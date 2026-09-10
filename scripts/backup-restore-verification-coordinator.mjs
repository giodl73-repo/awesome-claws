import { createHash } from "node:crypto";

export const BACKUP_RESTORE_VERIFICATION_SCHEMA_VERSION =
  "awesomeClaws.backupRestoreVerification.v1";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DESTINATION = "resilience-owner-review-queue";
const NOT_CLAIMED_FIELDS = [
  "restoreExecutionClaim",
  "validationExecutionClaim",
  "cleanupExecutionClaim",
  "productionReadinessClaim",
  "recoverabilityClaim",
  "complianceClaim",
  "auditClaim",
  "failoverClaim",
  "deletionClaim",
  "verificationCompletionClaim",
];
const PROHIBITED_KEY_PATTERN =
  /(?:^|[^a-z])(?:action|recommendation|interpretation|assurance|executed|restored|validated|cleaned|ready|recoverable|compliant|audited|failed-over|deleted)(?:[^a-z]|$)/iu;

const FIELDS = Object.freeze({
  top: [
    "schemaVersion",
    "artifactId",
    "round",
    "resources",
    "protectedResourceExport",
    "recoveryPoints",
    "recoveryPointExport",
    "targets",
    "selections",
    "principals",
    "authorityRoster",
    "authorityGrants",
    "providerJobs",
    "validations",
    "cleanups",
    "evidence",
    "blockers",
    "coverage",
    "destinationApproval",
    "handoff",
  ],
  round: [
    "id",
    "requestedAt",
    "rpoMinutes",
    "rtoMinutes",
    "protectedResourceExportRef",
    "protectedResourceExportDigest",
    "recoveryPointExportRef",
    "recoveryPointExportDigest",
    "authorityRosterRef",
    "authorityRosterDigest",
    "destination",
    "destinationApproverRef",
    "handoffOwnerRef",
    "planDigest",
  ],
  resource: [
    "id",
    "ownerSystemRef",
    "resourceClass",
    "selectionState",
    "exclusionReason",
    "sourceRecordDigest",
    "payloadDigest",
  ],
  protectedResourceExport: [
    "id",
    "exportedAt",
    "suppliedByRef",
    "resourceRefs",
    "evidenceRef",
    "contentDigest",
  ],
  recoveryPoint: [
    "id",
    "resourceRef",
    "providerRef",
    "capturedAt",
    "eligibility",
    "sourceRecordDigest",
    "payloadDigest",
  ],
  recoveryPointExport: [
    "id",
    "exportedAt",
    "cutoffAt",
    "suppliedByRef",
    "recoveryPointRefs",
    "evidenceRef",
    "contentDigest",
  ],
  target: [
    "id",
    "providerRef",
    "isolation",
    "locatorDigest",
    "sourceRecordDigest",
    "evidenceRef",
    "payloadDigest",
  ],
  selection: [
    "id",
    "resourceRef",
    "resourcePayloadDigest",
    "recoveryPointRef",
    "recoveryPointPayloadDigest",
    "targetRef",
    "targetPayloadDigest",
    "selectedByRef",
    "authorityGrantRef",
    "selectedAt",
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
  providerJob: [
    "id",
    "selectionRef",
    "selectionPayloadDigest",
    "providerRef",
    "providerJobRef",
    "submittedAt",
    "completedAt",
    "outcome",
    "evidenceRef",
    "payloadDigest",
  ],
  validation: [
    "id",
    "selectionRef",
    "selectionPayloadDigest",
    "providerJobRef",
    "providerJobPayloadDigest",
    "validatorRef",
    "startedAt",
    "completedAt",
    "outcome",
    "checkCodes",
    "evidenceRef",
    "payloadDigest",
  ],
  cleanup: [
    "id",
    "selectionRef",
    "selectionPayloadDigest",
    "targetRef",
    "targetPayloadDigest",
    "ownerRef",
    "requestedAt",
    "completedAt",
    "outcome",
    "retentionReason",
    "retentionUntil",
    "retentionApprovedByRef",
    "retentionApprovalEvidenceRef",
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
    "selectionRef",
    "category",
    "targetRefs",
    "detectedAt",
    "ownerRef",
    "evidenceRef",
    "payloadDigest",
  ],
  coverage: [
    "roundRef",
    "planDigest",
    "resourceRefs",
    "selectedResourceRefs",
    "excludedResourceRefs",
    "recoveryPointRefs",
    "selectionRefs",
    "targetRefs",
    "providerJobRefs",
    "validationRefs",
    "cleanupRefs",
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
    "state",
    "nextOwnerRef",
    "authorityGrantRef",
    "handedOffAt",
    "selectedTripleRefs",
    "providerJobRefs",
    "validationRefs",
    "cleanupRefs",
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

export function computeResourceDigest(row) {
  return digest(withoutDigest(row));
}

export function computeRecoveryPointDigest(row) {
  return digest(withoutDigest(row));
}

export function computeTargetDigest(row) {
  return digest(withoutDigest(row));
}

export function computeSelectionDigest(row) {
  return digest(withoutDigest(row));
}

export function computeGrantDigest(row) {
  return digest(withoutDigest(row));
}

export function computeJobDigest(row) {
  return digest(withoutDigest(row));
}

export function computeValidationDigest(row) {
  return digest(withoutDigest(row));
}

export function computeCleanupDigest(row) {
  return digest(withoutDigest(row));
}

export function computeBlockerDigest(row) {
  return digest(withoutDigest(row));
}

export function computeResourceExportDigest(resourceExport, resources) {
  return digest({
    ...withoutDigest(resourceExport),
    resources: sortedRecords(resources).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeResourceDigest(row),
    })),
  });
}

export function computeRecoveryPointExportDigest(recoveryPointExport, recoveryPoints) {
  return digest({
    ...withoutDigest(recoveryPointExport),
    recoveryPoints: sortedRecords(recoveryPoints).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeRecoveryPointDigest(row),
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
  return digest({
    artifactId: value.artifactId ?? null,
    authorityGrants: sortedRecords(value.authorityGrants).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeGrantDigest(row),
    })),
    authorityRosterDigest: object(round).authorityRosterDigest ?? null,
    authorityRosterRef: object(round).authorityRosterRef ?? null,
    destination: object(round).destination ?? null,
    destinationApproverRef: object(round).destinationApproverRef ?? null,
    handoffOwnerRef: object(round).handoffOwnerRef ?? null,
    id: object(round).id ?? null,
    protectedResourceExportDigest: object(round).protectedResourceExportDigest ?? null,
    protectedResourceExportRef: object(round).protectedResourceExportRef ?? null,
    recoveryPointExportDigest: object(round).recoveryPointExportDigest ?? null,
    recoveryPointExportRef: object(round).recoveryPointExportRef ?? null,
    requestedAt: object(round).requestedAt ?? null,
    rpoMinutes: object(round).rpoMinutes ?? null,
    rtoMinutes: object(round).rtoMinutes ?? null,
    schemaVersion: value.schemaVersion ?? null,
    selections: sortedRecords(value.selections).map((row) => ({
      id: row.id ?? null,
      payloadDigest: computeSelectionDigest(row),
    })),
  });
}

