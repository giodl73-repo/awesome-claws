import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { estateAdministrationFindings } from "./estate-administration-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/estate-administration-coordinator/fixtures/estate-administration.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/estate-administration-coordinator/schemas/estate-administration.schema.json", import.meta.url), "utf8"));
const handoffTemplate = await readFile(new URL("../sources/estate-administration-coordinator/templates/estate-administration.md", import.meta.url), "utf8");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = estateAdministrationFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted estate administration ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(estateAdministrationFindings(fixture), []);
});

test("public artifact CLI accepts the packaged estate administration fixture", () => {
  const cli = spawnSync(process.execPath, [
    "scripts/validate-artifact.mjs",
    "estate-administration-coordinator",
    "sources/estate-administration-coordinator/fixtures/estate-administration.example.json",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "estate", [], {}, { estate: {}, review: {}, authorities: [null], sources: [null], assets: [null] }]) {
    assert.doesNotThrow(() => estateAdministrationFindings(value));
    assert.ok(estateAdministrationFindings(value).length > 0);
  }
});

test("global identity, review time, and exact estate indexes fail closed", () => {
  assertFinding(mutate((value) => { value.gaps[0].id = value.assets[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.asOf = "2026-09-25T16:01:00-07:00"; }), "invalid_estate_chronology");
  assertFinding(mutate((value) => value.estate.assetRefs.pop()), "incomplete_estate_index");
  assertFinding(mutate((value) => value.estate.sourceRefs.pop()), "incomplete_estate_index");
});

test("appointment authority remains current, same-estate, court-issued, and review-scoped", () => {
  assertFinding(mutate((value) => { value.estate.personalRepresentativeAuthorityRef = "counsel-river"; }), "invalid_estate_authority");
  assertFinding(mutate((value) => { value.authorities[0].scope = ["source-issuer"]; }), "invalid_estate_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-appointment").freshness = "stale"; }), "invalid_authority_evidence");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-appointment").issuerAuthorityRef = "counsel-river"; }), "invalid_authority_evidence");
  assertFinding(mutate((value) => { value.review.nextOwnerAuthorityRef = "counsel-river"; }), "invalid_estate_authority");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "counsel-river").scope.push("estate-administration-owner"); }), "invalid_authority_evidence");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "counsel-river").authorizationSourceRef = "missing-source"; }), "invalid_authority_evidence");
});

test("sources preserve kind authority, exact subjects, chronology, and minimization", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-home-value").issuerAuthorityRef = "representative-alex"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-home-value").subjectRef = "not-an-estate-record"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T10:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "vault://estate/token=secret-value"; }), "secret_bearing_source");
  assertFinding(mutate((value) => { value.assets[0].label = "account=123456789"; }), "secret_bearing_text");
});

test("assets retain exact estate, ownership, valuation, and reciprocal ledgers", () => {
  assertFinding(mutate((value) => { value.assets[0].estateRef = "other-estate"; }), "cross_estate_record");
  assertFinding(mutate((value) => { value.assets[0].ownershipSourceRefs = ["source-home-asset"]; }), "invalid_asset_source");
  assertFinding(mutate((value) => { value.assets[0].valuationSourceRefs = ["source-home-value"]; }), "invalid_asset_source");
  assertFinding(mutate((value) => { value.assets[0].valueMinorUnits = null; }), "invalid_asset_value");
  assertFinding(mutate((value) => { value.assets[2].valueMinorUnits = 1; value.assets[2].currency = "USD"; }), "invalid_asset_value");
  assertFinding(mutate((value) => { value.assets[0].currency = null; }), "invalid_asset_value");
  assertFinding(mutate((value) => value.assets[0].gapRefs.pop()), "incomplete_asset_index");
  assertFinding(mutate((value) => { value.assets[0].ownershipDeterminationByClaw = true; }), "prohibited_professional_conclusion");
});

