import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";
import { artifactSchemaName } from "./artifact-validator-registry.mjs";
import {
  computeSupplierCapacityBucketDigest,
  computeSupplierCapacityEvidenceDigest,
} from "./supplier-capacity-assurance-manager.mjs";

const id = "supplier-capacity-assurance-manager";
const base = `../sources/${id}`;
const fixture = JSON.parse(
  await readFile(
    new URL(`${base}/fixtures/supplier-capacity-assurance.example.json`, import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(`${base}/schemas/supplier-capacity-assurance.schema.json`, import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL(`${base}/templates/supplier-capacity-review.md`, import.meta.url),
  "utf8",
);
const visual = await readFile(
  new URL(`${base}/assets/supplier-capacity-assurance.html`, import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone() {
  return structuredClone(fixture);
}

function findings(value) {
  return validateArtifactSemantics(id, value);
}

function assertFinding(value, code) {
  const result = findings(value);
  assert.ok(result.some((item) => item.code === code), JSON.stringify(result, null, 2));
}

const fieldBySubjectType = {
  demand: "demand",
  commit: "commits",
  capacity: "capacity",
  inventory: "inventorySnapshots",
  "quality-disposition": "qualityDispositions",
  shipment: "shipments",
  receipt: "receipts",
  "logistics-constraint": "logisticsConstraints",
  "allocation-policy": "allocationPolicies",
  "recovery-action": "recoveryActions",
};

function reseal(value, subjectType, subjectRef) {
  const subject =
    subjectType === "plan"
      ? value.plan
      : value[fieldBySubjectType[subjectType]].find((item) => item.id === subjectRef);
  const evidence = value.evidence.find(
    (item) => item.subjectType === subjectType && item.subjectRef === subjectRef,
  );
  evidence.payloadDigest = computeSupplierCapacityEvidenceDigest(subjectType, subject);
  evidence.sourceRef = `${evidence.sourceRef.split("?")[0]}?sha256=${evidence.payloadDigest.slice(7)}`;
}

function setReconciliation(value, eligibleSupplyQuantity) {
  const reconciliation = value.reconciliations[0];
  reconciliation.eligibleSupplyQuantity = eligibleSupplyQuantity;
  reconciliation.allocatedQuantity = eligibleSupplyQuantity;
  reconciliation.shortageQuantity = 1500 - eligibleSupplyQuantity;
  const [priorityOne, priorityTwo] = value.allocationProposals[0].allocations;
  priorityOne.allocatedQuantity = Math.min(900, eligibleSupplyQuantity);
  priorityOne.shortageQuantity = 900 - priorityOne.allocatedQuantity;
  priorityTwo.allocatedQuantity = Math.max(0, eligibleSupplyQuantity - 900);
  priorityTwo.shortageQuantity = 600 - priorityTwo.allocatedQuantity;
}

test("supplier capacity fixture is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(hasArtifactSemanticValidator(id), true);
  assert.equal(artifactSchemaName(id), "supplier-capacity-assurance.schema.json");
});

test("X3 fallback and X4 visual expose the exact review and authority contract", () => {
  for (const text of [
    "Approved demand plan / revision",
    "Shortage allocation proposals",
    "Recovery actions and checkpoints",
    "No purchase order",
  ]) {
    assert.match(template, new RegExp(text, "u"));
  }
  for (const text of [
    "DP-2026-W38-R4",
    "1,500",
    "1,200",
    "300",
    "100 held",
    "planned, unreceived",
    "Not approved",
  ]) {
    assert.match(visual, new RegExp(text, "u"));
  }
});

test("validator rejects demand and commit revision drift", () => {
  const demandDrift = clone();
  demandDrift.demand[0].planRevision = "DP-2026-W38-R3";
  assertFinding(demandDrift, "demand_revision_or_identity_mismatch");

  const reconciliationDrift = clone();
  reconciliationDrift.reconciliations[0].planRevision = "DP-2026-W38-R3";
  assertFinding(reconciliationDrift, "reconciliation_revision_mismatch");

  const duplicateCommitRevision = clone();
  duplicateCommitRevision.commits[0].revision = "";
  assert.equal(validateSchema(duplicateCommitRevision), false);
});

test("canonical evidence digests bind every decision-relevant supplier commit field", () => {
  for (const [field, replacement] of [
    ["revision", "ALPHA-C8"],
    ["supplierRef", "supplier-beta"],
    ["siteRef", "site-beta-monterrey"],
    ["partRef", "part-other"],
    ["bucketRef", "bucket-other"],
    ["quantity", 601],
    ["committedAt", "2026-09-09T15:00:00Z"],
  ]) {
    const changed = clone();
    changed.commits[0][field] = replacement;
    assertFinding(changed, "evidence_payload_digest_mismatch");
  }
});

test("artifact-side resealing cannot preserve an unchanged source reference", () => {
  const selfResealed = clone();
  const commit = selfResealed.commits[0];
  commit.revision = "ALPHA-C8";
  const evidence = selfResealed.evidence.find(
    (item) => item.id === commit.evidenceRef,
  );
  evidence.payloadDigest = computeSupplierCapacityEvidenceDigest("commit", commit);
  assertFinding(selfResealed, "source_payload_digest_mismatch");

  const sourceReissued = clone();
  sourceReissued.commits[0].revision = "ALPHA-C8";
  reseal(sourceReissued, "commit", "commit-alpha-c17-w38");
  assert.equal(
    findings(sourceReissued).some(
      (item) =>
        item.code === "evidence_payload_digest_mismatch" ||
        item.code === "source_payload_digest_mismatch",
    ),
    false,
  );
});

test("every bucket-bound record carries the exact immutable calendar digest", () => {
  const expected = computeSupplierCapacityBucketDigest(fixture.timeBuckets[0]);
  for (const field of [
    "demand",
    "commits",
    "capacity",
    "inventorySnapshots",
    "shipments",
    "receipts",
    "logisticsConstraints",
    "allocationPolicies",
    "supplyPositions",
    "reconciliations",
  ]) {
    assert.ok(fixture[field].every((item) => item.bucketDigest === expected), field);
  }

  const calendarChanged = clone();
  calendarChanged.timeBuckets[0].start = "2026-09-15";
  assertFinding(calendarChanged, "bucket_digest_mismatch");

  const bindingChanged = clone();
  bindingChanged.demand[0].bucketDigest = `sha256:${"0".repeat(64)}`;
  assertFinding(bindingChanged, "bucket_digest_mismatch");
});

test("validator rejects cross-supplier, site, part, and time-bucket evidence", () => {
  const crossSite = clone();
  crossSite.supplyPositions[0].siteRef = "site-beta-monterrey";
  assertFinding(crossSite, "cross_identity_supply_evidence");

  const crossShipment = clone();
  crossShipment.shipments[0].supplierRef = "supplier-beta";
  assertFinding(crossShipment, "invalid_shipment_receipt_binding");

  const crossDemand = clone();
  crossDemand.demand[0].bucketRef = "bucket-does-not-exist";
  assertFinding(crossDemand, "demand_revision_or_identity_mismatch");
});

test("validator excludes unqualified or expired capacity and applies yield", () => {
  const unqualified = clone();
  unqualified.capacity[0].qualified = false;
  assertFinding(unqualified, "unqualified_capacity");
  assertFinding(unqualified, "invalid_eligible_commit");

  const expired = clone();
  expired.capacity[1].validThrough = "2026-09-18";
  assertFinding(expired, "unqualified_capacity");

  const wrongYield = clone();
  wrongYield.capacity[1].yieldRate = 0.7;
  assertFinding(wrongYield, "invalid_eligible_commit");
  assertFinding(wrongYield, "invalid_eligible_supply");
});

test("validator excludes stale inventory and preserves quality holds", () => {
  const stale = clone();
  stale.inventorySnapshots[0].asOf = "2026-08-01T00:00:00Z";
  assertFinding(stale, "stale_inventory_snapshot");
  assertFinding(stale, "invalid_eligible_inventory");

  const heldCounted = clone();
  heldCounted.supplyPositions[1].eligibleInventoryQuantity = 100;
  heldCounted.supplyPositions[1].eligibleSupplyQuantity = 500;
  assertFinding(heldCounted, "invalid_eligible_inventory");

  const crossDisposition = clone();
  crossDisposition.inventorySnapshots[0].qualityDispositionRef = "quality-beta-hold";
  assertFinding(crossDisposition, "invalid_quality_disposition_binding");
});

test("validator counts accepted receipts but not planned or unreceived shipments", () => {
  const plannedCounted = clone();
  plannedCounted.supplyPositions[1].eligibleReceiptQuantity = 200;
  plannedCounted.supplyPositions[1].eligibleSupplyQuantity = 600;
  assertFinding(plannedCounted, "invalid_eligible_receipts");

  const missingReceipt = clone();
  missingReceipt.receipts = [];
  assertFinding(missingReceipt, "invalid_eligible_receipts");

  const mismatchedReceipt = clone();
  mismatchedReceipt.receipts[0].siteRef = "site-beta-monterrey";
  assertFinding(mismatchedReceipt, "invalid_shipment_receipt_binding");
});

test("validator enforces departure, delivery, receipt, evidence, and trusted-asOf chronology", () => {
  const futureReceipt = clone();
  futureReceipt.receipts[0].receivedAt = "2026-09-15T14:25:00Z";
  reseal(futureReceipt, "receipt", "receipt-alpha-c17-0913");
  assertFinding(futureReceipt, "invalid_shipment_receipt_chronology");
  assertFinding(futureReceipt, "invalid_eligible_receipts");

  const receiptBeforeDelivery = clone();
  receiptBeforeDelivery.receipts[0].receivedAt = "2026-09-13T13:25:00Z";
  reseal(receiptBeforeDelivery, "receipt", "receipt-alpha-c17-0913");
  assertFinding(receiptBeforeDelivery, "invalid_shipment_receipt_chronology");

  const deliveryBeforeDeparture = clone();
  deliveryBeforeDeparture.shipments[0].deliveredAt = "2026-09-10T14:00:00Z";
  reseal(deliveryBeforeDeparture, "shipment", "shipment-alpha-c17-0913");
  assertFinding(deliveryBeforeDeparture, "invalid_shipment_chronology");

  const evidenceBeforeDelivery = clone();
  evidenceBeforeDelivery.evidence.find(
    (item) => item.id === "evidence-shipment-alpha",
  ).observedAt = "2026-09-12T14:00:00Z";
  assertFinding(evidenceBeforeDelivery, "invalid_shipment_chronology");
});

test("validator rejects lead-time-infeasible supply", () => {
  const late = clone();
  late.commits[1].committedAt = "2026-09-18T14:00:00Z";
  assertFinding(late, "lead_time_infeasible");
  assertFinding(late, "invalid_eligible_commit");
});

test("blocked logistics contributes zero and constrained logistics applies its exact ceiling", () => {
  const blocked = clone();
  blocked.logisticsConstraints[1].status = "blocked";
  reseal(blocked, "logistics-constraint", "logistics-beta-c17-w38");
  blocked.supplyPositions[1].eligibleCommitQuantity = 0;
  blocked.supplyPositions[1].eligibleSupplyQuantity = 0;
  setReconciliation(blocked, 800);
  assert.deepEqual(findings(blocked), []);

  const constrained = clone();
  constrained.logisticsConstraints[1].maxReceivableQuantity = 300;
  reseal(constrained, "logistics-constraint", "logistics-beta-c17-w38");
  constrained.supplyPositions[1].eligibleCommitQuantity = 300;
  constrained.supplyPositions[1].eligibleSupplyQuantity = 300;
  setReconciliation(constrained, 1100);
  assert.deepEqual(findings(constrained), []);
});

test("clear logistics also applies maxReceivableQuantity as a hard ceiling", () => {
  const clearCapped = clone();
  clearCapped.logisticsConstraints[0].maxReceivableQuantity = 550;
  reseal(clearCapped, "logistics-constraint", "logistics-alpha-c17-w38");
  clearCapped.supplyPositions[0].eligibleCommitQuantity = 550;
  clearCapped.supplyPositions[0].eligibleSupplyQuantity = 750;
  setReconciliation(clearCapped, 1150);
  assert.deepEqual(findings(clearCapped), []);

  const uncappedClaim = clone();
  uncappedClaim.logisticsConstraints[0].maxReceivableQuantity = 550;
  reseal(uncappedClaim, "logistics-constraint", "logistics-alpha-c17-w38");
  assertFinding(uncappedClaim, "invalid_eligible_commit");
});

test("inventory cutoff prevents receipt double counting", () => {
  const includedInSnapshot = clone();
  includedInSnapshot.inventorySnapshots[0].transactionCutoffAt = "2026-09-13T15:00:00Z";
  includedInSnapshot.inventorySnapshots[0].asOf = "2026-09-13T15:00:00Z";
  includedInSnapshot.evidence.find(
    (item) => item.id === "evidence-inventory-alpha",
  ).observedAt = "2026-09-13T15:00:00Z";
  reseal(includedInSnapshot, "inventory", "inventory-alpha-c17");
  includedInSnapshot.supplyPositions[0].eligibleReceiptQuantity = 0;
  includedInSnapshot.supplyPositions[0].eligibleSupplyQuantity = 700;
  setReconciliation(includedInSnapshot, 1100);
  assert.deepEqual(findings(includedInSnapshot), []);

  const invalidCutoff = clone();
  invalidCutoff.inventorySnapshots[0].transactionCutoffAt = "2026-09-13T19:00:00Z";
  reseal(invalidCutoff, "inventory", "inventory-alpha-c17");
  assertFinding(invalidCutoff, "invalid_inventory_cutoff");
});

test("plan approval, horizon, and bucket chronology are ordered and contained", () => {
  const futureApproval = clone();
  futureApproval.plan.approvedAt = "2026-09-15T12:00:00Z";
  reseal(futureApproval, "plan", futureApproval.plan.id);
  assertFinding(futureApproval, "invalid_plan_approval_chronology");

  const reversedHorizon = clone();
  reversedHorizon.plan.horizonStart = "2026-09-21";
  reseal(reversedHorizon, "plan", reversedHorizon.plan.id);
  assertFinding(reversedHorizon, "invalid_plan_horizon");

  const outsideBucket = clone();
  outsideBucket.timeBuckets[0].end = "2026-09-21";
  assertFinding(outsideBucket, "invalid_bucket_horizon");
});

test("reconciliations exactly partition approved demand without omissions or duplicates", () => {
  const omitted = clone();
  omitted.reconciliations[0].demandRefs.pop();
  assertFinding(omitted, "incomplete_demand_partition");

  const duplicated = clone();
  duplicated.reconciliations[0].demandRefs.push("demand-c17-w38-a");
  assertFinding(duplicated, "duplicate_reference");
  assertFinding(duplicated, "incomplete_demand_partition");

  const overlapping = clone();
  overlapping.reconciliations.push({
    ...structuredClone(overlapping.reconciliations[0]),
    id: "reconciliation-c17-w38-copy",
  });
  assertFinding(overlapping, "incomplete_demand_partition");
});

test("validator requires exact demand, supply, allocation, and shortage arithmetic", () => {
  const shortageDrift = clone();
  shortageDrift.reconciliations[0].shortageQuantity = 299;
  assertFinding(shortageDrift, "inconsistent_reconciliation_arithmetic");

  const allocationDrift = clone();
  allocationDrift.allocationProposals[0].allocations[0].allocatedQuantity = 801;
  assertFinding(allocationDrift, "allocation_policy_violation");
  assertFinding(allocationDrift, "incomplete_allocation_proposal");

  const duplicateSupply = clone();
  duplicateSupply.supplyPositions.push({
    ...structuredClone(duplicateSupply.supplyPositions[0]),
    id: "supply-alpha-c17-w38-copy",
  });
  assertFinding(duplicateSupply, "duplicate_supply_position");
});

test("structured allocation policy is digest-bound and deterministically enforced", () => {
  const policyDrift = clone();
  policyDrift.allocationPolicies[0].revision = "ALLOC-C17-2026-R3";
  assertFinding(policyDrift, "evidence_payload_digest_mismatch");

  const policyTooNew = clone();
  policyTooNew.allocationPolicies[0].effectiveAt = "2026-09-15T00:00:00Z";
  reseal(policyTooNew, "allocation-policy", "policy-c17-priority");
  assertFinding(policyTooNew, "invalid_allocation_policy");

  const lowerPriorityFirst = clone();
  lowerPriorityFirst.allocationProposals[0].allocations[0].allocatedQuantity = 800;
  lowerPriorityFirst.allocationProposals[0].allocations[0].shortageQuantity = 100;
  lowerPriorityFirst.allocationProposals[0].allocations[1].allocatedQuantity = 400;
  lowerPriorityFirst.allocationProposals[0].allocations[1].shortageQuantity = 200;
  assertFinding(lowerPriorityFirst, "allocation_policy_violation");
});

test("validator keeps scarce-supply allocation and recovery work unapproved", () => {
  const allocated = clone();
  allocated.allocationProposals[0].state = "approved";
  allocated.allocationProposals[0].approvedByRef = "owner-plan";
  allocated.allocationProposals[0].approvedAt = "2026-09-14T18:00:00Z";
  assert.equal(validateSchema(allocated), false);
  assertFinding(allocated, "unauthorized_allocation_state");

  const committedExpedite = clone();
  committedExpedite.recoveryActions[2].state = "committed";
  assert.equal(validateSchema(committedExpedite), false);
  assertFinding(committedExpedite, "unauthorized_recovery_state");
});

test("validator requires accountable action and checkpoint owners", () => {
  const nonHumanOwner = clone();
  nonHumanOwner.principals[1].kind = "team";
  assert.equal(validateSchema(nonHumanOwner), false);
  assertFinding(nonHumanOwner, "agent_owned_authority");

  const agentOwner = clone();
  agentOwner.principals[1].name = "assistant";
  assertFinding(agentOwner, "agent_owned_authority");

  const selfOwner = clone();
  selfOwner.principals[1].name = "Supplier Capacity Assurance Manager";
  assertFinding(selfOwner, "agent_owned_authority");

  const missingCheckpoint = clone();
  missingCheckpoint.recoveryActions[0].checkpointRef = "checkpoint-does-not-exist";
  assertFinding(missingCheckpoint, "dangling_reference");
});

test("action and checkpoint membership is reciprocal and exact in both directions", () => {
  const omittedFromCheckpoint = clone();
  omittedFromCheckpoint.reviewCheckpoints[0].actionRefs.shift();
  assertFinding(omittedFromCheckpoint, "inconsistent_checkpoint_membership");

  const extraAtCheckpoint = clone();
  extraAtCheckpoint.reviewCheckpoints[0].actionRefs.push("action-logistics-options-review");
  assertFinding(extraAtCheckpoint, "inconsistent_checkpoint_membership");

  const actionMovedOnly = clone();
  actionMovedOnly.recoveryActions[0].checkpointRef = "checkpoint-allocation-decision";
  reseal(actionMovedOnly, "recovery-action", "action-beta-capacity-review");
  assertFinding(actionMovedOnly, "inconsistent_checkpoint_membership");
});

test("validator requires controlled, correctly scoped, current evidence", () => {
  const narrativeSource = clone();
  narrativeSource.evidence[3].sourceRef = "Supplier said so";
  assert.equal(validateSchema(narrativeSource), false);
  assertFinding(narrativeSource, "invalid_grounding_evidence");

  const crossEvidence = clone();
  crossEvidence.commits[0].evidenceRef = "evidence-commit-beta-c12";
  assertFinding(crossEvidence, "invalid_grounding_evidence");

  const futureEvidence = clone();
  futureEvidence.evidence[3].observedAt = "2026-09-15T00:00:00Z";
  assertFinding(futureEvidence, "invalid_grounding_evidence");
});

test("validator enforces all eight authority gates and blocks narrative bypasses", () => {
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "contact-supplier",
  );
  assertFinding(missingGate, "missing_authority_gate");

  const narrativeMutations = [
    (value) => {
      value.evidence[0].summary = "We contacted the supplier.";
    },
    (value) => {
      value.reconciliations[0].explanation = "The agent allocated scarce supply.";
    },
    (value) => {
      value.allocationProposals[0].allocations[0].rationale = "We approved the allocation.";
    },
    (value) => {
      value.recoveryActions[0].description = "We changed the forecast.";
    },
    (value) => {
      value.reviewCheckpoints[0].decisionNeeded = "We committed an expedite.";
    },
    (value) => {
      value.handoff.summary = "We contacted the supplier and allocated scarce supply.";
    },
  ];
  for (const mutate of narrativeMutations) {
    const narrativeBypass = clone();
    mutate(narrativeBypass);
    assertFinding(narrativeBypass, "prohibited_authority_narrative");
  }

  for (const passiveClaim of [
    "The supplier was contacted.",
    "The allocation was approved.",
    "The waiver was granted.",
    "The expedite was committed.",
    "The payment was made.",
    "The sourcing was decided.",
  ]) {
    const narrativeBypass = clone();
    narrativeBypass.recoveryActions[0].description = passiveClaim;
    assertFinding(narrativeBypass, "prohibited_authority_narrative");
  }

  const negated = clone();
  negated.handoff.summary =
    "We did not contact the supplier or allocate scarce supply; owner decisions remain pending.";
  assert.equal(
    findings(negated).some((item) => item.code === "prohibited_authority_narrative"),
    false,
  );

  const negatedPassive = clone();
  negatedPassive.handoff.summary =
    "The supplier was not contacted, the allocation was not approved, and the payment was not made.";
  assert.equal(
    findings(negatedPassive).some(
      (item) => item.code === "prohibited_authority_narrative",
    ),
    false,
  );
});

test("full validator rejects has-been passive supplier contact", () => {
  for (const claim of [
    "The supplier has been contacted.",
    "The suppliers have been contacted.",
    "The supplier had been contacted.",
    "The allocations have been approved.",
    "The waiver had been granted.",
    "The expedites have been committed.",
    "The payments have been made.",
    "The sourcing had been decided.",
  ]) {
    const passive = clone();
    passive.handoff.summary = claim;
    assertFinding(passive, "prohibited_authority_narrative");
  }
});

test("full validator accepts truly coordinated negation", () => {
  const coordinatedNegation = clone();
  coordinatedNegation.handoff.summary =
    "We did not contact the supplier and allocate scarce supply.";
  assert.equal(
    findings(coordinatedNegation).some(
      (item) => item.code === "prohibited_authority_narrative",
    ),
    false,
  );
});

test("full validator rejects an affirmative second coordinated clause", () => {
  const affirmativeSecondClause = clone();
  affirmativeSecondClause.handoff.summary =
    "We did not contact the supplier and we allocated scarce supply.";
  assertFinding(affirmativeSecondClause, "prohibited_authority_narrative");
});

test("validator rejects premature readiness and incomplete handoff coverage", () => {
  const premature = clone();
  premature.handoff.state = "ready-for-owner-review";
  assertFinding(premature, "premature_ready_state");

  const missingAction = clone();
  missingAction.handoff.unresolvedActionRefs.pop();
  assertFinding(missingAction, "incomplete_handoff");

  const malformedRefs = clone();
  malformedRefs.handoff.reconciliationRefs = { length: 1 };
  assert.doesNotThrow(() => findings(malformedRefs));
  assertFinding(malformedRefs, "invalid_reference_list");
});
