import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  backupRestoreVerificationFindings,
  computeAuthorityRosterDigest,
  computeCoverageDigest,
  computeDestinationApprovalDigest,
  computeEvidencePayloadDigest,
  computeEvidenceRecordDigest,
  computeHandoffDigest,
  computePlanDigest,
  computeRecoveryPointDigest,
  computeRecoveryPointExportDigest,
  computeResourceDigest,
  computeResourceExportDigest,
  computeSelectionDigest,
  resealBackupRestoreVerification,
} from "./backup-restore-verification-coordinator.mjs";

const AS_OF = "2026-09-02T12:00:00Z";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/backup-restore-verification-coordinator/fixtures/backup-restore-verification.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/backup-restore-verification-coordinator/schemas/backup-restore-verification.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/backup-restore-verification-coordinator/templates/backup-restore-verification.md",
    import.meta.url,
  ),
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
  return reseal ? resealBackupRestoreVerification(value) : value;
}

function findings(value, context = { asOf: AS_OF }) {
  return backupRestoreVerificationFindings(value, context);
}

function codes(value, context = { asOf: AS_OF }) {
  return new Set(findings(value, context).map((row) => row.code));
}

function assertHas(value, code, context = { asOf: AS_OF }) {
  assert.ok(codes(value, context).has(code), JSON.stringify(findings(value, context), null, 2));
}

test("accepted fixture is schema-valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("accepted fixture binds every non-circular root", () => {
  assert.equal(
    fixture.protectedResourceExport.contentDigest,
    computeResourceExportDigest(fixture.protectedResourceExport, fixture.resources),
  );
  assert.equal(
    fixture.recoveryPointExport.contentDigest,
    computeRecoveryPointExportDigest(fixture.recoveryPointExport, fixture.recoveryPoints),
  );
  assert.equal(
    fixture.authorityRoster.contentDigest,
    computeAuthorityRosterDigest(fixture.authorityRoster, fixture.principals),
  );
  assert.equal(fixture.round.planDigest, computePlanDigest(fixture.round, fixture));
  assert.equal(fixture.coverage.contentDigest, computeCoverageDigest(fixture.coverage, fixture));
  assert.equal(
    fixture.destinationApproval.payloadDigest,
    computeDestinationApprovalDigest(fixture.destinationApproval),
  );
  assert.equal(fixture.handoff.payloadDigest, computeHandoffDigest(fixture.handoff));
});

test("accepted fixture exercises every required outcome", () => {
  assert.equal(fixture.resources.filter((row) => row.selectionState === "selected").length, 5);
  assert.equal(fixture.resources.filter((row) => row.selectionState === "excluded").length, 1);
  assert.ok(fixture.providerJobs.some((row) => row.outcome === "succeeded"));
  assert.ok(fixture.providerJobs.some((row) => row.outcome === "failed"));
  assert.ok(fixture.validations.some((row) => row.outcome === "failed"));
  assert.ok(fixture.selections.some((row) => !fixture.providerJobs.some((job) => job.selectionRef === row.id)));
  assert.ok(fixture.cleanups.some((row) => row.outcome === "pending"));
  assert.ok(fixture.cleanups.some((row) => row.outcome === "retained"));
  for (const category of [
    "rpo-violation",
    "rto-violation",
    "provider-job-missing",
    "restore-failed",
    "validation-failed",
    "cleanup-pending",
    "temporary-target-retained",
  ]) {
    assert.ok(fixture.blockers.some((row) => row.category === category), category);
  }
});

