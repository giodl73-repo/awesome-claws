import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

function canonicalJson(value) {
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
}

const definitions = [
  {
    id: "change-control-operator",
    schema: "../claws/change-control-operator/schemas/change-plan.schema.json",
    fixture: "../claws/change-control-operator/fixtures/change-plan.example.json",
    decisionField: "decision.state",
  },
  {
    id: "case-continuity-coordinator",
    schema: "../claws/case-continuity-coordinator/schemas/case-checkpoint.schema.json",
    fixture: "../claws/case-continuity-coordinator/fixtures/case-checkpoint.example.json",
    decisionField: "decision.state",
  },
  {
    id: "delegation-coordinator",
    schema: "../claws/delegation-coordinator/schemas/delegation-ledger.schema.json",
    fixture: "../claws/delegation-coordinator/fixtures/delegation-ledger.example.json",
    decisionField: "synthesis.state",
  },
  {
    id: "financial-analyst",
    schema: "../claws/financial-analyst/schemas/financial-scenario.schema.json",
    fixture: "../claws/financial-analyst/fixtures/financial-scenario.example.json",
    decisionField: "decisionState",
  },
  {
    id: "green-thumb-coordinator",
    schema: "../claws/green-thumb-coordinator/schemas/garden-plan.schema.json",
    fixture: "../claws/green-thumb-coordinator/fixtures/garden-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "home-repair-coordinator",
    schema: "../claws/home-repair-coordinator/schemas/home-repair.schema.json",
    fixture: "../claws/home-repair-coordinator/fixtures/home-repair.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "model-evaluation-adjudicator",
    schema: "../claws/model-evaluation-adjudicator/schemas/model-evaluation.schema.json",
    fixture: "../claws/model-evaluation-adjudicator/fixtures/model-evaluation.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "pet-care-coordinator",
    schema: "../claws/pet-care-coordinator/schemas/pet-care.schema.json",
    fixture: "../claws/pet-care-coordinator/fixtures/pet-care.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "vehicle-service-coordinator",
    schema: "../claws/vehicle-service-coordinator/schemas/vehicle-service.schema.json",
    fixture: "../claws/vehicle-service-coordinator/fixtures/vehicle-service.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "public-safety-monitor",
    schema: "../claws/public-safety-monitor/schemas/public-safety-state.schema.json",
    fixture: "../claws/public-safety-monitor/fixtures/public-safety-state.example.json",
    decisionField: "state",
  },
  {
    id: "recruiting-coordinator",
    schema: "../claws/recruiting-coordinator/schemas/interview-plan.schema.json",
    fixture: "../claws/recruiting-coordinator/fixtures/interview-plan.example.json",
    decisionField: "planState",
  },
  {
    id: "sales-operations",
    schema: "../claws/sales-operations/schemas/pipeline-review.schema.json",
    fixture: "../claws/sales-operations/fixtures/pipeline-review.example.json",
    decisionField: "decisionState",
  },
  {
    id: "civic-data-analyst",
    schema: "../claws/civic-data-analyst/schemas/civic-evidence.schema.json",
    fixture: "../claws/civic-data-analyst/fixtures/civic-evidence.example.json",
    decisionField: "publicationState",
  },
];

