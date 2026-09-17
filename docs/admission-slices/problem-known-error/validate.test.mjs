import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  canonicalJson,
  computeAuthorityGrantDigest,
  computeChangeReceiptRevision,
  computeHypothesisDispositionRevision,
  computeHypothesisRevision,
  computeIncidentManifestRevision,
  computeIncidentMembershipRevision,
  computeKnownErrorRevision,
  computeRecurrenceRevision,
  computeSourceAttestationDigest,
  computeTestRevision,
  computeWorkaroundRevision,
  problemKnownErrorFindings,
  resealProblemKnownErrorArtifact,
} from "./validate.mjs";

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const [
  accepted,
  publicTrustInput,
  revisionDrift,
  missingCoverage,
  candidateSchema,
  publicTrustSchema,
  caseSchema,
  caseFixture,
  incidentSchema,
  incidentFixture,
] = await Promise.all([
  json("./accepted.json"),
  json("./public-trust-input.json"),
  json("./revision-drift.json"),
  json("./missing-coverage.json"),
  json("./problem-known-error.schema.json"),
  json("./problem-known-error-public-trust.schema.json"),
  json("../../../sources/case-continuity-coordinator/schemas/case-checkpoint.schema.json"),
  json("../../../sources/case-continuity-coordinator/fixtures/case-checkpoint.example.json"),
  json("../../../sources/incident-response/schemas/incident-state.schema.json"),
  json("../../../sources/incident-response/fixtures/incident-state.example.json"),
]);

const CUTOFF = "2026-09-16T20:00:00Z";
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCandidateSchema = ajv.compile(candidateSchema);
const validatePublicTrustSchema = ajv.compile(publicTrustSchema);
const validateCaseSchema = ajv.compile(caseSchema);
const validateIncidentSchema = ajv.compile(incidentSchema);

function clone(value = accepted) {
  return structuredClone(value);
}

function findings(value, options = {}) {
  return problemKnownErrorFindings(value, {
    cutoff: CUTOFF,
    publicTrustInput,
    ...options,
  });
}

