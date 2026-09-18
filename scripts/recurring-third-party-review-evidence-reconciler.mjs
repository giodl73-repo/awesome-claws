import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
export const SLICE_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconciler.v1";
export const RESULT_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerResult.v1";
export const PUBLIC_TRUST_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerPublicTrust.v1";
export const SLICE_LIMITS = Object.freeze({
  inputBytes: 1024 * 1024,
  evidenceRecords: 64,
  publicTrustSigners: 8,
  maxDepth: 32,
  maxNodes: 4096,
  maxArrayItems: 64,
  maxObjectProperties: 128,
  validationContextBytes: 2 * 1024 * 1024,
  analogueSchemaBytes: 512 * 1024,
  analogueArtifactBytes: 2 * 1024 * 1024,
  cliFileBytes: 2 * 1024 * 1024,
});

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u;
const PRIVATE_KEY_PEM_PATTERN =
  /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/iu;
const PRIVATE_KEY_NAME_PATTERN = /private.*key|key.*private/iu;
const AUTHORITY_CLAIMS = Object.freeze({
  scoringClaim: false,
  selectionClaim: false,
  vendorContactClaim: false,
  contractInterpretationClaim: false,
  certificationClaim: false,
  riskAcceptanceClaim: false,
  exceptionApprovalClaim: false,
  onboardingClaim: false,
  renewalClaim: false,
  terminationClaim: false,
  purchaseClaim: false,
  mutationClaim: false,
});
const COMPOSITION_INVARIANT_IDS = Object.freeze([
  "owner-declared-service-applicability",
  "requirement-catalog-revision",
  "evidence-expiry",
  "predecessor-reopening",
]);

const packagedVerifierPath =
  "/skills/recurring-third-party-review-validator/scripts/verify.mjs";
const sourceBaseUrl = new URL(import.meta.url).pathname.endsWith(
  packagedVerifierPath,
)
  ? new URL("../../../", import.meta.url)
  : new URL(
      "../sources/recurring-third-party-review-evidence-reconciler/",
      import.meta.url,
    );
