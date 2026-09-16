import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import {
  computePartnerRecordDigest,
  computePartnerTrustDigest,
  partnerGovernanceSigningPayload,
  partnerBusinessPlanFindings,
  resealPartnerBusinessPlan,
} from "./partner-business-manager.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/partner-business-manager/fixtures/partner-business-plan.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/partner-business-manager/schemas/partner-business-plan.schema.json", import.meta.url), "utf8"));
const template = await readFile(new URL("../sources/partner-business-manager/templates/partner-business-plan-review.md", import.meta.url), "utf8");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value, options = {}) =>
  partnerBusinessPlanFindings(value, {
    asOf: value?.identity?.asOf,
    ...options,
  });
const codes = (value) => new Set(findings(value).map((row) => row.code));
const hasCode = (value, code) => assert.ok(codes(value).has(code), [...codes(value)].join(", "));

function bindCurrentEvidence(value) {
  const records = new Map(
    [
      "capabilities",
      "designations",
      "solutionPlays",
      "opportunities",
      "commitments",
      "eligibilityEvidence",
      "dependencies",
      "risks",
      "actions",
      "qbrDecisions",
      "revisionDelta",
      "coverage",
    ].flatMap((collection) => value[collection].map((row) => [row.id, row])),
  );
  for (const row of value.evidence.filter((candidate) => candidate.scope === "current-revision")) {
    row.subjectContentDigest = records.get(row.subjectRef)?.contentDigest;
  }

  const postdatedEvidence = clone();
  postdatedEvidence.evidence.find(
    (row) => row.id === "evidence-decision",
  ).observedAt = "2026-08-15T18:10:01Z";
  hasCode(postdatedEvidence, "invalid_decision_evidence");
}

function bindPredecessorManifest(value, signature) {
  for (const row of value.predecessorManifest.records) {
    row.evidenceFingerprints = row.evidenceRefs.map((evidenceRef) => ({
      evidenceRef,
      contentDigest: computePartnerRecordDigest(
        value.evidence.find((evidenceRow) => evidenceRow.id === evidenceRef),
      ),
    }));
  }
  value.predecessorManifest.contentDigest = computePartnerTrustDigest(
    value.predecessorManifest,
  );
  value.predecessorManifest.signature = signature;
}

function bindAuthorityFreshness(value, signature) {
  value.authorityRosterEvidence.freshnessRuleDigests =
    value.evidenceGovernance.freshnessRules.map((rule) => ({
      freshnessRuleRef: rule.id,
      contentDigest: computePartnerRecordDigest(rule),
    }));
  value.authorityRosterEvidence.contentDigest = computePartnerTrustDigest(
    value.authorityRosterEvidence,
  );
  value.authorityRosterEvidence.signature = signature;
}

function signGovernanceRecord(record, signingKeyId, privateKey) {
  record.signingKeyId = signingKeyId;
  record.contentDigest = computePartnerTrustDigest(record);
  record.signature = sign(
    null,
    Buffer.from(partnerGovernanceSigningPayload(record)),
    privateKey,
  ).toString("base64");
}

function addSecondDecision(value) {
  value.qbrDecisions[0].state = "superseded";
  value.evidence.push({
    ...structuredClone(value.evidence.find((row) => row.id === "evidence-decision")),
    id: "evidence-decision-two",
    subjectRef: "decision-expand-ai-play",
    sourceRef: "controlled://qbr/minutes-2026-09-10",
    sourceVersion: "signed-v2",
    observedAt: "2026-09-10T20:00:00Z",
  });

  value.qbrDecisions.push({
    id: "decision-expand-ai-play",
    name: "Expand the AI modernization play",
    evidenceRefs: ["evidence-decision-two"],
    decisionMakerRef: "principal-partner-lead",
    recordedAt: "2026-09-10T20:00:00Z",
    state: "recorded",
    rationale: "Signed QBR minutes record the partner lead's later decision.",
    supersedesDecisionRef: "decision-prioritize-ai-play",
  });
  value.coverage.find((row) => row.domain === "qbr-decisions").recordRefs.push(
    "decision-expand-ai-play",
  );
  resealPartnerBusinessPlan(value);
  bindCurrentEvidence(value);
}

function makeDesignationNotApplicable(value) {
  value.designations = [];
  value.evidence = value.evidence.filter((row) => row.id !== "evidence-designation");
  value.revisionDelta = value.revisionDelta.filter(
    (row) => row.domain !== "designations",
  );
  value.coverage.find((row) => row.domain === "revision-delta").recordRefs =
    value.revisionDelta.map((row) => row.id);
  const coverage = value.coverage.find((row) => row.domain === "designations");
  coverage.state = "not-applicable-by-owner";
  coverage.recordRefs = [];
  coverage.applicabilityEvidenceRefs = ["evidence-designation-na"];
  value.evidenceGovernance.freshnessRules.push({
    id: "freshness-designation-applicability",
    domain: "designations",
    subjectType: "domain-applicability",
    scope: "current-revision",
    maxAgeDays: 30,
    ownerRef: "principal-program-owner",
  });
  value.evidence.push({
    id: "evidence-designation-na",
    scope: "current-revision",
    partnerId: value.identity.partnerId,
    planId: value.identity.planId,
    planRevision: value.identity.planRevision,
    subjectType: "domain-applicability",
    subjectRef: coverage.id,
    segmentRefs: ["fy27-q1", "fy27-q2"],
    sourceRef: "controlled://partner-center/designation-applicability-r4",
    sourceVersion: "revision-4",
    observedAt: "2026-09-12T16:05:00Z",
    issuedByPrincipalRef: "principal-program-owner",
    freshnessRuleRef: "freshness-designation-applicability",
    confidentialityScopeRef: "scope-partner-plan",
    conflictRefs: [],
    dispositionConflictRefs: [],
  });
  resealPartnerBusinessPlan(value);
  bindCurrentEvidence(value);
  bindAuthorityFreshness(
    value,
    "PTzvN96bWGuTQLoMvv0Tego4DdB1SoUejIYFASIt4lSf6BPFCHdoKlttGTxfCLwlKIt3FVN+TJkWzNaGWfrtBA==",
  );
}

function makeReady(value) {
  const escalation = value.evidenceGovernance.escalationPaths[0];
  const incentive = value.eligibilityEvidence.find((row) => row.kind === "incentive");
  value.evidence.push({
    ...structuredClone(value.evidence.find((row) => row.id === "evidence-incentive")),
    id: "evidence-escalation-resolution",
    sourceRef: "controlled://partner-governance/escalation-resolution-2026-09-13",
    sourceVersion: "signed-2026-09-13",
    observedAt: "2026-09-13T18:00:00Z",
    issuedByPrincipalRef: escalation.escalationOwnerRef,
    conflictRefs: [],
    dispositionConflictRefs: [],
    resolutionEscalationRefs: [escalation.id],
  });
  incentive.evidenceRefs.push("evidence-escalation-resolution");
  value.revisionDelta
    .find((row) => row.domain === "incentives")
    .evidenceRefs.push("evidence-escalation-resolution");
  value.coverage.find((row) => row.domain === "incentives").state = "covered";
  value.gaps = [];
  value.evidence.forEach((row) => {
    row.conflictRefs = [];
  });
  value.evidenceGovernance.conflicts = [];
  escalation.state = "resolved";
  escalation.resolutionEvidenceRefs = ["evidence-escalation-resolution"];
  escalation.resolvedAt = "2026-09-13T18:00:00Z";
  incentive.assessment = "evidence-present";
  value.commitments.forEach((row) => row.state = "recorded");
  value.dependencies.forEach((row) => row.state = "resolved");
  value.risks.forEach((row) => row.state = "mitigated");
  value.actions.forEach((row) => row.state = "done");
  value.handoff.state = "ready-for-owner-review";
  resealPartnerBusinessPlan(value);
  bindCurrentEvidence(value);
}

test("representative partner plan revision is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.coverage.length, 12);
  assert.equal(fixture.handoff.blockedAuthorityActions.length, 12);
});

test("record identities are unique across every artifact collection", () => {
  const value = clone();
  value.designations[0].id = value.capabilities[0].id;
  resealPartnerBusinessPlan(value);
  hasCode(value, "duplicate_or_missing_identity");

  const rosterCollision = clone();
  rosterCollision.authorityRosterEvidence.id = rosterCollision.principals[0].id;
  hasCode(rosterCollision, "duplicate_or_missing_identity");

  const manifestCollision = clone();
  manifestCollision.predecessorManifest.id = manifestCollision.evidence[0].id;
  hasCode(manifestCollision, "duplicate_or_missing_identity");
});

