import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL(
    "../claws/facilities-operations-coordinator/fixtures/facilities-issue.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/facilities-operations-coordinator/schemas/facilities-issue.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("facilities-operations-coordinator", value).length === 0
  );
}

test("facilities issue fixture keeps assets, work orders, gates, and handoff consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("facilities-operations-coordinator", fixture), []);
});

test("facilities validator is total over schema-valid malformed nested records", () => {
  const malformedAsset = clone();
  malformedAsset.assets.push({});
  assert.equal(validateSchema(malformedAsset), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", malformedAsset));
  assert.equal(isValid(malformedAsset), false);

  const malformedGate = clone();
  malformedGate.gates.push({});
  assert.equal(validateSchema(malformedGate), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", malformedGate));
  assert.equal(isValid(malformedGate), false);

  const malformedEvidence = clone();
  malformedEvidence.evidence.push({});
  assert.equal(validateSchema(malformedEvidence), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", malformedEvidence));
  assert.equal(isValid(malformedEvidence), false);

  // `workOrders` restores this claw's original nested `required` item
  // constraint (id/site/observedAt/observation/priority/state, renamed to
  // match this schema's field names), now extended with asset/completion
  // fields, so a bare `{}` is no longer schema-valid there; exercise the
  // validator's totality instead with every required key present but
  // degenerate-typed.
  const hollowWorkOrder = clone();
  hollowWorkOrder.workOrders.push({
    id: "wo-hollow",
    siteRef: "",
    assetRef: null,
    description: "",
    priority: "",
    status: "",
    observedAt: "",
    completedBy: null,
    completedAt: null,
    completionEvidenceRef: null,
  });
  assert.equal(validateSchema(hollowWorkOrder), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("facilities-operations-coordinator", hollowWorkOrder),
  );
  assert.equal(isValid(hollowWorkOrder), false);
});

test("facilities issue schema restores the original nested work-order required-field constraint", () => {
  // Before checkpoint 2, a facilities issue's id/site/observedAt/observation/
  // priority/state were required by the schema itself (renamed here to
  // id/siteRef/observedAt/description/priority/status). A work order missing
  // any of those must fail schema validation, not merely semantic validation.
  for (const field of ["siteRef", "description", "priority", "status", "observedAt"]) {
    const hollowArtifact = clone();
    const workOrder = {
      id: "wo-hollow", siteRef: "site-north-tower", assetRef: null, description: "d",
      priority: "low", status: "open", observedAt: "2026-01-01", completedBy: null,
      completedAt: null, completionEvidenceRef: null,
    };
    delete workOrder[field];
    hollowArtifact.workOrders.push(workOrder);
    assert.equal(
      validateSchema(hollowArtifact),
      false,
      `expected schema to reject a work order missing "${field}"`,
    );
  }

  // A wholly hollow artifact (missing every top-level required field) must
  // never validate against the schema, ready-state text notwithstanding.
  assert.equal(validateSchema({ handoff: { state: "ready" } }), false);
});

test("facilities validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", malformed));
  const findings = validateArtifactSemantics("facilities-operations-coordinator", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("facilities validator handles a non-array reference list without throwing", () => {
  const malformed = clone();
  malformed.handoff.workOrderRefs = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", malformed));
  const findings = validateArtifactSemantics("facilities-operations-coordinator", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_reference_list"));
});

test("facilities validator fails closed on a matching-length object masquerading as a reference list", () => {
  const fakeArray = clone();
  fakeArray.handoff.workOrderRefs = { length: 2 };
  assert.equal(validateSchema(fakeArray), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("facilities-operations-coordinator", fakeArray));
  assert.equal(isValid(fakeArray), false);
});

test("facilities validator rejects an asset or work order assigned to another site", () => {
  const crossSiteWorkOrder = clone();
  crossSiteWorkOrder.workOrders.find((item) => item.id === "wo-chiller-2-noise").assetRef =
    "asset-south-badge-reader-lobby";
  assert.equal(isValid(crossSiteWorkOrder), false);
  const findings = validateArtifactSemantics("facilities-operations-coordinator", crossSiteWorkOrder);
  assert.ok(findings.some((item) => item.code === "inconsistent_asset_site"));
});

test("facilities validator rejects a work order marked complete without grounding evidence", () => {
  const statusToggle = clone();
  statusToggle.workOrders.find((item) => item.id === "wo-badge-reader-offline").status = "complete";
  assert.equal(isValid(statusToggle), false);
  const findings = validateArtifactSemantics("facilities-operations-coordinator", statusToggle);
  assert.ok(findings.some((item) => item.code === "unverified_work_order_completion"));

  // Removing the one qualifying evidence record for an already-verified work
  // order must re-open the completion, not silently keep it verified.
  const evidenceRemoved = clone();
  evidenceRemoved.evidence = evidenceRemoved.evidence.filter(
    (item) => item.id !== "evidence-chiller-2-vendor-report",
  );
  assert.equal(isValid(evidenceRemoved), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", evidenceRemoved).some(
      (item) => item.code === "unverified_work_order_completion",
    ),
  );
});

test("facilities validator fails closed on an unknown work order status", () => {
  const unknownStatus = clone();
  unknownStatus.workOrders.find((item) => item.id === "wo-badge-reader-offline").status = "closed";
  assert.equal(validateSchema(unknownStatus), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownStatus), false);
  const findings = validateArtifactSemantics("facilities-operations-coordinator", unknownStatus);
  assert.ok(findings.some((item) => item.code === "invalid_work_order_status"));
});

test("facilities validator rejects agent, assistant, and self-attested gate approvers", () => {
  const agentApprover = clone();
  agentApprover.gates.find((item) => item.id === "gate-safety-north-tower").approvedBy = "the bot";
  assert.equal(isValid(agentApprover), false);

  const selfApprover = clone();
  selfApprover.gates.find((item) => item.id === "gate-safety-north-tower").approvedBy =
    "Facilities Operations Coordinator";
  assert.equal(isValid(selfApprover), false);

  const legitimateApprover = clone();
  legitimateApprover.gates.find((item) => item.id === "gate-safety-north-tower").approvedBy =
    "Regional Fire Marshal";
  assert.equal(
    isValid(legitimateApprover),
    true,
    JSON.stringify(validateArtifactSemantics("facilities-operations-coordinator", legitimateApprover)),
  );
});

test("facilities validator rejects a gate cleared without grounding evidence of the matching kind", () => {
  const ungroundedClearance = clone();
  const gate = ungroundedClearance.gates.find((item) => item.id === "gate-safety-north-tower");
  gate.evidenceRefs = ["evidence-north-tower-fire-inspection"]; // site-kind evidence, not work-order-kind
  assert.equal(isValid(ungroundedClearance), false);
  const findings = validateArtifactSemantics("facilities-operations-coordinator", ungroundedClearance);
  assert.ok(findings.some((item) => item.code === "self_attested_gate_clearance"));
});

test("facilities validator rejects a gate whose scope resolves to the wrong site or work order", () => {
  // gate-safety-north-tower is scoped to wo-chiller-2-noise; pointing its
  // scope at a different, real work order in another site must not let its
  // matching-kind evidence silently ground an unrelated site's gate.
  const crossWorkOrderScope = clone();
  const gate = crossWorkOrderScope.gates.find((item) => item.id === "gate-safety-north-tower");
  gate.scopeRef = "wo-badge-reader-offline";
  assert.equal(isValid(crossWorkOrderScope), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", crossWorkOrderScope).some(
      (item) => item.code === "self_attested_gate_clearance",
    ),
  );

  // A gate's scopeKind must match the scope kind implied by its own gate
  // kind; a "site"-scoped safety gate (which requires work-order evidence)
  // must fail closed even though "site-north-tower" is a perfectly real id.
  const wrongScopeKind = clone();
  const gate2 = wrongScopeKind.gates.find((item) => item.id === "gate-safety-north-tower");
  gate2.scopeKind = "site";
  gate2.scopeRef = "site-north-tower";
  assert.equal(isValid(wrongScopeKind), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", wrongScopeKind).some(
      (item) => item.code === "invalid_gate_scope",
    ),
  );

  // A dangling scopeRef must also fail closed, even for an otherwise
  // unresolved (not "cleared") gate.
  const danglingScope = clone();
  const gate3 = danglingScope.gates.find((item) => item.id === "gate-vendor-south-annex");
  gate3.scopeRef = "asset-does-not-exist";
  assert.equal(isValid(danglingScope), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", danglingScope).some(
      (item) => item.code === "invalid_gate_scope",
    ),
  );
});