const cases = new Map();
for (const definition of definitions) {
  const schema = JSON.parse(await readFile(new URL(definition.schema, import.meta.url), "utf8"));
  const fixture = JSON.parse(await readFile(new URL(definition.fixture, import.meta.url), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  cases.set(definition.id, {
    ...definition,
    fixture,
    fixturePath: definition.fixture,
    validate: ajv.compile(schema),
  });
}

function isValid(id, candidate) {
  const item = cases.get(id);
  return item.validate(candidate) && validateArtifactSemantics(id, candidate).length === 0;
}

for (const item of cases.values()) {
  test(`${item.id} accepts its packaged decision artifact`, () => {
    assert.equal(isValid(item.id, item.fixture), true, JSON.stringify(item.validate.errors));
  });
}

test("installed X3 instructions require the structured artifact contract", async () => {
  for (const item of cases.values()) {
    const instructions = await readFile(
      new URL(`../claws/${item.id}/workspace/AGENTS.md`, import.meta.url),
      "utf8",
    );
    const schemaPath = item.schema.slice(item.schema.indexOf("schemas/"));
    const fixturePath = item.fixturePath.slice(item.fixturePath.indexOf("fixtures/"));
    const name = schemaPath.split("/").at(-1).replace(/\.schema\.json$/u, "");
    for (const expected of [
      schemaPath,
      fixturePath,
      `templates/${name}.md`,
      `outputs/${item.id}-handoff.md`,
      "explicit decision by the named accountable owner",
    ]) {
      assert.match(instructions, new RegExp(expected.replaceAll(".", "\\."), "u"), item.id);
    }
  }
});

test("the public artifact validator accepts every packaged X3 fixture", () => {
  const validator = fileURLToPath(new URL("./validate-artifact.mjs", import.meta.url));
  for (const item of cases.values()) {
    const fixture = fileURLToPath(new URL(item.fixturePath, import.meta.url));
    const result = spawnSync(process.execPath, [validator, item.id, fixture], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${item.id}: ${result.stderr || result.stdout}`);
    assert.equal(JSON.parse(result.stdout).valid, true, item.id);
  }
});

test("financial analysis rejects dangling source and scenario references", () => {
  const candidate = structuredClone(cases.get("financial-analyst").fixture);
  candidate.assumptions[0].sourceRefs = ["missing-source"];
  assert.equal(isValid("financial-analyst", candidate), false);
  candidate.assumptions[0].sourceRefs = ["actuals-q2"];
  candidate.risks[0].scenarioRefs = ["missing-scenario"];
  assert.equal(isValid("financial-analyst", candidate), false);
});

test("public safety state rejects impossible time ranges and dangling alerts", () => {
  const candidate = structuredClone(cases.get("public-safety-monitor").fixture);
  candidate.alerts[0].expiresAt = candidate.alerts[0].issuedAt;
  assert.equal(isValid("public-safety-monitor", candidate), false);
  candidate.alerts[0].expiresAt = "2026-08-18T04:00:00Z";
  candidate.actions[0].alertRefs = ["missing-alert"];
  assert.equal(isValid("public-safety-monitor", candidate), false);
});

test("recruiting plans reject invalid sessions and dangling participants", () => {
  const candidate = structuredClone(cases.get("recruiting-coordinator").fixture);
  candidate.sessions[0].end = candidate.sessions[0].start;
  assert.equal(isValid("recruiting-coordinator", candidate), false);
  candidate.sessions[0].end = "2026-08-20T15:45:00Z";
  candidate.sessions[0].interviewerRefs = ["missing-interviewer"];
  assert.equal(isValid("recruiting-coordinator", candidate), false);
});

test("sales reviews reject deal references outside the supplied snapshot", () => {
  const candidate = structuredClone(cases.get("sales-operations").fixture);
  candidate.actions[0].dealRefs = ["missing-deal"];
  assert.equal(isValid("sales-operations", candidate), false);
});

test("civic evidence rejects incompatible source, measure, and geography references", () => {
  const candidate = structuredClone(cases.get("civic-data-analyst").fixture);
  candidate.measures[0].sourceRefs = ["missing-source"];
  assert.equal(isValid("civic-data-analyst", candidate), false);
  candidate.measures[0].sourceRefs = ["acs-vehicle"];
  candidate.comparisons[0].measureRefs = ["zero-vehicle-share", "missing-measure"];
  assert.equal(isValid("civic-data-analyst", candidate), false);
  candidate.comparisons[0].measureRefs = ["zero-vehicle-share", "evening-trips"];
  candidate.measures[0].geographyRef = "different-boundary";
  assert.equal(isValid("civic-data-analyst", candidate), false);
});

test("decision artifacts reject agent-owned terminal states", () => {
  for (const item of cases.values()) {
    const candidate = structuredClone(item.fixture);
    const parts = item.decisionField.split(".");
    const target = parts.slice(0, -1).reduce((value, key) => value[key], candidate);
    target[parts.at(-1)] = "committed-by-agent";
    assert.equal(isValid(item.id, candidate), false, item.id);
  }
});

test("decision artifacts reject duplicate semantic references", () => {
  const mutations = [
    ["change-control-operator", (value) => value.execution.stepResults.push(structuredClone(value.execution.stepResults[0]))],
    ["case-continuity-coordinator", (value) => value.actions[0].evidenceRefs.push(value.actions[0].evidenceRefs[0])],
    ["delegation-coordinator", (value) => value.synthesis.resultRefs.push(value.synthesis.resultRefs[0])],
    ["financial-analyst", (value) => value.risks[0].sourceRefs.push(value.risks[0].sourceRefs[0])],
    ["model-evaluation-adjudicator", (value) => value.disagreements[0].judgmentRefs.push(value.disagreements[0].judgmentRefs[0])],
    ["public-safety-monitor", (value) => value.actions[0].alertRefs.push(value.actions[0].alertRefs[0])],
    ["recruiting-coordinator", (value) => value.communications[0].sessionRefs.push(value.communications[0].sessionRefs[0])],
    ["sales-operations", (value) => value.actions[0].dealRefs.push(value.actions[0].dealRefs[0])],
    ["civic-data-analyst", (value) => value.measures[0].sourceRefs.push(value.measures[0].sourceRefs[0])],
  ];
  for (const [id, mutate] of mutations) {
    const candidate = structuredClone(cases.get(id).fixture);
    mutate(candidate);
    assert.equal(isValid(id, candidate), false, id);
  }
});

test("change control rejects digest drift and unsupported verification", () => {
  const candidate = structuredClone(cases.get("change-control-operator").fixture);
  candidate.decision.planDigest = "b".repeat(64);
  assert.equal(isValid("change-control-operator", candidate), false);
  candidate.decision.planDigest = candidate.plan.digest;
  candidate.execution.stepResults[0].state = "failed";
  assert.equal(isValid("change-control-operator", candidate), false);
  const changedPlan = structuredClone(cases.get("change-control-operator").fixture);
  changedPlan.plan.targets.push("config/production.yml");
  assert.equal(isValid("change-control-operator", changedPlan), false);
});

test("case continuity rejects broken chains and stale resume points", () => {
  const candidate = structuredClone(cases.get("case-continuity-coordinator").fixture);
  candidate.checkpoints[1].previousRef = "missing-checkpoint";
  assert.equal(isValid("case-continuity-coordinator", candidate), false);
  candidate.checkpoints[1].previousRef = candidate.checkpoints[0].id;
  candidate.resume.checkpointRef = candidate.checkpoints[0].id;
  assert.equal(isValid("case-continuity-coordinator", candidate), false);
  const stale = structuredClone(cases.get("case-continuity-coordinator").fixture);
  stale.evidence[0].expiresAt = stale.checkpoints.at(-1).recordedAt;
  assert.equal(isValid("case-continuity-coordinator", stale), false);
});

test("delegation rejects dangling provenance and mismatched worker sessions", () => {
  const candidate = structuredClone(cases.get("delegation-coordinator").fixture);
  candidate.results[0].assignmentRef = "missing-assignment";
  assert.equal(isValid("delegation-coordinator", candidate), false);
  candidate.results[0].assignmentRef = candidate.assignments[0].id;
  candidate.results[0].workerSessionRef = "agent:other:01";
  assert.equal(isValid("delegation-coordinator", candidate), false);
  const expanded = structuredClone(cases.get("delegation-coordinator").fixture);
  expanded.results[0].sourceRefs = ["accessibility-pack"];
  assert.equal(isValid("delegation-coordinator", expanded), false);
});

test("model evaluation rejects invalid score, coverage, and adjudication state", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.judgments[0].score = 8;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.judgments[0].score = 4;
  candidate.coverage.completedJudgments = 7;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.coverage.completedJudgments = 8;
  candidate.disagreements[0].state = "open";
  delete candidate.disagreements[0].adjudication;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation rejects dangling and incomparable judgments", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.disagreements[0].judgmentRefs[1] = "missing-judgment";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.disagreements[0].judgmentRefs[1] = "j-a-policy-1";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation blocks incomplete studies from owner-ready state", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.study.blinding.state = "partial";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.study.blinding.state = "verified";
  candidate.evaluators[0].calibrationState = "needs-review";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation requires every planned judgment and material disagreement", () => {
  const missingDisagreement = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  missingDisagreement.disagreements = [];
  assert.equal(isValid("model-evaluation-adjudicator", missingDisagreement), false);

  const omittedOutlier = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  omittedOutlier.evaluators.push({
    id: "evaluator-3",
    calibrationState: "calibrated",
    anchorRefs: omittedOutlier.evaluators[0].anchorRefs,
  });
  omittedOutlier.judgments.push({
    id: "j-b-policy-3",
    outputRef: "output-b",
    criterionRef: "policy",
    evaluatorRef: "evaluator-3",
    score: 1,
    evidenceRef: "evaluations/evaluator-3.json",
  });
  omittedOutlier.samplingPlan.push({
    outputRef: "output-b",
    criterionRef: "policy",
    evaluatorRef: "evaluator-3",
  });
  omittedOutlier.coverage.expectedJudgments += 1;
  omittedOutlier.coverage.completedJudgments += 1;
  omittedOutlier.disagreements[0].judgmentRefs = ["j-b-policy-1", "j-b-policy-3"];
  omittedOutlier.disagreements[0].spread = 0;
  omittedOutlier.disagreements[0].thresholdExceeded = false;
  assert.equal(isValid("model-evaluation-adjudicator", omittedOutlier), false);

  const decimalSpread = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  decimalSpread.judgments.find((item) => item.id === "j-b-policy-1").score = 1.1;
  decimalSpread.judgments.find((item) => item.id === "j-b-policy-2").score = 3.3;
  decimalSpread.disagreements[0].spread = 2.2;
  assert.equal(isValid("model-evaluation-adjudicator", decimalSpread), true);

  const incompleteMatrix = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  incompleteMatrix.judgments = [incompleteMatrix.judgments[0]];
  incompleteMatrix.samplingPlan = [incompleteMatrix.samplingPlan[0]];
  incompleteMatrix.coverage = {
    expectedJudgments: 1,
    completedJudgments: 1,
    missing: [],
  };
  incompleteMatrix.disagreements = [];
  assert.equal(isValid("model-evaluation-adjudicator", incompleteMatrix), false);
});

test("model evaluation binds calibration anchors to their criteria", () => {
  const incomplete = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  incomplete.evaluators[0].anchorRefs = ["anchor-accuracy-low"];
  assert.equal(isValid("model-evaluation-adjudicator", incomplete), false);

  const mismatched = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  mismatched.criteria[0].anchorRefs[0] = "anchor-policy-low";
  assert.equal(isValid("model-evaluation-adjudicator", mismatched), false);
});

test("model evaluation keeps blinding and terminal authority owner-controlled", () => {
  const exposed = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  exposed.outputs[0].blindLabel = "GPT-5.6";
  exposed.outputs[0].sourceRef = "outputs/gpt-5.6.json";
  assert.equal(isValid("model-evaluation-adjudicator", exposed), false);

  const identityBearingPath = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  identityBearingPath.outputs[0].sourceRef = "blinded/gpt-5.6.json";
  assert.equal(isValid("model-evaluation-adjudicator", identityBearingPath), false);

  const mismatchedOpaqueAlias = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  mismatchedOpaqueAlias.outputs[0].id = "output-gpt-5";
  mismatchedOpaqueAlias.outputs[0].sourceRef = "blinded/system-gpt-5.json";
  mismatchedOpaqueAlias.judgments
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });

  mismatchedOpaqueAlias.samplingPlan
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  assert.equal(isValid("model-evaluation-adjudicator", mismatchedOpaqueAlias), false);

  const identityBearingAlias = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  identityBearingAlias.outputs[0].blindLabel = "System GPT-5";
  identityBearingAlias.outputs[0].id = "output-gpt-5";
  identityBearingAlias.outputs[0].sourceRef = "blinded/system-gpt-5.json";
  identityBearingAlias.judgments
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  identityBearingAlias.samplingPlan
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  assert.equal(isValid("model-evaluation-adjudicator", identityBearingAlias), false);

  const agentOwned = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  agentOwned.study.decisionOwner.id = "model-evaluation-adjudicator";
  agentOwned.handoff.decisionOwner.id = "model-evaluation-adjudicator";
  assert.equal(isValid("model-evaluation-adjudicator", agentOwned), false);

  const incompleteProhibitions = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  incompleteProhibitions.handoff.prohibitedActions = ["deploy"];
  assert.equal(isValid("model-evaluation-adjudicator", incompleteProhibitions), false);
});

test("vehicle service binds safety, diagnosis, and appointment authority", () => {
  const unsafe = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unsafe.assessment.safeToDrive = "routine";
  assert.equal(isValid("vehicle-service-coordinator", unsafe), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  unsupportedDiagnosis.hypotheses[0].status = "technician-confirmed";
  assert.equal(isValid("vehicle-service-coordinator", unsupportedDiagnosis), false);

  const unsupportedCheck = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unsupportedCheck.ownerChecks[0].safetyClass = "manual-approved";
  unsupportedCheck.ownerChecks[0].evidenceRefs = ["ev-owner"];
  unsupportedCheck.hypotheses = [];
  assert.equal(isValid("vehicle-service-coordinator", unsupportedCheck), false);

  const exposedVin = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  exposedVin.vehicle.reference = "vehicle-1hgcm82633a004352";
  assert.equal(isValid("vehicle-service-coordinator", exposedVin), false);

  const exposedLowercaseVin = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  exposedLowercaseVin.observations[0].description += " VIN 1hgcm82633a004352.";
  assert.equal(isValid("vehicle-service-coordinator", exposedLowercaseVin), false);

  const agentOwned = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  agentOwned.owner.id = "vehicle-service-coordinator";
  agentOwned.handoff.owner.id = "vehicle-service-coordinator";
  assert.equal(isValid("vehicle-service-coordinator", agentOwned), false);
});

test("vehicle service rejects unapproved or drifted booking state", () => {
  const prematureReceipt = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  prematureReceipt.appointment.bookingIntegration = {
    id: "approved-integration-provider",
    providerRef: "provider-hybrid",
    approvalRef: "controlled://vehicle-service/integration-approval",
    configuredBy: prematureReceipt.owner,
  };
  prematureReceipt.appointment.receipt = {
    planDigest: `sha256:${"0".repeat(64)}`,
    integrationId: "approved-integration-provider",
    providerRef: "provider-hybrid",
    confirmationRef: "provider://provider-hybrid/confirmation-early",
    bookedAt: "2026-08-22T17:00:00Z",
  };
  assert.equal(isValid("vehicle-service-coordinator", prematureReceipt), false);

  const unapproved = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unapproved.appointment.state = "booked";
  assert.equal(isValid("vehicle-service-coordinator", unapproved), false);

  const invalidProvider = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  invalidProvider.appointment.plan.providerRef = "missing-provider";
  assert.equal(isValid("vehicle-service-coordinator", invalidProvider), false);

  const excessiveDeposit = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  excessiveDeposit.appointment.plan.maxDeposit = 300;
  assert.equal(isValid("vehicle-service-coordinator", excessiveDeposit), false);

  const booked = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(booked.appointment.plan))
    .digest("hex")}`;
  booked.appointment = {
    ...booked.appointment,
    state: "booked",
    approval: {
      owner: booked.owner,
      planDigest,
      approvedAt: "2026-08-22T18:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-provider",
      providerRef: "provider-hybrid",
      approvalRef: "controlled://vehicle-service/integration-approval",
      configuredBy: booked.owner,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-provider",
      providerRef: "provider-hybrid",
      confirmationRef: "provider://provider-hybrid/confirmation-1",
      bookedAt: "2026-08-22T17:00:00Z",
    },
  };
  assert.equal(isValid("vehicle-service-coordinator", booked), false);

  booked.appointment.receipt.bookedAt = "2026-08-22T19:00:00Z";
  booked.appointment.receipt.confirmationRef =
    "provider://unrelated-provider/confirmation-1";
  assert.equal(isValid("vehicle-service-coordinator", booked), false);
});

test("home repair rejects hazardous or unauthorized owner work", () => {
  const ownerLabels = structuredClone(cases.get("home-repair-coordinator").fixture);
  ownerLabels.home.reference = "primary-home";
  ownerLabels.home.locationLabel = "upstairs-hallway";
  assert.equal(isValid("home-repair-coordinator", ownerLabels), true);

  const hazardous = structuredClone(cases.get("home-repair-coordinator").fixture);
  hazardous.hazardAssessment.level = "high";
  hazardous.hazardAssessment.hazards = ["gas"];
  hazardous.hazardAssessment.action = "bounded-owner-check";
  assert.equal(isValid("home-repair-coordinator", hazardous), false);

  const hazardousInstructions = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  hazardousInstructions.hazardAssessment.level = "high";
  hazardousInstructions.hazardAssessment.hazards = ["gas"];
  hazardousInstructions.hazardAssessment.action = "qualified-trade";
  hazardousInstructions.repairPlan.eligibility = "specialist-only";
  assert.equal(isValid("home-repair-coordinator", hazardousInstructions), false);

  const roofInstructions = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  roofInstructions.hazardAssessment.level = "high";
  roofInstructions.hazardAssessment.hazards = ["roof"];
  roofInstructions.hazardAssessment.action = "qualified-trade";
  roofInstructions.repairPlan.eligibility = "specialist-only";
  assert.equal(isValid("home-repair-coordinator", roofInstructions), false);

  const inconsistentHazardLevel = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  inconsistentHazardLevel.hazardAssessment.level = "high";
  assert.equal(isValid("home-repair-coordinator", inconsistentHazardLevel), false);

  const unauthorized = structuredClone(cases.get("home-repair-coordinator").fixture);
  unauthorized.home.workAuthority = "landlord-required";
  assert.equal(isValid("home-repair-coordinator", unauthorized), false);

  const unisolated = structuredClone(cases.get("home-repair-coordinator").fixture);
  unisolated.isolations[0].state = "unknown";
  assert.equal(isValid("home-repair-coordinator", unisolated), false);

  const missingIsolation = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  missingIsolation.isolations = [];
  assert.equal(isValid("home-repair-coordinator", missingIsolation), false);

  const unsupportedIsolation = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedIsolation.isolations[0].evidenceRefs = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedIsolation), false);
});

test("home repair binds instructions, verification, and resident authority", () => {
  const unsupportedStep = structuredClone(cases.get("home-repair-coordinator").fixture);
  unsupportedStep.repairPlan.steps[0].evidenceRefs = ["ev-report"];
  unsupportedStep.repairPlan.hypotheses = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedStep), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedDiagnosis.repairPlan.hypotheses[0].status = "specialist-confirmed";
  unsupportedDiagnosis.evidence[0].authority = "qualified-specialist";
  assert.equal(isValid("home-repair-coordinator", unsupportedDiagnosis), false);

  const unsupportedVerification = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedVerification.verification.state = "passed";
  unsupportedVerification.verification.evidenceRefs = ["ev-manual"];
  unsupportedVerification.verification.unresolvedConditions = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedVerification), false);

  const unboundStep = structuredClone(cases.get("home-repair-coordinator").fixture);
  unboundStep.repairPlan.steps[0].observationRefs = ["obs-missing"];
  assert.equal(isValid("home-repair-coordinator", unboundStep), false);

  const missingHypothesis = structuredClone(cases.get("home-repair-coordinator").fixture);
  missingHypothesis.repairPlan.hypotheses = [];
  missingHypothesis.repairPlan.steps = [];
  assert.equal(isValid("home-repair-coordinator", missingHypothesis), false);

  const agentOwned = structuredClone(cases.get("home-repair-coordinator").fixture);
  agentOwned.resident.id = "home-repair-coordinator";
  agentOwned.handoff.resident.id = "home-repair-coordinator";
  assert.equal(isValid("home-repair-coordinator", agentOwned), false);
});

