import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";
import {
  customerSuccessApprovedPlanVerificationPayload,
  customerSuccessMetricDefinitionDigest,
} from "./customer-success-program-manager.mjs";

const base = "../sources/customer-success-program-manager";
const fixture = JSON.parse(
  await readFile(new URL(`${base}/fixtures/customer-success-review.example.json`, import.meta.url)),
);
const schema = JSON.parse(
  await readFile(new URL(`${base}/schemas/customer-success-review.schema.json`, import.meta.url)),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone() {
  return structuredClone(fixture);
}

function findings(value) {
  return validateArtifactSemantics("customer-success-program-manager", value);
}

function assertHas(value, code) {
  const result = findings(value);
  assert.ok(result.some((item) => item.code === code), JSON.stringify(result, null, 2));
}

function assertNotHas(value, code) {
  const result = findings(value);
  assert.equal(
    result.some((item) => item.code === code),
    false,
    JSON.stringify(result, null, 2),
  );
}

test("customer success fixture is strict-schema valid and semantically clean", () => {
  assert.equal(hasArtifactSemanticValidator("customer-success-program-manager"), true);
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("strict schema rejects undeclared fields and incomplete evidence records", () => {
  const extra = clone();
  extra.review.claimedSuccess = true;
  assert.equal(validateSchema(extra), false);

  const incomplete = clone();
  delete incomplete.metricDefinitions[0].definition;
  assert.equal(validateSchema(incomplete), false);
});

test("review rejects customer tenant account and plan revision drift", () => {
  const tenantDrift = clone();
  tenantDrift.review.tenant.customerRef = "customer-other";
  assertHas(tenantDrift, "invalid_review_scope");

  const revisionDrift = clone();
  revisionDrift.sources[1].binding.planRevision = 8;
  assertHas(revisionDrift, "cross_scope_or_revision_binding");

  const accountDrift = clone();
  accountDrift.actions[0].binding.accountRef = "account-other";
  assertHas(accountDrift, "cross_scope_or_revision_binding");
});

test("approved plan revision requires matching human decision evidence and timestamp", () => {
  const wrongApprover = clone();
  wrongApprover.decisions[0].madeByRef = "principal-adoption-system";
  assertHas(wrongApprover, "invalid_plan_approval");
  assertHas(wrongApprover, "invalid_authority_owner");

  const wrongTime = clone();
  wrongTime.decisions[0].madeAt = "2026-08-29T17:00:00Z";
  assertHas(wrongTime, "invalid_plan_approval");

  const wrongSource = clone();
  wrongSource.decisions[0].evidenceRefs = ["source-owner-review"];
  assertHas(wrongSource, "invalid_plan_approval");
});

test("workload service and source identities cannot cross scopes", () => {
  const wrongService = clone();
  wrongService.workloads[0].serviceRef = "service-other";
  assertHas(wrongService, "dangling_reference");

  const halfScopedSource = clone();
  halfScopedSource.sources[1].serviceRef = null;
  assertHas(halfScopedSource, "invalid_source_identity");

  const futureSource = clone();
  futureSource.sources[1].collectedAt = "2026-09-15T12:00:00Z";
  assertHas(futureSource, "invalid_source_timestamp");
});

test("metric observations preserve definition workload service source and exact window", () => {
  const wrongMetricSource = clone();
  wrongMetricSource.metricObservations[0].sourceRef = "source-teams-health";
  assertHas(wrongMetricSource, "invalid_metric_observation_binding");

  const wrongWindow = clone();
  wrongWindow.metricObservations[0].windowStart = "2026-08-02T00:00:00Z";
  assertHas(wrongWindow, "invalid_metric_window");

  const inventedStatus = clone();
  inventedStatus.metricObservations[0].status = "on-target";
  assertHas(inventedStatus, "invalid_metric_status");

  const missingTarget = clone();
  missingTarget.metricDefinitions[0].target = null;
  assertHas(missingTarget, "invalid_metric_target");
});

test("approved-plan evidence makes every metric semantic immutable", () => {
  const mutations = [
    ["name", "Support ticket resolution rate"],
    ["definition", "A redefined active-user calculation."],
    ["direction", "at-most"],
    ["target", 0.6],
    ["unit", "percent"],
    ["aggregation", "average"],
    ["windowStart", "2026-08-02T00:00:00Z"],
    ["windowEnd", "2026-08-30T23:59:59Z"],
  ];
  for (const [field, replacement] of mutations) {
    const value = clone();
    value.metricDefinitions[0][field] = replacement;
    value.metricDefinitions[0].definitionDigest = customerSuccessMetricDefinitionDigest(
      value.metricDefinitions[0],
      value.sources[1],
    );
    if (field === "target") {
      value.metricObservations[0].status = "on-target";
      value.sources[0].verifiedContentDigests = [
        value.metricDefinitions[0].definitionDigest,
      ];
    }
    assertHas(value, "invalid_authoritative_metric_definition");
  }

  const substitutedSource = clone();
  substitutedSource.sources[1].sourceUri =
    "controlled://adoption/contoso/teams/substituted-export";
  assertHas(substitutedSource, "invalid_authoritative_metric_definition");
});

test("approved metric evidence binds exact plan approval provenance", () => {
  const rewrittenApproval = clone();
  rewrittenApproval.review.plan.approvedAt = "2026-08-29T17:00:00Z";
  rewrittenApproval.decisions[0].madeAt = "2026-08-29T17:00:00Z";
  assertHas(rewrittenApproval, "invalid_authoritative_metric_definition");

  const unsignedApprovalSource = clone();
  const unsignedSource = structuredClone(unsignedApprovalSource.sources[0]);
  unsignedSource.id = "source-unverified-approved-plan";
  unsignedSource.sourceUri = "controlled://success-plans/contoso/2026/revisions/7-copy";
  unsignedApprovalSource.sources.push(unsignedSource);
  unsignedApprovalSource.decisions[0].evidenceRefs = [unsignedSource.id];
  assertHas(unsignedApprovalSource, "invalid_plan_approval");
});

test("approved-plan trust roots are caller configurable", () => {
  const value = clone();
  const secondMetric = {
    ...structuredClone(value.metricDefinitions[0]),
    id: "metric-teams-weekly-active-user-rate",
    name: "Regional Monthly active enabled-user rate",
    definition: "Weekly active enabled users divided by enabled users.",
    target: 0.8,
  };
  secondMetric.definitionDigest = customerSuccessMetricDefinitionDigest(
    secondMetric,
    value.sources[1],
  );
  value.metricDefinitions.push(secondMetric);
  value.sources[0].verifiedContentDigests.push(secondMetric.definitionDigest);
  value.actions[0].summary =
    "Monthly active enabled-user rate target is 0.75 before the Regional Monthly active enabled-user rate target is 0.8.";
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  value.sources[0].verification.keyId = "customer-plan-authority";
  value.sources[0].verification.signature = sign(
    null,
    Buffer.from(
      customerSuccessApprovedPlanVerificationPayload(
        value.sources[0],
        value.review.plan,
      ),
    ),
    privateKey,
  ).toString("base64");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.deepEqual(
    validateArtifactSemantics("customer-success-program-manager", value, {
      approvedPlanPublicKeys: { "customer-plan-authority": publicKeyDer },
      approvedPlanMetricDigests: {
        "plan-contoso-2026@7#metric-teams-active-user-rate":
          value.metricDefinitions[0].definitionDigest,
        "plan-contoso-2026@7#metric-teams-weekly-active-user-rate":
          secondMetric.definitionDigest,
      },
    }),
    [],
  );
});

test("caller-pinned plan revision digest rejects a fully resigned lower target", () => {
  const value = clone();
  const originalDigest = value.metricDefinitions[0].definitionDigest;
  value.metricDefinitions[0].target = 0.6;
  value.metricDefinitions[0].definitionDigest = customerSuccessMetricDefinitionDigest(
    value.metricDefinitions[0],
    value.sources[1],
  );
  value.metricObservations[0].status = "on-target";
  value.sources[0].verifiedContentDigests = [value.metricDefinitions[0].definitionDigest];
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  value.sources[0].verification.keyId = "customer-plan-authority";
  value.sources[0].verification.signature = sign(
    null,
    Buffer.from(
      customerSuccessApprovedPlanVerificationPayload(
        value.sources[0],
        value.review.plan,
      ),
    ),
    privateKey,
  ).toString("base64");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const result = validateArtifactSemantics("customer-success-program-manager", value, {
    approvedPlanPublicKeys: { "customer-plan-authority": publicKeyDer },
    approvedPlanMetricDigests: {
      "plan-contoso-2026@7#metric-teams-active-user-rate": originalDigest,
    },
  });
  assert.ok(
    result.some((item) => item.code === "invalid_authoritative_metric_definition"),
    JSON.stringify(result, null, 2),
  );
});

test("criterion cannot restate a conflicting metric target", () => {
  const conflictingTarget = clone();
  conflictingTarget.milestones[1].acceptanceCriteria[0].target = "At least 0.99";
  assert.equal(validateSchema(conflictingTarget), false);

  const conflictingDescription = clone();
  conflictingDescription.milestones[1].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate reaches at least 0.50.";
  assertHas(conflictingDescription, "invalid_metric_acceptance_criterion");

  const spelledOutConflict = clone();
  spelledOutConflict.milestones[1].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate reaches at least sixty percent.";
  assertHas(spelledOutConflict, "invalid_metric_acceptance_criterion");

  const unrelatedNumber = clone();
  unrelatedNumber.milestones[1].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate sustains the approved target for 2 consecutive months.";
  assertHas(unrelatedNumber, "invalid_metric_acceptance_criterion");

  const matchingTarget = clone();
  matchingTarget.milestones[1].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate reaches at least 0.75.";
  assertNotHas(matchingTarget, "invalid_metric_acceptance_criterion");

  const matchingPercentTarget = clone();
  matchingPercentTarget.milestones[1].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate target is 75%.";
  assertNotHas(matchingPercentTarget, "invalid_metric_acceptance_criterion");

  const unboundTarget = clone();
  unboundTarget.milestones[0].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate reaches the approved target.";
  assertHas(unboundTarget, "invalid_metric_acceptance_criterion");

  const unboundNumericTarget = clone();
  unboundNumericTarget.milestones[0].acceptanceCriteria[0].description =
    "Monthly active enabled-user rate reaches at least 0.75.";
  assertHas(unboundNumericTarget, "invalid_metric_acceptance_criterion");

  for (const description of [
    "The Monthly active enabled-user rate approved target was lowered to 0.50.",
    "Monthly active enabled-user rate reaches 0.75, then at least 0.50.",
    "Monthly active enabled-user rate must stay below 0.75.",
    "Support ticket volume reaches the approved target.",
    "Monthly active enabled-user rate exceeds 50%.",
    "Monthly active enabled-user rate has a minimum of 50%.",
    "Monthly active enabled-user rate is no less than 50%.",
    "Monthly active enabled-user rate exceeds 0.75.",
    "Monthly active enabled-user rate must stay above 0.75.",
    "The approved target is 0.75.",
    "Monthly active enabled-user rate has a 50% goal.",
    "Monthly active enabled-user rate goal equals 50%.",
    "Monthly active enabled-user rate target = 50%.",
    "Monthly active enabled-user rate should reach 50%.",
    "The target for Monthly active enabled-user rate is 0.50.",
    "The threshold for Monthly active enabled-user rate is 0.50.",
    "The goal for Monthly active enabled-user rate is 0.50.",
    "The objective for Monthly active enabled-user rate is 0.50.",
    "Monthly active enabled-user rate must equal 0.50.",
    "Monthly active enabled-user rate must equal 0.75.",
    "Monthly active enabled-user rate should remain no lower than 0.50.",
    "Support ticket volume reaches at least 0.75 before Monthly active enabled-user rate is reviewed.",
    "Monthly active enabled-user rate is documented and support ticket resolution rate reaches at least 0.75.",
    "Regional Monthly active enabled-user rate context lists Monthly active enabled-user rate target is 0.8.",
    "Monthly active enabled-user rate maximum target is 0.75.",
    "Monthly active enabled-user rate maximum approved target is 0.75.",
  ]) {
    const value = clone();
    value.milestones[1].acceptanceCriteria[0].description = description;
    assertHas(value, "invalid_metric_acceptance_criterion");
  }
});

test("metric-backed accepted criteria require exact on-target observation evidence", () => {
  const missingObservation = clone();
  Object.assign(missingObservation.milestones[0].acceptanceCriteria[0], {
    metricRef: "metric-teams-active-user-rate",
    observationRef: "observation-missing",
    evidenceRef: "source-teams-adoption",
  });
  assertHas(missingObservation, "invalid_metric_acceptance_criterion");

  const crossEvidence = clone();
  Object.assign(crossEvidence.milestones[0].acceptanceCriteria[0], {
    metricRef: "metric-teams-active-user-rate",
    observationRef: "observation-teams-active-user-rate",
    evidenceRef: "source-teams-health",
  });
  assertHas(crossEvidence, "invalid_metric_acceptance_criterion");

  const belowTarget = clone();
  Object.assign(belowTarget.milestones[0].acceptanceCriteria[0], {
    metricRef: "metric-teams-active-user-rate",
    observationRef: "observation-teams-active-user-rate",
    evidenceRef: "source-teams-adoption",
  });
  assertHas(belowTarget, "invalid_metric_acceptance_criterion");
});

test("service health stays bound to exact service source window and incident state", () => {
  const adoptionAsHealth = clone();
  adoptionAsHealth.serviceHealthObservations[0].sourceRef = "source-teams-adoption";
  assertHas(adoptionAsHealth, "invalid_service_health_binding");

  const staleWindow = clone();
  staleWindow.serviceHealthObservations[0].windowEnd = "2026-08-30T23:59:59Z";
  assertHas(staleWindow, "invalid_service_health_window");

  const unsupportedHealthy = clone();
  unsupportedHealthy.serviceHealthObservations[0].incidentRef = "incident-123";
  assertHas(unsupportedHealthy, "invalid_service_health_status");
});

test("observation sources cannot predate their window end or observation time", () => {
  const adoptionBeforeObservation = clone();
  adoptionBeforeObservation.sources[1].collectedAt = "2026-09-01T12:00:00Z";
  assertHas(adoptionBeforeObservation, "invalid_observation_source_chronology");

  const healthBeforeWindowEnd = clone();
  healthBeforeWindowEnd.sources[2].collectedAt = "2026-08-30T12:00:00Z";
  assertHas(healthBeforeWindowEnd, "invalid_observation_source_chronology");
});

test("accepted milestones require criterion-complete human receipts and decisions", () => {
  const missingReceipt = clone();
  missingReceipt.milestoneReceipts = [];
  missingReceipt.milestones[0].receiptRefs = [];
  assertHas(missingReceipt, "incomplete_milestone_acceptance");

  const wrongCriterion = clone();
  wrongCriterion.milestoneReceipts[0].criterionRef = "criterion-adoption-target";
  assertHas(wrongCriterion, "invalid_milestone_receipt");

  const systemAcceptance = clone();
  systemAcceptance.milestoneReceipts[0].acceptedByRef = "principal-adoption-system";
  systemAcceptance.decisions[1].madeByRef = "principal-adoption-system";
  assertHas(systemAcceptance, "invalid_authority_owner");

  const prematureReceipt = clone();
  prematureReceipt.milestones[0].state = "at-risk";
  assertHas(prematureReceipt, "premature_milestone_acceptance");

  const mismatchedEvidence = clone();
  const alternateSource = structuredClone(mismatchedEvidence.sources[3]);
  alternateSource.id = "source-rollout-acceptance-other";
  alternateSource.sourceUri =
    "controlled://success-plans/contoso/milestones/teams-rollout/other-acceptance";
  mismatchedEvidence.sources.push(alternateSource);
  mismatchedEvidence.milestoneReceipts[0].sourceRef = alternateSource.id;
  mismatchedEvidence.decisions[1].evidenceRefs = [alternateSource.id];
  assertHas(mismatchedEvidence, "invalid_milestone_receipt");
});

test("completed actions require exact human-owned completion receipts", () => {
  const noReceipt = clone();
  noReceipt.actionReceipts = [];
  noReceipt.actions[0].receiptRefs = [];
  assertHas(noReceipt, "incomplete_action_receipt");

  const wrongSource = clone();
  wrongSource.actionReceipts[0].sourceRef = "source-teams-adoption";
  assertHas(wrongSource, "invalid_action_receipt");

  const systemOwner = clone();
  systemOwner.actions[0].ownerRef = "principal-adoption-system";
  assertHas(systemOwner, "invalid_authority_owner");

  const premature = clone();
  premature.actions[0].status = "in-progress";
  assertHas(premature, "premature_action_completion");
});

test("milestones actions receipts and evidence require exact workload service scope", () => {
  const crossMilestoneService = clone();
  crossMilestoneService.milestones[0].serviceRef = "service-other";
  assertHas(crossMilestoneService, "invalid_workload_service_scope");

  const nullActionWorkload = clone();
  nullActionWorkload.actions[0].workloadRef = null;
  assertHas(nullActionWorkload, "invalid_workload_service_scope");

  const nullScopedMilestoneEvidence = clone();
  nullScopedMilestoneEvidence.milestones[0].acceptanceCriteria[0].evidenceRef =
    "source-owner-review";
  assertHas(nullScopedMilestoneEvidence, "invalid_milestone_criterion_evidence");

  const crossActionEvidence = clone();
  crossActionEvidence.actions[0].evidenceRefs = ["source-owner-review"];
  assertHas(crossActionEvidence, "invalid_action_evidence_scope");

  const nullScopedReceiptSource = clone();
  nullScopedReceiptSource.actionReceipts[0].sourceRef = "source-owner-review";
  assertHas(nullScopedReceiptSource, "invalid_action_receipt");
});

test("risks and blockers keep evidence actions owners and closure receipts exact", () => {
  const missingEvidence = clone();
  missingEvidence.risksAndBlockers[0].evidenceRefs = ["source-missing"];
  assertHas(missingEvidence, "dangling_reference");

  const missingAction = clone();
  missingAction.risksAndBlockers[0].actionRefs = ["action-missing"];
  assertHas(missingAction, "dangling_reference");

  const prematureClosure = clone();
  prematureClosure.risksAndBlockers[0].status = "closed";
  prematureClosure.risksAndBlockers[0].actionRefs = ["action-adoption-remeasure"];
  assertHas(prematureClosure, "premature_risk_closure");
});

test("decision and review cadence chronology fail closed", () => {
  const futureDecision = clone();
  futureDecision.decisions[2].madeAt = "2026-09-15T18:30:00Z";
  assertHas(futureDecision, "invalid_decision_timestamp");

  const pastNextReview = clone();
  pastNextReview.cadence.nextReviewAt = "2026-09-13T19:00:00Z";
  assertHas(pastNextReview, "invalid_review_cadence");

  const systemCadenceOwner = clone();
  systemCadenceOwner.cadence.ownerRef = "principal-health-system";
  assertHas(systemCadenceOwner, "invalid_authority_owner");
});

test("renewal and escalation remain exact owner handoffs", () => {
  const noRenewalEvidence = clone();
  noRenewalEvidence.handoff.renewal.evidenceRefs = [];
  assertHas(noRenewalEvidence, "invalid_evidence_refs");

  const hiddenMaterialRisk = clone();
  hiddenMaterialRisk.handoff.escalation.riskRefs = [];
  assertHas(hiddenMaterialRisk, "invalid_escalation_handoff");

  const systemRenewalOwner = clone();
  systemRenewalOwner.handoff.renewal.ownerRef = "principal-health-system";
  assertHas(systemRenewalOwner, "invalid_authority_owner");
});

test("unresolved evidence outcomes risks and actions block owner-ready state", () => {
  const premature = clone();
  premature.review.state = "ready-for-owner-review";
  premature.handoff.state = "ready-for-owner-review";
  assertHas(premature, "premature_handoff_state");
});

test("all customer system support commercial renewal risk and success gates are mandatory", () => {
  for (const action of fixture.handoff.prohibitedActions) {
    const value = clone();
    value.handoff.prohibitedActions = value.handoff.prohibitedActions.filter(
      (candidate) => candidate !== action,
    );
    assertHas(value, "missing_authority_gate");
  }
});

test("every rendered narrative rejects prohibited claims", () => {
  const cases = [
    [(value) => (value.actions[0].summary = "The customer was contacted."), "action summary"],
    [
      (value) =>
        (value.actions[0].summary =
          "The customer was contacted and renewal was not committed."),
      "mixed affirmative and negated predicates",
    ],
    [
      (value) => (value.actions[0].summary = "We have contacted the customer."),
      "active perfect customer contact",
    ],
    [
      (value) =>
        (value.actions[0].summary =
          "We did not contact the customer but sent a message."),
      "coordinated affirmative message",
    ],
    [
      (value) =>
        (value.actions[0].summary =
          "The customer was not contacted but was emailed."),
      "coordinated passive contact",
    ],
    [
      (value) =>
        (value.actions[0].summary =
          "The customer did not receive an email but received a call."),
      "coordinated recipient contact",
    ],
    [
      (value) =>
        (value.actions[0].summary = "The customer has already been contacted."),
      "modified passive contact",
    ],
    [
      (value) =>
        (value.actions[0].summary = "The customer may have been contacted."),
      "modal passive contact",
    ],
    [
      (value) =>
        (value.actions[0].summary = "We may have contacted the customer."),
      "modal active contact",
    ],
    [
      (value) =>
        (value.actions[0].summary = "The implementation lead contacted the customer."),
      "general role contact",
    ],
    [
      (value) => (value.actions[0].summary = "Alice sent a message."),
      "named message send",
    ],
    [
      (value) =>
        (value.actions[0].summary =
          "We did not contact the customer or sent an email."),
      "or-coordinated affirmative message",
    ],
    [
      (value) =>
        (value.actions[0].summary =
          "We did not contact the customer but sent a message."),
      "coordinated mixed contact and message",
    ],
    [
      (value) => (value.actions[0].summary = "The customer has been contacted."),
      "perfect passive customer contact",
    ],
    [
      (value) => (value.actions[0].summary = "A message has been sent."),
      "perfect passive message",
    ],
    [
      (value) =>
        (value.actions[0].summary = "The agent sent a message to the customer."),
      "active message",
    ],
    [
      (value) => (value.actions[0].summary = "Alice contacted the customer."),
      "named active customer contact",
    ],
    [
      (value) =>
        (value.actions[0].summary = "The account manager contacted the customer."),
      "role-based customer contact",
    ],
    [
      (value) => (value.actions[0].summary = "Support emailed the customer."),
      "support customer contact",
    ],
    [
      (value) => (value.actions[0].summary = "The customer received an email."),
      "recipient-side customer contact",
    ],
    [
      (value) => (value.actions[0].summary = "The agent emailed the customer."),
      "active customer email",
    ],
    [
      (value) => (value.actions[0].summary = "We sent an email to the customer."),
      "active sent email",
    ],
    [(value) => (value.actions[0].summary = "We called the customer."), "active customer call"],
    [(value) => (value.actions[0].summary = "We emailed Contoso."), "scoped customer name"],
    [
      (value) => (value.actions[0].summary = "Alice contacted customer-contoso."),
      "scoped customer id",
    ],
    [(value) => (value.milestones[0].name = "The tenant was changed."), "milestone name"],
    [
      (value) => (value.milestones[0].name = "The workload has been configured."),
      "perfect passive workload change",
    ],
    [(value) => (value.milestones[0].name = "We changed pricing."), "active pricing change"],
    [(value) => (value.milestones[0].name = "We modified the tenant."), "active tenant mutation"],
    [
      (value) =>
        (value.milestones[0].name =
          "We did not change the tenant but updated the account."),
      "coordinated account mutation",
    ],
    [
      (value) =>
        (value.milestones[0].name = "We have successfully updated the tenant."),
      "modified active mutation",
    ],
    [
      (value) => (value.milestones[0].name = "The tenant was recently changed."),
      "modified passive mutation",
    ],
    [
      (value) => (value.milestones[0].name = "The tenant may have been changed."),
      "modal passive mutation",
    ],
    [(value) => (value.milestones[0].name = "We may have changed the tenant."), "modal active mutation"],
    [(value) => (value.milestones[0].name = "Pricing may have been changed."), "modal pricing mutation"],
    [
      (value) =>
        (value.milestones[0].name = "The implementation lead changed the tenant."),
      "role-based mutation",
    ],
    [
      (value) =>
        (value.milestones[0].name =
          "We did not change the tenant or updated the account."),
      "or-coordinated mutation",
    ],
    [
      (value) =>
        (value.milestones[0].name = "customer-contoso changed the tenant."),
      "customer-id mutation",
    ],
    [(value) => (value.milestones[0].name = "Alice changed the tenant."), "named mutation"],
    [
      (value) => (value.milestones[0].name = "We made a commercial promise."),
      "active commercial promise",
    ],
    [
      (value) => (value.milestones[0].name = "A commercial promise was made."),
      "passive commercial promise",
    ],
    [(value) => (value.milestones[0].name = "We messaged the customer."), "ordinary contact verb"],
    [(value) => (value.milestones[0].name = "The tenant was provisioned."), "ordinary configuration verb"],
    [(value) => (value.milestones[0].name = "We offered the customer a discount."), "ordinary commercial verb"],
    [(value) => (value.milestones[0].name = "We notified the customer."), "notify customer"],
    [(value) => (value.milestones[0].name = "We enabled the workload."), "enable workload"],
    [(value) => (value.milestones[0].name = "We renewed the account."), "renew account"],
    [(value) => (value.milestones[0].name = "We assumed the risk."), "assume risk"],
    [(value) => (value.milestones[0].name = "We declared the customer successful."), "declare success"],
    [(value) => (value.milestones[0].name = "Alice reached out to the customer."), "reach-out contact"],
    [(value) => (value.milestones[0].name = "We altered the tenant."), "alter tenant"],
    [(value) => (value.milestones[0].name = "Alice gave the customer a discount."), "give discount"],
    [(value) => (value.milestones[0].name = "The renewal went through."), "renewal completion"],
    [(value) => (value.milestones[0].name = "Alice waived the risk."), "waive risk"],
    [(value) => (value.milestones[0].name = "The customer is successful."), "successful customer"],
    [(value) => (value.milestones[0].name = "We phoned the customer."), "phone customer"],
    [(value) => (value.milestones[0].name = "We deactivated the account."), "deactivate account"],
    [(value) => (value.milestones[0].name = "We guaranteed the customer a discount."), "guarantee discount"],
    [(value) => (value.milestones[0].name = "We approved the risk."), "approve risk"],
    [(value) => (value.milestones[0].name = "The customer met the success criteria."), "meet success criteria"],
    [(value) => (value.milestones[0].name = "The workload was disabled."), "disable workload"],
    [(value) => (value.milestones[0].name = "The support case was resolved."), "resolve support case"],
    [(value) => (value.milestones[0].name = "The contract was amended."), "amend contract"],
    [(value) => (value.milestones[0].name = "Customer success was validated."), "validate success"],
    [
      (value) =>
        (value.milestones[0].acceptanceCriteria[0].description =
          "The support case was closed."),
      "milestone criterion",
    ],
    [
      (value) =>
        (value.milestones[0].acceptanceCriteria[0].description =
          "We closed the support case."),
      "active support closure",
    ],
    [(value) => (value.risksAndBlockers[0].summary = "Pricing was changed."), "risk summary"],
    [(value) => (value.decisions[0].result = "Renewal was committed."), "decision result"],
    [(value) => (value.decisions[0].result = "Renewal is committed."), "present passive renewal"],
    [
      (value) =>
        (value.actions[0].summary = "After committing the renewal, prepare the handoff."),
      "gerund renewal commitment",
    ],
    [(value) => (value.decisions[0].result = "We signed the renewal."), "active renewal signing"],
    [
      (value) =>
        (value.decisions[0].result = "The account manager committed the renewal."),
      "role-based renewal commitment",
    ],
    [
      (value) => (value.decisions[0].result = "Renewal has already been committed."),
      "modified passive renewal",
    ],
    [
      (value) => (value.decisions[0].result = "Renewal may have been committed."),
      "modal passive renewal",
    ],
    [(value) => (value.decisions[0].result = "Renewal was formally committed."), "adverbial renewal"],
    [(value) => (value.decisions[0].result = "We may have committed the renewal."), "modal active renewal"],
    [
      (value) =>
        (value.decisions[0].result = "Renewal was not committed but was signed."),
      "coordinated passive renewal",
    ],
    [(value) => (value.handoff.decisionNeeded = "Risk was accepted."), "handoff decision"],
    [
      (value) => (value.handoff.decisionNeeded = "Risk has been accepted."),
      "perfect passive risk acceptance",
    ],
    [
      (value) => (value.handoff.summary = "Customer success was achieved."),
      "handoff summary",
    ],
    [
      (value) => (value.handoff.summary = "Customer success has been achieved."),
      "perfect passive success claim",
    ],
    [
      (value) =>
        (value.handoff.summary =
          "We did not accept risk but confirmed customer success."),
      "coordinated success claim",
    ],
    [(value) => (value.handoff.summary = "Alice accepted risk."), "named risk acceptance"],
    [(value) => (value.handoff.summary = "Risk may have been accepted."), "modal risk acceptance"],
    [(value) => (value.handoff.summary = "Risk was explicitly accepted."), "adverbial risk acceptance"],
    [(value) => (value.handoff.summary = "We accepted the risk."), "article risk acceptance"],
    [
      (value) => (value.handoff.summary = "Accepting risk is complete."),
      "gerund risk acceptance",
    ],
    [
      (value) => (value.actions[0].summary = "After contacting the customer, continue."),
      "gerund customer contact",
    ],
    [
      (value) => (value.actions[0].summary = "After changing the tenant, continue."),
      "gerund system change",
    ],
    [
      (value) =>
        (value.actions[0].summary = "After offering the customer a discount, continue."),
      "gerund commercial promise",
    ],
    [
      (value) =>
        (value.actions[0].summary = "After confirming customer success, continue."),
      "gerund customer success",
    ],
    [
      (value) => (value.handoff.summary = "Contoso is successful."),
      "named customer success",
    ],
    [
      (value) => (value.actions[0].summary = "After reaching out to Contoso, continue."),
      "gerund named customer contact",
    ],
    [(value) => (value.actions[0].summary = "The tenant was reconfigured."), "passive reconfiguration"],
    [(value) => (value.actions[0].summary = "A discount was offered to Contoso."), "passive discount"],
    [(value) => (value.actions[0].summary = "The contract was renewed."), "passive renewal"],
    [(value) => (value.actions[0].summary = "Risk was assumed."), "passive assumed risk"],
    [(value) => (value.actions[0].summary = "Risk was waived."), "passive waived risk"],
    [(value) => (value.handoff.summary = "Alice declared Contoso successful."), "named success declaration"],
    [(value) => (value.actions[0].summary = "We reached the customer."), "customer reach synonym"],
    [(value) => (value.actions[0].summary = "We reset the tenant configuration."), "configuration reset"],
    [(value) => (value.actions[0].summary = "We agreed to the renewal."), "renewal agreement"],
    [(value) => (value.actions[0].summary = "We reduced the price."), "price reduction"],
    [(value) => (value.actions[0].summary = "The owner took on the risk."), "risk assumption"],
    [(value) => (value.handoff.summary = "Contoso achieved success."), "named success synonym"],
    [(value) => (value.actions[0].summary = "We corresponded with the customer."), "customer correspondence"],
    [(value) => (value.actions[0].summary = "We suspended the account."), "account suspension"],
    [(value) => (value.actions[0].summary = "We agreed to a discount for the customer."), "discount agreement"],
    [(value) => (value.actions[0].summary = "We finalized the renewal."), "renewal finalization"],
    [(value) => (value.actions[0].summary = "Alice consented to the risk."), "risk consent"],
    [(value) => (value.handoff.summary = "Contoso attained customer success."), "attained success"],
    [(value) => (value.actions[0].summary = "We sent the customer a message."), "indirect message send"],
    [(value) => (value.actions[0].summary = "We deleted the account."), "account deletion"],
    [(value) => (value.actions[0].summary = "We created a support case."), "support case creation"],
    [(value) => (value.handoff.summary = "Alice promised the customer a discount."), "commercial promise"],
    [
      (value) =>
        (value.handoff.summary = "The account manager confirmed customer success."),
      "role-based success claim",
    ],
    [
      (value) =>
        (value.handoff.summary = "Customer success has now been achieved."),
      "modified passive success claim",
    ],
    [
      (value) =>
        (value.handoff.summary = "Customer success may have been achieved."),
      "modal passive success claim",
    ],
    [(value) => (value.handoff.summary = "Customer success was clearly achieved."), "adverbial success claim"],
    [(value) => (value.handoff.summary = "The customer achieved customer success."), "customer success actor"],
    [
      (value) =>
        (value.metricDefinitions[0].unit = "The customer was contacted."),
      "rendered metric unit",
    ],
  ];
  for (const [mutate, label] of cases) {
    const value = clone();
    mutate(value);
    assert.doesNotThrow(() => findings(value), label);
    assert.ok(
      findings(value).some((item) => item.code === "unauthorized_outcome_claim"),
      `${label}: ${JSON.stringify(findings(value), null, 2)}`,
    );
  }
});

test("negated and pending authority language remains valid", () => {
  const value = clone();
  value.actions[0].summary = "The customer was not contacted.";
  value.milestones[0].name = "The customer has not been contacted.";
  value.milestones[0].acceptanceCriteria[0].description =
    "The support case was not closed.";
  value.risksAndBlockers[0].summary = "Pricing change is pending.";
  value.decisions[0].result =
    "The customer was not contacted and renewal is pending owner approval.";
  value.handoff.decisionNeeded = "Risk acceptance is pending.";
  value.handoff.summary =
    "Customer success has not been achieved and renewal has not been committed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "We did not send a message and we did not change pricing.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "Alice did not contact the customer and we did not make a commercial promise.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The agent did not email the customer; we did not modify the tenant; we did not sign the renewal.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "We did not call the customer and we did not send an email to the customer.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The account manager did not contact the customer and support did not email Contoso.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The customer did not receive an email and Contoso did not receive a call.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "No customer was contacted; it is pending confirmation whether the customer was contacted.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "Pending confirmation whether Contoso was contacted.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "It remains unconfirmed whether the customer was contacted.";
  value.handoff.summary = "Whether the customer was contacted is still pending.";
  value.handoff.decisionNeeded = "It is not confirmed that renewal was committed.";
  value.milestones[0].name = "No tenant was changed.";
  value.decisions[0].result = "No renewal was committed.";
  value.risksAndBlockers[0].summary = "Neither tenant nor account was changed.";
  value.actions[0].summary = "It is not true that the customer was contacted.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "Not once was the customer contacted.";
  value.milestones[0].name = "Neither the tenant nor the account was changed.";
  value.handoff.summary = "It has not been confirmed whether the customer was contacted.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The customer was not contacted nor was renewal committed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  for (const summary of [
    "We did not contact the customer nor change the tenant.",
    "We did not change the tenant nor contact the customer.",
    "We neither contacted the customer nor changed the tenant.",
    "We did not contact the customer nor did we change the tenant.",
    "We did not contact the customer or change the tenant.",
    "We did not contact the customer or commit the renewal.",
  ]) {
    value.actions[0].summary = summary;
    assertNotHas(value, "unauthorized_outcome_claim");
  }

  for (const summary of [
    "The tenant must not be changed.",
    "Renewal must not be committed.",
    "Risk must not be accepted.",
    "Customer success must not be claimed.",
  ]) {
    value.actions[0].summary = summary;
    assertNotHas(value, "unauthorized_outcome_claim");
  }

  for (const summary of [
    "There is no evidence that the customer was contacted.",
    "We cannot say that renewal was committed.",
    "It is false that the tenant was changed.",
  ]) {
    value.actions[0].summary = summary;
    assertNotHas(value, "unauthorized_outcome_claim");
  }
});

test("all rendered metric target prose matches the authoritative definition", () => {
  for (const mutate of [
    (value) =>
      (value.handoff.summary =
        "Monthly active enabled-user rate uses weekly sum aggregation and target is 75 percent."),
    (value) =>
      (value.handoff.summary =
        "metric-teams-active-user-rate uses weekly sum aggregation."),
    (value) =>
      (value.handoff.summary =
        "We calculate Monthly active enabled-user rate using weekly average aggregation."),
    (value) =>
      (value.handoff.summary =
        "For Monthly active enabled-user rate, lower values are better."),
    (value) =>
      (value.handoff.summary =
        "Monthly active enabled-user rate target is 75%, where lower values are better."),
    (value) =>
      (value.handoff.summary =
        "Monthly active enabled-user rate target is 75%. It uses weekly sum aggregation."),
    (value) =>
      (value.handoff.summary =
        "The approved Monthly active enabled-user rate target was lowered to 0.50."),
    (value) =>
      (value.actions[0].summary =
        "Use the new Monthly active enabled-user rate target of 0.50."),
    (value) =>
      (value.milestones[1].name = "Monthly active enabled-user rate goal: 50%."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate uses a trailing seven-day window."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate uses weekly sum aggregation."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate measures weekly active users."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate target changed to 0.50."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate is computed as daily users."),
    (value) =>
      (value.milestones[1].name =
        "Monthly active enabled-user rate is calculated by dividing weekly active users by enabled users."),
  ]) {
    const value = clone();
    mutate(value);
    assertHas(value, "invalid_authoritative_metric_definition");
  }

  const negatedIdentity = clone();
  negatedIdentity.actions[0].summary =
    "We did not email Contoso and Alice did not contact customer-contoso.";
  assertNotHas(negatedIdentity, "unauthorized_outcome_claim");
});

test("polarity cannot cross narrative predicate segments", () => {
  for (const summary of [
    "The customer was not contacted despite being emailed.",
    "The customer was not contacted when emailed.",
    "Risk was not accepted despite being waived.",
    "Renewal was not committed despite being signed.",
    "The tenant was not changed despite being updated.",
    "Customer success was not achieved despite being confirmed.",
    "The customer was not contacted, but they were emailed.",
    "The tenant was not changed, but it was updated.",
    "Customer contact is pending while renewal was committed.",
    "Renewal was committed, while the customer was not contacted.",
    "Renewal was committed although customer success was not confirmed.",
    "We contacted not only the customer but also the reseller.",
    "We did not contact the customer yet committed the renewal.",
    "We did not contact the customer but did send an email.",
    "We did not contact the customer and did email them.",
    "The customer was not contacted but was phoned.",
    "Although the customer was not contacted renewal was committed.",
    "Renewal remains pending because pricing was changed.",
    "No customer was contacted before renewal was committed.",
    "Neither evidence nor owner was missing when renewal was committed.",
    "We did not contact nor email the customer. Renewal was committed.",
    "Renewal was committed and we did not contact the customer nor change the tenant.",
    "We contacted the customer and did not change the tenant nor the account.",
    "We did not contact the customer or change the tenant, and renewal was committed.",
    "We did not contact the customer nor change the tenant, and risk was accepted.",
    "The customer was not ready when contacted.",
    "The customer was not contacted even though the customer was emailed.",
    "Customer success was not achieved but was confirmed.",
    "No customer was contacted: renewal was committed.",
    "Renewal was not committed but completed.",
    "Risk was not accepted but waived.",
    "The customer was not contacted before being emailed.",
    "Renewal was not committed before being signed.",
    "Risk was not accepted after being waived.",
  ]) {
    const value = clone();
    value.actions[0].summary = summary;
    assert.ok(
      findings(value).some((item) => item.code === "unauthorized_outcome_claim"),
      summary,
    );
  }

  const value = clone();
  value.actions[0].summary = "The customer wasn't contacted.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The internal review was approved; the action was completed; the evidence was signed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "We did not contact or email the customer.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "We did not contact, email, or call the customer.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "The non-renewal was approved and completed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "Renewal was neither approved nor completed; the customer was neither emailed nor called; the tenant was neither changed nor updated.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary =
    "The non renewal was approved; the non‑renewal was completed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "Renewal was not approved or completed.";
  assertNotHas(value, "unauthorized_outcome_claim");

  value.actions[0].summary = "The customer was not contacted or emailed.";
  value.handoff.summary = "Risk was not accepted or waived.";
  assertNotHas(value, "unauthorized_outcome_claim");
});

test("semantic validator is total over malformed records", () => {
  const malformed = clone();
  malformed.sources = [null];
  malformed.metricDefinitions = {};
  malformed.milestones = [
    {
      id: "malformed-milestone",
      acceptanceCriteria: {},
    },
  ];
  malformed.handoff = null;
  assert.doesNotThrow(() => findings(malformed));
  assert.ok(findings(malformed).length > 0);
});
