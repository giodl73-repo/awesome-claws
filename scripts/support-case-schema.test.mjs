import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile(new URL("../claws/customer-support/schemas/support-case.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/customer-support/fixtures/support-case.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function setPath(value, path, replacement) {
  const parts = path.split(".");
  let target = value;
  for (const part of parts.slice(0, -1)) target = target[Number.isNaN(Number(part)) ? part : Number(part)];
  const key = parts.at(-1);
  if (replacement === null) delete target[key];
  else target[key] = replacement;
}

test("the Customer Support schema accepts the packaged fixture", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("rejects empty evidence", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "evidence", []);
  assert.equal(validate(candidate), false);
});

test("rejects secret request", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "diagnostics.0.dataClass", "password-or-token");
  assert.equal(validate(candidate), false);
});

test("rejects unowned escalation", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "escalation.owner", null);
  assert.equal(validate(candidate), false);
});

test("rejects automatic closure", () => {
  const candidate = structuredClone(fixture);
  setPath(candidate, "disposition", "closed-by-agent");
  assert.equal(validate(candidate), false);
});