test("facilities validator rejects a fabricated or narrative evidence source and an unrecognized evidence assertion", () => {
  const fakeSource = clone();
  fakeSource.evidence.find((item) => item.id === "evidence-chiller-2-vendor-report").sourceRef =
    "I saw the technician fix it myself.";
  assert.equal(isValid(fakeSource), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", fakeSource).some(
      (item) => item.code === "untrusted_evidence_source",
    ),
  );

  const unknownAssertion = clone();
  unknownAssertion.evidence.find((item) => item.id === "evidence-chiller-2-vendor-report").assertion =
    "confirmation";
  assert.equal(isValid(unknownAssertion), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", unknownAssertion).some(
      (item) => item.code === "invalid_evidence_assertion",
    ),
  );
});

test("facilities validator rejects an unparseable or premature gate approval and work order completion timestamp", () => {
  const badApprovalTimestamp = clone();
  badApprovalTimestamp.gates.find((item) => item.id === "gate-safety-north-tower").approvedAt =
    "not-a-real-timestamp";
  assert.equal(isValid(badApprovalTimestamp), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", badApprovalTimestamp).some(
      (item) => item.code === "self_attested_gate_clearance",
    ),
  );

  // The approval predates when the scoped work order was even observed.
  const prematureApproval = clone();
  prematureApproval.gates.find((item) => item.id === "gate-safety-north-tower").approvedAt =
    "2026-08-01"; // wo-chiller-2-noise was observed 2026-08-25
  assert.equal(isValid(prematureApproval), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", prematureApproval).some(
      (item) => item.code === "self_attested_gate_clearance",
    ),
  );

  const badCompletionTimestamp = clone();
  badCompletionTimestamp.workOrders.find((item) => item.id === "wo-chiller-2-noise").completedAt =
    "not-a-real-timestamp";
  assert.equal(isValid(badCompletionTimestamp), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", badCompletionTimestamp).some(
      (item) => item.code === "unverified_work_order_completion",
    ),
  );

  // The completion predates when the issue was even observed.
  const prematureCompletion = clone();
  prematureCompletion.workOrders.find((item) => item.id === "wo-chiller-2-noise").completedAt =
    "2026-08-01"; // observedAt is 2026-08-25
  assert.equal(isValid(prematureCompletion), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", prematureCompletion).some(
      (item) => item.code === "unverified_work_order_completion",
    ),
  );

  // A self-attested or agent completer must also be rejected even with a
  // valid timestamp and grounding evidence reference.
  const selfCompleter = clone();
  selfCompleter.workOrders.find((item) => item.id === "wo-chiller-2-noise").completedBy =
    "Facilities Operations Coordinator";
  assert.equal(isValid(selfCompleter), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", selfCompleter).some(
      (item) => item.code === "unverified_work_order_completion",
    ),
  );
});

