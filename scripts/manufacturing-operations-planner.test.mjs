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
    "../claws/manufacturing-operations-planner/fixtures/production-plan.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/manufacturing-operations-planner/schemas/production-plan.schema.json",
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
    validateArtifactSemantics("manufacturing-operations-planner", value).length === 0
  );
}

test("production plan fixture keeps schedule, constraint, and handoff data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("manufacturing-operations-planner", fixture), []);
});

test("manufacturing validator is total over schema-valid malformed nested records", () => {
  const malformedScheduleEntry = clone();
  malformedScheduleEntry.scheduleEntries.push({});
  assert.equal(validateSchema(malformedScheduleEntry), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("manufacturing-operations-planner", malformedScheduleEntry),
  );
  assert.equal(isValid(malformedScheduleEntry), false);

  const malformedConstraint = clone();
  malformedConstraint.constraints.push({});
  assert.equal(validateSchema(malformedConstraint), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("manufacturing-operations-planner", malformedConstraint),
  );
  assert.equal(isValid(malformedConstraint), false);

  const malformedException = clone();
  malformedException.exceptions.push({});
  assert.equal(validateSchema(malformedException), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("manufacturing-operations-planner", malformedException),
  );
  assert.equal(isValid(malformedException), false);
});

test("manufacturing validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("manufacturing-operations-planner", malformed));
  const findings = validateArtifactSemantics("manufacturing-operations-planner", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("manufacturing validator handles a non-array reference list without throwing", () => {
  const malformed = clone();
  malformed.handoff.scheduleRefs = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("manufacturing-operations-planner", malformed));
  const findings = validateArtifactSemantics("manufacturing-operations-planner", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_reference_list"));
});

test("manufacturing validator fails closed on a matching-length object masquerading as a reference list", () => {
  const fakeArray = clone();
  fakeArray.handoff.scheduleRefs = { length: 3 };
  assert.equal(validateSchema(fakeArray), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("manufacturing-operations-planner", fakeArray));
  assert.equal(isValid(fakeArray), false);
});

test("manufacturing validator rejects a schedule entry whose capacity slot belongs to another line", () => {
  const crossLineEntry = clone();
  crossLineEntry.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").capacitySlotRef =
    "capacity-line4-2026-09-12";
  assert.equal(isValid(crossLineEntry), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", crossLineEntry);
  assert.ok(findings.some((item) => item.code === "inconsistent_capacity_line"));
});

test("manufacturing validator rejects a schedule entry whose quantity exceeds capacity", () => {
  const overCapacity = clone();
  overCapacity.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").quantity = 5000;
  assert.equal(isValid(overCapacity), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", overCapacity);
  assert.ok(findings.some((item) => item.code === "capacity_exceeded"));
});

test("manufacturing validator rejects a released schedule entry when the plan itself is not released", () => {
  const unauthorizedRelease = clone();
  unauthorizedRelease.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").state =
    "released";
  assert.equal(isValid(unauthorizedRelease), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", unauthorizedRelease);
  assert.ok(findings.some((item) => item.code === "unauthorized_release"));
});

test("manufacturing validator rejects a released schedule entry blocked by an unresolved constraint on its own line", () => {
  const releasedPlan = clone();
  releasedPlan.state = "released";
  releasedPlan.scheduleEntries.find((item) => item.id === "schedule-sku-5820-day1").state = "released";
  // constraint-line4-quality-hold is scoped to line-4-packaging and remains open.
  assert.equal(isValid(releasedPlan), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", releasedPlan);
  assert.ok(findings.some((item) => item.code === "unauthorized_release"));

  // The other line's constraints are already resolved, so releasing that
  // line's already-released-plan entry must be authorized.
  releasedPlan.scheduleEntries.find((item) => item.id === "schedule-sku-5820-day1").state = "proposed";
  releasedPlan.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").state = "released";
  releasedPlan.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day2").state = "released";
  releasedPlan.handoff.state = "blocked"; // line 4's exception/constraint still unresolved
  assert.equal(
    isValid(releasedPlan),
    true,
    JSON.stringify(validateArtifactSemantics("manufacturing-operations-planner", releasedPlan)),
  );
});

test("manufacturing validator rejects a constraint cleared without grounding evidence for the same constraint, and requires disqualifying enum totality", () => {
  const selfClearedConstraint = clone();
  const constraint = selfClearedConstraint.constraints.find(
    (item) => item.id === "constraint-line4-quality-hold",
  );
  constraint.status = "cleared";
  constraint.clearedBy = "owner-quality-lead";
  constraint.clearedAt = "2026-09-10";
  constraint.evidenceRefs = []; // no grounding evidence cited for the clearance itself
  assert.equal(isValid(selfClearedConstraint), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", selfClearedConstraint).some(
      (item) => item.code === "self_attested_constraint_clearance",
    ),
  );

  const unknownKind = clone();
  unknownKind.constraints.find((item) => item.id === "constraint-line3-material").kind = "budget";
  assert.equal(validateSchema(unknownKind), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownKind), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", unknownKind).some(
      (item) => item.code === "invalid_constraint_kind",
    ),
  );
});

test("manufacturing validator rejects agent, assistant, and self-attested constraint clearance identities", () => {
  const constraint = () => ({
    id: "constraint-adhoc",
    kind: "material",
    scope: "line-3-assembly",
    status: "cleared",
    evidenceRefs: ["evidence-adhoc"],
    clearedBy: "the system",
    clearedAt: "2026-09-09",
  });
  const agentClearer = clone();
  agentClearer.constraints.push(constraint());
  agentClearer.evidence.push({
    id: "evidence-adhoc",
    kind: "material",
    refId: "constraint-adhoc",
    sourceRef: "controlled://manufacturing-evidence/adhoc",
    note: "Ad hoc material check.",
  });
  assert.equal(isValid(agentClearer), false);

  const selfClearer = clone(agentClearer);
  selfClearer.constraints.find((item) => item.id === "constraint-adhoc").clearedBy =
    "Manufacturing Operations Planner";
  assert.equal(isValid(selfClearer), false);
});

test("manufacturing validator requires every exception to name a non-agent, non-self owner regardless of status", () => {
  const blankOwner = clone();
  blankOwner.exceptions.find((item) => item.id === "exception-line4-packaging-film").ownerId = "";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const agentOwner = clone();
  agentOwner.exceptions.find((item) => item.id === "exception-line4-packaging-film").ownerId = "an agent";
  assert.equal(isValid(agentOwner), false);

  const resolvedWithoutTimestamp = clone();
  const exception = resolvedWithoutTimestamp.exceptions.find(
    (item) => item.id === "exception-line4-packaging-film",
  );
  exception.status = "resolved";
  exception.resolvedAt = null;
  assert.equal(isValid(resolvedWithoutTimestamp), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", resolvedWithoutTimestamp).some(
      (item) => item.code === "incomplete_exception_resolution",
    ),
  );
});

test("manufacturing validator requires a named, non-agent, non-self plan and handoff owner", () => {
  const blankOwner = clone();
  blankOwner.handoff.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const agentOwner = clone();
  agentOwner.planOwnerId = "assistant";
  assert.equal(isValid(agentOwner), false);

  const selfOwner = clone();
  selfOwner.handoff.owner = "Manufacturing Operations Planner";
  assert.equal(isValid(selfOwner), false);
});

test("manufacturing validator requires exactly one score-equivalent clearance per unresolved constraint before readiness, and blocks a premature ready state", () => {
  const readyAttempt = clone();
  const constraint = readyAttempt.constraints.find((item) => item.id === "constraint-line4-quality-hold");
  constraint.status = "cleared";
  constraint.clearedBy = "owner-quality-lead";
  constraint.clearedAt = "2026-09-10";
  // The constraint's existing evidence record was an "observation" (the hold
  // notice itself); it must be replaced with a genuine clearance assertion
  // before the constraint can be validly cleared.
  readyAttempt.evidence.find((item) => item.id === "evidence-line4-quality-hold-notice").assertion =
    "clearance";
  readyAttempt.evidence.find((item) => item.id === "evidence-line4-quality-hold-notice").assertedAt =
    "2026-09-10";
  const exception = readyAttempt.exceptions.find((item) => item.id === "exception-line4-packaging-film");
  exception.status = "resolved";
  exception.resolvedBy = "owner-quality-engineer";
  exception.resolvedAt = "2026-09-10";
  exception.resolutionEvidenceRef = "evidence-line4-exception-resolution";
  readyAttempt.evidence.push({
    id: "evidence-line4-exception-resolution",
    kind: "quality",
    refId: "exception-line4-packaging-film",
    sourceRef: "controlled://manufacturing-evidence/line4-week37/exception-resolution-2026-09-10",
    note: "Approved substitute packaging film qualified and released for use.",
    assertion: "clearance",
    assertedAt: "2026-09-10",
  });
  readyAttempt.handoff.state = "ready";
  readyAttempt.handoff.unresolvedConstraintRefs = [];
  readyAttempt.handoff.unresolvedExceptionRefs = [];
  assert.equal(
    isValid(readyAttempt),
    true,
    JSON.stringify(validateArtifactSemantics("manufacturing-operations-planner", readyAttempt)),
  );

  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(isValid(prematureReady), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", prematureReady).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("manufacturing validator requires the full prohibited-action gate list and rejects narrative bypass claims", () => {
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "release-work-order",
  );
  assert.equal(isValid(missingGate), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", missingGate).some(
      (item) => item.code === "missing_authority_gate",
    ),
  );

  const narrativeBypass = clone();
  narrativeBypass.handoff.summary = "We released the work order early to keep the line moving.";
  assert.equal(isValid(narrativeBypass), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", narrativeBypass).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
  );

  const negatedNarrative = clone();
  negatedNarrative.handoff.summary = "We have not released the work order and will not without approval.";
  assert.equal(
    validateArtifactSemantics("manufacturing-operations-planner", negatedNarrative).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
    false,
  );
});

test("production plan schema restores the original literal state enum", () => {
  const invalidState = clone();
  invalidState.state = "in-progress";
  assert.equal(validateSchema(invalidState), false, "an unsupported plan state must fail schema validation");
  assert.ok(validateSchema.errors.some((error) => error.instancePath === "/state"));

  const hollow = { schemaVersion: "awesomeClaws.productionPlan.v1" };
  assert.equal(validateSchema(hollow), false, "a hollow artifact missing every required field must fail schema");
});

test("manufacturing validator rejects an open-hold notice reused as its own clearance evidence", () => {
  const selfClearingNotice = clone();
  const constraint = selfClearingNotice.constraints.find(
    (item) => item.id === "constraint-line4-quality-hold",
  );
  constraint.status = "cleared";
  constraint.clearedBy = "owner-quality-lead";
  constraint.clearedAt = "2026-09-10";
  // The only cited evidence is still the original "observation" hold notice;
  // it was never re-asserted as a clearance, so it can never clear itself.
  assert.equal(isValid(selfClearingNotice), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", selfClearingNotice).some(
      (item) => item.code === "self_attested_constraint_clearance",
    ),
  );

  const lateAssertion = clone();
  const lateConstraint = lateAssertion.constraints.find(
    (item) => item.id === "constraint-line4-quality-hold",
  );
  lateConstraint.status = "cleared";
  lateConstraint.clearedBy = "owner-quality-lead";
  lateConstraint.clearedAt = "2026-09-09";
  const lateEvidence = lateAssertion.evidence.find(
    (item) => item.id === "evidence-line4-quality-hold-notice",
  );
  lateEvidence.assertion = "clearance";
  lateEvidence.assertedAt = "2026-09-11"; // asserted after the claimed clearance timestamp
  assert.equal(isValid(lateAssertion), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", lateAssertion).some(
      (item) => item.code === "self_attested_constraint_clearance",
    ),
  );
});

