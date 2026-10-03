import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildCloseWorkpaper, checkCloseWorkpaper, closeWorkpaperNarrative, snapshot } from "./close-workpaper.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await read(path));
const input = await json("sources/spreadsheet-analyst/fixtures/close-workpaper-input.json");
const result = await json("sources/spreadsheet-analyst/fixtures/close-workpaper-result.json");
const markdown = (await read("sources/spreadsheet-analyst/fixtures/close-workpaper.example.md")).replaceAll("\r\n", "\n");
const reconciliation = await json("sources/financial-account-reconciliation-coordinator/fixtures/financial-account-reconciliation.example.json");
const manifest = await json("sources/spreadsheet-analyst/fixtures/close-spreadsheet-change.example.json");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

test("actual schedule retains the unexplained 500 and both separate-account residuals", () => {
  assert.deepEqual(checkCloseWorkpaper(input, reconciliation, result, markdown), []);
  assert.equal(result.analysis.opening, 12000);
  assert.equal(result.analysis.closing, 15500);
  assert.equal(result.analysis.change, 3500);
  assert.equal(result.analysis.explained, 3000);
  assert.equal(result.analysis.unexplained, 500);
  assert.deepEqual(result.analysis.residuals.map((r) => r.usd), [1.25, -0.9]);
  assert.match(markdown, /USD 500.00 remains unexplained/);
  assert.match(markdown, /SCHED-SUPPLIER \/ r1/);
  assert.match(markdown, /SCHED-PAYROLL \/ r1/);
});

test("both real owner artifacts use existing schemas and semantics", async () => {
  for (const [id, stem, value, options] of [
    ["spreadsheet-analyst", "spreadsheet-change", manifest, {}],
    ["financial-account-reconciliation-coordinator", "financial-account-reconciliation", reconciliation, { asOf: input.asOf }],
  ]) {
    const schema = await json(`sources/${id}/schemas/${stem}.schema.json`);
    const validate = ajv.compile(schema);
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
    assert.deepEqual(validateArtifactSemantics(id, value, options), []);
  }
  assert.equal(manifest.handoff.state, "blocked");
  assert.deepEqual(manifest.handoff.blockingRefs, ["exception-unexplained", "exception-reconciliation"]);
});

for (const [name, mutate] of [
  ["missing schedule", (x) => { x.rows.pop(); }],
  ["blank amount", (x) => { x.rows[3].cents = null; }],
  ["fractional cents", (x) => { x.rows[3].cents = 0.5; }],
  ["incomplete source", (x) => { x.rows[3].state = "missing"; }],
  ["wrong entity", (x) => { x.rows[0].entity = "Other entity"; }],
  ["wrong account", (x) => { x.rows[0].accountId = "other"; }],
  ["wrong period", (x) => { x.rows[1].period = "2026-09"; }],
  ["wrong currency", (x) => { x.rows[1].currency = "EUR"; }],
  ["wrong basis", (x) => { x.rows[1].basis = "cash"; }],
  ["duplicate source", (x) => { x.rows[3].reference = x.rows[2].reference; }],
  ["missing source revision", (x) => { x.rows[2].revision = ""; }],
  ["missing reconciliation binding", (x) => { x.reconciliationBinding = null; }],
  ["wrong reconciliation entity", (x) => { x.reconciliationBinding.entity = "Other entity"; }],
  ["wrong reconciliation basis", (x) => { x.reconciliationBinding.basis = "cash"; }],
  ["wrong reconciliation period", (x) => { x.reconciliationBinding.period = "2026-09"; }],
  ["changed reconciliation revision", (x) => { x.reconciliationBinding.roundRootDigest = "sha256:changed"; }],
  ["missing trusted review time", (x) => { delete x.asOf; }],
  ["malformed rows", (x) => { x.rows = {}; }],
  ["malformed row", (x) => { x.rows[0] = null; }],
]) test(`workpaper with ${name} produces an evidence gap instead of zero`, () => {
  const changed = structuredClone(input);
  mutate(changed);
  const gap = buildCloseWorkpaper(changed, reconciliation);
  assert.equal(gap.analysis, null);
  assert.ok(gap.gaps.length);
  assert.doesNotMatch(closeWorkpaperNarrative(gap), /\| Unexplained \| 0/);
});

test("a real zero schedule is different from a missing schedule", () => {
  const changed = structuredClone(input);
  changed.rows[3].cents = 0;
  assert.equal(buildCloseWorkpaper(changed, reconciliation).analysis.unexplained, 1400);
});

test("balanced main schedule does not erase the separate account's residuals", () => {
  const changed = structuredClone(input);
  changed.rows[1].cents = 1500000;
  const updated = buildCloseWorkpaper(changed, reconciliation);
  assert.equal(updated.analysis.unexplained, 0);
  assert.equal(updated.analysis.residuals.length, 2);
  assert.equal(updated.analysis.state, "accountant-review-pending");
});

test("changed source revision invalidates the old workpaper without inventing approval", () => {
  const changed = structuredClone(input);
  changed.rows[1].revision = "r3";
  assert.ok(checkCloseWorkpaper(changed, reconciliation, result, markdown).length);
  const updated = buildCloseWorkpaper(changed, reconciliation);
  assert.notEqual(updated.analysis.sourceSnapshot, result.analysis.sourceSnapshot);
  assert.equal(updated.analysis.state, "accountant-review-pending");
});

test("corrupt reconciliation cannot be treated as a validated owner output", () => {
  const corrupt = structuredClone(reconciliation);
  corrupt.ledgerRows[0].minorUnits = "999999";
  assert.equal(buildCloseWorkpaper(input, corrupt).analysis, null);
});

for (const [name, mutate] of [
  ["wrong residual arithmetic", (x) => { x.analysis.unexplained = 0; }],
  ["lost separate-account item", (x) => { x.analysis.residuals.pop(); }],
  ["unsupported journal posting", (x) => { x.analysis.journalPosting = "performed"; }],
  ["false book closure", (x) => { x.analysis.bookClosure = "performed"; }],
]) test(`exact worked-example proof rejects ${name}`, () => {
  const changed = structuredClone(result);
  mutate(changed);
  assert.ok(checkCloseWorkpaper(input, reconciliation, changed, markdown).length);
});

test("a narrative-only invented accrual fails the exact example check", () => {
  assert.ok(checkCloseWorkpaper(input, reconciliation, result, `${markdown}\nPost a 500 accrual to close the books.\n`).length);
});

test("saved workbook bytes are bound to the authoring proof, not claimed as live CI recalculation", async () => {
  const proof = await json("candidates/accounting-workpapers/outputs/calculation-proof.json");
  for (const [path, expected] of [["inputs/close-source.xlsx", proof.sourceSha256], ["outputs/close-review.xlsx", proof.outputSha256]]) {
    const bytes = await readFile(new URL(`candidates/accounting-workpapers/${path}`, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
  }
  assert.equal(manifest.workbook.sourceSha256, proof.sourceSha256);
  assert.equal(proof.scopeSnapshot, snapshot(input));
  assert.equal(proof.reconciliationSnapshot, snapshot(reconciliation));
  assert.equal(proof.recalculationCases.length, 12);
  assert.ok(proof.recalculationCases.every((c) => c.status === "passed"));
  assert.equal(proof.nativeExcel, "not-tested");
  assert.equal(proof.reopened, true);
});
