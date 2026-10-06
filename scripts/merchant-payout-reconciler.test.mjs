import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { deriveMerchantPayoutReview, merchantPayoutFindings } from "./merchant-payout-reconciler.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { resolveArtifactContract } from "./runtime-evidence-lib.mjs";

const base = new URL("../sources/merchant-payout-reconciler/", import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, base), "utf8"));
const fixture = await read("fixtures/merchant-payout.example.json");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(await read("schemas/merchant-payout.schema.json"));
const clone = () => structuredClone(fixture);
const refresh = f => { f.review = deriveMerchantPayoutReview(f); return f; };
const valid = f => {
  assert(validate(f), JSON.stringify(validate.errors));
  assert.deepEqual(merchantPayoutFindings(f), []);
};
const rejects = (f, code) => assert(merchantPayoutFindings(f).some(x => x.code === code), JSON.stringify(merchantPayoutFindings(f)));

test("merchant payout: packaged instructions resolve the registered structured output", async () => {
  const catalog = await readCatalog({ loadResources: false });
  const id = "merchant-payout-reconciler";
  const entry = catalog.entries.find(e => e.id === id);
  const experience = (await readExperienceCases(catalog)).find(e => e.id === id);
  const contract = await resolveArtifactContract({ entry, experience });
  assert.equal(contract.structuredPath, "outputs/merchant-payout-review.json");
  assert.equal(contract.schemaName, "merchant-payout.schema.json");
  assert.equal(contract.handoffPath, "outputs/merchant-payout-reconciler-handoff.md");
});

test("merchant payout: unused association sources and disguised processor receipt evidence fail", () => {
  let f = clone(); f.sources.find(s => s.kind === "bank").issuerRef = "processor-demo";
  rejects(refresh(f), "invalid_payout_issuer");
  f = clone(); f.mappings = []; rejects(refresh(f), "unbound_payout_source");
});

test("merchant payout: strict registered synthetic workpaper preserves independent residuals", () => {
  valid(fixture);
  assert.deepEqual(validateArtifactSemantics("merchant-payout-reconciler", fixture), []);
  const row = fixture.review.rows[0];
  assert.equal(row.grossMinor, 90000);
  assert.equal(row.feeMinor, 3500);
  assert.equal(row.netMinor, 86500);
  assert.equal(row.memberResidualMinor, 0);
  assert.equal(row.bankResidualMinor, -500);
  assert.equal(fixture.review.unsettledMinor, 19400);
  assert.deepEqual(fixture.review.questions.map(x => x.reason), ["bank-residual", "unsettled"]);
});

test("merchant payout: missing receipts are unknown, never zero or processor-paid evidence", () => {
  const f = clone(); f.bankReceipts = []; f.mappings = []; f.scope.bankReceiptRefs = [];
  f.sources = f.sources.filter(s => !["bank", "mapping"].includes(s.kind));
  valid(refresh(f));
  assert.equal(f.review.rows[0].bankMinor, null);
  assert.equal(f.review.rows[0].bankResidualMinor, null);
  assert(f.review.questions.some(x => x.reason === "bank-evidence-missing"));
});

test("merchant payout: unmatched bank rows stay owner questions", () => {
  const f = clone(); f.mappings = []; f.sources = f.sources.filter(s => s.kind !== "mapping");
  valid(refresh(f));
  assert(f.review.questions.some(x => x.reason === "unmapped-bank-row"));
});

test("merchant payout: manual and instant missing membership cannot infer transactions by amount", () => {
  for (const kind of ["automatic", "manual", "instant"]) {
    const f = clone(); f.payouts[0].kind = kind; f.payouts[0].memberRefs = [];
    f.payouts[0].membershipSourceRef = null; f.sources = f.sources.filter(s => s.kind !== "membership");
    f.transactions.slice(0, 3).forEach(t => { t.disposition = "unresolved"; t.payoutRef = null; });
    valid(refresh(f));
    assert.equal(f.review.rows[0].memberResidualMinor, null);
    assert.equal(f.review.rows[0].grossMinor, null);
    assert.equal(f.review.rows[0].feeMinor, null);
    assert.equal(f.review.rows[0].netMinor, null);
    assert(f.review.questions.some(x => x.reason === "membership-missing"));
  }
  const f = clone(); f.payouts[0].membershipSourceRef = null;
  rejects(refresh(f), "missing_attributable_membership");
});