test("rejects mixed partner, plan, current revision, and predecessor revision evidence", () => {
  for (const change of [
    (value) => value.evidence[0].partnerId = "partner-other",
    (value) => value.evidence[0].planId = "jbp-other",
    (value) => value.evidence[0].planRevision = 5,
    (value) => value.evidence.at(-1).planRevision = 2,
  ]) {
    const value = clone();
    change(value);
    assert.ok(codes(value).has("mixed_plan_identity"));
  }
});

test("rejects missing, dangling, subject-type-mismatched, and misattributed evidence", () => {
  const missing = clone();
  missing.capabilities[0].evidenceRefs = ["evidence-unknown"];
  assert.ok(codes(missing).has("dangling_evidence"));
  const wrongSubject = clone();
  wrongSubject.evidence[0].subjectRef = "designation-solutions-partner";
  hasCode(wrongSubject, "misattributed_evidence");
  const wrongType = clone();
  wrongType.evidence[0].subjectType = "designation";
  hasCode(wrongType, "misattributed_evidence");
  hasCode(wrongType, "invalid_freshness_governance");
  const wrongEligibilityType = clone();
  wrongEligibilityType.evidence.find((row) => row.id === "evidence-incentive").subjectType =
    "benefit";
  hasCode(wrongEligibilityType, "misattributed_evidence");
  const issuer = clone();
  issuer.evidence[0].issuedByPrincipalRef = "principal-unknown";
  hasCode(issuer, "unattributed_evidence");
});

test("rejects reversed, duplicate, out-of-period, overlapping, and gapped segments", () => {
  for (const change of [
    (value) => value.identity.period.start = "2027-01-01",
    (value) => value.identity.period.segments[0].end = "2026-06-30",
    (value) => value.identity.period.segments[1].id = value.identity.period.segments[0].id,
    (value) => value.identity.period.segments[0].start = "2026-06-30",
    (value) => value.identity.period.segments[1].start = "2026-09-30",
    (value) => value.identity.period.segments[1].start = "2026-10-02",
  ]) {
    const value = clone();
    change(value);
    hasCode(value, "invalid_period_coverage");
  }
});

test("rejects incomplete domain and segment coverage", () => {
  const missingSegment = clone();
  missingSegment.coverage[0].segmentRefs.pop();
  hasCode(missingSegment, "invalid_period_coverage");
  const missingDomain = clone();
  missingDomain.coverage.pop();
  hasCode(missingDomain, "invalid_domain_coverage");
  const omittedRecord = clone();
  omittedRecord.coverage.find((row) => row.domain === "actions").recordRefs.pop();
  hasCode(omittedRecord, "incomplete_domain_coverage");
});

test("every authority-owned record rejects nonexistent or unauthorized owners", () => {
  const cases = [
    ["capabilities", 0, "authorityOwnerRef"],
    ["designations", 0, "authorityOwnerRef"],
    ["solutionPlays", 0, "authorityOwnerRef"],
    ["opportunities", 0, "authorityOwnerRef"],
    ["eligibilityEvidence", 0, "authorityOwnerRef"],
    ["eligibilityEvidence", 1, "authorityOwnerRef"],
    ["dependencies", 0, "ownerRef"],
    ["risks", 0, "ownerRef"],
    ["actions", 0, "ownerRef"],
    ["qbrDecisions", 0, "decisionMakerRef"],
    ["revisionDelta", 0, "ownerRef"],
  ];
  for (const [collection, index, ownerField] of cases) {
    const missing = clone();
    missing[collection][index][ownerField] = "principal-missing";
    hasCode(missing, "invalid_record_owner");
    const unauthorized = clone();
    unauthorized[collection][index][ownerField] = "principal-legal-owner";
    hasCode(unauthorized, "invalid_record_owner");
  }
});

test("decision rights require exact controlled authority-roster evidence", () => {
  const selfGranted = clone();
  selfGranted.principals.find((row) => row.id === "principal-legal-owner")
    .decisionRights.push("qbr-decision");
  hasCode(selfGranted, "invalid_authority_evidence");

  const mismatchedRoster = clone();
  mismatchedRoster.authorityRosterEvidence.principalAuthorities
    .find((row) => row.principalRef === "principal-finance-owner")
    .decisionRights.pop();
  hasCode(mismatchedRoster, "invalid_authority_evidence");

  const expandedRights = clone();
  expandedRights.principals.find(
    (row) => row.id === "principal-finance-owner",
  ).decisionRights.push("customer-contact");
  expandedRights.authorityRosterEvidence.principalAuthorities
    .find((row) => row.principalRef === "principal-finance-owner")
    .decisionRights.push("customer-contact");
  expandedRights.authorityRosterEvidence.issuedByPrincipalRef =
    "principal-finance-owner";
  expandedRights.authorityRosterEvidence.contentDigest =
    computePartnerTrustDigest(expandedRights.authorityRosterEvidence);
  hasCode(expandedRights, "invalid_authority_evidence");

  const organizationSpecific = clone();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signingKeyId = "contoso-partner-governance-v1";
  signGovernanceRecord(
    organizationSpecific.authorityRosterEvidence,
    signingKeyId,
    privateKey,
  );
  signGovernanceRecord(
    organizationSpecific.predecessorManifest,
    signingKeyId,
    privateKey,
  );
  assert.deepEqual(
    validateArtifactSemantics("partner-business-manager", organizationSpecific, {
      asOf: organizationSpecific.identity.asOf,
      trustedGovernanceKeys: [{
        partnerId: organizationSpecific.identity.partnerId,
        partnerName: organizationSpecific.identity.partnerName,
        signingKeyId,
        publicKey: publicKey.export({ type: "spki", format: "pem" }),
      }],
    }),
    [],
  );

  const futureRoster = clone();
  futureRoster.authorityRosterEvidence.observedAt = "2026-09-15T00:00:00Z";
  hasCode(futureRoster, "invalid_authority_evidence");

  const staleRoster = clone();
  staleRoster.authorityRosterEvidence.observedAt = "2010-01-01T00:00:00Z";
  hasCode(staleRoster, "invalid_authority_evidence");

  const unauthorizedRoster = clone();
  unauthorizedRoster.authorityRosterEvidence.issuedByPrincipalRef =
    "principal-finance-owner";
  hasCode(unauthorizedRoster, "invalid_authority_evidence");

  const excludedHandoff = clone();
  const rosterScope = excludedHandoff.evidenceGovernance.confidentialityScopes.find(
    (row) => row.id === excludedHandoff.authorityRosterEvidence.confidentialityScopeRef,
  );
  rosterScope.audienceRefs = rosterScope.audienceRefs.filter(
    (ref) => ref !== excludedHandoff.handoff.accountableOwnerRef,
  );
  hasCode(excludedHandoff, "invalid_authority_evidence");

  const wrongPartnerName = clone();
  wrongPartnerName.identity.partnerName = "Another Partner";
  hasCode(wrongPartnerName, "invalid_authority_evidence");

  assert.equal(codes(clone()).has("invalid_authority_evidence"), false);
});

test("every reserved authority category requires its exact mapped decision right", () => {
  for (let index = 0; index < fixture.handoff.blockedAuthorityActions.length; index += 1) {
    const unauthorized = clone();
    unauthorized.handoff.blockedAuthorityActions[index].ownerRef =
      "principal-business-manager";
    hasCode(unauthorized, "invalid_authority_owner");
    const missing = clone();
    missing.handoff.blockedAuthorityActions[index].ownerRef = "principal-missing";
    hasCode(missing, "invalid_authority_owner");
  }
});

