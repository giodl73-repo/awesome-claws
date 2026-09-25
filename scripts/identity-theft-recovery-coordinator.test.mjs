import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { identityTheftRecoveryFindings } from "./identity-theft-recovery-coordinator.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../sources/identity-theft-recovery-coordinator/fixtures/recovery-ledger.example.json", import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../sources/identity-theft-recovery-coordinator/schemas/recovery-ledger.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = identityTheftRecoveryFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted identity recovery ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(identityTheftRecoveryFindings(fixture), []);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "case", [], {}, { case: {}, sources: [null], surfaces: [null] }]) {
    assert.doesNotThrow(() => identityTheftRecoveryFindings(value));
    assert.ok(identityTheftRecoveryFindings(value).length > 0);
  }
});

test("case and surface indexes are exact and global ids are unique", () => {
  assertFinding(mutate((value) => value.case.surfaceRefs.pop()), "incomplete_case_index");
  assertFinding(mutate((value) => value.surfaces[0].actionRefs.pop()), "incomplete_surface_index");
  assertFinding(mutate((value) => { value.gaps[0].id = value.actions[0].id; }), "duplicate_identity");
});

test("suspicion never becomes a fraud determination or unsupported confirmed state", () => {
  assertFinding(mutate((value) => { value.events[0].assertionState = "institution-confirmed-fact"; }), "invalid_assertion_evidence");
  assertFinding(mutate((value) => { value.events[0].fraudDetermination = true; }), "fraud_determination_claim");
  assertFinding(mutate((value) => { value.surfaces[0].state = "institution-confirmed-impact"; }), "unsupported_surface_state");
});

test("source authority, chronology, jurisdiction, and redaction remain bounded", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-issuer-route").issuerAuthorityRef = "owner-rivera"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T00:00:00Z"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].jurisdiction = "US-NY"; }), "invalid_source_jurisdiction");
  assertFinding(mutate((value) => { value.surfaces[0].redactedIdentifier = "123-45-6789"; }), "secret_bearing_identifier");
});

test("official routes retain exact revision, jurisdiction, coverage, and owner execution", () => {
  assertFinding(mutate((value) => { value.routes[0].revision = "unknown"; }), "invalid_route_binding");
  assertFinding(mutate((value) => { value.routes[0].ownerActionRefs.pop(); }), "invalid_action_route");
  assertFinding(mutate((value) => { value.routes[1].ownerActionRefs.push("action-tax-contact"); }), "incomplete_route_index");
  assertFinding(mutate((value) => { value.routes[0].externalExecution = "agent"; }), "external_authority_claim");
});

test("owner-completed actions require independent same-subject receipts", () => {
  assertFinding(mutate((value) => { value.actions.find((row) => row.id === "action-issuer-contact").state = "owner-completed"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-report-action-receipt").subjectRef = "action-tax-contact"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-tax-action-receipt").issuerAuthorityRef = "owner-rivera"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = []; }), "missing_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-owner-credit-observation"]; }), "cross_subject_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
});

test("report and dispute states require matching owner actions and receipts", () => {
  assertFinding(mutate((value) => { value.reports[0].receiptSourceRef = "source-report-action-receipt"; }), "invalid_filing_receipt");
  assertFinding(mutate((value) => { value.disputes[0].state = "acknowledged"; }), "invalid_filing_receipt");
  assertFinding(mutate((value) => { value.reports[0].surfaceRefs = ["surface-credit-account"]; }), "invalid_filing_action");
  assertFinding(mutate((value) => { value.reports[0].agentFiled = true; }), "external_authority_claim");
});

test("institution decisions remain source-bound facts, not Claw conclusions", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-tax-decision").subjectRef = "surface-tax-account"; }), "invalid_institution_decision");
  assertFinding(mutate((value) => { value.decisions[0].occurredAt = "2026-09-21T00:00:00Z"; }), "invalid_decision_chronology");
  assertFinding(mutate((value) => { value.decisions[0].fraudDetermination = true; }), "fraud_determination_claim");
});

test("gaps and review indexes expose all unresolved state without premature closure", () => {
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].kind = "missing-evidence"; }), "incomplete_missing_receipt_coverage");
  assertFinding(mutate((value) => { value.gaps[0].relatedRefs = [value.gaps[0].id]; }), "self_referential_gap");
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.decision = "ready-for-owner-review"; }), "premature_recovery_handoff");
  assertFinding(mutate((value) => { value.review.closureClaim = true; }), "premature_closure_claim");
});

test("strict schema forbids hidden sensitive fields and prohibited authority", () => {
  const hidden = mutate((value) => { value.surfaces[0].fullAccountNumber = "not allowed"; });
  assert.equal(validateSchema(hidden), false);

  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");

  const authority = mutate((value) => { value.prohibitedActions.reportFiled = true; });
  assert.equal(validateSchema(authority), false);
  assertFinding(authority, "prohibited_authority_claim");
});
