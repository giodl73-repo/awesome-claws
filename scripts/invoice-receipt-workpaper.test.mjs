import assert from "node:assert/strict";
import test from "node:test";
import { reconcileInvoiceReceipts, renderInvoiceReceiptWorkpaper } from "./invoice-receipt-workpaper.mjs";

const at = "2026-10-04T10:00:00Z";
function input() {
  return { schemaVersion: "awesomeClaws.receiptWorkpaperInput.v1", asOf: at, owner: "AR-OWNER", scopeRef: "LEDGER-ACCOUNT-1",
    currencies: [{ code: "USD", scale: 2 }],
    sources: [{ id: "BANK", revision: "V1", capturedAt: at, kind: "receipt", scopeRef: "LEDGER-ACCOUNT-1" },
      { id: "REMIT", revision: "V1", capturedAt: at, kind: "remittance", scopeRef: "LEDGER-ACCOUNT-1" }],
    invoices: [{ id: "A", currency: "USD" }, { id: "B", currency: "USD" }],
    receipts: [{ id: "R1", identityRef: "CASH-1", sourceRef: "BANK", sourceRevision: "V1", sourceRecord: "ROW-1", at,
      currency: "USD", amountMinor: 100000, status: "current" }],
    allocations: [["L1", "A", 60000], ["L2", "B", 30000]].map(([id, invoiceRef, amountMinor]) => ({
      id, identityRef: `ALLOCATION-${id}`, receiptRef: "R1", invoiceRef, sourceRef: "REMIT", sourceRevision: "V1", sourceRecord: id, at,
      currency: "USD", amountMinor, basis: "remittance", status: "current" })) };
}

test("conserves a partial receipt without upgrading remittance to applied payment", () => {
  const value = input();
  const before = structuredClone(value);
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "ready-for-owner-review");
  assert.equal(report.receipts[0].allocatedMinor, 90000);
  assert.equal(report.receipts[0].unallocatedMinor, 10000);
  assert.deepEqual(report.allocations.map((row) => row.basis), ["remittance", "remittance"]);
  assert.equal(report.invoiceBalancesChanged, false);
  assert.equal(report.accountingEntriesPosted, false);
  assert.deepEqual(value, before);
});

test("wholly unapplied receipt needs no invented invoice", () => {
  const value = input(); value.invoices = []; value.allocations = [];
  assert.equal(reconcileInvoiceReceipts(value).receipts[0].unallocatedMinor, 100000);
});

test("fully allocated receipt has an explicit zero remainder", () => {
  const value = input(); value.allocations[1].amountMinor = 40000;
  assert.equal(reconcileInvoiceReceipts(value).receipts[0].unallocatedMinor, 0);
});

test("application cannot precede its receipt", () => {
  const value = input();
  value.sources[1].kind = "application";
  for (const row of value.allocations) row.basis = "application";
  value.allocations[0].at = "2026-10-03T10:00:00Z";
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === "application_before_receipt" && row.id === "L1"));
  assert.equal(report.receipts[0].allocatedMinor, null);
  assert.equal(report.receipts[0].unallocatedMinor, null);
});

test("remittance advice may precede receipt without asserting accounting application", () => {
  const value = input();
  value.allocations[0].at = "2026-10-03T10:00:00Z";
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "ready-for-owner-review");
  assert.equal(report.allocations[0].basis, "remittance");
  assert.equal(report.invoiceBalancesChanged, false);
});

test("application chronology compares instants rather than local dates", () => {
  const value = input();
  value.sources[1].kind = "application";
  for (const row of value.allocations) {
    row.basis = "application";
    row.at = "2026-10-04T05:00:00-05:00";
  }
  assert.equal(reconcileInvoiceReceipts(value).state, "ready-for-owner-review");
});

for (const [name, change, code] of [
  ["overallocated", (x) => { x.allocations[1].amountMinor = 50000; }, "overallocated_receipt"],
  ["stale", (x) => { x.receipts[0].sourceRevision = "V0"; }, "source_revision"],
  ["receipt inferred from remittance", (x) => { x.receipts[0].sourceRef = "REMIT"; }, "source_kind"],
  ["replayed allocation", (x) => { x.allocations[1].sourceRecord = "L1"; }, "duplicate_source_record"],
  ["unknown invoice", (x) => { x.allocations[0].invoiceRef = "UNKNOWN"; }, "invoice_reference"],
  ["cross currency", (x) => { x.invoices[0].currency = "EUR"; }, "currency_mismatch"],
  ["reversed receipt", (x) => { x.receipts[0].status = "reversed"; }, "unresolved_record"],
  ["future source", (x) => { x.sources[0].capturedAt = "2026-10-05T10:00:00Z"; }, "future_source"],
  ["unknown receipt identity", (x) => { x.receipts[0].identityRef = null; }, "unresolved_identity"],
  ["unknown allocation identity", (x) => { x.allocations[0].identityRef = null; }, "unresolved_identity"],
  ["cross-ledger evidence", (x) => { x.sources[0].scopeRef = "OTHER-LEDGER"; }, "source_scope"],
  ["unresolved source scope", (x) => { x.sources[0].scopeRef = null; }, "source_scope"],
  ["replayed allocation identity", (x) => { x.allocations[1].identityRef = x.allocations[0].identityRef; }, "duplicate_allocations_identity"],
]) test(`${name} blocks derived balances but retains every record`, () => {
  const value = input(); change(value);
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === code));
  assert.equal(report.receipts[0].unallocatedMinor, null);
  assert.equal(report.receipts[0].allocatedMinor, null);
  assert.deepEqual(report.receiptCoverage, ["R1"]);
  assert.deepEqual(report.allocationCoverage, ["L1", "L2"]);
  assert.deepEqual(report.evidence, value);
  assert.deepEqual(report.allocations, value.allocations);
  assert.ok(report.reviewQuestions.some((row) => row.code === code && row.owner === value.owner));
});

