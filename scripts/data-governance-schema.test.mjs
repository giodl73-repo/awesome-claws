import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/data-governance-steward/schemas/data-governance-assessment.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/data-governance-steward/fixtures/data-governance-assessment.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test("the Data Governance Steward schema accepts the packaged assessment", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});

test("the Data Governance Steward schema rejects products without critical elements", () => {
  const dataProducts = fixture.dataProducts.map((product, index) =>
    index === 0 ? { ...product, criticalDataElements: [] } : product,
  );
  assert.equal(validate({ ...fixture, dataProducts }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});

test("the Data Governance Steward schema rejects empty evidence", () => {
  assert.equal(validate({ ...fixture, evidence: [] }), false);
  assert.match(JSON.stringify(validate.errors), /must NOT have fewer than 1 items/u);
});

test("the Data Governance Steward schema rejects ambiguous evidence states", () => {
  const evidence = fixture.evidence.map((item, index) =>
    index === 0 ? { ...item, state: "probably-current" } : item,
  );
  assert.equal(validate({ ...fixture, evidence }), false);
  assert.match(JSON.stringify(validate.errors), /must be equal to one of the allowed values/u);
});
