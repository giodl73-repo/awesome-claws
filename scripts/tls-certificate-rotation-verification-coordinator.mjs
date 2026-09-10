import { createHash } from "node:crypto";

export const TLS_CERTIFICATE_ROTATION_VERIFICATION_SCHEMA_VERSION =
  "awesomeClaws.tlsCertificateRotationVerification.v1";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DESTINATION = "tls-rotation-owner-review-queue";
const NOT_CLAIMED_FIELDS = [
  "privateKeyAccessClaim",
  "certificateBodyAccessClaim",
  "issuanceExecutionClaim",
  "deploymentExecutionClaim",
  "listenerRouteChangeClaim",
  "restartClaim",
  "revocationClaim",
  "disableClaim",
  "deletionClaim",
  "externalCommunicationClaim",
  "readinessClaim",
  "identityAssuranceClaim",
  "securityAssuranceClaim",
  "complianceClaim",
  "auditClaim",
  "rotationCompletionClaim",
];
const PROHIBITED_KEY_PATTERN =
  /(?:^|[^a-z])(?:action|recommendation|interpretation|assurance|executed|deployed|rotated|validated|retired|revoked|disabled|deleted|contacted|restarted|ready|compliant|audited)(?:[^a-z]|$)/iu;

const FIELDS = Object.freeze({
  top: [
    "schemaVersion",
    "artifactId",
    "round",
    "certificates",
    "certificateExport",
    "bindings",
    "bindingExport",
    "rotationRequests",
    "issuances",
    "deployments",
    "endpointObservations",
    "retirements",
    "overlaps",
    "principals",
    "authorityRoster",
    "authorityGrants",
    "evidence",
    "blockers",
    "coverage",
    "destinationApproval",
    "handoff",
  ],
  round: [
    "id",
    "requestedAt",
    "campaignRef",
    "campaignVersion",
    "campaignCoordinatorRef",
    "certificateExportRef",
    "certificateExportDigest",
    "bindingExportRef",
    "bindingExportDigest",
    "authorityRosterRef",
    "authorityRosterDigest",
    "destination",
    "destinationApproverRef",
    "handoffOwnerRef",
    "planDigest",
  ],
  certificate: [
    "id",
    "ownerSystemRef",
    "certificateClass",
    "rotationState",
    "exclusionReason",
    "sourceRecordDigest",
    "payloadDigest",
  ],
  certificateExport: [
    "id",
    "exportedAt",
    "suppliedByRef",
    "certificateRefs",
    "evidenceRef",
    "contentDigest",
  ],
  binding: [
    "id",
    "certificateRef",
    "serviceRef",
    "listenerRef",
    "endpointLocatorDigest",
    "sourceRecordDigest",
    "payloadDigest",
  ],
  bindingExport: [
    "id",
    "exportedAt",
    "suppliedByRef",
    "bindingRefs",
    "evidenceRef",
    "contentDigest",
  ],
  rotationRequest: [
    "id",
    "certificateRef",
    "certificatePayloadDigest",
    "campaignRef",
    "approvedVersion",
    "requestedByRef",
    "authorityGrantRef",
    "requestedAt",
    "evidenceRef",
    "payloadDigest",
  ],
  issuance: [
    "id",
    "rotationRequestRef",
    "rotationRequestPayloadDigest",
    "providerRef",
    "providerOperationId",
    "submittedAt",
    "decidedAt",
    "outcome",
    "campaignRef",
    "successorLogicalId",
    "successorVersionId",
    "evidenceRef",
    "payloadDigest",
  ],
  deployment: [
    "id",
    "bindingRef",
    "bindingPayloadDigest",
    "rotationRequestRef",
    "issuanceRef",
    "issuancePayloadDigest",
    "successorVersionId",
    "observerRef",
    "observedAt",
    "outcome",
    "evidenceRef",
    "payloadDigest",
  ],
  endpointObservation: [
    "id",
    "deploymentRef",
    "deploymentPayloadDigest",
    "bindingRef",
    "validatorRef",
    "expectedSuccessorVersionId",
    "observedAt",
    "outcome",
    "checkCodes",
    "evidenceRef",
    "payloadDigest",
  ],
  retirement: [
    "id",
    "certificateRef",
    "certificatePayloadDigest",
    "observerRef",
    "observedAt",
    "outcome",
    "evidenceRef",
    "payloadDigest",
  ],
  overlap: [
    "id",
    "certificateRef",
    "certificatePayloadDigest",
    "approvedByRef",
    "authorityGrantRef",
    "declaredAt",
    "overlapUntil",
    "state",
    "evidenceRef",
    "payloadDigest",
  ],
  principal: ["id", "name", "kind", "scopes"],
  authorityRoster: [
    "id",
    "issuedAt",
    "custodianRef",
    "principalRefs",
    "evidenceRef",
    "contentDigest",
  ],
  authorityGrant: [
    "id",
    "granteeRef",
    "issuedByRef",
    "scope",
    "roundRef",
    "activeFrom",
    "activeUntil",
    "rosterRef",
    "rosterDigest",
    "evidenceRef",
    "payloadDigest",
  ],
  evidence: [
    "id",
    "kind",
    "roundRef",
    "observedAt",
    "suppliedByRef",
    "subjectRefs",
    "sourceRecordDigest",
    "payloadDigest",
    "recordDigest",
  ],
  blocker: [
    "id",
    "certificateRef",
    "category",
    "subjectRefs",
    "detectedAt",
    "ownerRef",
    "evidenceRef",
    "payloadDigest",
  ],
  coverage: [
    "roundRef",
    "planDigest",
    "certificateRefs",
    "rotateCertificateRefs",
    "excludeCertificateRefs",
    "bindingRefs",
    "rotationRequestRefs",
    "issuanceRefs",
    "deploymentRefs",
    "endpointObservationRefs",
    "retirementRefs",
    "overlapRefs",
    "blockerRefs",
    "contentDigest",
  ],
  destinationApproval: [
    "id",
    "roundRef",
    "planDigest",
    "coverageDigest",
    "destination",
    "approvedByRef",
    "authorityGrantRef",
    "approvedAt",
    "evidenceRef",
    "payloadDigest",
  ],
  handoff: [
    "id",
    "roundRef",
    "planDigest",
    "coverageDigest",
    "destinationApprovalRef",
    "destinationApprovalDigest",
    "destinationApprovalEvidenceDigest",
    "state",
    "nextOwnerRef",
    "authorityGrantRef",
    "handedOffAt",
    "rotationRequestRefs",
    "issuanceRefs",
    "deploymentRefs",
    "endpointObservationRefs",
    "retirementRefs",
    "overlapRefs",
    "blockerRefs",
    ...NOT_CLAIMED_FIELDS,
    "evidenceRef",
    "payloadDigest",
  ],
});

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
  return a < b ? -1 : a > b ? 1 : 0;
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

function sorted(value) {
  return strings(value).sort(compareUtf16CodeUnits);
}

function sortedRecords(value) {
  return records(value).sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
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
  if (typeof value !== "string") return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapById(rows) {
  return new Map(rows.filter((row) => typeof row.id === "string").map((row) => [row.id, row]));
}

function withoutDigest(row) {
  const value = object(row);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "payloadDigest" && key !== "contentDigest")
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right)),
  );
}

export function computeCertificateDigest(row) {
  return digest(withoutDigest(row));
}

export function computeBindingDigest(row) {
  return digest(withoutDigest(row));
}

export function computeRotationRequestDigest(row) {
  return digest(withoutDigest(row));
}

export function computeIssuanceDigest(row) {
  return digest(withoutDigest(row));
}

export function computeDeploymentDigest(row) {
  return digest(withoutDigest(row));
}

export function computeEndpointObservationDigest(row) {
  return digest(withoutDigest(row));
}

export function computeRetirementDigest(row) {
  return digest(withoutDigest(row));
}

export function computeOverlapDigest(row) {
  return digest(withoutDigest(row));
}

export function computeGrantDigest(row) {
  return digest(withoutDigest(row));
}

export function computeBlockerDigest(row) {
  return digest(withoutDigest(row));
}

