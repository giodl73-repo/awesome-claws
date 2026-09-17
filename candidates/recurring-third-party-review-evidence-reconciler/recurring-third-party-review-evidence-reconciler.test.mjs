import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign as signPayload } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  assessComplianceContractComposition,
  computeCellIndexRevision,
  computeExceptionScopeDigest,
  computeFreshnessRuleRevision,
  computeRequirementCatalogRevision,
  evaluateRecurringThirdPartyReview,
  renderReviewProof,
  sourceAuthorityPayload,
} from "./recurring-third-party-review-evidence-reconciler.mjs";
import {
  artifactSemanticValidationOptions,
  validateArtifactSemantics,
} from "../../scripts/artifact-semantics.mjs";
import { contractObligationTrackerFindings } from "../../scripts/contract-obligation-tracker.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const asOf = "2026-09-16T20:00:00Z";
const fixture = JSON.parse(
  await readFile(resolve(here, "fixtures", "approved-review-cycle.input.json"), "utf8"),
);
const publicTrust = JSON.parse(
  await readFile(resolve(here, "fixtures", "public-trust.test.json"), "utf8"),
);
const expected = JSON.parse(
  await readFile(resolve(here, "expected", "blocked-handoff.expected.json"), "utf8"),
);
const expectedFailure = JSON.parse(
  await readFile(resolve(here, "expected", "prohibited-score.failure.json"), "utf8"),
);
const compositionAudit = JSON.parse(
  await readFile(
    resolve(here, "fixtures", "compliance-contract-composition-audit.json"),
    "utf8",
  ),
);
const proof = await readFile(resolve(here, "proof", "blocked-handoff.md"), "utf8");
const clone = () => structuredClone(fixture);
const evaluate = (input = fixture, options = {}) =>
  evaluateRecurringThirdPartyReview(input, {
    asOf,
    publicTrust,
    ...options,
  });

function signWithEphemeralTrust(input) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  input.sourceAuthority.signingKeyId = "key-adversarial-chronology";
  input.sourceAuthority.signature = signPayload(
    null,
    sourceAuthorityPayload(input),
    privateKey,
  ).toString("base64");
  return {
    schemaVersion:
      "awesomeClaws.recurringThirdPartyReviewEvidenceReconcilerPublicTrust.v1",
    signers: [
      {
        ownerRef: input.sourceAuthority.ownerRef,
        signingKeyId: input.sourceAuthority.signingKeyId,
        algorithm: "Ed25519",
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
        validFrom: "2026-07-01T00:00:00Z",
        validUntil: "2027-06-30T23:59:59Z",
      },
    ],
  };
}

function resultSummary(evaluation) {
  return {
    valid: evaluation.valid,
    freshnessRuleRevision: evaluation.result.freshnessRuleRevision,
    coverage: {
      declaredCells: evaluation.result.coverage.declaredCellRefs.length,
      decisions: evaluation.result.coverage.decisionCellRefs.length,
      coveredExactlyOnce: evaluation.result.coverage.coveredExactlyOnce,
    },
    scope: {
      vendorServiceRefs: evaluation.result.scope.vendorServiceRefs,
      sharedSubprocessorRef: evaluation.result.scope.sharedSubprocessorRef,
      publicTrustEvidenceRef: evaluation.result.scope.publicTrustEvidenceRef,
      remediationRefs: evaluation.result.scope.remediationRefs,
      exceptionRefs: evaluation.result.scope.exceptionRefs,
      riskAcceptanceAttemptRefs:
        evaluation.result.scope.riskAcceptanceAttemptRefs,
    },
    expiredEvidenceRefs: evaluation.result.evidenceStates
      .filter((item) => item.state === "expired")
      .map((item) => item.evidenceRef),
    reopenedCells: evaluation.result.reopenedCells,
    blockers: evaluation.result.blockers,
    handoff: {
      state: evaluation.result.handoff.state,
      nextOwnerRef: evaluation.result.handoff.nextOwnerRef,
      blockerCodes: evaluation.result.handoff.blockerCodes,
      authorityClaims: evaluation.result.handoff.authorityClaims,
    },
  };
}

