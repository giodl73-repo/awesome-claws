import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeLearningProgramArtifactDigest,
  learningProgramFindings,
  resealLearningProgramArtifact,
} from "./learning-program-manager.mjs";

const AS_OF = "2026-09-14T20:00:00Z";
const base = "../sources/learning-program-manager";
const fixture = JSON.parse(
  await readFile(
    new URL(`${base}/fixtures/learning-program-release.example.json`, import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(`${base}/schemas/learning-program-release.schema.json`, import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL(`${base}/templates/learning-program-release.md`, import.meta.url),
  "utf8",
);
const asset = await readFile(
  new URL(`${base}/assets/learning-program-review.html`, import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change, reseal = true) {
  const value = structuredClone(fixture);
  change(value);
  return reseal ? resealLearningProgramArtifact(value) : value;
}

function findings(value, context = { asOf: AS_OF }) {
  return learningProgramFindings(value, context);
}

function assertHas(value, code, context = { asOf: AS_OF }) {
  const result = findings(value, context);
  assert.ok(result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

test("accepted fixture is schema-valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("artifact digest binds the complete payload without circularity", () => {
  assert.equal(
    fixture.handoff.artifactDigest,
    computeLearningProgramArtifactDigest(fixture),
  );
  const changed = structuredClone(fixture);
  changed.skillTaxonomy.version = "2026.4";
  assert.notEqual(
    fixture.handoff.artifactDigest,
    computeLearningProgramArtifactDigest(changed),
  );
});

test("public artifact CLI validates the generated fixture with caller asOf", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "learning-program-manager",
      "claws/learning-program-manager/fixtures/learning-program-release.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [
    null,
    undefined,
    true,
    7,
    "artifact",
    [],
    {},
    { assignments: [null], cohorts: [{}], handoff: {} },
  ]) {
    assert.doesNotThrow(() => findings(value));
    assert.ok(findings(value).length > 0);
  }
});

test("trusted asOf is mandatory, exact, and artifact-bound", () => {
  assertHas(fixture, "invalid_validation_context", {});
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-14T20:00:00" });
  assertHas(fixture, "invalid_validation_context", { asOf: "not-a-time" });
  assertHas(fixture, "invalid_validation_context", {
    asOf: "2026-09-14T20:00:01Z",
  });
});

test("strict schema rejects individual inference and mandatory assignment fields", () => {
  const score = structuredClone(fixture);
  score.assessmentRecords[0].score = 97;
  assert.equal(validateSchema(score), false);
  const mandatory = structuredClone(fixture);
  mandatory.assignments[0].mandatory = true;
  assert.equal(validateSchema(mandatory), false);
});

test("strict schema requires all measure and review evidence sets", () => {
  for (const change of [
    (value) => {
      value.effectivenessMeasures[0].evidenceRefs = [];
    },
    (value) => {
      value.refreshReviews[0].measureRefs = [];
    },
    (value) => {
      value.refreshReviews[0].rationaleEvidenceRefs = [];
    },
  ]) {
    const value = structuredClone(fixture);
    change(value);
    assert.equal(validateSchema(value), false);
  }
});

test("every evidence-bearing record enforces its expected evidence kind", () => {
  const cases = [
    ["evidence-taxonomy", "gap-export"],
    ["evidence-gap", "taxonomy-export"],
    ["evidence-release", "roster-export"],
    ["evidence-roster", "curriculum-release-record"],
    ["evidence-assignment-01", "assignment-receipt"],
    ["evidence-receipt-01", "assignment-record"],
    ["evidence-delivery", "completion-record"],
    ["evidence-completion-01", "assessment-record"],
    ["evidence-assessment-01", "aggregate-measure"],
    ["evidence-measure", "refresh-decision"],
    ["evidence-refresh", "aggregate-measure"],
  ];
  for (const [evidenceId, wrongKind] of cases) {
    const value = mutate((candidate) => {
      candidate.evidence.find((row) => row.id === evidenceId).kind = wrongKind;
    });
    assertHas(value, "invalid_evidence_kind");
  }
});

test("release time precedes every bound lifecycle record", () => {
  for (const releasedAt of [
    "2026-07-03T15:00:01Z",
    "2026-07-03T16:00:01Z",
    "2026-07-05T17:00:01Z",
    "2026-08-15T18:00:01Z",
    "2026-08-16T18:00:01Z",
    "2026-09-01T18:00:01Z",
  ]) {
    const value = mutate((candidate) => {
      candidate.curriculumReleases[0].releasedAt = releasedAt;
      candidate.evidence.find((row) => row.id === "evidence-release").observedAt =
        releasedAt;
    });
    assertHas(value, "invalid_release_chronology");
  }
});

for (const [eventName, releasedAt] of [
  ["assignment", "2026-07-03T15:00:00Z"],
  ["receipt", "2026-07-03T16:00:00Z"],
  ["delivery", "2026-07-05T17:00:00Z"],
  ["completion", "2026-08-15T18:00:00Z"],
  ["assessment", "2026-08-16T18:00:00Z"],
  ["measure", "2026-09-01T18:00:00Z"],
]) {
  test(`release time must strictly precede equal ${eventName} time`, () => {
    const value = mutate((candidate) => {
      candidate.curriculumReleases[0].releasedAt = releasedAt;
      candidate.evidence.find((row) => row.id === "evidence-release").observedAt =
        releasedAt;
    });
    assertHas(value, "invalid_release_chronology");
  });
}

test("handoff is prepared after all included evidence, events, and reviews", () => {
  const value = mutate((candidate) => {
    candidate.handoff.preparedAt = candidate.refreshReviews[0].effectiveAt;
  });
  assertHas(value, "invalid_handoff_chronology");
});

function fixtureWithVersionHistory() {
  const value = structuredClone(fixture);
  const current = value.curriculumReleases[0];
  current.predecessorReleaseRef = "release-cloud-reliability-v3";
  const release = ({
    id,
    version,
    state,
    releasedAt,
    retiredAt,
    predecessorReleaseRef,
    evidenceRef,
  }) => ({
    ...structuredClone(current),
    id,
    version,
    state,
    releasedAt,
    retiredAt,
    predecessorReleaseRef,
    evidenceRef,
  });
  value.curriculumReleases.unshift(
    release({
      id: "release-cloud-reliability-v2",
      version: "2.0.0",
      state: "retired",
      releasedAt: "2026-06-21T12:00:00Z",
      retiredAt: "2026-06-23T12:00:00Z",
      predecessorReleaseRef: null,
      evidenceRef: "evidence-release-v2",
    }),
    release({
      id: "release-cloud-reliability-v3",
      version: "3.0.0",
      state: "historical",
      releasedAt: "2026-06-24T12:00:00Z",
      retiredAt: null,
      predecessorReleaseRef: "release-cloud-reliability-v2",
      evidenceRef: "evidence-release-v3",
    }),
  );
  value.curriculumReleases.push(
    release({
      id: "release-cloud-reliability-v5",
      version: "5.0.0",
      state: "planned",
      releasedAt: null,
      retiredAt: null,
      predecessorReleaseRef: "release-cloud-reliability-v4",
      evidenceRef: "evidence-release-v5",
    }),
  );
  for (const [id, observedAt] of [
    ["v2", "2026-06-21T12:00:00Z"],
    ["v3", "2026-06-24T12:00:00Z"],
    ["v5", "2026-09-12T12:00:00Z"],
  ]) {
    value.evidence.push({
      id: `evidence-release-${id}`,
      kind: "curriculum-release-record",
      subjectRefs: [`release-cloud-reliability-${id}`],
      observedAt,
      suppliedByRef: "principal-curriculum-owner",
      sourceDigest: `sha256:${id.at(-1).repeat(64)}`,
      privacyClass: "confidential",
    });
  }
  value.coverage.curriculumReleaseRefs = value.curriculumReleases.map(
    (item) => item.id,
  );
  return resealLearningProgramArtifact(value);
}

test("historical retired and planned versions may repeat current skills", () => {
  assert.deepEqual(findings(fixtureWithVersionHistory()), []);
});

test("release lifecycle and predecessor version lineage fail closed", () => {
  for (const change of [
    (value) => {
      value.curriculumReleases.at(-1).releasedAt = "2026-09-12T12:00:00Z";
    },
    (value) => {
      value.curriculumReleases.at(-1).version = "4.0.0";
    },
    (value) => {
      value.curriculumReleases.at(-1).predecessorReleaseRef =
        "release-cloud-reliability-v2";
    },
  ]) {
    const value = fixtureWithVersionHistory();
    change(value);
    const result = findings(resealLearningProgramArtifact(value));
    assert.ok(
      result.some((row) =>
        ["invalid_release_lifecycle", "invalid_release_lineage"].includes(row.code),
      ),
      JSON.stringify(result, null, 2),
    );
  }
});

test("planned release cannot precede an already released version", () => {
  const value = fixtureWithVersionHistory();
  const plannedPredecessor = value.curriculumReleases.find(
    (release) => release.id === "release-cloud-reliability-v3",
  );
  plannedPredecessor.state = "planned";
  plannedPredecessor.releasedAt = null;
  plannedPredecessor.retiredAt = null;
  assertHas(resealLearningProgramArtifact(value), "invalid_release_lineage");
});

function fixtureWithTwoRefreshReviews() {
  const value = structuredClone(fixture);
  value.effectivenessMeasures.push({
    ...structuredClone(value.effectivenessMeasures[0]),
    id: "measure-scenario-transfer",
    metricId: "metric-scenario-transfer",
    numerator: 7,
    observedRate: 0.7,
    targetRate: 0.7,
    observedAt: "2026-09-05T18:00:00Z",
    evidenceRefs: ["evidence-measure-transfer"],
    refreshReviewRef: "refresh-review-fy27q1-r2",
  });
  value.refreshReviews.push({
    ...structuredClone(value.refreshReviews[0]),
    id: "refresh-review-fy27q1-r2",
    reviewedAt: "2026-09-12T18:00:00Z",
    revision: 2,
    predecessorReviewRef: "refresh-review-fy27q1",
    measureRefs: ["measure-scenario-transfer"],
    rationaleEvidenceRefs: ["evidence-refresh-r2"],
    effectiveAt: "2026-09-12T18:00:00Z",
  });
  value.evidence.push(
    {
      id: "evidence-measure-transfer",
      kind: "aggregate-measure",
      subjectRefs: ["measure-scenario-transfer", "cohort-platform-fy27q1"],
      observedAt: "2026-09-05T18:00:00Z",
      suppliedByRef: "principal-program-owner",
      sourceDigest:
        "sha256:4ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      privacyClass: "confidential",
    },
    {
      id: "evidence-refresh-r2",
      kind: "refresh-decision",
      subjectRefs: [
        "refresh-review-fy27q1-r2",
        "measure-scenario-transfer",
      ],
      observedAt: "2026-09-12T18:00:00Z",
      suppliedByRef: "principal-program-owner",
      sourceDigest:
        "sha256:4eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      privacyClass: "confidential",
    },
  );
  value.coverage.effectivenessMeasureRefs.push("measure-scenario-transfer");
  value.coverage.refreshReviewRefs.push("refresh-review-fy27q1-r2");
  return resealLearningProgramArtifact(value);
}

test("multiple ordered refresh reviews may partition one release measures", () => {
  assert.deepEqual(findings(fixtureWithTwoRefreshReviews()), []);
});

test("refresh review revision and predecessor lineage fail closed", () => {
  for (const change of [
    (value) => {
      value.refreshReviews[1].revision = 3;
    },
    (value) => {
      value.refreshReviews[1].predecessorReviewRef = null;
    },
    (value) => {
      value.refreshReviews[1].reviewedAt = "2026-09-09T18:00:00Z";
      value.refreshReviews[1].effectiveAt = "2026-09-09T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-refresh-r2").observedAt =
        "2026-09-09T18:00:00Z";
    },
  ]) {
    const value = fixtureWithTwoRefreshReviews();
    change(value);
    assertHas(resealLearningProgramArtifact(value), "invalid_refresh_lineage");
  }
});

test("refresh rationale evidence cannot omit an assigned measure", () => {
  const value = mutate((candidate) => {
    candidate.evidence.find((row) => row.id === "evidence-refresh").subjectRefs = [
      "refresh-review-fy27q1",
    ];
  });
  assertHas(value, "invalid_refresh_rationale_evidence");
});

test("refresh rationale evidence rejects a cross-review measure", () => {
  const value = fixtureWithTwoRefreshReviews();
  value.evidence.find((row) => row.id === "evidence-refresh").subjectRefs = [
    "refresh-review-fy27q1",
    "measure-scenario-transfer",
  ];
  assertHas(
    resealLearningProgramArtifact(value),
    "invalid_refresh_rationale_evidence",
  );
});

test("refresh rationale evidence rejects a cross-release measure", () => {
  const value = fixtureWithVersionHistory();
  value.effectivenessMeasures.push({
    ...structuredClone(value.effectivenessMeasures[0]),
    id: "measure-historical-release",
    releaseRef: "release-cloud-reliability-v3",
    refreshReviewRef: "refresh-review-historical",
  });
  value.coverage.effectivenessMeasureRefs.push("measure-historical-release");
  value.evidence.find((row) => row.id === "evidence-refresh").subjectRefs = [
    "refresh-review-fy27q1",
    "measure-historical-release",
  ];
  assertHas(
    resealLearningProgramArtifact(value),
    "invalid_refresh_rationale_evidence",
  );
});

const semanticCases = [
  [
    "taxonomy revision drift",
    (value) => {
      value.gapRevision.taxonomyVersion = "2026.2";
    },
    "invalid_taxonomy_binding",
  ],
  [
    "gap revision drift",
    (value) => {
      value.curriculumReleases[0].gapRevisionVersion = "fy27-r1";
    },
    "invalid_curriculum_binding",
  ],
  [
    "curriculum skill outside approved gap",
    (value) => {
      value.curriculumReleases[0].skillRefs = ["skill-unapproved"];
    },
    "invalid_curriculum_binding",
  ],
  [
    "approved gap skill must exist in taxonomy",
    (value) => {
      value.gapRevision.skillGapRefs.push("skill-missing-from-taxonomy");
    },
    "invalid_gap_skill_coverage",
  ],
  [
    "curriculum cannot omit an approved gap skill",
    (value) => {
      value.curriculumReleases[0].skillRefs.pop();
    },
    "invalid_curriculum_skill_coverage",
  ],
  [
    "curriculum cannot add a non-gap taxonomy skill",
    (value) => {
      value.skillTaxonomy.skillRefs.push("skill-extra");
      value.curriculumReleases[0].skillRefs.push("skill-extra");
    },
    "invalid_curriculum_skill_coverage",
  ],
  [
    "approved skill coverage cannot be duplicated across releases",
    (value) => {
      value.curriculumReleases.push({
        ...structuredClone(value.curriculumReleases[0]),
        id: "release-cloud-reliability-v5",
        version: "5.0.0",
      });
    },
    "invalid_curriculum_skill_coverage",
  ],
  [
    "taxonomy must be effective before gap approval",
    (value) => {
      value.skillTaxonomy.effectiveAt = "2026-06-21T00:00:00Z";
      value.evidence.find((row) => row.id === "evidence-taxonomy").observedAt =
        "2026-06-21T00:00:00Z";
    },
    "invalid_program_chronology",
  ],
  [
    "gap approval must precede curriculum release",
    (value) => {
      value.curriculumReleases[0].releasedAt = "2026-06-19T00:00:00Z";
      value.evidence.find((row) => row.id === "evidence-release").observedAt =
        "2026-06-19T00:00:00Z";
    },
    "invalid_program_chronology",
  ],
  [
    "cohort release is unknown",
    (value) => {
      value.cohorts[0].curriculumReleaseRef = "release-missing";
    },
    "invalid_cohort_binding",
  ],
  [
    "assignment roster revision drifts",
    (value) => {
      value.assignments[0].rosterRevisionVersion = "2";
    },
    "invalid_assignment_binding",
  ],
  [
    "roster must be effective before assignment",
    (value) => {
      value.cohorts[0].rosterRevision.effectiveAt = "2026-07-04T00:00:00Z";
      value.evidence.find((row) => row.id === "evidence-roster").observedAt =
        "2026-07-04T00:00:00Z";
    },
    "invalid_assignment_binding",
  ],
  [
    "mandatory assignment is rejected semantically",
    (value) => {
      value.assignments[0].mandatory = true;
    },
    "invalid_assignment_binding",
  ],
  [
    "assignment receipt learner changes",
    (value) => {
      value.assignmentReceipts[0].learnerRef = "learner-ffffffffffffffff";
    },
    "invalid_assignment_receipt",
  ],
  [
    "assignment receipt predates assignment",
    (value) => {
      value.assignmentReceipts[0].recordedAt = "2026-07-03T14:00:00Z";
      value.evidence.find((row) => row.id === "evidence-receipt-01").observedAt =
        "2026-07-03T14:00:00Z";
    },
    "invalid_assignment_receipt",
  ],
  [
    "orphan assignment receipt is rejected",
    (value) => {
      value.assignmentReceipts.push({
        ...structuredClone(value.assignmentReceipts[0]),
        id: "receipt-orphan",
        assignmentRef: "assignment-missing",
      });
      value.coverage.assignmentReceiptRefs.push("receipt-orphan");
    },
    "invalid_assignment_receipt",
  ],
  [
    "receipt backlink must be reciprocal",
    (value) => {
      value.assignmentReceipts[0].assignmentRef = "assignment-02";
    },
    "invalid_assignment_receipt",
  ],
  [
    "accepted assignment lacks completion",
    (value) => {
      value.completionRecords = [];
      value.assessmentRecords = [];
      value.coverage.completionRecordRefs = [];
      value.coverage.assessmentRecordRefs = [];
    },
    "blocker_drift",
  ],
  [
    "completion learner identity drifts",
    (value) => {
      value.completionRecords[0].learnerRef = "learner-ffffffffffffffff";
    },
    "invalid_completion_identity",
  ],
  [
    "completion binds a declined assignment",
    (value) => {
      value.completionRecords[0].assignmentRef = "assignment-02";
      value.completionRecords[0].learnerRef = "learner-1234567890abcdef";
    },
    "invalid_completion_identity",
  ],
  [
    "withdrawn completion does not satisfy an accepted assignment",
    (value) => {
      value.completionRecords[0].state = "withdrawn";
    },
    "blocker_drift",
  ],
  [
    "assessment requires a verified completion",
    (value) => {
      value.completionRecords[0].state = "reported";
    },
    "invalid_assessment_identity",
  ],
  [
    "assessment learner identity drifts",
    (value) => {
      value.assessmentRecords[0].learnerRef = "learner-ffffffffffffffff";
    },
    "invalid_assessment_identity",
  ],
  [
    "assessment predates completion",
    (value) => {
      value.assessmentRecords[0].assessedAt = "2026-08-14T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-assessment-01").observedAt =
        "2026-08-14T18:00:00Z";
    },
    "invalid_assessment_identity",
  ],
  [
    "delivery check crosses release scope",
    (value) => {
      value.deliveryChecks[0].releaseRef = "release-missing";
    },
    "invalid_delivery_binding",
  ],
  [
    "delivery blocker cannot be hidden",
    (value) => {
      value.deliveryChecks[0].state = "blocked";
    },
    "blocker_drift",
  ],
  [
    "delivery evidence must precede effectiveness measurement",
    (value) => {
      value.deliveryChecks[0].observedAt = "2026-09-02T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-delivery").observedAt =
        "2026-09-02T18:00:00Z";
    },
    "invalid_measure_chronology",
  ],
  [
    "completion evidence must precede effectiveness measurement",
    (value) => {
      value.completionRecords[0].completedAt = "2026-09-02T18:00:00Z";
      value.assessmentRecords[0].assessedAt = "2026-09-03T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-completion-01").observedAt =
        "2026-09-02T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-assessment-01").observedAt =
        "2026-09-03T18:00:00Z";
    },
    "invalid_measure_chronology",
  ],
  [
    "assessment evidence must precede effectiveness measurement",
    (value) => {
      value.assessmentRecords[0].assessedAt = "2026-09-02T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-assessment-01").observedAt =
        "2026-09-02T18:00:00Z";
    },
    "invalid_measure_chronology",
  ],
  [
    "effectiveness measure must remain inside review window",
    (value) => {
      value.program.reviewWindowStart = "2026-09-02T00:00:00Z";
    },
    "invalid_measure_chronology",
  ],
  [
    "aggregate numerator exceeds denominator",
    (value) => {
      value.effectivenessMeasures[0].numerator = 11;
      value.effectivenessMeasures[0].observedRate = 1.1;
    },
    "invalid_effectiveness_measure",
  ],
  [
    "aggregate observed rate is not derived",
    (value) => {
      value.effectivenessMeasures[0].observedRate = 0.7;
    },
    "invalid_effectiveness_measure",
  ],
  [
    "unsupported aggregate conclusion is rejected",
    (value) => {
      value.effectivenessMeasures[0].conclusion = "does-not-support-target";
    },
    "invalid_effectiveness_measure",
  ],
  [
    "undersized aggregate cannot claim effectiveness",
    (value) => {
      value.effectivenessMeasures[0].denominator = 4;
      value.effectivenessMeasures[0].numerator = 3;
      value.effectivenessMeasures[0].observedRate = 0.75;
      value.effectivenessMeasures[0].conclusion = "no-conclusion";
    },
    "blocker_drift",
  ],
  [
    "measure cannot exceed roster size",
    (value) => {
      value.effectivenessMeasures[0].denominator = 13;
      value.effectivenessMeasures[0].numerator = 10;
      value.effectivenessMeasures[0].observedRate = 10 / 13;
    },
    "invalid_effectiveness_measure",
  ],
  [
    "privacy class cannot be weakened",
    (value) => {
      value.effectivenessMeasures[0].privacyClass = "internal";
    },
    "privacy_downgrade",
  ],
  [
    "restricted evidence propagates to every downstream output",
    (value) => {
      value.evidence[0].privacyClass = "restricted";
    },
    "privacy_downgrade",
  ],
  [
    "refresh review must cover every release measure",
    (value) => {
      value.refreshReviews[0].measureRefs = [];
    },
    "invalid_refresh_review",
  ],
  [
    "refresh review cannot claim a measure assigned to another review",
    (value) => {
      value.refreshReviews.push({
        ...structuredClone(value.refreshReviews[0]),
        id: "refresh-review-fy27q1-duplicate",
      });
      value.coverage.refreshReviewRefs.push("refresh-review-fy27q1-duplicate");
    },
    "invalid_refresh_review",
  ],
  [
    "effectiveness measure requires evidence",
    (value) => {
      value.effectivenessMeasures[0].evidenceRefs = [];
    },
    "invalid_effectiveness_measure",
  ],
  [
    "refresh review requires rationale evidence",
    (value) => {
      value.refreshReviews[0].rationaleEvidenceRefs = [];
    },
    "invalid_refresh_review",
  ],
  [
    "refresh review cannot reference another measure",
    (value) => {
      value.refreshReviews[0].measureRefs = ["measure-missing"];
    },
    "invalid_refresh_review",
  ],
  [
    "refresh review cannot predate its aggregate",
    (value) => {
      value.refreshReviews[0].reviewedAt = "2026-08-30T18:00:00Z";
      value.refreshReviews[0].effectiveAt = "2026-08-30T18:00:00Z";
      value.evidence.find((row) => row.id === "evidence-refresh").observedAt =
        "2026-08-30T18:00:00Z";
    },
    "invalid_refresh_review",
  ],
  [
    "coverage cannot omit a release",
    (value) => {
      value.coverage.curriculumReleaseRefs = [];
    },
    "invalid_coverage",
  ],
  [
    "evidence cannot cite an unknown subject",
    (value) => {
      value.evidence[0].subjectRefs = ["unknown-subject"];
    },
    "invalid_evidence_subject",
  ],
  [
    "future observations are rejected",
    (value) => {
      value.deliveryChecks[0].observedAt = "2099-01-01T00:00:00Z";
      value.evidence.find((row) => row.id === "evidence-delivery").observedAt =
        "2099-01-01T00:00:00Z";
    },
    "future_event",
  ],
  [
    "principal identities are globally unique",
    (value) => {
      value.principals[1].id = "principal-program-owner";
    },
    "duplicate_identity",
  ],
  [
    "authority claims remain false",
    (value) => {
      value.handoff.authorityClaims.hrRecordMutation = true;
    },
    "authority_violation",
  ],
  [
    "ready state cannot hide declared blockers",
    (value) => {
      value.blockers.push({
        id: "blocker-delivery-not-ready-delivery-check-facilitator",
        category: "delivery-not-ready",
        subjectRefs: ["delivery-check-facilitator"],
        evidenceRefs: ["evidence-delivery"],
        ownerRef: "principal-delivery-owner",
        openedAt: "2026-07-05T17:00:00Z",
      });
      value.handoff.blockerRefs.push(
        "blocker-delivery-not-ready-delivery-check-facilitator",
      );
    },
    "blocker_drift",
  ],
  [
    "stale digest is rejected",
    (value) => {
      value.program.reviewWindowStart = "2026-07-02T00:00:00Z";
    },
    "artifact_digest_mismatch",
    false,
  ],
  [
    "prohibited individual score field is rejected semantically",
    (value) => {
      value.assessmentRecords[0].score = 97;
    },
    "prohibited_contract_field",
  ],
];

