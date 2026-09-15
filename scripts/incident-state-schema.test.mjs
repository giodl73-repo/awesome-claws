import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL("../claws/incident-response/fixtures/incident-state.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/incident-response/schemas/incident-state.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("incident-response", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const digest = (value) =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const sorted = (items) => [...items].sort();
const sealServiceRecovery = (value) => {
  const row = value.serviceRecovery;
  row.revision = digest({
    id: row.id,
    state: row.state,
    technicalDriId: row.technicalDriId,
    timelineSnapshotRef: row.timelineSnapshotRef,
    recoveryCheckRefs: sorted(row.recoveryCheckRefs),
    evaluatedAt: row.evaluatedAt,
  });
};
const sealIncidentRecovery = (value) => {
  const row = value.incidentRecoveryRecommendation;
  row.revision = digest({
    id: row.id,
    state: row.state,
    serviceRecoveryRef: row.serviceRecoveryRef,
    technicalDriId: row.technicalDriId,
    incidentManagerId: row.incidentManagerId,
    recommendedAt: row.recommendedAt,
    rationale: row.rationale,
  });
};
const sealClosure = (value) => {
  const row = value.closure;
  row.revision = digest({
    id: row.id,
    incidentRef: row.incidentRef,
    incidentRecoveryRecommendationRef:
      row.incidentRecoveryRecommendationRef,
    state: row.state,
    incidentManagerId: row.incidentManagerId,
    authorityOwnerId: row.authorityOwnerId,
    closedAt: row.closedAt,
  });
};
const activeFixture = () => {
  const value = clone();
  value.signals[0].state = "monitoring";
  delete value.signals[0].resolvedAt;
  value.serviceRecovery.state = "criteria-unmet";
  sealServiceRecovery(value);
  value.incidentRecoveryRecommendation.state = "not-ready";
  value.incidentRecoveryRecommendation.rationale =
    "A high-risk signal remains under observation.";
  sealIncidentRecovery(value);
  const recoveryDecision = value.decisions.find(
    (item) =>
      item.id === value.incidentRecoveryRecommendation.decisionRef,
  );
  recoveryDecision.subjectRevision =
    value.incidentRecoveryRecommendation.revision;
  value.recommendation = {
    state: "blocked",
    reviewerId: null,
    reviewedAt: null,
    rationale: "Incident recovery is not ready while the signal remains active.",
  };
  value.handoff.state = "blocked";
  value.handoff.summary =
    "The incident remains active; recovery, closure, communication, risk, and compliance actions stay owner-controlled.";
  return value;
};
const closedFixture = () => {
  const value = clone();
  value.incident.status = "resolved";
  value.updateCadence.asOf = "2026-09-05T11:07:00Z";
  value.evidence.push({
    id: "evidence-owner-closure",
    kind: "owner-closure",
    incidentRef: value.incident.id,
    serviceRef: "service-checkout-api",
    closureRef: value.closure.id,
    approvedById: value.closure.authorityOwnerId,
    environment: value.incident.environment,
    deploymentOrBuild: "checkout-api@2026.08.16.4",
    timelineSnapshotRef: value.incident.timelineSnapshotRef,
    outcome: "closed",
    sourceRef: "controlled://incident-evidence/INC-2048/owner-closure",
    assertedAt: "2026-09-05T11:05:00Z",
  });
  const recoveryEvidenceRefs = [
    "evidence-rollback-execution",
    "evidence-checkout-recovery",
    "evidence-payment-recovery",
  ];
  value.decisions.push({
    id: "decision-closure-recommendation",
    incidentRef: value.incident.id,
    timelineSnapshotRef: value.incident.timelineSnapshotRef,
    decisionMakerId: value.roleAssignments.incidentManager.principalId,
    recordedById: value.roleAssignments.incidentManager.principalId,
    authorityScope: "incident-closure-recommendation",
    decisionType: "closure-recommendation",
    subjectRef: value.incidentRecoveryRecommendation.id,
    subjectRevision: value.incidentRecoveryRecommendation.revision,
    inputEvidenceRefs: recoveryEvidenceRefs,
    decidedAt: "2026-09-05T11:04:00Z",
    supersedesDecisionId: null,
  });
  value.closure.state = "closed-by-owner";
  value.closure.recommendationDecisionRef =
    "decision-closure-recommendation";
  value.closure.evidenceRef = "evidence-owner-closure";
  value.closure.closedAt = "2026-09-05T11:06:00Z";
  sealClosure(value);
  value.decisions.push({
    id: "decision-owner-closure",
    incidentRef: value.incident.id,
    timelineSnapshotRef: value.incident.timelineSnapshotRef,
    decisionMakerId: value.closure.authorityOwnerId,
    recordedById: value.roleAssignments.incidentManager.principalId,
    authorityScope: "incident-declaration-closure",
    decisionType: "owner-closure",
    subjectRef: value.closure.id,
    subjectRevision: value.closure.revision,
    inputEvidenceRefs: [value.closure.evidenceRef],
    decidedAt: value.closure.closedAt,
    supersedesDecisionId: null,
  });
  value.closure.closureDecisionRef = "decision-owner-closure";
  value.recommendation = {
    state: "closed-by-owner",
    reviewerId: value.closure.authorityOwnerId,
    reviewedAt: value.closure.closedAt,
    rationale:
      "The external incident authority closed the incident after recovery and closure evidence; compliance work remains separate.",
  };
  value.handoff.summary =
    "Owner closure is externally evidenced; compliance issue, remediation, verification, risk, and closure states remain unchanged.";
  return value;
};
const v1Fixture = () => {
  const value = clone();
  value.schemaVersion = "awesomeClaws.incidentResponse.v1";
  for (const field of [
    "roleAssignments",
    "updateCadence",
    "updates",
    "decisions",
    "serviceRecovery",
    "incidentRecoveryRecommendation",
    "closure",
    "complianceHandoffs",
    "authority",
  ]) {
    delete value[field];
  }
  value.recommendation.state = "ready-for-incident-command-review";
  return value;
};
const legacy = {
  incidentId: "INC-2048",
  severity: "SEV-1",
  status: "mitigating",
  startedAt: "2026-08-16T14:07:00Z",
  incidentCommander: "Primary incident commander",
  impact: {
    summary: "Checkout errors increased after deployment.",
    affectedServices: ["checkout-api"],
    customerImpact: "partial-outage",
    evidenceRef: "dashboard/checkout-errors/14-07",
    observedAt: "2026-08-16T14:09:00Z",
  },
  timeline: [
    {
      timestamp: "2026-08-16T14:07:00Z",
      kind: "observation",
      summary: "Alert crossed threshold.",
      evidenceRef: "alert/checkout-errors-2048",
      owner: "On-call engineer",
    },
  ],
  mitigations: [
    {
      action: "Roll back checkout-api",
      target: "checkout-api production",
      owner: "Checkout lead",
      state: "approved",
      approvalRef: "approval/INC-2048/rollback",
      verification: "Errors remain below 2%.",
      rollbackCondition: "Stop if payment failures increase.",
    },
  ],
  recoveryCriteria: [
    {
      criterion: "Checkout errors below 2%",
      state: "unmet",
      evidenceRef: "dashboard/checkout-errors/live",
      owner: "Checkout lead",
    },
  ],
  communications: [
    {
      audience: "Customer support",
      state: "draft",
      owner: "Communications lead",
      messageRef: "draft/INC-2048/update-1",
    },
  ],
  decisionState: "not-ready",
};

test("incident response fixture is a valid exact-incident enriched record", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("incident response validator is total over malformed arrays and records", () => {
  for (const field of [
    "principals",
    "services",
    "signals",
    "evidence",
    "hypotheses",
    "updates",
    "decisions",
    "timelineEvents",
    "actions",
    "recoveryChecks",
    "communications",
    "followUps",
    "complianceHandoffs",
  ]) {
    const malformed = clone();
    malformed[field].push(null);
    assert.equal(validateSchema(malformed), false);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.equal(validateSchema(malformed), false);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(
      findings(malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
    );
  }
});

test("incident exact marker and every legacy-only hybrid field fail closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.incidentResponse.v3";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));

  for (const field of [
    "incidentId",
    "severity",
    "status",
    "startedAt",
    "incidentCommander",
    "impact",
    "timeline",
    "mitigations",
    "recoveryCriteria",
    "decisionState",
  ]) {
    const partial = clone();
    partial[field] = legacy[field];
    assert.equal(isValid(partial), false, field);
    assert.ok(
      findings(partial).some(
        (item) =>
          item.code === "legacy_field_in_enriched_record" && item.path === field,
      ),
    );
  }
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(
    findings(hybrid).some(
      (item) => item.code === "invalid_array_list" && item.path === "principals",
    ),
  );
  assert.equal(validateSchema({ ...clone(), sensitiveLogs: ["payload"] }), false);
});

