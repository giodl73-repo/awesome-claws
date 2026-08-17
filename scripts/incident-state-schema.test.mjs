import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL("../claws/incident-response/schemas/incident-state.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL("../claws/incident-response/fixtures/incident-state.example.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test("the Incident Response schema accepts the packaged incident state", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("the Incident Response schema rejects empty timelines", () => {
  assert.equal(validate({ ...fixture, timeline: [] }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});

test("the Incident Response schema rejects ambiguous timeline events", () => {
  const timeline = fixture.timeline.map((event, index) =>
    index === 0 ? { ...event, kind: "maybe-action" } : event,
  );
  assert.equal(validate({ ...fixture, timeline }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});

test("the Incident Response schema requires mitigation approvals", () => {
  const mitigations = fixture.mitigations.map((mitigation, index) => {
    if (index !== 0) return mitigation;
    const { approvalRef: _omitted, ...withoutApproval } = mitigation;
    return withoutApproval;
  });
  assert.equal(validate({ ...fixture, mitigations }), false);
  assert.match(JSON.stringify(validate.errors), /must have required property 'approvalRef'/u);
});

test("the Incident Response schema rejects unowned closure states", () => {
  assert.equal(validate({ ...fixture, decisionState: "closed-automatically" }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});
