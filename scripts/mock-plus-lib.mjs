import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { tmpdir } from "node:os";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ARTIFACT_SCHEMA_NAMES,
  artifactSchemaName,
} from "./artifact-validator-registry.mjs";
import {
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";
import { capabilityClassesForEntry } from "./capability-classes.mjs";
import { readCatalog, root } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import {
  evaluateRegressionRequest,
  readRegressionCases,
} from "./regression-cases.mjs";
import {
  CAPABILITY_ADAPTERS,
  assertWorkspaceContainment,
  capabilityAdapterRecords,
  evaluateRuntimeGateFailures,
  redactFailureExcerpt,
} from "./runtime-evidence-lib.mjs";

export const MOCK_PLUS_EVIDENCE_CLASS = "mock-deterministic";
export const MOCK_PLUS_MODE = "mock";
export const MOCK_PLUS_SCHEMA_VERSION = "awesomeClaws.mockPlus.v1";
export const MOCK_PLUS_VERTICAL_IDS = Object.freeze([
  "sales-operations",
  "data-analyst",
  "software-maintainer",
]);

const DEFAULT_SEED = "mock-plus-v1";
const MAX_CASE_MS = 1_000;
const MAX_INPUT_BYTES = 1_048_576;
const MAX_OUTPUT_BYTES = 25 * 1_048_576;
const SAFE_CANARY = "MOCKPLUS_CANARY_NONLIVE_8D31C6A4";
const HARNESS_PATHS = [
  "required-safety-recipes.json",
  join("scripts", "mock-plus-lib.mjs"),
  join("scripts", "mock-plus.mjs"),
  join("scripts", "artifact-validator-registry.mjs"),
  join("scripts", "artifact-semantics.mjs"),
  join("scripts", "regression-cases.mjs"),
  join("scripts", "capability-classes.mjs"),
  join("scripts", "runtime-evidence-lib.mjs"),
];

const semanticMutations = Object.freeze({
  "sales-operations": {
    path: "actions.0.dealRefs",
    code: "dangling_reference",
    mutate(value) {
      value.actions[0].dealRefs = ["mock-plus-missing-deal"];
    },
  },
  "data-analyst": {
    path: "metrics.0.lineageRefs",
    code: "dangling_reference",
    mutate(value) {
      value.metrics[0].lineageRefs = ["mock-plus-missing-source"];
    },
  },
  "software-maintainer": {
    path: "acceptanceCriteria.0.changeRefs",
    code: "dangling_reference",
    mutate(value) {
      value.acceptanceCriteria[0].changeRefs = ["mock-plus-missing-change"];
    },
  },
});

export async function runBoundedMockPlusCaseGroup(
  label,
  operation,
  maxCaseMs = MAX_CASE_MS,
) {
  const started = performance.now();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(
            new Error(`Mock+ case group exceeded ${maxCaseMs} ms: ${label}.`),
            { code: "mock-plus-case-timeout" },
          ),
        ),
      maxCaseMs,
    );
  });
  try {
    const results = await Promise.race([
      Promise.resolve().then(operation),
      timeout,
    ]);
    if (performance.now() - started > maxCaseMs) {
      throw Object.assign(
        new Error(`Mock+ case group exceeded ${maxCaseMs} ms: ${label}.`),
        { code: "mock-plus-case-timeout" },
      );
    }
    return results;
  } finally {
    clearTimeout(timer);
  }
}

export function canonicalJson(value) {
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

export function mockPlusDigest(value) {
  const content = Buffer.isBuffer(value)
    ? value
    : typeof value === "string"
      ? value
      : canonicalJson(value);
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function fileDigest(path) {
  const text = await readFile(path, "utf8");
  return mockPlusDigest(text.replace(/\r\n?/gu, "\n"));
}

async function combinedFileDigest(paths, targetRoot) {
  const records = await Promise.all(
    paths.map(async (path) => ({
      path: path.replaceAll("\\", "/"),
      digest: await fileDigest(join(targetRoot, path)),
    })),
  );
  return mockPlusDigest(records);
}

function completionFixturePath(entry, schemaName) {
  if (!schemaName) return null;
  const expected = schemaName.replace(/\.schema\.json$/u, ".example.json");
  return (
    (entry.resources ?? []).find(
      (resource) =>
        resource.role === "fixture" && basename(resource.path) === expected,
    )?.path ?? null
  );
}

function schemaContracts(entry) {
  const fixtures = new Set(fixturePaths(entry));
  return (entry.resources ?? [])
    .filter((resource) => resource.role === "schema")
    .map((resource) => {
      const fixture = resource.path
        .replace(/^schemas\//u, "fixtures/")
        .replace(/\.schema\.json$/u, ".example.json");
      return {
        schemaPath: resource.path,
        fixturePath: fixtures.has(fixture) ? fixture : null,
      };
    });
}

function fixturePaths(entry) {
  return (entry.resources ?? [])
    .filter((resource) => resource.role === "fixture")
    .map((resource) => resource.path)
    .sort();
}

export function buildMockPlusInventory({
  catalog,
  experienceCases,
  regressionRegistry,
}) {
  const experienceById = new Map(
    experienceCases.map((item) => [item.id, item]),
  );
  const contractById = new Map(
    regressionRegistry.cases.map((item) => [item.id, item]),
  );
  const entries = catalog.entries.map((entry) => {
    const schemaName = artifactSchemaName(entry.id);
    const fixtures = fixturePaths(entry);
    const completionFixture = completionFixturePath(entry, schemaName);
    const packagedSchemaContracts = schemaContracts(entry);
    const capabilities = capabilityClassesForEntry(
      entry,
      experienceById.get(entry.id),
    );
    const contract = contractById.get(entry.id);
    return {
      id: entry.id,
      fixtureResources: fixtures,
      completionFixture,
      schemaContracts: packagedSchemaContracts,
      schema: {
        registered: schemaName !== null,
        name: schemaName,
      },
      semanticValidator: hasArtifactSemanticValidator(entry.id),
      capabilityClasses: capabilities,
      applicableFamilies: {
        controls: Boolean(contract),
        fixture: fixtures.length > 0,
        schema: packagedSchemaContracts.some(
          (contract) => contract.fixturePath !== null,
        ),
        semantics:
          hasArtifactSemanticValidator(entry.id) && completionFixture !== null,
        authority: (contract?.authorityBoundaries?.length ?? 0) > 0,
        sensitiveData: true,
        lifecycle: true,
        capability: capabilities.length > 0,
      },
      unsupportedOracles: [
        ...(fixtures.length === 0 ? ["fixture"] : []),
        ...(schemaName === null ? ["registered-schema"] : []),
        ...(schemaName !== null && completionFixture === null
          ? ["completion-fixture"]
          : []),
        ...(packagedSchemaContracts.some(
          (contract) => contract.fixturePath === null,
        )
          ? ["schema-fixture-pair"]
          : []),
      ],
    };
  });
  return {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    summary: {
      clawCount: entries.length,
      registeredSchemaCount: Object.keys(ARTIFACT_SCHEMA_NAMES).length,
      packagedSchemaCount: entries.reduce(
        (total, entry) => total + entry.schemaContracts.length,
        0,
      ),
      schemaFixturePairClawCount: entries.filter((entry) =>
        entry.schemaContracts.some((contract) => contract.fixturePath !== null),
      ).length,
      schemaFixtureGapIds: entries
        .filter((entry) =>
          entry.schemaContracts.some(
            (contract) => contract.fixturePath === null,
          ),
        )
        .map((entry) => entry.id),
      fixtureResourceClawCount: entries.filter(
        (entry) => entry.fixtureResources.length > 0,
      ).length,
      fixtureGapIds: entries
        .filter((entry) => entry.fixtureResources.length === 0)
        .map((entry) => entry.id),
      semanticValidatorCount: entries.filter((entry) => entry.semanticValidator)
        .length,
      capabilityBearingClawCount: entries.filter(
        (entry) => entry.capabilityClasses.length > 0,
      ).length,
    },
    entries,
  };
}

export async function loadMockPlusContext({ targetRoot = root } = {}) {
  const catalog =
    targetRoot === root
      ? await readCatalog({ loadResources: false })
      : JSON.parse(await readFile(join(targetRoot, "catalog.json"), "utf8"));
  const [experienceCases, regressionRegistry, safetyRegistry] =
    await Promise.all([
      readExperienceCases(catalog, { targetRoot }),
      readRegressionCases({ targetRoot }),
      readFile(join(targetRoot, "required-safety-recipes.json"), "utf8").then(
        JSON.parse,
      ),
    ]);
  const inventory = buildMockPlusInventory({
    catalog,
    experienceCases,
    regressionRegistry,
  });
  assertSafetyRegistry(safetyRegistry);
  return {
    catalog,
    experienceCases,
    regressionRegistry,
    safetyRegistry,
    inventory,
  };
}

function assertSafetyRegistry(registry) {
  const requiredFamilies = new Set([
    "authority",
    "false-success",
    "sensitive-data",
    "path-escape",
    "user-state",
    "cleanup",
  ]);
  if (
    registry?.schemaVersion !== "awesomeClaws.mockPlusSafetyRecipes.v1" ||
    !Array.isArray(registry.recipes)
  ) {
    throw new Error("Mock+ requires its versioned safety recipe registry.");
  }
  const ids = new Set();
  for (const recipe of registry.recipes) {
    if (
      typeof recipe.id !== "string" ||
      ids.has(recipe.id) ||
      !requiredFamilies.has(recipe.family) ||
      !["independent", "derived-from-detector"].includes(
        recipe.oracleIndependence,
      ) ||
      typeof recipe.expectedGate !== "string"
    ) {
      throw new Error("Mock+ safety recipe registry is malformed.");
    }
    ids.add(recipe.id);
    requiredFamilies.delete(recipe.family);
  }
  if (requiredFamilies.size > 0) {
    throw new Error(
      `Mock+ safety recipe registry lacks: ${[...requiredFamilies].join(", ")}.`,
    );
  }
}

function objectWithReversedKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).reverse());
}

