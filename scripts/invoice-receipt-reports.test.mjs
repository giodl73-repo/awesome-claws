import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { artifactSchemaName, validateArtifact } from "./artifact-validator-registry.mjs";
import { invoiceReceiptReportDefinition, invoiceReceiptReportFindings } from "./invoice-receipt-reports.mjs";
import { reconcileInvoiceReceipts, renderInvoiceReceiptWorkpaper } from "./invoice-receipt-workpaper.mjs";
import { reconcileLegacyReceiptPayments, renderLegacyReceiptReview } from "./invoice-receipt-legacy-map.mjs";

const base = new URL("../sources/invoice-payment-followup/fixtures/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, base), "utf8"));
const receiptInput = await read("receipt-workpaper.example.json");
const linked = {
  legacy: await read("invoice-receivables.example.json"),
  receiptInput: await read("receipt-application.example.json"),
  mapping: await read("receipt-legacy-map.example.json"),
};

async function check(value, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "invoice-receipt-report-"));
  try {
    const artifactPath = join(dir, "artifact.json");
    await writeFile(artifactPath, JSON.stringify(value));
    return await validateArtifact({ id: "invoice-payment-followup", artifactPath,
      scenarioType: "accepted-task", mode: "mock-plus", ...options });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("report fixtures and handoffs exactly match recomputation", async () => {
  assert.deepEqual(await read("receipt-workpaper-report.example.json"), reconcileInvoiceReceipts(receiptInput));
  assert.deepEqual(await read("receipt-legacy-review.example.json"), reconcileLegacyReceiptPayments(linked));
  assert.equal((await readFile(new URL("receipt-handoff.example.md", base), "utf8")).replace(/\r\n/g, "\n"), renderInvoiceReceiptWorkpaper(receiptInput));
  assert.equal((await readFile(new URL("receipt-legacy-handoff.example.md", base), "utf8")).replace(/\r\n/g, "\n"), renderLegacyReceiptReview(linked));
});

test("runtime registry accepts old invoice format and both explicit report versions without cache collision", async () => {
  for (const value of [linked.legacy, reconcileInvoiceReceipts(receiptInput), reconcileLegacyReceiptPayments(linked), linked.legacy]) {
    const result = await check(value);
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.equal(result.schema.name, artifactSchemaName("invoice-payment-followup", value.schemaVersion));
  }
  assert.equal(artifactSchemaName("invoice-payment-followup"), "invoice-receivables.schema.json");
});

test("report dispatch is scoped to Invoice Follow-up and exact own version keys", async () => {
  assert.equal(invoiceReceiptReportDefinition("project-manager", "awesomeClaws.receiptWorkpaperReport.v1"), null);
  for (const schemaVersion of ["toString", "__proto__", "awesomeClaws.receiptWorkpaperReport.v2"]) {
    const value = { ...reconcileInvoiceReceipts(receiptInput), schemaVersion };
    const result = await check(value);
    assert.equal(result.valid, false);
    assert.equal(result.schema.name, "invoice-receivables.schema.json");
  }
  assert.equal((await check(reconcileInvoiceReceipts(receiptInput), { id: "project-manager" })).valid, false);
});

test("malformed version values are rejected as artifacts, not coerced into dispatch keys", async () => {
  for (const schemaVersion of [null, 1, [], {}, { toString: null }, { toString: {}, valueOf: null }]) {
    const value = { ...reconcileInvoiceReceipts(receiptInput), schemaVersion };
    assert.equal(invoiceReceiptReportDefinition("invoice-payment-followup", schemaVersion), null);
    assert.equal((await check(value)).valid, false);
  }
});

for (const [name, change] of [
  ["altered amount", (x) => { x.receipts[0].unallocatedMinor = 0; }],
  ["omitted receipt coverage", (x) => { x.receiptCoverage = []; }],
  ["omitted allocation", (x) => { x.allocations.pop(); }],
  ["omitted owner questions", (x) => { x.reviewQuestions = []; }],
  ["different evidence revision", (x) => { x.evidence.sources[0].revision = "V2"; }],
  ["different owner", (x) => { x.owner = "OTHER"; }],
]) test(`runtime recomputation rejects ${name}`, async () => {
  const value = reconcileInvoiceReceipts(receiptInput); change(value);
  const result = await check(value);
  assert.equal(result.schema.valid, true, JSON.stringify(result.schema));
  assert.equal(result.semantics.valid, false);
  assert.equal(result.valid, false);
});

test("truthfully blocked report is valid, but erased findings and fabricated totals are not", async () => {
  const input = structuredClone(receiptInput); input.receipts[0].identityRef = null;
  const value = reconcileInvoiceReceipts(input);
  assert.equal(value.state, "blocked");
  assert.equal((await check(value)).valid, true);
  value.findings = [];
  value.state = "ready-for-owner-review";
  value.receipts[0].allocatedMinor = 90000;
  value.receipts[0].unallocatedMinor = 10000;
  assert.equal((await check(value)).valid, false);
});

test("legacy linked report cannot hide missing coverage or change the original handoff state", async () => {
  const value = reconcileLegacyReceiptPayments(linked);
  value.legacyHandoffState = "ready-for-owner-review";
  assert.equal((await check(value)).semantics.valid, false);
  value.legacyHandoffState = linked.legacy.handoff.state;
  value.paymentCoverage = [];
  assert.equal((await check(value)).semantics.valid, false);
});

test("linked blocked evidence survives validation with every unresolved mapping visible", async () => {
  const input = structuredClone(linked); input.mapping.payments = [];
  const value = reconcileLegacyReceiptPayments(input);
  assert.equal(value.state, "blocked");
  assert.equal((await check(value)).valid, true);
  value.findings = [];
  assert.equal((await check(value)).valid, false);
});

test("unmappable long legacy IDs remain representable in a truthfully blocked report", async () => {
  const input = structuredClone(linked);
  const oldId = input.legacy.paymentEvidence[0].id;
  const longId = `payment-${"x".repeat(100)}`;
  input.legacy.paymentEvidence[0].id = longId;
  for (const question of input.legacy.reviewQuestions) question.refs = question.refs.map((ref) => ref === oldId ? longId : ref);
  input.mapping.payments = [];
  const value = reconcileLegacyReceiptPayments(input);
  assert.equal(value.state, "blocked");
  assert(value.paymentCoverage.includes(longId));
  assert.equal((await check(value)).valid, true);
});

test("schema rejects missing evidence, extra posting authority and combined totals", async () => {
  const value = reconcileInvoiceReceipts(receiptInput);
  delete value.evidence;
  assert.equal((await check(value)).schema.valid, false);
  const linkedValue = reconcileLegacyReceiptPayments(linked);
  linkedValue.accountingEntriesPosted = true;
  linkedValue.combinedCashTotal = 350000;
  assert.equal((await check(linkedValue)).schema.valid, false);
});

test("semantic helper is total on malformed reports and safe diagnostics do not echo evidence", async () => {
  for (const value of [null, {}, [], { schemaVersion: "awesomeClaws.receiptLegacyReview.v1", evidence: {} }]) {
    assert(invoiceReceiptReportFindings(value).length > 0);
  }
  const value = reconcileInvoiceReceipts(receiptInput); value.receipts[0].unallocatedMinor = 1;
  const result = await check(value, { diagnostics: "safe" });
  assert.deepEqual(Object.keys(result.semantics.findings[0]).sort(), ["code", "path"]);
});
