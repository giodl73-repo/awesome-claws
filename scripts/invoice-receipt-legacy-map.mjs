import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Temporal } from "@js-temporal/polyfill";
import legacySchema from "../sources/invoice-payment-followup/schemas/invoice-receivables.schema.json" with { type: "json" };
import mappingSchema from "../sources/invoice-payment-followup/schemas/receipt-legacy-map.schema.json" with { type: "json" };
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { reconcileInvoiceReceipts } from "./invoice-receipt-workpaper.mjs";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateLegacy = ajv.compile(legacySchema);
const validateMapping = ajv.compile(mappingSchema);

// Interpret the legacy JSON number's decimal value; never round or multiply floats.
export function legacyAmountMinor(amount, scale) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(scale) || scale < 0 || scale > 6) return null;
  const [mantissa, exponent = "0"] = String(amount).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const coefficient = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length + scale;
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  if (coefficient % divisor !== 0n) return null;
  const minor = shift < 0 ? coefficient / divisor : coefficient * 10n ** BigInt(shift);
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? minor : null;
}

export function reconcileLegacyReceiptPayments({ legacy, receiptInput, mapping }) {
  if (!validateLegacy(legacy)) throw new Error(`Invalid legacy invoice artifact: ${ajv.errorsText(validateLegacy.errors)}`);
  if (!validateMapping(mapping)) throw new Error(`Invalid receipt legacy mapping: ${ajv.errorsText(validateMapping.errors)}`);
  const workpaper = reconcileInvoiceReceipts(receiptInput);
  const findings = [];
  const add = (code, ref) => findings.push({ code, ref });
  if (validateArtifactSemantics("invoice-payment-followup", legacy).length) add("legacy_semantics", legacy.ledger.id);
  if (workpaper.state === "blocked") add("receipt_workpaper_blocked", receiptInput.scopeRef);
  if (mapping.ledgerRef !== legacy.ledger.id || mapping.scopeRef !== receiptInput.scopeRef) add("mapping_scope", mapping.ledgerRef);
  if (!mapping.cutoffCompatibilityConfirmed) add("cutoff_unresolved", mapping.ledgerRef);
  const legacyInvoices = new Map(legacy.invoices.map((row) => [row.id, row]));
  const invoices = new Map(receiptInput.invoices.map((row) => [row.id, row]));
  const payments = new Map(legacy.paymentEvidence.map((row) => [row.id, row]));
  const allocations = new Map(receiptInput.allocations.map((row) => [row.id, row]));
  const receipts = new Map(receiptInput.receipts.map((row) => [row.id, row]));
  const legacySources = new Map(legacy.sources.map((row) => [row.id, row]));
  let legacyCutoff;
  try {
    legacyCutoff = Temporal.PlainDate.from(legacy.ledger.asOf).add({ days: 1 })
      .toZonedDateTime(legacy.ledger.timezone).toInstant().epochNanoseconds;
  } catch { add("legacy_cutoff_invalid", legacy.ledger.id); }
  const scales = new Map(receiptInput.currencies.map((row) => [row.code, row.scale]));
  const invoiceMap = new Map();
  const mappedInvoices = new Set();
  for (const row of mapping.invoiceMappings) {
    if (invoiceMap.has(row.legacyInvoiceRef) || mappedInvoices.has(row.workpaperInvoiceRef)) add("duplicate_invoice_mapping", row.legacyInvoiceRef);
    invoiceMap.set(row.legacyInvoiceRef, row.workpaperInvoiceRef);
    mappedInvoices.add(row.workpaperInvoiceRef);
    if (!legacyInvoices.has(row.legacyInvoiceRef) || !invoices.has(row.workpaperInvoiceRef)) add("invoice_mapping_reference", row.legacyInvoiceRef);
    else if (legacyInvoices.get(row.legacyInvoiceRef).currency !== invoices.get(row.workpaperInvoiceRef).currency) add("invoice_mapping_currency", row.legacyInvoiceRef);
  }
  const seen = new Set();
  const usedAllocations = new Set();
  for (const row of mapping.payments) {
    if (seen.has(row.paymentRef)) add("duplicate_payment_disposition", row.paymentRef);
    seen.add(row.paymentRef);
    const payment = payments.get(row.paymentRef);
    if (!payment) { add("unknown_payment", row.paymentRef); continue; }
    if (row.disposition === "unresolved") add("payment_identity_unresolved", row.paymentRef);
    if (row.disposition !== "represented") {
      if (row.allocationRefs.length) add("nonrepresented_allocations", row.paymentRef);
      if (row.disposition === "outside-scope" && (row.scopeRef === receiptInput.scopeRef || invoiceMap.has(payment.invoiceRef))) add("outside_scope_conflict", row.paymentRef);
      continue;
    }
    if (row.scopeRef !== receiptInput.scopeRef) add("payment_scope", row.paymentRef);
    for (const ref of payment.sourceRefs) {
      const source = legacySources.get(ref);
      if (source?.freshness !== "current") add("legacy_payment_source_not_current", ref);
      if (source && source.asOf > legacy.ledger.asOf) add("legacy_payment_source_after_snapshot", ref);
    }
    if (!row.allocationRefs.length) add("missing_allocation_mapping", row.paymentRef);
    if (!invoiceMap.has(payment.invoiceRef)) add("missing_invoice_mapping", row.paymentRef);
    let total = 0n;
    for (const ref of row.allocationRefs) {
      if (usedAllocations.has(ref)) add("reused_allocation", ref);
      usedAllocations.add(ref);
      const allocation = allocations.get(ref);
      if (!allocation) { add("unknown_allocation", ref); continue; }
      if (allocation.invoiceRef !== invoiceMap.get(payment.invoiceRef) || allocation.currency !== payment.currency) add("allocation_payment_mismatch", ref);
      if (allocation.status !== "current") add("allocation_not_current", ref);
      if (payment.state === "confirmed" && allocation.basis !== "application") add("confirmed_payment_without_application", ref);
      if (payment.state === "confirmed" && legacyCutoff !== undefined) {
        const receipt = receipts.get(allocation.receiptRef);
        if (Temporal.Instant.from(allocation.at).epochNanoseconds >= legacyCutoff ||
            receipt && Temporal.Instant.from(receipt.at).epochNanoseconds >= legacyCutoff) add("application_after_legacy_snapshot", ref);
      }
      if (payment.state !== "confirmed" && allocation.basis === "application") add("payment_state_conflict", ref);
      if (["missing", "conflicting"].includes(payment.state)) add("payment_state_unresolved", row.paymentRef);
      total += BigInt(allocation.amountMinor);
    }
    const expected = legacyAmountMinor(payment.amount, scales.get(payment.currency));
    if (expected === null) add("legacy_amount_not_representable", row.paymentRef);
    else if (total !== expected) add("legacy_amount_mismatch", row.paymentRef);
  }
  for (const payment of legacy.paymentEvidence) if (!seen.has(payment.id)) add("missing_payment_disposition", payment.id);
  return {
    schemaVersion: "awesomeClaws.receiptLegacyReview.v1",
    state: findings.length ? "blocked" : "ready-for-owner-review",
    evidence: structuredClone({ legacy, receiptInput, mapping }),
    findings,
    reviewQuestions: findings.map(({ code, ref }) => ({ owner: mapping.owner, code, ref,
      question: `Resolve ${code} for ${ref} from owner-reviewed evidence; do not combine amounts or change invoice balances.` })),
    workpaper,
    legacyHandoffState: legacy.handoff.state,
    paymentCoverage: legacy.paymentEvidence.map((row) => row.id),
    invoiceBalancesChanged: false,
    accountingEntriesPosted: false,
    combinedCashTotal: null,
  };
}

