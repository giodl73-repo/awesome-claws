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
  new URL("../claws/incident-response/fixtures/incident-state.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/incident-response/schemas/incident-state.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("incident-response", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  incidentId: "INC-2048",
  severity: "SEV-1",
  status: "mitigating",
  startedAt: "2026-08-16T14:07:00Z",
  incidentCommander: "Primary incident commander",
  impact: {
    summary: "Checkout errors increased after deployment.",
    affectedServices: ["checkout-api"],
    customerImpact: "partial-outage",
    evidenceRef: "dashboard/checkout-errors/14-07",
    observedAt: "2026-08-16T14:09:00Z",
  },
  timeline: [
    {
      timestamp: "2026-08-16T14:07:00Z",
      kind: "observation",
      summary: "Alert crossed threshold.",
      evidenceRef: "alert/checkout-errors-2048",
      owner: "On-call engineer",
    },
  ],
  mitigations: [
    {
      action: "Roll back checkout-api",
      target: "checkout-api production",
      owner: "Checkout lead",
      state: "approved",
      approvalRef: "approval/INC-2048/rollback",
      verification: "Errors remain below 2%.",
      rollbackCondition: "Stop if payment failures increase.",
    },
  ],
  recoveryCriteria: [
    {
      criterion: "Checkout errors below 2%",
      state: "unmet",
      evidenceRef: "dashboard/checkout-errors/live",
      owner: "Checkout lead",
    },
  ],
  communications: [
    {
      audience: "Customer support",
      state: "draft",
      owner: "Communications lead",
      messageRef: "draft/INC-2048/update-1",
    },
  ],
  decisionState: "not-ready",
};

test("incident response fixture is a valid exact-incident enriched record", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("incident response validator is total over malformed arrays and records", () => {
  for (const field of [
    "principals",
    "services",
    "signals",
    "evidence",
    "hypotheses",
    "timelineEvents",
    "actions",
    "recoveryChecks",
    "communications",
    "followUps",
  ]) {
    const malformed = clone();
    malformed[field].push(null);
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(
      findings(malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
    );
  }
});

test("incident exact marker and every legacy-only hybrid field fail closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.incidentResponse.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));

  for (const field of [
    "incidentId",
    "severity",
    "status",
    "startedAt",
    "incidentCommander",
    "impact",
    "timeline",
    "mitigations",
    "recoveryCriteria",
    "decisionState",
  ]) {
    const partial = clone();
    partial[field] = legacy[field];
    assert.equal(isValid(partial), false, field);
    assert.ok(
      findings(partial).some(
        (item) =>
          item.code === "legacy_field_in_enriched_record" && item.path === field,
      ),
    );
  }
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(
    findings(hybrid).some(
      (item) => item.code === "invalid_array_list" && item.path === "principals",
    ),
  );
  assert.equal(validateSchema({ ...clone(), sensitiveLogs: ["payload"] }), false);
});

test("incident response rejects unstable, dangling, and orphan rows", () => {
  const invalid = clone();
  delete invalid.signals[0].id;
  invalid.hypotheses[0].serviceRef = "service-missing";
  assert.ok(
    findings(invalid).some(
      (item) => item.code === "invalid_array_record" && item.path === "signals[0].id",
    ),
  );
  assert.ok(findings(invalid).some((item) => item.code === "unsupported_hypothesis"));

  const orphan = clone();
  orphan.actions.push({
    ...orphan.actions[0],
    id: "action-orphan",
    serviceRef: "service-missing",
    approvalEvidenceRef: "evidence-missing",
    executionEvidenceRef: "evidence-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(findings(orphan).some((item) => item.code === "unsupported_incident_action"));
});

test("incident evidence binds exact incident, service build, environment, and snapshot", () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].incidentRef = "INC-OTHER";
    },
    (value) => {
      value.evidence[0].deploymentOrBuild = "checkout-api@old";
    },
    (value) => {
      value.evidence[0].timelineSnapshotRef = "snapshot-old";
    },
    (value) => {
      value.evidence[0].serviceRef = "service-missing";
    },
  ]) {
    const crossScope = clone();
    mutate(crossScope);
    assert.equal(isValid(crossScope), false);
    assert.ok(
      findings(crossScope).some((item) => item.code === "cross_scope_evidence"),
    );
  }
});

test("incident evidence references only rows for its declared service", () => {
  for (const [field, reference] of [
    ["signalRef", "signal-checkout-errors"],
    ["hypothesisRef", "hypothesis-timeout-regression"],
    ["actionRef", "action-checkout-rollback"],
    ["recoveryCheckRef", "recovery-checkout-errors"],
  ]) {
    const crossService = clone();
    const evidence = crossService.evidence.find(
      (item) => item.id === "evidence-payment-recovery",
    );
    evidence[field] = reference;
    assert.ok(
      findings(crossService).some(
        (item) =>
          item.code === "cross_scope_evidence" &&
          item.path === "evidence[6]",
      ),
      field,
    );
  }
});

