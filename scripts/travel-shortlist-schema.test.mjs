import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL("../claws/travel-concierge/schemas/travel-shortlist.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const validShortlist = {
  retrievedAt: "2026-07-31T18:30:00Z",
  currency: "USD",
  options: [
    {
      kind: "lodging",
      name: "Museum district stay",
      provider: "Expedia Group",
      retrievedAt: "2026-07-31T18:30:00Z",
      sourceUrl: "https://www.expedia.com/example-hotel",
      priceSummary: "USD 840 total before any taxes or fees not shown by the provider",
      caveats: ["Traveler must recheck availability and cancellation terms before purchase."],
    },
  ],
  travelerDecisions: ["Choose whether refundable terms justify the higher displayed price."],
};

test("the Golden travel shortlist schema accepts a sourced Expedia option", () => {
  assert.equal(validate(validShortlist), true, JSON.stringify(validate.errors));
});

test("the Golden travel shortlist schema rejects empty and unsourced options", () => {
  assert.equal(validate({ ...validShortlist, options: [] }), false);
  assert.equal(
    validate({
      ...validShortlist,
      options: [{ ...validShortlist.options[0], provider: "Unknown provider" }],
    }),
    false,
  );
});

test("the Golden travel shortlist schema rejects unsafe and unrelated source URLs", () => {
  assert.equal(
    validate({
      ...validShortlist,
      options: [{ ...validShortlist.options[0], sourceUrl: "javascript:alert(1)" }],
    }),
    false,
  );
  assert.equal(
    validate({
      ...validShortlist,
      options: [{ ...validShortlist.options[0], sourceUrl: "https://example.com/hotel" }],
    }),
    false,
  );
  assert.equal(
    validate({
      ...validShortlist,
      options: [{ ...validShortlist.options[0], sourceUrl: "http://www.expedia.com/hotel" }],
    }),
    false,
  );
});