function codes(value, options) {
  return new Set(findings(value, options).map((row) => row.code));
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function refreshedTrust(value, input = publicTrustInput) {
  const trust = structuredClone(input);
  const principalById = new Map(value.principals.map((row) => [row.id, row]));
  for (const grant of trust.authorityGrants) {
    const principal = principalById.get(grant.principalRef);
    if (principal) {
      grant.principalRecordDigest = digest(principal);
      grant.scopes = [...principal.scopes].sort();
      grant.grantDigest = computeAuthorityGrantDigest(grant);
    }
  }
  trust.evidenceRecords = value.evidence.map((row) => ({
    evidenceRef: row.id,
    evidenceRecordDigest: digest(row),
  }));
  trust.sourceRecords = value.evidence.map((row) => {
    const source = {
      evidenceRef: row.id,
      sourceRef: row.sourceRef,
      sourceBytesDigest: row.recordDigest,
      observedAt: row.observedAt,
      issuerRef: trust.issuer.id,
    };
    return {
      ...source,
      attestationDigest: computeSourceAttestationDigest(source),
    };
  });
  trust.records = value.evidence
    .filter((row) => row.trust === "public")
    .map((row) => ({
      evidenceRef: row.id,
      sourceRef: row.sourceRef,
      recordDigest: row.recordDigest,
      publishedAt: row.observedAt,
    }));
  return trust;
}

function setPath(value, path, replacement) {
  const parts = path.split(".");
  const field = parts.pop();
  let parent = value;
  for (const part of parts) parent = parent[part];
  parent[field] = replacement;
}

test("accepted candidate is strict-schema valid and semantically clean", () => {
  assert.equal(
    validateCandidateSchema(accepted),
    true,
    ajv.errorsText(validateCandidateSchema.errors),
  );
  assert.equal(
    validatePublicTrustSchema(publicTrustInput),
    true,
    ajv.errorsText(validatePublicTrustSchema.errors),
  );
  assert.deepEqual(findings(accepted), []);
  assert.equal(accepted.evidence.length, 17);
  assert.equal(accepted.incidentMemberships.length, 3);
  assert.equal(accepted.incidentManifest.state, "owner-signed");
  assert.equal(accepted.hypotheses.length, 2);
  assert.equal(accepted.tests.length, 2);
  assert.equal(accepted.workarounds.length, 1);
  assert.equal(accepted.knownErrors.length, 1);
  assert.equal(accepted.changeReceipts.length, 1);
  assert.equal(accepted.recurrences.length, 1);
  assert.ok(
    Date.parse(accepted.changeReceipts[0].executedAt) >
      Date.parse(accepted.knownErrors[0].declaredAt),
  );
  assert.ok(
    Date.parse(accepted.recurrences[0].observedAt) >
      Date.parse(accepted.incidentMemberships[2].declaredAt),
  );
});

test("strict owner schemas do not directly carry the candidate lifecycle", () => {
  assert.equal(validateCaseSchema(caseFixture), true, ajv.errorsText(validateCaseSchema.errors));
  assert.equal(
    validateIncidentSchema(incidentFixture),
    true,
    ajv.errorsText(validateIncidentSchema.errors),
  );
  const overloadedCase = structuredClone(caseFixture);
  overloadedCase.problemRevision = accepted.problem.revision;
  overloadedCase.incidentMemberships = accepted.incidentMemberships;
  overloadedCase.hypotheses = accepted.hypotheses;
  overloadedCase.knownErrors = accepted.knownErrors;
  assert.equal(validateCaseSchema(overloadedCase), false);

  const overloadedIncident = structuredClone(incidentFixture);
  Object.assign(overloadedIncident.followUps[0], {
    problemRevision: accepted.problem.revision,
    incidentMemberships: accepted.incidentMemberships,
    hypotheses: accepted.hypotheses,
    tests: accepted.tests,
    workarounds: accepted.workarounds,
    knownErrors: accepted.knownErrors,
    changeReceipts: accepted.changeReceipts,
    recurrences: accepted.recurrences,
    coverage: accepted.coverage,
    authority: accepted.authority,
  });
  assert.equal(validateIncidentSchema(overloadedIncident), false);
});

test("incident membership is owner-declared and never inferred by the Claw", () => {
  const candidate = clone();
  candidate.incidentMemberships[0].declaredByRef =
    "principal-problem-coordinator-claw";
  assert.ok(codes(candidate).has("invalid_incident_membership_authority"));

  const premature = clone();
  premature.incidentMemberships[0].declaredAt = "2026-08-13T08:59:59Z";
  premature.evidence.find(
    (row) => row.id === premature.incidentMemberships[0].declarationEvidenceRef,
  ).observedAt = "2026-08-13T08:59:59Z";
  assert.ok(codes(premature).has("invalid_incident_membership_authority"));

  const prematureEvidenceBinding = clone();
  prematureEvidenceBinding.evidence.find(
    (row) =>
      row.id ===
      prematureEvidenceBinding.incidentMemberships[0].incidentRecordEvidenceRef,
  ).observedAt = "2026-08-13T09:01:01Z";
  assert.ok(
    codes(prematureEvidenceBinding).has(
      "invalid_incident_membership_authority",
    ),
  );

  for (const field of ["followUpRef", "followUpIdentityKey"]) {
    const duplicate = clone();
    duplicate.incidentMemberships[1][field] =
      duplicate.incidentMemberships[0][field];
    assert.ok(
      codes(duplicate).has("invalid_incident_membership_totality"),
      field,
    );
  }
});

test("the hypothesis matrix requires exact support and refutation evidence", () => {
  const candidate = clone();
  candidate.tests[1].outcome = "supports";
  assert.ok(codes(candidate).has("invalid_hypothesis_matrix"));
  assert.ok(codes(candidate).has("invalid_hypothesis_test_totality"));

  const driftedExecution = clone();
  driftedExecution.tests[0].buildId = "checkout-api@different-build";
  assert.ok(codes(driftedExecution).has("invalid_hypothesis_test"));

  const prematureDisposition = clone();
  prematureDisposition.hypotheses[0].revisedAt = "2026-08-14T10:59:59Z";
  prematureDisposition.evidence.find(
    (row) => row.id === "evidence-hypothesis-route-cache",
  ).observedAt = "2026-08-14T10:59:59Z";
  assert.ok(
    codes(resealProblemKnownErrorArtifact(prematureDisposition)).has(
      "invalid_hypothesis_matrix",
    ),
  );

  const changedEvidenceLineage = clone().hypotheses[0];
  changedEvidenceLineage.testRevisionRefs = [
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  ];
  assert.notEqual(
    computeHypothesisDispositionRevision(changedEvidenceLineage),
    accepted.hypotheses[0].dispositionRevision,
  );

  const preproposalTest = clone();
  preproposalTest.tests[0].executedAt = "2026-08-13T09:59:59Z";
  assert.ok(
    codes(resealProblemKnownErrorArtifact(preproposalTest)).has(
      "invalid_hypothesis_test",
    ),
  );

  const preproblemHypothesis = clone();
  preproblemHypothesis.hypotheses[0].proposedAt = "2026-08-13T08:59:59Z";
  assert.ok(
    codes(resealProblemKnownErrorArtifact(preproblemHypothesis)).has(
      "invalid_hypothesis_matrix",
    ),
  );
});

test("lifecycle digests bind exact revision and authority evidence lineage", () => {
  const driftedTest = clone().tests[0];
  driftedTest.hypothesisRevisionRef = accepted.hypotheses[1].revision;
  assert.notEqual(computeTestRevision(driftedTest), accepted.tests[0].revision);

  const driftedWorkaround = clone().workarounds[0];
  driftedWorkaround.hypothesisDispositionRevisionRef =
    accepted.hypotheses[1].dispositionRevision;
  assert.notEqual(
    computeWorkaroundRevision(driftedWorkaround),
    accepted.workarounds[0].revision,
  );

  const changedApprovalLineage = clone().workarounds[0];
  changedApprovalLineage.approvalEvidenceRef =
    "evidence-known-error-declaration";
  assert.notEqual(
    computeWorkaroundRevision(changedApprovalLineage),
    accepted.workarounds[0].revision,
  );

  const changedDeclarationLineage = clone().knownErrors[0];
  changedDeclarationLineage.declarationEvidenceRef =
    "evidence-workaround-approval";
  assert.notEqual(
    computeKnownErrorRevision(changedDeclarationLineage),
    accepted.knownErrors[0].revision,
  );

  const changedProposalTime = clone().hypotheses[0];
  changedProposalTime.proposedAt = "2026-08-13T10:00:00.001Z";
  assert.notEqual(
    computeHypothesisRevision(changedProposalTime),
    accepted.hypotheses[0].revision,
  );

  const changedDispositionTime = clone().hypotheses[0];
  changedDispositionTime.revisedAt = "2026-08-14T11:10:00.001Z";
  assert.notEqual(
    computeHypothesisDispositionRevision(changedDispositionTime),
    accepted.hypotheses[0].dispositionRevision,
  );

  const changedExecutionTime = clone().changeReceipts[0];
  changedExecutionTime.executedAt = "2026-08-17T10:00:00.001Z";
  assert.notEqual(
    computeChangeReceiptRevision(changedExecutionTime),
    accepted.changeReceipts[0].revision,
  );
});

test("problem revision drift invalidates the workaround and known-error lifecycle", () => {
  const candidate = clone();
  setPath(candidate, revisionDrift.mutation.path, revisionDrift.mutation.value);
  const actual = codes(candidate);
  for (const expected of revisionDrift.expectedFindingCodes) {
    assert.ok(actual.has(expected), `${expected} should be reported`);
  }
});

test("an active workaround requires unexpired external owner approval", () => {
  const expired = clone();
  expired.workarounds[0].expiresAt = CUTOFF;
  assert.ok(codes(expired).has("invalid_workaround_authority"));

  const selfApproved = clone();
  selfApproved.workarounds[0].approvedByRef =
    "principal-problem-coordinator-claw";
  assert.ok(codes(selfApproved).has("invalid_workaround_authority"));

  const premature = clone();
  premature.workarounds[0].approvedAt = "2026-08-13T09:30:00Z";
  premature.evidence.find(
    (row) => row.id === premature.workarounds[0].approvalEvidenceRef,
  ).observedAt = "2026-08-13T09:30:00Z";
  assert.ok(codes(premature).has("invalid_workaround_authority"));
});

test("the known error requires an owner-declared cause rather than Claw inference", () => {
  const candidate = clone();
  candidate.knownErrors[0].declaredByRef =
    "principal-problem-coordinator-claw";
  assert.ok(codes(candidate).has("invalid_known_error_authority"));

  const simultaneousDeclaration = clone();
  simultaneousDeclaration.knownErrors[0].declaredAt =
    simultaneousDeclaration.workarounds[0].approvedAt;
  simultaneousDeclaration.evidence.find(
    (row) => row.id === simultaneousDeclaration.knownErrors[0].declarationEvidenceRef,
  ).observedAt = simultaneousDeclaration.workarounds[0].approvedAt;
  assert.ok(
    codes(resealProblemKnownErrorArtifact(simultaneousDeclaration)).has(
      "invalid_known_error_authority",
    ),
  );
});

test("the change remains an owner-executed receipt", () => {
  const candidate = clone();
  candidate.changeReceipts[0].executedByRef =
    "principal-problem-coordinator-claw";
  assert.ok(codes(candidate).has("invalid_change_receipt"));

  const unlinked = clone();
  unlinked.changeReceipts[0].linkEvidenceRef = "evidence-change-execution";
  assert.ok(codes(unlinked).has("invalid_change_receipt"));

  const retargeted = clone();
  retargeted.changeReceipts[0].targetRefs = ["service-unrelated"];
  assert.ok(
    codes(resealProblemKnownErrorArtifact(retargeted)).has(
      "invalid_change_receipt",
    ),
  );

  const simultaneousVerification = clone();
  simultaneousVerification.evidence.find(
    (row) => row.id === "evidence-change-verification",
  ).observedAt = simultaneousVerification.changeReceipts[0].executedAt;
  assert.ok(codes(simultaneousVerification).has("invalid_change_receipt"));
});

test("semantic validation is total over malformed reference arrays", () => {
  for (const [field, mutate] of [
    [
      "observationEvidenceRefs",
      (candidate) => {
        candidate.hypotheses[0].observationEvidenceRefs = {};
      },
    ],
    [
      "verificationEvidenceRefs",
      (candidate) => {
        candidate.changeReceipts[0].verificationEvidenceRefs = {};
      },
    ],
  ]) {
    const candidate = clone();
    mutate(candidate);
    assert.doesNotThrow(() => findings(candidate), field);
    assert.ok(findings(candidate).length > 0, field);
  }

  for (const [field, mutate] of [
    [
      "observationEvidenceRefs",
      (candidate) => {
        candidate.hypotheses[0].observationEvidenceRefs = [];
      },
    ],
    [
      "verificationEvidenceRefs",
      (candidate) => {
        candidate.changeReceipts[0].verificationEvidenceRefs = [];
      },
    ],
    [
      "principal record",
      (candidate) => {
        candidate.principals.push(null);
      },
    ],
  ]) {
    const candidate = clone();
    mutate(candidate);
    assert.doesNotThrow(() => findings(candidate), field);
    assert.ok(findings(candidate).length > 0, field);
  }
});

test("recurrence must be observed after the owner-executed change", () => {
  const candidate = clone();
  candidate.recurrences[0].observedAt = "2026-08-01T18:19:59Z";
  assert.ok(codes(candidate).has("invalid_recurrence"));

  const changedMembership = clone();
  changedMembership.incidentMemberships[2].followUpIdentityKey =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const resealed = resealProblemKnownErrorArtifact(changedMembership);
  resealed.recurrences[0].incidentMembershipRevisionRef =
    accepted.incidentMemberships[2].revision;
  resealed.recurrences[0].revision = accepted.recurrences[0].revision;
  assert.ok(codes(resealed).has("invalid_recurrence"));

  const oldIncident = clone();
  oldIncident.recurrences[0].incidentMembershipRef = "membership-inc-001";
  assert.ok(
    codes(resealProblemKnownErrorArtifact(oldIncident)).has(
      "invalid_recurrence",
    ),
  );
});

test("public trust and cutoff stay caller-controlled", () => {
  assert.ok(
    codes(accepted, { publicTrustInput: undefined }).has(
      "invalid_validation_context",
    ),
  );
  const driftedTrust = structuredClone(publicTrustInput);
  driftedTrust.records[0].recordDigest =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.ok(
    codes(accepted, { publicTrustInput: driftedTrust }).has(
      "invalid_public_trust_input",
    ),
  );

  const inventedOwner = clone();
  inventedOwner.principals.find(
    (row) => row.id === "principal-workaround-owner",
  ).displayName = "Invented Owner";
  assert.ok(codes(inventedOwner).has("invalid_caller_trust_input"));

  const inventedControlledEvidence = clone();
  inventedControlledEvidence.evidence.find(
    (row) => row.id === "evidence-workaround-approval",
  ).recordDigest =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.ok(
    codes(inventedControlledEvidence).has("invalid_caller_trust_input"),
  );
  assert.ok(
    codes(accepted, { cutoff: "2026-08-14T00:00:00Z" }).has(
      "invalid_evidence",
    ),
  );
  assert.ok(
    codes(accepted, { cutoff: "2026-09-16T20:00:00" }).has(
      "invalid_validation_context",
    ),
  );
  assert.ok(
    codes(accepted, { cutoff: "2026-09-31T20:00:00Z" }).has(
      "invalid_validation_context",
    ),
  );

  const relabeled = clone();
  const publicObservation = relabeled.evidence.find(
    (row) => row.id === "evidence-public-status-inc-003",
  );
  publicObservation.trust = "controlled-owner";
  publicObservation.sourceRef = "controlled://status/inc-003";
  const ownerDeclaration = relabeled.evidence.find(
    (row) => row.id === "evidence-membership-inc-001",
  );
  ownerDeclaration.trust = "public";
  ownerDeclaration.sourceRef = "https://status.contoso.example/declarations/inc-001";
  relabeled.coverage.publicTrustEvidenceRefs = [ownerDeclaration.id];
  const relabeledTrust = {
    ...structuredClone(publicTrustInput),
    records: [
      {
        evidenceRef: ownerDeclaration.id,
        sourceRef: ownerDeclaration.sourceRef,
        recordDigest: ownerDeclaration.recordDigest,
        publishedAt: ownerDeclaration.observedAt,
      },
    ],
  };
  assert.ok(
    codes(relabeled, { publicTrustInput: relabeledTrust }).has("invalid_evidence"),
  );

  for (const field of [
    "records",
    "authorityGrants",
    "evidenceRecords",
    "sourceRecords",
  ]) {
    const malformedTrust = structuredClone(publicTrustInput);
    malformedTrust[field].push(null);
    assert.ok(
      codes(accepted, { publicTrustInput: malformedTrust }).has(
        "invalid_validation_context",
      ),
      field,
    );
  }
});

test("exact closed coverage rejects omissions", () => {
  const candidate = clone();
  const target = candidate.coverage[missingCoverage.mutation.path.split(".").at(-1)];
  target.pop();
  const actual = codes(candidate);
  for (const expected of missingCoverage.expectedFindingCodes) {
    assert.ok(actual.has(expected), `${expected} should be reported`);
  }

  const extra = clone();
  extra.evidence.push({
    ...structuredClone(extra.evidence[3]),
    id: "evidence-unreferenced",
    sourceRef: "controlled://incidents/unreferenced",
  });
  extra.coverage.evidenceRefs.push("evidence-unreferenced");
  assert.ok(codes(extra).has("invalid_coverage"));

  const uncoveredExtra = clone();
  uncoveredExtra.evidence.push({
    ...structuredClone(uncoveredExtra.evidence[3]),
    id: "evidence-uncovered-and-unreferenced",
    sourceRef: "controlled://incidents/uncovered-and-unreferenced",
  });
  assert.ok(codes(uncoveredExtra).has("invalid_coverage"));

  const extraPrincipal = clone();
  extraPrincipal.principals.push({
    id: "principal-unreferenced",
    kind: "named-human",
    displayName: "Unreferenced Person",
    scopes: ["test-executor"],
  });
  extraPrincipal.coverage.principalRefs.push("principal-unreferenced");
  assert.ok(codes(extraPrincipal).has("invalid_coverage"));
});

test("change linkage cannot postdate the caller cutoff", () => {
  const candidate = clone();
  candidate.changeReceipts[0].linkedAt = "2099-01-01T00:00:00Z";
  assert.ok(codes(candidate).has("invalid_change_receipt"));

  const predatesExecution = clone();
  predatesExecution.problem.declaredAt = "2026-07-01T00:00:00Z";
  predatesExecution.changeReceipts[0].linkedAt = "2026-08-01T18:19:59Z";
  predatesExecution.evidence.find(
    (row) => row.id === "evidence-problem-change-link",
  ).observedAt = "2026-08-01T18:19:59Z";
  assert.ok(
    codes(resealProblemKnownErrorArtifact(predatesExecution)).has(
      "invalid_change_receipt",
    ),
  );

  const simultaneousLink = clone();
  simultaneousLink.changeReceipts[0].linkedAt =
    simultaneousLink.changeReceipts[0].executedAt;
  simultaneousLink.evidence.find(
    (row) => row.id === "evidence-problem-change-link",
  ).observedAt = simultaneousLink.changeReceipts[0].executedAt;
  assert.ok(
    codes(resealProblemKnownErrorArtifact(simultaneousLink)).has(
      "invalid_change_receipt",
    ),
  );
});

test("authority claims remain structural non-claims", () => {
  for (const field of [
    "workaroundPublication",
    "workaroundExecution",
    "productionChange",
    "incidentClosure",
    "problemClosure",
    "ticketMutation",
    "riskAcceptance",
  ]) {
    const candidate = clone();
    candidate.authority[field] = "claimed";
    assert.ok(codes(candidate).has("prohibited_authority_claim"), field);
  }

  const narrativeClaim = clone();
  narrativeClaim.handoff.summary =
    "The Claw executed the production change and closed the problem.";
  assert.ok(codes(narrativeClaim).has("invalid_private_handoff"));

  const missingClosureAuthority = clone();
  missingClosureAuthority.principals.find(
    (row) => row.id === missingClosureAuthority.handoff.ownerRef,
  ).scopes = ["problem-owner", "incident-membership-declarer"];
  assert.ok(
    codes(missingClosureAuthority).has("invalid_private_handoff"),
  );

  const misroutedDecision = clone();
  misroutedDecision.handoff.nextDecision =
    "The problem owner decides whether to revise or publish the known error, renew the workaround, authorize another change, or close the problem.";
  assert.ok(codes(misroutedDecision).has("invalid_private_handoff"));
});

test("resealing computes digests without rewriting evidence or authority bindings", () => {
  assert.deepEqual(resealProblemKnownErrorArtifact(accepted), accepted);

  const candidate = clone();
  candidate.problem.title = "Legitimate revised checkout timeout scope";
  candidate.workarounds[0].instructions =
    "The service owner may use the revised route-cache runbook.";
  const evidenceBefore = structuredClone(candidate.evidence);
  const principalsBefore = structuredClone(candidate.principals);
  const coverageBefore = structuredClone(candidate.coverage);
  const membershipProblemRevision =
    candidate.incidentMemberships[0].problemRevision;
  const knownErrorWorkaroundRevision =
    candidate.knownErrors[0].workaroundRevisionRef;

  const resealed = resealProblemKnownErrorArtifact(candidate);
  assert.notEqual(resealed.problem.revision, accepted.problem.revision);
  assert.notEqual(
    resealed.workarounds[0].revision,
    accepted.workarounds[0].revision,
  );
  assert.equal(
    resealed.incidentMemberships[0].problemRevision,
    membershipProblemRevision,
  );
  assert.equal(
    resealed.knownErrors[0].workaroundRevisionRef,
    knownErrorWorkaroundRevision,
  );
  assert.deepEqual(resealed.evidence, evidenceBefore);
  assert.deepEqual(resealed.principals, principalsBefore);
  assert.deepEqual(resealed.coverage, coverageBefore);
  const actual = codes(resealed, {
    publicTrustInput: refreshedTrust(resealed),
  });
  assert.ok(actual.has("invalid_incident_membership_authority"));
  assert.ok(actual.has("invalid_known_error_revision_binding"));
});

test("owner-signed incident manifest seals coherent incident substitutions", () => {
  const candidate = clone();
  const membership = candidate.incidentMemberships[0];
  const source = candidate.evidence.find(
    (row) => row.id === membership.incidentRecordEvidenceRef,
  );
  const declaration = candidate.evidence.find(
    (row) => row.id === membership.declarationEvidenceRef,
  );
  membership.incidentRef = "incident-inc-009";
  membership.incidentRevision =
    "sha256:9999999999999999999999999999999999999999999999999999999999999999";
  membership.followUpRef = "follow-up-inc-009-timeout";
  membership.followUpIdentityKey =
    "sha256:9292929292929292929292929292929292929292929292929292929292929292";
  source.subjectRef = membership.incidentRef;
  source.subjectRevision = membership.incidentRevision;
  source.recordDigest =
    "sha256:9191919191919191919191919191919191919191919191919191919191919191";
  membership.revision = computeIncidentMembershipRevision(membership);
  declaration.subjectRevision = membership.revision;

  const actual = codes(candidate, {
    publicTrustInput: refreshedTrust(candidate),
  });
  assert.equal(actual.has("invalid_incident_membership_authority"), false);
  assert.ok(actual.has("invalid_incident_manifest"));

  const selfSigned = clone();
  selfSigned.incidentManifest.signedByRef =
    "principal-problem-coordinator-claw";
  selfSigned.incidentManifest.revision =
    computeIncidentManifestRevision(selfSigned.incidentManifest);
  assert.ok(codes(selfSigned).has("invalid_incident_manifest"));
});

test("caller trust uses unique issuer-scoped time-bounded grants and source bytes", () => {
  for (const mutate of [
    (trust) => {
      trust.authorityGrants[0].issuerRef = "issuer-untrusted";
      trust.authorityGrants[0].grantDigest = computeAuthorityGrantDigest(
        trust.authorityGrants[0],
      );
    },
    (trust) => {
      trust.authorityGrants[0].scopes = ["problem-owner"];
      trust.authorityGrants[0].grantDigest = computeAuthorityGrantDigest(
        trust.authorityGrants[0],
      );
    },
    (trust) => {
      trust.authorityGrants[0].expiresAt = CUTOFF;
      trust.authorityGrants[0].grantDigest = computeAuthorityGrantDigest(
        trust.authorityGrants[0],
      );
    },
    (trust) => {
      const grant = trust.authorityGrants.find(
        (row) => row.principalRef === "principal-investigator",
      );
      grant.validFrom = "2026-08-13T12:00:00Z";
      grant.grantDigest = computeAuthorityGrantDigest(grant);
    },
    (trust) => {
      trust.authorityGrants.push(structuredClone(trust.authorityGrants[0]));
    },
    (trust) => {
      trust.evidenceRecords.push(structuredClone(trust.evidenceRecords[0]));
    },
    (trust) => {
      trust.sourceRecords.push(structuredClone(trust.sourceRecords[0]));
    },
    (trust) => {
      trust.sourceRecords[0].sourceBytesDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      trust.sourceRecords[0].attestationDigest =
        computeSourceAttestationDigest(trust.sourceRecords[0]);
    },
  ]) {
    const trust = structuredClone(publicTrustInput);
    mutate(trust);
    assert.ok(
      codes(accepted, { publicTrustInput: trust }).has(
        "invalid_caller_trust_input",
      ),
    );
  }
});

test("agent and package identities cannot exercise human authority", () => {
  for (const displayName of [
    "Problem Owner Agent",
    "Problem Owner Package",
    "OwnerBot",
    "Chatbot",
    "Workflow System",
    "Automated Service Account",
  ]) {
    const candidate = clone();
    candidate.principals.find(
      (row) => row.id === "principal-problem-owner",
    ).displayName = displayName;
    assert.ok(
      codes(candidate, {
        publicTrustInput: refreshedTrust(candidate),
      }).has("invalid_typed_authority"),
      displayName,
    );
  }

  const agentId = clone();
  agentId.principals.find(
    (row) => row.id === "principal-problem-owner",
  ).id = "principal-agent-runner";
  assert.ok(
    codes(agentId, {
      publicTrustInput: refreshedTrust(agentId),
    }).has("invalid_typed_authority"),
  );

  for (const displayName of [
    "Alice Abbott",
    "Assistant Director Alice",
  ]) {
    const candidate = clone();
    candidate.principals.find(
      (row) => row.id === "principal-problem-owner",
    ).displayName = displayName;
    assert.equal(
      codes(candidate, {
        publicTrustInput: refreshedTrust(candidate),
      }).has("invalid_typed_authority"),
      false,
      displayName,
    );
  }
});

test("prohibited narrative claims are detected without rejecting negation", () => {
  for (const mutate of [
    (candidate) => {
      candidate.problem.title =
        "The Claw declared the root cause for checkout failures.";
    },
    (candidate) => {
      candidate.hypotheses[0].statement =
        "The coordinator correlated the incidents.";
    },
    (candidate) => {
      candidate.workarounds[0].instructions =
        "The agent approved the workaround.";
    },
    (candidate) => {
      candidate.handoff.summary =
        "The assistant executed the production change.";
    },
  ]) {
    const candidate = clone();
    mutate(candidate);
    assert.ok(codes(candidate).has("prohibited_authority_claim"));
  }

  const negated = clone();
  negated.problem.title =
    "The Claw did not execute the production change.";
  assert.equal(codes(negated).has("prohibited_authority_claim"), false);

  const mixed = clone();
  mixed.problem.title =
    "The Claw did not publish the workaround but executed the production change.";
  assert.ok(codes(mixed).has("prohibited_authority_claim"));

  const authorized = clone();
  authorized.problem.title =
    "The Claw authorized the production change.";
  assert.ok(codes(authorized).has("prohibited_authority_claim"));

  const passive = clone();
  passive.problem.title =
    "The production change was executed by the Claw.";
  assert.ok(codes(passive).has("prohibited_authority_claim"));

  const deployed = clone();
  deployed.problem.title =
    "The Claw deployed the production change.";
  assert.ok(codes(deployed).has("prohibited_authority_claim"));

  const nominal = clone();
  nominal.problem.title =
    "The Claw's approval of this workaround is authoritative.";
  assert.ok(codes(nominal).has("prohibited_authority_claim"));

  const packageActor = clone();
  packageActor.problem.title =
    "The package approved the workaround.";
  assert.ok(codes(packageActor).has("prohibited_authority_claim"));

  const knownErrorClaim = clone();
  knownErrorClaim.problem.title =
    "The Claw declared the known error.";
  assert.ok(codes(knownErrorClaim).has("prohibited_authority_claim"));

  const systemActor = clone();
  systemActor.problem.title =
    "This system approves production changes.";
  assert.ok(codes(systemActor).has("prohibited_authority_claim"));

  const unrelatedNegation = clone();
  unrelatedNegation.problem.title =
    "The Claw cannot wait and executed the production change.";
  assert.ok(codes(unrelatedNegation).has("prohibited_authority_claim"));

  const delayed = clone();
  delayed.problem.title =
    "The Claw cannot delay before it executes the production change.";
  assert.ok(codes(delayed).has("prohibited_authority_claim"));

  const indirectNegation = clone();
  indirectNegation.problem.title =
    "The Claw did not wait to execute the production change.";
  assert.ok(codes(indirectNegation).has("prohibited_authority_claim"));

  const longClaim = clone();
  longClaim.problem.title =
    "The Claw approved after detailed external owner review the workaround.";
  assert.ok(codes(longClaim).has("prohibited_authority_claim"));

  const ownerAttributed = clone();
  ownerAttributed.problem.title =
    "The Claw compiled evidence, and the problem owner approved the workaround.";
  assert.equal(
    codes(ownerAttributed).has("prohibited_authority_claim"),
    false,
  );

  const namedHuman = clone();
  namedHuman.problem.title =
    "The Claw compiled evidence. Alice Abbott approved the workaround.";
  assert.equal(
    codes(namedHuman).has("prohibited_authority_claim"),
    false,
  );

  const negatedNominal = clone();
  negatedNominal.problem.title =
    "The Claw has no approval of the workaround.";
  assert.equal(
    codes(negatedNominal).has("prohibited_authority_claim"),
    false,
  );

  const coordinatedNegation = clone();
  coordinatedNegation.problem.title =
    "The Claw did not approve or execute the production change.";
  assert.equal(
    codes(coordinatedNegation).has("prohibited_authority_claim"),
    false,
  );

  const pronounCarry = clone();
  pronounCarry.problem.title =
    "The Claw compiled evidence. It executed the production change.";
  assert.ok(codes(pronounCarry).has("prohibited_authority_claim")  );

  const singleName = clone();
  singleName.problem.title =
    "The Claw compiled evidence. Alice approved the workaround.";
  assert.equal(
    codes(singleName).has("prohibited_authority_claim"),
    false,
  );
});

test("fresh lifecycle events strictly follow the revisions they consume", () => {
  const simultaneousApproval = clone();
  const workaround = simultaneousApproval.workarounds[0];
  const hypothesis = simultaneousApproval.hypotheses.find(
    (row) => row.id === workaround.hypothesisRef,
  );
  workaround.approvedAt = hypothesis.revisedAt;
  const approval = simultaneousApproval.evidence.find(
    (row) => row.id === workaround.approvalEvidenceRef,
  );
  approval.observedAt = workaround.approvedAt;
  workaround.revision = computeWorkaroundRevision(workaround);
  approval.subjectRevision = workaround.revision;
  assert.ok(
    codes(simultaneousApproval, {
      publicTrustInput: refreshedTrust(simultaneousApproval),
    }).has("invalid_workaround_authority"),
  );

  const staleExecution = clone();
  const change = staleExecution.changeReceipts[0];
  change.executedAt = staleExecution.knownErrors[0].declaredAt;
  change.linkedAt = "2026-08-16T15:00:00.002Z";
  staleExecution.evidence.find(
    (row) => row.id === change.executionReceiptRef,
  ).observedAt = change.executedAt;
  staleExecution.evidence.find(
    (row) => row.id === change.verificationEvidenceRefs[0],
  ).observedAt = "2026-08-16T15:00:00.001Z";
  const linkEvidence = staleExecution.evidence.find(
    (row) => row.id === change.linkEvidenceRef,
  );
  linkEvidence.observedAt = change.linkedAt;
  change.revision = computeChangeReceiptRevision(change);
  linkEvidence.subjectRevision = change.revision;
  assert.ok(
    codes(staleExecution, {
      publicTrustInput: refreshedTrust(staleExecution),
    }).has("invalid_change_receipt"),
  );

  const fractionalRecurrence = clone();
  const recurrenceMembership = fractionalRecurrence.incidentMemberships[2];
  recurrenceMembership.declaredAt = "2026-08-18T14:32:00.002Z";
  fractionalRecurrence.evidence.find(
    (row) => row.id === recurrenceMembership.declarationEvidenceRef,
  ).observedAt = recurrenceMembership.declaredAt;
  fractionalRecurrence.recurrences[0].observedAt =
    "2026-08-18T14:32:00.001Z";
  fractionalRecurrence.evidence.find(
    (row) => row.id === fractionalRecurrence.recurrences[0].evidenceRef,
  ).observedAt = fractionalRecurrence.recurrences[0].observedAt;
  assert.ok(
    codes(fractionalRecurrence, {
      publicTrustInput: refreshedTrust(fractionalRecurrence),
    }).has("invalid_recurrence"),
  );

  assert.ok(
    codes(accepted, { cutoff: "2026-09-16T20:00:00.0001Z" }).has(
      "invalid_validation_context",
    ),
  );

  const recurrenceBeforeFinalization = clone();
  const laterChange = recurrenceBeforeFinalization.changeReceipts[0];
  laterChange.linkedAt = "2026-08-19T10:10:00Z";
  const laterLink = recurrenceBeforeFinalization.evidence.find(
    (row) => row.id === laterChange.linkEvidenceRef,
  );
  laterLink.observedAt = laterChange.linkedAt;
  recurrenceBeforeFinalization.evidence.find(
    (row) => row.id === laterChange.verificationEvidenceRefs[0],
  ).observedAt = "2026-08-19T10:05:00Z";
  laterChange.revision = computeChangeReceiptRevision(laterChange);
  laterLink.subjectRevision = laterChange.revision;
  const recurrence = recurrenceBeforeFinalization.recurrences[0];
  recurrence.changeReceiptRevisionRef = laterChange.revision;
  recurrence.revision = computeRecurrenceRevision(recurrence);
  recurrenceBeforeFinalization.evidence.find(
    (row) => row.id === recurrence.evidenceRef,
  ).subjectRevision = recurrence.revision;
  assert.ok(
    codes(recurrenceBeforeFinalization, {
      publicTrustInput: refreshedTrust(recurrenceBeforeFinalization),
    }).has("invalid_recurrence"),
  );
});

test("schema-first validation is total and resource bounded", () => {
  const schemaInvalid = clone();
  delete schemaInvalid.problem.title;
  assert.ok(codes(schemaInvalid).has("invalid_schema"));

  const oversizedString = clone();
  oversizedString.problem.title = "x".repeat(4097);
  assert.ok(codes(oversizedString).has("invalid_string_length"));

  const oversizedCollection = clone();
  oversizedCollection.principals = Array.from(
    { length: 257 },
    (_, index) => ({
      id: `principal-extra-${index}`,
      kind: "named-human",
      displayName: `Person ${index}`,
      scopes: ["test-executor"],
    }),
  );
  assert.ok(codes(oversizedCollection).has("invalid_collection_size"));

  const enormousSparseCollection = clone();
  enormousSparseCollection.principals = new Array(1_000_000);
  assert.ok(
    codes(enormousSparseCollection).has("invalid_collection_size"),
  );

  const oversizedObject = clone();
  oversizedObject.extra = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [`field${index}`, index]),
  );
  assert.ok(codes(oversizedObject).has("invalid_cardinality"));

  const oversizedBytes = clone();
  oversizedBytes.extra = Array.from(
    { length: 65 },
    (_, index) => `${index}:${"x".repeat(4090)}`,
  );
  assert.ok(codes(oversizedBytes).has("invalid_byte_size"));

  const tooDeep = clone();
  let cursor = (tooDeep.extra = {});
  for (let depth = 0; depth < 18; depth += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.ok(codes(tooDeep).has("invalid_depth"));

  const bigintArtifact = clone();
  bigintArtifact.extra = 1n;
  assert.doesNotThrow(() => findings(bigintArtifact));
  assert.ok(codes(bigintArtifact).has("invalid_structure"));

  const bigintTrust = structuredClone(publicTrustInput);
  bigintTrust.extra = 1n;
  assert.doesNotThrow(() =>
    findings(accepted, { publicTrustInput: bigintTrust }),
  );
  assert.ok(
    codes(accepted, { publicTrustInput: bigintTrust }).has(
      "invalid_structure",
    ),
  );

  const sharedStructure = clone();
  sharedStructure.changeReceipts[0].targetRefs =
    sharedStructure.problem.serviceRefs;
  assert.equal(codes(sharedStructure).has("invalid_structure"), false);
});
