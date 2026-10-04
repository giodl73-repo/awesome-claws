import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { homePurchaseTransactionFindings } from "./home-purchase-transaction-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/home-purchase-transaction-coordinator/fixtures/home-purchase-transaction.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/home-purchase-transaction-coordinator/schemas/home-purchase-transaction.schema.json", import.meta.url), "utf8"));
const handoffTemplate = await readFile(new URL("../sources/home-purchase-transaction-coordinator/templates/home-purchase-transaction.md", import.meta.url), "utf8");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = homePurchaseTransactionFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted home purchase ledger is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(homePurchaseTransactionFindings(fixture), []);
});

test("public artifact CLI accepts the packaged home purchase fixture", () => {
  const cli = spawnSync(process.execPath, [
    "scripts/validate-artifact.mjs",
    "home-purchase-transaction-coordinator",
    "sources/home-purchase-transaction-coordinator/fixtures/home-purchase-transaction.example.json",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "purchase", [], {}, { transaction: {}, review: {}, authorities: [null], sources: [null], milestones: [null] }]) {
    assert.doesNotThrow(() => homePurchaseTransactionFindings(value));
    assert.ok(homePurchaseTransactionFindings(value).length > 0);
  }
});

test("global identity, review time, and exact transaction indexes fail closed", () => {
  assertFinding(mutate((value) => { value.gaps[0].id = value.milestones[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.asOf = "2026-09-26T09:01:00-07:00"; }), "invalid_transaction_chronology");
  assertFinding(mutate((value) => value.transaction.sourceRefs.pop()), "incomplete_transaction_index");
  assertFinding(mutate((value) => value.transaction.conditionRefs.pop()), "incomplete_transaction_index");
});

test("buyer ownership remains current, same-transaction, documented, and review-scoped", () => {
  assertFinding(mutate((value) => { value.transaction.buyerAuthorityRef = "broker-river"; }), "invalid_buyer_authority");
  assertFinding(mutate((value) => { value.authorities[0].scope = ["source-issuer"]; }), "invalid_buyer_authority");
  assertFinding(mutate((value) => { value.authorities[0].transactionRef = "other-transaction"; }), "cross_transaction_record");
  assertFinding(mutate((value) => { value.sources[0].freshness = "stale"; }), "invalid_authority_evidence");
  assertFinding(mutate((value) => { value.review.nextOwnerAuthorityRef = "broker-river"; }), "invalid_buyer_authority");
  assertFinding(mutate((value) => { value.authorities[1].scope.push("transaction-owner"); }), "invalid_authority_scope");
});

test("sources preserve kind authority, exact subjects, chronology, minimization, and amount pairs", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-appraisal").issuerAuthorityRef = "buyer-alex"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-title-commitment").subjectRef = "not-a-record"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-27T10:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "controlled://buyer/password=secret-value"; }), "secret_bearing_source");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-settlement-estimate").currency = null; }), "invalid_amount_currency");
  assertFinding(mutate((value) => { value.transaction.generalizedPropertyRef = "123 Main Street"; }), "secret_bearing_text");
});

test("records may cite only current evidence bound to an exact related subject", () => {
  assertFinding(mutate((value) => {
    value.deadlines.find((row) => row.id === "deadline-financing").sourceRefs = ["source-title-commitment"];
  }), "irrelevant_source_reference");
  assertFinding(mutate((value) => {
    value.milestones.find((row) => row.id === "milestone-contract").sourceRefs = ["source-contract-v1"];
  }), "irrelevant_source_reference");
});

test("cross-record relationships require reciprocal references", () => {
  assertFinding(mutate((value) => {
    value.deadlines.find((row) => row.id === "deadline-closing").subjectRefs = ["milestone-contract", "milestone-closing", "workstream-closing"];
  }), "incomplete_reciprocal_reference");
  assertFinding(mutate((value) => {
    value.gaps.find((row) => row.id === "gap-title").subjectRefs = ["condition-title-exception", "milestone-closing", "workstream-title", "workstream-closing", "question-title"];
  }), "incomplete_reciprocal_reference");
});

test("contract revision lineage is single-current, ordered, and same-source", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-contract-v1").freshness = "current"; }), "ambiguous_source_revision");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-contract-v2").stableSourceRef = "different-contract"; }), "invalid_source_lineage");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-contract-v2").supersedesSourceRef = "source-appraisal"; }), "invalid_source_lineage");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-contract-v2").supersedesSourceRef = null; }), "invalid_source_lineage");
  assertFinding(mutate((value) => { for (const row of value.sources) if (row.kind === "contract-revision") row.freshness = "stale"; }), "missing_current_contract");
});

test("milestones retain exact amounts, cited evidence, open gaps, and no readiness claim", () => {
  assertFinding(mutate((value) => { value.milestones.find((row) => row.id === "milestone-contract").amountMinorUnits = 48000000; }), "unsupported_milestone_amount");
  assertFinding(mutate((value) => { value.milestones.find((row) => row.id === "milestone-settlement").currency = null; }), "invalid_amount_currency");
  assertFinding(mutate((value) => { value.milestones.find((row) => row.id === "milestone-financing").gapRefs = []; }), "unowned_milestone_blocker");
  assertFinding(mutate((value) => { value.milestones[0].readinessDeterminationByClaw = true; }), "prohibited_professional_conclusion");
});

