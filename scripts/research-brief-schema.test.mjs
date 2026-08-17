import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(await readFile(new URL("../claws/research-briefing/schemas/research-brief.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/research-briefing/fixtures/research-brief.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const isValid = (candidate) =>
  validate(candidate) && validateArtifactSemantics("research-briefing", candidate).length === 0;

function setPath(value, path, replacement) {
  const parts = path.split(".");
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[Number.isNaN(Number(part)) ? part : Number(part)];
  const key = parts.at(-1);
  if (replacement === null) delete target[key];
  else target[key] = replacement;
}

test("the Research Briefing schema accepts the packaged fixture", () => {
  assert.equal(isValid(fixture), true, JSON.stringify(validate.errors));
});

test("rejects claim without sources", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "claims.0.sources", []);
  assert.equal(isValid(candidate), false);
});

test("rejects ambiguous source authority", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "claims.0.sources.0.authority", "popular");
  assert.equal(isValid(candidate), false);
});

test("rejects hidden disagreement", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "disagreements", []);
  assert.equal(isValid(candidate), false);
});

test("rejects automatic publication", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "briefState", "published-by-agent");
  assert.equal(isValid(candidate), false);
});

test("rejects dangling and duplicate claim references", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "options.0.claimRefs", ["missing"]);
  assert.equal(isValid(candidate), false);
  setPath(candidate, "options.0.claimRefs", [
    fixture.claims[0].claim,
    fixture.claims[0].claim,
  ]);
  assert.equal(isValid(candidate), false);
});
