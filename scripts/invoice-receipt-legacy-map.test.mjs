import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../sources/invoice-payment-followup/fixtures/invoice-receivables.example.json" with { type: "json" };
import { legacyAmountMinor, reconcileLegacyReceiptPayments, renderLegacyReceiptReview } from "./invoice-receipt-legacy-map.mjs";

function input() {
  const at = "2026-08-29T12:00:00Z";
  return {
    legacy: structuredClone(fixture),
    receiptInput: {
      schemaVersion: "awesomeClaws.receiptWorkpaperInput.v1", asOf: at, owner: "AR-OWNER", scopeRef: "LEDGER-ACCOUNT-1",
      currencies: [{ code: "USD", scale: 2 }],
      sources: [{ id: "BANK", revision: "V1", capturedAt: at, kind: "receipt", scopeRef: "LEDGER-ACCOUNT-1" },
        { id: "APPLICATION", revision: "V1", capturedAt: at, kind: "application", scopeRef: "LEDGER-ACCOUNT-1" }],
      invoices: [{ id: "A", currency: "USD" }],
      receipts: [{ id: "R1", identityRef: "CASH-1", sourceRef: "BANK", sourceRevision: "V1", sourceRecord: "ROW-1", at,
        currency: "USD", amountMinor: 200000, status: "current" }],
      allocations: [{ id: "L1", identityRef: "APPLIED-1", receiptRef: "R1", invoiceRef: "A", sourceRef: "APPLICATION",
        sourceRevision: "V1", sourceRecord: "ROW-1", at, currency: "USD", amountMinor: 150000, basis: "application", status: "current" }],
    },
    mapping: {
      schemaVersion: "awesomeClaws.receiptLegacyMap.v1", owner: "AR-OWNER", ownerEvidenceRef: "OWNER-MAPPING-1",
      scopeRef: "LEDGER-ACCOUNT-1", ledgerRef: fixture.ledger.id, cutoffCompatibilityConfirmed: true,
      invoiceMappings: [{ legacyInvoiceRef: "invoice-atlas-1042", workpaperInvoiceRef: "A" }],
      payments: [{ paymentRef: "payment-atlas-partial", disposition: "represented", scopeRef: "LEDGER-ACCOUNT-1",
        evidenceRef: "OWNER-LINK-1", allocationRefs: ["L1"] }],
    },
  };
}

test("legacy payment equivalence does not double count cash or change existing units/balances", () => {
  const value = input();
  const before = structuredClone(value);
  const report = reconcileLegacyReceiptPayments(value);
  assert.deepEqual(report.findings, []);
  assert.equal(report.state, "ready-for-owner-review");
  assert.equal(report.workpaper.receipts[0].allocatedMinor, 150000);
  assert.equal(report.workpaper.receipts[0].unallocatedMinor, 50000);
  assert.equal(report.evidence.legacy.paymentEvidence[0].amount, 1500);
  assert.equal(report.evidence.legacy.invoices[0].balanceDue, 900);
  assert.equal(report.legacyHandoffState, fixture.handoff.state);
  assert.equal(report.combinedCashTotal, null);
  assert.equal(report.invoiceBalancesChanged, false);
  assert.equal(report.accountingEntriesPosted, false);
  assert.deepEqual(value, before);
  assert.deepEqual(report.evidence, value);
});

test("one legacy payment can identify multiple whole allocation rows exactly once", () => {
  const value = input();
  value.receiptInput.allocations[0].amountMinor = 100000;
  value.receiptInput.allocations.push({ ...value.receiptInput.allocations[0], id: "L2", identityRef: "APPLIED-2", sourceRecord: "ROW-2", amountMinor: 50000 });
  value.mapping.payments[0].allocationRefs.push("L2");
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.state, "ready-for-owner-review");
  assert.equal(report.workpaper.receipts[0].allocatedMinor, 150000);
});