test("facilities validator requires every evidence record to carry its own parseable assertedAt and rejects an old site-gate approval that predates it", () => {
  const missingAssertedAt = clone();
  const evidenceEntry = missingAssertedAt.evidence.find(
    (item) => item.id === "evidence-north-tower-fire-inspection",
  );
  delete evidenceEntry.assertedAt;
  assert.equal(validateSchema(missingAssertedAt), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingAssertedAt), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", missingAssertedAt).some(
      (item) => item.code === "invalid_evidence_timestamp",
    ),
  );

  const blankAssertedAt = clone();
  blankAssertedAt.evidence.find(
    (item) => item.id === "evidence-north-tower-fire-inspection",
  ).assertedAt = "   ";
  assert.equal(isValid(blankAssertedAt), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", blankAssertedAt).some(
      (item) => item.code === "invalid_evidence_timestamp",
    ),
  );

  // The site-gate approval itself is otherwise perfectly valid, but its only
  // grounding evidence was not asserted until after the approval date: an
  // "old" (already-recorded) approval cannot be retroactively justified by
  // evidence that did not exist yet when it was granted.
  const oldApprovalNewEvidence = clone();
  oldApprovalNewEvidence.evidence.find(
    (item) => item.id === "evidence-north-tower-fire-inspection",
  ).assertedAt = "2026-08-20"; // gate-permit-north-tower was approved 2026-08-15
  assert.equal(isValid(oldApprovalNewEvidence), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", oldApprovalNewEvidence).some(
      (item) => item.code === "self_attested_gate_clearance",
    ),
  );
});

