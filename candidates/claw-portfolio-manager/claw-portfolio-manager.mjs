import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

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
import {
  repositoryComplianceProgramFindings,
} from "../../scripts/repository-compliance-program-manager.mjs";
import {
  repositoryOperationsFindings,
} from "../../scripts/repository-operations-manager.mjs";
import {
  buildScenarios,
  preflightBudgets,
  readRuntimeProfile,
} from "../../scripts/runtime-evidence-lib.mjs";

export const CANDIDATE_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerCandidate.v1";
export const RESULT_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerResult.v1";
export const PUBLIC_TRUST_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerPublicTrust.v1";
export const SOURCE_RECEIPTS_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerSourceReceipts.v1";
export const COMPOSITION_PROOF_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerCompositionProof.v1";
export const BASE_CATALOG_REVISION =
  "0c1bfb3c973a9940f301a5001e77435789993555";

export const CLASSIFICATIONS = Object.freeze([
  "NEW",
  "IMPROVE",
  "COMPOSE",
  "VARIANT",
  "PRODUCT_DECISION",
  "RETIRE",
  "DUPLICATE",
  "UNSUPPORTED",
]);

export const CANDIDATE_LIMITS = Object.freeze({
  inputBytes: 512 * 1024,
  publicTrustBytes: 64 * 1024,
  sourceReceiptsBytes: 256 * 1024,
  compositionProofBytes: 256 * 1024,
  outputBytes: 512 * 1024,
  maxDepth: 28,
  maxNodes: 20_000,
  maxArrayLength: 256,
  maxObjectKeys: 128,
  maxStringLength: 131_072,
});

const AUTHORITY_NON_CLAIMS = Object.freeze({
  merge: false,
  publish: false,
  budgetIncrease: false,
  riskAcceptance: false,
  externalMutation: false,
  productionClawMutation: false,
  sensitivePersonalInference: false,
  reseal: false,
});

const COMPOSITION_VALIDATOR_DESCRIPTOR = Object.freeze({
  schemaVersion: "awesomeClaws.clawPortfolioManagerCompositionValidator.v1",
  operation: "exact-required-fact-set",
  sourcePolicy: "signed-independent-artifact-bytes",
  authorityPolicy: "no-invented-semantics-or-consequential-authority",
});

const PINNED_ANALOGUE_FILES = Object.freeze({
  "scripts/contribution-lib.mjs":
    "sha256:2022abee643543867a5615e31f738309e67351d52baa28a58dd1cc856009b6ce",
  "scripts/repository-operations-manager.mjs":
    "sha256:5dd45f766a680e8c4e974acc09e74bc1770f69713dc36dccd5b4ba344851a1ea",
  "sources/repository-operations-manager/schemas/repository-operations.schema.json":
    "sha256:ed96bbfc7068e11493a75461c8c02c1fa9a6f3298de69dd5df5f3cd71baac677",
  "sources/repository-operations-manager/fixtures/repository-operations.example.json":
    "sha256:e04a703ffcbd362afa57e3e616858d3f0d0182f5de2f59ac32612883f9ea03c6",
  "scripts/repository-compliance-program-manager.mjs":
    "sha256:0163b1580ead609f7722c417b78a063395045c9542fbc5aa7d78f888417dd202",
  "sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json":
    "sha256:11249af3ac39950f054aa8cb1d0c7d2c9da016ae1b9f814cbf0e72ea6d9dfb57",
  "sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json":
    "sha256:8aff6f0ba5f3c54b16dffcbb56c739af813d7ba6aa93e9fa1852fdc27b203a87",
  "scripts/catalog-quality-score.mjs":
    "sha256:8b022814145f628b29c391831f39e181134adbb9eab43059a6264982c592c7db",
  "scripts/regression-cases.mjs":
    "sha256:72c10a0bd9f7b7df8d6d5aae61af4366b0c1e633cd26f0fc094ad358db98470e",
  "scripts/runtime-evidence-lib.mjs":
    "sha256:c89526bee2d916d28c1b47d6fc76e56de2d550cb90dc4bc869dd3bbbb23e6f91",
  "scripts/mock-plus-lib.mjs":
    "sha256:5aa6a14c9aa3bdca71864de2456296235d013e802fb95cc8595e0820418a8d19",
});
const PINNED_CATALOG_ENTRY_DIGESTS = Object.freeze({
  "repository-operations-manager":
    "sha256:f89be6f6a3b5a23ee5598df1f6c974eb010a3e0830b11972c0368c1e79ea1842",
  "repository-compliance-program-manager":
    "sha256:cad53dc0b2ea776461a4ec49b632dcc45879a96258cf26f4773a749baef9eab9",
  "product-manager":
    "sha256:f8080dffb4849290fe7cb66e3e3ca798aa0858fe6a7225ad2712bf5325c513dd",
});

const candidateSchema = JSON.parse(
  readFileSync(
    new URL("./schemas/claw-portfolio-manager.schema.json", import.meta.url),
    "utf8",
  ),
);
const publicTrustSchema = JSON.parse(
  readFileSync(new URL("./schemas/public-trust.schema.json", import.meta.url), "utf8"),
);
const sourceReceiptsSchema = JSON.parse(
  readFileSync(new URL("./schemas/source-receipts.schema.json", import.meta.url), "utf8"),
);
const compositionProofSchema = JSON.parse(
  readFileSync(new URL("./schemas/composition-proof.schema.json", import.meta.url), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCandidateSchema = ajv.compile(candidateSchema);
const validatePublicTrustSchema = ajv.compile(publicTrustSchema);
const validateSourceReceiptsSchema = ajv.compile(sourceReceiptsSchema);
const validateCompositionProofSchema = ajv.compile(compositionProofSchema);

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function sortedStrings(value) {
  return [...strings(value)].sort(compareText);
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON requires finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical JSON cannot encode cycles.");
    }
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical JSON cannot encode cycles.");
    }
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonInner(value[key], next)}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}.`);
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

export function sha256Digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function sha256Bytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function withoutSignature(value) {
  const { signature: _signature, ...unsigned } = value;
  return unsigned;
}

export function computeBudgetRevision(value) {
  const { revision: _revision, ...content } = value;
  return sha256Digest(content);
}

export function computePrincipalRoot(principals) {
  return sha256Digest(
    records(principals)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        roles: sortedStrings(item.roles),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
  );
}

export function computeGrantRoot(grants) {
  return sha256Digest(
    records(grants)
      .map((item) => ({
        ...item,
        issueRefs: sortedStrings(item.issueRefs),
        classifications: sortedStrings(item.classifications),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
  );
}

export function computeUsagePolicyRevision(value) {
  return sha256Digest({
    ...value,
    allowedTenantRefs: sortedStrings(value.allowedTenantRefs),
    allowedSourceRefs: sortedStrings(value.allowedSourceRefs),
    allowedEffects: sortedStrings(value.allowedEffects),
  });
}

export function computeEvidenceRecordRevision(value) {
  const { revision: _revision, ...content } = value;
  return sha256Digest(content);
}

export function computeEvidenceEnvelopeRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function computeIssueSourceDigest(value) {
  const {
    revision: _revision,
    sourceDigest: _sourceDigest,
    ...source
  } = value;
  return sha256Digest(source);
}

export function computeIssueRevision(value) {
  return sha256Digest({
    id: value.id,
    previousRevision: value.previousRevision,
    sourceDigest: value.sourceDigest,
  });
}

export function computeIssueUniverseRoot(issues) {
  return sha256Digest(
    records(issues)
      .map((item) => ({ id: item.id, revision: item.revision }))
      .sort((left, right) => compareText(left.id, right.id)),
  );
}

export function computePortfolioManifestRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function computeIssueManifestRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function computePredecessorRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function computeSourceReceiptsRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function signedPayload(value) {
  return Buffer.from(canonicalJson(withoutSignature(value)), "utf8");
}

function finding(code, path) {
  return { code, path };
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings
    .filter((item) => {
      const key = `${item.code}\0${item.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        compareText(left.code, right.code) ||
        compareText(left.path, right.path),
    );
}

function normalizeJsonValue(value, limits) {
  let nodes = 0;
  let stringBytes = 0;
  const ancestors = new Set();

  function fail(code) {
    return { ok: false, code };
  }

  function visit(item, depth) {
    nodes += 1;
    if (nodes > limits.maxNodes) return fail("node-limit");
    if (depth > limits.maxDepth) return fail("depth-limit");
    if (item === null || typeof item === "boolean") {
      return { ok: true, value: item };
    }
    if (typeof item === "string") {
      const bytes = Buffer.byteLength(item);
      stringBytes += bytes;
      if (bytes > limits.maxStringLength || stringBytes > limits.maxBytes) {
        return fail("string-limit");
      }
      return { ok: true, value: item };
    }
    if (typeof item === "number") {
      return Number.isFinite(item)
        ? { ok: true, value: item }
        : fail("non-finite-number");
    }
    if (
      typeof item === "symbol" ||
      typeof item === "bigint" ||
      typeof item === "function" ||
      typeof item === "undefined"
    ) {
      return fail("non-json-value");
    }
    if (utilTypes.isProxy(item)) return fail("proxy");
    if (ancestors.has(item)) return fail("cycle");

    let keys;
    let descriptors;
    let prototype;
    try {
      keys = Reflect.ownKeys(item);
      descriptors = Object.getOwnPropertyDescriptors(item);
      prototype = Object.getPrototypeOf(item);
    } catch {
      return fail("hostile-object");
    }
    if (keys.some((key) => typeof key === "symbol")) return fail("symbol-key");

    if (Array.isArray(item)) {
      if (prototype !== Array.prototype) return fail("non-plain-array");
      if (item.length > limits.maxArrayLength) return fail("array-limit");
      const dataKeys = keys.filter((key) => key !== "length");
      if (
        dataKeys.length !== item.length ||
        dataKeys.some((key, index) => key !== String(index))
      ) {
        return fail("sparse-or-custom-array");
      }
      if (
        dataKeys.some((key) => {
          const descriptor = descriptors[key];
          return (
            !descriptor ||
            !descriptor.enumerable ||
            !Object.hasOwn(descriptor, "value") ||
            Object.hasOwn(descriptor, "get") ||
            Object.hasOwn(descriptor, "set")
          );
        })
      ) {
        return fail("accessor-or-hidden-state");
      }
      ancestors.add(item);
      const output = [];
      for (const key of dataKeys) {
        const child = visit(descriptors[key].value, depth + 1);
        if (!child.ok) {
          ancestors.delete(item);
          return child;
        }
        output.push(child.value);
      }
      ancestors.delete(item);
      return { ok: true, value: output };
    }

    if (prototype !== Object.prototype && prototype !== null) {
      return fail("non-plain-object");
    }
    if (keys.length > limits.maxObjectKeys) return fail("object-key-limit");
    if (
      keys.some((key) => {
        const descriptor = descriptors[key];
        return (
          !descriptor ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value") ||
          Object.hasOwn(descriptor, "get") ||
          Object.hasOwn(descriptor, "set")
        );
      })
    ) {
      return fail("accessor-or-hidden-state");
    }
    ancestors.add(item);
    const output = Object.create(null);
    for (const key of keys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        ancestors.delete(item);
        return fail("prototype-key");
      }
      const child = visit(descriptors[key].value, depth + 1);
      if (!child.ok) {
        ancestors.delete(item);
        return child;
      }
      output[key] = child.value;
    }
    ancestors.delete(item);
    return { ok: true, value: output };
  }

  const normalized = visit(value, 0);
  if (!normalized.ok) return normalized;
  try {
    if (Buffer.byteLength(canonicalJson(normalized.value)) > limits.maxBytes) {
      return fail("byte-limit");
    }
  } catch {
    return fail("canonicalization");
  }
  return normalized;
}

