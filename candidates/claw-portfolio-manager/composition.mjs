import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import {
  open,
  readFile,
  readdir,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  init as initModuleLexer,
  parse as parseModuleImports,
} from "es-module-lexer";

import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";
import { buildCatalogQualityScorecard } from "../../scripts/catalog-quality-score.mjs";
import { readCatalog, root } from "../../scripts/catalog-source.mjs";
import {
  contributionSimilarityReport,
  validateContributionProposal,
} from "../../scripts/contribution-lib.mjs";
import { readExperienceCases } from "../../scripts/experience-cases.mjs";
import { loadMockPlusContext } from "../../scripts/mock-plus-lib.mjs";
import {
  readRegressionCases,
  runRepositoryRegressionCases,
} from "../../scripts/regression-cases.mjs";
import { repositoryComplianceProgramFindings } from "../../scripts/repository-compliance-program-manager.mjs";
import { repositoryOperationsFindings } from "../../scripts/repository-operations-manager.mjs";
import {
  buildScenarios,
  preflightBudgets,
  readRuntimeProfile,
} from "../../scripts/runtime-evidence-lib.mjs";
import {
  JSON_LIMITS,
  canonicalJson,
  normalizeJsonValue,
  sha256Digest,
} from "./candidate-utils.mjs";

await initModuleLexer();

export const COMPOSITION_INPUT_VERSION =
  "awesomeClaws.clawPortfolioCompositionInput.v1";
export const COMPOSITION_RESULT_VERSION =
  "awesomeClaws.clawPortfolioCompositionResult.v1";
export const PINNED_CATALOG_REVISION =
  "0c1bfb3c973a9940f301a5001e77435789993555";
export const ADMISSION_CLASSIFICATIONS = Object.freeze([
  "NEW",
  "IMPROVE",
  "COMPOSE",
  "VARIANT",
  "PRODUCT_DECISION",
  "RETIRE",
  "DUPLICATE",
  "UNSUPPORTED",
]);

const REQUIRED_OWNER_IDS = Object.freeze([
  "repository-operations-manager",
  "repository-compliance-program-manager",
  "work-chief-of-staff",
]);

const SOURCE_BINDINGS = Object.freeze([
  ["catalog-quality", "registry", "catalog.json"],
  ["catalog-quality", "registry", "experience-cases.json"],
  ["catalog-quality", "registry", "regression-cases.json"],
  ["runtime-evidence", "registry", "runtime-evidence-profile.json"],
  ["runtime-evidence", "registry", "required-safety-recipes.json"],
  ["runtime-evidence", "registry", "required-semantic-recipes.json"],
  ["runtime-evidence", "registry", "required-lifecycle-recipes.json"],
  ["repository-operations-manager", "validator", "scripts/repository-operations-manager.mjs"],
  ["repository-operations-manager", "schema", "sources/repository-operations-manager/schemas/repository-operations.schema.json"],
  ["repository-operations-manager", "artifact", "sources/repository-operations-manager/fixtures/repository-operations.example.json"],
  ["repository-operations-manager", "artifact", "contributions/repository-operations-manager.json"],
  ["repository-compliance-program-manager", "validator", "scripts/repository-compliance-program-manager.mjs"],
  ["repository-compliance-program-manager", "schema", "sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json"],
  ["repository-compliance-program-manager", "artifact", "sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json"],
  ["repository-compliance-program-manager", "artifact", "contributions/repository-compliance-program-manager.json"],
  ["work-chief-of-staff", "validator", "scripts/artifact-semantics.mjs"],
  ["work-chief-of-staff", "schema", "sources/work-chief-of-staff/schemas/operating-portfolio.schema.json"],
  ["work-chief-of-staff", "artifact", "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json"],
  ["work-chief-of-staff", "artifact", "contributions/work-chief-of-staff.json"],
  ["contribution-admission", "validator", "scripts/contribution-lib.mjs"],
  ["contribution-admission", "validator", "scripts/catalog-health.mjs"],
  ["catalog-quality", "validator", "scripts/catalog-quality-score.mjs"],
  ["catalog-quality", "validator", "scripts/catalog-source.mjs"],
  ["runtime-evidence", "validator", "scripts/runtime-evidence-lib.mjs"],
  ["runtime-evidence", "validator", "scripts/experience-cases.mjs"],
  ["runtime-evidence", "validator", "scripts/regression-cases.mjs"],
  ["runtime-evidence", "validator", "scripts/mock-plus-lib.mjs"],
  ["runtime-evidence", "validator", "scripts/artifact-validator-registry.mjs"],
  ["runtime-evidence", "validator", "scripts/capability-classes.mjs"],
  ["runtime-evidence", "validator", "scripts/portable-paths.mjs"],
  ["composition-adapter", "validator", "candidates/claw-portfolio-manager/composition.mjs"],
  ["composition-adapter", "validator", "candidates/claw-portfolio-manager/candidate-utils.mjs"],
  ["composition-adapter", "schema", "candidates/claw-portfolio-manager/schemas/composition-input.schema.json"],
  ["composition-adapter", "schema", "candidates/claw-portfolio-manager/schemas/composition-output.schema.json"],
  ["composition-adapter", "schema", "candidates/claw-portfolio-manager/schemas/provider-issue-body.schema.json"],
  ["composition-adapter", "schema", "candidates/claw-portfolio-manager/schemas/composition-trust.schema.json"],
  ["composition-adapter", "schema", "candidates/claw-portfolio-manager/schemas/composition-trust-pin.schema.json"],
  ["composition-adapter", "dependency-manifest", "package.json"],
  ["composition-adapter", "dependency-lock", "package-lock.json"],
]);

const AUTHORITY = Object.freeze({
  merge: false,
  publish: false,
  externalMutation: false,
  atomicMutation: false,
  budgetIncrease: false,
  riskAcceptance: false,
  hrInference: false,
  sensitivePersonalInference: false,
});

