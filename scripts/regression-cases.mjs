import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildCapabilityMatrix,
  capabilityClassesForEntry,
} from "./capability-classes.mjs";
import { readCatalog, root } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { isSafePackagePath } from "./portable-paths.mjs";

const requiredCases = [
  "accepted-request",
  "missing-evidence",
  "authority-boundary",
  "output-fallback",
  "capability-limits",
];
const allowedCaseKeys = [
  "id",
  "acceptedRequest",
  "requiredEvidence",
  "authorityBoundaries",
  "experience",
  "capabilityClasses",
  "capabilityDigest",
];

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function capabilitySurface(entry) {
  return {
    packages: entry.packages ?? [],
    mcpServers: entry.mcpServers ?? {},
    cronJobs: entry.cronJobs ?? [],
    bootstrap: entry.bootstrap ?? null,
    openclawProfile: entry.openclawProfile ?? null,
  };
}

function capabilityDigest(entry) {
  return `sha256:${createHash("sha256")
    .update(canonicalJson(capabilitySurface(entry)))
    .digest("hex")}`;
}

function experienceContract(experience) {
  return {
    target: experience.target,
    primary: experience.primary,
    output: experience.output,
    fallback: experience.fallback,
    ...(experience.asset ? { asset: experience.asset } : {}),
    ...(experience.widgets ? { widgets: experience.widgets } : {}),
  };
}

export function regressionCaseFor(entry, experience) {
  return {
    id: entry.id,
    acceptedRequest: entry.example.request,
    requiredEvidence: [...entry.intake],
    authorityBoundaries: [...entry.boundaries],
    experience: experienceContract(experience),
    capabilityClasses: capabilityClassesForEntry(entry, experience),
    capabilityDigest: capabilityDigest(entry),
  };
}

export function buildRegressionRegistry(catalog, experienceCases) {
  const experienceById = new Map(experienceCases.map((item) => [item.id, item]));
  return {
    schemaVersion: 1,
    requiredCases,
    cases: catalog.entries.map((entry) =>
      regressionCaseFor(entry, experienceById.get(entry.id)),
    ),
  };
}

export async function readRegressionCases({ targetRoot = root } = {}) {
  return JSON.parse(await readFile(join(targetRoot, "regression-cases.json"), "utf8"));
}

export async function readPackageTexts(catalog, { targetRoot = root } = {}) {
  return new Map(
    await Promise.all(
      catalog.entries.map(async (entry) => [
        entry.id,
        (
          await Promise.all(
            ["CLAW.md", "README.md", join("workspace", "AGENTS.md")].map((path) =>
              readFile(join(targetRoot, "claws", entry.id, path), "utf8"),
            ),
          )
        ).join("\n"),
      ]),
    ),
  );
}

function firstDifference(actual, expected, path = "") {
  if (isDeepStrictEqual(actual, expected)) {
    return undefined;
  }
  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object" &&
    !Array.isArray(actual) &&
    !Array.isArray(expected)
  ) {
    for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
      const difference = firstDifference(
        actual[key],
        expected[key],
        path ? `${path}.${key}` : key,
      );
      if (difference) {
        return difference;
      }
    }
  }
  return `${path || "contract"}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`;
}

function assertSessionFixture(entry, experience) {
  const fixture = (entry.resources ?? []).find(
    (resource) => resource.path === "fixtures/session-demo.json",
  );
  if (!fixture) {
    if (experience.target === 3) {
      throw new Error(`${entry.id} is missing its accepted-request session fixture.`);
    }
    return;
  }
  let session;
  try {
    session = JSON.parse(fixture.content);
  } catch (error) {
    throw new Error(`${entry.id} has an invalid accepted-request session fixture: ${error.message}`);
  }
  if (
    session.schemaVersion !== "awesomeClaws.sessionDemo.v1" ||
    session.claw !== entry.id ||
    session.scenario !== entry.example.request ||
    session.messages?.[0]?.role !== "user" ||
    session.messages[0].text !== entry.example.request ||
    typeof session.report?.summary !== "string" ||
    !session.report.summary.trim() ||
    typeof session.report?.output !== "string" ||
    !isSafePackagePath(session.report.output) ||
    !session.report.output.startsWith("outputs/") ||
    (experience.target === 3 && session.report.output !== experience.output)
  ) {
    throw new Error(`${entry.id} accepted-request session fixture has drifted.`);
  }
}

