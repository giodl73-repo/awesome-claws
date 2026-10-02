import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { collegeApplicationFindings } from "./college-application-coordinator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/college-application-coordinator/fixtures/college-application-portfolio.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/college-application-coordinator/schemas/college-application-portfolio.schema.json", import.meta.url), "utf8"));
const template = await readFile(new URL("../sources/college-application-coordinator/templates/college-application-portfolio.md", import.meta.url), "utf8");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = collegeApplicationFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted college application portfolio is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(collegeApplicationFindings(fixture), []);
});

test("fixture deadlines preserve local wall time across the daylight-saving change", () => {
  for (const requirement of fixture.requirements) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: requirement.timezone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(requirement.dueAt));
    const local = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    assert.equal(`${local.year}-${local.month}-${local.day}T${local.hour}:${local.minute}`, requirement.dueAt.slice(0, 16), requirement.id);
  }
});

test("public artifact CLI accepts the packaged portfolio fixture", () => {
  const cli = spawnSync(process.execPath, [
    "scripts/validate-artifact.mjs",
    "college-application-coordinator",
    "sources/college-application-coordinator/fixtures/college-application-portfolio.example.json",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "college", [], {}, { portfolio: {}, review: {}, authorities: [null], sources: [null], applications: [null] }]) {
    assert.doesNotThrow(() => collegeApplicationFindings(value));
    assert.ok(collegeApplicationFindings(value).length > 0);
  }
});

test("global identity, exact as-of time, and portfolio indexes fail closed", () => {
  assertFinding(mutate((value) => { value.gaps[0].id = value.materials[0].id; }), "duplicate_identity");
  assertFinding(mutate((value) => { value.review.asOf = "2026-09-26T09:01:00-07:00"; }), "invalid_portfolio_chronology");
  assertFinding(mutate((value) => value.portfolio.sourceRefs.pop()), "incomplete_portfolio_index");
  assertFinding(mutate((value) => value.portfolio.requirementRefs.pop()), "incomplete_portfolio_index");
});

test("applicant ownership remains current, documented, and review-scoped", () => {
  assertFinding(mutate((value) => { value.portfolio.applicantAuthorityRef = "adviser-jordan"; }), "invalid_applicant_authority");
  assertFinding(mutate((value) => { value.authorities[0].scope = ["source-issuer"]; }), "invalid_applicant_authority");
  assertFinding(mutate((value) => { value.sources[0].freshness = "stale"; }), "invalid_applicant_authority");
  assertFinding(mutate((value) => { value.review.nextOwnerAuthorityRef = "adviser-jordan"; }), "invalid_applicant_authority");
  assertFinding(mutate((value) => { value.authorities[1].scope.push("material-author"); }), "invalid_authority_scope");
  assertFinding(mutate((value) => {
    value.authorities.push({ ...value.authorities[0], id: "applicant-second", label: "Second applicant" });
    value.portfolio.authorityRefs.push("applicant-second");
  }), "invalid_applicant_authority");
});

test("sources preserve exact authority, subject, chronology, privacy, and revision lineage", () => {
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-test").issuerAuthorityRef = "applicant-morgan"; }), "invalid_source_authority");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-transcript").subjectRef = "not-a-record"; }), "invalid_source_subject");
  assertFinding(mutate((value) => { value.sources[0].retrievedAt = "2026-09-27T10:00:00-07:00"; }), "invalid_source_chronology");
  assertFinding(mutate((value) => { value.sources[0].controlledRef = "controlled://applicant/password=secret-value"; }), "secret_bearing_source");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-red-program-v1").freshness = "current"; }), "ambiguous_source_revision");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-red-program-v2").supersedesSourceRef = null; }), "invalid_source_lineage");
});