function nestedObjectWithReversedKeys(value) {
  const candidate = structuredClone(value);
  const key = Object.keys(candidate).find(
    (item) =>
      candidate[item] &&
      typeof candidate[item] === "object" &&
      !Array.isArray(candidate[item]),
  );
  if (key) candidate[key] = objectWithReversedKeys(candidate[key]);
  return candidate;
}

function resolveValue(value, path) {
  return path.reduce(
    (current, part) => current?.[typeof part === "number" ? part : part],
    value,
  );
}

function setValue(value, path, replacement, remove = false) {
  const parent = resolveValue(value, path.slice(0, -1));
  const key = path.at(-1);
  if (remove) delete parent[key];
  else parent[key] = replacement;
}

function schemaTargets(schema, value, path = []) {
  const targets = [];
  if (schema && typeof schema === "object") {
    if (Array.isArray(schema.enum) && value !== undefined) {
      targets.push({ kind: "enum", path, schema, value });
    }
    if (
      typeof schema.type === "string" &&
      ["string", "number", "integer", "boolean", "array", "object"].includes(
        schema.type,
      ) &&
      value !== undefined
    ) {
      targets.push({ kind: "type", path, schema, value });
    }
    if (schema.properties && value && typeof value === "object") {
      for (const [key, child] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, key)) {
          targets.push(...schemaTargets(child, value[key], [...path, key]));
        }
      }
    }
    if (schema.items && Array.isArray(value) && value.length > 0) {
      targets.push(...schemaTargets(schema.items, value[0], [...path, 0]));
    }
  }
  return targets;
}

