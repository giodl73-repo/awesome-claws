import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/security-analyst/schemas/threat-assessment.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/security-analyst/fixtures/threat-assessment.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test("the Security Analyst schema accepts the packaged assessment", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("the Security Analyst schema rejects scenarios without evidence", () => {
  const scenarios = fixture.scenarios.map((scenario, index) =>
    index === 0 ? { ...scenario, evidence: [] } : scenario,
  );
  assert.equal(validate({ ...fixture, scenarios }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});

test("the Security Analyst schema rejects ambiguous evidence conclusions", () => {
  const scenarios = fixture.scenarios.map((scenario, index) =>
    index === 0 ? { ...scenario, evidenceState: "probably-exploitable" } : scenario,
  );
  assert.equal(validate({ ...fixture, scenarios }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});

test("the Security Analyst schema requires authorization for active testing", () => {
  assert.equal(validate({ ...fixture, assessmentMode: "active-testing" }), false);
  assert.match(JSON.stringify(validate.errors), /must have required property/u);
});

test("the Security Analyst schema requires authorization for evidence review", () => {
  const { authorizationRef: _omitted, ...withoutAuthorization } = fixture;
  assert.equal(validate(withoutAuthorization), false);
  assert.match(JSON.stringify(validate.errors), /must have required property 'authorizationRef'/u);
});

test("the Security Analyst schema rejects exploitability-shaped terminal states", () => {
  assert.equal(validate({ ...fixture, assessmentState: "confirmed-exploitable" }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});