test("accepted bounded fixture is trusted, exact, and intentionally blocked", () => {
  const before = structuredClone(fixture);
  const evaluation = evaluate();
  assert.equal(evaluation.valid, true, JSON.stringify(evaluation.findings, null, 2));
  assert.deepEqual(evaluation.findings, []);
  assert.deepEqual(resultSummary(evaluation), expected);
  assert.deepEqual(fixture, before, "evaluation must not mutate its inputs");
});

test("validator is total over non-JSON direct inputs", () => {
  for (const input of [null, [], "not-an-artifact"]) {
    assert.doesNotThrow(() => evaluateRecurringThirdPartyReview(input));
    const evaluation = evaluateRecurringThirdPartyReview(input);
    assert.equal(evaluation.valid, false);
    assert.equal(evaluation.result, null);
    assert.ok(evaluation.findings.some((item) => item.code === "invalid-json-input"));
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.doesNotThrow(() => evaluateRecurringThirdPartyReview(cyclic));
  assert.ok(
    evaluateRecurringThirdPartyReview(cyclic).findings.some(
      (item) => item.code === "invalid-json-input",
    ),
  );
});

test("fixture contains the exact requested bounded evidence slice", () => {
  assert.equal(fixture.vendorServices.length, 2);
  assert.equal(fixture.subprocessors.length, 1);
  assert.equal(fixture.requirementCatalog.requirements.length, 4);
  assert.equal(fixture.requirementCatalog.cells.length, 6);
  assert.equal(fixture.decisions.length, 6);
  assert.equal(fixture.remediations.length, 1);
  assert.equal(fixture.exceptions.length, 1);
  assert.equal(fixture.riskAcceptanceAttempts.length, 1);
  assert.equal(
    fixture.evidence.filter((item) => item.sourceClass === "public-trust").length,
    1,
  );
  assert.equal(
    fixture.evidence.filter(
      (item) =>
        item.kind === "assurance-report" &&
        Date.parse(item.validUntil) < Date.parse(asOf),
    ).length,
    1,
  );
  assert.ok(
    fixture.requirementCatalog.cells.length <
      fixture.vendorServices.length * fixture.requirementCatalog.requirements.length,
    "the six owner-declared cells must not be a derived Cartesian product",
  );
  const serviceRefs = fixture.vendorServices.map((item) => item.id).sort();
  assert.deepEqual([...fixture.subprocessors[0].serviceRefs].sort(), serviceRefs);
  for (const service of fixture.vendorServices) {
    assert.deepEqual(service.subprocessorRefs, [fixture.subprocessors[0].id]);
  }
});

test("catalog, cell index, and exception scope revisions bind exact owner input", () => {
  assert.equal(
    fixture.requirementCatalog.revision,
    computeRequirementCatalogRevision(fixture.requirementCatalog),
  );
  assert.equal(
    fixture.cycle.cellIndexRevision,
    computeCellIndexRevision(fixture.requirementCatalog),
  );
  assert.equal(
    fixture.predecessorCycle.cellIndexRevision,
    computeCellIndexRevision(fixture.requirementCatalog),
  );
  assert.equal(
    fixture.cycle.freshnessRuleRevision,
    computeFreshnessRuleRevision(fixture.freshnessRules),
  );
  assert.equal(
    fixture.predecessorCycle.freshnessRuleRevision,
    computeFreshnessRuleRevision(fixture.freshnessRules),
  );
  assert.equal(
    fixture.exceptions[0].scopeDigest,
    computeExceptionScopeDigest(fixture.exceptions[0]),
  );
});

test("proof is derived from the accepted result and preserves the blocked handoff", () => {
  const rendered = renderReviewProof(evaluate().result);
  assert.equal(rendered, proof.replaceAll("\r\n", "\n"));
  assert.match(rendered, /Exact cell coverage: \*\*yes\*\* \(6\/6\)/u);
  assert.match(rendered, /unauthorized-risk-acceptance-attempt/u);
  assert.match(rendered, /risk acceptance.*structurally `false`/su);
});

test("caller-controlled time is required and wall-clock time is never consulted", () => {
  const originalNow = Date.now;
  Date.now = () => {
    throw new Error("wall clock consulted");
  };
  try {
    assert.doesNotThrow(() => evaluate());
    const sameInstant = evaluate(fixture, {
      asOf: "2026-09-16T16:00:00-04:00",
    });
    assert.equal(sameInstant.valid, true);
    assert.equal(sameInstant.result.evaluatedAt, "2026-09-16T20:00:00.000Z");
    const fractional = evaluate(fixture, {
      asOf: "2026-09-16T20:00:00.000000Z",
    });
    assert.equal(fractional.valid, true);
    assert.equal(fractional.result.evaluatedAt, "2026-09-16T20:00:00.000Z");
  } finally {
    Date.now = originalNow;
  }
  const missing = evaluateRecurringThirdPartyReview(fixture, { publicTrust });
  assert.equal(missing.valid, false);
  assert.ok(
    missing.findings.some((item) => item.code === "invalid-validation-context"),
  );
  const calendarInvalid = evaluate(fixture, {
    asOf: "2026-02-30T20:00:00Z",
  });
  assert.equal(calendarInvalid.valid, false);
  assert.ok(
    calendarInvalid.findings.some(
      (item) => item.code === "invalid-validation-context",
    ),
  );
});

test("source authority issuance is bounded by cycle close and caller asOf", () => {
  const expectedFinding = {
    code: "invalid-source-authority-chronology",
    path: "$.sourceAuthority",
    message:
      "The typed program owner must sign no earlier than cycle close, after all current actions, and no later than caller-controlled asOf.",
    refs: [fixture.sourceAuthority.ownerRef],
  };
  for (const issuedAt of [
    "2026-09-15T17:59:59Z",
    "2026-09-16T20:00:01Z",
  ]) {
    const changed = clone();
    changed.sourceAuthority.issuedAt = issuedAt;
    const adversarialTrust = signWithEphemeralTrust(changed);
    const evaluation = evaluate(changed, { publicTrust: adversarialTrust });
    assert.equal(evaluation.valid, false);
    assert.deepEqual(
      evaluation.findings.filter(
        (item) => item.code === "invalid-source-authority-chronology",
      ),
      [expectedFinding],
    );
    assert.equal(
      evaluation.findings.some(
        (item) => item.code === "source-envelope-signature-invalid",
      ),
      false,
      "the chronology finding must be proven with an otherwise valid signature",
    );
    assert.equal(
      evaluation.findings.some(
        (item) => item.code === "evidence-after-envelope-issuance",
      ),
      false,
      "all signed evidence predates both adversarial issuance times",
    );
  }
});

test("public trust is injected, owner-and-key scoped, and has no private key", () => {
  assert.doesNotMatch(JSON.stringify(publicTrust), /PRIVATE KEY/u);
  const missing = evaluateRecurringThirdPartyReview(fixture, { asOf });
  assert.equal(missing.valid, false);
  assert.ok(
    missing.findings.some((item) => item.code === "invalid-public-trust-input"),
  );
  const wrongOwner = structuredClone(publicTrust);
  wrongOwner.signers[0].ownerRef = "principal-program-owner-other";
  const untrusted = evaluate(fixture, { publicTrust: wrongOwner });
  assert.equal(untrusted.valid, false);
  assert.ok(
    untrusted.findings.some((item) => item.code === "untrusted-source-authority"),
  );
  const privateTrust = structuredClone(publicTrust);
  privateTrust.signers[0].publicKeyPem = generateKeyPairSync("ed25519").privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  const privateKeyResult = evaluate(fixture, { publicTrust: privateTrust });
  assert.equal(privateKeyResult.valid, false);
  assert.ok(
    privateKeyResult.findings.some(
      (item) => item.code === "invalid-public-trust-key",
    ),
  );
  const wrongKeyType = structuredClone(publicTrust);
  wrongKeyType.signers[0].publicKeyPem = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey.export({
    type: "spki",
    format: "pem",
  });
  const wrongKeyTypeResult = evaluate(fixture, { publicTrust: wrongKeyType });
  assert.doesNotThrow(() => evaluate(fixture, { publicTrust: wrongKeyType }));
  assert.ok(
    wrongKeyTypeResult.findings.some(
      (item) => item.code === "invalid-public-trust-key",
    ),
  );
  const cyclicTrust = structuredClone(publicTrust);
  cyclicTrust.self = cyclicTrust;
  assert.doesNotThrow(() => evaluate(fixture, { publicTrust: cyclicTrust }));
  assert.ok(
    evaluate(fixture, { publicTrust: cyclicTrust }).findings.some(
      (item) => item.code === "invalid-public-trust-input",
    ),
  );
});

test("the public signature covers every result-driving input", () => {
  for (const mutate of [
    (input) => {
      input.requirementCatalog.cells[0].requirementRef =
        "requirement-security-questionnaire";
    },
    (input) => {
      input.evidence[7].sourceContentDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    },
    (input) => {
      input.riskAcceptanceAttempts[0].attemptedByRef =
        "principal-service-owner-olivia";
    },
  ]) {
    const changed = clone();
    mutate(changed);
    const evaluation = evaluate(changed);
    assert.equal(evaluation.valid, false);
    assert.ok(
      evaluation.findings.some(
        (item) => item.code === "source-envelope-signature-invalid",
      ),
      JSON.stringify(evaluation.findings, null, 2),
    );
    assert.ok(
      evaluation.result.blockers.some(
        (item) => item.code === "candidate-input-invalid",
      ),
    );
  }
});

test("exact current and predecessor cell coverage rejects omissions and duplicates", () => {
  const duplicate = clone();
  duplicate.decisions[5].cellRef = duplicate.decisions[0].cellRef;
  const duplicateResult = evaluate(duplicate);
  assert.ok(
    duplicateResult.findings.some((item) => item.code === "inexact-cell-coverage"),
  );

  const omitted = clone();
  omitted.predecessorCycle.decisions.pop();
  const omittedResult = evaluate(omitted);
  assert.equal(omittedResult.valid, false);
  assert.ok(
    omittedResult.findings.some(
      (item) =>
        item.code === "schema-invalid" || item.code === "inexact-cell-coverage",
    ),
  );
});

test("the owner-declared cell index cannot be replaced by inferred applicability", () => {
  const duplicatePair = clone();
  duplicatePair.requirementCatalog.cells[5].vendorServiceRef =
    "vendor-service-alpine-support";
  duplicatePair.requirementCatalog.cells[5].ownerRef =
    "principal-service-owner-olivia";
  duplicatePair.requirementCatalog.cells[5].requirementRef =
    "requirement-security-questionnaire";
  const evaluation = evaluate(duplicatePair);
  assert.ok(
    evaluation.findings.some((item) => item.code === "duplicate-requirement-cell"),
  );

  const duplicateVendor = clone();
  duplicateVendor.vendorServices[1].vendorId =
    duplicateVendor.vendorServices[0].vendorId;
  assert.ok(
    evaluate(duplicateVendor).findings.some(
      (item) => item.code === "invalid-vendor-service-universe",
    ),
  );

  const orphanedServiceOwner = clone();
  orphanedServiceOwner.vendorServices[1].ownerRef =
    "principal-service-owner-olivia";
  assert.ok(
    evaluate(orphanedServiceOwner).findings.some(
      (item) => item.code === "invalid-vendor-service-universe",
    ),
  );
});

test("catalog content drift invalidates both revision and cycle binding", () => {
  const changed = clone();
  changed.requirementCatalog.requirements[0].statement =
    "A changed owner requirement.";
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "requirement-catalog-revision-mismatch",
    ),
  );
  assert.ok(
    evaluation.findings.some((item) => item.code === "invalid-cycle-revision-binding"),
  );

  const freshnessDrift = clone();
  freshnessDrift.freshnessRules.find(
    (item) => item.id === "freshness-assurance-report",
  ).maxAgeDays = 364;
  assert.ok(
    evaluate(freshnessDrift).findings.some(
      (item) => item.code === "invalid-cycle-revision-binding",
    ),
  );
});