for (const [name, change, code] of [
  ["missing disposition", (x) => { x.mapping.payments = []; }, "missing_payment_disposition"],
  ["extra disposition", (x) => { x.mapping.payments.push({ ...x.mapping.payments[0], paymentRef: "UNKNOWN" }); }, "unknown_payment"],
  ["duplicate disposition", (x) => { x.mapping.payments.push({ ...x.mapping.payments[0] }); }, "duplicate_payment_disposition"],
  ["reused allocation", (x) => { x.mapping.payments.push({ ...x.mapping.payments[0] }); }, "reused_allocation"],
  ["unknown allocation", (x) => { x.mapping.payments[0].allocationRefs = ["UNKNOWN"]; }, "unknown_allocation"],
  ["missing invoice equivalence", (x) => { x.mapping.invoiceMappings = []; }, "missing_invoice_mapping"],
  ["wrong ledger", (x) => { x.mapping.ledgerRef = "OTHER"; }, "mapping_scope"],
  ["unconfirmed cutoff", (x) => { x.mapping.cutoffCompatibilityConfirmed = false; }, "cutoff_unresolved"],
  ["unresolved identity", (x) => { x.mapping.payments[0].disposition = "unresolved"; x.mapping.payments[0].allocationRefs = []; }, "payment_identity_unresolved"],
  ["false outside scope", (x) => { x.mapping.payments[0].disposition = "outside-scope"; x.mapping.payments[0].allocationRefs = []; }, "outside_scope_conflict"],
  ["mapped invoice excluded as outside scope", (x) => { x.mapping.payments[0].disposition = "outside-scope"; x.mapping.payments[0].scopeRef = "OTHER"; x.mapping.payments[0].allocationRefs = []; }, "outside_scope_conflict"],
  ["remittance promoted to application", (x) => { x.receiptInput.sources[1].kind = "remittance"; x.receiptInput.allocations[0].basis = "remittance"; }, "confirmed_payment_without_application"],
  ["wrong currency", (x) => { x.receiptInput.allocations[0].currency = "EUR"; }, "allocation_payment_mismatch"],
  ["amount drift", (x) => { x.receiptInput.allocations[0].amountMinor = 149999; }, "legacy_amount_mismatch"],
  ["reversed application", (x) => { x.receiptInput.allocations[0].status = "reversed"; }, "allocation_not_current"],
  ["legacy balance conflict", (x) => { x.legacy.invoices[0].balanceDue = 0; }, "legacy_semantics"],
]) test(`${name} blocks linked review and preserves original evidence`, () => {
  const value = input(); change(value);
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === code), JSON.stringify(report.findings));
  assert.deepEqual(report.evidence, value);
  assert.equal(report.combinedCashTotal, null);
  assert.equal(report.invoiceBalancesChanged, false);
});

test("owner-disposed genuinely outside-scope payment stays outside without proving cash availability", () => {
  const value = input();
  value.mapping.invoiceMappings = [];
  value.mapping.payments[0] = { ...value.mapping.payments[0], disposition: "outside-scope", scopeRef: "OTHER-LEDGER-ACCOUNT", allocationRefs: [] };
  value.receiptInput.allocations = [];
  value.receiptInput.invoices = [];
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.state, "ready-for-owner-review");
  assert.deepEqual(report.paymentCoverage, ["payment-atlas-partial"]);
  assert.equal(report.evidence.legacy.paymentEvidence[0].amount, 1500);
  assert.equal(report.combinedCashTotal, null);
});

test("nonconfirmed legacy rows are not upgraded by current accounting application", () => {
  const value = input();
  value.legacy.paymentEvidence[0].state = "pending-owner-review";
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === "payment_state_conflict"));
  assert.equal(report.evidence.legacy.paymentEvidence[0].state, "pending-owner-review");
});

test("owner cutoff assertion cannot override a confirmed application after the legacy snapshot", () => {
  const value = input();
  const after = "2026-09-02T12:00:00Z";
  value.receiptInput.asOf = after;
  for (const source of value.receiptInput.sources) source.capturedAt = after;
  value.receiptInput.receipts[0].at = after;
  value.receiptInput.allocations[0].at = after;
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === "application_after_legacy_snapshot"));
});

test("legacy snapshot cutoff uses its local day, not UTC midnight", () => {
  const value = input();
  const sameLocalDay = "2026-08-30T06:59:59Z";
  value.receiptInput.asOf = "2026-08-30T08:00:00Z";
  for (const source of value.receiptInput.sources) source.capturedAt = value.receiptInput.asOf;
  value.receiptInput.receipts[0].at = sameLocalDay;
  value.receiptInput.allocations[0].at = sameLocalDay;
  assert.equal(reconcileLegacyReceiptPayments(value).state, "ready-for-owner-review");
  value.receiptInput.allocations[0].at = "2026-08-30T07:00:00Z";
  assert.ok(reconcileLegacyReceiptPayments(value).findings.some((row) => row.code === "application_after_legacy_snapshot"));
});

