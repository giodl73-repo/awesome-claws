import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { deriveInvoiceDraft, invoiceDraftFindings, renderInvoiceDraft } from "./invoice-draft-producer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";

const root = new URL("../sources/invoice-draft-producer/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/invoice-draft.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/invoice-draft.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const refresh = (record) => { record.result = deriveInvoiceDraft(record); return record; };

test("invoice: packaged digest recipe computes the exact current input fingerprint", async () => {
  const reference = await readFile(new URL("references/billing-contract.md", root), "utf8");
  const code = reference.match(/```js\r?\n([\s\S]*?)\r?\n```/)[1];
  const { computeInvoiceInputDigest } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  for (const change of [() => {}, (value) => { value.items[0].sourceRef = "SOURCE-CHANGED"; }, (value) => { value.scope.reviewer = "\u00c9lodie"; }, (value) => { value.scope = Object.fromEntries(Object.entries(value.scope).reverse()); }]) {
    const value = clone(); change(value);
    assert.equal(computeInvoiceInputDigest(value), deriveInvoiceDraft(value).inputDigest);
  }
});

test("invoice: normalized agent identities cannot stand in for the human reviewer", () => {
  for (const reviewer of ["Invoice draft producer", " invoice-draft-producer ", "invoice_draft_producer", "INVOICE   DRAFT PRODUCER", " assistant ", "\uff41ssistant"]) {
    const value = clone(); value.scope.reviewer = reviewer;
    assert.throws(() => deriveInvoiceDraft(value), /human reviewer/);
    assert(invoiceDraftFindings(value).some((finding) => finding.code === "invoice_input"));
  }
  const value = clone(); value.scope.reviewer = "Assistant manager Maya"; refresh(value);
  assert.deepEqual(invoiceDraftFindings(value), []);
});

test("invoice: accepted example produces the actual invoice and separate blocked workpaper", async () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(invoiceDraftFindings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("invoice-draft-producer", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["invoice-draft-producer"], "invoice-draft.schema.json");
  assert.deepEqual(fixture.result.totals, { gross: 97500, discount: 7500, net: 90000, tax: 1440, total: 91440, applications: 25000, due: 66440 });
  assert.equal(fixture.result.state, "blocked");
  assert.equal(fixture.result.dueDate, "2026-10-16");
  assert.equal(fixture.result.coverage[3].disposition, "already-billed");
  const rendered = renderInvoiceDraft(fixture);
  assert.equal(rendered.draft, await readFile(new URL("fixtures/invoice.example.md", root), "utf8"));
  assert.equal(rendered.workpaper, await readFile(new URL("fixtures/workpaper.example.md", root), "utf8"));
  assert.match(rendered.draft, /USD 664\.40/);
  assert.match(rendered.workpaper, /WORK-102/);
  for (const secret of ["WORK-101", "WORK-102", "AGREEMENT-3", "OWNER-APPLICATION-1", "Demo billing owner", "Owner-only"]) assert(!rendered.draft.includes(secret), secret);
});

test("invoice: explicit deferral permits owner review, never issuance", () => {
  const value = clone();
  Object.assign(value.items[4], { decision: "defer", decisionRef: "OWNER-DEFERRAL-102" });
  refresh(value);
  assert.deepEqual(invoiceDraftFindings(value), []);
  assert.equal(value.result.state, "ready-for-owner-review");
  assert.equal(value.result.totals.due, 66440);
  assert.match(renderInvoiceDraft(value).draft, /DRAFT - NOT ISSUED/);
});

test("invoice: a missing required PO stays visibly unresolved in the customer draft", () => {
  const value = clone();
  Object.assign(value.items[4], { decision: "defer", decisionRef: "OWNER-DEFERRAL-102" });
  value.scope.purchaseOrder = null;
  value.rules.poRequired = true;
  refresh(value);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.result.state, "blocked");
  assert(value.result.blockers.some((item) => item.reason === "Supply the required customer PO."));
  assert.match(renderInvoiceDraft(value).draft, /Customer PO: Required - pending owner input/);
  assert(!renderInvoiceDraft(value).draft.includes("Not required under supplied rules"));
  value.rules.poRequired = false;
  refresh(value);
  assert.equal(value.result.state, "ready-for-owner-review");
  assert.match(renderInvoiceDraft(value).draft, /Customer PO: Not required under supplied rules/);
});

