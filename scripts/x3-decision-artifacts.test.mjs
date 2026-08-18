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
    candidate[item.decisionField] = "committed-by-agent";
    assert.equal(isValid(item.id, candidate), false, item.id);
  }
});

test("decision artifacts reject duplicate semantic references", () => {
  const mutations = [
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