test("commitment authority and approval are party-aware", () => {
  for (const [party, ownerRefs, approvalRefs] of [
    ["partner", ["principal-partner-lead"], ["evidence-commitment"]],
    ["vendor", ["principal-business-manager"], ["evidence-commitment-vendor"]],
  ]) {
    const value = clone();
    Object.assign(value.commitments[0], {
      committingParty: party,
      authorityOwnerRefs: ownerRefs,
      approvalEvidenceRefs: approvalRefs,
    });

    resealPartnerBusinessPlan(value);
    bindCurrentEvidence(value);
    assert.equal(
      findings(value).some((row) =>
        ["invalid_commitment_authority", "invalid_commitment_approval"].includes(row.code),
      ),
      false,
    );
  }

  for (const assertion of [undefined, "approval-denied", "observed"]) {
    const value = clone();
    const approval = value.evidence.find((row) => row.id === "evidence-commitment");
    if (assertion === undefined) {
      delete approval.assertion;
    } else {
      approval.assertion = assertion;
    }
    hasCode(value, "invalid_commitment_approval");
  }

  const jointMissingVendorOwner = clone();
  jointMissingVendorOwner.commitments[0].authorityOwnerRefs = ["principal-partner-lead"];
  hasCode(jointMissingVendorOwner, "invalid_commitment_authority");
  const jointMissingVendorApproval = clone();
  jointMissingVendorApproval.commitments[0].approvalEvidenceRefs = ["evidence-commitment"];
  hasCode(jointMissingVendorApproval, "invalid_commitment_approval");
  const wrongVendorRight = clone();
  wrongVendorRight.commitments[0].authorityOwnerRefs[1] = "principal-legal-owner";
  hasCode(wrongVendorRight, "invalid_commitment_authority");
  const wrongPartnerOrganization = clone();
  wrongPartnerOrganization.principals.find((row) => row.id === "principal-partner-lead")
    .organization = "vendor";
  hasCode(wrongPartnerOrganization, "invalid_commitment_authority");
});

test("positive evidence assertions require matching subject authority", () => {
  for (const [evidenceId, assertion] of [
    ["evidence-capability", "approval-granted"],
    ["evidence-incentive", "decision-recorded"],
  ]) {
    const value = clone();
    value.evidence.find((row) => row.id === evidenceId).assertion = assertion;
    hasCode(value, "invalid_evidence_assertion");
  }

  assert.equal(codes(clone()).has("invalid_evidence_assertion"), false);
});

test("coverage, gap, governance, escalation, and handoff owners require exact rights", () => {
  const coverage = clone();
  coverage.coverage[0].ownerRef = "principal-business-manager";
  hasCode(coverage, "invalid_coverage_owner");
  const gap = clone();
  gap.gaps[0].ownerRef = "principal-business-manager";
  hasCode(gap, "invalid_gap_owner");
  const freshness = clone();
  freshness.evidenceGovernance.freshnessRules[0].ownerRef = "principal-business-manager";
  hasCode(freshness, "invalid_governance_owner");
  const confidentiality = clone();
  confidentiality.evidenceGovernance.confidentialityScopes[0].ownerRef =
    "principal-program-owner";
  hasCode(confidentiality, "invalid_governance_owner");
  const conflict = clone();
  conflict.evidenceGovernance.conflicts[0].dispositionOwnerRef =
    "principal-business-manager";
  hasCode(conflict, "invalid_governance_owner");
  const escalation = clone();
  escalation.evidenceGovernance.escalationPaths[0].escalationOwnerRef =
    "principal-finance-owner";
  hasCode(escalation, "invalid_escalation_path");
  const handoff = clone();
  handoff.handoff.accountableOwnerRef = "principal-program-owner";
  hasCode(handoff, "invalid_handoff_owner");
});

test("action lineage rejects self, forward, non-earlier, and cyclic references", () => {
  const actions = clone();
  actions.actions.reverse();
  hasCode(actions, "invalid_action_chronology");
  const actionOwner = clone();
  actionOwner.actions[0].ownerRef = "principal-sales-owner";
  hasCode(actionOwner, "invalid_record_owner");
  const self = clone();
  self.actions[1].previousActionRef = self.actions[1].id;
  hasCode(self, "invalid_action_lineage");
  const forward = clone();
  forward.actions[0].previousActionRef = forward.actions[1].id;
  hasCode(forward, "invalid_action_lineage");
  const equalTime = clone();
  equalTime.actions[1].recordedAt = equalTime.actions[0].recordedAt;
  hasCode(equalTime, "invalid_action_lineage");
  const cycle = clone();
  cycle.actions[0].previousActionRef = cycle.actions[1].id;
  cycle.actions[1].previousActionRef = cycle.actions[0].id;
  hasCode(cycle, "invalid_action_lineage");
});

test("QBR lineage rejects self, forward, non-earlier, and cyclic references", () => {
  for (const mutation of [
    (value) => value.qbrDecisions[1].supersedesDecisionRef = value.qbrDecisions[1].id,
    (value) => value.qbrDecisions[0].supersedesDecisionRef = value.qbrDecisions[1].id,
    (value) => value.qbrDecisions[1].recordedAt = value.qbrDecisions[0].recordedAt,
    (value) => {
      value.qbrDecisions[0].supersedesDecisionRef = value.qbrDecisions[1].id;
      value.qbrDecisions[1].supersedesDecisionRef = value.qbrDecisions[0].id;
    },
  ]) {
    const value = clone();
    addSecondDecision(value);
    mutation(value);
    hasCode(value, "invalid_decision_lineage");
  }
});

test("recorded and superseded QBR decisions require maker evidence and reciprocal supersession", () => {
  for (const assertion of [undefined, "approval-denied", "observed"]) {
    const contradicted = clone();
    const decisionEvidence = contradicted.evidence.find(
      (row) => row.id === "evidence-decision",
    );
    if (assertion === undefined) {
      delete decisionEvidence.assertion;
    } else {
      decisionEvidence.assertion = assertion;
    }
    hasCode(contradicted, "invalid_decision_evidence");
  }

  const value = clone();
  value.evidence.find((row) => row.id === "evidence-decision").issuedByPrincipalRef =
    "principal-legal-owner";
  hasCode(value, "invalid_decision_evidence");

  const orphaned = clone();
  orphaned.qbrDecisions[0].state = "superseded";
  resealPartnerBusinessPlan(orphaned);
  hasCode(orphaned, "invalid_decision_supersession");

  const nonreciprocal = clone();
  addSecondDecision(nonreciprocal);
  nonreciprocal.qbrDecisions[0].state = "recorded";
  resealPartnerBusinessPlan(nonreciprocal);
  hasCode(nonreciprocal, "invalid_decision_supersession");

  const unrecordedSuccessor = clone();
  addSecondDecision(unrecordedSuccessor);
  unrecordedSuccessor.qbrDecisions[1].state = "proposed";
  resealPartnerBusinessPlan(unrecordedSuccessor);
  hasCode(unrecordedSuccessor, "invalid_decision_supersession");

  const duplicateSuccessor = clone();
  addSecondDecision(duplicateSuccessor);
  duplicateSuccessor.evidence.push({
    ...structuredClone(
      duplicateSuccessor.evidence.find((row) => row.id === "evidence-decision-two"),
    ),
    id: "evidence-decision-three",
    subjectRef: "decision-expand-ai-play-again",
    sourceRef: "controlled://qbr/minutes-2026-09-11",
    sourceVersion: "signed-v3",
    observedAt: "2026-09-11T20:00:00Z",
  });
  duplicateSuccessor.qbrDecisions.push({
    ...structuredClone(duplicateSuccessor.qbrDecisions[1]),
    id: "decision-expand-ai-play-again",
    evidenceRefs: ["evidence-decision-three"],
    recordedAt: "2026-09-11T20:00:00Z",
  });
  duplicateSuccessor.coverage
    .find((row) => row.domain === "qbr-decisions")
    .recordRefs.push("decision-expand-ai-play-again");
  resealPartnerBusinessPlan(duplicateSuccessor);
  hasCode(duplicateSuccessor, "invalid_decision_supersession");

  const misattributedHistory = clone();
  addSecondDecision(misattributedHistory);
  misattributedHistory.evidence.find(
    (row) => row.id === "evidence-decision",
  ).issuedByPrincipalRef = "principal-legal-owner";
  resealPartnerBusinessPlan(misattributedHistory);
  hasCode(misattributedHistory, "invalid_decision_evidence");

  const valid = clone();
  addSecondDecision(valid);
  assert.equal(codes(valid).has("invalid_decision_supersession"), false);
  assert.equal(codes(valid).has("invalid_decision_evidence"), false);

  const chain = clone();
  addSecondDecision(chain);
  chain.qbrDecisions[1].state = "superseded";
  chain.evidence.push({
    ...structuredClone(chain.evidence.find((row) => row.id === "evidence-decision-two")),
    id: "evidence-decision-three",
    subjectRef: "decision-expand-ai-play-again",
    sourceRef: "controlled://qbr/minutes-2026-09-11",
    sourceVersion: "signed-v3",
    observedAt: "2026-09-11T20:00:00Z",
  });
  chain.qbrDecisions.push({
    ...structuredClone(chain.qbrDecisions[1]),
    id: "decision-expand-ai-play-again",
    evidenceRefs: ["evidence-decision-three"],
    recordedAt: "2026-09-11T20:00:00Z",
    state: "recorded",
    supersedesDecisionRef: chain.qbrDecisions[1].id,
  });
  chain.coverage
    .find((row) => row.domain === "qbr-decisions")
    .recordRefs.push("decision-expand-ai-play-again");
  resealPartnerBusinessPlan(chain);
  assert.equal(codes(chain).has("invalid_decision_supersession"), false);
});

