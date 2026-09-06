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
const fixturePath = fileURLToPath(new URL("../claws/release-coordinator/fixtures/release-readiness.example.json", import.meta.url));
const schema = JSON.parse(await readFile(new URL("../claws/release-coordinator/schemas/release-readiness.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("release-coordinator", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  repository: "acme/widget",
  version: "v2.4.0",
  targetCommit: "8f1c2d4",
  checks: [{ name: "required CI", state: "passed", evidence: "workflow run 1842" }],
  artifacts: [{ name: "package", state: "passed", evidence: "sha256:example" }],
  blockers: [],
  decisionState: "ready-for-owner-decision",
  communicationState: "draft",
};

test("release fixture is a realistic valid enriched readiness record", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("release validator is total over malformed arrays and records", () => {
  for (const field of ["principals", "requiredChecks", "artifacts", "evidence", "blockers", "waivers"]) {
    const malformed = clone();
    malformed[field].push(7);
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_list" && item.path === field));
  }
});

test("release enriched marker is exact and hybrid deletion fails closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.releaseReadiness.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(findings(hybrid).some((item) => item.code === "invalid_array_list" && item.path === "principals"));
});

test("release validator rejects unstable ids and dangling references", () => {
  const invalid = clone();
  delete invalid.requiredChecks[0].id;
  invalid.requiredChecks[1].waiverRef = "waiver-missing";
  assert.equal(isValid(invalid), false);
  assert.ok(findings(invalid).some((item) => item.code === "invalid_array_record"));
  assert.ok(findings(invalid).some((item) => item.code === "unresolved_required_check"));
});

test("release check evidence and artifacts must bind the exact target", () => {
  const crossCommit = clone();
  crossCommit.evidence[0].targetCommit = "1111111";
  assert.equal(isValid(crossCommit), false);
  assert.ok(findings(crossCommit).some((item) => item.code === "cross_scope_evidence"));
  assert.ok(findings(crossCommit).some((item) => item.code === "unresolved_required_check"));

  const unboundArtifact = clone();
  unboundArtifact.artifacts[0].digest = "sha256:wrong";
  assert.ok(findings(unboundArtifact).some((item) => item.code === "unbound_release_artifact"));
});

test("release required checks need pass evidence or accountable waiver", () => {
  const invalidWaiver = clone();
  invalidWaiver.principals.find((item) => item.id === "principal-waiver-owner-priya").scopes = [];
  assert.ok(findings(invalidWaiver).some((item) => item.code === "unresolved_required_check"));
  const failed = clone();
  failed.requiredChecks[0].state = "failed";
  assert.ok(findings(failed).some((item) => item.code === "unresolved_required_check"));

  const orphan = clone();
  orphan.waivers.push({
    ...orphan.waivers[0],
    id: "waiver-orphan",
    checkRef: "check-missing",
    ownerId: "principal-missing",
    evidenceRef: "evidence-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(findings(orphan).some((item) => item.code === "unsupported_release_waiver"));
});

test("release blockers and rollback proof prevent premature readiness", () => {
  const blocked = clone();
  blocked.blockers.push({ id: "blocker-upgrade", state: "open", ownerId: "principal-ci-owner-alex" });
  assert.ok(findings(blocked).some((item) => item.code === "unresolved_release_blocker"));

  const unsupportedResolution = clone();
  unsupportedResolution.blockers.push({
    id: "blocker-upgrade",
    summary: "",
    state: "resolved",
    ownerId: "principal-missing",
  });
  assert.equal(isValid(unsupportedResolution), false);
  assert.ok(
    findings(unsupportedResolution).some(
      (item) => item.code === "unsupported_blocker_resolution",
    ),
  );
  assert.ok(
    findings(unsupportedResolution).some(
      (item) => item.code === "premature_release_readiness",
    ),
  );
  assert.ok(findings(blocked).some((item) => item.code === "premature_release_readiness"));
  const noRollback = clone();
  noRollback.rollback.evidenceRef = "missing";
  assert.ok(findings(noRollback).some((item) => item.code === "missing_rollback_proof"));
});

test("release evidence and decision chronology are bounded", () => {
  const stale = clone();
  stale.evidence[0].assertedAt = "2026-08-01T00:00:00Z";
  assert.ok(findings(stale).some((item) => item.code === "stale_evidence"));
  const earlyReview = clone();
  earlyReview.recommendation.reviewedAt = "2026-09-01T09:00:00Z";
  assert.ok(findings(earlyReview).some((item) => item.code === "premature_release_readiness"));

  const blockerAfterReview = clone();
  blockerAfterReview.evidence.push({
    id: "evidence-blocker-resolution",
    kind: "blocker-resolution",
    blockerRef: "blocker-upgrade",
    releaseRef: blockerAfterReview.release.id,
    targetCommit: blockerAfterReview.release.targetCommit,
    candidateId: blockerAfterReview.release.candidateId,
    snapshotRef: blockerAfterReview.release.snapshotRef,
    outcome: "resolved",
    sourceRef: "controlled://release-evidence/acme-widget/blocker-resolution",
    assertedAt: "2026-09-01T12:30:00Z",
  });
  blockerAfterReview.blockers.push({
    id: "blocker-upgrade",
    summary: "Upgrade smoke runner capacity restored.",
    state: "resolved",
    ownerId: "principal-ci-owner-alex",
    resolutionEvidenceRef: "evidence-blocker-resolution",
    resolvedAt: "2026-09-01T12:45:00Z",
  });
  assert.ok(
    findings(blockerAfterReview).some(
      (item) => item.code === "premature_release_readiness",
    ),
  );
});

test("release authority must be an independent stable principal", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(findings(self).some((item) => item.code === "premature_release_readiness"));
  const bare = clone();
  bare.owner = "Release Coordinator";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));
  const titledHuman = clone();
  titledHuman.owner = "Jordan Blake, Release Coordinator";
  titledHuman.handoff.owner = "Jordan Blake, Release Coordinator";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name = "Jordan Blake, Release Coordinator";
  assert.equal(isValid(titledHuman), true);
});

test("release handoff rejects mutation and communication claims", () => {
  const claim = clone();
  claim.handoff.summary = "We published the release and sent the communication.";
  assert.ok(findings(claim).some((item) => item.code === "unauthorized_narrative_action"));
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter((item) => item !== "sign-artifact");
  assert.ok(findings(missingGate).some((item) => item.code === "missing_authority_gate"));
});

test("release schema preserves strict legacy behavior", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, targetCommit: "latest" }), false);
  assert.equal(validateSchema({ ...legacy, checks: [] }), false);
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("release CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `release-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(process.execPath, [resolve(root, "scripts", "validate-artifact.mjs"), "release-coordinator", path], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
