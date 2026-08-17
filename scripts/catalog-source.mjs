import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isSafePackagePath } from "./portable-paths.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const sourceRoot = join(root, "sources");

export function resourceSourcePath(entryId, source) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(entryId) || !isSafePackagePath(source)) {
    throw new Error(`Unsafe catalog source path: ${entryId}/${source}`);
  }
  return join(sourceRoot, entryId, ...source.split("/"));
}

export async function readCatalog({ loadResources = true } = {}) {
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) {
    throw new Error("catalog.json must contain a schemaVersion 1 entries array.");
  }
  if (!loadResources) {
    return catalog;
  }
  await Promise.all(
    catalog.entries.flatMap((entry) =>
      (entry.resources ?? []).map(async (resource) => {
        if (Object.hasOwn(resource, "content")) {
          throw new Error(
            `${entry.id}/${resource.source} must keep content in its per-Claw source file.`,
          );
        }
        resource.content = await readFile(resourceSourcePath(entry.id, resource.source), "utf8");
      }),
    ),
  );
  return catalog;
}