test("incident response rejects unstable, dangling, and orphan rows", () => {
  const invalid = clone();
  delete invalid.signals[0].id;
  invalid.hypotheses[0].serviceRef = "service-missing";
  assert.ok(
    findings(invalid).some(
      (item) => item.code === "invalid_array_record" && item.path === "signals[0].id",
    ),
  );
  assert.ok(findings(invalid).some((item) => item.code === "unsupported_hypothesis"));

  const orphan = clone();
  orphan.actions.push({
    ...orphan.actions[0],
    id: "action-orphan",
    serviceRef: "service-missing",
    approvalEvidenceRef: "evidence-missing",
    executionEvidenceRef: "evidence-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(findings(orphan).some((item) => item.code === "unsupported_incident_action"));
});

test("incident evidence binds exact incident, service build, environment, and snapshot", () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].incidentRef = "INC-OTHER";
    },
    (value) => {
      value.evidence[0].deploymentOrBuild = "checkout-api@old";
    },
    (value) => {
      value.evidence[0].timelineSnapshotRef = "snapshot-old";
    },
    (value) => {
      value.evidence[0].serviceRef = "service-missing";
    },
  ]) {
    const crossScope = clone();
    mutate(crossScope);
    assert.equal(isValid(crossScope), false);
    assert.ok(
      findings(crossScope).some((item) => item.code === "cross_scope_evidence"),
    );
  }
});