function retry(status = "failed") {
  const f = clone(); const prior = f.payouts[0]; prior.status = status;
  const next = { ...prior, id: "payout-retry", nativeId: "native-retry", status: "paid",
    priorAttemptRef: prior.id, occurredAt: "2026-09-06T12:00:00Z", membershipSourceRef: "source-retry-members" };
  f.payouts.push(next); f.scope.payoutRefs.push(next.id);
  f.sources.find(s => s.kind === "payouts").payoutRefs.push(next.id);
  const members = structuredClone(f.sources.find(s => s.kind === "membership"));
  members.id = next.membershipSourceRef; members.controlledRef = "controlled://merchant-payout/source-retry-members";
  members.payoutRefs = [next.id]; f.sources.push(members);
  f.transactions.filter(t => t.disposition === "assigned").forEach(t => { t.payoutRef = next.id; });
  return refresh(f);
}

test("merchant payout: failed and returned retries preserve historical receipts and exact lineage", () => {
  for (const status of ["failed", "returned"]) {
    const f = retry(status); valid(f);
    assert.equal(f.review.rows[0].current, false);
    assert.equal(f.review.rows[0].bankMinor, 86000);
    assert.equal(f.review.rows[1].current, true);
    assert.equal(f.review.rows[1].bankMinor, null);
    assert.equal(f.review.unsettledMinor, 19400);
  }
});

test("merchant payout: changed retry amount, lineage cycles and competing current membership fail", () => {
  let f = retry(); f.payouts[1].amountMinor++; rejects(refresh(f), "invalid_payout_retry");
  f = retry(); f.payouts[0].priorAttemptRef = "payout-retry"; rejects(refresh(f), "invalid_payout_retry");
  f = retry(); f.payouts[1].priorAttemptRef = null; rejects(refresh(f), "invalid_current_membership");
  f = retry(); f.payouts[0].status = "paid"; rejects(refresh(f), "invalid_payout_retry");
});

test("merchant payout: source population omission and repeated native IDs fail", () => {
  let f = clone(); f.transactions.pop(); f.scope.transactionRefs.pop(); rejects(refresh(f), "incomplete_payout_population");
  f = clone(); f.transactions[1].nativeId = f.transactions[0].nativeId; rejects(refresh(f), "duplicate_processor_observation");
  f = clone(); f.payouts[0].memberRefs.push("txn-charge"); rejects(refresh(f), "invalid_payout_evidence");
});

test("merchant payout: cross-account, stale, incomplete and role-swapped sources fail", () => {
  for (const [key, value] of [["accountRef", "account-other"], ["currency", "EUR"], ["current", false], ["complete", false], ["scale", 3]]) {
    const f = clone(); f.sources[0][key] = value; rejects(refresh(f), "invalid_payout_source");
  }
  const f = clone(); f.sources.find(s => s.kind === "bank").issuerKind = "processor";
  rejects(refresh(f), "invalid_payout_issuer");
});

test("merchant payout: evidence chronology, timezone and exact membership sources are required", () => {
  let f = clone(); f.sources.find(s => s.kind === "membership").issuedAt = "2026-09-01T00:00:00Z";
  rejects(refresh(f), "mismatched_membership_evidence");
  f = clone(); f.transactions[0].occurredAt = "2026-09-04T12:00:00Z"; rejects(refresh(f), "invalid_payout_chronology");
  f = clone(); f.scope.asOf = "2026-09-08T23:59:00"; rejects(refresh(f), "invalid_payout_scope");
  f = clone(); f.sources.find(s => s.kind === "membership").transactionRefs.pop(); rejects(refresh(f), "mismatched_membership_evidence");
});

test("merchant payout: owner mapping cannot be duplicated, reassigned or predate evidence", () => {
  let f = clone(); f.mappings.push({ ...f.mappings[0], id: "mapping-two" }); rejects(refresh(f), "duplicate_bank_mapping");
  f = clone(); f.mappings[0].ownerRef = "owner-other"; rejects(refresh(f), "invalid_bank_mapping");
  f = clone(); f.sources.find(s => s.kind === "mapping").issuedAt = "2026-09-04T00:00:00Z";
  rejects(refresh(f), "invalid_bank_mapping");
});

