import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/executive-assistant/schemas/executive-commitment-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/executive-assistant/fixtures/executive-commitment-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/executive-assistant/templates/executive-commitment-ledger.md",
    import.meta.url,
  ),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function executiveCommitmentLedgerFindings(",
);
const validatorBody = validatorSource.slice(
  validatorStart,
  validatorSource.indexOf("\nfunction ", validatorStart + 1),
);
const emittedFindingCodes = new Set(
  [...validatorBody.matchAll(/finding\(\s*"([a-z_]+)"/gu)].map(
    (match) => match[1],
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("executive-assistant", value);
const hasFinding = (value, code) =>
  findings(value).some((item) => item.code === code);

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function find(collection, id) {
  return collection.find((item) => item.id === id);
}

function readyForExecutiveReview() {
  const value = clone();
  find(value.sources, "source-headcount-brief").freshness = "current";
  find(value.priorities, "priority-reorg-decision").state =
    "needs-executive-input";
  const reorgReview = find(value.meetings, "meeting-reorg-review");
  reorgReview.agendaPath = "outputs/reorg-review-agenda.md";
  reorgReview.preparationState = "ready-for-executive-review";
  find(value.commitments, "commitment-headcount-brief").state = "proposed";
  find(value.conflicts, "conflict-headcount-evidence").state = "resolved";
  value.horizon.state = "ready-for-executive-review";
  value.handoff.state = "ready-for-executive-review";
  value.handoff.blockingRefs = [];
  return value;
}

function readyForExecutionHandoff() {
  const value = readyForExecutiveReview();
  value.sources.push({
    id: "source-draft-approvals",
    kind: "draft-approval",
    label: "Dana Whitfield's approval of the two executive communication drafts",
    reference: "references/draft-approvals-2026-08-31.md",
    observedAt: "2026-08-31T15:30:00-07:00",
    freshness: "current",
    confidentiality: "confidential",
    audienceScope: "executive-and-support",
  });
  value.handoff.sourceRefs.push("source-draft-approvals");
  const renewal = find(value.decisions, "decision-vendor-renewal");
  renewal.state = "decided";
  renewal.decision =
    "Priya Raman selected the six-month bridge under the signed delegation so procurement can finish the comparison.";
  renewal.decidedAt = "2026-08-31T14:00:00-07:00";
  renewal.decisionEvidenceSourceRef = "source-decision-log";
  const reorg = find(value.decisions, "decision-reorg-envelope");
  reorg.state = "decided";
  reorg.decision =
    "Dana Whitfield authorized a flat headcount envelope for the platform reorganization.";
  reorg.decidedAt = "2026-08-31T15:00:00-07:00";
  reorg.evidenceSourceRefs.push("source-decision-log");
  reorg.decisionEvidenceSourceRef = "source-decision-log";
  find(value.conflicts, "conflict-offsite-overlap").state = "resolved";
  const headcount = find(value.commitments, "commitment-headcount-brief");
  headcount.acknowledgementState = "acknowledged";
  headcount.acknowledgementSourceRef = "source-commitment-log";
  headcount.acknowledgedBy = "Finance Business Partner";
  headcount.acknowledgedByType = "team";
  headcount.acknowledgedAt = "2026-08-31T12:15:00-07:00";
  headcount.state = "active";
  const renewalDraft = find(value.drafts, "draft-renewal-note");
  renewalDraft.reviewState = "approved-by-executive";
  renewalDraft.executiveApproval = {
    approvedBy: "Dana Whitfield",
    approvedAt: "2026-08-31T15:20:00-07:00",
    draftVersion: renewalDraft.version,
    evidenceSourceRef: "source-draft-approvals",
  };
  const offsiteHold = find(value.drafts, "draft-offsite-hold");
  offsiteHold.reviewState = "approved-by-executive";
  offsiteHold.executiveApproval = {
    approvedBy: "Dana Whitfield",
    approvedAt: "2026-08-31T15:25:00-07:00",
    draftVersion: offsiteHold.version,
    evidenceSourceRef: "source-draft-approvals",
  };
  value.reviewQuestions = [];
  value.handoff.reviewQuestionRefs = [];
  value.horizon.state = "ready-for-execution-handoff";
  value.handoff.state = "ready-for-execution-handoff";
  return value;
}

test("the executive commitment fixture is schema-valid and semantically honest", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.horizon.state, "blocked");
  assert.ok(fixture.drafts.every((draft) => draft.sendState === "not-sent"));
  assert.ok(
    fixture.meetings.every((meeting) =>
      ["observed-from-supplied-input", "proposed-only"].includes(
        meeting.calendarState,
      ),
    ),
  );
});

test("the template preserves the complete commitment and authority contract", () => {
  for (const heading of [
    "## Request, horizon, and authority",
    "## Source inventory",
    "## Priorities and protected constraints",
    "## Meetings and calendar state",
    "## Decisions, authority, and delegation",
    "## Commitments and acknowledgement",
    "## Communication drafts",
    "## Conflicts, risks, and review questions",
    "## Honest state and private handoff",
  ]) {
    assert.ok(template.includes(heading), heading);
  }
});

test("review and execution-handoff states are representable without acting", () => {
  const review = readyForExecutiveReview();
  assertSchemaValid(review);
  assert.deepEqual(findings(review), []);

  const execution = readyForExecutionHandoff();
  assertSchemaValid(execution);
  assert.deepEqual(findings(execution), []);
  assert.ok(execution.drafts.every((draft) => draft.sendState === "not-sent"));
  assert.ok(
    execution.meetings.every(
      (meeting) => meeting.calendarState === "observed-from-supplied-input",
    ),
  );
});

test("chronology, timezones, and source references are enforced", () => {
  const badHorizon = clone();
  badHorizon.horizon.asOf = "2026-09-30T16:00:00-07:00";
  assert.equal(hasFinding(badHorizon, "invalid_horizon_chronology"), true);

  const badZone = clone();
  badZone.horizon.timeZone = "Mars/Olympus";
  assert.equal(hasFinding(badZone, "invalid_time_zone"), true);

  const badCommitmentZone = clone();
  badCommitmentZone.commitments[0].timeZone = "Mars/Olympus";
  assert.equal(hasFinding(badCommitmentZone, "invalid_time_zone"), true);

  const futureSource = clone();
  futureSource.sources[0].observedAt = "2026-09-02T09:00:00-07:00";
  assert.equal(hasFinding(futureSource, "future_source_evidence"), true);

  const unsafeSource = clone();
  unsafeSource.sources[0].reference = "../private.md";
  assert.equal(hasFinding(unsafeSource, "unsafe_source_reference"), true);

  const privateUrl = clone();
  privateUrl.sources[0].reference = "https://localhost/priorities";
  assert.equal(hasFinding(privateUrl, "unsafe_source_reference"), true);

  const credentialUrl = clone();
  credentialUrl.sources[0].reference =
    "https://example.com/priorities?access_token=abc";
  assert.equal(hasFinding(credentialUrl, "unsafe_source_reference"), true);
});

test("priorities keep unique ranks, bounded timeboxes, and honest state", () => {
  const duplicateRank = clone();
  duplicateRank.priorities[1].rank = 1;
  assert.equal(hasFinding(duplicateRank, "duplicate_priority_rank"), true);

  const badTimebox = clone();
  badTimebox.priorities[0].timebox.end = "2026-09-06T12:00:00-07:00";
  assert.equal(hasFinding(badTimebox, "invalid_priority_timebox"), true);

  const overstatedBlock = clone();
  overstatedBlock.priorities[2].state = "blocked";
  assert.equal(hasFinding(overstatedBlock, "unsupported_priority_state"), true);

  const uncovered = clone();
  uncovered.meetings[2].priorityRefs = ["priority-renewal"];
  uncovered.decisions[2].priorityRefs = ["priority-renewal"];
  assert.equal(hasFinding(uncovered, "uncovered_priority"), true);
});

test("meetings observe supplied calendar state and never claim mutation", () => {
  const badWindow = clone();
  badWindow.meetings[0].suppliedEnd = "2026-09-08T08:00:00-07:00";
  assert.equal(hasFinding(badWindow, "invalid_meeting_window"), true);

  const outsideHorizon = clone();
  outsideHorizon.meetings[0].suppliedStart = "2026-09-06T09:00:00-07:00";
  assert.equal(hasFinding(outsideHorizon, "invalid_meeting_window"), true);

  const proposedWithExport = clone();
  proposedWithExport.meetings[0].calendarState = "proposed-only";
  assert.equal(
    hasFinding(proposedWithExport, "unsupported_calendar_state"),
    true,
  );

  const unsafeAgenda = clone();
  unsafeAgenda.meetings[0].agendaPath = "../agenda.md";
  assert.equal(hasFinding(unsafeAgenda, "unsafe_agenda_path"), true);

  const overstatedPrep = clone();
  overstatedPrep.meetings[0].preparationState = "not-started";
  assert.equal(
    hasFinding(overstatedPrep, "premature_meeting_preparation"),
    true,
  );
});

test("decision authority, delegation, and resolution stay evidence-bound", () => {
  const lateDeadline = clone();
  lateDeadline.decisions[0].deadline = "2026-10-01T17:00:00-07:00";
  assert.equal(hasFinding(lateDeadline, "deadline_outside_horizon"), true);

  const lateCommitment = clone();
  lateCommitment.commitments[0].deadline = "2027-01-05T17:00:00-08:00";
  assert.equal(hasFinding(lateCommitment, "deadline_outside_horizon"), true);

  const claimedDelegation = clone();
  claimedDelegation.decisions[1].authorityState = "delegated";
  assert.equal(
    hasFinding(claimedDelegation, "invalid_delegation_structure"),
    true,
  );

  const outOfScope = clone();
  outOfScope.decisions[0].delegation.scopeKinds = ["personnel"];
  assert.equal(
    hasFinding(outOfScope, "unsupported_delegated_authority"),
    true,
  );

  const wrongDelegate = clone();
  wrongDelegate.decisions[0].delegation.delegate = "Another leader";
  assert.equal(
    hasFinding(wrongDelegate, "unsupported_delegated_authority"),
    true,
  );

  const expiredDelegation = clone();
  expiredDelegation.decisions[0].delegation.validThrough =
    "2026-09-08T17:00:00-07:00";
  assert.equal(
    hasFinding(expiredDelegation, "unsupported_delegated_authority"),
    true,
  );

  const claimedDecision = clone();
  claimedDecision.decisions[1].state = "decided";
  assert.equal(
    hasFinding(claimedDecision, "invalid_decision_resolution"),
    true,
  );

  const futureDecision = clone();
  futureDecision.decisions[2].decidedAt = "2026-09-05T12:00:00-07:00";
  assert.equal(hasFinding(futureDecision, "future_decision_record"), true);

  const weakEvidence = clone();
  weakEvidence.decisions[2].decisionEvidenceSourceRef =
    "source-headcount-brief";
  assert.equal(
    hasFinding(weakEvidence, "unsupported_decision_evidence"),
    true,
  );

  const undeclaredEvidence = clone();
  undeclaredEvidence.decisions[2].decisionEvidenceSourceRef =
    "source-executive-priorities";
  assert.equal(
    hasFinding(undeclaredEvidence, "unsupported_decision_evidence"),
    true,
  );

  const uncoveredDecision = clone();
  uncoveredDecision.meetings[1].decisionRefs = [];
  uncoveredDecision.reviewQuestions[0].refs = ["source-headcount-brief"];
  assert.equal(hasFinding(uncoveredDecision, "uncovered_decision"), true);
});

test("commitments require a real origin, owner acknowledgement, and honest state", () => {
  const draftOrigin = clone();
  draftOrigin.commitments[0].originRef = "decision-reorg-envelope";
  assert.equal(hasFinding(draftOrigin, "invalid_commitment_origin"), true);

  const weakOrigin = clone();
  weakOrigin.commitments[1].originRef = "source-headcount-brief";
  assert.equal(hasFinding(weakOrigin, "invalid_commitment_origin"), true);

  const inventedAcknowledgement = clone();
  inventedAcknowledgement.commitments[1].acknowledgementSourceRef =
    "source-commitment-log";
  assert.equal(
    hasFinding(inventedAcknowledgement, "unsupported_acknowledgement"),
    true,
  );

  const wrongAcknowledger = clone();
  wrongAcknowledger.commitments[0].acknowledgedBy = "Another person";
  assert.equal(
    hasFinding(wrongAcknowledger, "unsupported_acknowledgement"),
    true,
  );

  const earlyAcknowledgement = clone();
  earlyAcknowledgement.commitments[0].acknowledgedAt =
    "2026-08-31T11:00:00-07:00";
  assert.equal(
    hasFinding(earlyAcknowledgement, "unsupported_acknowledgement"),
    true,
  );

  const staleAcknowledgement = clone();
  staleAcknowledgement.commitments[0].acknowledgementSourceRef =
    "source-headcount-brief";
  assert.equal(
    hasFinding(staleAcknowledgement, "unsupported_acknowledgement"),
    true,
  );

  const overstatedState = clone();
  overstatedState.commitments[1].state = "active";
  assert.equal(
    hasFinding(overstatedState, "unsupported_commitment_state"),
    true,
  );
});

test("drafts stay bound, classified, unsent, and honestly staged", () => {
  const unsafePath = clone();
  unsafePath.drafts[0].path = "../renewal.md";
  assert.equal(hasFinding(unsafePath, "unsafe_draft_path"), true);

  const unbound = clone();
  unbound.drafts[0].decisionRefs = [];
  assert.equal(hasFinding(unbound, "missing_draft_binding"), true);

  const widened = clone();
  widened.drafts[1].audienceReach = "organization";
  assert.equal(hasFinding(widened, "confidentiality_audience_mismatch"), true);

  const downgraded = clone();
  downgraded.drafts[1].classification = "internal";
  assert.equal(
    hasFinding(downgraded, "confidentiality_audience_mismatch"),
    true,
  );

  const inheritedDisclosure = clone();
  inheritedDisclosure.drafts[0].sourceRefs = [
    "source-executive-priorities",
    "source-calendar-export",
  ];
  inheritedDisclosure.drafts[0].classification = "internal";
  inheritedDisclosure.drafts[0].audienceReach = "named-stakeholders";
  assert.equal(
    hasFinding(inheritedDisclosure, "confidentiality_audience_mismatch"),
    true,
  );

  const earlyDraft = clone();
  earlyDraft.drafts[0].reviewState = "ready-for-executive-review";
  assert.equal(hasFinding(earlyDraft, "premature_draft_state"), true);

  const unapprovedApproval = readyForExecutionHandoff();
  unapprovedApproval.drafts[1].executiveApproval.draftVersion = "v2";
  assert.equal(
    hasFinding(unapprovedApproval, "unsupported_draft_approval"),
    true,
  );
  assert.equal(hasFinding(unapprovedApproval, "premature_draft_state"), true);
});

test("meeting and conflict references remain bidirectional", () => {
  const missingMeetingLink = clone();
  missingMeetingLink.meetings[1].conflictRefs = [
    "conflict-headcount-evidence",
  ];
  assert.equal(
    hasFinding(missingMeetingLink, "missing_meeting_conflict_coverage"),
    true,
  );
});

test("handoff completeness, blockers, and readiness remain truthful", () => {
  const incomplete = clone();
  incomplete.handoff.sourceRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const missingBlocker = clone();
  missingBlocker.handoff.blockingRefs.pop();
  assert.equal(hasFinding(missingBlocker, "incomplete_blocked_handoff"), true);

  const earlyReview = clone();
  earlyReview.horizon.state = "ready-for-executive-review";
  earlyReview.handoff.state = "ready-for-executive-review";
  assert.equal(
    hasFinding(earlyReview, "premature_executive_review_state"),
    true,
  );

  const stalledDraft = readyForExecutiveReview();
  const settledRenewal = find(stalledDraft.decisions, "decision-vendor-renewal");
  settledRenewal.state = "decided";
  settledRenewal.decision =
    "Priya Raman selected the six-month bridge under the signed delegation.";
  settledRenewal.decidedAt = "2026-08-31T14:00:00-07:00";
  settledRenewal.decisionEvidenceSourceRef = "source-decision-log";
  assert.equal(
    hasFinding(stalledDraft, "premature_executive_review_state"),
    true,
  );

  const earlyExecution = readyForExecutiveReview();
  earlyExecution.horizon.state = "ready-for-execution-handoff";
  earlyExecution.handoff.state = "ready-for-execution-handoff";
  assert.equal(
    hasFinding(earlyExecution, "premature_execution_handoff_state"),
    true,
  );

  const inconsistent = clone();
  inconsistent.handoff.supportOwner = "Someone else";
  assert.equal(hasFinding(inconsistent, "inconsistent_horizon_handoff"), true);
});

test("authority stays human-owned and prohibited actions stay explicit", () => {
  const agentOwner = clone();
  agentOwner.horizon.supportOwner = "Executive Assistant Claw";
  agentOwner.handoff.supportOwner = "Executive Assistant Claw";
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);

  const agentDecider = clone();
  agentDecider.decisions[0].decisionOwner = "the assistant";
  assert.equal(hasFinding(agentDecider, "agent_owned_authority"), true);

  const missingGate = clone();
  missingGate.prohibitedActions.splice(0, 1);
  assert.equal(hasFinding(missingGate, "missing_authority_gate"), true);

  const claimedSend = clone();
  claimedSend.priorities[0].protectedConstraints.push(
    "We already sent the reorganization note to the leadership team.",
  );
  assert.equal(hasFinding(claimedSend, "unauthorized_narrative_action"), true);

  const claimedAcceptance = clone();
  claimedAcceptance.conflicts[0].description =
    "The meeting was accepted on the executive's behalf to clear the overlap.";
  assert.equal(
    hasFinding(claimedAcceptance, "unauthorized_narrative_action"),
    true,
  );

  const futureSend = clone();
  futureSend.priorities[0].protectedConstraints.push(
    "The assistant will send the reorganization note.",
  );
  assert.equal(
    hasFinding(futureSend, "unauthorized_narrative_action"),
    true,
  );

  const contractedSend = clone();
  contractedSend.priorities[0].protectedConstraints.push(
    "We've sent the reorganization note.",
  );
  assert.equal(
    hasFinding(contractedSend, "unauthorized_narrative_action"),
    true,
  );

  const ownerDirected = clone();
  ownerDirected.reviewQuestions[0].question =
    "Should Priya Raman send the note after Dana Whitfield approves it, or should the executive reply directly?";
  assert.equal(
    hasFinding(ownerDirected, "unauthorized_narrative_action"),
    false,
  );
});