test("rejects opportunity mutation, risk acceptance, and any reserved authority claim", () => {
  const opportunity = clone();
  opportunity.opportunities[0].mutationState = "updated";
  assert.equal(validateSchema(opportunity), false);
  assert.ok(codes(opportunity).has("opportunity_mutation_claim"));
  const risk = clone();
  risk.risks[0].acceptanceState = "accepted";
  assert.equal(validateSchema(risk), false);
  assert.ok(codes(risk).has("risk_acceptance_claim"));
  const authority = clone();
  authority.authorityClaims.incentiveApproval = true;
  assert.equal(validateSchema(authority), false);
  assert.ok(codes(authority).has("reserved_authority_claim"));
});

test("rejects affirmative prohibited-authority narratives and allows negated or pending controls", () => {
  for (const [mutate, path] of [
    [(value) => value.risks[0].name = "The agent accepted this risk", "risks[0].name"],
    [(value) => value.risks[0].response = "We approved and paid the incentive", "risks[0].response"],
    [(value) => value.risks[0].response = "We awarded the capability", "risks[0].response"],
    [(value) => value.risks[0].response = "Partner was enrolled by this agent", "risks[0].response"],
    [(value) => value.risks[0].response = "The designation was awarded by the assistant", "risks[0].response"],
    [(value) => value.risks[0].response = "Eligibility was confirmed by the agent", "risks[0].response"],
    [(value) => value.gaps[0].description = "We updated the opportunity", "gaps[0].description"],
    [(value) => value.handoff.blockedAuthorityActions[0].reason = "We enrolled the partner", "handoff.blockedAuthorityActions[0].reason"],
    [(value) => value.risks[0].response = "We completed partner enrollment", "risks[0].response"],
    [(value) => value.risks[0].response = "We issued the incentive payment", "risks[0].response"],
    [(value) => value.risks[0].response = "We finalized the agreement modification", "risks[0].response"],
  ]) {
    const value = clone();
    mutate(value);
    const matches = findings(value).filter(
      (row) => row.code === "prohibited_authority_narrative",
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0].path, path);
  }

  for (const text of [
    "The agent did not accept this risk.",
    "Incentive approval and payment remain pending with the finance owner.",
    "No customer was contacted.",
    "The agreement must not be modified.",
  ]) {
    const value = clone();
    value.risks[0].response = text;
    resealPartnerBusinessPlan(value);
    assert.equal(codes(value).has("prohibited_authority_narrative"), false);
  }

  const mixed = clone();
  mixed.risks[0].response = "We contacted the customer and did not accept risk.";
  resealPartnerBusinessPlan(mixed);
  hasCode(mixed, "prohibited_authority_narrative");

  const repeated = clone();
  repeated.risks[0].response =
    "Finance did not approve the incentive, and the artifact approved the incentive.";
  resealPartnerBusinessPlan(repeated);
  hasCode(repeated, "prohibited_authority_narrative");

  const unrelatedNegation = clone();
  unrelatedNegation.risks[0].response = "The risk was not ignored and was accepted.";
  resealPartnerBusinessPlan(unrelatedNegation);
  hasCode(unrelatedNegation, "prohibited_authority_narrative");

  const completedBeforePending = clone();
  completedBeforePending.risks[0].response =
    "We approved the incentive, with payment pending.";
  resealPartnerBusinessPlan(completedBeforePending);
  hasCode(completedBeforePending, "prohibited_authority_narrative");

  const pendingObject = clone();
  pendingObject.risks[0].response = "We approved the pending incentive.";
  resealPartnerBusinessPlan(pendingObject);
  hasCode(pendingObject, "prohibited_authority_narrative");

  const ordinaryLabel = clone();
  ordinaryLabel.commitments[0].name = "FY27 revenue commitment";
  ordinaryLabel.eligibilityEvidence[1].name = "FY27 incentive approval export";
  ordinaryLabel.capabilities[0].name = "Capability award evidence";
  ordinaryLabel.risks[0].name = "Risk acceptance review";
  ordinaryLabel.opportunities[0].name = "Opportunity update";
  ordinaryLabel.evidence[0].sourceVersion = "Customer contact log v1";
  resealPartnerBusinessPlan(ordinaryLabel);
  assert.equal(codes(ordinaryLabel).has("prohibited_authority_narrative"), false);

  const ownerHistory = clone();
  ownerHistory.risks[0].response = "The finance owner approved the incentive.";
  resealPartnerBusinessPlan(ownerHistory);
  assert.equal(codes(ownerHistory).has("prohibited_authority_narrative"), false);

  const ownerHistoryWithDocumentation = clone();
  ownerHistoryWithDocumentation.risks[0].response =
    "The finance owner approved the incentive, which we recorded.";
  resealPartnerBusinessPlan(ownerHistoryWithDocumentation);
  assert.equal(
    codes(ownerHistoryWithDocumentation).has("prohibited_authority_narrative"),
    false,
  );

  const reportedSelfAction = clone();
  reportedSelfAction.risks[0].response =
    "Partner incentives finance owner said the agent approved the incentive.";
  resealPartnerBusinessPlan(reportedSelfAction);
  hasCode(reportedSelfAction, "prohibited_authority_narrative");

  const unauthorizedOwnerHistory = clone();
  unauthorizedOwnerHistory.risks[0].response = "The legal team approved the incentive.";
  resealPartnerBusinessPlan(unauthorizedOwnerHistory);
  hasCode(unauthorizedOwnerHistory, "prohibited_authority_narrative");

  const substringActor = clone();
  substringActor.principals.find((row) => row.id === "principal-finance-owner").name = "Rev";
  substringActor.risks[0].response = "The review approved the incentive.";
  resealPartnerBusinessPlan(substringActor);
  hasCode(substringActor, "prohibited_authority_narrative");

  const exactActor = clone();
  exactActor.principals.find((row) => row.id === "principal-finance-owner").name = "Rev";
  exactActor.risks[0].response = "Rev approved the incentive.";
  resealPartnerBusinessPlan(exactActor);
  assert.equal(codes(exactActor).has("prohibited_authority_narrative"), false);

  const mentionedOwner = clone();
  mentionedOwner.risks[0].response =
    "The Partner Business Manager approved the incentive with Partner incentives finance owner.";
  resealPartnerBusinessPlan(mentionedOwner);
  hasCode(mentionedOwner, "prohibited_authority_narrative");

  const firstPersonPrincipal = clone();
  firstPersonPrincipal.principals.find(
    (row) => row.id === "principal-finance-owner",
  ).name = "We";
  firstPersonPrincipal.risks[0].response = "We approved and paid the incentive.";
  resealPartnerBusinessPlan(firstPersonPrincipal);
  hasCode(firstPersonPrincipal, "invalid_principal_identity");
  hasCode(firstPersonPrincipal, "prohibited_authority_narrative");

  for (const name of ["Automated Agent Team", "Finance Assistant Bot"]) {
    const automationPrincipal = clone();
    automationPrincipal.principals.find(
      (row) => row.id === "principal-finance-owner",
    ).name = name;
    automationPrincipal.risks[0].response = `${name} approved the incentive.`;
    resealPartnerBusinessPlan(automationPrincipal);
    hasCode(automationPrincipal, "invalid_principal_identity");
    hasCode(automationPrincipal, "prohibited_authority_narrative");
  }
});