test("expired predecessor evidence must reopen the exact current cell", () => {
  const changed = clone();
  changed.decisions[0].decisionType = "evidence-confirmed";
  changed.decisions[0].remediationRef = null;
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some((item) => item.code === "inexact-evidence-reopening"),
  );
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "invalid-evidence-confirmed-decision",
    ),
  );
});

test("predecessor and current decisions require exact-cell evidence chronology", () => {
  const wrongPredecessorCell = clone();
  wrongPredecessorCell.predecessorCycle.decisions[1].evidenceRefs = [
    "evidence-brightpay-security-questionnaire",
  ];
  const predecessorResult = evaluate(wrongPredecessorCell);
  assert.ok(
    predecessorResult.findings.some(
      (item) => item.code === "invalid-predecessor-decision",
    ),
  );

  const lateEvidence = clone();
  lateEvidence.evidence.find(
    (item) => item.id === "evidence-alpine-security-questionnaire",
  ).observedAt = "2026-09-15T17:00:00Z";
  const currentResult = evaluate(lateEvidence);
  assert.ok(
    currentResult.findings.some(
      (item) => item.code === "invalid-typed-human-decision",
    ),
  );

  const predecessorException = clone();
  predecessorException.predecessorCycle.decisions[1].decisionType =
    "exception-recorded";
  const predecessorExceptionResult = evaluate(predecessorException);
  assert.ok(
    predecessorExceptionResult.findings.some(
      (item) => item.code === "invalid-predecessor-decision",
    ),
  );

  const preApprovalDecision = clone();
  preApprovalDecision.predecessorCycle.decisions[1].decidedAt =
    "2026-01-12T15:00:00Z";
  const preApprovalResult = evaluate(preApprovalDecision);
  assert.ok(
    preApprovalResult.findings.some(
      (item) => item.code === "invalid-predecessor-decision",
    ),
  );

  const crossCellExtra = clone();
  crossCellExtra.decisions[1].evidenceRefs.push(
    "evidence-brightpay-continuity-test",
  );
  const crossCellResult = evaluate(crossCellExtra);
  assert.ok(
    crossCellResult.findings.some(
      (item) => item.code === "invalid-typed-human-decision",
    ),
  );
});

