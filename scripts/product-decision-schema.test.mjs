import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(await readFile(new URL("../claws/product-manager/schemas/product-decision.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/product-manager/fixtures/product-decision.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const isValid = (candidate) =>
  validate(candidate) && validateArtifactSemantics("product-manager", candidate).length === 0;

function setPath(value, path, replacement) {
  const parts = path.split(".");
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[Number.isNaN(Number(part)) ? part : Number(part)];
  const key = parts.at(-1);
  if (replacement === null) delete target[key];
  else target[key] = replacement;
}

test("the Product Manager schema accepts the packaged fixture", () => {
  assert.equal(isValid(fixture), true, JSON.stringify(validate.errors));
});

test("rejects empty evidence", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "evidence", []);
  assert.equal(isValid(candidate), false);
});

test("rejects unlabeled preference", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "evidence.0.kind", "fact");
  assert.equal(isValid(candidate), false);
});

test("rejects validation without failure threshold", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "hypothesis.failureThreshold", null);
  assert.equal(isValid(candidate), false);
});

test("rejects automatic roadmap commitment", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "decisionState", "committed-by-agent");
  assert.equal(isValid(candidate), false);
});

test("rejects dangling and duplicate evidence references", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "options.0.evidenceRefs", ["missing"]);
  assert.equal(isValid(candidate), false);
  setPath(candidate, "options.0.evidenceRefs", [
    "research/onboarding-2026-q2",
    "research/onboarding-2026-q2",
  ]);
  assert.equal(isValid(candidate), false);
});

test("rejects recommendations without supported evidence", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "options.2.evidenceRefs", ["strategy/workshop-notes"]);
  assert.equal(isValid(candidate), false);
});