test("manufacturing validator requires exception resolution to be grounded in matching clearance evidence with sound chronology", () => {
  const ungroundedResolution = clone();
  const exception = ungroundedResolution.exceptions.find(
    (item) => item.id === "exception-line4-packaging-film",
  );
  exception.status = "resolved";
  exception.resolvedBy = "owner-quality-engineer";
  exception.resolvedAt = "2026-09-10";
  exception.resolutionEvidenceRef = null; // no grounding evidence cited at all
  assert.equal(isValid(ungroundedResolution), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", ungroundedResolution).some(
      (item) => item.code === "incomplete_exception_resolution",
    ),
  );

  const lateGroundedResolution = clone();
  const lateException = lateGroundedResolution.exceptions.find(
    (item) => item.id === "exception-line4-packaging-film",
  );
  lateException.status = "resolved";
  lateException.resolvedBy = "owner-quality-engineer";
  lateException.resolvedAt = "2026-09-10";
  lateException.resolutionEvidenceRef = "evidence-line4-exception-resolution";
  lateGroundedResolution.evidence.push({
    id: "evidence-line4-exception-resolution",
    kind: "quality",
    refId: "exception-line4-packaging-film",
    sourceRef: "controlled://manufacturing-evidence/line4-week37/exception-resolution-2026-09-10",
    note: "Substitute film qualified.",
    assertion: "clearance",
    assertedAt: "2026-09-11", // asserted after the claimed resolution timestamp
  });
  assert.equal(isValid(lateGroundedResolution), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", lateGroundedResolution).some(
      (item) => item.code === "incomplete_exception_resolution",
    ),
  );

  const selfResolver = clone();
  const selfException = selfResolver.exceptions.find(
    (item) => item.id === "exception-line4-packaging-film",
  );
  selfException.status = "resolved";
  selfException.resolvedBy = "the assistant";
  selfException.resolvedAt = "2026-09-10";
  selfException.resolutionEvidenceRef = "evidence-line4-exception-resolution";
  selfResolver.evidence.push({
    id: "evidence-line4-exception-resolution",
    kind: "quality",
    refId: "exception-line4-packaging-film",
    sourceRef: "controlled://manufacturing-evidence/line4-week37/exception-resolution-2026-09-10",
    note: "Substitute film qualified.",
    assertion: "clearance",
    assertedAt: "2026-09-10",
  });
  assert.equal(isValid(selfResolver), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", selfResolver).some(
      (item) => item.code === "incomplete_exception_resolution",
    ),
  );
});

