import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  deriveIncidentArtifact,
  digest as computeOwnerArtifactDigest,
} from "./composition-adapter.mjs";

import {
  canonicalJson,
  computeAuthorityGrantDigest,
  computeChangeReceiptRevision,
  computeEvidenceClaimDigest,
  computeHypothesisDispositionRevision,
  computeHypothesisRevision,
  computeIncidentManifestRevision,
  computeIncidentMembershipRevision,
  computeIdentityCredentialDigest,
  computeKnownErrorRevision,
  computeOwnerReceiptDigest,
  computeProblemRevision,
  computeProseAttestationRevision,
  computeProseSurfaceDigest,
  computeRecurrenceRevision,
  computeSourceAttestationDigest,
  computeTestRevision,
  computeWorkaroundRevision,
  isVerifiedHumanPrincipal,
  problemKnownErrorFindings,
  resealProblemKnownErrorArtifact,
  signedCollectionPayload,
} from "./validate.mjs";

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const [
  accepted,
  publicTrustInput,
  trustKeyring,
  revisionDrift,
  missingCoverage,
  candidateSchema,
  publicTrustSchema,
  trustKeyringSchema,
  caseSchema,
  caseFixture,
  incidentSchema,
  incidentFixture,
] = await Promise.all([
  json("./accepted.json"),
  json("./public-trust-input.json"),
  json("./trust-keyring.json"),
  json("./revision-drift.json"),
  json("./missing-coverage.json"),
  json("./problem-known-error.schema.json"),
  json("./problem-known-error-public-trust.schema.json"),
  json("./problem-known-error-trust-keyring.schema.json"),
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
const validateTrustKeyringSchema = ajv.compile(trustKeyringSchema);
const validateCaseSchema = ajv.compile(caseSchema);
const validateIncidentSchema = ajv.compile(incidentSchema);

function clone(value = accepted) {
  return structuredClone(value);
}

function findings(value, options = {}) {
  return problemKnownErrorFindings(value, {
    cutoff: CUTOFF,
    publicTrustInput,
    trustKeyring,
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
  for (const credential of trust.identityCredentials) {
    const principal = principalById.get(credential.principalRef);
    if (principal) {
      credential.principalRecordDigest = digest(principal);
      credential.credentialDigest =
        computeIdentityCredentialDigest(credential);
    }
  }
  trust.evidenceRecords = value.evidence.map((row) => {
    const claim = {
      evidenceRef: row.id,
      evidenceRecordDigest: digest(row),
      issuerRef: trust.issuer.id,
    };
    return {
      ...claim,
      claimDigest: computeEvidenceClaimDigest(claim),
    };
  });
  trust.sourceRecords = value.evidence.map((row) => {
    const source = {
      evidenceRef: row.id,
      sourceRef: row.sourceRef,
      sourceBytesDigest: row.recordDigest,
      evidenceRecordDigest: digest(row),
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

function coherentlyReseal(value) {
  const artifact = structuredClone(value);
  const updateEvidence = (kind, subjectRef, subjectRevision) => {
    for (const row of artifact.evidence) {
      if (row.kind === kind && row.subjectRef === subjectRef) {
        row.subjectRevision = subjectRevision;
      }
    }
  };

  artifact.problem.revision = computeProblemRevision(artifact.problem);
  updateEvidence(
    "problem-revision-declaration",
    artifact.problem.id,
    artifact.problem.revision,
  );
  for (const membership of artifact.incidentMemberships) {
    membership.problemRevision = artifact.problem.revision;
    membership.revision = computeIncidentMembershipRevision(membership);
    updateEvidence(
      "incident-membership-declaration",
      membership.id,
      membership.revision,
    );
  }
  artifact.incidentManifest.problemRevision = artifact.problem.revision;
  artifact.incidentManifest.membershipRevisionRefs =
    artifact.incidentMemberships.map((row) => row.revision).sort();
  artifact.incidentManifest.revision = computeIncidentManifestRevision(
    artifact.incidentManifest,
  );
  updateEvidence(
    "incident-membership-manifest-signature",
    artifact.incidentManifest.id,
    artifact.incidentManifest.revision,
  );
  for (const hypothesis of artifact.hypotheses) {
    hypothesis.problemRevision = artifact.problem.revision;
    hypothesis.revision = computeHypothesisRevision(hypothesis);
  }
  for (const candidateTest of artifact.tests) {
    const hypothesis = artifact.hypotheses.find(
      (row) => row.id === candidateTest.hypothesisRef,
    );
    candidateTest.problemRevision = artifact.problem.revision;
    candidateTest.hypothesisRevisionRef = hypothesis.revision;
    candidateTest.revision = computeTestRevision(candidateTest);
    updateEvidence("test-result", candidateTest.id, candidateTest.revision);
  }
  for (const hypothesis of artifact.hypotheses) {
    hypothesis.testRevisionRefs = hypothesis.testRefs
      .map(
        (testRef) =>
          artifact.tests.find((row) => row.id === testRef).revision,
      )
      .sort();
    hypothesis.dispositionRevision =
      computeHypothesisDispositionRevision(hypothesis);
    updateEvidence(
      "hypothesis-observation",
      hypothesis.id,
      hypothesis.dispositionRevision,
    );
  }
  for (const workaround of artifact.workarounds) {
    const hypothesis = artifact.hypotheses.find(
      (row) => row.id === workaround.hypothesisRef,
    );
    workaround.problemRevision = artifact.problem.revision;
    workaround.hypothesisDispositionRevisionRef =
      hypothesis.dispositionRevision;
    workaround.revision = computeWorkaroundRevision(workaround);
    updateEvidence(
      "workaround-approval",
      workaround.id,
      workaround.revision,
    );
  }
  for (const knownError of artifact.knownErrors) {
    const hypothesis = artifact.hypotheses.find(
      (row) => row.id === knownError.causeHypothesisRef,
    );
    const workaround = artifact.workarounds.find(
      (row) => row.id === knownError.workaroundRef,
    );
    knownError.problemRevision = artifact.problem.revision;
    knownError.causeHypothesisDispositionRevisionRef =
      hypothesis.dispositionRevision;
    knownError.workaroundRevisionRef = workaround.revision;
    knownError.revision = computeKnownErrorRevision(knownError);
    updateEvidence(
      "known-error-declaration",
      knownError.id,
      knownError.revision,
    );
  }
  for (const change of artifact.changeReceipts) {
    change.problemRevision = artifact.problem.revision;
    change.revision = computeChangeReceiptRevision(change);
    updateEvidence(
      "change-execution-receipt",
      change.id,
      change.planDigest,
    );
    updateEvidence("change-verification", change.id, change.planDigest);
    updateEvidence("problem-change-link", change.id, change.revision);
  }
  for (const recurrence of artifact.recurrences) {
    const membership = artifact.incidentMemberships.find(
      (row) => row.id === recurrence.incidentMembershipRef,
    );
    const change = artifact.changeReceipts.find(
      (row) => row.id === recurrence.changeReceiptRef,
    );
    recurrence.problemRevision = artifact.problem.revision;
    recurrence.incidentMembershipRevisionRef = membership.revision;
    recurrence.changeReceiptRevisionRef = change.revision;
    recurrence.revision = computeRecurrenceRevision(recurrence);
    updateEvidence(
      "recurrence-observation",
      recurrence.id,
      recurrence.revision,
    );
  }
  artifact.proseAttestation.surfaceDigest =
    computeProseSurfaceDigest(artifact);
  artifact.proseAttestation.revision =
    computeProseAttestationRevision(artifact.proseAttestation);
  updateEvidence(
    "owner-prose-receipt",
    artifact.proseAttestation.id,
    artifact.proseAttestation.revision,
  );
  artifact.coverage.principalRefs = artifact.principals
    .map((row) => row.id)
    .sort();
  artifact.coverage.evidenceRefs = artifact.evidence
    .map((row) => row.id)
    .sort();
  artifact.coverage.incidentMembershipRefs =
    artifact.incidentMemberships.map((row) => row.id).sort();
  artifact.coverage.incidentManifestRevisionRef =
    artifact.incidentManifest.revision;
  artifact.coverage.hypothesisRevisionRefs = artifact.hypotheses
    .map((row) => row.revision)
    .sort();
  artifact.coverage.hypothesisDispositionRevisionRefs =
    artifact.hypotheses.map((row) => row.dispositionRevision).sort();
  artifact.coverage.testRefs = artifact.tests.map((row) => row.id).sort();
  artifact.coverage.workaroundRevisionRefs = artifact.workarounds
    .map((row) => row.revision)
    .sort();
  artifact.coverage.knownErrorRevisionRefs = artifact.knownErrors
    .map((row) => row.revision)
    .sort();
  artifact.coverage.changeReceiptRefs = artifact.changeReceipts
    .map((row) => row.id)
    .sort();
  artifact.coverage.recurrenceRefs = artifact.recurrences
    .map((row) => row.id)
    .sort();
  artifact.coverage.proseAttestationRevisionRef =
    artifact.proseAttestation.revision;
  return artifact;
}

function fullySignedTrust(value, options = {}) {
  const issuerRef = "issuer-test-chronology";
  const issuerKeys = generateKeyPairSync("ed25519");
  const issuerKey = {
    id: "key-test-chronology-issuer",
    kind: "issuer",
    principalRef: null,
    issuerRef,
    keyRef: "https://awesome-claws.example/keys/test-chronology/issuer",
    algorithm: "ed25519",
    publicKeyPem: issuerKeys.publicKey.export({
      type: "spki",
      format: "pem",
    }),
  };
  const principalKeys = new Map();
  const keyRows = value.principals
    .filter((principal) => principal.kind !== "claw")
    .map((principal) => {
      const keys = generateKeyPairSync("ed25519");
      const id = `key-test-${principal.id}`;
      principalKeys.set(principal.id, { id, privateKey: keys.privateKey });
      return {
        id,
        kind: "principal",
        principalRef: principal.id,
        issuerRef,
        keyRef: `https://awesome-claws.example/keys/test-chronology/${principal.id}`,
        algorithm: "ed25519",
        publicKeyPem: keys.publicKey.export({
          type: "spki",
          format: "pem",
        }),
      };
    });
  const trustKeyring = {
    schemaVersion: "awesomeClaws.problemKnownErrorTrustKeyring.v1",
    allowedIssuerRefs: [issuerRef],
    keys: [issuerKey, ...keyRows],
  };
  const issuer = {
    id: issuerRef,
    displayName: "Chronology test trust issuer",
    keyRef: issuerKey.keyRef,
    keyId: issuerKey.id,
    algorithm: "ed25519",
  };
  const validity = {
    validFrom: "2026-01-01T00:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
  };
  const identityCredentials = value.principals
    .filter((principal) => principal.kind === "named-human")
    .map((principal) => {
      const credential = {
        id: principal.identityCredentialRef,
        principalRef: principal.id,
        principalRecordDigest: digest(principal),
        assurance: "verified-human",
        subjectKeyId: principalKeys.get(principal.id).id,
        issuerRef,
        ...validity,
      };
      return {
        ...credential,
        credentialDigest: computeIdentityCredentialDigest(credential),
      };
    });
  const authorityGrants = value.principals
    .filter((principal) => principal.kind !== "claw")
    .map((principal) => {
      const grant = {
        principalRef: principal.id,
        principalRecordDigest: digest(principal),
        issuerRef,
        scopes: [...principal.scopes].sort(),
        ...validity,
      };
      return {
        ...grant,
        grantDigest: computeAuthorityGrantDigest(grant),
      };
    });
  const evidenceRecords = value.evidence.map((evidence) => {
    const claim = {
      evidenceRef: evidence.id,
      evidenceRecordDigest: digest(evidence),
      issuerRef,
    };
    return { ...claim, claimDigest: computeEvidenceClaimDigest(claim) };
  });
  const sourceRecords = value.evidence.map((evidence) => {
    const source = {
      evidenceRef: evidence.id,
      sourceRef: evidence.sourceRef,
      sourceBytesDigest: evidence.recordDigest,
      evidenceRecordDigest: digest(evidence),
      observedAt: evidence.observedAt,
      issuerRef,
    };
    return {
      ...source,
      attestationDigest: computeSourceAttestationDigest(source),
    };
  });
  const evidenceById = new Map(value.evidence.map((row) => [row.id, row]));
  const receiptSpecs = [
    {
      evidenceRef: value.problem.declarationEvidenceRef,
      ownerRef: value.problem.declaredByRef,
      refs: [
        value.problem.revision,
        value.problem.predecessorArtifactDigest,
        value.problem.predecessorRevisionRef,
      ],
      consumedAt: value.problem.declaredAt,
    },
    ...value.incidentMemberships.map((row) => ({
      evidenceRef: row.declarationEvidenceRef,
      ownerRef: row.declaredByRef,
      refs: [row.revision],
      consumedAt: row.declaredAt,
    })),
    {
      evidenceRef: value.incidentManifest.signatureEvidenceRef,
      ownerRef: value.incidentManifest.signedByRef,
      refs: [value.incidentManifest.revision],
      consumedAt: value.incidentManifest.signedAt,
    },
    ...value.hypotheses.flatMap((row) =>
      row.observationEvidenceRefs.map((evidenceRef) => ({
        evidenceRef,
        ownerRef: row.ownerRef,
        refs: [row.dispositionRevision],
        consumedAt: row.revisedAt,
      })),
    ),
    ...value.tests.map((row) => ({
      evidenceRef: row.evidenceRef,
      ownerRef: row.executedByRef,
      refs: [row.revision],
      consumedAt: row.executedAt,
    })),
    ...value.workarounds.map((row) => ({
      evidenceRef: row.approvalEvidenceRef,
      ownerRef: row.approvedByRef,
      refs: [row.revision],
      consumedAt: row.approvedAt,
    })),
    ...value.knownErrors.map((row) => ({
      evidenceRef: row.declarationEvidenceRef,
      ownerRef: row.declaredByRef,
      refs: [row.revision],
      consumedAt: row.declaredAt,
    })),
    ...value.changeReceipts.flatMap((row) => [
      {
        evidenceRef: row.executionReceiptRef,
        ownerRef: row.executedByRef,
        refs: [row.planDigest, row.ownerArtifactDigest],
        consumedAt: row.executedAt,
      },
      {
        evidenceRef: row.linkEvidenceRef,
        ownerRef: value.problem.declaredByRef,
        refs: [row.revision],
        consumedAt: row.linkedAt,
      },
      ...row.verificationEvidenceRefs.map((evidenceRef) => ({
        evidenceRef,
        ownerRef: evidenceById.get(evidenceRef).producedByRef,
        refs: [row.planDigest, row.ownerArtifactDigest],
        consumedAt: evidenceById.get(evidenceRef).observedAt,
      })),
    ]),
    ...value.recurrences.map((row) => ({
      evidenceRef: row.evidenceRef,
      ownerRef: row.observedByRef,
      refs: [row.revision],
      consumedAt: row.observedAt,
    })),
    {
      evidenceRef: value.proseAttestation.receiptEvidenceRef,
      ownerRef: value.proseAttestation.ownerRef,
      refs: [value.proseAttestation.revision],
      consumedAt: value.proseAttestation.signedAt,
    },
  ];
  const ownerReceipts = receiptSpecs.map((spec, index) => {
    const evidence = evidenceById.get(spec.evidenceRef);
    const signer = principalKeys.get(spec.ownerRef);
    const latest = Math.max(
      Date.parse(spec.consumedAt),
      Date.parse(evidence.observedAt),
    );
    const receipt = {
      id: `owner-receipt-test-${String(index + 1).padStart(2, "0")}`,
      evidenceRef: spec.evidenceRef,
      evidenceRecordDigest: digest(evidence),
      ownerRef: spec.ownerRef,
      consumedRevisionRefs: [...spec.refs].sort(),
      issuedAt:
        options.equalReceiptEvidenceRef === spec.evidenceRef
          ? evidence.observedAt
          : new Date(latest + 1_000).toISOString().replace(".000Z", "Z"),
      issuerRef,
      signerKeyId: signer.id,
    };
    receipt.receiptDigest = computeOwnerReceiptDigest(receipt);
    receipt.signature = sign(
      null,
      Buffer.from(
        canonicalJson({
          kind: "ownerReceipt",
          digest: receipt.receiptDigest,
        }),
        "utf8",
      ),
      signer.privateKey,
    ).toString("base64");
    return receipt;
  });
  const collections = {
    identityCredentials,
    authorityGrants,
    evidenceRecords,
    sourceRecords,
    ownerReceipts,
  };
  const signatures = Object.fromEntries(
    Object.entries(collections).map(([kind, rows]) => [
      kind,
      sign(
        null,
        signedCollectionPayload(kind, rows),
        issuerKeys.privateKey,
      ).toString("base64"),
    ]),
  );
  const publicEvidence = value.evidence.find((row) => row.trust === "public");
  return {
    publicTrustInput: {
      schemaVersion: "awesomeClaws.problemKnownErrorPublicTrust.v1",
      id: "public-trust-chronology-test",
      publisher: "Chronology test publisher",
      issuer,
      ...collections,
      signatures,
      records: [
        {
          evidenceRef: publicEvidence.id,
          sourceRef: publicEvidence.sourceRef,
          recordDigest: publicEvidence.recordDigest,
          publishedAt: publicEvidence.observedAt,
        },
      ],
    },
    trustKeyring,
  };
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
  assert.equal(
    validateTrustKeyringSchema(trustKeyring),
    true,
    ajv.errorsText(validateTrustKeyringSchema.errors),
  );
  assert.deepEqual(findings(accepted), []);
  assert.equal(accepted.evidence.length, 19);
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
  const substitutedOwnerArtifact = deriveIncidentArtifact(
    incidentFixture,
    membership,
  );
  membership.followUpIdentityKey =
    substitutedOwnerArtifact.followUps[0].identityKey;
  membership.ownerArtifactDigest = computeOwnerArtifactDigest(
    substitutedOwnerArtifact,
  );
  membership.incidentRevision = membership.ownerArtifactDigest;
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

  for (const field of [
    "identityCredentials",
    "authorityGrants",
    "evidenceRecords",
    "sourceRecords",
    "ownerReceipts",
  ]) {
    const trust = structuredClone(publicTrustInput);
    trust.signatures[field] =
      `${trust.signatures[field][0] === "A" ? "B" : "A"}${trust.signatures[field].slice(1)}`;
    assert.ok(
      codes(accepted, { publicTrustInput: trust }).has(
        "invalid_caller_trust_input",
      ),
      field,
    );
  }

  const ownerSignature = structuredClone(publicTrustInput);
  ownerSignature.ownerReceipts[0].signature =
    `${ownerSignature.ownerReceipts[0].signature[0] === "A" ? "B" : "A"}${ownerSignature.ownerReceipts[0].signature.slice(1)}`;
  assert.ok(
    codes(accepted, { publicTrustInput: ownerSignature }).has(
      "invalid_caller_trust_input",
    ),
  );

  const issuerAsOwner = structuredClone(publicTrustInput);
  issuerAsOwner.ownerReceipts[0].signerKeyId =
    issuerAsOwner.issuer.keyId;
  issuerAsOwner.ownerReceipts[0].receiptDigest =
    computeOwnerReceiptDigest(issuerAsOwner.ownerReceipts[0]);
  assert.ok(
    codes(accepted, { publicTrustInput: issuerAsOwner }).has(
      "invalid_caller_trust_input",
    ),
  );

  const attacker = generateKeyPairSync("ed25519");
  const selfDeclared = structuredClone(publicTrustInput);
  selfDeclared.issuer.keyId = "key-attacker";
  selfDeclared.issuer.keyRef =
    "https://attacker.example/keys/self-declared";
  selfDeclared.issuer.publicKeyPem = attacker.publicKey.export({
    type: "spki",
    format: "pem",
  });
  for (const [field, rows] of Object.entries({
    identityCredentials: selfDeclared.identityCredentials,
    authorityGrants: selfDeclared.authorityGrants,
    evidenceRecords: selfDeclared.evidenceRecords,
    sourceRecords: selfDeclared.sourceRecords,
    ownerReceipts: selfDeclared.ownerReceipts,
  })) {
    selfDeclared.signatures[field] = sign(
      null,
      signedCollectionPayload(field, rows),
      attacker.privateKey,
    ).toString("base64");
  }
  assert.ok(
    codes(accepted, { publicTrustInput: selfDeclared }).has(
      "invalid_caller_trust_input",
    ),
  );
  assert.ok(
    codes(accepted, { publicTrustInput: selfDeclared }).has(
      "invalid_public_trust_schema",
    ),
  );
  assert.ok(
    codes(accepted, { trustKeyring: undefined }).has(
      "invalid_validation_context",
    ),
  );
});

test("trusted issuer signatures cannot impersonate a different receipt owner", () => {
  const attacker = generateKeyPairSync("ed25519");
  const keyring = structuredClone(trustKeyring);
  const issuerKey = keyring.keys.find((row) => row.kind === "issuer");
  issuerKey.publicKeyPem = attacker.publicKey.export({
    type: "spki",
    format: "pem",
  });

  const trust = structuredClone(publicTrustInput);
  const receipt = trust.ownerReceipts[0];
  receipt.ownerRef = "principal-investigator";
  receipt.signerKeyId = issuerKey.id;
  receipt.receiptDigest = computeOwnerReceiptDigest(receipt);
  receipt.signature = sign(
    null,
    Buffer.from(
      canonicalJson({
        kind: "ownerReceipt",
        digest: receipt.receiptDigest,
      }),
      "utf8",
    ),
    attacker.privateKey,
  ).toString("base64");
  for (const [field, rows] of Object.entries({
    identityCredentials: trust.identityCredentials,
    authorityGrants: trust.authorityGrants,
    evidenceRecords: trust.evidenceRecords,
    sourceRecords: trust.sourceRecords,
    ownerReceipts: trust.ownerReceipts,
  })) {
    trust.signatures[field] = sign(
      null,
      signedCollectionPayload(field, rows),
      attacker.privateKey,
    ).toString("base64");
  }

  assert.ok(
    codes(accepted, {
      publicTrustInput: trust,
      trustKeyring: keyring,
    }).has("invalid_caller_trust_input"),
  );
});

test("issuer re-signing cannot substitute owner-authored evidence", () => {
  const candidate = clone();
  candidate.evidence.find(
    (row) => row.id === "evidence-membership-inc-001",
  ).recordDigest =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const trust = refreshedTrust(candidate);
  const attacker = generateKeyPairSync("ed25519");
  const keyring = structuredClone(trustKeyring);
  keyring.keys.find((row) => row.kind === "issuer").publicKeyPem =
    attacker.publicKey.export({ type: "spki", format: "pem" });
  for (const [field, rows] of Object.entries({
    identityCredentials: trust.identityCredentials,
    authorityGrants: trust.authorityGrants,
    evidenceRecords: trust.evidenceRecords,
    sourceRecords: trust.sourceRecords,
    ownerReceipts: trust.ownerReceipts,
  })) {
    trust.signatures[field] = sign(
      null,
      signedCollectionPayload(field, rows),
      attacker.privateKey,
    ).toString("base64");
  }
  assert.ok(
    codes(candidate, {
      publicTrustInput: trust,
      trustKeyring: keyring,
    }).has("invalid_caller_trust_input"),
  );
});

test("issuer key material cannot be aliased as a principal key", () => {
  const attacker = generateKeyPairSync("ed25519");
  const attackerPublicKey = attacker.publicKey.export({
    type: "spki",
    format: "pem",
  });
  const keyring = structuredClone(trustKeyring);
  const issuerKey = keyring.keys.find((row) => row.kind === "issuer");
  const principalKey = keyring.keys.find(
    (row) => row.principalRef === "principal-problem-owner",
  );
  issuerKey.publicKeyPem = attackerPublicKey;
  principalKey.publicKeyPem = attackerPublicKey;

  const trust = structuredClone(publicTrustInput);
  for (const receipt of trust.ownerReceipts.filter(
    (row) => row.signerKeyId === principalKey.id,
  )) {
    receipt.signature = sign(
      null,
      Buffer.from(
        canonicalJson({
          kind: "ownerReceipt",
          digest: receipt.receiptDigest,
        }),
        "utf8",
      ),
      attacker.privateKey,
    ).toString("base64");
  }
  for (const [field, rows] of Object.entries({
    identityCredentials: trust.identityCredentials,
    authorityGrants: trust.authorityGrants,
    evidenceRecords: trust.evidenceRecords,
    sourceRecords: trust.sourceRecords,
    ownerReceipts: trust.ownerReceipts,
  })) {
    trust.signatures[field] = sign(
      null,
      signedCollectionPayload(field, rows),
      attacker.privateKey,
    ).toString("base64");
  }

  assert.ok(
    codes(accepted, {
      publicTrustInput: trust,
      trustKeyring: keyring,
    }).has("invalid_caller_trust_input"),
  );

  const duplicatePrincipal = structuredClone(trustKeyring);
  duplicatePrincipal.keys.push({
    ...structuredClone(principalKey),
    id: "key-problem-owner-extra",
    publicKeyPem: generateKeyPairSync("ed25519").publicKey.export({
      type: "spki",
      format: "pem",
    }),
  });
  assert.ok(
    codes(accepted, { trustKeyring: duplicatePrincipal }).has(
      "invalid_caller_trust_input",
    ),
  );

  const ecdsa = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const wrongKeyType = structuredClone(trustKeyring);
  const wrongIssuerKey = wrongKeyType.keys.find(
    (row) => row.kind === "issuer",
  );
  wrongIssuerKey.publicKeyPem = ecdsa.publicKey.export({
    type: "spki",
    format: "pem",
  });
  const ecdsaTrust = structuredClone(publicTrustInput);
  for (const [field, rows] of Object.entries({
    identityCredentials: ecdsaTrust.identityCredentials,
    authorityGrants: ecdsaTrust.authorityGrants,
    evidenceRecords: ecdsaTrust.evidenceRecords,
    sourceRecords: ecdsaTrust.sourceRecords,
    ownerReceipts: ecdsaTrust.ownerReceipts,
  })) {
    ecdsaTrust.signatures[field] = sign(
      "sha256",
      signedCollectionPayload(field, rows),
      ecdsa.privateKey,
    ).toString("base64");
  }
  assert.ok(
    codes(accepted, {
      publicTrustInput: ecdsaTrust,
      trustKeyring: wrongKeyType,
    }).has("invalid_caller_trust_input"),
  );
});

test("candidate records resolve exact complete owner artifacts", () => {
  const unresolvedMembership = clone();
  unresolvedMembership.incidentMemberships[0].ownerArtifactDigest =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.ok(
    codes(unresolvedMembership).has("invalid_incident_membership_authority"),
  );

  const invalidOwnerArtifact = clone();
  const invalidMembership = invalidOwnerArtifact.incidentMemberships[0];
  invalidMembership.followUpRef = "follow-up.invalid";
  invalidMembership.ownerArtifactDigest = computeOwnerArtifactDigest(
    deriveIncidentArtifact(incidentFixture, invalidMembership),
  );
  invalidMembership.incidentRevision =
    invalidMembership.ownerArtifactDigest;
  invalidMembership.revision =
    computeIncidentMembershipRevision(invalidMembership);
  invalidOwnerArtifact.evidence.find(
    (row) => row.id === invalidMembership.declarationEvidenceRef,
  ).subjectRevision = invalidMembership.revision;
  assert.ok(
    codes(invalidOwnerArtifact).has(
      "invalid_incident_membership_authority",
    ),
  );

  const unresolvedTest = clone();
  unresolvedTest.tests[0].testRunRef = "run-missing";
  assert.ok(codes(unresolvedTest).has("invalid_hypothesis_test"));

  const misleadingQaArtifact = clone();
  misleadingQaArtifact.tests[0].qaArtifactRef =
    "sources/quality-assurance-lead/fixtures/missing.json";
  assert.ok(codes(misleadingQaArtifact).has("invalid_hypothesis_test"));

  const unresolvedChange = clone();
  unresolvedChange.changeReceipts[0].ownerPlanDigest =
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.ok(codes(unresolvedChange).has("invalid_change_receipt"));
});

test("coherent graph reseal cannot mint fresh external receipts or signatures", () => {
  const candidate = clone();
  candidate.workarounds[0].instructions =
    "The service owner may use the revised recovery procedure.";
  const resealed = coherentlyReseal(candidate);
  const trust = refreshedTrust(resealed);
  assert.deepEqual(
    trust.sourceRecords.map((row) => row.sourceBytesDigest),
    publicTrustInput.sourceRecords.map((row) => row.sourceBytesDigest),
  );
  const actual = codes(resealed, { publicTrustInput: trust });
  assert.ok(actual.has("invalid_caller_trust_input"));
  assert.equal(actual.has("invalid_workaround_revision_binding"), false);
  assert.equal(actual.has("invalid_known_error_revision_binding"), false);
});

test("caller-verified human credentials reject agent and package substitutions", () => {
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
      }).has("invalid_caller_trust_input"),
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
    }).has("invalid_caller_trust_input"),
  );

  const copilot = clone();
  copilot.principals.find(
    (row) => row.id === "principal-problem-owner",
  ).displayName = "GitHub Copilot";
  assert.ok(
    codes(copilot, {
      publicTrustInput: refreshedTrust(copilot),
    }).has("invalid_caller_trust_input"),
  );

  for (const displayName of ["Alice Abbott", "Assistant Director Alice"]) {
    assert.equal(
      isVerifiedHumanPrincipal({
        id: "principal-alice",
        kind: "named-human",
        displayName,
        identityCredentialRef: "credential-alice",
      }),
      true,
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

  for (const title of [
    "Copilot signed off on the workaround.",
    "Copilot is signing off on the workaround.",
    "The Claw green-lit the production change.",
    "The Claw greenlights the production change.",
  ]) {
    const candidate = clone();
    candidate.problem.title = title;
    assert.ok(
      codes(candidate).has("prohibited_authority_claim"),
      title,
    );
  }

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
  laterChange.linkedAt = "2026-09-06T10:10:00Z";
  const laterLink = recurrenceBeforeFinalization.evidence.find(
    (row) => row.id === laterChange.linkEvidenceRef,
  );
  laterLink.observedAt = laterChange.linkedAt;
  recurrenceBeforeFinalization.evidence.find(
    (row) => row.id === laterChange.verificationEvidenceRefs[0],
  ).observedAt = "2026-09-06T10:05:00Z";
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

test("fully signed equality at every consume-after boundary fails chronology", () => {
  const cases = [
    {
      name: "membership equals problem declaration",
      expected: "invalid_incident_membership_authority",
      mutate(candidate) {
        candidate.incidentMemberships[0].declaredAt =
          candidate.problem.declaredAt;
      },
    },
    {
      name: "membership equals incident observation",
      expected: "invalid_incident_membership_authority",
      mutate(candidate) {
        candidate.problem.declaredAt = "2026-06-01T00:00:00Z";
        const membership = candidate.incidentMemberships[0];
        membership.declaredAt = candidate.evidence.find(
          (row) => row.id === membership.incidentRecordEvidenceRef,
        ).observedAt;
      },
    },
    {
      name: "hypothesis proposal equals problem declaration",
      expected: "invalid_hypothesis_matrix",
      mutate(candidate) {
        candidate.hypotheses[0].proposedAt =
          candidate.problem.declaredAt;
      },
    },
    {
      name: "QA execution equals hypothesis proposal",
      expected: "invalid_hypothesis_test",
      mutate(candidate) {
        const candidateTest = candidate.tests[0];
        candidate.hypotheses.find(
          (row) => row.id === candidateTest.hypothesisRef,
        ).proposedAt = candidateTest.executedAt;
      },
    },
    {
      name: "disposition equals latest test evidence",
      expected: "invalid_hypothesis_matrix",
      mutate(candidate) {
        const candidateTest = candidate.tests[0];
        candidate.hypotheses.find(
          (row) => row.id === candidateTest.hypothesisRef,
        ).revisedAt = candidate.evidence.find(
          (row) => row.id === candidateTest.evidenceRef,
        ).observedAt;
      },
    },
    {
      name: "QA execution equals disposition",
      expected: "invalid_hypothesis_test",
      mutate(candidate) {
        const candidateTest = candidate.tests[0];
        candidate.hypotheses.find(
          (row) => row.id === candidateTest.hypothesisRef,
        ).revisedAt = candidateTest.executedAt;
      },
    },
    {
      name: "QA evidence equals execution",
      expected: "invalid_hypothesis_test",
      mutate(candidate) {
        const candidateTest = candidate.tests[0];
        candidate.evidence.find(
          (row) => row.id === candidateTest.evidenceRef,
        ).observedAt = candidateTest.executedAt;
      },
    },
    {
      name: "workaround approval equals disposition",
      expected: "invalid_workaround_authority",
      mutate(candidate) {
        const workaround = candidate.workarounds[0];
        workaround.approvedAt = candidate.hypotheses.find(
          (row) => row.id === workaround.hypothesisRef,
        ).revisedAt;
      },
    },
    {
      name: "known-error declaration equals workaround approval",
      expected: "invalid_known_error_authority",
      mutate(candidate) {
        candidate.knownErrors[0].declaredAt =
          candidate.workarounds[0].approvedAt;
      },
    },
    {
      name: "change execution equals known-error declaration",
      expected: "invalid_change_receipt",
      mutate(candidate) {
        candidate.changeReceipts[0].executedAt =
          candidate.knownErrors[0].declaredAt;
      },
    },
    {
      name: "change linkage equals execution",
      expected: "invalid_change_receipt",
      mutate(candidate) {
        candidate.changeReceipts[0].linkedAt =
          candidate.changeReceipts[0].executedAt;
      },
    },
    {
      name: "manifest signature equals latest membership",
      expected: "invalid_incident_manifest",
      mutate(candidate) {
        candidate.incidentManifest.signedAt =
          candidate.incidentMemberships.at(-1).declaredAt;
      },
    },
    {
      name: "recurrence equals finalized change",
      expected: "invalid_recurrence",
      mutate(candidate) {
        candidate.recurrences[0].observedAt =
          candidate.changeReceipts[0].linkedAt;
      },
    },
    {
      name: "recurrence equals membership declaration",
      expected: "invalid_recurrence",
      mutate(candidate) {
        candidate.recurrences[0].observedAt =
          candidate.incidentMemberships.at(-1).declaredAt;
      },
    },
    {
      name: "prose receipt equals prose signature",
      expected: "invalid_prose_attestation",
      mutate(candidate) {
        candidate.evidence.find(
          (row) =>
            row.id === candidate.proseAttestation.receiptEvidenceRef,
        ).observedAt = candidate.proseAttestation.signedAt;
      },
    },
  ];

  for (const row of cases) {
    const candidate = clone();
    row.mutate(candidate);
    const resealed = coherentlyReseal(candidate);
    const signed = fullySignedTrust(resealed);
    const actual = codes(resealed, signed);
    assert.equal(
      actual.has("invalid_caller_trust_input"),
      false,
      `${row.name}: trust should remain valid`,
    );
    assert.ok(actual.has(row.expected), row.name);
  }

  const receiptEvidenceRef = accepted.tests[0].evidenceRef;
  const signed = fullySignedTrust(accepted, {
    equalReceiptEvidenceRef: receiptEvidenceRef,
  });
  assert.ok(
    codes(accepted, signed).has("invalid_caller_trust_input"),
    "owner receipt must follow evidence observation",
  );
});

test("schema-first validation is total and resource bounded", () => {
  const schemaInvalid = clone();
  delete schemaInvalid.problem.title;
  assert.ok(codes(schemaInvalid).has("invalid_schema"));

  const malformedMembershipIdentity = clone();
  malformedMembershipIdentity.incidentMemberships[0].incidentRef = null;
  assert.doesNotThrow(() => findings(malformedMembershipIdentity));
  assert.ok(
    codes(malformedMembershipIdentity).has(
      "invalid_incident_membership_authority",
    ),
  );

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

  const danglingEvidence = clone();
  danglingEvidence.problem.declarationEvidenceRef = "evidence-missing";
  const danglingTrust = structuredClone(publicTrustInput);
  danglingTrust.ownerReceipts[0].evidenceRef = "evidence-missing";
  danglingTrust.ownerReceipts[0].receiptDigest =
    computeOwnerReceiptDigest(danglingTrust.ownerReceipts[0]);
  assert.doesNotThrow(() =>
    findings(danglingEvidence, { publicTrustInput: danglingTrust }),
  );
  assert.ok(
    codes(danglingEvidence, { publicTrustInput: danglingTrust }).has(
      "invalid_caller_trust_input",
    ),
  );

  const sharedStructure = clone();
  sharedStructure.changeReceipts[0].targetRefs =
    sharedStructure.problem.serviceRefs;
  assert.equal(codes(sharedStructure).has("invalid_structure"), false);
});
