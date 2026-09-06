import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL("../claws/data-migration-planner/fixtures/mapping.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/data-migration-planner/schemas/mapping.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("data-migration-planner", value).length === 0
  );
}

test("migration mapping fixture keeps systems, mapping, reconciliation, and rollback data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("data-migration-planner", fixture), []);
});

test("migration validator is total over schema-valid malformed nested records", () => {
  for (const field of ["mappings", "reconciliation", "principals", "evidence", "exceptions", "dataQualityFindings"]) {
    const malformed = clone();
    malformed[field].push({});
    assert.equal(validateSchema(malformed), true, `${field}: ${JSON.stringify(validateSchema.errors)}`);
    assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", malformed));
    assert.equal(isValid(malformed), false, field);
  }
});

test("migration validator returns findings for malformed system snapshot dates", () => {
  for (const label of ["source", "target"]) {
    const malformed = clone();
    malformed.systems[label].asOf = "not-a-date";
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", malformed));
    assert.ok(
      validateArtifactSemantics("data-migration-planner", malformed).some(
        (item) => item.code === "future_evidence" && item.path === `systems.${label}.asOf`,
      ),
    );
  }
});

test("migration validator rejects non-array required ledgers", () => {
  for (const field of ["principals", "evidence", "exceptions", "dataQualityFindings"]) {
    const malformed = clone();
    malformed[field] = {};
    assert.equal(validateSchema(malformed), true, `${field}: ${JSON.stringify(validateSchema.errors)}`);
    assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", malformed));
    assert.ok(
      validateArtifactSemantics("data-migration-planner", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("migration validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", malformed));
  const findings = validateArtifactSemantics("data-migration-planner", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("migration validator does not downgrade a malformed enriched-only owner field to legacy semantics", () => {
  const malformed = clone();
  malformed.owner = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("migration validator does not downgrade incomplete enriched records to legacy semantics", () => {
  for (const field of ["principals", "handoff", "systems", "rollback"]) {
    const incomplete = clone();
    delete incomplete[field];
    assert.equal(validateSchema(incomplete), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("data-migration-planner", incomplete));
    assert.equal(isValid(incomplete), false, field);
    assert.ok(
      validateArtifactSemantics("data-migration-planner", incomplete).length > 0,
      `expected incomplete enriched contract finding after deleting ${field}`,
    );
  }
});

test("migration validator requires the enriched schema version despite legacy-branch overlap", () => {
  const unversioned = clone();
  delete unversioned.schemaVersion;
  assert.equal(validateSchema(unversioned), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unversioned), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", unversioned).some(
      (item) => item.code === "invalid_schema_version" && item.path === "schemaVersion",
    ),
  );
  assert.ok(
    validateArtifactSemantics("data-migration-planner", unversioned).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("migration validator rejects a batch grounded in a different batch's evidence (cross-batch evidence)", () => {
  const crossBatch = clone();
  crossBatch.reconciliation.find((item) => item.id === "batch-rehearsal-1").evidenceRef = "evidence-rehearsal-2";
  assert.equal(isValid(crossBatch), false);
  const findings = validateArtifactSemantics("data-migration-planner", crossBatch);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("migration validator rejects colliding missing batch ids and references", () => {
  const missingIdentity = clone();
  delete missingIdentity.reconciliation[0].id;
  delete missingIdentity.evidence[0].batchRef;
  delete missingIdentity.exceptions[0].batchRef;
  assert.equal(validateSchema(missingIdentity), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingIdentity), false);
  const findings = validateArtifactSemantics("data-migration-planner", missingIdentity);
  assert.ok(
    findings.some(
      (item) => item.code === "invalid_array_record" && item.path === "reconciliation[0].id",
    ),
  );
  assert.ok(
    findings.some(
      (item) => item.code === "dangling_reference" && item.path === "exceptions[0].batchRef",
    ),
  );
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("migration validator rejects evidence whose snapshot identity does not match systems (cross-snapshot evidence)", () => {
  const crossSnapshot = clone();
  crossSnapshot.evidence[0].sourceSnapshotId = "snap-source-other";
  assert.equal(isValid(crossSnapshot), false);
  const findings = validateArtifactSemantics("data-migration-planner", crossSnapshot);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("migration validator rejects a batch count mismatch (source != migrated + rejected + held)", () => {
  const mismatched = clone();
  mismatched.reconciliation.find((item) => item.id === "batch-rehearsal-2").migratedCount = 5100;
  assert.equal(isValid(mismatched), false);
  const findings = validateArtifactSemantics("data-migration-planner", mismatched);
  assert.ok(findings.some((item) => item.code === "count_reconciliation_mismatch"));
});

test("migration validator rejects negative and non-finite batch quantities", () => {
  const negative = clone();
  negative.reconciliation.find((item) => item.id === "batch-rehearsal-1").rejectedCount = -5;
  assert.equal(isValid(negative), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", negative).some(
      (item) => item.code === "invalid_batch_count",
    ),
  );

  const nonFinite = clone();
  nonFinite.reconciliation.find((item) => item.id === "batch-rehearsal-1").sourceCount = Number.POSITIVE_INFINITY;
  // The schema leaves per-batch fields unconstrained (a bare
  // {"type":"array"} with no item schema), so a non-finite numeric value
  // remains schema-valid; the total semantic validator is the sole guard
  // against a non-finite quantity smuggled into a reconciliation batch.
  assert.equal(validateSchema(nonFinite), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(nonFinite), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", nonFinite).some(
      (item) => item.code === "invalid_batch_count",
    ),
  );
});

test("migration validator rejects a required field with no mapping", () => {
  const missingMapping = clone();
  missingMapping.mappings = missingMapping.mappings.filter((item) => item.sourceField !== "PrimaryEmail");
  assert.equal(isValid(missingMapping), false);
  const findings = validateArtifactSemantics("data-migration-planner", missingMapping);
  assert.ok(findings.some((item) => item.code === "missing_mapping"));
});

test("migration validator rejects a vacuous artifact with no required fields or mappings", () => {
  const vacuous = clone();
  vacuous.requiredFields = [];
  vacuous.mappings = [];
  assert.equal(validateSchema(vacuous), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(vacuous), false);
  const findings = validateArtifactSemantics("data-migration-planner", vacuous);
  assert.ok(findings.some((item) => item.code === "missing_mapping"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("migration validator rejects an unresolved (pending) exception blocking cutover readiness", () => {
  const unresolved = clone();
  unresolved.exceptions[0].disposition = "pending";
  assert.equal(isValid(unresolved), false);
  const findings = validateArtifactSemantics("data-migration-planner", unresolved);
  assert.ok(findings.some((item) => item.code === "unresolved_reject"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("migration validator rejects a waived exception counting as clearance", () => {
  const waived = clone();
  waived.exceptions[0].disposition = "waived";
  assert.equal(isValid(waived), false);
  const findings = validateArtifactSemantics("data-migration-planner", waived);
  assert.ok(findings.some((item) => item.code === "unresolved_reject"));
});

test("migration validator rejects a fully-migrated batch whose source and target checksums do not match", () => {
  const checksumMismatch = clone();
  checksumMismatch.reconciliation.find((item) => item.id === "batch-rehearsal-2").targetChecksum = "chk-different";
  assert.equal(isValid(checksumMismatch), false);
  const findings = validateArtifactSemantics("data-migration-planner", checksumMismatch);
  assert.ok(findings.some((item) => item.code === "checksum_mismatch"));
});

test("migration validator rejects a cutover approval dated before its grounding evidence", () => {
  const early = clone();
  early.cutoverApproval.approvedAt = "2026-08-15T00:00:00Z";
  assert.equal(isValid(early), false);
  const findings = validateArtifactSemantics("data-migration-planner", early);
  assert.ok(findings.some((item) => item.code === "unsupported_cutover_approval"));
});

test("migration validator rejects a self-approved cutover (approver id equals owner id)", () => {
  const selfApproved = clone();
  selfApproved.cutoverApproval.approverId = selfApproved.ownerId;
  assert.equal(isValid(selfApproved), false);
  const findings = validateArtifactSemantics("data-migration-planner", selfApproved);
  assert.ok(findings.some((item) => item.code === "self_approved_cutover"));
});

test("migration validator rejects an arbitrary, unregistered cutover approver id", () => {
  const arbitrary = clone();
  arbitrary.cutoverApproval.approverId = "principal-ghost";
  assert.equal(isValid(arbitrary), false);
  const findings = validateArtifactSemantics("data-migration-planner", arbitrary);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
});

test("migration validator rejects a cutover approver lacking cutover-approval-authority (unsupported approval)", () => {
  const unsupported = clone();
  unsupported.cutoverApproval.approverId = "principal-data-steward-omar";
  assert.equal(isValid(unsupported), false);
  const findings = validateArtifactSemantics("data-migration-planner", unsupported);
  assert.ok(findings.some((item) => item.code === "unsupported_cutover_approval"));
});

test("migration validator requires an explicit, verified rollback plan", () => {
  const noRollback = clone();
  noRollback.rollback.verified = false;
  assert.equal(isValid(noRollback), false);
  const findings = validateArtifactSemantics("data-migration-planner", noRollback);
  assert.ok(findings.some((item) => item.code === "missing_rollback"));
});

test("migration validator rejects rollback evidence from a rehearsal run", () => {
  const wrongKind = clone();
  wrongKind.rollback.evidenceRef = "evidence-rehearsal-2";
  assert.equal(isValid(wrongKind), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", wrongKind).some(
      (item) => item.code === "missing_rollback",
    ),
  );
});

test("migration validator rejects reconciliation evidence from a rollback drill", () => {
  const wrongKind = clone();
  wrongKind.reconciliation.find((item) => item.id === "batch-rehearsal-2").evidenceRef =
    "evidence-rollback-drill";
  assert.equal(isValid(wrongKind), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", wrongKind).some(
      (item) => item.code === "cross_scope_evidence",
    ),
  );
});

test("migration validator rejects a dangling batch reference on an exception", () => {
  const dangling = clone();
  dangling.exceptions[0].batchRef = "batch-ghost";
  assert.equal(isValid(dangling), false);
  const findings = validateArtifactSemantics("data-migration-planner", dangling);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
});

test("migration validator requires the handoff to stay blocked for a vacuous/empty batch scope", () => {
  const empty = clone();
  empty.reconciliation = [];
  empty.exceptions = [];
  empty.dataQualityFindings = [];
  assert.equal(isValid(empty), false);
  const findings = validateArtifactSemantics("data-migration-planner", empty);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("migration validator requires a stable owner principal id", () => {
  const missingOwnerId = clone();
  delete missingOwnerId.ownerId;
  assert.equal(isValid(missingOwnerId), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", missingOwnerId).some(
      (item) => item.code === "agent_owned_authority" && item.path === "ownerId",
    ),
  );
});

test("migration validator rejects a blank owner and the exact package self-attestation identity 'data migration planner'", () => {
  const blankOwner = clone();
  blankOwner.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "Data Migration Planner";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("data-migration-planner", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("migration validator rejects an unauthorized narrative claim of executing the cutover", () => {
  const narrative = clone();
  narrative.handoff.summary = "We executed the cutover and wrote to the target this morning.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("data-migration-planner", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

// A HEAD-authored artifact predating the enriched cutover-readiness record:
// the exact pre-checkpoint single-record shape (sourceVersion/targetVersion/
// mappings/reconciliation, no systems/principals/evidence/owner/handoff/etc.).
const legacyMappingRecord = {
  sourceVersion: "legacy-crm@2026.1",
  targetVersion: "cloud-crm@2026.2",
  mappings: [{ sourceField: "AccountID", targetField: "account_id" }],
  reconciliation: [{ sourceCount: 100, migratedCount: 100 }],
};

test("migration mapping schema preserves the original HEAD legacy single-record shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyMappingRecord), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("data-migration-planner", legacyMappingRecord), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it lacks the
  // complete enriched required shape.
  const bothShapesAtOnce = { ...legacyMappingRecord, schemaVersion: "awesomeClaws.migrationMapping.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("data-migration-planner", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyMappingRecord)) {
    const incomplete = { ...legacyMappingRecord };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("migration validator dispatches an overlapping legacy+enriched artifact to the full enriched contract", () => {
  // The complete enriched fixture already carries valid sourceVersion,
  // targetVersion, mappings, and reconciliation fields at the top level --
  // exactly what the legacy anyOf branch requires -- so it genuinely
  // overlaps both branches structurally by domain design. Prove that
  // overlap directly against the legacy branch's own subschema, then
  // confirm semantic dispatch still recognizes the complete enriched shape
  // and applies the full cutover-readiness contract rather than bounded
  // legacy semantics.
  const legacyBranchSchema = schema.anyOf[0];
  const validateLegacyBranch = new Ajv2020({ allErrors: true, strict: true }).compile(legacyBranchSchema);
  const overlap = clone();
  assert.equal(validateLegacyBranch(overlap), true, JSON.stringify(validateLegacyBranch.errors));
  assert.equal(validateSchema(overlap), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("data-migration-planner", overlap), []);
});

test("migration validator applies bounded legacy semantics without requiring enriched-only fields", () => {
  const blankField = { ...legacyMappingRecord, sourceVersion: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("data-migration-planner", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const blankTargetVersion = { ...legacyMappingRecord, targetVersion: "   " };
  assert.equal(validateSchema(blankTargetVersion), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("data-migration-planner", blankTargetVersion).some(
      (item) => item.code === "invalid_legacy_field" && item.path === "targetVersion",
    ),
  );
});

test("validate-artifact CLI accepts the packaged data-migration-planner fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "data-migration-planner", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy migration mapping artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `data-migration-planner-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyMappingRecord, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "data-migration-planner", scratchPath],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.deepEqual(output.schemaErrors, []);
    assert.deepEqual(output.semanticFindings, []);
  } finally {
    await rm(scratchPath, { force: true });
  }
});

test("validate-artifact CLI reports semantic findings for a count-reconciliation-mismatch migration artifact", async () => {
  const mismatched = clone();
  mismatched.reconciliation.find((item) => item.id === "batch-rehearsal-2").migratedCount = 5100;
  assert.equal(validateSchema(mismatched), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(mismatched), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `data-migration-planner-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(mismatched, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "data-migration-planner", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "count_reconciliation_mismatch"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