test("manufacturing validator aggregates schedule quantities across multiple entries against a shared capacity slot", () => {
  const overCommittedSlot = clone();
  // Neither entry alone exceeds the 2200-unit slot, but together they do.
  overCommittedSlot.scheduleEntries.push({
    id: "schedule-sku-4410-day1-extra",
    demandRef: "demand-sku-4410-w37",
    lineRef: "line-3-assembly",
    capacitySlotRef: "capacity-line3-2026-09-10",
    quantity: 500,
    state: "proposed",
  });
  assert.equal(validateSchema(overCommittedSlot), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(overCommittedSlot), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", overCommittedSlot);
  assert.ok(findings.some((item) => item.code === "capacity_exceeded"));
});

test("manufacturing validator rejects a cloned schedule entry that double-counts against capacity and demand", () => {
  const clonedEntry = clone();
  const original = clonedEntry.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1");
  clonedEntry.scheduleEntries.push({ ...original, id: "schedule-sku-4410-day1-clone" });
  assert.equal(validateSchema(clonedEntry), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(clonedEntry), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", clonedEntry);
  assert.ok(findings.some((item) => item.code === "capacity_exceeded"));
  assert.ok(findings.some((item) => item.code === "demand_overscheduled"));
});

test("manufacturing validator enforces demand fulfillment mode and rejects unknown modes", () => {
  const overscheduledExact = clone();
  overscheduledExact.scheduleEntries.push({
    id: "schedule-sku-5820-extra",
    demandRef: "demand-sku-5820-w37",
    lineRef: "line-4-packaging",
    capacitySlotRef: "capacity-line4-2026-09-12",
    quantity: 1, // pushes the exact-mode order's total past its exact demand
    state: "proposed",
  });
  assert.equal(isValid(overscheduledExact), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", overscheduledExact).some(
      (item) => item.code === "demand_overscheduled",
    ),
  );

  const partialModeUnderfilled = clone();
  partialModeUnderfilled.orders.find((item) => item.id === "demand-sku-5820-w37").fulfillmentMode =
    "partial";
  partialModeUnderfilled.scheduleEntries.find((item) => item.id === "schedule-sku-5820-day1").quantity = 1200;
  // Partial fulfillment permits scheduling less than the full demand quantity.
  assert.equal(
    validateArtifactSemantics("manufacturing-operations-planner", partialModeUnderfilled).some(
      (item) => item.code === "demand_overscheduled",
    ),
    false,
  );

  const unknownMode = clone();
  unknownMode.orders.find((item) => item.id === "demand-sku-5820-w37").fulfillmentMode = "flexible";
  assert.equal(validateSchema(unknownMode), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownMode), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", unknownMode).some(
      (item) => item.code === "invalid_fulfillment_mode",
    ),
  );
});

