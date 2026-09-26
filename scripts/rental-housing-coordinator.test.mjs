import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { rentalHousingFindings } from "./rental-housing-coordinator.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../sources/rental-housing-coordinator/fixtures/rental-housing-ledger.example.json", import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../sources/rental-housing-coordinator/schemas/rental-housing-ledger.schema.json", import.meta.url),
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
  const findings = rentalHousingFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted rental housing ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(rentalHousingFindings(fixture), []);
});

test("public artifact CLI accepts the packaged rental housing fixture", () => {
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "rental-housing-coordinator",
      "sources/rental-housing-coordinator/fixtures/rental-housing-ledger.example.json",
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "tenancy", [], {}, { tenancy: {}, sources: [null], actions: [null] }]) {
    assert.doesNotThrow(() => rentalHousingFindings(value));
    assert.ok(rentalHousingFindings(value).length > 0);
  }
});

test("tenancy indexes are exact and global ids are unique", () => {
  assertFinding(mutate((value) => value.tenancy.chargeRefs.pop()), "incomplete_tenancy_index");
  assertFinding(mutate((value) => { value.gaps[0].id = value.actions[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.nextRevision = 7; }), "invalid_revision_lineage");
});

test("renter, landlord, helper, and privacy authority remain bounded", () => {
  assertFinding(mutate((value) => { value.tenancy.renterAuthorityRef = "manager-riverbend"; }), "invalid_renter_authority");
  assertFinding(mutate((value) => { value.tenancy.landlordAuthorityRef = "renter-owner"; }), "invalid_landlord_authority");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "helper-family").authorizationSourceRef = "source-lease-amendment"; }), "invalid_helper_authorization");
  assertFinding(mutate((value) => { value.authorities[0].label = "renter@example.test"; }), "secret_bearing_identifier");
  assertFinding(mutate((value) => { value.tenancy.generalizedPremisesRef = "123 Main Street"; }), "secret_bearing_identifier");
  assertFinding(mutate((value) => { value.obligations[0].summary = "Send the record to renter@example.test"; }), "secret_bearing_text");
  assertFinding(mutate((value) => { value.payments[0].amountNote = "Account 4111111111111111"; }), "secret_bearing_text");
});

test("source authority, subject, jurisdiction, chronology, and minimization are enforced", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-lease-amendment").issuerAuthorityRef = "renter-owner"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-rent-receipt").subjectRef = "charge-cleaning"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].jurisdiction = "US-NY"; }), "invalid_source_jurisdiction");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T00:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "workspace://rental/door-code=1234"; }), "secret_bearing_source");
});

test("one current lease controls lineage, sources, obligations, and notices", () => {
  assertFinding(mutate((value) => { value.leaseRevisions[0].state = "controlling"; }), "invalid_controlling_lease");
  assertFinding(mutate((value) => { value.leaseRevisions[1].sourceRef = "source-lease-original"; }), "invalid_lease_source");
  assertFinding(mutate((value) => { value.leaseRevisions[0].successorRef = null; }), "invalid_lease_lineage");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-lease-amendment").freshness = "stale"; }), "stale_controlling_lease");
  assertFinding(mutate((value) => { value.obligations[0].leaseRevisionRef = "lease-r1"; }), "stale_obligation_lease");
  assertFinding(mutate((value) => { value.notices[0].leaseRevisionRef = "lease-r1"; }), "stale_current_notice");
});

test("condition and maintenance state remains reciprocal and attributed", () => {
  assertFinding(mutate((value) => value.conditionItems[0].maintenanceEpisodeRefs.pop()), "incomplete_condition_index");
  assertFinding(mutate((value) => { value.conditionItems[0].assertionState = "landlord-positioned"; }), "invalid_condition_assertion");
  assertFinding(mutate((value) => { value.conditionItems[0].habitabilityDetermination = true; }), "prohibited_condition_determination");
  assertFinding(mutate((value) => value.maintenanceEpisodes[0].accessEventRefs.pop()), "incomplete_maintenance_index");
  assertFinding(mutate((value) => { value.maintenanceEpisodes[0].sourceRefs = ["source-owner-sink-observation", "source-maintenance-response"]; }), "unsupported_maintenance_state");
  assertFinding(mutate((value) => { value.maintenanceEpisodes[0].repairSufficiencyDetermination = true; }), "prohibited_maintenance_conclusion");
});