test("applications remain exact-program and exact-cycle with current institution evidence", () => {
  assertFinding(mutate((value) => { value.applications[1].cycle = "spring-2028"; }), "cross_cycle_application");
  assertFinding(mutate((value) => {
    value.applications[1].institutionRef = value.applications[0].institutionRef;
    value.applications[1].programRef = value.applications[0].programRef;
    value.applications[1].round = value.applications[0].round;
  }), "duplicate_application_scope");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-blue-program").freshness = "stale"; }), "missing_current_program_requirements");
  assertFinding(mutate((value) => { value.applications[1].sourceRefs = ["source-red-program-v2"]; }), "irrelevant_source_reference");
  assertFinding(mutate((value) => {
    value.applications[1].state = "withdrawn";
    value.review.incompleteApplicationRefs = [];
    value.review.unresolvedDecisionApplicationRefs = [];
  }), "unsupported_application_state");
  assertFinding(mutate((value) => {
    value.applications[0].state = "submitted-receipted";
    value.review.unresolvedDecisionApplicationRefs = ["application-blue"];
  }), "unsupported_application_state");
  assertFinding(mutate((value) => {
    value.applications[0].state = "conflicting";
    value.review.incompleteApplicationRefs = ["application-red", "application-blue"];
  }), "unowned_application_blocker");
  assertFinding(mutate((value) => {
    value.applications[0].state = "submitted-receipted";
    value.decisions[0].outcome = "pending";
    value.review.unresolvedDecisionApplicationRefs = ["application-blue"];
  }), "incomplete_review_index");
  assertFinding(mutate((value) => {
    value.decisions[0].kind = "financial-aid";
    value.decisions[0].outcome = "offer";
  }), "unsupported_application_state");
  assertFinding(mutate((value) => {
    value.applications[1].state = "submitted-receipted";
    value.submissions[1].kind = "transcript";
    value.submissions[1].state = "submitted-receipted";
    value.review.incompleteApplicationRefs = [];
    value.review.unreceiptedSubmissionRefs = [];
  }), "unsupported_application_state");
});

test("applicant materials prevent authorship substitution and preserve paired revision lineage", () => {
  assertFinding(mutate((value) => { value.materials[2].authorAuthorityRef = "adviser-jordan"; }), "invalid_material_author");
  assertFinding(mutate((value) => { value.materials[2].authoredByClaw = true; }), "prohibited_authorship_substitution");
  assertFinding(mutate((value) => { value.materials[1].supersedesMaterialRef = null; }), "invalid_material_lineage");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-essay-v2").supersedesSourceRef = "source-red-program-v1"; }), "invalid_material_lineage");
  assertFinding(mutate((value) => { value.materials[0].state = "draft"; }), "invalid_material_source");
  assertFinding(mutate((value) => { value.materials[2].state = "draft"; }), "unsupported_requirement_state");
});

test("third-party records reject self-issued or mismatched evidence and retain blockers", () => {
  assertFinding(mutate((value) => { value.records[0].issuerAuthorityRef = "applicant-morgan"; }), "invalid_record_issuer");
  assertFinding(mutate((value) => { value.records[1].sourceRef = "source-transcript"; }), "invalid_record_source");
  assertFinding(mutate((value) => { value.records[3].gapRefs = []; }), "unowned_record_blocker");
  assertFinding(mutate((value) => {
    value.applications[0].recordRefs = value.applications[0].recordRefs.filter((ref) => ref !== "record-transcript");
  }), "incomplete_reciprocal_reference");
  assertFinding(mutate((value) => {
    const item = value.records.find((row) => row.id === "record-transcript");
    item.state = "received-stale";
    item.sourceRef = "source-test";
    item.gapRefs = ["gap-blue-portal"];
  }), "invalid_record_source");
  assertFinding(mutate((value) => {
    const item = value.records.find((row) => row.id === "record-recommendation-blue");
    item.state = "waived-by-institution";
    item.gapRefs = [];
  }), "invalid_record_waiver");
  assertFinding(mutate((value) => {
    value.records.find((row) => row.id === "record-recommendation-blue").gapRefs = ["gap-blue-portal"];
  }), "unowned_record_blocker");
});