test("manufacturing validator tolerates floating-point summation noise for exact demand totals and aggregate capacity, but rejects material overage", () => {
  // Two schedule entries summing via ordinary IEEE-754 addition
  // (0.1 + 0.2 -> 0.30000000000000004) must not spuriously exceed an exact
  // 0.3-unit demand order or a 0.3-unit capacity limit that draws on the
  // very same aggregated total.
  assert.notEqual(0.1 + 0.2, 0.3, "this test relies on real IEEE-754 rounding noise");
  const fractionalNoOverage = clone();
  const order = fractionalNoOverage.orders.find((item) => item.id === "demand-sku-5820-w37");
  order.quantity = 0.3;
  order.fulfillmentMode = "exact";
  const slot = fractionalNoOverage.capacitySlots.find((item) => item.id === "capacity-line4-2026-09-12");
  slot.availableUnits = 0.3;
  fractionalNoOverage.scheduleEntries.find((item) => item.id === "schedule-sku-5820-day1").quantity = 0.1;
  fractionalNoOverage.scheduleEntries.push({
    id: "schedule-sku-5820-day1-fraction",
    demandRef: "demand-sku-5820-w37",
    lineRef: "line-4-packaging",
    capacitySlotRef: "capacity-line4-2026-09-12",
    quantity: 0.2,
    state: "proposed",
  });
  fractionalNoOverage.handoff.scheduleRefs.push("schedule-sku-5820-day1-fraction");
  assert.equal(validateSchema(fractionalNoOverage), true, JSON.stringify(validateSchema.errors));
  const noiseFindings = validateArtifactSemantics("manufacturing-operations-planner", fractionalNoOverage);
  assert.ok(!noiseFindings.some((item) => item.code === "capacity_exceeded"), JSON.stringify(noiseFindings));
  assert.ok(!noiseFindings.some((item) => item.code === "demand_overscheduled"), JSON.stringify(noiseFindings));

  // A genuinely material overage (0.1 + 0.21 = 0.31, well outside the
  // floating-point noise band of a 0.3 limit) must still be rejected on
  // both the capacity and the exact-demand front.
  const materialOverage = clone(fractionalNoOverage);
  materialOverage.scheduleEntries.find(
    (item) => item.id === "schedule-sku-5820-day1-fraction",
  ).quantity = 0.21;
  assert.equal(validateSchema(materialOverage), true, JSON.stringify(validateSchema.errors));
  const overageFindings = validateArtifactSemantics("manufacturing-operations-planner", materialOverage);
  assert.ok(overageFindings.some((item) => item.code === "capacity_exceeded"));
  assert.ok(overageFindings.some((item) => item.code === "demand_overscheduled"));

  // Partial fulfillment's overscheduling check must apply the same
  // tolerance: noise-level overage on an otherwise-partial order must not
  // trip demand_overscheduled either.
  const partialFractionalNoOverage = clone(fractionalNoOverage);
  partialFractionalNoOverage.orders.find((item) => item.id === "demand-sku-5820-w37").fulfillmentMode =
    "partial";
  const partialFindings = validateArtifactSemantics(
    "manufacturing-operations-planner",
    partialFractionalNoOverage,
  );
  assert.ok(!partialFindings.some((item) => item.code === "demand_overscheduled"), JSON.stringify(partialFindings));
});