for (const [name, change, code, reseal = true] of semanticCases) {
  test(name, () => {
    assertHas(mutate(change, reseal), code);
  });
}

function blockedDeliveryFixture() {
  const value = structuredClone(fixture);
  const blockerId =
    "blocker-delivery-not-ready-delivery-check-facilitator";
  value.deliveryChecks[0].state = "blocked";
  value.evidence.push({
    id: "evidence-blocker-delivery",
    kind: "blocker-observation",
    subjectRefs: [blockerId, "delivery-check-facilitator"],
    observedAt: value.deliveryChecks[0].observedAt,
    suppliedByRef: "principal-delivery-owner",
    sourceDigest:
      "sha256:4ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    privacyClass: "confidential",
  });
  value.blockers.push({
    id: blockerId,
    category: "delivery-not-ready",
    subjectRefs: ["delivery-check-facilitator"],
    evidenceRefs: ["evidence-blocker-delivery"],
    ownerRef: "principal-delivery-owner",
    openedAt: value.deliveryChecks[0].observedAt,
    privacyClass: "confidential",
  });
  value.handoff.state = "blocked";
  value.handoff.blockerRefs = [blockerId];
  return resealLearningProgramArtifact(value);
}

test("well-formed blocker binds trigger, owner, evidence kind, and chronology", () => {
  assert.deepEqual(findings(blockedDeliveryFixture()), []);
});

