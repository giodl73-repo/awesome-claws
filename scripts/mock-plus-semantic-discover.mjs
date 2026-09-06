import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildMockPlusInventory,
  loadMockPlusContext,
} from "./mock-plus-lib.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function setValue(value, path, replacement, remove = false) {
  const parent = path
    .slice(0, -1)
    .reduce((current, part) => current[part], value);
  const key = path.at(-1);
  if (remove) delete parent[key];
  else parent[key] = replacement;
}

function candidatesFor(value, clawId, path = []) {
  const candidates = [];
  if (!value || typeof value !== "object") return candidates;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = [...path, key];
    if (typeof item === "string") {
      const replacements = [
        "mock-plus-missing",
        "agent-owned",
        clawId,
        "unauthorized",
        "2099-12-31T23:59:59Z",
        "2000-01-01T00:00:00Z",
        `sha256:${"0".repeat(64)}`,
        "The agent completed and submitted this action.",
      ];
      for (const replacement of replacements) {
        if (replacement !== item) {
          candidates.push({
            operator: "replace",
            path: itemPath,
            replacement,
          });
        }
      }
    } else if (typeof item === "boolean") {
      candidates.push({
        operator: "replace",
        path: itemPath,
        replacement: !item,
      });
    } else if (typeof item === "number") {
      candidates.push({
        operator: "replace",
        path: itemPath,
        replacement: item + 1,
      });
    }
    candidates.push({ operator: "remove", path: itemPath });
    if (item && typeof item === "object") {
      candidates.push(...candidatesFor(item, clawId, itemPath));
    }
  }
  return candidates;
}

function applyCandidate(fixture, mutation) {
  const candidate = structuredClone(fixture);
  setValue(
    candidate,
    mutation.path,
    mutation.replacement,
    mutation.operator === "remove",
  );
  return candidate;
}

function recipeId(mutation, index) {
  const code = mutation.expectedCodes[0].replaceAll(/[^a-z0-9-]/giu, "-");
  return `semantic-${code}-${index + 1}`;
}

export async function discoverSemanticRecipes() {
  const context = await loadMockPlusContext({ requireSemanticRegistry: false });
  const inventory = await buildMockPlusInventory(context);
  const discoveries = [];
  for (const entry of inventory.entries.filter((item) => item.semanticValidator)) {
    const contract = entry.schemaContracts[0];
    const [fixture, schema] = await Promise.all([
      readFile(join(root, "claws", entry.id, contract.fixturePath), "utf8").then(
        JSON.parse,
      ),
      readFile(join(root, "claws", entry.id, contract.schemaPath), "utf8").then(
        JSON.parse,
      ),
    ]);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const recipes = [];
    const seenCodes = new Set();
    const errors = [];
    for (const mutation of candidatesFor(fixture, entry.id)) {
      const candidate = applyCandidate(fixture, mutation);
      if (!validate(candidate)) continue;
      let findings;
      try {
        findings = validateArtifactSemantics(entry.id, candidate);
      } catch (error) {
        errors.push({
          ...mutation,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const codes = [...new Set(findings.map((finding) => finding.code))].sort();
      if (codes.length === 0 || codes.every((code) => seenCodes.has(code))) {
        continue;
      }
      recipes.push({ ...mutation, expectedCodes: codes });
      for (const code of codes) seenCodes.add(code);
      if (recipes.length === 3) break;
    }
    if (errors.length > 0) {
      throw new Error(
        `${entry.id} semantic validator threw during schema-valid mutation discovery: ${errors[0].error}`,
      );
    }
    discoveries.push({
      id: entry.id,
      recipes: recipes.map((recipe, index) => ({
        id: recipeId(recipe, index),
        ...recipe,
      })),
    });
  }
  const covered = discoveries.filter((entry) => entry.recipes.length > 0);
  const uncoveredIds = discoveries
    .filter((entry) => entry.recipes.length === 0)
    .map((entry) => entry.id);
  if (uncoveredIds.length > 0) {
    throw new Error(
      `Semantic mutation discovery lacks recipes for: ${uncoveredIds.join(", ")}.`,
    );
  }
  return {
    schemaVersion: "awesomeClaws.mockPlusSemanticRecipes.v1",
    evidenceClass: "mock-deterministic",
    summary: {
      validatorCount: discoveries.length,
      coveredCount: covered.length,
      recipeCount: discoveries.reduce(
        (total, entry) => total + entry.recipes.length,
        0,
      ),
      findingCodeCount: new Set(
        discoveries.flatMap((entry) =>
          entry.recipes.flatMap((recipe) => recipe.expectedCodes),
        ),
      ).size,
    },
    entries: discoveries,
  };
}

export async function main(args = process.argv.slice(2)) {
  const check = args.includes("--check");
  if (args.some((argument) => argument !== "--check")) {
    throw new Error(`Unknown semantic recipe option: ${args.join(" ")}.`);
  }
  const outputPath = join(root, "required-semantic-recipes.json");
  const document = await discoverSemanticRecipes();
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  if (check) {
    const existing = await readFile(outputPath, "utf8");
    if (existing !== serialized) {
      throw new Error(
        "Mock+ semantic recipe registry is stale. Run npm run mock-plus:semantics:recipes.",
      );
    }
  } else {
    await writeFile(outputPath, serialized);
  }
  console.log(
    `Semantic recipes ${check ? "checked" : "wrote"}: ${document.summary.coveredCount} validators, ${document.summary.recipeCount} recipes, ${document.summary.findingCodeCount} finding codes.`,
  );
  return document;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
