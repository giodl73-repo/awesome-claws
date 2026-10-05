import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Temporal } from "@js-temporal/polyfill";
import schema from "../sources/invoice-payment-followup/schemas/receipt-workpaper.schema.json" with { type: "json" };

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const instant = (value) => Temporal.Instant.from(value).epochNanoseconds;

// This workpaper never creates paymentEvidence or changes an invoice balance.
export function reconcileInvoiceReceipts(input) {
  if (!validate(input)) throw new Error(`Invalid receipt workpaper input: ${ajv.errorsText(validate.errors)}`);
  const findings = [];
  const add = (code, id) => findings.push({ code, id });
  const unique = (rows, field, code) => {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row[field])) add(code, row[field]);
      seen.add(row[field]);
    }
  };
  for (const kind of ["sources", "invoices", "receipts", "allocations"]) unique(input[kind], "id", `duplicate_${kind}`);
  unique(input.currencies, "code", "duplicate_currency");
  const currencies = new Map(input.currencies.map((row) => [row.code, row.scale]));
  const sources = new Map(input.sources.map((row) => [row.id, row]));
  const invoices = new Map(input.invoices.map((row) => [row.id, row]));
  const receipts = new Map(input.receipts.map((row) => [row.id, row]));
  const cutoff = instant(input.asOf);
  for (const source of input.sources) {
    if (instant(source.capturedAt) > cutoff) add("future_source", source.id);
    if (source.scopeRef !== input.scopeRef) add("source_scope", source.id);
  }
  for (const kind of ["receipts", "allocations"]) {
    const identities = new Set();
    for (const row of input[kind]) {
      if (row.identityRef === null) add("unresolved_identity", row.id);
      else if (identities.has(row.identityRef)) add(`duplicate_${kind}_identity`, row.id);
      identities.add(row.identityRef);
    }
  }
  const usedEvidence = new Set();
  function evidence(row, expectedKind) {
    const source = sources.get(row.sourceRef);
    if (!source || source.revision !== row.sourceRevision) add("source_revision", row.id);
    if (source && source.kind !== expectedKind) add("source_kind", row.id);
    if (source && instant(row.at) > instant(source.capturedAt)) add("event_after_capture", row.id);
    if (instant(row.at) > cutoff) add("future_event", row.id);
    // A revised copy of the same native record is not additional cash/allocation.
    const key = JSON.stringify([row.sourceRef, row.sourceRecord]);
    if (usedEvidence.has(key)) add("duplicate_source_record", row.id);
    usedEvidence.add(key);
    if (!currencies.has(row.currency)) add("currency_scale_missing", row.id);
    if (row.status !== "current") add("unresolved_record", row.id);
  }
  for (const row of input.receipts) evidence(row, "receipt");
  for (const row of input.invoices) if (!currencies.has(row.currency)) add("currency_scale_missing", row.id);
  for (const row of input.allocations) {
    evidence(row, row.basis);
    const receipt = receipts.get(row.receiptRef);
    const invoice = invoices.get(row.invoiceRef);
    if (!receipt) add("receipt_reference", row.id);
    if (receipt && row.basis === "application" && instant(row.at) < instant(receipt.at)) add("application_before_receipt", row.id);
    if (!invoice) add("invoice_reference", row.id);
    if (receipt && receipt.currency !== row.currency || invoice && invoice.currency !== row.currency) add("currency_mismatch", row.id);
  }
  const totals = new Map(input.receipts.map((row) => [row.id, 0n]));
  for (const row of input.allocations) {
    if (totals.has(row.receiptRef)) totals.set(row.receiptRef, totals.get(row.receiptRef) + BigInt(row.amountMinor));
  }
  for (const row of input.receipts) if (totals.get(row.id) > BigInt(row.amountMinor)) add("overallocated_receipt", row.id);
  const blocked = findings.length > 0;
  const reviewQuestions = findings.map(({ code, id }) => ({ owner: input.owner, code, ref: id,
    question: `Resolve ${code} for ${id} using scoped source evidence; do not post or infer an adjustment.` }));
  if (!blocked) for (const row of input.receipts) {
    if (totals.get(row.id) < BigInt(row.amountMinor)) reviewQuestions.push({ owner: input.owner,
      code: "unallocated_cash", ref: row.id,
      question: `Retain the unallocated remainder of ${row.id}; obtain allocation evidence without inventing an invoice or refund.` });
  }
  for (const row of input.allocations) if (row.basis !== "application") reviewQuestions.push({ owner: input.owner,
    code: "application_not_established", ref: row.id,
    question: `${row.id} records ${row.basis}, not accounting application; do not change an invoice balance.` });
  return {
    schemaVersion: "awesomeClaws.receiptWorkpaperReport.v1",
    state: blocked ? "blocked" : "ready-for-owner-review",
    owner: input.owner,
    evidence: structuredClone(input),
    findings,
    reviewQuestions,
    receiptCoverage: input.receipts.map((row) => row.id),
    allocationCoverage: input.allocations.map((row) => row.id),
    receipts: input.receipts.map((row) => ({ ...row,
      scale: currencies.get(row.currency) ?? null, amountMinor: row.amountMinor,
      allocatedMinor: blocked ? null : Number(totals.get(row.id)),
      unallocatedMinor: blocked ? null : Number(BigInt(row.amountMinor) - totals.get(row.id)),
      allocationRefs: input.allocations.filter((item) => item.receiptRef === row.id).map((item) => item.id) })),
    allocations: structuredClone(input.allocations),
    invoiceBalancesChanged: false,
    accountingEntriesPosted: false,
  };
}

