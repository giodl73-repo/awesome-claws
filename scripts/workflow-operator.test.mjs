import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeWorkflowAuthorityScopeDigest,
  computeWorkflowExecutionReconciliationDigest,
  computeWorkflowInvocationEvidenceDigest,
  computeWorkflowInvocationRequestDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/workflow-operator/schemas/workflow-execution-reconciliation.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/workflow-operator/fixtures/workflow-execution-reconciliation.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const reference = await readFile(
  new URL(
    "../sources/workflow-operator/references/workflow-execution-reconciliation-contract.md",
    import.meta.url,
  ),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function workflowExecutionReconciliationFindings(",
);
const validatorEnd = validatorSource.indexOf(
  "\nconst validators = {",
  validatorStart,
);
assert.notEqual(validatorStart, -1);
assert.notEqual(validatorEnd, -1);
const emittedFindingCodes = new Set(
  [
    ...validatorSource
      .slice(validatorStart, validatorEnd)
      .matchAll(/finding\(\s*"([a-z_]+)"/gu),
  ].map((match) => match[1]),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = (value) => structuredClone(value);
const digest = (character) => `sha256:${character.repeat(64)}`;

function semanticFindings(value, options = {}) {
  return validateArtifactSemantics("workflow-operator", value, options);
}

function allIdObjects(value) {
  return [
    value.manifest,
    ...value.principals,
    ...value.authorityAttestations,
    value.workflowDefinition,
    ...value.workflowDefinition.steps,
    value.inputEnvelope,
    ...value.effectDeclarations,
    ...value.approvalGates,
    ...value.approvalDecisions,
    ...value.invocations,
    ...value.evidenceReceipts,
    ...value.stepReconciliations,
    ...value.blockers,
    ...value.questions,
    value.controlPolicy,
    value.handoff,
  ];
}

function refresh(value) {
  value.handoff.principalRefs = value.principals.map((item) => item.id);
  value.handoff.coveredObjectRefs = [
    ...new Set(allIdObjects(value).map((item) => item.id)),
  ];
  const manifestDigest = computeWorkflowExecutionReconciliationDigest(value);
  value.manifest.contentDigest = manifestDigest;
  value.handoff.manifestDigest = manifestDigest;
}

function provenance(label, recordedAt) {
  return {
    sourceSystem: "approved-governance-ledger",
    sourceRecordRef: label,
    recordDigest: digest("a"),
    recordedAt,
  };
}

function makeProduction() {
  const value = clone(fixture);
  value.manifest.artifactMode = "production";
  value.manifest.state = "awaiting-human-decision";
  value.principals = [
    {
      ...value.principals[0],
      id: "person-release-owner",
      kind: "human",
      displayName: "Morgan Release Owner",
      attestationRef: "attestation-release-owner",
    },
    {
      ...value.principals[1],
      id: "person-effect-approver",
      kind: "human",
      displayName: "Riley Effect Approver",
      attestationRef: "attestation-effect-approver",
    },
  ];
  const replaceRef = (candidate) => {
    if (candidate === "planned-role-release-owner") return "person-release-owner";
    if (candidate === "planned-role-effect-approver") {
      return "person-effect-approver";
    }
    return candidate;
  };
  const replaceRefs = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(replaceRefs);
    if (!candidate || typeof candidate !== "object") return replaceRef(candidate);
    return Object.fromEntries(
      Object.entries(candidate).map(([key, child]) => [key, replaceRefs(child)]),
    );
  };
  Object.assign(value, replaceRefs(value));
  value.authorityAttestations = [
    {
      id: "attestation-release-owner",
      principalRef: "person-release-owner",
      humanIdentityVerified: true,
      scopeDigest: computeWorkflowAuthorityScopeDigest(
        value.principals[0].authorityScopes,
      ),
      attestedAt: "2026-09-01T18:00:00Z",
      receipt: provenance("release-owner", "2026-09-01T18:00:00Z"),
    },
    {
      id: "attestation-effect-approver",
      principalRef: "person-effect-approver",
      humanIdentityVerified: true,
      scopeDigest: computeWorkflowAuthorityScopeDigest(
        value.principals[1].authorityScopes,
      ),
      attestedAt: "2026-09-01T18:01:00Z",
      receipt: provenance("effect-approver", "2026-09-01T18:01:00Z"),
    },
  ];
  value.workflowDefinition.evidenceStatus = "observed";
  value.workflowDefinition.reviewedAt = "2026-09-01T18:10:00Z";
  value.workflowDefinition.reviewReceipt = provenance(
    "workflow-review",
    "2026-09-01T18:10:00Z",
  );
  value.inputEnvelope.evidenceStatus = "observed";
  value.inputEnvelope.validated = true;
  value.inputEnvelope.validatedAt = "2026-09-01T18:15:00Z";
  value.inputEnvelope.validationReceipt = provenance(
    "input-validation",
    "2026-09-01T18:15:00Z",
  );
  const gate = value.approvalGates[0];
  gate.state = "waiting";
  gate.lobsterApprovalId = "approval-release-effects";
  gate.surfacedAt = "2026-09-01T18:25:00Z";
  const request = {
    pipeline: value.workflowDefinition.path,
    cwd: "workspace",
    argsDigest: value.inputEnvelope.valuesDigest,
    timeoutMs: 120000,
    maxStdoutBytes: 512000,
    approvalId: null,
    approve: null,
    decisionRef: null,
  };
  const invocation = {
    id: "invocation-release-readiness-run",
    action: "run",
    retryOfInvocationRef: null,
    toolCallId: "tool-call-release-readiness",
    invokedAt: "2026-09-01T18:20:00Z",
    completedAt: "2026-09-01T18:25:00Z",
    request,
    requestDigest: computeWorkflowInvocationRequestDigest(request),
    response: {
      ok: true,
      status: "needs_approval",
      outputDigest: digest("3"),
      requiresApproval: {
        approvalId: gate.lobsterApprovalId,
        promptDigest: gate.promptDigest,
        itemsDigest: gate.itemsDigest,
        resumeTokenPresent: true,
      },
      errorType: null,
      errorMessage: null,
    },
    evidenceDigest: digest("0"),
  };
  invocation.evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(invocation);
  value.invocations = [invocation];
  value.evidenceReceipts = [
    {
      id: "evidence-lobster-readiness-output",
      kind: "lobster-output",
      sourceSystem: "@openclaw/lobster@2026.7.1",
      sourceRecordRef: invocation.toolCallId,
      observedAt: invocation.completedAt,
      recordDigest: invocation.response.outputDigest,
      supportsStepRefs: [
        "step-validate-input",
        "step-run-tests",
        "step-check-artifacts",
        "step-approval-stop",
      ],
      supportsEffectRefs: [],
      effectState: "none",
    },
  ];
  for (const item of value.stepReconciliations) {
    if (
      ["step-validate-input", "step-run-tests", "step-check-artifacts"].includes(
        item.stepRef,
      )
    ) {
      item.state = "passed";
      item.attemptRefs = [invocation.id];
      item.startedAt = invocation.invokedAt;
      item.endedAt = invocation.completedAt;
      item.evidenceRefs = [value.evidenceReceipts[0].id];
    } else if (item.stepRef === "step-approval-stop") {
      item.state = "pending-approval";
      item.attemptRefs = [invocation.id];
      item.startedAt = invocation.invokedAt;
      item.endedAt = invocation.completedAt;
      item.evidenceRefs = [value.evidenceReceipts[0].id];
    }
  }
  value.blockers = [];
  value.reconciliation.status = "awaiting-owner";
  value.reconciliation.completedStepRefs = [
    "step-validate-input",
    "step-run-tests",
    "step-check-artifacts",
  ];
  value.reconciliation.pendingStepRefs = [
    "step-approval-stop",
    "step-notify-release",
    "step-create-tag",
  ];
  value.reconciliation.nextAction =
    "A human effect approver must decide whether to resume the exact paused state.";
  value.reconciliation.nextOwnerRef = "person-effect-approver";
  value.handoff.state = "awaiting-human-decision";
  refresh(value);
  return value;
}

const production = makeProduction();

function makeRejectedProduction() {
  const value = clone(production);
  const gate = value.approvalGates[0];
  const decision = {
    id: "decision-reject-release-effects",
    gateRef: gate.id,
    decision: "reject-and-abort",
    deciderRef: "person-effect-approver",
    decidedAt: "2026-09-01T18:30:00Z",
    workflowDigest: value.workflowDefinition.contentDigest,
    inputDigest: value.inputEnvelope.valuesDigest,
    observedStateDigest: digest("4"),
    guardedEffectRefs: [...gate.guardedEffectRefs],
    receipt: provenance("reject-decision", "2026-09-01T18:30:00Z"),
  };
  gate.state = "rejected";
  gate.decisionRef = decision.id;
  value.approvalDecisions = [decision];
  const request = {
    pipeline: value.workflowDefinition.path,
    cwd: "workspace",
    argsDigest: value.inputEnvelope.valuesDigest,
    timeoutMs: 120000,
    maxStdoutBytes: 512000,
    approvalId: gate.lobsterApprovalId,
    approve: false,
    decisionRef: decision.id,
  };
  const invocation = {
    id: "invocation-release-readiness-reject",
    action: "resume",
    retryOfInvocationRef: null,
    toolCallId: "tool-call-release-reject",
    invokedAt: "2026-09-01T18:31:00Z",
    completedAt: "2026-09-01T18:32:00Z",
    request,
    requestDigest: computeWorkflowInvocationRequestDigest(request),
    response: {
      ok: true,
      status: "ok",
      outputDigest: digest("5"),
      requiresApproval: null,
      errorType: null,
      errorMessage: null,
    },
    evidenceDigest: digest("0"),
  };
  invocation.evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(invocation);
  value.invocations.push(invocation);
  value.evidenceReceipts.push({
    id: "evidence-lobster-rejection",
    kind: "lobster-output",
    sourceSystem: "@openclaw/lobster@2026.7.1",
    sourceRecordRef: invocation.toolCallId,
    observedAt: invocation.completedAt,
    recordDigest: invocation.response.outputDigest,
    supportsStepRefs: ["step-approval-stop"],
    supportsEffectRefs: [],
    effectState: "none",
  });
  const stop = value.stepReconciliations.find(
    (item) => item.stepRef === "step-approval-stop",
  );
  stop.state = "passed";
  stop.attemptRefs.push(invocation.id);
  stop.endedAt = invocation.completedAt;
  stop.evidenceRefs.push("evidence-lobster-rejection");
  for (const stepRef of ["step-notify-release", "step-create-tag"]) {
    const item = value.stepReconciliations.find(
      (candidate) => candidate.stepRef === stepRef,
    );
    item.state = "skipped";
  }
  value.manifest.state = "completed-reconciled";
  value.reconciliation.status = "completed-read-only";
  value.reconciliation.completedStepRefs.push("step-approval-stop");
  value.reconciliation.pendingStepRefs = [];
  value.reconciliation.skippedStepRefs = [
    "step-notify-release",
    "step-create-tag",
  ];
  value.reconciliation.unresolvedEffectRefs = [];
  value.reconciliation.nextAction =
    "Preserve the rejected run as closed without notification, tag, or replay.";
  value.handoff.state = "completed-reconciled";
  refresh(value);
  return value;
}

function makeCompletedEffectfulProduction() {
  const value = makeRejectedProduction();
  const gate = value.approvalGates[0];
  gate.state = "approved";
  value.approvalDecisions[0].decision = "approve-resume-once";
  const resume = value.invocations.at(-1);
  resume.request.approve = true;
  resume.requestDigest = computeWorkflowInvocationRequestDigest(resume.request);
  resume.evidenceDigest = computeWorkflowInvocationEvidenceDigest(resume);
  const effectCases = [
    {
      stepRef: "step-notify-release",
      effectRef: "effect-release-notification",
      receiptRef: "evidence-release-notification",
      sourceSystem: "notification-service",
      sourceRecordRef: "notification-release-4-2-0",
      recordDigest: digest("7"),
    },
    {
      stepRef: "step-create-tag",
      effectRef: "effect-release-tag",
      receiptRef: "evidence-release-tag",
      sourceSystem: "release-tag-service",
      sourceRecordRef: "tag-release-4-2-0",
      recordDigest: digest("8"),
    },
  ];
  for (const effectCase of effectCases) {
    const item = value.stepReconciliations.find(
      (candidate) => candidate.stepRef === effectCase.stepRef,
    );
    item.state = "passed";
    item.attemptRefs = [resume.id];
    item.startedAt = resume.invokedAt;
    item.endedAt = resume.completedAt;
    item.evidenceRefs = [effectCase.receiptRef];
    item.effectState = "observed";
    value.evidenceReceipts.push({
      id: effectCase.receiptRef,
      kind: "external-system",
      sourceSystem: effectCase.sourceSystem,
      sourceRecordRef: effectCase.sourceRecordRef,
      observedAt: resume.completedAt,
      recordDigest: effectCase.recordDigest,
      supportsStepRefs: [effectCase.stepRef],
      supportsEffectRefs: [effectCase.effectRef],
      effectState: "observed",
    });
    value.reconciliation.completedStepRefs.push(effectCase.stepRef);
  }
  value.reconciliation.skippedStepRefs = [];
  value.reconciliation.status = "completed-with-effects";
  refresh(value);
  return value;
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function assertHas(value, code, options) {
  assertSchemaValid(value);
  assert.equal(
    semanticFindings(value, options).some((finding) => finding.code === code),
    true,
    `${code}: ${JSON.stringify(semanticFindings(value, options))}`,
  );
}

test("ships a strict illustrative zero-execution reconciliation", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(semanticFindings(fixture), []);
  assert.equal(fixture.manifest.artifactMode, "illustrative-fixture");
  assert.equal(fixture.manifest.state, "blocked");
  assert.deepEqual(fixture.invocations, []);
  assert.deepEqual(fixture.approvalDecisions, []);
  assert.deepEqual(fixture.evidenceReceipts, []);
  assert.deepEqual(fixture.authorityAttestations, []);
  assert.equal(
    fixture.stepReconciliations.every((item) => item.state === "not-run"),
    true,
  );
});

test("accepts observed read-only progress paused before notification and tag", () => {
  assertSchemaValid(production);
  assert.deepEqual(semanticFindings(production), []);
  assert.equal(production.manifest.state, "awaiting-human-decision");
  assert.equal(production.approvalGates[0].state, "waiting");
  assert.equal(production.invocations[0].response.status, "needs_approval");
  assert.equal(
    production.stepReconciliations
      .filter((item) =>
        ["step-notify-release", "step-create-tag"].includes(item.stepRef),
      )
      .every(
        (item) =>
          item.state === "not-run" && item.effectState === "not-attempted",
      ),
    true,
  );
});

test("accepts generic target versions and consequential effect kinds", () => {
  const generic = clone(production);
  generic.inputEnvelope.targetVersion = "deployment-2026.09";
  generic.effectDeclarations[1].kind = "external-write";
  refresh(generic);
  assertSchemaValid(generic);
  assert.deepEqual(semanticFindings(generic), []);
});

test("accepts an exact human rejection without running guarded effects", () => {
  const rejected = makeRejectedProduction();
  assertSchemaValid(rejected);
  assert.deepEqual(semanticFindings(rejected), []);
  assert.equal(rejected.invocations.at(-1).request.approve, false);
  assert.equal(
    rejected.stepReconciliations
      .filter((item) =>
        ["step-notify-release", "step-create-tag"].includes(item.stepRef),
      )
      .every((item) => item.state === "skipped"),
    true,
  );
});

test("accepts fully reconciled consequential effects with external evidence", () => {
  const value = makeCompletedEffectfulProduction();
  assertSchemaValid(value);
  assert.deepEqual(semanticFindings(value), []);
});

test("rejects passed consequential steps without an effect outcome", () => {
  const missingEffect = makeCompletedEffectfulProduction();
  missingEffect.stepReconciliations.find(
    (item) => item.stepRef === "step-notify-release",
  ).effectState = "none";
  refresh(missingEffect);
  assertHas(missingEffect, "invalid_step_reconciliation");
});

test("rejects consequential effects attempted before approval", () => {
  const prematureEffect = makeCompletedEffectfulProduction();
  prematureEffect.approvalGates[0].state = "waiting";
  prematureEffect.approvalGates[0].decisionRef = null;
  prematureEffect.approvalDecisions = [];
  refresh(prematureEffect);
  assertHas(prematureEffect, "invalid_step_reconciliation");
});

test("blocks decided workflows while steps or effects remain unresolved", () => {
  const pending = makeRejectedProduction();
  for (const stepRef of ["step-notify-release", "step-create-tag"]) {
    const item = pending.stepReconciliations.find(
      (candidate) => candidate.stepRef === stepRef,
    );
    item.state = "not-run";
  }
  pending.reconciliation.skippedStepRefs = [];
  pending.reconciliation.pendingStepRefs = [
    "step-notify-release",
    "step-create-tag",
  ];
  pending.reconciliation.unresolvedEffectRefs = [
    "effect-release-notification",
    "effect-release-tag",
  ];
  pending.manifest.state = "completed-reconciled";
  pending.handoff.state = "completed-reconciled";
  refresh(pending);
  assertHas(pending, "invalid_workflow_state");
});

test("blocks terminal completion while any reconciled step failed", () => {
  const failed = makeRejectedProduction();
  const item = failed.stepReconciliations.find(
    (candidate) => candidate.stepRef === "step-run-tests",
  );
  item.state = "failed";
  failed.reconciliation.completedStepRefs =
    failed.reconciliation.completedStepRefs.filter(
      (stepRef) => stepRef !== item.stepRef,
    );
  failed.reconciliation.failedStepRefs = [item.stepRef];
  refresh(failed);
  assertHas(failed, "invalid_workflow_state");
});

test("rejects authority evidence after the reconciliation boundary", () => {
  const futureAuthority = clone(production);
  futureAuthority.authorityAttestations[0].attestedAt =
    "2026-09-01T20:01:00Z";
  futureAuthority.authorityAttestations[0].receipt.recordedAt =
    "2026-09-01T20:01:00Z";
  refresh(futureAuthority);
  assertHas(futureAuthority, "invalid_workflow_authority");
});

test("rejects workflow review and input receipts after the as-of boundary", () => {
  const futureReceipts = clone(production);
  futureReceipts.workflowDefinition.reviewReceipt.recordedAt =
    "2026-09-01T20:01:00Z";
  futureReceipts.inputEnvelope.validationReceipt.recordedAt =
    "2026-09-01T20:01:00Z";
  refresh(futureReceipts);
  assertHas(futureReceipts, "invalid_workflow_definition");
  assertHas(futureReceipts, "invalid_workflow_input");
});

test("keeps illustrative workflow and input claims evidence-free", () => {
  const fictional = clone(fixture);
  fictional.workflowDefinition.reviewedAt = "2026-09-01T17:00:00Z";
  fictional.workflowDefinition.reviewReceipt = provenance(
    "fictional-review",
    "2026-09-01T17:00:00Z",
  );
  fictional.inputEnvelope.validated = true;
  fictional.inputEnvelope.validatedAt = "2026-09-01T17:00:00Z";
  fictional.inputEnvelope.validationReceipt = provenance(
    "fictional-validation",
    "2026-09-01T17:00:00Z",
  );
  refresh(fictional);
  assertHas(fictional, "fictional_workflow_evidence");
});

test("rejects decisions for approval gates that were never surfaced", () => {
  const unsurfaced = makeRejectedProduction();
  unsurfaced.approvalGates[0].surfacedAt = null;
  refresh(unsurfaced);
  assertHas(unsurfaced, "stale_or_unauthorized_resume_decision");
});

test("rejects an awaiting approval gate without a surfaced timestamp", () => {
  const unsurfaced = clone(production);
  unsurfaced.approvalGates[0].surfacedAt = null;
  refresh(unsurfaced);
  assertHas(unsurfaced, "invalid_lobster_approval_evidence");
});

test("rejects waiting gates without a needs-approval invocation", () => {
  const fabricatedPause = clone(production);
  fabricatedPause.invocations[0].response.status = "ok";
  fabricatedPause.invocations[0].response.requiresApproval = null;
  fabricatedPause.invocations[0].evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(fabricatedPause.invocations[0]);
  refresh(fabricatedPause);
  assertHas(fabricatedPause, "invalid_approval_gate");
});

test("rejects step evidence that supports a different step", () => {
  const mismatchedEvidence = clone(production);
  mismatchedEvidence.evidenceReceipts[0].supportsStepRefs =
    mismatchedEvidence.evidenceReceipts[0].supportsStepRefs.filter(
      (stepRef) => stepRef !== "step-validate-input",
    );
  refresh(mismatchedEvidence);
  assertHas(mismatchedEvidence, "invalid_step_reconciliation");
});

test("binds Lobster receipts to exact recorded invocations", () => {
  const unbound = clone(production);
  unbound.evidenceReceipts[0].sourceRecordRef = "unknown-tool-call";
  refresh(unbound);
  assertHas(unbound, "invalid_workflow_evidence");
});

test("rejects undeclared effect references on workflow steps", () => {
  const undeclared = clone(production);
  undeclared.workflowDefinition.steps
    .find((step) => step.id === "step-notify-release")
    .effectRefs.push("effect-undeclared");
  refresh(undeclared);
  assertHas(undeclared, "invalid_effect_boundary");
});

test("rejects decided gates without immutable decisions", () => {
  const missingDecision = makeRejectedProduction();
  missingDecision.approvalGates[0].decisionRef = null;
  missingDecision.approvalDecisions = [];
  refresh(missingDecision);
  assertHas(missingDecision, "invalid_approval_gate");
});

test("keeps approved but skipped effects unresolved", () => {
  const skippedAfterApproval = makeRejectedProduction();
  const gate = skippedAfterApproval.approvalGates[0];
  gate.state = "approved";
  skippedAfterApproval.approvalDecisions[0].decision = "approve-resume-once";
  const resume = skippedAfterApproval.invocations.at(-1);
  resume.request.approve = true;
  resume.requestDigest = computeWorkflowInvocationRequestDigest(resume.request);
  resume.evidenceDigest = computeWorkflowInvocationEvidenceDigest(resume);
  refresh(skippedAfterApproval);
  assertHas(skippedAfterApproval, "inaccurate_workflow_reconciliation");
  assertHas(skippedAfterApproval, "invalid_workflow_state");
});

test("rejects observed effects on skipped steps", () => {
  const hiddenEffect = makeRejectedProduction();
  const item = hiddenEffect.stepReconciliations.find(
    (candidate) => candidate.stepRef === "step-notify-release",
  );
  item.effectState = "observed";
  item.startedAt = "2026-09-01T18:31:00Z";
  item.endedAt = "2026-09-01T18:32:00Z";
  item.evidenceRefs = ["evidence-release-notification"];
  hiddenEffect.evidenceReceipts.push({
    id: "evidence-release-notification",
    kind: "external-system",
    sourceSystem: "notification-service",
    sourceRecordRef: "notification-release-4-2-0",
    observedAt: item.endedAt,
    recordDigest: digest("6"),
    supportsStepRefs: [item.stepRef],
    supportsEffectRefs: ["effect-release-notification"],
    effectState: "observed",
  });
  refresh(hiddenEffect);
  assertHas(hiddenEffect, "invalid_step_reconciliation");
});

test("rejects contradictory Lobster ok and status fields", () => {
  const contradictory = clone(production);
  contradictory.invocations[0].response.ok = false;
  contradictory.invocations[0].evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(contradictory.invocations[0]);
  refresh(contradictory);
  assertHas(contradictory, "invalid_lobster_invocation");

  const staleApproval = clone(production);
  staleApproval.invocations[0].response.status = "ok";
  staleApproval.invocations[0].evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(staleApproval.invocations[0]);
  refresh(staleApproval);
  assertHas(staleApproval, "invalid_lobster_invocation");

  const staleError = clone(production);
  staleError.invocations[0].response.status = "ok";
  staleError.invocations[0].response.requiresApproval = null;
  staleError.invocations[0].response.errorType = "stale-error";
  staleError.invocations[0].response.errorMessage = "Stale error detail.";
  staleError.invocations[0].evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(staleError.invocations[0]);
  refresh(staleError);
  assertHas(staleError, "invalid_lobster_invocation");
});

test("rejects resume invocations that predate their human decision", () => {
  const premature = makeRejectedProduction();
  const resume = premature.invocations.at(-1);
  resume.invokedAt = "2026-09-01T18:29:00Z";
  resume.evidenceDigest = computeWorkflowInvocationEvidenceDigest(resume);
  refresh(premature);
  assertHas(premature, "invalid_lobster_invocation");
});

test("documents actual pinned Lobster evidence and token custody", () => {
  for (const phrase of [
    "@openclaw/lobster@2026.7.1",
    "@clawdbot/lobster@2026.6.11",
    "resume token",
    "runtime custody",
    "does not prove a notification",
    "not transactions",
  ]) {
    assert.match(reference, new RegExp(phrase, "iu"));
  }
});

test("every workflow reconciliation finding code has a focused case", () => {
  const cases = new Map();
  const add = (code, mutate, base = production, options) => {
    const value = clone(base);
    mutate(value);
    if (
      ![
        "incomplete_workflow_handoff",
        "invalid_workflow_manifest_digest",
      ].includes(code)
    ) {
      refresh(value);
    }
    cases.set(code, { value, options });
  };

  add("duplicate_workflow_object_id", (value) => {
    value.questions[0].id = value.controlPolicy.id;
  });
  add(
    "invalid_workflow_chronology",
    (value) => {
      value.manifest.asOf = "2026-09-02T20:00:00Z";
      value.manifest.deadline = "2026-09-03T20:00:00Z";
    },
    production,
    { validationTime: "2026-09-01T20:00:00Z" },
  );
  add("invalid_workflow_authority", (value) => {
    value.principals[0].displayName = "Release AI agent";
  });
  add("invalid_workflow_definition", (value) => {
    value.workflowDefinition.path = "workflows/release-readiness.txt";
  });
  add("invalid_workflow_input", (value) => {
    value.inputEnvelope.validated = false;
  });
  add("invalid_workflow_step_graph", (value) => {
    value.workflowDefinition.steps[0].dependsOn = ["step-run-tests"];
  });
  add("invalid_effect_boundary", (value) => {
    value.effectDeclarations[0].stepRef = "step-run-tests";
  });
  add("invalid_approval_gate", (value) => {
    value.approvalGates[0].guardedEffectRefs = ["effect-release-tag"];
  });
  add("stale_or_unauthorized_resume_decision", (value) => {
    const gate = value.approvalGates[0];
    gate.state = "approved";
    gate.decisionRef = "decision-release-effects";
    value.approvalDecisions = [
      {
        id: gate.decisionRef,
        gateRef: gate.id,
        decision: "approve-resume-once",
        deciderRef: "person-effect-approver",
        decidedAt: "2026-09-01T18:30:00Z",
        workflowDigest: digest("9"),
        inputDigest: value.inputEnvelope.valuesDigest,
        observedStateDigest: digest("4"),
        guardedEffectRefs: [...gate.guardedEffectRefs],
        receipt: provenance("resume-decision", "2026-09-01T18:30:00Z"),
      },
    ];
  });
  add("invalid_lobster_invocation", (value) => {
    value.invocations[0].request.argsDigest = digest("5");
    value.invocations[0].requestDigest =
      computeWorkflowInvocationRequestDigest(value.invocations[0].request);
    value.invocations[0].evidenceDigest =
      computeWorkflowInvocationEvidenceDigest(value.invocations[0]);
  });
  add("invalid_workflow_retry", (value) => {
    value.invocations[0].retryOfInvocationRef = value.invocations[0].id;
    value.invocations[0].evidenceDigest =
      computeWorkflowInvocationEvidenceDigest(value.invocations[0]);
  });
  add("invalid_lobster_approval_evidence", (value) => {
    value.invocations[0].response.requiresApproval.promptDigest = digest("6");
    value.invocations[0].evidenceDigest =
      computeWorkflowInvocationEvidenceDigest(value.invocations[0]);
  });
  add("invalid_workflow_evidence", (value) => {
    value.evidenceReceipts[0].supportsStepRefs = ["unknown-step"];
  });
  add("incomplete_step_reconciliation", (value) => {
    value.stepReconciliations.pop();
  });
  add("invalid_step_reconciliation", (value) => {
    value.stepReconciliations[0].startedAt = null;
  });
  add("unproven_external_effect", (value) => {
    const item = value.stepReconciliations.find(
      (candidate) => candidate.stepRef === "step-notify-release",
    );
    item.state = "passed";
    item.effectState = "observed";
    item.attemptRefs = [value.invocations[0].id];
    item.startedAt = value.invocations[0].invokedAt;
    item.endedAt = value.invocations[0].completedAt;
    item.evidenceRefs = [value.evidenceReceipts[0].id];
    value.reconciliation.completedStepRefs.push(item.stepRef);
    value.reconciliation.pendingStepRefs =
      value.reconciliation.pendingStepRefs.filter((ref) => ref !== item.stepRef);
    value.reconciliation.unresolvedEffectRefs =
      value.reconciliation.unresolvedEffectRefs.filter(
        (ref) => ref !== "effect-release-notification",
      );
  });
  add("inaccurate_workflow_reconciliation", (value) => {
    value.reconciliation.pendingStepRefs = [];
  });
  add("invalid_workflow_state", (value) => {
    value.manifest.state = "completed-reconciled";
    value.handoff.state = "completed-reconciled";
  });
  add(
    "fictional_workflow_evidence",
    (value) => {
      value.workflowDefinition.evidenceStatus = "observed";
    },
    fixture,
  );
  add("dangling_workflow_owner_or_target", (value) => {
    value.questions[0].ownerRef = "missing-owner";
  });
  add("incomplete_workflow_prohibitions", (value) => {
    value.prohibitedActions.pop();
  });
  add("workflow_secret_exposure", (value) => {
    value.questions[0].text = "resume_token=secret123";
  });
  add("invalid_workflow_controls", (value) => {
    value.handoff.retentionDays = 31;
  });

  test("rejects private URLs in durable workflow text", () => {
    const privateUrl = clone(production);
    privateUrl.questions[0].text =
      "Consult https://release-runbook.corp.example/secret before resuming.";
    refresh(privateUrl);
    assertHas(privateUrl, "workflow_secret_exposure");
  });
  add("incomplete_workflow_handoff", (value) => {
    value.handoff.coveredObjectRefs.pop();
  });
  add("invalid_workflow_manifest_digest", (value) => {
    refresh(value);
    value.manifest.contentDigest = digest("7");
  });

  assert.deepEqual(
    [...cases.keys()].sort(),
    [...emittedFindingCodes].sort(),
  );
  for (const [code, { value, options }] of cases) {
    assertHas(value, code, options);
  }
});

test("schema-valid artifacts never crash the semantic validator", () => {
  const dangling = clone(production);
  dangling.invocations[0].request.decisionRef = "missing-decision";
  dangling.invocations[0].request.approvalId = "missing-approval";
  dangling.invocations[0].request.approve = true;
  dangling.invocations[0].action = "resume";
  dangling.invocations[0].requestDigest =
    computeWorkflowInvocationRequestDigest(dangling.invocations[0].request);
  dangling.invocations[0].evidenceDigest =
    computeWorkflowInvocationEvidenceDigest(dangling.invocations[0]);
  refresh(dangling);
  assertSchemaValid(dangling);
  assert.doesNotThrow(() => semanticFindings(dangling));
  assertHas(dangling, "invalid_lobster_invocation");
});