test("public artifact CLI accepts the fixture only with caller asOf", () => {
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "backup-restore-verification-coordinator",
      "claws/backup-restore-verification-coordinator/fixtures/backup-restore-verification.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("handoff template exposes the complete review contract", () => {
  for (const token of [
    "## Exact protected-resource universe",
    "{{coverage.selectedResourceRefs}}",
    "{{coverage.excludedResourceRefs}}",
    "## Eligible recovery-point export",
    "{{recoveryPointExport.cutoffAt}}",
    "## Selected resource / recovery-point / isolated-target triples",
    "{{selections[].resourcePayloadDigest}}",
    "{{selections[].recoveryPointPayloadDigest}}",
    "{{selections[].targetPayloadDigest}}",
    "## Provider restore-job outcomes",
    "## Independent validation",
    "## Exact cleanup and temporary retention",
    "{{cleanups[].selectionPayloadDigest}}",
    "{{cleanups[].targetPayloadDigest}}",
    "RTO starts at the selected triple's own provider restore job",
    "{{authorityRoster.custodianRef}}",
    "{{authorityRoster.issuedAt}}",
    "{{authorityGrants[].issuedByRef}}",
    "## Roles, grants, and evidence chronology",
    "## Exact blockers",
    "{{handoff.restoreExecutionClaim}}",
    "{{handoff.validationExecutionClaim}}",
    "{{handoff.cleanupExecutionClaim}}",
    "{{handoff.recoverabilityClaim}}",
    "{{handoff.verificationCompletionClaim}}",
  ]) {
    assert.ok(template.includes(token), token);
  }
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [
    null,
    undefined,
    true,
    7,
    "artifact",
    [],
    {},
    { resources: {}, recoveryPoints: [null], selections: false },
    {
      resources: [{}],
      recoveryPoints: [{}],
      targets: [{}],
      selections: [{}],
      principals: [{}],
      authorityGrants: [{}],
      providerJobs: [{}],
      validations: [{}],
      cleanups: [{}],
      evidence: [{}],
      blockers: [{}],
    },
  ]) {
    assert.doesNotThrow(() => findings(value));
    assert.ok(findings(value).length > 0);
  }
});

test("trusted caller asOf is mandatory and never defaulted", () => {
  assert.ok(
    backupRestoreVerificationFindings(fixture).some(
      (row) => row.code === "invalid_validation_context",
    ),
  );
  assertHas(fixture, "invalid_validation_context", {});
  assertHas(fixture, "invalid_validation_context", { asOf: "not-a-time" });
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-31T12:00:00Z" });
  assert.ok(
    !backupRestoreVerificationFindings(fixture, {
      asOf: "2026-09-02T12:00:00.123456Z",
    }).some((row) => row.code === "invalid_validation_context"),
  );
});

test("offset-less asOf is rejected in every process timezone", () => {
  const moduleUrl = new URL("./backup-restore-verification-coordinator.mjs", import.meta.url).href;
  const fixtureUrl = new URL(
    "../sources/backup-restore-verification-coordinator/fixtures/backup-restore-verification.example.json",
    import.meta.url,
  ).href;
  const script = `
    import { readFile } from "node:fs/promises";
    import { backupRestoreVerificationFindings as validate } from ${JSON.stringify(moduleUrl)};
    const value = JSON.parse(await readFile(new URL(${JSON.stringify(fixtureUrl)}), "utf8"));
    const result = validate(value, { asOf: "2026-09-02T12:00:00" });
    if (!result.some((row) => row.code === "invalid_validation_context")) process.exit(1);
  `;
  for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      encoding: "utf8",
      env: { ...process.env, TZ: timezone },
    });
    assert.equal(child.status, 0, `${timezone}: ${child.stderr || child.stdout}`);
  }
});

