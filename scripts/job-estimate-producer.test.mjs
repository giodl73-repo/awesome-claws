import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { deriveJobEstimate, jobEstimateFindings, renderJobEstimate } from "./job-estimate-producer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";
import { resolveArtifactContract } from "./runtime-evidence-lib.mjs";

const root = new URL("../sources/job-estimate-producer/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/job-estimate.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/job-estimate.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const refresh = (value) => { value.result = deriveJobEstimate(value); return value; };
const output = (value) => value.result.scenarios[0];

test("estimate: blocker explanations and order may vary without changing evidence", () => {
  const value = clone(); value.scenarios[0].pricing.taxBps = null; value.scenarios[0].pricing.confirmed = false; refresh(value);
  const blockers = output(value).blockers;
  assert(blockers.length > 1);
  blockers.find((blocker) => blocker.code === "tax-treatment").reason = "Owner: please provide the whole-quote tax rate.";
  blockers.reverse();
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(jobEstimateFindings(value), []);
  assert.deepEqual(validateArtifactSemantics("job-estimate-producer", value), []);
  assert.match(renderJobEstimate(value).workpaper, /Owner: please provide the whole-quote tax rate/);
});

for (const [name, mutate] of [
  ["missing code", (rows) => { delete rows[0].code; }],
  ["wrong code", (rows) => { rows[0].code = rows[0].code === "tax-treatment" ? "rate" : "tax-treatment"; }],
  ["wrong id", (rows) => { rows[0].id = "UNRELATED"; }],
  ["hidden blocker", (rows) => { rows.pop(); }],
  ["duplicate blocker", (rows) => { rows.push({ ...rows[0] }); }],
  ["blank explanation", (rows) => { rows[0].reason = " \t"; }],
  ["extra assertion", (rows) => { rows[0].approved = true; }],
]) test(`estimate: rejects blocker mutation: ${name}`, () => {
  const value = clone(); value.scenarios[0].pricing.taxBps = null; refresh(value);
  mutate(output(value).blockers);
  assert(jobEstimateFindings(value).length > 0);
  assert.throws(() => renderJobEstimate(value));
});

test("estimate: packaged digest recipe computes the exact current input fingerprint", async () => {
  const reference = await readFile(new URL("references/estimating-contract.md", root), "utf8");
  const code = reference.match(/```js\r?\n([\s\S]*?)\r?\n```/)[1];
  const { computeEstimateInputDigest } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  for (const change of [() => {}, (value) => { value.scenarios[0].lines[0].sourceRef = "SOURCE-CHANGED"; }, (value) => { value.scope.owner = "\u00c9lodie"; }, (value) => { value.scope = Object.fromEntries(Object.entries(value.scope).reverse()); }]) {
    const value = clone(); change(value);
    assert.equal(computeEstimateInputDigest(value), deriveJobEstimate(value).inputDigest);
  }
});

test("estimate: normalized agent identities cannot stand in for the human owner", () => {
  for (const owner of ["Job estimate producer", " job-estimate-producer ", "job_estimate_producer", "JOB   ESTIMATE PRODUCER", " assistant ", "\uff41ssistant"]) {
    const value = clone(); value.scope.owner = owner;
    assert.throws(() => deriveJobEstimate(value), /human estimating owner/);
    assert(jobEstimateFindings(value).some((finding) => finding.code === "estimate_input"));
  }
  const value = clone(); value.scope.owner = "Assistant manager Maya"; refresh(value);
  assert.deepEqual(jobEstimateFindings(value), []);
});

test("estimate: generated runtime contract declares the structured state and private handoff", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === "job-estimate-producer");
  const contract = await resolveArtifactContract({ entry, experience: { output: "outputs/job-estimate-producer-handoff.md" } });
  assert.equal(contract.structuredPath, "outputs/job-estimate.json");
  assert.equal(contract.handoffPath, "outputs/job-estimate-producer-handoff.md");
});