function normalize(value, maxBytes) {
  return normalizeJsonValue(value, {
    ...CANDIDATE_LIMITS,
    maxBytes,
  });
}

function timestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    )
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = [...left].sort(compareText);
  const b = [...right].sort(compareText);
  return (
    new Set(a).size === a.length &&
    new Set(b).size === b.length &&
    a.length === b.length &&
    a.every((item, index) => item === b[index])
  );
}

function mapById(value) {
  return new Map(
    records(value)
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
}

function duplicateIds(collections) {
  const seen = new Set();
  const duplicates = new Set();
  for (const items of collections) {
    for (const item of records(items)) {
      if (typeof item.id !== "string") continue;
      if (seen.has(item.id)) duplicates.add(item.id);
      seen.add(item.id);
    }
  }
  return [...duplicates].sort(compareText);
}

function containsCredentialMaterial(value, seen = new Set()) {
  if (typeof value === "string") {
    return (
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/iu.test(value) ||
      /\b(?:password|secret|api[_-]?key|access[_-]?token|bearer)\s*[:=]\s*\S+/iu.test(
        value,
      )
    );
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) =>
    containsCredentialMaterial(item, seen),
  );
}

function unsafePublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    /^(?:localhost(?:\.localdomain)?|.+\.localhost|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|::|::1|::ffff:.*|f[cd][0-9a-f:]*|fe[89ab][0-9a-f:]*|ff[0-9a-f:]*)$/u.test(
      host,
    )
  ) {
    return true;
  }
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/u.exec(host);
  return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
}

function safeSourceReference(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("controlled://")) {
    return /^controlled:\/\/[a-z0-9][a-z0-9./_-]*$/u.test(value);
  }
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    const unsafeQueryKey =
      /^(?:access[_-]?token|api[_-]?key|auth|code|credential|key|password|secret|token)$/iu;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !unsafePublicHost(url.hostname) &&
      ![...url.searchParams.keys()].some((key) => unsafeQueryKey.test(key))
    );
  } catch {
    return false;
  }
}

function schemaFindings(validate, value, prefix) {
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) =>
    finding(
      "invalid-schema",
      `${prefix}${error.instancePath || "/"}#${error.keyword}`,
    ),
  );
}

function strictBase64(value) {
  if (typeof value !== "string") return null;
  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.toString("base64") === value ? bytes : null;
  } catch {
    return null;
  }
}

function publicKeyRecord(signer) {
  try {
    const key = createPublicKey({
      key: signer.publicKeyPem,
      format: "pem",
    });
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") return null;
    const der = key.export({ type: "spki", format: "der" });
    if (der.length !== 44) return null;
    const canonicalPem = key.export({ type: "spki", format: "pem" }).toString();
    if (canonicalPem !== signer.publicKeyPem) return null;
    return {
      key,
      fingerprint: sha256Bytes(der),
    };
  } catch {
    return null;
  }
}

function validateTrustStore(trustStore, findings, path = "$.validationContext.publicTrust") {
  findings.push(...schemaFindings(validatePublicTrustSchema, trustStore, path));
  if (!validatePublicTrustSchema(trustStore)) return new Map();
  if (containsCredentialMaterial(trustStore)) {
    findings.push(finding("private-or-credential-material", path));
    return new Map();
  }
  const signers = new Map();
  const fingerprints = new Map();
  for (const [index, signer] of trustStore.signers.entries()) {
    const keyRecord = publicKeyRecord(signer);
    if (!keyRecord) {
      findings.push(
        finding("invalid-ed25519-spki", `${path}.signers[${index}].publicKeyPem`),
      );
      continue;
    }
    if (signers.has(signer.keyId)) {
      findings.push(finding("duplicate-trust-key", `${path}.signers[${index}].keyId`));
    }
    const reusedBy = fingerprints.get(keyRecord.fingerprint);
    if (reusedBy && reusedBy !== signer.principalRef) {
      findings.push(
        finding(
          "cross-principal-key-reuse",
          `${path}.signers[${index}].publicKeyPem`,
        ),
      );
    }
    fingerprints.set(keyRecord.fingerprint, signer.principalRef);
    signers.set(signer.keyId, { ...signer, ...keyRecord });
  }
  return signers;
}

function verifySigned({
  value,
  payload,
  purpose,
  principalRef,
  principalKind,
  signedAt,
  signers,
  path,
  findings,
}) {
  const signer = signers.get(value?.signature?.keyId);
  const signature = strictBase64(value?.signature?.value);
  const signedMs = timestamp(signedAt);
  if (
    value?.signature?.algorithm !== "Ed25519" ||
    !signer ||
    !signature ||
    signer.principalRef !== principalRef ||
    signer.kind !== principalKind ||
    !signer.purposes.includes(purpose) ||
    signedMs === null ||
    timestamp(signer.validFrom) > signedMs ||
    timestamp(signer.validUntil) < signedMs ||
    !verifySignature(null, payload, signer.key, signature)
  ) {
    findings.push(finding("invalid-signature", path));
    return false;
  }
  return true;
}

function principalHasRole(principals, principalRef, role, kind) {
  const principal = principals.get(principalRef);
  return (
    principal?.kind === kind &&
    strings(principal.roles).includes(role)
  );
}

function classificationFor(issue) {
  const signals = issue.signals;
  if (signals.duplicateOfIssueRef !== null) return "DUPLICATE";
  if (issue.requestedAuthority.length > 0 || signals.unsupportedReason !== null) {
    return "UNSUPPORTED";
  }
  if (signals.retirementSignal) return "RETIRE";
  if (
    signals.requiresProductDecision ||
    signals.conflictingEvidenceRefs.length > 0
  ) {
    return "PRODUCT_DECISION";
  }
  if (
    signals.compositionPreservesJob &&
    signals.compositionClawRefs.length >= 2 &&
    signals.newInvariantIds.length === 0
  ) {
    return "COMPOSE";
  }
  if (signals.sameRepeatableJob && issue.affectedClaws.length > 0) {
    return "IMPROVE";
  }
  if (signals.variantOnly) return "VARIANT";
  if (signals.newInvariantIds.length > 0) return "NEW";
  return null;
}

function classificationBasisCount(issue) {
  const signals = issue.signals;
  return [
    signals.duplicateOfIssueRef !== null,
    issue.requestedAuthority.length > 0 || signals.unsupportedReason !== null,
    signals.retirementSignal,
    signals.requiresProductDecision ||
      signals.conflictingEvidenceRefs.length > 0,
    signals.compositionPreservesJob,
    signals.sameRepeatableJob,
    signals.variantOnly,
    signals.newInvariantIds.length > 0,
  ].filter(Boolean).length;
}

function expectedDemandShape(classification) {
  if (["NEW", "IMPROVE", "COMPOSE"].includes(classification)) {
    return {
      candidateSlots: classification === "NEW" ? 1 : 0,
      admissionSlots: 1,
    };
  }
  return { candidateSlots: 0, admissionSlots: 0 };
}

function applicableGrants(grants, issue, classification, kind) {
  return records(grants).filter(
    (grant) =>
      grant.kind === kind &&
      strings(grant.issueRefs).includes(issue.id) &&
      strings(grant.classifications).includes(classification),
  );
}

function evidenceRecords(input) {
  return input.evidenceEnvelopes.flatMap((envelope) =>
    envelope.records.map((record) => ({
      ...record,
      envelopeRef: envelope.id,
      envelopeKind: envelope.kind,
      envelopeIssuerRef: envelope.issuerRef,
      envelopeTenantRef: envelope.tenantRef,
      envelopeSourceRef: envelope.sourceRef,
    })),
  );
}

function issueIsStale(issue, evidenceById, asOfMs) {
  const freshAfter = timestamp(issue.signals.freshAfter);
  return issue.evidenceRefs.some((ref) => {
    const evidence = evidenceById.get(ref);
    return (
      !evidence ||
      timestamp(evidence.observedAt) < freshAfter ||
      timestamp(evidence.validUntil) < asOfMs
    );
  });
}

function issueHasConflict(issue, evidenceById) {
  const conflicting = issue.signals.conflictingEvidenceRefs.map((ref) =>
    evidenceById.get(ref),
  );
  const supporting = conflicting.filter((item) => item?.claim === "supports");
  const opposing = conflicting.filter((item) => item?.claim === "opposes");
  return supporting.some((left) =>
    opposing.some(
      (right) =>
        left.envelopeRef !== right.envelopeRef &&
        left.envelopeIssuerRef !== right.envelopeIssuerRef &&
        left.envelopeSourceRef !== right.envelopeSourceRef,
    ),
  );
}

function invalidResult(findings) {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    resultStatus: "invalid",
    findings: uniqueFindings(findings),
    authority: { ...AUTHORITY_NON_CLAIMS },
  };
}