export function computeCertificateExportDigest(certificateExport, certificates) {
  return digest({
    ...withoutDigest(certificateExport),
    certificates: sortedRecords(certificates).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeCertificateDigest(row),
    })),
  });
}

export function computeBindingExportDigest(bindingExport, bindings) {
  return digest({
    ...withoutDigest(bindingExport),
    bindings: sortedRecords(bindings).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeBindingDigest(row),
    })),
  });
}

export function computeAuthorityRosterDigest(authorityRoster, principals) {
  const roster = object(authorityRoster);
  return digest({
    custodianRef: roster.custodianRef ?? null,
    evidenceRef: roster.evidenceRef ?? null,
    id: roster.id ?? null,
    issuedAt: roster.issuedAt ?? null,
    principals: sortedRecords(principals).map((row) => ({
      id: row.id ?? null,
      kind: row.kind ?? null,
      name: row.name ?? null,
      scopes: sorted(row.scopes),
    })),
  });
}

export function computePlanDigest(round, artifact) {
  const value = object(artifact);
  const roundValue = object(round);
  return digest({
    artifactId: value.artifactId ?? null,
    authorityGrants: sortedRecords(value.authorityGrants).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeGrantDigest(row),
    })),
    authorityRosterDigest: roundValue.authorityRosterDigest ?? null,
    authorityRosterRef: roundValue.authorityRosterRef ?? null,
    bindingExportDigest: roundValue.bindingExportDigest ?? null,
    bindingExportRef: roundValue.bindingExportRef ?? null,
    campaignCoordinatorRef: roundValue.campaignCoordinatorRef ?? null,
    campaignRef: roundValue.campaignRef ?? null,
    campaignVersion: roundValue.campaignVersion ?? null,
    certificateExportDigest: roundValue.certificateExportDigest ?? null,
    certificateExportRef: roundValue.certificateExportRef ?? null,
    destination: roundValue.destination ?? null,
    destinationApproverRef: roundValue.destinationApproverRef ?? null,
    handoffOwnerRef: roundValue.handoffOwnerRef ?? null,
    id: roundValue.id ?? null,
    requestedAt: roundValue.requestedAt ?? null,
    rotationRequests: sortedRecords(value.rotationRequests).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeRotationRequestDigest(row),
    })),
    schemaVersion: value.schemaVersion ?? null,
  });
}

function evidenceSource(kind, artifact, evidenceRef) {
  const value = object(artifact);
  const find = (field, refField = "evidenceRef") =>
    records(value[field]).find((row) => row[refField] === evidenceRef) ?? null;
  switch (kind) {
    case "certificate-export":
      return object(value.certificateExport).evidenceRef === evidenceRef
        ? value.certificateExport
        : null;
    case "binding-export":
      return object(value.bindingExport).evidenceRef === evidenceRef ? value.bindingExport : null;
    case "authority-roster-export":
      return object(value.authorityRoster).evidenceRef === evidenceRef ? value.authorityRoster : null;
    case "authority-grant-record":
      return find("authorityGrants");
    case "rotation-request-record":
      return find("rotationRequests");
    case "issuance-record":
      return find("issuances");
    case "deployment-record":
      return find("deployments");
    case "endpoint-observation-record":
      return find("endpointObservations");
    case "retirement-record":
      return find("retirements");
    case "overlap-record":
      return find("overlaps");
    case "blocker-record":
      return find("blockers");
    case "destination-approval-record":
      return object(value.destinationApproval).evidenceRef === evidenceRef
        ? value.destinationApproval
        : null;
    case "handoff-record":
      return object(value.handoff).evidenceRef === evidenceRef ? value.handoff : null;
    default:
      return null;
  }
}

export function computeEvidencePayloadDigest(kind, artifact, evidenceRef) {
  const source = evidenceSource(kind, artifact, evidenceRef);
  if (source === null) return null;
  if (kind === "certificate-export") {
    return digest({
      certificateRefs: sorted(object(source).certificateRefs),
      contentDigest: object(source).contentDigest ?? null,
      evidenceRef: object(source).evidenceRef ?? null,
      id: object(source).id ?? null,
    });
  }
  if (kind === "binding-export") {
    return digest({
      bindingRefs: sorted(object(source).bindingRefs),
      contentDigest: object(source).contentDigest ?? null,
      evidenceRef: object(source).evidenceRef ?? null,
      id: object(source).id ?? null,
    });
  }
  if (kind === "authority-roster-export") {
    return digest({
      contentDigest: object(source).contentDigest ?? null,
      custodianRef: object(source).custodianRef ?? null,
      evidenceRef: object(source).evidenceRef ?? null,
      id: object(source).id ?? null,
      issuedAt: object(source).issuedAt ?? null,
      principalRefs: sorted(object(source).principalRefs),
    });
  }
  return digest(withoutDigest(source));
}

export function computeEvidenceRecordDigest(row) {
  const value = object(row);
  return digest({
    id: value.id ?? null,
    kind: value.kind ?? null,
    observedAt: value.observedAt ?? null,
    payloadDigest: value.payloadDigest ?? null,
    roundRef: value.roundRef ?? null,
    sourceRecordDigest: value.sourceRecordDigest ?? null,
    subjectRefs: sorted(value.subjectRefs),
    suppliedByRef: value.suppliedByRef ?? null,
  });
}

function coverageSupport(artifact) {
  const value = object(artifact);
  const payloads = (field, compute) =>
    sortedRecords(value[field]).map((row) => ({ id: row.id ?? null, payloadDigest: compute(row) }));
  return {
    bindings: payloads("bindings", computeBindingDigest),
    blockers: payloads("blockers", computeBlockerDigest),
    certificates: payloads("certificates", computeCertificateDigest),
    deployments: payloads("deployments", computeDeploymentDigest),
    endpointObservations: payloads("endpointObservations", computeEndpointObservationDigest),
    evidence: sortedRecords(value.evidence)
      .filter(
        (row) =>
          row.kind !== "destination-approval-record" && row.kind !== "handoff-record",
      )
      .map((row) => ({
        id: row.id ?? null,
        payloadDigest: computeEvidencePayloadDigest(row.kind, value, row.id),
        recordDigest: computeEvidenceRecordDigest(row),
      })),
    issuances: payloads("issuances", computeIssuanceDigest),
    overlaps: payloads("overlaps", computeOverlapDigest),
    retirements: payloads("retirements", computeRetirementDigest),
    rotationRequests: payloads("rotationRequests", computeRotationRequestDigest),
  };
}

export function computeCoverageDigest(coverage, artifact) {
  return digest({
    ...withoutDigest(coverage),
    support: coverageSupport(artifact),
  });
}

export function computeDestinationApprovalDigest(row) {
  return digest(withoutDigest(row));
}

export function computeHandoffDigest(row) {
  return digest(withoutDigest(row));
}

