import { createHash } from "node:crypto";

export const CONTRACT_OBLIGATION_TRACKER_SCHEMA_VERSION =
  "awesomeClaws.contractObligationTracker.v1";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const VERSION_PATTERN = /^v[1-9][0-9]*$/u;
const HUMAN_NAME_PATTERN = /^[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*){0,3}$/u;
const CLAUSE_PATTERN = /^[A-Z0-9]+(?:[.-][A-Z0-9]+){0,7}$/u;
const CONTRACT_OWNER_REVIEW_QUEUE = "contract-owner-review-queue";
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const PROHIBITED_CLAIM_PATTERN =
  /(?:^|[^a-z])(?:acceptance|accepted|action|advice|amendment|amended|assurance|assured|audit|audited|compliance|compliant|dispute|extracted|extraction|interpreted|interpretation|legal|message|mutation|mutated|notice|payment|renewal|renewed|sent|terminated|termination|waiver|waived|closed)(?:[^a-z]|$)/iu;

const TOP_FIELDS = [
  "schemaVersion",
  "artifactId",
  "round",
  "agreements",
  "register",
  "obligations",
  "principals",
  "authorityRoster",
  "authorityGrants",
  "observations",
  "blockers",
  "evidence",
  "coverage",
  "destinationApproval",
  "handoff",
];
const ROUND_FIELDS = [
  "id",
  "registerRef",
  "registerVersion",
  "registerDigest",
  "agreementVersionRefs",
  "authorityRosterRef",
  "authorityRosterDigest",
  "opensAt",
  "closesAt",
  "destination",
  "destinationApproverRef",
  "handoffOwnerRef",
  "roundDigest",
];
const AGREEMENT_FIELDS = [
  "id",
  "agreementId",
  "version",
  "executedAt",
  "repositoryRef",
  "contentDigest",
  "sourceEvidenceRef",
];
const REGISTER_FIELDS = [
  "id",
  "version",
  "confirmedAt",
  "confirmedByRef",
  "sourceSystemRef",
  "agreementVersionRefs",
  "obligationRefs",
  "contentDigest",
  "evidenceRef",
];
const OBLIGATION_FIELDS = [
  "id",
  "agreementVersionRef",
  "responsibleOwnerRef",
  "clauseLocator",
  "clauseDigest",
  "obligationDigest",
  "dueAt",
  "performanceEvidenceSupplierRef",
  "requiredEvidenceRefs",
];
const PRINCIPAL_FIELDS = ["id", "name", "kind", "scopes"];
const ROSTER_FIELDS = [
  "id",
  "version",
  "issuedAt",
  "custodianRef",
  "principalRefs",
  "contentDigest",
  "evidenceRef",
];
const GRANT_FIELDS = [
  "id",
  "obligationRef",
  "granteeRef",
  "issuedByRef",
  "scope",
  "activeFrom",
  "activeUntil",
  "rosterRef",
  "rosterDigest",
  "evidenceRef",
  "payloadDigest",
];
const OBSERVATION_FIELDS = [
  "id",
  "obligationRef",
  "agreementVersionRef",
  "clauseDigest",
  "obligationDigest",
  "ownerRef",
  "state",
  "dueState",
  "observedAt",
  "reliedEvidenceRefs",
  "observationEvidenceRef",
  "completion",
];
const COMPLETION_FIELDS = [
  "confirmedByRef",
  "confirmedAt",
  "authorityGrantRef",
  "confirmationEvidenceRef",
];
const BLOCKER_FIELDS = [
  "id",
  "obligationRef",
  "category",
  "detectedAt",
  "ownerRef",
  "exactMissingEvidenceRefs",
  "evidenceRef",
];
const EVIDENCE_FIELDS = [
  "id",
  "kind",
  "roundRef",
  "roundDigest",
  "observedAt",
  "suppliedByRef",
  "subjectRefs",
  "sourceRecordDigest",
  "payloadDigest",
  "recordDigest",
];
const COVERAGE_FIELDS = [
  "registerRef",
  "registerVersion",
  "registerDigest",
  "entries",
  "contentDigest",
];
const COVERAGE_ENTRY_FIELDS = ["obligationRef", "resolutionKind", "resolutionRef"];
const DESTINATION_FIELDS = [
  "id",
  "roundRef",
  "roundDigest",
  "registerRef",
  "registerDigest",
  "coverageDigest",
  "destination",
  "approvedByRef",
  "approvedAt",
  "evidenceRef",
  "payloadDigest",
];
const HANDOFF_DISCLAIMER_FIELDS = [
  "legalConclusionClaim",
  "performanceAcceptanceClaim",
  "complianceClaim",
  "auditClaim",
  "noticeSentClaim",
  "paymentMadeClaim",
  "amendmentClaim",
  "renewalClaim",
  "terminationClaim",
  "systemMutationClaim",
];
const HANDOFF_FIELDS = [
  "id",
  "roundRef",
  "roundDigest",
  "registerRef",
  "registerDigest",
  "coverageDigest",
  "destinationApprovalRef",
  "destinationApprovalDigest",
  "state",
  "nextOwnerRef",
  "handedOffAt",
  "observationRefs",
  "blockerRefs",
  ...HANDOFF_DISCLAIMER_FIELDS,
  "evidenceRef",
  "payloadDigest",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function compareUtf16CodeUnits(left, right) {
  const a = String(left);
  const b = String(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort(compareUtf16CodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonInner(value[key], next)}`)
      .join(",")}}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "bigint") return JSON.stringify(String(value));
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  return "null";
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function sorted(values) {
  return strings(values).sort(compareUtf16CodeUnits);
}

function sameExactSet(actual, expected) {
  const left = sorted(actual);
  const right = sorted(expected);
  return (
    Array.isArray(actual) &&
    Array.isArray(expected) &&
    left.length === actual.length &&
    right.length === expected.length &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function timestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function principalPayload(row) {
  const value = object(row);
  return {
    id: value.id ?? null,
    kind: value.kind ?? null,
    name: value.name ?? null,
    scopes: sorted(value.scopes),
  };
}

function obligationPayload(row) {
  const value = object(row);
  return {
    agreementVersionRef: value.agreementVersionRef ?? null,
    clauseDigest: value.clauseDigest ?? null,
    clauseLocator: value.clauseLocator ?? null,
    dueAt: value.dueAt ?? null,
    id: value.id ?? null,
    obligationDigest: value.obligationDigest ?? null,
    performanceEvidenceSupplierRef: value.performanceEvidenceSupplierRef ?? null,
    requiredEvidenceRefs: sorted(value.requiredEvidenceRefs),
    responsibleOwnerRef: value.responsibleOwnerRef ?? null,
  };
}

function agreementPayload(row) {
  const value = object(row);
  return {
    agreementId: value.agreementId ?? null,
    contentDigest: value.contentDigest ?? null,
    executedAt: value.executedAt ?? null,
    id: value.id ?? null,
    version: value.version ?? null,
  };
}

export function computeRegisterDigest(register, obligations, agreements) {
  const value = object(register);
  return digest({
    agreements: records(agreements)
      .map(agreementPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id)),
    agreementVersionRefs: sorted(value.agreementVersionRefs),
    confirmedAt: value.confirmedAt ?? null,
    confirmedByRef: value.confirmedByRef ?? null,
    id: value.id ?? null,
    obligationRefs: sorted(value.obligationRefs),
    obligations: records(obligations)
      .map(obligationPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id)),
    sourceSystemRef: value.sourceSystemRef ?? null,
    version: value.version ?? null,
  });
}

export function computeAuthorityRosterDigest(principals) {
  return digest(
    records(principals)
      .map(principalPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id)),
  );
}

export function computeAuthorityGrantDigest(grant) {
  const value = object(grant);
  return digest({
    activeFrom: value.activeFrom ?? null,
    activeUntil: value.activeUntil ?? null,
    evidenceRef: value.evidenceRef ?? null,
    granteeRef: value.granteeRef ?? null,
    id: value.id ?? null,
    issuedByRef: value.issuedByRef ?? null,
    obligationRef: value.obligationRef ?? null,
    rosterDigest: value.rosterDigest ?? null,
    rosterRef: value.rosterRef ?? null,
    scope: value.scope ?? null,
  });
}

export function computeRoundDigest(round, artifactIdentity) {
  const value = object(round);
  const identity = object(artifactIdentity);
  return digest({
    agreementVersionRefs: sorted(value.agreementVersionRefs),
    artifactId: identity.artifactId ?? null,
    authorityRosterDigest: value.authorityRosterDigest ?? null,
    authorityRosterRef: value.authorityRosterRef ?? null,
    closesAt: value.closesAt ?? null,
    destination: value.destination ?? null,
    destinationApproverRef: value.destinationApproverRef ?? null,
    handoffOwnerRef: value.handoffOwnerRef ?? null,
    id: value.id ?? null,
    opensAt: value.opensAt ?? null,
    registerDigest: value.registerDigest ?? null,
    registerRef: value.registerRef ?? null,
    registerVersion: value.registerVersion ?? null,
    schemaVersion: identity.schemaVersion ?? null,
  });
}

function observationPayload(row) {
  const value = object(row);
  const completion = value.completion === null ? null : object(value.completion);
  return {
    agreementVersionRef: value.agreementVersionRef ?? null,
    clauseDigest: value.clauseDigest ?? null,
    completion:
      completion === null
        ? null
        : {
            authorityGrantRef: completion.authorityGrantRef ?? null,
            confirmationEvidenceRef: completion.confirmationEvidenceRef ?? null,
            confirmedAt: completion.confirmedAt ?? null,
            confirmedByRef: completion.confirmedByRef ?? null,
          },
    dueState: value.dueState ?? null,
    id: value.id ?? null,
    obligationDigest: value.obligationDigest ?? null,
    obligationRef: value.obligationRef ?? null,
    observedAt: value.observedAt ?? null,
    observationEvidenceRef: value.observationEvidenceRef ?? null,
    ownerRef: value.ownerRef ?? null,
    reliedEvidenceRefs: sorted(value.reliedEvidenceRefs),
    state: value.state ?? null,
  };
}

function blockerPayload(row) {
  const value = object(row);
  return {
    category: value.category ?? null,
    detectedAt: value.detectedAt ?? null,
    evidenceRef: value.evidenceRef ?? null,
    exactMissingEvidenceRefs: sorted(value.exactMissingEvidenceRefs),
    id: value.id ?? null,
    obligationRef: value.obligationRef ?? null,
    ownerRef: value.ownerRef ?? null,
  };
}

function compareCanonical(left, right) {
  return compareUtf16CodeUnits(canonicalJson(left), canonicalJson(right));
}

function coverageSupportPayload(coverage, artifact) {
  const value = object(artifact);
  const entries = records(object(coverage).entries);
  const observationRefs = new Set(
    entries
      .filter((entry) => entry.resolutionKind === "observation")
      .map((entry) => entry.resolutionRef),
  );
  const blockerRefs = new Set(
    entries
      .filter((entry) => entry.resolutionKind === "blocker")
      .map((entry) => entry.resolutionRef),
  );
  const observations = records(value.observations).filter((row) => observationRefs.has(row.id));
  const blockers = records(value.blockers).filter((row) => blockerRefs.has(row.id));
  const grantRefs = new Set(
    observations.map((row) => object(row.completion).authorityGrantRef),
  );
  const grants = records(value.authorityGrants).filter((row) => grantRefs.has(row.id));
  const evidenceRefs = new Set(
    observations.flatMap((row) => [
      ...strings(row.reliedEvidenceRefs),
      row.observationEvidenceRef,
      object(row.completion).confirmationEvidenceRef,
    ]),
  );
  for (const blocker of blockers) evidenceRefs.add(blocker.evidenceRef);
  for (const grant of grants) evidenceRefs.add(grant.evidenceRef);

  return {
    authorityGrants: grants
      .map((row) => ({
        id: row.id ?? null,
        payloadDigest: computeAuthorityGrantDigest(row),
      }))
      .sort(compareCanonical),
    blockers: blockers.map(blockerPayload).sort(compareCanonical),
    evidenceRecords: records(value.evidence)
      .filter((row) => evidenceRefs.has(row.id))
      .map((row) => {
        const payloadDigest = computeEvidencePayloadDigest(row.kind, value, row.id);
        return {
          id: row.id ?? null,
          payloadDigest,
          recordDigest: computeEvidenceRecordDigest({ ...row, payloadDigest }),
        };
      })
      .sort(compareCanonical),
    observations: observations.map(observationPayload).sort(compareCanonical),
  };
}

export function computeCoverageDigest(coverage, artifact) {
  const value = object(coverage);
  return digest({
    entries: records(value.entries)
      .map((entry) => ({
        obligationRef: entry.obligationRef ?? null,
        resolutionKind: entry.resolutionKind ?? null,
        resolutionRef: entry.resolutionRef ?? null,
      }))
      .sort((left, right) => compareUtf16CodeUnits(left.obligationRef, right.obligationRef)),
    registerDigest: value.registerDigest ?? null,
    registerRef: value.registerRef ?? null,
    registerVersion: value.registerVersion ?? null,
    support: coverageSupportPayload(value, artifact),
  });
}

export function computeDestinationApprovalDigest(approval) {
  const value = object(approval);
  return digest({
    approvedAt: value.approvedAt ?? null,
    approvedByRef: value.approvedByRef ?? null,
    coverageDigest: value.coverageDigest ?? null,
    destination: value.destination ?? null,
    evidenceRef: value.evidenceRef ?? null,
    id: value.id ?? null,
    registerDigest: value.registerDigest ?? null,
    registerRef: value.registerRef ?? null,
    roundDigest: value.roundDigest ?? null,
    roundRef: value.roundRef ?? null,
  });
}

export function computeHandoffDigest(handoff) {
  const value = object(handoff);
  return digest({
    amendmentClaim: value.amendmentClaim ?? null,
    auditClaim: value.auditClaim ?? null,
    blockerRefs: sorted(value.blockerRefs),
    complianceClaim: value.complianceClaim ?? null,
    coverageDigest: value.coverageDigest ?? null,
    destinationApprovalDigest: value.destinationApprovalDigest ?? null,
    destinationApprovalRef: value.destinationApprovalRef ?? null,
    evidenceRef: value.evidenceRef ?? null,
    handedOffAt: value.handedOffAt ?? null,
    id: value.id ?? null,
    legalConclusionClaim: value.legalConclusionClaim ?? null,
    nextOwnerRef: value.nextOwnerRef ?? null,
    noticeSentClaim: value.noticeSentClaim ?? null,
    observationRefs: sorted(value.observationRefs),
    paymentMadeClaim: value.paymentMadeClaim ?? null,
    performanceAcceptanceClaim: value.performanceAcceptanceClaim ?? null,
    registerDigest: value.registerDigest ?? null,
    registerRef: value.registerRef ?? null,
    renewalClaim: value.renewalClaim ?? null,
    roundDigest: value.roundDigest ?? null,
    roundRef: value.roundRef ?? null,
    state: value.state ?? null,
    systemMutationClaim: value.systemMutationClaim ?? null,
    terminationClaim: value.terminationClaim ?? null,
  });
}

function evidenceRawPayload(row) {
  const value = object(row);
  return {
    id: value.id ?? null,
    kind: value.kind ?? null,
    observedAt: value.observedAt ?? null,
    roundDigest: value.roundDigest ?? null,
    roundRef: value.roundRef ?? null,
    sourceRecordDigest: value.sourceRecordDigest ?? null,
    subjectRefs: sorted(value.subjectRefs),
    suppliedByRef: value.suppliedByRef ?? null,
  };
}

function findEvidenceSource(kind, artifact, evidenceRef) {
  const value = object(artifact);
  switch (kind) {
    case "executed-agreement-copy":
      return records(value.agreements).find((row) => row.sourceEvidenceRef === evidenceRef) ?? null;
    case "obligation-register-export":
      return object(value.register).evidenceRef === evidenceRef ? object(value.register) : null;
    case "authority-roster-export":
      return object(value.authorityRoster).evidenceRef === evidenceRef
        ? object(value.authorityRoster)
        : null;
    case "authority-grant-record":
      return records(value.authorityGrants).find((row) => row.evidenceRef === evidenceRef) ?? null;
    case "performance-evidence":
      return records(value.evidence).find((row) => row.id === evidenceRef) ?? null;
    case "obligation-observation-record":
      return records(value.observations).find((row) => row.observationEvidenceRef === evidenceRef) ?? null;
    case "completion-confirmation": {
      const observation = records(value.observations).find(
        (row) => object(row.completion).confirmationEvidenceRef === evidenceRef,
      );
      return observation
        ? { completion: object(observation.completion), observationRef: observation.id }
        : null;
    }
    case "blocker-record":
      return records(value.blockers).find((row) => row.evidenceRef === evidenceRef) ?? null;
    case "destination-approval-record":
      return object(value.destinationApproval).evidenceRef === evidenceRef
        ? object(value.destinationApproval)
        : null;
    case "handoff-record":
      return object(value.handoff).evidenceRef === evidenceRef ? object(value.handoff) : null;
    default:
      return null;
  }
}

export function computeEvidencePayloadDigest(kind, artifact, evidenceRef) {
  const source = findEvidenceSource(kind, artifact, evidenceRef);
  if (source === null) return null;
  switch (kind) {
    case "executed-agreement-copy": {
      const row = object(source);
      return digest({
        agreementId: row.agreementId ?? null,
        contentDigest: row.contentDigest ?? null,
        executedAt: row.executedAt ?? null,
        id: row.id ?? null,
        repositoryRef: row.repositoryRef ?? null,
        sourceEvidenceRef: row.sourceEvidenceRef ?? null,
        version: row.version ?? null,
      });
    }
    case "obligation-register-export":
      return digest({
        contentDigest: object(source).contentDigest ?? null,
        evidenceRef: object(source).evidenceRef ?? null,
        id: object(source).id ?? null,
        obligationRefs: sorted(object(source).obligationRefs),
        version: object(source).version ?? null,
      });
    case "authority-roster-export":
      return digest({
        contentDigest: object(source).contentDigest ?? null,
        evidenceRef: object(source).evidenceRef ?? null,
        id: object(source).id ?? null,
        principalRefs: sorted(object(source).principalRefs),
        version: object(source).version ?? null,
      });
    case "authority-grant-record":
      return computeAuthorityGrantDigest(source);
    case "performance-evidence":
      return digest(evidenceRawPayload(source));
    case "obligation-observation-record":
      return digest(observationPayload(source));
    case "completion-confirmation":
      return digest({
        completion: object(source).completion,
        observationRef: object(source).observationRef ?? null,
      });
    case "blocker-record":
      return digest(blockerPayload(source));
    case "destination-approval-record":
      return computeDestinationApprovalDigest(source);
    case "handoff-record":
      return computeHandoffDigest(source);
    default:
      return null;
  }
}

export function computeEvidenceRecordDigest(row) {
  const value = object(row);
  return digest({
    id: value.id ?? null,
    kind: value.kind ?? null,
    observedAt: value.observedAt ?? null,
    payloadDigest: value.payloadDigest ?? null,
    roundDigest: value.roundDigest ?? null,
    roundRef: value.roundRef ?? null,
    sourceRecordDigest: value.sourceRecordDigest ?? null,
    subjectRefs: sorted(value.subjectRefs),
    suppliedByRef: value.suppliedByRef ?? null,
  });
}

export function resealContractObligationTracker(input, options = {}) {
  const value = structuredClone(input);
  if (object(options).resealRegister === true) {
    value.register.contentDigest = computeRegisterDigest(
      value.register,
      value.obligations,
      value.agreements,
    );
  }
  value.authorityRoster.contentDigest = computeAuthorityRosterDigest(value.principals);
  for (const grant of value.authorityGrants) {
    grant.rosterDigest = value.authorityRoster.contentDigest;
    grant.payloadDigest = computeAuthorityGrantDigest(grant);
  }
  value.round.registerDigest = value.register.contentDigest;
  value.round.authorityRosterDigest = value.authorityRoster.contentDigest;
  value.round.roundDigest = computeRoundDigest(value.round, value);
  for (const row of value.evidence) {
    row.roundDigest = value.round.roundDigest;
  }
  value.coverage.registerDigest = value.register.contentDigest;
  value.coverage.contentDigest = computeCoverageDigest(value.coverage, value);
  value.destinationApproval.roundDigest = value.round.roundDigest;
  value.destinationApproval.registerDigest = value.register.contentDigest;
  value.destinationApproval.coverageDigest = value.coverage.contentDigest;
  value.destinationApproval.payloadDigest = computeDestinationApprovalDigest(
    value.destinationApproval,
  );
  value.handoff.roundDigest = value.round.roundDigest;
  value.handoff.registerDigest = value.register.contentDigest;
  value.handoff.coverageDigest = value.coverage.contentDigest;
  value.handoff.destinationApprovalDigest = value.destinationApproval.payloadDigest;
  value.handoff.payloadDigest = computeHandoffDigest(value.handoff);
  for (const row of value.evidence) {
    row.payloadDigest = computeEvidencePayloadDigest(row.kind, value, row.id);
    row.recordDigest = computeEvidenceRecordDigest(row);
  }
  return value;
}

function finding(code, path, refs = []) {
  return {
    code,
    path,
    refs: [...new Set(strings(refs))].sort(compareUtf16CodeUnits),
  };
}

function rejectUnknownFields(record, allowedFields, path, findings) {
  if (!isRecord(record)) return;
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(record).sort(compareUtf16CodeUnits)) {
    if (!allowed.has(key)) findings.push(finding("prohibited_contract_field", `${path}.${key}`));
  }
}

function rejectUnknownShapes(value, findings) {
  rejectUnknownFields(value, TOP_FIELDS, "$", findings);
  rejectUnknownFields(value.round, ROUND_FIELDS, "$.round", findings);
  records(value.agreements).forEach((row, index) =>
    rejectUnknownFields(row, AGREEMENT_FIELDS, `$.agreements[${index}]`, findings),
  );
  rejectUnknownFields(value.register, REGISTER_FIELDS, "$.register", findings);
  records(value.obligations).forEach((row, index) =>
    rejectUnknownFields(row, OBLIGATION_FIELDS, `$.obligations[${index}]`, findings),
  );
  records(value.principals).forEach((row, index) =>
    rejectUnknownFields(row, PRINCIPAL_FIELDS, `$.principals[${index}]`, findings),
  );
  rejectUnknownFields(value.authorityRoster, ROSTER_FIELDS, "$.authorityRoster", findings);
  records(value.authorityGrants).forEach((row, index) =>
    rejectUnknownFields(row, GRANT_FIELDS, `$.authorityGrants[${index}]`, findings),
  );
  records(value.observations).forEach((row, index) => {
    rejectUnknownFields(row, OBSERVATION_FIELDS, `$.observations[${index}]`, findings);
    if (isRecord(row.completion)) {
      rejectUnknownFields(
        row.completion,
        COMPLETION_FIELDS,
        `$.observations[${index}].completion`,
        findings,
      );
    }
  });
  records(value.blockers).forEach((row, index) =>
    rejectUnknownFields(row, BLOCKER_FIELDS, `$.blockers[${index}]`, findings),
  );
  records(value.evidence).forEach((row, index) =>
    rejectUnknownFields(row, EVIDENCE_FIELDS, `$.evidence[${index}]`, findings),
  );
  rejectUnknownFields(value.coverage, COVERAGE_FIELDS, "$.coverage", findings);
  records(object(value.coverage).entries).forEach((row, index) =>
    rejectUnknownFields(row, COVERAGE_ENTRY_FIELDS, `$.coverage.entries[${index}]`, findings),
  );
  rejectUnknownFields(
    value.destinationApproval,
    DESTINATION_FIELDS,
    "$.destinationApproval",
    findings,
  );
  rejectUnknownFields(value.handoff, HANDOFF_FIELDS, "$.handoff", findings);
}

function scanProhibitedKeys(value, findings) {
  const seen = new Set();
  function visit(node, path) {
    if ((isRecord(node) || Array.isArray(node)) && seen.has(node)) return;
    if (isRecord(node) || Array.isArray(node)) seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (isRecord(node)) {
      for (const key of Object.keys(node).sort(compareUtf16CodeUnits)) {
        const normalizedKey = key
          .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
          .replaceAll(/[-_/]/gu, " ");
        if (
          !(path === "$.handoff" && HANDOFF_DISCLAIMER_FIELDS.includes(key)) &&
          PROHIBITED_CLAIM_PATTERN.test(normalizedKey)
        ) {
          findings.push(finding("prohibited_contract_field", `${path}.${key}`));
        }
        visit(node[key], `${path}.${key}`);
      }
    }
  }
  visit(value, "$");
}

function collectIds(value, findings) {
  const ids = new Map();
  const seen = new Set();
  function visit(node, path) {
    if ((!isRecord(node) && !Array.isArray(node)) || seen.has(node)) return;
    seen.add(node);
    if (isRecord(node) && Object.hasOwn(node, "id")) {
      if (typeof node.id !== "string" || !ID_PATTERN.test(node.id)) {
        findings.push(finding("invalid_identity", `${path}.id`));
      } else if (ids.has(node.id)) {
        findings.push(finding("duplicate_identity", `${path}.id`, [node.id]));
      } else {
        ids.set(node.id, `${path}.id`);
      }
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else {
      for (const key of Object.keys(node).sort(compareUtf16CodeUnits)) {
        visit(node[key], `${path}.${key}`);
      }
    }
  }
  visit(value, "$");
  return ids;
}

function readLedger(value, field, findings) {
  if (!Array.isArray(value[field]) || value[field].some((row) => !isRecord(row))) {
    findings.push(finding("invalid_artifact_shape", `$.${field}`));
  }
  return records(value[field]);
}

function hasScope(principal, scope) {
  return object(principal).kind === "named-human" && strings(object(principal).scopes).includes(scope);
}

function mapById(rows) {
  return new Map(rows.filter((row) => typeof row.id === "string").map((row) => [row.id, row]));
}

function sortedFindings(findings) {
  const unique = new Map();
  for (const row of findings) {
    const key = canonicalJson(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()].sort((left, right) =>
    compareUtf16CodeUnits(
      `${left.code}\u0000${left.path}\u0000${canonicalJson(left.refs)}`,
      `${right.code}\u0000${right.path}\u0000${canonicalJson(right.refs)}`,
    ),
  );
}

export function contractObligationTrackerFindings(input, context) {
  if (!isRecord(input)) return [finding("invalid_artifact", "$")];

  const value = input;
  const findings = [];
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  rejectUnknownShapes(value, findings);
  scanProhibitedKeys(value, findings);
  collectIds(value, findings);

  if (value.schemaVersion !== CONTRACT_OBLIGATION_TRACKER_SCHEMA_VERSION) {
    add("invalid_artifact", "$.schemaVersion");
  }
  if (typeof value.artifactId !== "string" || !ID_PATTERN.test(value.artifactId)) {
    add("invalid_identity", "$.artifactId");
  }

  const asOf = timestamp(object(context).asOf);
  if (asOf === null) {
    add("invalid_validation_context", "$.validationContext.asOf");
    add("invalid_handoff", "$.handoff.state");
  }

  const agreements = readLedger(value, "agreements", findings);
  const obligations = readLedger(value, "obligations", findings);
  const principals = readLedger(value, "principals", findings);
  const grants = readLedger(value, "authorityGrants", findings);
  const observations = readLedger(value, "observations", findings);
  const blockers = readLedger(value, "blockers", findings);
  const evidence = readLedger(value, "evidence", findings);
  const coverageEntries = records(object(value.coverage).entries);

  const round = object(value.round);
  const register = object(value.register);
  const roster = object(value.authorityRoster);
  const coverage = object(value.coverage);
  const destination = object(value.destinationApproval);
  const handoff = object(value.handoff);
  const agreementById = mapById(agreements);
  const obligationById = mapById(obligations);
  const principalById = mapById(principals);
  const grantById = mapById(grants);
  const observationById = mapById(observations);
  const blockerById = mapById(blockers);
  const evidenceById = mapById(evidence);

  if (round.destination !== CONTRACT_OWNER_REVIEW_QUEUE) {
    add("invalid_destination", "$.round.destination", [round.id]);
  }
  for (const [version, path, ref] of [
    [register.version, "$.register.version", register.id],
    [round.registerVersion, "$.round.registerVersion", round.id],
    [coverage.registerVersion, "$.coverage.registerVersion", register.id],
  ]) {
    if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
      add("invalid_version", path, [ref]);
    }
  }

  function checkTimestamp(valueToCheck, path, refs = [], futureAllowed = false) {
    const parsed = timestamp(valueToCheck);
    if (parsed === null) {
      add("invalid_timestamp", path, refs);
    } else if (!futureAllowed && asOf !== null && parsed > asOf) {
      add("future_record", path, refs);
    }
    return parsed;
  }

  const opensAt = checkTimestamp(round.opensAt, "$.round.opensAt", [round.id]);
  const closesAt = checkTimestamp(round.closesAt, "$.round.closesAt", [round.id]);
  if (opensAt !== null && closesAt !== null && opensAt > closesAt) {
    add("invalid_chronology", "$.round", [round.id]);
  }

  const agreementIds = agreements.map((row) => row.id);
  const obligationIds = obligations.map((row) => row.id);
  const principalIds = principals.map((row) => row.id);
  if (
    register.id !== round.registerRef ||
    register.version !== round.registerVersion ||
    register.contentDigest !== round.registerDigest ||
    roster.id !== round.authorityRosterRef ||
    roster.contentDigest !== round.authorityRosterDigest ||
    !sameExactSet(round.agreementVersionRefs, agreementIds)
  ) {
    add("invalid_round_binding", "$.round", [round.id]);
  }
  if (
    !sameExactSet(register.agreementVersionRefs, agreementIds) ||
    !sameExactSet(register.obligationRefs, obligationIds)
  ) {
    add("invalid_register_binding", "$.register", [register.id]);
  }
  if (register.contentDigest !== computeRegisterDigest(register, obligations, agreements)) {
    add("invalid_register_digest", "$.register.contentDigest", [register.id]);
  }
  if (round.roundDigest !== computeRoundDigest(round, value)) {
    add("invalid_round_digest", "$.round.roundDigest", [round.id]);
  }

  const registerConfirmedAt = checkTimestamp(
    register.confirmedAt,
    "$.register.confirmedAt",
    [register.id],
  );
  if (
    registerConfirmedAt !== null &&
    opensAt !== null &&
    registerConfirmedAt > opensAt
  ) {
    add("invalid_chronology", "$.register.confirmedAt", [register.id]);
  }
  const registerOwner = principalById.get(register.confirmedByRef);
  const registerSystem = principalById.get(register.sourceSystemRef);
  if (!hasScope(registerOwner, "obligation-register-owner")) {
    add("invalid_register_authority", "$.register.confirmedByRef", [register.confirmedByRef]);
  }
  if (
    object(registerSystem).kind !== "owner-system" ||
    !strings(object(registerSystem).scopes).includes("register-source")
  ) {
    add("invalid_register_authority", "$.register.sourceSystemRef", [register.sourceSystemRef]);
  }

  const agreementsByAgreementId = new Map();
  for (const [index, agreement] of agreements.entries()) {
    if (typeof agreement.agreementId === "string") {
      const prior = agreementsByAgreementId.get(agreement.agreementId);
      if (prior) {
        add("duplicate_agreement_id", `$.agreements[${index}].agreementId`, [
          prior.id,
          agreement.id,
        ]);
      } else {
        agreementsByAgreementId.set(agreement.agreementId, agreement);
      }
    }
    const executedAt = checkTimestamp(
      agreement.executedAt,
      `$.agreements[${index}].executedAt`,
      [agreement.id],
    );
    if (
      executedAt !== null &&
      registerConfirmedAt !== null &&
      executedAt > registerConfirmedAt
    ) {
      add("invalid_chronology", `$.agreements[${index}].executedAt`, [agreement.id]);
    }
    const repository = principalById.get(agreement.repositoryRef);
    if (
      object(repository).kind !== "owner-system" ||
      !strings(object(repository).scopes).includes("agreement-source")
    ) {
      add("invalid_agreement_source", `$.agreements[${index}].repositoryRef`, [agreement.id]);
    }
  }

  const rosterIssuedAt = checkTimestamp(roster.issuedAt, "$.authorityRoster.issuedAt", [roster.id]);
  if (rosterIssuedAt !== null && opensAt !== null && rosterIssuedAt > opensAt) {
    add("invalid_chronology", "$.authorityRoster.issuedAt", [roster.id]);
  }
  if (
    !sameExactSet(roster.principalRefs, principalIds) ||
    roster.contentDigest !== computeAuthorityRosterDigest(principals) ||
    !hasScope(principalById.get(roster.custodianRef), "authority-roster-custodian")
  ) {
    add("invalid_authority_roster", "$.authorityRoster", [roster.id]);
  }
  for (const [index, principal] of principals.entries()) {
    if (
      typeof principal.name !== "string" ||
      !HUMAN_NAME_PATTERN.test(principal.name) ||
      (principal.kind !== "named-human" && principal.kind !== "owner-system")
    ) {
      add("invalid_principal", `$.principals[${index}]`, [principal.id]);
    }
  }

  const clauseLocationsByDigest = new Map();
  const clauseDigestsByLocation = new Map();
  const obligationSemantics = new Map();
  for (const [index, obligation] of obligations.entries()) {
    const clauseContentKey = canonicalJson([
      obligation.agreementVersionRef ?? null,
      obligation.clauseDigest ?? null,
    ]);
    const priorClause = clauseLocationsByDigest.get(clauseContentKey);
    if (priorClause && priorClause.clauseLocator !== obligation.clauseLocator) {
      add("invalid_clause_identity", `$.obligations[${index}].clauseLocator`, [
        priorClause.id,
        obligation.id,
      ]);
    } else {
      clauseLocationsByDigest.set(clauseContentKey, obligation);
    }
    const clauseLocationKey = canonicalJson([
      obligation.agreementVersionRef ?? null,
      obligation.clauseLocator ?? null,
    ]);
    const priorLocation = clauseDigestsByLocation.get(clauseLocationKey);
    if (priorLocation && priorLocation.clauseDigest !== obligation.clauseDigest) {
      add("invalid_clause_identity", `$.obligations[${index}].clauseDigest`, [
        priorLocation.id,
        obligation.id,
      ]);
    } else {
      clauseDigestsByLocation.set(clauseLocationKey, obligation);
    }
    if (
      typeof obligation.agreementVersionRef === "string" &&
      typeof obligation.obligationDigest === "string"
    ) {
      const semanticKey = canonicalJson([
        obligation.agreementVersionRef,
        obligation.obligationDigest,
      ]);
      const priorSemantic = obligationSemantics.get(semanticKey);
      if (priorSemantic) {
        add("duplicate_obligation_semantics", `$.obligations[${index}].obligationDigest`, [
          priorSemantic.id,
          obligation.id,
        ]);
      } else {
        obligationSemantics.set(semanticKey, obligation);
      }
    }
    if (!agreementById.has(obligation.agreementVersionRef)) {
      add("invalid_obligation_binding", `$.obligations[${index}].agreementVersionRef`, [
        obligation.id,
      ]);
    }
    if (!hasScope(principalById.get(obligation.responsibleOwnerRef), "obligation-owner")) {
      add("invalid_obligation_binding", `$.obligations[${index}].responsibleOwnerRef`, [
        obligation.id,
      ]);
    }
    if (
      !hasScope(
        principalById.get(obligation.performanceEvidenceSupplierRef),
        "performance-evidence-supplier",
      )
    ) {
      add(
        "invalid_performance_evidence_supplier",
        `$.obligations[${index}].performanceEvidenceSupplierRef`,
        [obligation.id, obligation.performanceEvidenceSupplierRef],
      );
    }
    if (strings(obligation.requiredEvidenceRefs).length === 0) {
      add("invalid_required_evidence", `$.obligations[${index}].requiredEvidenceRefs`, [
        obligation.id,
      ]);
    }
    if (typeof obligation.clauseLocator !== "string" || !CLAUSE_PATTERN.test(obligation.clauseLocator)) {
      add("invalid_obligation_binding", `$.obligations[${index}].clauseLocator`, [obligation.id]);
    }
    checkTimestamp(obligation.dueAt, `$.obligations[${index}].dueAt`, [obligation.id], true);
  }

  const usedGrantRefs = [];
  for (const [index, grant] of grants.entries()) {
    const activeFrom = checkTimestamp(
      grant.activeFrom,
      `$.authorityGrants[${index}].activeFrom`,
      [grant.id],
    );
    const activeUntil = checkTimestamp(
      grant.activeUntil,
      `$.authorityGrants[${index}].activeUntil`,
      [grant.id],
      true,
    );
    const grantee = principalById.get(grant.granteeRef);
    const issuer = principalById.get(grant.issuedByRef);
    if (
      !obligationById.has(grant.obligationRef) ||
      !hasScope(grantee, "obligation-owner") ||
      !hasScope(issuer, "authority-grant-issuer") ||
      grant.granteeRef === grant.issuedByRef ||
      grant.granteeRef === round.destinationApproverRef ||
      grant.granteeRef === round.handoffOwnerRef ||
      grant.scope !== "owner-completion-confirmation" ||
      grant.rosterRef !== roster.id ||
      grant.rosterDigest !== roster.contentDigest ||
      grant.payloadDigest !== computeAuthorityGrantDigest(grant) ||
      activeFrom === null ||
      activeUntil === null ||
      opensAt === null ||
      closesAt === null ||
      activeFrom < opensAt ||
      activeUntil < closesAt ||
      activeFrom > activeUntil
    ) {
      add("invalid_authority_grant", `$.authorityGrants[${index}]`, [grant.id]);
    }
  }

  const separatedRoles = [
    ["register-confirmer", [register.confirmedByRef]],
    ["roster-custodian", [roster.custodianRef]],
    ["grant-issuer", grants.map((grant) => grant.issuedByRef)],
    ["grant-grantee", grants.map((grant) => grant.granteeRef)],
    ["destination-approver", [round.destinationApproverRef]],
    ["handoff-owner", [round.handoffOwnerRef]],
    ["obligation-responsible-owner", obligations.map((obligation) => obligation.responsibleOwnerRef)],
    [
      "performance-evidence-supplier",
      obligations.map((obligation) => obligation.performanceEvidenceSupplierRef),
    ],
  ].map(([role, refs]) => [role, new Set(strings(refs))]);
  for (let leftIndex = 0; leftIndex < separatedRoles.length; leftIndex += 1) {
    const [leftRole, leftRefs] = separatedRoles[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < separatedRoles.length; rightIndex += 1) {
      const [rightRole, rightRefs] = separatedRoles[rightIndex];
      for (const ref of leftRefs) {
        if (rightRefs.has(ref)) {
          add("invalid_role_separation", "$.principals", [leftRole, rightRole, ref]);
        }
      }
    }
  }

  const observationsByObligation = new Map();
  for (const [index, observation] of observations.entries()) {
    const rows = observationsByObligation.get(observation.obligationRef) ?? [];
    rows.push(observation);
    observationsByObligation.set(observation.obligationRef, rows);
    const obligation = obligationById.get(observation.obligationRef);
    const observedAt = checkTimestamp(
      observation.observedAt,
      `$.observations[${index}].observedAt`,
      [observation.id],
    );
    if (
      !obligation ||
      observation.agreementVersionRef !== obligation.agreementVersionRef ||
      observation.clauseDigest !== obligation.clauseDigest ||
      observation.obligationDigest !== obligation.obligationDigest ||
      observation.ownerRef !== obligation.responsibleOwnerRef
    ) {
      add("invalid_observation_binding", `$.observations[${index}]`, [observation.id]);
    }
    if (
      observedAt !== null &&
      (opensAt === null || closesAt === null || observedAt < opensAt || observedAt > closesAt)
    ) {
      add("invalid_chronology", `$.observations[${index}].observedAt`, [observation.id]);
    }

    const dueAt = timestamp(object(obligation).dueAt);
    if (dueAt !== null && closesAt !== null) {
      const expectedDueState = dueAt > closesAt ? "not-yet-due" : "due";
      const isNotYetDue = expectedDueState === "not-yet-due";
      const validState =
        observation.dueState === expectedDueState &&
        (isNotYetDue
          ? observation.state === "not-yet-due" &&
            strings(observation.reliedEvidenceRefs).length === 0 &&
            observation.completion === null
          : (observation.state === "owner-confirmation-pending" ||
              observation.state === "owner-confirmed-complete") &&
            sameExactSet(observation.reliedEvidenceRefs, object(obligation).requiredEvidenceRefs));
      if (!validState) {
        add("invalid_due_state", `$.observations[${index}]`, [observation.id]);
      }
    }

    if (observation.state === "owner-confirmed-complete") {
      const completion = object(observation.completion);
      const grant = grantById.get(completion.authorityGrantRef);
      const confirmedAt = checkTimestamp(
        completion.confirmedAt,
        `$.observations[${index}].completion.confirmedAt`,
        [observation.id],
      );
      const grantFrom = timestamp(object(grant).activeFrom);
      const grantUntil = timestamp(object(grant).activeUntil);
      const reliedTimes = strings(observation.reliedEvidenceRefs)
        .map((ref) => timestamp(object(evidenceById.get(ref)).observedAt))
        .filter((instant) => instant !== null);
      if (
        strings(observation.reliedEvidenceRefs).length === 0 ||
        !grant ||
        grant.obligationRef !== observation.obligationRef ||
        grant.granteeRef !== completion.confirmedByRef ||
        object(principalById.get(completion.confirmedByRef)).kind !== "named-human" ||
        confirmedAt === null ||
        grantFrom === null ||
        grantUntil === null ||
        confirmedAt < grantFrom ||
        confirmedAt > grantUntil ||
        confirmedAt !== observedAt ||
        reliedTimes.some((instant) => instant >= confirmedAt)
      ) {
        add("invalid_completion_authority", `$.observations[${index}].completion`, [
          observation.id,
        ]);
      }
      if (strings(observation.reliedEvidenceRefs).length === 0) {
        add("invalid_required_evidence", `$.observations[${index}].reliedEvidenceRefs`, [
          observation.id,
        ]);
      }
      usedGrantRefs.push(completion.authorityGrantRef);
    } else if (observation.completion !== null) {
      add("invalid_observation_binding", `$.observations[${index}].completion`, [observation.id]);
    }
  }

  for (const grant of grants) {
    if (usedGrantRefs.filter((ref) => ref === grant.id).length !== 1) {
      add("invalid_authority_grant", "$.authorityGrants", [grant.id]);
    }
  }

  const blockersByObligation = new Map();
  for (const [index, blocker] of blockers.entries()) {
    const rows = blockersByObligation.get(blocker.obligationRef) ?? [];
    rows.push(blocker);
    blockersByObligation.set(blocker.obligationRef, rows);
    const obligation = obligationById.get(blocker.obligationRef);
    const detectedAt = checkTimestamp(
      blocker.detectedAt,
      `$.blockers[${index}].detectedAt`,
      [blocker.id],
    );
    if (
      !obligation ||
      blocker.ownerRef !== obligation.responsibleOwnerRef ||
      blocker.category !== "source-evidence-missing" ||
      detectedAt === null ||
      opensAt === null ||
      closesAt === null ||
      detectedAt < opensAt ||
      detectedAt > closesAt
    ) {
      add("invalid_blocker", `$.blockers[${index}]`, [blocker.id]);
    }
  }

  function isExactPerformanceEvidenceForObligation(ref, obligation) {
    const matchingRows = evidence.filter((row) => row.id === ref);
    if (matchingRows.length !== 1) return false;
    const row = matchingRows[0];
    return (
      row.kind === "performance-evidence" &&
      row.roundRef === round.id &&
      row.roundDigest === round.roundDigest &&
      row.suppliedByRef === obligation.performanceEvidenceSupplierRef &&
      sameExactSet(row.subjectRefs, [obligation.id])
    );
  }

  for (const obligation of obligations) {
    const missing = strings(obligation.requiredEvidenceRefs).filter(
      (ref) => !isExactPerformanceEvidenceForObligation(ref, obligation),
    );
    const obligationObservations = observationsByObligation.get(obligation.id) ?? [];
    const obligationBlockers = blockersByObligation.get(obligation.id) ?? [];
    const dueAt = timestamp(obligation.dueAt);
    const isNotYetDue = dueAt !== null && closesAt !== null && dueAt > closesAt;
    if (isNotYetDue) {
      const observation = obligationObservations[0];
      if (
        obligationObservations.length !== 1 ||
        obligationBlockers.length !== 0 ||
        observation?.state !== "not-yet-due" ||
        observation?.dueState !== "not-yet-due" ||
        strings(observation?.reliedEvidenceRefs).length !== 0 ||
        observation?.completion !== null
      ) {
        add("invalid_obligation_resolution", "$.observations", [obligation.id]);
      }
    } else if (missing.length === 0) {
      if (obligationObservations.length !== 1 || obligationBlockers.length !== 0) {
        add("invalid_obligation_resolution", "$.observations", [obligation.id]);
      }
    } else if (
      obligationObservations.length !== 0 ||
      obligationBlockers.length !== 1 ||
      !sameExactSet(obligationBlockers[0].exactMissingEvidenceRefs, missing)
    ) {
      add("invalid_blocker_equality", "$.blockers", [obligation.id, ...missing]);
    }
  }

  const expectedCoverage = obligations.map((obligation) => {
    const blocker = (blockersByObligation.get(obligation.id) ?? [])[0];
    const observation = (observationsByObligation.get(obligation.id) ?? [])[0];
    return blocker
      ? { obligationRef: obligation.id, resolutionKind: "blocker", resolutionRef: blocker.id }
      : {
          obligationRef: obligation.id,
          resolutionKind: "observation",
          resolutionRef: observation?.id,
        };
  });
  const coverageMatches =
    coverageEntries.length === expectedCoverage.length &&
    expectedCoverage.every(
      (expected) =>
        coverageEntries.filter(
          (entry) =>
            entry.obligationRef === expected.obligationRef &&
            entry.resolutionKind === expected.resolutionKind &&
            entry.resolutionRef === expected.resolutionRef,
        ).length === 1,
    );
  if (
    coverage.registerRef !== register.id ||
    coverage.registerVersion !== register.version ||
    coverage.registerDigest !== register.contentDigest ||
    !coverageMatches
  ) {
    add("invalid_coverage", "$.coverage", obligationIds);
  }
  if (coverage.contentDigest !== computeCoverageDigest(coverage, value)) {
    add("invalid_coverage_digest", "$.coverage.contentDigest");
  }

  const expectedEvidence = new Map();
  function expectEvidence(ref, kind, subjects, supplier, path) {
    if (typeof ref !== "string") return;
    if (expectedEvidence.has(ref)) {
      add("invalid_evidence_closure", path, [ref]);
      return;
    }
    expectedEvidence.set(ref, { kind, path, subjects, supplier });
  }
  for (const agreement of agreements) {
    expectEvidence(
      agreement.sourceEvidenceRef,
      "executed-agreement-copy",
      [agreement.id],
      agreement.repositoryRef,
      "$.agreements",
    );
  }
  expectEvidence(
    register.evidenceRef,
    "obligation-register-export",
    [register.id, ...obligationIds],
    register.confirmedByRef,
    "$.register.evidenceRef",
  );
  expectEvidence(
    roster.evidenceRef,
    "authority-roster-export",
    [roster.id, ...principalIds],
    roster.custodianRef,
    "$.authorityRoster.evidenceRef",
  );
  for (const grant of grants) {
    expectEvidence(
      grant.evidenceRef,
      "authority-grant-record",
      [grant.id, grant.obligationRef, grant.granteeRef],
      grant.issuedByRef,
      "$.authorityGrants",
    );
  }
  for (const observation of observations) {
    const obligation = obligationById.get(observation.obligationRef);
    for (const ref of strings(observation.reliedEvidenceRefs)) {
      expectEvidence(
        ref,
        "performance-evidence",
        [observation.obligationRef],
        object(obligation).performanceEvidenceSupplierRef,
        "$.observations",
      );
    }
    expectEvidence(
      observation.observationEvidenceRef,
      "obligation-observation-record",
      [observation.id, observation.obligationRef],
      observation.ownerRef,
      "$.observations",
    );
    if (observation.state === "owner-confirmed-complete") {
      expectEvidence(
        object(observation.completion).confirmationEvidenceRef,
        "completion-confirmation",
        [observation.id, observation.obligationRef, object(observation.completion).confirmedByRef],
        object(observation.completion).confirmedByRef,
        "$.observations",
      );
    }
  }
  for (const blocker of blockers) {
    expectEvidence(
      blocker.evidenceRef,
      "blocker-record",
      [blocker.id, blocker.obligationRef, ...strings(blocker.exactMissingEvidenceRefs)],
      blocker.ownerRef,
      "$.blockers",
    );
  }
  expectEvidence(
    destination.evidenceRef,
    "destination-approval-record",
    [destination.id, destination.approvedByRef],
    destination.approvedByRef,
    "$.destinationApproval.evidenceRef",
  );
  expectEvidence(
    handoff.evidenceRef,
    "handoff-record",
    [handoff.id, handoff.nextOwnerRef],
    handoff.nextOwnerRef,
    "$.handoff.evidenceRef",
  );

  const evidenceBySourceRecordDigest = new Map();
  for (const [index, row] of evidence.entries()) {
    if (typeof row.sourceRecordDigest === "string") {
      const prior = evidenceBySourceRecordDigest.get(row.sourceRecordDigest);
      if (prior) {
        add("duplicate_source_record_digest", `$.evidence[${index}].sourceRecordDigest`, [
          prior.id,
          row.id,
          row.sourceRecordDigest,
        ]);
      } else {
        evidenceBySourceRecordDigest.set(row.sourceRecordDigest, row);
      }
    }
    const expected = expectedEvidence.get(row.id);
    const observedAt = checkTimestamp(
      row.observedAt,
      `$.evidence[${index}].observedAt`,
      [row.id],
    );
    if (
      row.roundRef !== round.id ||
      row.roundDigest !== round.roundDigest ||
      !principalById.has(row.suppliedByRef)
    ) {
      add("invalid_evidence_binding", `$.evidence[${index}]`, [row.id]);
    }
    if (
      !expected ||
      row.kind !== expected.kind ||
      row.suppliedByRef !== expected.supplier ||
      !sameExactSet(row.subjectRefs, expected.subjects)
    ) {
      add("invalid_evidence_closure", `$.evidence[${index}]`, [row.id]);
    }
    const expectedPayload = computeEvidencePayloadDigest(row.kind, value, row.id);
    if (
      expectedPayload === null ||
      row.payloadDigest !== expectedPayload ||
      row.recordDigest !== computeEvidenceRecordDigest(row)
    ) {
      add("invalid_evidence_digest", `$.evidence[${index}]`, [row.id]);
    }
    if (expected?.kind === "performance-evidence") {
      const consumingObservation = observations.find((item) =>
        strings(item.reliedEvidenceRefs).includes(row.id),
      );
      const obligation = obligationById.get(object(consumingObservation).obligationRef);
      const agreement = agreementById.get(object(obligation).agreementVersionRef);
      const completionConfirmer = object(object(consumingObservation).completion).confirmedByRef;
      if (
        !hasScope(principalById.get(row.suppliedByRef), "performance-evidence-supplier") ||
        row.suppliedByRef !== object(obligation).performanceEvidenceSupplierRef ||
        row.suppliedByRef === completionConfirmer
      ) {
        add("invalid_performance_evidence_supplier", `$.evidence[${index}].suppliedByRef`, [
          row.id,
          row.suppliedByRef,
        ]);
      }
      const consumedAt = timestamp(object(consumingObservation).observedAt);
      const completedAt = timestamp(object(object(consumingObservation).completion).confirmedAt);
      const executedAt = timestamp(object(agreement).executedAt);
      if (
        observedAt !== null &&
        (executedAt === null ||
          consumedAt === null ||
          observedAt < executedAt ||
          observedAt >= consumedAt ||
          (completedAt !== null && observedAt >= completedAt))
      ) {
        add("invalid_evidence_chronology", `$.evidence[${index}].observedAt`, [row.id]);
      }
    } else {
      const sourceTime =
        expected?.kind === "executed-agreement-copy"
          ? timestamp(
              agreements.find((agreement) => agreement.sourceEvidenceRef === row.id)?.executedAt,
            )
          : expected?.kind === "obligation-register-export"
            ? registerConfirmedAt
            : expected?.kind === "authority-roster-export"
              ? rosterIssuedAt
              : expected?.kind === "authority-grant-record"
                ? timestamp(grants.find((grant) => grant.evidenceRef === row.id)?.activeFrom)
                : expected?.kind === "obligation-observation-record"
                  ? timestamp(
                      observations.find((item) => item.observationEvidenceRef === row.id)?.observedAt,
                    )
                  : expected?.kind === "completion-confirmation"
                    ? timestamp(
                        object(
                          observations.find(
                            (item) =>
                              object(item.completion).confirmationEvidenceRef === row.id,
                          )?.completion,
                        ).confirmedAt,
                      )
                    : expected?.kind === "blocker-record"
                      ? timestamp(blockers.find((item) => item.evidenceRef === row.id)?.detectedAt)
                      : expected?.kind === "destination-approval-record"
                        ? timestamp(destination.approvedAt)
                        : expected?.kind === "handoff-record"
                          ? timestamp(handoff.handedOffAt)
                          : null;
      if (observedAt !== null && sourceTime !== null && observedAt !== sourceTime) {
        add("invalid_evidence_chronology", `$.evidence[${index}].observedAt`, [row.id]);
      }
    }
  }
  for (const ref of expectedEvidence.keys()) {
    if (!evidenceById.has(ref)) add("invalid_evidence_closure", "$.evidence", [ref]);
  }

  const internallyDerivedDigests = new Set(
    [
      register.contentDigest,
      roster.contentDigest,
      round.roundDigest,
      coverage.contentDigest,
      ...agreements.map((row) => row.contentDigest),
      ...obligations.flatMap((row) => [row.clauseDigest, row.obligationDigest]),
      ...grants.map((row) => row.payloadDigest),
      destination.payloadDigest,
      handoff.payloadDigest,
      ...evidence.flatMap((row) => [row.payloadDigest, row.recordDigest]),
      computeRegisterDigest(register, obligations, agreements),
      computeAuthorityRosterDigest(principals),
      computeRoundDigest(round, value),
      computeCoverageDigest(coverage, value),
      ...grants.map(computeAuthorityGrantDigest),
      computeDestinationApprovalDigest(destination),
      computeHandoffDigest(handoff),
      ...evidence.flatMap((row) => [
        computeEvidencePayloadDigest(row.kind, value, row.id),
        computeEvidenceRecordDigest(row),
      ]),
    ].filter((value) => typeof value === "string"),
  );
  for (const [index, row] of evidence.entries()) {
    if (internallyDerivedDigests.has(row.sourceRecordDigest)) {
      add("derived_source_record_digest", `$.evidence[${index}].sourceRecordDigest`, [
        row.id,
        row.sourceRecordDigest,
      ]);
    }
  }

  const latestResolutionAt = Math.max(
    ...observations.map((row) => timestamp(row.observedAt) ?? Number.NEGATIVE_INFINITY),
    ...blockers.map((row) => timestamp(row.detectedAt) ?? Number.NEGATIVE_INFINITY),
  );
  const approvedAt = checkTimestamp(
    destination.approvedAt,
    "$.destinationApproval.approvedAt",
    [destination.id],
  );
  if (
    destination.roundRef !== round.id ||
    destination.roundDigest !== round.roundDigest ||
    destination.registerRef !== register.id ||
    destination.registerDigest !== register.contentDigest ||
    destination.coverageDigest !== coverage.contentDigest ||
    destination.destination !== round.destination ||
    destination.approvedByRef !== round.destinationApproverRef ||
    !hasScope(principalById.get(destination.approvedByRef), "destination-approver") ||
    destination.payloadDigest !== computeDestinationApprovalDigest(destination) ||
    (approvedAt !== null && approvedAt < latestResolutionAt)
  ) {
    add("invalid_destination", "$.destinationApproval", [destination.id]);
  }

  const handedOffAt = checkTimestamp(handoff.handedOffAt, "$.handoff.handedOffAt", [handoff.id]);
  const expectedState = blockers.length === 0 ? "ready-for-owner-review" : "blocked";
  if (
    handoff.roundRef !== round.id ||
    handoff.roundDigest !== round.roundDigest ||
    handoff.registerRef !== register.id ||
    handoff.registerDigest !== register.contentDigest ||
    handoff.coverageDigest !== coverage.contentDigest ||
    handoff.destinationApprovalRef !== destination.id ||
    handoff.destinationApprovalDigest !== destination.payloadDigest ||
    handoff.state !== expectedState ||
    handoff.nextOwnerRef !== round.handoffOwnerRef ||
    !hasScope(principalById.get(handoff.nextOwnerRef), "handoff-recipient") ||
    !sameExactSet(
      handoff.observationRefs,
      observations.map((row) => row.id),
    ) ||
    !sameExactSet(
      handoff.blockerRefs,
      blockers.map((row) => row.id),
    ) ||
    HANDOFF_DISCLAIMER_FIELDS.some((field) => handoff[field] !== "not-claimed") ||
    handoff.payloadDigest !== computeHandoffDigest(handoff) ||
    (handedOffAt !== null && approvedAt !== null && handedOffAt < approvedAt)
  ) {
    add("invalid_handoff", "$.handoff", [handoff.id]);
  }

  return sortedFindings(findings);
}
