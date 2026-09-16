import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  businessContinuityProgramFindings,
  computeActionRevision,
  computeBiaRevision,
  computeBlockerRevision,
  computeCoverageDigest,
  computeDependencyRevision,
  computeEvidencePayloadDigest,
  computeExceptionRevision,
  computeExceptionScopeDigest,
  computeExerciseRevision,
  computeFindingRevision,
  computeFindingStableKey,
  computeHandoffDigest,
  computePlanPredecessorRevision,
  computePlanRevision,
  computeProcessRevision,
  computeProgramDigest,
  computeRecertificationRevision,
  computeRegisterRevision,
  resealBusinessContinuityArtifact,
} from "./business-continuity-program-manager.mjs";
import {
  artifactSemanticValidationOptions,
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const AS_OF = "2026-09-14T19:00:00Z";
const base = "../sources/business-continuity-program-manager";
const fixture = JSON.parse(
  await readFile(
    new URL(`${base}/fixtures/business-continuity-program.example.json`, import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(`${base}/schemas/business-continuity-program.schema.json`, import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL(`${base}/templates/business-continuity-program.md`, import.meta.url),
  "utf8",
);
const visual = await readFile(
  new URL(`${base}/assets/business-continuity-program.html`, import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function mutate(change, reseal = true) {
  const value = clone();
  change(value);
  return reseal ? resealBusinessContinuityArtifact(value) : value;
}

function findings(value, context = { asOf: AS_OF }) {
  return businessContinuityProgramFindings(value, context);
}

function assertHas(value, code, context = { asOf: AS_OF }) {
  const result = findings(value, context);
  assert.ok(result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

test("accepted fixture is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("accepted fixture content-binds every program ledger", () => {
  assert.equal(fixture.program.programDigest, computeProgramDigest(fixture.program));
  for (const row of fixture.registers) assert.equal(row.revision, computeRegisterRevision(row));
  for (const row of fixture.processes) assert.equal(row.revision, computeProcessRevision(row));
  for (const row of fixture.businessImpactAnalyses) {
    assert.equal(row.revision, computeBiaRevision(row));
  }
  for (const row of fixture.dependencies) {
    assert.equal(row.revision, computeDependencyRevision(row));
  }
  for (const row of fixture.planPredecessors) {
    assert.equal(row.revision, computePlanPredecessorRevision(row));
  }
  for (const row of fixture.plans) assert.equal(row.revision, computePlanRevision(row));
  for (const row of fixture.exercises) assert.equal(row.revision, computeExerciseRevision(row));
  for (const row of fixture.findings) {
    assert.equal(row.stableKey, computeFindingStableKey(row));
    assert.equal(row.revision, computeFindingRevision(row));
  }
  for (const row of fixture.correctiveActions) {
    assert.equal(row.revision, computeActionRevision(row));
  }
  for (const row of fixture.exceptions) {
    assert.equal(
      row.scopeDigest,
      computeExceptionScopeDigest(
        row,
        fixture.processes.find((process) => process.id === row.processRef).revision,
        fixture.findings.find((finding) => finding.id === row.findingRef).revision,
      ),
    );
    assert.equal(row.revision, computeExceptionRevision(row));
  }
  for (const row of fixture.recertifications) {
    assert.equal(row.revision, computeRecertificationRevision(row));
  }
  for (const row of fixture.evidence) {
    assert.equal(row.payloadDigest, computeEvidencePayloadDigest(row));
  }
  for (const row of fixture.blockers) {
    assert.equal(row.revision, computeBlockerRevision(row));
  }
  assert.equal(fixture.coverage.contentDigest, computeCoverageDigest(fixture.coverage));
  assert.equal(fixture.handoff.payloadDigest, computeHandoffDigest(fixture.handoff));
});

test("accepted fixture exercises the recurring lifecycle and adverse states", () => {
  assert.equal(fixture.registers.length, 2);
  assert.deepEqual(
    new Set(fixture.processes.map((row) => row.changeKind)),
    new Set(["retained", "revised"]),
  );
  assert.deepEqual(
    new Set(fixture.dependencies.map((row) => row.kind)),
    new Set(["service", "vendor", "site"]),
  );
  assert.equal(fixture.businessImpactAnalyses.length, fixture.processes.length);
  assert.equal(fixture.plans.length, fixture.processes.length);
  assert.equal(fixture.exercises[0].injects.length, 3);
  assert.ok(fixture.findings.some((row) => row.state === "verified-closed"));
  assert.ok(fixture.findings.some((row) => row.state === "in-remediation"));
  assert.ok(fixture.correctiveActions.some((row) => row.status === "verified"));
  assert.ok(fixture.correctiveActions.some((row) => row.status === "in-progress"));
  assert.ok(fixture.exceptions.some((row) => row.status === "active"));
  assert.ok(fixture.exceptions.some((row) => row.status === "revoked"));
  assert.deepEqual(
    new Set(fixture.recertifications.map((row) => row.decision)),
    new Set(["evidence-current", "recertification-blocked"]),
  );
  assert.deepEqual(
    new Set(fixture.blockers.map((row) => row.category)),
    new Set(["exercise-finding-open", "exception-active"]),
  );
});

test("every dependent revision carries exact source and payload evidence digests", () => {
  const evidenceById = new Map(fixture.evidence.map((row) => [row.id, row]));
  for (const key of [
    "registers",
    "processes",
    "businessImpactAnalyses",
    "dependencies",
    "planPredecessors",
    "plans",
    "findings",
    "correctiveActions",
    "exceptions",
    "recertifications",
    "blockers",
  ]) {
    for (const row of fixture[key]) {
      const evidence = evidenceById.get(row.evidenceRef);
      assert.equal(row.evidenceSourceDigest, evidence.sourceDigest, `${key}.${row.id}.source`);
      assert.equal(row.evidencePayloadDigest, evidence.payloadDigest, `${key}.${row.id}.payload`);
    }
  }
  for (const row of fixture.exercises) {
    assert.deepEqual(
      row.evidenceSourceDigests,
      row.evidenceRefs.map((ref) => evidenceById.get(ref).sourceDigest),
    );
    assert.deepEqual(
      row.evidencePayloadDigests,
      row.evidenceRefs.map((ref) => evidenceById.get(ref).payloadDigest),
    );
  }
  const verified = fixture.correctiveActions.find((row) => row.status === "verified");
  assert.equal(verified.receiptRevision, evidenceById.get(verified.evidenceRef).payloadDigest);
});

test("recertification rejects a frozen revision after transitive evidence changes", () => {
  const value = clone();
  const frozen = structuredClone(value.recertifications[0]);
  const evidence = value.evidence.find((row) => row.id === "evidence-bia-checkout");
  evidence.sourceDigest = `sha256:${"6".repeat(64)}`;
  const resealed = resealBusinessContinuityArtifact(value);
  resealed.recertifications[0] = frozen;
  assertHas(resealed, "invalid_recertification");
});

test("invalid revoked-exception evidence remains an exact blocker", () => {
  const value = mutate((artifact) => {
    const row = artifact.exceptions.find((item) => item.status === "revoked");
    row.revocationEvidenceRef = null;
    row.revocationEvidenceSourceDigest = null;
    row.revocationEvidencePayloadDigest = null;
  }, false);
  assertHas(value, "invalid_exception");
  assertHas(value, "invalid_blocker_equality");
});

test("public artifact CLI validates the exact fixture with trusted asOf", () => {
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "business-continuity-program-manager",
      "claws/business-continuity-program-manager/fixtures/business-continuity-program.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("semantic registry exposes the validator and trusted fixture time", () => {
  assert.equal(hasArtifactSemanticValidator("business-continuity-program-manager"), true);
  assert.deepEqual(artifactSemanticValidationOptions("business-continuity-program-manager"), {
    asOf: AS_OF,
  });
  assert.deepEqual(
    validateArtifactSemantics(
      "business-continuity-program-manager",
      fixture,
      artifactSemanticValidationOptions("business-continuity-program-manager"),
    ),
    [],
  );
});

test("X3 handoff and X4 visual expose the complete contract", () => {
  for (const token of [
    "## Exact critical-process universe",
    "{{program.currentRegisterRevision}}",
    "{{processes[].predecessorProcessRevision}}",
    "{{registers[].retiredProcessRevisions}}",
    "{{businessImpactAnalyses[].rtoMinutes}}",
    "{{businessImpactAnalyses[].rpoMinutes}}",
    "{{processes[].dependencyRefs}}",
    "{{plans[].revision}}",
    "{{planPredecessors}}",
    "{{exercises[].injects}}",
    "{{exercises[].findingRefs}}",
    "{{findings[].stableKey}}",
    "{{correctiveActions[].receiptRevision}}",
    "{{exceptions[].revision}}",
    "{{exceptions[].revokedByRef}}",
    "{{recertifications[].revision}}",
    "{{coverage.contentDigest}}",
    "{{handoff.disasterDeclarationClaim}}",
    "{{handoff.planInvocationClaim}}",
    "{{handoff.productionFailoverClaim}}",
    "{{handoff.trafficShiftClaim}}",
    "{{handoff.vendorContactClaim}}",
    "{{handoff.riskAcceptanceClaim}}",
    "{{handoff.exceptionApprovalClaim}}",
    "{{handoff.readinessCertificationClaim}}",
    "{{handoff.complianceCertificationClaim}}",
  ]) {
    assert.ok(template.includes(token), token);
  }
  for (const token of [
    "Business Continuity Program",
    "Critical-process universe",
    "Dependency coverage",
    "Evidence lifecycle",
    "Authority boundary",
    "not claimed",
  ]) {
    assert.ok(visual.includes(token), token);
  }
});

test("schema rejects extension fields and claimed authority", () => {
  const extra = clone();
  extra.executeFailover = true;
  assert.equal(validateSchema(extra), false);
  const claimed = clone();
  claimed.handoff.productionFailoverClaim = "completed";
  assert.equal(validateSchema(claimed), false);
});

test("semantic validation is total over malformed direct input", () => {
  for (const value of [
    null,
    undefined,
    true,
    7,
    "program",
    [],
    {},
    { processes: [{}], plans: false, handoff: [] },
  ]) {
    assert.doesNotThrow(() => findings(value));
    assert.ok(findings(value).length > 0);
  }
});

test("caller-supplied asOf is mandatory and timezone-safe", () => {
  assertHas(fixture, "invalid_validation_context", {});
  assertHas(fixture, "invalid_validation_context", { asOf: "not-a-time" });
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-31T12:00:00Z" });
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-14T19:00:00" });
});

const adversarialCases = [
  ["unknown top-level action", (v) => { v.invokePlan = true; }, "prohibited_contract_field"],
  ["unknown nested recommendation", (v) => { v.plans[0].recommendation = "invoke"; }, "prohibited_contract_field"],
  ["duplicate global identity", (v) => { v.processes[1].id = v.processes[0].id; }, "duplicate_identity"],
  ["program manager has wrong role", (v) => { v.principals.find((row) => row.id === "principal-program-manager").role = "handoff-owner"; }, "invalid_authority_binding"],
  ["program manager lacks exact cycle scope", (v) => { v.principals.find((row) => row.id === "principal-program-manager").scopes = ["cycle-other"]; }, "invalid_authority_binding"],
  ["handoff owner lacks exact destination scope", (v) => { v.principals.find((row) => row.id === "principal-handoff-owner").scopes = ["destination-other"]; }, "invalid_authority_binding"],
  ["program and handoff authority collapse", (v) => { v.program.handoffOwnerRef = v.program.programManagerRef; }, "invalid_authority_separation"],
  ["current register revision drift", (v) => { v.program.currentRegisterRevision = `sha256:${"f".repeat(64)}`; }, "invalid_register_binding", false],
  ["predecessor register omitted", (v) => { v.registers.shift(); }, "invalid_register_binding"],
  ["predecessor register is not earlier", (v) => { v.registers.find((row) => row.id === "register-q2").issuedAt = "2026-09-02T09:00:00Z"; }, "invalid_register_binding"],
  ["register evidence predates issue", (v) => { v.evidence.find((row) => row.id === "evidence-register-q3").observedAt = "2026-08-31T23:59:59Z"; }, "invalid_register_binding"],
  ["current process omitted from register", (v) => { v.registers[1].processRefs.pop(); }, "invalid_process_universe"],
  ["current register process revision drifts", (v) => { v.registers[1].processRevisions[0] = `sha256:${"f".repeat(64)}`; }, "invalid_process_universe", false],
  ["retired transition is omitted", (v) => { v.registers[1].retiredProcessRefs = []; v.registers[1].retiredProcessRevisions = []; }, "invalid_register_transition"],
  ["predecessor process revision drifts", (v) => { v.processes[0].predecessorProcessRevision = `sha256:${"f".repeat(64)}`; }, "invalid_register_transition", false],
  ["unregistered process invented", (v) => { v.processes[0].registerRef = "register-q2"; }, "invalid_process_binding"],
  ["retained process loses predecessor", (v) => { v.processes[0].predecessorProcessRef = null; }, "invalid_process_binding"],
  ["process predecessor refs swap across lineages after reseal", (v) => {
    [v.processes[0].predecessorProcessRef, v.processes[1].predecessorProcessRef] =
      [v.processes[1].predecessorProcessRef, v.processes[0].predecessorProcessRef];
  }, "invalid_process_binding"],
  ["retained process version is not later than its predecessor", (v) => { v.processes[0].version = "v2"; }, "invalid_process_binding"],
  ["process owner lacks exact process scope", (v) => { v.principals.find((row) => row.id === "principal-checkout-owner").scopes = ["bia-checkout"]; }, "invalid_process_binding"],
  ["process revision replay", (v) => { v.processes[0].criticality = "tier-2"; }, "invalid_process_binding", false],
  ["process evidence supplier drifts", (v) => { v.evidence.find((row) => row.id === "evidence-processes").suppliedByRef = "principal-program-manager"; }, "invalid_process_binding"],
  ["BIA omitted", (v) => { v.businessImpactAnalyses.pop(); }, "invalid_bia_totality"],
  ["RTO approval self-assigned", (v) => { v.businessImpactAnalyses[0].approvedByRef = "principal-program-manager"; }, "invalid_bia_binding"],
  ["BIA approver lacks exact BIA scope", (v) => { v.principals.find((row) => row.id === "principal-checkout-owner").scopes = ["process-checkout"]; }, "invalid_bia_binding"],
  ["RPO becomes negative", (v) => { v.businessImpactAnalyses[0].rpoMinutes = -1; }, "invalid_bia_binding"],
  ["BIA approval predates process evidence", (v) => { v.businessImpactAnalyses[0].approvedAt = "2026-09-01T09:30:00Z"; }, "invalid_bia_binding"],
  ["BIA process revision replay", (v) => { v.businessImpactAnalyses[0].processRevision = `sha256:${"e".repeat(64)}`; }, "invalid_bia_binding", false],
  ["BIA approval evidence loses subject", (v) => { v.evidence.find((row) => row.id === "evidence-bia-checkout").subjectRefs = []; }, "invalid_bia_binding"],
  ["dependency omitted from process index", (v) => { v.processes[0].dependencyRefs.pop(); }, "invalid_dependency_totality"],
  ["dependency attested by program manager", (v) => { v.dependencies[0].ownerRef = "principal-program-manager"; }, "invalid_dependency_binding"],
  ["dependency crosses process", (v) => { v.dependencies[0].processRef = "process-payroll"; }, "invalid_dependency_totality"],
  ["dependency revision replay", (v) => { v.dependencies[0].sourceRevision = `sha256:${"d".repeat(64)}`; }, "invalid_dependency_binding", false],
  ["plan omitted", (v) => { v.plans.pop(); }, "invalid_plan_totality"],
  ["plan predecessor omitted", (v) => { v.planPredecessors.shift(); }, "invalid_plan_binding"],
  ["plan predecessor revision drifts", (v) => { v.plans[0].predecessorRevision = `sha256:${"a".repeat(64)}`; }, "invalid_plan_binding", false],
  ["plan predecessor refs swap across lineages after reseal", (v) => {
    [v.plans[0].predecessorRef, v.plans[1].predecessorRef] =
      [v.plans[1].predecessorRef, v.plans[0].predecessorRef];
  }, "invalid_plan_binding"],
  ["plan version is not later than its predecessor", (v) => { v.plans[0].version = "v2"; }, "invalid_plan_binding"],
  ["plan predecessor evidence content drifts", (v) => { const evidence = v.evidence.find((row) => row.id === "evidence-plan-checkout-v2"); evidence.sourceDigest = `sha256:${"b".repeat(64)}`; evidence.payloadDigest = computeEvidencePayloadDigest(evidence); }, "invalid_plan_predecessor", false],
  ["plan omits BIA", (v) => { v.plans[0].biaRefs = []; }, "invalid_plan_binding"],
  ["plan omits dependency", (v) => { v.plans[0].dependencyRefs.pop(); }, "invalid_plan_binding"],
  ["program manager becomes invocation authority", (v) => { v.plans[0].invocationAuthorityRef = "principal-program-manager"; }, "invalid_plan_binding"],
  ["invocation authority lacks exact plan scope", (v) => { v.principals.find((row) => row.id === "principal-invocation-authority").scopes = ["plan-other"]; }, "invalid_plan_binding"],
  ["plan approval predates dependency evidence", (v) => { v.plans[0].approvedAt = "2026-09-03T09:00:00Z"; }, "invalid_plan_binding"],
  ["versioned plan loses predecessor revision", (v) => { v.plans[0].predecessorRef = null; v.plans[0].predecessorRevision = null; }, "invalid_plan_binding"],
  ["plan revision replay", (v) => { v.plans[0].strategyCodes = ["manual-workaround"]; }, "invalid_plan_binding", false],
  ["exercise scope drops a process", (v) => { v.exercises[0].scopeProcessRefs.pop(); }, "invalid_exercise_binding"],
  ["exercise scope approver lacks exact scope", (v) => { v.principals.find((row) => row.id === "principal-scope-approver").scopes = ["exercise-other"]; }, "invalid_exercise_binding"],
  ["exercise evaluator lacks exact scope", (v) => { v.principals.find((row) => row.id === "principal-evaluator").scopes = ["exercise-other"]; }, "invalid_exercise_binding"],
  ["exercise evaluator owns scope approval", (v) => { v.exercises[0].evaluatorRef = v.exercises[0].scopeApprovedByRef; }, "invalid_exercise_binding"],
  ["exercise result is supplied by scope approver", (v) => { v.evidence.find((row) => row.id === "evidence-exercise-result").suppliedByRef = "principal-scope-approver"; }, "invalid_exercise_binding"],
  ["exercise inject ordering drifts", (v) => { v.exercises[0].injects[1].sequence = 3; }, "invalid_exercise_binding"],
  ["exercise result omits finding", (v) => { v.exercises[0].findingRefs.pop(); }, "invalid_exercise_binding", false],
  ["exercise charter predates plan evidence", (v) => { v.evidence.find((row) => row.id === "evidence-exercise-charter").observedAt = "2026-09-04T09:00:00Z"; }, "invalid_exercise_binding"],
  ["exercise performance predates charter", (v) => { v.exercises[0].performedAt = "2026-09-06T08:59:59Z"; }, "invalid_exercise_binding"],
  ["exercise result predates performance", (v) => { v.evidence.find((row) => row.id === "evidence-exercise-result").observedAt = "2026-09-10T15:59:59Z"; }, "invalid_exercise_binding"],
  ["qualifying exercise is missing", (v) => { v.exercises = []; }, "invalid_exercise_coverage"],
  ["exercise remains incomplete", (v) => { v.exercises[0].result = "incomplete"; }, "invalid_exercise_coverage"],
  ["completed exercise lacks full findings", (v) => { v.exercises[0].result = "completed-no-findings"; }, "invalid_exercise_binding"],
  ["exercise revision replay", (v) => { v.exercises[0].result = "incomplete"; }, "invalid_exercise_binding", false],
  ["finding stable identity is reused", (v) => { v.findings[0].stableKey = v.findings[1].stableKey; }, "invalid_finding_identity", false],
  ["finding stable keys collide globally", (v) => { v.findings[1].exerciseRef = v.findings[0].exerciseRef; v.findings[1].processRef = v.findings[0].processRef; v.findings[1].category = v.findings[0].category; }, "duplicate_finding_stable_key"],
  ["finding crosses exercise scope", (v) => { v.findings[0].processRef = "process-invented"; }, "invalid_finding_identity"],
  ["finding predates result evidence", (v) => { v.findings[0].identifiedAt = "2026-09-10T16:30:00Z"; }, "invalid_finding_identity"],
  ["finding owner lacks exact finding scope", (v) => { v.principals.find((row) => row.id === "principal-remediation-owner").scopes = ["action-checkout", "action-payroll"]; }, "invalid_finding_identity"],
  ["verified finding is relabeled open", (v) => { v.findings[0].state = "open"; }, "invalid_finding_closure"],
  ["finding revision replay", (v) => { v.findings[0].severity = "critical"; }, "invalid_finding_identity", false],
  ["action finding revision drifts", (v) => { v.correctiveActions[0].findingRevision = `sha256:${"c".repeat(64)}`; }, "invalid_corrective_action", false],
  ["action owner self-verifies", (v) => { v.correctiveActions[0].verifiedByRef = v.correctiveActions[0].ownerRef; }, "invalid_corrective_action"],
  ["action owner lacks exact action scope", (v) => { v.principals.find((row) => row.id === "principal-remediation-owner").scopes = ["finding-checkout", "finding-payroll"]; }, "invalid_corrective_action"],
  ["verifier lacks exact action scope", (v) => { v.principals.find((row) => row.id === "principal-verifier").scopes = ["action-other"]; }, "invalid_corrective_action"],
  ["verified label survives without receipt", (v) => { const action = v.correctiveActions[0]; action.status = "in-progress"; action.receiptRef = null; action.receiptRevision = null; action.verifiedByRef = null; action.verifiedAt = null; }, "invalid_finding_closure"],
  ["duplicate corrective actions claim closure", (v) => { v.correctiveActions.push({ ...structuredClone(v.correctiveActions[0]), id: "action-checkout-duplicate" }); }, "invalid_finding_closure"],
  ["receipt revision is arbitrary", (v) => { v.correctiveActions[0].receiptRevision = `sha256:${"9".repeat(64)}`; }, "invalid_corrective_action", false],
  ["remediation evidence predates finding", (v) => { v.evidence.find((row) => row.id === "evidence-actions").observedAt = "2026-09-10T17:00:00Z"; }, "invalid_corrective_action"],
  ["remediation receipt loses receipt identity", (v) => { v.evidence.find((row) => row.id === "evidence-receipt-checkout").subjectRefs = ["action-checkout"]; }, "invalid_corrective_action"],
  ["unverified action claims a receipt", (v) => { v.correctiveActions[1].receiptRef = "receipt-invented"; }, "invalid_corrective_action"],
  ["exception is approved by program manager", (v) => { v.exceptions[0].approvedByRef = "principal-program-manager"; }, "invalid_exception"],
  ["exception approver lacks exact scope", (v) => { v.principals.find((row) => row.id === "principal-exception-approver").scopes = ["exception-payroll"]; }, "invalid_exception"],
  ["exception approval evidence supplier drifts", (v) => { v.evidence.find((row) => row.id === "evidence-exception-payroll").suppliedByRef = "principal-program-manager"; }, "invalid_exception"],
  ["exception has non-positive validity", (v) => { v.exceptions[0].expiresAt = v.exceptions[0].approvedAt; }, "invalid_exception"],
  ["active exception passes its expiry", (v) => { v.exceptions.find((row) => row.status === "active").expiresAt = "2026-09-12T12:00:00Z"; }, "invalid_exception"],
  ["exception scope digest is arbitrary", (v) => { v.exceptions[0].scopeDigest = `sha256:${"8".repeat(64)}`; }, "invalid_exception", false],
  ["revoked exception lacks event evidence", (v) => { const row = v.exceptions.find((item) => item.status === "revoked"); row.revocationEvidenceRef = null; row.revocationEvidenceSourceDigest = null; row.revocationEvidencePayloadDigest = null; }, "invalid_exception", false],
  ["exception approval and revocation collapse", (v) => { const row = v.exceptions.find((item) => item.status === "revoked"); row.revokedByRef = row.approvedByRef; }, "invalid_authority_separation"],
  ["revoker lacks exact exception scope", (v) => { v.principals.find((row) => row.id === "principal-exception-revoker").scopes = ["exception-other"]; }, "invalid_exception"],
  ["exception revocation predates approval", (v) => { v.exceptions.find((row) => row.status === "revoked").revokedAt = "2026-09-11T09:59:59Z"; }, "invalid_exception"],
  ["exception approval predates finding", (v) => { v.exceptions.find((row) => row.status === "active").approvedAt = "2026-09-10T16:00:00Z"; }, "invalid_exception"],
  ["recertifier becomes process owner", (v) => { v.recertifications[0].recertifiedByRef = "principal-checkout-owner"; }, "invalid_recertification"],
  ["recertifier lacks exact process scope", (v) => { v.principals.find((row) => row.id === "principal-recertifier").scopes = ["process-payroll"]; }, "invalid_recertification"],
  ["recertification evidence supplier drifts", (v) => { v.evidence.find((row) => row.id === "evidence-recertifications").suppliedByRef = "principal-program-manager"; }, "invalid_recertification"],
  ["recertification predates remediation receipt", (v) => { v.recertifications[0].recertifiedAt = "2026-09-11T10:00:00Z"; }, "invalid_recertification"],
  ["recertification claims current with open finding", (v) => { v.recertifications[1].decision = "evidence-current"; }, "invalid_recertification"],
  ["recertification claims current without completed exercise", (v) => { v.exercises[0].result = "incomplete"; v.recertifications[0].decision = "evidence-current"; }, "invalid_recertification"],
  ["recertification drops plan revision", (v) => { v.recertifications[0].planRevision = `sha256:${"b".repeat(64)}`; }, "invalid_recertification", false],
  ["future source evidence", (v) => { v.evidence[0].observedAt = "2026-09-15T00:00:00Z"; }, "invalid_evidence_binding"],
  ["evidence payload replay", (v) => { v.evidence[0].sourceDigest = `sha256:${"a".repeat(64)}`; }, "invalid_evidence_binding", false],
  ["changed BIA evidence is not transitively rebound", (v) => { const evidence = v.evidence.find((row) => row.id === "evidence-bia-checkout"); evidence.sourceDigest = `sha256:${"7".repeat(64)}`; evidence.payloadDigest = computeEvidencePayloadDigest(evidence); }, "invalid_bia_binding", false],
  ["coverage drops a process", (v) => { v.coverage.processRefs.pop(); }, "invalid_coverage"],
  ["coverage digest replay", (v) => { v.coverage.findingRefs.pop(); }, "invalid_coverage", false],
  ["required blocker omitted", (v) => { v.blockers.pop(); }, "invalid_blocker_equality"],
  ["blocker evidence loses target", (v) => { v.evidence.find((row) => row.id === "evidence-blockers").subjectRefs.pop(); }, "invalid_blocker_equality"],
  ["invented blocker added", (v) => { v.blockers.push({ ...v.blockers[0], id: "blocker-invented", category: "missing-bia", targetRefs: ["process-checkout"] }); }, "invalid_blocker_equality"],
  ["blocked handoff claims owner review", (v) => { v.handoff.state = "owner-review"; }, "invalid_handoff"],
  ["handoff blocker index drifts", (v) => { v.handoff.blockerRefs.pop(); }, "invalid_handoff"],
  ["handoff digest replay", (v) => { v.handoff.summary = "Evidence changed."; }, "invalid_handoff", false],
  ["handoff claims disaster declaration", (v) => { v.handoff.disasterDeclarationClaim = "declared"; }, "invalid_handoff"],
  ["handoff narrative claims certification", (v) => { v.handoff.summary = "The agent certified the program."; }, "prohibited_authority_narrative"],
];

for (const [name, change, code, reseal = true] of adversarialCases) {
  test(`rejects ${name}`, () => {
    assertHas(mutate(change, reseal), code);
  });
}
