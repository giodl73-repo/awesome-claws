import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { propertyInsuranceClaimFindings } from "./property-insurance-claim-coordinator.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../sources/property-insurance-claim-coordinator/fixtures/property-claim-ledger.example.json", import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../sources/property-insurance-claim-coordinator/schemas/property-claim-ledger.schema.json", import.meta.url),
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
  const findings = propertyInsuranceClaimFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted property claim ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(propertyInsuranceClaimFindings(fixture), []);
});

test("public artifact CLI accepts the packaged property claim fixture", () => {
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "property-insurance-claim-coordinator",
      "sources/property-insurance-claim-coordinator/fixtures/property-claim-ledger.example.json",
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "claim", [], {}, { claim: {}, sources: [null], propertyUnits: [null] }]) {
    assert.doesNotThrow(() => propertyInsuranceClaimFindings(value));
    assert.ok(propertyInsuranceClaimFindings(value).length > 0);
  }
});

test("claim and property indexes are exact and global ids are unique", () => {
  assertFinding(mutate((value) => value.claim.paymentRefs.pop()), "incomplete_claim_index");
  assertFinding(mutate((value) => value.propertyUnits[0].estimateRefs.pop()), "incomplete_property_index");
  assertFinding(mutate((value) => { value.gaps[0].id = value.actions[0].id; }), "duplicate_identity");
});

test("claim authority, lineage, and privacy remain bounded", () => {
  assertFinding(mutate((value) => { value.claim.ownerAuthorityRef = "carrier-harbor"; }), "invalid_claim_owner");
  assertFinding(mutate((value) => { value.claim.carrierAuthorityRef = "owner-rivera"; }), "invalid_claim_carrier");
  assertFinding(mutate((value) => { value.review.nextRevision = 8; }), "invalid_revision_lineage");
  assertFinding(mutate((value) => { value.claim.policyRefRedacted = "1234567890123456"; }), "secret_bearing_identifier");
  assertFinding(mutate((value) => { value.authorities[0].name = "owner@example.test"; }), "secret_bearing_identifier");
});

test("source authority, kind, subject, jurisdiction, chronology, and redaction are enforced", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-carrier-scope").issuerAuthorityRef = "owner-rivera"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-owner-decision").subjectRef = "payment-initial"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].jurisdiction = "US-NY"; }), "invalid_source_jurisdiction");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T00:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "workspace://claim/api-key=exposed"; }), "secret_bearing_source");
});

test("event assertions require matching evidence and never become determinations", () => {
  assertFinding(mutate((value) => { value.events[0].assertionState = "carrier-issued-fact"; }), "invalid_assertion_evidence");
  assertFinding(mutate((value) => { value.events[0].coverageDetermination = true; }), "prohibited_event_determination");
  assertFinding(mutate((value) => { value.events[0].occurredAt = "2026-09-09T12:00:00-07:00"; }), "invalid_event_chronology");
});

test("official requirements retain exact carrier, revision, jurisdiction, action, and deadline bindings", () => {
  assertFinding(mutate((value) => { value.requirements[0].revision = "unknown"; }), "invalid_requirement_binding");
  assertFinding(mutate((value) => { value.requirements[0].actionRefs = []; }), "incomplete_requirement_index");
  assertFinding(mutate((value) => { value.requirements[0].deadlineAt = "2026-09-10T00:00:00-07:00"; }), "invalid_requirement_deadline");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-inventory-instruction").freshness = "stale"; }), "stale_current_requirement");
  assertFinding(mutate((value) => { value.requirements[0].externalExecution = "agent"; }), "external_authority_claim");
});

test("owner-completed actions require independent same-subject receipts", () => {
  assertFinding(mutate((value) => { value.actions.find((row) => row.id === "action-submit-mitigation-record").state = "owner-completed"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-inventory-action-receipt").subjectRef = "action-perform-mitigation"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-mitigation-action-receipt").issuerAuthorityRef = "owner-rivera"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions.find((row) => row.id === "action-submit-mitigation-record").sourceRefs = []; }), "missing_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-owner-mitigation-attempt"]; }), "cross_subject_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
});

test("estimate scopes and carrier positions remain attributed rather than endorsed", () => {
  assertFinding(mutate((value) => { value.estimates[0].issuerAuthorityRef = "carrier-harbor"; }), "invalid_estimate_authority");
  assertFinding(mutate((value) => { value.estimates[0].revision = "2"; }), "invalid_estimate_binding");
  assertFinding(mutate((value) => { value.estimates[0].clawRecommended = true; }), "valuation_recommendation_claim");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-carrier-scope").subjectRef = "estimate-carrier-scope"; }), "invalid_carrier_position");
  assertFinding(mutate((value) => { value.carrierPositions[0].clawEndorsed = true; }), "carrier_position_endorsement");
  assertFinding(mutate((value) => { for (const position of value.carrierPositions) position.state = "carrier-withdrawn"; }), "unsupported_property_state");
});

test("payment allocations reconcile and announced payments cannot imply receipt or settlement", () => {
  assertFinding(mutate((value) => { value.payments[0].allocations[0].amountMinorUnits += 1; }), "invalid_payment_allocation");
  assertFinding(mutate((value) => { value.payments[0].allocations[0].propertyUnitRef = "property-desk"; }), "invalid_payment_allocation");
  assertFinding(mutate((value) => { value.payments[0].receiptSourceRef = "source-inventory-action-receipt"; }), "premature_payment_receipt");
  assertFinding(mutate((value) => { value.payments[0].ownerAcceptanceClaim = true; }), "premature_payment_conclusion");
  assertFinding(mutate((value) => { value.payments[0].settlementClaim = true; }), "premature_payment_conclusion");
});

test("repair records require owner authorization and provider completion evidence", () => {
  assertFinding(mutate((value) => { value.repairRecords[0].providerAuthorityRef = "carrier-harbor"; }), "invalid_repair_provider");
  assertFinding(mutate((value) => { value.repairRecords[0].authorizedActionRef = "action-submit-inventory"; }), "invalid_repair_authorization");
  assertFinding(mutate((value) => { value.repairRecords[0].completionReceiptSourceRef = null; }), "invalid_repair_completion");
  assertFinding(mutate((value) => { value.repairRecords[0].currency = null; }), "invalid_repair_amount");
  assertFinding(mutate((value) => { value.repairRecords[0].repairSufficiencyClaim = true; }), "prohibited_repair_claim");
});

test("owner decisions, gaps, and unresolved review indexes remain exact", () => {
  assertFinding(mutate((value) => { value.ownerDecisions[0].ownerAuthorityRef = "carrier-harbor"; }), "invalid_owner_decision");
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].kind = "missing-evidence"; }), "incomplete_missing_receipt_coverage");
  assertFinding(mutate((value) => { value.gaps[0].relatedRefs = [value.gaps[0].id]; }), "self_referential_gap");
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.decision = "ready-for-owner-review"; }), "premature_claim_handoff");
  assertFinding(mutate((value) => { value.review.closureClaim = true; }), "premature_closure_claim");
});

test("strict schema forbids hidden fields, secrets, and prohibited authority", () => {
  const hidden = mutate((value) => { value.propertyUnits[0].preciseAddress = "not allowed"; });
  assert.equal(validateSchema(hidden), false);

  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");

  const authority = mutate((value) => { value.prohibitedActions.coverageDetermined = true; });
  assert.equal(validateSchema(authority), false);
  assertFinding(authority, "prohibited_authority_claim");
});