test("estimate: actual cost workpaper and quote preserve the accepted markup example", async () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(jobEstimateFindings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("job-estimate-producer", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["job-estimate-producer"], "job-estimate.schema.json");
  const result = output(fixture);
  assert.equal(result.directCost, 80000); assert.equal(result.preTax, 100000);
  assert.equal(result.grossMarginBps, 2000); assert.equal(result.total, null);
  assert.equal(result.state, "blocked");
  assert.deepEqual(result.coverage.map((item) => item.disposition), ["priced", "allowance", "excluded"]);
  const rendered = renderJobEstimate(fixture);
  assert.equal(rendered.quote, await readFile(new URL("fixtures/quote.example.md", root), "utf8"));
  assert.equal(rendered.workpaper, await readFile(new URL("fixtures/workpaper.example.md", root), "utf8"));
  const session = JSON.parse(await readFile(new URL("fixtures/session-demo.json", root), "utf8"));
  assert(session.report.summary.endsWith(rendered.quote));
  assert.match(session.report.summary, /Synthetic reference fixture; not live model/);
  assert.match(rendered.quote, /USD 1000\.00/);
  assert.match(rendered.quote, /Final total: Pending owner input/);
  assert.match(rendered.workpaper, /gross margin: 20%/);
  for (const secret of ["LABOR-2", "MATERIAL-6", "USD 50.00", "USD 800.00", "20%", "25%", "Owner-only", "OWNER-COST-2"]) assert(!rendered.quote.includes(secret), secret);
});

test("estimate: explicit zero tax allows owner review but never a binding offer", () => {
  const value = clone(); value.scenarios[0].pricing.taxBps = 0; refresh(value);
  assert.equal(output(value).state, "ready-for-owner-review");
  assert.equal(output(value).total, 100000);
  assert.match(renderJobEstimate(value).quote, /QUOTE DRAFT - NOT A BINDING OFFER/);
});