test("manufacturing validator flags a non-numeric schedule entry quantity without throwing", () => {
  const nonNumericQuantity = clone();
  nonNumericQuantity.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").quantity =
    "a lot";
  assert.equal(validateSchema(nonNumericQuantity), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("manufacturing-operations-planner", nonNumericQuantity),
  );
  assert.equal(isValid(nonNumericQuantity), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", nonNumericQuantity);
  assert.ok(findings.some((item) => item.code === "invalid_schedule_quantity"));
});

test("manufacturing validator requires evidence to name a supported assertion kind", () => {
  const invalidAssertion = clone();
  invalidAssertion.evidence.find(
    (item) => item.id === "evidence-line3-material-receipt",
  ).assertion = "hearsay";
  assert.equal(validateSchema(invalidAssertion), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(invalidAssertion), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", invalidAssertion);
  assert.ok(findings.some((item) => item.code === "invalid_evidence_assertion"));
});

test("manufacturing validator requires every evidence record to carry a controlled, attributable source reference", () => {
  const fabricatedSource = clone();
  fabricatedSource.evidence.find(
    (item) => item.id === "evidence-line3-material-receipt",
  ).sourceRef = "trust me, the component lot arrived";
  assert.equal(validateSchema(fabricatedSource), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(fabricatedSource), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", fabricatedSource).some(
      (item) => item.code === "untrusted_evidence_source",
    ),
  );

  const missingSource = clone();
  delete missingSource.evidence.find((item) => item.id === "evidence-line3-material-receipt").sourceRef;
  assert.equal(validateSchema(missingSource), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingSource), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", missingSource).some(
      (item) => item.code === "untrusted_evidence_source",
    ),
  );

  // An untrusted source must also fail closed for the predicate it was
  // meant to ground, not just surface an extra, independent finding.
  const fabricatedClearance = clone();
  const constraint = fabricatedClearance.constraints.find(
    (item) => item.id === "constraint-line3-material",
  );
  constraint.status = "cleared";
  constraint.clearedBy = "owner-materials-planner";
  constraint.clearedAt = "2026-09-09";
  fabricatedClearance.evidence.find(
    (item) => item.id === "evidence-line3-material-receipt",
  ).sourceRef = "trust me, the component lot arrived";
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", fabricatedClearance).some(
      (item) => item.code === "self_attested_constraint_clearance",
    ),
  );
});

