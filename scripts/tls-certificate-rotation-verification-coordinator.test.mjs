import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeAuthorityRosterDigest,
  computeBindingExportDigest,
  computeCertificateDigest,
  computeCertificateExportDigest,
  computeCoverageDigest,
  computeDestinationApprovalDigest,
  computeEndpointObservationDigest,
  computeEvidencePayloadDigest,
  computeEvidenceRecordDigest,
  computeHandoffDigest,
  computeIssuanceDigest,
  computePlanDigest,
  computeRotationRequestDigest,
  resealTlsCertificateRotationVerification,
  tlsCertificateRotationVerificationFindings,
} from "./tls-certificate-rotation-verification-coordinator.mjs";

const AS_OF = "2026-09-05T00:00:00Z";
const base = "../sources/tls-certificate-rotation-verification-coordinator";
const fixture = JSON.parse(
  await readFile(new URL(`${base}/fixtures/tls-certificate-rotation.example.json`, import.meta.url), "utf8"),
);
const schema = JSON.parse(
  await readFile(new URL(`${base}/schemas/tls-certificate-rotation.schema.json`, import.meta.url), "utf8"),
);
const template = await readFile(
  new URL(`${base}/templates/tls-certificate-rotation.md`, import.meta.url),
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
  return reseal ? resealTlsCertificateRotationVerification(value) : value;
}

function setBlockerDetectedAt(value, blockerId, detectedAt) {
  const blocker = value.blockers.find((row) => row.id === blockerId);
  blocker.detectedAt = detectedAt;
  value.evidence.find((row) => row.id === blocker.evidenceRef).observedAt = detectedAt;
}

function findings(value, context = { asOf: AS_OF }) {
  return tlsCertificateRotationVerificationFindings(value, context);
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
    fixture.certificateExport.contentDigest,
    computeCertificateExportDigest(fixture.certificateExport, fixture.certificates),
  );
  assert.equal(
    fixture.bindingExport.contentDigest,
    computeBindingExportDigest(fixture.bindingExport, fixture.bindings),
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
  assert.equal(fixture.certificates.filter((row) => row.rotationState === "rotate").length, 8);
  assert.equal(fixture.certificates.filter((row) => row.rotationState === "exclude").length, 1);
  assert.ok(fixture.issuances.some((row) => row.outcome === "issued"));
  assert.ok(fixture.issuances.some((row) => row.outcome === "pending"));
  assert.ok(fixture.issuances.some((row) => row.outcome === "failed"));
  assert.ok(fixture.deployments.some((row) => row.outcome === "deployed"));
  assert.ok(fixture.deployments.some((row) => row.outcome === "failed"));
  assert.ok(
    fixture.bindings.some((row) => !fixture.deployments.some((dep) => dep.bindingRef === row.id)),
  );
  assert.ok(fixture.endpointObservations.some((row) => row.outcome === "fingerprint-mismatch"));
  assert.ok(fixture.endpointObservations.some((row) => row.outcome === "chain-failed"));
  assert.equal(fixture.retirements.length, 1);
  assert.ok(fixture.overlaps.length > 0);
  assert.equal(fixture.handoff.state, "blocked");
  for (const category of [
    "issuance-pending",
    "issuance-failed",
    "deployment-missing",
    "deployment-failed",
    "endpoint-fingerprint-mismatch",
    "endpoint-chain-failed",
    "overlap-retained",
  ]) {
    assert.ok(fixture.blockers.some((row) => row.category === category), category);
  }
});