test("every direct semantic finding code has focused coverage", () => {
  const exercised = new Set([
    "invalid_horizon_chronology",
    "invalid_time_zone",
    "future_source_evidence",
    "unsafe_source_reference",
    "duplicate_priority_rank",
    "invalid_priority_timebox",
    "unsupported_priority_state",
    "invalid_meeting_window",
    "unsupported_calendar_state",
    "unsafe_agenda_path",
    "premature_meeting_preparation",
    "deadline_outside_horizon",
    "invalid_delegation_structure",
    "unsupported_delegated_authority",
    "invalid_decision_resolution",
    "future_decision_record",
    "unsupported_decision_evidence",
    "invalid_commitment_origin",
    "unsupported_acknowledgement",
    "unsupported_commitment_state",
    "unsafe_draft_path",
    "missing_draft_binding",
    "confidentiality_audience_mismatch",
    "unsupported_draft_approval",
    "premature_draft_state",
    "missing_meeting_conflict_coverage",
    "uncovered_priority",
    "uncovered_decision",
    "incomplete_handoff",
    "incomplete_blocked_handoff",
    "premature_executive_review_state",
    "premature_execution_handoff_state",
    "inconsistent_horizon_handoff",
    "agent_owned_authority",
    "missing_authority_gate",
    "unauthorized_narrative_action",
  ]);
  assert.deepEqual(emittedFindingCodes, exercised);
});
