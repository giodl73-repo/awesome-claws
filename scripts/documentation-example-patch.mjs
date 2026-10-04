import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const fixtureRoot = new URL("../sources/software-maintainer/fixtures/documentation-change/", import.meta.url);
export const normalize = (value) => value.replaceAll("\r\n", "\n");

// A whole-file unified diff keeps this tiny synthetic example reproducible.
export function documentationPatch(before, after) {
  return Object.keys(before).filter((path) => before[path] !== after[path]).map((path) => {
    const oldLines = before[path].trimEnd().split("\n");
    const newLines = after[path].trimEnd().split("\n");
    return [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`,
      `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
      ...oldLines.map((line) => `-${line}`), ...newLines.map((line) => `+${line}`), ""].join("\n");
  }).join("");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(await readFile(new URL("input.json", fixtureRoot), "utf8"));
  const after = {};
  for (const path of Object.keys(input.before)) after[path] = normalize(await readFile(new URL(path, fixtureRoot), "utf8"));
  const patch = documentationPatch(input.before, after);
  await writeFile(new URL("documentation.patch", fixtureRoot), patch);
  console.log("Generated the synthetic documentation patch.");
}
