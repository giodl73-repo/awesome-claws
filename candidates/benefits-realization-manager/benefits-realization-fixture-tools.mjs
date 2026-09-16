import {
  computeInternalEvidenceDigest,
  computeInternalRecordDigest,
} from "./benefits-realization-slice.mjs";

function subjectEntries(value) {
  return [
    ...value.kpis.map((record) => ["kpi", record]),
    ...value.benefits.map((record) => ["benefit", record]),
    ...value.allocationRules.map((record) => ["allocation-rule", record]),
    ...value.attributions.map((record) => ["attribution", record]),
    ["finance-review", value.financeReview],
  ];
}

export function resealInternalFixture(input) {
  const value = structuredClone(input);
  for (const [, record] of subjectEntries(value)) {
    record.recordDigest = computeInternalRecordDigest(record);
  }
  const subjects = new Map(
    subjectEntries(value).map(([subjectType, record]) => [
      `${subjectType}:${record.id}`,
      record,
    ]),
  );
  for (const evidence of value.evidence) {
    evidence.subjectRecordDigest =
      subjects.get(`${evidence.subjectType}:${evidence.subjectRef}`)
        ?.recordDigest ?? `sha256:${"0".repeat(64)}`;
    evidence.bindingDigest = computeInternalEvidenceDigest(evidence);
  }
  return value;
}

export function buildSourceAuthorityRecords(value) {
  return value.evidence.map((evidence) => ({
    evidenceRef: evidence.id,
    subjectType: evidence.subjectType,
    subjectRef: evidence.subjectRef,
    subjectRecordDigest: evidence.subjectRecordDigest,
    sourceRef: evidence.sourceRef,
    sourceVersion: evidence.sourceVersion,
    sourceContentDigest: evidence.sourceContentDigest,
    suppliedByRef: evidence.suppliedByRef,
  }));
}