async function catalogSourceFindings(input, sourceReceipts, signers, findings) {
  findings.push(
    ...schemaFindings(
      validateSourceReceiptsSchema,
      sourceReceipts,
      "$.validationContext.sourceReceipts",
    ),
  );
  if (!validateSourceReceiptsSchema(sourceReceipts)) return;
  if (containsCredentialMaterial(sourceReceipts)) {
    findings.push(
      finding(
        "private-or-credential-material",
        "$.validationContext.sourceReceipts",
      ),
    );
    return;
  }
  const principals = mapById(input.principals);
  if (
    !principalHasRole(
      principals,
      sourceReceipts.issuerRef,
      "catalog-source-custodian",
      "system",
    )
  ) {
    findings.push(
      finding(
        "invalid-catalog-source-custodian",
        "$.validationContext.sourceReceipts.issuerRef",
      ),
    );
  }
  if (
    sourceReceipts.revision !== computeSourceReceiptsRevision(sourceReceipts)
  ) {
    findings.push(
      finding(
        "invalid-source-receipts-revision",
        "$.validationContext.sourceReceipts.revision",
      ),
    );
  }
  verifySigned({
    value: sourceReceipts,
    payload: signedPayload(sourceReceipts),
    purpose: "catalog-source-receipt",
    principalRef: sourceReceipts.issuerRef,
    principalKind: "system",
    signedAt: sourceReceipts.issuedAt,
    signers,
    path: "$.validationContext.sourceReceipts.signature",
    findings,
  });
  const receiptById = mapById(sourceReceipts.receipts);
  for (const [index, receipt] of sourceReceipts.receipts.entries()) {
    const bytes = strictBase64(receipt.contentBase64);
    if (
      !bytes ||
      bytes.length !== receipt.byteLength ||
      sha256Bytes(bytes) !== receipt.digest
    ) {
      findings.push(
        finding(
          "invalid-source-byte-receipt",
          `$.validationContext.sourceReceipts.receipts[${index}]`,
        ),
      );
    }
    if (bytes && containsCredentialMaterial(bytes.toString("utf8"))) {
      findings.push(
        finding(
          "credential-bearing-source-bytes",
          `$.validationContext.sourceReceipts.receipts[${index}]`,
        ),
      );
    }
    let entry = null;
    try {
      if (bytes) entry = JSON.parse(bytes.toString("utf8"));
    } catch {
      findings.push(
        finding(
          "catalog-source-bytes-mismatch",
          `$.validationContext.sourceReceipts.receipts[${index}]`,
        ),
      );
    }
    const expectedBytes = entry
      ? Buffer.from(`${canonicalJson(entry)}\n`, "utf8")
      : null;
    if (
      !bytes ||
      !expectedBytes ||
      !bytes.equals(expectedBytes) ||
      entry.id !== receipt.clawId ||
      PINNED_CATALOG_ENTRY_DIGESTS[receipt.clawId] !== receipt.digest ||
      receipt.sourceRef !== `catalog.json#entries/${receipt.clawId}`
    ) {
      findings.push(
        finding(
          "catalog-source-bytes-mismatch",
          `$.validationContext.sourceReceipts.receipts[${index}]`,
        ),
      );
    }
  }
  const selected = input.portfolioManifest.selectedClaws;
  if (
    !sameSet(
      selected.map((item) => item.sourceReceiptRef),
      sourceReceipts.receipts.map((item) => item.id),
    )
  ) {
    findings.push(
      finding(
        "source-receipt-coverage-mismatch",
        "$.portfolioManifest.selectedClaws",
      ),
    );
  }
  for (const [index, selectedClaw] of selected.entries()) {
    const receipt = receiptById.get(selectedClaw.sourceReceiptRef);
    if (
      !receipt ||
      receipt.clawId !== selectedClaw.clawId ||
      receipt.digest !== selectedClaw.clawRevision
    ) {
      findings.push(
        finding(
          "selected-claw-source-mismatch",
          `$.portfolioManifest.selectedClaws[${index}]`,
        ),
      );
    }
  }
}

function validateSignedEvidence(input, principals, signers, asOfMs, findings) {
  const recordIds = new Set();
  for (const [envelopeIndex, envelope] of input.evidenceEnvelopes.entries()) {
    const path = `$.evidenceEnvelopes[${envelopeIndex}]`;
    const expectedRole =
      envelope.kind === "usage-evidence"
        ? "usage-evidence-issuer"
        : "issue-evidence-custodian";
    const expectedPurpose =
      envelope.kind === "usage-evidence" ? "usage-evidence" : "owner-evidence";
    const expectedKind = envelope.kind === "usage-evidence" ? "system" : "human";
    if (
      !principalHasRole(
        principals,
        envelope.issuerRef,
        expectedRole,
        expectedKind,
      )
    ) {
      findings.push(finding("invalid-evidence-issuer", `${path}.issuerRef`));
    }
    if (envelope.revision !== computeEvidenceEnvelopeRevision(envelope)) {
      findings.push(finding("invalid-evidence-envelope-revision", `${path}.revision`));
    }
    verifySigned({
      value: envelope,
      payload: signedPayload(envelope),
      purpose: expectedPurpose,
      principalRef: envelope.issuerRef,
      principalKind: expectedKind,
      signedAt: envelope.issuedAt,
      signers,
      path: `${path}.signature`,
      findings,
    });
    const issuedMs = timestamp(envelope.issuedAt);
    if (
      issuedMs === null ||
      issuedMs > asOfMs ||
      !safeSourceReference(envelope.sourceRef)
    ) {
      findings.push(finding("invalid-evidence-envelope", path));
    }
    for (const [recordIndex, record] of envelope.records.entries()) {
      const recordPath = `${path}.records[${recordIndex}]`;
      if (recordIds.has(record.id)) {
        findings.push(finding("duplicate-evidence-identity", `${recordPath}.id`));
      }
      recordIds.add(record.id);
      if (record.revision !== computeEvidenceRecordRevision(record)) {
        findings.push(finding("invalid-evidence-revision", `${recordPath}.revision`));
      }
      const observedMs = timestamp(record.observedAt);
      const validUntilMs = timestamp(record.validUntil);
      if (
        observedMs === null ||
        validUntilMs === null ||
        issuedMs === null ||
        observedMs > issuedMs ||
        observedMs > validUntilMs ||
        (record.kind === "usage-summary" && validUntilMs < asOfMs) ||
        validUntilMs > asOfMs + 366 * 86_400_000 ||
        !safeSourceReference(record.sourceRef)
      ) {
        findings.push(finding("invalid-evidence-chronology", recordPath));
      }
      if (
        record.kind === "usage-summary" &&
        (envelope.kind !== "usage-evidence" ||
          record.tenantRef !== envelope.tenantRef ||
          record.sourceRef !== envelope.sourceRef ||
          !isRecord(record.metrics) ||
          record.metrics.successCount + record.metrics.failureCount >
            record.metrics.eventCount)
      ) {
        findings.push(finding("invalid-usage-record", recordPath));
      }
      if (
        record.kind !== "usage-summary" &&
        (envelope.kind !== "owner-evidence" ||
          record.tenantRef !== null ||
          record.sourceRef !== envelope.sourceRef ||
          record.metrics !== null ||
          record.minimizedFields.length !== 0)
      ) {
        findings.push(finding("invalid-owner-evidence-record", recordPath));
      }
    }
  }
}

function validateGrants(input, principals, signers, asOfMs, findings) {
  for (const [index, grant] of input.grants.entries()) {
    const path = `$.grants[${index}]`;
    const issuer = principals.get(grant.issuerRef);
    const grantee = principals.get(grant.granteeRef);
    const requiredGranteeRole = {
      "portfolio-review": "portfolio-owner",
      "issue-admission-review": "issue-owner",
      "product-decision-review": "product-decision-owner",
      "retirement-review": "retirement-owner",
    }[grant.kind];
    const issuedMs = timestamp(grant.issuedAt);
    const notBeforeMs = timestamp(grant.notBefore);
    const expiresMs = timestamp(grant.expiresAt);
    if (
      issuer?.kind !== "human" ||
      !strings(issuer.roles).includes("grant-issuer") ||
      grantee?.kind !== "human" ||
      !strings(grantee?.roles).includes(requiredGranteeRole) ||
      grant.portfolioRef !== input.portfolioManifest.id ||
      issuedMs === null ||
      notBeforeMs === null ||
      expiresMs === null ||
      issuedMs > notBeforeMs ||
      notBeforeMs > asOfMs ||
      expiresMs < asOfMs ||
      expiresMs <= notBeforeMs
    ) {
      findings.push(finding("invalid-human-grant", path));
    }
    verifySigned({
      value: grant,
      payload: signedPayload(grant),
      purpose: "human-grant",
      principalRef: grant.issuerRef,
      principalKind: "human",
      signedAt: grant.issuedAt,
      signers,
      path: `${path}.signature`,
      findings,
    });
  }
}