test("typed human decisions cannot be reassigned to a service owner", () => {
  const changed = clone();
  changed.decisions[1].decidedByRef = "principal-service-owner-olivia";
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "invalid-typed-human-decision",
    ),
  );
});

test("typed authority must predate each governed action", () => {
  const lateReviewerAuthority = clone();
  lateReviewerAuthority.principals.find(
    (item) => item.id === "principal-reviewer-riley",
  ).authorityObservedAt = "2026-09-15T16:06:00Z";
  const decisionResult = evaluate(lateReviewerAuthority);
  assert.ok(
    decisionResult.findings.some(
      (item) => item.code === "invalid-typed-human-decision",
    ),
  );

  const lateCatalogAuthority = clone();
  lateCatalogAuthority.principals.find(
    (item) => item.id === "principal-catalog-owner-morgan",
  ).authorityObservedAt = "2026-07-15T16:00:01Z";
  const catalogResult = evaluate(lateCatalogAuthority);
  assert.ok(
    catalogResult.findings.some(
      (item) => item.code === "invalid-requirement-catalog-authority",
    ),
  );
});

test("typed principal cardinality and evidence closure are exact", () => {
  const extraReviewer = clone();
  extraReviewer.principals.push({
    ...extraReviewer.principals.find(
      (item) => item.id === "principal-reviewer-riley",
    ),
    id: "principal-reviewer-taylor",
    name: "Taylor Gray",
    humanIdentityRef: "controlled://identity/taylor-gray",
  });
  const principalResult = evaluate(extraReviewer);
  assert.ok(
    principalResult.findings.some(
      (item) => item.code === "invalid-principal-role-cardinality",
    ),
  );

  const unreferenced = clone();
  unreferenced.evidence.push({
    ...unreferenced.evidence.find(
      (item) => item.id === "evidence-alpine-security-questionnaire",
    ),
    id: "evidence-unreferenced-questionnaire",
    sourceRef: "controlled://third-party-review/questionnaires/unreferenced",
  });
  const evidenceResult = evaluate(unreferenced);
  assert.ok(
    evidenceResult.findings.some(
      (item) => item.code === "inexact-evidence-closure",
    ),
  );
});

