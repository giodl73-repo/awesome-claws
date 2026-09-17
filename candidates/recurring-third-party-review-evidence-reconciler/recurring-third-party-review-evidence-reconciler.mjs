import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const SLICE_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerSlice.v1";
export const RESULT_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerResult.v1";
export const PUBLIC_TRUST_SCHEMA_VERSION =
  "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerPublicTrust.v1";
export const SLICE_LIMITS = Object.freeze({
  inputBytes: 1024 * 1024,
  evidenceRecords: 24,
  publicTrustSigners: 8,
});

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u;
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

const schema = JSON.parse(
  readFileSync(
    new URL(
      "./schemas/recurring-third-party-review-evidence-reconciler.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function containsPrivateKeyMaterial(value, seen = new Set()) {
  if (typeof value === "string") {
    return /-----BEGIN (?:ENCRYPTED )?PRIVATE KEY-----/u.test(value);
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
      /private.*key|key.*private/iu.test(key) ||
      containsPrivateKeyMaterial(nested, seen),
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
      `Identity ${JSON.stringify(id)} appears more than once in the candidate envelope.`,
      [id],
    ),
  );
}

function publicTrustFindings(input, trustStore, asOf) {
  const findings = [];
  try {
    JSON.stringify(trustStore);
  } catch (error) {
    return [
      finding(
        "invalid-public-trust-input",
        "$.validationContext.publicTrust",
        `Public trust input must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}.`,
      ),
    ];
  }
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
  if (
    !isRecord(trustStore) ||
    trustStore.schemaVersion !== PUBLIC_TRUST_SCHEMA_VERSION ||
    !Array.isArray(trustStore.signers) ||
    trustStore.signers.length === 0 ||
    trustStore.signers.length > SLICE_LIMITS.publicTrustSigners
  ) {
    return [
      finding(
        "invalid-public-trust-input",
        "$.validationContext.publicTrust",
        "Validation requires an explicitly injected bounded public signer trust input.",
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
    /-----BEGIN (?:ENCRYPTED )?PRIVATE KEY-----/u.test(signer.publicKeyPem)
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
        "The complete candidate input does not match its injected public trust signature.",
        [input.sourceAuthority.ownerRef, input.sourceAuthority.signingKeyId],
      ),
    );
  }
  return findings;
}

function inputLimitFindings(input) {
  if (!isRecord(input)) {
    return [
      finding(
        "invalid-json-input",
        "$",
        "The candidate input must be a JSON object.",
      ),
    ];
  }
  let serialized;
  try {
    serialized = JSON.stringify(input);
  } catch (error) {
    return [
      finding(
        "invalid-json-input",
        "$",
        `The candidate input must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}.`,
      ),
    ];
  }
  const byteLength = Buffer.byteLength(serialized, "utf8");
  const evidenceCount = Array.isArray(input?.evidence) ? input.evidence.length : 0;
  const findings = [];
  if (byteLength > SLICE_LIMITS.inputBytes) {
    findings.push(
      finding(
        "input-limit-exceeded",
        "$",
        `Candidate input is ${byteLength} bytes; the bounded slice limit is ${SLICE_LIMITS.inputBytes}.`,
      ),
    );
  }
  if (evidenceCount > SLICE_LIMITS.evidenceRecords) {
    findings.push(
      finding(
        "evidence-limit-exceeded",
        "$.evidence",
        `Candidate input has ${evidenceCount} evidence records; the bounded slice limit is ${SLICE_LIMITS.evidenceRecords}.`,
      ),
    );
  }
  return findings;
}

function effectiveExpiry(evidence, freshnessRule) {
  const observedAt = timestamp(evidence?.observedAt);
  const validUntil = timestamp(evidence?.validUntil);
  if (observedAt === null || validUntil === null || !Number.isInteger(freshnessRule?.maxAgeDays)) {
    return null;
  }
  return Math.min(validUntil, observedAt + freshnessRule.maxAgeDays * 86_400_000);
}

function evidenceState(evidence, rule, asOf) {
  const expiry = effectiveExpiry(evidence, rule);
  if (expiry === null) return "invalid";
  return expiry < asOf ? "expired" : "current";
}

function semanticFindings(input, asOf) {
  const findings = [...globalIdentityFindings(input)];
  const principals = mapById(input.principals);
  const vendorServices = mapById(input.vendorServices);
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
    ["vendor-service-owner", 2],
    ["evidence-custodian", 1],
    ["reviewer", 1],
    ["remediation-owner", 1],
    ["exception-authority", 1],
  ]);
  for (const [role, expectedCount] of expectedRoleCounts) {
    const actualCount = input.principals.filter((item) => item.role === role).length;
    if (actualCount !== expectedCount) {
      add(
        "invalid-principal-role-cardinality",
        "$.principals",
        `The bounded slice requires exactly ${expectedCount} typed human ${role} principal${expectedCount === 1 ? "" : "s"}.`,
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
      "The owner-approved requirement catalog revision must bind its exact four requirements.",
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
  if (catalog.cells.length !== 6) {
    add(
      "invalid-cell-index-cardinality",
      "$.requirementCatalog.cells",
      "This bounded falsification slice requires exactly six owner-declared cells.",
    );
  }
  if (
    catalog.cells.length ===
    input.vendorServices.length * catalog.requirements.length
  ) {
    add(
      "derived-cartesian-cell-index",
      "$.requirementCatalog.cells",
      "Applicability must be supplied as an explicit owner-declared index, not a vendor-by-requirement Cartesian product.",
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
    duplicateValues(input.vendorServices.map((item) => item.vendorId)).length > 0 ||
    duplicateValues(input.vendorServices.map((item) => item.serviceId)).length > 0 ||
    duplicateValues(input.vendorServices.map((item) => item.ownerRef)).length > 0 ||
    !sameSet(
      input.vendorServices.map((item) => item.ownerRef),
      serviceOwnerRefs,
    ) ||
    input.vendorServices.some(
      (service) =>
        !catalog.cells.some((cell) => cell.vendorServiceRef === service.id),
    ) ||
    catalog.requirements.some(
      (requirement) =>
        !catalog.cells.some((cell) => cell.requirementRef === requirement.id),
    )
  ) {
    add(
      "invalid-vendor-service-universe",
      "$.vendorServices",
      "The bounded universe requires two distinct vendor and service identities, with every service and catalog requirement represented by at least one declared cell.",
      serviceRefs,
    );
  }
  const sharedSubprocessor = input.subprocessors[0];
  if (
    !sameSet(sharedSubprocessor.serviceRefs, serviceRefs) ||
    input.vendorServices.some(
      (service) => !sameSet(service.subprocessorRefs, [sharedSubprocessor.id]),
    )
  ) {
    add(
      "invalid-shared-subprocessor-binding",
      "$.subprocessors",
      "The one shared subprocessor must bind reciprocally to both and only the two reviewed vendor services.",
      [sharedSubprocessor.id],
    );
  }
  const subprocessorEvidence = evidence.get(sharedSubprocessor.declarationEvidenceRef);
  const subprocessorCells = catalog.cells
    .filter(
      (cell) =>
        requirements.get(cell.requirementRef)?.requiredEvidenceKind ===
        "subprocessor-disclosure",
    )
    .map((cell) => cell.id);
  if (
    subprocessorEvidence?.kind !== "subprocessor-disclosure" ||
    subprocessorEvidence.subjectType !== "subprocessor" ||
    subprocessorEvidence.subjectRef !== sharedSubprocessor.id ||
    !sameSet(subprocessorEvidence.cellRefs, subprocessorCells)
  ) {
    add(
      "invalid-shared-subprocessor-evidence",
      "$.subprocessors[0].declarationEvidenceRef",
      "The shared subprocessor disclosure must cover exactly its two explicit requirement cells.",
      [sharedSubprocessor.id],
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
      "The cycle must consume an external owner approval record; the candidate cannot approve its own cycle.",
      [cycle.id, cycle.approvalEvidenceRef],
    );
  }

  const publicEvidence = input.evidence.filter(
    (item) => item.sourceClass === "public-trust",
  );
  if (
    publicEvidence.length !== 1 ||
    !publicEvidence[0].sourceRef.startsWith("https://")
  ) {
    add(
      "invalid-public-trust-evidence",
      "$.evidence",
      "The bounded slice requires exactly one HTTPS public-trust evidence input.",
      publicEvidence.map((item) => item.id),
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
    if (timestamp(item.validUntil) <= timestamp(item.observedAt)) {
      add(
        "invalid-evidence-validity-window",
        `$.evidence[${index}].validUntil`,
        "Evidence valid-until must be later than its observation time.",
        [item.id],
      );
    }
    if (
      (item.sourceClass === "public-trust" &&
        !item.sourceRef.startsWith("https://")) ||
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
          "Evidence cell references must resolve inside the exact six-cell index.",
          [item.id, cellRef],
        );
      }
    }
  }
  const expiredReports = input.evidence.filter(
    (item) =>
      item.kind === "assurance-report" &&
      evidenceStates.get(item.id) === "expired",
  );
  if (expiredReports.length !== 1) {
    add(
      "invalid-expired-report-cardinality",
      "$.evidence",
      "This bounded slice requires exactly one expired assurance report.",
      expiredReports.map((item) => item.id),
    );
  }
  if (
    expiredReports.length === 1 &&
    (publicEvidence.length !== 1 || publicEvidence[0].id !== expiredReports[0].id)
  ) {
    add(
      "invalid-public-trust-report-binding",
      "$.evidence",
      "The one public-trust input must be the one expired assurance report exercised by this bounded slice.",
      [...publicEvidence, ...expiredReports].map((item) => item.id),
    );
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
    sharedSubprocessor.declarationEvidenceRef,
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
      "Every supplied evidence record must be consumed by the exact cycle, applicability, decision, remediation, exception, or shared-subprocessor contract.",
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
        item?.kind === requirement?.requiredEvidenceKind &&
        evidenceStates.get(ref) === "current"
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
      if (
        item.exceptionRef !== null ||
        requirementEvidence.length === 0 ||
        !requirementEvidence.some(
          (candidate) => evidenceStates.get(candidate.id) === "expired",
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
        "The one remediation must be human-owned and causally reopen the exact predecessor cell after evidence expiry.",
        [remediation.id, remediation.cellRef],
      );
    }
  }

  for (const [index, exception] of input.exceptions.entries()) {
    const exceptionEvidence = evidence.get(exception.evidenceRef);
    const consumingDecisions = input.decisions.filter(
      (decision) =>
        decision.decisionType === "exception-recorded" &&
        decision.exceptionRef === exception.id &&
        decision.cellRef === exception.cellRef,
    );
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
      timestamp(exception.expiresAt) < asOf ||
      consumingDecisions.length !== 1
    ) {
      add(
        "invalid-external-exception",
        `$.exceptions[${index}]`,
        "The one exception must be current, exact-cell scoped, and supplied by a distinct typed human authority.",
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
      sharedSubprocessorRef: input.subprocessors[0].id,
      publicTrustEvidenceRef: input.evidence.find(
        (item) => item.sourceClass === "public-trust",
      )?.id ?? null,
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
  const findings = [...inputLimitFindings(input)];
  if (findings.some((item) => item.code === "invalid-json-input")) {
    return { valid: false, findings, result: null };
  }
  const asOf = timestamp(options.asOf);
  if (asOf === null) {
    findings.push(
      finding(
        "invalid-validation-context",
        "$.validationContext.asOf",
        "A caller-controlled zone-bearing RFC 3339 asOf is required; wall-clock time is never consulted.",
      ),
    );
  }
  const structuralFindings = schemaFindings(input);
  findings.push(...structuralFindings);
  if (structuralFindings.length === 0 && asOf !== null) {
    findings.push(...publicTrustFindings(input, options.publicTrust, asOf));
    findings.push(...semanticFindings(input, asOf));
  }
  const orderedFindings = uniqueSortedFindings(findings);
  return {
    valid: orderedFindings.length === 0,
    findings: orderedFindings,
    result:
      structuralFindings.length === 0 && asOf !== null
        ? resultFor(input, orderedFindings, asOf)
        : null,
  };
}

export function assessComplianceContractComposition({
  complianceSchema,
  complianceValidatorSource,
  contractSchema,
  contractValidatorSource,
  capabilityAudit,
}) {
  const currentSourceDigests = {
    complianceSchema: sha256Digest(complianceSchema),
    complianceValidator: sha256Digest(String(complianceValidatorSource)),
    contractSchema: sha256Digest(contractSchema),
    contractValidator: sha256Digest(String(contractValidatorSource)),
  };
  const auditRows = records(capabilityAudit?.invariants);
  const auditIds = auditRows.map((item) => item.id);
  const auditValid =
    capabilityAudit?.schemaVersion ===
      "awesomeClaws.complianceContractCompositionAudit.v1" &&
    isRecord(capabilityAudit.sources) &&
    canonicalJson(capabilityAudit.sources) === canonicalJson(currentSourceDigests) &&
    sameSet(auditIds, COMPOSITION_INVARIANT_IDS) &&
    duplicateValues(auditIds).length === 0 &&
    auditRows.every(
      (item) =>
        ["preserved", "not-preserved"].includes(item.compliance) &&
        ["preserved", "not-preserved"].includes(item.contract) &&
        ["preserved", "not-preserved-without-sidecar"].includes(
          item.composition,
        ) &&
        typeof item.rationale === "string" &&
        item.rationale.length > 0 &&
        Array.isArray(item.sourceRefs) &&
        item.sourceRefs.length > 0,
    );
  const invariants = COMPOSITION_INVARIANT_IDS.map((id) => {
    const audited = auditRows.find((item) => item.id === id);
    return {
      id,
      compliance: audited?.compliance ?? "not-audited",
      contract: audited?.contract ?? "not-audited",
      composition: audited?.composition ?? "not-audited",
      preserved: audited?.composition === "preserved",
      rationale: audited?.rationale ?? "",
      sourceRefs: Array.isArray(audited?.sourceRefs)
        ? [...audited.sourceRefs]
        : [],
    };
  });
  const preservesAllInvariants =
    auditValid && invariants.every((item) => item.preserved);
  return {
    auditValid,
    currentSourceDigests,
    preservesAllInvariants,
    verdict: !auditValid
      ? "reaudit-required"
      : preservesAllInvariants
        ? "reject-candidate"
        : "reject-compliance-plus-contract-composition",
    invariants,
    deletionTarget:
      "Delete this candidate when the strict Compliance Reviewer and Contract Obligation Tracker composition preserves every listed invariant without an untyped sidecar.",
  };
}

export function renderReviewProof(result) {
  if (!isRecord(result)) throw new TypeError("A derived review result is required.");
  const rows = result.reopenedCells
    .map(
      (item) =>
        `| ${item.cellRef} | ${item.expiredEvidenceRefs.join(", ")} | ${item.remediationRef} |`,
    )
    .join("\n");
  return `# Recurring Third-Party Review Evidence Reconciler candidate proof

- Cycle: \`${result.reviewCycleRef}\`
- Caller-controlled asOf: \`${result.evaluatedAt}\`
- Requirement catalog revision: \`${result.requirementCatalogRevision}\`
- Cell-index revision: \`${result.cellIndexRevision}\`
- Freshness-rule revision: \`${result.freshnessRuleRevision}\`
- Exact cell coverage: **${result.coverage.coveredExactlyOnce ? "yes" : "no"}** (${result.coverage.decisionCellRefs.length}/${result.coverage.declaredCellRefs.length})
- Handoff: **${result.handoff.state}**

## Bounded scope

- Vendor/services: ${result.scope.vendorServiceRefs.map((ref) => `\`${ref}\``).join(", ")}
- Shared subprocessor: \`${result.scope.sharedSubprocessorRef}\`
- Public trust evidence: \`${result.scope.publicTrustEvidenceRef}\`
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

async function runCli() {
  const [inputPath, asOf, publicTrustPath] = process.argv.slice(2);
  if (!inputPath || !asOf || !publicTrustPath) {
    process.stderr.write(
      "Usage: node recurring-third-party-review-evidence-reconciler.mjs <input.json> <asOf> <public-trust.json>\n",
    );
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const publicTrust = JSON.parse(readFileSync(publicTrustPath, "utf8"));
  const evaluation = evaluateRecurringThirdPartyReview(input, {
    asOf,
    publicTrust,
  });
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