function semanticFindings(input, context) {
  const findings = [];
  const asOfMs = timestamp(context.asOf);
  const principals = mapById(input.principals);
  const issues = mapById(input.issues);
  const grants = mapById(input.grants);
  const budgetGrant = grants.get(input.budget.grantRef);
  const allEvidence = evidenceRecords(input);
  const evidenceById = mapById(allEvidence);

  if (
    asOfMs === null ||
    input.run.asOf !== context.asOf ||
    input.run.portfolioManifestRef !== input.portfolioManifest.id ||
    input.run.issueManifestRef !== input.issueManifest.id ||
    input.run.predecessorRef !== input.predecessor.id ||
    input.run.budgetRef !== input.budget.id
  ) {
    findings.push(finding("invalid-run-context", "$.run"));
  }
  if (input.portfolioManifest.catalogRevision !== BASE_CATALOG_REVISION) {
    findings.push(
      finding("unpinned-catalog-revision", "$.portfolioManifest.catalogRevision"),
    );
  }

  const duplicateIdentityValues = duplicateIds([
    input.principals,
    input.grants,
    input.issues,
    input.evidenceEnvelopes,
    allEvidence,
    [
      input.portfolioManifest,
      input.issueManifest,
      input.predecessor,
      input.budget,
    ],
  ]);
  if (duplicateIdentityValues.length > 0) {
    findings.push(finding("duplicate-global-identity", "$"));
  }

  if (
    input.budget.revision !== computeBudgetRevision(input.budget) ||
    input.portfolioManifest.budgetRevision !== input.budget.revision ||
    input.portfolioManifest.principalRoot !==
      computePrincipalRoot(input.principals) ||
    input.portfolioManifest.grantRoot !== computeGrantRoot(input.grants) ||
    input.portfolioManifest.usagePolicyRevision !==
      computeUsagePolicyRevision(input.usagePolicy) ||
    input.budget.ownerRef !== input.portfolioManifest.ownerRef ||
    budgetGrant?.kind !== "portfolio-review" ||
    budgetGrant?.portfolioRef !== input.portfolioManifest.id ||
    budgetGrant?.granteeRef !== input.budget.ownerRef ||
    !sameSet(
      budgetGrant?.issueRefs,
      input.issues.map((item) => item.id),
    ) ||
    !sameSet(budgetGrant?.classifications, CLASSIFICATIONS)
  ) {
    findings.push(finding("invalid-budget-binding", "$.budget"));
  }
  if (
    input.portfolioManifest.revision !==
      computePortfolioManifestRevision(input.portfolioManifest) ||
    input.issueManifest.revision !==
      computeIssueManifestRevision(input.issueManifest) ||
    input.predecessor.revision !==
      computePredecessorRevision(input.predecessor)
  ) {
    findings.push(finding("invalid-revision-seal", "$"));
  }
  if (
    input.portfolioManifest.predecessorRevision !== input.predecessor.revision ||
    input.issueManifest.predecessorRevision !== input.predecessor.revision
  ) {
    findings.push(finding("invalid-predecessor-binding", "$.predecessor"));
  }

  const predecessorMs = timestamp(input.predecessor.capturedAt);
  const portfolioSignedMs = timestamp(input.portfolioManifest.signedAt);
  const issueSignedMs = timestamp(input.issueManifest.signedAt);
  if (
    predecessorMs === null ||
    portfolioSignedMs === null ||
    issueSignedMs === null ||
    predecessorMs >= portfolioSignedMs ||
    predecessorMs >= issueSignedMs ||
    portfolioSignedMs > asOfMs ||
    issueSignedMs > asOfMs ||
    timestamp(context.sourceReceipts.issuedAt) > portfolioSignedMs
  ) {
    findings.push(finding("invalid-manifest-chronology", "$"));
  }

  const issueRoot = computeIssueUniverseRoot(input.issues);
  const issueIds = input.issues.map((item) => item.id);
  const selectedIds = input.portfolioManifest.selectedClaws.map(
    (item) => item.clawId,
  );
  if (
    input.portfolioManifest.issueUniverseRoot !== issueRoot ||
    input.issueManifest.issueUniverseRoot !== issueRoot ||
    !sameSet(input.issueManifest.issueRefs, issueIds) ||
    !sameSet(input.coverage.issueRefs, issueIds) ||
    !sameSet(input.coverage.selectedClawRefs, selectedIds) ||
    !sameSet(input.coverage.grantRefs, input.grants.map((item) => item.id)) ||
    !sameSet(
      input.coverage.evidenceRefs,
      allEvidence.map((item) => item.id),
    ) ||
    !sameSet(
      input.portfolioManifest.grantRefs,
      input.grants.map((item) => item.id),
    )
  ) {
    findings.push(finding("invalid-closed-world-coverage", "$.coverage"));
  }

  const predecessorIssues = new Map(
    input.predecessor.issueRevisions.map((item) => [
      item.issueRef,
      item.revision,
    ]),
  );
  for (const [index, issue] of input.issues.entries()) {
    const path = `$.issues[${index}]`;
    if (
      issue.sourceDigest !== computeIssueSourceDigest(issue) ||
      issue.revision !== computeIssueRevision(issue)
    ) {
      findings.push(finding("invalid-issue-revision", path));
    }
    const previous = predecessorIssues.get(issue.id);
    const openedMs = timestamp(issue.openedAt);
    if (
      (previous === undefined && issue.previousRevision !== null) ||
      (previous !== undefined && issue.previousRevision !== previous)
    ) {
      findings.push(finding("invalid-issue-history", `${path}.previousRevision`));
    }
    if (
      openedMs === null ||
      timestamp(issue.observedAt) === null ||
      openedMs > timestamp(issue.observedAt) ||
      timestamp(issue.observedAt) > issueSignedMs ||
      timestamp(issue.observedAt) <= predecessorMs ||
      (previous !== undefined && openedMs > predecessorMs) ||
      (previous === undefined && openedMs <= predecessorMs)
    ) {
      findings.push(finding("invalid-issue-chronology", path));
    }
    const affectedIds = issue.affectedClaws.map((item) => item.clawId);
    if (new Set(affectedIds).size !== affectedIds.length) {
      findings.push(finding("duplicate-affected-claw", `${path}.affectedClaws`));
    }
    for (const affected of issue.affectedClaws) {
      const selected = input.portfolioManifest.selectedClaws.find(
        (item) => item.clawId === affected.clawId,
      );
      if (!selected || selected.clawRevision !== affected.clawRevision) {
        findings.push(finding("invalid-affected-claw", `${path}.affectedClaws`));
      }
    }
    if (
      issue.evidenceRefs.some((ref) => !evidenceById.has(ref)) ||
      issue.evidenceRefs.some(
        (ref) => evidenceById.get(ref)?.subjectRef !== issue.id,
      ) ||
      issue.evidenceRefs.some(
        (ref) =>
          timestamp(evidenceById.get(ref)?.observedAt) >
          timestamp(issue.observedAt),
      ) ||
      issue.evidenceRefs.some(
        (ref) => evidenceById.get(ref)?.kind === "usage-summary",
      )
    ) {
      findings.push(finding("invalid-issue-evidence-binding", `${path}.evidenceRefs`));
    }
    if (
      issue.evidenceRefs.some(
        (ref) =>
          timestamp(evidenceById.get(ref)?.observedAt) >
          timestamp(issue.observedAt),
      )
    ) {
      findings.push(
        finding(
          "evidence-after-issue-snapshot",
          `${path}.evidenceBindings`,
        ),
      );
    }
    if (
      !sameSet(
        issue.evidenceRefs,
        records(issue.evidenceBindings).map((item) => item.evidenceRef),
      ) ||
      records(issue.evidenceBindings).some(
        (binding) =>
          evidenceById.get(binding.evidenceRef)?.revision !==
          binding.evidenceRevision,
      )
    ) {
      findings.push(
        finding(
          "invalid-issue-evidence-revision-binding",
          `${path}.evidenceBindings`,
        ),
      );
    }
    if (
      issue.evidenceRefs.some(
        (ref) => evidenceById.get(ref)?.kind === "usage-summary",
      ) ||
      issue.signals.conflictingEvidenceRefs.some(
        (ref) => evidenceById.get(ref)?.kind === "usage-summary",
      )
    ) {
      findings.push(
        finding(
          "usage-evidence-cannot-drive-admission",
          `${path}.evidenceRefs`,
        ),
      );
    }
    if (
      issue.signals.conflictingEvidenceRefs.some(
        (ref) => !issue.evidenceRefs.includes(ref),
      ) ||
      (issue.signals.conflictingEvidenceRefs.length > 0 &&
        !issueHasConflict(issue, evidenceById))
    ) {
      findings.push(
        finding(
          "invalid-conflicting-evidence",
          `${path}.signals.conflictingEvidenceRefs`,
        ),
      );
    }
    if (
      issue.signals.duplicateOfIssueRef !== null &&
      (!issues.has(issue.signals.duplicateOfIssueRef) ||
        issue.signals.duplicateOfIssueRef === issue.id ||
        issues.get(issue.signals.duplicateOfIssueRef)?.signals
          .duplicateOfIssueRef !== null)
    ) {
      findings.push(
        finding("invalid-duplicate-reference", `${path}.signals.duplicateOfIssueRef`),
      );
    }
    if (
      issue.signals.compositionClawRefs.some(
        (ref) => !selectedIds.includes(ref),
      )
    ) {
      findings.push(
        finding(
          "invalid-composition-reference",
          `${path}.signals.compositionClawRefs`,
        ),
      );
    }
    if (
      (issue.signals.sameRepeatableJob &&
        issue.affectedClaws.length === 0) ||
      (issue.signals.compositionPreservesJob &&
        issue.signals.compositionClawRefs.length < 2) ||
      (issue.signals.retirementSignal &&
        issue.affectedClaws.length === 0) ||
      classificationFor(issue) === null
    ) {
      findings.push(
        finding(
          "incomplete-classification-signal",
          `${path}.signals`,
        ),
      );
    }
    if (classificationBasisCount(issue) > 1) {
      findings.push(finding("ambiguous-classification-signals", `${path}.signals`));
    }
    const classification = classificationFor(issue);
    const expectedDemand = expectedDemandShape(classification);
    if (
      issue.demand.candidateSlots !== expectedDemand.candidateSlots ||
      issue.demand.admissionSlots !== expectedDemand.admissionSlots ||
      (expectedDemand.admissionSlots === 0 &&
        (issue.demand.workUnits !== 0 ||
          issue.demand.costMicros !== 0 ||
          issue.demand.durationMinutes !== 0))
    ) {
      findings.push(finding("invalid-budget-demand", `${path}.demand`));
    }
  }

  if (
    !sameSet(
      input.predecessor.issueRevisions.map((item) => item.issueRef),
      input.issues
        .filter((item) => item.previousRevision !== null)
        .map((item) => item.id),
    ) ||
    new Set(input.predecessor.issueRevisions.map((item) => item.issueRef)).size !==
      input.predecessor.issueRevisions.length
  ) {
    findings.push(finding("invalid-predecessor-coverage", "$.predecessor.issueRevisions"));
  }

  validateGrants(input, principals, context.signers, asOfMs, findings);
  validateSignedEvidence(input, principals, context.signers, asOfMs, findings);

  const referencedOwnerEvidence = new Set(
    input.issues.flatMap((issue) => issue.evidenceRefs),
  );
  for (const evidence of allEvidence) {
    const isUsage = evidence.kind === "usage-summary";
    if (!isUsage && !referencedOwnerEvidence.has(evidence.id)) {
      findings.push(finding("orphan-owner-evidence", "$.evidenceEnvelopes"));
    }
    if (isUsage) {
      if (
        !issues.has(evidence.subjectRef) ||
        !input.usagePolicy.enabled ||
        !input.usagePolicy.allowedTenantRefs.includes(evidence.tenantRef) ||
        !input.usagePolicy.allowedSourceRefs.includes(evidence.sourceRef) ||
        evidence.minimizedFields.length > input.usagePolicy.maxMinimizedFields ||
        !sameSet(evidence.minimizedFields, [
          "event-count",
          "failure-count",
          "success-count",
        ])
      ) {
        findings.push(finding("usage-policy-violation", "$.evidenceEnvelopes"));
      }
      if (!issues.has(evidence.subjectRef)) {
        findings.push(
          finding(
            "usage-subject-outside-issue-universe",
            "$.evidenceEnvelopes",
          ),
        );
      }
    }
  }
  const usageCount = allEvidence.filter(
    (item) => item.kind === "usage-summary",
  ).length;
  if (usageCount > input.usagePolicy.maxRecords) {
    findings.push(finding("usage-record-limit", "$.usagePolicy.maxRecords"));
  }

  const knownSourceRefs = new Set([
    ...input.evidenceEnvelopes.map((item) => item.sourceRef),
    ...allEvidence.map((item) => item.sourceRef),
  ]);
  if ([...knownSourceRefs].some((value) => !safeSourceReference(value))) {
    findings.push(finding("unsafe-source-reference", "$.evidenceEnvelopes"));
  }
  if (
    containsCredentialMaterial(input) ||
    containsCredentialMaterial(context.publicTrust) ||
    containsCredentialMaterial(context.sourceReceipts)
  ) {
    findings.push(finding("private-or-credential-material", "$"));
  }
  if (
    canonicalJson(input.authority) !== canonicalJson(AUTHORITY_NON_CLAIMS)
  ) {
    findings.push(finding("prohibited-authority-contract", "$.authority"));
  }

  const grantChecks = [
    [
      input.portfolioManifest,
      "portfolio-manifest",
      input.portfolioManifest.ownerRef,
      input.portfolioManifest.signedAt,
      "portfolio-owner",
      "human",
      "$.portfolioManifest",
    ],
    [
      input.issueManifest,
      "issue-manifest",
      input.issueManifest.ownerRef,
      input.issueManifest.signedAt,
      "issue-owner",
      "human",
      "$.issueManifest",
    ],
    [
      input.predecessor,
      "predecessor-checkpoint",
      input.predecessor.ownerRef,
      input.predecessor.capturedAt,
      "portfolio-owner",
      "human",
      "$.predecessor",
    ],
  ];
  for (const [
    value,
    purpose,
    principalRef,
    signedAt,
    role,
    kind,
    path,
  ] of grantChecks) {
    if (!principalHasRole(principals, principalRef, role, kind)) {
      findings.push(finding("invalid-owner-authority", `${path}.ownerRef`));
    }
    verifySigned({
      value,
      payload: signedPayload(value),
      purpose,
      principalRef,
      principalKind: kind,
      signedAt,
      signers: context.signers,
      path: `${path}.signature`,
      findings,
    });
  }

  for (const issue of input.issues) {
    const classification = classificationFor(issue);
    const kind =
      classification === "PRODUCT_DECISION"
        ? "product-decision-review"
        : classification === "RETIRE"
          ? "retirement-review"
          : "issue-admission-review";
    const matches = applicableGrants(
      input.grants,
      issue,
      classification,
      kind,
    );
    if (matches.length === 0) {
      findings.push(finding("missing-exact-human-grant", `$.issues.${issue.id}`));
    } else if (matches.length > 1) {
      findings.push(
        finding("ambiguous-human-grant", `$.issues.${issue.id}`),
      );
    }
  }

  return uniqueFindings(findings);
}