test("cell evidence and validity windows remain exact", () => {
  const crossCell = clone();
  const questionnaire = crossCell.evidence.find(
    (item) => item.id === "evidence-alpine-security-questionnaire",
  );
  questionnaire.subjectRef = "cell-brightpay-security";
  const crossCellResult = evaluate(crossCell);
  assert.ok(
    crossCellResult.findings.some(
      (item) => item.code === "invalid-cell-evidence-binding",
    ),
  );

  const invertedWindow = clone();
  invertedWindow.evidence.find(
    (item) => item.id === "evidence-brightpay-continuity-test",
  ).validUntil = "2026-04-15T13:59:59Z";
  const windowResult = evaluate(invertedWindow);
  assert.ok(
    windowResult.findings.some(
      (item) => item.code === "invalid-evidence-validity-window",
    ),
  );
});

test("the one shared subprocessor is reciprocal across both services and cells", () => {
  const changed = clone();
  changed.subprocessors[0].serviceRefs = ["vendor-service-alpine-support"];
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some(
      (item) =>
        item.code === "schema-invalid" ||
        item.code === "invalid-shared-subprocessor-binding",
    ),
  );
});

test("the one public trust evidence input cannot be silently reclassified", () => {
  const changed = clone();
  changed.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).sourceClass = "owner-controlled";
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some((item) => item.code === "invalid-public-trust-evidence"),
  );

  const swapped = clone();
  const report = swapped.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  );
  const questionnaire = swapped.evidence.find(
    (item) => item.id === "evidence-brightpay-security-questionnaire",
  );
  report.sourceClass = "owner-controlled";
  report.sourceRef = "controlled://third-party-review/assurance/alpine-2025";
  questionnaire.sourceClass = "public-trust";
  questionnaire.sourceRef =
    "https://trust.brightpay.example/questionnaires/security-2026";
  const swappedResult = evaluate(swapped);
  assert.ok(
    swappedResult.findings.some(
      (item) => item.code === "invalid-public-trust-report-binding",
    ),
  );

  const staleApplicability = clone();
  staleApplicability.evidence.find(
    (item) => item.id === "evidence-applicability-alpine-security",
  ).validUntil = "2026-09-01T00:00:00Z";
  assert.ok(
    evaluate(staleApplicability).findings.some(
      (item) => item.code === "invalid-applicability-evidence",
    ),
  );
});