test("liabilities and claims remain source-bound, reciprocal, and undecided", () => {
  assertFinding(mutate((value) => { value.liabilities[0].sourceRefs = ["source-home-asset"]; }), "invalid_liability_source");
  assertFinding(mutate((value) => { value.liabilities[0].amountMinorUnits = null; }), "invalid_liability_amount");
  assertFinding(mutate((value) => { value.liabilities[1].claimRef = null; }), "invalid_claim_binding");
  assertFinding(mutate((value) => { value.claims[0].claimantAuthorityRef = "beneficiary-casey"; }), "invalid_claim_binding");
  assertFinding(mutate((value) => { value.claims[0].state = "allowed-by-authority"; }), "invalid_claim_decision");
  assertFinding(mutate((value) => { value.claims[0].decisionSourceRef = "source-creditor-claim"; }), "invalid_claim_decision");
  assertFinding(mutate((value) => { value.claims[0].currency = null; }), "invalid_claim_binding");
  assertFinding(mutate((value) => { value.claims[0].actionRefs = []; }), "invalid_claim_binding");
  assertFinding(mutate((value) => { value.claims[0].gapRefs = []; }), "invalid_claim_binding");
  assertFinding(mutate((value) => { value.liabilities[1].priorityDeterminationByClaw = true; }), "prohibited_professional_conclusion");
  assert.match(handoffTemplate, /\{\{claims\[\]\.actionRefs\}\}/u);
});

test("notices require personal-representative ownership and independent receipts", () => {
  assertFinding(mutate((value) => { value.notices[0].ownerAuthorityRef = "counsel-river"; }), "invalid_notice_receipt");
  assertFinding(mutate((value) => { value.notices[0].receiptSourceRef = "source-action-notice-receipt"; }), "invalid_notice_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-creditor-notice-receipt").issuerAuthorityRef = "representative-alex"; }), "invalid_notice_receipt");
  assertFinding(mutate((value) => { value.notices[1].noticeAt = "2026-09-24T09:00:00-07:00"; }), "invalid_notice_receipt");
  assertFinding(mutate((value) => { value.notices[0].applicabilityDeterminationByClaw = true; }), "prohibited_professional_conclusion");
});

test("deadlines preserve exact subjects, evidence, candidates, and qualified confirmation", () => {
  assertFinding(mutate((value) => { value.deadlines[0].subjectRefs = ["not-a-subject"]; }), "invalid_deadline");
  assertFinding(mutate((value) => { value.deadlines[0].sourceRefs = ["source-home-value"]; }), "invalid_deadline");
  assertFinding(mutate((value) => { value.deadlines[1].candidateAt = "2026-10-01T17:00:00-07:00"; }), "invalid_deadline");
  assertFinding(mutate((value) => { value.deadlines[0].confirmedByAuthorityRef = "counsel-river"; }), "invalid_deadline_confirmation");
  assertFinding(mutate((value) => { value.deadlines[0].state = "confirmed"; }), "invalid_deadline_confirmation");
  assertFinding(mutate((value) => { value.deadlines[0].applicabilityDeterminationByClaw = true; }), "prohibited_professional_conclusion");
});

test("external actions remain owner-controlled, chronological, and independently receipted", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "counsel-river"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.actions[1].attemptedAt = null; }), "invalid_action_chronology");
  assertFinding(mutate((value) => { value.actions[1].sourceRefs = []; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].receiptSourceRef = "source-creditor-notice-receipt"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-action-notice-receipt").issuerAuthorityRef = "representative-alex"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
});

test("distributions stay proposals until exact authority, owner execution, and beneficiary receipt", () => {
  assertFinding(mutate((value) => { value.distributions[0].beneficiaryAuthorityRef = "claimant-services"; }), "invalid_distribution");
  assertFinding(mutate((value) => { value.distributions[0].assetRefs = ["not-an-asset"]; }), "invalid_distribution");
  assertFinding(mutate((value) => { value.distributions[0].proposalSourceRef = "source-creditor-claim"; }), "invalid_distribution");
  assertFinding(mutate((value) => { value.distributions[0].currency = null; }), "invalid_distribution");
  assertFinding(mutate((value) => { value.distributions[0].state = "approved-by-authority"; }), "invalid_distribution_approval");
  assertFinding(mutate((value) => { value.distributions[0].actionRef = "action-creditor-notice"; }), "invalid_distribution_receipt");
  assertFinding(mutate((value) => { value.distributions[0].entitlementDeterminationByClaw = true; }), "prohibited_professional_conclusion");
});