test("home repair rejects address leakage and unapproved appointments", () => {
  const addressLeak = structuredClone(cases.get("home-repair-coordinator").fixture);
  addressLeak.observations[0].description += " Service address: 123 Main Street.";
  assert.equal(isValid("home-repair-coordinator", addressLeak), false);

  const terraceLeak = structuredClone(cases.get("home-repair-coordinator").fixture);
  terraceLeak.observations[0].description += " Service address: 742 Evergreen Terrace.";
  assert.equal(isValid("home-repair-coordinator", terraceLeak), false);

  const alphanumericAddressLeak = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  alphanumericAddressLeak.observations[0].description +=
    " Service address: 123A Main Street.";
  assert.equal(isValid("home-repair-coordinator", alphanumericAddressLeak), false);

  const sluggedAddressLeak = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  sluggedAddressLeak.home.reference = "home-123-main-st";
  assert.equal(isValid("home-repair-coordinator", sluggedAddressLeak), false);

  const invalidProvider = structuredClone(cases.get("home-repair-coordinator").fixture);
  invalidProvider.appointment.plan.trade = "electrician";
  assert.equal(isValid("home-repair-coordinator", invalidProvider), false);

  const unsupportedProvider = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-manual";
  assert.equal(isValid("home-repair-coordinator", unsupportedProvider), false);

  unsupportedProvider.appointment = { state: "not-requested" };
  assert.equal(isValid("home-repair-coordinator", unsupportedProvider), false);

  const prematureReceipt = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  prematureReceipt.appointment.bookingIntegration = {
    id: "approved-integration-provider",
    providerRef: "provider-appliance",
    approvalRef: "controlled://home-repair/integration-approval",
    approvalEvidenceRef: "ev-report",
    configuredBy: prematureReceipt.resident,
  };
  prematureReceipt.appointment.receipt = {
    planDigest: `sha256:${"0".repeat(64)}`,
    integrationId: "approved-integration-provider",
    providerRef: "provider-appliance",
    confirmationRef: "provider://provider-appliance/confirmation-early",
    evidenceRef: "ev-provider",
    bookedAt: "2026-08-23T17:00:00Z",
  };
  assert.equal(isValid("home-repair-coordinator", prematureReceipt), false);
});