test("remediation and exception authority stay external and exact-cell scoped", () => {
  const selfApproved = clone();
  selfApproved.exceptions[0].approvedByRef = "principal-reviewer-riley";
  const exceptionResult = evaluate(selfApproved);
  assert.ok(
    exceptionResult.findings.some(
      (item) => item.code === "invalid-external-exception",
    ),
  );

  const wrongCell = clone();
  wrongCell.remediations[0].cellRef = "cell-alpine-security";
  const remediationResult = evaluate(wrongCell);
  assert.ok(
    remediationResult.findings.some(
      (item) => item.code === "invalid-expiry-remediation",
    ),
  );

  const detachedFromPredecessor = clone();
  detachedFromPredecessor.predecessorCycle.decisions[0].evidenceRefs = [
    "evidence-alpine-security-questionnaire",
  ];
  assert.ok(
    evaluate(detachedFromPredecessor).findings.some(
      (item) => item.code === "invalid-expiry-remediation",
    ),
  );

  const crossCellRemediationEvidence = clone();
  crossCellRemediationEvidence.evidence.find(
    (item) => item.id === "evidence-remediation-alpine-assurance",
  ).cellRefs = ["cell-alpine-security"];
  assert.ok(
    evaluate(crossCellRemediationEvidence).findings.some(
      (item) => item.code === "invalid-expiry-remediation",
    ),
  );

  const crossCellExceptionEvidence = clone();
  crossCellExceptionEvidence.evidence.find(
    (item) => item.id === "evidence-exception-brightpay-security",
  ).cellRefs = ["cell-brightpay-continuity"];
  assert.ok(
    evaluate(crossCellExceptionEvidence).findings.some(
      (item) => item.code === "invalid-external-exception",
    ),
  );
});

