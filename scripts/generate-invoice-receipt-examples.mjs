import { readFile, writeFile } from "node:fs/promises";
import { reconcileInvoiceReceipts, renderInvoiceReceiptWorkpaper, formatReceiptAmount } from "./invoice-receipt-workpaper.mjs";
import { reconcileLegacyReceiptPayments, renderLegacyReceiptReview } from "./invoice-receipt-legacy-map.mjs";

const base = new URL("../sources/invoice-payment-followup/fixtures/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, base), "utf8"));
const receiptInput = await read("receipt-workpaper.example.json");
const linked = {
  legacy: await read("invoice-receivables.example.json"),
  receiptInput: await read("receipt-application.example.json"),
  mapping: await read("receipt-legacy-map.example.json"),
};
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const entry = catalog.entries.find((row) => row.id === "invoice-payment-followup");
const report = reconcileInvoiceReceipts(receiptInput);
if (report.receipts.length !== 1 || report.state !== "ready-for-owner-review") throw new Error("Receipt session example requires one reviewable receipt.");
const receipt = report.receipts[0];
const amount = (value) => `${receipt.currency} ${formatReceiptAmount(value, receipt.scale)}`;
const session = {
  schemaVersion: "awesomeClaws.sessionDemo.v1", claw: entry.id, scenario: entry.example.request,
  messages: [
    { role: "user", text: entry.example.request },
    { role: "agent", text: `Receipt ${receipt.id} is source-linked; remittance is not accounting application.` },
    { role: "user", text: "Keep the unallocated amount visible and leave the complete JSON and Markdown for owner review." },
    { role: "agent", text: "Prepared outputs/invoice-receivables.json and outputs/invoice-payment-followup-handoff.md. No invoice balance or accounting entry changed." },
  ],
  report: {
    title: "Receipt allocation: owner review", summary: entry.example.outcome,
    output: "outputs/invoice-payment-followup-handoff.md",
    items: [
      { title: `Receipt ${receipt.id}`, summary: `${amount(receipt.amountMinor)} received; evidence ${receipt.sourceRef} / ${receipt.sourceRevision} / ${receipt.sourceRecord}.`, tags: ["evidence", "reviewable"] },
      { title: "Allocation evidence", summary: report.allocations.map((row) => `${amount(row.amountMinor)} for invoice ${row.invoiceRef} (${row.basis}; ${row.sourceRef} / ${row.sourceRecord})`).join("; ") + ". Remittance does not establish posting.", tags: ["evidence", "reviewable"] },
      { title: "Unallocated cash", summary: `${amount(receipt.unallocatedMinor)} remains unallocated. No invoice, refund or adjustment invented.`, tags: ["evidence", "reviewable"] },
      { title: "Owner action gate", summary: `${report.owner} reviews ${report.reviewQuestions.length} questions. Invoice balances and accounting entries are unchanged; no message or money movement.`, tags: ["handoff", "owner-visible"] },
    ],
  },
};
const outputs = {
  "receipt-workpaper-report.example.json": `${JSON.stringify(report, null, 2)}\n`,
  "receipt-legacy-review.example.json": `${JSON.stringify(reconcileLegacyReceiptPayments(linked), null, 2)}\n`,
  "receipt-handoff.example.md": renderInvoiceReceiptWorkpaper(receiptInput),
  "receipt-legacy-handoff.example.md": renderLegacyReceiptReview(linked),
  "session-demo.json": `${JSON.stringify(session, null, 2)}\n`,
  "../templates/session-handoff.md": renderInvoiceReceiptWorkpaper(receiptInput),
};
if (process.argv.slice(2).some((arg) => arg !== "--check")) throw new Error("Usage: generate-invoice-receipt-examples.mjs [--check]");
for (const [name, expected] of Object.entries(outputs)) {
  const path = new URL(name, base);
  if (process.argv.includes("--check")) {
    const actual = (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
    if (actual !== expected) throw new Error(`Receipt fixture drift: ${name}`);
  } else await writeFile(path, expected);
}
console.log(`${process.argv.includes("--check") ? "Checked" : "Generated"} ${Object.keys(outputs).length} receipt report/handoff fixtures.`);