test("green thumb rejects unsafe or unsupported resident care", () => {
  const hazardous = structuredClone(cases.get("green-thumb-coordinator").fixture);
  hazardous.riskAssessment.level = "high";
  hazardous.riskAssessment.risks = ["regulated-pesticide"];
  hazardous.riskAssessment.action = "qualified-specialist";
  assert.equal(isValid("green-thumb-coordinator", hazardous), false);

  hazardous.carePlan.eligibility = "specialist-only";
  hazardous.carePlan.steps = [];
  hazardous.calendar[0].activity = "Prune the unstable tree limb above the bed.";
  assert.equal(isValid("green-thumb-coordinator", hazardous), false);

  const contradictoryRisk = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  contradictoryRisk.riskAssessment.level = "uncertain";
  contradictoryRisk.carePlan.eligibility = "specialist-only";
  contradictoryRisk.carePlan.steps = [];
  assert.equal(isValid("green-thumb-coordinator", contradictoryRisk), false);

  contradictoryRisk.riskAssessment.level = "high";
  contradictoryRisk.riskAssessment.action = "qualified-specialist";
  contradictoryRisk.calendar[0].executor = "resident";
  assert.equal(isValid("green-thumb-coordinator", contradictoryRisk), false);

  const understatedRisk = structuredClone(cases.get("green-thumb-coordinator").fixture);
  understatedRisk.riskAssessment.risks = ["regulated-pesticide"];
  understatedRisk.carePlan.eligibility = "specialist-only";
  understatedRisk.carePlan.steps = [];
  understatedRisk.calendar[0].executor = "qualified-specialist";
  assert.equal(isValid("green-thumb-coordinator", understatedRisk), false);

  const unauthorized = structuredClone(cases.get("green-thumb-coordinator").fixture);
  unauthorized.site.workAuthority = "landlord-required";
  assert.equal(isValid("green-thumb-coordinator", unauthorized), false);

  const unsupportedProduct = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedProduct.carePlan.steps[0].class = "label-approved-product";
  unsupportedProduct.carePlan.steps[0].productUse = {
    productName: "Restricted pesticide",
    target: "tomato",
    labelRef: "ev-extension",
    localRuleRefs: ["ev-zone"],
    licenseRequired: true,
    applicationLimits: "Unknown",
  };
  assert.equal(isValid("green-thumb-coordinator", unsupportedProduct), false);
});

