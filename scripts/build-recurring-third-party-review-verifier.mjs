import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  root,
  "sources",
  "recurring-third-party-review-evidence-reconciler",
  "skills",
  "recurring-third-party-review-validator",
  "scripts",
  "verify.mjs",
);
const result = await build({
  entryPoints: [
    resolve(root, "scripts", "recurring-third-party-review-evidence-reconciler.mjs"),
  ],
  bundle: true,
  format: "esm",
  legalComments: "eof",
  minify: true,
  platform: "node",
  target: "node22",
  write: false,
});
const expected = result.outputFiles[0].text;

if (process.argv.includes("--check")) {
  const actual = await readFile(outputPath, "utf8").catch(() => null);
  if (actual !== expected) {
    throw new Error("Packaged recurring third-party review verifier is stale.");
  }
  console.log("Packaged recurring third-party review verifier is current.");
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected, "utf8");
  console.log("Packaged recurring third-party review verifier.");
}