export function renderLegacyReceiptReview(input) {
  const report = reconcileLegacyReceiptPayments(input);
  const payments = new Map(input.legacy.paymentEvidence.map((row) => [row.id, row]));
  return ["# Legacy payment and receipt equivalence review", "",
    `Mapping state: ${report.state}. Mapping owner: ${input.mapping.owner}.`,
    `Legacy handoff state (unchanged): ${report.legacyHandoffState}.`,
    "Owner-only: complete source artifacts are retained below. Review storage and recipients before sharing.",
    "Scope, identity and cutoff compatibility are owner assertions, not authenticated facts.",
    "This checks equivalence only. No combined cash total, posting authority, or changed invoice balance.", "",
    "## Payment dispositions", "",
    "| Legacy payment | Legacy state | Original amount | Currency | Disposition | Scope | Allocation references | Owner evidence |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...input.mapping.payments.map((r) => {
      const payment = payments.get(r.paymentRef);
      return `| ${r.paymentRef} | ${payment?.state ?? "unknown"} | ${payment?.amount ?? "unknown"} | ${payment?.currency ?? "unknown"} | ${r.disposition} | ${r.scopeRef} | ${r.allocationRefs.join(", ") || "none"} | ${r.evidenceRef} |`;
    }),
    ...input.legacy.paymentEvidence.filter((r) => !input.mapping.payments.some((m) => m.paymentRef === r.id))
      .map((r) => `| ${r.id} | ${r.state} | ${r.amount} | ${r.currency} | MISSING | unknown | none | none |`),
    "", "## Receipt-only conservation", "",
    "These are register amounts, not added to legacy payments. Amounts are integer minor units at the supplied scale.",
    "A passing receipt calculation does not clear a blocked equivalence review.", "",
    "| Receipt | Currency | Scale | Received minor units | Allocated minor units | Unallocated minor units |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.workpaper.receipts.map((r) => `| ${r.id} | ${r.currency} | ${r.scale ?? "unknown"} | ${r.amountMinor} | ${r.allocatedMinor ?? "unknown"} | ${r.unallocatedMinor ?? "unknown"} |`),
    "", "## Owner review", "",
    ...[...report.reviewQuestions, ...report.workpaper.reviewQuestions].map((q) => `- ${q.owner}: ${q.question}`),
    "- Owner review remains required. Neither artifact grants external execution authority.",
    "", "## Complete review record", "",
    "```json", JSON.stringify(report, null, 2).replace(/`/g, "\\u0060"), "```", "",
  ].join("\n");
}
