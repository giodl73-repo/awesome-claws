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
const fixturePath = fileURLToPath(new URL("../claws/compliance-reviewer/fixtures/control-assessment.example.json", import.meta.url));
const schema = JSON.parse(await readFile(new URL("../claws/compliance-reviewer/schemas/control-assessment.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("compliance-reviewer", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  framework: "Supply-Chain Policy",
  frameworkVersion: "2026.3",
  systemBoundary: "Build and release",
  reviewPeriod: "2026-Q3",
  requirements: [{
    requirementId: "SUP-01",
    requirement: "Artifacts use approved CI",
    controlOwner: "Build Platform",
    implementationState: "implemented",
    evidenceState: "supported",
    evidence: [{ reference: "ci/1842", source: "CI export", custodian: "Build Platform", collectedAt: "2026-09-01T09:00:00Z" }],
    finding: { severity: "none", summary: "Supported", state: "resolved" },
  }],
  remediation: [],
  assessmentDecision: "ready-for-independent-review",
};

test("compliance fixture is a realistic valid enriched assessment", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("compliance validator is total over malformed arrays and records", () => {
  for (const field of ["principals", "requirements", "evidence", "findings", "compensatingControls", "remediation", "verifications"]) {
    const malformed = clone();
    malformed[field].push("bad");
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_list" && item.path === field));
  }
});

test("compliance enriched marker is exact and hybrid deletion fails closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.controlAssessment.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(findings(hybrid).some((item) => item.code === "invalid_array_list" && item.path === "principals"));
});

test("compliance validator rejects unstable ids and dangling references", () => {
  const invalid = clone();
  delete invalid.requirements[0].id;
  invalid.findings[0].requirementRef = "requirement-missing";
  assert.ok(findings(invalid).some((item) => item.code === "invalid_array_record"));
  assert.ok(findings(invalid).some((item) => item.code === "dangling_reference"));

  const danglingOwner = clone();
  danglingOwner.requirements[0].controlOwnerId = "principal-missing";
  assert.equal(isValid(danglingOwner), false);
  assert.ok(
    findings(danglingOwner).some(
      (item) =>
        item.code === "dangling_reference" &&
        item.path === "requirements[0].controlOwnerId",
    ),
  );
});

test("compliance evidence must bind exact requirement and snapshot", () => {
  const crossScope = clone();
  crossScope.evidence[0].snapshotRef = "snapshot-old";
  assert.ok(findings(crossScope).some((item) => item.code === "cross_scope_evidence"));
  assert.ok(findings(crossScope).some((item) => item.code === "incomplete_requirement_coverage"));
});

test("compliance compensating controls require exact controlled evidence", () => {
  const invalid = clone();
  invalid.evidence.find((item) => item.id === "evidence-approval-log").compensatingControlRef = "control-other";
  assert.ok(findings(invalid).some((item) => item.code === "unsupported_compensating_control"));

  const orphan = clone();
  orphan.compensatingControls.push({
    ...orphan.compensatingControls[0],
    id: "control-orphan",
    requirementRef: "requirement-missing",
    ownerId: "principal-missing",
    evidenceRefs: ["evidence-missing"],
    state: "accepted",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(
    findings(orphan).some(
      (item) =>
        item.code === "unsupported_compensating_control" &&
        item.path === "compensatingControls[1]",
    ),
  );
});

test("compliance resolved material findings require independent remediation verification", () => {
  const self = clone();
  self.verifications[0].verifiedById = "principal-remediation-owner-priya";
  assert.ok(findings(self).some((item) => item.code === "self_verified_remediation"));
  const crossRequirement = clone();
  crossRequirement.verifications[0].requirementRef = "requirement-sup-01";
  assert.ok(findings(crossRequirement).some((item) => item.code === "unsupported_remediation_verification"));
});

test("compliance readiness rejects unresolved high or critical findings", () => {
  const unresolved = clone();
  unresolved.findings.find((item) => item.id === "finding-rel-04").state = "open";
  assert.ok(findings(unresolved).some((item) => item.code === "unresolved_material_finding"));
  assert.ok(findings(unresolved).some((item) => item.code === "premature_independent_review"));
});

test("compliance evidence and review chronology are bounded", () => {
  const stale = clone();
  stale.evidence[0].collectedAt = "2026-08-01T00:00:00Z";
  assert.ok(findings(stale).some((item) => item.code === "stale_evidence"));
  const earlyReview = clone();
  earlyReview.recommendation.reviewedAt = "2026-09-01T08:30:00Z";
  assert.ok(findings(earlyReview).some((item) => item.code === "premature_independent_review"));
});

test("compliance authority must be a distinct stable principal", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(findings(self).some((item) => item.code === "premature_independent_review"));
  const bare = clone();
  bare.owner = "Compliance Reviewer";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));
  const titledHuman = clone();
  titledHuman.owner = "Jordan Blake, Compliance Reviewer";
  titledHuman.handoff.owner = "Jordan Blake, Compliance Reviewer";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name = "Jordan Blake, Compliance Reviewer";
  assert.equal(isValid(titledHuman), true);
});

test("compliance forbids risk acceptance and assurance claims", () => {
  const accepted = clone();
  accepted.findings[2].state = "accepted-risk";
  assert.ok(findings(accepted).some((item) => item.code === "unauthorized_risk_disposition"));
  const claim = clone();
  claim.handoff.summary = "We certified compliance and accepted the risk.";
  assert.ok(findings(claim).some((item) => item.code === "unauthorized_narrative_action"));
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter((item) => item !== "grant-waiver");
  assert.ok(findings(missingGate).some((item) => item.code === "missing_authority_gate"));
});

test("compliance schema preserves strict legacy behavior", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, requirements: [] }), false);
  assert.equal(validateSchema({ ...legacy, assessmentDecision: "certified-compliant" }), false);
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("compliance CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `compliance-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(process.execPath, [resolve(root, "scripts", "validate-artifact.mjs"), "compliance-reviewer", path], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