test("merchant payout: negative fee refund is added once and unsafe arithmetic fails closed", () => {
  const f = clone(); f.transactions[1].feeMinor = -100; f.transactions[1].netMinor = -9900;
  valid(refresh(f)); assert.equal(f.review.rows[0].memberResidualMinor, 100);
  f.transactions[0].grossMinor = Number.MAX_SAFE_INTEGER;
  f.transactions[0].feeMinor = -1;
  rejects(f, "invalid_merchant_payout_shape");
  const g = clone(); g.transactions[0].netMinor++; rejects(refresh(g), "incorrect_processor_net");
});

test("merchant payout: changed source revisions invalidate old review even when totals agree", () => {
  const f = clone(); f.sources[0].revision = "r2";
  rejects(f, "incorrect_payout_review"); valid(refresh(f));
});

test("merchant payout: bank debits cannot net away a receipt discrepancy", () => {
  const f = clone(); f.bankReceipts[0].amountMinor = 87000;
  f.bankReceipts.push({ ...f.bankReceipts[0], id: "bank-debit", nativeId: "native-debit", amountMinor: -500 });
  f.scope.bankReceiptRefs.push("bank-debit");
  f.sources.find(s => s.kind === "bank").bankReceiptRefs.push("bank-debit");
  const source = { ...f.sources.find(s => s.kind === "mapping"), id: "source-debit-map",
    controlledRef: "controlled://merchant-payout/source-debit-map", bankReceiptRefs: ["bank-debit"] };
  f.sources.push(source);
  f.mappings.push({ ...f.mappings[0], id: "mapping-debit", receiptRef: "bank-debit", sourceRef: source.id });
  rejects(refresh(f), "invalid_bank_mapping");
  f.mappings.pop(); f.sources.pop(); valid(refresh(f));
  assert.equal(f.review.rows[0].bankResidualMinor, 500);
  assert(f.review.questions.some(q => q.targetRef === "bank-debit" && q.reason === "unmapped-bank-row"));
});

test("merchant payout: all questions fit the supported maximum populations", () => {
  const f = clone();
  const transaction = { ...f.transactions[3] }, receipt = { ...f.bankReceipts[0] };
  const transactionSource = { ...f.sources[0] }, bankSource = { ...f.sources[3] };
  f.transactions = []; f.scope.transactionRefs = []; f.bankReceipts = []; f.scope.bankReceiptRefs = []; f.mappings = [];
  f.payouts = Array.from({ length: 1000 }, (_, i) => ({ ...f.payouts[0], id: `payout-${i}`, nativeId: `native-${i}`,
    status: "pending", memberRefs: [], membershipSourceRef: null }));
  f.scope.payoutRefs = f.payouts.map(p => p.id);
  f.sources = f.sources.filter(s => s.kind === "payouts"); f.sources[0].payoutRefs = [...f.scope.payoutRefs];
  f.transactions = Array.from({ length: 1000 }, (_, i) => ({ ...transaction, id: `unsettled-${i}`, nativeId: `native-unsettled-${i}` }));
  f.bankReceipts = Array.from({ length: 1000 }, (_, i) => ({ ...receipt, id: `bank-${i}`, nativeId: `native-bank-${i}` }));
  f.scope.transactionRefs = f.transactions.map(t => t.id); transactionSource.transactionRefs = [...f.scope.transactionRefs];
  f.scope.bankReceiptRefs = f.bankReceipts.map(r => r.id); bankSource.bankReceiptRefs = [...f.scope.bankReceiptRefs];
  f.sources.push(transactionSource, bankSource);
  valid(refresh(f));
  assert.equal(f.review.questions.length, 5000);
});

test("merchant payout: harmless object key reordering preserves review freshness", () => {
  const reverse = value => Array.isArray(value) ? value.map(reverse) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)])) : value;
  valid(reverse(clone()));
});

test("merchant payout: hidden residuals, authority escalation and undeclared fields fail", () => {
  for (const [key, value] of [["externalActions", "retry-payout"], ["settlementCertification", "settled"], ["state", "approved"]]) {
    const f = clone(); f.review[key] = value; assert.equal(validate(f), false); rejects(f, "incorrect_payout_review");
  }
  let f = clone(); f.review.questions = []; rejects(f, "incorrect_payout_review");
  f = clone(); f.bankAccountNumber = "sensitive"; assert.equal(validate(f), false);
  f = clone(); f.sources[0].controlledRef = "https://processor.example/export?token=secret"; assert.equal(validate(f), false);
});
