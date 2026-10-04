import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { learningPlanFindings } from "./learning-plan-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/learning-plan-coordinator/fixtures/learning-plan.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/learning-plan-coordinator/schemas/learning-plan.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = learningPlanFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted learning plan is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(learningPlanFindings(fixture), []);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "plan", [], {}, { plan: {}, activities: [null] }]) {
    assert.doesNotThrow(() => learningPlanFindings(value));
    assert.ok(learningPlanFindings(value).length > 0);
  }
});

test("plan indexes must exactly cover the artifact collections", () => {
  assertFinding(mutate((value) => value.plan.competencyRefs.pop()), "incomplete_plan_index");
});

test("competency prerequisites are acyclic and activity-bound", () => {
  assertFinding(mutate((value) => value.competencies[0].prerequisiteRefs.push("competency-capstone")), "cyclic_prerequisites");
  assertFinding(mutate((value) => value.activities[1].prerequisiteRefs = []), "prerequisite_drift");
});

test("passed checkpoints and evidenced competencies require independent support", () => {
  assertFinding(mutate((value) => value.evidence[0].kind = "self-report"), "unsupported_passed_checkpoint");
  assertFinding(mutate((value) => value.checkpoints[0].status = "planned"), "unsupported_evidenced_competency");
});

test("competency backlinks exactly cover bound evidence and checkpoints", () => {
  assertFinding(mutate((value) => value.competencies[0].evidenceRefs = []), "incomplete_competency_evidence_index");
  assertFinding(mutate((value) => value.competencies[0].checkpointRefs = []), "incomplete_competency_checkpoint_index");
});

test("activity ranges cover the plan without overlap and honor weekly budget", () => {
  assertFinding(mutate((value) => value.activities[1].startWeek = 3), "overlapping_activity_weeks");
  assertFinding(mutate((value) => value.activities[1].startWeek = 5), "incomplete_week_coverage");
  assertFinding(mutate((value) => value.activities[1].minutesPerWeek = 241), "weekly_budget_exceeded");
});

test("unevidenced prerequisites keep later activities blocked", () => {
  assertFinding(mutate((value) => value.activities[2].status = "planned"), "unmet_prerequisite");
});

test("resource choices honor cost, currency, selection, and competency scope", () => {
  assertFinding(mutate((value) => value.resources[0].costMinor = 1), "invalid_resource_constraint");
  assertFinding(mutate((value) => value.resources[0].selected = false), "invalid_activity_resource");
  const unselectedCandidate = mutate((value) => {
    value.resources[0].selected = false;
    value.resources[0].currency = "EUR";
    value.resources[0].costMinor = 2500;
    value.activities[0].resourceRefs = [];
  });
  assert.ok(!learningPlanFindings(unselectedCandidate).some((row) => row.code === "invalid_resource_constraint"));
});

test("review exactly preserves failed, skipped, and blocked checkpoints", () => {
  assertFinding(mutate((value) => value.review.blockedCheckpointRefs.pop()), "incomplete_blocked_checkpoint_review");
  assertFinding(mutate((value) => value.checkpoints[1].status = "failed"), "incomplete_failed_checkpoint_review");
  assertFinding(mutate((value) => value.review.decision = "complete"), "premature_completion");
  assertFinding(mutate((value) => {
    value.checkpoints[2].status = "passed";
    value.checkpoints[3].status = "passed";
    value.review.blockedCheckpointRefs = [];
    value.review.decision = "complete";
  }), "premature_completion");
});

test("evidence chronology cannot exceed the plan boundary", () => {
  assertFinding(mutate((value) => value.evidence[0].observedAt = "2026-09-25T12:00:01Z"), "invalid_evidence_chronology");
});

test("strict schema structurally forbids authority claims and hidden fields", () => {
  const authority = mutate((value) => value.prohibitedActions.enrollmentPerformed = true);
  assert.equal(validateSchema(authority), false);
  const hiddenMastery = mutate((value) => value.competencies[0].masteryScore = 100);
  assert.equal(validateSchema(hiddenMastery), false);
});