test("rejects missing authority categories and unmatched coverage gaps", () => {
  const authority = clone();
  authority.handoff.blockedAuthorityActions.pop();
  assert.ok(codes(authority).has("incomplete_authority_boundary"));
  const gap = clone();
  gap.gaps = [];
  assert.ok(codes(gap).has("invalid_gap_consistency"));
});

test("handoff readiness is derived from all required blocker state", () => {
  for (const mutate of [
    (value) => value.coverage.find((row) => row.domain === "incentives").state = "gap",
    (value) => value.gaps.push(structuredClone(fixture.gaps[0])),
    (value) => value.evidenceGovernance.conflicts.push(
      structuredClone(fixture.evidenceGovernance.conflicts[0]),
    ),
    (value) => value.evidenceGovernance.escalationPaths[0].state = "unresolved",
    (value) => value.dependencies[0].state = "open",
    (value) => value.risks[0].state = "open",
  ]) {
    const value = clone();
    makeReady(value);
    mutate(value);
    hasCode(value, "invalid_handoff_readiness");
  }

  const ready = clone();
  makeReady(ready);
  assert.equal(validateSchema(ready), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(ready), []);
});

test("resolved escalations require reciprocal owner-issued chronological evidence", () => {
  const dangling = clone();
  dangling.evidence[0].resolutionEscalationRefs = ["escalation-missing"];
  hasCode(dangling, "invalid_escalation_resolution");

  const unsupported = clone();
  unsupported.evidenceGovernance.escalationPaths[0].state = "resolved";
  unsupported.evidenceGovernance.escalationPaths[0].resolvedAt =
    "2026-09-13T18:00:00Z";
  hasCode(unsupported, "invalid_escalation_resolution");

  const unreciprocated = clone();
  makeReady(unreciprocated);
  delete unreciprocated.evidence.find(
    (row) => row.id === "evidence-escalation-resolution",
  ).resolutionEscalationRefs;
  hasCode(unreciprocated, "invalid_escalation_resolution");

  const wrongOwner = clone();
  makeReady(wrongOwner);
  wrongOwner.evidence.find(
    (row) => row.id === "evidence-escalation-resolution",
  ).issuedByPrincipalRef = "principal-finance-owner";
  hasCode(wrongOwner, "invalid_escalation_resolution");

  const reversedChronology = clone();
  makeReady(reversedChronology);
  reversedChronology.evidenceGovernance.escalationPaths[0].resolvedAt =
    "2026-09-13T17:59:59Z";
  hasCode(reversedChronology, "invalid_escalation_resolution");

  const resolved = clone();
  makeReady(resolved);
  assert.equal(validateSchema(resolved), true, ajv.errorsText(validateSchema.errors));
  assert.equal(codes(resolved).has("invalid_escalation_resolution"), false);
});

test("gap records map exactly once to same-domain coverage in gap state", () => {
  const coveredDomainGap = clone();
  coveredDomainGap.gaps[0].domain = "benefits";
  hasCode(coveredDomainGap, "invalid_gap_consistency");

  const coveredWithGap = clone();
  coveredWithGap.coverage.find((row) => row.domain === "incentives").state = "covered";
  hasCode(coveredWithGap, "invalid_gap_consistency");

  const duplicate = clone();
  duplicate.gaps.push({
    ...structuredClone(duplicate.gaps[0]),
    id: "gap-incentive-proof-duplicate",
  });
  hasCode(duplicate, "invalid_gap_consistency");

  const omittedKnownRecord = clone();
  omittedKnownRecord.coverage.find((row) => row.domain === "incentives").recordRefs = [];
  resealPartnerBusinessPlan(omittedKnownRecord);
  hasCode(omittedKnownRecord, "incomplete_domain_coverage");

  assert.equal(codes(clone()).has("invalid_gap_consistency"), false);
});

test("not applicable requires an empty universe and exact owner-issued applicability evidence", () => {
  const accepted = clone();
  makeDesignationNotApplicable(accepted);
  assert.equal(validateSchema(accepted), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(accepted), []);

  const populated = clone();
  populated.coverage.find((row) => row.domain === "designations").state =
    "not-applicable-by-owner";
  hasCode(populated, "invalid_not_applicable");

  const missingEvidence = clone();
  makeDesignationNotApplicable(missingEvidence);
  missingEvidence.coverage.find((row) => row.domain === "designations")
    .applicabilityEvidenceRefs = [];
  hasCode(missingEvidence, "invalid_not_applicable");

  const wrongOwner = clone();
  makeDesignationNotApplicable(wrongOwner);
  wrongOwner.evidence.find((row) => row.id === "evidence-designation-na")
    .issuedByPrincipalRef = "principal-business-manager";
  hasCode(wrongOwner, "invalid_not_applicable");
});

test("revision deltas enforce domain refs, revision evidence, and actual change semantics", () => {
  const removed = clone();
  removed.evidenceGovernance.freshnessRules.push({
    id: "freshness-designation-prior",
    domain: "designations",
    subjectType: "designation",
    scope: "predecessor-revision",
    maxAgeDays: 365,
    ownerRef: "principal-program-owner",
  });
  removed.evidence.push({
    ...structuredClone(removed.evidence.find((row) => row.id === "evidence-designation")),
    id: "evidence-designation-legacy",
    scope: "predecessor-revision",
    planRevision: removed.identity.predecessorRevision,
    subjectRef: "designation-legacy",
    sourceRef: "controlled://partner-center/designation-export-legacy",
    sourceVersion: "revision-3",
    observedAt: "2026-06-28T16:05:00Z",
    freshnessRuleRef: "freshness-designation-prior",
    subjectContentDigest: `sha256:${"a".repeat(64)}`,
  });
  removed.predecessorManifest.records.push({
    domain: "designations",
    recordRef: "designation-legacy",
    contentDigest: `sha256:${"a".repeat(64)}`,
    evidenceRefs: ["evidence-designation-legacy"],
    evidenceFingerprints: [],
  });
  bindPredecessorManifest(
    removed,
    "eQLqCThu/XW2OatNeSX75YUdSQgzBqMPtN3QTVzjDkQ0a4opYtvke4tQUyMiK97XmJGkZpL0LwKETOZ7WFRfAw==",
  );
  bindAuthorityFreshness(
    removed,
    "7nIZBb33EbnUBYihA3l/Iu5H5c0ipw5Ow2pv0VZU10D92ELX0i6nCLIvHz1V0iQ3egOnDVvXHL+v/09H82UmCQ==",
  );
  removed.revisionDelta.push({
    id: "delta-remove-legacy-designation",
    name: "Legacy designation removed in revision 4",
    evidenceRefs: [],
    domain: "designations",
    change: "removed",
    ownerRef: "principal-business-manager",
    currentRecordRefs: [],
    predecessorRecordRefs: ["designation-legacy"],
    predecessorEvidenceRefs: ["evidence-designation-legacy"],
  });
  removed.coverage.find((row) => row.domain === "revision-delta").recordRefs.push(
    "delta-remove-legacy-designation",
  );
  removed.revisionDelta.at(-1).predecessorRecordFingerprints = [
    {
      recordRef: "designation-legacy",
      contentDigest: `sha256:${"a".repeat(64)}`,
    },
  ];
  resealPartnerBusinessPlan(removed);
  assert.equal(validateSchema(removed), true, ajv.errorsText(validateSchema.errors));
  assert.equal(
    findings(removed).some((row) => row.code.startsWith("invalid_revision_delta")),
    false,
  );

  const wrongDomain = clone();
  wrongDomain.revisionDelta[0].domain = "opportunities";
  hasCode(wrongDomain, "invalid_revision_delta");
  const missingCurrentEvidence = clone();
  missingCurrentEvidence.revisionDelta[0].evidenceRefs = [];
  hasCode(missingCurrentEvidence, "invalid_revision_delta_evidence");
  const wrongPredecessorScope = clone();
  wrongPredecessorScope.evidence.find((row) => row.id === "evidence-capability-prior")
    .scope = "current-revision";
  hasCode(wrongPredecessorScope, "invalid_revision_delta_evidence");
  const wrongPredecessorType = clone();
  wrongPredecessorType.evidence.find((row) => row.id === "evidence-capability-prior")
    .subjectType = "designation";
  hasCode(wrongPredecessorType, "invalid_revision_delta_evidence");
  const falseAdded = clone();
  falseAdded.revisionDelta[0].predecessorRecordRefs = ["play-ai-modernization"];
  hasCode(falseAdded, "invalid_revision_delta_semantics");
  const falseUnchanged = clone();
  falseUnchanged.revisionDelta[1].predecessorRecordRefs = ["capability-other"];
  hasCode(falseUnchanged, "invalid_revision_delta_semantics");
  const duplicateRecord = clone();
  duplicateRecord.revisionDelta.push({
    ...structuredClone(duplicateRecord.revisionDelta[0]),
    id: "delta-add-ai-play-again",
  });
  duplicateRecord.coverage.find((row) => row.domain === "revision-delta").recordRefs.push(
    "delta-add-ai-play-again",
  );
  hasCode(duplicateRecord, "duplicate_revision_delta_record");
});