export const COMPOSITION_MAPPINGS = Object.freeze([
  {
    owner: "repository-operations-manager",
    outputPort: "portfolio-run-lineage",
    extensionRef: "continuation-portfolio-composition",
    authority: [],
    sourcePaths: [
      "scripts/repository-operations-manager.mjs",
      "sources/repository-operations-manager/schemas/repository-operations.schema.json",
    ],
  },
  {
    owner: "repository-compliance-program-manager",
    outputPort: "provider-issue-snapshot",
    extensionRef: "provider-snapshot-issue-api",
    authority: [],
    sourcePaths: [
      "scripts/repository-compliance-program-manager.mjs",
      "sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json",
    ],
  },
  {
    owner: "contribution-admission",
    outputPort: "typed-admission-decision",
    extensionRef: "admission-issue-api",
    authority: [],
    sourcePaths: ["scripts/contribution-lib.mjs", "catalog.json"],
  },
  {
    owner: "catalog-quality",
    outputPort: "signed-package-tree",
    extensionRef: "composition-package-manifest",
    authority: [],
    sourcePaths: ["scripts/catalog-quality-score.mjs", "catalog.json"],
  },
  {
    owner: "work-chief-of-staff",
    outputPort: "stateless-budget-plan",
    extensionRef: "capacity-engineering",
    authority: [],
    sourcePaths: [
      "sources/work-chief-of-staff/schemas/operating-portfolio.schema.json",
      "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json",
    ],
  },
  {
    owner: "composition-adapter",
    outputPort: "externally-pinned-trust",
    extensionRef: "composition-trust",
    authority: [],
    sourcePaths: [
      "candidates/claw-portfolio-manager/schemas/composition-trust.schema.json",
      "candidates/claw-portfolio-manager/schemas/composition-trust-pin.schema.json",
    ],
  },
  {
    owner: "runtime-evidence",
    outputPort: "minimized-usage-evidence",
    extensionRef: "runtime-evidence-optional",
    authority: [],
    sourcePaths: [
      "scripts/runtime-evidence-lib.mjs",
      "runtime-evidence-profile.json",
    ],
  },
  {
    owner: "work-chief-of-staff",
    outputPort: "proposal-owner-handoff",
    extensionRef: "work-chief-handoff",
    authority: [],
    sourcePaths: [
      "sources/work-chief-of-staff/schemas/operating-portfolio.schema.json",
      "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json",
    ],
  },
]);

