import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { medicationRegimenFindings } from "./medication-regimen-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/medication-regimen-coordinator/fixtures/medication-regimen.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/medication-regimen-coordinator/schemas/medication-regimen.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = medicationRegimenFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted medication regimen is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(medicationRegimenFindings(fixture), []);
});

test("public artifact CLI accepts the packaged medication regimen fixture", () => {
  const cli = spawnSync(process.execPath, [
    "scripts/validate-artifact.mjs",
    "medication-regimen-coordinator",
    "sources/medication-regimen-coordinator/fixtures/medication-regimen.example.json",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [
    null,
    undefined,
    true,
    7,
    "medication",
    [],
    {},
    { review: {}, authorities: [null], sources: [null], medications: [null], orders: [null] },
    { review: { authorizedCaregiverRefs: {} }, authorities: [{ id: "caregiver-bad", kind: "caregiver" }] },
  ]) {
    assert.doesNotThrow(() => medicationRegimenFindings(value));
    assert.ok(medicationRegimenFindings(value).length > 0);
  }
});

test("review indexes, global identity, and chronology are exact", () => {
  assertFinding(mutate((value) => value.review.medicationRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.gaps[0].id = value.actions[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.asOf = "2026-09-30T00:00:00-07:00"; }), "invalid_review_boundary");
});

test("patient, caregiver, and privacy authority remain bounded", () => {
  assertFinding(mutate((value) => { value.review.patientAuthorityRef = "prescriber-clinic"; }), "invalid_patient_authority");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "patient-owner").authorizationSourceRef = "source-label-a"; }), "invalid_patient_authority");
  assertFinding(mutate((value) => { value.review.authorizedCaregiverRefs = []; }), "incomplete_caregiver_index");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "caregiver-river").authorizationSourceRef = "source-label-a"; }), "invalid_caregiver_authorization");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-caregiver-authorization").freshness = "stale"; }), "invalid_caregiver_authorization");
  assertFinding(mutate((value) => { value.medications[0].label = "patient@example.test"; }), "secret_bearing_text");
  assertFinding(mutate((value) => { value.orders[0].directionText = "Deliver to 123 Main Street"; }), "secret_bearing_text");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "workspace://review/api-key=secret"; }), "secret_bearing_source");
});

test("sources preserve exact authority, subject, chronology, and minimization", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-order-a-r2").issuerAuthorityRef = "patient-owner"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-observation-a-1").subjectRef = "medication-a"; }), "invalid_observation_source");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T00:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].minimized = false; }), "secret_bearing_source");
  assertFinding(mutate((value) => { const source = value.sources.find((row) => row.id === "source-warning-a"); source.kind = "emergency-guidance"; source.issuerAuthorityRef = "patient-owner"; }), "invalid_source_authority");
});

test("medication indexes and identity evidence are exact", () => {
  assertFinding(mutate((value) => value.medications[0].orderRefs.pop()), "incomplete_medication_index");
  assertFinding(mutate((value) => { value.medications[0].patientAuthorityRef = "caregiver-river"; }), "invalid_medication_patient");
  assertFinding(mutate((value) => { value.medications[0].identitySourceRefs = ["source-order-a-r2"]; }), "invalid_medication_identity");
  assertFinding(mutate((value) => { value.medications[0].identitySourceRefs.push("source-label-b"); }), "invalid_medication_identity");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-label-a").freshness = "stale"; }), "invalid_medication_identity");
  assertFinding(mutate((value) => { value.medications[0].safetyDetermination = true; }), "prohibited_clinical_conclusion");
});

