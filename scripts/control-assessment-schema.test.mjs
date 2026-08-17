import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/compliance-reviewer/schemas/control-assessment.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/compliance-reviewer/fixtures/control-assessment.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test("the Compliance Reviewer schema accepts the packaged assessment", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("the Compliance Reviewer schema rejects empty requirement sets", () => {
  assert.equal(validate({ ...fixture, requirements: [] }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});

test("the Compliance Reviewer schema rejects ambiguous evidence states", () => {
  const requirements = fixture.requirements.map((requirement, index) =>
    index === 0 ? { ...requirement, evidenceState: "probably-supported" } : requirement,
  );
  assert.equal(validate({ ...fixture, requirements }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});

test("the Compliance Reviewer schema requires compensating-control detail", () => {
  const requirements = fixture.requirements.map((requirement) => {
    if (requirement.evidenceState !== "compensating-control") return requirement;
    const { compensatingControl: _omitted, ...withoutCompensatingControl } = requirement;
    return withoutCompensatingControl;
  });
  assert.equal(validate({ ...fixture, requirements }), false);
  assert.match(JSON.stringify(validate.errors), /must have required property 'compensatingControl'/u);
});

test("the Compliance Reviewer schema rejects certification-shaped decisions", () => {
  assert.equal(validate({ ...fixture, assessmentDecision: "certified-compliant" }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});