test("incident evidence references only rows for its declared service", () => {
  for (const [field, reference] of [
    ["signalRef", "signal-checkout-errors"],
    ["hypothesisRef", "hypothesis-timeout-regression"],
    ["actionRef", "action-checkout-rollback"],
    ["recoveryCheckRef", "recovery-checkout-errors"],
  ]) {
    const crossService = clone();
    const evidence = crossService.evidence.find(
      (item) => item.id === "evidence-payment-recovery",
    );
    evidence[field] = reference;
    assert.ok(
      findings(crossService).some(
        (item) =>
          item.code === "cross_scope_evidence" &&
          item.path === "evidence[6]",
      ),
      field,
    );
  }
});

test("incident timeline is chronological, evidence-backed, and exact-incident", () => {
  const reversed = clone();
  reversed.timelineEvents[1].occurredAt = "2026-09-05T10:03:00Z";
  assert.ok(
    findings(reversed).some((item) => item.code === "invalid_incident_chronology"),
  );
  const wrongIncident = clone();
  wrongIncident.timelineEvents[0].incidentRef = "INC-OTHER";
  assert.ok(
    findings(wrongIncident).some(
      (item) => item.code === "invalid_incident_chronology",
    ),
  );
});

test("incident consequential actions are proposed or owner-executed, never Claw-executed", () => {
  const clawExecuted = clone();
  clawExecuted.actions[0].executionState = "claw-executed";
  assert.ok(
    findings(clawExecuted).some(
      (item) => item.code === "claw_executed_consequential_action",
    ),
  );
  const unsupported = clone();
  unsupported.actions[0].approvalEvidenceRef = "evidence-missing";
  assert.ok(
    findings(unsupported).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
  const wrongIncident = clone();
  wrongIncident.actions[0].incidentRef = "INC-OTHER";
  assert.ok(
    findings(wrongIncident).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
  const prematureEvidence = clone();
  prematureEvidence.evidence.find(
    (item) => item.id === "evidence-rollback-execution",
  ).assertedAt = "2026-09-05T10:29:59Z";
  assert.ok(
    findings(prematureEvidence).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
});

test("incident recovery covers every service and rejects self-verification", () => {
  const missingService = clone();
  missingService.recoveryChecks = missingService.recoveryChecks.filter(
    (item) => item.serviceRef !== "service-payment-orchestrator",
  );
  assert.ok(
    findings(missingService).some(
      (item) => item.code === "incomplete_recovery_coverage",
    ),
  );
  const self = clone();
  self.recoveryChecks[0].verifiedById = self.services[0].ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "self_verified_recovery"),
  );
});

test("incident active high-risk state is valid when recovery and handoff stay blocked", () => {
  const unresolved = activeFixture();
  assert.equal(validateSchema(unresolved), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(unresolved), []);
  for (const resolvedAt of [undefined, "not-a-date", "2099-01-01T00:00:00Z"]) {
    const invalidResolution = clone();
    invalidResolution.signals[0].resolvedAt = resolvedAt;
    assert.ok(
      findings(invalidResolution).some(
        (item) => item.code === "invalid_high_risk_resolution",
      ),
      String(resolvedAt),
    );
  }
  const sent = clone();
  sent.communications[0].state = "sent";
  assert.ok(
    findings(sent).some((item) => item.code === "unauthorized_communication_state"),
  );
  const unapprovedDraft = clone();
  unapprovedDraft.communications[0].state = "draft";
  unapprovedDraft.communications[0].approvedById = null;
  unapprovedDraft.communications[0].approvalDecisionRef = null;
  unapprovedDraft.decisions = unapprovedDraft.decisions.filter(
    (item) => item.decisionType !== "communication-approval",
  );
  assert.equal(isValid(unapprovedDraft), true);
});

test("incident-manager review is scoped and occurs after all evidence", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "premature_incident_readiness"),
  );
  const early = clone();
  early.recommendation.reviewedAt = "2026-09-05T10:30:00Z";
  assert.ok(
    findings(early).some((item) => item.code === "premature_incident_readiness"),
  );
});