test("facilities validator requires every work order's observedAt to be a parseable timestamp", () => {
  const badObservedAt = clone();
  badObservedAt.workOrders.find((item) => item.id === "wo-chiller-2-noise").observedAt =
    "not-a-real-timestamp";
  assert.equal(validateSchema(badObservedAt), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(badObservedAt), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", badObservedAt).some(
      (item) => item.code === "invalid_timestamp",
    ),
  );
});

test("facilities validator requires a named, non-agent, non-self portfolio and handoff owner", () => {
  const blankOwner = clone();
  blankOwner.handoff.owner = "";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const agentOwner = clone();
  agentOwner.portfolio.ownerId = "system account";
  assert.equal(isValid(agentOwner), false);

  const selfOwner = clone();
  selfOwner.handoff.owner = "Facilities Operations Coordinator";
  assert.equal(isValid(selfOwner), false);
});

test("facilities validator blocks a ready state until every work order and gate is resolved", () => {
  const readyAttempt = clone();
  const secondWorkOrder = readyAttempt.workOrders.find((item) => item.id === "wo-badge-reader-offline");
  readyAttempt.evidence.push({
    id: "evidence-badge-reader-vendor-completion",
    kind: "work-order",
    refId: "wo-badge-reader-offline",
    sourceRef: "controlled://facilities-evidence/hq-campus/badge-reader-vendor-completion-2026-09-05",
    note: "Access-control vendor confirmed the badge reader now authorizes valid credentials.",
    assertion: "completion",
    assertedAt: "2026-09-05",
  });
  Object.assign(secondWorkOrder, {
    status: "complete",
    completedBy: "Access-Control Vendor Field Technician",
    completedAt: "2026-09-05",
    completionEvidenceRef: "evidence-badge-reader-vendor-completion",
  });
  const vendorGate = readyAttempt.gates.find((item) => item.id === "gate-vendor-south-annex");
  vendorGate.status = "cleared";
  vendorGate.approvedBy = "owner-facilities-safety-lead";
  vendorGate.approvedAt = "2026-09-05";
  readyAttempt.handoff.state = "ready";
  readyAttempt.handoff.unresolvedWorkOrderRefs = [];
  readyAttempt.handoff.unresolvedGateRefs = [];
  assert.equal(
    isValid(readyAttempt),
    true,
    JSON.stringify(validateArtifactSemantics("facilities-operations-coordinator", readyAttempt)),
  );

  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(isValid(prematureReady), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", prematureReady).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("facilities validator requires the full prohibited-action gate list and rejects narrative bypass claims", () => {
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "dispatch-technician",
  );
  assert.equal(isValid(missingGate), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", missingGate).some(
      (item) => item.code === "missing_authority_gate",
    ),
  );

  const narrativeBypass = clone();
  narrativeBypass.handoff.summary = "We dispatched a technician to unlock the space this morning.";
  assert.equal(isValid(narrativeBypass), false);
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", narrativeBypass).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
  );

  const negatedNarrative = clone();
  negatedNarrative.handoff.summary = "We have not dispatched a technician and will not without approval.";
  assert.equal(
    validateArtifactSemantics("facilities-operations-coordinator", negatedNarrative).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
    false,
  );
});