test("signed evidence cannot postdate envelope issuance", () => {
  const changed = clone();
  changed.evidence.find(
    (item) => item.id === "evidence-cycle-approval",
  ).observedAt = "2026-09-16T19:00:01Z";
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "evidence-after-envelope-issuance",
    ),
  );
  assert.ok(
    evaluation.result.blockers.some(
      (item) => item.code === "candidate-input-invalid",
    ),
  );

  const lateCycleApproval = clone();
  lateCycleApproval.evidence.find(
    (item) => item.id === "evidence-cycle-approval",
  ).observedAt = "2026-08-02T12:00:00Z";
  assert.ok(
    evaluate(lateCycleApproval).findings.some(
      (item) => item.code === "invalid-cycle-approval-evidence",
    ),
  );
});

test("unauthorized risk acceptance is preserved only as an exact blocker", () => {
  const evaluation = evaluate();
  const attempt = fixture.riskAcceptanceAttempts[0];
  assert.ok(
    evaluation.result.blockers.some(
      (item) =>
        item.code === "unauthorized-risk-acceptance-attempt" &&
        item.cellRef === attempt.cellRef &&
        item.subjectRef === attempt.id,
    ),
  );
  assert.equal(evaluation.result.handoff.authorityClaims.riskAcceptanceClaim, false);
  assert.equal(
    fixture.decisions.some((item) => item.decisionType.includes("risk")),
    false,
  );

  const outsideCycle = clone();
  outsideCycle.riskAcceptanceAttempts[0].attemptedAt =
    "2026-09-15T18:00:01Z";
  const outsideResult = evaluate(outsideCycle);
  assert.ok(
    outsideResult.findings.some(
      (item) => item.code === "invalid-risk-acceptance-attempt-record",
    ),
  );

  const inventedAuthority = clone();
  inventedAuthority.riskAcceptanceAttempts[0].assertedAuthoritySourceRef =
    "controlled://authority/risk-owner/invented";
  assert.ok(
    evaluate(inventedAuthority).findings.some(
      (item) => item.code === "invalid-risk-acceptance-attempt-record",
    ),
  );
});

test("scoring and every consequential action remain structurally impossible", () => {
  const changed = clone();
  changed.score = 100;
  const evaluation = evaluate(changed);
  assert.match(evaluation.findings[0].message, /additional properties/u);
  const summary = {
    valid: evaluation.valid,
    result: evaluation.result,
    finding: {
      code: evaluation.findings[0].code,
      path: evaluation.findings[0].path,
      messageIncludes: "additional properties",
    },
  };
  assert.deepEqual(summary, expectedFailure);

  const actionClaim = clone();
  actionClaim.decisions[0].riskAccepted = true;
  const claimResult = evaluate(actionClaim);
  assert.equal(claimResult.valid, false);
  assert.ok(claimResult.findings.some((item) => item.code === "schema-invalid"));
  assert.ok(
    Object.values(evaluate().result.handoff.authorityClaims).every(
      (value) => value === false,
    ),
  );
});

test("invalid evidence freshness remains invalid in the derived blocked result", () => {
  const changed = clone();
  changed.freshnessRules = changed.freshnessRules.filter(
    (item) => item.evidenceKind !== "continuity-test",
  );
  const evaluation = evaluate(changed);
  assert.equal(evaluation.valid, false);
  assert.equal(
    evaluation.result.evidenceStates.find(
      (item) => item.evidenceRef === "evidence-brightpay-continuity-test",
    ).state,
    "invalid",
  );
  assert.equal(evaluation.result.handoff.state, "blocked");
});

