import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeCheckpointDigest,
  computeFindingRevision,
  computeIssueIdempotencyKey,
  computeIssueMutationPreview,
  computeIssuePolicyDigest,
  computeObligationKey,
  computeObligationRevision,
  computeSignalRevision,
  repositoryComplianceProgramFindings,
  resealRepositoryComplianceArtifact,
} from "./repository-compliance-program-manager.mjs";
import {
  artifactSemanticValidationOptions,
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const AS_OF = "2026-09-14T19:00:00Z";
const base = "../sources/repository-compliance-program-manager";
const fixture = JSON.parse(
  await readFile(
    new URL(`${base}/fixtures/repository-compliance-program.example.json`, import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(`${base}/schemas/repository-compliance-program.schema.json`, import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL(`${base}/templates/repository-compliance-program.md`, import.meta.url),
  "utf8",
);
const capabilityContract = await readFile(
  new URL(`${base}/references/issue-writer-capability-contract.md`, import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function mutate(change, reseal = true) {
  const value = clone();
  change(value);
  return reseal ? resealRepositoryComplianceArtifact(value) : value;
}

function findings(value, options = { asOf: AS_OF }) {
  return repositoryComplianceProgramFindings(value, options);
}

function assertHas(value, code, options = { asOf: AS_OF }) {
  const result = findings(value, options);
  assert.ok(result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

function assertNotHas(value, code, options = { asOf: AS_OF }) {
  const result = findings(value, options);
  assert.ok(!result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

test("representative checkpoint is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.run.currentCheckpointDigest, computeCheckpointDigest(fixture));
  assert.equal(fixture.handoff.checkpointDigest, fixture.run.currentCheckpointDigest);
});

test("fixture carries the bounded adverse and lifecycle states", () => {
  assert.equal(fixture.controls.length, 2);
  assert.equal(fixture.assets.length, 4);
  assert.equal(fixture.signals.length, 6);
  assert.equal(fixture.canonicalFindings.length, 5);
  assert.equal(fixture.obligations.length, 5);
  assert.equal(fixture.issues.length, fixture.obligations.length);
  assert.ok(fixture.issueReceipts.some((row) => row.replayed === true));
  assert.ok(fixture.issueMutations.some((row) => row.conflictState === "owner-content-conflict"));
  assert.ok(fixture.obligations.some((row) => row.etaAt === null));
  assert.deepEqual(
    new Set(fixture.obligations.map((row) => row.slaState)),
    new Set(["within", "near", "out"]),
  );
  assert.ok(fixture.obligations.some((row) => row.state === "verified"));
  assert.ok(fixture.obligations.some((row) => row.state === "reopened"));
  assert.equal(fixture.extensions.length, 1);
  assert.equal(fixture.exceptions.length, 1);
  assert.equal(fixture.nonQualifyingClosureSignals.length, 4);
});

test("exact snapshot kinds, roots, and source indices are total", () => {
  assertHas(
    mutate((value) => value.snapshots.splice(3, 1)),
    "missing_snapshot_kind",
  );
  assertHas(
    mutate((value) => value.snapshots[0].complete = false),
    "invalid_snapshot",
  );
  assertHas(
    mutate((value) => value.run.sourceSnapshotRoots.pop(), false),
    "invalid_snapshot_totality",
  );
  assertHas(
    mutate((value) => value.snapshots[1].indexRefs.pop()),
    "invalid_snapshot",
  );
});

test("controls and assets remain bound to exact revisions and owners", () => {
  assertHas(
    mutate((value) => value.controls[0].applicability = "agent-assigned"),
    "invalid_control_binding",
  );
  assertHas(
    mutate((value) => value.assets[0].ownerRef = "principal-cli-owner"),
    "invalid_obligation_owner",
  );
  assertHas(
    mutate((value) => value.assets[0].revision = `sha256:${"f".repeat(64)}`, false),
    "invalid_asset_owner_binding",
  );
});

test("duplicate signals canonicalize without losing source identities", () => {
  const canonical = fixture.canonicalFindings.find((row) => row.id === "finding-api");
  assert.deepEqual(canonical.sourceSignalRefs, ["signal-api-a", "signal-api-b"]);
  assert.notEqual(
    fixture.signals.find((row) => row.id === "signal-api-a").sourceIdentity,
    fixture.signals.find((row) => row.id === "signal-api-b").sourceIdentity,
  );
  assertHas(
    mutate((value) => value.signals.find((row) => row.id === "signal-api-b").sourceIdentity =
      value.signals.find((row) => row.id === "signal-api-a").sourceIdentity),
    "duplicate_source_identity",
  );
  assertHas(
    mutate((value) => value.canonicalFindings[0].sourceSignalRefs.pop()),
    "invalid_signal_canonicalization",
  );
});

test("signal, finding, and obligation revision identities are content-bound", () => {
  const signal = fixture.signals[0];
  const canonical = fixture.canonicalFindings[0];
  const obligation = fixture.obligations[0];
  assert.equal(signal.revision, computeSignalRevision(signal));
  assert.equal(canonical.revision, computeFindingRevision(canonical));
  assert.equal(obligation.obligationKey, computeObligationKey(obligation));
  assert.equal(obligation.revision, computeObligationRevision(obligation));
  assertHas(
    mutate((value) => value.signals[0].findingRevision = "rewritten", false),
    "invalid_signal_binding",
  );
});

test("one exact obligation exists per canonical control asset finding revision", () => {
  assertHas(
    mutate((value) => value.obligations.pop()),
    "invalid_obligation_totality",
  );
  assertHas(
    mutate((value) => {
      const duplicate = structuredClone(value.obligations[0]);
      duplicate.id = "obligation-duplicate";
      duplicate.issueRef = "issue-cli";
      value.obligations.push(duplicate);
    }),
    "invalid_obligation_identity",
  );
  assertHas(
    mutate((value) => value.obligations[0].findingRevision = "another-revision", false),
    "invalid_obligation_identity",
  );
});

test("one policy-bound issue exists per obligation", () => {
  for (const obligation of fixture.obligations) {
    assert.equal(
      fixture.issues.filter((issue) => issue.obligationRef === obligation.id).length,
      1,
    );
    const issue = fixture.issues.find((row) => row.id === obligation.issueRef);
    assert.equal(issue.idempotencyKey, computeIssueIdempotencyKey(obligation, fixture.issuePolicy));
    assert.equal(issue.status, "open");
  }
  assertHas(
    mutate((value) => value.issues.pop()),
    "invalid_issue_totality",
  );
  assertHas(
    mutate((value) => value.obligations[0].issueRef = "issue-cli"),
    "invalid_issue_binding",
  );
});

test("issue policy fails closed on destination template fields labels and operations", () => {
  for (const change of [
    (value) => value.issuePolicy.allowedOperations.push("close"),
    (value) => value.issuePolicy.mutableFieldAllowlist.push("body"),
    (value) => value.issuePolicy.approvedRepositoryRefs.pop(),
    (value) => value.issuePolicy.closeAllowed = true,
  ]) {
    assertHas(mutate(change), "invalid_issue_policy");
  }
  assertHas(
    mutate((value) => value.issuePolicy.allowedLabels.push("owner-selected")),
    "invalid_issue_binding",
  );
  assertHas(
    mutate((value) => value.issues[0].destinationRef = "destination-unapproved"),
    "invalid_issue_binding",
  );
  assertHas(
    mutate((value) => value.issueMutations[0].templateRef = "template-unapproved"),
    "invalid_issue_mutation",
  );
});

test("issue mutation intent derives from exact obligation and policy state", () => {
  for (const mutation of fixture.issueMutations) {
    const obligation = fixture.obligations.find((row) => row.id === mutation.obligationRef);
    assert.equal(mutation.obligationRevision, obligation.revision);
    assert.equal(mutation.policyDigest, computeIssuePolicyDigest(fixture.issuePolicy));
    assert.equal(mutation.templateRef, fixture.issuePolicy.templateRef);
    assert.equal(mutation.routeRef, fixture.issuePolicy.routeRef);
    assert.deepEqual(new Set(mutation.labels), new Set(fixture.issuePolicy.allowedLabels));
    for (const field of mutation.mutableFields) {
      const obligationField = field === "obligationState" ? "state" : field;
      assert.equal(mutation.proposedValues[field], obligation[obligationField]);
    }
  }

  const tampered = clone();
  const mutation = tampered.issueMutations.find((row) => row.id === "mutation-api-update");
  mutation.proposedValues.dueAt = "2026-10-02T18:00:00Z";
  mutation.previewDigest = computeIssueMutationPreview(mutation);
  assertHas(tampered, "invalid_issue_mutation");

  const coherent = mutate((value) => {
    value.obligations.find((row) => row.id === "obligation-api").dueAt =
      "2026-10-02T18:00:00Z";
    value.issueMutations.find((row) => row.id === "mutation-api-update").proposedValues.dueAt =
      "2026-10-02T18:00:00Z";
  });
  assertNotHas(coherent, "invalid_issue_mutation");
});

test("owner-authored content conflicts block without a receipt", () => {
  const mutation = fixture.issueMutations.find(
    (row) => row.id === "mutation-api-revision-update",
  );
  assert.equal(mutation.state, "blocked");
  assert.equal(mutation.receiptRef, null);
  assertHas(
    mutate((value) => {
      const row = value.issueMutations.find(
        (item) => item.id === "mutation-api-revision-update",
      );
      row.state = "applied";
      row.receiptRef = "receipt-api-update";
    }),
    "owner_content_overwrite",
  );
  assertHas(
    mutate((value) => value.issueMutations[0].expectedOwnerContentDigest =
      `sha256:${"9".repeat(64)}`),
    "owner_content_overwrite",
  );
});

test("applied and replayed issue mutations require exact external receipts", () => {
  assertHas(
    mutate((value) => value.issueReceipts[0].external = false),
    "invalid_issue_receipt",
  );
  assertHas(
    mutate((value) => value.issueReceipts[0].providerIssueId = "OTHER-1"),
    "invalid_issue_receipt",
  );
  assertHas(
    mutate((value) => value.issueMutations[0].receiptRef = null),
    "invalid_issue_receipt",
  );
  assertNotHas(fixture, "invalid_issue_receipt");
});

test("optimistic concurrency binds the pre-mutation revision and resulting receipt", () => {
  for (const mutation of fixture.issueMutations.filter((row) => row.state === "applied")) {
    const receipt = fixture.issueReceipts.find((row) => row.id === mutation.receiptRef);
    const issue = fixture.issues.find((row) => row.id === mutation.issueRef);
    assert.equal(mutation.expectedIssueRevision, receipt.beforeRevision);
    assert.equal(receipt.afterRevision, issue.revision);
  }
  const replayMutation = fixture.issueMutations.find(
    (row) => row.state === "idempotent-replay",
  );
  const replayReceipt = fixture.issueReceipts.find(
    (row) => row.id === replayMutation.receiptRef,
  );
  const priorReceipt = fixture.issueReceipts.find(
    (row) => row.id === replayReceipt.priorReceiptRef,
  );
  assert.equal(replayMutation.expectedIssueRevision, priorReceipt.beforeRevision);
  assert.equal(replayReceipt.afterRevision, priorReceipt.afterRevision);

  const tampered = clone();
  const mutation = tampered.issueMutations.find((row) => row.id === "mutation-api-update");
  const receipt = tampered.issueReceipts.find((row) => row.id === mutation.receiptRef);
  mutation.expectedIssueRevision = receipt.afterRevision;
  mutation.previewDigest = computeIssueMutationPreview(mutation);
  assertHas(tampered, "invalid_issue_receipt");
});

test("checkpoint seal covers every material issue receipt field", () => {
  const receipt = fixture.issueReceipts.find((row) => row.id === "receipt-api-update");
  const replacements = {
    id: "receipt-api-update-tampered",
    mutationRef: "mutation-cli-create",
    issueRef: "issue-cli",
    operation: "create",
    idempotencyKey: `sha256:${"8".repeat(64)}`,
    providerRequestId: "request-tampered",
    providerIssueId: "ENG-TAMPERED",
    beforeRevision: null,
    afterRevision: `sha256:${"7".repeat(64)}`,
    observedAt: "2026-09-14T18:10:01Z",
    external: false,
    replayed: true,
    priorReceiptRef: "receipt-cli-create-original",
    resultDigest: `sha256:${"6".repeat(64)}`,
  };
  assert.deepEqual(Object.keys(replacements).sort(), Object.keys(receipt).sort());
  for (const [field, replacement] of Object.entries(replacements)) {
    const value = clone();
    value.issueReceipts.find((row) => row.id === receipt.id)[field] = replacement;
    assert.notEqual(computeCheckpointDigest(value), fixture.run.currentCheckpointDigest, field);
    assertHas(value, "invalid_private_handoff");
  }
});

test("receipt replay binds state, original receipt, identical result, and one mutation", () => {
  const replayMutation = fixture.issueMutations.find(
    (row) => row.state === "idempotent-replay",
  );
  const replayReceipt = fixture.issueReceipts.find(
    (row) => row.id === replayMutation.receiptRef,
  );
  const priorReceipt = fixture.issueReceipts.find(
    (row) => row.id === replayReceipt.priorReceiptRef,
  );
  assert.equal(replayReceipt.replayed, true);
  assert.equal(priorReceipt.replayed, false);
  assert.equal(replayReceipt.mutationRef, priorReceipt.mutationRef);
  assert.equal(replayReceipt.idempotencyKey, priorReceipt.idempotencyKey);
  assert.equal(replayReceipt.resultDigest, priorReceipt.resultDigest);
  assert.equal(
    fixture.issueMutations.filter(
      (row) => row.idempotencyKey === replayMutation.idempotencyKey,
    ).length,
    1,
  );

  assertHas(
    mutate((value) => {
      value.issueReceipts.find((row) => row.id === "receipt-api-update").replayed = true;
    }),
    "invalid_issue_receipt",
  );
  assertHas(
    mutate((value) => {
      value.issueReceipts.find((row) => row.id === replayReceipt.id).priorReceiptRef = null;
    }),
    "invalid_issue_receipt",
  );
  assertHas(
    mutate((value) => {
      value.issueReceipts.find((row) => row.id === replayReceipt.id).afterRevision =
        `sha256:${"5".repeat(64)}`;
    }),
    "invalid_issue_receipt",
  );
  assertHas(
    mutate((value) => {
      const duplicate = structuredClone(
        value.issueMutations.find((row) => row.id === replayMutation.id),
      );
      duplicate.id = "mutation-cli-create-duplicate";
      value.issueMutations.push(duplicate);
    }),
    "invalid_issue_mutation",
  );
});

test("SLA within near out and ETA states derive at the exact trusted asOf", () => {
  assertHas(
    mutate((value) => value.obligations[0].dueAt = "2026-09-15T18:00:00Z"),
    "invalid_sla_state",
  );
  assertHas(
    mutate((value) => value.obligations[1].slaState = "within"),
    "invalid_sla_state",
  );
  assertHas(fixture, "invalid_as_of", { asOf: "2026-09-14T20:00:00Z" });
});

test("missing ETA priority near and out state require exact escalation routes", () => {
  assertHas(
    mutate((value) => value.escalations.pop()),
    "invalid_escalation_totality",
  );
  assertHas(
    mutate((value) => value.escalations[0].routeRef = "route-unapproved"),
    "invalid_escalation",
  );
  assertHas(
    mutate((value) => value.escalations[0].approvalEffect = "approved"),
    "invalid_escalation",
  );
});

test("extensions and exceptions require independent scoped expiring authority", () => {
  assertHas(
    mutate((value) => value.extensions[0].authorityRef = "principal-api-owner"),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.exceptions[0].authorityRef =
      "principal-compliance-program-claw"),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.exceptions[0].expiresAt = AS_OF),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.exceptions[0].assetRef = "asset-api"),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.extensions[0].obligationRef = "obligation-service"),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.exceptions[0].obligationRef = "obligation-api"),
    "invalid_scoped_authority",
  );
  assertHas(
    mutate((value) => value.escalations[0].obligationRef = "obligation-api-revision"),
    "invalid_escalation",
  );
});

test("verified remediation is bound and independently authored in chronology", () => {
  assertHas(
    mutate((value) => value.verifications[0].authorRef =
      "principal-remediation-author"),
    "invalid_independent_verification",
  );
  assertHas(
    mutate((value) => value.verifications[0].issueRevision =
      `sha256:${"8".repeat(64)}`, false),
    "invalid_independent_verification",
  );
  assertHas(
    mutate((value) => value.remediationEvidence[0].authoredAt =
      "2026-09-13T18:00:00Z"),
    "invalid_independent_verification",
  );
});

test("self-authored evidence and non-verification records cannot establish closure", () => {
  assertHas(
    mutate((value) => {
      const obligation = value.obligations.find((row) => row.id === "obligation-api");
      obligation.state = "verified";
      obligation.remediationEvidenceRef = "closure-signal-scanner";
      obligation.verificationRef = "closure-signal-check";
    }),
    "invalid_independent_verification",
  );
  assertHas(
    mutate((value) => value.verifications[0].authorRef =
      "principal-compliance-program-claw"),
    "invalid_independent_verification",
  );
});

test("merge checks scanner status and incident recovery retain no closure effect", () => {
  assert.deepEqual(
    new Set(fixture.nonQualifyingClosureSignals.map((row) => row.kind)),
    new Set(["pull-request-merge", "passing-check", "scanner-status", "incident-recovery"]),
  );
  assert.ok(fixture.nonQualifyingClosureSignals.every((row) => row.closureEffect === "none"));
  assertHas(
    mutate((value) => value.nonQualifyingClosureSignals[0].closureEffect = "verified"),
    "invalid_nonqualifying_closure_signal",
  );
});

test("superseding finding revision drives a newly keyed reopen", () => {
  const reopened = fixture.obligations.find((row) => row.state === "reopened");
  const prior = fixture.predecessor.obligations.find(
    (row) => row.obligationRef === reopened.reopenOfObligationRef,
  );
  assert.equal(prior.state, "verified");
  assert.notEqual(prior.obligationKey, reopened.obligationKey);
  assertHas(
    mutate((value) => value.obligations.find((row) => row.state === "reopened").reopenReason =
      null),
    "invalid_revision_reopen",
  );
  assertHas(
    mutate((value) => value.predecessor.obligations.at(-1).state = "open"),
    "invalid_revision_reopen",
  );
});

test("predecessor delta exactly covers the current obligation universe", () => {
  assertHas(
    mutate((value) => value.delta.entries.pop()),
    "invalid_checkpoint_delta",
  );
  assertHas(
    mutate((value) => value.delta.predecessorCheckpointRef = "checkpoint-other"),
    "invalid_checkpoint_delta",
  );
  assertHas(
    mutate((value) => value.delta.entries[0].beforeRevision = null),
    "invalid_checkpoint_delta",
  );
});

test("coverage cannot omit a signal issue asset or obligation", () => {
  for (const field of [
    "snapshotRefs",
    "controlRefs",
    "assetRefs",
    "signalRefs",
    "canonicalFindingRefs",
    "obligationRefs",
    "issueRefs",
  ]) {
    const value = clone();
    value.coverage[field].pop();
    assertHas(value, "invalid_coverage");
  }
});

test("evidence chronology fails closed for future and unknown authors", () => {
  assertHas(
    mutate((value) => value.evidence[0].observedAt = "2026-09-15T00:00:00Z"),
    "invalid_evidence_chronology",
  );
  assertHas(
    mutate((value) => value.evidence[0].authorRef = "principal-unknown"),
    "invalid_evidence_chronology",
  );
});

test("structural authority non-claims and private handoff are mandatory", () => {
  assertHas(
    mutate((value) => value.authority.issueClosure = "claimed"),
    "invalid_authority_claim",
  );
  assertHas(
    mutate((value) => value.handoff.published = true),
    "invalid_private_handoff",
  );
  assertHas(
    mutate((value) => value.handoff.ownerRef = "principal-compliance-program-claw"),
    "invalid_private_handoff",
  );
});

test("prohibited positive authority narrative is detected", () => {
  assertHas(
    mutate((value) => value.evidence[0].sourceUri =
      "controlled://claim/the-agent-closed-the-issue"),
    "prohibited_narrative_claim",
  );
});

test("malformed artifacts return findings instead of throwing", () => {
  for (const value of [
    null,
    [],
    {},
    { schemaVersion: "wrong" },
    { ...clone(), signals: "not-an-array" },
  ]) {
    assert.doesNotThrow(() => findings(value));
    assert.ok(findings(value).length > 0);
  }
});

test("semantic validator is publicly registered with deterministic asOf", () => {
  assert.equal(hasArtifactSemanticValidator("repository-compliance-program-manager"), true);
  assert.deepEqual(
    artifactSemanticValidationOptions("repository-compliance-program-manager"),
    { asOf: AS_OF },
  );
  assert.deepEqual(
    validateArtifactSemantics("repository-compliance-program-manager", fixture, {
      asOf: AS_OF,
    }),
    [],
  );
});

test("X3 template exposes totality issue authority SLA verification and reopen", () => {
  for (const token of [
    "Program identity and source totality",
    "canonical finding",
    "obligation key",
    "idempotency key",
    "owner-content",
    "within/near/out",
    "independent verification",
    "incident-recovery",
    "revision-driven reopen",
    "structural",
    "published: false",
  ]) {
    assert.ok(template.toLowerCase().includes(token.toLowerCase()), token);
  }
});

test("capability contract pins least privilege and lifecycle proof surfaces", () => {
  for (const token of [
    "issue_tracker__create_issue",
    "issue_tracker__update_issue",
    "There is no issue close",
    "dry-run preview",
    "stale-consent rejection",
    "rollback preview",
    "reinstall preview",
    "second removal",
    "It does not contact an issue",
  ]) {
    assert.ok(capabilityContract.includes(token), token);
  }
});

test("public artifact CLI accepts the materialized fixture with exact asOf", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "repository-compliance-program-manager",
      "claws/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});