test("validate-artifact CLI accepts the packaged facilities-operations-coordinator fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "facilities-operations-coordinator", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready facilities artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `facilities-operations-coordinator-cli-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "facilities-operations-coordinator", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_ready_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});

// A HEAD-authored artifact predating the portfolio contract: the exact
// pre-checkpoint-2 single-issue shape (id/site/observedAt/observation/
// priority/state, all bare strings, no portfolio/sites/workOrders/etc.).
const legacyFacilitiesIssue = {
  id: "issue-legacy-001",
  site: "hq-building-a",
  observedAt: "2026-08-20",
  observation: "Water intrusion reported near loading dock door 3 after overnight storms.",
  priority: "high",
  state: "open",
};

test("facilities schema preserves the original HEAD legacy single-issue shape as a distinct oneOf branch", () => {
  assert.equal(validateSchema(legacyFacilitiesIssue), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(
    validateArtifactSemantics("facilities-operations-coordinator", legacyFacilitiesIssue),
    [],
  );

  // The current portfolio fixture must never be mistaken for the legacy
  // shape, and vice versa: the two oneOf branches cannot ambiguously
  // overlap. A document combining every legacy field with a "schemaVersion"
  // marker must be rejected by the legacy branch (which forbids
  // schemaVersion) and still needs the full portfolio required-field set to
  // pass the portfolio branch, so it fails oneOf overall rather than
  // matching two schemas at once.
  const bothShapesAtOnce = { ...legacyFacilitiesIssue, schemaVersion: "awesomeClaws.facilitiesIssue.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), false);

  // Missing any one legacy field must fail the legacy branch; since it also
  // lacks every portfolio field, it must fail schema validation entirely.
  for (const field of Object.keys(legacyFacilitiesIssue)) {
    const incomplete = { ...legacyFacilitiesIssue };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("facilities validator applies bounded legacy semantics without requiring portfolio-only fields", () => {
  const blankField = { ...legacyFacilitiesIssue, observation: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const unparseableObservedAt = { ...legacyFacilitiesIssue, observedAt: "not-a-real-timestamp" };
  assert.equal(validateSchema(unparseableObservedAt), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", unparseableObservedAt).some(
      (item) => item.code === "invalid_timestamp",
    ),
  );

  const unknownState = { ...legacyFacilitiesIssue, state: "archived" };
  assert.equal(validateSchema(unknownState), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("facilities-operations-coordinator", unknownState).some(
      (item) => item.code === "invalid_legacy_state",
    ),
  );

  // A fully-formed legacy artifact must not be flagged for missing any of
  // the portfolio-only fields (sites/assets/workOrders/gates/handoff/etc.).
  assert.deepEqual(
    validateArtifactSemantics("facilities-operations-coordinator", legacyFacilitiesIssue),
    [],
  );
});

test("validate-artifact CLI accepts an exact HEAD legacy facilities issue artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `facilities-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyFacilitiesIssue, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "facilities-operations-coordinator", scratchPath],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.deepEqual(output.schemaErrors, []);
    assert.deepEqual(output.semanticFindings, []);
  } finally {
    await rm(scratchPath, { force: true });
  }
});