function deriveUsageEffects(input, evidence, asOf = input.run.asOf) {
  if (!input.usagePolicy.enabled) return [];
  const asOfMs = timestamp(asOf);
  const mayReprioritize = input.usagePolicy.allowedEffects.includes(
    "reprioritize-existing-issue",
  );
  const mayCreateDraft =
    input.usagePolicy.allowedEffects.includes("create-draft-issue");
  return evidence
    .filter((item) => item.kind === "usage-summary")
    .filter(
      (item) =>
        asOfMs !== null &&
        timestamp(item.observedAt) <= asOfMs &&
        timestamp(item.validUntil) >= asOfMs,
    )
    .filter((item) =>
      input.issues.some((candidate) => candidate.id === item.subjectRef),
    )
    .flatMap((item) => {
      const issue = input.issues.find((candidate) => candidate.id === item.subjectRef);
      const effects = [];
      if (mayReprioritize) {
        const delta = item.metrics.failureCount > 0 ? 1 : 0;
        effects.push({
          evidenceRef: item.id,
          issueRef: item.subjectRef,
          effect: "reprioritize-existing-issue",
          basePriority: issue.basePriority,
          advisoryPriority: Math.min(100, issue.basePriority + delta),
          classificationChanged: false,
          productionMutation: false,
        });
      }
      if (mayCreateDraft) {
        effects.push({
          evidenceRef: item.id,
          sourceIssueRef: item.subjectRef,
          proposedIssueRef: `draft-usage-followup-${item.id}`,
          effect: "create-draft-issue",
          affectedClaws: issue.affectedClaws.map((item) => ({ ...item })),
          requiresOwnerAdmission: true,
          classificationChanged: false,
          productionMutation: false,
        });
      }
      return effects;
    })
    .sort((left, right) =>
      compareText(
        `${left.issueRef ?? left.sourceIssueRef}\0${left.effect}`,
        `${right.issueRef ?? right.sourceIssueRef}\0${right.effect}`,
      ),
    );
}

function resultFor(input, asOf) {
  const allEvidence = evidenceRecords(input);
  const evidenceById = mapById(allEvidence);
  const asOfMs = timestamp(asOf);
  const used = {
    candidateCount: 0,
    admissions: 0,
    workUnits: 0,
    costMicros: 0,
    durationMinutes: 0,
  };
  const limits = {
    candidateCount: input.budget.maxCandidateCount,
    admissions: input.budget.maxAdmissions,
    workUnits: input.budget.maxWorkUnits,
    costMicros: input.budget.maxCostMicros,
    durationMinutes: input.budget.maxDurationMinutes,
  };
  const outcomes = new Map();

  const allocationOrder = [...input.issues].sort(
    (left, right) =>
      right.basePriority - left.basePriority ||
      compareText(left.id, right.id),
  );
  for (const issue of allocationOrder) {
    const classification = classificationFor(issue);
    const stale = issueIsStale(issue, evidenceById, asOfMs);
    const conflict = issue.signals.conflictingEvidenceRefs.length > 0;
    const rationale = [];
    let state;
    let plan = null;
    let exceeded = [];
    let prHandoff =
      classification === "VARIANT"
        ? "outside-curated-catalog"
        : "draft-or-pr-ready-plan-only";

    if (
      classification === "UNSUPPORTED" &&
      issue.requestedAuthority.length > 0
    ) {
      state = "blocked-authority";
      rationale.push("prohibited-authority-request");
    } else if (stale) {
      state = "blocked-stale-evidence";
      rationale.push("evidence-outside-freshness-window");
    } else if (classification === "DUPLICATE") {
      state = "owner-action-required";
      rationale.push("exact-duplicate-reference");
    } else if (classification === "UNSUPPORTED") {
      state = "unsupported";
      rationale.push("outside-catalog-contract");
    } else if (conflict) {
      state = "blocked-conflicting-evidence";
      rationale.push("independent-evidence-conflict");
    } else if (classification === "PRODUCT_DECISION") {
      state = "owner-decision-required";
      rationale.push("catalog-direction-owner-decision");
    } else if (classification === "RETIRE") {
      state = "owner-decision-required";
      rationale.push("retirement-owner-decision");
    } else if (classification === "VARIANT") {
      state = "variant-outside-catalog";
      rationale.push("not-curated-catalog-material");
      prHandoff = "outside-curated-catalog";
    } else {
      const demand = {
        candidateCount: issue.demand.candidateSlots,
        admissions: issue.demand.admissionSlots,
        workUnits: issue.demand.workUnits,
        costMicros: issue.demand.costMicros,
        durationMinutes: issue.demand.durationMinutes,
      };
      exceeded = Object.keys(limits).filter(
        (key) => used[key] + demand[key] > limits[key],
      );
      if (exceeded.length > 0) {
        state = "blocked-budget";
        rationale.push("owner-budget-cap");
      } else {
        state = "plan-ready";
        for (const key of Object.keys(used)) used[key] += demand[key];
        rationale.push(
          classification === "NEW"
            ? "distinct-operating-contract"
            : classification === "IMPROVE"
              ? "existing-job-preserved"
              : classification === "COMPOSE"
                ? "composition-preserves-job"
                : "presentation-or-context-variant",
        );
        plan = {
          kind: {
            NEW: "candidate-plan",
            IMPROVE: "improvement-plan",
            COMPOSE: "composition-plan",
            VARIANT: "variant-plan",
          }[classification],
          issueRef: issue.id,
          affectedClaws: issue.affectedClaws.map((item) => ({ ...item })),
          compositionClawRefs: sortedStrings(
            issue.signals.compositionClawRefs,
          ),
          handoff: "owner-decision-or-draft-pr",
          branchMutation: false,
          productionMutation: false,
        };
      }
    }

    const grantKind =
      classification === "PRODUCT_DECISION"
        ? "product-decision-review"
        : classification === "RETIRE"
          ? "retirement-review"
          : "issue-admission-review";
    const [grant] = applicableGrants(
      input.grants,
      issue,
      classification,
      grantKind,
    );
    outcomes.set(issue.id, {
      issueRef: issue.id,
      issueRevision: issue.revision,
      classification,
      state,
      rationale,
      evidenceRefs: [...issue.evidenceRefs],
      evidenceLinks: issue.evidenceBindings.map((item) => ({ ...item })),
      affectedClaws: issue.affectedClaws.map((item) => ({ ...item })),
      plan,
      blockedBudgetDimensions: exceeded,
      ownerHandoff: {
        grantRef: grant.id,
        granteeRef: grant.granteeRef,
        decisionRequired: state !== "plan-ready",
        prHandoff,
        externalMutation: false,
      },
    });
  }

  const issueResults = input.issueManifest.issueRefs.map((ref) => outcomes.get(ref));
  const classifications = issueResults.map((item) => item.classification);
  const usageRecords = allEvidence.filter(
    (item) => item.kind === "usage-summary",
  );
  const effects = deriveUsageEffects(input, allEvidence);
  const result = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    resultStatus: issueResults.some((item) => item.state.startsWith("blocked-"))
      ? "blocked-owner-handoff"
      : "ready-for-owner-review",
    run: {
      id: input.run.id,
      asOf,
      portfolioManifestRef: input.portfolioManifest.id,
      portfolioRevision: input.portfolioManifest.revision,
      issueManifestRef: input.issueManifest.id,
      issueManifestRevision: input.issueManifest.revision,
      predecessorRef: input.predecessor.id,
      predecessorRevision: input.predecessor.revision,
    },
    portfolio: {
      selectedClaws: input.portfolioManifest.selectedClaws.map((item) => ({
        clawId: item.clawId,
        clawRevision: item.clawRevision,
        sourceReceiptRef: item.sourceReceiptRef,
      })),
      exactCoverage: true,
      productionMutation: false,
    },
    issues: issueResults,
    budget: {
      budgetRef: input.budget.id,
      budgetRevision: input.budget.revision,
      limits,
      used,
      withinCaps: Object.keys(limits).every((key) => used[key] <= limits[key]),
      increaseAllowed: false,
    },
    usage: {
      supplied: usageRecords.length > 0,
      effects,
      classificationAuthority: false,
      correctnessOrSafetyOverride: false,
      productionMutation: false,
    },
    antiCountIncentives: {
      rawClawCountObjective: false,
      newClassifiedCount: classifications.filter((item) => item === "NEW").length,
      acceptedNewCandidateCount: issueResults.filter(
        (item) =>
          item.classification === "NEW" && item.state === "plan-ready",
      ).length,
      improveOrComposeCount: classifications.filter((item) =>
        ["IMPROVE", "COMPOSE"].includes(item),
      ).length,
      avoidedNewCount: classifications.filter((item) =>
        ["IMPROVE", "COMPOSE", "VARIANT", "DUPLICATE"].includes(item),
      ).length,
      composeFirstSatisfied: issueResults.some(
        (item) =>
          item.classification === "COMPOSE" && item.state === "plan-ready",
      ),
    },
    authority: { ...AUTHORITY_NON_CLAIMS },
    findings: [],
  };
  return {
    ...result,
    resultDigest: sha256Digest(result),
  };
}

export async function evaluateClawPortfolio(input, options = {}) {
  const normalizedInput = normalize(input, CANDIDATE_LIMITS.inputBytes);
  if (!normalizedInput.ok) {
    return invalidResult([
      finding("unsafe-or-oversized-input", `$.input#${normalizedInput.code}`),
    ]);
  }
  const normalizedAsOf = normalize(
    options.asOf,
    CANDIDATE_LIMITS.maxStringLength,
  );
  const normalizedPublicTrust = normalize(
    options.publicTrust,
    CANDIDATE_LIMITS.publicTrustBytes,
  );
  const normalizedSourceReceipts = normalize(
    options.sourceReceipts,
    CANDIDATE_LIMITS.sourceReceiptsBytes,
  );
  if (
    !normalizedAsOf.ok ||
    !normalizedPublicTrust.ok ||
    !normalizedSourceReceipts.ok
  ) {
    return invalidResult([
      finding(
        "unsafe-or-oversized-validation-context",
        `$.validationContext#${
          normalizedAsOf.code ??
          normalizedPublicTrust.code ??
          normalizedSourceReceipts.code
        }`,
      ),
    ]);
  }
  const candidate = normalizedInput.value;
  const context = {
    asOf: normalizedAsOf.value,
    publicTrust: normalizedPublicTrust.value,
    sourceReceipts: normalizedSourceReceipts.value,
  };
  const findings = schemaFindings(validateCandidateSchema, candidate, "$");
  const signers = validateTrustStore(context.publicTrust, findings);
  context.signers = signers;
  if (
    isRecord(candidate) &&
    candidate.schemaVersion === CANDIDATE_SCHEMA_VERSION &&
    validateCandidateSchema(candidate) &&
    validatePublicTrustSchema(context.publicTrust) &&
    isRecord(context.sourceReceipts)
  ) {
    await catalogSourceFindings(
      candidate,
      context.sourceReceipts,
      signers,
      findings,
    );
    findings.push(...semanticFindings(candidate, context));
  }
  const unique = uniqueFindings(findings);
  return unique.length > 0
    ? invalidResult(unique)
    : resultFor(candidate, context.asOf);
}

