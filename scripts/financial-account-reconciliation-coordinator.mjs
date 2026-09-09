import { createHash } from "node:crypto";

export const FINANCIAL_ACCOUNT_RECONCILIATION_SCHEMA_VERSION =
  "awesomeClaws.financialAccountReconciliation.v1";

const BALANCE_CONVENTION = "owner-normalized-account-balance-effect";
const REVIEW_SCOPE = "reconciliation-review";
const ISSUER_SCOPE = "reconciliation-authority-issuer";
const HANDOFF_SCOPE = "owner-handoff";
const DESTINATION_SCOPE = "destination-approver";
const GRANTABLE_SCOPES = new Set([REVIEW_SCOPE, HANDOFF_SCOPE, DESTINATION_SCOPE]);
const RESIDUAL_REASONS = new Set([
  "timing-difference",
  "source-detail-needed",
  "ambiguous-correspondence",
  "owner-review-needed",
]);

const ROW_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "exportRef",
  "side",
  "accountId",
  "currency",
  "sourceNativeId",
  "effectiveDate",
  "minorUnits",
  "balanceConvention",
];
const PRINCIPAL_PAYLOAD_FIELDS = ["id", "name", "kind", "scopes"];
const GRANT_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "accountId",
  "currency",
  "authorityRosterRef",
  "authorityRosterDigest",
  "authorityRosterEvidenceRef",
  "authorityRosterEvidenceDigest",
  "authorityRosterEvidenceControlledRef",
  "granteeRef",
  "granteePrincipalDigest",
  "issuedByRef",
  "issuerPrincipalDigest",
  "scopes",
  "issuedAt",
  "activeFrom",
  "activeUntil",
];
const EXPORT_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "side",
  "sourceSystemRef",
  "accountId",
  "currency",
  "period",
  "cutoffAt",
  "exportedAt",
  "rowRefs",
  "rowManifestDigest",
  "sourceEvidenceRootDigest",
];
const RESIDUAL_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "side",
  "rowRef",
  "accountId",
  "currency",
  "reason",
  "recordedByRef",
  "recordedAt",
  "nextOwnerRef",
  "ledgerManifestDigest",
  "statementManifestDigest",
  "roundRootDigest",
];
const BLOCKER_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "code",
  "ownerRef",
  "raisedAt",
  "targetRefs",
  "evidenceRefs",
];
const EVIDENCE_RECORD_FIELDS = [
  "id",
  "kind",
  "controlledSource",
  "controlledPurpose",
  "payloadDigest",
  "observedAt",
  "suppliedByRef",
  "subjectRefs",
];
const DESTINATION_APPROVAL_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "accountId",
  "currency",
  "controlledRef",
  "visibility",
  "approvedByRef",
  "approvedAt",
  "authorityRosterDigest",
  "authorityGrantRef",
  "authorityGrantPayloadDigest",
  "authorityGrantEvidenceRef",
  "authorityGrantEvidenceDigest",
  "authorityGrantEvidenceControlledRef",
  "roundRootDigest",
];
const ROUND_ROOT_FIELDS = [
  "id",
  "priorRoundRef",
  "accountId",
  "currency",
  "period",
  "cutoffAt",
  "reviewWindow",
  "authorityRosterRef",
  "balanceConvention",
];
const COVERAGE_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "ledgerRowRefs",
  "statementRowRefs",
  "matchedLedgerRowRefs",
  "matchedStatementRowRefs",
  "residualLedgerRowRefs",
  "residualStatementRowRefs",
  "groupRefs",
  "residualRefs",
];
const EVIDENCE_PURPOSE_BY_KIND = Object.freeze({
  "authority-roster-record": "authority-roster-record",
  "authority-grant-record": "authority-grant-record",
  "ledger-export-record": "ledger-export-record",
  "statement-export-record": "statement-export-record",
  "ledger-row-record": "ledger-row-record",
  "statement-row-record": "statement-row-record",
  "match-decision-record": "match-decision-record",
  "residual-record": "residual-record",
  "blocker-record": "blocker-record",
  "destination-approval-record": "destination-approval-record",
  "handoff-record": "handoff-record",
});

const LEDGERS = [
  ["principals", "principal"],
  ["authorityGrants", "authority grant"],
  ["evidence", "evidence"],
  ["ledgerRows", "ledger row"],
  ["statementRows", "statement row"],
  ["matchGroups", "match group"],
  ["residuals", "residual"],
  ["blockers", "blocker"],
];

function finding(code, path, message, targetRefs = []) {
  return { code, path, message, targetRefs: sortedIds(targetRefs) };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
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
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "bigint") return JSON.stringify(String(value));
  if (["string", "boolean"].includes(typeof value)) return JSON.stringify(value);
  return "null";
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizedField(value) {
  if (Array.isArray(value)) {
    return [...value].map(String).sort(compareUtf16CodeUnits);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareUtf16CodeUnits)
        .map((key) => [key, normalizedField(value[key])]),
    );
  }
  return value === undefined ? null : value;
}

function project(fields, source) {
  const row = object(source);
  return Object.fromEntries(fields.map((field) => [field, normalizedField(row[field])]));
}

function sortedIds(values) {
  return (Array.isArray(values) ? values : []).map(String).sort(compareUtf16CodeUnits);
}

function sameExactIdSet(actual, expected) {
  if (
    !Array.isArray(actual) ||
    actual.some((item) => typeof item !== "string" || item.length === 0) ||
    new Set(actual).size !== actual.length
  ) {
    return false;
  }
  const left = sortedIds(actual);
  const right = sortedIds(expected);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function computeRowDigest(row) {
  return sha256(canonicalJson(project(ROW_PAYLOAD_FIELDS, row)));
}

export function computeExportManifestDigest(rows) {
  const payloads = (Array.isArray(rows) ? rows : [])
    .filter(isRecord)
    .map((row) => project(ROW_PAYLOAD_FIELDS, row))
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
  return sha256(canonicalJson(payloads));
}

export function computeAuthorityRosterDigest(principals) {
  const payloads = (Array.isArray(principals) ? principals : [])
    .filter(isRecord)
    .map((row) => project(PRINCIPAL_PAYLOAD_FIELDS, row))
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
  return sha256(canonicalJson(payloads));
}

export function computePrincipalPayloadDigest(principal) {
  return sha256(canonicalJson(project(PRINCIPAL_PAYLOAD_FIELDS, principal)));
}

export function computeAuthorityGrantPayloadDigest(grant) {
  return sha256(canonicalJson(project(GRANT_PAYLOAD_FIELDS, grant)));
}

function evidenceBinding(ref, evidenceById) {
  const evidence = object(evidenceById.get(ref));
  return {
    evidenceRef: normalizedField(ref),
    evidenceRecordDigest: normalizedField(evidence.recordDigest),
    evidenceControlledRef: normalizedField(evidence.controlledRef),
    suppliedByRef: normalizedField(evidence.suppliedByRef),
  };
}

export function computeSourceEvidenceRootDigest(rows, evidenceRows) {
  const evidence = Array.isArray(evidenceRows) ? evidenceRows.filter(isRecord) : [];
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const payloads = (Array.isArray(rows) ? rows : [])
    .filter(isRecord)
    .map((row) => ({
      id: normalizedField(row.id),
      rowDigest: normalizedField(row.rowDigest),
      ...evidenceBinding(row.evidenceRef, evidenceById),
    }))
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
  return sha256(canonicalJson(payloads));
}

export function computeRoundRootDigest(value) {
  const artifact = object(value);
  const round = object(artifact.round);
  const roster = object(artifact.authorityRoster);
  const ledgerExport = object(artifact.ledgerExport);
  const statementExport = object(artifact.statementExport);
  const evidence = Array.isArray(artifact.evidence) ? artifact.evidence.filter(isRecord) : [];
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const rosterEvidence = object(evidenceById.get(roster.evidenceRef));
  const ledgerEvidence = object(evidenceById.get(ledgerExport.evidenceRef));
  const statementEvidence = object(evidenceById.get(statementExport.evidenceRef));
  return sha256(
    canonicalJson({
      schemaVersion: artifact.schemaVersion,
      round: project(ROUND_ROOT_FIELDS, round),
      authorityRoster: {
        id: roster.id ?? null,
        rosterDigest: roster.rosterDigest ?? null,
        evidenceRef: roster.evidenceRef ?? null,
        evidenceDigest: rosterEvidence.recordDigest ?? null,
        evidenceControlledRef: rosterEvidence.controlledRef ?? null,
      },
      ledgerExport: {
        id: ledgerExport.id ?? null,
        rowManifestDigest: ledgerExport.rowManifestDigest ?? null,
        sourceEvidenceRootDigest: ledgerExport.sourceEvidenceRootDigest ?? null,
        evidenceRef: ledgerExport.evidenceRef ?? null,
        evidenceDigest: ledgerEvidence.recordDigest ?? null,
        evidenceControlledRef: ledgerEvidence.controlledRef ?? null,
      },
      statementExport: {
        id: statementExport.id ?? null,
        rowManifestDigest: statementExport.rowManifestDigest ?? null,
        sourceEvidenceRootDigest: statementExport.sourceEvidenceRootDigest ?? null,
        evidenceRef: statementExport.evidenceRef ?? null,
        evidenceDigest: statementEvidence.recordDigest ?? null,
        evidenceControlledRef: statementEvidence.controlledRef ?? null,
      },
    }),
  );
}

function matchGroupPayload(group) {
  const row = object(group);
  const decision = object(row.decision);
  return {
    id: normalizedField(row.id),
    roundRef: normalizedField(row.roundRef),
    accountId: normalizedField(row.accountId),
    currency: normalizedField(row.currency),
    cardinality: normalizedField(row.cardinality),
    ledgerRowRefs: normalizedField(row.ledgerRowRefs),
    statementRowRefs: normalizedField(row.statementRowRefs),
    decision: project(
      [
        "id",
        "roundRef",
        "decidedByRef",
        "decidedAt",
        "authorityGrantRef",
        "authorityGrantPayloadDigest",
        "authorityGrantEvidenceRef",
        "authorityGrantEvidenceDigest",
        "authorityGrantEvidenceControlledRef",
        "authorityRosterDigest",
        "ledgerManifestDigest",
        "statementManifestDigest",
        "roundRootDigest",
      ],
      decision,
    ),
  };
}

function rosterPayload(value) {
  const roster = object(object(value).authorityRoster);
  return {
    roster: project(
      [
        "id",
        "roundRef",
        "accountId",
        "currency",
        "custodianRef",
        "principalRefs",
        "issuedAt",
        "rosterDigest",
      ],
      roster,
    ),
    principals: (Array.isArray(object(value).principals) ? object(value).principals : [])
      .filter(isRecord)
      .map((row) => project(PRINCIPAL_PAYLOAD_FIELDS, row))
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id)),
  };
}