test("requirements reject cross-application, stale, missing, and falsely ready evidence", () => {
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-transcript").recordRefs = ["record-recommendation-red"]; }), "cross_application_reference");
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-transcript").sourceRefs = ["source-red-program-v2"]; }), "irrelevant_source_reference");
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-recommendation").gapRefs = []; }), "unowned_requirement_blocker");
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-recommendation").state = "ready"; }), "unsupported_requirement_state");
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-form").submissionRefs = []; }), "unsupported_requirement_state");
  assertFinding(mutate((value) => { value.requirements.find((row) => row.id === "requirement-blue-transcript").recordRefs = []; }), "unsupported_requirement_state");
  assertFinding(mutate((value) => {
    const requirement = value.requirements.find((row) => row.id === "requirement-blue-form");
    requirement.state = "waived-by-institution";
    requirement.sourceRefs = ["source-owner-submit-blue"];
  }), "invalid_requirement_waiver");
  assertFinding(mutate((value) => {
    value.submissions[1].state = "proposed";
    value.submissions[1].attemptedAt = null;
    value.review.unreceiptedSubmissionRefs = [];
  }), "unsupported_requirement_state");
  assertFinding(mutate((value) => {
    value.requirements.find((row) => row.id === "requirement-blue-recommendation").gapRefs = ["gap-blue-portal"];
  }), "unowned_requirement_blocker");
  assertFinding(mutate((value) => {
    const requirement = value.requirements.find((row) => row.id === "requirement-blue-form");
    requirement.state = "received";
    requirement.submissionRefs = [];
  }), "unsupported_requirement_state");
  assertFinding(mutate((value) => {
    const requirement = value.requirements.find((row) => row.id === "requirement-blue-fee-waiver");
    requirement.state = "waived-by-institution";
    requirement.sourceRefs = ["source-red-program-v2"];
  }), "invalid_requirement_waiver");
});

test("submission claims require applicant control, exact scope, chronology, and independent receipts", () => {
  assertFinding(mutate((value) => { value.submissions[0].submittedByAuthorityRef = "adviser-jordan"; }), "invalid_submission_owner");
  assertFinding(mutate((value) => { value.submissions[0].subjectRefs.push("requirement-blue-form"); }), "cross_application_reference");
  assertFinding(mutate((value) => { value.submissions[0].receiptSourceRef = null; }), "invalid_submission_receipt");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-receipt-red").issuerAuthorityRef = "applicant-morgan"; }), "invalid_submission_receipt");
  assertFinding(mutate((value) => { value.submissions[1].attemptedAt = "2026-09-27T12:00:00-07:00"; }), "invalid_submission_chronology");
  assertFinding(mutate((value) => { value.submissions[0].agentExecuted = true; }), "prohibited_submission_execution");
  assertFinding(mutate((value) => {
    value.submissions[0].externalExecution = "third-party-only";
    value.submissions[0].submittedByAuthorityRef = "school-north";
  }), "invalid_submission_kind");
  assertFinding(mutate((value) => { value.submissions[0].kind = "transcript"; }), "invalid_submission_kind");
  assertFinding(mutate((value) => {
    const source = value.sources.find((row) => row.id === "source-portal-red");
    source.subjectRef = "submission-red-application";
    value.submissions[0].sourceRefs = [source.id];
  }), "invalid_submission_source");
  assertFinding(mutate((value) => { value.sources.find((row) => row.id === "source-receipt-red").issuerAuthorityRef = "admissions-blue"; }), "invalid_submission_receipt");
  assertFinding(mutate((value) => {
    const submission = value.submissions.find((row) => row.id === "submission-blue-application");
    submission.kind = "transcript";
    submission.subjectRefs = ["record-transcript"];
    submission.submittedByAuthorityRef = "school-north";
    submission.sourceRefs = [];
    submission.externalExecution = "third-party-only";
  }), "invalid_submission_source");
});