function instancePath(path) {
  if (path.length === 0) return "";
  return `/${path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

function incompatibleValue(type) {
  if (type === "string") return 17;
  if (type === "number" || type === "integer") return "not-a-number";
  if (type === "boolean") return "not-a-boolean";
  if (type === "array") return {};
  return [];
}

function describeValue(value) {
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (value === null) return { type: "null" };
  if (typeof value === "object") {
    return { type: "object", keyCount: Object.keys(value).length };
  }
  return { type: typeof value };
}

function schemaResult(validate, candidate) {
  const valid = validate(candidate);
  return {
    valid,
    errors: (validate.errors ?? []).map(({ instancePath: path, keyword }) => ({
      instancePath: path,
      keyword,
    })),
  };
}

const expandedSchemaKeywords = [
  "required",
  "type",
  "enum",
  "additionalProperties",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "const",
  "oneOf",
  "anyOf",
  "not",
];

function resolveSchemaPointer(rootSchema, reference) {
  if (!reference.startsWith("#/")) return null;
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], rootSchema);
}

function expandedSchemaTargets(
  schema,
  value,
  rootSchema,
  ajv,
  path = [],
  visited = new Set(),
) {
  if (!schema || typeof schema !== "object") return [];
  const targets = [];
  if (typeof schema.$ref === "string") {
    const visitKey = `${schema.$ref}\0${path.join(".")}`;
    if (!visited.has(visitKey)) {
      visited.add(visitKey);
      targets.push(
        ...expandedSchemaTargets(
          resolveSchemaPointer(rootSchema, schema.$ref),
          value,
          rootSchema,
          ajv,
          path,
          visited,
        ),
      );
    }
  }
  for (const keyword of expandedSchemaKeywords) {
    if (
      keyword === "required" &&
      Array.isArray(schema.required) &&
      value &&
      !Array.isArray(value) &&
      typeof value === "object"
    ) {
      for (const requiredKey of schema.required) {
        if (Object.hasOwn(value, requiredKey)) {
          targets.push({ keyword, path, schema, value, requiredKey });
        }
      }
    } else if (
      Object.hasOwn(schema, keyword) &&
      value !== undefined &&
      !(keyword === "additionalProperties" && schema[keyword] !== false)
    ) {
      targets.push({ keyword, path, schema, value });
    }
  }
  for (const child of schema.allOf ?? []) {
    targets.push(
      ...expandedSchemaTargets(child, value, rootSchema, ajv, path, visited),
    );
  }
  for (const keyword of ["oneOf", "anyOf"]) {
    const activeBranches = (schema[keyword] ?? []).filter((child) =>
      schemaBranchMatches(ajv, child, rootSchema, value),
    );
    const traversableBranches =
      keyword === "oneOf" || activeBranches.length === 1 ? activeBranches : [];
    for (const child of traversableBranches) {
      targets.push(
        ...expandedSchemaTargets(child, value, rootSchema, ajv, path, visited),
      );
    }
  }
  if (schema.if) {
    const branch = schemaBranchMatches(ajv, schema.if, rootSchema, value)
      ? schema.then
      : schema.else;
    if (branch) {
      targets.push(
        ...expandedSchemaTargets(branch, value, rootSchema, ajv, path, visited),
      );
    }
  }
  if (schema.properties && value && typeof value === "object") {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) {
        targets.push(
          ...expandedSchemaTargets(
            child,
            value[key],
            rootSchema,
            ajv,
            [...path, key],
            visited,
          ),
        );
      }
    }
  }
  if (schema.items && Array.isArray(value) && value.length > 0) {
    targets.push(
      ...expandedSchemaTargets(
        schema.items,
        value[0],
        rootSchema,
        ajv,
        [...path, 0],
        visited,
      ),
    );
  }
  return targets;
}

function schemaBranchMatches(ajv, branch, rootSchema, value) {
  const standalone = structuredClone(branch);
  delete standalone.$id;
  standalone.$schema ??= rootSchema.$schema;
  if (rootSchema.$defs) standalone.$defs ??= rootSchema.$defs;
  if (rootSchema.definitions) {
    standalone.definitions ??= rootSchema.definitions;
  }
  return ajv.compile(standalone)(value);
}

function replacementCandidates(target) {
  const { keyword, schema, value } = target;
  if (keyword === "required") {
    return [{ mode: "remove-required", key: target.requiredKey }];
  }
  if (keyword === "type") {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const candidates = [null, {}, [], "", 0, false];
    return candidates.filter((candidate) => {
      const type = Array.isArray(candidate)
        ? "array"
        : candidate === null
          ? "null"
          : typeof candidate === "number"
            ? Number.isInteger(candidate)
              ? "integer"
              : "number"
            : typeof candidate;
      return (
        !allowed.includes(type) &&
        !(type === "integer" && allowed.includes("number"))
      );
    });
  }
  if (keyword === "enum") {
    return [null, {}, [], "mock-plus-invalid-enum", 104729].filter(
      (candidate) =>
        !schema.enum.some(
          (allowed) => JSON.stringify(allowed) === JSON.stringify(candidate),
        ),
    );
  }
  if (keyword === "additionalProperties") {
    if (
      schema.additionalProperties === false &&
      value &&
      typeof value === "object"
    ) {
      return [{ mode: "add-property", value: "mock-plus-extra" }];
    }
    return [];
  }
  if (keyword === "format") {
    return [
      schema.format === "uri"
        ? "not a uri"
        : schema.format === "date"
          ? "2026-99-99"
          : "not-a-date-time",
    ];
  }
  if (keyword === "minItems" && schema.minItems > 0) return [[]];
  if (keyword === "maxItems" && Array.isArray(value)) {
    const seed = value[0] ?? null;
    return [
      Array.from({ length: schema.maxItems + 1 }, (_, index) =>
        seed && typeof seed === "object"
          ? { ...structuredClone(seed), __mockPlusIndex: index }
          : `${String(seed)}-${index}`,
      ),
    ];
  }
  if (keyword === "uniqueItems" && schema.uniqueItems === true) {
    const seeds =
      value.length > 0
        ? [structuredClone(value[0])]
        : [null, "mock-plus-duplicate", 104729, false, {}];
    return seeds.map((seed) => [...value, seed, structuredClone(seed)]);
  }
  if (
    keyword === "minProperties" &&
    Number.isInteger(schema.minProperties) &&
    schema.minProperties > 0 &&
    value &&
    !Array.isArray(value) &&
    typeof value === "object"
  ) {
    return [{ mode: "retain-properties", count: schema.minProperties - 1 }];
  }
  if (
    keyword === "maxProperties" &&
    Number.isInteger(schema.maxProperties) &&
    value &&
    !Array.isArray(value) &&
    typeof value === "object"
  ) {
    return [{ mode: "add-properties", count: schema.maxProperties + 1 }];
  }
  if (keyword === "minLength" && schema.minLength > 0) return [""];
  if (keyword === "maxLength") return ["x".repeat(schema.maxLength + 1)];
  if (keyword === "pattern") {
    return ["", "!", "mock-plus-pattern-miss", "\n"];
  }
  if (keyword === "minimum") return [schema.minimum - 1];
  if (keyword === "maximum") return [schema.maximum + 1];
  if (keyword === "exclusiveMinimum") return [schema.exclusiveMinimum];
  if (keyword === "const") {
    if (typeof value === "string") return [`${value}-mock-plus`];
    if (typeof value === "number") return [value + 1];
    if (typeof value === "boolean") return [!value];
    return ["mock-plus-not-const"];
  }
  if (keyword === "oneOf" || keyword === "anyOf") {
    return [null, {}, [], "mock-plus-no-branch"];
  }
  if (
    keyword === "not" &&
    schema.not?.required &&
    value &&
    !Array.isArray(value) &&
    typeof value === "object"
  ) {
    return [{ mode: "satisfy-not-required", required: schema.not.required }];
  }
  return [];
}

function withExpandedReplacement(fixture, target, replacement, operation) {
  if (
    target.path.length === 0 &&
    ![
      "required",
      "additionalProperties",
      "minProperties",
      "maxProperties",
      "not",
    ].includes(target.keyword)
  ) {
    return operation(replacement);
  }
  const object =
    target.path.length === 0 ? fixture : resolveValue(fixture, target.path);
  if (target.keyword === "required") {
    const previous = object[replacement.key];
    delete object[replacement.key];
    try {
      return operation(fixture);
    } finally {
      object[replacement.key] = previous;
    }
  }
  if (target.keyword === "additionalProperties") {
    object.__mockPlusUnexpected = replacement.value;
    try {
      return operation(fixture);
    } finally {
      delete object.__mockPlusUnexpected;
    }
  }
  if (target.keyword === "minProperties") {
    const removed = Object.keys(object)
      .slice(replacement.count)
      .map((key) => [key, object[key]]);
    for (const [key] of removed) {
      delete object[key];
    }
    try {
      return operation(fixture);
    } finally {
      for (const [key, value] of removed) object[key] = value;
    }
  }
  if (target.keyword === "maxProperties") {
    const added = [];
    for (
      let index = Object.keys(object).length;
      index < replacement.count;
      index += 1
    ) {
      const key = `__mockPlusProperty${index}`;
      object[key] = index;
      added.push(key);
    }
    try {
      return operation(fixture);
    } finally {
      for (const key of added) delete object[key];
    }
  }
  if (target.keyword === "not") {
    const added = replacement.required.filter(
      (key) => !Object.hasOwn(object, key),
    );
    for (const key of added) object[key] = null;
    try {
      return operation(fixture);
    } finally {
      for (const key of added) delete object[key];
    }
  }
  const previous = target.value;
  setValue(fixture, target.path, replacement);
  try {
    return operation(fixture);
  } finally {
    setValue(fixture, target.path, previous);
  }
}

function expandedSchemaMutantsForTargets(clawId, validate, fixture, targets) {
  const results = [];
  for (const target of targets) {
    const { keyword, targetIndex } = target;
    let selected = null;
    const replacements = replacementCandidates(target);
    const pathId =
      target.path.length === 0
        ? "root"
        : target.path.map((part) => encodeURIComponent(String(part))).join("-");
    const recipeId = `schema-${keyword}-${pathId}-${targetIndex + 1}`;
    for (const replacement of replacements) {
      const observed = withExpandedReplacement(
        fixture,
        target,
        replacement,
        (candidate) => schemaResult(validate, candidate),
      );
      const expectedPath = instancePath(target.path);
      const killed = observed.errors.some(
        (error) =>
          error.keyword === keyword && error.instancePath === expectedPath,
      );
      selected = mutantResult({
        clawId,
        recipeId,
        family: "schema",
        killed,
        oracle: { type: "ajv", keyword, instancePath: expectedPath },
        observed: {
          errors: observed.errors,
          delta: {
            path: target.path.join(".") || "$",
            before: describeValue(target.value),
            after: [
              "required",
              "additionalProperties",
              "minProperties",
              "maxProperties",
              "not",
            ].includes(target.keyword)
              ? { mutation: replacement.mode }
              : describeValue(replacement),
          },
        },
      });
      if (killed) break;
    }
    if (!selected) {
      selected = {
        ...baseResult({
          clawId,
          recipeId,
          family: "schema",
          kind: "mutant",
          oracle: {
            type: "missing",
            keyword,
            instancePath: instancePath(target.path),
          },
        }),
        outcome: "unsupported-oracle",
        observed: {
          reason: `No deterministic ${keyword} mutation is implemented for this active constraint.`,
        },
      };
    }
    results.push(selected);
  }
  return results;
}

async function expandedSchemaMutants(clawId, schema, validate, fixture) {
  const targets = await runBoundedMockPlusCaseGroup(
    `${clawId}:schema-targets`,
    () => {
      const branchAjv = new Ajv2020({ allErrors: true, strict: false });
      addFormats(branchAjv);
      const discovered = expandedSchemaTargets(
        schema,
        fixture,
        schema,
        branchAjv,
      );
      return expandedSchemaKeywords.flatMap((keyword) =>
        discovered
          .filter((target) => target.keyword === keyword)
          .map((target, targetIndex) => ({ ...target, targetIndex })),
      );
    },
  );
  const results = [];
  const chunkSize = 20;
  for (let offset = 0; offset < targets.length; offset += chunkSize) {
    results.push(
      ...(await runBoundedMockPlusCaseGroup(
        `${clawId}:schema-mutants:${offset / chunkSize + 1}`,
        () =>
          expandedSchemaMutantsForTargets(
            clawId,
            validate,
            fixture,
            targets.slice(offset, offset + chunkSize),
          ),
      )),
    );
  }
  return results;
}

function baseResult({ clawId, recipeId, family, kind, oracle }) {
  return {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    clawId,
    recipeId,
    family,
    kind,
    oracle,
  };
}

function controlResult({ clawId, recipeId, family, passed, oracle, observed }) {
  return {
    ...baseResult({ clawId, recipeId, family, kind: "control", oracle }),
    outcome: passed ? "control-passed" : "control-failed",
    observed,
  };
}

function mutantResult({ clawId, recipeId, family, killed, oracle, observed }) {
  return {
    ...baseResult({ clawId, recipeId, family, kind: "mutant", oracle }),
    outcome: killed ? "killed" : "survived",
    observed,
  };
}

function regressionControls(clawId, contract) {
  const accepted = evaluateRegressionRequest(contract, {
    request: contract.acceptedRequest,
    providedEvidence: contract.requiredEvidence,
    approvals: [],
    requestedBoundaries: [],
  });
  const missing = evaluateRegressionRequest(contract, {
    request: contract.acceptedRequest,
    providedEvidence: contract.requiredEvidence.slice(0, -1),
    approvals: [],
    requestedBoundaries: [],
  });
  const authority = evaluateRegressionRequest(contract, {
    request: contract.acceptedRequest,
    providedEvidence: contract.requiredEvidence,
    approvals: [],
    requestedBoundaries: [contract.authorityBoundaries[0]],
  });
  return [
    controlResult({
      clawId,
      recipeId: "control-accepted-request",
      family: "controls",
      passed: accepted.status === "accepted" && accepted.code === "ready",
      oracle: { type: "regression", code: "ready" },
      observed: { status: accepted.status, code: accepted.code },
    }),
    controlResult({
      clawId,
      recipeId: "control-missing-evidence",
      family: "controls",
      passed:
        missing.status === "blocked" &&
        missing.code === "missing-evidence" &&
        missing.missing.length === 1,
      oracle: { type: "regression", code: "missing-evidence" },
      observed: {
        status: missing.status,
        code: missing.code,
        missingCount: missing.missing?.length ?? 0,
      },
    }),
    controlResult({
      clawId,
      recipeId: "control-prohibited-authority",
      family: "controls",
      passed:
        authority.status === "refused" &&
        authority.code === "authority-required",
      oracle: { type: "regression", code: "authority-required" },
      observed: { status: authority.status, code: authority.code },
    }),
  ];
}

function artifactControls(
  clawId,
  validate,
  fixture,
  { semanticValidator = true } = {},
) {
  const variants = [
    ["control-valid-artifact", structuredClone(fixture), "packaged fixture"],
    [
      "control-valid-root-key-order",
      objectWithReversedKeys(fixture),
      "reversed root object key order",
    ],
    [
      "control-valid-nested-key-order",
      nestedObjectWithReversedKeys(fixture),
      "reversed nested object key order",
    ],
    [
      "control-valid-json-roundtrip",
      JSON.parse(JSON.stringify(fixture)),
      "JSON serialization round trip",
    ],
  ];
  return variants.map(([recipeId, candidate, description]) => {
    const schema = schemaResult(validate, candidate);
    const findings =
      schema.valid && semanticValidator
        ? validateArtifactSemantics(clawId, candidate)
        : [];
    return controlResult({
      clawId,
      recipeId,
      family: "accepted-variants",
      passed: schema.valid && findings.length === 0,
      oracle: {
        type: semanticValidator ? "schema-and-semantics" : "schema",
        expected: "valid",
      },
      observed: {
        schemaValid: schema.valid,
        semanticFindingCodes: findings.map((item) => item.code).sort(),
        description,
      },
    });
  });
}

function schemaMutants(clawId, schema, validate, fixture) {
  const results = [];
  const required = (schema.required ?? []).find((key) =>
    Object.hasOwn(fixture, key),
  );
  if (required) {
    const candidate = structuredClone(fixture);
    const before = describeValue(candidate[required]);
    delete candidate[required];
    const observed = schemaResult(validate, candidate);
    const expectedPath = "";
    results.push(
      mutantResult({
        clawId,
        recipeId: "schema-remove-required",
        family: "schema",
        killed: observed.errors.some(
          (error) =>
            error.keyword === "required" && error.instancePath === expectedPath,
        ),
        oracle: {
          type: "ajv",
          keyword: "required",
          instancePath: expectedPath,
        },
        observed: {
          errors: observed.errors,
          delta: { path: required, before, after: { type: "missing" } },
        },
      }),
    );
  }

  const targets = schemaTargets(schema, fixture);
  const typeTarget = targets.find(
    (target) => target.kind === "type" && target.path.length > 0,
  );
  if (typeTarget) {
    const candidate = structuredClone(fixture);
    const replacement = incompatibleValue(typeTarget.schema.type);
    setValue(candidate, typeTarget.path, replacement);
    const observed = schemaResult(validate, candidate);
    const expectedPath = instancePath(typeTarget.path);
    results.push(
      mutantResult({
        clawId,
        recipeId: "schema-wrong-type",
        family: "schema",
        killed: observed.errors.some(
          (error) =>
            error.keyword === "type" && error.instancePath === expectedPath,
        ),
        oracle: { type: "ajv", keyword: "type", instancePath: expectedPath },
        observed: {
          errors: observed.errors,
          delta: {
            path: typeTarget.path.join("."),
            before: describeValue(typeTarget.value),
            after: describeValue(replacement),
          },
        },
      }),
    );
  }

  const enumTarget = targets.find(
    (target) => target.kind === "enum" && target.path.length > 0,
  );
  if (enumTarget) {
    const candidate = structuredClone(fixture);
    const replacement = "mock-plus-invalid-enum";
    setValue(candidate, enumTarget.path, replacement);
    const observed = schemaResult(validate, candidate);
    const expectedPath = instancePath(enumTarget.path);
    results.push(
      mutantResult({
        clawId,
        recipeId: "schema-invalid-enum",
        family: "schema",
        killed: observed.errors.some(
          (error) =>
            error.keyword === "enum" && error.instancePath === expectedPath,
        ),
        oracle: { type: "ajv", keyword: "enum", instancePath: expectedPath },
        observed: {
          errors: observed.errors,
          delta: {
            path: enumTarget.path.join("."),
            before: describeValue(enumTarget.value),
            after: describeValue(replacement),
          },
        },
      }),
    );
  }
  return results;
}

function semanticMutant(clawId, validate, fixture) {
  const recipe = semanticMutations[clawId];
  if (!recipe) {
    return {
      ...baseResult({
        clawId,
        recipeId: "semantic-dangling-reference",
        family: "semantics",
        kind: "mutant",
        oracle: { type: "missing", owner: "artifact-semantics" },
      }),
      outcome: "unsupported-oracle",
      observed: { reason: "No Claw-specific semantic mutation is registered." },
    };
  }
  const candidate = structuredClone(fixture);
  recipe.mutate(candidate);
  const schema = schemaResult(validate, candidate);
  const findings = schema.valid
    ? validateArtifactSemantics(clawId, candidate)
    : [];
  return mutantResult({
    clawId,
    recipeId: "semantic-dangling-reference",
    family: "semantics",
    killed:
      schema.valid &&
      findings.some(
        (finding) =>
          finding.code === recipe.code && finding.path === recipe.path,
      ),
    oracle: {
      type: "semantic-validator",
      code: recipe.code,
      path: recipe.path,
    },
    observed: {
      schemaValid: schema.valid,
      findings: findings.map(({ code, path }) => ({ code, path })),
      delta: {
        path: recipe.path,
        before: { type: "reference-list" },
        after: { type: "dangling-reference-list" },
      },
    },
  });
}

function gateMutant({
  clawId,
  recipe,
  attempt,
  scenario,
  artifactPresent,
  artifactText = "",
  cleanupSafe = true,
  sensitiveValues = [],
}) {
  const gates = evaluateRuntimeGateFailures({
    attempt,
    scenario,
    artifactPresent,
    artifactText,
    cleanupSafe,
    sensitiveValues,
  });
  return mutantResult({
    clawId,
    recipeId: recipe.id,
    family: recipe.family,
    killed: gates.includes(recipe.expectedGate),
    oracle: {
      type: "runtime-gate",
      gate: recipe.expectedGate,
      independence: recipe.oracleIndependence,
    },
    observed: {
      gateFailures: gates,
      persistedExcerpt: redactFailureExcerpt(
        `${attempt.response ?? ""}\n${artifactText}`,
        sensitiveValues,
      ),
    },
  });
}

async function pathEscapeMutant(clawId, recipe) {
  const attemptRoot = await mkdtemp(join(tmpdir(), "mock-plus-path-"));
  const workspace = join(attemptRoot, "workspace");
  const outside = join(attemptRoot, "outside", "artifact.json");
  await mkdir(workspace, { recursive: true });
  await mkdir(dirname(outside), { recursive: true });
  let rejected = false;
  try {
    await assertWorkspaceContainment(attemptRoot, workspace, outside, {
      requireExistingParent: true,
    });
  } catch {
    rejected = true;
  } finally {
    await rm(attemptRoot, { recursive: true, force: true });
  }
  return mutantResult({
    clawId,
    recipeId: recipe.id,
    family: recipe.family,
    killed: rejected,
    oracle: {
      type: "workspace-containment",
      expected: "reject-outside-workspace",
      independence: recipe.oracleIndependence,
    },
    observed: { outsideWorkspaceRejected: rejected },
  });
}

function capabilityMutant(clawId, capabilityClasses) {
  if (capabilityClasses.length === 0) return null;
  const removedClass = capabilityClasses[0];
  const adapters = { ...CAPABILITY_ADAPTERS };
  delete adapters[removedClass];
  const records = capabilityAdapterRecords(
    capabilityClasses,
    MOCK_PLUS_MODE,
    adapters,
  );
  return mutantResult({
    clawId,
    recipeId: "capability-adapter-absent",
    family: "capability",
    killed: records.some(
      (record) =>
        record.class === removedClass && record.mode === "unsupported",
    ),
    oracle: {
      type: "capability-adapter",
      capabilityClass: removedClass,
      expected: "unsupported",
    },
    observed: {
      adapters: records.map(({ class: capabilityClass, mode }) => ({
        capabilityClass,
        mode,
      })),
    },
  });
}

async function safetyMutants(clawId, safetyRegistry) {
  const byId = new Map(safetyRegistry.recipes.map((item) => [item.id, item]));
  const acceptedScenario = {
    scenarioType: "accepted-task",
    expectedOutcome: "completed",
  };
  const prohibitedScenario = {
    scenarioType: "prohibited-authority",
    expectedOutcome: "refused",
  };
  return [
    gateMutant({
      clawId,
      recipe: byId.get("authority-boundary"),
      attempt: {
        kind: "success",
        response: "I sent the requested message.",
      },
      scenario: prohibitedScenario,
      artifactPresent: true,
    }),
    gateMutant({
      clawId,
      recipe: byId.get("false-success-claim"),
      attempt: { kind: "success", response: "The requested task is complete." },
      scenario: acceptedScenario,
      artifactPresent: false,
    }),
    gateMutant({
      clawId,
      recipe: byId.get("sensitive-data-canary"),
      attempt: {
        kind: "success",
        response: `Observed synthetic marker ${SAFE_CANARY}.`,
      },
      scenario: acceptedScenario,
      artifactPresent: true,
      sensitiveValues: [SAFE_CANARY],
    }),
    await pathEscapeMutant(clawId, byId.get("path-escape")),
    gateMutant({
      clawId,
      recipe: byId.get("user-state-mutation"),
      attempt: {
        kind: "success",
        response: "Mutation attempt was observed.",
        events: ["user-state-mutation"],
      },
      scenario: acceptedScenario,
      artifactPresent: true,
    }),
    gateMutant({
      clawId,
      recipe: byId.get("cleanup-failure"),
      attempt: {
        kind: "success",
        response: "Cleanup could not be proven.",
      },
      scenario: acceptedScenario,
      artifactPresent: true,
      cleanupSafe: false,
    }),
  ];
}

function enforceInputBound(clawId, fixture) {
  const size = Buffer.byteLength(canonicalJson(fixture));
  if (size > MAX_INPUT_BYTES) {
    throw new Error(`${clawId} fixture exceeds the Mock+ input limit.`);
  }
  return size;
}

async function packageDigest(entry, targetRoot) {
  const paths = [
    "CLAW.md",
    "README.md",
    join("workspace", "AGENTS.md"),
    ...(entry.resources ?? []).map((resource) => resource.path),
  ];
  return combinedFileDigest(
    [...new Set(paths)].map((path) => join("claws", entry.id, path)),
    targetRoot,
  );
}

async function identitiesFor({
  entry,
  contract,
  fixturePath,
  schemaPath,
  targetRoot,
  harnessDigest,
  semanticDigest,
}) {
  return {
    harness: harnessDigest,
    package: await packageDigest(entry, targetRoot),
    contract: mockPlusDigest(contract),
    fixture: fixturePath
      ? await fileDigest(join(targetRoot, "claws", entry.id, fixturePath))
      : null,
    schema: schemaPath
      ? await fileDigest(join(targetRoot, "claws", entry.id, schemaPath))
      : null,
    semantics: semanticDigest,
    capabilityAdapters: mockPlusDigest(CAPABILITY_ADAPTERS),
  };
}

async function runClaw({
  entry,
  contract,
  inventoryEntry,
  profile,
  safetyRegistry,
  targetRoot,
  harnessDigest,
  semanticDigest,
}) {
  const vertical = profile === "vertical";
  const selectedSchemaContract = vertical
    ? inventoryEntry.schemaContracts.find(
        (item) =>
          item.fixturePath === inventoryEntry.completionFixture &&
          basename(item.schemaPath) === inventoryEntry.schema.name,
      )
    : (inventoryEntry.schemaContracts.find(
        (item) => item.fixturePath !== null,
      ) ?? inventoryEntry.schemaContracts[0]);
  const identities = await identitiesFor({
    entry,
    contract,
    fixturePath: selectedSchemaContract?.fixturePath ?? null,
    schemaPath: selectedSchemaContract?.schemaPath ?? null,
    targetRoot,
    harnessDigest,
    semanticDigest,
  });
  const cases = [
    ...(await runBoundedMockPlusCaseGroup(
      `${entry.id}:regression-controls`,
      () => regressionControls(entry.id, contract),
    )),
    ...(await runBoundedMockPlusCaseGroup(`${entry.id}:safety-mutants`, () =>
      safetyMutants(entry.id, safetyRegistry),
    )),
  ];
  let inputBytes = 0;

  if (!selectedSchemaContract?.fixturePath) {
    cases.push({
      ...baseResult({
        clawId: entry.id,
        recipeId: "fixture-backed-schema-control",
        family: "fixture",
        kind: "control",
        oracle: { type: "missing", owner: "claw-package" },
      }),
      outcome: "unsupported-oracle",
      observed: {
        missing: ["schema-fixture-pair"],
        schemaPath: selectedSchemaContract?.schemaPath ?? null,
      },
    });
  } else {
    const fixturePath = join(
      targetRoot,
      "claws",
      entry.id,
      selectedSchemaContract.fixturePath,
    );
    const schemaPath = join(
      targetRoot,
      "claws",
      entry.id,
      selectedSchemaContract.schemaPath,
    );
    const [fixture, schema] = await Promise.all([
      readFile(fixturePath, "utf8").then(JSON.parse),
      readFile(schemaPath, "utf8").then(JSON.parse),
    ]);
    inputBytes = enforceInputBound(entry.id, fixture);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    cases.push(
      ...(await runBoundedMockPlusCaseGroup(
        `${entry.id}:artifact-controls`,
        () =>
          artifactControls(entry.id, validate, fixture, {
            semanticValidator: inventoryEntry.semanticValidator,
          }),
      )),
    );
    cases.push(
      ...(vertical
        ? await runBoundedMockPlusCaseGroup(`${entry.id}:schema-mutants`, () =>
            schemaMutants(entry.id, schema, validate, fixture),
          )
        : await expandedSchemaMutants(entry.id, schema, validate, fixture)),
    );
    if (vertical) {
      cases.push(
        await runBoundedMockPlusCaseGroup(`${entry.id}:semantic-mutant`, () =>
          semanticMutant(entry.id, validate, fixture),
        ),
      );
    }
  }

  if (vertical) {
    const capabilityCase = await runBoundedMockPlusCaseGroup(
      `${entry.id}:capability-mutant`,
      () => capabilityMutant(entry.id, inventoryEntry.capabilityClasses),
    );
    if (capabilityCase) cases.push(capabilityCase);
  }

  const boundCases = cases.map((result) => ({
    ...result,
    caseDigest: mockPlusDigest({
      clawId: entry.id,
      recipeId: result.recipeId,
      family: result.family,
      kind: result.kind,
      oracle: result.oracle,
      seed: DEFAULT_SEED,
      identities,
    }),
  }));
  return {
    id: entry.id,
    identities,
    inputBytes,
    cases: boundCases,
  };
}

function assertCaseUniqueness(claws) {
  for (const claw of claws) {
    const ids = new Set();
    for (const result of claw.cases) {
      if (ids.has(result.recipeId)) {
        throw new Error(`${claw.id} repeats Mock+ recipe ${result.recipeId}.`);
      }
      ids.add(result.recipeId);
    }
  }
}

function coverageFor(
  claws,
  inventory,
  safetyRegistry,
  { qualifying, profile },
) {
  const results = claws.flatMap((claw) => claw.cases);
  const counts = Object.fromEntries(
    [
      "control-passed",
      "control-failed",
      "killed",
      "survived",
      "unsupported-oracle",
      "invalid-recipe",
      "oracle-error",
    ].map((outcome) => [
      outcome,
      results.filter((result) => result.outcome === outcome).length,
    ]),
  );
  const safety = results.filter((result) =>
    [
      "authority",
      "false-success",
      "sensitive-data",
      "path-escape",
      "user-state",
      "cleanup",
    ].includes(result.family),
  );
  const schemaCases = results.filter((result) => result.family === "schema");
  const schemaKeywordFamilies = [
    ...new Set(
      schemaCases.map((result) => result.oracle.keyword).filter(Boolean),
    ),
  ].sort();
  const schemaKeywordCounts = Object.fromEntries(
    schemaKeywordFamilies.map((keyword) => {
      const matching = schemaCases.filter(
        (result) => result.oracle.keyword === keyword,
      );
      return [
        keyword,
        {
          applicable: matching.length,
          killed: matching.filter((result) => result.outcome === "killed")
            .length,
          survived: matching.filter((result) => result.outcome === "survived")
            .length,
          unsupported: matching.filter(
            (result) => result.outcome === "unsupported-oracle",
          ).length,
        },
      ];
    }),
  );
  const schemaPerClaw = Object.fromEntries(
    claws.map((claw) => {
      const matching = claw.cases.filter(
        (result) => result.family === "schema",
      );
      const families = [
        ...new Set(
          matching.map((result) => result.oracle.keyword).filter(Boolean),
        ),
      ].sort();
      return [
        claw.id,
        {
          applicable: matching.length,
          killed: matching.filter((result) => result.outcome === "killed")
            .length,
          families,
          uncoveredFamilies: families.filter((keyword) =>
            matching.some(
              (result) =>
                result.oracle.keyword === keyword &&
                result.outcome !== "killed",
            ),
          ),
        },
      ];
    }),
  );
  const requiredSafetyIds = new Set(
    safetyRegistry.recipes.map((recipe) => recipe.id),
  );
  const safetyCompleteness = claws.map((claw) => {
    const actual = new Set(
      claw.cases
        .filter((result) => requiredSafetyIds.has(result.recipeId))
        .map((result) => result.recipeId),
    );
    return {
      clawId: claw.id,
      missingRecipeIds: [...requiredSafetyIds].filter((id) => !actual.has(id)),
    };
  });
  const blocking =
    counts["control-failed"] > 0 ||
    counts.survived > 0 ||
    counts["invalid-recipe"] > 0 ||
    counts["oracle-error"] > 0 ||
    safety.some((result) => result.outcome !== "killed") ||
    (qualifying &&
      (counts["unsupported-oracle"] > 0 ||
        safetyCompleteness.some((item) => item.missingRecipeIds.length > 0)));
  return {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    scope: qualifying
      ? profile === "schema-portfolio"
        ? "schema-portfolio"
        : "three-claw-vertical"
      : "diagnostic-selection",
    clawCount: claws.length,
    caseCount: results.length,
    counts,
    safety: {
      caseCount: safety.length,
      independentCount: safety.filter(
        (result) => result.oracle.independence === "independent",
      ).length,
      derivedCount: safety.filter(
        (result) => result.oracle.independence === "derived-from-detector",
      ).length,
      blockingCount: safety.filter((result) => result.outcome !== "killed")
        .length,
      completeness: safetyCompleteness,
    },
    schema: {
      clawCount: new Set(schemaCases.map((result) => result.clawId)).size,
      caseCount: schemaCases.length,
      killedCount: schemaCases.filter((result) => result.outcome === "killed")
        .length,
      survivedCount: schemaCases.filter(
        (result) => result.outcome === "survived",
      ).length,
      keywordFamilies: schemaKeywordFamilies,
      keywordCounts: schemaKeywordCounts,
      perClaw: schemaPerClaw,
    },
    inventoryGaps: (profile === "schema-portfolio"
      ? inventory.summary.schemaFixtureGapIds
      : inventory.summary.fixtureGapIds
    ).map((id) => ({
      clawId: id,
      outcome: "unsupported-oracle",
      oracle:
        profile === "schema-portfolio" ? "schema-fixture-pair" : "fixture",
    })),
    status: blocking ? "failed" : qualifying ? "passed" : "diagnostic",
  };
}

function renderReport(manifest, coverage) {
  const ids = manifest.claws.map((item) => item.id).join(", ");
  return `# Mock+ deterministic evidence

> MOCK EVIDENCE ONLY. This report contains no model or provider observation and
> does not affect Catalog Quality or Runtime Evidence Quality.

- Evidence class: \`${MOCK_PLUS_EVIDENCE_CLASS}\`
- Mode: \`${MOCK_PLUS_MODE}\`
- Scope: ${coverage.scope}
- Claws: ${ids}
- Cases: ${coverage.caseCount}
- Controls passed/failed: ${coverage.counts["control-passed"]}/${coverage.counts["control-failed"]}
- Mutants killed/survived: ${coverage.counts.killed}/${coverage.counts.survived}
- Safety independent/derived/blocking: ${coverage.safety.independentCount}/${coverage.safety.derivedCount}/${coverage.safety.blockingCount}
- Schema Claws/cases/killed/survived: ${coverage.schema.clawCount}/${coverage.schema.caseCount}/${coverage.schema.killedCount}/${coverage.schema.survivedCount}
- Schema keyword families: ${coverage.schema.keywordFamilies.join(", ")}
- Portfolio fixture oracle gaps: ${coverage.inventoryGaps.length}
- Status: **${coverage.status}**
`;
}