export function computePartitionEvidenceRootDigest(value) {
  const artifact = object(value);
  const evidence = Array.isArray(artifact.evidence) ? artifact.evidence.filter(isRecord) : [];
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const matchGroups = Array.isArray(artifact.matchGroups)
    ? artifact.matchGroups.filter(isRecord)
    : [];
  const residuals = Array.isArray(artifact.residuals) ? artifact.residuals.filter(isRecord) : [];
  const blockers = Array.isArray(artifact.blockers) ? artifact.blockers.filter(isRecord) : [];
  const grants = Array.isArray(artifact.authorityGrants)
    ? artifact.authorityGrants.filter(isRecord)
    : [];
  const consumedGrantRefs = new Set(
    [
      ...matchGroups.map((group) => object(group.decision).authorityGrantRef),
      object(object(artifact.round).destination).authorityGrantRef,
      object(artifact.handoff).authorityGrantRef,
    ].filter((ref) => typeof ref === "string"),
  );
  return sha256(
    canonicalJson({
      coverage: project(COVERAGE_PAYLOAD_FIELDS, artifact.coverage),
      matchGroups: matchGroups
        .map((group) => ({
          payload: matchGroupPayload(group),
          decisionEvidence: evidenceBinding(object(group.decision).evidenceRef, evidenceById),
        }))
        .sort((left, right) =>
          compareUtf16CodeUnits(left.payload.id, right.payload.id),
        ),
      residuals: residuals
        .map((residual) => ({
          payload: project(RESIDUAL_PAYLOAD_FIELDS, residual),
          evidence: evidenceBinding(residual.evidenceRef, evidenceById),
        }))
        .sort((left, right) =>
          compareUtf16CodeUnits(left.payload.id, right.payload.id),
        ),
      blockers: blockers
        .map((blocker) => ({
          payload: project(BLOCKER_PAYLOAD_FIELDS, blocker),
          evidence: sortedIds(blocker.evidenceRefs).map((ref) =>
            evidenceBinding(ref, evidenceById),
          ),
        }))
        .sort((left, right) =>
          compareUtf16CodeUnits(left.payload.id, right.payload.id),
        ),
      authorityGrants: grants
        .filter((grant) => consumedGrantRefs.has(grant.id))
        .map((grant) => ({
          payload: project(GRANT_PAYLOAD_FIELDS, grant),
          evidence: evidenceBinding(grant.evidenceRef, evidenceById),
        }))
        .sort((left, right) =>
          compareUtf16CodeUnits(left.payload.id, right.payload.id),
        ),
    }),
  );
}

export function evidencePayloadProjection(kind, source, artifact) {
  switch (kind) {
    case "authority-roster-record":
      return isRecord(artifact) ? rosterPayload(artifact) : null;
    case "authority-grant-record":
      return isRecord(source) ? project(GRANT_PAYLOAD_FIELDS, source) : null;
    case "ledger-export-record":
    case "statement-export-record":
      return isRecord(source) ? project(EXPORT_PAYLOAD_FIELDS, source) : null;
    case "ledger-row-record":
    case "statement-row-record":
      return isRecord(source)
        ? {
            ...project(ROW_PAYLOAD_FIELDS, source),
            rowDigest: normalizedField(source.rowDigest),
          }
        : null;
    case "match-decision-record":
      return isRecord(source) ? matchGroupPayload(source) : null;
    case "residual-record":
      return isRecord(source) ? project(RESIDUAL_PAYLOAD_FIELDS, source) : null;
    case "blocker-record":
      return isRecord(source) ? project(BLOCKER_PAYLOAD_FIELDS, source) : null;
    case "destination-approval-record":
      return isRecord(source)
        ? project(DESTINATION_APPROVAL_PAYLOAD_FIELDS, source)
        : null;
    case "handoff-record":
      return isRecord(source)
        ? {
            id: normalizedField(source.id),
            roundRef: normalizedField(source.roundRef),
            state: normalizedField(source.state),
            destinationRef: normalizedField(source.destinationRef),
            destinationVisibility: normalizedField(source.destinationVisibility),
            destinationApprovalRef: normalizedField(source.destinationApprovalRef),
            destinationApprovalEvidenceRef: normalizedField(
              source.destinationApprovalEvidenceRef,
            ),
            destinationApprovalEvidenceDigest: normalizedField(
              source.destinationApprovalEvidenceDigest,
            ),
            destinationApprovalEvidenceControlledRef: normalizedField(
              source.destinationApprovalEvidenceControlledRef,
            ),
            nextOwnerRef: normalizedField(source.nextOwnerRef),
            ledgerManifestDigest: normalizedField(source.ledgerManifestDigest),
            statementManifestDigest: normalizedField(source.statementManifestDigest),
            roundRootDigest: normalizedField(source.roundRootDigest),
            partitionEvidenceRootDigest: normalizedField(
              source.partitionEvidenceRootDigest,
            ),
            counts: normalizedField(source.counts),
            indexes: normalizedField(source.indexes),
            authorityGrantRef: normalizedField(source.authorityGrantRef),
            authorityGrantPayloadDigest: normalizedField(source.authorityGrantPayloadDigest),
            authorityGrantEvidenceRef: normalizedField(source.authorityGrantEvidenceRef),
            authorityGrantEvidenceDigest: normalizedField(source.authorityGrantEvidenceDigest),
            authorityGrantEvidenceControlledRef: normalizedField(
              source.authorityGrantEvidenceControlledRef,
            ),
            handedOffAt: normalizedField(source.handedOffAt),
          }
        : null;
    default:
      return null;
  }
}

export function computeEvidencePayloadDigest(kind, source, artifact) {
  const payload = evidencePayloadProjection(kind, source, artifact);
  return payload === null ? null : sha256(canonicalJson({ kind, payload }));
}

export function computeEvidenceRecordDigest(row) {
  return sha256(canonicalJson(project(EVIDENCE_RECORD_FIELDS, row)));
}

export function contentAddressedControlledRef(row) {
  const value = object(row);
  const token = computeEvidenceRecordDigest(value).slice("sha256:".length);
  return `controlled://${value.controlledSource}/${value.controlledPurpose}@sha256-${token}`;
}

const RFC3339_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/u;