test("blocker owner must resolve and match the triggering owner", () => {
  const value = blockedDeliveryFixture();
  value.blockers[0].ownerRef = "principal-missing";
  assertHas(resealLearningProgramArtifact(value), "invalid_blocker_owner");
  assertHas(resealLearningProgramArtifact(value), "invalid_blocker_chronology");
});

test("blocker evidence must resolve with exact kind and subject", () => {
  for (const change of [
    (value) => {
      value.blockers[0].evidenceRefs = ["evidence-missing"];
    },
    (value) => {
      value.evidence.at(-1).kind = "delivery-observation";
    },
    (value) => {
      value.evidence.at(-1).subjectRefs = [value.blockers[0].id];
    },
  ]) {
    const value = blockedDeliveryFixture();
    change(value);
    assertHas(resealLearningProgramArtifact(value), "invalid_blocker_evidence");
  }
});

test("blocker openedAt and observation must equal the triggering instant", () => {
  const value = blockedDeliveryFixture();
  value.blockers[0].openedAt = "2026-07-05T17:00:01Z";
  value.evidence.at(-1).observedAt = "2026-07-05T17:00:01Z";
  assertHas(resealLearningProgramArtifact(value), "invalid_blocker_chronology");
});

test("X3 fallback exposes the complete governed lifecycle", () => {
  for (const token of [
    "## Bound program revision",
    "{{gapRevision.version}}",
    "{{skillTaxonomy.version}}",
    "## Audiences, cohorts, and assignment receipts",
    "{{assignmentReceipts[].id}}",
    "## Completion and assessment identity",
    "{{assessmentRecords[].id}}",
    "## Aggregate effectiveness review",
    "{{effectivenessMeasures[].id}}",
    "## Refresh decisions and chronology",
    "{{handoff.artifactDigest}}",
    "mandatory assignment",
    "promotion or compensation",
  ]) {
    assert.ok(template.includes(token), token);
  }
});

test("X4 asset is semantic, responsive, and preserves the fallback boundary", () => {
  for (const token of [
    "<main",
    "aria-labelledby",
    "@media(max-width:650px)",
    "Approved gap",
    "Roster r3",
    "Aggregate effectiveness",
    "no score exposed",
    "outputs/learning-program-release.md",
  ]) {
    assert.ok(asset.includes(token), token);
  }
  assert.doesNotMatch(asset, /<script|https?:\/\//iu);
});