const schema = JSON.parse(
  readFileSync(
    new URL(
      "schemas/recurring-third-party-review-evidence-reconciler.schema.json",
      sourceBaseUrl,
    ),
    "utf8",
  ),
);
const publicTrustSchema = JSON.parse(
  readFileSync(new URL("schemas/public-trust.schema.json", sourceBaseUrl), "utf8"),
);
const sourceReceiptsSchema = JSON.parse(
  readFileSync(new URL("schemas/source-receipts.schema.json", sourceBaseUrl), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const validatePublicTrustSchema = ajv.compile(publicTrustSchema);
const validateSourceReceiptsSchema = ajv.compile(sourceReceiptsSchema);
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inspectJsonDescriptors(value, limits) {
  const active = new WeakSet();
  let nodes = 0;
  let bytes = 0;
  const hardLimitErrors = new Set([
    "node-limit-exceeded",
    "depth-limit-exceeded",
    "byte-limit-exceeded",
    "object-property-limit-exceeded",
    "array-limit-exceeded",
  ]);
  const privateError = (path) =>
    path[0] === "publicTrust"
      ? "private-key-material-public-trust"
      : "private-key-material";
  const visit = (node, depth, path) => {
    nodes += 1;
    if (nodes > limits.maxNodes) return "node-limit-exceeded";
    if (depth > limits.maxDepth) return "depth-limit-exceeded";
    if (typeof node === "string") {
      bytes += Buffer.byteLength(node, "utf8") + 2;
      if (bytes > limits.maxBytes) return "byte-limit-exceeded";
      return PRIVATE_KEY_PEM_PATTERN.test(node) ? privateError(path) : null;
    }
    if (
      node === null ||
      typeof node === "boolean" ||
      (typeof node === "number" && Number.isFinite(node))
    ) {
      return null;
    }
    if (typeof node !== "object") return "non-json-value";
    if (isProxy(node)) return "proxy-object";
    if (active.has(node)) return "cycle";
    active.add(node);
    let descriptors;
    let prototype;
    try {
      descriptors = Object.getOwnPropertyDescriptors(node);
      prototype = Object.getPrototypeOf(node);
    } catch {
      return "unreadable-object";
    }
    let structuralError =
      prototype === Object.prototype ||
      prototype === Array.prototype ||
      prototype === null
        ? null
        : "non-json-object";
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      Array.isArray(node) &&
      (!Number.isInteger(descriptors.length?.value) ||
        descriptors.length.value < 0 ||
        descriptors.length.value > limits.maxArrayItems)
    ) {
      return "array-limit-exceeded";
    }
    const dataKeys = ownKeys.filter(
      (key) => !(Array.isArray(node) && key === "length"),
    );
    if (dataKeys.length > limits.maxObjectProperties) {
      return "object-property-limit-exceeded";
    }
    for (const key of dataKeys) {
      if (typeof key === "symbol") {
        structuralError ??= "symbol-property";
      }
      const descriptor = descriptors[key];
      if (descriptor.get || descriptor.set) {
        structuralError ??= "accessor-property";
        continue;
      }
      if (!descriptor.enumerable) {
        structuralError ??= "non-enumerable-property";
      }
      if (
        typeof key === "string" &&
        PRIVATE_KEY_NAME_PATTERN.test(key)
      ) {
        return privateError([...path, key]);
      }
      const nestedError = visit(descriptor.value, depth + 1, [
        ...path,
        typeof key === "string" ? key : "<symbol>",
      ]);
      if (nestedError?.startsWith("private-key-material")) {
        return nestedError;
      }
      if (hardLimitErrors.has(nestedError)) return nestedError;
      structuralError ??= nestedError;
    }
    active.delete(node);
    return structuralError;
  };
  return visit(value, 0, []);
}

function normalizeJsonValue(value, limits) {
  const inspectionError = inspectJsonDescriptors(value, limits);
  if (inspectionError !== null) {
    return { value: null, error: inspectionError };
  }
  const active = new WeakSet();
  let bytes = 0;
  let nodes = 0;
  const fail = (code) => ({ value: null, error: code });
  const countBytes = (text) => {
    bytes += Buffer.byteLength(text, "utf8") + 2;
    return bytes <= limits.maxBytes;
  };
  const visit = (node, depth) => {
    nodes += 1;
    if (nodes > limits.maxNodes) return fail("node-limit-exceeded");
    if (depth > limits.maxDepth) return fail("depth-limit-exceeded");
    if (node === null || typeof node === "boolean") {
      if (!countBytes(String(node))) return fail("byte-limit-exceeded");
      return { value: node, error: null };
    }
    if (typeof node === "string") {
      if (!countBytes(node)) return fail("byte-limit-exceeded");
      return { value: node, error: null };
    }
    if (typeof node === "number") {
      if (!Number.isFinite(node)) return fail("non-json-number");
      if (!countBytes(String(node))) return fail("byte-limit-exceeded");
      return { value: node, error: null };
    }
    if (typeof node !== "object") return fail("non-json-value");
    if (isProxy(node)) return fail("proxy-object");
    if (active.has(node)) return fail("cycle");
    active.add(node);
    let descriptors;
    let prototype;
    try {
      descriptors = Object.getOwnPropertyDescriptors(node);
      prototype = Object.getPrototypeOf(node);
    } catch {
      return fail("unreadable-object");
    }
    if (
      prototype !== Object.prototype &&
      prototype !== Array.prototype &&
      prototype !== null
    ) {
      return fail("non-json-object");
    }
    if (Array.isArray(node)) {
      const arrayLength = descriptors.length?.value;
      if (!Number.isInteger(arrayLength) || arrayLength < 0) {
        return fail("invalid-array-length");
      }
      if (arrayLength > limits.maxArrayItems) return fail("array-limit-exceeded");
      const extraEnumerable = Object.keys(descriptors).filter(
        (key) =>
          descriptors[key].enumerable &&
          (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= arrayLength),
      );
      if (extraEnumerable.length > 0) return fail("array-extra-property");
      const copy = [];
      for (let index = 0; index < arrayLength; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || descriptor.get || descriptor.set) {
          return fail("accessor-or-sparse-array");
        }
        const nested = visit(descriptor.value, depth + 1);
        if (nested.error !== null) return nested;
        copy.push(nested.value);
      }
      active.delete(node);
      return { value: copy, error: null };
    }
    const keys = Object.keys(descriptors).filter(
      (key) => descriptors[key].enumerable,
    );
    if (keys.length > limits.maxObjectProperties) {
      return fail("object-property-limit-exceeded");
    }
    const copy = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor.get || descriptor.set) return fail("accessor-property");
      if (!countBytes(key)) return fail("byte-limit-exceeded");
      const nested = visit(descriptor.value, depth + 1);
      if (nested.error !== null) return nested;
      copy[key] = nested.value;
    }
    active.delete(node);
    return { value: copy, error: null };
  };
  return visit(value, 0);
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function timestamp(value) {
  if (typeof value !== "string") return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zone === "Z" ? 0 : Number(offsetHourText);
  const offsetMinute = zone === "Z" ? 0 : Number(offsetMinuteText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON requires finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("Canonical JSON cannot encode cycles.");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) throw new TypeError("Canonical JSON cannot encode cycles.");
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
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

function sha256ByteDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function computeCellDigest(cell) {
  return sha256Digest({
    kind: "third-party-review-requirement-cell",
    id: cell?.id,
    vendorServiceRef: cell?.vendorServiceRef,
    requirementRef: cell?.requirementRef,
    ownerRef: cell?.ownerRef,
    applicability: cell?.applicability,
    declaredAt: cell?.declaredAt,
    declarationEvidenceRef: cell?.declarationEvidenceRef,
  });
}

export function computeVendorServiceDigest(service) {
  return sha256Digest({
    kind: "third-party-review-vendor-service",
    id: service?.id,
    vendorId: service?.vendorId,
    vendorName: service?.vendorName,
    serviceId: service?.serviceId,
    serviceName: service?.serviceName,
    ownerRef: service?.ownerRef,
    subprocessorRefs: [...(service?.subprocessorRefs ?? [])].sort(compareText),
  });
}

export function computeRequirementCatalogRevision(catalog) {
  return sha256Digest({
    kind: "third-party-review-requirement-catalog",
    id: catalog?.id,
    version: catalog?.version,
    approvedByRef: catalog?.approvedByRef,
    approvedAt: catalog?.approvedAt,
    requirements: [...records(catalog?.requirements)].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  });
}

export function computeCellIndexRevision(catalog) {
  return sha256Digest({
    kind: "third-party-review-owner-declared-cell-index",
    requirementCatalogRef: catalog?.id,
    cells: [...records(catalog?.cells)].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  });
}

export function computeFreshnessRuleRevision(freshnessRules) {
  return sha256Digest({
    kind: "third-party-review-freshness-rules",
    rules: [...records(freshnessRules)].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  });
}

export function computeExceptionScopeDigest(exception) {
  return sha256Digest({
    kind: "third-party-review-exception-scope",
    id: exception?.id,
    cellRef: exception?.cellRef,
    approvedByRef: exception?.approvedByRef,
    approvedAt: exception?.approvedAt,
    expiresAt: exception?.expiresAt,
    evidenceRef: exception?.evidenceRef,
  });
}

export function sourceAuthorityPayload(input) {
  const value = structuredClone(input);
  if (isRecord(value.sourceAuthority)) delete value.sourceAuthority.signature;
  return Buffer.from(canonicalJson(value), "utf8");
}

export function computePredecessorArtifactDigest(
  predecessorCycle,
  evidenceRecords = [],
) {
  const value = structuredClone(predecessorCycle);
  delete value.artifactDigest;
  delete value.sourceAuthority;
  const evidenceRefs = new Set(
    records(value.decisions).flatMap((item) => item.evidenceRefs ?? []),
  );
  return sha256Digest({
    kind: "third-party-review-predecessor-cycle",
    artifact: value,
    evidence: records(evidenceRecords)
      .filter((item) => evidenceRefs.has(item.id))
      .sort((left, right) => compareText(left.id, right.id)),
  });
}

export function predecessorAuthorityPayload(predecessorCycle) {
  const value = structuredClone(predecessorCycle);
  if (isRecord(value.sourceAuthority)) delete value.sourceAuthority.signature;
  return Buffer.from(canonicalJson(value), "utf8");
}

export function ownerManifestPayload(manifest) {
  const value = structuredClone(manifest);
  delete value.signature;
  return Buffer.from(canonicalJson(value), "utf8");
}

export function sourceReceiptsPayload(receipts) {
  const value = structuredClone(receipts);
  delete value.signature;
  return Buffer.from(canonicalJson(value), "utf8");
}

function finding(code, path, message, refs = []) {
  return { code, path, message, refs: [...refs].sort(compareText) };
}

function uniqueSortedFindings(findings) {
  const unique = new Map();
  for (const item of findings) {
    const key = canonicalJson(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((left, right) =>
    compareText(
      `${left.code}\u0000${left.path}\u0000${canonicalJson(left.refs)}`,
      `${right.code}\u0000${right.path}\u0000${canonicalJson(right.refs)}`,
    ),
  );
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  const expected = [...left].sort(compareText);
  const actual = [...right].sort(compareText);
  return expected.every((value, index) => value === actual[index]);
}

function mapById(values) {
  return new Map(
    records(values)
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort(compareText);
}

function hasUnsafePublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (isIP(host) === 4) {
    const [first, second] = host.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && [0, 168].includes(second)) ||
      (first === 198 && [18, 19].includes(second)) ||
      first >= 224
    );
  }
  if (isIP(host) === 6) {
    return (
      host === "::" ||
      host === "::1" ||
      host.startsWith("::ffff:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/u.test(host) ||
      host.startsWith("ff") ||
      host.startsWith("2001:db8:")
    );
  }
  if (
    /^(?:localhost(?:\.localdomain)?|.+\.localhost|.+\.local|.+\.internal)$/u.test(
      host,
    )
  ) {
    return true;
  }
  return false;
}

function isCredentialFreePublicHttpsReference(value) {
  let reference;
  try {
    reference = new URL(value);
  } catch {
    return false;
  }
  const unsafeQueryKey = (key) => {
    const compact = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    return (
      /^(?:auth|code|credential|key|password|secret|sig|signature|token)$/u.test(
        compact,
      ) ||
      /(?:accesskey|accesstoken|apikey|authtoken|credential|securitytoken|signature|signed)/u.test(
        compact,
      ) ||
      compact.startsWith("xamz") ||
      compact.startsWith("xgoog")
    );
  };
  const unsafeQuery =
    [...reference.searchParams.keys()].some(unsafeQueryKey) ||
    [...reference.searchParams.values()].some((queryValue) =>
      /\b(?:access[_-]?token|api[_-]?key|auth|credential|password|secret|token)\s*[:=]/iu.test(
        queryValue,
      ),
    );
  return (
    reference.protocol === "https:" &&
    !reference.username &&
    !reference.password &&
    !reference.hash &&
    !hasUnsafePublicHost(reference.hostname) &&
    !unsafeQuery
  );
}

function containsPrivateKeyMaterial(value, seen = new Set()) {
  if (typeof value === "string") {
    return PRIVATE_KEY_PEM_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.some((item) => containsPrivateKeyMaterial(item, seen));
  }
  if (!isRecord(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(
    ([key, nested]) =>
      PRIVATE_KEY_NAME_PATTERN.test(key) ||
      containsPrivateKeyMaterial(nested, seen),
  );
}

function publicKeyFingerprint(signer) {
  try {
    return sha256ByteDigest(
      createPublicKey(signer.publicKeyPem).export({
        type: "spki",
        format: "der",
      }),
    );
  } catch {
    return null;
  }
}

function hasCrossOwnerKeyReuse(trustStore) {
  const ownersByKeyFingerprint = new Map();
  for (const signer of records(trustStore?.signers)) {
    const fingerprint = publicKeyFingerprint(signer);
    if (fingerprint === null) continue;
    const owners = ownersByKeyFingerprint.get(fingerprint) ?? new Set();
    owners.add(signer.ownerRef);
    ownersByKeyFingerprint.set(fingerprint, owners);
  }
  return [...ownersByKeyFingerprint.values()].some(
    (owners) => owners.size > 1,
  );
}

function trustedSignerActiveAt(trustStore, authority, instant) {
  const matching = records(trustStore?.signers).filter(
    (signer) =>
      signer.ownerRef === authority?.ownerRef &&
      signer.signingKeyId === authority?.signingKeyId &&
      signer.algorithm === "Ed25519",
  );
  return (
    matching.length === 1 &&
    timestamp(matching[0].validFrom) <= instant &&
    timestamp(matching[0].validUntil) >= instant
  );
}

function schemaFindings(input) {
  if (validateSchema(input)) return [];
  return (validateSchema.errors ?? []).map((error) =>
    finding(
      "schema-invalid",
      error.instancePath || "$",
      `${error.keyword}: ${error.message ?? "schema validation failed"}`,
    ),
  );
}

function globalIdentityFindings(input) {
  const ledgers = [
    [input.requirementCatalog],
    input.requirementCatalog?.requirements,
    input.requirementCatalog?.cells,
    input.vendorServices,
    input.subprocessors,
    input.freshnessRules,
    input.principals,
    [input.cycle],
    [input.predecessorCycle],
    input.predecessorCycle?.decisions,
    input.evidence,
    input.decisions,
    input.remediations,
    input.exceptions,
    input.riskAcceptanceAttempts,
  ];
  const ids = ledgers.flatMap((values) =>
    records(values)
      .map((item) => item.id)
      .filter((id) => typeof id === "string"),
  );
  return duplicateValues(ids).map((id) =>
    finding(
      "duplicate-global-identity",
      "$",
      `Identity ${JSON.stringify(id)} appears more than once in the review envelope.`,
      [id],
    ),
  );
}

function publicTrustFindings(input, trustStore, asOf) {
  const findings = [];
  if (containsPrivateKeyMaterial(trustStore)) {
    return [
      finding(
        "invalid-public-trust-key",
        "$.validationContext.publicTrust",
        "Public trust input must never contain private key material.",
        [input.sourceAuthority.signingKeyId],
      ),
    ];
  }
  if (!validatePublicTrustSchema(trustStore)) {
    return (validatePublicTrustSchema.errors ?? []).map((error) =>
      finding(
        "invalid-public-trust-input",
        `$.validationContext.publicTrust${error.instancePath}`,
        `${error.keyword}: ${error.message ?? "public trust schema validation failed"}`,
      ),
    );
  }
  if (hasCrossOwnerKeyReuse(trustStore)) {
    return [
      finding(
        "non-independent-public-trust-key",
        "$.validationContext.publicTrust.signers",
        "Distinct authority owners must not share the same public key material.",
      ),
    ];
  }
  const matching = trustStore.signers.filter(
    (signer) =>
      isRecord(signer) &&
      signer.ownerRef === input.sourceAuthority.ownerRef &&
      signer.signingKeyId === input.sourceAuthority.signingKeyId &&
      signer.algorithm === "Ed25519",
  );
  if (matching.length !== 1) {
    return [
      finding(
        "untrusted-source-authority",
        "$.sourceAuthority",
        "The source authority must resolve to exactly one owner-and-key-scoped Ed25519 public trust entry.",
        [input.sourceAuthority.ownerRef, input.sourceAuthority.signingKeyId],
      ),
    ];
  }
  const signer = matching[0];
  if (
    typeof signer.publicKeyPem !== "string" ||
    /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/iu.test(signer.publicKeyPem)
  ) {
    return [
      finding(
        "invalid-public-trust-key",
        "$.validationContext.publicTrust",
        "Public trust input must contain a public key and must never contain private key material.",
        [input.sourceAuthority.signingKeyId],
      ),
    ];
  }
  const validFrom = timestamp(signer.validFrom);
  const validUntil = timestamp(signer.validUntil);
  const issuedAt = timestamp(input.sourceAuthority.issuedAt);
  if (
    validFrom === null ||
    validUntil === null ||
    issuedAt === null ||
    issuedAt < validFrom ||
    issuedAt > validUntil ||
    asOf < validFrom ||
    asOf > validUntil
  ) {
    findings.push(
      finding(
        "inactive-public-trust-key",
        "$.sourceAuthority",
        "The source envelope and caller-controlled asOf must fall inside the trusted key interval.",
        [input.sourceAuthority.signingKeyId],
      ),
    );
  }
  let publicKey;
  try {
    publicKey = createPublicKey(signer.publicKeyPem);
  } catch (error) {
    findings.push(
      finding(
        "invalid-public-trust-key",
        "$.validationContext.publicTrust",
        `The trusted public key cannot be parsed: ${error instanceof Error ? error.message : String(error)}.`,
        [input.sourceAuthority.signingKeyId],
      ),
    );
    return findings;
  }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    return [
      finding(
        "invalid-public-trust-key",
        "$.validationContext.publicTrust",
        "A signer declared as Ed25519 must supply an Ed25519 public key.",
        [input.sourceAuthority.signingKeyId],
      ),
    ];
  }
  const signature = Buffer.from(input.sourceAuthority.signature, "base64");
  if (!verifySignature(null, sourceAuthorityPayload(input), publicKey, signature)) {
    findings.push(
      finding(
        "source-envelope-signature-invalid",
        "$.sourceAuthority.signature",
        "The complete review input does not match its injected public trust signature.",
        [input.sourceAuthority.ownerRef, input.sourceAuthority.signingKeyId],
      ),
    );
  }
  return findings;
}

function detachedSignatureFindings(
  authority,
  payload,
  trustStore,
  {
    code,
    path,
    message,
    ownerRef,
    notBefore,
    notAfter,
  },
) {
  const findings = [];
  const matching = trustStore.signers.filter(
    (signer) =>
      signer.ownerRef === authority.ownerRef &&
      signer.signingKeyId === authority.signingKeyId &&
      signer.algorithm === "Ed25519",
  );
  const issuedAt = timestamp(authority.issuedAt);
  const signer = matching[0];
  if (
    matching.length !== 1 ||
    authority.ownerRef !== ownerRef ||
    issuedAt === null ||
    issuedAt < notBefore ||
    issuedAt > notAfter ||
    issuedAt < timestamp(signer?.validFrom) ||
    issuedAt > timestamp(signer?.validUntil)
  ) {
    return [
      finding(
        code,
        path,
        message,
        [authority.ownerRef, authority.signingKeyId],
      ),
    ];
  }
  try {
    const publicKey = createPublicKey(signer.publicKeyPem);
    const signature = Buffer.from(authority.signature, "base64");
    if (
      publicKey.asymmetricKeyType !== "ed25519" ||
      !verifySignature(null, payload, publicKey, signature)
    ) {
      findings.push(
        finding(code, path, message, [
          authority.ownerRef,
          authority.signingKeyId,
        ]),
      );
    }
  } catch {
    findings.push(
      finding(
        code,
        path,
        message,
        [authority.ownerRef, authority.signingKeyId],
      ),
    );
  }
  return findings;
}

function effectiveExpiry(evidence, freshnessRule) {
  const observedAt = timestamp(evidence?.observedAt);
  const validUntil = timestamp(evidence?.validUntil);
  if (
    observedAt === null ||
    !Number.isInteger(freshnessRule?.maxAgeDays) ||
    (freshnessRule.explicitValidUntilRequired && validUntil === null)
  ) {
    return null;
  }
  const ageExpiry = observedAt + freshnessRule.maxAgeDays * 86_400_000;
  return validUntil === null ? ageExpiry : Math.min(validUntil, ageExpiry);
}

function evidenceState(evidence, rule, asOf) {
  const expiry = effectiveExpiry(evidence, rule);
  if (expiry === null) return "invalid";
  return expiry < asOf ? "expired" : "current";
}

function sourceReceiptFindings(input, sourceReceipts, trustStore, asOf) {
  if (!validateSourceReceiptsSchema(sourceReceipts)) {
    return (validateSourceReceiptsSchema.errors ?? []).map((error) =>
      finding(
        "invalid-source-receipt",
        `$.validationContext.sourceReceipts${error.instancePath}`,
        `${error.keyword}: ${error.message ?? "source receipt schema validation failed"}`,
      ),
    );
  }
  const evidenceCustodians = input.principals.filter(
    (item) => item.role === "evidence-custodian",
  );
  const receiptOwner = evidenceCustodians[0];
  const findings = [];
  if (
    evidenceCustodians.length !== 1 ||
    sourceReceipts.ownerRef !== receiptOwner?.id
  ) {
    findings.push(
      finding(
        "invalid-source-receipt-authority",
        "$.validationContext.sourceReceipts.ownerRef",
        "The source receipt manifest must be issued by the one typed evidence custodian.",
        [sourceReceipts.ownerRef],
      ),
    );
  }
  findings.push(...detachedSignatureFindings(
    sourceReceipts,
    sourceReceiptsPayload(sourceReceipts),
    trustStore,
    {
      code: "invalid-source-receipt-authority",
      path: "$.validationContext.sourceReceipts",
      message:
        "The source receipt manifest requires an independently trusted evidence custodian signature.",
      ownerRef: receiptOwner?.id,
      notBefore: Math.max(
        timestamp(receiptOwner?.authorityObservedAt) ??
          Number.POSITIVE_INFINITY,
        ...input.evidence.map((item) => timestamp(item.observedAt)),
      ),
      notAfter: Math.min(
        asOf,
        timestamp(input.sourceAuthority.issuedAt) ??
          Number.NEGATIVE_INFINITY,
      ),
    },
  ));
  const evidenceById = mapById(input.evidence);
  const receiptByEvidence = new Map(
    sourceReceipts.receipts.map((item) => [item.evidenceRef, item]),
  );
  if (
    receiptByEvidence.size !== sourceReceipts.receipts.length ||
    !sameSet([...receiptByEvidence.keys()], [...evidenceById.keys()])
  ) {
    findings.push(
      finding(
        "inexact-source-receipt-closure",
        "$.validationContext.sourceReceipts.receipts",
        "Every evidence row requires exactly one independently signed source receipt.",
        [...evidenceById.keys()],
      ),
    );
  }
  for (const [index, receipt] of sourceReceipts.receipts.entries()) {
    const evidenceItem = evidenceById.get(receipt.evidenceRef);
    let bytes = null;
    try {
      const decoded = Buffer.from(receipt.contentBase64, "base64");
      if (decoded.toString("base64") === receipt.contentBase64) bytes = decoded;
    } catch {
      bytes = null;
    }
    if (
      !evidenceItem ||
      receipt.sourceRef !== evidenceItem.sourceRef ||
      receipt.sourceVersion !== evidenceItem.sourceVersion ||
      receipt.contentDigest !== evidenceItem.sourceContentDigest ||
      bytes === null ||
      sha256ByteDigest(bytes) !== receipt.contentDigest
    ) {
      findings.push(
        finding(
          "invalid-source-receipt",
          `$.validationContext.sourceReceipts.receipts[${index}]`,
          "Each receipt must bind the exact source reference, version, bytes, and digest of one evidence row.",
          [receipt.evidenceRef],
        ),
      );
    }
  }
  return findings;
}

function semanticFindings(input, asOf, trustStore) {
  const findings = [...globalIdentityFindings(input)];
  const principals = mapById(input.principals);
  const vendorServices = mapById(input.vendorServices);
  const subprocessors = mapById(input.subprocessors);
  const requirements = mapById(input.requirementCatalog.requirements);
  const cells = mapById(input.requirementCatalog.cells);
  const freshnessRules = mapById(input.freshnessRules);
  const evidence = mapById(input.evidence);
  const predecessorDecisions = mapById(input.predecessorCycle.decisions);
  const remediations = mapById(input.remediations);
  const exceptions = mapById(input.exceptions);
  const principalWithRoleAt = (ref, role, occurredAt) => {
    const principal = principals.get(ref);
    const authorityObservedAt = timestamp(principal?.authorityObservedAt);
    const actionAt = timestamp(occurredAt);
    return (
      principal?.kind === "human" &&
      principal.role === role &&
      authorityObservedAt !== null &&
      actionAt !== null &&
      authorityObservedAt <= actionAt
    );
  };
  const add = (code, path, message, refs = []) =>
    findings.push(finding(code, path, message, refs));

  const catalogManifest = input.ownerManifests.find(
    (item) =>
      item.kind === "requirement-catalog" &&
      item.subjectRef === input.requirementCatalog.id,
  );
  const serviceManifests = input.ownerManifests.filter(
    (item) => item.kind === "vendor-service-applicability",
  );
  const serviceManifestRefs = serviceManifests.map((item) => item.subjectRef);
  const vendorServiceRefs = input.vendorServices.map((item) => item.id);
  if (
    input.ownerManifests.length !== input.vendorServices.length + 1 ||
    !catalogManifest ||
    serviceManifests.length !== input.vendorServices.length ||
    !sameSet(serviceManifestRefs, vendorServiceRefs) ||
    duplicateValues(serviceManifestRefs).length > 0
  ) {
    add(
      "inexact-owner-manifest-closure",
      "$.ownerManifests",
      "The catalog and each vendor service require exactly one independent owner manifest.",
    );
  }
  for (const [index, manifest] of input.ownerManifests.entries()) {
    const principal = principals.get(manifest.ownerRef);
    const service = vendorServices.get(manifest.subjectRef);
    const serviceCells = input.requirementCatalog.cells
      .filter((cell) => cell.vendorServiceRef === manifest.subjectRef)
      .sort((left, right) => compareText(left.id, right.id));
    const expectedCellRefs = serviceCells.map((cell) => cell.id);
    const expectedCellDigests = serviceCells.map(computeCellDigest).sort(compareText);
    const isCatalog = manifest.kind === "requirement-catalog";
    const semanticValid = isCatalog
      ? manifest.subjectRef === input.requirementCatalog.id &&
        manifest.ownerRef === input.requirementCatalog.approvedByRef &&
        principal?.role === "requirement-catalog-owner" &&
        manifest.subjectDigest === input.requirementCatalog.revision &&
        manifest.cellRefs.length === 0 &&
        manifest.cellDigests.length === 0
      : service &&
        manifest.ownerRef === service.ownerRef &&
        principal?.role === "vendor-service-owner" &&
        manifest.subjectDigest === computeVendorServiceDigest(service) &&
        sameSet(manifest.cellRefs, expectedCellRefs) &&
        sameSet(manifest.cellDigests, expectedCellDigests);
    if (!semanticValid) {
      add(
        "invalid-owner-manifest",
        `$.ownerManifests[${index}]`,
        "Each independently signed owner manifest must bind its exact catalog or service applicability graph.",
        [manifest.subjectRef, manifest.ownerRef],
      );
    }
    findings.push(
      ...detachedSignatureFindings(
        manifest,
        ownerManifestPayload(manifest),
        trustStore,
        {
          code: "invalid-owner-manifest-signature",
          path: `$.ownerManifests[${index}].signature`,
          message:
            "Each owner manifest requires an independently trusted owner signature.",
          ownerRef: manifest.ownerRef,
          notBefore: Math.max(
            timestamp(principal?.authorityObservedAt) ??
              Number.POSITIVE_INFINITY,
            isCatalog
              ? timestamp(input.requirementCatalog.approvedAt)
              : Math.max(
                  ...serviceCells.map((cell) => timestamp(cell.declaredAt)),
                ),
          ),
          notAfter: Math.min(
            asOf,
            timestamp(input.sourceAuthority.issuedAt) ??
              Number.NEGATIVE_INFINITY,
          ),
        },
      ),
    );
  }

  for (const [index, principal] of input.principals.entries()) {
    if (timestamp(principal.authorityObservedAt) > asOf) {
      add(
        "future-authority-record",
        `$.principals[${index}].authorityObservedAt`,
        "Human authority evidence cannot be later than caller-controlled asOf.",
        [principal.id],
      );
    }
  }
  for (const identity of duplicateValues(input.principals.map((item) => item.humanIdentityRef))) {
    add(
      "duplicate-human-identity",
      "$.principals",
      "One stable human identity cannot represent multiple principals in the bounded cycle.",
      [identity],
    );
  }
  const expectedRoleCounts = new Map([
    ["review-program-owner", 1],
    ["requirement-catalog-owner", 1],
    ["evidence-custodian", 1],
  ]);
  for (const [role, expectedCount] of expectedRoleCounts) {
    const actualCount = input.principals.filter((item) => item.role === role).length;
    if (actualCount !== expectedCount) {
      add(
        "invalid-principal-role-cardinality",
        "$.principals",
        `The review requires exactly ${expectedCount} typed human ${role} principal${expectedCount === 1 ? "" : "s"}.`,
        [role],
      );
    }
  }
  if (input.principals.filter((item) => item.role === "reviewer").length === 0) {
    add(
      "invalid-principal-role-cardinality",
      "$.principals",
      "The review requires at least one typed human reviewer.",
      ["reviewer"],
    );
  }
  for (const [role, referenced] of [
    [
      "vendor-service-owner",
      [...new Set(input.vendorServices.map((item) => item.ownerRef))],
    ],
    [
      "remediation-owner",
      [...new Set(input.remediations.map((item) => item.ownerRef))],
    ],
    [
      "exception-authority",
      [...new Set(input.exceptions.map((item) => item.approvedByRef))],
    ],
  ]) {
    const declared = input.principals
      .filter((item) => item.role === role)
      .map((item) => item.id);
    if (!sameSet(declared, referenced)) {
      add(
        "invalid-principal-role-cardinality",
        "$.principals",
        `The ${role} principal set must equal the owners referenced by the review portfolio.`,
        [role],
      );
    }
  }

  const catalog = input.requirementCatalog;
  const expectedCatalogRevision = computeRequirementCatalogRevision(catalog);
  const expectedCellIndexRevision = computeCellIndexRevision(catalog);
  const expectedFreshnessRuleRevision = computeFreshnessRuleRevision(
    input.freshnessRules,
  );
  if (catalog.revision !== expectedCatalogRevision) {
    add(
      "requirement-catalog-revision-mismatch",
      "$.requirementCatalog.revision",
      "The owner-approved requirement catalog revision must bind its exact requirement universe.",
      [catalog.id],
    );
  }
  if (
    !principalWithRoleAt(
      catalog.approvedByRef,
      "requirement-catalog-owner",
      catalog.approvedAt,
    )
  ) {
    add(
      "invalid-requirement-catalog-authority",
      "$.requirementCatalog.approvedByRef",
      "The requirement catalog must be approved by its typed human catalog owner.",
      [catalog.approvedByRef],
    );
  }
  const requirementKinds = new Set(input.freshnessRules.map((item) => item.evidenceKind));
  for (const [index, requirement] of catalog.requirements.entries()) {
    const rule = freshnessRules.get(requirement.freshnessRuleRef);
    if (
      !rule ||
      rule.evidenceKind !== requirement.requiredEvidenceKind ||
      !requirementKinds.has(requirement.requiredEvidenceKind)
    ) {
      add(
        "invalid-requirement-freshness-binding",
        `$.requirementCatalog.requirements[${index}].freshnessRuleRef`,
        "Every requirement must bind the exact owner-supplied freshness rule for its required evidence kind.",
        [requirement.id, requirement.freshnessRuleRef],
      );
    }
  }
  for (const duplicate of duplicateValues(
    input.freshnessRules.map((item) => item.evidenceKind),
  )) {
    add(
      "duplicate-freshness-rule",
      "$.freshnessRules",
      "Each evidence kind must have exactly one freshness rule.",
      [duplicate],
    );
  }

  const cellPairs = catalog.cells.map(
    (cell) => `${cell.vendorServiceRef}\u0000${cell.requirementRef}`,
  );
  for (const pair of duplicateValues(cellPairs)) {
    add(
      "duplicate-requirement-cell",
      "$.requirementCatalog.cells",
      "The explicit owner-declared service and requirement pair must occur exactly once.",
      [pair],
    );
  }
  for (const [index, cell] of catalog.cells.entries()) {
    const vendorService = vendorServices.get(cell.vendorServiceRef);
    const declarationEvidence = evidence.get(cell.declarationEvidenceRef);
    if (
      !vendorService ||
      !requirements.has(cell.requirementRef) ||
      vendorService.ownerRef !== cell.ownerRef ||
      !principalWithRoleAt(
        cell.ownerRef,
        "vendor-service-owner",
        cell.declaredAt,
      ) ||
      timestamp(cell.declaredAt) > timestamp(catalog.approvedAt)
    ) {
      add(
        "invalid-service-applicability-cell",
        `$.requirementCatalog.cells[${index}]`,
        "Each cell must bind an existing vendor service, requirement, and typed human service owner.",
        [cell.id],
      );
    }
    if (
      declarationEvidence?.kind !== "applicability-declaration" ||
      declarationEvidence.subjectType !== "requirement-cell" ||
      declarationEvidence.subjectRef !== cell.id ||
      !sameSet(declarationEvidence.cellRefs, [cell.id]) ||
      declarationEvidence.suppliedByRef !== cell.ownerRef ||
      timestamp(declarationEvidence.observedAt) < timestamp(cell.declaredAt) ||
      timestamp(declarationEvidence.observedAt) > timestamp(catalog.approvedAt)
    ) {
      add(
        "invalid-applicability-evidence",
        `$.requirementCatalog.cells[${index}].declarationEvidenceRef`,
        "Every declared cell needs reciprocal owner-supplied applicability evidence.",
        [cell.id, cell.declarationEvidenceRef],
      );
    }
  }

  const serviceRefs = input.vendorServices.map((item) => item.id);
  const serviceOwnerRefs = input.principals
    .filter((item) => item.role === "vendor-service-owner")
    .map((item) => item.id);
  if (
    duplicateValues(
      input.vendorServices.map(
        (item) => `${item.vendorId}\u0000${item.serviceId}`,
      ),
    ).length > 0 ||
    !sameSet(
      [...new Set(input.vendorServices.map((item) => item.ownerRef))],
      serviceOwnerRefs,
    ) ||
    input.vendorServices.some(
      (service) =>
        !catalog.cells.some((cell) => cell.vendorServiceRef === service.id),
    ) ||
    input.vendorServices.some((service) =>
      service.subprocessorRefs.some((ref) => !subprocessors.has(ref)),
    ) ||
    catalog.requirements.some(
      (requirement) =>
        !catalog.cells.some((cell) => cell.requirementRef === requirement.id),
    )
  ) {
    add(
      "invalid-vendor-service-universe",
      "$.vendorServices",
      "The owner universe requires distinct vendor and service identities, with every service and catalog requirement represented by at least one declared cell.",
      serviceRefs,
    );
  }
  const coveredSubprocessorCells = new Set();
  for (const [index, subprocessor] of input.subprocessors.entries()) {
    const reciprocal =
      subprocessor.serviceRefs.every(
        (ref) =>
          vendorServices.has(ref) &&
          vendorServices.get(ref).subprocessorRefs.includes(subprocessor.id),
      ) &&
      input.vendorServices.every(
        (service) =>
          service.subprocessorRefs.includes(subprocessor.id) ===
          subprocessor.serviceRefs.includes(service.id),
      );
    if (!reciprocal) {
      add(
        "invalid-shared-subprocessor-binding",
        `$.subprocessors[${index}]`,
        "Every subprocessor must bind reciprocally to exactly its declared vendor services.",
        [subprocessor.id],
      );
    }
    const subprocessorCells = catalog.cells
      .filter(
        (cell) =>
          subprocessor.serviceRefs.includes(cell.vendorServiceRef) &&
          requirements.get(cell.requirementRef)?.requiredEvidenceKind ===
            "subprocessor-disclosure",
      )
      .map((cell) => cell.id);
    subprocessorCells.forEach((cellRef) => coveredSubprocessorCells.add(cellRef));
    const subprocessorEvidence = evidence.get(
      subprocessor.declarationEvidenceRef,
    );
    if (
      subprocessorEvidence?.kind !== "subprocessor-disclosure" ||
      subprocessorEvidence.subjectType !== "subprocessor" ||
      subprocessorEvidence.subjectRef !== subprocessor.id ||
      !sameSet(subprocessorEvidence.cellRefs, subprocessorCells) ||
      evidenceState(
        subprocessorEvidence,
        input.freshnessRules.find(
          (item) => item.evidenceKind === subprocessorEvidence?.kind,
        ),
        asOf,
      ) !== "current"
    ) {
      add(
        "invalid-shared-subprocessor-evidence",
        `$.subprocessors[${index}].declarationEvidenceRef`,
        "Each subprocessor disclosure must cover exactly its explicit requirement cells.",
        [subprocessor.id],
      );
    }
  }
  const expectedSubprocessorCells = catalog.cells
    .filter(
      (cell) =>
        requirements.get(cell.requirementRef)?.requiredEvidenceKind ===
        "subprocessor-disclosure",
    )
    .map((cell) => cell.id);
  if (!sameSet([...coveredSubprocessorCells], expectedSubprocessorCells)) {
    add(
      "invalid-shared-subprocessor-binding",
      "$.subprocessors",
      "Every subprocessor-disclosure cell must be covered by one declared reciprocal subprocessor.",
      expectedSubprocessorCells,
    );
  }

  const cycle = input.cycle;
  const predecessor = input.predecessorCycle;
  const cycleOpensAt = timestamp(cycle.opensAt);
  const cycleClosesAt = timestamp(cycle.closesAt);
  const cycleApprovedAt = timestamp(cycle.approvedAt);
  const predecessorClosedAt = timestamp(predecessor.closedAt);
  const sourceIssuedAt = timestamp(input.sourceAuthority.issuedAt);
  if (
    cycle.requirementCatalogRef !== catalog.id ||
    cycle.requirementCatalogRevision !== expectedCatalogRevision ||
    cycle.cellIndexRevision !== expectedCellIndexRevision ||
    cycle.freshnessRuleRevision !== expectedFreshnessRuleRevision ||
    predecessor.requirementCatalogRef !== catalog.id ||
    predecessor.requirementCatalogRevision !== expectedCatalogRevision ||
    predecessor.cellIndexRevision !== expectedCellIndexRevision ||
    predecessor.freshnessRuleRevision !== expectedFreshnessRuleRevision ||
    cycle.predecessorCycleRef !== predecessor.id
  ) {
    add(
      "invalid-cycle-revision-binding",
      "$.cycle",
      "Current and predecessor cycles must bind the exact catalog and explicit cell-index revisions.",
      [cycle.id, predecessor.id],
    );
  }
  if (
    predecessor.artifactDigest !==
    computePredecessorArtifactDigest(predecessor, input.evidence)
  ) {
    add(
      "invalid-predecessor-artifact-digest",
      "$.predecessorCycle.artifactDigest",
      "The predecessor artifact digest must bind its exact revisions, cells, decisions, and evidence references.",
      [predecessor.id],
    );
  }
  findings.push(
    ...detachedSignatureFindings(
      predecessor.sourceAuthority,
      predecessorAuthorityPayload(predecessor),
      trustStore,
      {
        code: "invalid-predecessor-artifact-signature",
        path: "$.predecessorCycle.sourceAuthority.signature",
        message:
          "The predecessor cycle requires an independent trusted program-owner signature.",
        ownerRef: cycle.approvedByRef,
        notBefore: Math.max(
          predecessorClosedAt,
          timestamp(principals.get(cycle.approvedByRef)?.authorityObservedAt) ??
            Number.POSITIVE_INFINITY,
        ),
        notAfter: cycleOpensAt,
      },
    ),
  );
  if (
    !principalWithRoleAt(
      cycle.approvedByRef,
      "review-program-owner",
      cycle.approvedAt,
    ) ||
    cycle.handoffOwnerRef !== cycle.approvedByRef ||
    input.sourceAuthority.ownerRef !== cycle.approvedByRef
  ) {
    add(
      "invalid-cycle-authority",
      "$.cycle.approvedByRef",
      "The approved cycle, handoff, and signed source envelope must retain one typed human review-program owner.",
      [cycle.approvedByRef],
    );
  }
  if (
    cycleApprovedAt === null ||
    cycleOpensAt === null ||
    cycleClosesAt === null ||
    predecessorClosedAt === null ||
    cycleApprovedAt > cycleOpensAt ||
    cycleOpensAt > cycleClosesAt ||
    predecessorClosedAt >= cycleOpensAt ||
    cycleClosesAt > asOf ||
    timestamp(catalog.approvedAt) > predecessorClosedAt ||
    timestamp(catalog.approvedAt) > cycleApprovedAt
  ) {
    add(
      "invalid-cycle-chronology",
      "$.cycle",
      "Catalog approval, predecessor close, current approval, current window, and caller-controlled asOf must be ordered.",
      [cycle.id, predecessor.id],
    );
  }
  const cycleApprovalEvidence = evidence.get(cycle.approvalEvidenceRef);
  if (
    cycleApprovalEvidence?.kind !== "cycle-approval" ||
    cycleApprovalEvidence.subjectType !== "review-cycle" ||
    cycleApprovalEvidence.subjectRef !== cycle.id ||
    cycleApprovalEvidence.suppliedByRef !== cycle.approvedByRef ||
    cycleApprovalEvidence.cellRefs.length !== 0 ||
    timestamp(cycleApprovalEvidence.observedAt) < cycleApprovedAt ||
    timestamp(cycleApprovalEvidence.observedAt) > cycleOpensAt
  ) {
    add(
      "invalid-cycle-approval-evidence",
      "$.cycle.approvalEvidenceRef",
      "The cycle must consume an external owner approval record; the reconciler cannot approve its own cycle.",
      [cycle.id, cycle.approvalEvidenceRef],
    );
  }

  const evidenceStates = new Map();
  for (const [index, item] of input.evidence.entries()) {
    const rule = input.freshnessRules.find(
      (candidate) => candidate.evidenceKind === item.kind,
    );
    const itemState = evidenceState(item, rule, asOf);
    evidenceStates.set(item.id, itemState);
    if (!rule || itemState === "invalid") {
      add(
        "invalid-evidence-freshness",
        `$.evidence[${index}]`,
        "Every evidence item must resolve to one freshness rule and an exact effective expiry.",
        [item.id],
      );
    }
    if (
      rule?.explicitValidUntilRequired &&
      timestamp(item.validUntil) === null
    ) {
      add(
        "missing-explicit-evidence-expiry",
        `$.evidence[${index}].validUntil`,
        "This evidence kind requires an explicit valid-until timestamp.",
        [item.id, rule.id],
      );
    }
    if (timestamp(item.observedAt) > asOf) {
      add(
        "future-evidence",
        `$.evidence[${index}].observedAt`,
        "Evidence cannot be observed after caller-controlled asOf.",
        [item.id],
      );
    }
    if (timestamp(item.observedAt) > sourceIssuedAt) {
      add(
        "evidence-after-envelope-issuance",
        `$.evidence[${index}].observedAt`,
        "The signed source envelope cannot contain evidence observed after it was issued.",
        [item.id],
      );
    }
    if (
      timestamp(item.validUntil) !== null &&
      timestamp(item.validUntil) <= timestamp(item.observedAt)
    ) {
      add(
        "invalid-evidence-validity-window",
        `$.evidence[${index}].validUntil`,
        "Evidence valid-until must be later than its observation time.",
        [item.id],
      );
    }
    if (
      (item.sourceClass === "public-trust" &&
        !isCredentialFreePublicHttpsReference(item.sourceRef)) ||
      (item.sourceClass === "owner-controlled" &&
        !item.sourceRef.startsWith("controlled://"))
    ) {
      add(
        "invalid-evidence-source-class",
        `$.evidence[${index}].sourceRef`,
        "Public-trust evidence requires HTTPS and owner-controlled evidence requires a controlled reference.",
        [item.id],
      );
    }
    if (
      ["assurance-report", "security-questionnaire", "continuity-test"].includes(
        item.kind,
      ) &&
      (item.subjectType !== "requirement-cell" ||
        !sameSet(item.cellRefs, [item.subjectRef]) ||
        !cells.has(item.subjectRef))
    ) {
      add(
        "invalid-cell-evidence-binding",
        `$.evidence[${index}]`,
        "Cell evidence must bind reciprocally to exactly one declared requirement cell.",
        [item.id, item.subjectRef],
      );
    }
    const supplier = principals.get(item.suppliedByRef);
    const expectedRole =
      item.kind === "applicability-declaration"
        ? "vendor-service-owner"
        : item.kind === "cycle-approval"
          ? "review-program-owner"
          : item.kind === "remediation-record"
            ? "remediation-owner"
            : item.kind === "exception-approval"
              ? "exception-authority"
              : "evidence-custodian";
    if (
      supplier?.role !== expectedRole ||
      !principalWithRoleAt(item.suppliedByRef, expectedRole, item.observedAt)
    ) {
      add(
        "invalid-evidence-supplier",
        `$.evidence[${index}].suppliedByRef`,
        `Evidence kind ${item.kind} requires a typed human ${expectedRole}.`,
        [item.id, item.suppliedByRef],
      );
    }
    for (const cellRef of item.cellRefs) {
      if (!cells.has(cellRef)) {
        add(
          "dangling-evidence-cell",
          `$.evidence[${index}].cellRefs`,
          "Evidence cell references must resolve inside the owner-declared cell index.",
          [item.id, cellRef],
        );
      }
    }
  }
  for (const cell of catalog.cells) {
    if (evidenceStates.get(cell.declarationEvidenceRef) !== "current") {
      add(
        "invalid-applicability-evidence",
        "$.requirementCatalog.cells",
        "Every owner-declared applicability record must remain current at caller-controlled asOf.",
        [cell.id, cell.declarationEvidenceRef],
      );
    }
  }
  if (evidenceStates.get(cycle.approvalEvidenceRef) !== "current") {
    add(
      "invalid-cycle-approval-evidence",
      "$.cycle.approvalEvidenceRef",
      "The externally approved current cycle must retain current approval evidence.",
      [cycle.id, cycle.approvalEvidenceRef],
    );
  }
  const consumedEvidenceRefs = new Set([
    ...catalog.cells.map((item) => item.declarationEvidenceRef),
    ...input.subprocessors.map((item) => item.declarationEvidenceRef),
    cycle.approvalEvidenceRef,
    ...predecessor.decisions.flatMap((item) => item.evidenceRefs),
    ...input.decisions.flatMap((item) => item.evidenceRefs),
    ...input.remediations.map((item) => item.evidenceRef),
    ...input.exceptions.map((item) => item.evidenceRef),
  ]);
  const evidenceIds = input.evidence.map((item) => item.id);
  if (!sameSet([...consumedEvidenceRefs], evidenceIds)) {
    add(
      "inexact-evidence-closure",
      "$.evidence",
      "Every supplied evidence record must be consumed by the exact cycle, applicability, decision, remediation, exception, or subprocessor contract.",
      evidenceIds.filter((id) => !consumedEvidenceRefs.has(id)),
    );
  }

  const cellIds = catalog.cells.map((item) => item.id);
  const decisionCellRefs = input.decisions.map((item) => item.cellRef);
  const predecessorCellRefs = predecessor.decisions.map((item) => item.cellRef);
  if (
    !sameSet(decisionCellRefs, cellIds) ||
    duplicateValues(decisionCellRefs).length > 0 ||
    !sameSet(predecessorCellRefs, cellIds) ||
    duplicateValues(predecessorCellRefs).length > 0
  ) {
    add(
      "inexact-cell-coverage",
      "$.decisions",
      "Current and predecessor decisions must each cover every owner-declared cell exactly once.",
      cellIds,
    );
  }
  const decisionByCell = new Map(input.decisions.map((item) => [item.cellRef, item]));
  for (const [index, item] of predecessor.decisions.entries()) {
    const decidedAt = timestamp(item.decidedAt);
    const cell = cells.get(item.cellRef);
    const requirement = requirements.get(cell?.requirementRef);
    const reliedEvidence = item.evidenceRefs
      .map((ref) => evidence.get(ref))
      .filter(Boolean);
    const exactRequirementEvidence = reliedEvidence.filter(
      (evidenceItem) =>
        evidenceItem.kind === requirement?.requiredEvidenceKind &&
        evidenceItem.cellRefs.includes(item.cellRef),
    );
    const predecessorExceptionEvidence = reliedEvidence.find(
      (evidenceItem) =>
        evidenceItem.kind === "exception-approval" &&
        evidenceItem.cellRefs.includes(item.cellRef),
    );
    const predecessorException = input.exceptions.find(
      (exception) =>
        exception.cellRef === item.cellRef &&
        exception.evidenceRef === predecessorExceptionEvidence?.id,
    );
    if (
      item.requirementCatalogRevision !==
        predecessor.requirementCatalogRevision ||
      item.cellIndexRevision !== predecessor.cellIndexRevision ||
      item.freshnessRuleRevision !== predecessor.freshnessRuleRevision ||
      item.cellDigest !== computeCellDigest(cell) ||
      !principalWithRoleAt(item.decidedByRef, "reviewer", item.decidedAt) ||
      decidedAt < timestamp(catalog.approvedAt) ||
      decidedAt > predecessorClosedAt ||
      item.evidenceRefs.some((ref) => {
        const evidenceItem = evidence.get(ref);
        return (
          !evidenceItem ||
          timestamp(evidenceItem.observedAt) > decidedAt ||
          !evidenceItem.cellRefs.includes(item.cellRef)
        );
      }) ||
      (item.decisionType === "evidence-confirmed" &&
        (exactRequirementEvidence.length === 0 ||
          exactRequirementEvidence.some((evidenceItem) => {
            const rule = input.freshnessRules.find(
              (candidate) => candidate.evidenceKind === evidenceItem.kind,
            );
            const expiry = effectiveExpiry(evidenceItem, rule);
            return expiry === null || expiry < predecessorClosedAt;
          }))) ||
      (item.decisionType === "exception-recorded" &&
        (!predecessorExceptionEvidence ||
          !predecessorException ||
          timestamp(predecessorException.approvedAt) > decidedAt ||
          timestamp(predecessorException.expiresAt) < predecessorClosedAt ||
          !reliedEvidence.some((evidenceItem) => {
          const rule = input.freshnessRules.find(
            (candidate) => candidate.evidenceKind === evidenceItem.kind,
          );
          const expiry = effectiveExpiry(evidenceItem, rule);
          return (
            evidenceItem.kind === "exception-approval" &&
            evidenceItem.cellRefs.includes(item.cellRef) &&
            principals.get(evidenceItem.suppliedByRef)?.role ===
              "exception-authority" &&
            expiry !== null &&
            expiry >= predecessorClosedAt
          );
          })))
    ) {
      add(
        "invalid-predecessor-decision",
        `$.predecessorCycle.decisions[${index}]`,
        "Every predecessor cell needs a typed human reviewer decision with evidence no later than predecessor close.",
        [item.id, item.cellRef],
      );
    }
  }

  const expectedReopenedCells = [];
  for (const predecessorDecision of predecessor.decisions) {
    const expiredAtCurrent = predecessorDecision.evidenceRefs.filter(
      (ref) => evidenceStates.get(ref) === "expired",
    );
    const wasCurrentAtPredecessor = predecessorDecision.evidenceRefs.every((ref) => {
      const item = evidence.get(ref);
      const rule = input.freshnessRules.find(
        (candidate) => candidate.evidenceKind === item?.kind,
      );
      const expiry = effectiveExpiry(item, rule);
      return expiry !== null && expiry >= predecessorClosedAt;
    });
    const currentDecision = decisionByCell.get(predecessorDecision.cellRef);
    const hasFreshReplacement = currentDecision?.evidenceRefs.some((ref) => {
      const item = evidence.get(ref);
      const requirement = requirements.get(
        cells.get(predecessorDecision.cellRef)?.requirementRef,
      );
      return (
        evidenceStates.get(ref) === "current" &&
        (item?.kind === requirement?.requiredEvidenceKind ||
          (currentDecision.decisionType === "exception-recorded" &&
            item?.kind === "exception-approval" &&
            item.cellRefs.includes(predecessorDecision.cellRef)))
      );
    });
    if (wasCurrentAtPredecessor && expiredAtCurrent.length > 0 && !hasFreshReplacement) {
      expectedReopenedCells.push(predecessorDecision.cellRef);
    }
  }
  const actualReopenedCells = input.decisions
    .filter((item) => item.decisionType === "evidence-expired-reopened")
    .map((item) => item.cellRef);
  if (!sameSet(actualReopenedCells, expectedReopenedCells)) {
    add(
      "inexact-evidence-reopening",
      "$.decisions",
      "Every predecessor decision whose relied evidence expired without replacement must reopen, and no other cell may reopen.",
      expectedReopenedCells,
    );
  }

  for (const [index, item] of input.decisions.entries()) {
    const cell = cells.get(item.cellRef);
    const requirement = requirements.get(cell?.requirementRef);
    const predecessorDecision = predecessorDecisions.get(
      item.predecessorDecisionRef,
    );
    const currentEvidence = item.evidenceRefs
      .map((ref) => evidence.get(ref))
      .filter(Boolean);
    if (
      !cell ||
      item.requirementCatalogRevision !== cycle.requirementCatalogRevision ||
      item.cellIndexRevision !== cycle.cellIndexRevision ||
      item.freshnessRuleRevision !== cycle.freshnessRuleRevision ||
      item.cellDigest !== computeCellDigest(cell) ||
      !principalWithRoleAt(item.decidedByRef, "reviewer", item.decidedAt) ||
      predecessorDecision?.cellRef !== item.cellRef ||
      timestamp(item.decidedAt) < cycleOpensAt ||
      timestamp(item.decidedAt) > cycleClosesAt ||
      timestamp(item.decidedAt) > sourceIssuedAt ||
      item.evidenceRefs.some((ref) => !evidence.has(ref)) ||
      currentEvidence.some(
        (evidenceItem) =>
          timestamp(evidenceItem.observedAt) > timestamp(item.decidedAt) ||
          !evidenceItem.cellRefs.includes(item.cellRef),
      )
    ) {
      add(
        "invalid-typed-human-decision",
        `$.decisions[${index}]`,
        "Every current cell requires one in-cycle typed human reviewer decision bound to its predecessor.",
        [item.id, item.cellRef],
      );
      continue;
    }
    const requirementEvidence = currentEvidence.filter(
      (candidate) =>
        candidate.kind === requirement?.requiredEvidenceKind &&
        candidate.cellRefs.includes(item.cellRef),
    );
    if (
      item.decisionType === "evidence-confirmed" &&
      (item.remediationRef !== null ||
        item.exceptionRef !== null ||
        requirementEvidence.length === 0 ||
        requirementEvidence.some(
          (candidate) => evidenceStates.get(candidate.id) !== "current",
        ))
    ) {
      add(
        "invalid-evidence-confirmed-decision",
        `$.decisions[${index}]`,
        "Evidence-confirmed decisions require current exact-cell evidence and no remediation or exception.",
        [item.id, item.cellRef],
      );
    }
    if (item.decisionType === "evidence-expired-reopened") {
      const remediation = remediations.get(item.remediationRef);
      const expiredPredecessorEvidenceRefs =
        predecessorDecision?.evidenceRefs.filter(
          (ref) => evidenceStates.get(ref) === "expired",
        ) ?? [];
      if (
        item.exceptionRef !== null ||
        expiredPredecessorEvidenceRefs.length === 0 ||
        !expiredPredecessorEvidenceRefs.every((ref) =>
          item.evidenceRefs.includes(ref),
        ) ||
        remediation?.cellRef !== item.cellRef ||
        remediation?.predecessorDecisionRef !== item.predecessorDecisionRef ||
        !item.evidenceRefs.includes(remediation?.evidenceRef)
      ) {
        add(
          "invalid-reopened-decision",
          `$.decisions[${index}]`,
          "A reopened decision must bind the exact expired requirement evidence, predecessor decision, and one open remediation.",
          [item.id, item.cellRef],
        );
      }
    }
    if (item.decisionType === "exception-recorded") {
      const exception = exceptions.get(item.exceptionRef);
      if (
        item.remediationRef !== null ||
        exception?.cellRef !== item.cellRef ||
        exception?.status !== "active" ||
        timestamp(exception?.expiresAt) < asOf ||
        !item.evidenceRefs.includes(exception?.evidenceRef) ||
        evidenceStates.get(exception?.evidenceRef) !== "current"
      ) {
        add(
          "invalid-exception-recorded-decision",
          `$.decisions[${index}]`,
          "An exception-recorded decision may only consume a current externally approved exact-cell exception.",
          [item.id, item.cellRef],
        );
      }
    }
  }

  for (const [index, remediation] of input.remediations.entries()) {
    const expiredEvidence = evidence.get(remediation.expiredEvidenceRef);
    const remediationEvidence = evidence.get(remediation.evidenceRef);
    const consumingDecisions = input.decisions.filter(
      (decision) =>
        decision.decisionType === "evidence-expired-reopened" &&
        decision.remediationRef === remediation.id &&
        decision.cellRef === remediation.cellRef,
    );
    if (
      !principalWithRoleAt(
        remediation.ownerRef,
        "remediation-owner",
        remediation.openedAt,
      ) ||
      evidenceStates.get(remediation.expiredEvidenceRef) !== "expired" ||
      !expiredEvidence?.cellRefs.includes(remediation.cellRef) ||
      predecessorDecisions.get(remediation.predecessorDecisionRef)?.cellRef !==
        remediation.cellRef ||
      !predecessorDecisions
        .get(remediation.predecessorDecisionRef)
        ?.evidenceRefs.includes(remediation.expiredEvidenceRef) ||
      remediationEvidence?.kind !== "remediation-record" ||
      remediationEvidence.subjectType !== "remediation" ||
      remediationEvidence.subjectRef !== remediation.id ||
      !sameSet(remediationEvidence.cellRefs, [remediation.cellRef]) ||
      remediationEvidence.suppliedByRef !== remediation.ownerRef ||
      evidenceStates.get(remediation.evidenceRef) !== "current" ||
      timestamp(remediationEvidence.observedAt) < timestamp(remediation.openedAt) ||
      timestamp(remediation.openedAt) <= effectiveExpiry(
        expiredEvidence,
        input.freshnessRules.find(
          (candidate) => candidate.evidenceKind === expiredEvidence?.kind,
        ),
      ) ||
      timestamp(remediation.dueAt) <= timestamp(remediation.openedAt) ||
      consumingDecisions.length !== 1
    ) {
      add(
        "invalid-expiry-remediation",
        `$.remediations[${index}]`,
        "Each remediation must be human-owned and causally reopen its exact predecessor cell after evidence expiry.",
        [remediation.id, remediation.cellRef],
      );
    }
  }

  for (const [index, exception] of input.exceptions.entries()) {
    const exceptionEvidence = evidence.get(exception.evidenceRef);
    const currentConsumers = input.decisions.filter(
      (decision) =>
        decision.decisionType === "exception-recorded" &&
        decision.exceptionRef === exception.id &&
        decision.cellRef === exception.cellRef,
    );
    const predecessorConsumers = predecessor.decisions.filter(
      (decision) =>
        decision.decisionType === "exception-recorded" &&
        decision.cellRef === exception.cellRef &&
        decision.evidenceRefs.includes(exception.evidenceRef),
    );
    const lifecycleValid =
      exception.status === "active"
        ? timestamp(exception.expiresAt) >= asOf &&
          evidenceStates.get(exception.evidenceRef) === "current" &&
          currentConsumers.length === 1
        : exception.status === "expired" &&
          timestamp(exception.expiresAt) < asOf &&
          evidenceStates.get(exception.evidenceRef) === "expired" &&
          currentConsumers.length === 0 &&
          predecessorConsumers.length === 1;
    if (
      !cells.has(exception.cellRef) ||
      !principalWithRoleAt(
        exception.approvedByRef,
        "exception-authority",
        exception.approvedAt,
      ) ||
      exception.scopeDigest !== computeExceptionScopeDigest(exception) ||
      exceptionEvidence?.kind !== "exception-approval" ||
      exceptionEvidence.subjectType !== "exception" ||
      exceptionEvidence.subjectRef !== exception.id ||
      !sameSet(exceptionEvidence.cellRefs, [exception.cellRef]) ||
      exceptionEvidence.suppliedByRef !== exception.approvedByRef ||
      timestamp(exceptionEvidence.observedAt) < timestamp(exception.approvedAt) ||
      timestamp(exception.approvedAt) > timestamp(exception.expiresAt) ||
      !lifecycleValid
    ) {
      add(
        "invalid-external-exception",
        `$.exceptions[${index}]`,
        "Each exception must be exact-cell scoped, externally approved, and either current-decision active or predecessor-decision expired.",
        [exception.id, exception.cellRef],
      );
    }
  }

  for (const [index, attempt] of input.riskAcceptanceAttempts.entries()) {
    if (
      !cells.has(attempt.cellRef) ||
      !principals.has(attempt.attemptedByRef) ||
      attempt.assertedAuthoritySourceRef !==
        principals.get(attempt.attemptedByRef)?.authoritySourceRef ||
      timestamp(principals.get(attempt.attemptedByRef)?.authorityObservedAt) >
        timestamp(attempt.attemptedAt) ||
      timestamp(attempt.attemptedAt) < cycleOpensAt ||
      timestamp(attempt.attemptedAt) > cycleClosesAt
    ) {
      add(
        "invalid-risk-acceptance-attempt-record",
        `$.riskAcceptanceAttempts[${index}]`,
        "The preserved out-of-scope attempt must name an existing cell, typed human, and in-cycle attempt time.",
        [attempt.id, attempt.cellRef, attempt.attemptedByRef],
      );
    }
  }

  if (
    input.sourceAuthority.ownerRef !== cycle.approvedByRef ||
    !principalWithRoleAt(
      input.sourceAuthority.ownerRef,
      "review-program-owner",
      input.sourceAuthority.issuedAt,
    ) ||
    sourceIssuedAt < cycleClosesAt ||
    sourceIssuedAt > asOf ||
    sourceIssuedAt <
      Math.max(
        ...input.decisions.map((item) => timestamp(item.decidedAt)),
        ...input.riskAcceptanceAttempts.map((item) => timestamp(item.attemptedAt)),
        ...input.remediations.map((item) => timestamp(item.openedAt)),
        ...input.exceptions.map((item) => timestamp(item.approvedAt)),
      )
  ) {
    add(
      "invalid-source-authority-chronology",
      "$.sourceAuthority",
      "The typed program owner must sign no earlier than cycle close, after all current actions, and no later than caller-controlled asOf.",
      [input.sourceAuthority.ownerRef],
    );
  }

  return uniqueSortedFindings(findings);
}

function resultFor(input, findings, asOf) {
  const freshnessByKind = new Map(
    input.freshnessRules.map((item) => [item.evidenceKind, item]),
  );
  const evidenceStates = input.evidence
    .map((item) => {
      const expiresAt = effectiveExpiry(item, freshnessByKind.get(item.kind));
      return {
        evidenceRef: item.id,
        kind: item.kind,
        state:
          expiresAt === null
            ? "invalid"
            : expiresAt < asOf
              ? "expired"
              : "current",
        effectiveExpiresAt:
          expiresAt === null ? null : new Date(expiresAt).toISOString(),
        cellRefs: [...item.cellRefs].sort(compareText),
        sourceClass: item.sourceClass,
      };
    })
    .sort((left, right) => compareText(left.evidenceRef, right.evidenceRef));
  const expiredById = new Set(
    evidenceStates
      .filter((item) => item.state === "expired")
      .map((item) => item.evidenceRef),
  );
  const blockers = [];
  for (const decision of input.decisions) {
    for (const evidenceRef of decision.evidenceRefs) {
      if (expiredById.has(evidenceRef)) {
        blockers.push({
          code: "evidence-expired",
          cellRef: decision.cellRef,
          subjectRef: evidenceRef,
        });
      }
    }
  }
  for (const remediation of input.remediations) {
    blockers.push({
      code: "remediation-open",
      cellRef: remediation.cellRef,
      subjectRef: remediation.id,
    });
  }
  for (const attempt of input.riskAcceptanceAttempts) {
    blockers.push({
      code: "unauthorized-risk-acceptance-attempt",
      cellRef: attempt.cellRef,
      subjectRef: attempt.id,
    });
  }
  if (
    findings.length > 0 &&
    !blockers.some((item) => item.code === "candidate-input-invalid")
  ) {
    blockers.push({
      code: "candidate-input-invalid",
      cellRef: null,
      subjectRef: input.artifactId,
    });
  }
  blockers.sort((left, right) =>
    compareText(
      `${left.code}\u0000${left.cellRef ?? ""}\u0000${left.subjectRef}`,
      `${right.code}\u0000${right.cellRef ?? ""}\u0000${right.subjectRef}`,
    ),
  );
  const cellRefs = input.requirementCatalog.cells
    .map((item) => item.id)
    .sort(compareText);
  const decisionRefs = input.decisions.map((item) => item.id).sort(compareText);
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    artifactId: input.artifactId,
    reviewCycleRef: input.cycle.id,
    evaluatedAt: new Date(asOf).toISOString(),
    requirementCatalogRevision: input.requirementCatalog.revision,
    cellIndexRevision: input.cycle.cellIndexRevision,
    freshnessRuleRevision: input.cycle.freshnessRuleRevision,
    scope: {
      vendorServiceRefs: input.vendorServices
        .map((item) => item.id)
        .sort(compareText),
      requirementRefs: input.requirementCatalog.requirements
        .map((item) => item.id)
        .sort(compareText),
      subprocessorRefs: input.subprocessors.map((item) => item.id).sort(compareText),
      publicTrustEvidenceRefs: input.evidence
        .filter((item) => item.sourceClass === "public-trust")
        .map((item) => item.id)
        .sort(compareText),
      remediationRefs: input.remediations.map((item) => item.id).sort(compareText),
      exceptionRefs: input.exceptions.map((item) => item.id).sort(compareText),
      riskAcceptanceAttemptRefs: input.riskAcceptanceAttempts
        .map((item) => item.id)
        .sort(compareText),
    },
    coverage: {
      declaredCellRefs: cellRefs,
      decisionCellRefs: input.decisions
        .map((item) => item.cellRef)
        .sort(compareText),
      coveredExactlyOnce:
        sameSet(
          input.decisions.map((item) => item.cellRef),
          cellRefs,
        ) && duplicateValues(input.decisions.map((item) => item.cellRef)).length === 0,
    },
    evidenceStates,
    reopenedCells: input.decisions
      .filter((item) => item.decisionType === "evidence-expired-reopened")
      .map((item) => ({
        cellRef: item.cellRef,
        predecessorDecisionRef: item.predecessorDecisionRef,
        remediationRef: item.remediationRef,
        expiredEvidenceRefs: item.evidenceRefs
          .filter((ref) => expiredById.has(ref))
          .sort(compareText),
      }))
      .sort((left, right) => compareText(left.cellRef, right.cellRef)),
    decisionRefs,
    blockers,
    findings,
    handoff: {
      state: blockers.length > 0 || findings.length > 0 ? "blocked" : "ready-for-owner-review",
      nextOwnerRef: input.cycle.handoffOwnerRef,
      cellRefs,
      decisionRefs,
      blockerCodes: [...new Set(blockers.map((item) => item.code))].sort(
        compareText,
      ),
      authorityClaims: { ...AUTHORITY_CLAIMS },
    },
  };
}

export function evaluateRecurringThirdPartyReview(input, options = {}) {
  const normalizedInput = normalizeJsonValue(input, {
    ...SLICE_LIMITS,
    maxBytes: SLICE_LIMITS.inputBytes,
  });
  if (normalizedInput.error !== null) {
    if (normalizedInput.error.startsWith("private-key-material")) {
      return {
        valid: false,
        findings: [
          finding(
            "private-key-material-prohibited",
            "$",
            "The review envelope must never contain private key material.",
          ),
        ],
        result: null,
      };
    }
    return {
      valid: false,
      findings: [
        finding(
          normalizedInput.error.includes("limit")
            ? "input-limit-exceeded"
            : "invalid-json-input",
          "$",
          "The review artifact could not be safely normalized within bounded JSON limits.",
        ),
      ],
      result: null,
    };
  }
  const candidate = normalizedInput.value;
  if (!isRecord(candidate)) {
    return {
      valid: false,
      findings: [
        finding(
          "invalid-json-input",
          "$",
          "The review artifact must be a bounded JSON object.",
        ),
      ],
      result: null,
    };
  }
  if (containsPrivateKeyMaterial(candidate)) {
    return {
      valid: false,
      findings: [
        finding(
          "private-key-material-prohibited",
          "$",
          "The review envelope must never contain private key material.",
        ),
      ],
      result: null,
    };
  }
  const normalizedContext = normalizeJsonValue(options ?? {}, {
    ...SLICE_LIMITS,
    maxBytes: SLICE_LIMITS.validationContextBytes,
  });
  if (normalizedContext.error !== null) {
    if (
      normalizedContext.error === "private-key-material-public-trust"
    ) {
      return {
        valid: false,
        findings: [
          finding(
            "invalid-public-trust-key",
            "$.validationContext",
            "The validation context must never contain private key material.",
          ),
        ],
        result: null,
      };
    }
    if (normalizedContext.error === "private-key-material") {
      return {
        valid: false,
        findings: [
          finding(
            "invalid-validation-context",
            "$.validationContext",
            "The validation context must never contain private key material.",
          ),
        ],
        result: null,
      };
    }
    return {
      valid: false,
      findings: [
        finding(
          "invalid-validation-context",
          "$.validationContext",
          "The validation context could not be safely normalized within bounded JSON limits.",
        ),
      ],
      result: null,
    };
  }
  const context = normalizedContext.value;
  if (!isRecord(context)) {
    return {
      valid: false,
      findings: [
        finding(
          "invalid-validation-context",
          "$.validationContext",
          "The validation context must be a bounded JSON object.",
        ),
      ],
      result: null,
    };
  }
  const findings = [];
  const nonTrustContext = { ...context };
  delete nonTrustContext.publicTrust;
  if (containsPrivateKeyMaterial(nonTrustContext)) {
    return {
      valid: false,
      findings: [
        finding(
          "invalid-validation-context",
          "$.validationContext",
          "The validation context must never contain private key material.",
        ),
      ],
      result: null,
    };
  }
  const asOf = timestamp(context.asOf);
  if (asOf === null) {
    findings.push(
      finding(
        "invalid-validation-context",
        "$.validationContext.asOf",
        "A caller-controlled zone-bearing RFC 3339 asOf is required; wall-clock time is never consulted.",
      ),
    );
  }
  const structuralFindings = schemaFindings(candidate);
  findings.push(...structuralFindings);
  if (structuralFindings.length === 0 && asOf !== null) {
    const trustFindings = publicTrustFindings(
      candidate,
      context.publicTrust,
      asOf,
    );
    findings.push(...trustFindings);
    if (
      !containsPrivateKeyMaterial(context.publicTrust) &&
      validatePublicTrustSchema(context.publicTrust)
    ) {
      findings.push(
        ...sourceReceiptFindings(
          candidate,
          context.sourceReceipts,
          context.publicTrust,
          asOf,
        ),
      );
      findings.push(
        ...semanticFindings(candidate, asOf, context.publicTrust),
      );
    }
  }
  const orderedFindings = uniqueSortedFindings(findings);
  return {
    valid: orderedFindings.length === 0,
    findings: orderedFindings,
    result:
      structuralFindings.length === 0 && asOf !== null
        ? resultFor(candidate, orderedFindings, asOf)
        : null,
  };
}

const examplePublicTrust = JSON.parse(
  readFileSync(new URL("fixtures/public-trust.example.json", sourceBaseUrl), "utf8"),
);
const exampleSourceReceipts = JSON.parse(
  readFileSync(new URL("fixtures/source-receipts.example.json", sourceBaseUrl), "utf8"),
);

export const RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS = Object.freeze({
  asOf: "2026-09-16T20:00:00Z",
  fixtureTrustProfile: "recurring-third-party-review-example",
  fixtureSourceProfile: "recurring-third-party-review-example",
});

export function recurringThirdPartyReviewFindings(input, options = RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS) {
  const normalizedOptions = normalizeJsonValue(options ?? {}, {
    ...SLICE_LIMITS,
    maxBytes: SLICE_LIMITS.validationContextBytes,
  });
  if (
    normalizedOptions.error !== null ||
    !isRecord(normalizedOptions.value)
  ) {
    return evaluateRecurringThirdPartyReview(input, options).findings;
  }
  const resolved = normalizedOptions.value;
  if (
    resolved.fixtureTrustProfile ===
    RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS.fixtureTrustProfile
  ) {
    resolved.publicTrust = structuredClone(examplePublicTrust);
  }
  if (
    resolved.fixtureSourceProfile ===
    RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS.fixtureSourceProfile
  ) {
    resolved.sourceReceipts = structuredClone(exampleSourceReceipts);
  }
  delete resolved.fixtureTrustProfile;
  delete resolved.fixtureSourceProfile;
  return evaluateRecurringThirdPartyReview(input, resolved).findings;
}

export function renderReviewProof(result) {
  if (!isRecord(result)) throw new TypeError("A derived review result is required.");
  const rows = result.reopenedCells
    .map(
      (item) =>
        `| ${item.cellRef} | ${item.expiredEvidenceRefs.join(", ")} | ${item.remediationRef} |`,
    )
    .join("\n");
  return `# Recurring Third-Party Review Evidence Reconciler proof

- Cycle: \`${result.reviewCycleRef}\`
- Caller-controlled asOf: \`${result.evaluatedAt}\`
- Requirement catalog revision: \`${result.requirementCatalogRevision}\`
- Cell-index revision: \`${result.cellIndexRevision}\`
- Freshness-rule revision: \`${result.freshnessRuleRevision}\`
- Exact cell coverage: **${result.coverage.coveredExactlyOnce ? "yes" : "no"}** (${result.coverage.decisionCellRefs.length}/${result.coverage.declaredCellRefs.length})
- Handoff: **${result.handoff.state}**

## Bounded scope

- Vendor/services: ${result.scope.vendorServiceRefs.map((ref) => `\`${ref}\``).join(", ")}
- Subprocessors: ${result.scope.subprocessorRefs.map((ref) => `\`${ref}\``).join(", ") || "none"}
- Public trust evidence: ${result.scope.publicTrustEvidenceRefs.map((ref) => `\`${ref}\``).join(", ") || "none"}
- External exception: ${result.scope.exceptionRefs.map((ref) => `\`${ref}\``).join(", ")}
- Preserved risk-acceptance attempt: ${result.scope.riskAcceptanceAttemptRefs.map((ref) => `\`${ref}\``).join(", ")}

## Reopened cells

| Cell | Expired evidence | Remediation |
| --- | --- | --- |
${rows || "| None | None | None |"}

## Exact blockers

${result.blockers.map((item) => `- \`${item.code}\`: ${item.cellRef ?? "artifact"} / ${item.subjectRef}`).join("\n")}

## Retained authority

All scoring, selection, vendor contact, contract interpretation, certification,
risk acceptance, exception approval, onboarding, renewal, termination,
purchase, and mutation claims are structurally \`false\`.
`;
}