test("Compliance Reviewer and Contract Obligation Tracker pass their actual contracts", async () => {
  const complianceSchema = JSON.parse(
    await readFile(
      resolve(root, "sources", "compliance-reviewer", "schemas", "control-assessment.schema.json"),
      "utf8",
    ),
  );
  const complianceFixture = JSON.parse(
    await readFile(
      resolve(root, "sources", "compliance-reviewer", "fixtures", "control-assessment.example.json"),
      "utf8",
    ),
  );
  const contractSchema = JSON.parse(
    await readFile(
      resolve(
        root,
        "sources",
        "contract-obligation-tracker",
        "schemas",
        "contract-obligation-tracker.schema.json",
      ),
      "utf8",
    ),
  );
  const contractFixture = JSON.parse(
    await readFile(
      resolve(
        root,
        "sources",
        "contract-obligation-tracker",
        "fixtures",
        "contract-obligation-tracker.example.json",
      ),
      "utf8",
    ),
  );
  const localAjv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(localAjv);
  assert.equal(localAjv.compile(complianceSchema)(complianceFixture), true);
  assert.deepEqual(validateArtifactSemantics("compliance-reviewer", complianceFixture), []);
  assert.equal(localAjv.compile(contractSchema)(contractFixture), true);
  assert.deepEqual(
    contractObligationTrackerFindings(
      contractFixture,
      artifactSemanticValidationOptions("contract-obligation-tracker"),
    ),
    [],
  );
});

test("actual Compliance plus Contract composition fails the admission falsification", async () => {
  const complianceSchema = JSON.parse(
    await readFile(
      resolve(root, "sources", "compliance-reviewer", "schemas", "control-assessment.schema.json"),
      "utf8",
    ),
  );
  const contractSchema = JSON.parse(
    await readFile(
      resolve(
        root,
        "sources",
        "contract-obligation-tracker",
        "schemas",
        "contract-obligation-tracker.schema.json",
      ),
      "utf8",
    ),
  );
  const artifactSemanticsSource = await readFile(
    resolve(root, "scripts", "artifact-semantics.mjs"),
    "utf8",
  );
  const complianceStart = artifactSemanticsSource.indexOf(
    "function complianceAssessmentFindings",
  );
  const complianceEnd = artifactSemanticsSource.indexOf(
    "\nfunction apiIntegrationReadinessFindings",
    complianceStart,
  );
  const complianceValidatorSource = artifactSemanticsSource.slice(
    complianceStart,
    complianceEnd,
  );
  const contractValidatorSource = await readFile(
    resolve(root, "scripts", "contract-obligation-tracker.mjs"),
    "utf8",
  );
  const assessment = assessComplianceContractComposition({
    complianceSchema,
    complianceValidatorSource,
    contractSchema,
    contractValidatorSource,
    capabilityAudit: compositionAudit,
  });
  assert.equal(assessment.auditValid, true);
  assert.equal(assessment.preservesAllInvariants, false);
  assert.equal(
    assessment.verdict,
    "reject-compliance-plus-contract-composition",
  );
  assert.deepEqual(
    assessment.invariants.filter((item) => !item.preserved).map((item) => item.id),
    [
      "owner-declared-service-applicability",
      "requirement-catalog-revision",
      "evidence-expiry",
      "predecessor-reopening",
    ],
  );

  const futureAudit = structuredClone(compositionAudit);
  for (const invariant of futureAudit.invariants) {
    invariant.compliance = "preserved";
    invariant.contract = "preserved";
    invariant.composition = "preserved";
    invariant.rationale = "Future source-backed composition proof.";
  }
  const futureComposition = assessComplianceContractComposition({
    complianceSchema,
    complianceValidatorSource,
    contractSchema,
    contractValidatorSource,
    capabilityAudit: futureAudit,
  });
  assert.equal(futureComposition.auditValid, true);
  assert.equal(futureComposition.preservesAllInvariants, true);
  assert.equal(futureComposition.verdict, "reject-candidate");

  const staleAudit = structuredClone(compositionAudit);
  staleAudit.sources.contractValidator =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const staleAssessment = assessComplianceContractComposition({
    complianceSchema,
    complianceValidatorSource,
    contractSchema,
    contractValidatorSource,
    capabilityAudit: staleAudit,
  });
  assert.equal(staleAssessment.auditValid, false);
  assert.equal(staleAssessment.verdict, "reaudit-required");
});

test("candidate CLI accepts the trusted fixture but reports a blocked handoff", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(here, "recurring-third-party-review-evidence-reconciler.mjs"),
      resolve(here, "fixtures", "approved-review-cycle.input.json"),
      asOf,
      resolve(here, "fixtures", "public-trust.test.json"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.result.handoff.state, "blocked");
  assert.deepEqual(output.result.handoff.blockerCodes, expected.handoff.blockerCodes);
});
