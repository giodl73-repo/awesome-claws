import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./openclaw-proof-lib.mjs";
import { isSafePackagePath } from "./portable-paths.mjs";

export async function readExperienceCases(catalog, { targetRoot = root } = {}) {
  const registry = JSON.parse(
    await readFile(join(targetRoot, "experience-cases.json"), "utf8"),
  );
  if (registry.schemaVersion !== 1) {
    throw new Error("experience-cases.json must use schemaVersion 1.");
  }
  const cases = registry.artifactCases.ids.map((id) => ({
    id,
    target: registry.artifactCases.target,
    primary: registry.artifactCases.primary,
    fallback: registry.artifactCases.fallback,
    output: registry.artifactCases.outputPattern.replace("{id}", id),
  }));
  cases.push(...registry.visualCases);

  const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  if (cases.length !== catalog.entries.length || new Set(cases.map((item) => item.id)).size !== cases.length) {
    throw new Error("Experience cases must cover every catalog Claw exactly once.");
  }
  for (const item of cases) {
    const entry = byId.get(item.id);
    if (!entry) {
      throw new Error(`Unknown Experience case: ${item.id}.`);
    }
    if (![3, 4, 5].includes(item.target)) {
      throw new Error(`${item.id} has an invalid Experience target.`);
    }
    if (
      !isSafePackagePath(item.output) ||
      !item.output.startsWith("outputs/")
    ) {
      throw new Error(`${item.id} must declare a safe workspace output.`);
    }
    if (item.target === 3) {
      const resources = new Set((entry.resources ?? []).map((resource) => resource.path));
      if (item.primary !== "artifact" || item.fallback !== "text" || !item.output) {
        throw new Error(`${item.id} must declare an artifact output and text fallback.`);
      }
      for (const requiredPath of [
        "fixtures/session-demo.json",
        "templates/session-report.template.json",
        "templates/session-handoff.md",
      ]) {
        if (!resources.has(requiredPath)) {
          throw new Error(`${item.id} must package ${requiredPath} for its X3 session demo.`);
        }
      }
      continue;
    }
    const resources = new Set((entry.resources ?? []).map((resource) => resource.path));
    const toolPolicy = entry.openclawProfile?.agent?.tools;
    const tools = new Set([...(toolPolicy?.allow ?? []), ...(toolPolicy?.alsoAllow ?? [])]);
    if (
      !resources.has(item.asset) ||
      !tools.has("show_widget") ||
      !isSafePackagePath(item.fallback) ||
      !item.fallback.startsWith("outputs/") ||
      item.output === item.fallback
    ) {
      throw new Error(`${item.id} does not satisfy its visual Experience declaration.`);
    }
    if (item.target === 5 && (!tools.has("dashboard") || !item.widgets?.length)) {
      throw new Error(`${item.id} must declare dashboard access and stable widget names for X5.`);
    }
  }
  return cases;
}
