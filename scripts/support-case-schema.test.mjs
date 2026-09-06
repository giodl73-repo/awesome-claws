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
const fixturePath = fileURLToPath(new URL("../claws/customer-support/fixtures/support-case.example.json", import.meta.url));
const schema = JSON.parse(await readFile(new URL("../claws/customer-support/schemas/support-case.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("customer-support", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  caseId: "SUP-4017",
  symptom: "Webhook deliveries return 401",
  impact: "high",
  environment: "Production sender",
  evidence: [{ reference: "case/log", source: "Sanitized log", observedAt: "2026-09-01T08:30:00Z", state: "verified" }],
  diagnostics: [{ check: "Compare identifier", requestedData: "Last four characters", dataClass: "customer-approved-metadata", expectedResult: "Identifiers match", state: "verified" }],
  responseDraft: { audience: "Customer", message: "Please retry after propagation.", state: "draft", nextUpdateAt: "2026-09-01T12:00:00Z" },
  escalation: { needed: true, owner: "Priya Desai", reason: "Confirm cache behavior", evidenceRefs: ["case/log"] },
  caseOwner: "Jordan Blake",
  disposition: "investigating",
};

test("support fixture is a realistic valid enriched case", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("support validator is total over malformed arrays and records", () => {
  for (const field of ["principals", "evidence", "diagnostics", "diagnoses", "communications", "escalations"]) {
    const malformed = clone();
    malformed[field].push(false);
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_list" && item.path === field));
  }
});

test("support enriched marker is exact and hybrid deletion fails closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.supportCase.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(findings(hybrid).some((item) => item.code === "invalid_array_list" && item.path === "principals"));
});

test("support validator rejects unstable ids and dangling escalation evidence", () => {
  const invalid = clone();
  delete invalid.evidence[0].id;
  invalid.escalations[0].evidenceRefs = ["evidence-missing"];
  assert.ok(findings(invalid).some((item) => item.code === "invalid_array_record"));
  assert.ok(findings(invalid).some((item) => item.code === "dangling_reference"));
});

test("support evidence must bind exact case scope and approved data", () => {
  const crossCase = clone();
  crossCase.evidence[0].accountId = "account-other";
  assert.ok(findings(crossCase).some((item) => item.code === "cross_scope_evidence"));
  const sensitive = clone();
  sensitive.evidence[0].dataClass = "credential-secret";
  assert.ok(findings(sensitive).some((item) => item.code === "unapproved_sensitive_data"));
});

test("support diagnostics reject secret requests and unsupported evidence", () => {
  const secret = clone();
  secret.diagnostics[0].requestedData = "Send the full access token";
  assert.ok(findings(secret).some((item) => item.code === "secret_request"));
  const dangling = clone();
  dangling.diagnostics[0].evidenceRefs = ["missing"];
  assert.ok(findings(dangling).some((item) => item.code === "dangling_reference"));
  assert.ok(findings(dangling).some((item) => item.code === "unsupported_diagnostic"));
});

test("support diagnosis and escalation chronology fail closed", () => {
  const earlyDiagnosis = clone();
  earlyDiagnosis.diagnoses[0].verifiedAt = "2026-09-01T08:00:00Z";
  assert.ok(findings(earlyDiagnosis).some((item) => item.code === "unsupported_diagnosis"));
  const unresolved = clone();
  unresolved.escalations[0].state = "open";
  assert.ok(findings(unresolved).some((item) => item.code === "unresolved_escalation"));
  assert.ok(findings(unresolved).some((item) => item.code === "premature_resolution_readiness"));

  const earlyResolution = clone();
  earlyResolution.escalations[0].resolvedAt = "2026-09-01T09:00:00Z";
  assert.equal(isValid(earlyResolution), false);
  assert.ok(
    findings(earlyResolution).some(
      (item) => item.code === "unresolved_escalation",
    ),
  );
});

test("support evidence chronology is bounded to the case", () => {
  const stale = clone();
  stale.evidence[0].observedAt = "2026-08-01T00:00:00Z";
  assert.ok(findings(stale).some((item) => item.code === "stale_evidence"));
  const future = clone();
  future.evidence[0].observedAt = "2099-01-01T00:00:00Z";
  assert.ok(findings(future).some((item) => item.code === "future_evidence"));
});

test("support resolution requires independent case-owner review", () => {
  const self = clone();
  self.diagnoses[0].verifiedById = self.ownerId;
  assert.ok(findings(self).some((item) => item.code === "premature_resolution_readiness"));
  const unknown = clone();
  unknown.resolution.reviewerId = "principal-missing";
  assert.ok(findings(unknown).some((item) => item.code === "premature_resolution_readiness"));
});

test("support rejects bare package identity but accepts a named human with that title", () => {
  const bare = clone();
  bare.owner = "Customer Support";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));
  const titledHuman = clone();
  titledHuman.owner = "Jordan Blake, Customer Support";
  titledHuman.handoff.owner = "Jordan Blake, Customer Support";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name = "Jordan Blake, Customer Support";
  assert.equal(isValid(titledHuman), true);
});

test("support forbids sent communication and consequential claims", () => {
  const sent = clone();
  sent.communications[0].state = "sent";
  assert.ok(findings(sent).some((item) => item.code === "unauthorized_communication_state"));
  const claim = clone();
  claim.handoff.summary = "We closed the case and issued the refund.";
  assert.ok(findings(claim).some((item) => item.code === "unauthorized_narrative_action"));
  const refundClaim = clone();
  refundClaim.handoff.summary = "Refunded the customer after review.";
  assert.ok(
    findings(refundClaim).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
  );
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter((item) => item !== "mutate-account");
  assert.ok(findings(missingGate).some((item) => item.code === "missing_authority_gate"));
});

test("support communication drafts require resolved evidence and accountable principals", () => {
  for (const mutate of [
    (value) => {
      value.communications[0].authorId = "principal-missing";
    },
    (value) => {
      value.communications[0].approvedById = "principal-missing";
    },
    (value) => {
      value.communications[0].evidenceRefs = ["evidence-missing"];
    },
  ]) {
    const unsupported = clone();
    mutate(unsupported);
    assert.equal(isValid(unsupported), false);
    assert.ok(
      findings(unsupported).some(
        (item) => item.code === "unsupported_communication_draft",
      ),
    );
    assert.ok(
      findings(unsupported).some(
        (item) => item.code === "premature_resolution_readiness",
      ),
    );
  }
});

test("support schema preserves strict legacy behavior", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, diagnostics: [] }), false);
  assert.equal(validateSchema({ ...legacy, evidence: [] }), false);
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("support CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `support-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(process.execPath, [resolve(root, "scripts", "validate-artifact.mjs"), "customer-support", path], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