test("incident v2 requires distinct named Technical DRI and Incident Manager loops", () => {
  const samePrincipal = clone();
  samePrincipal.roleAssignments.incidentManager.principalId =
    samePrincipal.roleAssignments.technicalDri.principalId;
  assert.ok(
    findings(samePrincipal).some(
      (item) => item.code === "invalid_incident_role_separation",
    ),
  );

  const missingScope = clone();
  missingScope.principals
    .find(
      (item) =>
        item.id === missingScope.roleAssignments.technicalDri.principalId,
    )
    .scopes = ["technical-investigation"];
  assert.ok(
    findings(missingScope).some(
      (item) => item.code === "invalid_incident_role_separation",
    ),
  );

  for (const [role, name] of [
    ["technicalDri", "Technical DRI"],
    ["incidentManager", "Incident Manager"],
  ]) {
    const bareRole = clone();
    const principalId = bareRole.roleAssignments[role].principalId;
    bareRole.principals.find((item) => item.id === principalId).name = name;
    assert.ok(
      findings(bareRole).some(
        (item) => item.code === "invalid_incident_role_separation",
      ),
      role,
    );
  }
});

test("incident v2 rejects authority crossover and inexact independent approvals", () => {
  const wrongTechnicalOwner = clone();
  wrongTechnicalOwner.hypotheses[0].ownerId =
    wrongTechnicalOwner.roleAssignments.incidentManager.principalId;
  assert.ok(
    findings(wrongTechnicalOwner).some(
      (item) => item.code === "unsupported_hypothesis",
    ),
  );

  const selfApprovedAction = clone();
  const decision = selfApprovedAction.decisions.find(
    (item) => item.id === selfApprovedAction.actions[0].approvalDecisionRef,
  );
  decision.decisionMakerId = selfApprovedAction.actions[0].ownerId;
  assert.ok(
    findings(selfApprovedAction).some(
      (item) =>
        item.code === "invalid_decision_chronology" ||
        item.code === "unsupported_incident_action",
    ),
  );

  const wrongActionRevision = clone();
  wrongActionRevision.decisions.find(
    (item) => item.id === wrongActionRevision.actions[0].approvalDecisionRef,
  ).subjectRevision = "action-checkout-rollback-r0";
  assert.ok(
    findings(wrongActionRevision).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );

  const unapprovedOutcome = clone();
  unapprovedOutcome.evidence.find(
    (item) => item.id === unapprovedOutcome.actions[0].approvalEvidenceRef,
  ).outcome = "requested";
  assert.ok(
    findings(unapprovedOutcome).some(
      (item) =>
        item.code === "unsupported_incident_action" ||
        item.code === "invalid_decision_chronology",
    ),
  );

  const selfApprovedCommunication = clone();
  const communication = selfApprovedCommunication.communications[0];
  communication.approvedById = communication.ownerId;
  assert.ok(
    findings(selfApprovedCommunication).some(
      (item) => item.code === "unsupported_communication_draft",
    ),
  );

  const leastPrivilege = clone();
  const authority = leastPrivilege.principals.find(
    (item) => item.id === leastPrivilege.closure.authorityOwnerId,
  );
  authority.scopes = authority.scopes.filter(
    (scope) => scope !== "incident-command-review",
  );
  assert.equal(isValid(leastPrivilege), true);

  const missingActionApprovalScope = clone();
  missingActionApprovalScope.principals.find(
    (item) => item.id === missingActionApprovalScope.closure.authorityOwnerId,
  ).scopes = ["independent-communication-approval"];
  assert.ok(
    findings(missingActionApprovalScope).some(
      (item) =>
        item.code === "unsupported_incident_action" ||
        item.code === "invalid_decision_chronology",
    ),
  );

  const missingCommunicationApprovalScope = clone();
  missingCommunicationApprovalScope.principals.find(
    (item) =>
      item.id === missingCommunicationApprovalScope.closure.authorityOwnerId,
  ).scopes = ["independent-action-approval"];
  assert.ok(
    findings(missingCommunicationApprovalScope).some(
      (item) =>
        item.code === "unsupported_communication_draft" ||
        item.code === "invalid_decision_chronology",
    ),
  );

  const mutatedAuthority = clone();
  mutatedAuthority.authority.riskAcceptance = "accepted";
  assert.ok(
    findings(mutatedAuthority).some(
      (item) => item.code === "invalid_incident_authority",
    ),
  );
});

