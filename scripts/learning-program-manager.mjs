import { createHash } from "node:crypto";

export const LEARNING_PROGRAM_SCHEMA_VERSION =
  "awesomeClaws.learningProgramRelease.v1";

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const PRIVACY_RANK = Object.freeze({
  internal: 0,
  confidential: 1,
  restricted: 2,
});
const PROHIBITED_KEYS = new Set([
  "name",
  "email",
  "sensitiveTraits",
  "performanceScore",
  "score",
  "grade",
  "rank",
  "aptitude",
  "compensation",
  "promotionDecision",
  "credentialStatus",
  "hrRecordId",
]);
const AUTHORITY_FIELDS = [
  "individualPerformanceInference",
  "sensitiveTraitInference",
  "mandatoryAssignment",
  "hrRecordMutation",
  "credentialAwardOrRevocation",
  "promotionOrCompensationDecision",
  "externalContact",
  "effectivenessBeyondEvidence",
];
const COLLECTIONS = Object.freeze({
  curriculumReleaseRefs: "curriculumReleases",
  cohortRefs: "cohorts",
  assignmentRefs: "assignments",
  assignmentReceiptRefs: "assignmentReceipts",
  deliveryCheckRefs: "deliveryChecks",
  completionRecordRefs: "completionRecords",
  assessmentRecordRefs: "assessmentRecords",
  effectivenessMeasureRefs: "effectivenessMeasures",
  refreshReviewRefs: "refreshReviews",
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function finding(code, path, message) {
  return { code, path, message };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeLearningProgramArtifactDigest(value) {
  const copy = structuredClone(value);
  if (isRecord(copy?.handoff)) delete copy.handoff.artifactDigest;
  return `sha256:${createHash("sha256").update(canonicalJson(copy)).digest("hex")}`;
}

export function resealLearningProgramArtifact(value) {
  const copy = structuredClone(value);
  if (isRecord(copy?.handoff)) {
    copy.handoff.artifactDigest = computeLearningProgramArtifactDigest(copy);
  }
  return copy;
}

function exactTimestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOrdered(before, after) {
  const beforeTime = exactTimestamp(before);
  const afterTime = exactTimestamp(after);
  return beforeTime !== null && afterTime !== null && beforeTime <= afterTime;
}

function isBefore(before, after) {
  const beforeTime = exactTimestamp(before);
  const afterTime = exactTimestamp(after);
  return beforeTime !== null && afterTime !== null && beforeTime < afterTime;
}

function maxPrivacyClass(rows) {
  let maximum = -1;
  for (const row of rows) {
    const rank = PRIVACY_RANK[row?.privacyClass];
    if (rank !== undefined) maximum = Math.max(maximum, rank);
  }
  return Object.keys(PRIVACY_RANK).find(
    (privacyClass) => PRIVACY_RANK[privacyClass] === maximum,
  );
}

function releaseVersionParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version ?? "");
  return match ? match.slice(1).map(Number) : null;
}

function compareReleaseVersions(left, right) {
  const leftParts = releaseVersionParts(left);
  const rightParts = releaseVersionParts(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function uniqueIds(rows, path, findings, globalIds) {
  const local = new Set();
  for (const [index, row] of array(rows).entries()) {
    if (!isRecord(row) || typeof row.id !== "string") continue;
    if (local.has(row.id) || globalIds.has(row.id)) {
      findings.push(
        finding("duplicate_identity", `${path}/${index}/id`, `Duplicate id ${row.id}.`),
      );
    }
    local.add(row.id);
    globalIds.add(row.id);
  }
}

function sameSet(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

function indexById(rows) {
  return new Map(
    array(rows)
      .filter((row) => isRecord(row) && typeof row.id === "string")
      .map((row) => [row.id, row]),
  );
}

function requireReference(index, ref, path, code, findings) {
  const target = index.get(ref);
  if (!target) {
    findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
  }
  return target;
}

function requireReleaseTime(release, eventAt, path, findings) {
  if (!isBefore(release?.releasedAt, eventAt)) {
    findings.push(
      finding(
        "invalid_release_chronology",
        path,
        "Bound release time must strictly precede the lifecycle event.",
      ),
    );
  }
}

function collectProhibitedKeys(value, path, findings, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${key}`;
    if (PROHIBITED_KEYS.has(key)) {
      findings.push(
        finding(
          "prohibited_contract_field",
          childPath,
          `${key} could enable an individual or employment inference.`,
        ),
      );
    }
    collectProhibitedKeys(child, childPath, findings, seen);
  }
}

function collectTimestamps(value, path, asOf, findings, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${key}`;
    if (
      typeof child === "string" &&
      (key.endsWith("At") ||
        key === "asOf")
    ) {
      const parsed = exactTimestamp(child);
      if (parsed === null) {
        findings.push(
          finding("invalid_chronology", childPath, "Timestamp must be exact RFC 3339 with a zone."),
        );
      } else if (asOf !== null && parsed > asOf) {
        findings.push(finding("future_event", childPath, "Event occurs after trusted asOf."));
      }
    }
    collectTimestamps(child, childPath, asOf, findings, seen);
  }
}

function recordEvidence(
  evidence,
  ref,
  subjectRef,
  eventAt,
  expectedKind,
  path,
  findings,
) {
  const record = requireReference(
    evidence,
    ref,
    `${path}/evidenceRef`,
    "missing_evidence",
    findings,
  );
  if (!record) return;
  if (record.kind !== expectedKind) {
    findings.push(
      finding(
        "invalid_evidence_kind",
        `${path}/evidenceRef`,
        `Evidence ${ref} must use kind ${expectedKind}.`,
      ),
    );
  }
  if (!array(record.subjectRefs).includes(subjectRef)) {
    findings.push(
      finding(
        "invalid_evidence_subject",
        `${path}/evidenceRef`,
        `Evidence ${ref} does not bind ${subjectRef}.`,
      ),
    );
  }
  const observedAt = exactTimestamp(record.observedAt);
  const eventTime = exactTimestamp(eventAt);
  if (observedAt !== null && eventTime !== null && observedAt < eventTime) {
    findings.push(
      finding(
        "invalid_evidence_chronology",
        `${path}/evidenceRef`,
        `Evidence ${ref} predates the event it supports.`,
      ),
    );
  }
}

function expectedBlockers(value) {
  const blockers = [];
  const receipts = indexById(value.assignmentReceipts);
  const cohorts = indexById(value.cohorts);
  const assignments = indexById(value.assignments);
  const completions = indexById(value.completionRecords);
  const completionsByAssignment = new Map(
    array(value.completionRecords)
      .filter((row) => isRecord(row) && row.state === "verified")
      .map((row) => [row.assignmentRef, row]),
  );
  const reviewsByRelease = new Map(
    array(value.refreshReviews)
      .filter(isRecord)
      .map((row) => [row.releaseRef, row]),
  );
  function add(category, subject, ownerRef, openedAt) {
    blockers.push({
      id: `blocker-${category}-${subject}`,
      category,
      subject,
      ownerRef,
      openedAt,
    });
  }
  for (const row of array(value.deliveryChecks)) {
    if (!isRecord(row)) continue;
    if (row.state !== "ready") {
      add("delivery-not-ready", row.id, row.ownerRef, row.observedAt);
    }
  }
  for (const row of array(value.assignments)) {
    if (!isRecord(row)) continue;
    const cohort = cohorts.get(row.cohortRef);
    if (!receipts.has(row.receiptRef)) {
      add(
        "missing-assignment-receipt",
        row.id,
        cohort?.ownerRef,
        value.program?.asOf,
      );
    }
    if (row.state === "accepted" && !completionsByAssignment.has(row.id)) {
      add(
        "accepted-assignment-incomplete",
        row.id,
        cohort?.ownerRef,
        value.program?.asOf,
      );
    }
  }
  for (const row of array(value.assessmentRecords)) {
    if (!isRecord(row)) continue;
    if (row.state === "invalid") {
      const completion = completions.get(row.completionRef);
      const assignment = assignments.get(completion?.assignmentRef);
      add(
        "invalid-assessment",
        row.id,
        cohorts.get(assignment?.cohortRef)?.ownerRef,
        row.assessedAt,
      );
    }
  }
  for (const row of array(value.effectivenessMeasures)) {
    if (!isRecord(row)) continue;
    const ownerRef = cohorts.get(row.cohortRef)?.ownerRef;
    if (row.denominator < row.minimumGroupSize) {
      add("insufficient-aggregate", row.id, ownerRef, row.observedAt);
    } else {
      const supports = row.observedRate >= row.targetRate;
      if (
        (row.conclusion === "supports-target" && !supports) ||
        (row.conclusion === "does-not-support-target" && supports) ||
        row.conclusion === "no-conclusion"
      ) {
        add(
          "unsupported-effectiveness-conclusion",
          row.id,
          ownerRef,
          row.observedAt,
        );
      }
    }
  }
  for (const release of array(value.curriculumReleases)) {
    if (!isRecord(release)) continue;
    const measures = array(value.effectivenessMeasures).filter(
      (row) => row.releaseRef === release.id,
    );
    if (measures.length > 0 && !reviewsByRelease.has(release.id)) {
      add(
        "missing-refresh-review",
        release.id,
        release.ownerRef,
        value.program?.asOf,
      );
    }
  }
  return blockers;
}

export function learningProgramFindings(value, options = {}) {
  const findings = [];
  const trustedAsOf = exactTimestamp(options?.asOf);
  if (trustedAsOf === null) {
    findings.push(
      finding(
        "invalid_validation_context",
        "/",
        "A caller-supplied exact RFC 3339 asOf is required.",
      ),
    );
  }
  if (!isRecord(value)) {
    return [
      ...findings,
      finding("invalid_artifact_shape", "/", "Artifact must be an object."),
    ];
  }
  if (value.schemaVersion !== LEARNING_PROGRAM_SCHEMA_VERSION) {
    findings.push(
      finding("invalid_artifact_shape", "/schemaVersion", "Unexpected schema version."),
    );
  }

  collectProhibitedKeys(value, "", findings);
  collectTimestamps(value, "", trustedAsOf, findings);

  const globalIds = new Set();
  if (typeof value.artifactId === "string") globalIds.add(value.artifactId);
  for (const id of [
    value.program?.id,
    value.skillTaxonomy?.id,
    value.gapRevision?.id,
  ]) {
    if (typeof id === "string") globalIds.add(id);
  }
  for (const [path, rows] of [
    ["/curriculumReleases", value.curriculumReleases],
    ["/cohorts", value.cohorts],
    ["/assignments", value.assignments],
    ["/assignmentReceipts", value.assignmentReceipts],
    ["/deliveryChecks", value.deliveryChecks],
    ["/completionRecords", value.completionRecords],
    ["/assessmentRecords", value.assessmentRecords],
    ["/effectivenessMeasures", value.effectivenessMeasures],
    ["/refreshReviews", value.refreshReviews],
    ["/principals", value.principals],
    ["/evidence", value.evidence],
    ["/blockers", value.blockers],
  ]) {
    uniqueIds(rows, path, findings, globalIds);
  }
  for (const [index, cohort] of array(value.cohorts).entries()) {
    const rosterId = cohort?.rosterRevision?.id;
    if (typeof rosterId !== "string") continue;
    if (globalIds.has(rosterId)) {
      findings.push(
        finding(
          "duplicate_identity",
          `/cohorts/${index}/rosterRevision/id`,
          `Duplicate id ${rosterId}.`,
        ),
      );
    }
    globalIds.add(rosterId);
  }

  const program = isRecord(value.program) ? value.program : {};
  const taxonomy = isRecord(value.skillTaxonomy) ? value.skillTaxonomy : {};
  const gap = isRecord(value.gapRevision) ? value.gapRevision : {};
  const releases = indexById(value.curriculumReleases);
  const cohorts = indexById(value.cohorts);
  const assignments = indexById(value.assignments);
  const receipts = indexById(value.assignmentReceipts);
  const completions = indexById(value.completionRecords);
  const measures = indexById(value.effectivenessMeasures);
  const reviews = indexById(value.refreshReviews);
  const principals = indexById(value.principals);
  const evidence = indexById(value.evidence);

  if (program.asOf !== options?.asOf) {
    findings.push(
      finding(
        "invalid_validation_context",
        "/program/asOf",
        "Artifact asOf must equal caller-supplied trusted asOf.",
      ),
    );
  }
  if (
    exactTimestamp(program.reviewWindowStart) >
    exactTimestamp(program.reviewWindowEnd)
  ) {
    findings.push(
      finding(
        "invalid_program_chronology",
        "/program/reviewWindowEnd",
        "Review window end precedes start.",
      ),
    );
  }
  requireReference(
    principals,
    program.ownerRef,
    "/program/ownerRef",
    "invalid_owner",
    findings,
  );
  if (
    program.skillTaxonomyRef !== taxonomy.id ||
    gap.taxonomyRef !== taxonomy.id ||
    gap.taxonomyVersion !== taxonomy.version
  ) {
    findings.push(
      finding(
        "invalid_taxonomy_binding",
        "/gapRevision",
        "Program and approved gap must bind the exact taxonomy id and version.",
      ),
    );
  }
  if (
    program.gapRevisionRef !== gap.id ||
    gap.status !== "approved" ||
    gap.aggregateOnly !== true
  ) {
    findings.push(
      finding(
        "invalid_gap_binding",
        "/gapRevision",
        "Program must bind one approved aggregate-only gap revision.",
      ),
    );
  }
  const taxonomySkills = array(taxonomy.skillRefs);
  const gapSkills = array(gap.skillGapRefs);
  if (
    new Set(gapSkills).size !== gapSkills.length ||
    !gapSkills.every((skillRef) => taxonomySkills.includes(skillRef))
  ) {
    findings.push(
      finding(
        "invalid_gap_skill_coverage",
        "/gapRevision/skillGapRefs",
        "Every unique approved gap skill must exist in the bound taxonomy.",
      ),
    );
  }
  if (!isOrdered(taxonomy.effectiveAt, gap.approvedAt)) {
    findings.push(
      finding(
        "invalid_program_chronology",
        "/gapRevision/approvedAt",
        "Taxonomy effective time must not follow gap approval.",
      ),
    );
  }
  if (
    !releases.has(program.curriculumReleaseRef) ||
    releases.get(program.curriculumReleaseRef)?.state !== "current"
  ) {
    findings.push(
      finding(
        "invalid_curriculum_binding",
        "/program/curriculumReleaseRef",
        "Program release reference must resolve to a current release.",
      ),
    );
  }
  recordEvidence(
    evidence,
    taxonomy.evidenceRef,
    taxonomy.id,
    taxonomy.effectiveAt,
    "taxonomy-export",
    "/skillTaxonomy",
    findings,
  );
  recordEvidence(
    evidence,
    gap.evidenceRef,
    gap.id,
    gap.approvedAt,
    "gap-export",
    "/gapRevision",
    findings,
  );
  requireReference(
    principals,
    gap.approvedByRef,
    "/gapRevision/approvedByRef",
    "invalid_owner",
    findings,
  );

  for (const [index, release] of array(value.curriculumReleases).entries()) {
    if (!isRecord(release)) continue;
    const path = `/curriculumReleases/${index}`;
    if (
      release.gapRevisionRef !== gap.id ||
      release.gapRevisionVersion !== gap.version ||
      release.taxonomyRef !== taxonomy.id ||
      release.taxonomyVersion !== taxonomy.version ||
      !array(release.skillRefs).every((ref) => array(gap.skillGapRefs).includes(ref))
    ) {
      findings.push(
        finding(
          "invalid_curriculum_binding",
          path,
          "Curriculum release does not bind the exact approved gap and taxonomy.",
        ),
      );
    }
    if (
      release.state !== "planned" &&
      (!isOrdered(gap.approvedAt, release.releasedAt) ||
        !isOrdered(taxonomy.effectiveAt, release.releasedAt))
    ) {
      findings.push(
        finding(
          "invalid_program_chronology",
          `${path}/releasedAt`,
          "Curriculum release must follow taxonomy effectiveness and gap approval.",
        ),
      );
    }
    if (
      !releaseVersionParts(release.version) ||
      (release.state === "planned" &&
        (release.releasedAt !== null || release.retiredAt !== null)) ||
      (["current", "historical"].includes(release.state) &&
        (typeof release.releasedAt !== "string" || release.retiredAt !== null)) ||
      (release.state === "retired" &&
        (typeof release.releasedAt !== "string" ||
          typeof release.retiredAt !== "string" ||
          !isOrdered(release.releasedAt, release.retiredAt)))
    ) {
      findings.push(
        finding(
          "invalid_release_lifecycle",
          path,
          "Release version and planned, current, historical, or retired timestamps must be coherent.",
        ),
      );
    }
    requireReference(
      principals,
      release.ownerRef,
      `${path}/ownerRef`,
      "invalid_owner",
      findings,
    );
    recordEvidence(
      evidence,
      release.evidenceRef,
      release.id,
      release.releasedAt ?? evidence.get(release.evidenceRef)?.observedAt,
      "curriculum-release-record",
      path,
      findings,
    );
  }
  const currentReleases = array(value.curriculumReleases).filter(
    (release) => release?.state === "current",
  );
  const coveredSkills = currentReleases.flatMap((release) =>
    array(release?.skillRefs),
  );
  if (
    currentReleases.length === 0 ||
    coveredSkills.length !== gapSkills.length ||
    new Set(coveredSkills).size !== coveredSkills.length ||
    !sameSet(coveredSkills, gapSkills)
  ) {
    findings.push(
      finding(
        "invalid_curriculum_skill_coverage",
        "/curriculumReleases",
        "Current curriculum releases must cover every approved gap skill exactly once with no extras.",
      ),
    );
  }
  const releasesByCurriculum = new Map();
  for (const release of array(value.curriculumReleases)) {
    if (!isRecord(release)) continue;
    const rows = releasesByCurriculum.get(release.curriculumId) ?? [];
    rows.push(release);
    releasesByCurriculum.set(release.curriculumId, rows);
  }
  for (const rows of releasesByCurriculum.values()) {
    if (rows.filter((release) => release.state === "current").length > 1) {
      findings.push(
        finding(
          "invalid_release_lifecycle",
          "/curriculumReleases",
          "A curriculum may have only one current release.",
        ),
      );
    }
    const sorted = [...rows].sort((left, right) =>
      compareReleaseVersions(left.version, right.version) ?? 0,
    );
    const versions = new Set();
    for (const [index, release] of sorted.entries()) {
      if (versions.has(release.version)) {
        findings.push(
          finding(
            "invalid_release_lifecycle",
            "/curriculumReleases",
            "Curriculum release versions must be unique.",
          ),
        );
      }
      versions.add(release.version);
      const predecessor =
        release.predecessorReleaseRef === null
          ? null
          : releases.get(release.predecessorReleaseRef);
      const expectedPredecessor = index === 0 ? null : sorted[index - 1];
      const releaseEventAt =
        release.releasedAt ?? evidence.get(release.evidenceRef)?.observedAt;
      const predecessorEventAt =
        predecessor?.releasedAt ??
        evidence.get(predecessor?.evidenceRef)?.observedAt;
      if (
        (release.state === "planned" && predecessor === null) ||
        (index === 0 && release.predecessorReleaseRef !== null) ||
        (index > 0 &&
          (predecessor?.id !== expectedPredecessor?.id ||
            predecessor?.curriculumId !== release.curriculumId ||
          predecessor?.state === "planned" ||
          compareReleaseVersions(predecessor?.version, release.version) >= 0 ||
            !isOrdered(predecessorEventAt, releaseEventAt)))
      ) {
        findings.push(
          finding(
            "invalid_release_lineage",
            "/curriculumReleases",
            "Release predecessor must be the immediately prior non-planned version with ordered lifecycle chronology.",
          ),
        );
      }
    }
  }

  for (const [index, cohort] of array(value.cohorts).entries()) {
    if (!isRecord(cohort)) continue;
    const path = `/cohorts/${index}`;
    requireReference(
      releases,
      cohort.curriculumReleaseRef,
      `${path}/curriculumReleaseRef`,
      "invalid_cohort_binding",
      findings,
    );
    requireReference(
      principals,
      cohort.ownerRef,
      `${path}/ownerRef`,
      "invalid_owner",
      findings,
    );
    const roster = isRecord(cohort.rosterRevision) ? cohort.rosterRevision : {};
    recordEvidence(
      evidence,
      roster.evidenceRef,
      roster.id,
      roster.effectiveAt,
      "roster-export",
      `${path}/rosterRevision`,
      findings,
    );
  }

  for (const [index, assignment] of array(value.assignments).entries()) {
    if (!isRecord(assignment)) continue;
    const path = `/assignments/${index}`;
    const cohort = requireReference(
      cohorts,
      assignment.cohortRef,
      `${path}/cohortRef`,
      "invalid_assignment_binding",
      findings,
    );
    const roster = cohort?.rosterRevision;
    const release = releases.get(cohort?.curriculumReleaseRef);
    requireReleaseTime(release, assignment.assignedAt, `${path}/assignedAt`, findings);
    if (
      assignment.mandatory !== false ||
      assignment.rosterRevisionRef !== roster?.id ||
      assignment.rosterRevisionVersion !== roster?.version ||
      !isOrdered(roster?.effectiveAt, assignment.assignedAt) ||
      !isBefore(release?.releasedAt, assignment.assignedAt)
    ) {
      findings.push(
        finding(
          "invalid_assignment_binding",
          path,
          "Assignment must be voluntary and bind the exact cohort roster revision.",
        ),
      );
    }
    const receipt = requireReference(
      receipts,
      assignment.receiptRef,
      `${path}/receiptRef`,
      "invalid_assignment_receipt",
      findings,
    );
    if (
      receipt &&
      (receipt.assignmentRef !== assignment.id ||
        assignment.receiptRef !== receipt.id ||
        receipt.learnerRef !== assignment.learnerRef ||
        receipt.state !== assignment.state ||
        !isOrdered(roster?.effectiveAt, receipt.recordedAt) ||
        !isOrdered(assignment.assignedAt, receipt.recordedAt))
    ) {
      findings.push(
        finding(
          "invalid_assignment_receipt",
          `${path}/receiptRef`,
          "Receipt identity, state, or chronology does not match assignment.",
        ),
      );
    }
    recordEvidence(
      evidence,
      assignment.evidenceRef,
      assignment.id,
      assignment.assignedAt,
      "assignment-record",
      path,
      findings,
    );
  }

  for (const [index, receipt] of array(value.assignmentReceipts).entries()) {
    if (!isRecord(receipt)) continue;
    const path = `/assignmentReceipts/${index}`;
    const assignment = requireReference(
      assignments,
      receipt.assignmentRef,
      `${path}/assignmentRef`,
      "invalid_assignment_receipt",
      findings,
    );
    const cohort = cohorts.get(assignment?.cohortRef);
    const release = releases.get(cohort?.curriculumReleaseRef);
    requireReleaseTime(release, receipt.recordedAt, `${path}/recordedAt`, findings);
    if (
      assignment &&
      (assignment.receiptRef !== receipt.id ||
        assignment.learnerRef !== receipt.learnerRef ||
        assignment.state !== receipt.state ||
        !isBefore(release?.releasedAt, receipt.recordedAt) ||
        !isOrdered(assignment.assignedAt, receipt.recordedAt))
    ) {
      findings.push(
        finding(
          "invalid_assignment_receipt",
          path,
          "Receipt must reciprocally bind exactly one matching assignment.",
        ),
      );
    }
    recordEvidence(
      evidence,
      receipt.evidenceRef,
      receipt.id,
      receipt.recordedAt,
      "assignment-receipt",
      path,
      findings,
    );
  }

  for (const [index, check] of array(value.deliveryChecks).entries()) {
    if (!isRecord(check)) continue;
    const path = `/deliveryChecks/${index}`;
    requireReleaseTime(
      releases.get(check.releaseRef),
      check.observedAt,
      `${path}/observedAt`,
      findings,
    );
    if (
      !releases.has(check.releaseRef) ||
      !cohorts.has(check.cohortRef) ||
      cohorts.get(check.cohortRef)?.curriculumReleaseRef !== check.releaseRef ||
      !isBefore(releases.get(check.releaseRef)?.releasedAt, check.observedAt)
    ) {
      findings.push(
        finding(
          "invalid_delivery_binding",
          path,
          "Delivery check must bind a cohort and its exact release.",
        ),
      );
    }
    requireReference(
      principals,
      check.ownerRef,
      `${path}/ownerRef`,
      "invalid_owner",
      findings,
    );
    recordEvidence(
      evidence,
      check.evidenceRef,
      check.id,
      check.observedAt,
      "delivery-observation",
      path,
      findings,
    );
  }

  for (const [index, completion] of array(value.completionRecords).entries()) {
    if (!isRecord(completion)) continue;
    const path = `/completionRecords/${index}`;
    const assignment = requireReference(
      assignments,
      completion.assignmentRef,
      `${path}/assignmentRef`,
      "invalid_completion_identity",
      findings,
    );
    const cohort = cohorts.get(assignment?.cohortRef);
    requireReleaseTime(
      releases.get(completion.curriculumReleaseRef),
      completion.completedAt,
      `${path}/completedAt`,
      findings,
    );
    if (
      assignment?.state !== "accepted" ||
      completion.learnerRef !== assignment?.learnerRef ||
      completion.curriculumReleaseRef !== cohort?.curriculumReleaseRef ||
      !isBefore(
        releases.get(completion.curriculumReleaseRef)?.releasedAt,
        completion.completedAt,
      ) ||
      !isOrdered(assignment?.assignedAt, completion.completedAt)
    ) {
      findings.push(
        finding(
          "invalid_completion_identity",
          path,
          "Completion must bind an accepted assignment, learner, release, and valid chronology.",
        ),
      );
    }
    recordEvidence(
      evidence,
      completion.evidenceRef,
      completion.id,
      completion.completedAt,
      "completion-record",
      path,
      findings,
    );
  }

  for (const [index, assessment] of array(value.assessmentRecords).entries()) {
    if (!isRecord(assessment)) continue;
    const path = `/assessmentRecords/${index}`;
    const completion = requireReference(
      completions,
      assessment.completionRef,
      `${path}/completionRef`,
      "invalid_assessment_identity",
      findings,
    );
    const release = releases.get(completion?.curriculumReleaseRef);
    requireReleaseTime(release, assessment.assessedAt, `${path}/assessedAt`, findings);
    if (
      completion?.state !== "verified" ||
      assessment.learnerRef !== completion?.learnerRef ||
      !isBefore(release?.releasedAt, assessment.assessedAt) ||
      !isOrdered(completion?.completedAt, assessment.assessedAt)
    ) {
      findings.push(
        finding(
          "invalid_assessment_identity",
          path,
          "Assessment must bind an eligible verified completion identity and follow completion.",
        ),
      );
    }
    recordEvidence(
      evidence,
      assessment.evidenceRef,
      assessment.id,
      assessment.assessedAt,
      "assessment-record",
      path,
      findings,
    );
  }

  for (const [index, measure] of array(value.effectivenessMeasures).entries()) {
    if (!isRecord(measure)) continue;
    const path = `/effectivenessMeasures/${index}`;
    const cohort = cohorts.get(measure.cohortRef);
    const release = releases.get(measure.releaseRef);
    requireReleaseTime(release, measure.observedAt, `${path}/observedAt`, findings);
    const cohortAssignmentIds = new Set(
      array(value.assignments)
        .filter((assignment) => assignment?.cohortRef === measure.cohortRef)
        .map((assignment) => assignment.id),
    );
    const cohortCompletions = array(value.completionRecords).filter((completion) =>
      cohortAssignmentIds.has(completion?.assignmentRef),
    );
    const cohortCompletionIds = new Set(
      cohortCompletions.map((completion) => completion.id),
    );
    const cohortAssessments = array(value.assessmentRecords).filter((assessment) =>
      cohortCompletionIds.has(assessment?.completionRef),
    );
    const cohortDeliveryChecks = array(value.deliveryChecks).filter(
      (check) =>
        check?.cohortRef === measure.cohortRef &&
        check?.releaseRef === measure.releaseRef,
    );
    const expectedRate =
      measure.denominator > 0 ? measure.numerator / measure.denominator : null;
    const rateMatches =
      expectedRate === null
        ? measure.observedRate === null
        : Math.abs(measure.observedRate - expectedRate) < 1e-12;
    const enough = measure.denominator >= measure.minimumGroupSize;
    const expectedConclusion = !enough
      ? "no-conclusion"
      : expectedRate >= measure.targetRate
        ? "supports-target"
        : "does-not-support-target";
    if (
      measure.aggregationLevel !== "cohort" ||
      !cohort ||
      !release ||
      cohort.curriculumReleaseRef !== measure.releaseRef ||
      measure.denominator > cohort?.rosterRevision?.memberCount ||
      measure.numerator > measure.denominator ||
      !rateMatches ||
      measure.conclusion !== expectedConclusion ||
      array(measure.evidenceRefs).length === 0
    ) {
      findings.push(
        finding(
          "invalid_effectiveness_measure",
          path,
          "Effectiveness must be cohort-only, arithmetically exact, privacy-sized, and evidence-bounded.",
        ),
      );
    }
    const assignedReview = reviews.get(measure.refreshReviewRef);
    if (
      !assignedReview ||
      assignedReview.releaseRef !== measure.releaseRef ||
      array(assignedReview.measureRefs).filter((ref) => ref === measure.id).length !== 1
    ) {
      findings.push(
        finding(
          "invalid_refresh_measure_coverage",
          `${path}/refreshReviewRef`,
          "Measure must reciprocally bind exactly one review for its release.",
        ),
      );
    }
    if (
      !isOrdered(program.reviewWindowStart, measure.observedAt) ||
      !isOrdered(measure.observedAt, program.reviewWindowEnd) ||
      !isBefore(release?.releasedAt, measure.observedAt) ||
      cohortDeliveryChecks.some(
        (check) => !isBefore(check.observedAt, measure.observedAt),
      ) ||
      cohortCompletions.some(
        (completion) => !isBefore(completion.completedAt, measure.observedAt),
      ) ||
      cohortAssessments.some(
        (assessment) => !isBefore(assessment.assessedAt, measure.observedAt),
      )
    ) {
      findings.push(
        finding(
          "invalid_measure_chronology",
          `${path}/observedAt`,
          "Effectiveness measure must follow delivery, completion, and assessment evidence inside the review window.",
        ),
      );
    }
    for (const evidenceRef of array(measure.evidenceRefs)) {
      recordEvidence(
        evidence,
        evidenceRef,
        measure.id,
        measure.observedAt,
        "aggregate-measure",
        path,
        findings,
      );
    }
  }

  for (const [index, review] of array(value.refreshReviews).entries()) {
    if (!isRecord(review)) continue;
    const path = `/refreshReviews/${index}`;
    const release = releases.get(review.releaseRef);
    const reviewMeasures = array(review.measureRefs).map((ref) => measures.get(ref));
    const assignedMeasureRefs = array(value.effectivenessMeasures)
      .filter((measure) => measure?.refreshReviewRef === review.id)
      .map((measure) => measure.id);
    if (
      !release ||
      array(review.measureRefs).length === 0 ||
      array(review.rationaleEvidenceRefs).length === 0 ||
      !sameSet(array(review.measureRefs), assignedMeasureRefs) ||
      reviewMeasures.some((measure) => !measure || measure.releaseRef !== review.releaseRef) ||
      reviewMeasures.some(
        (measure) =>
          !isBefore(measure?.observedAt, review.reviewedAt),
      ) ||
      !isOrdered(review.reviewedAt, review.effectiveAt)
    ) {
      findings.push(
        finding(
          "invalid_refresh_review",
          path,
          "Refresh decision must follow and bind aggregate evidence for the exact release.",
        ),
      );
    }
    requireReference(
      principals,
      review.reviewerRef,
      `${path}/reviewerRef`,
      "invalid_owner",
      findings,
    );
    requireReference(
      principals,
      review.nextOwnerRef,
      `${path}/nextOwnerRef`,
      "invalid_owner",
      findings,
    );
    const rationaleSubjects = new Set();
    for (const evidenceRef of array(review.rationaleEvidenceRefs)) {
      const rationaleRecord = evidence.get(evidenceRef);
      for (const subjectRef of array(rationaleRecord?.subjectRefs)) {
        rationaleSubjects.add(subjectRef);
      }
      recordEvidence(
        evidence,
        evidenceRef,
        review.id,
        review.reviewedAt,
        "refresh-decision",
        path,
        findings,
      );
    }
    const expectedRationaleSubjects = [review.id, ...array(review.measureRefs)];
    if (
      array(review.rationaleEvidenceRefs).length === 0 ||
      array(review.rationaleEvidenceRefs).some(
        (evidenceRef) =>
          !array(evidence.get(evidenceRef)?.subjectRefs).includes(review.id),
      ) ||
      !sameSet([...rationaleSubjects], expectedRationaleSubjects)
    ) {
      findings.push(
        finding(
          "invalid_refresh_rationale_evidence",
          `${path}/rationaleEvidenceRefs`,
          "Rationale evidence must bind this review and exactly its assigned non-empty measure set.",
        ),
      );
    }
  }
  const reviewsByRelease = new Map();
  for (const review of array(value.refreshReviews)) {
    if (!isRecord(review)) continue;
    const rows = reviewsByRelease.get(review.releaseRef) ?? [];
    rows.push(review);
    reviewsByRelease.set(review.releaseRef, rows);
  }
  for (const rows of reviewsByRelease.values()) {
    const sorted = [...rows].sort((left, right) => left.revision - right.revision);
    for (const [index, review] of sorted.entries()) {
      const predecessor =
        review.predecessorReviewRef === null
          ? null
          : reviews.get(review.predecessorReviewRef);
      const expectedPredecessor = index === 0 ? null : sorted[index - 1];
      if (
        review.revision !== index + 1 ||
        (index === 0 && review.predecessorReviewRef !== null) ||
        (index > 0 &&
          (predecessor?.id !== expectedPredecessor?.id ||
            predecessor?.releaseRef !== review.releaseRef ||
            !isBefore(predecessor?.reviewedAt, review.reviewedAt) ||
            !isOrdered(predecessor?.effectiveAt, review.reviewedAt)))
      ) {
        findings.push(
          finding(
            "invalid_refresh_lineage",
            "/refreshReviews",
            "Review revisions must form one ordered predecessor lineage per release.",
          ),
        );
      }
    }
  }

  for (const [index, record] of array(value.evidence).entries()) {
    if (!isRecord(record)) continue;
    const path = `/evidence/${index}`;
    requireReference(
      principals,
      record.suppliedByRef,
      `${path}/suppliedByRef`,
      "invalid_owner",
      findings,
    );
    for (const subjectRef of array(record.subjectRefs)) {
      if (!globalIds.has(subjectRef)) {
        findings.push(
          finding(
            "invalid_evidence_subject",
            `${path}/subjectRefs`,
            `Evidence subject ${subjectRef} does not resolve.`,
          ),
        );
      }
    }
  }

  const derivedPrivacyClass = maxPrivacyClass([
    taxonomy,
    gap,
    ...array(value.curriculumReleases),
    ...array(value.cohorts).map((row) => row?.rosterRevision),
    ...array(value.evidence),
    ...array(value.effectivenessMeasures),
  ]);
  const privacyRows = [
    ["/program", program],
    ...array(value.curriculumReleases).map((row, index) => [
      `/curriculumReleases/${index}`,
      row,
    ]),
    ...array(value.cohorts).map((row, index) => [
      `/cohorts/${index}/rosterRevision`,
      row?.rosterRevision,
    ]),
    ...array(value.assignments).map((row, index) => [
      `/assignments/${index}`,
      row,
    ]),
    ...array(value.assignmentReceipts).map((row, index) => [
      `/assignmentReceipts/${index}`,
      row,
    ]),
    ...array(value.deliveryChecks).map((row, index) => [
      `/deliveryChecks/${index}`,
      row,
    ]),
    ...array(value.completionRecords).map((row, index) => [
      `/completionRecords/${index}`,
      row,
    ]),
    ...array(value.assessmentRecords).map((row, index) => [
      `/assessmentRecords/${index}`,
      row,
    ]),
    ...array(value.effectivenessMeasures).map((row, index) => [
      `/effectivenessMeasures/${index}`,
      row,
    ]),
    ...array(value.refreshReviews).map((row, index) => [
      `/refreshReviews/${index}`,
      row,
    ]),
    ...array(value.blockers).map((row, index) => [`/blockers/${index}`, row]),
    ["/handoff", value.handoff],
  ];
  for (const [path, row] of privacyRows) {
    if (
      !isRecord(row) ||
      PRIVACY_RANK[row.privacyClass] === undefined ||
      row.privacyClass !== derivedPrivacyClass
    ) {
      findings.push(
        finding(
          "privacy_downgrade",
          `${path}/privacyClass`,
          `Downstream learning state must use derived privacy class ${String(derivedPrivacyClass)}.`,
        ),
      );
    }
  }

  for (const [coverageKey, collectionKey] of Object.entries(COLLECTIONS)) {
    const actual = array(value.coverage?.[coverageKey]);
    const expected = array(value[collectionKey]).map((row) => row?.id);
    if (!sameSet(actual, expected)) {
      findings.push(
        finding(
          "invalid_coverage",
          `/coverage/${coverageKey}`,
          `Coverage must equal the complete ${collectionKey} identity set.`,
        ),
      );
    }
  }

  const expected = expectedBlockers(value);
  const actualBlockers = array(value.blockers);
  const exactBlockers =
    actualBlockers.length === expected.length &&
    expected.every(({ id, category, subject, ownerRef, openedAt }) =>
      actualBlockers.some(
        (row) =>
          row.id === id &&
          row.category === category &&
          array(row.subjectRefs).length === 1 &&
          row.subjectRefs[0] === subject &&
          row.ownerRef === ownerRef &&
          row.openedAt === openedAt,
      ),
    );
  if (!exactBlockers) {
    findings.push(
      finding(
        "blocker_drift",
        "/blockers",
        "Blockers must exactly equal the deterministically derived blocker set.",
      ),
    );
  }
  for (const [index, blocker] of actualBlockers.entries()) {
    if (!isRecord(blocker)) continue;
    const path = `/blockers/${index}`;
    const expectedBlocker = expected.find((row) => row.id === blocker.id);
    requireReference(
      principals,
      blocker.ownerRef,
      `${path}/ownerRef`,
      "invalid_blocker_owner",
      findings,
    );
    if (
      !expectedBlocker ||
      blocker.ownerRef !== expectedBlocker.ownerRef ||
      blocker.openedAt !== expectedBlocker.openedAt
    ) {
      findings.push(
        finding(
          "invalid_blocker_chronology",
          path,
          "Blocker owner and openedAt must equal the triggering condition.",
        ),
      );
    }
    if (array(blocker.evidenceRefs).length === 0) {
      findings.push(
        finding(
          "invalid_blocker_evidence",
          `${path}/evidenceRefs`,
          "Blocker requires current blocker-observation evidence.",
        ),
      );
    }
    for (const evidenceRef of array(blocker.evidenceRefs)) {
      const record = requireReference(
        evidence,
        evidenceRef,
        `${path}/evidenceRefs`,
        "invalid_blocker_evidence",
        findings,
      );
      if (
        record &&
        (record.kind !== "blocker-observation" ||
          !array(record.subjectRefs).includes(blocker.id) ||
          !array(record.subjectRefs).includes(expectedBlocker?.subject) ||
          record.observedAt !== blocker.openedAt)
      ) {
        findings.push(
          finding(
            "invalid_blocker_evidence",
            `${path}/evidenceRefs`,
            "Blocker evidence must bind the blocker and trigger with exact chronology.",
          ),
        );
      }
    }
  }
  const handoff = isRecord(value.handoff) ? value.handoff : {};
  const includedEventTimes = [
    taxonomy.effectiveAt,
    gap.approvedAt,
    ...array(value.curriculumReleases).flatMap((release) => [
      release?.releasedAt,
      release?.retiredAt,
    ]),
    ...array(value.cohorts).map((cohort) => cohort?.rosterRevision?.effectiveAt),
    ...array(value.assignments).map((row) => row?.assignedAt),
    ...array(value.assignmentReceipts).map((row) => row?.recordedAt),
    ...array(value.deliveryChecks).map((row) => row?.observedAt),
    ...array(value.completionRecords).map((row) => row?.completedAt),
    ...array(value.assessmentRecords).map((row) => row?.assessedAt),
    ...array(value.effectivenessMeasures).map((row) => row?.observedAt),
    ...array(value.refreshReviews).flatMap((row) => [
      row?.reviewedAt,
      row?.effectiveAt,
    ]),
    ...array(value.evidence).map((row) => row?.observedAt),
    ...array(value.blockers).map((row) => row?.openedAt),
  ]
    .map(exactTimestamp)
    .filter((timestamp) => timestamp !== null);
  const preparedAt = exactTimestamp(handoff.preparedAt);
  if (
    includedEventTimes.length > 0 &&
    (preparedAt === null || preparedAt <= Math.max(...includedEventTimes))
  ) {
    findings.push(
      finding(
        "invalid_handoff_chronology",
        "/handoff/preparedAt",
        "Handoff must be prepared after every included evidence, lifecycle event, and applicable review.",
      ),
    );
  }
  if (
    !sameSet(
      array(handoff.blockerRefs),
      actualBlockers.map((row) => row?.id),
    )
  ) {
    findings.push(
      finding(
        "blocker_drift",
        "/handoff/blockerRefs",
        "Handoff blocker refs must equal the blocker ledger.",
      ),
    );
  }
  if (
    (actualBlockers.length === 0 && handoff.state !== "ready-for-owner") ||
    (actualBlockers.length > 0 && handoff.state !== "blocked")
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "/handoff/state",
        "Handoff state must reflect the exact blocker set.",
      ),
    );
  }
  requireReference(
    principals,
    handoff.ownerRef,
    "/handoff/ownerRef",
    "invalid_owner",
    findings,
  );
  if (
    AUTHORITY_FIELDS.some(
      (field) => handoff.authorityClaims?.[field] !== false,
    )
  ) {
    findings.push(
      finding(
        "authority_violation",
        "/handoff/authorityClaims",
        "Every prohibited authority claim must remain structurally false.",
      ),
    );
  }
  if (handoff.artifactDigest !== computeLearningProgramArtifactDigest(value)) {
    findings.push(
      finding(
        "artifact_digest_mismatch",
        "/handoff/artifactDigest",
        "Artifact digest does not bind the complete semantic payload.",
      ),
    );
  }
  return findings;
}