test("public artifact CLI accepts the fixture only with caller asOf", () => {
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "tls-certificate-rotation-verification-coordinator",
      "claws/tls-certificate-rotation-verification-coordinator/fixtures/tls-certificate-rotation.example.json",
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
    "## Exact predecessor certificate inventory",
    "{{certificates[].rotationState}}",
    "{{coverage.rotateCertificateRefs}}",
    "{{coverage.excludeCertificateRefs}}",
    "## Exact service / listener / endpoint binding inventory",
    "{{bindings[].endpointLocatorDigest}}",
    "## Owner-approved rotation requests",
    "## CA / provider issuance outcomes",
    "{{issuances[].providerOperationId}}",
    "## Successor deployment observations",
    "## Independent endpoint fingerprint and chain observations",
    "{{endpointObservations[].expectedSuccessorVersionId}}",
    "## Retirement, revocation, and approved temporary overlap",
    "{{overlaps[].overlapUntil}}",
    "borrowable across requests",
    "{{authorityRoster.custodianRef}}",
    "## Exact blockers",
    "{{handoff.privateKeyAccessClaim}}",
    "{{handoff.issuanceExecutionClaim}}",
    "{{handoff.deploymentExecutionClaim}}",
    "{{handoff.revocationClaim}}",
    "{{handoff.rotationCompletionClaim}}",
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
    { certificates: {}, bindings: [null], rotationRequests: false },
    {
      certificates: [{}],
      bindings: [{}],
      rotationRequests: [{}],
      issuances: [{}],
      deployments: [{}],
      endpointObservations: [{}],
      retirements: [{}],
      overlaps: [{}],
      principals: [{}],
      authorityGrants: [{}],
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
    tlsCertificateRotationVerificationFindings(fixture).some(
      (row) => row.code === "invalid_validation_context",
    ),
  );
  assertHas(fixture, "invalid_validation_context", {});
  assertHas(fixture, "invalid_validation_context", { asOf: "not-a-time" });
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-31T12:00:00Z" });
  assert.ok(
    !tlsCertificateRotationVerificationFindings(fixture, {
      asOf: "2026-09-05T00:00:00.123456Z",
    }).some((row) => row.code === "invalid_validation_context"),
  );
});

