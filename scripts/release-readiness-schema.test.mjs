import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/release-coordinator/schemas/release-readiness.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/release-coordinator/fixtures/release-readiness.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

test("the Release Coordinator schema accepts the packaged readiness fixture", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("the Release Coordinator schema rejects ambiguous evidence states", () => {
  assert.equal(
    validate({
      ...fixture,
      checks: [{ name: "required CI", state: "unknown", evidence: "not checked" }],
    }),
    false,
  );
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});

test("the Release Coordinator schema rejects unbound target commits", () => {
  assert.equal(validate({ ...fixture, targetCommit: "latest" }), false);
  assert.match(JSON.stringify(validate.errors), /must match pattern/u);
});

test("the Release Coordinator schema rejects empty evidence ledgers", () => {
  assert.equal(validate({ ...fixture, checks: [] }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
  assert.equal(validate({ ...fixture, artifacts: [] }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});