export function formatReceiptAmount(amount, scale) {
  if (amount === null || scale === null) return "unknown";
  const digits = String(amount).padStart(scale + 1, "0");
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

// Recompute from source input so the readable handoff cannot trust edited totals.
export function renderInvoiceReceiptWorkpaper(input) {
  const report = reconcileInvoiceReceipts(input);
  const scales = new Map(input.currencies.map((row) => [row.code, row.scale]));
  return ["# Receipt allocation workpaper", "",
    `State: ${report.state}. Owner: ${report.owner}. Scope: ${input.scopeRef}. As of: ${input.asOf}.`, "",
    "Owner-supplied identity and scope references are assertions, not source authentication.",
    "Allocation evidence is not posting authority. Invoice balances and accounting entries are unchanged.",
    "Amounts below use the supplied currency scale. Unknown means blocked, never zero.", "",
    "## Receipts", "",
    "| Record | Identity | Status | Currency | Received | Allocated evidence | Unallocated | Source / revision / record |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.receipts.map((r) => `| ${r.id} | ${r.identityRef ?? "unresolved"} | ${r.status} | ${r.currency} | ${formatReceiptAmount(r.amountMinor, r.scale)} | ${formatReceiptAmount(r.allocatedMinor, r.scale)} | ${formatReceiptAmount(r.unallocatedMinor, r.scale)} | ${r.sourceRef} / ${r.sourceRevision} / ${r.sourceRecord} |`),
    "", "## Allocation evidence", "",
    "| Record | Identity | Receipt | Invoice | Basis | Status | Currency | Amount | Source / revision / record |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.allocations.map((r) => `| ${r.id} | ${r.identityRef ?? "unresolved"} | ${r.receiptRef} | ${r.invoiceRef} | ${r.basis} | ${r.status} | ${r.currency} | ${formatReceiptAmount(r.amountMinor, scales.get(r.currency) ?? null)} | ${r.sourceRef} / ${r.sourceRevision} / ${r.sourceRecord} |`),
    ...(report.allocations.length ? [] : ["No allocation evidence supplied."]),
    "", "## Owner review", "",
    ...report.reviewQuestions.map((q) => `- ${q.owner}: ${q.question}`),
    ...(report.reviewQuestions.length ? [] : ["Owner review remains required; no external action is authorized."]),
    "", "## Complete workpaper record", "",
    "The record below retains every supplied source, invoice, receipt and allocation, including unresolved evidence.", "",
    "```json", JSON.stringify(report, null, 2), "```", "",
  ].join("\n");
}