const semanticCases = [
  ["unknown top-level key", (v) => { v.action = "restore"; }, "prohibited_contract_field"],
  ["unknown nested key", (v) => { v.selections[0].recommendation = "use"; }, "prohibited_contract_field"],
  ["duplicate global id", (v) => { v.targets[1].id = v.targets[0].id; }, "duplicate_identity"],
  ["resource omitted from export", (v) => { v.protectedResourceExport.resourceRefs.pop(); }, "invalid_resource_universe"],
  ["resource invented in export", (v) => { v.protectedResourceExport.resourceRefs.push("resource-invented"); }, "invalid_resource_universe"],
  ["selected resource has exclusion reason", (v) => { v.resources[0].exclusionReason = "owner-approved-out-of-scope"; }, "invalid_resource"],
  ["excluded resource lacks reason", (v) => { v.resources.at(-1).exclusionReason = null; }, "invalid_resource"],
  ["resource owner is not owner exporter", (v) => { v.resources[0].ownerSystemRef = "principal-recovery-catalog"; }, "invalid_resource"],
  ["resource payload id-only replay", (v) => { v.resources[0].resourceClass = "queue"; }, "invalid_resource_universe", false],
  ["recovery point omitted from export", (v) => { v.recoveryPointExport.recoveryPointRefs.pop(); }, "invalid_recovery_point_export"],
  ["recovery point crosses resource", (v) => { v.recoveryPoints[0].resourceRef = v.resources[1].id; }, "invalid_selection_binding"],
  ["recovery point provider drift", (v) => { v.recoveryPoints[0].providerRef = "principal-recovery-catalog"; }, "invalid_recovery_point"],
  ["recovery point reuses a resource source record", (v) => { v.recoveryPoints[0].sourceRecordDigest = v.resources[0].sourceRecordDigest; }, "duplicate_source_record_digest"],
  ["recovery point captured after export", (v) => { v.recoveryPoints[0].capturedAt = "2026-09-01T08:50:00Z"; }, "invalid_recovery_point"],
  ["recovery point captured after its own export", (v) => { v.recoveryPoints[0].capturedAt = "2026-08-31T08:45:01Z"; }, "invalid_recovery_point"],
  ["RPO cutoff is not caller supplied", (v) => { v.recoveryPointExport.cutoffAt = "2026-08-31T08:00:01Z"; }, "invalid_recovery_point_export"],
  ["RPO boundary violation needs blocker", (v) => { v.recoveryPoints[0].capturedAt = "2026-08-31T07:59:59Z"; }, "invalid_blocker_equality"],
  ["selection omitted", (v) => { v.selections.pop(); }, "invalid_selection_partition"],
  ["selection duplicates resource", (v) => { v.selections[1].resourceRef = v.selections[0].resourceRef; }, "invalid_selection_partition"],
  ["selection reuses recovery point", (v) => { v.selections[1].recoveryPointRef = v.selections[0].recoveryPointRef; }, "invalid_selection_partition"],
  ["selection reuses target", (v) => { v.selections[1].targetRef = v.selections[0].targetRef; }, "invalid_selection_partition"],
  ["target locator collides", (v) => { v.targets[1].locatorDigest = v.targets[0].locatorDigest; }, "invalid_isolated_target"],
  ["selection target provider differs", (v) => { v.targets[0].providerRef = "principal-recovery-catalog"; }, "invalid_selection_binding"],
  ["selection occurs before request", (v) => { v.selections[0].selectedAt = "2026-09-01T08:59:59Z"; }, "invalid_selection_binding"],
  ["selection uses wrong grant", (v) => { v.selections[0].authorityGrantRef = "grant-cleanup-report"; }, "invalid_selection_binding"],
  ["plan digest frozen replay", (v) => { v.selections[0].selectedAt = "2026-09-01T09:06:30Z"; }, "invalid_plan_digest", false],
  ["duplicate provider job", (v) => { const row = clone(v.providerJobs[0]); row.id = "job-duplicate"; row.providerJobRef = "provider-job-duplicate"; row.evidenceRef = "evidence-job-duplicate"; v.providerJobs.push(row); }, "invalid_provider_job"],
  ["provider job identity reused across selections", (v) => { v.providerJobs[1].providerJobRef = v.providerJobs[0].providerJobRef; }, "invalid_provider_job"],
  ["provider mismatch", (v) => { v.providerJobs[0].providerRef = "principal-recovery-catalog"; }, "invalid_provider_job"],
  ["job starts before selection", (v) => { v.providerJobs[0].submittedAt = "2026-09-01T09:00:00Z"; }, "invalid_provider_job"],
  ["job completes before submit", (v) => { v.providerJobs[0].completedAt = "2026-09-01T09:09:00Z"; }, "invalid_provider_job"],
  ["provider job missing blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.category !== "provider-job-missing"); }, "invalid_blocker_equality"],
  ["restore failure blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.category !== "restore-failed"); }, "invalid_blocker_equality"],
  ["validation self-authored by provider", (v) => { v.validations[0].validatorRef = "principal-restore-provider"; }, "invalid_independent_validation"],
  ["failed-job selection borrows job-1 and passes", (v) => { v.validations[2].providerJobRef = "job-1"; v.validations[2].outcome = "passed"; v.validations[2].startedAt = "2026-09-01T09:40:00Z"; v.validations[2].completedAt = "2026-09-01T09:50:00Z"; v.validations[2].checkCodes = ["integrity-check"]; }, "invalid_independent_validation"],
  ["missing-job selection borrows job-1 and passes", (v) => { v.validations[3].providerJobRef = "job-1"; v.validations[3].outcome = "passed"; v.validations[3].startedAt = "2026-09-01T09:40:00Z"; v.validations[3].completedAt = "2026-09-01T09:50:00Z"; v.validations[3].checkCodes = ["integrity-check"]; }, "invalid_independent_validation"],
  ["validation passes failed job", (v) => { v.validations[2].outcome = "passed"; v.validations[2].startedAt = "2026-09-01T09:31:00Z"; v.validations[2].completedAt = "2026-09-01T09:40:00Z"; v.validations[2].checkCodes = ["integrity-check"]; }, "invalid_independent_validation"],
  ["not-run validation has timestamp", (v) => { v.validations[3].startedAt = "2026-09-01T09:20:00Z"; }, "invalid_independent_validation"],
  ["validation begins before job complete", (v) => { v.validations[0].startedAt = "2026-09-01T09:34:59Z"; }, "invalid_independent_validation"],
  ["completed validation lacks checks", (v) => { v.validations[0].checkCodes = []; }, "invalid_independent_validation"],
  ["validation row omitted", (v) => { v.validations.pop(); }, "invalid_validation_coverage"],
  ["validation failure blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.category !== "validation-failed"); }, "invalid_blocker_equality"],
  ["RTO violation blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.category !== "rto-violation"); }, "invalid_blocker_equality"],
  ["RTO uses own provider job submission", (v) => { v.validations[0].completedAt = "2026-09-01T10:40:01Z"; }, "invalid_blocker_equality"],
  ["cleanup row omitted", (v) => { v.cleanups.pop(); }, "invalid_cleanup_coverage"],
  ["cleanup requested before own job completion", (v) => { v.cleanups[2].requestedAt = "2026-09-01T09:20:00Z"; v.cleanups[2].completedAt = "2026-09-01T09:25:00Z"; }, "invalid_cleanup_outcome"],
  ["cleanup completes while own validation is running", (v) => { v.cleanups[0].requestedAt = "2026-09-01T09:45:00Z"; v.cleanups[0].completedAt = "2026-09-01T09:50:00Z"; }, "invalid_cleanup_outcome"],
  ["pending cleanup claims completion", (v) => { v.cleanups[1].completedAt = "2026-09-01T10:20:00Z"; }, "invalid_cleanup_outcome"],
  ["cleaned target lacks completion", (v) => { v.cleanups[0].completedAt = null; }, "invalid_cleanup_outcome"],
  ["cleaned target completes after cleanup grant expires", (v) => { v.authorityGrants.find((row) => row.id === "grant-cleanup-report").activeUntil = "2026-09-01T10:19:59Z"; }, "invalid_cleanup_outcome"],
  ["retained target lacks reason", (v) => { v.cleanups[4].retentionReason = null; }, "invalid_cleanup_outcome"],
  ["retained target lacks deadline", (v) => { v.cleanups[4].retentionUntil = null; }, "invalid_cleanup_outcome"],
  ["retained target expires exactly at caller asOf", (v) => { v.cleanups[4].retentionUntil = AS_OF; }, "invalid_cleanup_outcome"],
  ["retained target has wrong approver", (v) => { v.cleanups[4].retentionApprovedByRef = "principal-cleanup-owner"; }, "invalid_cleanup_outcome"],
  ["retained target lacks approver-authored evidence", (v) => { v.cleanups[4].retentionApprovalEvidenceRef = null; }, "invalid_cleanup_outcome"],
  ["cleanup pending blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-cleanup-pending-2"); }, "invalid_blocker_equality"],
  ["retention blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.category !== "temporary-target-retained"); }, "invalid_blocker_equality"],
  ["unrelated blocker added", (v) => { const row = clone(v.blockers[0]); row.id = "blocker-unrelated"; row.category = "rpo-violation"; row.evidenceRef = "evidence-blocker-unrelated"; v.blockers.push(row); }, "invalid_blocker_equality"],
  ["blocker target mismatch", (v) => { v.blockers[0].targetRefs = ["selection-2", "target-3"]; }, "invalid_blocker_equality"],
  ["blocker category mismatch", (v) => { v.blockers[0].category = "restore-failed"; }, "invalid_blocker_equality"],
  ["restore failure blocker predates provider outcome", (v) => { v.blockers.find((row) => row.category === "restore-failed").detectedAt = "2026-09-01T09:20:00Z"; }, "invalid_blocker"],
  ["grant is expired at selection", (v) => { v.authorityGrants.find((row) => row.id === "grant-selection").activeUntil = "2026-09-01T09:04:00Z"; }, "invalid_selection_binding"],
  ["grant uses wrong scope", (v) => { v.authorityGrants.find((row) => row.id === "grant-selection").scope = "report-cleanup"; }, "invalid_selection_binding"],
  ["grant issuer self-grants", (v) => { v.authorityGrants[0].issuedByRef = v.authorityGrants[0].granteeRef; }, "invalid_authority_grant"],
  ["grant targets an unrostered identity", (v) => { const row = clone(v.authorityGrants[0]); row.id = "grant-unrostered"; row.granteeRef = "principal-unrostered"; v.authorityGrants.push(row); }, "invalid_authority_grant"],
  ["roster provenance omits changed issuance time", (v) => { v.authorityRoster.issuedAt = "2026-08-31T08:41:00Z"; }, "invalid_authority_roster", false],
  ["roster custodian collides with coordinator", (v) => { v.principals.find((row) => row.id === "principal-coordinator").scopes.push("authority-roster-custodian"); v.authorityRoster.custodianRef = "principal-coordinator"; }, "invalid_role_separation"],
  ["grant issuer collides with validator", (v) => { v.principals.find((row) => row.id === "principal-validator").scopes.push("authority-grant-issuer"); v.authorityGrants[0].issuedByRef = "principal-validator"; }, "invalid_role_separation"],
  ["roster custodian collides with grant issuer", (v) => { v.principals.find((row) => row.id === "principal-grant-issuer").scopes.push("authority-roster-custodian"); v.authorityRoster.custodianRef = "principal-grant-issuer"; }, "invalid_role_separation"],
  ["blocker owner collides with handoff recipient", (v) => { v.principals.find((row) => row.id === "principal-handoff-owner").scopes.push("selection-coordinator"); v.blockers.forEach((row) => { row.ownerRef = "principal-handoff-owner"; }); v.evidence.filter((row) => row.kind === "blocker-record").forEach((row) => { row.suppliedByRef = "principal-handoff-owner"; }); }, "invalid_role_separation"],
  ["provider and validator roles collide", (v) => { v.validations.forEach((row) => { row.validatorRef = "principal-restore-provider"; }); }, "invalid_role_separation"],
  ["no-eligible exclusion contradicts eligible recovery point", (v) => { v.resources.at(-1).exclusionReason = "no-eligible-recovery-point"; v.recoveryPoints[0].resourceRef = v.resources.at(-1).id; }, "invalid_resource"],
  ["evidence row omitted", (v) => { v.evidence.pop(); }, "invalid_evidence_closure"],
  ["evidence subjects drift", (v) => { v.evidence.find((row) => row.id === "evidence-selection-1").subjectRefs.pop(); }, "invalid_evidence_closure"],
  ["evidence chronology drifts", (v) => { v.evidence.find((row) => row.id === "evidence-job-1").observedAt = "2026-09-01T09:36:00Z"; }, "invalid_evidence_chronology"],
  ["source record digest reused", (v) => { v.evidence[1].sourceRecordDigest = v.evidence[0].sourceRecordDigest; }, "duplicate_source_record_digest"],
  ["coverage omits selected resource", (v) => { v.coverage.selectedResourceRefs.pop(); }, "invalid_coverage"],
  ["coverage omits cleanup", (v) => { v.coverage.cleanupRefs.pop(); }, "invalid_coverage"],
  ["coverage digest frozen replay", (v) => { v.cleanups[0].requestedAt = "2026-09-01T10:06:00Z"; }, "invalid_coverage", false],
  ["destination coverage root drifts", (v) => { v.destinationApproval.coverageDigest = `sha256:${"1".repeat(64)}`; }, "invalid_destination", false],
  ["destination approver drifts", (v) => { v.destinationApproval.approvedByRef = "principal-handoff-owner"; }, "invalid_destination"],
  ["destination approval predates covered evidence", (v) => { v.destinationApproval.approvedAt = "2026-09-01T09:00:00Z"; }, "invalid_destination"],
  ["handoff destination root drifts", (v) => { v.handoff.destinationApprovalDigest = `sha256:${"2".repeat(64)}`; }, "invalid_handoff", false],
  ["handoff claims ready with blockers", (v) => { v.handoff.state = "ready-for-owner-review"; }, "invalid_handoff"],
  ["handoff omits validation", (v) => { v.handoff.validationRefs.pop(); }, "invalid_handoff"],
  ["future job evidence fails caller asOf", (v) => { v.providerJobs[0].completedAt = "2026-09-03T09:35:00Z"; }, "future_record"],
];

test("accepts RTO exactly at the own-job boundary", () => {
  const value = mutate((candidate) => {
    candidate.validations[4].completedAt = "2026-09-01T10:44:00Z";
    candidate.evidence.find((row) => row.id === "evidence-validation-5").observedAt =
      "2026-09-01T10:44:00Z";
    const blocker = candidate.blockers.find((row) => row.id === "blocker-rto");
    candidate.blockers = candidate.blockers.filter((row) => row.id !== blocker.id);
    candidate.evidence = candidate.evidence.filter((row) => row.id !== blocker.evidenceRef);
    candidate.coverage.blockerRefs = candidate.coverage.blockerRefs.filter(
      (ref) => ref !== blocker.id,
    );
    candidate.handoff.blockerRefs = candidate.handoff.blockerRefs.filter(
      (ref) => ref !== blocker.id,
    );
  });
  assert.deepEqual(findings(value), []);
});

test("requires an RTO blocker one second after the own-job boundary", () => {
  const value = mutate((candidate) => {
    candidate.validations[4].completedAt = "2026-09-01T10:44:01Z";
    candidate.evidence.find((row) => row.id === "evidence-validation-5").observedAt =
      "2026-09-01T10:44:01Z";
  });
  assert.deepEqual(findings(value), []);
});

for (const [name, change, expectedCode, reseal = true] of semanticCases) {
  test(`rejects ${name}`, () => {
    const value = mutate(change, reseal);
    assertHas(value, expectedCode);
  });
}

for (const field of [
  "restoreExecutionClaim",
  "validationExecutionClaim",
  "cleanupExecutionClaim",
  "productionReadinessClaim",
  "recoverabilityClaim",
  "complianceClaim",
  "auditClaim",
  "failoverClaim",
  "deletionClaim",
  "verificationCompletionClaim",
]) {
  test(`requires structural not-claimed ${field}`, () => {
    const value = mutate((candidate) => {
      candidate.handoff[field] = "claimed";
    });
    assert.equal(validateSchema(value), false);
    assertHas(value, "invalid_handoff");
  });
}

test("source record digests cannot equal an internally derived root", () => {
  const value = mutate((candidate) => {
    candidate.evidence[0].sourceRecordDigest = candidate.round.planDigest;
  }, false);
  assertHas(value, "derived_source_record_digest");
});

test("semantic findings are deterministic for malformed schema-valid state", () => {
  const value = mutate((candidate) => {
    candidate.coverage.selectedResourceRefs.pop();
    candidate.handoff.state = "ready-for-owner-review";
  });
  assert.deepEqual(findings(value), findings(clone(value)));
});

test("resource, recovery point, and selection digests bind semantic content", () => {
  assert.equal(fixture.resources[0].payloadDigest, computeResourceDigest(fixture.resources[0]));
  assert.equal(
    fixture.recoveryPoints[0].payloadDigest,
    computeRecoveryPointDigest(fixture.recoveryPoints[0]),
  );
  assert.equal(fixture.selections[0].payloadDigest, computeSelectionDigest(fixture.selections[0]));
});

test("every evidence record binds its source payload and external record root separately", () => {
  for (const row of fixture.evidence) {
    assert.equal(row.payloadDigest, computeEvidencePayloadDigest(row.kind, fixture, row.id));
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
    assert.notEqual(row.sourceRecordDigest, row.payloadDigest);
    assert.notEqual(row.sourceRecordDigest, row.recordDigest);
  }
});