export function resealTlsCertificateRotationVerification(input) {
  const value = structuredClone(input);
  for (const row of records(value.certificates)) row.payloadDigest = computeCertificateDigest(row);
  for (const row of records(value.bindings)) row.payloadDigest = computeBindingDigest(row);
  value.certificateExport.contentDigest = computeCertificateExportDigest(
    value.certificateExport,
    value.certificates,
  );
  value.bindingExport.contentDigest = computeBindingExportDigest(
    value.bindingExport,
    value.bindings,
  );
  value.authorityRoster.contentDigest = computeAuthorityRosterDigest(
    value.authorityRoster,
    value.principals,
  );
  for (const row of records(value.authorityGrants)) {
    row.rosterDigest = value.authorityRoster.contentDigest;
    row.payloadDigest = computeGrantDigest(row);
  }
  const certificateById = new Map(records(value.certificates).map((row) => [row.id, row]));
  const bindingById = new Map(records(value.bindings).map((row) => [row.id, row]));
  for (const row of records(value.rotationRequests)) {
    const certificate = certificateById.get(row.certificateRef);
    row.certificatePayloadDigest = object(certificate).payloadDigest;
    row.payloadDigest = computeRotationRequestDigest(row);
  }
  value.round.certificateExportDigest = value.certificateExport.contentDigest;
  value.round.bindingExportDigest = value.bindingExport.contentDigest;
  value.round.authorityRosterDigest = value.authorityRoster.contentDigest;
  value.round.planDigest = computePlanDigest(value.round, value);
  const requestById = new Map(records(value.rotationRequests).map((row) => [row.id, row]));
  for (const row of records(value.issuances)) {
    const request = requestById.get(row.rotationRequestRef);
    row.rotationRequestPayloadDigest = object(request).payloadDigest;
    row.payloadDigest = computeIssuanceDigest(row);
  }
  const issuanceById = new Map(records(value.issuances).map((row) => [row.id, row]));
  for (const row of records(value.deployments)) {
    const binding = bindingById.get(row.bindingRef);
    const issuance = issuanceById.get(row.issuanceRef);
    row.bindingPayloadDigest = object(binding).payloadDigest;
    row.issuancePayloadDigest = object(issuance).payloadDigest;
    row.payloadDigest = computeDeploymentDigest(row);
  }
  const deploymentById = new Map(records(value.deployments).map((row) => [row.id, row]));
  for (const row of records(value.endpointObservations)) {
    const deployment = deploymentById.get(row.deploymentRef);
    row.deploymentPayloadDigest = object(deployment).payloadDigest;
    row.payloadDigest = computeEndpointObservationDigest(row);
  }
  for (const row of records(value.retirements)) {
    const certificate = certificateById.get(row.certificateRef);
    row.certificatePayloadDigest = object(certificate).payloadDigest;
    row.payloadDigest = computeRetirementDigest(row);
  }
  for (const row of records(value.overlaps)) {
    const certificate = certificateById.get(row.certificateRef);
    row.certificatePayloadDigest = object(certificate).payloadDigest;
    row.payloadDigest = computeOverlapDigest(row);
  }
  for (const row of records(value.blockers)) row.payloadDigest = computeBlockerDigest(row);
  for (const row of records(value.evidence)) {
    if (!["destination-approval-record", "handoff-record"].includes(row.kind)) {
      row.payloadDigest = computeEvidencePayloadDigest(row.kind, value, row.id);
      row.recordDigest = computeEvidenceRecordDigest(row);
    }
  }
  value.coverage.planDigest = value.round.planDigest;
  value.coverage.contentDigest = computeCoverageDigest(value.coverage, value);
  value.destinationApproval.planDigest = value.round.planDigest;
  value.destinationApproval.coverageDigest = value.coverage.contentDigest;
  value.destinationApproval.payloadDigest = computeDestinationApprovalDigest(
    value.destinationApproval,
  );
  const destinationEvidence = records(value.evidence).find(
    (row) => row.kind === "destination-approval-record",
  );
  if (destinationEvidence) {
    destinationEvidence.payloadDigest = computeEvidencePayloadDigest(
      destinationEvidence.kind,
      value,
      destinationEvidence.id,
    );
    destinationEvidence.recordDigest = computeEvidenceRecordDigest(destinationEvidence);
  }
  value.handoff.planDigest = value.round.planDigest;
  value.handoff.coverageDigest = value.coverage.contentDigest;
  value.handoff.destinationApprovalDigest = value.destinationApproval.payloadDigest;
  value.handoff.destinationApprovalEvidenceDigest = object(destinationEvidence).recordDigest;
  value.handoff.payloadDigest = computeHandoffDigest(value.handoff);
  const handoffEvidence = records(value.evidence).find((row) => row.kind === "handoff-record");
  if (handoffEvidence) {
    handoffEvidence.payloadDigest = computeEvidencePayloadDigest(
      handoffEvidence.kind,
      value,
      handoffEvidence.id,
    );
    handoffEvidence.recordDigest = computeEvidenceRecordDigest(handoffEvidence);
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

function rejectFields(record, allowed, path, add) {
  if (!isRecord(record)) return;
  const fields = new Set(allowed);
  for (const key of Object.keys(record).sort(compareUtf16CodeUnits)) {
    if (!fields.has(key)) add("prohibited_contract_field", `${path}.${key}`);
  }
}

function rejectUnknownShapes(value, add) {
  rejectFields(value, FIELDS.top, "$", add);
  rejectFields(value.round, FIELDS.round, "$.round", add);
  rejectFields(value.certificateExport, FIELDS.certificateExport, "$.certificateExport", add);
  rejectFields(value.bindingExport, FIELDS.bindingExport, "$.bindingExport", add);
  rejectFields(value.authorityRoster, FIELDS.authorityRoster, "$.authorityRoster", add);
  rejectFields(value.coverage, FIELDS.coverage, "$.coverage", add);
  rejectFields(value.destinationApproval, FIELDS.destinationApproval, "$.destinationApproval", add);
  rejectFields(value.handoff, FIELDS.handoff, "$.handoff", add);
  for (const [field, shape] of [
    ["certificates", "certificate"],
    ["bindings", "binding"],
    ["rotationRequests", "rotationRequest"],
    ["issuances", "issuance"],
    ["deployments", "deployment"],
    ["endpointObservations", "endpointObservation"],
    ["retirements", "retirement"],
    ["overlaps", "overlap"],
    ["principals", "principal"],
    ["authorityGrants", "authorityGrant"],
    ["evidence", "evidence"],
    ["blockers", "blocker"],
  ]) {
    records(value[field]).forEach((row, index) =>
      rejectFields(row, FIELDS[shape], `$.${field}[${index}]`, add),
    );
  }
}

function scanProhibitedKeys(value, add) {
  const seen = new Set();
  function visit(node, path) {
    if ((!isRecord(node) && !Array.isArray(node)) || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const key of Object.keys(node).sort(compareUtf16CodeUnits)) {
      const words = key.replaceAll(/([a-z])([A-Z])/gu, "$1 $2").replaceAll(/[-_/]/gu, " ");
      if (
        !(path === "$.handoff" && NOT_CLAIMED_FIELDS.includes(key)) &&
        PROHIBITED_KEY_PATTERN.test(words)
      ) {
        add("prohibited_contract_field", `${path}.${key}`);
      }
      visit(node[key], `${path}.${key}`);
    }
  }
  visit(value, "$");
}

function collectIds(value, add) {
  const ids = new Map();
  const seen = new Set();
  function visit(node, path) {
    if ((!isRecord(node) && !Array.isArray(node)) || seen.has(node)) return;
    seen.add(node);
    if (isRecord(node) && Object.hasOwn(node, "id")) {
      if (typeof node.id !== "string" || !ID_PATTERN.test(node.id)) {
        add("invalid_identity", `${path}.id`);
      } else if (ids.has(node.id)) {
        add("duplicate_identity", `${path}.id`, [node.id]);
      } else {
        ids.set(node.id, path);
      }
    }
    if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${path}[${index}]`));
    else for (const key of Object.keys(node)) visit(node[key], `${path}.${key}`);
  }
  visit(value, "$");
}

function sortedFindings(findings) {
  const unique = new Map(findings.map((row) => [canonicalJson(row), row]));
  return [...unique.values()].sort((left, right) =>
    compareUtf16CodeUnits(canonicalJson(left), canonicalJson(right)),
  );
}

export function tlsCertificateRotationVerificationFindings(input, context) {
  if (!isRecord(input)) return [finding("invalid_artifact", "$")];
  const value = input;
  const findings = [];
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  rejectUnknownShapes(value, add);
  scanProhibitedKeys(value, add);
  collectIds(value, add);

  if (value.schemaVersion !== TLS_CERTIFICATE_ROTATION_VERIFICATION_SCHEMA_VERSION) {
    add("invalid_artifact", "$.schemaVersion");
  }
  if (typeof value.artifactId !== "string" || !ID_PATTERN.test(value.artifactId)) {
    add("invalid_identity", "$.artifactId");
  }

  const asOf = timestamp(object(context).asOf);
  if (asOf === null) add("invalid_validation_context", "$.validationContext.asOf");
  const checkTime = (raw, path, refs = [], allowFuture = false) => {
    const parsed = timestamp(raw);
    if (parsed === null) add("invalid_timestamp", path, refs);
    else if (!allowFuture && asOf !== null && parsed > asOf) add("future_record", path, refs);
    return parsed;
  };
  const ledger = (field) => {
    if (!Array.isArray(value[field]) || value[field].some((row) => !isRecord(row))) {
      add("invalid_artifact_shape", `$.${field}`);
    }
    return records(value[field]);
  };

  const round = object(value.round);
  const certificates = ledger("certificates");
  const bindings = ledger("bindings");
  const rotationRequests = ledger("rotationRequests");
  const issuances = ledger("issuances");
  const deployments = ledger("deployments");
  const endpointObservations = ledger("endpointObservations");
  const retirements = ledger("retirements");
  const overlaps = ledger("overlaps");
  const principals = ledger("principals");
  const grants = ledger("authorityGrants");
  const evidence = ledger("evidence");
  const blockers = ledger("blockers");
  const certificateExport = object(value.certificateExport);
  const bindingExport = object(value.bindingExport);
  const roster = object(value.authorityRoster);
  const coverage = object(value.coverage);
  const destination = object(value.destinationApproval);
  const handoff = object(value.handoff);
  const certificateById = mapById(certificates);
  const bindingById = mapById(bindings);
  const requestById = mapById(rotationRequests);
  const deploymentById = mapById(deployments);
  const principalById = mapById(principals);
  const grantById = mapById(grants);
  const evidenceById = mapById(evidence);

  const requestedAt = checkTime(round.requestedAt, "$.round.requestedAt", [round.id]);
  if (
    typeof round.campaignRef !== "string" ||
    !ID_PATTERN.test(round.campaignRef) ||
    typeof round.campaignVersion !== "string" ||
    round.campaignVersion.trim().length === 0 ||
    round.destination !== DESTINATION
  ) {
    add("invalid_round", "$.round", [round.id]);
  }

  const hasScope = (ref, scope, kind = null) => {
    const principal = object(principalById.get(ref));
    return (
      (kind === null || principal.kind === kind) && strings(principal.scopes).includes(scope)
    );
  };
  const grantFor = (ref, granteeRef, scope, at) => {
    const grant = object(grantById.get(ref));
    const from = timestamp(grant.activeFrom);
    const until = timestamp(grant.activeUntil);
    return (
      grant.id === ref &&
      grant.granteeRef === granteeRef &&
      grant.scope === scope &&
      grant.roundRef === round.id &&
      grant.rosterRef === roster.id &&
      grant.rosterDigest === roster.contentDigest &&
      grant.payloadDigest === computeGrantDigest(grant) &&
      from !== null &&
      until !== null &&
      at !== null &&
      from <= at &&
      at <= until
    );
  };
  const hasGrant = (granteeRef, scope, at) =>
    grants.some((grant) => grantFor(grant.id, granteeRef, scope, at));
  if (!hasScope(round.campaignCoordinatorRef, "campaign-coordinator", "named-human")) {
    add("invalid_round", "$.round.campaignCoordinatorRef", [round.campaignCoordinatorRef]);
  }

  for (const [index, principal] of principals.entries()) {
    if (
      typeof principal.name !== "string" ||
      principal.name.trim().length < 3 ||
      !["named-human", "owner-system", "provider-system"].includes(principal.kind) ||
      strings(principal.scopes).length === 0
    ) {
      add("invalid_principal", `$.principals[${index}]`, [principal.id]);
    }
  }
  const rosterIssuedAt = checkTime(roster.issuedAt, "$.authorityRoster.issuedAt", [roster.id]);
  if (
    !sameExactSet(roster.principalRefs, principals.map((row) => row.id)) ||
    roster.contentDigest !== computeAuthorityRosterDigest(roster, principals) ||
    !hasScope(roster.custodianRef, "authority-roster-custodian", "named-human")
  ) {
    add("invalid_authority_roster", "$.authorityRoster", [roster.id]);
  }
  for (const [index, grant] of grants.entries()) {
    const activeFrom = checkTime(grant.activeFrom, `$.authorityGrants[${index}].activeFrom`, [grant.id]);
    const activeUntil = checkTime(
      grant.activeUntil,
      `$.authorityGrants[${index}].activeUntil`,
      [grant.id],
      true,
    );
    if (
      grant.roundRef !== round.id ||
      grant.rosterRef !== roster.id ||
      grant.rosterDigest !== roster.contentDigest ||
      grant.payloadDigest !== computeGrantDigest(grant) ||
      !hasScope(grant.issuedByRef, "authority-grant-issuer", "named-human") ||
      !principalById.has(grant.granteeRef) ||
      !roster.principalRefs.includes(grant.granteeRef) ||
      grant.issuedByRef === grant.granteeRef ||
      activeFrom === null ||
      activeUntil === null ||
      activeFrom > activeUntil ||
      (rosterIssuedAt !== null && activeFrom < rosterIssuedAt)
    ) {
      add("invalid_authority_grant", `$.authorityGrants[${index}]`, [grant.id]);
    }
  }

  const roleRefs = [
    ["authority-roster-custodian", [roster.custodianRef]],
    ["authority-grant-issuer", grants.map((row) => row.issuedByRef)],
    ["certificate-exporter", [certificateExport.suppliedByRef, ...certificates.map((row) => row.ownerSystemRef)]],
    ["binding-exporter", [bindingExport.suppliedByRef]],
    ["campaign-coordinator", [round.campaignCoordinatorRef, ...blockers.map((row) => row.ownerRef)]],
    ["rotation-approver", rotationRequests.map((row) => row.requestedByRef)],
    ["ca-provider-reporter", issuances.map((row) => row.providerRef)],
    ["deployment-observer", deployments.map((row) => row.observerRef)],
    ["endpoint-validator", endpointObservations.map((row) => row.validatorRef)],
    ["retirement-observer", retirements.map((row) => row.observerRef)],
    ["overlap-approver", overlaps.map((row) => row.approvedByRef)],
    ["destination-approver", [round.destinationApproverRef]],
    ["handoff-recipient", [round.handoffOwnerRef]],
  ].map(([role, refs]) => [role, new Set(strings(refs))]);
  for (let left = 0; left < roleRefs.length; left += 1) {
    for (let right = left + 1; right < roleRefs.length; right += 1) {
      for (const ref of roleRefs[left][1]) {
        if (roleRefs[right][1].has(ref)) {
          add("invalid_role_separation", "$.principals", [
            roleRefs[left][0],
            roleRefs[right][0],
            ref,
          ]);
        }
      }
    }
  }

  const certificateIds = certificates.map((row) => row.id);
  const rotateCertificates = certificates
    .filter((row) => row.rotationState === "rotate")
    .map((row) => row.id);
  const excludeCertificates = certificates
    .filter((row) => row.rotationState === "exclude")
    .map((row) => row.id);
  for (const [index, certificate] of certificates.entries()) {
    if (
      !hasScope(certificate.ownerSystemRef, "certificate-exporter", "owner-system") ||
      (certificate.rotationState === "rotate" && certificate.exclusionReason !== null) ||
      (certificate.rotationState === "exclude" && certificate.exclusionReason === null) ||
      certificate.payloadDigest !== computeCertificateDigest(certificate)
    ) {
      add("invalid_certificate", `$.certificates[${index}]`, [certificate.id]);
    }
  }
  const certificateExportedAt = checkTime(
    certificateExport.exportedAt,
    "$.certificateExport.exportedAt",
    [certificateExport.id],
  );
  if (
    round.certificateExportRef !== certificateExport.id ||
    round.certificateExportDigest !== certificateExport.contentDigest ||
    !sameExactSet(certificateExport.certificateRefs, certificateIds) ||
    !hasScope(certificateExport.suppliedByRef, "certificate-exporter", "owner-system") ||
    certificateExport.contentDigest !== computeCertificateExportDigest(certificateExport, certificates) ||
    (requestedAt !== null && certificateExportedAt !== null && certificateExportedAt > requestedAt)
  ) {
    add("invalid_certificate_universe", "$.certificateExport", certificateIds);
  }

  const bindingIds = bindings.map((row) => row.id);
  const bindingExportedAt = checkTime(
    bindingExport.exportedAt,
    "$.bindingExport.exportedAt",
    [bindingExport.id],
  );
  const bindingByLocatorDigest = new Map();
  for (const [index, binding] of bindings.entries()) {
    const collidingBinding = bindingByLocatorDigest.get(binding.endpointLocatorDigest);
    if (typeof binding.endpointLocatorDigest === "string" && collidingBinding) {
      add("invalid_binding", `$.bindings[${index}].endpointLocatorDigest`, [
        collidingBinding.id,
        binding.id,
      ]);
    } else if (typeof binding.endpointLocatorDigest === "string") {
      bindingByLocatorDigest.set(binding.endpointLocatorDigest, binding);
    }
    const certificate = object(certificateById.get(binding.certificateRef));
    if (
      certificate.id !== binding.certificateRef ||
      typeof binding.serviceRef !== "string" ||
      !ID_PATTERN.test(binding.serviceRef) ||
      typeof binding.listenerRef !== "string" ||
      !ID_PATTERN.test(binding.listenerRef) ||
      binding.payloadDigest !== computeBindingDigest(binding)
    ) {
      add("invalid_binding", `$.bindings[${index}]`, [binding.id]);
    }
  }
  if (
    round.bindingExportRef !== bindingExport.id ||
    round.bindingExportDigest !== bindingExport.contentDigest ||
    !sameExactSet(bindingExport.bindingRefs, bindingIds) ||
    !hasScope(bindingExport.suppliedByRef, "binding-exporter", "owner-system") ||
    bindingExport.contentDigest !== computeBindingExportDigest(bindingExport, bindings) ||
    (requestedAt !== null && bindingExportedAt !== null && bindingExportedAt > requestedAt)
  ) {
    add("invalid_binding_universe", "$.bindingExport", bindingIds);
  }

  const requestSeen = new Set();
  for (const [index, request] of rotationRequests.entries()) {
    const certificate = object(certificateById.get(request.certificateRef));
    const requestAt = checkTime(request.requestedAt, `$.rotationRequests[${index}].requestedAt`, [request.id]);
    if (requestSeen.has(request.certificateRef)) {
      add("invalid_rotation_partition", `$.rotationRequests[${index}]`, [request.id]);
    }
    requestSeen.add(request.certificateRef);
    if (
      certificate.rotationState !== "rotate" ||
      certificate.id !== request.certificateRef ||
      request.certificatePayloadDigest !== certificate.payloadDigest ||
      request.campaignRef !== round.campaignRef ||
      request.approvedVersion !== round.campaignVersion ||
      request.payloadDigest !== computeRotationRequestDigest(request) ||
      !hasScope(request.requestedByRef, "rotation-approver", "named-human") ||
      !grantFor(request.authorityGrantRef, request.requestedByRef, "approve-rotation-requests", requestAt) ||
      (requestedAt !== null && requestAt !== null && requestAt < requestedAt) ||
      (certificateExportedAt !== null && requestAt !== null && requestAt < certificateExportedAt) ||
      (bindingExportedAt !== null && requestAt !== null && requestAt < bindingExportedAt)
    ) {
      add("invalid_rotation_request", `$.rotationRequests[${index}]`, [request.id]);
    }
  }
  if (
    !sameExactSet([...requestSeen], rotateCertificates) ||
    rotationRequests.length !== rotateCertificates.length ||
    rotateCertificates.some((ref) => excludeCertificates.includes(ref))
  ) {
    add("invalid_rotation_partition", "$.rotationRequests", rotateCertificates);
  }

  if (
    round.authorityRosterRef !== roster.id ||
    round.authorityRosterDigest !== roster.contentDigest ||
    round.planDigest !== computePlanDigest(round, value)
  ) {
    add("invalid_plan_digest", "$.round", [round.id]);
  }

  const issuancesByRequest = new Map();
  const providerOperationKeys = new Set();
  const successorLogicalKeys = new Set();
  const successorVersionKeys = new Set();
  for (const [index, issuance] of issuances.entries()) {
    const request = object(requestById.get(issuance.rotationRequestRef));
    const submittedAt = checkTime(issuance.submittedAt, `$.issuances[${index}].submittedAt`, [issuance.id]);
    const decidedAt = issuance.decidedAt === null
      ? null
      : checkTime(issuance.decidedAt, `$.issuances[${index}].decidedAt`, [issuance.id]);
    const rows = issuancesByRequest.get(issuance.rotationRequestRef) ?? [];
    rows.push(issuance);
    issuancesByRequest.set(issuance.rotationRequestRef, rows);
    const providerReused = providerOperationKeys.has(issuance.providerOperationId);
    providerOperationKeys.add(issuance.providerOperationId);
    let identityReused = false;
    if (typeof issuance.successorLogicalId === "string") {
      identityReused ||= successorLogicalKeys.has(issuance.successorLogicalId);
      successorLogicalKeys.add(issuance.successorLogicalId);
    }
    if (typeof issuance.successorVersionId === "string") {
      identityReused ||= successorVersionKeys.has(issuance.successorVersionId);
      successorVersionKeys.add(issuance.successorVersionId);
    }
    const authorityAt = decidedAt ?? submittedAt;
    const outcomeShape =
      issuance.outcome === "issued"
        ? decidedAt !== null &&
          typeof issuance.successorLogicalId === "string" &&
          ID_PATTERN.test(issuance.successorLogicalId) &&
          typeof issuance.successorVersionId === "string" &&
          ID_PATTERN.test(issuance.successorVersionId) &&
          issuance.campaignRef === round.campaignRef
        : issuance.outcome === "failed"
          ? decidedAt !== null &&
            issuance.successorLogicalId === null &&
            issuance.successorVersionId === null &&
            issuance.campaignRef === null
          : issuance.outcome === "pending" &&
            issuance.decidedAt === null &&
            issuance.successorLogicalId === null &&
            issuance.successorVersionId === null &&
            issuance.campaignRef === null;
    if (
      request.id !== issuance.rotationRequestRef ||
      issuance.rotationRequestPayloadDigest !== request.payloadDigest ||
      typeof issuance.providerOperationId !== "string" ||
      !ID_PATTERN.test(issuance.providerOperationId) ||
      providerReused ||
      identityReused ||
      !hasScope(issuance.providerRef, "ca-provider-reporter", "provider-system") ||
      !hasGrant(issuance.providerRef, "report-issuance-outcomes", authorityAt) ||
      !outcomeShape ||
      submittedAt === null ||
      (decidedAt !== null && submittedAt > decidedAt) ||
      (requestAtOf(request) !== null && submittedAt !== null && submittedAt < requestAtOf(request)) ||
      issuance.payloadDigest !== computeIssuanceDigest(issuance)
    ) {
      add("invalid_issuance", `$.issuances[${index}]`, [issuance.id]);
    }
  }
  for (const [requestRef, rows] of issuancesByRequest) {
    if (rows.length > 1) add("invalid_issuance", "$.issuances", [requestRef]);
  }
  const uniqueIssuanceForRequest = (requestRef) => {
    const rows = issuancesByRequest.get(requestRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };
  const issuanceForCertificate = (certificateRef) => {
    const request = rotationRequests.find((row) => row.certificateRef === certificateRef);
    return request ? uniqueIssuanceForRequest(request.id) : null;
  };

  const deploymentsByBinding = new Map();
  for (const [index, deployment] of deployments.entries()) {
    const binding = object(bindingById.get(deployment.bindingRef));
    const request = rotationRequests.find((row) => row.certificateRef === binding.certificateRef);
    const issuance = request ? uniqueIssuanceForRequest(request.id) : null;
    const observedAt = checkTime(deployment.observedAt, `$.deployments[${index}].observedAt`, [deployment.id]);
    const rows = deploymentsByBinding.get(deployment.bindingRef) ?? [];
    rows.push(deployment);
    deploymentsByBinding.set(deployment.bindingRef, rows);
    const issued = issuance !== null && issuance.outcome === "issued";
    const shapeValid =
      deployment.outcome === "deployed"
        ? issued &&
          deployment.issuanceRef === issuance.id &&
          deployment.successorVersionId === issuance.successorVersionId &&
          deployment.rotationRequestRef === object(request).id
        : deployment.outcome === "failed" &&
          issued &&
          deployment.rotationRequestRef === object(request).id &&
          deployment.issuanceRef === (issuance?.id ?? null) &&
          deployment.issuancePayloadDigest === issuance?.payloadDigest &&
          deployment.successorVersionId === null;
    const causalTimes = [
      requestAtOf(request),
      issuance === null ? null : timestamp(issuance.submittedAt),
      issuance === null ? null : timestamp(issuance.decidedAt),
    ].filter((time) => time !== null);
    const earliestDeploymentAt = causalTimes.length === 0 ? null : Math.max(...causalTimes);
    if (
      binding.id !== deployment.bindingRef ||
      deployment.bindingPayloadDigest !== binding.payloadDigest ||
      deployment.issuancePayloadDigest !== issuance?.payloadDigest ||
      !hasScope(deployment.observerRef, "deployment-observer", "named-human") ||
      !hasGrant(deployment.observerRef, "report-deployment-observations", observedAt) ||
      !shapeValid ||
      observedAt === null ||
      (earliestDeploymentAt !== null && observedAt < earliestDeploymentAt) ||
      deployment.payloadDigest !== computeDeploymentDigest(deployment)
    ) {
      add("invalid_deployment", `$.deployments[${index}]`, [deployment.id]);
    }
  }
  for (const [bindingRef, rows] of deploymentsByBinding) {
    if (rows.length > 1) add("invalid_deployment", "$.deployments", [bindingRef]);
  }
  const uniqueDeploymentForBinding = (bindingRef) => {
    const rows = deploymentsByBinding.get(bindingRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };

  const observationsByDeployment = new Map();
  for (const [index, observation] of endpointObservations.entries()) {
    const deployment = object(deploymentById.get(observation.deploymentRef));
    const observedAt = checkTime(
      observation.observedAt,
      `$.endpointObservations[${index}].observedAt`,
      [observation.id],
    );
    const rows = observationsByDeployment.get(observation.deploymentRef) ?? [];
    rows.push(observation);
    observationsByDeployment.set(observation.deploymentRef, rows);
    const deploymentObservedAt = timestamp(deployment.observedAt);
    const checkCodes = strings(observation.checkCodes);
    const shapeValid =
      ["match", "fingerprint-mismatch", "chain-failed", "fingerprint-and-chain-failed"].includes(
        observation.outcome,
      ) &&
      deployment.outcome === "deployed" &&
      observation.bindingRef === deployment.bindingRef &&
      observation.expectedSuccessorVersionId === deployment.successorVersionId &&
      checkCodes.length > 0 &&
      (observation.outcome !== "match" ||
        (checkCodes.includes("fingerprint-match") && checkCodes.includes("chain-valid"))) &&
      (observation.outcome !== "fingerprint-mismatch" ||
        (!checkCodes.includes("fingerprint-match") && checkCodes.includes("chain-valid"))) &&
      (observation.outcome !== "chain-failed" ||
        (checkCodes.includes("fingerprint-match") && !checkCodes.includes("chain-valid"))) &&
      (observation.outcome !== "fingerprint-and-chain-failed" ||
        (!checkCodes.includes("fingerprint-match") && !checkCodes.includes("chain-valid")));
    if (
      deployment.id !== observation.deploymentRef ||
      observation.deploymentPayloadDigest !== deployment.payloadDigest ||
      !hasScope(observation.validatorRef, "endpoint-validator", "named-human") ||
      observation.validatorRef === object(deployment).observerRef ||
      !hasGrant(observation.validatorRef, "report-endpoint-observations", observedAt) ||
      !shapeValid ||
      observedAt === null ||
      (deploymentObservedAt !== null && observedAt < deploymentObservedAt) ||
      observation.payloadDigest !== computeEndpointObservationDigest(observation)
    ) {
      add("invalid_endpoint_observation", `$.endpointObservations[${index}]`, [observation.id]);
    }
  }
  for (const [deploymentRef, rows] of observationsByDeployment) {
    if (rows.length > 1) add("invalid_endpoint_observation", "$.endpointObservations", [deploymentRef]);
  }
  for (const deployment of deployments) {
    if (
      deployment.outcome !== "deployed" &&
      (observationsByDeployment.get(deployment.id) ?? []).length !== 0
    ) {
      add("invalid_endpoint_coverage", "$.endpointObservations", [deployment.id]);
    }
  }
  const uniqueObservationForDeployment = (deploymentRef) => {
    const rows = observationsByDeployment.get(deploymentRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };

  const bindingValidated = (binding) => {
    const deployment = uniqueDeploymentForBinding(binding.id);
    if (!deployment || deployment.outcome !== "deployed") return false;
    const observation = uniqueObservationForDeployment(deployment.id);
    return observation !== null && observation.outcome === "match";
  };
  const certificateBindings = (certificateRef) =>
    bindings.filter((row) => row.certificateRef === certificateRef);
  const allBindingsValidated = (certificateRef) => {
    const issuance = issuanceForCertificate(certificateRef);
    if (!issuance || issuance.outcome !== "issued") return false;
    const rows = certificateBindings(certificateRef);
    return rows.length > 0 && rows.every((binding) => bindingValidated(binding));
  };

  const retirementByCertificate = new Map();
  for (const [index, retirement] of retirements.entries()) {
    const certificate = object(certificateById.get(retirement.certificateRef));
    const observedAt = checkTime(retirement.observedAt, `$.retirements[${index}].observedAt`, [retirement.id]);
    const rows = retirementByCertificate.get(retirement.certificateRef) ?? [];
    rows.push(retirement);
    retirementByCertificate.set(retirement.certificateRef, rows);
    const endpointTimes = certificateBindings(retirement.certificateRef)
      .map((binding) => uniqueDeploymentForBinding(binding.id))
      .filter((deployment) => deployment !== null)
      .map((deployment) => uniqueObservationForDeployment(deployment.id))
      .filter((observation) => observation !== null)
      .map((observation) => timestamp(observation.observedAt))
      .filter((time) => time !== null);
    const earliestRetirementAt =
      endpointTimes.length === 0 ? null : Math.max(...endpointTimes);
    if (
      certificate.rotationState !== "rotate" ||
      certificate.id !== retirement.certificateRef ||
      retirement.certificatePayloadDigest !== certificate.payloadDigest ||
      !["retired", "revoked"].includes(retirement.outcome) ||
      !allBindingsValidated(retirement.certificateRef) ||
      !hasScope(retirement.observerRef, "retirement-observer", "named-human") ||
      !hasGrant(retirement.observerRef, "report-retirement", observedAt) ||
      observedAt === null ||
      (earliestRetirementAt !== null && observedAt < earliestRetirementAt) ||
      retirement.payloadDigest !== computeRetirementDigest(retirement)
    ) {
      add("invalid_retirement", `$.retirements[${index}]`, [retirement.id]);
    }
  }
  for (const [certificateRef, rows] of retirementByCertificate) {
    if (rows.length > 1) add("invalid_retirement", "$.retirements", [certificateRef]);
  }

  const overlapByCertificate = new Map();
  for (const [index, overlap] of overlaps.entries()) {
    const certificate = object(certificateById.get(overlap.certificateRef));
    const declaredAt = checkTime(overlap.declaredAt, `$.overlaps[${index}].declaredAt`, [overlap.id]);
    const overlapUntil = overlap.overlapUntil === null
      ? null
      : checkTime(overlap.overlapUntil, `$.overlaps[${index}].overlapUntil`, [overlap.id], true);
    const rows = overlapByCertificate.get(overlap.certificateRef) ?? [];
    rows.push(overlap);
    overlapByCertificate.set(overlap.certificateRef, rows);
    if (
      certificate.rotationState !== "rotate" ||
      certificate.id !== overlap.certificateRef ||
      overlap.certificatePayloadDigest !== certificate.payloadDigest ||
      overlap.state !== "temporary-overlap-active" ||
      !hasScope(overlap.approvedByRef, "overlap-approver", "named-human") ||
      !grantFor(overlap.authorityGrantRef, overlap.approvedByRef, "approve-temporary-overlap", declaredAt) ||
      declaredAt === null ||
      overlapUntil === null ||
      declaredAt > overlapUntil ||
      (asOf !== null && declaredAt > asOf) ||
      (asOf !== null && overlapUntil <= asOf) ||
      overlap.payloadDigest !== computeOverlapDigest(overlap)
    ) {
      add("invalid_overlap", `$.overlaps[${index}]`, [overlap.id]);
    }
  }
  for (const [certificateRef, rows] of overlapByCertificate) {
    if (rows.length > 1) add("invalid_overlap", "$.overlaps", [certificateRef]);
  }
  const uniqueRetirementForCertificate = (certificateRef) => {
    const rows = retirementByCertificate.get(certificateRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };
  const uniqueOverlapForCertificate = (certificateRef) => {
    const rows = overlapByCertificate.get(certificateRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };
  for (const certificateRef of rotateCertificates) {
    const hasRetirement = (retirementByCertificate.get(certificateRef) ?? []).length > 0;
    const hasOverlap = (overlapByCertificate.get(certificateRef) ?? []).length > 0;
    if (hasRetirement === hasOverlap) {
      add("invalid_terminal_state", "$.retirements", [certificateRef]);
    }
  }

  const expectedBlockers = [];
  const addExpected = (certificateRef, category, subjectRefs) =>
    expectedBlockers.push({ category, certificateRef, subjectRefs });
  for (const certificateRef of rotateCertificates) {
    const issuance = issuanceForCertificate(certificateRef);
    if (!issuance) addExpected(certificateRef, "issuance-missing", [certificateRef]);
    else if (issuance.outcome === "pending") addExpected(certificateRef, "issuance-pending", [certificateRef]);
    else if (issuance.outcome === "failed") addExpected(certificateRef, "issuance-failed", [certificateRef]);
    for (const binding of certificateBindings(certificateRef)) {
      const deployment = uniqueDeploymentForBinding(binding.id);
      if (!deployment) addExpected(certificateRef, "deployment-missing", [certificateRef, binding.id]);
      else if (deployment.outcome === "failed") {
        addExpected(certificateRef, "deployment-failed", [certificateRef, binding.id]);
      } else {
        const observation = uniqueObservationForDeployment(deployment.id);
        if (!observation) addExpected(certificateRef, "endpoint-missing", [certificateRef, binding.id]);
        else if (
          ["fingerprint-mismatch", "fingerprint-and-chain-failed"].includes(
            observation.outcome,
          )
        ) {
          addExpected(certificateRef, "endpoint-fingerprint-mismatch", [certificateRef, binding.id]);
        }
        if (["chain-failed", "fingerprint-and-chain-failed"].includes(observation?.outcome)) {
          addExpected(certificateRef, "endpoint-chain-failed", [certificateRef, binding.id]);
        }
      }
    }
    if (uniqueOverlapForCertificate(certificateRef)) {
      addExpected(certificateRef, "overlap-retained", [certificateRef]);
    }
  }
  const blockerKey = (row) =>
    canonicalJson({
      category: row.category ?? null,
      certificateRef: row.certificateRef ?? null,
      subjectRefs: sorted(row.subjectRefs),
    });
  const actualBlockerKeys = blockers.map(blockerKey).sort(compareUtf16CodeUnits);
  const expectedBlockerKeys = expectedBlockers.map(blockerKey).sort(compareUtf16CodeUnits);
  if (
    actualBlockerKeys.length !== expectedBlockerKeys.length ||
    actualBlockerKeys.some((key, index) => key !== expectedBlockerKeys[index])
  ) {
    add("invalid_blocker_equality", "$.blockers", expectedBlockers.map((row) => row.certificateRef));
  }
  for (const [index, blocker] of blockers.entries()) {
    const detectedAt = checkTime(blocker.detectedAt, `$.blockers[${index}].detectedAt`, [blocker.id]);
    const request = rotationRequests.find((row) => row.certificateRef === blocker.certificateRef);
    const issuance = request ? uniqueIssuanceForRequest(request.id) : null;
    const bindingRef = strings(blocker.subjectRefs).find((ref) => bindingById.has(ref));
    const deployment = bindingRef ? uniqueDeploymentForBinding(bindingRef) : null;
    const observation = deployment ? uniqueObservationForDeployment(deployment.id) : null;
    const overlap = uniqueOverlapForCertificate(blocker.certificateRef);
    const causalTimeByCategory = {
      "issuance-missing": requestAtOf(request),
      "issuance-pending": timestamp(issuance?.submittedAt),
      "issuance-failed": timestamp(issuance?.decidedAt),
      "deployment-missing": timestamp(issuance?.decidedAt),
      "deployment-failed": timestamp(deployment?.observedAt),
      "endpoint-missing": timestamp(deployment?.observedAt),
      "endpoint-fingerprint-mismatch": timestamp(observation?.observedAt),
      "endpoint-chain-failed": timestamp(observation?.observedAt),
      "overlap-retained": timestamp(overlap?.declaredAt),
    };
    const causalTime = causalTimeByCategory[blocker.category] ?? null;
    if (
      !certificateById.has(blocker.certificateRef) ||
      !strings(blocker.subjectRefs).includes(blocker.certificateRef) ||
      !hasScope(blocker.ownerRef, "campaign-coordinator", "named-human") ||
      (requestedAt !== null && detectedAt !== null && detectedAt < requestedAt) ||
      (causalTime !== null && detectedAt !== null && detectedAt < causalTime) ||
      blocker.payloadDigest !== computeBlockerDigest(blocker)
    ) {
      add("invalid_blocker", `$.blockers[${index}]`, [blocker.id]);
    }
  }

  const expectedEvidence = new Map();
  const expect = (ref, kind, supplier, subjects, sourceTime) => {
    if (typeof ref !== "string" || expectedEvidence.has(ref)) {
      add("invalid_evidence_closure", "$.evidence", [ref]);
      return;
    }
    expectedEvidence.set(ref, { kind, supplier, subjects, sourceTime });
  };
  expect(
    certificateExport.evidenceRef,
    "certificate-export",
    certificateExport.suppliedByRef,
    [certificateExport.id, ...certificateIds],
    certificateExport.exportedAt,
  );
  expect(
    bindingExport.evidenceRef,
    "binding-export",
    bindingExport.suppliedByRef,
    [bindingExport.id, ...bindingIds],
    bindingExport.exportedAt,
  );
  expect(
    roster.evidenceRef,
    "authority-roster-export",
    roster.custodianRef,
    [roster.id, ...principals.map((row) => row.id)],
    roster.issuedAt,
  );
  const evidenceRows = [
    ...grants.map((row) => [row, "authority-grant-record", row.issuedByRef, [row.id, row.granteeRef], row.activeFrom]),
    ...rotationRequests.map((row) => [row, "rotation-request-record", row.requestedByRef, [row.id, row.certificateRef], row.requestedAt]),
    ...issuances.map((row) => [row, "issuance-record", row.providerRef, [row.id, row.rotationRequestRef], row.decidedAt ?? row.submittedAt]),
    ...deployments.map((row) => [row, "deployment-record", row.observerRef, [row.id, row.bindingRef], row.observedAt]),
    ...endpointObservations.map((row) => [row, "endpoint-observation-record", row.validatorRef, [row.id, row.deploymentRef], row.observedAt]),
    ...retirements.map((row) => [row, "retirement-record", row.observerRef, [row.id, row.certificateRef], row.observedAt]),
    ...overlaps.map((row) => [row, "overlap-record", row.approvedByRef, [row.id, row.certificateRef], row.declaredAt]),
    ...blockers.map((row) => [row, "blocker-record", row.ownerRef, [row.id, ...strings(row.subjectRefs)], row.detectedAt]),
    [destination, "destination-approval-record", destination.approvedByRef, [destination.id], destination.approvedAt],
    [handoff, "handoff-record", handoff.nextOwnerRef, [handoff.id], handoff.handedOffAt],
  ];
  for (const [row, kind, supplier, subjects, sourceTime] of evidenceRows) {
    expect(row.evidenceRef, kind, supplier, subjects, sourceTime);
  }
  const sourceDigests = new Map();
  for (const [field, rows] of [
    ["certificates", certificates],
    ["bindings", bindings],
  ]) {
    for (const [index, row] of rows.entries()) {
      if (sourceDigests.has(row.sourceRecordDigest)) {
        add("duplicate_source_record_digest", `$.${field}[${index}].sourceRecordDigest`, [
          sourceDigests.get(row.sourceRecordDigest),
          row.id,
        ]);
      } else {
        sourceDigests.set(row.sourceRecordDigest, row.id);
      }
    }
  }
  for (const [index, row] of evidence.entries()) {
    const expected = expectedEvidence.get(row.id);
    const observedAt = checkTime(row.observedAt, `$.evidence[${index}].observedAt`, [row.id]);
    if (
      !expected ||
      row.kind !== expected.kind ||
      row.roundRef !== round.id ||
      row.suppliedByRef !== expected.supplier ||
      !sameExactSet(row.subjectRefs, expected.subjects)
    ) {
      add("invalid_evidence_closure", `$.evidence[${index}]`, [row.id]);
    }
    if (observedAt !== timestamp(expected?.sourceTime)) {
      add("invalid_evidence_chronology", `$.evidence[${index}].observedAt`, [row.id]);
    }
    if (
      row.payloadDigest !== computeEvidencePayloadDigest(row.kind, value, row.id) ||
      row.recordDigest !== computeEvidenceRecordDigest(row)
    ) {
      add("invalid_evidence_digest", `$.evidence[${index}]`, [row.id]);
    }
    if (sourceDigests.has(row.sourceRecordDigest)) {
      add("duplicate_source_record_digest", `$.evidence[${index}].sourceRecordDigest`, [
        sourceDigests.get(row.sourceRecordDigest),
        row.id,
      ]);
    } else {
      sourceDigests.set(row.sourceRecordDigest, row.id);
    }
  }
  for (const ref of expectedEvidence.keys()) {
    if (!evidenceById.has(ref)) add("invalid_evidence_closure", "$.evidence", [ref]);
  }

  const coverageFields = [
    ["certificateRefs", certificateIds],
    ["rotateCertificateRefs", rotateCertificates],
    ["excludeCertificateRefs", excludeCertificates],
    ["bindingRefs", bindingIds],
    ["rotationRequestRefs", rotationRequests.map((row) => row.id)],
    ["issuanceRefs", issuances.map((row) => row.id)],
    ["deploymentRefs", deployments.map((row) => row.id)],
    ["endpointObservationRefs", endpointObservations.map((row) => row.id)],
    ["retirementRefs", retirements.map((row) => row.id)],
    ["overlapRefs", overlaps.map((row) => row.id)],
    ["blockerRefs", blockers.map((row) => row.id)],
  ];
  if (
    coverage.roundRef !== round.id ||
    coverage.planDigest !== round.planDigest ||
    coverageFields.some(([field, expected]) => !sameExactSet(coverage[field], expected)) ||
    coverage.contentDigest !== computeCoverageDigest(coverage, value)
  ) {
    add("invalid_coverage", "$.coverage", certificateIds);
  }

  const allInternalDigests = new Set(
    [
      ...certificates.map((row) => row.payloadDigest),
      certificateExport.contentDigest,
      ...bindings.map((row) => row.payloadDigest),
      bindingExport.contentDigest,
      ...rotationRequests.map((row) => row.payloadDigest),
      roster.contentDigest,
      ...grants.map((row) => row.payloadDigest),
      round.planDigest,
      ...issuances.map((row) => row.payloadDigest),
      ...deployments.map((row) => row.payloadDigest),
      ...endpointObservations.map((row) => row.payloadDigest),
      ...retirements.map((row) => row.payloadDigest),
      ...overlaps.map((row) => row.payloadDigest),
      ...blockers.map((row) => row.payloadDigest),
      coverage.contentDigest,
      destination.payloadDigest,
      handoff.payloadDigest,
      ...evidence.flatMap((row) => [row.payloadDigest, row.recordDigest]),
    ].filter((item) => typeof item === "string"),
  );
  for (const [index, row] of evidence.entries()) {
    if (allInternalDigests.has(row.sourceRecordDigest)) {
      add("derived_source_record_digest", `$.evidence[${index}].sourceRecordDigest`, [row.id]);
    }
  }
  for (const [field, rows] of [
    ["certificates", certificates],
    ["bindings", bindings],
  ]) {
    for (const [index, row] of rows.entries()) {
      if (allInternalDigests.has(row.sourceRecordDigest)) {
        add("derived_source_record_digest", `$.${field}[${index}].sourceRecordDigest`, [row.id]);
      }
    }
  }

  const approvedAt = checkTime(destination.approvedAt, "$.destinationApproval.approvedAt", [destination.id]);
  const coverageEvidenceTimes = evidence
    .filter(
      (row) =>
        row.kind !== "destination-approval-record" && row.kind !== "handoff-record",
    )
    .map((row) => timestamp(row.observedAt))
    .filter((time) => time !== null);
  const latestCoverageEvidenceAt =
    coverageEvidenceTimes.length === 0 ? null : Math.max(...coverageEvidenceTimes);
  if (
    destination.roundRef !== round.id ||
    destination.planDigest !== round.planDigest ||
    destination.coverageDigest !== coverage.contentDigest ||
    destination.destination !== DESTINATION ||
    destination.approvedByRef !== round.destinationApproverRef ||
    !hasScope(destination.approvedByRef, "destination-approver", "named-human") ||
    !grantFor(destination.authorityGrantRef, destination.approvedByRef, "approve-destination", approvedAt) ||
    (latestCoverageEvidenceAt !== null && approvedAt !== null && approvedAt < latestCoverageEvidenceAt) ||
    destination.payloadDigest !== computeDestinationApprovalDigest(destination)
  ) {
    add("invalid_destination", "$.destinationApproval", [destination.id]);
  }
  const handedOffAt = checkTime(handoff.handedOffAt, "$.handoff.handedOffAt", [handoff.id]);
  const destinationEvidenceRecord = object(evidenceById.get(destination.evidenceRef));
  if (
    handoff.roundRef !== round.id ||
    handoff.planDigest !== round.planDigest ||
    handoff.coverageDigest !== coverage.contentDigest ||
    handoff.destinationApprovalRef !== destination.id ||
    handoff.destinationApprovalDigest !== destination.payloadDigest ||
    handoff.destinationApprovalEvidenceDigest !== destinationEvidenceRecord.recordDigest ||
    handoff.state !== (blockers.length === 0 ? "ready-for-owner-review" : "blocked") ||
    handoff.nextOwnerRef !== round.handoffOwnerRef ||
    !hasScope(handoff.nextOwnerRef, "handoff-recipient", "named-human") ||
    !grantFor(handoff.authorityGrantRef, handoff.nextOwnerRef, "receive-handoff", handedOffAt) ||
    !sameExactSet(handoff.rotationRequestRefs, rotationRequests.map((row) => row.id)) ||
    !sameExactSet(handoff.issuanceRefs, issuances.map((row) => row.id)) ||
    !sameExactSet(handoff.deploymentRefs, deployments.map((row) => row.id)) ||
    !sameExactSet(handoff.endpointObservationRefs, endpointObservations.map((row) => row.id)) ||
    !sameExactSet(handoff.retirementRefs, retirements.map((row) => row.id)) ||
    !sameExactSet(handoff.overlapRefs, overlaps.map((row) => row.id)) ||
    !sameExactSet(handoff.blockerRefs, blockers.map((row) => row.id)) ||
    NOT_CLAIMED_FIELDS.some((field) => handoff[field] !== "not-claimed") ||
    handoff.payloadDigest !== computeHandoffDigest(handoff) ||
    (approvedAt !== null && handedOffAt !== null && handedOffAt < approvedAt)
  ) {
    add("invalid_handoff", "$.handoff", [handoff.id]);
  }

  return sortedFindings(findings);
}

function requestAtOf(request) {
  return timestamp(object(request).requestedAt);
}
