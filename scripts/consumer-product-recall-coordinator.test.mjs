import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { consumerProductRecallFindings } from "./consumer-product-recall-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/consumer-product-recall-coordinator/fixtures/consumer-recall-ledger.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/consumer-product-recall-coordinator/schemas/consumer-recall-ledger.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = consumerProductRecallFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted consumer recall ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(consumerProductRecallFindings(fixture), []);
});

test("public artifact CLI accepts the packaged consumer recall fixture", () => {
  const cli = spawnSync(process.execPath, [
    "scripts/validate-artifact.mjs",
    "consumer-product-recall-coordinator",
    "sources/consumer-product-recall-coordinator/fixtures/consumer-recall-ledger.example.json",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "recall", [], {}, { portfolio: {}, sources: [null], actions: [null] }, { portfolio: { authorizedHelperRefs: {} }, actions: [{ id: "action-bad", ownerAuthorityRef: "helper-bad" }] }]) {
    assert.doesNotThrow(() => consumerProductRecallFindings(value));
    assert.ok(consumerProductRecallFindings(value).length > 0);
  }
});

test("portfolio indexes, global identity, and revision boundary are exact", () => {
  assertFinding(mutate((value) => value.portfolio.outcomeRefs.pop()), "incomplete_portfolio_index");
  assertFinding(mutate((value) => { value.gaps[0].id = value.actions[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.nextRevision = 9; }), "invalid_revision_lineage");
  assertFinding(mutate((value) => { value.review.asOf = "2026-09-24T17:00:00-07:00"; }), "invalid_review_boundary");
});

test("owner, helper, and privacy authority remain bounded", () => {
  assertFinding(mutate((value) => { value.portfolio.ownerAuthorityRef = "regulator-products"; }), "invalid_owner_authority");
  assertFinding(mutate((value) => { value.portfolio.authorizedHelperRefs = []; }), "incomplete_helper_index");
  assertFinding(mutate((value) => { value.authorities.find((row) => row.id === "helper-household").authorizationSourceRef = "source-power-inventory"; }), "invalid_helper_authorization");
  assertFinding(mutate((value) => { value.products[0].generalizedLabel = "owner@example.test"; }), "secret_bearing_text");
  assertFinding(mutate((value) => { value.instructions[0].summary = "Deliver to 123 Main Street"; }), "secret_bearing_text");
  assertFinding(mutate((value) => { value.identityClaims[0].valueRef = "4111111111111111"; }), "secret_bearing_text");
});

test("sources enforce exact subject, authority, jurisdiction, chronology, and minimization", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-power-campaign-r2").issuerAuthorityRef = "owner-household"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-power-lookup").subjectRef = "product-power-bank"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].jurisdiction = "us-ny-example"; }), "invalid_source_jurisdiction");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-26T00:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "workspace://recall/api-key=secret"; }), "secret_bearing_source");
});

test("products and identity claims are reciprocal and evidence-bound", () => {
  assertFinding(mutate((value) => value.products[1].gapRefs.pop()), "incomplete_product_index");
  assertFinding(mutate((value) => { value.identityClaims[0].sourceRefs = ["source-blender-inventory"]; }), "invalid_identity_evidence");
  assertFinding(mutate((value) => { value.products[0].defectDetermination = true; }), "prohibited_product_determination");
});

test("campaign revisions preserve one current revision and reciprocal lineage", () => {
  assertFinding(mutate((value) => { value.campaigns[0].state = "current"; }), "invalid_current_campaign");
  assertFinding(mutate((value) => { value.campaigns[0].successorRef = null; }), "invalid_campaign_lineage");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-power-campaign-r2").freshness = "stale"; }), "stale_current_campaign");
  assertFinding(mutate((value) => value.campaigns[1].criterionRefs.pop()), "incomplete_campaign_index");
  assertFinding(mutate((value) => { value.campaigns[1].sourceRef = "source-power-campaign-r1"; }), "invalid_campaign_source");
});

test("criteria, instructions, and remedies remain campaign-attributed", () => {
  assertFinding(mutate((value) => { value.criteria[1].sourceRef = "source-power-campaign-r1"; }), "invalid_criterion_source");
  assertFinding(mutate((value) => { value.instructions[1].sourceRef = "source-power-campaign-r1"; }), "invalid_instruction_attribution");
  assertFinding(mutate((value) => { value.instructions[1].adviceByClaw = true; }), "advice_claim");
  assertFinding(mutate((value) => { value.remedies[1].prerequisiteCriterionRefs = ["criterion-blender-model"]; }), "cross_campaign_remedy_criterion");
  assertFinding(mutate((value) => { value.remedies[1].entitlementDetermination = true; }), "entitlement_claim");
});

test("applicability cannot launder similarity into authoritative status", () => {
  assertFinding(mutate((value) => { value.identityClaims.find((row) => row.id === "identity-power-lot").valueRef = "lot-similar"; }), "non_exact_applicability_claim");
  assertFinding(mutate((value) => { value.applicabilityChecks[0].resultSourceRef = null; }), "invalid_authoritative_result");
  assertFinding(mutate((value) => { value.applicabilityChecks[1].state = "possible-match"; value.applicabilityChecks[1].resultSourceRef = "source-power-lookup"; }), "premature_applicability_result");
  assertFinding(mutate((value) => value.applicabilityChecks[0].criterionRefs.pop()), "incomplete_applicability_criteria");
  assertFinding(mutate((value) => { value.applicabilityChecks[0].outcomeRef = null; }), "invalid_corrected_applicability");
  assertFinding(mutate((value) => { value.applicabilityChecks[0].eligibilityDetermination = true; }), "prohibited_applicability_determination");
});

test("actions remain owner-controlled and completed work needs independent receipts", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "helper-household"; }), "helper_action_scope_exceeded");
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "regulator-products"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-power-correction-receipt").issuerAuthorityRef = "owner-household"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].sourceRefs = ["source-power-correction-receipt"]; }), "missing_action_evidence");
  assertFinding(mutate((value) => { value.actions[0].state = "attempted"; }), "premature_action_receipt");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "external_authority_claim");
});

test("correction outcomes stay same-subject, independently receipted, and non-concluding", () => {
  assertFinding(mutate((value) => { value.outcomes[0].actionRef = "action-blender-review"; }), "cross_subject_outcome");
  assertFinding(mutate((value) => { value.outcomes[0].sourceRef = "source-power-action"; }), "invalid_outcome_receipt");
  assertFinding(mutate((value) => { value.outcomes[0].correctionSufficiencyDetermination = true; }), "premature_outcome_conclusion");
});

test("gaps and review indexes preserve every unresolved or deadline-bearing state", () => {
  assertFinding(mutate((value) => { value.gaps[0].state = "resolved"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].subjectRefs = [value.gaps[0].id]; }), "self_referential_gap");
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.deadlineRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.safetyConclusion = true; }), "premature_review_conclusion");
});

test("strict schema forbids hidden fields, secrets, and prohibited authority", () => {
  const hidden = mutate((value) => { value.products[0].fullSerial = "not allowed"; });
  assert.equal(validateSchema(hidden), false);
  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");
  const authority = mutate((value) => { value.prohibitedActions.shipping = true; });
  assert.equal(validateSchema(authority), false);
  assertFinding(authority, "prohibited_authority_claim");
});
