import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeHypothesisDispositionRevision,
  computeHypothesisRevision,
  computeKnownErrorRevision,
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
  json("../../../sources/case-continuity-coordinator/schemas/case-checkpoint.schema.json"),
  json("../../../sources/case-continuity-coordinator/fixtures/case-checkpoint.example.json"),
  json("../../../sources/incident-response/schemas/incident-state.schema.json"),
  json("../../../sources/incident-response/fixtures/incident-state.example.json"),
]);

const CUTOFF = "2026-09-16T20:00:00Z";
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCandidateSchema = ajv.compile(candidateSchema);
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
  assert.deepEqual(findings(accepted), []);
  assert.equal(accepted.incidentMemberships.length, 3);
  assert.equal(accepted.hypotheses.length, 2);
  assert.equal(accepted.tests.length, 2);
  assert.equal(accepted.workarounds.length, 1);
  assert.equal(accepted.knownErrors.length, 1);
  assert.equal(accepted.changeReceipts.length, 1);
  assert.equal(accepted.recurrences.length, 1);
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

  for (const field of ["records", "authorityGrants", "evidenceRecords"]) {
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