function cliFailure(code) {
  return {
    valid: false,
    findings: [
      {
        code,
        path: "$",
        message: "The bounded CLI input was rejected.",
        refs: [],
      },
    ],
    result: null,
  };
}

function readBoundedJson(path, maxBytes) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total <= maxBytes) {
      const read = readSync(
        descriptor,
        buffer,
        total,
        maxBytes + 1 - total,
        null,
      );
      if (read === 0) break;
      total += read;
    }
    if (total > maxBytes) {
      throw new RangeError("bounded file rejected");
    }
    return JSON.parse(buffer.subarray(0, total).toString("utf8"));
  } finally {
    closeSync(descriptor);
  }
}

async function runCli() {
  const [inputPath, asOf, publicTrustPath, sourceReceiptsPath] =
    process.argv.slice(2);
  if (!inputPath || !asOf || !publicTrustPath || !sourceReceiptsPath) {
    process.stdout.write(`${JSON.stringify(cliFailure("invalid-cli-input"))}\n`);
    process.exitCode = 2;
    return;
  }
  let evaluation;
  try {
    const input = readBoundedJson(inputPath, SLICE_LIMITS.inputBytes);
    const publicTrust = readBoundedJson(
      publicTrustPath,
      SLICE_LIMITS.validationContextBytes,
    );
    const sourceReceipts = readBoundedJson(
      sourceReceiptsPath,
      SLICE_LIMITS.validationContextBytes,
    );
    evaluation = evaluateRecurringThirdPartyReview(input, {
      asOf,
      publicTrust,
      sourceReceipts,
    });
  } catch {
    evaluation = cliFailure("invalid-cli-file");
  }
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
  if (!evaluation.valid) process.exitCode = 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() ===
    process.argv[1].toLowerCase()
) {
  await runCli();
}