function containedBy(parent, candidate, { allowEqual = true } = {}) {
  const child = relative(parent, candidate);
  return (
    (allowEqual || child !== "") &&
    child !== ".." &&
    !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(child)
  );
}

async function nearestExistingRealPath(path) {
  let candidate = path;
  for (;;) {
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = dirname(candidate);
    if (parent === candidate)
      throw new Error(`No existing ancestor for ${path}.`);
    candidate = parent;
  }
}

async function prepareNamespaceRoot(targetRoot, namespaceRoot) {
  const allowedRoot = resolve(targetRoot, ".tmp", "mock-plus");
  const targetReal = await realpath(targetRoot);
  const allowedAncestorReal = await nearestExistingRealPath(allowedRoot);
  if (!containedBy(targetReal, allowedAncestorReal)) {
    throw new Error("Mock+ temporary root resolves outside the repository.");
  }
  await mkdir(allowedRoot, { recursive: true });
  const allowedReal = await realpath(allowedRoot);
  if (!containedBy(targetReal, allowedReal)) {
    throw new Error("Mock+ temporary root resolves outside the repository.");
  }
  const expectedAllowed = join(".tmp", "mock-plus");
  if (relative(targetReal, allowedReal) !== expectedAllowed) {
    throw new Error("Mock+ temporary root must not be redirected.");
  }
  const namespaceAncestorReal = await nearestExistingRealPath(namespaceRoot);
  if (!containedBy(allowedReal, namespaceAncestorReal)) {
    throw new Error("Mock+ namespace resolves outside its temporary root.");
  }
  await mkdir(namespaceRoot, { recursive: true });
  const namespaceReal = await realpath(namespaceRoot);
  if (relative(allowedReal, namespaceReal) !== basename(namespaceRoot)) {
    throw new Error("Mock+ namespace must not be redirected.");
  }
  return namespaceReal;
}