test("order revisions preserve authority, source, freshness, and reciprocal lineage", () => {
  assertFinding(mutate((value) => { value.orders[1].orderedByAuthorityRef = "pharmacist-clinic"; }), "invalid_order_authority");
  assertFinding(mutate((value) => { value.orders[1].sourceRef = "source-order-a-r1"; }), "invalid_order_source");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-order-a-r2").freshness = "stale"; }), "stale_current_order");
  assertFinding(mutate((value) => { value.orders[2].sourceRef = "source-order-a-r2"; }), "invalid_order_source");
  assertFinding(mutate((value) => { value.orders[2].warningSourceRefs = ["source-warning-a"]; }), "invalid_order_source");
  assertFinding(mutate((value) => { value.orders[1].endedAt = "2026-09-24T09:00:00-07:00"; }), "invalid_order_chronology");
  assertFinding(mutate((value) => { value.orders[0].successorRef = null; }), "invalid_order_lineage");
  assertFinding(mutate((value) => { value.orders[1].state = "superseded"; }), "invalid_live_order_coverage");
  assertFinding(mutate((value) => { value.orders[1].doseCalculatedByClaw = true; }), "prohibited_clinical_conclusion");
  const discontinued = mutate((value) => {
    value.orders[2].state = "discontinued";
    value.orders[2].endedAt = "2026-09-24T15:00:00-07:00";
    value.sources.find((row) => row.id === "source-order-b-hold").kind = "order-discontinuation";
    value.occurrences = value.occurrences.filter((row) => row.id !== "occurrence-b-1");
    value.review.occurrenceRefs = value.review.occurrenceRefs.filter((ref) => ref !== "occurrence-b-1");
  });
  assert.deepEqual(medicationRegimenFindings(discontinued), []);
});

test("occurrences cannot infer administration or cross medication and order boundaries", () => {
  assertFinding(mutate((value) => { value.occurrences[0].medicationRef = "medication-b"; }), "cross_medication_occurrence");
  assertFinding(mutate((value) => { value.occurrences[0].plannedAt = "2026-09-21T08:00:00-07:00"; }), "invalid_occurrence_chronology");
  assertFinding(mutate((value) => { value.occurrences[1].observationRef = "observation-a-1"; }), "inferred_administration");
  assertFinding(mutate((value) => { value.occurrences[2].state = "scheduled"; }), "invalid_held_occurrence");
  assertFinding(mutate((value) => { value.occurrences[1].state = "scheduled"; value.review.unknownOccurrenceRefs = []; }), "invalid_occurrence_observation");
  assertFinding(mutate((value) => { value.occurrences[1].state = "not-applicable"; value.review.unknownOccurrenceRefs = []; }), "invalid_held_occurrence");
  assertFinding(mutate((value) => { value.orders[1].state = "conflicted"; }), "invalid_held_occurrence");
});

test("observations remain exact, attributed, reciprocal, and non-clinical", () => {
  assertFinding(mutate((value) => { value.observations[0].orderRef = "order-a-r1"; }), "cross_medication_observation");
  assertFinding(mutate((value) => { value.observations[0].observerAuthorityRef = "prescriber-clinic"; }), "invalid_observer_authority");
  assertFinding(mutate((value) => { value.observations[0].sourceRef = "source-label-a"; }), "invalid_observation_source");
  assertFinding(mutate((value) => { value.observations[0].observedAt = "2026-09-24T07:55:00-07:00"; }), "invalid_observation_chronology");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-observation-a-1").assertedAt = "2026-09-23T08:05:00-07:00"; }), "invalid_observation_chronology");
  assertFinding(mutate((value) => { value.observations[0].adherenceConclusion = true; }), "prohibited_clinical_conclusion");
});

test("supply remains owner-counted, chronological, and non-concluding", () => {
  assertFinding(mutate((value) => { value.supplies[0].sourceRef = "source-label-a"; }), "invalid_supply_source");
  assertFinding(mutate((value) => { value.supplies[0].countedAt = "2026-09-24T09:00:00-07:00"; }), "invalid_supply_chronology");
  assertFinding(mutate((value) => { value.supplies[0].countedUnits = 0; value.supplies[0].state = "available"; }), "invalid_supply_state");
  assertFinding(mutate((value) => { value.supplies[0].expiryDate = "not-a-date"; }), "invalid_supply_expiry");
  assertFinding(mutate((value) => { value.supplies[0].expiryDate = "2025-03-31"; }), "invalid_supply_expiry");
  assertFinding(mutate((value) => { value.supplies[0].state = "expired"; }), "invalid_supply_expiry");
  assertFinding(mutate((value) => { value.supplies[0].availabilityDetermination = true; }), "prohibited_clinical_conclusion");
});

