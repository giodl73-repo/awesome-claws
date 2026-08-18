import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

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
