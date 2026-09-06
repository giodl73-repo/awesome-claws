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
    "../claws/experimentation-lead/fixtures/experiment-record.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/experimentation-lead/schemas/experiment-record.schema.json", import.meta.url),
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
    validateArtifactSemantics("experimentation-lead", value).length === 0
  );
}

test("experiment record fixture keeps metric, guardrail, evidence, and decision data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("experimentation-lead", fixture), []);
});

test("experimentation validator is total over schema-valid malformed nested records", () => {
  const malformedMetric = clone();
  malformedMetric.metrics.push({});
  assert.equal(validateSchema(malformedMetric), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformedMetric));
  assert.equal(isValid(malformedMetric), false);

  const malformedGuardrail = clone();
  malformedGuardrail.guardrails.push({});
  assert.equal(validateSchema(malformedGuardrail), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformedGuardrail));
  assert.equal(isValid(malformedGuardrail), false);

  const malformedEvidence = clone();
  malformedEvidence.evidence.push({});
  assert.equal(validateSchema(malformedEvidence), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformedEvidence));
  assert.equal(isValid(malformedEvidence), false);
});

test("experimentation validator rejects non-array required ledgers", () => {
  for (const field of ["evidence", "principals"]) {
    const malformed = clone();
    malformed[field] = {};
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformed));
    assert.ok(
      validateArtifactSemantics("experimentation-lead", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("experimentation validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformed));
  const findings = validateArtifactSemantics("experimentation-lead", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("experimentation validator handles a non-array conclusion masquerading as a schema-valid nullable object without throwing", () => {
  const malformed = clone();
  malformed.conclusion = "positive";
  // The schema's anyOf keeps the lenient legacy branch available alongside
  // the enriched branch, and the legacy branch does not constrain
  // "conclusion" at all; a document that also satisfies the legacy
  // required-field subset (as this full fixture does, by domain design)
  // remains schema-valid even with a malformed enriched-only field, so
  // semantic dispatch is the sole guard for this case now.
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", malformed).some(
      (item) => item.code === "premature_decision_state",
    ),
  );

  const emptyConclusion = clone();
  emptyConclusion.conclusion = {};
  assert.equal(validateSchema(emptyConclusion), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", emptyConclusion));
  assert.equal(isValid(emptyConclusion), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", emptyConclusion).some(
      (item) => item.code === "premature_decision_state",
    ),
  );
});

test("experimentation validator does not downgrade malformed enriched fields to legacy semantics", () => {
  const malformed = clone();
  malformed.owner = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("experimentation validator does not downgrade incomplete enriched records to legacy semantics", () => {
  for (const field of ["principals", "handoff"]) {
    const incomplete = clone();
    delete incomplete[field];
    assert.equal(validateSchema(incomplete), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("experimentation-lead", incomplete));
    assert.equal(isValid(incomplete), false, field);
    assert.ok(
      validateArtifactSemantics("experimentation-lead", incomplete).length > 0,
      `expected incomplete enriched contract finding after deleting ${field}`,
    );
  }
});

test("experimentation validator rejects a metric predeclared after exposure begins (post-hoc metric declaration)", () => {
  const postHoc = clone();
  postHoc.metrics.find((item) => item.id === "metric-activation").predeclaredAt = "2026-07-20T00:00:00Z";
  assert.equal(isValid(postHoc), false);
  const findings = validateArtifactSemantics("experimentation-lead", postHoc);
  assert.ok(findings.some((item) => item.code === "post_hoc_metric_declaration"));
});

test("experimentation validator rejects more than one primary metric", () => {
  const twoPrimaries = clone();
  twoPrimaries.metrics.find((item) => item.id === "metric-support-load").role = "primary";
  assert.equal(isValid(twoPrimaries), false);
  const findings = validateArtifactSemantics("experimentation-lead", twoPrimaries);
  assert.ok(findings.some((item) => item.code === "invalid_primary_metric_count"));
});

test("experimentation validator rejects a guardrail evaluated with evidence asserted before the exposure window ended (peeking)", () => {
  const peeked = clone();
  peeked.evidence.find((item) => item.id === "evidence-guardrail-support-load").assertedAt =
    "2026-07-25T00:00:00Z";
  assert.equal(isValid(peeked), false);
  const findings = validateArtifactSemantics("experimentation-lead", peeked);
  assert.ok(findings.some((item) => item.code === "unsupported_guardrail_evaluation"));
});

test("experimentation validator rejects an unresolved exposure incident blocking a recorded decision", () => {
  const unresolvedIncident = clone();
  unresolvedIncident.evidence.find((item) => item.id === "evidence-exposure-incident-minor").resolved = false;
  assert.equal(isValid(unresolvedIncident), false);
  const findings = validateArtifactSemantics("experimentation-lead", unresolvedIncident);
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects a conclusion whose metricRef does not match the primary metric (post-hoc metric swap)", () => {
  const swappedMetric = clone();
  swappedMetric.conclusion.metricRef = "metric-support-load";
  assert.equal(isValid(swappedMetric), false);
  const findings = validateArtifactSemantics("experimentation-lead", swappedMetric);
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects control/treatment percentages that do not sum to 100", () => {
  const badSplit = clone();
  badSplit.exposurePlan.controlGroupPercent = 40;
  assert.equal(isValid(badSplit), false);
  const findings = validateArtifactSemantics("experimentation-lead", badSplit);
  assert.ok(findings.some((item) => item.code === "invalid_exposure_allocation"));
});

test("experimentation validator accepts a fractional control/treatment split that sums to exactly 100 within floating-point tolerance", () => {
  const fractionalSplit = clone();
  fractionalSplit.exposurePlan.controlGroupPercent = 50.1;
  fractionalSplit.exposurePlan.treatmentGroupPercent = 49.9;
  // The preregistration receipt's frozen digest was computed for the
  // original 50/50 split, so changing the split alone (without a fresh
  // receipt) is expected to trip the post-hoc-mutation digest check; the
  // allocation-validity check itself must not fire.
  const findings = validateArtifactSemantics("experimentation-lead", fractionalSplit);
  assert.ok(!findings.some((item) => item.code === "invalid_exposure_allocation"));
});

test("experimentation validator rejects a zero/100 control-treatment allocation", () => {
  const zeroAlloc = clone();
  zeroAlloc.exposurePlan.controlGroupPercent = 0;
  zeroAlloc.exposurePlan.treatmentGroupPercent = 100;
  assert.equal(isValid(zeroAlloc), false);
  const findings = validateArtifactSemantics("experimentation-lead", zeroAlloc);
  assert.ok(findings.some((item) => item.code === "invalid_exposure_allocation"));
});

test("experimentation validator rejects a guardrail grounded in evidence for an unrelated metric", () => {
  const unrelated = clone();
  unrelated.guardrails[0].metricRef = "metric-activation";
  assert.equal(isValid(unrelated), false);
  const findings = validateArtifactSemantics("experimentation-lead", unrelated);
  assert.ok(findings.some((item) => item.code === "unsupported_guardrail_evaluation"));
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects a primary readout missing structured analysis fields (sampleSize, result, uncertainty)", () => {
  const missingSampleSize = clone();
  delete missingSampleSize.evidence.find((item) => item.id === "evidence-readout-activation").sampleSize;
  assert.equal(isValid(missingSampleSize), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", missingSampleSize).some(
      (item) => item.code === "premature_decision_state",
    ),
  );

  const missingResult = clone();
  delete missingResult.evidence.find((item) => item.id === "evidence-readout-activation").result;
  assert.equal(isValid(missingResult), false);

  const missingUncertainty = clone();
  delete missingUncertainty.evidence.find((item) => item.id === "evidence-readout-activation").uncertainty;
  assert.equal(isValid(missingUncertainty), false);
});

test("experimentation validator rejects a decision-recorded state missing the preregistration receipt", () => {
  const missingPrereg = clone();
  missingPrereg.evidence = missingPrereg.evidence.filter((item) => item.kind !== "preregistration-receipt");
  assert.equal(isValid(missingPrereg), false);
  const findings = validateArtifactSemantics("experimentation-lead", missingPrereg);
  assert.ok(findings.some((item) => item.code === "missing_preregistration_receipt"));
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects zero/missing exposure-arm counts bypassing the recorded decision", () => {
  const noArms = clone();
  noArms.exposurePlan.arms = [];
  assert.equal(isValid(noArms), false);
  const findings = validateArtifactSemantics("experimentation-lead", noArms);
  assert.ok(findings.some((item) => item.code === "invalid_arm_allocation"));
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects a self-attested decision owner (same principal id as the experiment owner)", () => {
  const selfDecision = clone();
  selfDecision.decisionRecord.decisionOwnerId = selfDecision.ownerId;
  selfDecision.principals.find((item) => item.id === selfDecision.ownerId).scopes.push(
    "experiment-decision-authority",
  );
  assert.equal(isValid(selfDecision), false);
  const findings = validateArtifactSemantics("experimentation-lead", selfDecision);
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects an arbitrary, unregistered decision owner id", () => {
  const arbitraryOwner = clone();
  arbitraryOwner.decisionRecord.decisionOwnerId = "principal-ghost";
  assert.equal(isValid(arbitraryOwner), false);
  const findings = validateArtifactSemantics("experimentation-lead", arbitraryOwner);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects a decision record dated before the readout it relies on", () => {
  const earlyDecision = clone();
  earlyDecision.decisionRecord.decidedAt = "2026-08-01T00:00:00Z";
  assert.equal(isValid(earlyDecision), false);
  const findings = validateArtifactSemantics("experimentation-lead", earlyDecision);
  assert.ok(findings.some((item) => item.code === "premature_decision_state"));
});

test("experimentation validator rejects a decision recorded before guardrail or arm evidence", () => {
  for (const evidenceId of [
    "evidence-guardrail-support-load",
    "evidence-exposure-count-control",
    "evidence-exposure-count-treatment",
  ]) {
    const lateEvidence = clone();
    lateEvidence.evidence.find((item) => item.id === evidenceId).assertedAt =
      "2026-08-20T00:00:00Z";
    assert.equal(isValid(lateEvidence), false, evidenceId);
    assert.ok(
      validateArtifactSemantics("experimentation-lead", lateEvidence).some(
        (item) => item.code === "premature_decision_state",
      ),
      `expected decision chronology finding for ${evidenceId}`,
    );
  }
});

test("experimentation validator rejects a malformed/empty controlled evidence sourceRef", () => {
  const emptyControlled = clone();
  emptyControlled.evidence.find((item) => item.id === "evidence-readout-activation").sourceRef = "controlled://";
  assert.equal(isValid(emptyControlled), false);
  const findings = validateArtifactSemantics("experimentation-lead", emptyControlled);
  assert.ok(findings.some((item) => item.code === "untrusted_evidence_source"));
});

test("experimentation validator rejects a blank owner and the exact package self-attestation identity 'experimentation lead'", () => {
  const blankOwner = clone();
  blankOwner.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "Experimentation Lead";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("experimentation-lead", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("experimentation validator requires the handoff to stay blocked until the decision is validly recorded", () => {
  const prematureReady = clone();
  prematureReady.decisionState = "analysis-ready";
  prematureReady.handoff.state = "ready";
  assert.equal(isValid(prematureReady), false);
  const findings = validateArtifactSemantics("experimentation-lead", prematureReady);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("experimentation validator rejects an unauthorized narrative claim of launching the experiment", () => {
  const narrative = clone();
  narrative.handoff.summary = "We launched the experiment to the full population this morning.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("experimentation-lead", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

// A HEAD-authored artifact predating the enriched decision record: the exact
// pre-checkpoint-3 single-record shape (hypothesis/population/metrics/
// guardrails/decisionState, no exposurePlan/evidence/owner/handoff/etc.).
const legacyExperimentRecord = {
  hypothesis: "Reducing checkout steps increases completion without harming refund rate.",
  population: "Web checkout sessions during the study window.",
  metrics: ["completion-rate"],
  guardrails: ["refund-rate"],
  decisionState: "analysis-ready",
};

test("experiment record schema preserves the original HEAD legacy single-record shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyExperimentRecord), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("experimentation-lead", legacyExperimentRecord), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it lacks the
  // complete enriched required shape.
  const bothShapesAtOnce = { ...legacyExperimentRecord, schemaVersion: "awesomeClaws.experimentRecord.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("experimentation-lead", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyExperimentRecord)) {
    const incomplete = { ...legacyExperimentRecord };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("experimentation validator dispatches an overlapping legacy+enriched artifact to the full enriched contract", () => {
  // The complete enriched fixture already carries valid hypothesis,
  // population, metrics, guardrails, and decisionState fields at the top
  // level -- exactly what the legacy anyOf branch requires -- so it
  // genuinely overlaps both branches structurally by domain design. Prove
  // that overlap directly against the legacy branch's own subschema, then
  // confirm semantic dispatch still recognizes the complete enriched
  // shape and applies the full decision contract rather than bounded
  // legacy semantics.
  const legacyBranchSchema = schema.anyOf[0];
  const validateLegacyBranch = new Ajv2020({ allErrors: true, strict: true }).compile(legacyBranchSchema);
  const overlap = clone();
  assert.equal(validateLegacyBranch(overlap), true, JSON.stringify(validateLegacyBranch.errors));
  assert.equal(validateSchema(overlap), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("experimentation-lead", overlap), []);
});

test("experimentation validator applies bounded legacy semantics without requiring enriched-only fields", () => {
  const blankField = { ...legacyExperimentRecord, hypothesis: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("experimentation-lead", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const unknownDecisionState = { ...legacyExperimentRecord, decisionState: "archived" };
  assert.equal(validateSchema(unknownDecisionState), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("experimentation-lead", unknownDecisionState).some(
      (item) => item.code === "invalid_legacy_decision_state",
    ),
  );
});

test("validate-artifact CLI accepts the packaged experimentation-lead fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "experimentation-lead", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy experiment record artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `experimentation-lead-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyExperimentRecord, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "experimentation-lead", scratchPath],
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

test("validate-artifact CLI reports semantic findings for a premature decision-recorded experiment artifact", async () => {
  const prematureDecision = clone();
  prematureDecision.evidence.find((item) => item.id === "evidence-exposure-incident-minor").resolved = false;
  assert.equal(validateSchema(prematureDecision), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureDecision), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `experimentation-lead-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureDecision, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "experimentation-lead", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_decision_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