test("manufacturing validator rejects a non-positive or non-finite demand order quantity, even when it incidentally matches the scheduled total", () => {
  const zeroQuantity = clone();
  const order = zeroQuantity.orders.find((item) => item.id === "demand-sku-5820-w37");
  order.quantity = 0;
  // Clear every schedule entry against this order so the scheduled total
  // (0) would otherwise incidentally "match" the invalid quantity.
  zeroQuantity.scheduleEntries = zeroQuantity.scheduleEntries.filter(
    (item) => item.demandRef !== "demand-sku-5820-w37",
  );
  assert.equal(validateSchema(zeroQuantity), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(zeroQuantity), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", zeroQuantity).some(
      (item) => item.code === "invalid_order_quantity",
    ),
  );

  const negativeQuantity = clone();
  negativeQuantity.orders.find((item) => item.id === "demand-sku-5820-w37").quantity = -1800;
  assert.equal(validateSchema(negativeQuantity), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(negativeQuantity), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", negativeQuantity).some(
      (item) => item.code === "invalid_order_quantity",
    ),
  );
});

test("manufacturing validator rejects a zero or negative schedule entry quantity and excludes it from aggregation", () => {
  const zeroEntry = clone();
  zeroEntry.scheduleEntries.find((item) => item.id === "schedule-sku-4410-day1").quantity = 0;
  assert.equal(validateSchema(zeroEntry), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(zeroEntry), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", zeroEntry).some(
      (item) => item.code === "invalid_schedule_quantity",
    ),
  );

  // A negative quantity must not be allowed to net out a genuine
  // overcommitment when aggregating against the same capacity slot: the
  // existing 2100-unit entry plus a legitimate extra 300 units already
  // exceeds the slot's 2200-unit capacity, and a bogus -2100 "offset" entry
  // must not be allowed to cancel that overage back into bounds.
  const offsettingNegative = clone();
  offsettingNegative.scheduleEntries.push(
    {
      id: "schedule-sku-4410-day1-extra",
      demandRef: "demand-sku-4410-w37",
      lineRef: "line-3-assembly",
      capacitySlotRef: "capacity-line3-2026-09-10",
      quantity: 300,
      state: "proposed",
    },
    {
      id: "schedule-sku-4410-day1-negative-offset",
      demandRef: "demand-sku-4410-w37",
      lineRef: "line-3-assembly",
      capacitySlotRef: "capacity-line3-2026-09-10",
      quantity: -2100, // would cancel the overage back to within bounds if aggregated
      state: "proposed",
    },
  );
  assert.equal(validateSchema(offsettingNegative), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(offsettingNegative), false);
  const findings = validateArtifactSemantics("manufacturing-operations-planner", offsettingNegative);
  assert.ok(findings.some((item) => item.code === "invalid_schedule_quantity"));
  // The slot's legitimate 2100+300=2400 total against its 2200-unit
  // capacity must still be flagged, not silently offset to 300 by the
  // bogus negative entry.
  assert.ok(findings.some((item) => item.code === "capacity_exceeded"));
});

test("manufacturing validator rejects a non-finite or negative capacity slot availableUnits before aggregation", () => {
  const negativeUnits = clone();
  negativeUnits.capacitySlots.find((item) => item.id === "capacity-line3-2026-09-10").availableUnits = -1;
  assert.equal(validateSchema(negativeUnits), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(negativeUnits), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", negativeUnits).some(
      (item) => item.code === "invalid_capacity_units",
    ),
  );

  const nonNumericUnits = clone();
  nonNumericUnits.capacitySlots.find((item) => item.id === "capacity-line3-2026-09-10").availableUnits =
    "plenty";
  assert.equal(validateSchema(nonNumericUnits), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("manufacturing-operations-planner", nonNumericUnits),
  );
  assert.equal(isValid(nonNumericUnits), false);
  assert.ok(
    validateArtifactSemantics("manufacturing-operations-planner", nonNumericUnits).some(
      (item) => item.code === "invalid_capacity_units",
    ),
  );
});

test("validate-artifact CLI accepts the packaged manufacturing-operations-planner fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "manufacturing-operations-planner", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready manufacturing artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `manufacturing-operations-planner-cli-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "manufacturing-operations-planner", scratchPath],
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
