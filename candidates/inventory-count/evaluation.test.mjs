import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import yauzl from "yauzl";
import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";

const root = new URL("./", import.meta.url);
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const input = await json("inputs/counts.json");
const manifest = await json("outputs/spreadsheet-change.json");
const proof = await json("outputs/calculation-proof.json");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(await json("../../sources/spreadsheet-analyst/schemas/spreadsheet-change.schema.json"));

test("existing Spreadsheet Analyst schema and semantics accept the blocked handoff", () => {
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateArtifactSemantics("spreadsheet-analyst", manifest), []);
  assert.equal(manifest.handoff.state, "blocked");
  assert.equal(manifest.workbook.state, "blocked");
});

test("real validator rejects premature readiness and missing exception references", () => {
  const changed = structuredClone(manifest);
  changed.handoff.state = changed.workbook.state = "ready-for-owner-review";
  changed.handoff.blockingRefs = [];
  assert.ok(validateArtifactSemantics("spreadsheet-analyst", changed).length);
  const omitted = structuredClone(manifest);
  omitted.handoff.blockingRefs = [];
  assert.ok(validateArtifactSemantics("spreadsheet-analyst", omitted).length);
});

for (const [path, key] of [["inputs/counts.json", "inputSha256"], ["inputs/inventory-source.xlsx", "sourceSha256"], ["outputs/inventory-review.xlsx", "outputSha256"], ["outputs/spreadsheet-change.json", "manifestSha256"]]) {
  test(`saved proof binds actual bytes: ${path}`, async () => {
    const bytes = await read(path);
    assert.equal(sha(bytes), proof[key]);
    assert.notEqual(sha(Buffer.concat([bytes, Buffer.from("changed")])), proof[key]);
  });
}

test("source revisions and changed observations cannot inherit the old proof", async () => {
  for (const field of [8, 14, 15, 16, 18]) {
    const changed = structuredClone(input);
    changed.rows[2][field] = "revised";
    assert.notEqual(sha(`${JSON.stringify(changed, null, 2)}\n`), proof.inputSha256);
  }
  assert.equal(manifest.workbook.sourceSha256, proof.sourceSha256);
  assert.equal(manifest.workbook.sourcePath, "inputs/inventory-source.xlsx");
  assert.equal(manifest.workbook.outputPath, "outputs/inventory-review.xlsx");
});

test("synthetic fixture retains row-specific physical quantities and missing observations", () => {
  assert.equal(input.synthetic, true);
  assert.equal(input.rows.length, 9);
  const rows = Object.fromEntries(input.rows.map((r) => [r[0], r]));
  assert.equal(rows["bin-a"][14] - rows["bin-a"][7], -2);
  assert.equal(rows["bin-b"][14] - rows["bin-b"][7], 2);
  assert.equal(rows.receipt[7] + rows.receipt[8], 13);
  assert.equal(rows.receipt[14] - (rows.receipt[7] + rows.receipt[8]), -1);
  assert.equal(rows.held[7], 10);
  assert.equal(rows.held[19], 2);
  assert.equal(rows.missing[14], null);
  assert.equal(rows.zero[14], 0);
  assert.deepEqual(rows.recount.slice(14, 17), [8, 10, null]);
  assert.equal(rows["no-rule"][10], null);
  assert.equal(rows["no-basis"][17], null);
  assert.equal(new Set(input.rows.map((r) => r.slice(1, 5).join("/"))).size, 9);
});

test("saved calculation evidence is explicit about engine, edits and unresolved results", () => {
  assert.equal(proof.engine, "@oai/artifact-tool");
  assert.equal(proof.nativeExcel, "not-tested");
  assert.equal(proof.reopened, true);
  assert.equal(proof.reopenedMutationPassed, true);
  assert.equal(proof.sourcePreserved, true);
  assert.deepEqual(proof.variances, [-2, 2, -1, "n.a.", 0, "n.a.", "n.a.", -10, "n.a."]);
  assert.equal(proof.mutations.length, 22);
  assert.ok(proof.mutations.every((m) => m.status === "passed"));
  for (const name of ["blank is not zero", "stale row revision", "missing rule", "eligible not physical", "no auto favorable recount", "selection alone does not fix basis"]) assert.ok(proof.mutations.some((m) => m.name === name));
  assert.match(proof.formulaErrorScan, /matched 0 entries/);
});

function zipEntries(bytes) {
  return new Promise((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(error);
    const names = [];
    zip.on("error", reject);
    zip.on("entry", (entry) => { names.push(entry.fileName); zip.readEntry(); });
    zip.on("end", () => resolve(names));
    zip.readEntry();
  }));
}
test("delivered files are XLSX archives, not renamed text; no macro or external-link parts", async () => {
  for (const path of [manifest.workbook.sourcePath, manifest.workbook.outputPath]) {
    const entries = await zipEntries(await read(path));
    assert.ok(entries.includes("[Content_Types].xml"));
    assert.ok(entries.includes("xl/workbook.xml"));
    assert.ok(entries.includes("xl/worksheets/sheet1.xml"));
    assert.ok(!entries.some((e) => /vbaProject|externalLinks/i.test(e)));
  }
});

test("private handoff preserves authority and evaluation-only boundaries", async () => {
  const handoff = (await read("outputs/private-handoff.md")).toString();
  assert.match(handoff, /Every supplied decision is test data/);
  assert.match(handoff, /Native Microsoft Excel and live model execution were\s+not tested/);
  assert.match(handoff, /No new Claw ID/);
  assert.match(handoff, /#208 remains held/);
  assert.equal(manifest.blockedActions.length, 7);
  assert.deepEqual(manifest.handoff.prohibitedActions, manifest.blockedActions);
});