test("same cash represented by different sources is not counted twice", () => {
  const value = input();
  value.sources.push({ ...value.sources[0], id: "EXPORT" });
  value.receipts.push({ ...value.receipts[0], id: "R2", sourceRef: "EXPORT", sourceRecord: "COPY-1" });
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === "duplicate_receipts_identity"));
  assert.deepEqual(report.receiptCoverage, ["R1", "R2"]);
  assert(report.receipts.every((row) => row.unallocatedMinor === null));
});

test("corrected receipt revisions stay visible without generating additional cash", () => {
  const value = input();
  value.receipts[0].status = "superseded";
  value.receipts.push({ ...value.receipts[0], id: "R2", sourceRevision: "V2", status: "current", amountMinor: 120000 });
  value.sources[0].revision = "V2";
  const report = reconcileInvoiceReceipts(value);
  assert.equal(report.state, "blocked");
  assert.ok(report.findings.some((row) => row.code === "duplicate_source_record"));
  assert.deepEqual(report.evidence.receipts, value.receipts);
  assert.deepEqual(report.receipts.map((row) => row.amountMinor), [100000, 120000]);
  assert(report.receipts.every((row) => row.allocatedMinor === null));
});

test("report evidence is detached from input and retains source revisions and statuses", () => {
  const value = input();
  const report = reconcileInvoiceReceipts(value);
  assert.deepEqual(report.evidence, value);
  value.sources[0].revision = "CHANGED";
  value.allocations[0].amountMinor = 1;
  assert.equal(report.evidence.sources[0].revision, "V1");
  assert.equal(report.allocations[0].amountMinor, 60000);
  assert.equal(report.receipts[0].sourceRecord, "ROW-1");
  assert.equal(report.receipts[0].status, "current");
});

test("safe integer maximum conserves exactly and aggregate overflow is blocked", () => {
  const value = input(); value.receipts[0].amountMinor = Number.MAX_SAFE_INTEGER;
  value.allocations[0].amountMinor = Number.MAX_SAFE_INTEGER - 1;
  value.allocations[1].amountMinor = 1;
  assert.equal(reconcileInvoiceReceipts(value).receipts[0].unallocatedMinor, 0);
  value.allocations[1].amountMinor = 2;
  assert.equal(reconcileInvoiceReceipts(value).state, "blocked");
});

test("owner supplied currency scale is preserved, not assumed to be two", () => {
  const value = input(); value.currencies[0].scale = 0;
  assert.equal(reconcileInvoiceReceipts(value).receipts[0].scale, 0);
});

test("readable handoff and complete JSON agree exactly", () => {
  const value = input();
  const markdown = renderInvoiceReceiptWorkpaper(value);
  const embedded = JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]);
  assert.deepEqual(embedded, reconcileInvoiceReceipts(value));
  assert.match(markdown, /\| R1 \| CASH-1 \| current \| USD \| 1000\.00 \| 900\.00 \| 100\.00 \| BANK \/ V1 \/ ROW-1 \|/);
  assert.match(markdown, /L1 records remittance, not accounting application/);
  assert.match(markdown, /Retain the unallocated remainder of R1/);
  assert.match(markdown, /Invoice balances and accounting entries are unchanged/);
});

test("blocked handoff retains correction evidence and never renders unknown as zero", () => {
  const value = input();
  value.receipts[0].status = "superseded";
  const markdown = renderInvoiceReceiptWorkpaper(value);
  assert.match(markdown, /\| R1 \| CASH-1 \| superseded \| USD \| 1000\.00 \| unknown \| unknown \|/);
  assert.match(markdown, /Resolve unresolved_record for R1/);
  assert.deepEqual(JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]).evidence, value);
});

test("handoff formats safe integer maximum exactly at supplied scales", () => {
  const value = input();
  value.receipts[0].amountMinor = Number.MAX_SAFE_INTEGER;
  value.allocations = [];
  value.currencies[0].scale = 6;
  assert.match(renderInvoiceReceiptWorkpaper(value), /9007199254\.740991/);
  value.currencies[0].scale = 0;
  assert.match(renderInvoiceReceiptWorkpaper(value), /9007199254740991/);
});

for (const [name, change] of [
  ["fractional minor units", (x) => { x.receipts[0].amountMinor = 1.5; }],
  ["unsafe integer", (x) => { x.receipts[0].amountMinor = Number.MAX_SAFE_INTEGER + 1; }],
  ["missing scale", (x) => { delete x.currencies[0].scale; }],
  ["offsetless timestamp", (x) => { x.asOf = "2026-10-04T10:00:00"; }],
  ["injected posting authority", (x) => { x.postEntries = true; }],
]) test(`rejects malformed ${name}`, () => {
  const value = input(); change(value);
  assert.throws(() => reconcileInvoiceReceipts(value), /Invalid receipt workpaper input/);
});