test("incident cadence rejects gaps, interval drift, future state, and invalid chronology", () => {
  const outOfOrder = clone();
  outOfOrder.updates[1].sequence = 3;
  assert.ok(
    findings(outOfOrder).some(
      (item) => item.code === "invalid_incident_update_sequence",
    ),
  );

  const missingOccurrence = clone();
  missingOccurrence.updates.splice(3, 1);
  assert.ok(
    findings(missingOccurrence).some(
      (item) =>
        item.code === "invalid_update_cadence" ||
        item.code === "invalid_incident_update_sequence",
    ),
  );

  const intervalDrift = clone();
  intervalDrift.updateCadence.intervalMinutes = 20;
  assert.ok(
    findings(intervalDrift).some(
      (item) =>
        item.code === "invalid_update_cadence" ||
        item.code === "invalid_incident_update_sequence",
    ),
  );

  const futureAsOf = clone();
  futureAsOf.updateCadence.asOf = "2099-01-01T00:00:00Z";
  assert.ok(
    findings(futureAsOf).some(
      (item) => item.code === "invalid_update_cadence",
    ),
  );

  const preEvidence = clone();
  preEvidence.updates[0].observedThrough = "2026-09-05T10:14:59Z";
  assert.ok(
    findings(preEvidence).some(
      (item) => item.code === "invalid_incident_update_sequence",
    ),
  );

  const futureObservation = clone();
  futureObservation.updates[3].observedThrough =
    "2026-09-05T11:06:00Z";
  assert.ok(
    findings(futureObservation).some(
      (item) => item.code === "invalid_incident_update_sequence",
    ),
  );

  const issuedBeforeDue = clone();
  issuedBeforeDue.updates[3].issuedAt = "2026-09-05T10:59:59Z";
  assert.ok(
    findings(issuedBeforeDue).some(
      (item) => item.code === "invalid_incident_update_sequence",
    ),
  );
});

