import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildRecurringBusinessReview, checkRecurringBusinessReview } from "./recurring-business-review.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = new URL("../sources/data-analyst/", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const input = JSON.parse(await read("fixtures/recurring-review-input.example.json"));
const artifact = JSON.parse(await read("fixtures/recurring-analysis-state.example.json"));
const markdown = (await read("fixtures/recurring-business-review.example.md")).replaceAll("\r\n", "\n");
const schema = JSON.parse(await read("schemas/analysis-state.schema.json"));
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(input);
const metric = (a, name) => a.metrics.find((m) => m.name === name);

test("recurring review uses the existing Data Analyst schema and lineage contract", () => {
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateArtifactSemantics("data-analyst", artifact), []);
  assert.deepEqual(checkRecurringBusinessReview(input, artifact, markdown), []);
  assert.equal(metric(artifact, "Request volume change").value, 20);
  assert.equal(metric(artifact, "Prior target-hit rate").value, 90);
  assert.equal(metric(artifact, "Current target-hit rate").value, 90);
  assert.equal(metric(artifact, "Target-hit rate change").value, 0);
  assert.equal(metric(artifact, "Target-hit rate change").unit, "percentage points");
  assert.deepEqual(artifact.sources.map((s) => s.reference), ["SERVICE-A-AUG", "SERVICE-A-SEP"]);
  assert.match(markdown, /\| 2026-08 \| 100 \| 90 \| 90%/);
  assert.match(markdown, /\| 2026-09 \| 120 \| 108 \| 90%/);
  assert.match(markdown, /Adjacent service not combined or ranked/);
  assert.match(markdown, /Research Briefing may use the two primary source references/);
});

test("original onboarding example stays schema-valid and semantically intact", async () => {
  const original = JSON.parse(await read("fixtures/analysis-state.example.json"));
  assert.equal(validate(original), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateArtifactSemantics("data-analyst", original), []);
  assert.equal(original.metrics[0].value, 0.64);
});

test("changed denominator recomputes the rate instead of reusing the old period", () => {
  const changed = clone();
  changed.primary.current.total = 135;
  const result = buildRecurringBusinessReview(changed);
  assert.equal(metric(result.artifact, "Current target-hit rate").value, 80);
  assert.equal(metric(result.artifact, "Target-hit rate change").value, -10);
  assert.equal(metric(result.artifact, "Request volume change").value, 35);
  assert.ok(checkRecurringBusinessReview(changed, artifact, markdown).length);
});

for (const [name, mutate, message] of [
  ["missing period", (x) => { x.primary.prior = null; }, /period is missing/],
  ["missing source", (x) => { x.primary.current.state = "missing"; }, /do not substitute zero/],
  ["stale source", (x) => { x.primary.prior.state = "stale"; }, /do not substitute zero/],
  ["conflicting source", (x) => { x.primary.current.state = "conflicting"; }, /conflicting/],
  ["incomplete source", (x) => { x.primary.current.complete = false; }, /incomplete/],
  ["zero denominator", (x) => { x.primary.current.total = 0; }, /positive supplied denominator/],
  ["negative numerator", (x) => { x.primary.current.met = -1; }, /numerator/],
  ["numerator above denominator", (x) => { x.primary.current.met = 121; }, /numerator/],
  ["fractional count", (x) => { x.primary.current.total = 120.5; }, /denominator/],
  ["future observation", (x) => { x.primary.current.observedAt = "2027-01-01T00:00:00Z"; }, /chronology/],
  ["partial-period observation", (x) => { x.primary.current.observedAt = "2026-09-30T12:00:00Z"; }, /chronology/],
  ["invalid calendar date", (x) => { x.primary.current.end = "2026-09-31"; }, /chronology/],
  ["overlapping periods", (x) => { x.primary.current.start = "2026-08-31"; }, /nonoverlapping/],
  ["same source twice", (x) => { x.primary.current.reference = x.primary.prior.reference; }, /separate source/],
  ["different service", (x) => { x.primary.current.service = "Other service"; }, /same service/],
  ["definition revision drift", (x) => { x.primary.current.definition.revision = "v2"; }, /definitions differ/],
  ["same label with changed target", (x) => { x.primary.current.definition.target = "Within 4 business days"; }, /definitions differ/],
  ["denominator definition drift", (x) => { x.primary.current.definition.denominator = "Only escalated requests"; }, /definitions differ/],
  ["population drift", (x) => { x.primary.current.definition.population = "New customers only"; }, /definitions differ/],
  ["missing definition field", (x) => { delete x.primary.current.definition.numerator; }, /definitions differ/],
]) test(`recurring review with ${name} produces a gap, not a numeric comparison`, () => {
  const value = clone();
  mutate(value);
  const result = buildRecurringBusinessReview(value);
  assert.equal(result.artifact, null);
  assert.match(result.markdown, message);
  assert.doesNotMatch(result.markdown, /\| 2026-|Relative volume change:/);
});

