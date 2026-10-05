import { readFile, writeFile } from "node:fs/promises";
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
const outputs = {
  "receipt-workpaper-report.example.json": `${JSON.stringify(reconcileInvoiceReceipts(receiptInput), null, 2)}\n`,
  "receipt-legacy-review.example.json": `${JSON.stringify(reconcileLegacyReceiptPayments(linked), null, 2)}\n`,
  "receipt-handoff.example.md": renderInvoiceReceiptWorkpaper(receiptInput),
  "receipt-legacy-handoff.example.md": renderLegacyReceiptReview(linked),
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