const inputSchema = JSON.parse(
  await readFile(new URL("./schemas/composition-input.schema.json", import.meta.url)),
);
const outputSchema = JSON.parse(
  await readFile(new URL("./schemas/composition-output.schema.json", import.meta.url)),
);
const providerIssueBodySchema = JSON.parse(
  await readFile(
    new URL("./schemas/provider-issue-body.schema.json", import.meta.url),
  ),
);
const trustSchema = JSON.parse(
  await readFile(new URL("./schemas/composition-trust.schema.json", import.meta.url)),
);
const trustPinSchema = JSON.parse(
  await readFile(
    new URL("./schemas/composition-trust-pin.schema.json", import.meta.url),
  ),
);
const repoOpsSchema = JSON.parse(
  await readFile(
    new URL(
      "../../sources/repository-operations-manager/schemas/repository-operations.schema.json",
      import.meta.url,
    ),
  ),
);
const complianceSchema = JSON.parse(
  await readFile(
    new URL(
      "../../sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json",
      import.meta.url,
    ),
  ),
);
const workChiefSchema = JSON.parse(
  await readFile(
    new URL(
      "../../sources/work-chief-of-staff/schemas/operating-portfolio.schema.json",
      import.meta.url,
    ),
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);
const validateProviderIssueBody = ajv.compile(providerIssueBodySchema);
const validateTrust = ajv.compile(trustSchema);
const validateTrustPin = ajv.compile(trustPinSchema);
const validateRepoOps = ajv.compile(repoOpsSchema);
const validateCompliance = ajv.compile(complianceSchema);
const validateWorkChief = ajv.compile(workChiefSchema);

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function unsigned(value) {
  const { signature: _signature, ...content } = value;
  return content;
}

function signaturePayload(value) {
  return Buffer.from(canonicalJson(unsigned(value)), "utf8");
}

function contentRevision(value) {
  const {
    revision: _revision,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function providerRevision(value) {
  const {
    revision: _revision,
    completenessRoot: _completenessRoot,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function strictBase64(value) {
  if (typeof value !== "string") return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function timestamp(value) {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maximumDay =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year === 0 ? 400 : year, month, 0)).getUTCDate()
      : 0;
  if (
    day < 1 ||
    day > maximumDay ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function schemaErrors(validate, value, prefix) {
  if (validate(value)) return [];
  return (validate.errors ?? []).map(
    (item) => `${prefix}${item.instancePath || "/"}#${item.keyword}`,
  );
}

function invalid(findings) {
  return {
    schemaVersion: COMPOSITION_RESULT_VERSION,
    verdict: "INVALID",
    standaloneCandidateAccepted: false,
    findings: [...new Set(findings)].sort(),
    authority: { ...AUTHORITY },
  };
}

function publicKey(pem) {
  try {
    const key = createPublicKey({ key: pem, format: "pem" });
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") return null;
    const der = key.export({ type: "spki", format: "der" });
    return der.length === 44 ? key : null;
  } catch {
    return null;
  }
}

export function trustRevision(trust) {
  return sha256Digest({
    schemaVersion: trust.schemaVersion,
    keys: trust.keys,
  });
}

function verifyTrustDocument(trust, trustPin, asOf, findings) {
  findings.push(...schemaErrors(validateTrust, trust, "$.trust"));
  findings.push(...schemaErrors(validateTrustPin, trustPin, "$.trustPin"));
  if (!validateTrust(trust) || !validateTrustPin(trustPin)) return new Map();
  const evaluatedAt = timestamp(asOf);
  const pinNotBefore = timestamp(trustPin.notBefore);
  const pinExpiresAt = timestamp(trustPin.expiresAt);
  const revision = trustRevision(trust);
  if (
    revision !== trust.revision ||
    revision !== trustPin.trustRevision ||
    trust.schemaVersion !== trustPin.trustSchemaVersion ||
    evaluatedAt === null ||
    pinNotBefore === null ||
    pinExpiresAt === null ||
    pinNotBefore > evaluatedAt ||
    pinExpiresAt < evaluatedAt ||
    pinNotBefore > pinExpiresAt
  ) {
    findings.push("trust-revision-mismatch");
  }
  const keys = new Map();
  const fingerprints = new Set();
  const domains = new Set();
  for (const keyRecord of trust.keys) {
    const key = publicKey(keyRecord.publicKeyPem);
    const notBefore = timestamp(keyRecord.notBefore);
    const expiresAt = timestamp(keyRecord.expiresAt);
    const fingerprint = key
      ? digestBytes(key.export({ type: "spki", format: "der" }))
      : null;
    if (
      !key ||
      notBefore === null ||
      expiresAt === null ||
      evaluatedAt === null ||
      notBefore > evaluatedAt ||
      expiresAt < evaluatedAt ||
      fingerprints.has(fingerprint) ||
      keys.has(keyRecord.keyId) ||
      domains.has(keyRecord.domain)
    ) {
      findings.push(`invalid-trust-key:${keyRecord.keyId}`);
      continue;
    }
    fingerprints.add(fingerprint);
    domains.add(keyRecord.domain);
    keys.set(keyRecord.keyId, { ...keyRecord, key });
  }
  if (
    canonicalJson([...domains].sort()) !==
    canonicalJson(
      [
        "admission",
        "catalog",
        "continuation",
        "provider",
        "receipt",
        "runtime-budget",
        "usage",
      ].sort(),
    )
  ) {
    findings.push("invalid-trust-domain-coverage");
  }
  return keys;
}

function verifySigned(value, domain, asOf, keys, findings) {
  const record = keys.get(value?.signature?.keyId);
  const signature = strictBase64(value?.signature?.value);
  const signedAt = timestamp(
    value?.signedAt ??
      value?.issuedAt ??
      value?.decidedAt ??
      value?.capturedAt,
  );
  if (
    !record ||
    record.domain !== domain ||
    record.signerRef !== value.signerRef ||
    !signature ||
    signedAt === null ||
    signedAt > timestamp(asOf) ||
    timestamp(record.notBefore) > signedAt ||
    timestamp(record.expiresAt) < signedAt ||
    !verifySignature(null, signaturePayload(value), record.key, signature)
  ) {
    findings.push(`invalid-${domain}-signature`);
  }
}

async function fileBinding(ownerId, role, path) {
  const bytes = await readFile(join(root, ...path.split("/")));
  return {
    ownerId,
    role,
    path,
    digest: digestBytes(bytes),
  };
}

export function localModuleSpecifiers(source) {
  const specifiers = [];
  const [imports] = parseModuleImports(source);
  for (const importRecord of imports) {
    if (importRecord.type === "import-meta") continue;
    if (
      typeof importRecord.specifier !== "string" ||
      importRecord.specifier.includes("*")
    ) {
      throw new Error("Dynamic import specifier is not statically bindable.");
    }
    if (
      importRecord.specifier.startsWith("./") ||
      importRecord.specifier.startsWith("../")
    ) {
      specifiers.push(importRecord.specifier);
    }
  }
  return [...new Set(specifiers)].sort();
}

export async function localModuleClosure(
  entryPaths = ["candidates/claw-portfolio-manager/composition.mjs"],
) {
  const pending = [...new Set(entryPaths)].sort();
  const visited = new Set();
  while (pending.length > 0) {
    const batch = pending.splice(0).filter((path) => !visited.has(path));
    const modules = await Promise.all(
      batch.map(async (path) => {
        const absolutePath = resolve(root, ...path.split("/"));
        const relativePath = relative(root, absolutePath);
        if (
          isAbsolute(relativePath) ||
          relativePath === ".." ||
          relativePath.startsWith(`..\\`) ||
          relativePath.startsWith("../")
        ) {
          throw new Error("Local module import escaped the repository root.");
        }
        return {
          absolutePath,
          path,
          source: await readFile(absolutePath, "utf8"),
        };
      }),
    );
    for (const { absolutePath, path, source } of modules) {
      visited.add(path);
      for (const specifier of localModuleSpecifiers(source)) {
        const importedPath = relative(
          root,
          resolve(dirname(absolutePath), specifier),
        ).replaceAll("\\", "/");
        if (!visited.has(importedPath) && !pending.includes(importedPath)) {
          pending.push(importedPath);
        }
      }
    }
    pending.sort();
  }
  return [...visited].sort();
}

async function buildExpectedSourceBindings() {
  const bindingSpecs = new Map(
    SOURCE_BINDINGS.map(([ownerId, role, path]) => [
      path,
      { ownerId, role, path },
    ]),
  );
  for (const path of await localModuleClosure()) {
    if (!bindingSpecs.has(path)) {
      bindingSpecs.set(path, {
        ownerId: "composition-import-closure",
        role: "validator",
        path,
      });
    }
  }
  const ownerTrees = await Promise.all(
    REQUIRED_OWNER_IDS.flatMap((ownerId) =>
      [`sources/${ownerId}`, `claws/${ownerId}`].map(async (prefix) => ({
        ownerId,
        entries: await readdir(join(root, ...prefix.split("/")), {
          recursive: true,
          withFileTypes: true,
        }),
      })),
    ),
  );
  for (const { ownerId, entries } of ownerTrees) {
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      if (!entry.isFile()) {
        throw new Error(`Unsupported owner package entry: ${entry.name}`);
      }
      const path = join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .replaceAll("\\", "/");
      if (!bindingSpecs.has(path)) {
        bindingSpecs.set(path, { ownerId, role: "artifact", path });
      }
    }
  }
  return Promise.all(
    [...bindingSpecs.values()]
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      )
      .map(({ ownerId, role, path }) => fileBinding(ownerId, role, path)),
  );
}

export async function expectedSourceBindings() {
  return buildExpectedSourceBindings();
}

function mediaType(path) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "application/yaml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/javascript";
}

async function expectedPackageFiles(bindings) {
  return Promise.all(
    bindings.map(async (binding) => {
      const bytes = await readFile(join(root, ...binding.path.split("/")));
      return {
        path: binding.path,
        mediaType: mediaType(binding.path),
        byteLength: bytes.length,
        digest: binding.digest,
      };
    }),
  );
}

function exactBytes(value) {
  const bytes = strictBase64(value.contentBase64);
  return (
    bytes &&
    bytes.length === value.byteLength &&
    digestBytes(bytes) === value.digest
  );
}

function operatingContractDigest(entry) {
  return sha256Digest({
    audience: entry.audience,
    principles: entry.principles,
    boundaries: entry.boundaries,
    intake: entry.intake,
    workflow: entry.workflow,
    deliverables: entry.deliverables,
    doneWhen: entry.doneWhen,
    capabilityGuidance: entry.capabilityGuidance,
  });
}

function deriveAdmissionScorecard(
  comparison,
  evidence,
  { compositionFeasible, boundOwnerIds, proposalOperatingContractDigest },
) {
  const materialDifference = [
    comparison?.workflow,
    comparison?.outputs,
    comparison?.evidence,
    comparison?.authority,
  ].includes("different");
  const requiredOwnerSetComplete =
    canonicalJson([...evidence.requiredOwnerIds].sort()) ===
    canonicalJson([...REQUIRED_OWNER_IDS].sort());
  const supported =
    requiredOwnerSetComplete &&
    evidence.requiredOwnerIds.every((id) =>
      evidence.availableOwnerIds.includes(id),
    ) &&
    evidence.availableOwnerIds.every((id) => boundOwnerIds.has(id));
  const exactDuplicate =
    evidence.existingMatch !== null &&
    evidence.existingMatch.operatingContractDigest ===
      proposalOperatingContractDigest &&
    Object.values(comparison).every((value) => value === "same");
  const retirementRequested =
    evidence.lifecycle.action === "retire" &&
    evidence.lifecycle.evidenceRefs.length > 0;
  const variantRequired = evidence.variantBasis !== "none";
  const productDecisionRequired = evidence.productDecisionRefs.length > 0;
  const canImprove =
    comparison?.job === "same" && materialDifference && !variantRequired;
  const evaluations = [
    {
      classification: "UNSUPPORTED",
      eligible: !productDecisionRequired && supported === false,
      priority: 1,
      reason: "required-owner-contract-or-support-is-unavailable",
    },
    {
      classification: "DUPLICATE",
      eligible: !productDecisionRequired && exactDuplicate,
      priority: 2,
      reason: "same-job-and-operating-contract-already-exists",
    },
    {
      classification: "RETIRE",
      eligible: !productDecisionRequired && retirementRequested,
      priority: 3,
      reason: "validated-lifecycle-evidence-requires-retirement",
    },
    {
      classification: "COMPOSE",
      eligible: !productDecisionRequired && supported && compositionFeasible,
      priority: 4,
      reason: "validated-owner-composition-preserves-the-requested-contract",
    },
    {
      classification: "IMPROVE",
      eligible:
        supported &&
        !productDecisionRequired &&
        canImprove &&
        comparison?.job === "same" &&
        materialDifference,
      priority: 5,
      reason: "same-job-needs-a-material-owner-contract-improvement",
    },
    {
      classification: "VARIANT",
      eligible:
        supported &&
        !productDecisionRequired &&
        variantRequired &&
        !canImprove &&
        comparison?.job === "same" &&
        !materialDifference,
      priority: 6,
      reason: "same-job-differs-only-by-audience-or-presentation",
    },
    {
      classification: "NEW",
      eligible:
        supported &&
        !productDecisionRequired &&
        comparison?.job === "different" &&
        materialDifference &&
        !compositionFeasible &&
        !canImprove,
      priority: 7,
      reason: "distinct-job-and-material-operating-contract-difference",
    },
  ];
  const selected =
    evaluations.find((item) => item.eligible)?.classification ??
    "PRODUCT_DECISION";
  return {
    selected,
    materialDifference,
    candidates: [
      ...evaluations,
      {
        classification: "PRODUCT_DECISION",
        eligible: selected === "PRODUCT_DECISION",
        priority: 8,
        reason:
          productDecisionRequired
            ? "authenticated-product-decision-is-required"
            : "evidence-does-not-authorize-an-executable-disposition",
        },
    ],
    evidence: {
      supported,
      requiredOwnerIds: evidence.requiredOwnerIds,
      availableOwnerIds: evidence.availableOwnerIds,
      exactDuplicate,
      existingMatchId: evidence.existingMatch?.id ?? null,
      retirementRequested,
      retirementEvidenceRefs: evidence.lifecycle.evidenceRefs,
      variantRequired,
      variantBasis: evidence.variantBasis,
      productDecisionRequired,
      productDecisionRefs: evidence.productDecisionRefs,
      proposalOperatingContractDigest,
    },
  };
}

export function continuationModeFindings(
  continuation,
  ownerCheckpointRef,
) {
  if (continuation.mode === "bootstrap") {
    return [
      ...(continuation.predecessorCheckpointRef === null
        ? []
        : ["bootstrap-predecessor-must-be-null"]),
      ...(continuation.priorReceiptIds.length === 0
        ? []
        : ["bootstrap-prior-receipts-must-be-empty"]),
    ];
  }
  if (
    ["adopt", "manage"].includes(continuation.mode) &&
    continuation.predecessorCheckpointRef !== ownerCheckpointRef
  ) {
    return [`${continuation.mode}-predecessor-mismatch`];
  }
  return [];
}

function sourceRoot(bindings) {
  return sha256Digest(
    [...bindings].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  );
}

function packageRoot(files) {
  return sha256Digest(
    [...files].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  );
}

export async function composePortfolioPlan(
  inputValue,
  trustValue,
  trustPinValue,
  optionsValue,
) {
  const normalizedInput = normalizeJsonValue(inputValue, {
    ...JSON_LIMITS,
    maxBytes: 1024 * 1024,
  });
  const normalizedTrust = normalizeJsonValue(trustValue, {
    ...JSON_LIMITS,
    maxBytes: 128 * 1024,
  });
  const normalizedTrustPin = normalizeJsonValue(trustPinValue, {
    ...JSON_LIMITS,
    maxBytes: 4096,
  });
  const normalizedOptions = normalizeJsonValue(
    optionsValue === undefined ? {} : optionsValue,
    {
      maxBytes: 1024,
      maxDepth: 2,
      maxNodes: 4,
      maxArrayLength: 0,
      maxObjectKeys: 1,
      maxStringLength: 64,
    },
  );
  if (
    !normalizedInput.ok ||
    !normalizedTrust.ok ||
    !normalizedTrustPin.ok ||
    !normalizedOptions.ok
  ) {
    return invalid(["unsafe-or-oversized-input"]);
  }
  const input = normalizedInput.value;
  const trust = normalizedTrust.value;
  const trustPin = normalizedTrustPin.value;
  const options = normalizedOptions.value;
  if (
    options === null ||
    Array.isArray(options) ||
    Object.keys(options).length !== 1 ||
    typeof options.asOf !== "string"
  ) {
    return invalid(["invalid-options"]);
  }
  const asOf = options.asOf;
  const findings = schemaErrors(validateInput, input, "$");
  if (!validateInput(input)) return invalid(findings);
  const asOfMs = timestamp(asOf);
  const keys = verifyTrustDocument(trust, trustPin, asOf, findings);
  if (asOfMs === null) {
    findings.push("invalid-as-of");
    return invalid(findings);
  }

  let actual;
  try {
    actual = await Promise.all([
      expectedSourceBindings(),
      readFile(
        join(
          root,
          "sources",
          "repository-operations-manager",
          "fixtures",
          "repository-operations.example.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        join(
          root,
          "sources",
          "repository-compliance-program-manager",
          "fixtures",
          "repository-compliance-program.example.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        join(
          root,
          "sources",
          "work-chief-of-staff",
          "fixtures",
          "operating-portfolio.example.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readCatalog({ loadResources: false }),
    ]);
  } catch {
    return invalid(["owner-artifact-unavailable"]);
  }
  const [
    actualBindings,
    repoOpsArtifact,
    complianceArtifact,
    workChiefArtifact,
    catalog,
  ] = actual;

  if (canonicalJson(input.sourceBindings) !== canonicalJson(actualBindings)) {
    findings.push("source-binding-mismatch");
  }
  const bindingsRoot = sourceRoot(actualBindings);
  if (
    input.portfolio.sourceBindingsRoot !== bindingsRoot ||
    input.continuation.sourceBindingsRoot !== bindingsRoot ||
    input.portfolio.revision !==
      sha256Digest({
        id: input.portfolio.id,
        selectedClawIds: input.portfolio.selectedClawIds,
        sourceBindingsRoot: bindingsRoot,
        capacityEnvelopeRef: input.portfolio.capacityEnvelopeRef,
      }) ||
    canonicalJson(input.portfolio.selectedClawIds) !==
      canonicalJson(REQUIRED_OWNER_IDS)
  ) {
    findings.push("invalid-portfolio-manifest");
  }

  const repoOpsFindings = validateRepoOps(repoOpsArtifact)
    ? repositoryOperationsFindings(repoOpsArtifact, {
        asOf: repoOpsArtifact.run.asOf,
      })
    : ["schema"];
  const complianceFindings = validateCompliance(complianceArtifact)
    ? repositoryComplianceProgramFindings(complianceArtifact, {
        asOf: complianceArtifact.run.asOf,
      })
    : ["schema"];
  const workChiefFindings = validateWorkChief(workChiefArtifact)
    ? validateArtifactSemantics("work-chief-of-staff", workChiefArtifact)
    : ["schema"];
  if (
    repoOpsFindings.length ||
    complianceFindings.length ||
    workChiefFindings.length
  ) {
    findings.push("owner-artifact-validation-failed");
  }

  const baseIssue = complianceArtifact.issues.find(
    (item) => item.id === input.providerIssue.baseIssueRef,
  );
  if (
    !baseIssue ||
    baseIssue.revision !== input.providerIssue.baseIssueRevision ||
    baseIssue.providerIssueId !== input.providerIssue.providerIssueId ||
    baseIssue.url !== input.providerIssue.url ||
    baseIssue.status !== input.providerIssue.state ||
    input.providerIssue.ownerContentMapping.sourceDigest !==
      baseIssue.ownerContentDigest ||
    input.providerIssue.ownerContentMapping.replacementDigest !==
      sha256Digest({
        titleDigest: input.providerIssue.title.digest,
        bodyDigest: input.providerIssue.body.digest,
      }) ||
    !exactBytes(input.providerIssue.title) ||
    !exactBytes(input.providerIssue.body) ||
    input.providerIssue.revision !== providerRevision(input.providerIssue) ||
    input.providerIssue.completenessRoot !==
      sha256Digest({
        id: input.providerIssue.id,
        revision: input.providerIssue.revision,
      })
  ) {
    findings.push("invalid-provider-improvement");
  }
  let issueRequest;
  try {
    const parsedIssueRequest = JSON.parse(
      Buffer.from(input.providerIssue.body.contentBase64, "base64").toString(
        "utf8",
      ),
    );
    const normalizedIssueRequest = normalizeJsonValue(parsedIssueRequest, {
      maxBytes: 16 * 1024,
      maxDepth: 4,
      maxNodes: 96,
      maxArrayLength: 16,
      maxObjectKeys: 4,
      maxStringLength: 2000,
    });
    if (
      !normalizedIssueRequest.ok ||
      !validateProviderIssueBody(normalizedIssueRequest.value)
    ) {
      findings.push("invalid-provider-request");
    } else {
      issueRequest = {
        evidenceRefs: normalizedIssueRequest.value.evidenceRefs.map(
          ({ authority, id, kind, subjectRef }) => ({
            authority,
            id,
            kind,
            subjectRef,
          }),
        ),
        proposalDigest: normalizedIssueRequest.value.proposalDigest,
        request: normalizedIssueRequest.value.request,
      };
    }
  } catch {
    findings.push("invalid-provider-request");
  }
  verifySigned(input.providerIssue, "provider", asOf, keys, findings);

  if (
    input.continuation.portfolioRevision !== input.portfolio.revision ||
    input.continuation.sourceBindingsRoot !== bindingsRoot ||
    timestamp(input.continuation.signedAt) >
      timestamp(input.continuation.validUntil) ||
    timestamp(input.continuation.validUntil) < asOfMs
  ) {
    findings.push("invalid-continuation-checkpoint");
  }
  findings.push(
    ...continuationModeFindings(
      input.continuation,
      repoOpsArtifact.run.currentCheckpointId,
    ),
  );
  verifySigned(input.continuation, "continuation", asOf, keys, findings);

  const proposalErrors = validateContributionProposal(
    input.admission.proposal,
    catalog.entries,
  );
  const proposalDigest = sha256Digest(input.admission.proposal);
  const similarity = contributionSimilarityReport(
    input.admission.proposal.entry,
    catalog.entries,
  );
  const comparedAlternatives = new Set(
    input.admission.proposal.contribution.existingAlternatives.map(
      (item) => item.id,
    ),
  );
  const nearestCoverage = similarity.matches.filter((item) =>
    comparedAlternatives.has(item.id),
  ).length;
  const compositionContract = input.admission.compositionContract;
  const mappedPorts = compositionContract?.ownerMappings ?? [];
  const compositionContractValid =
    compositionContract !== null &&
    compositionContract.proposalDigest === proposalDigest &&
    canonicalJson(compositionContract.requiredOutputPorts) ===
      canonicalJson(COMPOSITION_MAPPINGS.map((item) => item.outputPort)) &&
    canonicalJson(mappedPorts) === canonicalJson(COMPOSITION_MAPPINGS) &&
    mappedPorts.every((mapping) =>
      mapping.sourcePaths.every((path) =>
        input.sourceBindings.some((item) => item.path === path),
      ),
    ) &&
    mappedPorts.every((mapping) => mapping.authority.length === 0);
  if (
    proposalErrors.length ||
    input.admission.proposalDigest !== proposalDigest ||
    input.admission.issueRevision !== input.providerIssue.revision ||
    nearestCoverage < Math.min(2, similarity.matches.length) ||
    issueRequest?.proposalDigest !== proposalDigest ||
    (compositionContract !== null && !compositionContractValid)
  ) {
    findings.push("invalid-admission-proposal");
  }
  const dispositionEvidence = input.admission.dispositionEvidence;
  const boundOwnerIds = new Set(
    input.sourceBindings.map((binding) => binding.ownerId),
  );
  const requiredOwnerSetComplete =
    canonicalJson([...dispositionEvidence.requiredOwnerIds].sort()) ===
    canonicalJson([...REQUIRED_OWNER_IDS].sort());
  const issueEvidenceRefs = issueRequest?.evidenceRefs ?? [];
  const issueEvidenceById = new Map(
    issueEvidenceRefs.map((evidence) => [evidence.id, evidence]),
  );
  const providerIssueEvidence = issueEvidenceRefs.filter(
    (evidence) => evidence.kind === "provider-issue",
  );
  const continuationEvidence = issueEvidenceRefs.filter(
    (evidence) => evidence.kind === "continuation-checkpoint",
  );
  const lifecycleEvidenceIds = issueEvidenceRefs
    .filter((evidence) => evidence.kind === "lifecycle-retirement")
    .map((evidence) => evidence.id)
    .sort();
  const productDecisionEvidenceIds = issueEvidenceRefs
    .filter((evidence) => evidence.kind === "product-decision-required")
    .map((evidence) => evidence.id)
    .sort();
  const existingMatchEntry = dispositionEvidence.existingMatch
    ? catalog.entries.find(
        (entry) => entry.id === dispositionEvidence.existingMatch.id,
      )
    : null;
  if (
    !requiredOwnerSetComplete ||
    dispositionEvidence.availableOwnerIds.some(
      (ownerId) => !boundOwnerIds.has(ownerId),
    ) ||
    issueEvidenceById.size !== issueEvidenceRefs.length ||
    providerIssueEvidence.length !== 1 ||
    continuationEvidence.length !== 1 ||
    issueEvidenceRefs.some((evidence) => {
      if (evidence.kind === "provider-issue") {
        return (
          evidence.id !== baseIssue?.id ||
          evidence.subjectRef !== input.admission.proposal.entry.id
        );
      }
      if (evidence.kind === "continuation-checkpoint") {
        return (
          evidence.id !== repoOpsArtifact.run.currentCheckpointId ||
          evidence.subjectRef !== input.continuation.id
        );
      }
      return evidence.subjectRef !== input.admission.proposal.entry.id;
    }) ||
    canonicalJson(
      [...dispositionEvidence.lifecycle.evidenceRefs].sort(),
    ) !== canonicalJson(lifecycleEvidenceIds) ||
    canonicalJson([...dispositionEvidence.productDecisionRefs].sort()) !==
      canonicalJson(productDecisionEvidenceIds) ||
    dispositionEvidence.lifecycle.evidenceRefs.some((evidenceRef) => {
      const evidence = issueEvidenceById.get(evidenceRef);
      return (
        evidence?.kind !== "lifecycle-retirement" ||
        evidence.authority !== "catalog-maintainer-decision"
      );
    }) ||
    dispositionEvidence.productDecisionRefs.some((evidenceRef) => {
      const evidence = issueEvidenceById.get(evidenceRef);
      return (
        evidence?.kind !== "product-decision-required" ||
        evidence.authority !== "catalog-maintainer-decision"
      );
    }) ||
    (dispositionEvidence.existingMatch !== null &&
      (!existingMatchEntry ||
        dispositionEvidence.existingMatch.operatingContractDigest !==
          operatingContractDigest(existingMatchEntry))) ||
    (dispositionEvidence.lifecycle.action === "retire") !==
      (dispositionEvidence.lifecycle.evidenceRefs.length > 0)
  ) {
    findings.push("invalid-disposition-evidence");
  }
  verifySigned(input.admission, "admission", asOf, keys, findings);

  const expectedFiles = await expectedPackageFiles(actualBindings);
  if (
    input.packageManifest.catalogRevision !== PINNED_CATALOG_REVISION ||
    canonicalJson(input.packageManifest.files) !==
      canonicalJson(expectedFiles) ||
    input.packageManifest.root !== packageRoot(input.packageManifest.files)
  ) {
    findings.push("invalid-package-manifest");
  }
  verifySigned(input.packageManifest, "catalog", asOf, keys, findings);

  const receiptIds = new Set();
  for (const receipt of input.idempotencyReceipts) {
    if (
      receiptIds.has(receipt.id) ||
      receipt.providerRef !== input.providerIssue.id ||
      receipt.issueRevision !== input.providerIssue.revision ||
      receipt.state !== "available" ||
      timestamp(receipt.issuedAt) > timestamp(receipt.validUntil) ||
      timestamp(receipt.validUntil) < asOfMs
    ) {
      findings.push("invalid-idempotency-receipt");
    }
    receiptIds.add(receipt.id);
    verifySigned(receipt, "receipt", asOf, keys, findings);
  }
  if (
    canonicalJson([...receiptIds].sort()) !==
    canonicalJson([...input.continuation.priorReceiptIds].sort())
  ) {
    findings.push("continuation-receipt-mismatch");
  }

  if (input.usageEvidence) {
    if (
      input.usageEvidence.issueRevision !== input.providerIssue.revision ||
      !input.usageEvidence.sourceRef.startsWith(
        `controlled://${input.usageEvidence.tenantRef}/`,
      ) ||
      input.usageEvidence.successCount + input.usageEvidence.failureCount >
        input.usageEvidence.eventCount ||
      canonicalJson([...input.usageEvidence.minimizedFields].sort()) !==
        canonicalJson(
          ["event-count", "failure-count", "success-count"].sort(),
        ) ||
      timestamp(input.usageEvidence.issuedAt) >
        timestamp(input.usageEvidence.validUntil) ||
      timestamp(input.usageEvidence.validUntil) < asOfMs ||
      input.usageEvidence.revision !== contentRevision(input.usageEvidence)
    ) {
      findings.push("invalid-minimized-usage");
    }
    verifySigned(input.usageEvidence, "usage", asOf, keys, findings);
  }
  let optionalEvidence = null;
  if (input.runtimeBudget) {
    if (
      timestamp(input.runtimeBudget.issuedAt) >
        timestamp(input.runtimeBudget.validUntil) ||
      timestamp(input.runtimeBudget.validUntil) < asOfMs
    ) {
      findings.push("invalid-runtime-budget");
    }
    verifySigned(
      input.runtimeBudget,
      "runtime-budget",
      asOf,
      keys,
      findings,
    );

    let quality;
    let regressions;
    let runtimeBudget;
    let runtimeProfile;
    let mockContext;
    let scenarios = [];
    try {
      const [experienceCases, regressionRegistry, profile, context] =
        await Promise.all([
          readExperienceCases(catalog),
          readRegressionCases(),
          readRuntimeProfile(),
          loadMockPlusContext(),
        ]);
      runtimeProfile = profile;
      mockContext = context;
      quality = await buildCatalogQualityScorecard({
        catalog: {
          entries: catalog.entries.filter((entry) =>
            REQUIRED_OWNER_IDS.includes(entry.id),
          ),
        },
        contributions: await Promise.all(
          REQUIRED_OWNER_IDS.map((id) =>
            readFile(
              join(root, "contributions", `${id}.json`),
              "utf8",
            ).then(JSON.parse),
          ),
        ),
        experienceCases: experienceCases.filter((item) =>
          REQUIRED_OWNER_IDS.includes(item.id),
        ),
        regressionCases: regressionRegistry.cases.filter((item) =>
          REQUIRED_OWNER_IDS.includes(item.id),
        ),
        asOf: new Date(asOfMs).toISOString().slice(0, 10),
      });
      regressions = await runRepositoryRegressionCases({
        onlyIds: REQUIRED_OWNER_IDS,
      });
      scenarios = regressionRegistry.cases
        .filter((item) => REQUIRED_OWNER_IDS.includes(item.id))
        .flatMap(buildScenarios);
      runtimeBudget = preflightBudgets({
        mode: "mock",
        selectedTrialCount: scenarios.length,
        catalogClawCount: catalog.entries.length,
        limits: {
          concurrency: input.runtimeBudget.concurrency,
          trialTimeoutMs: input.runtimeBudget.trialTimeoutMs,
          cleanupTimeoutMs: input.runtimeBudget.cleanupTimeoutMs,
          infrastructureRetries: input.runtimeBudget.infrastructureRetries,
          maxInputTokensPerTrial:
            input.runtimeBudget.maxInputTokensPerTrial,
          maxOutputTokensPerTrial:
            input.runtimeBudget.maxOutputTokensPerTrial,
          maxTotalTokens: input.runtimeBudget.maxTotalTokens,
          maxUsd: input.runtimeBudget.maxUsd,
        },
        pricing: {
          inputUsdPerMillion: input.runtimeBudget.inputUsdPerMillion,
          outputUsdPerMillion: input.runtimeBudget.outputUsdPerMillion,
        },
      });
    } catch {
      findings.push("optional-evidence-validation-failed");
    }
    const registeredOwnerIds = REQUIRED_OWNER_IDS.filter((id) =>
      mockContext?.inventory.entries.some(
        (item) => item.id === id && item.schema.registered,
      ),
    );
    if (
      !quality ||
      !regressions ||
      !runtimeBudget ||
      !runtimeProfile ||
      quality.scores.some((item) => !item.gates.qualified) ||
      regressions.length !== REQUIRED_OWNER_IDS.length ||
      !runtimeBudget.tokenBudgetCoversSelectedWorstCase ||
      !runtimeBudget.usdBudgetCoversSelectedWorstCase ||
      registeredOwnerIds.length !== REQUIRED_OWNER_IDS.length
    ) {
      findings.push("optional-evidence-validation-failed");
    } else {
      optionalEvidence = {
        advisoryOnly: true,
        requiredForClassification: false,
        catalogQuality: {
          qualifiedOwnerIds: quality.scores
            .filter((item) => item.gates.qualified)
            .map((item) => item.id)
            .sort(),
          totals: Object.fromEntries(
            quality.scores
              .map((item) => [item.id, item.total])
              .sort(([left], [right]) =>
                left < right ? -1 : left > right ? 1 : 0,
              ),
          ),
        },
        regression: {
          passedOwnerIds: regressions.map((item) => item.id).sort(),
        },
        runtime: {
          profileSchemaVersion: runtimeProfile.schemaVersion,
          scenarioCount: scenarios.length,
          selectedEstimateTokens: runtimeBudget.selectedEstimateTokens,
          selectedEstimateUsd: runtimeBudget.selectedEstimateUsd,
        },
        mockPlus: {
          registeredOwnerIds,
        },
      };
    }
  }

  const capacity = workChiefArtifact.capacityEnvelopes.find(
    (item) => item.id === input.portfolio.capacityEnvelopeRef,
  );
  if (!capacity) return invalid(["unknown-capacity-envelope"]);
  if (
    dispositionEvidence.proposedDemand.capacityEnvelopeRef !== capacity.id ||
    dispositionEvidence.proposedDemand.unit !== capacity.unit
  ) {
    findings.push("invalid-proposed-demand");
  }
  const committedDemand = workChiefArtifact.workstreams
    .flatMap((item) => item.capacityDemands)
    .filter((item) => item.capacityRef === capacity.id)
    .reduce((total, item) => total + item.amount, 0);
  const conflictRefs = workChiefArtifact.conflicts
    .filter(
      (conflict) =>
        conflict.kind === "capacity" &&
        conflict.state === "open" &&
        conflict.workstreamRefs.some((workstreamRef) =>
          workChiefArtifact.workstreams.some(
            (workstream) =>
              workstream.id === workstreamRef &&
              workstream.capacityDemands.some(
                (demand) => demand.capacityRef === capacity.id,
              ),
          ),
        ),
    )
    .map((item) => item.id)
    .sort();
  const proposedDemand = dispositionEvidence.proposedDemand.amount;
  const availableBeforeProposal = capacity.amount - committedDemand;
  const demandCanBeAllocated =
    proposedDemand <= Math.max(0, availableBeforeProposal) &&
    conflictRefs.length === 0;
  const totalDemand = committedDemand + proposedDemand;
  const emittedPortRefs = {
    "portfolio-run-lineage": input.continuation.id,
    "provider-issue-snapshot": input.providerIssue.id,
    "typed-admission-decision": input.admission.id,
    "signed-package-tree": input.packageManifest.id,
    "stateless-budget-plan": capacity.id,
    "externally-pinned-trust": "composition-trust",
    "minimized-usage-evidence": "runtime-evidence-optional",
    "proposal-owner-handoff": "work-chief-handoff",
  };
  const mappedOutputsEmitted = mappedPorts.every(
    (mapping) =>
      emittedPortRefs[mapping.outputPort] === mapping.extensionRef,
  );
  const reachableAuthority = [
    ...new Set(mappedPorts.flatMap((mapping) => mapping.authority)),
  ].sort();
  if (reachableAuthority.length > 0) {
    findings.push("composition-reaches-forbidden-authority");
  }
  const admissionScorecard = deriveAdmissionScorecard(
    input.admission.comparison,
    dispositionEvidence,
    {
      compositionFeasible:
        compositionContractValid &&
        mappedOutputsEmitted &&
        findings.length === 0,
      boundOwnerIds,
      proposalOperatingContractDigest: operatingContractDigest(
        input.admission.proposal.entry,
      ),
    },
  );
  const classification = admissionScorecard.selected;
  if (findings.length) return invalid(findings);
  const result = {
    schemaVersion: COMPOSITION_RESULT_VERSION,
    verdict: "IMPROVE_COMPOSE",
    standaloneCandidateAccepted: false,
    confidence: 0.92,
    sourceBindingsRoot: bindingsRoot,
    classification,
    admissionScorecard,
    optionalEvidence,
    ports: {
      "portfolio-run-lineage": {
        owner: "repository-operations-manager",
        mode: input.continuation.mode,
        runId: repoOpsArtifact.run.id,
        predecessorCheckpointRef:
          input.continuation.predecessorCheckpointRef,
        continuationCheckpointRef: input.continuation.id,
        portfolioRevision: input.portfolio.revision,
        sourceBindingsRoot: input.continuation.sourceBindingsRoot,
        priorReceiptIds: input.continuation.priorReceiptIds,
        signedAt: input.continuation.signedAt,
        validUntil: input.continuation.validUntil,
        signerRef: input.continuation.signerRef,
        signature: input.continuation.signature,
      },
      "provider-issue-snapshot": {
        owner: "repository-compliance-program-manager",
        issueRef: baseIssue.id,
        providerIssueId: baseIssue.providerIssueId,
        url: baseIssue.url,
        state: baseIssue.status,
        revision: input.providerIssue.revision,
        completenessRoot: input.providerIssue.completenessRoot,
        capturedAt: input.providerIssue.capturedAt,
        title: input.providerIssue.title,
        body: input.providerIssue.body,
        decodedBody: issueRequest,
      },
      "typed-admission-decision": {
        owner: "contribution-admission",
        issueRevision: input.providerIssue.revision,
        classification,
        proposalDigest,
        comparison: input.admission.comparison,
        nearestMatches: similarity.matches.map((item) => item.id),
        scorecard: admissionScorecard,
        dispositionEvidence: admissionScorecard.evidence,
      },
      "signed-package-tree": {
        owner: "catalog-quality",
        manifestRef: input.packageManifest.id,
        catalogRevision: input.packageManifest.catalogRevision,
        root: input.packageManifest.root,
        fileCount: input.packageManifest.files.length,
      },
      "stateless-budget-plan": {
        owner: "work-chief-of-staff",
        mode: "stateless-proposal",
        capacityEnvelopeRef: capacity.id,
        capacityAmount: capacity.amount,
        capacityUnit: capacity.unit,
        committedDemand,
        proposedDemand,
        totalDemand,
        remainingAmount: capacity.amount - totalDemand,
        overCapacity: totalDemand > capacity.amount,
        conflictRefs,
        allocation: demandCanBeAllocated
          ? {
              state: "allocated",
              allocatedAmount: proposedDemand,
              blockedAmount: 0,
              reason: null,
            }
          : {
              state: "blocked",
              allocatedAmount: 0,
              blockedAmount: proposedDemand,
              reason:
                conflictRefs.length > 0
                  ? "capacity-conflict"
                  : "capacity-exceeded",
            },
        priorReceiptIds: input.continuation.priorReceiptIds,
        proposedIdempotencyKey: sha256Digest({
          issueRevision: input.providerIssue.revision,
          classification,
          continuation: input.continuation.id,
        }),
        externalReceiptRequired: true,
        reservationClaim: false,
        atomicMutationClaim: false,
      },
      "externally-pinned-trust": {
        owner: "composition-adapter",
        revision: trust.revision,
        trustSchemaVersion: trust.schemaVersion,
        pinNotBefore: trustPin.notBefore,
        pinExpiresAt: trustPin.expiresAt,
        keyIds: [...keys.keys()].sort(),
      },
      "minimized-usage-evidence": input.usageEvidence
        ? {
            owner: "runtime-evidence",
            evidenceRef: input.usageEvidence.id,
            tenantRef: input.usageEvidence.tenantRef,
            sourceRef: input.usageEvidence.sourceRef,
            eventCount: input.usageEvidence.eventCount,
            successCount: input.usageEvidence.successCount,
            failureCount: input.usageEvidence.failureCount,
            allowedIssueEffects: ["create", "reprioritize"],
            advisoryOnly: true,
            externalMutation: false,
          }
        : null,
      "proposal-owner-handoff": {
        owner: "work-chief-of-staff",
        state: workChiefArtifact.handoff.state,
        issueRevision: input.providerIssue.revision,
        classification,
        composition: [...REQUIRED_OWNER_IDS],
        continuationCheckpointRef: input.continuation.id,
        externalActionRequired: true,
        externalMutation: false,
      },
    },
    recipe: [
      {
        owner: "repository-operations-manager",
        improvement:
          "Emit signed portfolio selection and continuation checkpoint fields.",
        outputPort: "portfolio-run-lineage",
      },
      {
        owner: "repository-compliance-program-manager",
        improvement:
          "Emit complete provider issue snapshot receipts without invoking mutation.",
        outputPort: "provider-issue-snapshot",
      },
      {
        owner: "contribution-admission",
        improvement:
          "Derive typed admission from a validated proposal and signed comparison.",
        outputPort: "typed-admission-decision",
      },
      {
        owner: "catalog-quality",
        improvement:
          "Publish a signed package-tree manifest over exact catalog and source bytes.",
        outputPort: "signed-package-tree",
      },
      {
        owner: "work-chief-of-staff",
        improvement:
          "Plan against supplied capacity and external idempotency receipts without reserving.",
        outputPort: "stateless-budget-plan",
      },
      {
        owner: "composition-adapter",
        improvement:
          "Pin public verification keys and reject unknown signer domains.",
        outputPort: "externally-pinned-trust",
      },
      {
        owner: "runtime-evidence",
        improvement:
          "Emit tenant-scoped minimized advisory outcome evidence.",
        outputPort: "minimized-usage-evidence",
      },
      {
        owner: "work-chief-of-staff",
        improvement:
          "Render the combined evidence and proposal as an owner-controlled handoff.",
        outputPort: "proposal-owner-handoff",
      },
    ],
    reachableAuthority,
    authority: { ...AUTHORITY },
  };
  const outputFindings = schemaErrors(validateOutput, result, "$.result");
  return outputFindings.length
    ? invalid(outputFindings)
    : JSON.parse(canonicalJson(result));
}

export function renderCompositionPlan(result) {
  if (result.verdict !== "IMPROVE_COMPOSE") {
    return `# Claw Portfolio Manager composition\n\n**Status:** ${result.verdict}\n`;
  }
  return `# Claw Portfolio Manager composition

**Decision:** IMPROVE/COMPOSE (standalone candidate rejected)
**Confidence:** ${result.confidence}
**Classification:** ${result.classification}

${result.recipe
  .map(
    (item) =>
      `- **${item.owner}** -> \`${item.outputPort}\`: ${item.improvement}`,
  )
  .join("\n")}

No merge, publish, external mutation, atomic mutation, budget increase, risk
acceptance, HR inference, or sensitive-person inference authority is reachable.
`;
}

async function readBoundedJsonFile(path, maxBytes) {
  if (typeof path !== "string" || path.length === 0 || path.length > 4096) {
    return { ok: false };
  }
  let handle;
  try {
    handle = await open(path, "r");
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) return { ok: false };
    const chunks = [];
    let total = 0;
    while (total <= maxBytes) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
      if (total > maxBytes) return { ok: false };
    }
    return {
      ok: true,
      value: JSON.parse(Buffer.concat(chunks, total).toString("utf8")),
    };
  } catch {
    return { ok: false };
  } finally {
    await handle?.close().catch(() => {});
  }
}

function parseCompositionCliArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 8) return null;
  const allowed = new Set(["--input", "--trust", "--trust-pin", "--as-of"]);
  const parsed = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !allowed.has(name) ||
      Object.hasOwn(parsed, name) ||
      typeof value !== "string" ||
      value.length === 0
    ) {
      return null;
    }
    parsed[name] = value;
  }
  return allowed.size === Object.keys(parsed).length ? parsed : null;
}

export async function runCompositionCli(argv) {
  const parsed = parseCompositionCliArgs(argv);
  if (!parsed) return invalid(["invalid-cli-arguments"]);
  const [input, trust, trustPin] = await Promise.all([
    readBoundedJsonFile(resolve(parsed["--input"]), 1024 * 1024),
    readBoundedJsonFile(resolve(parsed["--trust"]), 128 * 1024),
    readBoundedJsonFile(resolve(parsed["--trust-pin"]), 4096),
  ]);
  if (!input.ok || !trust.ok || !trustPin.ok) {
    return invalid(["unsafe-or-oversized-cli-file"]);
  }
  try {
    return await composePortfolioPlan(input.value, trust.value, trustPin.value, {
      asOf: parsed["--as-of"],
    });
  } catch {
    return invalid(["composition-failed-closed"]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await runCompositionCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict === "INVALID") process.exitCode = 1;
}
