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
const fixturePath = fileURLToPath(new URL("../claws/security-analyst/fixtures/threat-assessment.example.json", import.meta.url));
const schema = JSON.parse(await readFile(new URL("../claws/security-analyst/schemas/threat-assessment.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("security-analyst", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

const legacy = {
  assessmentScope: "Preview fetch boundary",
  assessmentMode: "evidence-review",
  authorizationRef: "security-review/approved",
  assets: [{ name: "Preview service", owner: "Platform", trustBoundary: "Internet to worker", criticality: "high" }],
  scenarios: [{
    id: "SEC-001",
    title: "Link-local fetch",
    asset: "Preview service",
    threatSource: "Document author",
    attackTechnique: "SSRF",
    exploitPreconditions: ["User-controlled URL"],
    existingControls: ["Scheme allowlist"],
    evidenceState: "supported",
    evidence: [{ reference: "review/1", source: "Architecture export", observedAt: "2026-09-01T09:00:00Z", state: "verified" }],
    likelihood: "possible",
    impact: "major",
    confidence: "medium",
    severity: "high",
    remediation: { action: "Block link-local", owner: "Platform", verification: "Regression", state: "planned" },
  }],
  riskOwner: "Riley Chen",
  assessmentState: "needs-remediation",
};

test("security fixture is a realistic valid enriched assessment", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("security validator is total over malformed arrays and records", () => {
  for (const field of ["principals", "assets", "scenarios", "observations", "evidence", "controlAssertions", "remediations", "verifications"]) {
    const malformed = clone();
    malformed[field].push(null);
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_list" && item.path === field));
  }
});

test("security enriched records require the exact schema version and cannot downgrade through a hybrid", () => {
  const wrongVersion = clone();
  wrongVersion.schemaVersion = "awesomeClaws.threatAssessment.v2";
  assert.equal(validateSchema(wrongVersion), false);
  assert.ok(findings(wrongVersion).some((item) => item.code === "invalid_schema_version"));

  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(findings(hybrid).some((item) => item.code === "invalid_array_list" && item.path === "principals"));

  for (const field of ["assessmentMode", "riskOwner"]) {
    const partialHybrid = clone();
    partialHybrid[field] = legacy[field];
    assert.equal(isValid(partialHybrid), false);
    assert.ok(
      findings(partialHybrid).some(
        (item) =>
          item.code === "legacy_field_in_enriched_record" && item.path === field,
      ),
    );
  }
});

test("security validator rejects unstable ids and dangling references", () => {
  const malformed = clone();
  delete malformed.assets[0].id;
  malformed.scenarios[0].assetRef = "asset-missing";
  assert.equal(isValid(malformed), false);
  assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record" && item.path === "assets[0].id"));
  assert.ok(findings(malformed).some((item) => item.code === "dangling_reference"));

  const danglingOwner = clone();
  danglingOwner.assets[0].ownerId = "principal-missing";
  assert.equal(isValid(danglingOwner), false);
  assert.ok(
    findings(danglingOwner).some(
      (item) =>
        item.code === "dangling_reference" &&
        item.path === "assets[0].ownerId",
    ),
  );
});

test("security evidence must bind the exact scenario, asset, and snapshot", () => {
  const crossScope = clone();
  crossScope.evidence[0].assetRef = "asset-fetch-proxy";
  assert.equal(isValid(crossScope), false);
  assert.ok(findings(crossScope).some((item) => item.code === "cross_scope_evidence"));
  assert.ok(findings(crossScope).some((item) => item.code === "incomplete_scenario_coverage"));

  const orphan = clone();
  orphan.observations.push({
    ...orphan.observations[0],
    id: "observation-orphan",
    scenarioRef: "scenario-missing",
    assetRef: "asset-missing",
    observedById: "principal-missing",
    evidenceRef: "evidence-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(findings(orphan).some((item) => item.code === "unsupported_observation"));
});

test("security evidence chronology is bounded to the assessment request and present", () => {
  for (const timestamp of ["2026-08-01T00:00:00Z", "2099-01-01T00:00:00Z"]) {
    const invalid = clone();
    invalid.evidence[0].assertedAt = timestamp;
    assert.equal(isValid(invalid), false);
    assert.ok(findings(invalid).some((item) => ["stale_evidence", "future_evidence"].includes(item.code)));
  }
});

test("security remediation verification must be independent and exact-scope", () => {
  const selfVerified = clone();
  selfVerified.verifications[0].verifiedById = "principal-network-owner-priya";
  assert.equal(isValid(selfVerified), false);
  assert.ok(findings(selfVerified).some((item) => item.code === "self_verified_remediation"));

  const crossScope = clone();
  crossScope.evidence.find((item) => item.kind === "remediation-verification").snapshotRef = "snapshot-old";
  assert.equal(isValid(crossScope), false);
  assert.ok(findings(crossScope).some((item) => item.code === "unsupported_remediation_verification"));
});

test("security readiness fails for unsupported material scenarios or incomplete coverage", () => {
  const unsupported = clone();
  unsupported.scenarios[0].supportState = "unsupported";
  unsupported.observations[0].result = "unsupported";
  assert.equal(isValid(unsupported), false);
  assert.ok(findings(unsupported).some((item) => item.code === "unsupported_material_scenario"));
  assert.ok(findings(unsupported).some((item) => item.code === "premature_risk_owner_review"));

  const uncovered = clone();
  uncovered.scenarios[0].observationRefs = [];
  assert.ok(findings(uncovered).some((item) => item.code === "incomplete_scenario_coverage"));

  const danglingRemediation = clone();
  danglingRemediation.scenarios[0].remediationRef = "remediation-missing";
  assert.equal(isValid(danglingRemediation), false);
  assert.ok(
    findings(danglingRemediation).some(
      (item) =>
        item.code === "dangling_reference" &&
        item.path === "scenarios[0].remediationRef",
    ),
  );
  assert.ok(
    findings(danglingRemediation).some(
      (item) => item.code === "premature_risk_owner_review",
    ),
  );
});

test("security readiness requires accountable risk-owner authority after all evidence", () => {
  const selfAttested = clone();
  selfAttested.principals.find((item) => item.id === selfAttested.ownerId).name = "Security Analyst";
  selfAttested.owner = "Security Analyst";
  assert.equal(isValid(selfAttested), false);
  assert.ok(findings(selfAttested).some((item) => item.code === "agent_owned_authority"));

  const wrongReviewer = clone();
  wrongReviewer.recommendation.reviewerId = "principal-assessor-alex";
  assert.equal(isValid(wrongReviewer), false);
  assert.ok(findings(wrongReviewer).some((item) => item.code === "premature_risk_owner_review"));

  const titledHuman = clone();
  titledHuman.owner = "Riley Chen, Security Analyst";
  titledHuman.handoff.owner = "Riley Chen, Security Analyst";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name = "Riley Chen, Security Analyst";
  assert.equal(isValid(titledHuman), true);
});

test("security active testing requires stop conditions", () => {
  const missingMode = clone();
  delete missingMode.assessment.mode;
  assert.equal(isValid(missingMode), false);
  assert.ok(
    findings(missingMode).some((item) => item.code === "invalid_assessment_mode"),
  );

  const active = clone();
  active.assessment.mode = "active-testing";
  active.assessment.stopConditions = [];
  assert.ok(findings(active).some((item) => item.code === "missing_stop_conditions"));

  const blankStop = clone();
  blankStop.assessment.mode = "active-testing";
  blankStop.assessment.stopConditions = ["   "];
  assert.equal(isValid(blankStop), false);
  assert.ok(
    findings(blankStop).some((item) => item.code === "missing_stop_conditions"),
  );
});

test("security handoff rejects authority claims and missing gates", () => {
  const claim = clone();
  claim.handoff.summary = "We exploited the target and accepted the risk.";
  assert.ok(findings(claim).some((item) => item.code === "unauthorized_narrative_action"));
  const remediationClaim = clone();
  remediationClaim.handoff.summary = "Completed remediation for the preview service.";
  assert.ok(
    findings(remediationClaim).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
  );
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter((item) => item !== "accept-risk");
  assert.ok(findings(missingGate).some((item) => item.code === "missing_authority_gate"));
});

test("security schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  for (const field of Object.keys(legacy)) {
    const incomplete = structuredClone(legacy);
    delete incomplete[field];
    assert.equal(validateSchema(incomplete), false, field);
  }
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("security CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `security-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(process.execPath, [resolve(root, "scripts", "validate-artifact.mjs"), "security-analyst", path], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
