import { readFile, writeFile } from "node:fs/promises";
import { commissionExample } from "./sales-commission-review-example.mjs";
import { reconcileCommissions, commissionFindings, renderCommission } from "./sales-commission-review-preparer.mjs";

const base = new URL("../sources/sales-commission-review-preparer/", import.meta.url);
const input = commissionExample(), record = { input, report: reconcileCommissions(input) };
const blocked = structuredClone(input); blocked.credits[0].evidence.decisionOwner = null;
const blockedRecord = { input: blocked, report: reconcileCommissions(blocked) };
for (const value of [record, blockedRecord]) if (commissionFindings(value).length) throw new Error("Invalid commission example");
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const entry = catalog.entries.find((r) => r.id === "sales-commission-review-preparer");
const session = {
  schemaVersion: "awesomeClaws.sessionDemo.v1", claw: entry.id, scenario: entry.example.request,
  messages: [{ role: "user", text: entry.example.request }, { role: "agent", text: "Prepared a private source-bound commission workpaper; no payout is approved." }],
  report: { title: "Commission cycle: owner review", summary: entry.example.outcome,
    output: input.scope.privateDestination,
    items: [
      { title: "Tier crossing", summary: "PAYEE-A: USD 9000 opening, USD 2000 credited. USD 50 plus USD 100 = USD 150 commission.", tags: ["evidence", "reviewable"] },
      { title: "Original-line reversal", summary: "R1 reverses OLD1's USD 80, not a current-rate recalculation. Remaining original amount: USD 0.", tags: ["evidence", "reviewable"] },
      { title: "Payout comparison", summary: "Expected USD 70; proposed USD 70; difference USD 0. No entitlement or payroll approval.", tags: ["handoff", "owner-visible"] }
    ] }
};
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
const outputs = {
  "fixtures/commission-input.example.json": json(input), "fixtures/commission.example.json": json(record),
  "fixtures/commission-blocked.example.json": json(blockedRecord), "fixtures/session-demo.json": json(session),
  "templates/session-handoff.md": renderCommission(input),
};
if (process.argv.slice(2).some((a) => a !== "--check")) throw new Error("Only --check is supported");
for (const [path, text] of Object.entries(outputs)) {
  const url = new URL(path, base);
  if (process.argv.includes("--check")) {
    if ((await readFile(url, "utf8")).replace(/\r\n/g, "\n") !== text) throw new Error(`Example drift: ${path}`);
  } else await writeFile(url, text);
}
console.log(`${process.argv.includes("--check") ? "Checked" : "Generated"} ${Object.keys(outputs).length} commission artifacts.`);