test("revision trace rejects an omitted current governed record", () => {
  const value = clone();
  const omitted = value.revisionDelta.find((row) => row.domain === "opportunities");
  value.revisionDelta = value.revisionDelta.filter((row) => row.id !== omitted.id);
  value.coverage.find((row) => row.domain === "revision-delta").recordRefs =
    value.revisionDelta.map((row) => row.id);
  resealPartnerBusinessPlan(value);
  hasCode(value, "incomplete_revision_delta_coverage");
});

test("revision deltas split changed identities from additions and removals", () => {
  const addCapability = (value) => {
    value.evidence.push({
      ...structuredClone(value.evidence.find((row) => row.id === "evidence-capability")),
      id: "evidence-capability-security",
      subjectRef: "capability-security",
      sourceRef: "controlled://partner-center/capability-export-security",
    });
    value.capabilities.push({
      ...structuredClone(value.capabilities[0]),
      id: "capability-security",
      name: "Security capability",
      evidenceRefs: ["evidence-capability-security"],
    });
    value.coverage.find((row) => row.domain === "capabilities").recordRefs.push(
      "capability-security",
    );
  };

  const mixed = clone();
  addCapability(mixed);
  const mixedDelta = mixed.revisionDelta.find((row) => row.domain === "capabilities");
  mixedDelta.currentRecordRefs.push("capability-security");
  mixedDelta.evidenceRefs.push("evidence-capability-security");
  mixedDelta.change = "changed";
  resealPartnerBusinessPlan(mixed);
  bindCurrentEvidence(mixed);
  hasCode(mixed, "invalid_revision_delta_semantics");

  const split = clone();
  addCapability(split);
  split.revisionDelta.push({
    id: "delta-capability-security-added",
    name: "Security capability added in revision 4",
    evidenceRefs: ["evidence-capability-security"],
    domain: "capabilities",
    change: "added",
    ownerRef: "principal-business-manager",
    currentRecordRefs: ["capability-security"],
    predecessorRecordRefs: [],
    currentRecordFingerprints: [],
    predecessorRecordFingerprints: [],
    predecessorEvidenceRefs: [],
  });
  split.coverage.find((row) => row.domain === "revision-delta").recordRefs.push(
    "delta-capability-security-added",
  );
  resealPartnerBusinessPlan(split);
  bindCurrentEvidence(split);
  assert.deepEqual(findings(split), []);
});

test("current and predecessor evidence must have one reciprocal immutable subject binding", () => {
  const orphanCurrent = clone();
  orphanCurrent.evidence.push({
    ...structuredClone(orphanCurrent.evidence[0]),
    id: "evidence-orphan-current",
    sourceRef: "controlled://partner-center/orphan-current",
  });
  hasCode(orphanCurrent, "orphan_current_evidence");

  const missingReciprocal = clone();
  missingReciprocal.capabilities[0].evidenceRefs = [];
  hasCode(missingReciprocal, "orphan_current_evidence");

  const missingSubject = clone();
  missingSubject.evidence[0].subjectRef = "capability-missing";
  hasCode(missingSubject, "orphan_current_evidence");

  const rewrittenPredecessorEvidence = clone();
  rewrittenPredecessorEvidence.evidence.find(
    (row) => row.id === "evidence-capability-prior",
  ).sourceRef = "controlled://partner-center/rewritten-prior-source";
  hasCode(rewrittenPredecessorEvidence, "invalid_predecessor_manifest");

  const orphanPredecessor = clone();
  orphanPredecessor.evidence.push({
    ...structuredClone(
      orphanPredecessor.evidence.find((row) => row.id === "evidence-capability-prior"),
    ),
    id: "evidence-orphan-predecessor",
    sourceRef: "controlled://partner-center/orphan-predecessor",
  });
  hasCode(orphanPredecessor, "orphan_predecessor_evidence");

  const duplicatedPredecessorBinding = clone();
  duplicatedPredecessorBinding.revisionDelta.push({
    ...structuredClone(duplicatedPredecessorBinding.revisionDelta[1]),
    id: "delta-capability-duplicate",
  });
  duplicatedPredecessorBinding.coverage
    .find((row) => row.domain === "revision-delta")
    .recordRefs.push("delta-capability-duplicate");
  resealPartnerBusinessPlan(duplicatedPredecessorBinding);
  hasCode(duplicatedPredecessorBinding, "orphan_predecessor_evidence");
});