test("notices keep same-subject authority, chronology, and action coverage", () => {
  assertFinding(mutate((value) => { value.notices[0].sourceRef = "source-maintenance-response"; }), "invalid_notice_source");
  assertFinding(mutate((value) => value.notices[0].actionRefs.pop()), "incomplete_notice_index");
  assertFinding(mutate((value) => { value.notices[0].deadlineAt = "2026-09-13T12:00:00-07:00"; }), "invalid_notice_chronology");
  assertFinding(mutate((value) => { value.notices[0].legalValidityDetermination = true; }), "legal_interpretation_claim");
});

test("owner-completed actions require authorized owners and independent same-subject receipts", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "manager-riverbend"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.actions[0].receiptSourceRef = "source-rent-receipt"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-maintenance-receipt").issuerAuthorityRef = "renter-owner"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-maintenance-receipt"]; }), "missing_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-rent-action", "source-maintenance-receipt"]; }), "cross_subject_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
  assertFinding(mutate((value) => { value.actions.find((row) => row.kind === "make-payment").ownerAuthorityRef = "helper-family"; }), "helper_action_scope_exceeded");
});

test("every action is covered by a semantically compatible obligation", () => {
  assertFinding(mutate((value) => { value.obligations.find((row) => row.kind === "maintenance").actionRefs = ["action-pay-september"]; }), "incompatible_obligation_action");
  assertFinding(mutate((value) => { value.obligations.find((row) => row.kind === "move").actionRefs = []; }), "uncovered_action");
});

test("payments and access events require exact evidence without implied validity or consent", () => {
  assertFinding(mutate((value) => { value.payments[0].obligationRef = "obligation-maintenance"; }), "invalid_payment_binding");
  assertFinding(mutate((value) => { value.payments[0].receiptSourceRef = "source-maintenance-receipt"; }), "invalid_payment_receipt");
  assertFinding(mutate((value) => { value.payments[0].paymentValidityDetermination = true; }), "payment_validity_claim");
  assertFinding(mutate((value) => { value.accessEvents[0].occurredAt = null; }), "unsupported_access_state");
  assertFinding(mutate((value) => { value.accessEvents[0].sourceRefs = ["source-entry-notice"]; }), "unsupported_access_state");
  assertFinding(mutate((value) => { value.accessEvents[0].ownerConsentClaim = true; }), "prohibited_access_conclusion");
});

test("move-out, returned property, and charges remain receipted but non-entitling", () => {
  assertFinding(mutate((value) => { value.returnedProperties[0].actionRef = "action-pay-september"; }), "invalid_return_action");
  assertFinding(mutate((value) => { value.returnedProperties[0].receiptSourceRef = "source-rent-receipt"; }), "invalid_return_receipt");
  assertFinding(mutate((value) => { value.actions.find((row) => row.kind === "return-property").state = "attempted"; }), "inconsistent_return_receipt");
  assertFinding(mutate((value) => { value.actions.find((row) => row.kind === "return-property").receiptSourceRef = "source-maintenance-receipt"; }), "inconsistent_return_receipt");
  assertFinding(mutate((value) => { value.moveStates.find((row) => row.phase === "move-out").chargeRefs = []; }), "incomplete_move_out_index");
  assertFinding(mutate((value) => { value.moveStates[1].closureDetermination = true; }), "premature_closure_claim");
  assertFinding(mutate((value) => { value.charges[0].statementSourceRef = "source-rent-statement"; }), "invalid_charge_statement");
  assertFinding(mutate((value) => { value.charges[0].entitlementDetermination = true; }), "entitlement_claim");
  assertFinding(mutate((value) => { value.charges[0].state = "paid"; }), "invalid_charge_payment");
  assertFinding(mutate((value) => { value.charges[0].state = "credited"; value.charges[0].paymentRef = "payment-september"; }), "invalid_charge_payment");
});

test("gaps and review indexes preserve unresolved tenancy state exactly", () => {
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].subjectRefs = [value.gaps[0].id]; }), "self_referential_gap");
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.disputedChargeRefs.pop()), "incomplete_disputed_charge_index");
  assertFinding(mutate((value) => { value.review.deadlineRefs = ["charge-cleaning"]; }), "invalid_deadline_ref");
  assertFinding(mutate((value) => value.review.deadlineRefs.pop()), "incomplete_deadline_index");
  assertFinding(mutate((value) => { value.review.entitlementConclusion = true; }), "premature_review_conclusion");
});

test("strict schema forbids hidden fields, secrets, and prohibited authority", () => {
  const hidden = mutate((value) => { value.tenancy.preciseAddress = "not allowed"; });
  assert.equal(validateSchema(hidden), false);

  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");

  const authority = mutate((value) => { value.prohibitedActions.payment = true; });
  assert.equal(validateSchema(authority), false);
  assertFinding(authority, "prohibited_authority_claim");
});