test("incident decisions reject cross-snapshot, pre-evidence, and invalid supersession", () => {
  const crossSnapshot = clone();
  crossSnapshot.decisions[0].timelineSnapshotRef = "snapshot-other";
  assert.ok(
    findings(crossSnapshot).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const wrongSeveritySubject = clone();
  wrongSeveritySubject.decisions.find(
    (item) => item.decisionType === "severity-state",
  ).subjectRevision = "snapshot-other";
  assert.ok(
    findings(wrongSeveritySubject).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const wrongCadenceRevision = clone();
  wrongCadenceRevision.decisions.find(
    (item) => item.decisionType === "cadence",
  ).subjectRevision = `sha256:${"0".repeat(64)}`;
  assert.ok(
    findings(wrongCadenceRevision).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const wrongRecorder = clone();
  wrongRecorder.decisions[0].recordedById =
    wrongRecorder.roleAssignments.technicalDri.principalId;
  assert.ok(
    findings(wrongRecorder).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const preEvidence = clone();
  preEvidence.decisions.find(
    (item) => item.decisionType === "action-approval",
  ).decidedAt = "2026-09-05T10:19:59Z";
  assert.ok(
    findings(preEvidence).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const futureSupersession = clone();
  futureSupersession.decisions.find(
    (item) => item.decisionType === "action-approval",
  ).supersedesDecisionId = futureSupersession.decisions.find(
    (item) => item.decisionType === "communication-approval",
  ).id;
  assert.ok(
    findings(futureSupersession).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const incompleteRecoveryInputs = clone();
  incompleteRecoveryInputs.decisions
    .find(
      (item) =>
        item.decisionType === "incident-recovery-recommendation",
    )
    .inputEvidenceRefs.pop();
  assert.ok(
    findings(incompleteRecoveryInputs).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const wrongCommunicationEvidence = clone();
  wrongCommunicationEvidence.decisions.find(
    (item) => item.decisionType === "communication-approval",
  ).inputEvidenceRefs = ["evidence-checkout-alert"];
  assert.ok(
    findings(wrongCommunicationEvidence).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );
});

test("incident service recovery, incident recommendation, and closure remain separate", () => {
  const active = activeFixture();
  assert.equal(isValid(active), true);

  const closed = closedFixture();
  assert.equal(validateSchema(closed), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(closed), []);
  assert.equal(closed.complianceHandoffs[0].issueMutationState, "not-requested");
  assert.equal(closed.complianceHandoffs[0].remediationState, "not-claimed");
  assert.equal(closed.complianceHandoffs[0].verificationState, "not-claimed");
  assert.equal(closed.complianceHandoffs[0].closureState, "not-claimed");

  const prematureClosure = clone();
  prematureClosure.closure.state = "closed-by-owner";
  prematureClosure.closure.closedAt = "2026-09-05T11:04:00Z";
  assert.ok(
    findings(prematureClosure).some(
      (item) => item.code === "invalid_recovery_closure_separation",
    ),
  );

  const incompleteServiceRecovery = clone();
  incompleteServiceRecovery.serviceRecovery.recoveryCheckRefs.pop();
  assert.ok(
    findings(incompleteServiceRecovery).some(
      (item) => item.code === "invalid_recovery_closure_separation",
    ),
  );

  const missingOwnerClosureEvidence = closedFixture();
  missingOwnerClosureEvidence.evidence =
    missingOwnerClosureEvidence.evidence.filter(
      (item) => item.id !== missingOwnerClosureEvidence.closure.evidenceRef,
    );
  assert.ok(
    findings(missingOwnerClosureEvidence).some(
      (item) =>
        item.code === "invalid_decision_chronology" ||
        item.code === "invalid_recovery_closure_separation",
    ),
  );

  const wrongClosureSubject = closedFixture();
  wrongClosureSubject.decisions.find(
    (item) => item.decisionType === "owner-closure",
  ).subjectRevision = `sha256:${"0".repeat(64)}`;
  assert.ok(
    findings(wrongClosureSubject).some(
      (item) => item.code === "invalid_decision_chronology",
    ),
  );

  const claimedComplianceClosure = clone();
  claimedComplianceClosure.complianceHandoffs[0].closureState = "closed";
  assert.ok(
    findings(claimedComplianceClosure).some(
      (item) => item.code === "invalid_compliance_handoff",
    ),
  );
});

test("incident compliance handoff preserves exact deterministic obligation identity", () => {
  const driftedKey = clone();
  driftedKey.followUps[0].identityKey = `sha256:${"0".repeat(64)}`;
  assert.ok(
    findings(driftedKey).some(
      (item) => item.code === "invalid_incident_follow_up",
    ),
  );

  const mismatchedHandoff = clone();
  mismatchedHandoff.complianceHandoffs[0].controlRefs = [
    "control-unrelated",
  ];
  assert.ok(
    findings(mismatchedHandoff).some(
      (item) => item.code === "invalid_compliance_handoff",
    ),
  );

  const duplicate = clone();
  duplicate.complianceHandoffs.push({
    ...structuredClone(duplicate.complianceHandoffs[0]),
    id: "compliance-handoff-timeout-control-duplicate",
  });
  assert.ok(
    findings(duplicate).some(
      (item) => item.code === "invalid_compliance_handoff",
    ),
  );

  const duplicateSemanticObligation = clone();
  const duplicateFollowUp = structuredClone(
    duplicateSemanticObligation.followUps[0],
  );
  duplicateFollowUp.id = "follow-up-timeout-control-copy";
  duplicateFollowUp.complianceHandoffRef =
    "compliance-handoff-timeout-control-copy";
  duplicateSemanticObligation.followUps.push(duplicateFollowUp);
  duplicateSemanticObligation.complianceHandoffs.push({
    ...structuredClone(duplicateSemanticObligation.complianceHandoffs[0]),
    id: "compliance-handoff-timeout-control-copy",
    followUpRef: duplicateFollowUp.id,
  });
  assert.ok(
    findings(duplicateSemanticObligation).some(
      (item) => item.code === "invalid_incident_follow_up",
    ),
  );
});

test("incident response preserves explicit enriched v1 compatibility", () => {
  const prior = v1Fixture();
  assert.equal(validateSchema(prior), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(prior), []);
});

test("incident response rejects the bare role identity but accepts a named human with the title", () => {
  const bare = clone();
  bare.owner = " Incident Response ";
  bare.handoff.owner = " Incident Response ";
  bare.principals.find((item) => item.id === bare.ownerId).name =
    " Incident Response ";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));

  const titledHuman = clone();
  titledHuman.owner = "Alex Rivera, Incident Response";
  titledHuman.handoff.owner = "Alex Rivera, Incident Response";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Alex Rivera, Incident Response";
  assert.equal(isValid(titledHuman), true);
});

test("incident response rejects direct prohibited-action claims and missing gates", () => {
  for (const claim of [
    "We mutated production.",
    "We revoked the session.",
    "We shifted traffic.",
    "We declared the incident.",
    "We closed the incident.",
    "We sent the update.",
  ]) {
    const invalid = clone();
    invalid.handoff.summary = claim;
    assert.ok(
      findings(invalid).some((item) => item.code === "unauthorized_narrative_action"),
      claim,
    );
  }
  const missingGate = clone();
  missingGate.handoff.prohibitedActions =
    missingGate.handoff.prohibitedActions.filter(
      (item) => item !== "shift-traffic",
    );
  assert.ok(
    findings(missingGate).some((item) => item.code === "missing_authority_gate"),
  );
});

test("incident schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, timeline: [] }), false);
  assert.equal(
    validateSchema({
      ...legacy,
      mitigations: [{ ...legacy.mitigations[0], approvalRef: undefined }],
    }),
    false,
  );
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("incident response CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `incident-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts", "validate-artifact.mjs"), "incident-response", path],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