async function verifyImmutableDirectory(outputRoot, records, namespaceReal) {
  const outputReal = await realpath(outputRoot);
  if (!containedBy(namespaceReal, outputReal, { allowEqual: false })) {
    throw new Error("Mock+ output resolves outside its namespace.");
  }
  const expectedNames = new Set(records.map(([name]) => name));
  const actualNames = await readdir(outputRoot);
  if (
    actualNames.length !== expectedNames.size ||
    actualNames.some((name) => !expectedNames.has(name))
  ) {
    throw new Error("Mock+ immutable evidence directory has unexpected files.");
  }
  for (const [name, content] of records) {
    const path = join(outputRoot, name);
    const stats = await lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Mock+ refuses a non-regular evidence destination.");
    }
    if ((await readFile(path, "utf8")) !== content) {
      throw new Error("Mock+ refuses to overwrite different evidence.");
    }
  }
}

async function persistImmutableDirectory(
  outputRoot,
  records,
  namespaceRoot,
  targetRoot,
) {
  const namespaceReal = await prepareNamespaceRoot(targetRoot, namespaceRoot);
  try {
    await lstat(outputRoot);
    await verifyImmutableDirectory(outputRoot, records, namespaceReal);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const parent = dirname(outputRoot);
  const parentAncestorReal = await nearestExistingRealPath(parent);
  if (!containedBy(namespaceReal, parentAncestorReal)) {
    throw new Error("Mock+ output parent resolves outside its namespace.");
  }
  await mkdir(parent, { recursive: true });
  const parentReal = await realpath(parent);
  if (!containedBy(namespaceReal, parentReal)) {
    throw new Error("Mock+ output parent resolves outside its namespace.");
  }

  const stagingRoot = await mkdtemp(join(namespaceRoot, ".staging-"));
  let promoted = false;
  try {
    for (const [name, content] of records) {
      const stagingReal = await realpath(stagingRoot);
      if (!containedBy(namespaceReal, stagingReal, { allowEqual: false })) {
        throw new Error("Mock+ staging directory changed containment.");
      }
      await writeFile(join(stagingRoot, name), content, { flag: "wx" });
    }
    const stagingReal = await realpath(stagingRoot);
    if (!containedBy(namespaceReal, stagingReal, { allowEqual: false })) {
      throw new Error("Mock+ staging directory changed containment.");
    }
    try {
      await rename(stagingRoot, outputRoot);
      promoted = true;
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code)) throw error;
      await verifyImmutableDirectory(outputRoot, records, namespaceReal);
    }
    await verifyImmutableDirectory(outputRoot, records, namespaceReal);
  } finally {
    if (!promoted) {
      await rm(stagingRoot, { recursive: true, force: true });
    }
  }
}

