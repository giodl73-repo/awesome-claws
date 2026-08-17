import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(await readFile(new URL("../claws/project-manager/schemas/project-state.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/project-manager/fixtures/project-state.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const isValid = (candidate) =>
  validate(candidate) && validateArtifactSemantics("project-manager", candidate).length === 0;

function setPath(value, path, replacement) {
  const parts = path.split(".");
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[Number.isNaN(Number(part)) ? part : Number(part)];
  const key = parts.at(-1);
  if (replacement === null) delete target[key];
  else target[key] = replacement;
}

test("the Project Manager schema accepts the packaged fixture", () => {
  assert.equal(isValid(fixture), true, JSON.stringify(validate.errors));
});

test("rejects empty milestones", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "milestones", []);
  assert.equal(isValid(candidate), false);
});

test("rejects milestone without owner", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "milestones.0.owner", null);
  assert.equal(isValid(candidate), false);
});

test("rejects ambiguous milestone state", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "milestones.0.state", "almost-done");
  assert.equal(isValid(candidate), false);
});

test("rejects automatic scope change", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "statusState", "scope-changed-by-agent");
  assert.equal(isValid(candidate), false);
});

test("rejects dangling and duplicate milestone dependencies", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "milestones.1.dependencies", ["missing"]);
  assert.equal(isValid(candidate), false);
  setPath(candidate, "milestones.1.dependencies", ["M1", "M1"]);
  assert.equal(isValid(candidate), false);
});

test("rejects milestone dependency cycles", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "milestones.0.dependencies", ["M2"]);
  assert.equal(isValid(candidate), false);
});