function evidenceSource(kind, artifact, evidenceRef) {
  const value = object(artifact);
  const find = (field, refField = "evidenceRef") =>
    records(value[field]).find((row) => row[refField] === evidenceRef) ?? null;
  switch (kind) {
    case "resource-export":
      return object(value.protectedResourceExport).evidenceRef === evidenceRef
        ? value.protectedResourceExport
        : null;
    case "recovery-point-export":
      return object(value.recoveryPointExport).evidenceRef === evidenceRef
        ? value.recoveryPointExport
        : null;
    case "authority-roster-export":
      return object(value.authorityRoster).evidenceRef === evidenceRef ? value.authorityRoster : null;
    case "authority-grant-record":
      return find("authorityGrants");
    case "target-record":
      return find("targets");
    case "selection-record":
      return find("selections");
    case "provider-job-record":
      return find("providerJobs");
    case "validation-record":
      return find("validations");
    case "cleanup-record":
      return find("cleanups");
    case "retention-approval-record": {
      const cleanup = records(value.cleanups).find(
        (row) => row.retentionApprovalEvidenceRef === evidenceRef,
      );
      return cleanup ?? null;
    }
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
  if (kind === "resource-export") {
    return digest({
      contentDigest: object(source).contentDigest ?? null,
      evidenceRef: object(source).evidenceRef ?? null,
      id: object(source).id ?? null,
      resourceRefs: sorted(object(source).resourceRefs),
    });
  }
  if (kind === "recovery-point-export") {
    return digest({
      contentDigest: object(source).contentDigest ?? null,
      cutoffAt: object(source).cutoffAt ?? null,
      evidenceRef: object(source).evidenceRef ?? null,
      id: object(source).id ?? null,
      recoveryPointRefs: sorted(object(source).recoveryPointRefs),
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
    blockers: payloads("blockers", computeBlockerDigest),
    cleanups: payloads("cleanups", computeCleanupDigest),
    evidence: sortedRecords(value.evidence)
      .filter(
        (row) =>
          row.kind !== "destination-approval-record" &&
          row.kind !== "handoff-record",
      )
      .map((row) => ({
        id: row.id ?? null,
        payloadDigest: computeEvidencePayloadDigest(row.kind, value, row.id),
        recordDigest: computeEvidenceRecordDigest(row),
      })),
    jobs: payloads("providerJobs", computeJobDigest),
    recoveryPoints: payloads("recoveryPoints", computeRecoveryPointDigest),
    resources: payloads("resources", computeResourceDigest),
    selections: payloads("selections", computeSelectionDigest),
    targets: payloads("targets", computeTargetDigest),
    validations: payloads("validations", computeValidationDigest),
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

export function resealBackupRestoreVerification(input) {
  const value = structuredClone(input);
  for (const row of records(value.resources)) row.payloadDigest = computeResourceDigest(row);
  for (const row of records(value.recoveryPoints)) {
    row.payloadDigest = computeRecoveryPointDigest(row);
  }
  for (const row of records(value.targets)) row.payloadDigest = computeTargetDigest(row);
  value.protectedResourceExport.contentDigest = computeResourceExportDigest(
    value.protectedResourceExport,
    value.resources,
  );
  value.recoveryPointExport.contentDigest = computeRecoveryPointExportDigest(
    value.recoveryPointExport,
    value.recoveryPoints,
  );
  value.authorityRoster.contentDigest = computeAuthorityRosterDigest(
    value.authorityRoster,
    value.principals,
  );
  for (const row of records(value.authorityGrants)) {
    row.rosterDigest = value.authorityRoster.contentDigest;
    row.payloadDigest = computeGrantDigest(row);
  }
  for (const row of records(value.selections)) {
    const resource = records(value.resources).find((item) => item.id === row.resourceRef);
    const point = records(value.recoveryPoints).find((item) => item.id === row.recoveryPointRef);
    const target = records(value.targets).find((item) => item.id === row.targetRef);
    row.resourcePayloadDigest = object(resource).payloadDigest;
    row.recoveryPointPayloadDigest = object(point).payloadDigest;
    row.targetPayloadDigest = object(target).payloadDigest;
    row.payloadDigest = computeSelectionDigest(row);
  }
  value.round.protectedResourceExportDigest = value.protectedResourceExport.contentDigest;
  value.round.recoveryPointExportDigest = value.recoveryPointExport.contentDigest;
  value.round.authorityRosterDigest = value.authorityRoster.contentDigest;
  value.round.planDigest = computePlanDigest(value.round, value);
  for (const row of records(value.providerJobs)) {
    const selection = records(value.selections).find((item) => item.id === row.selectionRef);
    row.selectionPayloadDigest = object(selection).payloadDigest;
    row.payloadDigest = computeJobDigest(row);
  }
  for (const row of records(value.validations)) {
    const selection = records(value.selections).find((item) => item.id === row.selectionRef);
    const job = records(value.providerJobs).find((item) => item.id === row.providerJobRef);
    row.selectionPayloadDigest = object(selection).payloadDigest;
    row.providerJobPayloadDigest = row.providerJobRef === null ? null : object(job).payloadDigest;
    row.payloadDigest = computeValidationDigest(row);
  }
  for (const row of records(value.cleanups)) {
    const selection = records(value.selections).find((item) => item.id === row.selectionRef);
    const target = records(value.targets).find((item) => item.id === row.targetRef);
    row.selectionPayloadDigest = object(selection).payloadDigest;
    row.targetPayloadDigest = object(target).payloadDigest;
    row.payloadDigest = computeCleanupDigest(row);
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
  rejectFields(value.protectedResourceExport, FIELDS.protectedResourceExport, "$.protectedResourceExport", add);
  rejectFields(value.recoveryPointExport, FIELDS.recoveryPointExport, "$.recoveryPointExport", add);
  rejectFields(value.authorityRoster, FIELDS.authorityRoster, "$.authorityRoster", add);
  rejectFields(value.coverage, FIELDS.coverage, "$.coverage", add);
  rejectFields(value.destinationApproval, FIELDS.destinationApproval, "$.destinationApproval", add);
  rejectFields(value.handoff, FIELDS.handoff, "$.handoff", add);
  for (const [field, shape] of [
    ["resources", "resource"],
    ["recoveryPoints", "recoveryPoint"],
    ["targets", "target"],
    ["selections", "selection"],
    ["principals", "principal"],
    ["authorityGrants", "authorityGrant"],
    ["providerJobs", "providerJob"],
    ["validations", "validation"],
    ["cleanups", "cleanup"],
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
      if (!(path === "$.handoff" && NOT_CLAIMED_FIELDS.includes(key)) && PROHIBITED_KEY_PATTERN.test(words)) {
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

export function backupRestoreVerificationFindings(input, context) {
  if (!isRecord(input)) return [finding("invalid_artifact", "$")];
  const value = input;
  const findings = [];
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  rejectUnknownShapes(value, add);
  scanProhibitedKeys(value, add);
  collectIds(value, add);

  if (value.schemaVersion !== BACKUP_RESTORE_VERIFICATION_SCHEMA_VERSION) {
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
  const resources = ledger("resources");
  const points = ledger("recoveryPoints");
  const targets = ledger("targets");
  const selections = ledger("selections");
  const principals = ledger("principals");
  const grants = ledger("authorityGrants");
  const jobs = ledger("providerJobs");
  const validations = ledger("validations");
  const cleanups = ledger("cleanups");
  const evidence = ledger("evidence");
  const blockers = ledger("blockers");
  const resourceExport = object(value.protectedResourceExport);
  const pointExport = object(value.recoveryPointExport);
  const roster = object(value.authorityRoster);
  const coverage = object(value.coverage);
  const destination = object(value.destinationApproval);
  const handoff = object(value.handoff);
  const resourceById = mapById(resources);
  const pointById = mapById(points);
  const targetById = mapById(targets);
  const selectionById = mapById(selections);
  const principalById = mapById(principals);
  const grantById = mapById(grants);
  const evidenceById = mapById(evidence);

  const requestedAt = checkTime(round.requestedAt, "$.round.requestedAt", [round.id]);
  if (
    !Number.isInteger(round.rpoMinutes) ||
    round.rpoMinutes < 1 ||
    !Number.isInteger(round.rtoMinutes) ||
    round.rtoMinutes < 1 ||
    round.destination !== DESTINATION
  ) {
    add("invalid_round", "$.round", [round.id]);
  }
  const cutoffAt =
    requestedAt === null || !Number.isInteger(round.rpoMinutes)
      ? null
      : requestedAt - round.rpoMinutes * 60_000;

  const hasScope = (ref, scope, kind = null) => {
    const principal = object(principalById.get(ref));
    return (
      (kind === null || principal.kind === kind) &&
      strings(principal.scopes).includes(scope)
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
    ["resource-exporter", [resourceExport.suppliedByRef]],
    ["recovery-point-exporter", [pointExport.suppliedByRef]],
    [
      "selection-coordinator",
      [
        ...selections.map((row) => row.selectedByRef),
        ...blockers.map((row) => row.ownerRef),
      ],
    ],
    ["restore-provider", jobs.map((row) => row.providerRef)],
    ["independent-validator", validations.map((row) => row.validatorRef)],
    ["cleanup-owner", cleanups.map((row) => row.ownerRef)],
    ["retention-approver", cleanups.map((row) => row.retentionApprovedByRef)],
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

  const resourceIds = resources.map((row) => row.id);
  const selectedResources = resources
    .filter((row) => row.selectionState === "selected")
    .map((row) => row.id);
  const excludedResources = resources
    .filter((row) => row.selectionState === "excluded")
    .map((row) => row.id);
  for (const [index, resource] of resources.entries()) {
    if (
      !hasScope(resource.ownerSystemRef, "resource-exporter", "owner-system") ||
      (resource.selectionState === "selected" && resource.exclusionReason !== null) ||
      (resource.selectionState === "excluded" && resource.exclusionReason === null) ||
      (resource.selectionState === "excluded" &&
        resource.exclusionReason === "no-eligible-recovery-point" &&
        points.some(
          (point) =>
            point.resourceRef === resource.id &&
            point.eligibility === "owner-exported-eligible",
        )) ||
      resource.payloadDigest !== computeResourceDigest(resource)
    ) {
      add("invalid_resource", `$.resources[${index}]`, [resource.id]);
    }
  }
  const resourceExportedAt = checkTime(
    resourceExport.exportedAt,
    "$.protectedResourceExport.exportedAt",
    [resourceExport.id],
  );
  if (
    round.protectedResourceExportRef !== resourceExport.id ||
    round.protectedResourceExportDigest !== resourceExport.contentDigest ||
    !sameExactSet(resourceExport.resourceRefs, resourceIds) ||
    !hasScope(resourceExport.suppliedByRef, "resource-exporter", "owner-system") ||
    resourceExport.contentDigest !== computeResourceExportDigest(resourceExport, resources) ||
    (requestedAt !== null && resourceExportedAt !== null && resourceExportedAt > requestedAt)
  ) {
    add("invalid_resource_universe", "$.protectedResourceExport", resourceIds);
  }

  const pointIds = points.map((row) => row.id);
  const pointExportedAt = checkTime(
    pointExport.exportedAt,
    "$.recoveryPointExport.exportedAt",
    [pointExport.id],
  );
  for (const [index, point] of points.entries()) {
    const capturedAt = checkTime(point.capturedAt, `$.recoveryPoints[${index}].capturedAt`, [point.id]);
    if (
      !resourceById.has(point.resourceRef) ||
      point.eligibility !== "owner-exported-eligible" ||
      !hasScope(point.providerRef, "restore-provider", "provider-system") ||
      point.payloadDigest !== computeRecoveryPointDigest(point) ||
      (resourceExportedAt !== null && capturedAt !== null && capturedAt > resourceExportedAt) ||
      (pointExportedAt !== null && capturedAt !== null && capturedAt > pointExportedAt)
    ) {
      add("invalid_recovery_point", `$.recoveryPoints[${index}]`, [point.id]);
    }
  }
  if (
    round.recoveryPointExportRef !== pointExport.id ||
    round.recoveryPointExportDigest !== pointExport.contentDigest ||
    !sameExactSet(pointExport.recoveryPointRefs, pointIds) ||
    !hasScope(pointExport.suppliedByRef, "recovery-point-exporter", "owner-system") ||
    pointExport.contentDigest !== computeRecoveryPointExportDigest(pointExport, points) ||
    timestamp(pointExport.cutoffAt) !== cutoffAt ||
    (requestedAt !== null && pointExportedAt !== null && pointExportedAt > requestedAt)
  ) {
    add("invalid_recovery_point_export", "$.recoveryPointExport", pointIds);
  }

  const targetByLocatorDigest = new Map();
  for (const [index, target] of targets.entries()) {
    const collidingTarget = targetByLocatorDigest.get(target.locatorDigest);
    if (typeof target.locatorDigest === "string" && collidingTarget) {
      add("invalid_isolated_target", `$.targets[${index}].locatorDigest`, [
        collidingTarget.id,
        target.id,
      ]);
    } else if (typeof target.locatorDigest === "string") {
      targetByLocatorDigest.set(target.locatorDigest, target);
    }
    if (
      target.isolation !== "isolated-temporary" ||
      !hasScope(target.providerRef, "restore-provider", "provider-system") ||
      target.payloadDigest !== computeTargetDigest(target)
    ) {
      add("invalid_isolated_target", `$.targets[${index}]`, [target.id]);
    }
  }

  const selectedSeen = new Set();
  const pointSeen = new Set();
  const targetSeen = new Set();
  for (const [index, selection] of selections.entries()) {
    const resource = object(resourceById.get(selection.resourceRef));
    const point = object(pointById.get(selection.recoveryPointRef));
    const target = object(targetById.get(selection.targetRef));
    const selectedAt = checkTime(selection.selectedAt, `$.selections[${index}].selectedAt`, [selection.id]);
    if (selectedSeen.has(selection.resourceRef) || pointSeen.has(selection.recoveryPointRef) || targetSeen.has(selection.targetRef)) {
      add("invalid_selection_partition", `$.selections[${index}]`, [selection.id]);
    }
    selectedSeen.add(selection.resourceRef);
    pointSeen.add(selection.recoveryPointRef);
    targetSeen.add(selection.targetRef);
    if (
      resource.selectionState !== "selected" ||
      point.resourceRef !== selection.resourceRef ||
      target.providerRef !== point.providerRef ||
      selection.resourcePayloadDigest !== resource.payloadDigest ||
      selection.recoveryPointPayloadDigest !== point.payloadDigest ||
      selection.targetPayloadDigest !== target.payloadDigest ||
      selection.payloadDigest !== computeSelectionDigest(selection) ||
      !hasScope(selection.selectedByRef, "selection-coordinator", "named-human") ||
      !grantFor(
        selection.authorityGrantRef,
        selection.selectedByRef,
        "select-recovery-triples",
        selectedAt,
      ) ||
      (requestedAt !== null && selectedAt !== null && selectedAt < requestedAt) ||
      (pointExportedAt !== null && selectedAt !== null && selectedAt < pointExportedAt)
    ) {
      add("invalid_selection_binding", `$.selections[${index}]`, [selection.id]);
    }
  }
  if (
    !sameExactSet([...selectedSeen], selectedResources) ||
    selections.length !== selectedResources.length ||
    !sameExactSet(targets.map((row) => row.id), [...targetSeen]) ||
    selectedResources.some((ref) => excludedResources.includes(ref))
  ) {
    add("invalid_selection_partition", "$.selections", selectedResources);
  }

  if (
    round.authorityRosterRef !== roster.id ||
    round.authorityRosterDigest !== roster.contentDigest ||
    round.planDigest !== computePlanDigest(round, value)
  ) {
    add("invalid_plan_digest", "$.round", [round.id]);
  }

  const jobsBySelection = new Map();
  const providerJobKeys = new Set();
  for (const [index, job] of jobs.entries()) {
    const selection = object(selectionById.get(job.selectionRef));
    const submittedAt = checkTime(job.submittedAt, `$.providerJobs[${index}].submittedAt`, [job.id]);
    const completedAt = checkTime(job.completedAt, `$.providerJobs[${index}].completedAt`, [job.id]);
    const rows = jobsBySelection.get(job.selectionRef) ?? [];
    rows.push(job);
    jobsBySelection.set(job.selectionRef, rows);
    const providerJobKey = `${String(job.providerRef)}\u0000${String(job.providerJobRef)}`;
    const providerJobIdentityReused = providerJobKeys.has(providerJobKey);
    providerJobKeys.add(providerJobKey);
    if (
      selection.id !== job.selectionRef ||
      job.selectionPayloadDigest !== selection.payloadDigest ||
      job.providerRef !== object(targetById.get(selection.targetRef)).providerRef ||
      !hasScope(job.providerRef, "restore-provider", "provider-system") ||
      !grants.some((grant) =>
        grantFor(grant.id, job.providerRef, "report-provider-jobs", completedAt),
      ) ||
      providerJobIdentityReused ||
      submittedAt === null ||
      completedAt === null ||
      submittedAt > completedAt ||
      submittedAt < (timestamp(selection.selectedAt) ?? Number.POSITIVE_INFINITY) ||
      job.payloadDigest !== computeJobDigest(job)
    ) {
      add("invalid_provider_job", `$.providerJobs[${index}]`, [job.id]);
    }
  }
  for (const [selectionRef, rows] of jobsBySelection) {
    if (rows.length > 1) add("invalid_provider_job", "$.providerJobs", [selectionRef]);
  }
  const uniqueJobForSelection = (selectionRef) => {
    const rows = jobsBySelection.get(selectionRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };

  const validationsBySelection = new Map();
  for (const [index, validation] of validations.entries()) {
    const selection = object(selectionById.get(validation.selectionRef));
    const job = uniqueJobForSelection(validation.selectionRef);
    const startedAt = validation.startedAt === null
      ? null
      : checkTime(validation.startedAt, `$.validations[${index}].startedAt`, [validation.id]);
    const completedAt = validation.completedAt === null
      ? null
      : checkTime(validation.completedAt, `$.validations[${index}].completedAt`, [validation.id]);
    const rows = validationsBySelection.get(validation.selectionRef) ?? [];
    rows.push(validation);
    validationsBySelection.set(validation.selectionRef, rows);
    const expectedNotRun = !job || job.outcome !== "succeeded";
    const validationRecordedAt =
      completedAt ??
      timestamp(object(job).completedAt) ??
      timestamp(selection.selectedAt);
    const shapeValid =
      validation.outcome === "not-run"
        ? validation.providerJobRef === (job?.id ?? null) &&
          validation.providerJobPayloadDigest === (job?.payloadDigest ?? null) &&
          validation.startedAt === null &&
          validation.completedAt === null &&
          strings(validation.checkCodes).length === 0
        : job?.outcome === "succeeded" &&
          validation.providerJobRef === job.id &&
          validation.providerJobPayloadDigest === job.payloadDigest &&
          startedAt !== null &&
          completedAt !== null &&
          startedAt >= (timestamp(job.completedAt) ?? Number.POSITIVE_INFINITY) &&
          startedAt <= completedAt &&
          strings(validation.checkCodes).length > 0;
    if (
      selection.id !== validation.selectionRef ||
      validation.selectionPayloadDigest !== selection.payloadDigest ||
      !hasScope(validation.validatorRef, "independent-validator", "named-human") ||
      validation.validatorRef === object(job).providerRef ||
      !grants.some((grant) =>
        grantFor(
          grant.id,
          validation.validatorRef,
          "report-independent-validation",
          validationRecordedAt,
        ),
      ) ||
      (expectedNotRun && validation.outcome !== "not-run") ||
      !shapeValid ||
      validation.payloadDigest !== computeValidationDigest(validation)
    ) {
      add("invalid_independent_validation", `$.validations[${index}]`, [validation.id]);
    }
  }
  for (const selection of selections) {
    if ((validationsBySelection.get(selection.id) ?? []).length !== 1) {
      add("invalid_validation_coverage", "$.validations", [selection.id]);
    }
  }
  const uniqueValidationForSelection = (selectionRef) => {
    const rows = validationsBySelection.get(selectionRef) ?? [];
    return rows.length === 1 ? rows[0] : null;
  };

  const cleanupBySelection = new Map();
  for (const [index, cleanup] of cleanups.entries()) {
    const selection = object(selectionById.get(cleanup.selectionRef));
    const target = object(targetById.get(cleanup.targetRef));
    const selectionJobs = jobsBySelection.get(cleanup.selectionRef) ?? [];
    const job = uniqueJobForSelection(cleanup.selectionRef);
    const validation = uniqueValidationForSelection(cleanup.selectionRef);
    const selectedAt = timestamp(selection.selectedAt);
    const jobCompletedAt = job === null ? null : timestamp(job.completedAt);
    const validationWasRun = validation !== null && validation.outcome !== "not-run";
    const validationCompletedAt = validationWasRun ? timestamp(validation.completedAt) : null;
    const requested = checkTime(cleanup.requestedAt, `$.cleanups[${index}].requestedAt`, [cleanup.id]);
    const completed = cleanup.completedAt === null
      ? null
      : checkTime(cleanup.completedAt, `$.cleanups[${index}].completedAt`, [cleanup.id]);
    const retentionUntil = cleanup.retentionUntil === null
      ? null
      : checkTime(cleanup.retentionUntil, `$.cleanups[${index}].retentionUntil`, [cleanup.id], true);
    const cleanupAuthorityAt = completed ?? requested;
    const rows = cleanupBySelection.get(cleanup.selectionRef) ?? [];
    rows.push(cleanup);
    cleanupBySelection.set(cleanup.selectionRef, rows);
    const outcomeShape =
      cleanup.outcome === "cleaned"
        ? completed !== null &&
          cleanup.retentionReason === null &&
          cleanup.retentionUntil === null &&
          cleanup.retentionApprovedByRef === null
        : cleanup.outcome === "pending"
          ? cleanup.completedAt === null &&
            cleanup.retentionReason === null &&
            cleanup.retentionUntil === null &&
            cleanup.retentionApprovedByRef === null
          : cleanup.outcome === "retained" &&
            cleanup.completedAt === null &&
            cleanup.retentionReason !== null &&
            retentionUntil !== null &&
            requested !== null &&
            retentionUntil > requested &&
            (asOf === null || retentionUntil > asOf) &&
            typeof cleanup.retentionApprovalEvidenceRef === "string" &&
            hasScope(cleanup.retentionApprovedByRef, "retention-approver", "named-human") &&
            grants.some((grant) =>
              grantFor(
                grant.id,
                cleanup.retentionApprovedByRef,
                "approve-temporary-retention",
                requested,
              ),
            );
    if (
      cleanup.outcome !== "retained" &&
      cleanup.retentionApprovalEvidenceRef !== null
    ) {
      add("invalid_cleanup_outcome", `$.cleanups[${index}]`, [cleanup.id]);
    }
    const chronologyValid =
      selectionJobs.length <= 1 &&
      requested !== null &&
      selectedAt !== null &&
      requested >= selectedAt &&
      (job === null || (jobCompletedAt !== null && requested >= jobCompletedAt)) &&
      (!validationWasRun ||
        (validationCompletedAt !== null && requested >= validationCompletedAt)) &&
      (completed === null ||
        (completed >= selectedAt &&
          (job === null || (jobCompletedAt !== null && completed >= jobCompletedAt)) &&
          (!validationWasRun ||
            (validationCompletedAt !== null && completed >= validationCompletedAt))));
    if (
      selection.id !== cleanup.selectionRef ||
      target.id !== selection.targetRef ||
      cleanup.targetRef !== selection.targetRef ||
      cleanup.selectionPayloadDigest !== selection.payloadDigest ||
      cleanup.targetPayloadDigest !== target.payloadDigest ||
      !hasScope(cleanup.ownerRef, "cleanup-owner", "named-human") ||
      !grants.some((grant) =>
        grantFor(grant.id, cleanup.ownerRef, "report-cleanup", cleanupAuthorityAt),
      ) ||
      !outcomeShape ||
      !chronologyValid ||
      (completed !== null && requested !== null && completed < requested) ||
      cleanup.payloadDigest !== computeCleanupDigest(cleanup)
    ) {
      add("invalid_cleanup_outcome", `$.cleanups[${index}]`, [cleanup.id]);
    }
  }
  for (const selection of selections) {
    if ((cleanupBySelection.get(selection.id) ?? []).length !== 1) {
      add("invalid_cleanup_coverage", "$.cleanups", [selection.id]);
    }
  }

  const expectedBlockers = [];
  const addExpected = (selection, category) =>
    expectedBlockers.push({
      category,
      selectionRef: selection.id,
      targetRefs: [selection.id, selection.targetRef],
    });
  for (const selection of selections) {
    const point = object(pointById.get(selection.recoveryPointRef));
    const job = uniqueJobForSelection(selection.id);
    const validation = uniqueValidationForSelection(selection.id);
    const cleanupRows = cleanupBySelection.get(selection.id) ?? [];
    const cleanup = cleanupRows.length === 1 ? cleanupRows[0] : null;
    const capturedAt = timestamp(point.capturedAt);
    if (cutoffAt !== null && (capturedAt === null || capturedAt < cutoffAt)) {
      addExpected(selection, "rpo-violation");
    }
    if (!job) addExpected(selection, "provider-job-missing");
    else if (job.outcome === "failed") addExpected(selection, "restore-failed");
    if (!validation || validation.outcome === "not-run") addExpected(selection, "validation-missing");
    else if (validation.outcome === "failed") addExpected(selection, "validation-failed");
    else if (
      validation.outcome === "passed" &&
      job?.outcome === "succeeded" &&
      validation.providerJobRef === job.id &&
      validation.providerJobPayloadDigest === job.payloadDigest &&
      timestamp(job.submittedAt) !== null &&
      timestamp(validation.completedAt) !== null &&
      timestamp(validation.completedAt) - timestamp(job.submittedAt) >
        round.rtoMinutes * 60_000
    ) {
      addExpected(selection, "rto-violation");
    }
    if (cleanup?.outcome === "pending") addExpected(selection, "cleanup-pending");
    else if (cleanup?.outcome === "retained") addExpected(selection, "temporary-target-retained");
  }
  const blockerKey = (row) =>
    canonicalJson({
      category: row.category ?? null,
      selectionRef: row.selectionRef ?? null,
      targetRefs: sorted(row.targetRefs),
    });
  const actualBlockerKeys = blockers.map(blockerKey).sort(compareUtf16CodeUnits);
  const expectedBlockerKeys = expectedBlockers.map(blockerKey).sort(compareUtf16CodeUnits);
  if (
    actualBlockerKeys.length !== expectedBlockerKeys.length ||
    actualBlockerKeys.some((key, index) => key !== expectedBlockerKeys[index])
  ) {
    add("invalid_blocker_equality", "$.blockers", expectedBlockers.map((row) => row.selectionRef));
  }
  for (const [index, blocker] of blockers.entries()) {
    const detectedAt = checkTime(blocker.detectedAt, `$.blockers[${index}].detectedAt`, [blocker.id]);
    const selection = object(selectionById.get(blocker.selectionRef));
    const job = uniqueJobForSelection(blocker.selectionRef);
    const validation = uniqueValidationForSelection(blocker.selectionRef);
    const cleanupRows = cleanupBySelection.get(blocker.selectionRef) ?? [];
    const cleanup = cleanupRows.length === 1 ? cleanupRows[0] : null;
    const blockerEarliestAt = (() => {
      switch (blocker.category) {
        case "restore-failed":
          return timestamp(object(job).completedAt);
        case "validation-failed":
        case "rto-violation":
          return timestamp(object(validation).completedAt);
        case "validation-missing":
          return timestamp(object(job).completedAt) ?? timestamp(selection.selectedAt);
        case "cleanup-pending":
        case "temporary-target-retained":
          return timestamp(object(cleanup).requestedAt);
        default:
          return timestamp(selection.selectedAt);
      }
    })();
    if (
      !selection.id ||
      !sameExactSet(blocker.targetRefs, [selection.id, selection.targetRef]) ||
      !hasScope(blocker.ownerRef, "selection-coordinator", "named-human") ||
      (requestedAt !== null && detectedAt !== null && detectedAt < requestedAt) ||
      (blockerEarliestAt !== null && detectedAt !== null && detectedAt < blockerEarliestAt) ||
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
    resourceExport.evidenceRef,
    "resource-export",
    resourceExport.suppliedByRef,
    [resourceExport.id, ...resourceIds],
    resourceExport.exportedAt,
  );
  expect(
    pointExport.evidenceRef,
    "recovery-point-export",
    pointExport.suppliedByRef,
    [pointExport.id, ...pointIds],
    pointExport.exportedAt,
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
    ...targets.map((row) => [row, "target-record", row.providerRef, [row.id], resourceExport.exportedAt]),
    ...selections.map((row) => [row, "selection-record", row.selectedByRef, [row.id, row.resourceRef, row.recoveryPointRef, row.targetRef], row.selectedAt]),
    ...jobs.map((row) => [row, "provider-job-record", row.providerRef, [row.id, row.selectionRef], row.completedAt]),
    ...validations.map((row) => [
      row,
      "validation-record",
      row.validatorRef,
      [row.id, row.selectionRef],
      row.completedAt ??
        object(uniqueJobForSelection(row.selectionRef)).completedAt ??
        object(selectionById.get(row.selectionRef)).selectedAt,
    ]),
    ...cleanups.map((row) => [row, "cleanup-record", row.ownerRef, [row.id, row.selectionRef, row.targetRef], row.completedAt ?? row.requestedAt]),
    ...cleanups
      .filter((row) => row.outcome === "retained")
      .map((row) => [
        { ...row, evidenceRef: row.retentionApprovalEvidenceRef },
        "retention-approval-record",
        row.retentionApprovedByRef,
        [row.id, row.selectionRef, row.targetRef],
        row.requestedAt,
      ]),
    ...blockers.map((row) => [
      row,
      "blocker-record",
      row.ownerRef,
      [row.id, ...strings(row.targetRefs)],
      row.detectedAt,
    ]),
    [destination, "destination-approval-record", destination.approvedByRef, [destination.id], destination.approvedAt],
    [handoff, "handoff-record", handoff.nextOwnerRef, [handoff.id], handoff.handedOffAt],
  ];
  for (const [row, kind, supplier, subjects, sourceTime] of evidenceRows) {
    expect(row.evidenceRef, kind, supplier, subjects, sourceTime);
  }
  const sourceDigests = new Map();
  for (const [field, rows] of [
    ["resources", resources],
    ["recoveryPoints", points],
    ["targets", targets],
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
    ["resourceRefs", resourceIds],
    ["selectedResourceRefs", selectedResources],
    ["excludedResourceRefs", excludedResources],
    ["recoveryPointRefs", pointIds],
    ["selectionRefs", selections.map((row) => row.id)],
    ["targetRefs", targets.map((row) => row.id)],
    ["providerJobRefs", jobs.map((row) => row.id)],
    ["validationRefs", validations.map((row) => row.id)],
    ["cleanupRefs", cleanups.map((row) => row.id)],
    ["blockerRefs", blockers.map((row) => row.id)],
  ];
  if (
    coverage.roundRef !== round.id ||
    coverage.planDigest !== round.planDigest ||
    coverageFields.some(([field, expected]) => !sameExactSet(coverage[field], expected)) ||
    coverage.contentDigest !== computeCoverageDigest(coverage, value)
  ) {
    add("invalid_coverage", "$.coverage", resourceIds);
  }

  const allInternalDigests = new Set(
    [
      ...resources.map((row) => row.payloadDigest),
      resourceExport.contentDigest,
      ...points.map((row) => row.payloadDigest),
      pointExport.contentDigest,
      ...targets.map((row) => row.payloadDigest),
      ...selections.map((row) => row.payloadDigest),
      roster.contentDigest,
      ...grants.map((row) => row.payloadDigest),
      round.planDigest,
      ...jobs.map((row) => row.payloadDigest),
      ...validations.map((row) => row.payloadDigest),
      ...cleanups.map((row) => row.payloadDigest),
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

  const approvedAt = checkTime(destination.approvedAt, "$.destinationApproval.approvedAt", [destination.id]);
  const coverageEvidenceTimes = evidence
    .filter(
      (row) =>
        row.kind !== "destination-approval-record" &&
        row.kind !== "handoff-record",
    )
    .map((row) => timestamp(row.observedAt))
    .filter((value) => value !== null);
  const latestCoverageEvidenceAt =
    coverageEvidenceTimes.length === 0 ? null : Math.max(...coverageEvidenceTimes);
  if (
    destination.roundRef !== round.id ||
    destination.planDigest !== round.planDigest ||
    destination.coverageDigest !== coverage.contentDigest ||
    destination.destination !== DESTINATION ||
    destination.approvedByRef !== round.destinationApproverRef ||
    !hasScope(destination.approvedByRef, "destination-approver", "named-human") ||
    !grantFor(
      destination.authorityGrantRef,
      destination.approvedByRef,
      "approve-destination",
      approvedAt,
    ) ||
    (latestCoverageEvidenceAt !== null &&
      approvedAt !== null &&
      approvedAt < latestCoverageEvidenceAt) ||
    destination.payloadDigest !== computeDestinationApprovalDigest(destination)
  ) {
    add("invalid_destination", "$.destinationApproval", [destination.id]);
  }
  const handedOffAt = checkTime(handoff.handedOffAt, "$.handoff.handedOffAt", [handoff.id]);
  if (
    handoff.roundRef !== round.id ||
    handoff.planDigest !== round.planDigest ||
    handoff.coverageDigest !== coverage.contentDigest ||
    handoff.destinationApprovalRef !== destination.id ||
    handoff.destinationApprovalDigest !== destination.payloadDigest ||
    handoff.state !== (blockers.length === 0 ? "ready-for-owner-review" : "blocked") ||
    handoff.nextOwnerRef !== round.handoffOwnerRef ||
    !hasScope(handoff.nextOwnerRef, "handoff-recipient", "named-human") ||
    !grantFor(handoff.authorityGrantRef, handoff.nextOwnerRef, "receive-handoff", handedOffAt) ||
    !sameExactSet(handoff.selectedTripleRefs, selections.map((row) => row.id)) ||
    !sameExactSet(handoff.providerJobRefs, jobs.map((row) => row.id)) ||
    !sameExactSet(handoff.validationRefs, validations.map((row) => row.id)) ||
    !sameExactSet(handoff.cleanupRefs, cleanups.map((row) => row.id)) ||
    !sameExactSet(handoff.blockerRefs, blockers.map((row) => row.id)) ||
    NOT_CLAIMED_FIELDS.some((field) => handoff[field] !== "not-claimed") ||
    handoff.payloadDigest !== computeHandoffDigest(handoff) ||
    (approvedAt !== null && handedOffAt !== null && handedOffAt < approvedAt)
  ) {
    add("invalid_handoff", "$.handoff", [handoff.id]);
  }

  return sortedFindings(findings);
}
