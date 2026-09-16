import { createHash } from "node:crypto";

export const ENTERPRISE_LICENSE_ENTITLEMENT_SCHEMA_VERSION =
  "awesomeClaws.enterpriseLicenseEntitlementReconciliation.v1";
export const ENTERPRISE_LICENSE_TRUST_ROOT_SCHEMA_VERSION =
  "awesomeClaws.enterpriseLicenseTrustRoot.v1";

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const HANDOFF_DISCLAIMERS = {
  purchasePerformed: "not-performed",
  assignmentPerformed: "not-performed",
  revocationPerformed: "not-performed",
  renewalPerformed: "not-performed",
  accountMutationPerformed: "not-performed",
  trueUpSubmitted: "not-performed",
  complianceDeclared: "not-claimed",
  effectiveAccessInferred: "not-performed",
  effectiveUsageInferred: "not-performed",
};
const ROLE_SCOPES = [
  "rights-source-owner",
  "sku-mapping-source-owner",
  "assignment-source-owner",
  "consumption-source-owner",
  "authority-roster-custodian",
  "authority-grant-issuer",
  "position-reconciler",
  "exception-reviewer",
  "destination-approver",
  "handoff-owner",
];
const LEDGERS = [
  "rights",
  "pools",
  "skuMappings",
  "sourceExports",
  "assignments",
  "consumption",
  "principals",
  "authorityGrants",
  "positions",
  "exceptions",
  "decisions",
  "blockers",
  "evidence",
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

function integer(value) {
  return Number.isSafeInteger(value) ? value : 0;
}

function exactNonNegativeSum(values) {
  let total = 0n;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return { valid: false, outOfRange: false, value: null };
    }
    total += BigInt(value);
  }
  if (total > MAX_SAFE_BIGINT) {
    return { valid: true, outOfRange: true, value: null };
  }
  return { valid: true, outOfRange: false, value: Number(total) };
}