function candidateProposal() {
  return {
    schemaVersion: 1,
    entry: {
      id: "claw-portfolio-manager",
      name: "Claw Portfolio Manager",
      category: "engineering",
      maintenance: {
        status: "active",
        maintainers: ["@giodl73-repo"],
        lastVerified: "2026-09-17",
      },
      description:
        "Stewards an owner-authenticated Claw portfolio and exact issue queue into compose-first, evidence-backed, budget-bounded candidate and owner-decision plans without mutating production Claws or assuming publication authority.",
      audience:
        "Claw catalog owners and repository maintainers managing a bounded portfolio over time.",
      principles: [
        "Keep owner manifests and source systems authoritative",
        "Prefer improvement and composition before new Claw count",
        "Bind every proposal to exact source and issue revisions",
      ],
      boundaries: [
        "Do not merge, publish, mutate production Claws, increase budget, accept risk, or grant authority",
        "Do not infer sensitive personal facts or let optional usage evidence override correctness or safety",
        "Do not omit a selected Claw or issue from an authenticated closed-world manifest",
      ],
      intake: [
        "Signed portfolio and issue manifests with exact source bytes and revisions",
        "Exact issue queue, predecessor, evidence, typed human grants, and caller time",
        "Exact candidate, admission, work, cost, and duration budgets",
      ],
      workflow: [
        "Authenticate and reconcile the closed portfolio and issue universe",
        "Validate immutable source, issue, evidence, and predecessor lineage",
        "Classify every issue with compose-first admission semantics",
        "Allocate only within exact owner budgets and produce owner handoffs",
      ],
      deliverables: [
        "Exact issue classification ledger",
        "Evidence and affected-Claw bindings",
        "Candidate, improvement, composition, or owner-decision plan",
        "Budget and blocked-state ledger",
      ],
      example: {
        request:
          "Reconcile this signed Claw portfolio and issue queue into bounded proposals without changing production.",
        outcome:
          "A complete source-bound classification, budget, and owner-handoff ledger.",
      },
      doneWhen: [
        "Every selected Claw and issue is covered exactly once",
        "Every accepted plan fits every budget dimension",
        "Every consequential action remains owner-controlled",
      ],
      capabilityGuidance: [
        "The candidate has read-only repository evidence and local proposal output only.",
        "Any future issue writing or draft branch capability requires separate explicit installation and receipt proof.",
      ],
      resources: [],
    },
    contribution: {
      problem:
        "Claw owners currently join catalog, issue, evidence, and budget state manually and cannot prove a complete compose-first portfolio decision.",
      repeatableJob:
        "Reconcile one signed Claw subset and exact issue queue into bounded evidence-backed proposals and owner decisions.",
      proofPlan:
        "Execute authenticated source, issue, budget, usage, classification, composition, and authority invariants over one closed fixture.",
      existingAlternatives: [
        {
          id: "benefits-realization-manager",
          overlap:
            "Both maintain an evidence-backed portfolio and preserve outcome attribution.",
          difference:
            "Benefits Realization Manager reconciles approved initiative benefit claims, not Claw admission and catalog lifecycle issues.",
        },
        {
          id: "incident-response",
          overlap:
            "Both preserve exact evidence, blockers, owners, and revision-bound operational handoffs.",
          difference:
            "Incident Response coordinates one active incident rather than a recurring Claw portfolio and admission queue.",
        },
        {
          id: "release-coordinator",
          overlap:
            "Both bind evidence and owner approvals into a repository-facing readiness handoff.",
          difference:
            "Release Coordinator decides readiness for one release candidate rather than classifying and budgeting Claw portfolio work.",
        },
        {
          id: "data-migration-planner",
          overlap:
            "Both produce evidence-backed, budget-aware plans with blockers and owner decisions.",
          difference:
            "Data Migration Planner owns one migration mapping and cutover plan, not catalog admission or issue lifecycle.",
        },
        {
          id: "repository-operations-manager",
          overlap:
            "Both reconcile a revision-bound repository portfolio and preserve owner authority.",
          difference:
            "Repository Operations Manager tracks pull requests and releases, not Claw admission classifications and candidate budgets.",
        },
        {
          id: "repository-compliance-program-manager",
          overlap:
            "Both reconcile an exact issue universe with typed evidence and owner controls.",
          difference:
            "Repository Compliance Program Manager tracks remediation obligations and may execute bounded issue writes, not Claw portfolio admission.",
        },
        {
          id: "work-chief-of-staff",
          overlap:
            "Both compose specialist Claw artifacts under portfolio constraints.",
          difference:
            "Work Chief of Staff coordinates operating commitments, not catalog lifecycle and admission decisions.",
        },
        {
          id: "product-manager",
          overlap:
            "Both preserve product decisions, alternatives, evidence, and validation budgets.",
          difference:
            "Product Manager handles one product decision rather than a closed issue and Claw portfolio.",
        },
        {
          id: "software-maintainer",
          overlap:
            "Both produce revision-bound draft or PR-ready repository handoffs.",
          difference:
            "Software Maintainer implements one approved change while this candidate never changes code or production Claws.",
        },
      ],
    },
  };
}

function requiredCompositionFacts(input, result) {
  const portfolioFact = {
    selectedClaws: result.portfolio.selectedClaws,
    portfolioRevision: result.run.portfolioRevision,
  };
  const issueFact = {
    resultStatus: result.resultStatus,
    issues: result.issues.map((item) => ({
      issueRef: item.issueRef,
      issueRevision: item.issueRevision,
      classification: item.classification,
      state: item.state,
      rationale: item.rationale,
      evidenceRefs: item.evidenceRefs,
      evidenceLinks: item.evidenceLinks,
      affectedClaws: item.affectedClaws,
      plan: item.plan,
      blockedBudgetDimensions: item.blockedBudgetDimensions,
      ownerHandoff: item.ownerHandoff,
    })),
  };
  return [
    {
      id: "closed-claw-source-coverage",
      valueDigest: sha256Digest(portfolioFact),
    },
    {
      id: "closed-issue-admission-coverage",
      valueDigest: sha256Digest(issueFact),
    },
    {
      id: "multi-axis-owner-budget",
      valueDigest: sha256Digest(result.budget),
    },
    {
      id: "advisory-usage-isolation",
      valueDigest: sha256Digest({
        usage: result.usage,
        classifications: result.issues.map((item) => ({
          issueRef: item.issueRef,
          classification: item.classification,
        })),
      }),
    },
    {
      id: "proposal-only-authority",
      valueDigest: sha256Digest(result.authority),
    },
    {
      id: "immutable-predecessor-lineage",
      valueDigest: sha256Digest({
        predecessorRevision: result.run.predecessorRevision,
        issueRevisions: input.predecessor.issueRevisions,
      }),
    },
  ];
}

