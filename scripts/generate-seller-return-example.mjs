import { readFile, writeFile } from "node:fs/promises";
import { reconcileSellerReturns, renderSellerReturns } from "./seller-return-reconciler.mjs";

const base = new URL("../sources/seller-return-reconciler/fixtures/", import.meta.url);
const input = JSON.parse(await readFile(new URL("return-input.example.json", base), "utf8"));
const outputs = [
  ["seller-return.example.json", `${JSON.stringify({ input, report: reconcileSellerReturns(input) }, null, 2)}\n`],
  ["return-handoff.example.md", renderSellerReturns(input)],
];
for (const [name, content] of outputs) {
  const path = new URL(name, base);
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== content) throw new Error(`Stale seller return example: ${name}`);
  } else {
    await writeFile(path, content);
  }
}
