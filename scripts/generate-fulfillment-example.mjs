import { readFile, writeFile } from "node:fs/promises";
import { reconcileFulfillment, renderFulfillment } from "./order-fulfillment-reconciler.mjs";

const base = new URL("../sources/order-fulfillment-reconciler/fixtures/", import.meta.url);
const input = JSON.parse(await readFile(new URL("fulfillment-input.example.json", base), "utf8"));
const outputs = [
  ["fulfillment.example.json", `${JSON.stringify({ input, report: reconcileFulfillment(input) }, null, 2)}\n`],
  ["fulfillment-handoff.example.md", renderFulfillment(input)],
];
for (const [name, content] of outputs) {
  const path = new URL(name, base);
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== content) throw new Error(`Stale fulfillment example: ${name}`);
  } else {
    await writeFile(path, content);
  }
}
