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
  new URL(
    "../claws/cloud-cost-analyst/fixtures/cloud-cost-record.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/cloud-cost-analyst/schemas/cloud-cost-record.schema.json", import.meta.url),
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
    validateArtifactSemantics("cloud-cost-analyst", value).length === 0
  );
}

test("cloud cost record fixture keeps snapshot, allocation, evidence, and recommendation data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("cloud-cost-analyst", fixture), []);
});

test("cloud cost validator is total over schema-valid malformed nested records", () => {
  for (const field of ["accounts", "principals", "allocations", "evidence", "anomalies", "recommendations"]) {
    const malformed = clone();
    malformed[field].push({});
    assert.equal(validateSchema(malformed), true, `${field}: ${JSON.stringify(validateSchema.errors)}`);
    assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", malformed));
    assert.equal(isValid(malformed), false, field);
  }
});

test("cloud cost validator returns a finding for a malformed snapshot date", () => {
  const malformed = clone();
  malformed.snapshot.asOf = "not-a-date";
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", malformed));
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", malformed).some(
      (item) => item.code === "future_evidence" && item.path === "snapshot.asOf",
    ),
  );
});

test("cloud cost validator rejects non-array required ledgers", () => {
  for (const field of ["accounts", "principals", "evidence", "anomalies", "recommendations"]) {
    const malformed = clone();
    malformed[field] = {};
    assert.equal(validateSchema(malformed), true, `${field}: ${JSON.stringify(validateSchema.errors)}`);
    assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", malformed));
    assert.ok(
      validateArtifactSemantics("cloud-cost-analyst", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("cloud cost validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", malformed));
  const findings = validateArtifactSemantics("cloud-cost-analyst", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("cloud cost validator does not downgrade a malformed enriched-only owner field to legacy semantics", () => {
  const malformed = clone();
  malformed.owner = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("cloud cost validator does not downgrade incomplete enriched records to legacy semantics", () => {
  for (const field of ["principals", "handoff", "snapshot"]) {
    const incomplete = clone();
    delete incomplete[field];
    assert.equal(validateSchema(incomplete), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("cloud-cost-analyst", incomplete));
    assert.equal(isValid(incomplete), false, field);
    assert.ok(
      validateArtifactSemantics("cloud-cost-analyst", incomplete).length > 0,
      `expected incomplete enriched contract finding after deleting ${field}`,
    );
  }
});

test("cloud cost validator requires the enriched schema version despite legacy-branch overlap", () => {
  const unversioned = clone();
  delete unversioned.schemaVersion;
  assert.equal(validateSchema(unversioned), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unversioned), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", unversioned).some(
      (item) => item.code === "invalid_schema_version" && item.path === "schemaVersion",
    ),
  );
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", unversioned).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("cloud cost validator rejects an allocation grounded in a different account's evidence (cross-account evidence)", () => {
  const crossAccount = clone();
  crossAccount.allocations[0].evidenceRef = "evidence-billing-staging";
  assert.equal(isValid(crossAccount), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", crossAccount);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("cloud cost validator requires stable ids across cost and authority ledgers", () => {
  const missingAllocationId = clone();
  delete missingAllocationId.allocations[0].id;
  assert.equal(validateSchema(missingAllocationId), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingAllocationId), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", missingAllocationId).some(
      (item) => item.code === "invalid_array_record" && item.path === "allocations[0].id",
    ),
  );

  const missingPrincipalId = clone();
  missingPrincipalId.principals.push({ name: "Taylor Human", scopes: [] });
  assert.equal(validateSchema(missingPrincipalId), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingPrincipalId), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", missingPrincipalId).some(
      (item) => item.code === "invalid_array_record" && item.path === "principals[3].id",
    ),
  );
});

test("cloud cost validator rejects evidence whose billing window does not match the snapshot window (cross-window evidence)", () => {
  const crossWindow = clone();
  crossWindow.evidence[0].windowStart = "2026-07-01T00:00:00Z";
  crossWindow.evidence[0].windowEnd = "2026-07-31T23:59:59Z";
  assert.equal(isValid(crossWindow), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", crossWindow);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("cloud cost validator rejects evidence in a different currency than the record (cross-currency evidence)", () => {
  const crossCurrency = clone();
  crossCurrency.evidence[0].currency = "EUR";
  assert.equal(isValid(crossCurrency), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", crossCurrency);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("cloud cost validator rejects allocation amounts that do not reconcile with the declared total", () => {
  const mismatched = clone();
  mismatched.allocations[0].amount += 500;
  assert.equal(isValid(mismatched), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", mismatched);
  assert.ok(findings.some((item) => item.code === "total_reconciliation_mismatch"));
});

test("cloud cost validator rejects a duplicate accepted savings recommendation for the same account/type/basis", () => {
  const duplicated = clone();
  const original = duplicated.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute");
  const duplicate = { ...structuredClone(original), id: "rec-rightsizing-staging-compute-duplicate" };
  duplicated.recommendations.push(duplicate);
  assert.equal(isValid(duplicated), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", duplicated);
  assert.ok(findings.some((item) => item.code === "duplicate_savings_recommendation"));
});

test("cloud cost validator rejects an accepted recommendation approved by a principal lacking cost-approval-authority (unsupported approval)", () => {
  const unsupported = clone();
  unsupported.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute").approval.approverId =
    "principal-finance-owner-sam";
  assert.equal(isValid(unsupported), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", unsupported);
  assert.ok(findings.some((item) => item.code === "unsupported_recommendation_approval"));
});

test("cloud cost validator rejects a recommendation that claims realized savings", () => {
  const realized = clone();
  realized.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute").realized = true;
  assert.equal(isValid(realized), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", realized);
  assert.ok(findings.some((item) => item.code === "savings_realized_claim"));
});

test("cloud cost validator rejects a self-approved recommendation (approver id equals owner id)", () => {
  const selfApproved = clone();
  const rec = selfApproved.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute");
  rec.approval.approverId = rec.ownerId;
  assert.equal(isValid(selfApproved), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", selfApproved);
  assert.ok(findings.some((item) => item.code === "self_approved_recommendation"));
});

test("cloud cost validator rejects an arbitrary, unregistered approver id", () => {
  const arbitraryApprover = clone();
  arbitraryApprover.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute").approval.approverId =
    "principal-ghost";
  assert.equal(isValid(arbitraryApprover), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", arbitraryApprover);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
});

test("cloud cost validator rejects future-dated billing evidence", () => {
  const future = clone();
  future.evidence[0].assertedAt = "2099-01-01T00:00:00Z";
  assert.equal(isValid(future), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", future);
  assert.ok(findings.some((item) => item.code === "future_evidence"));
});

test("cloud cost validator rejects billing evidence asserted before its own billing window closes (stale/premature evidence)", () => {
  const stale = clone();
  stale.evidence[0].assertedAt = "2026-08-15T00:00:00Z";
  assert.equal(isValid(stale), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", stale);
  assert.ok(findings.some((item) => item.code === "stale_evidence"));
});

test("cloud cost validator rejects a dangling account reference on an allocation", () => {
  const dangling = clone();
  dangling.allocations[0].accountRef = "account-ghost";
  assert.equal(isValid(dangling), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", dangling);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
});

test("cloud cost validator requires the handoff to stay blocked for a vacuous/empty account scope", () => {
  const empty = clone();
  empty.accounts = [];
  empty.allocations = [];
  empty.anomalies = [];
  empty.recommendations = [];
  empty.evidence = [];
  empty.total = 0;
  assert.equal(isValid(empty), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", empty);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("cloud cost validator requires a stable owner principal id", () => {
  const missingOwnerId = clone();
  delete missingOwnerId.ownerId;
  assert.equal(isValid(missingOwnerId), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", missingOwnerId).some(
      (item) => item.code === "agent_owned_authority" && item.path === "ownerId",
    ),
  );
});

test("cloud cost validator rejects a blank owner and the exact package self-attestation identity 'cloud cost analyst'", () => {
  const blankOwner = clone();
  blankOwner.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "Cloud Cost Analyst";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("cloud cost validator rejects an unauthorized narrative claim of representing finance approval", () => {
  const narrative = clone();
  narrative.handoff.summary = "The finance approval was granted this morning and savings were realized.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

test("cloud cost validator rejects accepted savings that exceed the eligible savings baseline", () => {
  const exceeded = clone();
  exceeded.savingsBaseline = 1000;
  assert.equal(isValid(exceeded), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", exceeded);
  assert.ok(findings.some((item) => item.code === "savings_exceeds_baseline"));
});

test("cloud cost validator rejects a negative estimated savings amount", () => {
  const negative = clone();
  negative.recommendations.find((item) => item.id === "rec-rightsizing-staging-compute").estimatedSavings = -50;
  assert.equal(isValid(negative), false);
  const findings = validateArtifactSemantics("cloud-cost-analyst", negative);
  assert.ok(findings.some((item) => item.code === "negative_savings_recommendation"));
});

// A HEAD-authored artifact predating the enriched reconciliation record: the
// exact pre-checkpoint single-record shape (period/currency/basis/total/
// allocations, no snapshot/accounts/principals/evidence/owner/handoff/etc.).
const legacyCloudCostRecord = {
  period: "2026-05",
  currency: "USD",
  basis: "amortized",
  total: 42000,
  allocations: [{ service: "compute", amount: 42000 }],
};

test("cloud cost record schema preserves the original HEAD legacy single-record shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyCloudCostRecord), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("cloud-cost-analyst", legacyCloudCostRecord), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it lacks the
  // complete enriched required shape.
  const bothShapesAtOnce = { ...legacyCloudCostRecord, schemaVersion: "awesomeClaws.cloudCostRecord.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("cloud-cost-analyst", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyCloudCostRecord)) {
    const incomplete = { ...legacyCloudCostRecord };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("cloud cost validator dispatches an overlapping legacy+enriched artifact to the full enriched contract", () => {
  // The complete enriched fixture already carries valid period, currency,
  // basis, total, and allocations fields at the top level -- exactly what
  // the legacy anyOf branch requires -- so it genuinely overlaps both
  // branches structurally by domain design. Prove that overlap directly
  // against the legacy branch's own subschema, then confirm semantic
  // dispatch still recognizes the complete enriched shape and applies the
  // full reconciliation contract rather than bounded legacy semantics.
  const legacyBranchSchema = schema.anyOf[0];
  const validateLegacyBranch = new Ajv2020({ allErrors: true, strict: true }).compile(legacyBranchSchema);
  const overlap = clone();
  assert.equal(validateLegacyBranch(overlap), true, JSON.stringify(validateLegacyBranch.errors));
  assert.equal(validateSchema(overlap), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("cloud-cost-analyst", overlap), []);
});

test("cloud cost validator applies bounded legacy semantics without requiring enriched-only fields", () => {
  const blankField = { ...legacyCloudCostRecord, currency: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const blankPeriod = { ...legacyCloudCostRecord, period: "   " };
  assert.equal(validateSchema(blankPeriod), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("cloud-cost-analyst", blankPeriod).some(
      (item) => item.code === "invalid_legacy_field" && item.path === "period",
    ),
  );
});

test("validate-artifact CLI accepts the packaged cloud-cost-analyst fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "cloud-cost-analyst", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy cloud cost record artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `cloud-cost-analyst-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyCloudCostRecord, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "cloud-cost-analyst", scratchPath],
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

test("validate-artifact CLI reports semantic findings for a total-reconciliation-mismatch cloud cost artifact", async () => {
  const mismatched = clone();
  mismatched.allocations[0].amount += 500;
  assert.equal(validateSchema(mismatched), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(mismatched), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `cloud-cost-analyst-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(mismatched, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "cloud-cost-analyst", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "total_reconciliation_mismatch"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