test("restricted primary evidence is withheld before values or references are emitted", () => {
  const value = clone();
  value.primary.current.audiences = ["Finance only"];
  value.primary.current.reference = "RESTRICTED-REF";
  value.primary.current.met = 987654321;
  const result = buildRecurringBusinessReview(value);
  assert.equal(result.artifact, null);
  assert.match(result.markdown, /not authorized/);
  assert.doesNotMatch(result.markdown, /RESTRICTED-REF|987654321/);
});

test("restricted adjacent evidence is not copied into the primary review or briefing", () => {
  const value = clone();
  value.adjacent.current.audiences = ["Finance only"];
  value.adjacent.current.reference = "RESTRICTED-REF";
  value.adjacent.current.total = 987654321;
  const result = buildRecurringBusinessReview(value);
  assert.equal(metric(result.artifact, "Current request volume").value, 120);
  assert.match(result.markdown, /not authorized/);
  assert.doesNotMatch(JSON.stringify(result), /RESTRICTED-REF|987654321/);
});

test("adjacent counts do not change the primary denominator or permit ranking", () => {
  const value = clone();
  value.adjacent.current.total = 1000000;
  value.adjacent.current.met = 999999;
  const result = buildRecurringBusinessReview(value);
  assert.deepEqual(result.artifact.metrics, artifact.metrics);
  assert.deepEqual(result.artifact.sources, artifact.sources);
  assert.match(result.markdown, /not combined or ranked/);
});

test("percentage-point change remains distinct from relative rate change", () => {
  const value = clone();
  value.primary.current.met = 96;
  const result = buildRecurringBusinessReview(value);
  assert.equal(metric(result.artifact, "Current target-hit rate").value, 80);
  assert.equal(metric(result.artifact, "Target-hit rate change").value, -10);
  assert.equal(metric(result.artifact, "Target-hit rate change").unit, "percentage points");
  assert.match(result.markdown, /-10 percentage points/);
});

for (const [name, mutate] of [
  ["incorrect rate", (a) => { metric(a, "Current target-hit rate").value = 108; }],
  ["percent instead of points", (a) => { metric(a, "Target-hit rate change").unit = "percent"; }],
  ["unsupported causal claim", (a) => { a.findings[0].statement = "The new workflow caused improved service quality."; }],
  ["false owner approval", (a) => { a.decisionState = "accepted-by-owner"; }],
  ["wrong evidence linkage", (a) => { a.metrics[0].lineageRefs = ["SERVICE-A-SEP"]; }],
]) test(`source-bound example proof rejects ${name}`, () => {
  const changed = structuredClone(artifact);
  mutate(changed);
  assert.ok(checkRecurringBusinessReview(input, changed, markdown).length);
});

test("a misleading Markdown-only causal claim fails the reproducible example proof", () => {
  assert.ok(checkRecurringBusinessReview(input, artifact, `${markdown}\nThe workflow caused improved quality.\n`).length);
});

test("required reviewer and timezone metadata cannot be omitted", () => {
  const value = clone();
  value.asOf = "2026-10-02T12:00:00";
  assert.throws(() => buildRecurringBusinessReview(value), /timezone/);
  assert.throws(() => buildRecurringBusinessReview(null), /audience/);
});
