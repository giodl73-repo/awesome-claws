import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(await readFile(new URL("../claws/data-analyst/schemas/analysis-state.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/data-analyst/fixtures/analysis-state.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const isValid = (candidate) =>
  validate(candidate) && validateArtifactSemantics("data-analyst", candidate).length === 0;

function setPath(value, path, replacement) {
  const parts = path.split(".");
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[Number.isNaN(Number(part)) ? part : Number(part)];
  const key = parts.at(-1);
  if (replacement === null) delete target[key];
  else target[key] = replacement;
}

test("the Data Analyst schema accepts the packaged fixture", () => {
  assert.equal(isValid(fixture), true, JSON.stringify(validate.errors));
});

test("rejects empty sources", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "sources", []);
  assert.equal(isValid(candidate), false);
});

test("rejects ambiguous evidence state", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "sources.0.state", "probably");
  assert.equal(isValid(candidate), false);
});

test("rejects missing metric lineage", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "metrics.0.lineageRefs", []);
  assert.equal(isValid(candidate), false);
});

test("rejects automatic causal conclusion", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "decisionState", "causally-proven");
  assert.equal(isValid(candidate), false);
});

test("rejects dangling lineage and metric references", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "metrics.0.lineageRefs", ["missing-source"]);
  assert.equal(isValid(candidate), false);
  setPath(candidate, "metrics.0.lineageRefs", ["warehouse/onboarding-cohorts-v4"]);
  setPath(candidate, "findings.0.metricRefs", ["missing-metric"]);
  assert.equal(isValid(candidate), false);
});

test("rejects duplicate semantic identifiers", () => {
  const candidate = structuredClone(fixture);
  candidate.sources.push(structuredClone(candidate.sources[0]));
  assert.equal(isValid(candidate), false);
});
