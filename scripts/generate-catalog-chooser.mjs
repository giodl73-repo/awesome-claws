import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildChooser, renderChooserMarkdown } from "./catalog-chooser.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { root } from "./openclaw-proof-lib.mjs";

const check = process.argv.includes("--check");
const catalog = await readCatalog();
const chooser = buildChooser(catalog, await readExperienceCases(catalog));
const outputs = new Map([
  ["catalog-chooser.json", `${JSON.stringify(chooser, null, 2)}\n`],
  ["CHOOSER.md", renderChooserMarkdown(chooser)],
]);

for (const [relativePath, expected] of outputs) {
  const path = join(root, relativePath);
  if (check) {
    const actual = await readFile(path, "utf8").catch(() => undefined);
    if (actual !== expected) {
      throw new Error(`Generated catalog chooser is stale or missing: ${relativePath}`);
    }
  } else {
    await writeFile(path, expected, "utf8");
  }
}

console.log(`${check ? "Checked" : "Generated"} chooser views for ${chooser.entries.length} Claws.`);