function milliseconds(value) {
  if (typeof value !== "string") return null;
  const match = RFC3339_DATE_TIME.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
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
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  if (offset !== "Z") {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function periodEndMilliseconds(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  return milliseconds(`${value}T23:59:59.999Z`);
}

function withinDate(date, startsOn, endsOn) {
  return (
    typeof date === "string" &&
    typeof startsOn === "string" &&
    typeof endsOn === "string" &&
    date >= startsOn &&
    date <= endsOn
  );
}

function namedHuman(principal) {
  return (
    isRecord(principal) &&
    principal.kind === "named-human" &&
    typeof principal.name === "string" &&
    principal.name.trim().length > 0
  );
}

function hasScope(principal, scope) {
  return Array.isArray(object(principal).scopes) && principal.scopes.includes(scope);
}

function readLedger(value, field, label, findings) {
  if (!Array.isArray(value[field])) {
    findings.push(finding("invalid_ledger_shape", field, `The ${label} ledger must be an array.`));
    return [];
  }
  const rows = [];
  for (const [index, row] of value[field].entries()) {
    if (!isRecord(row) || typeof row.id !== "string" || row.id.length === 0) {
      findings.push(
        finding(
          "invalid_ledger_shape",
          `${field}[${index}]`,
          `Every ${label} row must be an object carrying a non-empty id.`,
        ),
      );
      continue;
    }
    rows.push(row);
  }
  return rows;
}

function collectIds(value, findings) {
  const ids = new Map();
  const seen = new WeakSet();
  function visit(node, path) {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (isRecord(node) && Object.hasOwn(node, "id")) {
      if (typeof node.id !== "string" || node.id.length === 0) {
        findings.push(finding("invalid_id", `${path}.id`, "Every id must be a non-empty string."));
      } else if (ids.has(node.id)) {
        findings.push(
          finding(
            "duplicate_id",
            `${path}.id`,
            `Identifier ${JSON.stringify(node.id)} is already used at ${ids.get(node.id)}.`,
            [node.id],
          ),
        );
      } else {
        ids.set(node.id, `${path}.id`);
      }
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else {
      for (const key of Object.keys(node).sort(compareUtf16CodeUnits)) {
        visit(node[key], path === "$" ? key : `${path}.${key}`);
      }
    }
  }
  visit(value, "$");
  return new Set(ids.keys());
}

function rejectUnknownFields(record, allowedFields, path, findings) {
  if (!isRecord(record)) return;
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(record).sort(compareUtf16CodeUnits)) {
    if (!allowed.has(key)) {
      findings.push(
        finding(
          "prohibited_financial_field",
          path === "$" ? key : `${path}.${key}`,
          `Field ${JSON.stringify(key)} is outside the closed reconciliation record and cannot create an action, assurance, fuzzy, FX, tolerance, or narrative-claim lane.`,
        ),
      );
    }
  }
}

function validateClosedRecordShapes(value, findings) {
  rejectUnknownFields(
    value,
    [
      "schemaVersion",
      "round",
      "authorityRoster",
      "principals",
      "authorityGrants",
      "evidence",
      "ledgerExport",
      "statementExport",
      "ledgerRows",
      "statementRows",
      "matchGroups",
      "residuals",
      "coverage",
      "blockers",
      "handoff",
    ],
    "$",
    findings,
  );
  rejectUnknownFields(
    value.round,
    [
      "id",
      "priorRoundRef",
      "accountId",
      "currency",
      "period",
      "cutoffAt",
      "reviewWindow",
      "destination",
      "authorityRosterRef",
      "balanceConvention",
      "roundRootDigest",
    ],
    "round",
    findings,
  );
  rejectUnknownFields(value.round?.period, ["startsOn", "endsOn"], "round.period", findings);
  rejectUnknownFields(
    value.round?.reviewWindow,
    ["opensAt", "closesAt"],
    "round.reviewWindow",
    findings,
  );
  rejectUnknownFields(
    value.round?.destination,
    [
      "id",
      "roundRef",
      "accountId",
      "currency",
      "controlledRef",
      "visibility",
      "approvedByRef",
      "approvedAt",
      "authorityRosterDigest",
      "authorityGrantRef",
      "authorityGrantPayloadDigest",
      "authorityGrantEvidenceRef",
      "authorityGrantEvidenceDigest",
      "authorityGrantEvidenceControlledRef",
      "roundRootDigest",
      "evidenceRef",
    ],
    "round.destination",
    findings,
  );
  rejectUnknownFields(
    value.authorityRoster,
    [
      "id",
      "roundRef",
      "accountId",
      "currency",
      "custodianRef",
      "principalRefs",
      "issuedAt",
      "rosterDigest",
      "controlledRef",
      "evidenceRef",
    ],
    "authorityRoster",
    findings,
  );
  for (const [field, allowed] of [
    ["principals", ["id", "name", "kind", "scopes"]],
    [
      "authorityGrants",
      [...GRANT_PAYLOAD_FIELDS, "evidenceRef"],
    ],
    [
      "evidence",
      [...EVIDENCE_RECORD_FIELDS, "controlledRef", "recordDigest"],
    ],
    [
      "ledgerRows",
      [...ROW_PAYLOAD_FIELDS, "rowDigest", "evidenceRef"],
    ],
    [
      "statementRows",
      [...ROW_PAYLOAD_FIELDS, "rowDigest", "evidenceRef"],
    ],
    [
      "residuals",
      [...RESIDUAL_PAYLOAD_FIELDS, "evidenceRef"],
    ],
    [
      "blockers",
      BLOCKER_PAYLOAD_FIELDS,
    ],
  ]) {
    for (const [index, row] of (Array.isArray(value[field]) ? value[field] : []).entries()) {
      rejectUnknownFields(row, allowed, `${field}[${index}]`, findings);
    }
  }
  for (const [field, exportValue] of [
    ["ledgerExport", value.ledgerExport],
    ["statementExport", value.statementExport],
  ]) {
    rejectUnknownFields(exportValue, [...EXPORT_PAYLOAD_FIELDS, "evidenceRef"], field, findings);
    rejectUnknownFields(exportValue?.period, ["startsOn", "endsOn"], `${field}.period`, findings);
  }
  for (const [index, group] of (
    Array.isArray(value.matchGroups) ? value.matchGroups : []
  ).entries()) {
    rejectUnknownFields(
      group,
      [
        "id",
        "roundRef",
        "accountId",
        "currency",
        "cardinality",
        "ledgerRowRefs",
        "statementRowRefs",
        "decision",
      ],
      `matchGroups[${index}]`,
      findings,
    );
    rejectUnknownFields(
      group?.decision,
      [
        "id",
        "roundRef",
        "decidedByRef",
        "decidedAt",
        "authorityGrantRef",
        "authorityGrantPayloadDigest",
        "authorityGrantEvidenceRef",
        "authorityGrantEvidenceDigest",
        "authorityGrantEvidenceControlledRef",
        "authorityRosterDigest",
        "ledgerManifestDigest",
        "statementManifestDigest",
        "roundRootDigest",
        "evidenceRef",
      ],
      `matchGroups[${index}].decision`,
      findings,
    );
  }
  rejectUnknownFields(
    value.coverage,
    [
      "id",
      "roundRef",
      "ledgerRowRefs",
      "statementRowRefs",
      "matchedLedgerRowRefs",
      "matchedStatementRowRefs",
      "residualLedgerRowRefs",
      "residualStatementRowRefs",
      "groupRefs",
      "residualRefs",
    ],
    "coverage",
    findings,
  );
  rejectUnknownFields(
    value.handoff,
    [
      "id",
      "roundRef",
      "destinationRef",
      "destinationVisibility",
      "destinationApprovalRef",
      "destinationApprovalEvidenceRef",
      "destinationApprovalEvidenceDigest",
      "destinationApprovalEvidenceControlledRef",
      "state",
      "nextOwnerRef",
      "ledgerManifestDigest",
      "statementManifestDigest",
      "roundRootDigest",
      "partitionEvidenceRootDigest",
      "counts",
      "indexes",
      "authorityGrantRef",
      "authorityGrantPayloadDigest",
      "authorityGrantEvidenceRef",
      "authorityGrantEvidenceDigest",
      "authorityGrantEvidenceControlledRef",
      "handedOffAt",
      "evidenceRef",
    ],
    "handoff",
    findings,
  );
  rejectUnknownFields(
    value.handoff?.counts,
    [
      "ledgerRows",
      "statementRows",
      "matchedLedgerRows",
      "matchedStatementRows",
      "groups",
      "ledgerResiduals",
      "statementResiduals",
      "blockers",
    ],
    "handoff.counts",
    findings,
  );
  rejectUnknownFields(
    value.handoff?.indexes,
    ["ledgerRowRefs", "statementRowRefs", "groupRefs", "residualRefs", "blockerRefs"],
    "handoff.indexes",
    findings,
  );
}

function sourceForEvidence(evidence, value, ledgers) {
  switch (evidence.kind) {
    case "authority-roster-record":
      return object(value).authorityRoster;
    case "authority-grant-record":
      return ledgers.authorityGrants.find((row) => row.evidenceRef === evidence.id) ?? null;
    case "ledger-export-record":
      return object(object(value).ledgerExport).evidenceRef === evidence.id
        ? object(object(value).ledgerExport)
        : null;
    case "statement-export-record":
      return object(object(value).statementExport).evidenceRef === evidence.id
        ? object(object(value).statementExport)
        : null;
    case "ledger-row-record":
      return ledgers.ledgerRows.find((row) => row.evidenceRef === evidence.id) ?? null;
    case "statement-row-record":
      return ledgers.statementRows.find((row) => row.evidenceRef === evidence.id) ?? null;
    case "match-decision-record":
      return (
        ledgers.matchGroups.find((row) => object(row.decision).evidenceRef === evidence.id) ?? null
      );
    case "residual-record":
      return ledgers.residuals.find((row) => row.evidenceRef === evidence.id) ?? null;
    case "blocker-record":
      return ledgers.blockers.find((row) => Array.isArray(row.evidenceRefs) && row.evidenceRefs.includes(evidence.id)) ?? null;
    case "destination-approval-record":
      return object(object(value).round).destination?.evidenceRef === evidence.id
        ? object(object(object(value).round).destination)
        : null;
    case "handoff-record":
      return object(object(value).handoff).evidenceRef === evidence.id
        ? object(object(value).handoff)
        : null;
    default:
      return null;
  }
}

function expectedEvidenceSubjects(kind, source, value) {
  if (!isRecord(source)) return [];
  switch (kind) {
    case "authority-roster-record":
      return [
        object(object(value).authorityRoster).id,
        ...(Array.isArray(object(object(value).authorityRoster).principalRefs)
          ? object(object(value).authorityRoster).principalRefs
          : []),
      ];
    case "authority-grant-record":
      return [source.id, source.granteeRef, source.issuedByRef, source.authorityRosterRef];
    case "ledger-export-record":
    case "statement-export-record":
      return [source.id, ...(Array.isArray(source.rowRefs) ? source.rowRefs : [])];
    case "ledger-row-record":
    case "statement-row-record":
      return [source.id];
    case "match-decision-record":
      return [
        source.id,
        object(source.decision).id,
        object(source.decision).authorityGrantRef,
        object(object(value).authorityRoster).id,
      ];
    case "residual-record":
      return [
        source.id,
        source.rowRef,
        object(object(value).ledgerExport).id,
        object(object(value).statementExport).id,
      ];
    case "blocker-record":
      return [source.id, ...(Array.isArray(source.targetRefs) ? source.targetRefs : [])];
    case "destination-approval-record":
      return [
        source.id,
        source.approvedByRef,
        source.authorityGrantRef,
        object(object(value).authorityRoster).id,
      ];
    case "handoff-record":
      return [
        source.id,
        source.destinationApprovalRef,
        source.nextOwnerRef,
        source.authorityGrantRef,
        object(object(value).ledgerExport).id,
        object(object(value).statementExport).id,
      ];
    default:
      return [];
  }
}

function expectedEvidenceTime(kind, source, value) {
  switch (kind) {
    case "authority-roster-record":
      return object(object(value).authorityRoster).issuedAt;
    case "authority-grant-record":
      return object(source).issuedAt;
    case "ledger-export-record":
    case "statement-export-record":
    case "ledger-row-record":
    case "statement-row-record": {
      const exportValue =
        kind.startsWith("ledger")
          ? object(object(value).ledgerExport)
          : object(object(value).statementExport);
      return exportValue.exportedAt;
    }
    case "match-decision-record":
      return object(object(source).decision).decidedAt;
    case "residual-record":
      return object(source).recordedAt;
    case "blocker-record":
      return object(source).raisedAt;
    case "destination-approval-record":
      return object(source).approvedAt;
    case "handoff-record":
      return object(source).handedOffAt;
    default:
      return null;
  }
}

function categoryForFinding(code) {
  if (
    [
      "invalid_evidence",
      "invalid_evidence_binding",
      "invalid_evidence_digest",
      "invalid_export_digest",
      "invalid_roster_digest",
      "invalid_row_digest",
      "invalid_round_root",
      "invalid_source_evidence_root",
    ].includes(code)
  ) {
    return "evidence-invalid";
  }
  if (
    [
      "incomplete_coverage",
      "invalid_row_reference",
      "row_reused",
      "invalid_residual",
    ].includes(code)
  ) {
    return "coverage-invalid";
  }
  if (["invalid_grant", "invalid_reconciler"].includes(code)) return "authority-invalid";
  if (
    ["future_record", "invalid_chronology", "stale_decision", "stale_export"].includes(code)
  ) {
    return "chronology-invalid";
  }
  if (["unbalanced_match", "invalid_group_cardinality"].includes(code)) {
    return "arithmetic-invalid";
  }
  if (["invalid_scope_binding", "invalid_row_binding"].includes(code)) return "scope-invalid";
  if (code === "invalid_destination") return "destination-invalid";
  if (["duplicate_id", "invalid_id", "invalid_principal"].includes(code)) {
    return "identity-invalid";
  }
  if (code === "invalid_prior_round_ref") return "round-invalid";
  return null;
}

function validateArtifact(input, context) {
  if (!isRecord(input)) {
    return [finding("invalid_artifact", "$", "The reconciliation artifact must be an object.")];
  }

  const value = input;
  const findings = [];
  const add = (code, path, message, targetRefs = []) =>
    findings.push(finding(code, path, message, targetRefs));
  validateClosedRecordShapes(value, findings);
  const allIds = collectIds(value, findings);
  const asOf = milliseconds(object(context).asOf);
  if (asOf === null) {
    add(
      "invalid_validation_context",
      "validationContext.asOf",
      "Validation requires an explicit trusted asOf timestamp; wall-clock time is never consulted.",
    );
  }
  function rejectAfterAsOf(timestamp, path, targetRefs) {
    const observed = milliseconds(timestamp);
    if (asOf !== null && observed !== null && observed > asOf) {
      add(
        "future_record",
        path,
        "The record time is after the trusted validation asOf.",
        targetRefs,
      );
    }
  }

  if (value.schemaVersion !== FINANCIAL_ACCOUNT_RECONCILIATION_SCHEMA_VERSION) {
    add(
      "invalid_artifact",
      "schemaVersion",
      `The artifact must declare ${FINANCIAL_ACCOUNT_RECONCILIATION_SCHEMA_VERSION}.`,
    );
  }

  const ledgers = Object.fromEntries(
    LEDGERS.map(([field, label]) => [field, readLedger(value, field, label, findings)]),
  );
  const {
    principals,
    authorityGrants,
    evidence,
    ledgerRows,
    statementRows,
    matchGroups,
    residuals,
    blockers,
  } = ledgers;
  const round = object(value.round);
  const roster = object(value.authorityRoster);
  const ledgerExport = object(value.ledgerExport);
  const statementExport = object(value.statementExport);
  const coverage = object(value.coverage);
  const handoff = object(value.handoff);
  const counts = object(handoff.counts);
  const indexes = object(handoff.indexes);
  const period = object(round.period);
  const reviewWindow = object(round.reviewWindow);
  const destination = object(round.destination);

  const principalById = new Map(principals.map((row) => [row.id, row]));
  const grantById = new Map(authorityGrants.map((row) => [row.id, row]));
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const ledgerById = new Map(ledgerRows.map((row) => [row.id, row]));
  const statementById = new Map(statementRows.map((row) => [row.id, row]));

  const periodStart = milliseconds(`${period.startsOn}T00:00:00.000Z`);
  const periodEnd = periodEndMilliseconds(period.endsOn);
  const cutoff = milliseconds(round.cutoffAt);
  const reviewOpen = milliseconds(reviewWindow.opensAt);
  const reviewClose = milliseconds(reviewWindow.closesAt);
  if (
    typeof round.id !== "string" ||
    typeof round.accountId !== "string" ||
    typeof round.currency !== "string" ||
    round.balanceConvention !== BALANCE_CONVENTION ||
    periodStart === null ||
    periodEnd === null ||
    periodStart > periodEnd ||
    cutoff === null ||
    cutoff < periodEnd ||
    reviewOpen === null ||
    reviewClose === null ||
    reviewOpen < cutoff ||
    reviewClose <= reviewOpen
  ) {
    add(
      "invalid_chronology",
      "round",
      "The round needs one exact account/currency, an ordered period, cutoff after period end, and an ordered review window at or after cutoff.",
      [round.id],
    );
  }
  if (
    round.priorRoundRef !== null &&
    (typeof round.priorRoundRef !== "string" ||
      !/^prior-round:[a-z0-9][a-z0-9._-]{2,148}$/u.test(round.priorRoundRef) ||
      allIds.has(round.priorRoundRef))
  ) {
    const targets = [...new Set([round.id, round.priorRoundRef].filter(Boolean))];
    add(
      "invalid_prior_round_ref",
      "round.priorRoundRef",
      "The prior-round reference must use the disjoint prior-round namespace and cannot equal any current-artifact id.",
      targets,
    );
  }

  for (const [index, principal] of principals.entries()) {
    if (
      typeof principal.name !== "string" ||
      !Array.isArray(principal.scopes) ||
      typeof principal.kind !== "string"
    ) {
      add(
        "invalid_principal",
        `principals[${index}]`,
        "Every roster principal needs an owner-supplied name, kind, and closed scope list.",
        [principal.id],
      );
    }
  }

  if (
    roster.id !== round.authorityRosterRef ||
    roster.roundRef !== round.id ||
    roster.accountId !== round.accountId ||
    roster.currency !== round.currency ||
    !sameExactIdSet(
      roster.principalRefs,
      principals.map((row) => row.id),
    ) ||
    !principalById.has(roster.custodianRef)
  ) {
    add(
      "invalid_scope_binding",
      "authorityRoster",
      "The authority roster must bind the current round, exact account/currency, custodian, and complete principal roster.",
      [roster.id],
    );
  }
  if (roster.rosterDigest !== computeAuthorityRosterDigest(principals)) {
    add(
      "invalid_roster_digest",
      "authorityRoster.rosterDigest",
      "The authority roster digest must be recomputed from every principal semantic payload.",
      [roster.id],
    );
  }
  rejectAfterAsOf(roster.issuedAt, "authorityRoster.issuedAt", [roster.id]);

  for (const [index, grant] of authorityGrants.entries()) {
    const grantee = principalById.get(grant.granteeRef);
    const issuer = principalById.get(grant.issuedByRef);
    const scope = Array.isArray(grant.scopes) ? grant.scopes[0] : null;
    const issuedAt = milliseconds(grant.issuedAt);
    const activeFrom = milliseconds(grant.activeFrom);
    const activeUntil = milliseconds(grant.activeUntil);
    const grantEvidence = evidenceById.get(grant.evidenceRef);
    const rosterEvidence = evidenceById.get(roster.evidenceRef);
    const rosterIssuedAt = milliseconds(roster.issuedAt);
    if (
      grant.roundRef !== round.id ||
      grant.accountId !== round.accountId ||
      grant.currency !== round.currency ||
      grant.authorityRosterRef !== roster.id ||
      grant.authorityRosterDigest !== roster.rosterDigest ||
      grant.authorityRosterEvidenceRef !== roster.evidenceRef ||
      grant.authorityRosterEvidenceDigest !== rosterEvidence?.recordDigest ||
      grant.authorityRosterEvidenceControlledRef !== rosterEvidence?.controlledRef ||
      grant.granteePrincipalDigest !== computePrincipalPayloadDigest(grantee) ||
      grant.issuerPrincipalDigest !== computePrincipalPayloadDigest(issuer) ||
      !namedHuman(grantee) ||
      !namedHuman(issuer) ||
      !hasScope(issuer, ISSUER_SCOPE) ||
      !GRANTABLE_SCOPES.has(scope) ||
      !hasScope(grantee, scope) ||
      grant.granteeRef === grant.issuedByRef ||
      !sameExactIdSet(grant.scopes, [scope]) ||
      issuedAt === null ||
      activeFrom === null ||
      activeUntil === null ||
      rosterIssuedAt === null ||
      issuedAt <= rosterIssuedAt ||
      issuedAt >= activeFrom ||
      activeFrom > reviewOpen ||
      activeUntil < reviewClose ||
      activeUntil < reviewOpen ||
      !grantEvidence ||
      grantEvidence.kind !== "authority-grant-record" ||
      grantEvidence.suppliedByRef !== grant.issuedByRef
    ) {
      add(
        "invalid_grant",
        `authorityGrants[${index}]`,
        "A grant must bind the exact roster evidence and issuer/grantee payloads, be issued strictly after that roster and before activation, cover the review window, carry one grantable scope, and have reciprocal issuer evidence.",
        [grant.id],
      );
    }
    rejectAfterAsOf(grant.issuedAt, `authorityGrants[${index}].issuedAt`, [grant.id]);
  }

  function validateExport(exportValue, side, rows, path) {
    const exportedAt = milliseconds(exportValue.exportedAt);
    const evidenceRow = evidenceById.get(exportValue.evidenceRef);
    const expectedSourceEvidenceRoot = computeSourceEvidenceRootDigest(rows, evidence);
    const requiredSupplierScope =
      side === "ledger" ? "ledger-export-supplier" : "statement-export-supplier";
    if (
      exportValue.roundRef !== round.id ||
      exportValue.side !== side ||
      exportValue.accountId !== round.accountId ||
      exportValue.currency !== round.currency ||
      canonicalJson(exportValue.period) !== canonicalJson(round.period) ||
      exportValue.cutoffAt !== round.cutoffAt
    ) {
      add(
        "invalid_scope_binding",
        path,
        `The ${side} export must bind the exact current round, account, currency, period, and cutoff.`,
        [exportValue.id],
      );
    }
    if (
      exportedAt === null ||
      periodEnd === null ||
      cutoff === null ||
      exportedAt <= periodEnd ||
      exportedAt > cutoff
    ) {
      add(
        "stale_export",
        `${path}.exportedAt`,
        `The ${side} export must be produced after the bounded period and no later than the current cutoff.`,
        [exportValue.id],
      );
    }
    if (!sameExactIdSet(exportValue.rowRefs, rows.map((row) => row.id))) {
      add(
        "incomplete_coverage",
        `${path}.rowRefs`,
        `The ${side} export row index must equal its supplied row universe exactly.`,
        [exportValue.id],
      );
    }
    if (exportValue.rowManifestDigest !== computeExportManifestDigest(rows)) {
      add(
        "invalid_export_digest",
        `${path}.rowManifestDigest`,
        `The ${side} manifest digest must be recomputed from every supplied row semantic payload.`,
        [exportValue.id],
      );
    }
    if (exportValue.sourceEvidenceRootDigest !== expectedSourceEvidenceRoot) {
      add(
        "invalid_source_evidence_root",
        `${path}.sourceEvidenceRootDigest`,
        `The ${side} source-evidence root must bind every row id/digest to its exact evidence ref, record digest, controlled ref, and supplier.`,
        [exportValue.id],
      );
    }
    if (
      !evidenceRow ||
      evidenceRow.kind !== `${side}-export-record` ||
      !hasScope(principalById.get(evidenceRow.suppliedByRef), requiredSupplierScope)
    ) {
      add(
        "invalid_evidence_binding",
        `${path}.evidenceRef`,
        `The ${side} export needs reciprocal controlled export evidence.`,
        [exportValue.id],
      );
    }
    rejectAfterAsOf(exportValue.exportedAt, `${path}.exportedAt`, [exportValue.id]);
  }
  validateExport(ledgerExport, "ledger", ledgerRows, "ledgerExport");
  validateExport(statementExport, "statement", statementRows, "statementExport");

  function validateRows(rows, side, exportValue, pathPrefix) {
    const sourceNativeIds = new Set();
    for (const [index, row] of rows.entries()) {
      const path = `${pathPrefix}[${index}]`;
      const evidenceRow = evidenceById.get(row.evidenceRef);
      if (
        row.roundRef !== round.id ||
        row.exportRef !== exportValue.id ||
        row.side !== side ||
        row.accountId !== round.accountId ||
        row.currency !== round.currency ||
        row.balanceConvention !== BALANCE_CONVENTION ||
        !withinDate(row.effectiveDate, period.startsOn, period.endsOn)
      ) {
        add(
          "invalid_row_binding",
          path,
          `Every ${side} row must bind the current round, exact export/account/currency/period, and fixed account-balance-effect convention.`,
          [row.id],
        );
      }
      if (
        typeof row.minorUnits !== "string" ||
        !/^-?(?:0|[1-9][0-9]*)$/u.test(row.minorUnits)
      ) {
        add(
          "invalid_row_binding",
          `${path}.minorUnits`,
          "Minor units must be a signed decimal integer string with no exponent, fraction, or leading zero.",
          [row.id],
        );
      }
      if (
        typeof row.sourceNativeId !== "string" ||
        row.sourceNativeId.length === 0 ||
        sourceNativeIds.has(row.sourceNativeId)
      ) {
        add(
          "invalid_row_binding",
          `${path}.sourceNativeId`,
          `Each ${side} source-native row id must be non-empty and unique within its export.`,
          [row.id],
        );
      }
      sourceNativeIds.add(row.sourceNativeId);
      if (row.rowDigest !== computeRowDigest(row)) {
        add(
          "invalid_row_digest",
          `${path}.rowDigest`,
          "The row digest must bind the complete semantic row payload.",
          [row.id],
        );
      }
      if (!evidenceRow || evidenceRow.kind !== `${side}-row-record`) {
        add(
          "invalid_evidence_binding",
          `${path}.evidenceRef`,
          "Every row needs reciprocal content-bound controlled evidence.",
          [row.id],
        );
      }
      if (
        evidenceRow &&
        !hasScope(
          principalById.get(evidenceRow.suppliedByRef),
          side === "ledger" ? "ledger-export-supplier" : "statement-export-supplier",
        )
      ) {
        add(
          "invalid_evidence_binding",
          `${path}.evidenceRef`,
          `Every ${side} row must be supplied by a rostered principal with ${side}-export-supplier scope.`,
          [row.id],
        );
      }
    }
  }
  validateRows(ledgerRows, "ledger", ledgerExport, "ledgerRows");
  validateRows(statementRows, "statement", statementExport, "statementRows");

  const evidenceConsumerCounts = new Map();
  function consumeEvidence(ref) {
    if (typeof ref === "string") {
      evidenceConsumerCounts.set(ref, (evidenceConsumerCounts.get(ref) ?? 0) + 1);
    }
  }
  consumeEvidence(roster.evidenceRef);
  for (const grant of authorityGrants) consumeEvidence(grant.evidenceRef);
  consumeEvidence(ledgerExport.evidenceRef);
  consumeEvidence(statementExport.evidenceRef);
  for (const row of [...ledgerRows, ...statementRows]) consumeEvidence(row.evidenceRef);
  for (const group of matchGroups) consumeEvidence(object(group.decision).evidenceRef);
  for (const residual of residuals) consumeEvidence(residual.evidenceRef);
  for (const blocker of blockers) {
    for (const ref of Array.isArray(blocker.evidenceRefs) ? blocker.evidenceRefs : []) {
      consumeEvidence(ref);
    }
  }
  consumeEvidence(destination.evidenceRef);
  consumeEvidence(handoff.evidenceRef);

  for (const [index, evidenceRow] of evidence.entries()) {
    const path = `evidence[${index}]`;
    const source = sourceForEvidence(evidenceRow, value, ledgers);
    const expectedPayload = computeEvidencePayloadDigest(evidenceRow.kind, source, value);
    const expectedSubjects = expectedEvidenceSubjects(evidenceRow.kind, source, value);
    const supplier = principalById.get(evidenceRow.suppliedByRef);
    if (
      !source ||
      !supplier ||
      evidenceConsumerCounts.get(evidenceRow.id) !== 1 ||
      milliseconds(evidenceRow.observedAt) === null ||
      evidenceRow.observedAt !== expectedEvidenceTime(evidenceRow.kind, source, value) ||
      evidenceRow.controlledSource !== "finance-reconciliation" ||
      evidenceRow.controlledPurpose !== EVIDENCE_PURPOSE_BY_KIND[evidenceRow.kind]
    ) {
      add(
        "invalid_evidence_binding",
        path,
        "Evidence must have exactly one current artifact consumer, a rostered supplier, the exact source time, the fixed source, and the kind-derived controlled purpose.",
        [evidenceRow.id],
      );
    }
    if (!sameExactIdSet(evidenceRow.subjectRefs, expectedSubjects)) {
      add(
        "invalid_evidence_binding",
        `${path}.subjectRefs`,
        "Evidence subjects must equal the complete target identity set.",
        [evidenceRow.id],
      );
    }
    if (
      expectedPayload === null ||
      evidenceRow.payloadDigest !== expectedPayload ||
      evidenceRow.recordDigest !== computeEvidenceRecordDigest(evidenceRow) ||
      evidenceRow.controlledRef !== contentAddressedControlledRef(evidenceRow)
    ) {
      add(
        "invalid_evidence_digest",
        path,
        "Evidence payload, record digest, and content-addressed controlled reference must all recompute exactly.",
        [evidenceRow.id],
      );
    }
    rejectAfterAsOf(evidenceRow.observedAt, `${path}.observedAt`, [evidenceRow.id]);
  }
  if (
    !evidenceById.has(roster.evidenceRef) ||
    evidenceById.get(roster.evidenceRef)?.kind !== "authority-roster-record" ||
    evidenceById.get(roster.evidenceRef)?.suppliedByRef !== roster.custodianRef ||
    roster.controlledRef !== evidenceById.get(roster.evidenceRef)?.controlledRef
  ) {
    add(
      "invalid_evidence_binding",
      "authorityRoster.evidenceRef",
      "The authority roster must share the content-addressed reference of its reciprocal roster evidence.",
      [roster.id],
    );
  }
  if (
    milliseconds(roster.issuedAt) === null ||
    milliseconds(roster.issuedAt) >= (reviewOpen ?? Number.NEGATIVE_INFINITY)
  ) {
    add(
      "invalid_chronology",
      "authorityRoster.issuedAt",
      "The authenticated authority roster must be issued before the review window opens.",
      [roster.id],
    );
  }
  const expectedRoundRoot = computeRoundRootDigest(value);
  if (round.roundRootDigest !== expectedRoundRoot) {
    add(
      "invalid_round_root",
      "round.roundRootDigest",
      "The round root must bind the round, current roster evidence, and both current source manifests, source-evidence roots, and export evidence.",
      [round.id],
    );
  }

  const ledgerConsumption = new Map(ledgerRows.map((row) => [row.id, 0]));
  const statementConsumption = new Map(statementRows.map((row) => [row.id, 0]));
  const matchedLedger = new Set();
  const matchedStatement = new Set();
  const latestExport = Math.max(
    milliseconds(ledgerExport.exportedAt) ?? Number.POSITIVE_INFINITY,
    milliseconds(statementExport.exportedAt) ?? Number.POSITIVE_INFINITY,
  );
  const sourceEvidenceTimes = [
    ledgerExport.evidenceRef,
    statementExport.evidenceRef,
    ...ledgerRows.map((row) => row.evidenceRef),
    ...statementRows.map((row) => row.evidenceRef),
  ].map((ref) => milliseconds(evidenceById.get(ref)?.observedAt) ?? Number.POSITIVE_INFINITY);
  const latestSourcePrerequisite = Math.max(latestExport, ...sourceEvidenceTimes);

  function consume(refs, expectedSide, rowsById, consumption, matched, path, targetRef) {
    if (!Array.isArray(refs) || new Set(refs).size !== refs.length) {
      add("row_reused", path, "A match group cannot repeat a row reference.", [targetRef]);
      return [];
    }
    const rows = [];
    for (const ref of refs) {
      const row = rowsById.get(ref);
      if (!row) {
        const opposite = expectedSide === "ledger" ? statementById : ledgerById;
        add(
          "invalid_row_reference",
          path,
          opposite.has(ref)
            ? `A ${expectedSide} row set cannot consume a row from the opposite side.`
            : `A ${expectedSide} row set cannot invent a row outside the current export.`,
          [targetRef],
        );
        continue;
      }
      consumption.set(ref, (consumption.get(ref) ?? 0) + 1);
      matched.add(ref);
      rows.push(row);
    }
    return rows;
  }

  for (const [index, group] of matchGroups.entries()) {
    const path = `matchGroups[${index}]`;
    const decision = object(group.decision);
    const ledgerRefs = Array.isArray(group.ledgerRowRefs) ? group.ledgerRowRefs : [];
    const statementRefs = Array.isArray(group.statementRowRefs) ? group.statementRowRefs : [];
    const exactCardinality =
      (group.cardinality === "1:1" && ledgerRefs.length === 1 && statementRefs.length === 1) ||
      (group.cardinality === "1:n" && ledgerRefs.length === 1 && statementRefs.length > 1) ||
      (group.cardinality === "n:1" && ledgerRefs.length > 1 && statementRefs.length === 1);
    if (!exactCardinality) {
      add(
        "invalid_group_cardinality",
        `${path}.cardinality`,
        "A match group must be exactly 1:1, 1:n, or n:1; many-to-many has no representation.",
        [group.id],
      );
    }
    if (
      group.roundRef !== round.id ||
      group.accountId !== round.accountId ||
      group.currency !== round.currency
    ) {
      add(
        "invalid_scope_binding",
        path,
        "Every group must bind the exact current round, account, and currency.",
        [group.id],
      );
    }
    const groupLedgerRows = consume(
      ledgerRefs,
      "ledger",
      ledgerById,
      ledgerConsumption,
      matchedLedger,
      `${path}.ledgerRowRefs`,
      group.id,
    );
    const groupStatementRows = consume(
      statementRefs,
      "statement",
      statementById,
      statementConsumption,
      matchedStatement,
      `${path}.statementRowRefs`,
      group.id,
    );
    try {
      const ledgerTotal = groupLedgerRows.reduce((sum, row) => sum + BigInt(row.minorUnits), 0n);
      const statementTotal = groupStatementRows.reduce(
        (sum, row) => sum + BigInt(row.minorUnits),
        0n,
      );
      if (ledgerTotal !== statementTotal) {
        add(
          "unbalanced_match",
          path,
          "A match group must have exactly equal signed integer minor-unit totals on both sides.",
          [group.id],
        );
      }
    } catch {
      add(
        "unbalanced_match",
        path,
        "A match group cannot balance because at least one minor-unit value is not an integer.",
        [group.id],
      );
    }

    const reconciler = principalById.get(decision.decidedByRef);
    const grant = grantById.get(decision.authorityGrantRef);
    const grantEvidence = evidenceById.get(grant?.evidenceRef);
    const decidedAt = milliseconds(decision.decidedAt);
    if (!namedHuman(reconciler)) {
      add(
        "invalid_reconciler",
        `${path}.decision.decidedByRef`,
        "A match decision must name a rostered human, never a role, team, system, or agent.",
        [decision.id],
      );
    }
    if (
      !grant ||
      grant.granteeRef !== decision.decidedByRef ||
      grant.roundRef !== round.id ||
      grant.accountId !== round.accountId ||
      grant.currency !== round.currency ||
      !sameExactIdSet(grant.scopes, [REVIEW_SCOPE]) ||
      decision.authorityGrantPayloadDigest !== computeAuthorityGrantPayloadDigest(grant) ||
      decision.authorityGrantEvidenceRef !== grant.evidenceRef ||
      decision.authorityGrantEvidenceDigest !== grantEvidence?.recordDigest ||
      decision.authorityGrantEvidenceControlledRef !== grantEvidence?.controlledRef ||
      decision.authorityRosterDigest !== roster.rosterDigest ||
      decidedAt === null ||
      decidedAt < (milliseconds(grant.activeFrom) ?? Number.POSITIVE_INFINITY) ||
      decidedAt > (milliseconds(grant.activeUntil) ?? Number.NEGATIVE_INFINITY)
    ) {
      add(
        "invalid_grant",
        `${path}.decision.authorityGrantRef`,
        "The current named reconciler needs an active exact-account/currency current-round review grant with exact grant payload, grant evidence, and roster-digest bindings.",
        [decision.id],
      );
    }
    const latestDecisionPrerequisite = Math.max(
      latestSourcePrerequisite,
      milliseconds(roster.issuedAt) ?? Number.POSITIVE_INFINITY,
      milliseconds(evidenceById.get(roster.evidenceRef)?.observedAt) ??
        Number.POSITIVE_INFINITY,
      milliseconds(grant?.issuedAt) ?? Number.POSITIVE_INFINITY,
      milliseconds(grantEvidence?.observedAt) ?? Number.POSITIVE_INFINITY,
    );
    if (
      decision.roundRef !== round.id ||
      decision.ledgerManifestDigest !== ledgerExport.rowManifestDigest ||
      decision.statementManifestDigest !== statementExport.rowManifestDigest ||
      decision.roundRootDigest !== round.roundRootDigest ||
      decidedAt === null ||
      decidedAt <= latestDecisionPrerequisite ||
      decidedAt < (reviewOpen ?? Number.POSITIVE_INFINITY) ||
      decidedAt > (reviewClose ?? Number.NEGATIVE_INFINITY)
    ) {
      add(
        "stale_decision",
        `${path}.decision`,
        "A match decision must be current-round, strictly after every source and authority evidence prerequisite, inside the review window, and bound to both manifests and the current round root.",
        [decision.id],
      );
    }
    const decisionEvidence = evidenceById.get(decision.evidenceRef);
    if (
      !decisionEvidence ||
      decisionEvidence.kind !== "match-decision-record" ||
      decisionEvidence.suppliedByRef !== decision.decidedByRef
    ) {
      add(
        "invalid_evidence_binding",
        `${path}.decision.evidenceRef`,
        "A match decision needs reciprocal payload-bound evidence supplied by its named reconciler.",
        [decision.id],
      );
    }
    rejectAfterAsOf(decision.decidedAt, `${path}.decision.decidedAt`, [decision.id]);
  }

  const residualLedger = new Set();
  const residualStatement = new Set();
  for (const [index, residual] of residuals.entries()) {
    const path = `residuals[${index}]`;
    const rowsById = residual.side === "ledger" ? ledgerById : statementById;
    const consumption = residual.side === "ledger" ? ledgerConsumption : statementConsumption;
    const residualSet = residual.side === "ledger" ? residualLedger : residualStatement;
    const row = rowsById.get(residual.rowRef);
    const recorder = principalById.get(residual.recordedByRef);
    const nextOwner = principalById.get(residual.nextOwnerRef);
    const recordedAt = milliseconds(residual.recordedAt);
    if (
      !["ledger", "statement"].includes(residual.side) ||
      !row ||
      residual.roundRef !== round.id ||
      residual.accountId !== round.accountId ||
      residual.currency !== round.currency ||
      residual.ledgerManifestDigest !== ledgerExport.rowManifestDigest ||
      residual.statementManifestDigest !== statementExport.rowManifestDigest ||
      residual.roundRootDigest !== round.roundRootDigest ||
      !RESIDUAL_REASONS.has(residual.reason) ||
      !namedHuman(recorder) ||
      !namedHuman(nextOwner) ||
      !hasScope(nextOwner, HANDOFF_SCOPE) ||
      recordedAt === null ||
      recordedAt <= latestSourcePrerequisite ||
      recordedAt < (reviewOpen ?? Number.POSITIVE_INFINITY) ||
      recordedAt > (reviewClose ?? Number.NEGATIVE_INFINITY)
    ) {
      add(
        "invalid_residual",
        path,
        "A residual must bind one current-round row, both current source manifests and round root, exact scope, a closed reason, a time strictly after source evidence, and named recorder and handoff owner.",
        [residual.id],
      );
    }
    if (row) {
      consumption.set(row.id, (consumption.get(row.id) ?? 0) + 1);
      residualSet.add(row.id);
    } else if (
      (residual.side === "ledger" && statementById.has(residual.rowRef)) ||
      (residual.side === "statement" && ledgerById.has(residual.rowRef))
    ) {
      add(
        "invalid_row_reference",
        `${path}.rowRef`,
        "A residual cannot consume a row from the opposite side.",
        [residual.id],
      );
    } else {
      add(
        "invalid_row_reference",
        `${path}.rowRef`,
        "A residual cannot invent a row outside the current exports.",
        [residual.id],
      );
    }
    const residualEvidence = evidenceById.get(residual.evidenceRef);
    if (
      !residualEvidence ||
      residualEvidence.kind !== "residual-record" ||
      residualEvidence.suppliedByRef !== residual.recordedByRef
    ) {
      add(
        "invalid_evidence_binding",
        `${path}.evidenceRef`,
        "A residual needs reciprocal payload-bound evidence supplied by its named recorder.",
        [residual.id],
      );
    }
    rejectAfterAsOf(residual.recordedAt, `${path}.recordedAt`, [residual.id]);
  }

  for (const [rowId, consumed] of [...ledgerConsumption, ...statementConsumption]) {
    if (consumed !== 1) {
      add(
        consumed === 0 ? "incomplete_coverage" : "row_reused",
        rowId,
        `Every current source row must appear exactly once across match groups and residuals; observed ${consumed}.`,
        [rowId],
      );
    }
  }

  const expectedCoverage = {
    ledgerRowRefs: ledgerRows.map((row) => row.id),
    statementRowRefs: statementRows.map((row) => row.id),
    matchedLedgerRowRefs: [...matchedLedger],
    matchedStatementRowRefs: [...matchedStatement],
    residualLedgerRowRefs: [...residualLedger],
    residualStatementRowRefs: [...residualStatement],
    groupRefs: matchGroups.map((row) => row.id),
    residualRefs: residuals.map((row) => row.id),
  };
  if (coverage.roundRef !== round.id) {
    add(
      "incomplete_coverage",
      "coverage.roundRef",
      "Coverage must bind the current reconciliation round.",
      [coverage.id],
    );
  }
  for (const [field, expected] of Object.entries(expectedCoverage)) {
    if (!sameExactIdSet(coverage[field], expected)) {
      add(
        "incomplete_coverage",
        `coverage.${field}`,
        `${field} must equal the derived current-round two-sided partition index exactly.`,
        [coverage.id],
      );
    }
  }

  const destinationApprover = principalById.get(destination.approvedByRef);
  const destinationGrant = grantById.get(destination.authorityGrantRef);
  const destinationGrantEvidence = evidenceById.get(destinationGrant?.evidenceRef);
  const destinationEvidence = evidenceById.get(destination.evidenceRef);
  const destinationApprovedAt = milliseconds(destination.approvedAt);
  const latestDestinationPrerequisite = Math.max(
    latestSourcePrerequisite,
    milliseconds(roster.issuedAt) ?? Number.POSITIVE_INFINITY,
    milliseconds(evidenceById.get(roster.evidenceRef)?.observedAt) ??
      Number.POSITIVE_INFINITY,
    milliseconds(destinationGrant?.issuedAt) ?? Number.POSITIVE_INFINITY,
    milliseconds(destinationGrantEvidence?.observedAt) ?? Number.POSITIVE_INFINITY,
  );
  if (
    destination.roundRef !== round.id ||
    destination.accountId !== round.accountId ||
    destination.currency !== round.currency ||
    typeof destination.controlledRef !== "string" ||
    destination.visibility !== "private" ||
    !namedHuman(destinationApprover) ||
    !hasScope(destinationApprover, DESTINATION_SCOPE) ||
    !destinationGrant ||
    destinationGrant.granteeRef !== destination.approvedByRef ||
    destinationGrant.roundRef !== round.id ||
    destinationGrant.accountId !== round.accountId ||
    destinationGrant.currency !== round.currency ||
    !sameExactIdSet(destinationGrant.scopes, [DESTINATION_SCOPE]) ||
    destination.authorityRosterDigest !== roster.rosterDigest ||
    destination.authorityGrantPayloadDigest !==
      computeAuthorityGrantPayloadDigest(destinationGrant) ||
    destination.authorityGrantEvidenceRef !== destinationGrant.evidenceRef ||
    destination.authorityGrantEvidenceDigest !== destinationGrantEvidence?.recordDigest ||
    destination.authorityGrantEvidenceControlledRef !==
      destinationGrantEvidence?.controlledRef ||
    destination.roundRootDigest !== round.roundRootDigest ||
    destinationApprovedAt === null ||
    destinationApprovedAt <= latestDestinationPrerequisite ||
    destinationApprovedAt < (reviewOpen ?? Number.POSITIVE_INFINITY) ||
    destinationApprovedAt > (reviewClose ?? Number.NEGATIVE_INFINITY) ||
    destinationApprovedAt < (milliseconds(destinationGrant.activeFrom) ?? Number.POSITIVE_INFINITY) ||
    destinationApprovedAt > (milliseconds(destinationGrant.activeUntil) ?? Number.NEGATIVE_INFINITY) ||
    !destinationEvidence ||
    destinationEvidence.kind !== "destination-approval-record" ||
    destinationEvidence.suppliedByRef !== destination.approvedByRef
  ) {
    add(
      "invalid_destination",
      "round.destination",
      "The current-round private destination approval must bind exact destination, approver, roster, round root, active destination grant payload/evidence, and a strictly causal approval time with reciprocal evidence.",
      [destination.id],
    );
  }
  rejectAfterAsOf(destination.approvedAt, "round.destination.approvedAt", [destination.id]);

  const preBlockerFindings = [...findings];
  const expectedBlockerTargets = new Map();
  for (const item of preBlockerFindings) {
    const category = categoryForFinding(item.code);
    if (!category) continue;
    if (!expectedBlockerTargets.has(category)) expectedBlockerTargets.set(category, new Set());
    for (const ref of item.targetRefs) expectedBlockerTargets.get(category).add(ref);
  }
  const seenBlockerCategories = new Set();
  for (const [index, blocker] of blockers.entries()) {
    const path = `blockers[${index}]`;
    const owner = principalById.get(blocker.ownerRef);
    const expectedTargets = [...(expectedBlockerTargets.get(blocker.code) ?? [])];
    const blockerEvidence = (Array.isArray(blocker.evidenceRefs) ? blocker.evidenceRefs : []).map(
      (ref) => evidenceById.get(ref),
    );
    if (
      blocker.roundRef !== round.id ||
      !expectedBlockerTargets.has(blocker.code) ||
      seenBlockerCategories.has(blocker.code) ||
      !sameExactIdSet(blocker.targetRefs, expectedTargets) ||
      !namedHuman(owner) ||
      !hasScope(owner, HANDOFF_SCOPE) ||
      milliseconds(blocker.raisedAt) === null ||
      milliseconds(blocker.raisedAt) < (reviewOpen ?? Number.POSITIVE_INFINITY) ||
      milliseconds(blocker.raisedAt) > (reviewClose ?? Number.NEGATIVE_INFINITY) ||
      !Array.isArray(blocker.targetRefs) ||
      blocker.targetRefs.length === 0 ||
      blocker.targetRefs.some((ref) => !allIds.has(ref)) ||
      blockerEvidence.some((row) => !row) ||
      !blockerEvidence.some(
        (row) => row?.kind === "blocker-record" && row?.suppliedByRef === blocker.ownerRef,
      )
    ) {
      add(
        "invalid_blocker",
        path,
        "Each blocker category must occur exactly once and carry the exact derived target-id set for current blocking findings, a trusted current-window time, and reciprocal owner evidence.",
        [blocker.id],
      );
    }
    seenBlockerCategories.add(blocker.code);
    rejectAfterAsOf(blocker.raisedAt, `${path}.raisedAt`, [blocker.id]);
  }
  for (const [category, targetRefs] of expectedBlockerTargets) {
    if (!seenBlockerCategories.has(category)) {
      add(
        "invalid_blocker",
        "blockers",
        `The blocker ledger omits derived ${category} findings for ${sortedIds([...targetRefs]).join(", ")}.`,
        sortedIds([...targetRefs]),
      );
    }
  }

  const expectedCounts = {
    ledgerRows: ledgerRows.length,
    statementRows: statementRows.length,
    matchedLedgerRows: matchedLedger.size,
    matchedStatementRows: matchedStatement.size,
    groups: matchGroups.length,
    ledgerResiduals: residualLedger.size,
    statementResiduals: residualStatement.size,
    blockers: blockers.length,
  };
  const expectedIndexes = {
    ledgerRowRefs: ledgerRows.map((row) => row.id),
    statementRowRefs: statementRows.map((row) => row.id),
    groupRefs: matchGroups.map((row) => row.id),
    residualRefs: residuals.map((row) => row.id),
    blockerRefs: blockers.map((row) => row.id),
  };
  const handoffOwner = principalById.get(handoff.nextOwnerRef);
  const handoffGrant = grantById.get(handoff.authorityGrantRef);
  const handoffGrantEvidence = evidenceById.get(handoffGrant?.evidenceRef);
  const handoffEvidence = evidenceById.get(handoff.evidenceRef);
  const handedOffAt = milliseconds(handoff.handedOffAt);
  const destinationApprovalEvidence = evidenceById.get(destination.evidenceRef);
  const expectedPartitionEvidenceRoot = computePartitionEvidenceRootDigest(value);
  const prerequisiteTimes = [
    destination.approvedAt,
    destinationApprovalEvidence?.observedAt,
    ...matchGroups.flatMap((group) => [
      object(group.decision).decidedAt,
      evidenceById.get(object(group.decision).evidenceRef)?.observedAt,
    ]),
    ...residuals.flatMap((residual) => [
      residual.recordedAt,
      evidenceById.get(residual.evidenceRef)?.observedAt,
    ]),
    ...blockers.flatMap((blocker) => [
      blocker.raisedAt,
      ...(Array.isArray(blocker.evidenceRefs)
        ? blocker.evidenceRefs.map((ref) => evidenceById.get(ref)?.observedAt)
        : []),
    ]),
    handoffGrant?.issuedAt,
    handoffGrantEvidence?.observedAt,
  ].map((timestamp) => milliseconds(timestamp) ?? Number.POSITIVE_INFINITY);
  const latestHandoffPrerequisite = Math.max(latestSourcePrerequisite, ...prerequisiteTimes);
  if (
    handoff.roundRef !== round.id ||
    handoff.destinationRef !== destination.controlledRef ||
    handoff.destinationVisibility !== destination.visibility ||
    handoff.destinationApprovalRef !== destination.id ||
    handoff.destinationApprovalEvidenceRef !== destination.evidenceRef ||
    handoff.destinationApprovalEvidenceDigest !== destinationApprovalEvidence?.recordDigest ||
    handoff.destinationApprovalEvidenceControlledRef !==
      destinationApprovalEvidence?.controlledRef ||
    handoff.ledgerManifestDigest !== ledgerExport.rowManifestDigest ||
    handoff.statementManifestDigest !== statementExport.rowManifestDigest ||
    handoff.roundRootDigest !== round.roundRootDigest ||
    handoff.partitionEvidenceRootDigest !== expectedPartitionEvidenceRoot ||
    !namedHuman(handoffOwner) ||
    !hasScope(handoffOwner, HANDOFF_SCOPE) ||
    !handoffGrant ||
    handoffGrant.granteeRef !== handoff.nextOwnerRef ||
    handoffGrant.roundRef !== round.id ||
    handoffGrant.accountId !== round.accountId ||
    handoffGrant.currency !== round.currency ||
    !sameExactIdSet(handoffGrant.scopes, [HANDOFF_SCOPE]) ||
    handoff.authorityGrantPayloadDigest !== computeAuthorityGrantPayloadDigest(handoffGrant) ||
    handoff.authorityGrantEvidenceRef !== handoffGrant.evidenceRef ||
    handoff.authorityGrantEvidenceDigest !== handoffGrantEvidence?.recordDigest ||
    handoff.authorityGrantEvidenceControlledRef !== handoffGrantEvidence?.controlledRef ||
    handedOffAt === null ||
    handedOffAt <= latestHandoffPrerequisite ||
    handedOffAt < (reviewOpen ?? Number.POSITIVE_INFINITY) ||
    handedOffAt > (reviewClose ?? Number.NEGATIVE_INFINITY) ||
    handedOffAt < (milliseconds(handoffGrant.activeFrom) ?? Number.POSITIVE_INFINITY) ||
    handedOffAt > (milliseconds(handoffGrant.activeUntil) ?? Number.NEGATIVE_INFINITY) ||
    !handoffEvidence ||
    handoffEvidence.kind !== "handoff-record" ||
    handoffEvidence.suppliedByRef !== handoff.nextOwnerRef
  ) {
    add(
      handoff.destinationRef !== destination.controlledRef
        ? "invalid_destination"
        : "invalid_handoff",
      "handoff",
      "The content-bound handoff must bind the current round root, both manifests, complete partition-evidence root, exact approved destination evidence, derived state/counts/indexes, named next owner, exact active handoff grant evidence, and a strictly causal current-window time.",
      [handoff.id],
    );
  }
  rejectAfterAsOf(handoff.handedOffAt, "handoff.handedOffAt", [handoff.id]);
  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (counts[field] !== expected) {
      add(
        "invalid_handoff",
        `handoff.counts.${field}`,
        `${field} must equal the derived current-round count exactly.`,
        [handoff.id],
      );
    }
  }
  for (const [field, expected] of Object.entries(expectedIndexes)) {
    if (!sameExactIdSet(indexes[field], expected)) {
      add(
        "invalid_handoff",
        `handoff.indexes.${field}`,
        `${field} must equal the derived current-round index exactly.`,
        [handoff.id],
      );
    }
  }

  const blockerLedgerExact =
    !findings.some((item) => item.code === "invalid_blocker") &&
    blockers.length === expectedBlockerTargets.size;
  const preHandoffArtifactFindings = preBlockerFindings;
  if (
    handoff.state === "ready-for-owner-review" &&
    (preHandoffArtifactFindings.length > 0 || blockers.length > 0)
  ) {
    add(
      "invalid_handoff",
      "handoff.state",
      "Ready-for-owner-review is allowed with residuals, but never with blockers or semantic defects.",
      [handoff.id],
    );
  }
  if (
    handoff.state === "blocked" &&
    (expectedBlockerTargets.size === 0 || !blockerLedgerExact)
  ) {
    add(
      "invalid_handoff",
      "handoff.state",
      "Blocked is truthful only when the blocker ledger exactly equals every derived blocking category and target-id set.",
      [handoff.id],
    );
  }
  if (!["blocked", "ready-for-owner-review"].includes(handoff.state)) {
    add(
      "invalid_handoff",
      "handoff.state",
      "The only handoff states are blocked and ready-for-owner-review.",
      [handoff.id],
    );
  }

  return findings;
}

export function financialAccountReconciliationFindings(input, context) {
  return validateArtifact(input, context);
}

export function recomputeArtifactDigests(input) {
  if (!isRecord(input)) return input;
  const value = input;
  const ledgerRows = Array.isArray(value.ledgerRows) ? value.ledgerRows.filter(isRecord) : [];
  const statementRows = Array.isArray(value.statementRows)
    ? value.statementRows.filter(isRecord)
    : [];
  const ledgers = {
    authorityGrants: Array.isArray(value.authorityGrants) ? value.authorityGrants : [],
    ledgerRows,
    statementRows,
    matchGroups: Array.isArray(value.matchGroups) ? value.matchGroups : [],
    residuals: Array.isArray(value.residuals) ? value.residuals : [],
    blockers: Array.isArray(value.blockers) ? value.blockers : [],
  };
  const evidence = Array.isArray(value.evidence) ? value.evidence.filter(isRecord) : [];
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  function refreshEvidence(kinds) {
    for (const evidenceRow of evidence) {
      if (!kinds.has(evidenceRow.kind)) continue;
      const source = sourceForEvidence(evidenceRow, value, ledgers);
      evidenceRow.payloadDigest = computeEvidencePayloadDigest(evidenceRow.kind, source, value);
      evidenceRow.recordDigest = computeEvidenceRecordDigest(evidenceRow);
      evidenceRow.controlledRef = contentAddressedControlledRef(evidenceRow);
    }
  }

  for (const row of [...ledgerRows, ...statementRows]) row.rowDigest = computeRowDigest(row);
  if (isRecord(value.ledgerExport)) {
    value.ledgerExport.rowManifestDigest = computeExportManifestDigest(ledgerRows);
  }
  if (isRecord(value.statementExport)) {
    value.statementExport.rowManifestDigest = computeExportManifestDigest(statementRows);
  }
  if (isRecord(value.authorityRoster)) {
    value.authorityRoster.rosterDigest = computeAuthorityRosterDigest(value.principals);
  }
  refreshEvidence(new Set(["authority-roster-record"]));
  if (isRecord(value.authorityRoster)) {
    const rosterEvidence = evidenceById.get(value.authorityRoster.evidenceRef);
    if (rosterEvidence) value.authorityRoster.controlledRef = rosterEvidence.controlledRef;
  }
  const roster = object(value.authorityRoster);
  const rosterEvidence = evidenceById.get(roster.evidenceRef);
  const principals = Array.isArray(value.principals) ? value.principals : [];
  for (const grant of ledgers.authorityGrants.filter(isRecord)) {
    const issuer = principals.find(
      (principal) => isRecord(principal) && principal.id === grant.issuedByRef,
    );
    const grantee = principals.find(
      (principal) => isRecord(principal) && principal.id === grant.granteeRef,
    );
    grant.authorityRosterRef = roster.id;
    grant.authorityRosterDigest = roster.rosterDigest;
    grant.authorityRosterEvidenceRef = roster.evidenceRef;
    grant.authorityRosterEvidenceDigest = rosterEvidence?.recordDigest ?? null;
    grant.authorityRosterEvidenceControlledRef = rosterEvidence?.controlledRef ?? null;
    grant.issuerPrincipalDigest = isRecord(issuer)
      ? computePrincipalPayloadDigest(issuer)
      : null;
    grant.granteePrincipalDigest = isRecord(grantee)
      ? computePrincipalPayloadDigest(grantee)
      : null;
  }
  refreshEvidence(new Set(["authority-grant-record"]));

  refreshEvidence(new Set(["ledger-row-record", "statement-row-record"]));
  if (isRecord(value.ledgerExport)) {
    value.ledgerExport.sourceEvidenceRootDigest = computeSourceEvidenceRootDigest(
      ledgerRows,
      evidence,
    );
  }
  if (isRecord(value.statementExport)) {
    value.statementExport.sourceEvidenceRootDigest = computeSourceEvidenceRootDigest(
      statementRows,
      evidence,
    );
  }
  refreshEvidence(new Set(["ledger-export-record", "statement-export-record"]));

  const round = object(value.round);
  if (isRecord(value.round)) value.round.roundRootDigest = computeRoundRootDigest(value);
  const grantById = new Map(ledgers.authorityGrants.filter(isRecord).map((row) => [row.id, row]));
  function bindGrant(target) {
    if (!isRecord(target)) return;
    const grant = grantById.get(target.authorityGrantRef);
    const grantEvidence = evidenceById.get(grant?.evidenceRef);
    target.authorityGrantPayloadDigest = computeAuthorityGrantPayloadDigest(grant);
    target.authorityGrantEvidenceRef = grant?.evidenceRef ?? null;
    target.authorityGrantEvidenceDigest = grantEvidence?.recordDigest ?? null;
    target.authorityGrantEvidenceControlledRef = grantEvidence?.controlledRef ?? null;
  }
  for (const group of ledgers.matchGroups.filter(isRecord)) {
    if (!isRecord(group.decision)) continue;
    group.decision.ledgerManifestDigest = object(value.ledgerExport).rowManifestDigest;
    group.decision.statementManifestDigest = object(value.statementExport).rowManifestDigest;
    group.decision.roundRootDigest = round.roundRootDigest;
    group.decision.authorityRosterDigest = roster.rosterDigest;
    bindGrant(group.decision);
  }
  for (const residual of ledgers.residuals.filter(isRecord)) {
    residual.ledgerManifestDigest = object(value.ledgerExport).rowManifestDigest;
    residual.statementManifestDigest = object(value.statementExport).rowManifestDigest;
    residual.roundRootDigest = round.roundRootDigest;
  }
  const destination = object(round.destination);
  destination.authorityRosterDigest = roster.rosterDigest;
  destination.roundRootDigest = round.roundRootDigest;
  bindGrant(destination);
  refreshEvidence(
    new Set([
      "match-decision-record",
      "residual-record",
      "blocker-record",
      "destination-approval-record",
    ]),
  );

  const handoff = object(value.handoff);
  const destinationEvidence = evidenceById.get(destination.evidenceRef);
  handoff.destinationRef = destination.controlledRef;
  handoff.destinationVisibility = destination.visibility;
  handoff.destinationApprovalRef = destination.id;
  handoff.destinationApprovalEvidenceRef = destination.evidenceRef;
  handoff.destinationApprovalEvidenceDigest = destinationEvidence?.recordDigest ?? null;
  handoff.destinationApprovalEvidenceControlledRef =
    destinationEvidence?.controlledRef ?? null;
  handoff.ledgerManifestDigest = object(value.ledgerExport).rowManifestDigest;
  handoff.statementManifestDigest = object(value.statementExport).rowManifestDigest;
  handoff.roundRootDigest = round.roundRootDigest;
  bindGrant(handoff);
  handoff.partitionEvidenceRootDigest = computePartitionEvidenceRootDigest(value);
  refreshEvidence(new Set(["handoff-record"]));
  return value;
}