test("revision semantics derive from record identities and immutable content digests", () => {
  const currentContentTamper = clone();
  currentContentTamper.capabilities[0].name = "Changed without resealing";
  hasCode(currentContentTamper, "invalid_record_fingerprint");

  const resealedContentTamper = clone();
  resealedContentTamper.capabilities[0].name = "Fabricated current capability";
  resealPartnerBusinessPlan(resealedContentTamper);
  hasCode(resealedContentTamper, "invalid_evidence_fingerprint");

  const evidenceDigestTamper = clone();
  evidenceDigestTamper.evidence[0].subjectContentDigest = `sha256:${"f".repeat(64)}`;
  hasCode(evidenceDigestTamper, "invalid_evidence_fingerprint");

  const currentFingerprintTamper = clone();
  currentFingerprintTamper.revisionDelta[1].currentRecordFingerprints[0].contentDigest =
    `sha256:${"e".repeat(64)}`;
  hasCode(currentFingerprintTamper, "invalid_revision_fingerprint");

  const falseChanged = clone();
  falseChanged.revisionDelta[1].change = "changed";
  hasCode(falseChanged, "invalid_revision_delta_semantics");

  const rewrittenHistory = clone();
  rewrittenHistory.revisionDelta[1].change = "changed";
  rewrittenHistory.revisionDelta[1].predecessorRecordFingerprints[0]
    .contentDigest = `sha256:${"d".repeat(64)}`;
  rewrittenHistory.predecessorManifest.records[0].contentDigest =
    `sha256:${"d".repeat(64)}`;
  rewrittenHistory.evidence.find(
    (row) => row.id === "evidence-capability-prior",
  ).subjectContentDigest = `sha256:${"d".repeat(64)}`;
  rewrittenHistory.predecessorManifest.contentDigest =
    computePartnerTrustDigest(rewrittenHistory.predecessorManifest);
  resealPartnerBusinessPlan(rewrittenHistory);
  hasCode(rewrittenHistory, "invalid_predecessor_manifest");

  const sameIdentityChangedContent = clone();
  sameIdentityChangedContent.revisionDelta[1].change = "changed";
  sameIdentityChangedContent.revisionDelta[1].predecessorRecordFingerprints[0]
    .contentDigest = `sha256:${"d".repeat(64)}`;
  sameIdentityChangedContent.predecessorManifest.records[0].contentDigest =
    `sha256:${"d".repeat(64)}`;
  sameIdentityChangedContent.evidence.find(
    (row) => row.id === "evidence-capability-prior",
  ).subjectContentDigest = `sha256:${"d".repeat(64)}`;
  bindPredecessorManifest(
    sameIdentityChangedContent,
    "2DuU700N5tRbrNlq8P2KbzoQhwhYvpnpIlKNcTWa2Z+NehKN6lCfXJDI4FU2sdLJ37gODpv7Ywsl0t/YFP4SCg==",
  );
  resealPartnerBusinessPlan(sameIdentityChangedContent);
  assert.equal(
    findings(sameIdentityChangedContent).some((row) =>
      row.code.startsWith("invalid_revision"),
    ),
    false,
  );

  const resealedCurrentEdit = clone();
  const capabilityDelta = resealedCurrentEdit.revisionDelta.find(
    (row) => row.domain === "capabilities",
  );
  const historicalDigest = capabilityDelta.predecessorRecordFingerprints[0].contentDigest;
  resealedCurrentEdit.capabilities[0].name = "Updated specialization record";
  resealPartnerBusinessPlan(resealedCurrentEdit);
  assert.equal(capabilityDelta.change, "changed");
  assert.equal(
    capabilityDelta.predecessorRecordFingerprints[0].contentDigest,
    historicalDigest,
  );
  assert.notEqual(capabilityDelta.currentRecordFingerprints[0].contentDigest, historicalDigest);
  assert.equal(
    findings(resealedCurrentEdit).some((row) =>
      row.code.startsWith("invalid_revision"),
    ),
    false,
  );

  const omittedPredecessor = clone();
  omittedPredecessor.evidence = omittedPredecessor.evidence.filter(
    (row) => row.scope !== "predecessor-revision",
  );
  for (const delta of omittedPredecessor.revisionDelta) {
    delta.predecessorRecordRefs = [];
    delta.predecessorRecordFingerprints = [];
    delta.predecessorEvidenceRefs = [];
  }
  resealPartnerBusinessPlan(omittedPredecessor);
  hasCode(omittedPredecessor, "invalid_predecessor_manifest");

  const omittedDelta = clone();
  omittedDelta.revisionDelta = omittedDelta.revisionDelta.filter(
    (row) => row.domain !== "capabilities",
  );
  omittedDelta.coverage.find((row) => row.domain === "revision-delta").recordRefs =
    omittedDelta.revisionDelta.map((row) => row.id);
  resealPartnerBusinessPlan(omittedDelta);
  hasCode(omittedDelta, "invalid_predecessor_manifest");

  const danglingManifestEvidence = clone();
  danglingManifestEvidence.predecessorManifest.records[0].evidenceRefs =
    ["evidence-missing"];
  hasCode(danglingManifestEvidence, "invalid_predecessor_manifest");

  const postSnapshotEvidence = clone();
  postSnapshotEvidence.evidence.find(
    (row) => row.id === "evidence-capability-prior",
  ).observedAt = "2026-06-28T16:00:01Z";
  hasCode(postSnapshotEvidence, "invalid_predecessor_manifest");

  const multipleSources = clone();
  multipleSources.evidence.push({
    ...structuredClone(
      multipleSources.evidence.find((row) => row.id === "evidence-capability-prior"),
    ),
    id: "evidence-capability-prior-two",
    sourceRef: "controlled://partner-center/capability-export-legacy-two",
  });
  multipleSources.predecessorManifest.records[0].evidenceRefs.push(
    "evidence-capability-prior-two",
  );
  bindPredecessorManifest(
    multipleSources,
    "OYtKE5TT+ILax3FD+akq3Ar/tAxoSoWCNaLx/OFfiGqJeunWCUz0W8wVBZmaFziyAHdmaTW7Kgtrkiwhr38yAQ==",
  );
  const capabilityDeltaWithMultipleSources = multipleSources.revisionDelta.find(
    (row) => row.domain === "capabilities",
  );
  capabilityDeltaWithMultipleSources.predecessorEvidenceRefs.push(
    "evidence-capability-prior-two",
  );
  resealPartnerBusinessPlan(multipleSources);
  assert.equal(codes(multipleSources).has("invalid_predecessor_manifest"), false);

  for (const field of ["partnerId", "planId"]) {
    const wrongIdentity = clone();
    wrongIdentity.predecessorManifest[field] = `${field}-other`;
    hasCode(wrongIdentity, "invalid_predecessor_manifest");
  }

  assert.equal(codes(clone()).has("invalid_predecessor_manifest"), false);

  const sourceStringOnly = clone();
  const predecessorEvidence = sourceStringOnly.evidence.find(
    (row) => row.id === "evidence-capability-prior",
  );
  predecessorEvidence.sourceRef = "controlled://partner-center/different-uri";
  predecessorEvidence.sourceVersion = "different-source-version";
  assert.equal(
    findings(sourceStringOnly).some(
      (row) => row.code === "invalid_revision_delta_semantics",
    ),
    false,
  );
});

test("revision fingerprints require exactly one entry per record reference", () => {
  for (const field of ["currentRecordFingerprints", "predecessorRecordFingerprints"]) {
    const value = clone();
    const delta = value.revisionDelta.find((row) => row[field].length > 0);
    delta[field].unshift({
      ...structuredClone(delta[field][0]),
      contentDigest: `sha256:${"0".repeat(64)}`,
    });
    delta.contentDigest = computePartnerRecordDigest(delta);
    assert.equal(validateSchema(value), true, ajv.errorsText(validateSchema.errors));
    hasCode(value, "invalid_revision_fingerprint");
  }
});

test("commitment approvals and dependency blocks reject every dangling reference", () => {
  const approval = clone();
  approval.commitments[0].approvalEvidenceRefs.push("evidence-approval-missing");
  hasCode(approval, "invalid_commitment_approval");

  const dependency = clone();
  dependency.dependencies[0].blocksRefs.push("record-missing");
  hasCode(dependency, "invalid_dependency_reference");

  const selfBlocking = clone();
  selfBlocking.dependencies[0].blocksRefs = [selfBlocking.dependencies[0].id];
  hasCode(selfBlocking, "invalid_dependency_reference");

  assert.equal(codes(clone()).has("invalid_dependency_reference"), false);
});

test("principals cannot self-attest agent identity and handoff must be in every evidence audience", () => {
  const selfAttested = clone();
  selfAttested.principals.find((row) => row.id === "principal-business-manager").name =
    "Partner business manager";
  hasCode(selfAttested, "invalid_principal_identity");

  const excludedHandoff = clone();
  excludedHandoff.evidenceGovernance.confidentialityScopes[0].audienceRefs =
    excludedHandoff.evidenceGovernance.confidentialityScopes[0].audienceRefs.filter(
      (ref) => ref !== excludedHandoff.handoff.accountableOwnerRef,
    );
  hasCode(excludedHandoff, "invalid_confidentiality_scope");

  assert.equal(codes(clone()).has("invalid_principal_identity"), false);
});

test("conflict disposition evidence binds exact conflict domain, scope, owner, and chronology", () => {
  const resolved = clone();
  const dispositionEvidence = {
    ...structuredClone(resolved.evidence.find((row) => row.id === "evidence-incentive-policy")),
    id: "evidence-incentive-disposition",
    sourceRef: "controlled://finance/incentive-conflict-disposition-2026-09-13",
    sourceVersion: "signed-disposition-v1",
    observedAt: "2026-09-13T20:00:00Z",
    conflictRefs: [],
    dispositionConflictRefs: ["conflict-incentive-proof"],
  };
  resolved.evidence.push(dispositionEvidence);
  resolved.eligibilityEvidence.find((row) => row.kind === "incentive")
    .evidenceRefs.push(dispositionEvidence.id);
  Object.assign(resolved.evidenceGovernance.conflicts[0], {
    state: "resolved",
    dispositionEvidenceRefs: [dispositionEvidence.id],
  });
  resealPartnerBusinessPlan(resolved);
  assert.equal(validateSchema(resolved), true, ajv.errorsText(validateSchema.errors));
  assert.equal(codes(resolved).has("invalid_conflict_disposition"), false);

  for (const mutate of [
    (value) => value.evidence.at(-1).dispositionConflictRefs = [],
    (value) => value.evidence.at(-1).dispositionConflictRefs = ["conflict-other"],
    (value) => value.evidenceGovernance.conflicts[0].domain = "benefits",
    (value) => value.evidenceGovernance.conflicts[0].scope = "predecessor-revision",
    (value) => value.evidence.at(-1).issuedByPrincipalRef = "principal-program-owner",
    (value) => value.evidence.at(-1).observedAt = "2026-09-13T17:59:59Z",
  ]) {
    const value = structuredClone(resolved);
    mutate(value);
    hasCode(value, "invalid_conflict_disposition");
  }
});