test("offset-less asOf is rejected in every process timezone", () => {
  const moduleUrl = new URL("./tls-certificate-rotation-verification-coordinator.mjs", import.meta.url).href;
  const fixtureUrl = new URL(`${base}/fixtures/tls-certificate-rotation.example.json`, import.meta.url).href;
  const script = `
    import { readFile } from "node:fs/promises";
    import { tlsCertificateRotationVerificationFindings as validate } from ${JSON.stringify(moduleUrl)};
    const value = JSON.parse(await readFile(new URL(${JSON.stringify(fixtureUrl)}), "utf8"));
    const result = validate(value, { asOf: "2026-09-05T00:00:00" });
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
  ["unknown top-level key", (v) => { v.action = "issue"; }, "prohibited_contract_field"],
  ["unknown nested key", (v) => { v.rotationRequests[0].recommendation = "rotate"; }, "prohibited_contract_field"],
  ["duplicate global id", (v) => { v.bindings[1].id = v.bindings[0].id; }, "duplicate_identity"],
  ["certificate omitted from export", (v) => { v.certificateExport.certificateRefs.pop(); }, "invalid_certificate_universe"],
  ["certificate invented in export", (v) => { v.certificateExport.certificateRefs.push("certificate-invented"); }, "invalid_certificate_universe"],
  ["rotate certificate carries exclusion reason", (v) => { v.certificates[0].exclusionReason = "already-current"; }, "invalid_certificate"],
  ["excluded certificate lacks reason", (v) => { v.certificates[8].exclusionReason = null; }, "invalid_certificate"],
  ["certificate owner is not owner exporter", (v) => { v.certificates[0].ownerSystemRef = "principal-campaign-coordinator"; }, "invalid_certificate"],
  ["certificate payload id-only replay", (v) => { v.certificates[0].certificateClass = "wildcard"; }, "invalid_certificate_universe", false],
  ["binding omitted from export", (v) => { v.bindingExport.bindingRefs.pop(); }, "invalid_binding_universe"],
  ["deployment borrows a binding from an excluded certificate", (v) => { v.bindings[0].certificateRef = "cert-india"; }, "invalid_deployment"],
  ["binding locator collides", (v) => { v.bindings[1].endpointLocatorDigest = v.bindings[0].endpointLocatorDigest; }, "invalid_binding"],
  ["binding reuses a certificate source record", (v) => { v.bindings[0].sourceRecordDigest = v.certificates[0].sourceRecordDigest; }, "duplicate_source_record_digest"],
  ["rotation request omitted", (v) => { v.rotationRequests.pop(); }, "invalid_rotation_partition"],
  ["rotation request duplicates certificate", (v) => { v.rotationRequests[1].certificateRef = v.rotationRequests[0].certificateRef; }, "invalid_rotation_partition"],
  ["rotation request wrong campaign", (v) => { v.rotationRequests[0].campaignRef = "campaign-other"; }, "invalid_rotation_request"],
  ["rotation request wrong version", (v) => { v.rotationRequests[0].approvedVersion = "rotation-wave-9"; }, "invalid_rotation_request"],
  ["rotation request before export", (v) => { v.rotationRequests[0].requestedAt = "2026-09-01T08:59:00Z"; }, "invalid_rotation_request"],
  ["rotation request uses wrong grant", (v) => { v.rotationRequests[0].authorityGrantRef = "grant-issuance"; }, "invalid_rotation_request"],
  ["plan digest frozen replay", (v) => { v.rotationRequests[0].requestedAt = "2026-09-01T10:31:00Z"; }, "invalid_plan_digest", false],
  ["issuance row omitted without its blocker", (v) => { v.issuances.pop(); }, "invalid_blocker_equality"],
  ["duplicate issuance for request", (v) => { const row = clone(v.issuances[0]); row.id = "issuance-duplicate"; row.providerOperationId = "provider-operation-duplicate"; row.successorLogicalId = "successor-duplicate-logical"; row.successorVersionId = "successor-duplicate-version"; row.evidenceRef = "evidence-issuance-duplicate"; v.issuances.push(row); }, "invalid_issuance"],
  ["provider operation id reused across issuances", (v) => { v.issuances[1].providerOperationId = v.issuances[0].providerOperationId; }, "invalid_issuance"],
  ["successor version reused across issuances", (v) => { v.issuances[1].successorVersionId = v.issuances[0].successorVersionId; }, "invalid_issuance"],
  ["issued issuance drops its successor version", (v) => { v.issuances[0].successorVersionId = null; }, "invalid_issuance"],
  ["issued issuance carries a foreign campaign", (v) => { v.issuances[0].campaignRef = "campaign-other"; }, "invalid_issuance"],
  ["pending issuance carries a decision time", (v) => { v.issuances[2].decidedAt = "2026-09-01T11:30:00Z"; }, "invalid_issuance"],
  ["failed issuance carries a successor", (v) => { v.issuances[3].successorVersionId = "successor-delta-version"; v.issuances[3].successorLogicalId = "successor-delta-logical"; v.issuances[3].campaignRef = "campaign-2026q3-tls"; }, "invalid_issuance"],
  ["issuance submitted before its request", (v) => { v.issuances[0].submittedAt = "2026-09-01T10:00:00Z"; }, "invalid_issuance"],
  ["issuance decided before submission", (v) => { v.issuances[0].decidedAt = "2026-09-01T10:59:00Z"; }, "invalid_issuance"],
  ["issuance pending blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-charlie-issuance"); }, "invalid_blocker_equality"],
  ["issuance failed blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-delta-issuance"); }, "invalid_blocker_equality"],
  ["deployment borrows another binding", (v) => { v.deployments[0].bindingRef = "binding-bravo"; }, "invalid_deployment"],
  ["deployment references a foreign successor version", (v) => { v.deployments[0].successorVersionId = "successor-bravo-version"; }, "invalid_deployment"],
  ["deployment references a stale issuance payload", (v) => { v.issuances[0].providerOperationId = "provider-operation-alpha-reissued"; v.issuances[0].payloadDigest = computeIssuanceDigest(v.issuances[0]); }, "invalid_deployment", false],
  ["deployment observer authors its own endpoint proof", (v) => { v.deployments[0].observerRef = "principal-endpoint-validator"; }, "invalid_role_separation"],
  ["deployment observed before issuance decided", (v) => { v.deployments[0].observedAt = "2026-09-01T11:00:00Z"; }, "invalid_deployment"],
  ["failed deployment observed before issuance decided", (v) => { v.deployments.find((row) => row.id === "deployment-foxtrot").observedAt = "2026-09-01T11:00:00Z"; }, "invalid_deployment"],
  ["failed deployment references a non-issued issuance", (v) => { const row = v.issuances.find((item) => item.id === "issuance-foxtrot"); row.outcome = "pending"; row.decidedAt = null; row.campaignRef = null; row.successorLogicalId = null; row.successorVersionId = null; }, "invalid_deployment"],
  ["deployment missing blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-echo-deployment"); }, "invalid_blocker_equality"],
  ["deployment failed blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-foxtrot-deployment"); }, "invalid_blocker_equality"],
  ["deployed binding lacks an endpoint observation and blocker", (v) => { v.endpointObservations = v.endpointObservations.filter((row) => row.id !== "endpoint-alpha"); }, "invalid_blocker_equality"],
  ["failed deployment gains an endpoint observation", (v) => { const row = clone(v.endpointObservations[0]); row.id = "endpoint-foxtrot"; row.deploymentRef = "deployment-foxtrot"; row.bindingRef = "binding-foxtrot"; row.expectedSuccessorVersionId = "successor-foxtrot-version"; row.evidenceRef = "evidence-endpoint-foxtrot"; v.endpointObservations.push(row); }, "invalid_endpoint_coverage"],
  ["endpoint observation self-authored by deployment observer", (v) => { v.endpointObservations[0].validatorRef = "principal-deployment-observer"; }, "invalid_role_separation"],
  ["endpoint observation expects a foreign successor version", (v) => { v.endpointObservations[0].expectedSuccessorVersionId = "successor-bravo-version"; }, "invalid_endpoint_observation"],
  ["endpoint observed before deployment", (v) => { v.endpointObservations[0].observedAt = "2026-09-01T11:59:00Z"; }, "invalid_endpoint_observation"],
  ["completed endpoint observation lacks checks", (v) => { v.endpointObservations[0].checkCodes = []; }, "invalid_endpoint_observation"],
  ["matched endpoint omits fingerprint proof", (v) => { v.endpointObservations[0].checkCodes = ["chain-valid"]; }, "invalid_endpoint_observation"],
  ["matched endpoint omits chain proof", (v) => { v.endpointObservations[0].checkCodes = ["fingerprint-match"]; }, "invalid_endpoint_observation"],
  ["fingerprint mismatch claims a fingerprint match", (v) => { v.endpointObservations.find((row) => row.outcome === "fingerprint-mismatch").checkCodes = ["fingerprint-match", "chain-valid"]; }, "invalid_endpoint_observation"],
  ["chain failure claims a valid chain", (v) => { v.endpointObservations.find((row) => row.outcome === "chain-failed").checkCodes = ["fingerprint-match", "chain-valid"]; }, "invalid_endpoint_observation"],
  ["fingerprint mismatch omits valid-chain proof", (v) => { v.endpointObservations.find((row) => row.outcome === "fingerprint-mismatch").checkCodes = ["hostname-match"]; }, "invalid_endpoint_observation"],
  ["chain failure omits matching-fingerprint proof", (v) => { v.endpointObservations.find((row) => row.outcome === "chain-failed").checkCodes = ["hostname-match"]; }, "invalid_endpoint_observation"],
  ["fingerprint mismatch blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-golf-endpoint"); }, "invalid_blocker_equality"],
  ["chain failure blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-hotel-endpoint"); }, "invalid_blocker_equality"],
  ["retirement admitted before bindings validate", (v) => { v.endpointObservations[0].outcome = "fingerprint-mismatch"; }, "invalid_retirement"],
  ["retirement admitted without any certificate binding", (v) => { v.bindings = v.bindings.filter((row) => row.certificateRef !== "cert-alpha"); }, "invalid_retirement"],
  ["certificate carries both retirement and overlap", (v) => { const row = clone(v.overlaps[0]); row.id = "overlap-alpha"; row.certificateRef = "cert-alpha"; row.evidenceRef = "evidence-overlap-alpha"; v.overlaps.push(row); }, "invalid_terminal_state"],
  ["overlap already expired at asOf", (v) => { v.overlaps[0].overlapUntil = "2026-09-04T00:00:00Z"; }, "invalid_overlap"],
  ["overlap expires exactly at caller asOf", (v) => { v.overlaps[0].overlapUntil = AS_OF; }, "invalid_overlap"],
  ["overlap declared after asOf", (v) => { v.overlaps[0].declaredAt = "2026-09-06T00:00:00Z"; }, "invalid_overlap"],
  ["overlap uses wrong grant", (v) => { v.overlaps[0].authorityGrantRef = "grant-destination"; }, "invalid_overlap"],
  ["overlap-retained blocker omitted", (v) => { v.blockers = v.blockers.filter((row) => row.id !== "blocker-bravo-overlap"); }, "invalid_blocker_equality"],
  ["rotate certificate lacks a terminal state", (v) => { v.overlaps = v.overlaps.filter((row) => row.id !== "overlap-bravo"); }, "invalid_terminal_state"],
  ["unrelated blocker added", (v) => { const row = clone(v.blockers[0]); row.id = "blocker-unrelated"; row.category = "issuance-missing"; row.certificateRef = "cert-alpha"; row.subjectRefs = ["cert-alpha"]; row.evidenceRef = "evidence-blocker-unrelated"; v.blockers.push(row); }, "invalid_blocker_equality"],
  ["blocker subject mismatch", (v) => { v.blockers[5].subjectRefs = ["cert-echo", "binding-golf"]; }, "invalid_blocker_equality"],
  ["blocker category mismatch", (v) => { v.blockers[1].category = "issuance-failed"; }, "invalid_blocker_equality"],
  ["pending issuance blocker predates submission", (v) => { setBlockerDetectedAt(v, "blocker-charlie-issuance", "2026-09-01T10:45:00Z"); }, "invalid_blocker"],
  ["failed issuance blocker predates decision", (v) => { setBlockerDetectedAt(v, "blocker-delta-issuance", "2026-09-01T11:15:00Z"); }, "invalid_blocker"],
  ["missing deployment blocker predates issuance", (v) => { setBlockerDetectedAt(v, "blocker-echo-deployment", "2026-09-01T11:15:00Z"); }, "invalid_blocker"],
  ["failed deployment blocker predates observation", (v) => { setBlockerDetectedAt(v, "blocker-foxtrot-deployment", "2026-09-01T11:45:00Z"); }, "invalid_blocker"],
  ["fingerprint blocker predates endpoint mismatch", (v) => { setBlockerDetectedAt(v, "blocker-golf-endpoint", "2026-09-01T12:30:00Z"); }, "invalid_blocker"],
  ["chain blocker predates endpoint failure", (v) => { setBlockerDetectedAt(v, "blocker-hotel-endpoint", "2026-09-01T12:30:00Z"); }, "invalid_blocker"],
  ["overlap blocker predates overlap declaration", (v) => { setBlockerDetectedAt(v, "blocker-bravo-overlap", "2026-09-02T08:30:00Z"); }, "invalid_blocker"],
  ["grant is expired at rotation request", (v) => { v.authorityGrants[0].activeUntil = "2026-09-01T10:00:00Z"; }, "invalid_rotation_request"],
  ["grant uses wrong scope", (v) => { v.authorityGrants[0].scope = "approve-destination"; }, "invalid_rotation_request"],
  ["grant issuer self-grants", (v) => { v.authorityGrants[0].issuedByRef = v.authorityGrants[0].granteeRef; }, "invalid_authority_grant"],
  ["grant targets an unrostered identity", (v) => { const row = clone(v.authorityGrants[0]); row.id = "grant-unrostered"; row.granteeRef = "principal-unrostered"; row.evidenceRef = "evidence-grant-unrostered"; v.authorityGrants.push(row); }, "invalid_authority_grant"],
  ["roster provenance omits changed issuance time", (v) => { v.authorityRoster.issuedAt = "2026-09-01T07:30:00Z"; }, "invalid_authority_roster", false],
  ["roster custodian collides with coordinator", (v) => { v.principals.find((row) => row.id === "principal-campaign-coordinator").scopes.push("authority-roster-custodian"); v.authorityRoster.custodianRef = "principal-campaign-coordinator"; }, "invalid_role_separation"],
  ["campaign coordinator reference is dangling", (v) => { v.round.campaignCoordinatorRef = "principal-does-not-exist"; }, "invalid_round"],
  ["campaign coordinator lacks its required scope", (v) => { v.principals.find((row) => row.id === "principal-campaign-coordinator").scopes = ["endpoint-validator"]; }, "invalid_round"],
  ["provider and endpoint validator roles collide", (v) => { v.endpointObservations.forEach((row) => { row.validatorRef = "principal-ca-provider"; }); }, "invalid_role_separation"],
  ["evidence row omitted", (v) => { v.evidence.pop(); }, "invalid_evidence_closure"],
  ["evidence subjects drift", (v) => { v.evidence.find((row) => row.id === "evidence-request-alpha").subjectRefs.pop(); }, "invalid_evidence_closure"],
  ["evidence chronology drifts", (v) => { v.evidence.find((row) => row.id === "evidence-issuance-alpha").observedAt = "2026-09-01T11:31:00Z"; }, "invalid_evidence_chronology"],
  ["source record digest reused", (v) => { v.evidence[1].sourceRecordDigest = v.evidence[0].sourceRecordDigest; }, "duplicate_source_record_digest"],
  ["coverage omits rotate certificate", (v) => { v.coverage.rotateCertificateRefs.pop(); }, "invalid_coverage"],
  ["coverage omits blocker", (v) => { v.coverage.blockerRefs.pop(); }, "invalid_coverage"],
  ["coverage digest frozen replay", (v) => { v.blockers[0].detectedAt = "2026-09-02T11:00:00Z"; }, "invalid_coverage", false],
  ["destination coverage root drifts", (v) => { v.destinationApproval.coverageDigest = `sha256:${"1".repeat(64)}`; }, "invalid_destination", false],
  ["destination approver drifts", (v) => { v.destinationApproval.approvedByRef = "principal-handoff-recipient"; }, "invalid_destination"],
  ["destination approval predates covered evidence", (v) => { v.destinationApproval.approvedAt = "2026-09-01T09:00:00Z"; }, "invalid_destination"],
  ["handoff retains stale destination evidence provenance", (v) => { const row = v.evidence.find((item) => item.id === "evidence-destination"); row.sourceRecordDigest = `sha256:${"9".repeat(64)}`; row.recordDigest = computeEvidenceRecordDigest(row); }, "invalid_handoff", false],
  ["handoff destination root drifts", (v) => { v.handoff.destinationApprovalDigest = `sha256:${"2".repeat(64)}`; }, "invalid_handoff", false],
  ["handoff claims ready with blockers", (v) => { v.handoff.state = "ready-for-owner-review"; }, "invalid_handoff"],
  ["handoff omits an issuance", (v) => { v.handoff.issuanceRefs.pop(); }, "invalid_handoff"],
  ["future issuance evidence fails caller asOf", (v) => { v.issuances[0].decidedAt = "2026-09-06T09:00:00Z"; }, "future_record"],
];

for (const [name, change, expectedCode, reseal = true] of semanticCases) {
  test(`rejects ${name}`, () => {
    const value = mutate(change, reseal);
    assertHas(value, expectedCode);
  });
}

test("accepts a missing issuance represented by its exact blocker", () => {
  const value = clone();
  const issuance = value.issuances.find((row) => row.id === "issuance-charlie");
  value.issuances = value.issuances.filter((row) => row.id !== issuance.id);
  value.evidence = value.evidence.filter((row) => row.id !== issuance.evidenceRef);
  value.coverage.issuanceRefs = value.coverage.issuanceRefs.filter((ref) => ref !== issuance.id);
  value.handoff.issuanceRefs = value.handoff.issuanceRefs.filter((ref) => ref !== issuance.id);
  value.blockers.find((row) => row.id === "blocker-charlie-issuance").category = "issuance-missing";
  assert.deepEqual(findings(resealTlsCertificateRotationVerification(value)), []);
});

test("accepts a missing endpoint observation represented by its exact blocker", () => {
  const value = clone();
  const observation = value.endpointObservations.find((row) => row.id === "endpoint-golf");
  value.endpointObservations = value.endpointObservations.filter((row) => row.id !== observation.id);
  value.evidence = value.evidence.filter((row) => row.id !== observation.evidenceRef);
  value.coverage.endpointObservationRefs = value.coverage.endpointObservationRefs.filter(
    (ref) => ref !== observation.id,
  );
  value.handoff.endpointObservationRefs = value.handoff.endpointObservationRefs.filter(
    (ref) => ref !== observation.id,
  );
  value.blockers.find((row) => row.id === "blocker-golf-endpoint").category = "endpoint-missing";
  assert.deepEqual(findings(resealTlsCertificateRotationVerification(value)), []);
});

test("accepts simultaneous fingerprint and chain failures with two exact blockers", () => {
  const value = clone();
  const observation = value.endpointObservations.find((row) => row.id === "endpoint-golf");
  observation.outcome = "fingerprint-and-chain-failed";
  observation.checkCodes = ["hostname-match"];

  const blocker = clone(value.blockers.find((row) => row.id === "blocker-hotel-endpoint"));
  blocker.id = "blocker-golf-chain";
  blocker.certificateRef = "cert-golf";
  blocker.category = "endpoint-chain-failed";
  blocker.subjectRefs = ["cert-golf", "binding-golf"];
  blocker.evidenceRef = "evidence-blocker-golf-chain";
  value.blockers.push(blocker);

  const evidence = clone(
    value.evidence.find((row) => row.id === "evidence-blocker-hotel-endpoint"),
  );
  evidence.id = blocker.evidenceRef;
  evidence.subjectRefs = [blocker.id, ...blocker.subjectRefs];
  evidence.sourceRecordDigest = `sha256:${"7".repeat(64)}`;
  value.evidence.push(evidence);
  value.coverage.blockerRefs.push(blocker.id);
  value.handoff.blockerRefs.push(blocker.id);

  assert.deepEqual(findings(resealTlsCertificateRotationVerification(value)), []);
});

test("accepts an excluded certificate in the complete binding inventory", () => {
  const value = clone();
  const binding = clone(value.bindings[0]);
  binding.id = "binding-india";
  binding.certificateRef = "cert-india";
  binding.serviceRef = "service-already-current";
  binding.listenerRef = "listener-https-443-current";
  binding.endpointLocatorDigest = `sha256:${"6".repeat(64)}`;
  binding.sourceRecordDigest = `sha256:${"5".repeat(64)}`;
  value.bindings.push(binding);
  value.bindingExport.bindingRefs.push(binding.id);
  value.coverage.bindingRefs.push(binding.id);
  value.evidence
    .find((row) => row.id === value.bindingExport.evidenceRef)
    .subjectRefs.push(binding.id);

  assert.deepEqual(findings(resealTlsCertificateRotationVerification(value)), []);
});

const NOT_CLAIMED_FIELDS = [
  "privateKeyAccessClaim",
  "certificateBodyAccessClaim",
  "issuanceExecutionClaim",
  "deploymentExecutionClaim",
  "listenerRouteChangeClaim",
  "restartClaim",
  "revocationClaim",
  "disableClaim",
  "deletionClaim",
  "externalCommunicationClaim",
  "readinessClaim",
  "identityAssuranceClaim",
  "securityAssuranceClaim",
  "complianceClaim",
  "auditClaim",
  "rotationCompletionClaim",
];
for (const field of NOT_CLAIMED_FIELDS) {
  test(`requires structural not-claimed ${field}`, () => {
    const value = mutate((candidate) => {
      candidate.handoff[field] = "claimed";
    });
    assert.equal(validateSchema(value), false);
    assertHas(value, "invalid_handoff");
  });
}

test("accepts an overlap that expires just after caller asOf", () => {
  const value = mutate((candidate) => {
    candidate.overlaps[0].overlapUntil = "2026-09-05T00:00:01Z";
  });
  assert.deepEqual(findings(value), []);
});

test("source record digests cannot equal an internally derived root", () => {
  const value = mutate((candidate) => {
    candidate.evidence[0].sourceRecordDigest = candidate.round.planDigest;
  }, false);
  assertHas(value, "derived_source_record_digest");
});

test("semantic findings are deterministic for malformed schema-valid state", () => {
  const value = mutate((candidate) => {
    candidate.coverage.rotateCertificateRefs.pop();
    candidate.handoff.state = "ready-for-owner-review";
  });
  assert.deepEqual(findings(value), findings(clone(value)));
});

test("certificate, request, and issuance digests bind semantic content", () => {
  assert.equal(fixture.certificates[0].payloadDigest, computeCertificateDigest(fixture.certificates[0]));
  assert.equal(
    fixture.rotationRequests[0].payloadDigest,
    computeRotationRequestDigest(fixture.rotationRequests[0]),
  );
  assert.equal(fixture.issuances[0].payloadDigest, computeIssuanceDigest(fixture.issuances[0]));
  assert.equal(
    fixture.endpointObservations[0].payloadDigest,
    computeEndpointObservationDigest(fixture.endpointObservations[0]),
  );
});

test("every evidence record binds its source payload and external record root separately", () => {
  for (const row of fixture.evidence) {
    assert.equal(row.payloadDigest, computeEvidencePayloadDigest(row.kind, fixture, row.id));
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
    assert.notEqual(row.sourceRecordDigest, row.payloadDigest);
    assert.notEqual(row.sourceRecordDigest, row.recordDigest);
  }
});