test("invoice: generated handoff selects the private workpaper, not the customer invoice", async () => {
  const agents = await readFile(new URL("../claws/invoice-draft-producer/workspace/AGENTS.md", import.meta.url), "utf8");
  assert(agents.includes("Render the reviewable handoff with `templates/invoice-draft.md` at `outputs/invoice-draft-producer-handoff.md`"));
  const workpaper = await readFile(new URL("templates/invoice-draft.md", root), "utf8");
  assert.match(workpaper, /^# Private billing workpaper/);
  assert.match(workpaper, /## Work coverage/);
  assert.match(workpaper, /Unresolved items and specific owner questions/);
  assert(workpaper.includes("`templates/customer-invoice.md`"));
  const customer = await readFile(new URL("templates/customer-invoice.md", root), "utf8");
  assert.match(customer, /^# DRAFT - NOT ISSUED/);
  assert(!customer.includes("## Work coverage"));
});

test("invoice: a billing period can include multiple shorter service intervals", () => {
  const value = clone();
  value.scope.periodStart = "2026-09-30";
  value.items[1].periodStart = "2026-09-30";
  value.items[1].periodEnd = "2026-09-30";
  Object.assign(value.items[4], { decision: "defer", decisionRef: "OWNER-DEFERRAL-102" });
  refresh(value);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(invoiceDraftFindings(value), []);
  assert.equal(value.result.state, "ready-for-owner-review");
  assert.deepEqual(value.result.totals, fixture.result.totals);
});

test("invoice: out-of-period and reversed service intervals remain blocked", () => {
  for (const [start, end] of [["2026-09-30", "2026-10-01"], ["2026-10-01", "2026-10-02"], ["2026-10-02", "2026-10-01"]]) {
    const value = clone();
    value.items[0].periodStart = start; value.items[0].periodEnd = end;
    refresh(value);
    assert.equal(value.result.coverage[0].disposition, "blocked");
    assert(!value.result.lines.some((line) => line.sourceId === value.items[0].id));
    assert(value.result.blockers.some((item) => item.reason === "Resolve source service-period mismatch."));
  }
});

test("invoice: blocked foreign balances retain their currency and raw source units", () => {
  for (const currency of ["EUR", "JPY"]) {
    const value = clone(); value.balances[0].currency = currency;
    refresh(value);
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
    assert.deepEqual(invoiceDraftFindings(value), []);
    assert.equal(value.result.applications[0].state, "blocked");
    assert.equal(value.result.applications[0].included, 0);
    const row = renderInvoiceDraft(value).workpaper.split("\n").find((line) => line.startsWith(`- ${value.balances[0].id}/`));
    assert(row.includes(`remaining ${currency} ${value.balances[0].remaining} minor units`));
    assert(row.includes(`proposed ${currency} ${value.balances[0].proposed} minor units`));
    assert(row.includes("source precision not supplied; not converted"));
    assert(!row.includes("USD"));
  }
});

const mutations = [
  ["wrong total", (x) => x.result.totals.total++],
  ["wrong due date", (x) => { x.result.dueDate = "2026-10-17"; }],
  ["hidden unresolved item", (x) => { x.result.blockers = []; }],
  ["omitted coverage", (x) => x.result.coverage.pop()],
  ["duplicated invoice line", (x) => x.result.lines.push(structuredClone(x.result.lines[0]))],
  ["false readiness", (x) => { x.result.state = "ready-for-owner-review"; }],
  ["changed source revision", (x) => { x.items[0].revision = "3"; }],
  ["changed rate", (x) => { x.items[0].rateMinor = 15000; }],
  ["stale rule revision", (x) => { x.rules.revision = "4"; }],
  ["stale history revision", (x) => { x.history.revision = "6"; }],
  ["private notes injected into draft", (x) => { x.result.lines[0].description = "Private owner notes"; }],
  ["changed draft review", (x) => { x.scope.revision = "2"; }],
  ["changed seller", (x) => { x.scope.seller = "OTHER"; }],
  ["changed billing identity", (x) => { x.scope.customerBilling = "Other customer address"; }],
  ["changed currency precision", (x) => { x.scope.minorDigits = 0; }],
  ["changed source reference without revision", (x) => { x.items[0].sourceRef = "OTHER-SOURCE"; }],
];
for (const [name, mutate] of mutations) test(`invoice rejects ${name}`, () => {
  const value = clone(); mutate(value);
  assert(invoiceDraftFindings(value).some((f) => f.code === "invoice_result"));
  assert.throws(() => renderInvoiceDraft(value));
});

for (const key of ["invoice", "sending", "numbering", "ledger", "payment", "balances"]) test(`invoice rejects claimed external action: ${key}`, () => {
  const value = clone(); value.authority[key] = "completed";
  assert(invoiceDraftFindings(value).some((f) => f.code === "invoice_authority"));
  assert.throws(() => renderInvoiceDraft(value));
});

for (const [name, mutate] of [
  ["missing completion", (x) => { x.items[0].completed = false; }],
  ["missing approval evidence", (x) => { x.items[0].approvalRef = null; }],
  ["missing tax", (x) => { x.items[0].taxBps = null; }],
  ["stale record", (x) => { x.items[0].current = false; }],
  ["wrong customer", (x) => { x.items[0].customer = "OTHER"; }],
  ["mixed currency", (x) => { x.items[0].currency = "EUR"; }],
  ["wrong service period", (x) => { x.items[0].periodStart = "2026-09-01"; }],
  ["private description", (x) => { x.items[0].disclosureApproved = false; }],
  ["missing history declaration", (x) => { x.history.complete = false; }],
  ["unknown rounding", (x) => { x.rules.rounding = null; }],
  ["unconfirmed rules", (x) => { x.rules.confirmed = false; }],
]) test(`invoice retains ${name} as blocked coverage without charging it`, () => {
  const value = clone(); mutate(value); refresh(value);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(invoiceDraftFindings(value), []);
  assert.equal(value.result.coverage[0].disposition, "blocked");
  assert.equal(value.result.state, "blocked");
  assert(!value.result.lines.some((line) => line.sourceId === "WORK-101"));
});

for (const [name, mutate] of [
  ["duplicate work ID", (x) => x.items.push(structuredClone(x.items[0]))],
  ["duplicate work under another ID", (x) => x.items.push({ ...x.items[0], id: "DISGUISED-DUPLICATE" })],
  ["duplicate balance under another ID", (x) => x.balances.push({ ...x.balances[0], id: "DUPLICATE-BALANCE" })],
  ["duplicate history row", (x) => x.history.rows.push(structuredClone(x.history.rows[0]))],
  ["foreign history", (x) => { x.history.rows[0].customer = "OTHER"; }],
  ["history unit mismatch", (x) => { x.history.rows[0].unit = "days"; }],
  ["overbilled source", (x) => { x.history.rows[0].quantity = "3"; }],
  ["discount above gross", (x) => { x.items[0].discountMinor = 100000; }],
  ["unsafe integer", (x) => { x.items[0].rateMinor = Number.MAX_SAFE_INTEGER + 1; }],
  ["multiplication overflow", (x) => { x.items[0].rateMinor = Number.MAX_SAFE_INTEGER; }],
  ["invalid date", (x) => { x.scope.invoiceDate = "2026-02-30"; }],
  ["nonhuman reviewer", (x) => { x.scope.reviewer = "assistant"; }],
]) test(`invoice rejects invalid input: ${name}`, () => {
  const value = clone(); mutate(value);
  assert(invoiceDraftFindings(value).some((f) => f.code === "invoice_input"));
});

for (const [key, value] of Object.entries({ customer: "OTHER", currency: "EUR", remaining: 1, current: false, authorized: false, authorizationRef: null, draftRevision: "0", draftRef: "OTHER" })) test(`invoice excludes unsupported balance ${key}`, () => {
  const record = clone(); record.balances[0][key] = value; refresh(record);
  assert.equal(record.result.applications[0].state, "blocked");
  assert.equal(record.result.applications[0].included, 0);
  assert.equal(record.result.totals.due, 86440);
  assert.deepEqual(invoiceDraftFindings(record), []);
});

test("invoice: over-application remains unresolved, never a negative payable or silently clipped credit", () => {
  const value = clone(); value.balances[0].remaining = 100000; value.balances[0].proposed = 100000; refresh(value);
  assert.equal(value.result.totals.due, null);
  assert.equal(value.result.totals.applications, 105000);
  assert.equal(value.result.state, "blocked");
  assert.match(renderInvoiceDraft(value).draft, /Proposed amount due: Unresolved/);
});

test("invoice: partial prior billing subtracts quantities before calculating the new line", () => {
  const value = clone(); value.items[0].quantity = "8";
  value.history.rows.push({ ...value.history.rows[0], sourceId: "WORK-101", invoiceRef: "OLDER-INVOICE" });
  refresh(value);
  assert.equal(value.result.lines[0].quantity, "6");
  assert.equal(value.result.totals.due, 66440);
});

test("invoice: zero work cannot be labeled already billed without any billing history", () => {
  const value = clone(); value.items[0].quantity = "0"; refresh(value);
  assert.equal(value.result.coverage[0].disposition, "blocked");
  assert(value.result.blockers.some((blocker) => blocker.reason.includes("zero work")));
  assert(!value.result.lines.some((line) => line.sourceId === "WORK-101"));
});

for (const [name, unit, description] of [["fixed-fee", "milestone", "Completed installation milestone"], ["recurring", "period", "October service period"]]) test(`invoice: owner-defined ${name} billing creates a real line and checks prior coverage`, () => {
  const value = clone();
  value.items = [{ ...value.items[0], id: "FEE", quantity: "1", unit, description, rateMinor: 100000, discountMinor: 0 }];
  value.history.rows = []; value.balances = []; refresh(value);
  assert.equal(value.result.state, "ready-for-owner-review");
  assert.equal(value.result.totals.due, 100000);
  assert.match(renderInvoiceDraft(value).draft, new RegExp(description));
  value.history.rows.push({ sourceId: "FEE", quantity: "1", unit, invoiceRef: "PRIOR", customer: value.scope.customer, currency: "USD" }); refresh(value);
  assert.equal(value.result.lines.length, 0);
  assert.equal(value.result.coverage[0].disposition, "already-billed");
});

test("invoice: fractional quantity and tax round half-up using exact integer arithmetic", () => {
  const value = clone();
  value.items = [{ ...value.items[0], quantity: "0.5", rateMinor: 101, discountMinor: 0, taxBps: 1000 }];
  value.history.rows = []; value.balances = []; refresh(value);
  assert.deepEqual(value.result.totals, { gross: 51, discount: 0, net: 51, tax: 5, total: 56, applications: 0, due: 56 });
});

test("invoice: source text cannot inject HTML or Markdown destinations into rendered artifacts", () => {
  const value = clone(); value.items[0].description = '<script>send()</script> [pay](https://invalid.example) | fake'; refresh(value);
  const { draft } = renderInvoiceDraft(value);
  assert(!draft.includes("<script>"));
  assert(draft.includes("&#124; fake"));
  assert(draft.includes("\\[pay\\]"));
});