test("requirements cannot borrow receipts or attempts for other subjects", () => {
  const received = mutate((value) => { value.submissions[0].subjectRefs = ["requirement-red-form"]; });
  assert.equal(validateSchema(received), true, ajv.errorsText(validateSchema.errors));
  assertFinding(received, "incomplete_reciprocal_reference");
  const submitted = mutate((value) => { value.submissions[1].subjectRefs = ["material-blue-statement"]; });
  assert.equal(validateSchema(submitted), true, ajv.errorsText(validateSchema.errors));
  assertFinding(submitted, "incomplete_reciprocal_reference");
});

test("contradictory admission decisions remain blocked with exact owned conflict evidence", () => {
  const value = mutate((portfolio) => {
    const decision = { ...portfolio.decisions[0], id: "decision-red-denied", outcome: "denied", sourceRef: "source-red-denied" };
    const source = { ...portfolio.sources.find((row) => row.id === "source-decision-red"), id: decision.sourceRef, stableSourceRef: "red-denied", subjectRef: decision.id };
    portfolio.decisions.push(decision);
    portfolio.sources.push(source);
    portfolio.portfolio.decisionRefs.push(decision.id);
    portfolio.portfolio.sourceRefs.push(source.id);
    portfolio.applications[0].decisionRefs.push(decision.id);
    portfolio.applications[0].sourceRefs.push(source.id);
  });
  assert.equal(validateSchema(value), true, ajv.errorsText(validateSchema.errors));
  assertFinding(value, "unsupported_application_state");
  assertFinding(value, "incomplete_review_index");
  value.applications[0].state = "conflicting";
  value.review.incompleteApplicationRefs.push("application-red");
  value.review.unresolvedDecisionApplicationRefs.push("application-red");
  assertFinding(value, "unsupported_application_state");
  const gap = {
    id: "gap-red-decision", portfolioRef: value.portfolio.id, applicationRef: "application-red",
    kind: "official-decision", subjectRefs: ["application-red", "decision-red-admission", "decision-red-denied"],
    sourceRefs: ["source-decision-red", "source-red-denied"], nextOwnerAuthorityRef: "admissions-red",
    state: "open", resolutionSourceRef: null,
  };
  value.gaps.push(gap);
  value.portfolio.gapRefs.push(gap.id);
  value.applications[0].gapRefs.push(gap.id);
  value.review.openGapRefs.push(gap.id);
  assert.equal(validateSchema(value), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(collegeApplicationFindings(value), []);
  gap.subjectRefs.pop();
  assertFinding(value, "unsupported_application_state");
});

test("official decisions require exact current institution or aid evidence", () => {
  assertFinding(mutate((value) => { value.decisions[0].issuerAuthorityRef = "applicant-morgan"; }), "invalid_decision_issuer");
  assertFinding(mutate((value) => { value.decisions[0].sourceRef = "source-portal-red"; }), "invalid_decision_source");
  assertFinding(mutate((value) => { value.decisions[0].decidedAt = "2026-09-24T09:01:00-07:00"; }), "invalid_decision_chronology");
  assertFinding(mutate((value) => { value.decisions[0].interpretationByClaw = true; }), "prohibited_admission_conclusion");
  assertFinding(mutate((value) => { value.decisions[0].outcome = "offer"; }), "invalid_decision_outcome");
  assertFinding(mutate((value) => {
    value.decisions[0].issuerAuthorityRef = "admissions-blue";
    value.sources.find((row) => row.id === "source-decision-red").issuerAuthorityRef = "admissions-blue";
  }), "invalid_decision_issuer");
});

test("external actions remain applicant-owned and never agent-executed", () => {
  assertFinding(mutate((value) => { value.actions[0].ownerAuthorityRef = "adviser-jordan"; }), "invalid_action_owner");
  assertFinding(mutate((value) => { value.actions[0].attemptedAt = "2026-09-25T12:00:00-07:00"; }), "invalid_action_chronology");
  assertFinding(mutate((value) => { value.actions[0].agentExecuted = true; }), "prohibited_action_execution");
  assertFinding(mutate((value) => { value.actions[1].receiptSourceRef = "source-receipt-red"; }), "invalid_action_receipt");
  assertFinding(mutate((value) => {
    const action = value.actions[0];
    const receipt = value.sources.find((row) => row.id === "source-portal-red");
    receipt.kind = "submission-receipt";
    receipt.subjectRef = action.id;
    receipt.assertedAt = "2026-09-20T09:00:00-07:00";
    action.state = "owner-completed-receipted";
    action.attemptedAt = "2026-09-21T09:00:00-07:00";
    action.receiptSourceRef = receipt.id;
    value.applications[0].sourceRefs = value.applications[0].sourceRefs.filter((ref) => ref !== receipt.id);
  }), "invalid_action_receipt");
});

test("gaps retain current owners and exact resolution evidence", () => {
  assertFinding(mutate((value) => { value.gaps[0].nextOwnerAuthorityRef = "missing-owner"; }), "invalid_gap_owner");
  assertFinding(mutate((value) => { value.gaps[0].nextOwnerAuthorityRef = "admissions-blue"; }), "invalid_gap_owner");
  assertFinding(mutate((value) => {
    value.gaps[0].subjectRefs.push("record-transcript");
    value.gaps[0].nextOwnerAuthorityRef = "school-north";
  }), "invalid_gap_owner");
  assertFinding(mutate((value) => {
    value.submissions[1].state = "submitted-receipted";
    value.review.unreceiptedSubmissionRefs = [];
  }), "invalid_gap_subject");
  assertFinding(mutate((value) => { value.gaps[0].resolutionSourceRef = "source-recommendation-red"; }), "invalid_gap_resolution");
  assertFinding(mutate((value) => {
    value.gaps[0].state = "resolved";
    value.gaps[0].resolutionSourceRef = "source-recommendation-red";
  }), "invalid_gap_resolution");
  assertFinding(mutate((value) => { value.gaps[0].subjectRefs.push("decision-red-admission"); }), "cross_application_reference");
  assertFinding(mutate((value) => { value.actions[1].subjectRefs = ["decision-red-admission"]; }), "cross_application_reference");
});

test("review indexes exactly mirror blockers and cannot claim premature readiness", () => {
  assertFinding(mutate((value) => value.review.openGapRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.unreceiptedSubmissionRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => value.review.unresolvedDecisionApplicationRefs.pop()), "incomplete_review_index");
  assertFinding(mutate((value) => { value.review.state = "applicant-review-ready"; }), "premature_review_readiness");
  assertFinding(mutate((value) => { value.review.admissionPrediction = true; }), "prohibited_admission_conclusion");
  assertFinding(mutate((value) => { value.prohibitedActions.submission = true; }), "prohibited_authority_claim");
});

test("strict schema and semantics reject hidden fields and sensitive text", () => {
  const hidden = mutate((value) => { value.portfolio.studentName = "not allowed"; });
  assert.equal(validateSchema(hidden), false);
  const secret = mutate((value) => { value.sources[0].containsSecrets = true; });
  assert.equal(validateSchema(secret), false);
  assertFinding(secret, "secret_bearing_source");
  assertFinding(mutate((value) => { value.authorities[0].label = "Applicant email person@example.com"; }), "secret_bearing_text");
});

test("artifact template exposes the complete portfolio and authority contract", () => {
  for (const marker of [
    "Authority and source revisions",
    "Institutions, programs, and requirements",
    "Applicant-authored material revisions",
    "Independent records",
    "Submissions and receipts",
    "Official decisions and enrollment responses",
    "Gaps and exact review indexes",
    "Prohibited authority",
  ]) assert.match(template, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});