test("incident timeline is chronological, evidence-backed, and exact-incident", () => {
  const reversed = clone();
  reversed.timelineEvents[1].occurredAt = "2026-09-05T10:03:00Z";
  assert.ok(
    findings(reversed).some((item) => item.code === "invalid_incident_chronology"),
  );
  const wrongIncident = clone();
  wrongIncident.timelineEvents[0].incidentRef = "INC-OTHER";
  assert.ok(
    findings(wrongIncident).some(
      (item) => item.code === "invalid_incident_chronology",
    ),
  );
});

test("incident consequential actions are proposed or owner-executed, never Claw-executed", () => {
  const clawExecuted = clone();
  clawExecuted.actions[0].executionState = "claw-executed";
  assert.ok(
    findings(clawExecuted).some(
      (item) => item.code === "claw_executed_consequential_action",
    ),
  );
  const unsupported = clone();
  unsupported.actions[0].approvalEvidenceRef = "evidence-missing";
  assert.ok(
    findings(unsupported).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
  const wrongIncident = clone();
  wrongIncident.actions[0].incidentRef = "INC-OTHER";
  assert.ok(
    findings(wrongIncident).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
  const prematureEvidence = clone();
  prematureEvidence.evidence.find(
    (item) => item.id === "evidence-rollback-execution",
  ).assertedAt = "2026-09-05T10:29:59Z";
  assert.ok(
    findings(prematureEvidence).some(
      (item) => item.code === "unsupported_incident_action",
    ),
  );
});

test("incident recovery covers every service and rejects self-verification", () => {
  const missingService = clone();
  missingService.recoveryChecks = missingService.recoveryChecks.filter(
    (item) => item.serviceRef !== "service-payment-orchestrator",
  );
  assert.ok(
    findings(missingService).some(
      (item) => item.code === "incomplete_recovery_coverage",
    ),
  );
  const self = clone();
  self.recoveryChecks[0].verifiedById = self.services[0].ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "self_verified_recovery"),
  );
});

test("incident unresolved high-risk signals and sent communications block readiness", () => {
  const unresolved = clone();
  unresolved.signals[0].state = "monitoring";
  assert.ok(
    findings(unresolved).some(
      (item) => item.code === "unresolved_high_risk_signal",
    ),
  );
  assert.ok(
    findings(unresolved).some(
      (item) => item.code === "premature_incident_readiness",
    ),
  );
  for (const resolvedAt of [undefined, "not-a-date", "2099-01-01T00:00:00Z"]) {
    const invalidResolution = clone();
    invalidResolution.signals[0].resolvedAt = resolvedAt;
    assert.ok(
      findings(invalidResolution).some(
        (item) => item.code === "unresolved_high_risk_signal",
      ),
      String(resolvedAt),
    );
  }
  const sent = clone();
  sent.communications[0].state = "sent";
  assert.ok(
    findings(sent).some((item) => item.code === "unauthorized_communication_state"),
  );
  const unapprovedDraft = clone();
  unapprovedDraft.communications[0].state = "draft";
  delete unapprovedDraft.communications[0].approvedById;
  assert.equal(isValid(unapprovedDraft), true);
});

test("incident-command review is independent and occurs after all evidence", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "premature_incident_readiness"),
  );
  const early = clone();
  early.recommendation.reviewedAt = "2026-09-05T10:30:00Z";
  assert.ok(
    findings(early).some((item) => item.code === "premature_incident_readiness"),
  );
});

test("incident response rejects the bare role identity but accepts a named human with the title", () => {
  const bare = clone();
  bare.owner = " Incident Response ";
  bare.handoff.owner = " Incident Response ";
  bare.principals.find((item) => item.id === bare.ownerId).name =
    " Incident Response ";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));

  const titledHuman = clone();
  titledHuman.owner = "Alex Rivera, Incident Response";
  titledHuman.handoff.owner = "Alex Rivera, Incident Response";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Alex Rivera, Incident Response";
  assert.equal(isValid(titledHuman), true);
});

test("incident response rejects direct prohibited-action claims and missing gates", () => {
  for (const claim of [
    "We mutated production.",
    "We revoked the session.",
    "We shifted traffic.",
    "We declared the incident.",
    "We closed the incident.",
    "We sent the update.",
  ]) {
    const invalid = clone();
    invalid.handoff.summary = claim;
    assert.ok(
      findings(invalid).some((item) => item.code === "unauthorized_narrative_action"),
      claim,
    );
  }
  const missingGate = clone();
  missingGate.handoff.prohibitedActions =
    missingGate.handoff.prohibitedActions.filter(
      (item) => item !== "shift-traffic",
    );
  assert.ok(
    findings(missingGate).some((item) => item.code === "missing_authority_gate"),
  );
});

test("incident schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, timeline: [] }), false);
  assert.equal(
    validateSchema({
      ...legacy,
      mitigations: [{ ...legacy.mitigations[0], approvalRef: undefined }],
    }),
    false,
  );
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("incident response CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `incident-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts", "validate-artifact.mjs"), "incident-response", path],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