test("external actions remain patient-controlled and require independent receipts", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "prescriber-clinic"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "caregiver-river"; }), "caregiver_action_scope_exceeded");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-refill-a-receipt").issuerAuthorityRef = "patient-owner"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-refill-a-receipt"]; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[1].receiptSourceRef = "source-refill-a-receipt"; }), "premature_action_receipt");
  assertFinding(mutate((value) => { value.actions[1].attemptedAt = null; }), "invalid_action_chronology");
  assertFinding(mutate((value) => { value.actions[1].sourceRefs = ["source-supply-b"]; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { const source = value.sources.find((row) => row.id === "source-refill-a-receipt"); source.assertedAt = "2026-09-24T14:00:00-07:00"; source.retrievedAt = "2026-09-24T14:00:00-07:00"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
});

test("qualified-human questions remain exact and unanswered until evidenced", () => {
  assertFinding(mutate((value) => { value.questions[0].orderRef = "order-b-r1"; }), "cross_medication_question");
  assertFinding(mutate((value) => { value.questions[0].askedOfAuthorityRef = "patient-owner"; }), "invalid_question_authority");
  assertFinding(mutate((value) => { value.questions[0].askedOfAuthorityRef = "dispenser-pharmacy"; }), "invalid_question_authority");
  assertFinding(mutate((value) => { value.questions[0].kind = "overdose-poison"; }), "invalid_question_authority");
  assertFinding(mutate((value) => { value.questions[1].sourceRefs = ["source-warning-a"]; }), "invalid_question_answer");
  assertFinding(mutate((value) => { value.questions[0].answerSourceRef = "source-warning-a"; }), "premature_question_answer");
  assertFinding(mutate((value) => {
    const question = value.questions[0];
    const answer = value.sources.find((row) => row.id === "source-warning-a");
    question.state = "answered";
    question.answerSourceRef = answer.id;
    answer.subjectRef = question.id;
    answer.kind = "package-record";
    value.orders[1].warningSourceRefs = [];
  }), "invalid_question_answer");
  assertFinding(mutate((value) => { value.questions[0].interpretationByClaw = true; }), "prohibited_clinical_conclusion");
});

test("gaps and review expose unresolved state without closure", () => {
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].subjectRefs = [value.gaps[0].id]; }), "self_referential_gap");
  assertFinding(mutate((value) => { value.gaps[2].nextOwnerAuthorityRef = "caregiver-river"; }), "invalid_next_owner");
  assertFinding(mutate((value) => { value.gaps[1].sourceRefs = ["source-label-a"]; }), "unknown_gap_subject");
  assertFinding(mutate((value) => { const gap = value.gaps[2]; gap.state = "resolved"; gap.resolutionSourceRef = "source-order-b-hold"; const source = value.sources.find((row) => row.id === "source-order-b-hold"); source.kind = "gap-resolution"; source.subjectRef = gap.id; source.issuerAuthorityRef = "patient-owner"; value.review.openGapRefs = value.review.openGapRefs.filter((ref) => ref !== gap.id); }), "invalid_gap_resolution");
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.adherenceConclusion = true; }), "premature_review_conclusion");
  assertFinding(mutate((value) => { value.prohibitedActions.administration = true; }), "prohibited_authority_claim");
});

test("strict schema forbids hidden PHI, invented actions, and clinical claims", () => {
  const hidden = mutate((value) => { value.medications[0].patientDateOfBirth = "not allowed"; });
  assert.equal(validateSchema(hidden), false);
  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");
  const action = mutate((value) => { value.prohibitedActions.dispensing = true; });
  assert.equal(validateSchema(action), false);
  assertFinding(action, "prohibited_authority_claim");
});
