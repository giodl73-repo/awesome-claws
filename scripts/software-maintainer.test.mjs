import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/software-maintainer/schemas/change-delivery-record.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/software-maintainer/fixtures/change-delivery-record.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL("../claws/software-maintainer/templates/change-delivery-record.md", import.meta.url),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf("function changeDeliveryRecordFindings(");
const validatorBody = validatorSource.slice(
  validatorStart,
  validatorSource.indexOf("\nfunction ", validatorStart + 1),
);
const emittedFindingCodes = new Set(
  [...validatorBody.matchAll(/finding\(\s*"([a-z_]+)"/gu)].map((match) => match[1]),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("software-maintainer", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const HEAD = fixture.repository.headRevision;
const BASE = fixture.repository.baseRevision;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function criterion(value, id) {
  return value.acceptanceCriteria.find((item) => item.id === id);
}

function change(value, id) {
  return value.changes.find((item) => item.id === id);
}

function verification(value, id) {
  return value.verifications.find((item) => item.id === id);
}

function setOwner(value, owner) {
  value.request.owner = owner;
  value.handoff.owner = owner;
}

function setReviewer(value, reviewer) {
  value.request.reviewer = reviewer;
  value.handoff.reviewer = reviewer;
  value.reviews.find((item) => item.kind === "human-review").reviewer = reviewer;
}

// The requested behavior already holds on the recorded head, so the honest
// record carries no change, no commit, and no invented work.
function noChangeRecord() {
  const value = clone();
  value.changes = [];
  value.repository.headRevision = value.repository.baseRevision;
  value.repository.dirtyStateAtStart = { state: "clean", entries: [] };
  value.request.outcome = "no-change-required";
  value.delivery.performed = "none";
  for (const item of value.verifications) {
    item.baselineResult = "not-applicable";
    item.revision = value.repository.baseRevision;
  }
  for (const item of value.acceptanceCriteria) {
    item.kind = "compatibility";
    item.changeRefs = [];
  }
  value.findings = [];
  value.risks = [];
  value.reviews = [
    {
      id: "review-final-diff",
      kind: "self-diff-review",
      reviewer: "Software maintainer Claw",
      revision: value.repository.baseRevision,
      ranAt: "2026-08-30T11:05:00-07:00",
      state: "completed",
      findingRefs: [],
    },
  ];
  value.handoff.changeRefs = [];
  value.handoff.reviewRefs = ["review-final-diff"];
  value.handoff.findingRefs = [];
  value.handoff.riskRefs = [];
  value.handoff.residualRiskSummary =
    "The reported failure does not reproduce at the recorded revision, so no code was changed and the request goes back to the owner with the evidence that was gathered.";
  return value;
}

// Work that produced a diff but cannot honestly be called ready.
function blockedRecord() {
  const value = clone();
  value.request.state = "blocked";
  value.handoff.state = "blocked";
  value.risks.push({
    id: "risk-unverified-windows-host",
    description:
      "No Windows host was available in this session, so the reported failure was reproduced only from the resolver unit level and never from a real installed shim.",
    category: "coverage-gap",
    severity: "high",
    state: "open",
    blocking: true,
    ownerDecisionRequired: true,
    mitigationChangeRefs: [],
  });
  value.findings.push({
    id: "finding-missing-windows-host",
    reviewRef: "review-final-diff",
    severity: "blocking",
    summary:
      "The end-to-end launch path was never exercised on Windows, so the diff cannot be called verified against the reported failure.",
    disposition: "deferred-to-owner",
    changeRefs: [],
    riskRefs: ["risk-unverified-windows-host"],
    resolvedAtRevision: null,
  });
  value.reviews[0].findingRefs.push("finding-missing-windows-host");
  value.handoff.riskRefs.push("risk-unverified-windows-host");
  value.handoff.findingRefs.push("finding-missing-windows-host");
  value.handoff.blockingRefs = [
    "finding-missing-windows-host",
    "risk-unverified-windows-host",
  ];
  return value;
}

// The owner reviewed the ready record and authorized the draft pull request.
function deliveredRecord() {
  const value = clone();
  value.ownerDecision = {
    state: "completed",
    decidedBy: "Priya Raman",
    decidedAt: "2026-08-30T11:15:00-07:00",
    resolution:
      "Reviewed the record, accepted the stated UNC coverage gap as a follow-up, and authorized the draft pull request.",
    approvedDelivery: "draft-pull-request-opened",
  };
  value.delivery.performed = "draft-pull-request-opened";
  value.delivery.publishedAt = "2026-08-30T11:20:00-07:00";
  value.request.state = "delivered";
  value.handoff.state = "delivered";
  return value;
}

test("the packaged change delivery record is schema and semantically valid", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(findings(fixture), []);
});

test("the record template documents every part of the delivery contract", () => {
  for (const heading of [
    "## Request, criteria, and outcome",
    "## Repository identity and starting state",
    "## Authorized scope and protected paths",
    "## Evidence inventory",
    "## Changes and rationale",
    "## Verification bound to the current head",
    "## Review, findings, and dispositions",
    "## Risk, blockers, and honest state",
    "## Delivery authority and owner decision",
  ]) {
    assert.ok(template.includes(heading), heading);
  }
});

test("no-change work is recorded honestly instead of manufacturing a diff", () => {
  const value = noChangeRecord();
  assert.equal(isValid(value), true, JSON.stringify(findings(value)));

  const claimsDelivery = noChangeRecord();
  claimsDelivery.delivery.performed = "local-commit";
  assert.equal(hasFinding(claimsDelivery, "overstated_delivery_authority"), true);

  const claimsChangesDelivered = noChangeRecord();
  claimsChangesDelivered.request.outcome = "changes-delivered";
  assert.equal(hasFinding(claimsChangesDelivered, "invalid_change_outcome"), true);

  const unresolvedCriterion = noChangeRecord();
  criterion(unresolvedCriterion, "criterion-required-validation").state = "not-met";
  criterion(unresolvedCriterion, "criterion-required-validation").notMetReason =
    "The required validation command could not be run because the toolchain is not installed on this host.";
  assert.equal(hasFinding(unresolvedCriterion, "invalid_change_outcome"), true);

  const movedHead = noChangeRecord();
  movedHead.repository.headRevision = HEAD;
  assert.equal(hasFinding(movedHead, "invalid_revision_identity"), true);
});

test("blocked work keeps every blocker visible and cannot claim readiness", () => {
  const value = blockedRecord();
  assert.equal(isValid(value), true, JSON.stringify(findings(value)));

  const droppedBlockers = blockedRecord();
  droppedBlockers.handoff.blockingRefs = [];
  assert.equal(hasFinding(droppedBlockers, "incomplete_blocked_handoff"), true);

  const claimsReady = blockedRecord();
  claimsReady.request.state = "ready-for-owner-review";
  claimsReady.handoff.state = "ready-for-owner-review";
  assert.equal(hasFinding(claimsReady, "premature_ready_state"), true);

  const inventedBlocker = clone();
  inventedBlocker.request.state = "blocked";
  inventedBlocker.handoff.state = "blocked";
  assert.equal(hasFinding(inventedBlocker, "incomplete_blocked_handoff"), true);

  const selfAccepted = blockedRecord();
  selfAccepted.risks.at(-1).state = "accepted-by-owner";
  assert.equal(hasFinding(selfAccepted, "unowned_risk_acceptance"), true);
});

test("delivery never exceeds the authority the owner granted", () => {
  const delivered = deliveredRecord();
  assert.equal(isValid(delivered), true, JSON.stringify(findings(delivered)));

  const withoutDecision = deliveredRecord();
  withoutDecision.ownerDecision = {
    state: "pending",
    decidedBy: null,
    decidedAt: null,
    resolution: null,
    approvedDelivery: null,
  };
  assert.equal(hasFinding(withoutDecision, "unauthorized_delivery_action"), true);

  const beyondAuthority = deliveredRecord();
  beyondAuthority.delivery.performed = "merged";
  beyondAuthority.ownerDecision.approvedDelivery = "merged";
  assert.equal(hasFinding(beyondAuthority, "overstated_delivery_authority"), true);

  const decisionBeforeReview = deliveredRecord();
  decisionBeforeReview.ownerDecision.decidedAt = "2026-08-30T10:55:00-07:00";
  decisionBeforeReview.delivery.publishedAt = "2026-08-30T10:58:00-07:00";
  assert.equal(hasFinding(decisionBeforeReview, "invalid_owner_decision"), true);

  const rewrittenHistory = deliveredRecord();
  rewrittenHistory.delivery.historyRewritten = true;
  assert.equal(hasFinding(rewrittenHistory, "unauthorized_delivery_action"), true);

  const forcePushed = clone();
  forcePushed.delivery.forcePushed = true;
  assert.equal(hasFinding(forcePushed, "unauthorized_delivery_action"), true);
  assert.equal(hasFinding(forcePushed, "premature_ready_state"), true);

  const unpublishedButTimed = clone();
  unpublishedButTimed.delivery.publishedAt = "2026-08-30T11:20:00-07:00";
  assert.equal(hasFinding(unpublishedButTimed, "unauthorized_delivery_action"), true);

  const inferredAuthority = clone();
  inferredAuthority.delivery.authoritySourceRef = "source-launcher-history";
  assert.equal(hasFinding(inferredAuthority, "overstated_delivery_authority"), true);
});

test("evidence, verification, and review only count at the current head", () => {
  const staleCheck = clone();
  verification(staleCheck, "verification-full-suite").revision = BASE;
  assert.equal(hasFinding(staleCheck, "stale_verification_evidence"), true);

  const staleReview = clone();
  staleReview.reviews[0].revision = BASE;
  assert.equal(hasFinding(staleReview, "stale_review_evidence"), true);

  const unreviewedHead = clone();
  unreviewedHead.reviews[0].state = "not-run";
  unreviewedHead.reviews[0].revision = null;
  unreviewedHead.reviews[0].ranAt = null;
  unreviewedHead.reviews[0].findingRefs = [];
  unreviewedHead.findings = [];
  unreviewedHead.handoff.findingRefs = [];
  unreviewedHead.risks = unreviewedHead.risks.filter(
    (item) => item.id !== "risk-posix-launch-parity",
  );
  unreviewedHead.handoff.riskRefs = unreviewedHead.risks.map((item) => item.id);
  assert.equal(hasFinding(unreviewedHead, "premature_ready_state"), true);

  const unverifiedEvidence = clone();
  unverifiedEvidence.sources[2].integrity = "unverified";
  assert.equal(hasFinding(unverifiedEvidence, "premature_ready_state"), true);

  const missingBaselineFailure = clone();
  verification(missingBaselineFailure, "verification-focused-windows-shim").baselineResult =
    "not-applicable";
  assert.equal(hasFinding(missingBaselineFailure, "incomplete_criterion_coverage"), true);

  const fabricatedPass = clone();
  verification(fabricatedPass, "verification-required-build").evidenceSourceRef =
    "source-user-request";
  assert.equal(hasFinding(fabricatedPass, "unsupported_verification_result"), true);
});

test("the authorized scope bounds every change and preserves unrelated work", () => {
  const protectedPath = clone();
  change(protectedPath, "change-shim-path-decoding").path = "src/server/launcher.js";
  assert.equal(hasFinding(protectedPath, "unauthorized_path_change"), true);

  const outsideScope = clone();
  change(outsideScope, "change-shim-path-decoding").path = "src/runtime/launcher.js";
  assert.equal(hasFinding(outsideScope, "unauthorized_path_change"), true);

  const overlappingScope = clone();
  overlappingScope.scope.protectedPaths.push("src/cli/internal");
  assert.equal(hasFinding(overlappingScope, "incoherent_authorized_scope"), true);

  const committedUserWork = clone();
  committedUserWork.repository.dirtyStateAtStart.entries[0].disposition =
    "authorized-and-included";
  assert.equal(hasFinding(committedUserWork, "unrecorded_dirty_state"), true);

  const undeclaredDirtyPath = clone();
  undeclaredDirtyPath.scope.protectedPaths = ["src/server"];
  assert.equal(hasFinding(undeclaredDirtyPath, "unrecorded_dirty_state"), true);

  const dependencyEdit = clone();
  change(dependencyEdit, "change-shim-path-decoding").path = "src/cli/package.json";
  assert.equal(hasFinding(dependencyEdit, "unauthorized_dependency_change"), true);
  dependencyEdit.scope.dependencyChangeAuthorized = true;
  assert.equal(hasFinding(dependencyEdit, "unauthorized_dependency_change"), false);
});

test("acceptance criteria and changes must cover each other in both directions", () => {
  const oneWayCoverage = clone();
  criterion(oneWayCoverage, "criterion-windows-shim-discovery").changeRefs = [
    "change-shim-path-decoding",
  ];
  assert.equal(hasFinding(oneWayCoverage, "coverage_mismatch"), true);

  const unclaimedCheck = clone();
  criterion(unclaimedCheck, "criterion-required-validation").verificationRefs = [];
  assert.equal(hasFinding(unclaimedCheck, "coverage_mismatch"), true);

  const behaviorWithoutChange = clone();
  criterion(behaviorWithoutChange, "criterion-required-validation").kind =
    "feature-behavior";
  assert.equal(hasFinding(behaviorWithoutChange, "incomplete_criterion_coverage"), true);

  const silentlyUnmet = clone();
  criterion(silentlyUnmet, "criterion-posix-launch-unchanged").state = "unverifiable";
  assert.equal(hasFinding(silentlyUnmet, "incomplete_criterion_coverage"), true);

  for (const field of [
    "criterionRefs",
    "changeRefs",
    "verificationRefs",
    "reviewRefs",
    "findingRefs",
    "riskRefs",
  ]) {
    const value = clone();
    value.handoff[field] = value.handoff[field].slice(1);
    assert.equal(hasFinding(value, "incomplete_handoff"), true, field);
  }
});

test("delivery authority, ownership, and review stay with named humans", () => {
  for (const owner of [
    "Priya Raman",
    "Platform Maintainers",
    "Release Manager",
    "Assistant Director of Engineering",
    "Agent Miller",
  ]) {
    const value = clone();
    setOwner(value, owner);
    assert.equal(hasFinding(value, "agent_owned_authority"), false, owner);
  }
  for (const owner of [
    "AI",
    "bot",
    "GPT",
    "the assistant",
    "Claw",
    "Copilot",
    "Coding agent",
    "Review bot",
    "AI reviewer",
    "Automated maintainer",
    "the autonomous agent",
    "Synthetic engineer",
    "gpt-5 coding model",
    "An internal language model",
    "Software maintainer",
  ]) {
    const value = clone();
    setOwner(value, owner);
    assert.equal(hasFinding(value, "agent_owned_authority"), true, owner);
  }

  const agentRequester = clone();
  agentRequester.request.requestedBy = "Coding agent";
  assert.equal(hasFinding(agentRequester, "agent_owned_authority"), true);

  const agentAuthorizer = clone();
  agentAuthorizer.delivery.authorizedBy = "Copilot";
  assert.equal(hasFinding(agentAuthorizer, "agent_owned_authority"), true);

  const agentDecider = deliveredRecord();
  agentDecider.ownerDecision.decidedBy = "AI reviewer";
  assert.equal(hasFinding(agentDecider, "agent_owned_authority"), true);

  const agentHumanReviewer = clone();
  setReviewer(agentHumanReviewer, "AI reviewer");
  assert.equal(hasFinding(agentHumanReviewer, "agent_owned_authority"), true);

  const agentSelfReview = clone();
  assert.equal(agentSelfReview.reviews[0].kind, "self-diff-review");
  assert.equal(hasFinding(agentSelfReview, "agent_owned_authority"), false);
});

test("narrative safety survives negation and normalized punctuation", () => {
  const negated = clone();
  change(negated, "change-shim-path-decoding").rationale =
    "Resolve the shim path without reverting the user's uncommitted work and without skipping the failing test that proves the defect.";
  assert.equal(hasFinding(negated, "unsafe_narrative_content"), false);

  const curly = clone();
  negated.handoff.residualRiskSummary =
    "The maintainer won\u2019t force-push this branch; the owner decides how it lands.";
  curly.handoff.residualRiskSummary = negated.handoff.residualRiskSummary;
  assert.equal(hasFinding(curly, "unsafe_narrative_content"), false);

  for (const narrative of [
    "Force-pushed the rebased branch so the older commits would disappear.",
    "Merged the pull request once the suite went green.",
    "Pushed the fix to main after the build finished.",
    "Reverted the user's uncommitted work so the diff would apply cleanly.",
    "Skipped the failing test to keep the suite green.",
    "Assumed the checks pass because nothing in that area changed.",
    "Installed a new dependency to shorten the resolver.",
    "Accepted the residual risk on behalf of the owner.",
    "Closed the issue after landing the change.",
  ]) {
    const value = clone();
    change(value, "change-shim-path-decoding").rationale = narrative;
    assert.equal(hasFinding(value, "unsafe_narrative_content"), true, narrative);
  }
});

test("every change delivery record finding code has a focused case", () => {
  const cases = [
    [
      "duplicate_reference",
      (value) => value.changes.push(structuredClone(value.changes[0])),
    ],
    [
      "dangling_reference",
      (value) => {
        change(value, "change-shim-path-decoding").criterionRefs = ["criterion-missing"];
      },
    ],
    [
      "unverbatim_request_record",
      (value) => {
        value.request.statementVerbatim = false;
      },
    ],
    [
      "invalid_delivery_chronology",
      (value) => {
        verification(value, "verification-focused-windows-shim").startedAt =
          "2026-08-30T09:00:00-07:00";
      },
    ],
    [
      "unsafe_handoff_destination",
      (value) => {
        value.handoff.destination = "outputs/../private/change-delivery-record.md";
      },
    ],
    [
      "invalid_revision_identity",
      (value) => {
        value.repository.baseIsAncestorOfHead = false;
      },
    ],
    [
      "unrecorded_dirty_state",
      (value) => {
        value.repository.dirtyStateAtStart.state = "clean";
      },
    ],
    [
      "incoherent_authorized_scope",
      (value) => {
        value.scope.authorizationSourceRef = "source-launcher-history";
      },
    ],
    [
      "source_provenance_mismatch",
      (value) => {
        value.sources[0].provenance = "workspace-read";
      },
    ],
    [
      "unsafe_source_path",
      (value) => {
        value.sources[0].path = "src/cli/resolve-entrypoint.js";
      },
    ],
    [
      "future_source_evidence",
      (value) => {
        value.sources[0].capturedAt = "2026-08-31T09:00:00-07:00";
      },
    ],
    [
      "unauthorized_path_change",
      (value) => {
        change(value, "change-shim-path-decoding").path = "src/server/launcher.js";
      },
    ],
    [
      "unauthorized_dependency_change",
      (value) => {
        change(value, "change-shim-path-decoding").path = "src/cli/package.json";
      },
    ],
    [
      "unauthorized_behavior_change",
      (value) => {
        change(value, "change-shim-path-decoding").publicBehaviorChange = true;
      },
    ],
    [
      "invalid_change_record",
      (value) => {
        change(value, "change-entrypoint-regression-test").linesRemoved = 4;
      },
    ],
    [
      "unsupported_verification_result",
      (value) => {
        verification(value, "verification-full-suite").result = "failed";
      },
    ],
    [
      "stale_verification_evidence",
      (value) => {
        verification(value, "verification-full-suite").revision = BASE;
      },
    ],
    [
      "invalid_review_state",
      (value) => {
        value.reviews[0].findingRefs = [];
      },
    ],
    [
      "stale_review_evidence",
      (value) => {
        value.reviews[0].revision = BASE;
      },
    ],
    [
      "unresolved_finding_disposition",
      (value) => {
        value.findings[0].changeRefs = [];
      },
    ],
    [
      "unowned_risk_acceptance",
      (value) => {
        value.risks[0].state = "accepted-by-owner";
      },
    ],
    [
      "incomplete_criterion_coverage",
      (value) => {
        verification(value, "verification-focused-windows-shim").baselineResult =
          "not-applicable";
      },
    ],
    [
      "coverage_mismatch",
      (value) => {
        criterion(value, "criterion-windows-shim-discovery").changeRefs = [];
      },
    ],
    [
      "overstated_delivery_authority",
      (value) => {
        value.delivery.authority = "local-only";
        value.delivery.performed = "draft-pull-request-opened";
      },
    ],
    [
      "unauthorized_delivery_action",
      (value) => {
        value.delivery.forcePushed = true;
      },
    ],
    [
      "invalid_owner_decision",
      (value) => {
        value.ownerDecision.state = "completed";
      },
    ],
    [
      "agent_owned_authority",
      (value) => {
        setOwner(value, "AI agent");
      },
    ],
    [
      "owner_mismatch",
      (value) => {
        value.handoff.reviewer = "Sam Okafor";
      },
    ],
    [
      "invalid_change_outcome",
      (value) => {
        value.request.outcome = "no-change-required";
      },
    ],
    [
      "incomplete_handoff",
      (value) => {
        value.handoff.changeRefs = [];
      },
    ],
    [
      "resolved_blocking_reference",
      (value) => {
        value.handoff.blockingRefs = ["risk-unc-path-coverage"];
      },
    ],
    [
      "incomplete_blocked_handoff",
      (value) => {
        value.request.state = "blocked";
        value.handoff.state = "blocked";
      },
    ],
    [
      "premature_ready_state",
      (value) => {
        value.sources[2].integrity = "conflicting";
      },
    ],
    [
      "inconsistent_ready_state",
      (value) => {
        value.request.state = "draft";
      },
    ],
    [
      "unsafe_narrative_content",
      (value) => {
        change(value, "change-shim-path-decoding").rationale =
          "Force-pushed the rebased branch and skipped the failing test to keep the suite green.";
      },
    ],
  ];
  for (const [code, mutate] of cases) {
    const candidate = clone();
    mutate(candidate);
    assert.equal(hasFinding(candidate, code), true, code);
  }

  for (const gate of fixture.blockedActions) {
    const missingBlocked = clone();
    missingBlocked.blockedActions = missingBlocked.blockedActions.filter(
      (item) => item !== gate,
    );
    assert.equal(hasFinding(missingBlocked, "missing_authority_gate"), true, gate);
    const missingProhibited = clone();
    missingProhibited.handoff.prohibitedActions =
      missingProhibited.handoff.prohibitedActions.filter((item) => item !== gate);
    assert.equal(hasFinding(missingProhibited, "missing_authority_gate"), true, gate);
  }

  const covered = new Set(cases.map(([code]) => code));
  covered.add("missing_authority_gate");
  assert.deepEqual(
    [...emittedFindingCodes].filter((code) => !covered.has(code)),
    [],
  );
});
