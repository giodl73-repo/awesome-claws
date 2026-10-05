import { isDeepStrictEqual } from "node:util";
import { reconcileInvoiceReceipts } from "./invoice-receipt-workpaper.mjs";
import { reconcileLegacyReceiptPayments } from "./invoice-receipt-legacy-map.mjs";

export const INVOICE_RECEIPT_REPORTS = Object.freeze({
  "awesomeClaws.receiptWorkpaperReport.v1": {
    schemaName: "receipt-workpaper-report.schema.json",
    dependencies: ["receipt-workpaper.schema.json"],
  },
  "awesomeClaws.receiptLegacyReview.v1": {
    schemaName: "receipt-legacy-review.schema.json",
    dependencies: ["invoice-receivables.schema.json", "receipt-workpaper.schema.json", "receipt-legacy-map.schema.json", "receipt-workpaper-report.schema.json"],
  },
});

export function invoiceReceiptReportDefinition(id, version) {
  return id === "invoice-payment-followup" && typeof version === "string" && Object.hasOwn(INVOICE_RECEIPT_REPORTS, version)
    ? INVOICE_RECEIPT_REPORTS[version] : null;
}

export function invoiceReceiptReportFindings(value) {
  const finding = (code) => [{ code, path: "$", message: "Receipt report must exactly match recomputation from its complete supplied evidence." }];
  try {
    let expected;
    if (value?.schemaVersion === "awesomeClaws.receiptWorkpaperReport.v1") expected = reconcileInvoiceReceipts(value.evidence);
    else if (value?.schemaVersion === "awesomeClaws.receiptLegacyReview.v1") expected = reconcileLegacyReceiptPayments(value.evidence);
    else return finding("receipt_report_version");
    return isDeepStrictEqual(value, expected) ? [] : finding("receipt_report_mismatch");
  } catch {
    return finding("receipt_report_evidence_invalid");
  }
}