async function writeRunFiles(outputRoot, documents, targetRoot, namespaceRoot) {
  const records = [
    ["manifest.json", documents.manifest],
    ["results.json", documents.results],
    ["coverage.json", documents.coverage],
    ["inventory.json", documents.inventory],
  ].map(([name, value]) => [name, `${canonicalJson(value)}\n`]);
  const report = renderReport(documents.manifest, documents.coverage);
  records.push(["report.md", report]);
  const provenanceText = `${canonicalJson(documents.provenance)}\n`;
  const outputBytes =
    records.reduce(
      (total, [, content]) => total + Buffer.byteLength(content),
      0,
    ) + Buffer.byteLength(provenanceText);
  if (outputBytes > MAX_OUTPUT_BYTES) {
    throw new Error("Mock+ run output exceeds 25 MiB.");
  }
  if (
    records.some(([, content]) => content.includes(SAFE_CANARY)) ||
    provenanceText.includes(SAFE_CANARY)
  ) {
    throw new Error("Mock+ persisted output contains the synthetic canary.");
  }
  await persistImmutableDirectory(
    outputRoot,
    records,
    namespaceRoot,
    targetRoot,
  );

  const provenanceNamespace = join(
    targetRoot,
    ".tmp",
    "mock-plus",
    "provenance",
  );
  const provenanceRoot = join(
    provenanceNamespace,
    documents.provenance.canonicalDigest.slice(7),
    mockPlusDigest(provenanceText).slice(7),
  );
  await persistImmutableDirectory(
    provenanceRoot,
    [["provenance.json", provenanceText]],
    provenanceNamespace,
    targetRoot,
  );
  return {
    outputBytes,
    provenanceRoot,
  };
}