function exactConvertedUnits(sourceUnits, numerator, denominator) {
  if (
    !Number.isSafeInteger(sourceUnits) ||
    sourceUnits < 0 ||
    !Number.isSafeInteger(numerator) ||
    numerator <= 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  ) {
    return { valid: false, outOfRange: false, value: null };
  }
  const product = BigInt(sourceUnits) * BigInt(numerator);
  const divisor = BigInt(denominator);
  if (product % divisor !== 0n) {
    return { valid: false, outOfRange: false, value: null };
  }
  const quotient = product / divisor;
  if (quotient > MAX_SAFE_BIGINT) {
    return { valid: true, outOfRange: true, value: null };
  }
  return { valid: true, outOfRange: false, value: Number(quotient) };
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
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  const left = sorted(actual);
  const right = sorted(expected);
  return (
    left.length === actual.length &&
    right.length === expected.length &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function omit(value, fields) {
  return Object.fromEntries(
    Object.entries(object(value)).filter(([key]) => !fields.includes(key)),
  );
}

function sortedRecords(values) {
  return records(values)
    .map((row) => structuredClone(row))
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
}

function timestamp(value) {
  if (typeof value !== "string") return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute =
    offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
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
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function strictlyAfter(value, prerequisites) {
  const instant = timestamp(value);
  return (
    instant !== null &&
    prerequisites.every((prerequisite) => {
      const prior = timestamp(prerequisite);
      return prior !== null && prior < instant;
    })
  );
}

function ids(values) {
  return records(values).map((row) => row.id).filter((id) => typeof id === "string");
}

function mapById(values) {
  return new Map(records(values).map((row) => [row.id, row]));
}

function sourceEvidenceAnchors(value, evidenceRefs) {
  const evidenceById = mapById(object(value).evidence);
  return [...new Set(strings(evidenceRefs))]
    .sort(compareUtf16CodeUnits)
    .map((ref) => {
      const row = object(evidenceById.get(ref));
      return {
        id: row.id ?? ref,
        kind: row.kind ?? null,
        observedAt: row.observedAt ?? null,
        suppliedByRef: row.suppliedByRef ?? null,
        subjectRefs: sorted(row.subjectRefs),
        sourceRecordDigest: row.sourceRecordDigest ?? null,
      };
    });
}

export function computeRightsManifestDigest(value) {
  const artifact = object(value);
  const rights = sortedRecords(artifact.rights);
  const pools = sortedRecords(artifact.pools);
  return digest({
    manifest: omit(artifact.rightsManifest, ["contentDigest"]),
    rights,
    pools,
    sourceEvidence: sourceEvidenceAnchors(artifact, [
      object(artifact.rightsManifest).evidenceRef,
      ...rights.map((row) => row.evidenceRef),
      ...pools.map((row) => row.evidenceRef),
    ]),
  });
}

export function computeSkuMappingDigest(value) {
  const artifact = object(value);
  const mappings = sortedRecords(artifact.skuMappings);
  return digest({
    register: omit(artifact.skuMappingRegister, ["contentDigest"]),
    mappings,
    sourceEvidence: sourceEvidenceAnchors(artifact, [
      object(artifact.skuMappingRegister).evidenceRef,
      ...mappings.map((row) => row.evidenceRef),
    ]),
  });
}

export function computeAuthorityRosterDigest(value) {
  const artifact = object(value);
  return digest({
    roster: omit(artifact.authorityRoster, ["contentDigest"]),
    principals: sortedRecords(artifact.principals),
    sourceEvidence: sourceEvidenceAnchors(artifact, [
      object(artifact.authorityRoster).evidenceRef,
    ]),
  });
}

export function computeRowDigest(row) {
  return digest(omit(row, ["rowDigest", "evidenceRef"]));
}

export function computeSourceExportDigest(sourceExport, rows) {
  return digest({
    export: omit(sourceExport, ["contentDigest", "evidenceRef"]),
    rows: sortedRecords(rows).map((row) => omit(row, ["evidenceRef"])),
  });
}

export function computeAuthorityGrantDigest(grant) {
  return digest(omit(grant, ["payloadDigest", "evidenceRef"]));
}

export function computeRoundDigest(value) {
  const artifact = object(value);
  return digest({
    artifactId: artifact.artifactId ?? null,
    round: omit(artifact.round, ["roundDigest"]),
  });
}

export function computeCoverageDigest(coverage, value) {
  const artifact = object(value);
  const evidenceRefs = records(artifact.evidence)
    .filter((row) => row.kind !== "handoff-record")
    .map((row) => row.id);
  return digest({
    coverage: omit(coverage, ["contentDigest"]),
    trustRoots: {
      rightsManifestDigest: object(artifact.rightsManifest).contentDigest ?? null,
      skuMappingDigest: object(artifact.skuMappingRegister).contentDigest ?? null,
      authorityRosterDigest: object(artifact.authorityRoster).contentDigest ?? null,
    },
    sourceExports: sortedRecords(artifact.sourceExports),
    assignments: sortedRecords(artifact.assignments),
    consumption: sortedRecords(artifact.consumption),
    authorityGrants: sortedRecords(artifact.authorityGrants),
    positions: sortedRecords(artifact.positions),
    exceptions: sortedRecords(artifact.exceptions),
    decisions: sortedRecords(artifact.decisions),
    blockers: sortedRecords(artifact.blockers),
    evidenceAnchors: sourceEvidenceAnchors(artifact, evidenceRefs),
  });
}

export function computeDestinationApprovalDigest(approval) {
  return digest(omit(approval, ["payloadDigest", "evidenceRef"]));
}

export function computeHandoffDigest(handoff, value) {
  const artifact = object(value);
  return digest({
    handoff: omit(handoff, ["payloadDigest"]),
    terminalEvidence: sourceEvidenceAnchors(artifact, [
      object(artifact.destinationApproval).evidenceRef,
      object(handoff).evidenceRef,
    ]),
  });
}

function rowsNamedBySubjects(value, ledger, subjectRefs) {
  const wanted = new Set(strings(subjectRefs));
  return sortedRecords(object(value)[ledger]).filter((row) => wanted.has(row.id));
}

export function evidencePayloadProjection(kind, value, evidence) {
  const artifact = object(value);
  const row = object(evidence);
  switch (kind) {
    case "rights-manifest-record":
      return {
        rightsManifest: artifact.rightsManifest ?? null,
        rights: rowsNamedBySubjects(artifact, "rights", row.subjectRefs),
        pools: rowsNamedBySubjects(artifact, "pools", row.subjectRefs),
      };
    case "sku-mapping-record":
      return {
        skuMappingRegister: artifact.skuMappingRegister ?? null,
        skuMappings: rowsNamedBySubjects(artifact, "skuMappings", row.subjectRefs),
      };
    case "assignment-export-record":
      return {
        sourceExports: rowsNamedBySubjects(artifact, "sourceExports", row.subjectRefs),
        assignments: rowsNamedBySubjects(artifact, "assignments", row.subjectRefs),
      };
    case "consumption-export-record":
      return {
        sourceExports: rowsNamedBySubjects(artifact, "sourceExports", row.subjectRefs),
        consumption: rowsNamedBySubjects(artifact, "consumption", row.subjectRefs),
      };
    case "authority-roster-record":
      return {
        authorityRoster: artifact.authorityRoster ?? null,
        principals: rowsNamedBySubjects(artifact, "principals", row.subjectRefs),
      };
    case "authority-grant-record":
      return {
        authorityGrants: rowsNamedBySubjects(artifact, "authorityGrants", row.subjectRefs),
      };
    case "position-record":
      return { positions: rowsNamedBySubjects(artifact, "positions", row.subjectRefs) };
    case "exception-record":
      return { exceptions: rowsNamedBySubjects(artifact, "exceptions", row.subjectRefs) };
    case "decision-record":
      return { decisions: rowsNamedBySubjects(artifact, "decisions", row.subjectRefs) };
    case "blocker-record":
      return { blockers: rowsNamedBySubjects(artifact, "blockers", row.subjectRefs) };
    case "destination-approval-record":
      return { destinationApproval: artifact.destinationApproval ?? null };
    case "handoff-record":
      return { handoff: artifact.handoff ?? null };
    default:
      return null;
  }
}

export function computeEvidencePayloadDigest(kind, value, evidence) {
  const projection = evidencePayloadProjection(kind, value, evidence);
  return projection === null ? null : digest(projection);
}

export function computeEvidenceRecordDigest(evidence) {
  return digest(omit(evidence, ["recordDigest", "controlledRef"]));
}

export function contentAddressedEvidenceRef(evidence) {
  const hash = String(object(evidence).recordDigest ?? "").replace(/^sha256:/u, "");
  return `controlled://license-reconciliation/${object(evidence).id}@sha256-${hash}`;
}

function evidenceForKind(value, kind) {
  return records(object(value).evidence).find((row) => row.kind === kind);
}

function evidenceBoundRows(value, ledger, evidence) {
  return records(object(value)[ledger]).filter(
    (row) => row.evidenceRef === object(evidence).id,
  );
}

function expectedEvidenceSubjects(kind, value, evidence) {
  const artifact = object(value);
  const sourceExports = evidenceBoundRows(artifact, "sourceExports", evidence);
  const assignmentExports = sourceExports.filter((row) => row.kind === "assignment-export");
  const consumptionExports = sourceExports.filter((row) => row.kind === "consumption-export");
  switch (kind) {
    case "rights-manifest-record":
      return [
        ...(object(artifact.rightsManifest).evidenceRef === object(evidence).id
          ? [object(artifact.rightsManifest).id]
          : []),
        ...ids(evidenceBoundRows(artifact, "rights", evidence)),
        ...ids(evidenceBoundRows(artifact, "pools", evidence)),
      ];
    case "sku-mapping-record":
      return [
        ...(object(artifact.skuMappingRegister).evidenceRef === object(evidence).id
          ? [object(artifact.skuMappingRegister).id]
          : []),
        ...ids(evidenceBoundRows(artifact, "skuMappings", evidence)),
      ];
    case "assignment-export-record":
      return [
        ...ids(assignmentExports),
        ...ids(evidenceBoundRows(artifact, "assignments", evidence)),
      ];
    case "consumption-export-record":
      return [
        ...ids(consumptionExports),
        ...ids(evidenceBoundRows(artifact, "consumption", evidence)),
      ];
    case "authority-roster-record":
      return object(artifact.authorityRoster).evidenceRef === object(evidence).id
        ? [object(artifact.authorityRoster).id, ...ids(artifact.principals)]
        : [];
    case "authority-grant-record":
      return ids(evidenceBoundRows(artifact, "authorityGrants", evidence));
    case "position-record":
      return ids(evidenceBoundRows(artifact, "positions", evidence));
    case "exception-record":
      return ids(evidenceBoundRows(artifact, "exceptions", evidence));
    case "decision-record":
      return ids(evidenceBoundRows(artifact, "decisions", evidence));
    case "blocker-record":
      return ids(evidenceBoundRows(artifact, "blockers", evidence));
    case "destination-approval-record":
      return object(artifact.destinationApproval).evidenceRef === object(evidence).id
        ? [object(artifact.destinationApproval).id]
        : [];
    case "handoff-record":
      return object(artifact.handoff).evidenceRef === object(evidence).id
        ? [object(artifact.handoff).id]
        : [];
    default:
      return [];
  }
}

function expectedEvidenceProducers(kind, value, evidence) {
  const artifact = object(value);
  const sourceExports = evidenceBoundRows(artifact, "sourceExports", evidence);
  switch (kind) {
    case "rights-manifest-record":
      return object(artifact.rightsManifest).evidenceRef === object(evidence).id
        ? [object(artifact.rightsManifest).confirmedByRef]
        : [];
    case "sku-mapping-record":
      return object(artifact.skuMappingRegister).evidenceRef === object(evidence).id
        ? [object(artifact.skuMappingRegister).confirmedByRef]
        : [];
    case "assignment-export-record":
      return sourceExports
        .filter((row) => row.kind === "assignment-export")
        .map((row) => row.suppliedByRef);
    case "consumption-export-record":
      return sourceExports
        .filter((row) => row.kind === "consumption-export")
        .map((row) => row.suppliedByRef);
    case "authority-roster-record":
      return object(artifact.authorityRoster).evidenceRef === object(evidence).id
        ? [object(artifact.authorityRoster).custodianRef]
        : [];
    case "authority-grant-record":
      return evidenceBoundRows(artifact, "authorityGrants", evidence).map(
        (row) => row.issuedByRef,
      );
    case "position-record":
      return evidenceBoundRows(artifact, "positions", evidence).map(
        (row) => row.reconciledByRef,
      );
    case "exception-record":
      return evidenceBoundRows(artifact, "exceptions", evidence).map(
        (row) => row.ownerRef,
      );
    case "decision-record":
      return evidenceBoundRows(artifact, "decisions", evidence).map(
        (row) => row.reviewedByRef,
      );
    case "blocker-record":
      return evidenceBoundRows(artifact, "blockers", evidence).map(
        (row) => row.ownerRef,
      );
    case "destination-approval-record":
      return object(artifact.destinationApproval).evidenceRef === object(evidence).id
        ? [object(artifact.destinationApproval).approvedByRef]
        : [];
    case "handoff-record":
      return object(artifact.handoff).evidenceRef === object(evidence).id
        ? [object(artifact.handoff).nextOwnerRef]
        : [];
    default:
      return [];
  }
}

function evidenceChronologyMatches(kind, value, evidence) {
  const artifact = object(value);
  const row = object(evidence);
  const observedAt = timestamp(row.observedAt);
  if (observedAt === null) return false;
  const allAt = (values) =>
    values.length > 0 &&
    values.every((value) => timestamp(value) === observedAt);
  switch (kind) {
    case "rights-manifest-record":
      return (
        object(artifact.rightsManifest).evidenceRef === row.id &&
        timestamp(object(artifact.rightsManifest).confirmedAt) === observedAt
      );
    case "sku-mapping-record":
      return (
        object(artifact.skuMappingRegister).evidenceRef === row.id &&
        timestamp(object(artifact.skuMappingRegister).confirmedAt) === observedAt
      );
    case "assignment-export-record":
    case "consumption-export-record": {
      const expectedKind =
        kind === "assignment-export-record"
          ? "assignment-export"
          : "consumption-export";
      const ledger =
        kind === "assignment-export-record" ? "assignments" : "consumption";
      const exports = evidenceBoundRows(artifact, "sourceExports", row).filter(
        (sourceExport) => sourceExport.kind === expectedKind,
      );
      const governedRows = evidenceBoundRows(artifact, ledger, row);
      return (
        exports.length > 0 &&
        exports.every((sourceExport) => {
          const suppliedAt = timestamp(sourceExport.suppliedAt);
          const cutoffAt = timestamp(sourceExport.cutoffAt);
          const rows = governedRows.filter(
            (governedRow) => governedRow.exportRef === sourceExport.id,
          );
          return (
            suppliedAt === observedAt &&
            cutoffAt !== null &&
            cutoffAt < suppliedAt &&
            rows.every((governedRow) => {
              const rowObservedAt = timestamp(governedRow.observedAt);
              return (
                rowObservedAt !== null &&
                (governedRow.periodState === "out-of-period" ||
                  rowObservedAt <= cutoffAt) &&
                rowObservedAt < suppliedAt
              );
            })
          );
        })
      );
    }
    case "authority-roster-record":
      return (
        object(artifact.authorityRoster).evidenceRef === row.id &&
        timestamp(object(artifact.authorityRoster).issuedAt) === observedAt
      );
    case "authority-grant-record": {
      const grants = evidenceBoundRows(artifact, "authorityGrants", row);
      const rosterIssuedAt = timestamp(object(artifact.authorityRoster).issuedAt);
      return (
        rosterIssuedAt !== null &&
        allAt(grants.map((grant) => grant.issuedAt)) &&
        grants.every((grant) => {
          const issuedAt = timestamp(grant.issuedAt);
          const activeFrom = timestamp(grant.activeFrom);
          return (
            issuedAt !== null &&
            activeFrom !== null &&
            rosterIssuedAt <= issuedAt &&
            issuedAt <= activeFrom
          );
        })
      );
    }
    case "position-record":
      return allAt(
        evidenceBoundRows(artifact, "positions", row).map(
          (position) => position.reconciledAt,
        ),
      );
    case "exception-record":
      return allAt(
        evidenceBoundRows(artifact, "exceptions", row).map(
          (exception) => exception.detectedAt,
        ),
      );
    case "decision-record":
      return evidenceBoundRows(artifact, "decisions", row).length > 0;
    case "blocker-record":
      return allAt(
        evidenceBoundRows(artifact, "blockers", row).map(
          (blocker) => blocker.detectedAt,
        ),
      );
    case "destination-approval-record":
      return (
        object(artifact.destinationApproval).evidenceRef === row.id &&
        timestamp(object(artifact.destinationApproval).approvedAt) === observedAt
      );
    case "handoff-record":
      return (
        object(artifact.handoff).evidenceRef === row.id &&
        timestamp(object(artifact.handoff).handedOffAt) === observedAt
      );
    default:
      return false;
  }
}

function setEvidenceSubjects(value) {
  for (const row of records(value.evidence)) {
    row.subjectRefs = expectedEvidenceSubjects(row.kind, value, row);
  }
}

function sourceRowsForExport(value, sourceExport) {
  if (sourceExport.kind === "assignment-export") return records(value.assignments);
  if (sourceExport.kind === "consumption-export") return records(value.consumption);
  return [];
}

export function resealEnterpriseLicenseEntitlement(value) {
  const artifact = value;
  artifact.rightsManifest.rightRefs = ids(artifact.rights);
  artifact.rightsManifest.poolRefs = ids(artifact.pools);
  artifact.skuMappingRegister.mappingRefs = ids(artifact.skuMappings);
  artifact.authorityRoster.principalRefs = ids(artifact.principals);
  setEvidenceSubjects(artifact);
  for (const row of [...records(artifact.assignments), ...records(artifact.consumption)]) {
    row.rowDigest = computeRowDigest(row);
  }
  artifact.rightsManifest.contentDigest = computeRightsManifestDigest(artifact);
  artifact.skuMappingRegister.contentDigest = computeSkuMappingDigest(artifact);
  artifact.authorityRoster.contentDigest = computeAuthorityRosterDigest(artifact);
  for (const grant of records(artifact.authorityGrants)) {
    grant.rosterRef = artifact.authorityRoster.id;
    grant.rosterDigest = artifact.authorityRoster.contentDigest;
    grant.payloadDigest = computeAuthorityGrantDigest(grant);
  }
  for (const sourceExport of records(artifact.sourceExports)) {
    const rows = sourceRowsForExport(artifact, sourceExport);
    sourceExport.rowRefs = ids(rows);
    sourceExport.contentDigest = computeSourceExportDigest(sourceExport, rows);
  }
  const round = artifact.round;
  round.rightsManifestRef = artifact.rightsManifest.id;
  round.rightsManifestVersion = artifact.rightsManifest.version;
  round.rightsManifestDigest = artifact.rightsManifest.contentDigest;
  round.skuMappingRegisterRef = artifact.skuMappingRegister.id;
  round.skuMappingVersion = artifact.skuMappingRegister.version;
  round.skuMappingDigest = artifact.skuMappingRegister.contentDigest;
  round.authorityRosterRef = artifact.authorityRoster.id;
  round.authorityRosterVersion = artifact.authorityRoster.version;
  round.authorityRosterDigest = artifact.authorityRoster.contentDigest;
  round.rightRefs = ids(artifact.rights);
  round.poolRefs = ids(artifact.pools);
  round.skuMappingRefs = ids(artifact.skuMappings);
  round.sourceExportRefs = ids(artifact.sourceExports);
  round.assignmentRefs = ids(artifact.assignments);
  round.consumptionRefs = ids(artifact.consumption);
  round.positionRefs = ids(artifact.positions);
  round.exceptionRefs = ids(artifact.exceptions);
  round.decisionRefs = ids(artifact.decisions);
  round.blockerRefs = ids(artifact.blockers);
  round.evidenceRefs = ids(artifact.evidence);
  round.roundDigest = computeRoundDigest(artifact);
  artifact.coverage.rightRefs = ids(artifact.rights);
  artifact.coverage.poolRefs = ids(artifact.pools);
  artifact.coverage.assignmentRefs = ids(artifact.assignments);
  artifact.coverage.consumptionRefs = ids(artifact.consumption);
  artifact.coverage.positionRefs = ids(artifact.positions);
  artifact.coverage.exceptionRefs = ids(artifact.exceptions);
  artifact.coverage.decisionRefs = ids(artifact.decisions);
  artifact.coverage.blockerRefs = ids(artifact.blockers);
  artifact.coverage.evidenceRefs = ids(artifact.evidence);
  artifact.coverage.contentDigest = computeCoverageDigest(artifact.coverage, artifact);
  artifact.destinationApproval.roundRef = round.id;
  artifact.destinationApproval.roundDigest = round.roundDigest;
  artifact.destinationApproval.coverageDigest = artifact.coverage.contentDigest;
  artifact.destinationApproval.destination = round.destination;
  artifact.destinationApproval.payloadDigest = computeDestinationApprovalDigest(
    artifact.destinationApproval,
  );
  artifact.handoff.roundRef = round.id;
  artifact.handoff.roundDigest = round.roundDigest;
  artifact.handoff.coverageDigest = artifact.coverage.contentDigest;
  artifact.handoff.destinationApprovalRef = artifact.destinationApproval.id;
  artifact.handoff.destinationApprovalDigest = artifact.destinationApproval.payloadDigest;
  artifact.handoff.destination = round.destination;
  artifact.handoff.positionRefs = ids(artifact.positions);
  artifact.handoff.exceptionRefs = ids(artifact.exceptions);
  artifact.handoff.decisionRefs = ids(artifact.decisions);
  artifact.handoff.blockerRefs = ids(artifact.blockers);
  artifact.handoff.state =
    records(artifact.blockers).length === 0 &&
    records(artifact.exceptions).every((row) => row.resolutionState === "reviewed")
      ? "ready-for-owner-review"
      : "blocked";
  artifact.handoff.payloadDigest = computeHandoffDigest(artifact.handoff, artifact);
  for (const row of records(artifact.evidence)) {
    row.roundRef = round.id;
    const payloadDigest = computeEvidencePayloadDigest(row.kind, artifact, row);
    if (payloadDigest !== null) row.payloadDigest = payloadDigest;
    row.recordDigest = computeEvidenceRecordDigest(row);
    row.controlledRef = contentAddressedEvidenceRef(row);
  }
  return artifact;
}

function expectedPositionState(assignmentDelta, consumptionDelta) {
  if (assignmentDelta === 0 && consumptionDelta === 0) return "balanced";
  if (assignmentDelta >= 0 && consumptionDelta >= 0) return "available-rights";
  if (assignmentDelta < 0 && consumptionDelta >= 0) return "assignment-overage";
  if (assignmentDelta >= 0 && consumptionDelta < 0) return "consumption-overage";
  return "combined-overage";
}

function sourceRowInPeriod(row, ledger, round) {
  const observedAt = timestamp(object(row).observedAt);
  const periodStart = timestamp(object(round).periodStartsAt);
  const periodEnd = timestamp(object(round).periodEndsAt);
  const cutoff = timestamp(object(round).cutoffAt);
  if (
    observedAt === null ||
    periodStart === null ||
    periodEnd === null ||
    cutoff === null
  ) {
    return false;
  }
  if (ledger === "assignments") {
    return periodStart <= observedAt && observedAt <= cutoff;
  }
  return (
    object(row).periodStartsAt === object(round).periodStartsAt &&
    object(row).periodEndsAt === object(round).periodEndsAt &&
    periodEnd <= observedAt &&
    observedAt <= cutoff
  );
}

function trustRootMatches(value, trustRoot) {
  const round = object(value.round);
  const root = object(trustRoot);
  const rights = object(root.rightsManifest);
  const mapping = object(root.skuMappingRegister);
  const roster = object(root.authorityRoster);
  const predecessor = object(root.predecessorRound);
  return (
    root.schemaVersion === ENTERPRISE_LICENSE_TRUST_ROOT_SCHEMA_VERSION &&
    root.organizationRef === round.organizationRef &&
    root.agreementRef === round.agreementRef &&
    root.licenseProgramRef === round.licenseProgramRef &&
    predecessor.id === round.predecessorRoundRef &&
    predecessor.digest === round.predecessorRoundDigest &&
    rights.id === round.rightsManifestRef &&
    rights.version === round.rightsManifestVersion &&
    rights.digest === round.rightsManifestDigest &&
    mapping.id === round.skuMappingRegisterRef &&
    mapping.version === round.skuMappingVersion &&
    mapping.digest === round.skuMappingDigest &&
    roster.id === round.authorityRosterRef &&
    roster.version === round.authorityRosterVersion &&
    roster.digest === round.authorityRosterDigest
  );
}

export function enterpriseLicenseEntitlementFindings(value, options = {}) {
  const findings = [];
  const add = (code, path, message) => findings.push({ code, path, message });
  if (!isRecord(value)) {
    return [
      {
        code: "invalid_structure",
        path: "",
        message: "The artifact must be an object.",
      },
    ];
  }
  const artifact = value;
  const round = object(artifact.round);
  const rightsManifest = object(artifact.rightsManifest);
  const mappingRegister = object(artifact.skuMappingRegister);
  const roster = object(artifact.authorityRoster);
  const coverage = object(artifact.coverage);
  const approval = object(artifact.destinationApproval);
  const handoff = object(artifact.handoff);
  const evidence = records(artifact.evidence);
  const evidenceById = mapById(evidence);
  const blockers = records(artifact.blockers);
  const asOf = timestamp(options.asOf);

  if (artifact.schemaVersion !== ENTERPRISE_LICENSE_ENTITLEMENT_SCHEMA_VERSION) {
    add("invalid_schema_version", "schemaVersion", "The schema version is not supported.");
  }
  for (const ledger of LEDGERS) {
    if (!Array.isArray(artifact[ledger])) {
      add("invalid_structure", ledger, `${ledger} must be an array.`);
    }
  }
  if (asOf === null || !isRecord(options.licenseTrustRoot)) {
    add(
      "invalid_validation_context",
      "$context",
      "Caller-supplied asOf and licenseTrustRoot are required; the artifact cannot supply current time or its own public trust root.",
    );
  } else if (!trustRootMatches(artifact, options.licenseTrustRoot)) {
    add(
      "invalid_trust_root",
      "$context.licenseTrustRoot",
      "The public trust-root configuration must exactly match the organization, agreement, program, rights manifest, SKU mapping register, and authority roster.",
    );
  }

  const times = [
    ["round.periodStartsAt", round.periodStartsAt],
    ["round.periodEndsAt", round.periodEndsAt],
    ["round.cutoffAt", round.cutoffAt],
    ["round.opensAt", round.opensAt],
    ["round.closesAt", round.closesAt],
    ["rightsManifest.effectiveFrom", rightsManifest.effectiveFrom],
    ["rightsManifest.effectiveUntil", rightsManifest.effectiveUntil],
    ["rightsManifest.confirmedAt", rightsManifest.confirmedAt],
    ["skuMappingRegister.confirmedAt", mappingRegister.confirmedAt],
    ["authorityRoster.issuedAt", roster.issuedAt],
  ];
  for (const ledger of [
    "rights",
    "sourceExports",
    "assignments",
    "consumption",
    "authorityGrants",
    "positions",
    "exceptions",
    "decisions",
    "blockers",
    "evidence",
  ]) {
    records(artifact[ledger]).forEach((row, index) => {
      for (const field of [
        "effectiveFrom",
        "effectiveUntil",
        "periodStartsAt",
        "periodEndsAt",
        "cutoffAt",
        "suppliedAt",
        "observedAt",
        "activeFrom",
        "activeUntil",
        "issuedAt",
        "reconciledAt",
        "detectedAt",
        "reviewedAt",
      ]) {
        if (Object.hasOwn(row, field)) times.push([`${ledger}[${index}].${field}`, row[field]]);
      }
    });
  }
  times.push(
    ["destinationApproval.approvedAt", approval.approvedAt],
    ["handoff.handedOffAt", handoff.handedOffAt],
  );
  for (const [path, raw] of times) {
    const parsed = timestamp(raw);
    if (parsed === null) {
      add("invalid_timestamp", path, "Timestamps must be valid zone-bearing RFC 3339 values.");
    } else if (
      asOf !== null &&
      parsed > asOf &&
      !/(?:effectiveUntil|activeUntil)$/u.test(path)
    ) {
      add("future_evidence", path, "No artifact timestamp may be later than caller-supplied asOf.");
    }
  }

  const periodStart = timestamp(round.periodStartsAt);
  const periodEnd = timestamp(round.periodEndsAt);
  const cutoff = timestamp(round.cutoffAt);
  const opensAt = timestamp(round.opensAt);
  const closesAt = timestamp(round.closesAt);
  if (
    periodStart === null ||
    periodEnd === null ||
    cutoff === null ||
    opensAt === null ||
    closesAt === null ||
    !(periodStart < periodEnd && periodEnd <= cutoff && cutoff <= opensAt && opensAt <= closesAt) ||
    (asOf !== null && closesAt > asOf) ||
    round.id === round.predecessorRoundRef
  ) {
    add(
      "invalid_round_chronology",
      "round",
      "The fixed period, cutoff, review window, predecessor, and caller-supplied asOf are inconsistent.",
    );
  }

  const globalIds = new Map();
  for (const [path, row] of [
    ["round", round],
    ["rightsManifest", rightsManifest],
    ["skuMappingRegister", mappingRegister],
    ["authorityRoster", roster],
    ["destinationApproval", approval],
    ["handoff", handoff],
    ...LEDGERS.flatMap((ledger) =>
      records(artifact[ledger]).map((row, index) => [`${ledger}[${index}]`, row]),
    ),
  ]) {
    if (typeof row.id !== "string") continue;
    if (globalIds.has(row.id)) {
      add(
        "duplicate_identity",
        `${path}.id`,
        `Identity ${row.id} is already used at ${globalIds.get(row.id)}.`,
      );
    } else {
      globalIds.set(row.id, path);
    }
  }
  if (globalIds.has(round.predecessorRoundRef)) {
    add(
      "invalid_predecessor_lineage",
      "round.predecessorRoundRef",
      "The predecessor round reference must remain outside the current artifact identity space.",
    );
  }

  const indexContracts = [
    ["rightRefs", "rights"],
    ["poolRefs", "pools"],
    ["skuMappingRefs", "skuMappings"],
    ["sourceExportRefs", "sourceExports"],
    ["assignmentRefs", "assignments"],
    ["consumptionRefs", "consumption"],
    ["positionRefs", "positions"],
    ["exceptionRefs", "exceptions"],
    ["decisionRefs", "decisions"],
    ["blockerRefs", "blockers"],
    ["evidenceRefs", "evidence"],
  ];
  for (const [field, ledger] of indexContracts) {
    if (!sameExactSet(round[field], ids(artifact[ledger]))) {
      add("invalid_round_index", `round.${field}`, `The round ${field} must equal ${ledger}.`);
    }
  }
  if (
    round.organizationRef !== rightsManifest.organizationRef ||
    round.organizationRef !== mappingRegister.organizationRef ||
    round.agreementRef !== rightsManifest.agreementRef ||
    round.agreementRef !== mappingRegister.agreementRef ||
    round.licenseProgramRef !== rightsManifest.licenseProgramRef ||
    round.licenseProgramRef !== mappingRegister.licenseProgramRef ||
    round.rightsManifestRef !== rightsManifest.id ||
    round.rightsManifestVersion !== rightsManifest.version ||
    round.rightsManifestDigest !== rightsManifest.contentDigest ||
    round.skuMappingRegisterRef !== mappingRegister.id ||
    round.skuMappingVersion !== mappingRegister.version ||
    round.skuMappingDigest !== mappingRegister.contentDigest ||
    round.authorityRosterRef !== roster.id ||
    round.authorityRosterVersion !== roster.version ||
    round.authorityRosterDigest !== roster.contentDigest
  ) {
    add(
      "invalid_round_binding",
      "round",
      "The round must bind the exact organization, agreement, program, rights, mapping, and roster roots.",
    );
  }
  if (round.roundDigest !== computeRoundDigest(artifact)) {
    add("invalid_round_digest", "round.roundDigest", "The round digest does not recompute.");
  }

  const rights = records(artifact.rights);
  const pools = records(artifact.pools);
  const mappings = records(artifact.skuMappings);
  const rightsById = mapById(rights);
  const poolsById = mapById(pools);
  const mappingsById = mapById(mappings);
  for (const [index, pool] of pools.entries()) {
    if (!rightsById.has(pool.rightRef)) {
      add(
        "invalid_pool_binding",
        `pools[${index}].rightRef`,
        "Every entitlement pool must resolve to exactly one declared purchased right.",
      );
    }
  }
  if (
    !sameExactSet(rightsManifest.rightRefs, ids(rights)) ||
    !sameExactSet(rightsManifest.poolRefs, ids(pools)) ||
    rightsManifest.contentDigest !== computeRightsManifestDigest(artifact)
  ) {
    add(
      "invalid_rights_manifest",
      "rightsManifest",
      "The canonical rights manifest must exactly bind every right and pool.",
    );
  }
  if (
    !sameExactSet(mappingRegister.mappingRefs, ids(mappings)) ||
    mappingRegister.contentDigest !== computeSkuMappingDigest(artifact)
  ) {
    add(
      "invalid_sku_mapping",
      "skuMappingRegister",
      "The owner-supplied SKU mapping register must exactly bind every mapping.",
    );
  }
  if (
    timestamp(rightsManifest.effectiveFrom) === null ||
    timestamp(rightsManifest.effectiveUntil) === null ||
    periodStart === null ||
    periodEnd === null ||
    timestamp(rightsManifest.effectiveFrom) > periodStart ||
    timestamp(rightsManifest.effectiveUntil) < periodEnd
  ) {
    add(
      "invalid_rights_period",
      "rightsManifest",
      "The supplied rights manifest must cover the complete fixed reconciliation period.",
    );
  }
  for (const [index, right] of rights.entries()) {
    const rightPools = pools.filter((pool) => pool.rightRef === right.id);
    const purchased = exactNonNegativeSum(rightPools.map((pool) => pool.entitledUnits));
    const rightEffectiveFrom = timestamp(right.effectiveFrom);
    const rightEffectiveUntil = timestamp(right.effectiveUntil);
    if (
      right.manifestRef !== rightsManifest.id ||
      !sameExactSet(right.poolRefs, ids(rightPools)) ||
      !purchased.valid ||
      purchased.outOfRange ||
      right.purchasedUnits !== purchased.value ||
      right.normalizedUnit !== "license-unit"
    ) {
      add(
        "invalid_right_pool_binding",
        `rights[${index}]`,
        "Each right must equal the exact sum and index of its declared entitlement pools.",
      );
    }
    if (
      rightEffectiveFrom === null ||
      rightEffectiveUntil === null ||
      periodStart === null ||
      periodEnd === null ||
      rightEffectiveFrom > periodStart ||
      rightEffectiveUntil < periodEnd
    ) {
      add(
        "invalid_right_period",
        `rights[${index}]`,
        "Each purchased right must cover the complete fixed reconciliation period.",
      );
    }
  }
  const seenSkus = new Set();
  for (const [index, mapping] of mappings.entries()) {
    const right = rightsById.get(mapping.rightRef);
    if (seenSkus.has(mapping.sourceSku)) {
      add(
        "duplicate_sku_mapping",
        `skuMappings[${index}].sourceSku`,
        "A source SKU may map only once in the canonical register.",
      );
    }
    seenSkus.add(mapping.sourceSku);
    if (
      mapping.mappingRegisterRef !== mappingRegister.id ||
      !right ||
      right.metric !== mapping.metric ||
      right.normalizedUnit !== mapping.normalizedUnit ||
      !sameExactSet(
        mapping.poolRefs,
        strings(mapping.poolRefs).filter((ref) => poolsById.get(ref)?.rightRef === mapping.rightRef),
      ) ||
      strings(mapping.poolRefs).length === 0
    ) {
      add(
        "invalid_sku_mapping",
        `skuMappings[${index}]`,
        "Each mapping must resolve one SKU to an existing right and only that right's pools.",
      );
    }
  }

  const exports = records(artifact.sourceExports);
  const assignments = records(artifact.assignments);
  const consumption = records(artifact.consumption);
  const exportsById = mapById(exports);
  for (const kind of ["assignment-export", "consumption-export"]) {
    if (exports.filter((row) => row.kind === kind).length !== 1) {
      add(
        "invalid_source_export",
        "sourceExports",
        `Exactly one complete ${kind} is required.`,
      );
    }
  }
  for (const [index, sourceExport] of exports.entries()) {
    const rows = sourceRowsForExport(artifact, sourceExport);
    if (
      sourceExport.organizationRef !== round.organizationRef ||
      sourceExport.agreementRef !== round.agreementRef ||
      sourceExport.licenseProgramRef !== round.licenseProgramRef ||
      sourceExport.periodStartsAt !== round.periodStartsAt ||
      sourceExport.periodEndsAt !== round.periodEndsAt ||
      sourceExport.cutoffAt !== round.cutoffAt ||
      !sameExactSet(sourceExport.rowRefs, ids(rows)) ||
      sourceExport.contentDigest !== computeSourceExportDigest(sourceExport, rows)
    ) {
      add(
        "invalid_source_export",
        `sourceExports[${index}]`,
        "Each complete source export must bind the exact scope, period, cutoff, row index, and content digest.",
      );
    }
  }
  for (const [ledger, rows, expectedKind] of [
    ["assignments", assignments, "assignment-export"],
    ["consumption", consumption, "consumption-export"],
  ]) {
    for (const [index, row] of rows.entries()) {
      const mapping = mappingsById.get(row.mappingRef);
      const canonicalMappings = mappings.filter(
        (candidate) => candidate.sourceSku === row.sourceSku,
      );
      const canonicalMapping =
        canonicalMappings.length === 1 ? canonicalMappings[0] : undefined;
      const sourceExport = exportsById.get(row.exportRef);
      const mappingConflict =
        mapping &&
        (mapping.sourceSku !== row.sourceSku ||
          mapping.rightRef !== row.rightRef ||
          !strings(mapping.poolRefs).includes(row.poolRef) ||
          poolsById.get(row.poolRef)?.rightRef !== row.rightRef);
      const mappingValid =
        mapping &&
        canonicalMapping?.id === mapping.id &&
        sourceExport &&
        sourceExport.kind === expectedKind &&
        !mappingConflict;
      const conversion = exactConvertedUnits(
        row.sourceUnits,
        mapping?.conversionNumerator,
        mapping?.conversionDenominator,
      );
      const blockerCount = (code) =>
        blockers.filter(
          (blocker) => blocker.code === code && blocker.targetRef === row.id,
        ).length;
      if (!sourceExport || sourceExport.kind !== expectedKind) {
        add(
          "invalid_mapping_binding",
          `${ledger}[${index}]`,
          "Every source row must belong to the matching complete source export.",
        );
      }
      if (row.mappingState === "mapped") {
        if (!mappingValid) {
          add(
            "invalid_mapping_binding",
            `${ledger}[${index}]`,
            "A mapped row must resolve through exactly one owner-supplied mapping to its declared right and pool.",
          );
        }
        if (conversion.outOfRange) {
          add(
            "unsupported_conversion_range",
            `${ledger}[${index}].normalizedUnits`,
            "The exact converted quantity exceeds the supported safe-integer output range.",
          );
        } else if (!conversion.valid || conversion.value !== row.normalizedUnits) {
          add(
            "invalid_conversion_arithmetic",
            `${ledger}[${index}].normalizedUnits`,
            "Normalized integer units must equal the exact owner-supplied rational conversion.",
          );
        }
      } else if (
        row.mappingState === "unmapped" &&
        (canonicalMappings.length !== 0 ||
          mapping ||
          row.mappingRef !== null ||
          row.rightRef !== null ||
          row.poolRef !== null ||
          row.normalizedUnits !== null ||
          blockerCount("unmapped-sku") !== 1)
      ) {
        add(
          "invalid_mapping_resolution",
          `${ledger}[${index}].mappingState`,
          "An unmapped row must preserve null mapping outputs and exactly one unmapped-sku blocker.",
        );
      } else if (
        row.mappingState === "conflict" &&
        (!mapping ||
          canonicalMapping?.id !== mapping.id ||
          !mappingConflict ||
          row.normalizedUnits !== null ||
          blockerCount("mapping-conflict") !== 1)
      ) {
        add(
          "invalid_mapping_resolution",
          `${ledger}[${index}].mappingState`,
          "A conflicting row must identify the conflicting owner mapping, remain unnormalized, and carry exactly one mapping-conflict blocker.",
        );
      }
      if (row.rowDigest !== computeRowDigest(row)) {
        add(
          "invalid_row_digest",
          `${ledger}[${index}].rowDigest`,
          "The source-row digest does not recompute.",
        );
      }
      const inPeriod = sourceRowInPeriod(row, ledger, round);
      if (
        (row.periodState === "in-period" && !inPeriod) ||
        (row.periodState === "out-of-period" &&
          (inPeriod || blockerCount("out-of-period") !== 1))
      ) {
        add(
          "invalid_source_chronology",
          `${ledger}[${index}].periodState`,
          "Each source row must either bind the fixed period or carry exactly one out-of-period blocker.",
        );
      }
    }
  }

  const principals = records(artifact.principals);
  const principalsById = mapById(principals);
  const rosterCustodian = principalsById.get(roster.custodianRef);
  if (
    !sameExactSet(roster.principalRefs, ids(principals)) ||
    roster.contentDigest !== computeAuthorityRosterDigest(artifact)
  ) {
    add(
      "invalid_authority_roster",
      "authorityRoster",
      "The authority roster must bind every named-human principal and exact scope.",
    );
  }
  if (
    !rosterCustodian ||
    rosterCustodian.kind !== "named-human" ||
    !strings(rosterCustodian.scopes).includes("authority-roster-custodian")
  ) {
    add(
      "invalid_roster_custodian",
      "authorityRoster.custodianRef",
      "The authority roster custodian must be a named human holding the dedicated custodian scope.",
    );
  }
  for (const [index, principal] of principals.entries()) {
    if (
      principal.kind !== "named-human" ||
      typeof principal.humanIdentityRef !== "string" ||
      strings(principal.scopes).length === 0 ||
      strings(principal.scopes).some((scope) => !ROLE_SCOPES.includes(scope))
    ) {
      add(
        "invalid_human_authority",
        `principals[${index}]`,
        "Every authority principal must be a named human with a stable identity reference and closed typed scopes.",
      );
    }
  }
  const grants = records(artifact.authorityGrants);
  const grantsById = mapById(grants);
  for (const [index, grant] of grants.entries()) {
    const grantee = principalsById.get(grant.granteeRef);
    const issuer = principalsById.get(grant.issuedByRef);
    const targetValid =
      (grant.scope === "rights-source-owner" &&
        grant.targetType === "rights-manifest" &&
        grant.targetRef === rightsManifest.id) ||
      (grant.scope === "sku-mapping-source-owner" &&
        grant.targetType === "sku-mapping-register" &&
        grant.targetRef === mappingRegister.id) ||
      (grant.scope === "assignment-source-owner" &&
        grant.targetType === "source-export" &&
        records(artifact.sourceExports).some(
          (row) =>
            row.id === grant.targetRef && row.kind === "assignment-export",
        )) ||
      (grant.scope === "consumption-source-owner" &&
        grant.targetType === "source-export" &&
        records(artifact.sourceExports).some(
          (row) =>
            row.id === grant.targetRef && row.kind === "consumption-export",
        )) ||
      (grant.scope === "position-reconciler" &&
        grant.targetType === "position" &&
        records(artifact.positions).some((row) => row.id === grant.targetRef)) ||
      (grant.scope === "exception-reviewer" &&
        grant.targetType === "exception" &&
        records(artifact.exceptions).some((row) => row.id === grant.targetRef)) ||
      (grant.scope === "destination-approver" &&
        grant.targetType === "destination" &&
        grant.targetRef === round.destination) ||
      (grant.scope === "handoff-owner" &&
        grant.targetType === "destination" &&
        grant.targetRef === round.destination);
    if (
      grant.roundRef !== round.id ||
      grant.rosterRef !== roster.id ||
      grant.rosterDigest !== roster.contentDigest ||
      !grantee ||
      grantee.kind !== "named-human" ||
      !strings(grantee.scopes).includes(grant.scope) ||
      !issuer ||
      !strings(issuer.scopes).includes("authority-grant-issuer") ||
      grant.granteeRef === grant.issuedByRef ||
      !targetValid ||
      timestamp(grant.issuedAt) === null ||
      timestamp(grant.activeFrom) === null ||
      timestamp(grant.activeUntil) === null ||
      timestamp(roster.issuedAt) > timestamp(grant.issuedAt) ||
      timestamp(grant.issuedAt) > timestamp(grant.activeFrom) ||
      timestamp(grant.activeFrom) > timestamp(grant.activeUntil) ||
      grant.payloadDigest !== computeAuthorityGrantDigest(grant)
    ) {
      add(
        "invalid_authority_grant",
        `authorityGrants[${index}]`,
        "Each grant requires a distinct named-human issuer, exact scope and target, current roster, interval, and payload digest.",
      );
    }
  }

  function grantAuthorizes(grant, granteeRef, scope, targetType, targetRef, at) {
    const instant = timestamp(at);
    return (
      isRecord(grant) &&
      grant.granteeRef === granteeRef &&
      grant.scope === scope &&
      grant.targetType === targetType &&
      grant.targetRef === targetRef &&
      grant.roundRef === round.id &&
      grant.rosterRef === roster.id &&
      grant.rosterDigest === roster.contentDigest &&
      timestamp(grant.issuedAt) !== null &&
      timestamp(grant.issuedAt) <= instant &&
      instant !== null &&
      timestamp(grant.activeFrom) !== null &&
      timestamp(grant.activeUntil) !== null &&
      timestamp(grant.activeFrom) <= instant &&
      instant <= timestamp(grant.activeUntil)
    );
  }

  function hasGrant(granteeRef, scope, targetType, targetRef, at) {
    return grants.some(
      (grant) => grantAuthorizes(grant, granteeRef, scope, targetType, targetRef, at),
    );
  }

  const sourceAuthority = [
    [
      rightsManifest.confirmedByRef,
      "rights-source-owner",
      "rights-manifest",
      rightsManifest.id,
      rightsManifest.confirmedAt,
      "rightsManifest.confirmedByRef",
    ],
    [
      mappingRegister.confirmedByRef,
      "sku-mapping-source-owner",
      "sku-mapping-register",
      mappingRegister.id,
      mappingRegister.confirmedAt,
      "skuMappingRegister.confirmedByRef",
    ],
    ...exports.map((sourceExport, index) => [
      sourceExport.suppliedByRef,
      sourceExport.kind === "assignment-export"
        ? "assignment-source-owner"
        : "consumption-source-owner",
      "source-export",
      sourceExport.id,
      sourceExport.suppliedAt,
      `sourceExports[${index}].suppliedByRef`,
    ]),
  ];
  for (const [principalRef, scope, targetType, targetRef, at, path] of sourceAuthority) {
    if (!hasGrant(principalRef, scope, targetType, targetRef, at)) {
      add(
        "invalid_source_authority",
        path,
        "Every rights, mapping, assignment, and consumption source requires exact current-round named-human authority.",
      );
    }
  }
  const protectedRoleRefs = [
    rightsManifest.confirmedByRef,
    mappingRegister.confirmedByRef,
    ...exports.map((row) => row.suppliedByRef),
    roster.custodianRef,
    ...principals
      .filter((row) => strings(row.scopes).includes("authority-grant-issuer"))
      .map((row) => row.id),
    approval.approvedByRef,
    handoff.nextOwnerRef,
  ].filter((ref) => typeof ref === "string");
  const reviewRoleRefs = [
    ...records(artifact.positions).map((row) => row.reconciledByRef),
    ...records(artifact.exceptions).map((row) => row.ownerRef),
    ...records(artifact.decisions).map((row) => row.reviewedByRef),
  ].filter((ref) => typeof ref === "string");
  const humanIdentityFor = (principalRef) =>
    principalsById.get(principalRef)?.humanIdentityRef;
  const protectedRoleIdentities = protectedRoleRefs
    .map(humanIdentityFor)
    .filter((ref) => typeof ref === "string");
  const reviewRoleIdentities = reviewRoleRefs
    .map(humanIdentityFor)
    .filter((ref) => typeof ref === "string");
  const protectedRoleSet = new Set(protectedRoleIdentities);
  if (
    protectedRoleIdentities.length !== protectedRoleRefs.length ||
    reviewRoleIdentities.length !== reviewRoleRefs.length ||
    protectedRoleSet.size !== protectedRoleIdentities.length ||
    reviewRoleIdentities.some((ref) => protectedRoleSet.has(ref))
  ) {
    add(
      "invalid_role_separation",
      "principals",
      "Source owners, roster custodian, grant issuer, destination approver, and handoff owner must have distinct stable human identities from each other and from actual position reconcilers and exception reviewers.",
    );
  }

  const positions = records(artifact.positions);
  const positionsById = mapById(positions);
  const exceptions = records(artifact.exceptions);
  const exceptionsById = mapById(exceptions);
  const decisions = records(artifact.decisions);
  const decisionsById = mapById(decisions);
  const reviewedExceptions = exceptions.filter((row) => row.resolutionState === "reviewed");
  const pendingExceptions = exceptions.filter(
    (row) => row.resolutionState === "pending-human-decision",
  );
  const reconciliationPrerequisites = [
    rightsManifest.confirmedAt,
    mappingRegister.confirmedAt,
    ...exports.map((row) => row.suppliedAt),
    ...exports.map((row) => evidenceById.get(row.evidenceRef)?.observedAt),
  ];
  if (
    positions.length !== pools.length ||
    !sameExactSet(
      positions.map((row) => row.poolRef),
      ids(pools),
    )
  ) {
    add(
      "invalid_position_coverage",
      "positions",
      "Exactly one reconciliation position is required for every entitlement pool.",
    );
  }
  for (const [index, position] of positions.entries()) {
    const pool = poolsById.get(position.poolRef);
    const reconciler = principalsById.get(position.reconciledByRef);
    const reconciliationGrant = grantsById.get(position.authorityGrantRef);
    const poolAssignments = assignments.filter(
      (row) =>
        row.mappingState === "mapped" &&
        row.periodState === "in-period" &&
        row.poolRef === position.poolRef,
    );
    const poolConsumption = consumption.filter(
      (row) =>
        row.mappingState === "mapped" &&
        row.periodState === "in-period" &&
        row.poolRef === position.poolRef,
    );
    const assignedTotal = exactNonNegativeSum(
      poolAssignments.map((row) => row.normalizedUnits),
    );
    const consumedTotal = exactNonNegativeSum(
      poolConsumption.map((row) => row.normalizedUnits),
    );
    const assigned = assignedTotal.value;
    const consumed = consumedTotal.value;
    const entitled = integer(pool?.entitledUnits);
    const assignmentDelta = assigned === null ? null : entitled - assigned;
    const consumptionDelta = consumed === null ? null : entitled - consumed;
    const state =
      assignmentDelta === null || consumptionDelta === null
        ? null
        : expectedPositionState(assignmentDelta, consumptionDelta);
    const positionExceptions = exceptions.filter((row) => row.positionRef === position.id);
    if (
      !pool ||
      !assignedTotal.valid ||
      !consumedTotal.valid ||
      assignedTotal.outOfRange ||
      consumedTotal.outOfRange ||
      position.rightRef !== pool.rightRef ||
      position.entitledUnits !== entitled ||
      position.assignedUnits !== assigned ||
      position.consumedUnits !== consumed ||
      position.assignmentDeltaUnits !== assignmentDelta ||
      position.consumptionDeltaUnits !== consumptionDelta ||
      position.state !== state ||
      !sameExactSet(position.assignmentRefs, ids(poolAssignments)) ||
      !sameExactSet(position.consumptionRefs, ids(poolConsumption)) ||
      !sameExactSet(position.exceptionRefs, ids(positionExceptions)) ||
      (state === "balanced" ? positionExceptions.length !== 0 : positionExceptions.length !== 1)
    ) {
      add(
        "invalid_position_arithmetic",
        `positions[${index}]`,
        "Each position must exactly reconcile pool rights, assignments, consumption, deltas, state, and exception coverage.",
      );
    }
    const reconciledAt = timestamp(position.reconciledAt);
    if (
      !reconciler ||
      reconciler.kind !== "named-human" ||
      !strings(reconciler.scopes).includes("position-reconciler") ||
      !strictlyAfter(position.reconciledAt, reconciliationPrerequisites) ||
      reconciledAt === null ||
      reconciledAt < opensAt ||
      reconciledAt > closesAt
    ) {
      add(
        "invalid_reconciliation_chronology",
        `positions[${index}].reconciledAt`,
        "Each position must be reconciled by its named human after canonical source exports exist and within the review window.",
      );
    }
    if (
      !grantAuthorizes(
        reconciliationGrant,
        position.reconciledByRef,
        "position-reconciler",
        "position",
        position.id,
        position.reconciledAt,
      )
    ) {
      add(
        "invalid_reconciliation_authority",
        `positions[${index}].authorityGrantRef`,
        "Each position must reference an exact current-round grant authorizing its named reconciler for that position at reconciliation time.",
      );
    }
  }
  for (const [index, exception] of exceptions.entries()) {
    const position = positionsById.get(exception.positionRef);
    const linkedDecisions = decisions.filter((row) => row.exceptionRef === exception.id);
    const expectedDecision =
      typeof exception.decisionRef === "string"
        ? decisionsById.get(exception.decisionRef)
        : undefined;
    const owner = principalsById.get(exception.ownerRef);
    const reviewedResolution =
      exception.resolutionState === "reviewed" &&
      expectedDecision?.exceptionRef === exception.id &&
      linkedDecisions.length === 1;
    const pendingResolution =
      exception.resolutionState === "pending-human-decision" &&
      exception.decisionRef === null &&
      linkedDecisions.length === 0;
    if (
      !position ||
      position.state === "balanced" ||
      exception.rightRef !== position.rightRef ||
      exception.poolRef !== position.poolRef ||
      exception.code !== position.state ||
      exception.assignmentDeltaUnits !== position.assignmentDeltaUnits ||
      exception.consumptionDeltaUnits !== position.consumptionDeltaUnits ||
      !owner ||
      owner.kind !== "named-human" ||
      !strings(owner.scopes).includes("exception-reviewer") ||
      timestamp(exception.detectedAt) < timestamp(position.reconciledAt) ||
      (!reviewedResolution && !pendingResolution)
    ) {
      add(
        "invalid_exception_binding",
        `exceptions[${index}]`,
        "Every non-balanced position requires one exact exception resolved by one reciprocal decision or an explicit pending-human-decision state.",
      );
    }
  }
  if (
    decisions.length !== reviewedExceptions.length ||
    !sameExactSet(
      decisions.map((row) => row.exceptionRef),
      ids(reviewedExceptions),
    )
  ) {
    add(
      "invalid_decision_coverage",
      "decisions",
      "Every reviewed exception requires exactly one fresh decision, while pending exceptions require none.",
    );
  }
  for (const [index, decision] of decisions.entries()) {
    const exception = exceptionsById.get(decision.exceptionRef);
    const position = positionsById.get(exception?.positionRef);
    const grant = grantsById.get(decision.authorityGrantRef);
    const decisionAt = timestamp(decision.reviewedAt);
    if (
      !exception ||
      exception.resolutionState !== "reviewed" ||
      exception.decisionRef !== decision.id ||
      decision.roundRef !== round.id ||
      decision.predecessorDecisionRef !== null ||
      decision.reviewedByRef !== exception.ownerRef ||
      !grantAuthorizes(
        grant,
        decision.reviewedByRef,
        "exception-reviewer",
        "exception",
        exception.id,
        decision.reviewedAt,
      ) ||
      decisionAt === null ||
      decisionAt <= timestamp(exception.detectedAt) ||
      decisionAt < opensAt ||
      decisionAt > closesAt
    ) {
      add(
        "invalid_human_decision",
        `decisions[${index}]`,
        "Decisions must be fresh, reciprocal, current-round named-human acts under an exact exception grant; predecessor decisions are lineage only.",
      );
    }
    const decisionEvidence = evidenceById.get(decision.evidenceRef);
    const evidenceAt = timestamp(decisionEvidence?.observedAt);
    const reconciledAt = timestamp(position?.reconciledAt);
    if (
      !decisionEvidence ||
      decisionEvidence.kind !== "decision-record" ||
      decisionEvidence.suppliedByRef !== decision.reviewedByRef ||
      evidenceAt === null ||
      reconciledAt === null ||
      evidenceAt <= reconciledAt ||
      evidenceAt < timestamp(exception?.detectedAt) ||
      decisionAt === null ||
      evidenceAt !== decisionAt
    ) {
      add(
        "invalid_decision_evidence",
        `decisions[${index}].evidenceRef`,
        "Decision evidence must come from the exact authorized reviewer at the decision instant after reconciliation.",
      );
    }
  }

  const evidenceConsumers = [
    ["rightsManifest", rightsManifest],
    ["skuMappingRegister", mappingRegister],
    ["authorityRoster", roster],
    ["destinationApproval", approval],
    ["handoff", handoff],
    ...[
      "rights",
      "pools",
      "skuMappings",
      "sourceExports",
      "assignments",
      "consumption",
      "authorityGrants",
      "positions",
      "exceptions",
      "decisions",
      "blockers",
    ].flatMap((ledger) =>
      records(artifact[ledger]).map((row, index) => [`${ledger}[${index}]`, row]),
    ),
  ];
  for (const [path, consumer] of evidenceConsumers) {
    const evidenceRow = evidenceById.get(consumer.evidenceRef);
    if (!evidenceRow || !strings(evidenceRow.subjectRefs).includes(consumer.id)) {
      add(
        "invalid_evidence_reciprocity",
        `${path}.evidenceRef`,
        "Every governed record must point to evidence that reciprocally names it.",
      );
    }
  }
  const sourceDigests = new Set();
  const controlledRefs = new Set();
  for (const [index, row] of evidence.entries()) {
    const supplier = principalsById.get(row.suppliedByRef);
    const expectedSubjects = expectedEvidenceSubjects(row.kind, artifact, row);
    const expectedProducers = [
      ...new Set(
        expectedEvidenceProducers(row.kind, artifact, row).filter(
          (ref) => typeof ref === "string",
        ),
      ),
    ];
    const payloadDigest = computeEvidencePayloadDigest(row.kind, artifact, row);
    const recordDigest = computeEvidenceRecordDigest(row);
    if (
      row.roundRef !== round.id ||
      !supplier ||
      supplier.kind !== "named-human" ||
      !sameExactSet(row.subjectRefs, expectedSubjects) ||
      payloadDigest === null ||
      row.payloadDigest !== payloadDigest ||
      row.recordDigest !== recordDigest ||
      row.controlledRef !== contentAddressedEvidenceRef(row)
    ) {
      add(
        "invalid_evidence_binding",
        `evidence[${index}]`,
        "Evidence must reciprocally bind its exact semantic payload, named-human supplier, envelope, round, and content-addressed record digest.",
      );
    }
    if (expectedProducers.length !== 1 || row.suppliedByRef !== expectedProducers[0]) {
      add(
        "invalid_evidence_producer",
        `evidence[${index}].suppliedByRef`,
        "Each evidence kind must be supplied by the exact modeled source owner, reviewer, approver, or handoff owner.",
      );
    }
    if (!evidenceChronologyMatches(row.kind, artifact, row)) {
      add(
        "invalid_evidence_chronology",
        `evidence[${index}].observedAt`,
        "Evidence time must bind exactly to its governed export or event and follow the required source chronology.",
      );
    }
    if (sourceDigests.has(row.sourceRecordDigest) || controlledRefs.has(row.controlledRef)) {
      add(
        "duplicate_evidence_identity",
        `evidence[${index}]`,
        "External source digests and controlled evidence references must be unique.",
      );
    }
    sourceDigests.add(row.sourceRecordDigest);
    controlledRefs.add(row.controlledRef);
  }

  const blockerTargetRows = [
    rightsManifest,
    mappingRegister,
    roster,
    ...rights,
    ...pools,
    ...mappings,
    ...exports,
    ...assignments,
    ...consumption,
    ...grants,
    ...positions,
    ...exceptions,
    ...decisions,
  ];
  const blockerTargetsById = mapById(blockerTargetRows);
  for (const [index, blocker] of blockers.entries()) {
    const target = blockerTargetsById.get(blocker.targetRef);
    const owner = principalsById.get(blocker.ownerRef);
    const blockerEvidence = evidenceById.get(blocker.evidenceRef);
    const mapping = mappingsById.get(target?.mappingRef);
    const canonicalMappings = mappings.filter(
      (candidate) => candidate.sourceSku === target?.sourceSku,
    );
    const canonicalMapping =
      canonicalMappings.length === 1 ? canonicalMappings[0] : undefined;
    const targetLedger = assignments.includes(target)
      ? "assignments"
      : consumption.includes(target)
        ? "consumption"
        : null;
    const targetObservedAt =
      target?.reviewedAt ??
      target?.detectedAt ??
      target?.reconciledAt ??
      target?.suppliedAt ??
      target?.observedAt ??
      target?.confirmedAt ??
      target?.issuedAt ??
      target?.activeFrom;
    const hasActualDefect =
      (blocker.code === "missing-evidence" &&
        target &&
        (!evidenceById.has(target.evidenceRef) ||
          !strings(evidenceById.get(target.evidenceRef)?.subjectRefs).includes(target.id))) ||
      (blocker.code === "unmapped-sku" &&
        target &&
        targetLedger !== null &&
        target.mappingState === "unmapped" &&
        canonicalMappings.length === 0 &&
        !mapping &&
        target.mappingRef === null &&
        target.rightRef === null &&
        target.poolRef === null &&
        target.normalizedUnits === null) ||
      (blocker.code === "mapping-conflict" &&
        target &&
        targetLedger !== null &&
        target.mappingState === "conflict" &&
        mapping &&
        canonicalMapping?.id === mapping.id &&
        target.normalizedUnits === null &&
        (mapping.sourceSku !== target.sourceSku ||
          mapping.rightRef !== target.rightRef ||
          !strings(mapping.poolRefs).includes(target.poolRef))) ||
      (blocker.code === "out-of-period" &&
        target &&
        targetLedger !== null &&
        target.periodState === "out-of-period" &&
        !sourceRowInPeriod(target, targetLedger, round)) ||
      (blocker.code === "authority-missing" &&
        target &&
        exceptions.includes(target) &&
        target.resolutionState === "pending-human-decision" &&
        !hasGrant(
          target.ownerRef,
          "exception-reviewer",
          "exception",
          target.id,
          blocker.detectedAt,
        ));
    if (
      !target ||
      !owner ||
      owner.kind !== "named-human" ||
      !strings(owner.scopes).includes("exception-reviewer") ||
      !blockerEvidence ||
      blockerEvidence.kind !== "blocker-record" ||
      blockerEvidence.suppliedByRef !== blocker.ownerRef ||
      timestamp(blockerEvidence.observedAt) !== timestamp(blocker.detectedAt) ||
      timestamp(blocker.detectedAt) === null ||
      timestamp(blocker.detectedAt) < opensAt ||
      timestamp(blocker.detectedAt) > closesAt ||
      (targetObservedAt !== undefined &&
        !strictlyAfter(blocker.detectedAt, [targetObservedAt])) ||
      !hasActualDefect
    ) {
      add(
        "invalid_blocker",
        `blockers[${index}]`,
        "A blocker requires an existing affected target, scoped named-human owner, reciprocal same-time evidence, valid review-window chronology, and a corresponding unresolved defect.",
      );
    }
  }

  const coverageContracts = [
    ["rightRefs", "rights"],
    ["poolRefs", "pools"],
    ["assignmentRefs", "assignments"],
    ["consumptionRefs", "consumption"],
    ["positionRefs", "positions"],
    ["exceptionRefs", "exceptions"],
    ["decisionRefs", "decisions"],
    ["blockerRefs", "blockers"],
    ["evidenceRefs", "evidence"],
  ];
  if (
    coverageContracts.some(([field, ledger]) => !sameExactSet(coverage[field], ids(artifact[ledger]))) ||
    coverage.contentDigest !== computeCoverageDigest(coverage, artifact)
  ) {
    add(
      "invalid_coverage",
      "coverage",
      "Coverage must equal every right, pool, assignment, consumption, position, exception, decision, blocker, and evidence row exactly once.",
    );
  }

  if (
    approval.roundRef !== round.id ||
    approval.roundDigest !== round.roundDigest ||
    approval.coverageDigest !== coverage.contentDigest ||
    approval.coverageDigest !== computeCoverageDigest(coverage, artifact) ||
    approval.destination !== round.destination ||
    approval.payloadDigest !== computeDestinationApprovalDigest(approval) ||
    !grantAuthorizes(
      grantsById.get(approval.authorityGrantRef),
      approval.approvedByRef,
      "destination-approver",
      "destination",
      round.destination,
      approval.approvedAt,
    )
  ) {
    add(
      "invalid_destination_approval",
      "destinationApproval",
      "The destination requires a payload-bound approval from a named human with exact current-round authority.",
    );
  }

  const approvalEvidence = evidenceById.get(approval.evidenceRef);
  const approvalPrerequisites = [
    ...positions.map((row) => row.reconciledAt),
    ...exceptions.map((row) => row.detectedAt),
    ...decisions.map((row) => row.reviewedAt),
    ...records(artifact.blockers).map((row) => row.detectedAt),
    ...evidence
      .filter(
        (row) =>
          row.kind !== "destination-approval-record" &&
          row.kind !== "handoff-record",
      )
      .map((row) => row.observedAt),
  ];
  if (
    !strictlyAfter(approval.approvedAt, approvalPrerequisites) ||
    timestamp(approval.approvedAt) < opensAt ||
    timestamp(approval.approvedAt) > closesAt ||
    !approvalEvidence ||
    approvalEvidence.kind !== "destination-approval-record" ||
    approvalEvidence.suppliedByRef !== approval.approvedByRef ||
    timestamp(approvalEvidence.observedAt) !== timestamp(approval.approvedAt)
  ) {
    add(
      "invalid_approval_chronology",
      "destinationApproval.approvedAt",
      "Destination approval must be produced by its exact approver strictly after reconciliation and every consumed decision and prerequisite evidence record.",
    );
  }

  const handoffEvidence = evidenceById.get(handoff.evidenceRef);
  const handoffPrerequisites = [
    approval.approvedAt,
    ...positions.map((row) => row.reconciledAt),
    ...exceptions.map((row) => row.detectedAt),
    ...decisions.map((row) => row.reviewedAt),
    ...blockers.map((row) => row.detectedAt),
    ...evidence
      .filter((row) => row.kind !== "handoff-record")
      .map((row) => row.observedAt),
  ];
  if (
    !strictlyAfter(handoff.handedOffAt, handoffPrerequisites) ||
    timestamp(handoff.handedOffAt) < opensAt ||
    timestamp(handoff.handedOffAt) > closesAt ||
    !handoffEvidence ||
    handoffEvidence.kind !== "handoff-record" ||
    handoffEvidence.suppliedByRef !== handoff.nextOwnerRef ||
    timestamp(handoffEvidence.observedAt) !== timestamp(handoff.handedOffAt)
  ) {
    add(
      "invalid_handoff_chronology",
      "handoff.handedOffAt",
      "Handoff must be produced by its exact owner strictly after approval and every consumed reconciliation, decision, blocker, and evidence record.",
    );
  }

  const findingsBeforeHandoff = findings.length;
  const shouldBlock =
    blockers.length > 0 || pendingExceptions.length > 0 || findingsBeforeHandoff > 0;
  if (
    handoff.roundRef !== round.id ||
    handoff.roundDigest !== round.roundDigest ||
    handoff.coverageDigest !== coverage.contentDigest ||
    handoff.coverageDigest !== computeCoverageDigest(coverage, artifact) ||
    handoff.destinationApprovalRef !== approval.id ||
    handoff.destinationApprovalDigest !== approval.payloadDigest ||
    handoff.destination !== round.destination ||
    handoff.state !== (shouldBlock ? "blocked" : "ready-for-owner-review") ||
    !grantAuthorizes(
      grantsById.get(handoff.authorityGrantRef),
      handoff.nextOwnerRef,
      "handoff-owner",
      "destination",
      round.destination,
      handoff.handedOffAt,
    ) ||
    !sameExactSet(handoff.positionRefs, ids(positions)) ||
    !sameExactSet(handoff.exceptionRefs, ids(exceptions)) ||
    !sameExactSet(handoff.decisionRefs, ids(decisions)) ||
    !sameExactSet(handoff.blockerRefs, ids(blockers)) ||
    Object.entries(HANDOFF_DISCLAIMERS).some(([field, expected]) => handoff[field] !== expected) ||
    handoff.payloadDigest !== computeHandoffDigest(handoff, artifact)
  ) {
    add(
      "invalid_handoff",
      "handoff",
      "The handoff must preserve exact coverage, destination, blockers, human authority, structural non-actions, and deterministic payload binding.",
    );
  }

  return findings.sort(
    (left, right) =>
      compareUtf16CodeUnits(left.code, right.code) ||
      compareUtf16CodeUnits(left.path, right.path) ||
      compareUtf16CodeUnits(left.message, right.message),
  );
}