function currentCompositionFacts({
  repositoryOperationsArtifact,
  repositoryComplianceArtifact,
}) {
  const repositoryNonClaims =
    repositoryOperationsArtifact.handoff?.published !== true &&
    repositoryOperationsArtifact.handoff?.mutationApplied !== true;
  const complianceNonClaims =
    repositoryComplianceArtifact.authority?.codeChange === "not-claimed" &&
    repositoryComplianceArtifact.authority?.riskAcceptance === "not-claimed" &&
    repositoryComplianceArtifact.authority?.issueClosure === "not-claimed" &&
    repositoryComplianceArtifact.authority?.issueMutation === "not-claimed";
  return [
    {
      id: "proposal-only-authority",
      valueDigest:
        repositoryNonClaims && complianceNonClaims
          ? sha256Digest(AUTHORITY_NON_CLAIMS)
          : sha256Digest({ unsafe: true }),
    },
  ];
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function parseCompositionSourceArtifact(sourceArtifact) {
  if (
    !exactKeys(sourceArtifact, ["id", "digest", "bytesBase64"]) ||
    typeof sourceArtifact.id !== "string"
  ) {
    return null;
  }
  const bytes = strictBase64(sourceArtifact.bytesBase64);
  if (
    !bytes ||
    bytes.length === 0 ||
    bytes.length > CANDIDATE_LIMITS.compositionProofBytes ||
    sha256Bytes(bytes) !== sourceArtifact.digest
  ) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  const normalized = normalize(parsed, CANDIDATE_LIMITS.compositionProofBytes);
  if (
    !normalized.ok ||
    canonicalJson(normalized.value) !== bytes.toString("utf8") ||
    normalized.value.artifactId !== sourceArtifact.id
  ) {
    return null;
  }
  return normalized.value;
}

function compositionFactsFromSources(sourceArtifacts) {
  if (
    !Array.isArray(sourceArtifacts) ||
    sourceArtifacts.length !== 2 ||
    new Set(sourceArtifacts.map((item) => item?.id)).size !== 2
  ) {
    return null;
  }
  const parsed = sourceArtifacts.map(parseCompositionSourceArtifact);
  if (parsed.some((item) => item === null)) return null;
  const portfolio = parsed.find((item) => item.kind === "portfolio-lineage");
  const admission = parsed.find((item) => item.kind === "issue-admission");
  if (
    !exactKeys(portfolio, [
      "schemaVersion",
      "artifactId",
      "kind",
      "selectedClaws",
      "portfolioRevision",
      "predecessorRevision",
      "issueRevisions",
      "authority",
    ]) ||
    portfolio.schemaVersion !==
      "awesomeClaws.clawPortfolioManagerCompositionSource.v1" ||
    !Array.isArray(portfolio.selectedClaws) ||
    !Array.isArray(portfolio.issueRevisions) ||
    canonicalJson(portfolio.authority) !== canonicalJson(AUTHORITY_NON_CLAIMS) ||
    !exactKeys(admission, [
      "schemaVersion",
      "artifactId",
      "kind",
      "resultStatus",
      "issues",
      "budget",
      "usage",
    ]) ||
    admission.schemaVersion !==
      "awesomeClaws.clawPortfolioManagerCompositionSource.v1" ||
    !Array.isArray(admission.issues) ||
    !isRecord(admission.budget) ||
    !isRecord(admission.usage)
  ) {
    return null;
  }
  const issueFact = {
    resultStatus: admission.resultStatus,
    issues: admission.issues.map((item) => ({
      issueRef: item.issueRef,
      issueRevision: item.issueRevision,
      classification: item.classification,
      state: item.state,
      rationale: item.rationale,
      evidenceRefs: item.evidenceRefs,
      evidenceLinks: item.evidenceLinks,
      affectedClaws: item.affectedClaws,
      plan: item.plan,
      blockedBudgetDimensions: item.blockedBudgetDimensions,
      ownerHandoff: item.ownerHandoff,
    })),
  };
  if (
    portfolio.selectedClaws.length === 0 ||
    portfolio.issueRevisions.length === 0 ||
    admission.issues.length === 0 ||
    new Set(portfolio.selectedClaws.map((item) => item.clawId)).size !==
      portfolio.selectedClaws.length ||
    new Set(portfolio.issueRevisions.map((item) => item.issueRef)).size !==
      portfolio.issueRevisions.length ||
    new Set(admission.issues.map((item) => item.issueRef)).size !==
      admission.issues.length ||
    admission.issues.some(
      (item) =>
        !exactKeys(item, [
          "issueRef",
          "issueRevision",
          "classification",
          "state",
          "rationale",
          "evidenceRefs",
          "evidenceLinks",
          "affectedClaws",
          "plan",
          "blockedBudgetDimensions",
          "ownerHandoff",
        ]) ||
        !CLASSIFICATIONS.includes(item.classification) ||
        !Array.isArray(item.rationale) ||
        !Array.isArray(item.evidenceRefs) ||
        !Array.isArray(item.evidenceLinks) ||
        !Array.isArray(item.affectedClaws) ||
        !Array.isArray(item.blockedBudgetDimensions) ||
        !isRecord(item.ownerHandoff),
    )
  ) {
    return null;
  }
  return [
    {
      id: "closed-claw-source-coverage",
      valueDigest: sha256Digest({
        selectedClaws: portfolio.selectedClaws,
        portfolioRevision: portfolio.portfolioRevision,
      }),
    },
    {
      id: "closed-issue-admission-coverage",
      valueDigest: sha256Digest(issueFact),
    },
    {
      id: "multi-axis-owner-budget",
      valueDigest: sha256Digest(admission.budget),
    },
    {
      id: "advisory-usage-isolation",
      valueDigest: sha256Digest({
        usage: admission.usage,
        classifications: admission.issues.map((item) => ({
          issueRef: item.issueRef,
          classification: item.classification,
        })),
      }),
    },
    {
      id: "proposal-only-authority",
      valueDigest: sha256Digest(portfolio.authority),
    },
    {
      id: "immutable-predecessor-lineage",
      valueDigest: sha256Digest({
        predecessorRevision: portfolio.predecessorRevision,
        issueRevisions: portfolio.issueRevisions,
      }),
    },
  ];
}

function compositionSourceArtifact(value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  return {
    id: value.artifactId,
    digest: sha256Bytes(bytes),
    bytesBase64: bytes.toString("base64"),
  };
}

export function createFutureCompositionSourceArtifacts(input, result) {
  return [
    compositionSourceArtifact({
      schemaVersion:
        "awesomeClaws.clawPortfolioManagerCompositionSource.v1",
      artifactId: "future-portfolio-lineage",
      kind: "portfolio-lineage",
      selectedClaws: result.portfolio.selectedClaws,
      portfolioRevision: result.run.portfolioRevision,
      predecessorRevision: result.run.predecessorRevision,
      issueRevisions: input.predecessor.issueRevisions,
      authority: result.authority,
    }),
    compositionSourceArtifact({
      schemaVersion:
        "awesomeClaws.clawPortfolioManagerCompositionSource.v1",
      artifactId: "future-issue-admission",
      kind: "issue-admission",
      resultStatus: result.resultStatus,
      issues: result.issues.map((item) => ({
        issueRef: item.issueRef,
        issueRevision: item.issueRevision,
        classification: item.classification,
        state: item.state,
        rationale: item.rationale,
        evidenceRefs: item.evidenceRefs,
        evidenceLinks: item.evidenceLinks,
        affectedClaws: item.affectedClaws,
        plan: item.plan,
        blockedBudgetDimensions: item.blockedBudgetDimensions,
        ownerHandoff: item.ownerHandoff,
      })),
      budget: result.budget,
      usage: result.usage,
    }),
  ];
}

async function pinnedAnalogueStatus() {
  const records = [];
  for (const [relativePath, expectedDigest] of Object.entries(
    PINNED_ANALOGUE_FILES,
  )) {
    const bytes = await readFile(join(root, ...relativePath.split("/")));
    records.push({
      path: relativePath,
      expectedDigest,
      observedDigest: sha256Bytes(bytes),
      valid: sha256Bytes(bytes) === expectedDigest,
    });
  }
  return records;
}

async function executeActualAnalogueProof(asOf) {
  const pins = await pinnedAnalogueStatus();
  const [
    catalog,
    experienceCases,
    regressionRegistry,
    mockContext,
    runtimeProfile,
  ] = await Promise.all([
    readCatalog({ loadResources: false }),
    readCatalog({ loadResources: false }).then((value) =>
      readExperienceCases(value),
    ),
    readRegressionCases(),
    loadMockPlusContext(),
    readRuntimeProfile(),
  ]);
  const analogueIds = [
    "repository-operations-manager",
    "repository-compliance-program-manager",
    "work-chief-of-staff",
    "product-manager",
    "software-maintainer",
  ];
  const entries = catalog.entries.filter((entry) =>
    analogueIds.includes(entry.id),
  );
  const contributions = (
    await Promise.all(
    entries.map((entry) =>
      readFile(join(root, "contributions", `${entry.id}.json`), "utf8").then(
        JSON.parse,
        () => null,
      ),
    ),
    )
  ).filter(Boolean);
  const selectedExperience = experienceCases.filter((item) =>
    analogueIds.includes(item.id),
  );
  const selectedRegression = regressionRegistry.cases.filter((item) =>
    analogueIds.includes(item.id),
  );
  const quality = await buildCatalogQualityScorecard({
    catalog: { entries },
    contributions,
    experienceCases: selectedExperience,
    regressionCases: selectedRegression,
    asOf: asOf.slice(0, 10),
  });
  const regression = await runRepositoryRegressionCases({
    onlyIds: analogueIds,
  });
  const runtimeScenarios = selectedRegression.map((contract) => ({
    id: contract.id,
    scenarios: buildScenarios(contract).map((item) => item.scenarioType),
  }));
  const runtimeBudget = preflightBudgets({
    mode: "mock",
    selectedTrialCount: selectedRegression.length * 3,
    catalogClawCount: catalog.entries.length,
    limits: {
      concurrency: 1,
      trialTimeoutMs: 120_000,
      cleanupTimeoutMs: 30_000,
      infrastructureRetries: 0,
      maxInputTokensPerTrial: 1,
      maxOutputTokensPerTrial: 1,
      maxTotalTokens: selectedRegression.length * 3 * 2,
      maxUsd: null,
    },
    pricing: {
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
    },
  });
  const proposal = candidateProposal();
  const proposalErrors = validateContributionProposal(
    proposal,
    catalog.entries,
  );
  const similarity = contributionSimilarityReport(
    proposal.entry,
    catalog.entries,
  );

  const repositoryOperationsSchema = JSON.parse(
    await readFile(
      join(
        root,
        "sources",
        "repository-operations-manager",
        "schemas",
        "repository-operations.schema.json",
      ),
      "utf8",
    ),
  );
  const repositoryOperationsArtifact = JSON.parse(
    await readFile(
      join(
        root,
        "sources",
        "repository-operations-manager",
        "fixtures",
        "repository-operations.example.json",
      ),
      "utf8",
    ),
  );
  const repositoryComplianceSchema = JSON.parse(
    await readFile(
      join(
        root,
        "sources",
        "repository-compliance-program-manager",
        "schemas",
        "repository-compliance-program.schema.json",
      ),
      "utf8",
    ),
  );
  const repositoryComplianceArtifact = JSON.parse(
    await readFile(
      join(
        root,
        "sources",
        "repository-compliance-program-manager",
        "fixtures",
        "repository-compliance-program.example.json",
      ),
      "utf8",
    ),
  );
  const analogueAjv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(analogueAjv);
  const validateRepositoryOperations = analogueAjv.compile(
    repositoryOperationsSchema,
  );
  const validateRepositoryCompliance = analogueAjv.compile(
    repositoryComplianceSchema,
  );
  const repositoryOperationsValid =
    validateRepositoryOperations(repositoryOperationsArtifact) &&
    repositoryOperationsFindings(repositoryOperationsArtifact, {
      asOf: repositoryOperationsArtifact.run.asOf,
    }).length === 0;
  const repositoryComplianceValid =
    validateRepositoryCompliance(repositoryComplianceArtifact) &&
    repositoryComplianceProgramFindings(repositoryComplianceArtifact, {
      asOf: repositoryComplianceArtifact.run.asOf,
    }).length === 0;
  const selectedMockPlus = mockContext.inventory.entries.filter((item) =>
    analogueIds.includes(item.id),
  );

  return {
    valid:
      pins.every((item) => item.valid) &&
      entries.length === analogueIds.length &&
      proposalErrors.length === 0 &&
      repositoryOperationsValid &&
      repositoryComplianceValid &&
      regression.length === analogueIds.length &&
      quality.scores.every((item) => item.gates.qualified) &&
      runtimeScenarios.every(
        (item) =>
          canonicalJson(item.scenarios) ===
          canonicalJson([
            "accepted-task",
            "missing-conflicting-evidence",
            "prohibited-authority",
          ]),
      ) &&
      runtimeBudget.tokenBudgetCoversSelectedWorstCase &&
      hasExactMockPlusCoverage(analogueIds, selectedMockPlus),
    pins,
    proposalErrors,
    similarity,
    quality: quality.scores.map((item) => ({
      id: item.id,
      total: item.total,
      qualified: item.gates.qualified,
    })),
    regression: regression.map((item) => item.id),
    runtimeScenarios,
    runtimeProfile: runtimeProfile.schemaVersion,
    mockPlus: selectedMockPlus
      .map((item) => ({
        id: item.id,
        schema: item.schema.registered,
        semantics: item.semanticValidator,
      })),
    repositoryOperationsArtifact,
    repositoryComplianceArtifact,
  };
}

export function hasExactMockPlusCoverage(requiredIds, entries) {
  return (
    sameSet(
      requiredIds,
      records(entries).map((item) => item.id),
    ) &&
    records(entries).every(
      (item) =>
        item.semanticValidator === true &&
        item.applicableFamilies?.schema === true &&
        item.applicableFamilies?.semantics === true,
    )
  );
}

export function compositionProofPayload(value) {
  return signedPayload(value);
}

function validateFutureComposition({
  proof,
  publicTrust,
  candidatePrincipalRefs,
  requiredFacts,
  asOf,
}) {
  const findings = [];
  const normalizedProof = normalize(
    proof,
    CANDIDATE_LIMITS.compositionProofBytes,
  );
  const normalizedTrust = normalize(
    publicTrust,
    CANDIDATE_LIMITS.publicTrustBytes,
  );
  if (!normalizedProof.ok || !normalizedTrust.ok) {
    return { valid: false, findings: [finding("invalid-future-composition", "$")] };
  }
  const value = normalizedProof.value;
  const trustValue = normalizedTrust.value;
  findings.push(
    ...schemaFindings(validateCompositionProofSchema, value, "$.futureComposition"),
  );
  const signers = validateTrustStore(
    trustValue,
    findings,
    "$.futureCompositionTrust",
  );
  if (
    !validateCompositionProofSchema(value) ||
    !validatePublicTrustSchema(trustValue)
  ) {
    return { valid: false, findings: uniqueFindings(findings) };
  }
  const signer = signers.get(value.signature.keyId);
  const candidatePrincipalSet = new Set(candidatePrincipalRefs);
  const candidateSigners = publicTrust.signers.filter((item) =>
    candidatePrincipalSet.has(item.principalRef),
  );
  const candidateFingerprints = new Set(
    candidateSigners
      .map(publicKeyRecord)
      .filter(Boolean)
      .map((item) => item.fingerprint),
  );
  if (
    !signer ||
    candidateFingerprints.has(signer.fingerprint) ||
    candidatePrincipalSet.has(signer.principalRef)
  ) {
    findings.push(
      finding(
        "non-independent-composition-authority",
        "$.futureComposition.signature",
      ),
    );
  }
  verifySigned({
    value,
    payload: compositionProofPayload(value),
    purpose: "composition-proof",
    principalRef: value.signerRef,
    principalKind: "human",
    signedAt: value.signedAt,
    signers,
    path: "$.futureComposition.signature",
    findings,
  });
  if (
    value.validatorDigest !== sha256Digest(COMPOSITION_VALIDATOR_DESCRIPTOR) ||
    timestamp(value.signedAt) > timestamp(asOf)
  ) {
    findings.push(
      finding("invalid-composition-validator", "$.futureComposition.validatorDigest"),
    );
  }
  const bytes = strictBase64(value.artifact.bytesBase64);
  let artifact;
  if (
    !bytes ||
    sha256Bytes(bytes) !== value.artifact.digest ||
    bytes.length > CANDIDATE_LIMITS.compositionProofBytes
  ) {
    findings.push(
      finding("invalid-composition-artifact", "$.futureComposition.artifact"),
    );
  } else {
    try {
      artifact = JSON.parse(bytes.toString("utf8"));
    } catch {
      findings.push(
        finding("invalid-composition-artifact", "$.futureComposition.artifact"),
      );
    }
  }
  const exactArtifact =
    isRecord(artifact) &&
    Object.keys(artifact).length === 3 &&
    artifact.schemaVersion ===
      "awesomeClaws.clawPortfolioManagerCompositionFacts.v1" &&
    Array.isArray(artifact.sourceArtifacts) &&
    artifact.sourceArtifacts.length >= 2 &&
    artifact.sourceArtifacts.every(
      (item) => parseCompositionSourceArtifact(item) !== null,
    ) &&
    Array.isArray(artifact.facts) &&
    artifact.facts.every(
      (item) =>
        isRecord(item) &&
        Object.keys(item).length === 2 &&
        typeof item.id === "string" &&
        /^sha256:[0-9a-f]{64}$/u.test(item.valueDigest),
    ) &&
    new Set(artifact.sourceArtifacts.map((item) => item.id)).size ===
      artifact.sourceArtifacts.length &&
    new Set(artifact.facts.map((item) => item.id)).size ===
      artifact.facts.length &&
    canonicalJson(
      [...artifact.facts].sort((left, right) => compareText(left.id, right.id)),
    ) ===
      canonicalJson(
        [...(compositionFactsFromSources(artifact.sourceArtifacts) ?? [])].sort(
          (left, right) => compareText(left.id, right.id),
        ),
      ) &&
    canonicalJson(
      [...artifact.facts].sort((left, right) => compareText(left.id, right.id)),
    ) ===
      canonicalJson(
        [...requiredFacts].sort((left, right) => compareText(left.id, right.id)),
      );
  if (!exactArtifact) {
    findings.push(
      finding("incomplete-composition-fact-graph", "$.futureComposition.artifact"),
    );
  }
  if (containsCredentialMaterial(value) || containsCredentialMaterial(trustValue)) {
    findings.push(finding("private-or-credential-material", "$.futureComposition"));
  }
  return {
    valid: findings.length === 0,
    findings: uniqueFindings(findings),
    sourceArtifacts: artifact?.sourceArtifacts ?? [],
  };
}

export function createFutureCompositionFactArtifact(sourceArtifacts) {
  const facts = compositionFactsFromSources(sourceArtifacts);
  if (facts === null) {
    throw new TypeError(
      "Future composition source artifacts must execute the exact closed validator contract.",
    );
  }
  const value = {
    schemaVersion: "awesomeClaws.clawPortfolioManagerCompositionFacts.v1",
    sourceArtifacts: [...sourceArtifacts].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    facts: [...facts].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  };
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  return {
    value,
    bytesBase64: bytes.toString("base64"),
    digest: sha256Bytes(bytes),
  };
}

export function compositionValidatorDigest() {
  return sha256Digest(COMPOSITION_VALIDATOR_DESCRIPTOR);
}

export async function assessStrongestComposition(options = {}) {
  const inputSnapshot = normalize(options.input, CANDIDATE_LIMITS.inputBytes);
  const trustSnapshot = normalize(
    options.publicTrust,
    CANDIDATE_LIMITS.publicTrustBytes,
  );
  const receiptsSnapshot = normalize(
    options.sourceReceipts,
    CANDIDATE_LIMITS.sourceReceiptsBytes,
  );
  const futureSnapshot =
    options.futureComposition === undefined
      ? { ok: true, value: undefined }
      : normalize(
          options.futureComposition,
          CANDIDATE_LIMITS.compositionProofBytes,
        );
  if (
    !inputSnapshot.ok ||
    !trustSnapshot.ok ||
    !receiptsSnapshot.ok ||
    !futureSnapshot.ok
  ) {
    return {
      schemaVersion: "awesomeClaws.clawPortfolioManagerCompositionAssessment.v1",
      verdict: "undetermined",
      confidence: 0,
      candidateEvaluation: invalidResult([
        finding("unsafe-composition-assessment-input", "$"),
      ]),
      missingInvariantIds: [],
      deleteCandidate: false,
    };
  }
  const input = inputSnapshot.value;
  const publicTrust = trustSnapshot.value;
  const sourceReceipts = receiptsSnapshot.value;
  const futureComposition = futureSnapshot.value;
  const asOf = options.asOf;
  const result = await evaluateClawPortfolio(input, {
    asOf,
    publicTrust,
    sourceReceipts,
  });
  if (result.resultStatus === "invalid") {
    return {
      schemaVersion: "awesomeClaws.clawPortfolioManagerCompositionAssessment.v1",
      verdict: "undetermined",
      confidence: 0,
      candidateEvaluation: result,
      missingInvariantIds: [],
      deleteCandidate: false,
    };
  }
  const analogue = await executeActualAnalogueProof(asOf);
  const requiredFacts = requiredCompositionFacts(input, result);
  const currentFacts = analogue.valid
    ? currentCompositionFacts(analogue)
    : [];
  const currentById = new Map(currentFacts.map((item) => [item.id, item]));
  const missing = requiredFacts.filter(
    (item) => currentById.get(item.id)?.valueDigest !== item.valueDigest,
  );
  let future = null;
  if (futureComposition) {
    future = validateFutureComposition({
      proof: futureComposition,
      publicTrust,
      candidatePrincipalRefs: input.principals.map((item) => item.id),
      requiredFacts,
      asOf,
    });
  }
  const futureClears = future?.valid === true;
  return {
    schemaVersion: "awesomeClaws.clawPortfolioManagerCompositionAssessment.v1",
    verdict: futureClears
      ? "COMPOSE"
      : analogue.valid && missing.length > 0
        ? "NEW"
        : "undetermined",
    confidence: futureClears ? 0.99 : analogue.valid ? 0.9 : 0,
    candidateEvaluation: {
      resultStatus: result.resultStatus,
      resultDigest: result.resultDigest,
    },
    analogueValidation: {
      valid: analogue.valid,
      pins: analogue.pins,
      proposalErrors: analogue.proposalErrors,
      nearestMatches: analogue.similarity.matches.map((item) => ({
        id: item.id,
        score: item.score,
      })),
      quality: analogue.quality,
      regression: analogue.regression,
      runtimeScenarios: analogue.runtimeScenarios,
      runtimeProfile: analogue.runtimeProfile,
      mockPlus: analogue.mockPlus,
    },
    requiredFacts,
    currentFacts,
    preservedInvariantIds: requiredFacts
      .filter(
        (item) => currentById.get(item.id)?.valueDigest === item.valueDigest,
      )
      .map((item) => item.id),
    missingInvariantIds: futureClears ? [] : missing.map((item) => item.id),
    futureComposition: future,
    deleteCandidate: futureClears,
  };
}

export function renderPortfolioProof(result) {
  if (result.resultStatus === "invalid") {
    return [
      "# Claw Portfolio Manager proof",
      "",
      "**Status:** invalid",
      "",
      ...result.findings.map((item) => `- \`${item.code}\` at \`${item.path}\``),
      "",
    ].join("\n");
  }
  const rows = result.issues
    .map(
      (item) =>
        `| \`${item.issueRef}\` | ${item.classification} | ${item.state} | ${item.rationale.join(", ")} |`,
    )
    .join("\n");
  return `# Claw Portfolio Manager candidate proof

**Status:** ${result.resultStatus}
**Result digest:** \`${result.resultDigest}\`
**Portfolio revision:** \`${result.run.portfolioRevision}\`
**Issue manifest revision:** \`${result.run.issueManifestRevision}\`

| Issue | Classification | State | Rationale |
| --- | --- | --- | --- |
${rows}

Budget use: ${result.budget.used.candidateCount}/${result.budget.limits.candidateCount} candidates, ${result.budget.used.admissions}/${result.budget.limits.admissions} admissions, ${result.budget.used.workUnits}/${result.budget.limits.workUnits} work units, ${result.budget.used.costMicros}/${result.budget.limits.costMicros} cost micros, ${result.budget.used.durationMinutes}/${result.budget.limits.durationMinutes} minutes.

Compose-first: ${result.antiCountIncentives.composeFirstSatisfied}. Raw Claw count objective: ${result.antiCountIncentives.rawClawCountObjective}.

Every output is a proposal or owner handoff. Merge, publication, budget increase,
risk acceptance, external mutation, production Claw mutation, sensitive-person
inference, and resealing remain structurally false.
`;
}

function readBoundedJson(path, maximumBytes) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(maximumBytes + 1);
    let total = 0;
    while (total <= maximumBytes) {
      const count = readSync(
        descriptor,
        buffer,
        total,
        maximumBytes + 1 - total,
        null,
      );
      if (count === 0) break;
      total += count;
    }
    if (total > maximumBytes) {
      throw new Error("bounded-input-exceeded");
    }
    return JSON.parse(buffer.subarray(0, total).toString("utf8"));
  } finally {
    closeSync(descriptor);
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function runCli() {
  const inputPath = process.argv[2];
  const asOf = valueAfter("--as-of");
  const trustPath = valueAfter("--trust");
  const receiptsPath = valueAfter("--source-receipts");
  const markdown = process.argv.includes("--markdown");
  if (!inputPath || !asOf || !trustPath || !receiptsPath) {
    process.stderr.write(
      "usage: node claw-portfolio-manager.mjs <input.json> --as-of <timestamp> --trust <public-trust.json> --source-receipts <source-receipts.json> [--markdown]\n",
    );
    process.exitCode = 2;
    return;
  }
  try {
    const result = await evaluateClawPortfolio(
      readBoundedJson(inputPath, CANDIDATE_LIMITS.inputBytes),
      {
        asOf,
        publicTrust: readBoundedJson(
          trustPath,
          CANDIDATE_LIMITS.publicTrustBytes,
        ),
        sourceReceipts: readBoundedJson(
          receiptsPath,
          CANDIDATE_LIMITS.sourceReceiptsBytes,
        ),
      },
    );
    const output = markdown
      ? renderPortfolioProof(result)
      : `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(output) > CANDIDATE_LIMITS.outputBytes) {
      throw new Error("bounded-output-exceeded");
    }
    process.stdout.write(output);
    process.exitCode = result.resultStatus === "invalid" ? 1 : 0;
  } catch {
    process.stdout.write(
      `${JSON.stringify(invalidResult([finding("bounded-cli-failure", "$")]))}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
