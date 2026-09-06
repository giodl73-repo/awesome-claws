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
    "../claws/quality-assurance-lead/fixtures/test-evidence.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/quality-assurance-lead/schemas/test-evidence.schema.json", import.meta.url),
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
    validateArtifactSemantics("quality-assurance-lead", value).length === 0
  );
}

test("test evidence fixture keeps requirement, execution, defect, and recommendation data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("quality-assurance-lead", fixture), []);
});

test("quality assurance validator is total over schema-valid malformed nested records", () => {
  for (const field of ["requirements", "principals", "testCases", "testRuns", "evidence", "defects"]) {
    const malformed = clone();
    malformed[field].push({});
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("quality-assurance-lead", malformed));
    assert.equal(isValid(malformed), false, field);
  }
});

// Malforming a required enriched field's array type (e.g. setting it to a
// bare object) breaks the enriched anyOf branch, and this schema's legacy
// branch does not share any field names with the enriched branch other than
// "evidence" (deliberately excluded from enriched dispatch), so the pure
// enriched fixture has no schema fallback once an enriched-required field is
// malformed. Overlay the exact legacy required fields (with "evidence"
// forced to the legacy string shape) so the document keeps validating via
// the legacy anyOf branch while the target enriched field is malformed;
// enriched semantic dispatch still fires because other enriched-only
// properties (owner, handoff, etc.) remain present.
function withLegacyOverlay(value) {
  return {
    ...value,
    requirementId: "req-legacy-overlay",
    risk: "medium",
    testId: "test-legacy-overlay",
    state: "passed",
    evidence: "Legacy evidence note kept only to satisfy the legacy anyOf branch's required string type.",
  };
}