test("stale source blocks represented nonconfirmed payment even when legacy semantics allow it", () => {
  const value = input();
  value.legacy.paymentEvidence[0].state = "pending-owner-review";
  value.legacy.sources.find((row) => row.id === "source-bank-record").freshness = "stale";
  value.legacy.invoices[0].status = "stale";
  value.legacy.followUps[0].state = "blocked";
  value.receiptInput.sources[1].kind = "remittance";
  value.receiptInput.allocations[0].basis = "remittance";
  const report = reconcileLegacyReceiptPayments(value);
  assert.equal(report.findings.some((row) => row.code === "legacy_semantics"), false);
  assert.ok(report.findings.some((row) => row.code === "legacy_payment_source_not_current"));
  assert.equal(report.state, "blocked");
  assert.equal(report.evidence.legacy.paymentEvidence[0].state, "pending-owner-review");
});

test("unknown legacy timezone blocks chronology rather than assuming UTC", () => {
  const value = input(); value.legacy.ledger.timezone = "Unknown/Timezone";
  assert.ok(reconcileLegacyReceiptPayments(value).findings.some((row) => row.code === "legacy_cutoff_invalid"));
});

test("legacy decimal interpretation is exact, scale-aware and rejects excess precision", () => {
  assert.equal(legacyAmountMinor(1500, 2), 150000n);
  assert.equal(legacyAmountMinor(1.25, 2), 125n);
  assert.equal(legacyAmountMinor(1e-6, 6), 1n);
  assert.equal(legacyAmountMinor(1e-7, 6), null);
  assert.equal(legacyAmountMinor(0.1 + 0.2, 2), null);
  assert.equal(legacyAmountMinor(Number.MAX_SAFE_INTEGER, 0), BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(legacyAmountMinor(Number.MAX_SAFE_INTEGER, 2), null);
  assert.equal(legacyAmountMinor(1, undefined), null);
  assert.equal(legacyAmountMinor(1, 7), null);
});

test("invalid legacy and mapping structures do not reach equivalence checks", () => {
  const value = input();
  delete value.mapping.ownerEvidenceRef;
  assert.throws(() => reconcileLegacyReceiptPayments(value), /Invalid receipt legacy mapping/);
  value.mapping.ownerEvidenceRef = "OWNER-1";
  delete value.legacy.ledger;
  assert.throws(() => reconcileLegacyReceiptPayments(value), /Invalid legacy invoice artifact/);
});

test("linked Markdown preserves exact JSON and clearly separates original and minor units", () => {
  const value = input();
  const markdown = renderLegacyReceiptReview(value);
  const json = JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]);
  assert.deepEqual(json, reconcileLegacyReceiptPayments(value));
  assert.match(markdown, /payment-atlas-partial \| confirmed \| 1500 \| USD \| represented/);
  assert.match(markdown, /R1 \| USD \| 2 \| 200000 \| 150000 \| 50000/);
  assert.match(markdown, /Legacy handoff state \(unchanged\): blocked/);
  assert.match(markdown, /No combined cash total/);
});

test("legacy prose cannot break the embedded JSON fence", () => {
  const value = input();
  value.legacy.paymentEvidence[0].label = "Owner note ```json <b>text</b>";
  const markdown = renderLegacyReceiptReview(value);
  assert.equal(markdown.split("```json").length, 2);
  const json = JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]);
  assert.equal(json.evidence.legacy.paymentEvidence[0].label, value.legacy.paymentEvidence[0].label);
});

test("missing payment disposition remains visible in linked Markdown", () => {
  const value = input(); value.mapping.payments = [];
  const markdown = renderLegacyReceiptReview(value);
  assert.match(markdown, /Mapping state: blocked/);
  assert.match(markdown, /payment-atlas-partial \| confirmed \| 1500 \| USD \| MISSING/);
  assert.match(markdown, /Resolve missing_payment_disposition for payment-atlas-partial/);
});