test("evidence governance rejects stale rules, bad scopes, asymmetric conflicts, and invalid dispositions", () => {
  const missingGovernance = clone();
  delete missingGovernance.evidenceGovernance;
  assert.equal(validateSchema(missingGovernance), false);
  const stale = clone();
  stale.evidenceGovernance.freshnessRules.find((row) => row.id === "freshness-action")
    .maxAgeDays = 1;
  hasCode(stale, "stale_evidence");
  const extendedFreshness = clone();
  extendedFreshness.evidence.find(
    (row) => row.id === "evidence-capability",
  ).observedAt = "2025-09-15T19:00:00Z";
  extendedFreshness.evidenceGovernance.freshnessRules.find(
    (row) => row.id === "freshness-capability-current",
  ).maxAgeDays = 365;
  hasCode(extendedFreshness, "invalid_authority_evidence");
  const wrongRule = clone();
  wrongRule.evidence[0].freshnessRuleRef = "freshness-designation";
  hasCode(wrongRule, "invalid_freshness_governance");
  const unusedRuleOwner = clone();
  unusedRuleOwner.evidenceGovernance.freshnessRules.push({
    id: "freshness-unused-capability",
    domain: "capabilities",
    subjectType: "capability",
    scope: "current-revision",
    maxAgeDays: 30,
    ownerRef: "principal-business-manager",
  });

  hasCode(unusedRuleOwner, "invalid_governance_owner");
  const wrongScope = clone();
  wrongScope.evidence[0].confidentialityScopeRef = "scope-missing";
  hasCode(wrongScope, "invalid_confidentiality_scope");
  const asymmetric = clone();
  asymmetric.evidence.find((row) => row.id === "evidence-incentive-policy").conflictRefs = [];
  hasCode(asymmetric, "invalid_conflict_governance");
  const falseDisposition = clone();
  falseDisposition.evidenceGovernance.conflicts[0].state = "resolved";
  hasCode(falseDisposition, "invalid_conflict_disposition");
  const badPath = clone();
  badPath.gaps[0].escalationPathRef = "escalation-missing";
  hasCode(badPath, "invalid_escalation_path");
});

test("an empty domain cannot be covered and must use authorized not-applicable state", () => {
  const value = clone();
  makeDesignationNotApplicable(value);
  value.coverage.find((row) => row.domain === "designations").state = "covered";
  value.coverage.find((row) => row.domain === "designations")
    .applicabilityEvidenceRefs = [];
  value.evidence = value.evidence.filter((row) => row.id !== "evidence-designation-na");
  resealPartnerBusinessPlan(value);
  hasCode(value, "invalid_empty_domain_coverage");
  hasCode(value, "incomplete_domain_coverage");
});

test("coverage requires evidence for every claimed domain-period segment", () => {
  const unsupportedSegment = clone();
  unsupportedSegment.evidence.find(
    (row) => row.id === "evidence-capability",
  ).segmentRefs = ["fy27-q1"];
  hasCode(unsupportedSegment, "invalid_period_coverage");

  assert.equal(codes(clone()).has("invalid_period_coverage"), false);
});

test("actions and QBR decisions cannot be recorded after the review asOf", () => {
  const futureAction = clone();
  futureAction.actions.at(-1).recordedAt = "2026-09-15T00:00:00Z";
  resealPartnerBusinessPlan(futureAction);
  hasCode(futureAction, "invalid_action_chronology");

  const futureDecision = clone();
  futureDecision.qbrDecisions[0].recordedAt = "2026-09-15T00:00:00Z";
  resealPartnerBusinessPlan(futureDecision);
  hasCode(futureDecision, "invalid_decision_chronology");

  const impossibleDeadline = clone();
  impossibleDeadline.actions[0].dueAt = "2026-08-15T17:59:59Z";
  resealPartnerBusinessPlan(impossibleDeadline);
  bindCurrentEvidence(impossibleDeadline);
  hasCode(impossibleDeadline, "invalid_action_chronology");
});

test("caller-supplied validation time governs replay and freshness", () => {
  assert.ok(
    partnerBusinessPlanFindings(clone()).some(
      (row) => row.code === "invalid_validation_time",
    ),
  );
  assert.ok(
    partnerBusinessPlanFindings(clone(), {
      asOf: "2026-09-14T19:00:00",
    }).some((row) => row.code === "invalid_validation_time"),
  );

  const replayed = partnerBusinessPlanFindings(clone(), {
    asOf: "2035-01-01T00:00:00Z",
  });
  assert.ok(replayed.some((row) => row.code === "invalid_authority_evidence"));
  assert.ok(replayed.some((row) => row.code === "stale_evidence"));

  const predatesArtifact = partnerBusinessPlanFindings(clone(), {
    asOf: "2026-09-14T18:59:59Z",
  });
  assert.ok(predatesArtifact.some((row) => row.code === "invalid_validation_time"));

  assert.deepEqual(
    partnerBusinessPlanFindings(clone(), {
      asOf: fixture.identity.asOf,
    }),
    [],
  );

  const futureEvidence = clone();
  futureEvidence.evidence[0].observedAt = "2026-09-14T20:00:00Z";
  assert.ok(
    partnerBusinessPlanFindings(futureEvidence, {
      asOf: "2026-09-14T21:00:00Z",
    }).some((row) => row.code === "invalid_evidence_chronology"),
  );

  const futureAction = clone();
  futureAction.actions[0].recordedAt = "2026-09-14T20:00:00Z";
  assert.ok(
    partnerBusinessPlanFindings(futureAction, {
      asOf: "2026-09-14T21:00:00Z",
    }).some((row) => row.code === "invalid_action_chronology"),
  );

  const futureDecision = clone();
  futureDecision.qbrDecisions[0].recordedAt = "2026-09-14T20:00:00Z";
  assert.ok(
    partnerBusinessPlanFindings(futureDecision, {
      asOf: "2026-09-14T21:00:00Z",
    }).some((row) => row.code === "invalid_decision_chronology"),
  );
});

test("one invalid commitment or current evidence row emits one diagnostic", () => {
  const commitment = clone();
  commitment.commitments[0].authorityOwnerRefs = ["principal-partner-lead"];
  assert.equal(
    findings(commitment).filter(
      (row) => row.code === "invalid_commitment_authority",
    ).length,
    1,
  );

  const evidence = clone();
  evidence.evidence.push({
    ...structuredClone(evidence.evidence[0]),
    id: "evidence-single-orphan",
    sourceRef: "controlled://partner-center/single-orphan",
  });
  assert.equal(
    findings(evidence).filter(
      (row) => row.code === "orphan_current_evidence",
    ).length,
    1,
  );
});

test("schema remains strict for governance and revision-delta fields", () => {
  const extraGovernance = clone();
  extraGovernance.evidenceGovernance.unreviewed = true;
  assert.equal(validateSchema(extraGovernance), false);
  const missingDeltaRefs = clone();
  delete missingDeltaRefs.revisionDelta[0].currentRecordRefs;
  assert.equal(validateSchema(missingDeltaRefs), false);
  const extraEvidenceField = clone();
  extraEvidenceField.evidence[0].notes = "unmodeled";
  assert.equal(validateSchema(extraEvidenceField), false);

  for (const mutate of [
    (value) => value.evidence[0].sourceRef = "controlled://user:secret@partner-center/export",
    (value) => value.predecessorManifest.sourceRef = "controlled://user:secret@partner-governance/manifest",
    (value) => value.authorityRosterEvidence.sourceRef = "controlled://user:secret@partner-governance/roster",
  ]) {
    const credentialedSource = clone();
    mutate(credentialedSource);
    assert.equal(validateSchema(credentialedSource), false);
  }
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, true, 7, "bad", [], {}, { identity: {}, principals: [null], evidence: [1], coverage: [{}] }]) {
    assert.doesNotThrow(() => partnerBusinessPlanFindings(value));
    assert.ok(partnerBusinessPlanFindings(value).length > 0);
  }
});

test("Markdown fallback names identity, evidence, coverage, chronology, rights, and every authority boundary", () => {
  const normalizedTemplate = template.replace(/\s+/gu, " ");
  for (const text of [
    "Exact identity and review period",
    "Attributable evidence ledger",
    "Exact period and domain coverage",
    "chronological owner actions and QBR decisions",
    "Principals and decision rights",
    "enroll a partner",
    "award a designation",
    "approve or pay incentives",
    "commit revenue",
    "mutate an opportunity",
    "contact a customer",
    "modify an agreement",
    "make a QBR decision",
    "accept risk"
  ]) assert.match(normalizedTemplate, new RegExp(text, "i"));
});