test("quality assurance validator rejects non-array required ledgers", () => {
  for (const field of ["requirements", "principals", "testCases", "testRuns", "defects"]) {
    const malformed = withLegacyOverlay(clone());
    malformed[field] = {};
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("quality-assurance-lead", malformed));
    assert.ok(
      validateArtifactSemantics("quality-assurance-lead", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("quality assurance validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("quality-assurance-lead", malformed));
  const findings = validateArtifactSemantics("quality-assurance-lead", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("quality assurance validator keeps the handoff blocked when recommendation is null or an incomplete object", () => {
  const nullRecommendation = clone();
  nullRecommendation.recommendation = null;
  assert.equal(validateSchema(nullRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(nullRecommendation), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", nullRecommendation).some(
      (item) => item.code === "premature_ready_state",
    ),
  );

  const emptyRecommendation = clone();
  emptyRecommendation.recommendation = {};
  assert.equal(validateSchema(emptyRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(emptyRecommendation), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", emptyRecommendation).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("quality assurance validator does not downgrade a malformed enriched owner field to legacy semantics", () => {
  const malformed = withLegacyOverlay(clone());
  malformed.owner = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("quality-assurance-lead", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("quality assurance validator fails closed on a hybrid record that satisfies the legacy branch but has a partially deleted enriched shape", () => {
  // A document can carry the exact HEAD legacy required fields (which the
  // legacy anyOf branch accepts regardless of any other properties present)
  // alongside most, but not all, of the enriched contract. Semantic dispatch
  // must still recognize the surviving enriched-only properties (owner,
  // handoff, etc.) and fail closed on the missing "principals" ledger rather
  // than silently accepting the now schema-valid-via-legacy-branch document.
  const hybrid = clone();
  delete hybrid.principals;
  hybrid.requirementId = "req-legacy";
  hybrid.risk = "low";
  hybrid.testId = "test-legacy";
  hybrid.state = "passed";
  hybrid.evidence = "manual note";
  assert.equal(validateSchema(hybrid), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("quality-assurance-lead", hybrid));
  assert.equal(isValid(hybrid), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", hybrid);
  assert.ok(findings.some((item) => item.code === "invalid_array_list" && item.path === "principals"));
  assert.ok(findings.some((item) => item.code === "invalid_array_list" && item.path === "evidence"));
});

test("quality assurance validator requires the exact enriched schema version", () => {
  const unknownVersion = clone();
  unknownVersion.schemaVersion = "bogus-future-version";
  assert.equal(validateSchema(unknownVersion), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownVersion), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", unknownVersion);
  assert.ok(
    findings.some(
      (item) => item.code === "invalid_schema_version" && item.path === "schemaVersion",
    ),
  );
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("quality assurance validator rejects a test run's evidence asserted for a different build (cross-build evidence)", () => {
  const crossBuild = clone();
  crossBuild.evidence.find((item) => item.id === "evidence-run-checkout-completion-1").buildId =
    "release-2026.8.0-mobile";
  assert.equal(isValid(crossBuild), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", crossBuild);
  assert.ok(findings.some((item) => item.code === "unsupported_test_result"));
});

test("quality assurance validator rejects colliding missing record ids and references", () => {
  const missingIdentity = clone();
  delete missingIdentity.requirements[0].id;
  delete missingIdentity.testCases[0].requirementRef;
  assert.equal(validateSchema(missingIdentity), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingIdentity), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", missingIdentity);
  assert.ok(
    findings.some(
      (item) => item.code === "invalid_array_record" && item.path === "requirements[0].id",
    ),
  );
  assert.ok(
    findings.some(
      (item) => item.code === "dangling_reference" && item.path === "testCases[0].requirementRef",
    ),
  );
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("quality assurance validator rejects a release recommendation while a required criterion is untested", () => {
  const untested = clone();
  untested.testRuns = untested.testRuns.filter(
    (run) => run.testCaseRef !== "tc-payment-retry-decline",
  );
  assert.equal(isValid(untested), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", untested);
  assert.ok(findings.some((item) => item.code === "untested_required_criterion"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
});

test("quality assurance validator rejects a raw pass toggle that disagrees with the grounding evidence's recorded outcome", () => {
  const rawToggle = clone();
  rawToggle.testRuns.find((run) => run.id === "run-payment-retry-1").result = "passed";
  assert.equal(isValid(rawToggle), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", rawToggle);
  assert.ok(findings.some((item) => item.code === "unsupported_test_result"));
});

test("quality assurance validator rejects an open release-blocking defect", () => {
  const openBlocker = clone();
  openBlocker.defects.push({
    id: "defect-blocker-open",
    testRunRef: "run-checkout-completion-1",
    severity: "blocker",
    status: "open",
    foundAt: "2026-09-01T10:10:00Z",
  });
  assert.equal(isValid(openBlocker), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", openBlocker);
  assert.ok(findings.some((item) => item.code === "open_release_blocking_defect"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
});

test("quality assurance validator requires a passing rerun after independent defect verification", () => {
  const failedOnly = clone();
  failedOnly.testRuns = failedOnly.testRuns.filter((item) => item.id !== "run-payment-retry-2");
  failedOnly.evidence = failedOnly.evidence.filter((item) => item.id !== "evidence-run-payment-retry-2");
  assert.equal(validateSchema(failedOnly), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(failedOnly), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", failedOnly);
  assert.ok(findings.some((item) => item.code === "untested_required_criterion"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("quality assurance validator rejects a defect verified by the same principal who executed the failing run (self-verification)", () => {
  const selfVerified = clone();
  const defect = selfVerified.defects.find((item) => item.id === "defect-payment-retry-decline");
  defect.verifiedById = "principal-qa-engineer-alex";
  assert.equal(isValid(selfVerified), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", selfVerified);
  assert.ok(findings.some((item) => item.code === "self_verified_defect"));
});

test("quality assurance validator rejects defect verification evidence from another build", () => {
  const crossBuild = clone();
  crossBuild.evidence.find(
    (item) => item.id === "evidence-defect-verification-payment-retry",
  ).buildId = "release-2026.8.0-mobile";
  assert.equal(isValid(crossBuild), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", crossBuild).some(
      (item) => item.code === "unsupported_defect_verification",
    ),
  );
});

test("quality assurance validator rejects verification evidence reused for another defect", () => {
  const crossDefect = clone();
  crossDefect.defects.find(
    (item) => item.id === "defect-payment-retry-decline",
  ).id = "defect-payment-retry-other";
  assert.equal(isValid(crossDefect), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", crossDefect).some(
      (item) => item.code === "unsupported_defect_verification",
    ),
  );
});

test("quality assurance validator rejects defect evidence asserted after verification", () => {
  const prematureVerification = clone();
  prematureVerification.defects[0].verifiedAt = "2026-09-02T09:00:00Z";
  assert.equal(isValid(prematureVerification), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", prematureVerification);
  assert.ok(findings.some((item) => item.code === "unsupported_defect_verification"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("quality assurance validator rejects a recommendation signed before its evidence", () => {
  const earlyRecommendation = clone();
  earlyRecommendation.evidence.find(
    (item) => item.id === "evidence-run-payment-retry-2",
  ).assertedAt = "2026-09-02T10:30:00Z";
  assert.equal(isValid(earlyRecommendation), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", earlyRecommendation).some(
      (item) => item.code === "premature_release_recommendation",
    ),
  );
});

test("quality assurance validator rejects an arbitrary, unregistered recommendation reviewer", () => {
  const arbitraryReviewer = clone();
  arbitraryReviewer.recommendation.reviewerId = "principal-ghost";
  assert.equal(isValid(arbitraryReviewer), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", arbitraryReviewer);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
});

test("quality assurance validator rejects evidence asserted before the release was requested (stale evidence)", () => {
  const stale = clone();
  stale.evidence.find((item) => item.id === "evidence-run-checkout-completion-1").assertedAt =
    "2026-08-01T00:00:00Z";
  assert.equal(isValid(stale), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", stale);
  assert.ok(findings.some((item) => item.code === "stale_evidence"));
});

test("quality assurance validator rejects evidence asserted in the future", () => {
  const future = clone();
  future.evidence.find((item) => item.id === "evidence-run-checkout-completion-1").assertedAt =
    "2099-01-01T00:00:00Z";
  assert.equal(isValid(future), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", future);
  assert.ok(findings.some((item) => item.code === "future_evidence"));
});

test("quality assurance validator rejects evidence asserted before the test run it grounds (out-of-order evidence)", () => {
  const outOfOrder = clone();
  outOfOrder.evidence.find((item) => item.id === "evidence-run-checkout-completion-1").assertedAt =
    "2026-09-01T09:00:00Z";
  assert.equal(isValid(outOfOrder), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", outOfOrder);
  assert.ok(findings.some((item) => item.code === "unsupported_test_result"));
});

test("quality assurance validator rejects an empty requirement portfolio recommended for release (vacuous ready state)", () => {
  const vacuous = clone();
  vacuous.requirements = [];
  vacuous.testCases = [];
  vacuous.testRuns = [];
  assert.equal(isValid(vacuous), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", vacuous);
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
});

test("quality assurance validator rejects a missing release build and environment scope", () => {
  const unscoped = clone();
  delete unscoped.release.buildId;
  delete unscoped.release.environment;
  for (const run of unscoped.testRuns) {
    delete run.buildId;
    delete run.environment;
  }
  assert.equal(validateSchema(unscoped), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unscoped), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", unscoped);
  assert.ok(findings.some((item) => item.code === "invalid_release_scope"));
  assert.ok(findings.some((item) => item.code === "premature_release_recommendation"));
});

test("quality assurance validator requires a stable owner principal id", () => {
  const missingOwnerId = clone();
  delete missingOwnerId.ownerId;
  assert.equal(isValid(missingOwnerId), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", missingOwnerId).some(
      (item) => item.code === "agent_owned_authority" && item.path === "ownerId",
    ),
  );
});

test("quality assurance validator rejects a blank owner and the exact package self-attestation identity 'Quality Assurance Lead'", () => {
  const blankOwner = clone();
  blankOwner.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "Quality Assurance Lead";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("quality assurance validator rejects an unauthorized narrative claim of deploying the release", () => {
  const narrative = clone();
  narrative.handoff.summary = "We deployed the release to production this morning.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

test("quality assurance validator requires every prohibited release action to remain listed in the handoff", () => {
  const shortened = clone();
  shortened.handoff.prohibitedActions = shortened.handoff.prohibitedActions.filter(
    (action) => action !== "approve-release",
  );
  assert.equal(isValid(shortened), false);
  const findings = validateArtifactSemantics("quality-assurance-lead", shortened);
  assert.ok(findings.some((item) => item.code === "missing_authority_gate"));
});

// A HEAD-authored artifact predating the enriched release-evidence ledger:
// the exact pre-checkpoint single-record shape (requirementId/risk/testId/
// state/evidence, no release/testRuns/defects/handoff/etc.).
const legacyTestEvidence = {
  requirementId: "req-legacy-checkout",
  risk: "high",
  testId: "test-legacy-checkout-happy-path",
  state: "passed",
  evidence: "Manually attached execution log from the legacy tracker.",
};

test("test evidence schema preserves the original HEAD legacy single-record shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyTestEvidence), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("quality-assurance-lead", legacyTestEvidence), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it carries no
  // other enriched-only property.
  const bothShapesAtOnce = { ...legacyTestEvidence, schemaVersion: "awesomeClaws.testEvidence.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("quality-assurance-lead", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyTestEvidence)) {
    const incomplete = { ...legacyTestEvidence };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("quality assurance validator applies bounded legacy semantics without requiring enriched-only fields", () => {
  const blankField = { ...legacyTestEvidence, risk: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("quality-assurance-lead", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );
});

test("validate-artifact CLI accepts the packaged quality-assurance-lead fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "quality-assurance-lead", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy test evidence artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `quality-assurance-lead-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyTestEvidence, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "quality-assurance-lead", scratchPath],
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

test("validate-artifact CLI reports semantic findings for a premature release recommendation artifact", async () => {
  const prematureRecommendation = clone();
  prematureRecommendation.defects.push({
    id: "defect-blocker-open",
    testRunRef: "run-checkout-completion-1",
    severity: "blocker",
    status: "open",
    foundAt: "2026-09-01T10:10:00Z",
  });
  assert.equal(validateSchema(prematureRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureRecommendation), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `quality-assurance-lead-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureRecommendation, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "quality-assurance-lead", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_release_recommendation"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