export function evaluateRegressionRequest(contract, input) {
  if (input.request !== contract.acceptedRequest) {
    return { status: "unsupported", code: "request-mismatch" };
  }
  const providedEvidence = new Set(input.providedEvidence);
  const missing = contract.requiredEvidence.filter(
    (item) => !providedEvidence.has(item),
  );
  if (missing.length > 0) {
    return { status: "blocked", code: "missing-evidence", missing };
  }
  const approvals = new Set(input.approvals);
  const unapproved = input.requestedBoundaries.filter(
    (item) => !approvals.has(item),
  );
  if (unapproved.length > 0) {
    return { status: "refused", code: "authority-required", boundaries: unapproved };
  }
  return { status: "accepted", code: "ready" };
}

export function runRegressionCases({
  registry,
  catalog,
  experienceCases,
  packageTexts,
  onlyIds,
}) {
  if (
    !hasExactKeys(registry, ["schemaVersion", "requiredCases", "cases"]) ||
    registry.schemaVersion !== 1 ||
    !isDeepStrictEqual(registry.requiredCases, requiredCases) ||
    !Array.isArray(registry.cases)
  ) {
    throw new Error(
      "regression-cases.json must contain every required schemaVersion 1 regression case.",
    );
  }

  const entriesById = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const experienceById = new Map(experienceCases.map((item) => [item.id, item]));
  const caseIds = registry.cases.map((item) => item?.id);
  if (new Set(caseIds).size !== caseIds.length) {
    throw new Error(
      "Regression contracts contain a duplicate Claw id. Run npm run test:regression -- --update.",
    );
  }
  const missing = catalog.entries
    .map((entry) => entry.id)
    .filter((id) => !caseIds.includes(id));
  const unknown = caseIds.filter((id) => !entriesById.has(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Regression contracts must cover every catalog Claw exactly once (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}). Run npm run test:regression -- --update.`,
    );
  }

  const capabilityMatrix = buildCapabilityMatrix(catalog, experienceCases);
  const knownClasses = new Set(capabilityMatrix.classes.map((item) => item.id));
  const requestedIds = new Set(onlyIds ?? []);
  const unknownRequestedIds = [...requestedIds].filter((id) => !entriesById.has(id));
  if (unknownRequestedIds.length > 0) {
    throw new Error(`Unknown regression Claw ids: ${unknownRequestedIds.join(", ")}`);
  }
  const contracts =
    requestedIds.size === 0
      ? registry.cases
      : registry.cases.filter((contract) => requestedIds.has(contract.id));
  const results = [];
  for (const contract of contracts) {
    if (
      !hasExactKeys(contract, allowedCaseKeys) ||
      typeof contract.acceptedRequest !== "string" ||
      !contract.acceptedRequest.trim() ||
      !Array.isArray(contract.requiredEvidence) ||
      contract.requiredEvidence.length < 1 ||
      contract.requiredEvidence.some(
        (item) => typeof item !== "string" || !item.trim(),
      ) ||
      new Set(contract.requiredEvidence).size !== contract.requiredEvidence.length ||
      !Array.isArray(contract.authorityBoundaries) ||
      contract.authorityBoundaries.length < 1 ||
      contract.authorityBoundaries.some(
        (item) => typeof item !== "string" || !item.trim(),
      ) ||
      new Set(contract.authorityBoundaries).size !== contract.authorityBoundaries.length ||
      !isSafePackagePath(contract.experience?.output) ||
      !contract.experience.output.startsWith("outputs/") ||
      !Array.isArray(contract.capabilityClasses) ||
      contract.capabilityClasses.some(
        (id) => typeof id !== "string" || !knownClasses.has(id),
      ) ||
      new Set(contract.capabilityClasses).size !== contract.capabilityClasses.length ||
      !/^sha256:[a-f0-9]{64}$/u.test(contract.capabilityDigest)
    ) {
      throw new Error(`${contract.id ?? "unknown"} has an invalid regression contract.`);
    }

    const entry = entriesById.get(contract.id);
    const experience = experienceById.get(contract.id);
    const expected = regressionCaseFor(entry, experience);
    const difference = firstDifference(contract, expected);
    if (difference) {
      throw new Error(
        `${contract.id} regression contract has drifted from catalog metadata (${difference}). Run npm run test:regression -- --update to accept the reviewed change.`,
      );
    }
    assertSessionFixture(entry, experience);

    const packageText = packageTexts?.get(entry.id);
    const omittedText =
      packageText === undefined
        ? []
        : [
            contract.acceptedRequest,
            ...contract.requiredEvidence,
            ...contract.authorityBoundaries,
          ].filter((text) => !packageText.includes(text));
    if (omittedText.length > 0) {
      throw new Error(
        `${entry.id} materialized instructions omit regression contract text: ${omittedText.map((text) => JSON.stringify(text)).join(", ")}. Run npm run build.`,
      );
    }

    const baseInput = {
      request: contract.acceptedRequest,
      providedEvidence: [...contract.requiredEvidence],
      requestedBoundaries: [],
      approvals: [],
    };
    const accepted = evaluateRegressionRequest(contract, baseInput);
    const missingEvidence = evaluateRegressionRequest(contract, {
      ...baseInput,
      providedEvidence: contract.requiredEvidence.slice(1),
    });
    const authorityBoundary = evaluateRegressionRequest(contract, {
      ...baseInput,
      requestedBoundaries: [contract.authorityBoundaries[0]],
    });
    if (
      accepted.status !== "accepted" ||
      missingEvidence.status !== "blocked" ||
      !isDeepStrictEqual(missingEvidence.missing, [contract.requiredEvidence[0]]) ||
      authorityBoundary.status !== "refused" ||
      !isDeepStrictEqual(authorityBoundary.boundaries, [contract.authorityBoundaries[0]])
    ) {
      throw new Error(
        `${entry.id} failed its deterministic behavior vectors: ${JSON.stringify({ accepted, missingEvidence, authorityBoundary })}.`,
      );
    }
    results.push({
      id: entry.id,
      accepted,
      missingEvidence,
      authorityBoundary,
      output: contract.experience,
      capabilityClasses: contract.capabilityClasses,
      capabilityDigest: contract.capabilityDigest,
    });
  }
  return results;
}

export async function runRepositoryRegressionCases({ onlyIds } = {}) {
  const catalog = await readCatalog();
  const experienceCases = await readExperienceCases(catalog);
  const registry = await readRegressionCases();
  const packageTexts = await readPackageTexts(catalog);
  return runRegressionCases({ registry, catalog, experienceCases, packageTexts, onlyIds });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--update")) {
    const catalog = await readCatalog();
    const experienceCases = await readExperienceCases(catalog);
    const registry = buildRegressionRegistry(catalog, experienceCases);
    await writeFile(
      join(root, "regression-cases.json"),
      `${JSON.stringify(registry, null, 2)}\n`,
    );
    console.log(`Updated regression contracts for ${registry.cases.length} Claws.`);
  } else {
    const onlyIds = (process.env.REGRESSION_ONLY ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const results = await runRepositoryRegressionCases({ onlyIds });
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify({ schemaVersion: 1, results }, null, 2));
    } else {
      console.log(`Regression contracts passed for ${results.length} Claws.`);
    }
  }
}