test("professional questions require exact routing, evidence, and same-question answers", () => {
  assertFinding(mutate((value) => { value.questions[0].askedOfAuthorityRef = "tax-professional-morgan"; }), "invalid_question_authority");
  assertFinding(mutate((value) => { value.questions[1].subjectRefs = ["not-a-subject"]; }), "invalid_question_evidence");
  assertFinding(mutate((value) => { value.questions[2].sourceRefs = ["source-creditor-claim"]; }), "invalid_question_evidence");
  assertFinding(mutate((value) => { value.questions[0].answerSourceRef = "source-creditor-claim"; }), "invalid_question_answer");
  assertFinding(mutate((value) => { value.questions[0].state = "answered"; value.questions[0].answerSourceRef = "source-creditor-claim"; }), "invalid_question_answer");
  assertFinding(mutate((value) => { value.questions[0].interpretationByClaw = true; }), "prohibited_professional_conclusion");
});

test("gaps retain exact subjects, qualified owners, evidence, and independent resolution", () => {
  assertFinding(mutate((value) => { value.gaps[0].nextOwnerAuthorityRef = "representative-alex"; }), "invalid_gap_owner");
  assertFinding(mutate((value) => { value.gaps[0].subjectRefs = [value.gaps[0].id]; }), "invalid_gap_evidence");
  assertFinding(mutate((value) => { value.gaps[2].sourceRefs = ["source-home-value"]; }), "invalid_gap_evidence");
  assertFinding(mutate((value) => { value.gaps[0].resolutionSourceRef = "source-owner-inventory"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
});

test("review indexes and readiness expose every unresolved estate state", () => {
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.missingReceiptActionRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.state = "ready-for-personal-representative-review"; }), "premature_review_readiness");
  assertFinding(mutate((value) => {
    value.questions.forEach((row) => { row.state = "answered"; row.answerSourceRef = row.id === "question-ownership" ? "source-ownership-answer" : row.id === "question-tax" ? "source-tax-answer" : "source-value-answer"; });
    value.gaps.forEach((row) => { row.state = "resolved"; row.resolutionSourceRef = row.id === "gap-ownership" ? "source-ownership-resolution" : row.id === "gap-value" ? "source-value-resolution" : "source-receipt-resolution"; });
    value.claims[0].state = "received";
    value.assets[2].ownershipEvidenceState = "supported";
    value.assets[2].valueState = "current";
    value.assets[2].valueMinorUnits = 0;
    value.assets[2].currency = "USD";
    value.liabilities[1].amountState = "documented";
    value.actions[1].state = "owner-completed-receipted";
    value.actions[1].receiptSourceRef = "source-action-bank-receipt";
    value.distributions[0].state = "withdrawn";
    value.review.openQuestionRefs = [];
    value.review.openGapRefs = [];
    value.review.disputedClaimRefs = [];
    value.review.unknownOwnershipAssetRefs = [];
    value.review.valueGapAssetRefs = [];
    value.review.unresolvedLiabilityRefs = [];
    value.review.missingReceiptActionRefs = [];
    value.review.proposedDistributionRefs = [];
    value.review.state = "ready-for-personal-representative-review";
    value.deadlines[0].state = "conflicting";
  }), "premature_review_readiness");
  assertFinding(mutate((value) => { value.review.solvencyConclusion = true; }), "prohibited_professional_conclusion");
  assertFinding(mutate((value) => { value.prohibitedActions.payment = true; }), "prohibited_authority_claim");
});

test("strict schema forbids hidden fields, authority claims, and action mutation", () => {
  const hidden = mutate((value) => { value.assets[0].accountNumber = "not allowed"; });
  assert.equal(validateSchema(hidden), false);
  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");
  const action = mutate((value) => { value.prohibitedActions.distribution = true; });
  assert.equal(validateSchema(action), false);
  assertFinding(action, "prohibited_authority_claim");
});