test("conditions require exact human decisions and buyer-owned explicit waivers", () => {
  assertFinding(mutate((value) => {
    const row = value.conditions.find((item) => item.id === "condition-financing-docs");
    row.state = "satisfied-by-authority";
    row.decidedByAuthorityRef = "lender-home";
    row.decisionSourceRef = "source-lender-conditions";
  }), "invalid_condition_decision");
  assertFinding(mutate((value) => {
    const row = value.conditions.find((item) => item.id === "condition-inspection-response");
    row.state = "waived-by-owner";
    row.decidedByAuthorityRef = "buyer-alex";
    row.decisionSourceRef = "source-owner-earnest-note";
  }), "unauthorized_condition_waiver");
  assertFinding(mutate((value) => { value.conditions[0].gapRefs = []; }), "unowned_condition_blocker");
});

test("deadlines preserve exact confirmation evidence and unresolved conflicts", () => {
  assertFinding(mutate((value) => { value.deadlines[0].confirmationSourceRef = "source-contract-v2"; }), "invalid_deadline_confirmation");
  assertFinding(mutate((value) => { value.deadlines[2].confirmedByAuthorityRef = "broker-river"; }), "invalid_deadline_confirmation");
  assertFinding(mutate((value) => { value.deadlines.find((row) => row.id === "deadline-financing").gapRefs = []; }), "unowned_deadline_blocker");
  assertFinding(mutate((value) => { value.deadlines[0].candidateAt = "2026-09-22"; }), "invalid_deadline_chronology");
});

test("professional workstreams keep qualified owners, owner-issued completion, and blockers", () => {
  assertFinding(mutate((value) => { value.workstreams.find((row) => row.id === "workstream-appraisal").ownerAuthorityRef = "inspector-safe"; }), "invalid_workstream_owner");
  assertFinding(mutate((value) => { value.workstreams.find((row) => row.id === "workstream-appraisal").sourceRefs = ["source-contract-v2"]; }), "unsupported_workstream_completion");
  assertFinding(mutate((value) => { value.workstreams.find((row) => row.id === "workstream-title").gapRefs = []; }), "unowned_workstream_blocker");
  assertFinding(mutate((value) => { value.workstreams[0].professionalConclusionByClaw = true; }), "prohibited_professional_conclusion");
});

test("owner actions require the buyer, chronology, independent receipts, and exact amounts", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "title-harbor"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.actions[0].receiptSourceRef = "source-owner-earnest-note"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-earnest-receipt").issuerAuthorityRef = "buyer-alex"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-owner-earnest-note").amountMinorUnits = 1400000; }), "invalid_action_amount");
  assertFinding(mutate((value) => { value.actions[1].attemptedAt = "2026-09-25T12:00:00-07:00"; }), "invalid_action_chronology");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "prohibited_action_execution");
});

test("professional questions preserve kind-specific authority and exact answer evidence", () => {
  assertFinding(mutate((value) => { value.questions.find((row) => row.id === "question-wire-safety").askedOfAuthorityRef = "lender-home"; }), "invalid_question_authority");
  assertFinding(mutate((value) => {
    const row = value.questions.find((item) => item.id === "question-title");
    row.state = "answered";
    row.answerSourceRef = "source-title-commitment";
  }), "invalid_question_answer");
  assertFinding(mutate((value) => { value.questions[0].interpretationByClaw = true; }), "prohibited_professional_conclusion");
});

test("gaps retain exact owners and independent resolution evidence", () => {
  assertFinding(mutate((value) => { value.gaps[0].nextOwnerAuthorityRef = "missing-owner"; }), "invalid_gap_owner");
  assertFinding(mutate((value) => {
    value.gaps[0].state = "resolved";
    value.gaps[0].resolutionSourceRef = "source-repair-response";
  }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].resolutionSourceRef = "source-repair-response"; }), "invalid_gap_resolution");
});

test("review indexes mirror blockers and cannot become clear-to-close", () => {
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.wireSafetyQuestionRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.state = "ready-for-buyer-review"; }), "premature_review_readiness");
  assertFinding(mutate((value) => { value.review.clearToCloseClaim = true; }), "prohibited_professional_conclusion");
  assertFinding(mutate((value) => { value.prohibitedActions.fundTransfer = true; }), "prohibited_authority_claim");
});

test("strict schema forbids hidden fields, secrets, and authority mutation", () => {
  const hidden = mutate((value) => { value.transaction.preciseAddress = "not allowed"; });
  assert.equal(validateSchema(hidden), false);
  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");
  const action = mutate((value) => { value.prohibitedActions.payment = true; });
  assert.equal(validateSchema(action), false);
  assertFinding(action, "prohibited_authority_claim");
});

test("artifact template exposes the full review and authority contract", () => {
  for (const marker of [
    "Authority and source revisions",
    "Milestones and conditions",
    "Deadlines",
    "Professional workstreams",
    "Buyer-controlled actions",
    "Qualified-human questions and gaps",
    "Exact review indexes",
    "Prohibited authority",
    "wire-validation conclusion fields",
  ]) assert.match(handoffTemplate, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});
