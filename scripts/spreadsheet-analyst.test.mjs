import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(await readFile(new URL("../claws/spreadsheet-analyst/schemas/spreadsheet-change.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../claws/spreadsheet-analyst/fixtures/spreadsheet-change.example.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const isValid = (value) => validateSchema(value) && validateArtifactSemantics("spreadsheet-analyst", value).length === 0;

test("spreadsheet change fixture preserves source, lineage, and owner review", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("spreadsheet-analyst", fixture), []);
});

test("spreadsheet change rejects unsafe paths and source mutation", () => {
  const traversal = clone();
  traversal.workbook.outputPath = "outputs/../inputs/revenue-model.xlsx";
  assert.equal(isValid(traversal), false);
  const overwrite = clone();
  overwrite.workbook.outputPath = "inputs/revenue-model.xlsx";
  assert.equal(isValid(overwrite), false);
  const formulaLoss = clone();
  formulaLoss.sheets[1].formulaCountAfter = 200;
  assert.equal(isValid(formulaLoss), false);
  const unpreserved = clone();
  unpreserved.sheets[0].sourcePreserved = false;
  assert.equal(isValid(unpreserved), false);
});

test("spreadsheet change rejects dangling, forward, and unsafe transformations", () => {
  const dangling = clone();
  dangling.transformations[0].inputRefs = ["sheet-missing"];
  assert.equal(isValid(dangling), false);
  const forward = clone();
  forward.transformations[0].inputRefs = ["transform-add-validation"];
  assert.equal(isValid(forward), false);
  const replacement = clone();
  replacement.transformations[0].formulaPolicy = "preserve";
  assert.equal(isValid(replacement), false);
});

test("spreadsheet change requires complete readiness and blockers", () => {
  const failed = clone();
  failed.checks[2].status = "failed";
  failed.workbook.state = "blocked";
  failed.handoff.state = "blocked";
  failed.handoff.blockingRefs = ["check-recalculation"];
  assert.equal(isValid(failed), true);
  const missingBlocker = structuredClone(failed);
  missingBlocker.handoff.blockingRefs = [];
  assert.equal(isValid(missingBlocker), false);
  const incomplete = clone();
  incomplete.handoff.checkRefs.pop();
  assert.equal(isValid(incomplete), false);
  const ownerMismatch = clone();
  ownerMismatch.handoff.owner = "Another owner";
  assert.equal(isValid(ownerMismatch), false);
  const agentOwned = clone();
  agentOwned.workbook.owner = "the assistant";
  agentOwned.handoff.owner = "the assistant";
  assert.equal(validateArtifactSemantics("spreadsheet-analyst", agentOwned).some((item) => item.code === "agent_owned_authority"), true);
  const missingCheckKind = clone();
  missingCheckKind.checks = missingCheckKind.checks.filter((item) => item.kind !== "macros");
  missingCheckKind.handoff.checkRefs = missingCheckKind.handoff.checkRefs.filter((item) => item !== "check-macros");
  assert.equal(validateArtifactSemantics("spreadsheet-analyst", missingCheckKind).some((item) => item.code === "missing_verification_check"), true);
});

test("spreadsheet change requires every authority gate", () => {
  for (const action of fixture.blockedActions) {
    const missing = clone();
    missing.blockedActions = missing.blockedActions.filter((item) => item !== action);
    assert.equal(validateArtifactSemantics("spreadsheet-analyst", missing).some((item) => item.code === "missing_authority_gate"), true, action);
  }
});