test("estimate: customer option headings never disclose private scenario labels", () => {
  const value = clone();
  value.scenarios[0].label = "Internal labor USD 50/hour; supplier MATERIAL-6; 25% markup";
  for (const approved of [false, true]) {
    value.scope.disclosureApproved = approved; refresh(value);
    const rendered = renderJobEstimate(value);
    assert.match(rendered.quote, /## Proposed option 1/);
    for (const secret of ["Internal labor", "MATERIAL-6", "25% markup"]) assert(!rendered.quote.includes(secret));
    assert(rendered.workpaper.includes(value.scenarios[0].label));
    assert.match(rendered.workpaper, /## Option 1:/);
  }
});

test("estimate: workpaper reconciles supplied tax policy and complete quote totals", () => {
  const value = clone();
  value.scenarios[0].pricing.taxBps = 0; refresh(value);
  const zero = renderJobEstimate(value);
  assert.match(zero.workpaper, /Tax instruction: 0% of whole-job pre-tax price/);
  assert.match(zero.workpaper, /Calculated tax: USD 0\.00; final quote total: USD 1000\.00/);
  value.scenarios[0].pricing.taxBps = 1000; refresh(value);
  const taxed = renderJobEstimate(value);
  assert.notEqual(taxed.workpaper, zero.workpaper);
  assert.match(taxed.workpaper, /Tax instruction: 10% of whole-job pre-tax price; rounding policy: half-up-per-line/);
  assert.match(taxed.workpaper, /Calculated tax: USD 100\.00; final quote total: USD 1100\.00/);
  assert.match(taxed.quote, /Final total: USD 1100\.00/);
  value.scenarios[0].pricing.taxBps = null; refresh(value);
  assert.match(renderJobEstimate(value).workpaper, /Calculated tax: Pending owner input; final quote total: Pending owner input/);
});

test("estimate: blocked foreign cost rates retain their actual currency and source units", () => {
  const value = clone(); value.scenarios[0].lines[0].currency = "JPY"; refresh(value);
  assert.equal(output(value).costs[0].state, "blocked");
  assert.equal(output(value).costs[0].cost, null);
  const row = renderJobEstimate(value).workpaper.split("\n").find((line) => line.startsWith(`| ${value.scenarios[0].lines[0].sourceRef}/`));
  assert(row.includes("JPY 5000 minor units (source precision not supplied; not converted)"));
  assert(!row.includes("USD 50.00"));
});

const mutations = [
  ["wrong cost", (x) => output(x).costs[0].cost++],
  ["wrong price", (x) => output(x).preTax++],
  ["markup mislabeled as margin", (x) => { output(x).grossMarginBps = 2500; }],
  ["invented tax", (x) => { output(x).tax = 0; }],
  ["false readiness", (x) => { output(x).state = "ready-for-owner-review"; }],
  ["hidden blocker", (x) => { output(x).blockers = []; }],
  ["omitted coverage", (x) => output(x).coverage.pop()],
  ["duplicated cost", (x) => output(x).costs.push(structuredClone(output(x).costs[0]))],
  ["changed source revision", (x) => { x.scenarios[0].lines[0].sourceRevision = "3"; }],
  ["changed source reference", (x) => { x.scenarios[0].lines[0].sourceRef = "NEW-SOURCE"; }],
  ["changed rate", (x) => { x.scenarios[0].lines[0].rateMinor = 6000; }],
  ["changed pricing policy", (x) => { x.scenarios[0].pricing.bps = 2000; }],
  ["changed quote revision", (x) => { x.scope.quoteRevision = "2"; }],
  ["changed private destination", (x) => { x.scope.privateDestination = "Other destination"; }],
  ["changed currency precision", (x) => { x.scope.minorDigits = 0; }],
];
for (const [name, mutate] of mutations) test(`estimate rejects ${name}`, () => {
  const value = clone(); mutate(value);
  assert(jobEstimateFindings(value).some((finding) => finding.code === "estimate_result"));
  assert.throws(() => renderJobEstimate(value));
});

for (const [name, mutate] of [
  ["unknown quantity", (x) => { x.quantity = null; }], ["zero work", (x) => { x.quantity = "0"; }],
  ["missing rate", (x) => { x.rateMinor = null; }], ["missing approval", (x) => { x.approved = false; }],
  ["missing approval reference", (x) => { x.approvalRef = null; }], ["stale source", (x) => { x.current = false; }],
  ["wrong customer", (x) => { x.customer = "Other customer"; }], ["mixed currency", (x) => { x.currency = "EUR"; }],
  ["wrong job", (x) => { x.job = "OTHER"; }], ["wrong scope revision", (x) => { x.scopeRevision = "1"; }],
  ["expired quote", (x) => { x.validThrough = "2026-10-01"; }], ["future observation", (x) => { x.observedOn = "2026-10-03"; }],
  ["validity shorter than customer quote", (x) => { x.validThrough = "2026-10-08"; }],
  ["missing conversion", (x) => { x.conversion = null; }], ["zero conversion", (x) => { x.conversion = "0"; }],
  ["same-unit scaling", (x) => { x.conversion = "2"; }],
  ["unreferenced unit change", (x) => { x.quantityUnit = "days"; x.conversion = "8"; }],
  ["allowance masquerading as firm cost", (x) => { x.allowance = true; }],
]) test(`estimate retains ${name} without treating a subtotal as complete`, () => {
  const value = clone(); mutate(value.scenarios[0].lines[0]); refresh(value);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(jobEstimateFindings(value), []);
  assert.equal(output(value).costs[0].state, "blocked");
  assert.equal(output(value).knownCost, 40000); assert.equal(output(value).directCost, null);
  assert.equal(output(value).preTax, null); assert.equal(output(value).state, "blocked");
});

test("estimate: explicit zero rate is supported evidence, not an unknown", () => {
  const value = clone(); value.scenarios[0].lines[0].rateMinor = 0; value.scenarios[0].pricing.taxBps = 0; refresh(value);
  assert.equal(output(value).directCost, 40000); assert.equal(output(value).preTax, 50000);
  assert.equal(output(value).state, "ready-for-owner-review");
});

test("estimate: exact owner-supplied day-to-hour conversion preserves cost", () => {
  const value = clone(); Object.assign(value.scenarios[0].lines[0], { quantity: "1", quantityUnit: "day", conversion: "8", conversionRef: "OWNER-8-HOUR-DAY" }); refresh(value);
  assert.equal(output(value).directCost, 80000); assert.equal(output(value).preTax, 100000);
});

test("estimate: 25 percent target margin is not 25 percent markup", () => {
  const value = clone(); value.scenarios[0].pricing.method = "target-margin"; refresh(value);
  assert.equal(output(value).preTax, 106667); assert.equal(output(value).grossMarginBps, 2500);
});

test("estimate: owner-selected pricing basis controls overhead and contingency treatment", () => {
  const value = clone(); Object.assign(value.scenarios[0].pricing, { overheadMinor: 10000, contingencyMinor: 2000 }); refresh(value);
  assert.equal(output(value).totalCost, 92000); assert.equal(output(value).preTax, 112000);
  value.scenarios[0].pricing.basis = "total-estimated-cost"; refresh(value);
  assert.equal(output(value).preTax, 115000); assert.equal(output(value).grossMarginBps, 2000);
});

for (const key of ["overheadMinor", "contingencyMinor"]) test(`estimate: unknown ${key} blocks price rather than defaulting to zero`, () => {
  const value = clone(); value.scenarios[0].pricing[key] = null; refresh(value);
  assert.equal(output(value).directCost, 80000); assert.equal(output(value).totalCost, null); assert.equal(output(value).preTax, null);
});

test("estimate: requested alternatives compare equivalent scope with explicit deltas", () => {
  const value = clone(); const alternative = structuredClone(value.scenarios[0]);
  Object.assign(alternative, { id: "ALT", label: "Alternative labor basis", decisionRef: "OWNER-ALT-SAME-SCOPE" });
  alternative.lines[0].rateMinor = 6000; value.scenarios.push(alternative); refresh(value);
  assert.deepEqual(value.result.comparisons, [{ id: "ALT", baselineId: "BASE", costDelta: 8000, preTaxDelta: 10000 }]);
  alternative.equivalentScope = false; refresh(value);
  assert.equal(value.result.scenarios[1].preTax, null); assert.equal(value.result.comparisons[0].preTaxDelta, null);
});

test("estimate: omissions and exclusions cannot hide required cost", () => {
  const value = clone(); value.scopeItems.push({ id: "MISSING", description: "Missing subcontractor", disposition: "priced", decisionRef: "OWNER-SCOPE-ADD", disclosureApproved: true, costLineIds: ["SUBCONTRACT"] }); refresh(value);
  assert.equal(output(value).preTax, null); assert.equal(output(value).coverage.at(-1).disposition, "blocked");
  value.scopeItems.pop(); value.scopeItems[0].disposition = "excluded"; refresh(value);
  assert.equal(output(value).preTax, null);
});

test("estimate: undisclosed exclusions and missing allowance decisions block review", () => {
  const value = clone(); value.scenarios[0].pricing.taxBps = 0;
  value.scopeItems[2].disclosureApproved = false; refresh(value);
  assert.equal(output(value).state, "blocked");
  value.scopeItems[2].disclosureApproved = true; value.scopeItems[1].decisionRef = null; refresh(value);
  assert.equal(output(value).preTax, null);
});

test("estimate: a missing component cannot disappear behind another priced line in the same scope", () => {
  const value = clone(); value.scenarios[0].lines.splice(1, 1); refresh(value);
  assert.equal(output(value).knownCost, 50000); assert.equal(output(value).directCost, null);
  assert.equal(output(value).preTax, null); assert.equal(output(value).coverage[0].disposition, "blocked");
});

test("estimate: price limits trigger review without silently clipping the price", () => {
  const value = clone(); Object.assign(value.scenarios[0].pricing, { taxBps: 0, maxPreTaxMinor: 99999 }); refresh(value);
  assert.equal(output(value).preTax, 100000); assert.equal(output(value).state, "blocked");
});

test("estimate: fractional costs and supplied tax use half-up decimal rounding", () => {
  const value = clone(); value.scopeItems = [value.scopeItems[0]];
  value.scopeItems[0].costLineIds = ["LABOR"];
  value.scenarios[0].lines = [{ ...value.scenarios[0].lines[0], quantity: "0.5", rateMinor: 101 }];
  Object.assign(value.scenarios[0].pricing, { bps: 0, taxBps: 1000 }); refresh(value);
  assert.equal(output(value).directCost, 51); assert.equal(output(value).tax, 5); assert.equal(output(value).total, 56);
});

test("estimate: all-zero approved costs have undefined margin, not a divide-by-zero success", () => {
  const value = clone(); for (const line of value.scenarios[0].lines) line.rateMinor = 0;
  value.scenarios[0].pricing.taxBps = 0; refresh(value);
  assert.equal(output(value).total, 0); assert.equal(output(value).grossMarginBps, null);
});

for (const [name, mutate] of [
  ["duplicate scope", (x) => x.scopeItems.push(structuredClone(x.scopeItems[0]))],
  ["duplicate scenario", (x) => x.scenarios.push(structuredClone(x.scenarios[0]))],
  ["duplicate cost ID", (x) => x.scenarios[0].lines.push(structuredClone(x.scenarios[0].lines[0]))],
  ["same source under another ID", (x) => x.scenarios[0].lines.push({ ...x.scenarios[0].lines[0], id: "DUP" })],
  ["unmapped cost", (x) => { x.scenarios[0].lines[0].scopeId = "OTHER"; }],
  ["100 percent target margin", (x) => { Object.assign(x.scenarios[0].pricing, { method: "target-margin", bps: 10000 }); }],
  ["negative rate", (x) => { x.scenarios[0].lines[0].rateMinor = -1; }],
  ["unsafe integer", (x) => { x.scenarios[0].lines[0].rateMinor = Number.MAX_SAFE_INTEGER + 1; }],
  ["extended cost overflow", (x) => { x.scenarios[0].lines[0].rateMinor = Number.MAX_SAFE_INTEGER; }],
  ["invalid calendar date", (x) => { x.scope.asOf = "2026-02-30"; }],
  ["agent owner", (x) => { x.scope.owner = "assistant"; }],
]) test(`estimate rejects invalid input: ${name}`, () => {
  const value = clone(); mutate(value); assert(jobEstimateFindings(value).some((finding) => finding.code === "estimate_input"));
  assert.throws(() => renderJobEstimate(value));
});

for (const key of ["quote", "bid", "purchase", "contact", "price"]) test(`estimate rejects claimed external action: ${key}`, () => {
  const value = clone(); value.authority[key] = "completed";
  assert(jobEstimateFindings(value).some((finding) => finding.code === "estimate_authority"));
  assert.throws(() => renderJobEstimate(value));
});

test("estimate: source wording is escaped, and missing customer disclosure does not leak it", () => {
  const value = clone(); value.scope.customerScope = '<script>submit()</script> [link](https://invalid.example) | forged'; refresh(value);
  assert(!renderJobEstimate(value).quote.includes("<script>"));
  assert(renderJobEstimate(value).quote.includes("\\[link\\]"));
  value.scope.disclosureApproved = false; refresh(value);
  assert(!renderJobEstimate(value).quote.includes("submit()")); assert.equal(output(value).state, "blocked");
});

test("estimate: malformed direct inputs produce findings, not crashes", () => {
  for (const value of [null, {}, [], { ...fixture, scenarios: null }, { ...fixture, scopeItems: [null] }]) assert(jobEstimateFindings(value).length > 0);
});