test("green thumb binds seasonal evidence and monitored outcomes", () => {
  const unsupportedCalendar = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedCalendar.calendar[0].siteEvidenceRefs = ["ev-report"];
  assert.equal(isValid("green-thumb-coordinator", unsupportedCalendar), false);

  const reversedWindow = structuredClone(cases.get("green-thumb-coordinator").fixture);
  reversedWindow.calendar[0].windowEnd = "2026-03-01";
  assert.equal(isValid("green-thumb-coordinator", reversedWindow), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedDiagnosis.hypotheses[0].status = "specialist-confirmed";
  assert.equal(isValid("green-thumb-coordinator", unsupportedDiagnosis), false);

  const unsupportedOutcome = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedOutcome.monitoring[0].state = "passed";
  unsupportedOutcome.monitoring[0].evidenceRefs = ["ev-extension"];
  unsupportedOutcome.monitoring[0].observedAt = "2026-03-25T16:00:00Z";
  assert.equal(isValid("green-thumb-coordinator", unsupportedOutcome), false);

  const staleOutcome = structuredClone(cases.get("green-thumb-coordinator").fixture);
  staleOutcome.monitoring[0].state = "passed";
  staleOutcome.monitoring[0].evidenceRefs = ["ev-photo"];
  staleOutcome.monitoring[0].observedAt = "2026-03-18T16:10:00Z";
  assert.equal(isValid("green-thumb-coordinator", staleOutcome), false);

  const unsupportedFailure = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedFailure.monitoring[0].state = "failed";
  assert.equal(isValid("green-thumb-coordinator", unsupportedFailure), false);
});

test("green thumb protects resident and appointment authority", () => {
  const addressLeak = structuredClone(cases.get("green-thumb-coordinator").fixture);
  addressLeak.observations[0].description += " Service address: 742 Evergreen Terrace.";
  assert.equal(isValid("green-thumb-coordinator", addressLeak), false);

  const circleAddressLeak = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  circleAddressLeak.observations[0].description += " Service address: 123 Main Circle.";
  assert.equal(isValid("green-thumb-coordinator", circleAddressLeak), false);

  const unsupportedProvider = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-extension";
  assert.equal(isValid("green-thumb-coordinator", unsupportedProvider), false);

  const invalidSpecialty = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  invalidSpecialty.appointment.plan.specialty = "certified-arborist";
  assert.equal(isValid("green-thumb-coordinator", invalidSpecialty), false);

  const lateBooking = structuredClone(cases.get("green-thumb-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(lateBooking.appointment.plan))
    .digest("hex")}`;
  lateBooking.evidence.push(
    {
      id: "ev-integration",
      type: "integration-approval",
      authority: "resident-supplied",
      capturedAt: "2026-04-02T16:00:00Z",
      reference: "controlled://green-thumb/integration-approval",
    },
    {
      id: "ev-receipt",
      type: "provider-receipt",
      authority: "service-provider",
      capturedAt: "2026-04-01T16:00:00Z",
      reference: "provider://provider-plant-health/confirmation-1",
    },
  );
  lateBooking.appointment = {
    ...lateBooking.appointment,
    state: "booked",
    approval: {
      resident: lateBooking.resident,
      planDigest,
      approvedAt: "2026-03-20T16:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-plant-health",
      providerRef: "provider-plant-health",
      approvalRef: "controlled://green-thumb/integration-approval",
      approvalEvidenceRef: "ev-integration",
      configuredBy: lateBooking.resident,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-plant-health",
      providerRef: "provider-plant-health",
      confirmationRef: "provider://provider-plant-health/confirmation-1",
      evidenceRef: "ev-receipt",
      bookedAt: "2026-04-01T16:00:00Z",
    },
  };
  assert.equal(isValid("green-thumb-coordinator", lateBooking), false);

  const agentOwned = structuredClone(cases.get("green-thumb-coordinator").fixture);
  agentOwned.resident.id = "green-thumb-coordinator";
  agentOwned.handoff.resident.id = "green-thumb-coordinator";
  assert.equal(isValid("green-thumb-coordinator", agentOwned), false);
});

test("pet care rejects unsafe or unsupported guardian care", () => {
  const emergency = structuredClone(cases.get("pet-care-coordinator").fixture);
  emergency.assessment.risks = ["breathing-distress"];
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.assessment.level = "emergency";
  emergency.assessment.action = "emergency-veterinary";
  emergency.careCalendar[0].executor = "veterinarian";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.appointment = {
    state: "blocked",
    blockedReason: "Seek immediate emergency veterinary care.",
  };
  emergency.handoff.state = "blocked";
  emergency.careCalendar = [];
  assert.equal(isValid("pet-care-coordinator", emergency), true);

  emergency.careCalendar = structuredClone(
    cases.get("pet-care-coordinator").fixture.careCalendar,
  );
  emergency.assessment.action = "poison-control";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.assessment.action = "emergency-veterinary";
  emergency.careCalendar[0].executor = "guardian";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  const understatedUrgency = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  understatedUrgency.assessment.risks = ["persistent-vomiting"];
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.assessment.risks = ["foreign-body"];
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.assessment.level = "emergency";
  understatedUrgency.assessment.action = "emergency-veterinary";
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.appointment = {
    state: "blocked",
    blockedReason: "Seek immediate emergency veterinary care.",
  };
  understatedUrgency.handoff.state = "blocked";
  understatedUrgency.careCalendar[0].executor = "guardian";
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  const unsupportedMedication = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unsupportedMedication.careCalendar[0].kind = "veterinarian-directed-medication";
  unsupportedMedication.careCalendar[0].instruction =
    "Give a medication using the guardian report.";
  unsupportedMedication.careCalendar[0].evidenceRefs = ["ev-report"];
  assert.equal(isValid("pet-care-coordinator", unsupportedMedication), false);

  const reversedWindow = structuredClone(cases.get("pet-care-coordinator").fixture);
  reversedWindow.careCalendar[0].dueEnd = "2026-08-01T17:00:00Z";
  assert.equal(isValid("pet-care-coordinator", reversedWindow), false);
});

test("pet care binds outcome and provider evidence", () => {
  for (const [type, authority] of [
    ["laboratory-result", "veterinary-laboratory"],
    ["manufacturer-label", "manufacturer"],
    ["government-guidance", "government"],
  ]) {
    const supportedPreventive = structuredClone(
      cases.get("pet-care-coordinator").fixture,
    );
    const record = supportedPreventive.evidence.find((item) => item.id === "ev-record");
    record.type = type;
    record.authority = authority;
    assert.equal(isValid("pet-care-coordinator", supportedPreventive), true);
  }

  const staleOutcome = structuredClone(cases.get("pet-care-coordinator").fixture);
  staleOutcome.monitoring[0].state = "stable";
  staleOutcome.monitoring[0].observedAt = "2026-08-20T19:30:00Z";
  staleOutcome.monitoring[0].evidenceRefs = ["ev-report"];
  assert.equal(isValid("pet-care-coordinator", staleOutcome), false);

  const unsupportedProvider = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-record";
  assert.equal(isValid("pet-care-coordinator", unsupportedProvider), false);

  const unverifiedProvider = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unverifiedProvider.providers[0].qualificationState = "unverified";
  assert.equal(isValid("pet-care-coordinator", unverifiedProvider), false);

  const addressLeak = structuredClone(cases.get("pet-care-coordinator").fixture);
  addressLeak.observations[0].description += " Home address: 123 Main Circle.";
  assert.equal(isValid("pet-care-coordinator", addressLeak), false);
});

test("pet care protects guardian appointment authority", () => {
  const missingBoundary = structuredClone(cases.get("pet-care-coordinator").fixture);
  missingBoundary.handoff.prohibitedActions =
    missingBoundary.handoff.prohibitedActions.filter(
      (action) => action !== "delay-emergency-care",
    );
  assert.equal(isValid("pet-care-coordinator", missingBoundary), false);

  const unexplainedBlock = structuredClone(cases.get("pet-care-coordinator").fixture);
  unexplainedBlock.appointment = { state: "blocked" };
  assert.equal(isValid("pet-care-coordinator", unexplainedBlock), false);

  const unrequestedPlan = structuredClone(cases.get("pet-care-coordinator").fixture);
  unrequestedPlan.appointment.state = "not-requested";
  assert.equal(isValid("pet-care-coordinator", unrequestedPlan), false);

  const driftedApproval = structuredClone(cases.get("pet-care-coordinator").fixture);
  driftedApproval.appointment.state = "approved";
  driftedApproval.appointment.approval = {
    guardian: driftedApproval.guardian,
    planDigest: `sha256:${"0".repeat(64)}`,
    approvedAt: "2026-08-20T16:00:00Z",
  };
  assert.equal(isValid("pet-care-coordinator", driftedApproval), false);

  const lateBooking = structuredClone(cases.get("pet-care-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(lateBooking.appointment.plan))
    .digest("hex")}`;
  lateBooking.evidence.push(
    {
      id: "ev-integration",
      type: "integration-approval",
      authority: "guardian-supplied",
      capturedAt: "2026-08-20T16:00:00Z",
      reference: "controlled://pet-care/integration-approval",
    },
    {
      id: "ev-receipt",
      type: "provider-receipt",
      authority: "service-provider",
      capturedAt: "2026-08-22T17:00:00Z",
      reference: "provider://provider-general/confirmation-1",
    },
  );
  lateBooking.appointment = {
    ...lateBooking.appointment,
    state: "booked",
    approval: {
      guardian: lateBooking.guardian,
      planDigest,
      approvedAt: "2026-08-20T16:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-veterinary",
      providerRef: "provider-general",
      approvalRef: "controlled://pet-care/integration-approval",
      approvalEvidenceRef: "ev-integration",
      configuredBy: lateBooking.guardian,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-veterinary",
      providerRef: "provider-general",
      confirmationRef: "provider://provider-general/confirmation-1",
      evidenceRef: "ev-receipt",
      bookedAt: "2026-08-22T17:00:00Z",
    },
  };
  assert.equal(isValid("pet-care-coordinator", lateBooking), false);

  const agentOwned = structuredClone(cases.get("pet-care-coordinator").fixture);
  agentOwned.guardian.id = "pet-care-coordinator";
  agentOwned.handoff.guardian.id = "pet-care-coordinator";
  assert.equal(isValid("pet-care-coordinator", agentOwned), false);
});

test("capstone profiles expose only their intended runtime dimensions", async () => {
  const manifests = new Map(
    await Promise.all(
      ["change-control-operator", "case-continuity-coordinator", "delegation-coordinator"].map(
        async (id) => [id, await readFile(new URL(`../claws/${id}/profiles/openclaw.yml`, import.meta.url), "utf8")],
      ),
    ),
  );
  assert.match(manifests.get("change-control-operator"), /apply_patch/u);
  assert.doesNotMatch(manifests.get("change-control-operator"), /sessions_spawn/u);
  assert.match(manifests.get("delegation-coordinator"), /sessions_spawn/u);
  assert.match(manifests.get("delegation-coordinator"), /agents_wait/u);
  assert.doesNotMatch(manifests.get("delegation-coordinator"), /\n\s+- exec\b/u);
  assert.doesNotMatch(manifests.get("case-continuity-coordinator"), /sessions_spawn|exec|process/u);
});