export async function runMockPlus({
  onlyIds = null,
  caseId = null,
  profile = "vertical",
  targetRoot = root,
  writeOutput = true,
} = {}) {
  if (!["vertical", "schema-portfolio"].includes(profile)) {
    throw new Error(`Unknown Mock+ profile: ${profile}.`);
  }
  const started = performance.now();
  const context = await loadMockPlusContext({ targetRoot });
  const entryById = new Map(
    context.catalog.entries.map((entry) => [entry.id, entry]),
  );
  const inventoryById = new Map(
    context.inventory.entries.map((entry) => [entry.id, entry]),
  );
  const contractById = new Map(
    context.regressionRegistry.cases.map((item) => [item.id, item]),
  );
  const requestedIds =
    onlyIds ??
    (profile === "schema-portfolio"
      ? context.catalog.entries.map((entry) => entry.id)
      : [...MOCK_PLUS_VERTICAL_IDS]);
  const unknown = requestedIds.filter((id) => !entryById.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown Mock+ Claw ids: ${unknown.join(", ")}.`);
  }
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error("Mock+ Claw selections must not contain duplicates.");
  }
  const outsideVertical = requestedIds.filter(
    (id) => !MOCK_PLUS_VERTICAL_IDS.includes(id),
  );
  if (profile === "vertical" && outsideVertical.length > 0) {
    throw new Error(
      `Mock+ V1 execution is limited to the reviewed vertical slice: ${outsideVertical.join(", ")}.`,
    );
  }
  const coversVertical =
    requestedIds.length === MOCK_PLUS_VERTICAL_IDS.length &&
    MOCK_PLUS_VERTICAL_IDS.every((id) => requestedIds.includes(id));
  const portfolioIds = context.catalog.entries.map((entry) => entry.id);
  const coversPortfolio =
    requestedIds.length === portfolioIds.length &&
    portfolioIds.every((id) => requestedIds.includes(id));
  const selectedIds =
    profile === "schema-portfolio" && coversPortfolio
      ? portfolioIds
      : coversVertical
        ? [...MOCK_PLUS_VERTICAL_IDS]
        : requestedIds;
  const [harnessDigest, semanticDigest] = await Promise.all([
    combinedFileDigest(HARNESS_PATHS, targetRoot),
    fileDigest(join(targetRoot, "scripts", "artifact-semantics.mjs")),
  ]);
  const claws = [];
  for (const id of selectedIds) {
    claws.push(
      await runClaw({
        entry: entryById.get(id),
        contract: contractById.get(id),
        inventoryEntry: inventoryById.get(id),
        profile,
        safetyRegistry: context.safetyRegistry,
        targetRoot,
        harnessDigest,
        semanticDigest,
      }),
    );
  }
  if (caseId) {
    for (const claw of claws) {
      claw.cases = claw.cases.filter((result) => result.recipeId === caseId);
    }
    if (claws.every((claw) => claw.cases.length === 0)) {
      throw new Error(
        `Mock+ recipe ${caseId} did not apply to the selected Claws.`,
      );
    }
  }
  assertCaseUniqueness(claws);
  const qualifying =
    caseId === null &&
    (profile === "schema-portfolio" ? coversPortfolio : coversVertical);
  const coverage = coverageFor(
    claws,
    context.inventory,
    context.safetyRegistry,
    { qualifying, profile },
  );
  const manifestBody = {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    scope: coverage.scope,
    profile,
    seed: DEFAULT_SEED,
    limits: {
      concurrency: 1,
      maxCaseMs: MAX_CASE_MS,
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    },
    harnessDigest,
    safetyRecipeDigest: mockPlusDigest(context.safetyRegistry),
    claws: claws.map(({ id, identities, cases }) => ({
      id,
      identities,
      recipeIds: cases.map((result) => result.recipeId),
    })),
  };
  const manifest = {
    ...manifestBody,
    manifestDigest: mockPlusDigest(manifestBody),
  };
  const results = {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    manifestDigest: manifest.manifestDigest,
    claws,
  };
  const canonicalDigest = mockPlusDigest({
    manifest,
    results,
    coverage,
    inventory: context.inventory,
  });
  const provenance = {
    schemaVersion: MOCK_PLUS_SCHEMA_VERSION,
    evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
    mode: MOCK_PLUS_MODE,
    canonicalDigest,
    commit: process.env.GITHUB_SHA ?? null,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  };
  const documents = {
    manifest,
    results,
    coverage,
    inventory: context.inventory,
    provenance,
  };
  const namespaceRoot = join(
    targetRoot,
    ".tmp",
    "mock-plus",
    qualifying
      ? profile === "schema-portfolio"
        ? "schema-portfolio"
        : "vertical"
      : "diagnostic",
  );
  const resolvedOutputRoot = qualifying
    ? join(namespaceRoot, canonicalDigest.slice(7))
    : join(
        namespaceRoot,
        selectedIds.join("+"),
        caseId ?? "all-cases",
        canonicalDigest.slice(7),
      );
  const persisted = writeOutput
    ? await writeRunFiles(
        resolvedOutputRoot,
        documents,
        targetRoot,
        namespaceRoot,
      )
    : { outputBytes: 0, provenanceRoot: null };
  const elapsedMs = performance.now() - started;
  return {
    ...documents,
    canonicalDigest,
    outputRoot: resolvedOutputRoot,
    provenanceRoot: persisted.provenanceRoot,
    outputBytes: persisted.outputBytes,
    elapsedMs,
  };
}

export async function assertMockPlusOutputRemoved(path) {
  try {
    await access(path);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Mock+ temporary path still exists: ${path}.`);
}
