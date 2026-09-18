import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeCellIndexRevision,
  computeCellDigest,
  computeExceptionScopeDigest,
  computeFreshnessRuleRevision,
  computePredecessorArtifactDigest,
  computeRequirementCatalogRevision,
  evaluateRecurringThirdPartyReview,
  ownerManifestPayload,
  predecessorAuthorityPayload,
  RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS,
  recurringThirdPartyReviewFindings,
  renderReviewProof,
  sourceReceiptsPayload,
  sourceAuthorityPayload,
} from "./recurring-third-party-review-evidence-reconciler.mjs";
import {
  artifactSemanticValidationOptions,
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";
import {
  contractObligationTrackerFindings,
} from "./contract-obligation-tracker.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const sourceRoot = resolve(root, "sources", "recurring-third-party-review-evidence-reconciler");
const asOf = "2026-09-16T20:00:00Z";
const fixture = JSON.parse(
  await readFile(resolve(sourceRoot, "fixtures", "recurring-third-party-review-evidence-reconciler.example.json"), "utf8"),
);
const publicTrust = JSON.parse(
  await readFile(resolve(sourceRoot, "fixtures", "public-trust.example.json"), "utf8"),
);
const sourceReceipts = JSON.parse(
  await readFile(resolve(sourceRoot, "fixtures", "source-receipts.example.json"), "utf8"),
);
const expected = JSON.parse(
  await readFile(resolve(sourceRoot, "fixtures", "blocked-handoff.expected.json"), "utf8"),
);
const expectedFailure = JSON.parse(
  await readFile(resolve(sourceRoot, "fixtures", "prohibited-score.failure.json"), "utf8"),
);
const proof = await readFile(resolve(sourceRoot, "references", "blocked-handoff.md"), "utf8");
const clone = () => structuredClone(fixture);
const evaluate = (input = fixture, options = {}) =>
  evaluateRecurringThirdPartyReview(input, {
    asOf,
    publicTrust,
    sourceReceipts,
    ...options,
  });

function signWithEphemeralTrust(input) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  input.sourceAuthority.signingKeyId = "key-adversarial-current";
  input.sourceAuthority.signature = signPayload(
    null,
    sourceAuthorityPayload(input),
    privateKey,
  ).toString("base64");
  const trust = structuredClone(publicTrust);
  trust.signers = trust.signers.filter(
    (item) => item.signingKeyId !== "key-third-party-review-2026",
  );
  trust.signers.push({
    ownerRef: input.sourceAuthority.ownerRef,
    signingKeyId: input.sourceAuthority.signingKeyId,
    algorithm: "Ed25519",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    validFrom: "2026-07-01T00:00:00Z",
    validUntil: "2027-06-30T23:59:59Z",
  });
  return trust;
}

function signDetachedWithEphemeralTrust({
  record,
  payload,
  trust,
  replacedKeyId,
  signingKeyId,
}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  record.signingKeyId = signingKeyId;
  record.signature = signPayload(null, payload(), privateKey).toString("base64");
  trust.signers = trust.signers.filter(
    (item) => item.signingKeyId !== replacedKeyId,
  );
  trust.signers.push({
    ownerRef: record.ownerRef,
    signingKeyId,
    algorithm: "Ed25519",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    validFrom: "2025-01-01T00:00:00Z",
    validUntil: "2027-12-31T23:59:59Z",
  });
}

function readyOneServicePortfolio() {
  const input = clone();
  const trust = structuredClone(publicTrust);
  const receipts = structuredClone(sourceReceipts);
  const serviceRef = "vendor-service-alpine-support";
  const retainedCellRefs = new Set([
    "cell-alpine-assurance",
    "cell-alpine-security",
    "cell-alpine-subprocessor",
  ]);
  input.vendorServices = input.vendorServices.filter(
    (item) => item.id === serviceRef,
  );
  input.subprocessors[0].serviceRefs = [serviceRef];
  input.requirementCatalog.requirements =
    input.requirementCatalog.requirements.filter(
      (item) => item.id !== "requirement-continuity-test",
    );
  input.requirementCatalog.cells = input.requirementCatalog.cells.filter(
    (item) => retainedCellRefs.has(item.id),
  );
  input.requirementCatalog.revision = computeRequirementCatalogRevision(
    input.requirementCatalog,
  );
  input.cycle.requirementCatalogRevision = input.requirementCatalog.revision;
  input.cycle.cellIndexRevision = computeCellIndexRevision(
    input.requirementCatalog,
  );
  input.predecessorCycle.requirementCatalogRevision =
    input.requirementCatalog.revision;
  input.predecessorCycle.cellIndexRevision = input.cycle.cellIndexRevision;
  input.predecessorCycle.decisions =
    input.predecessorCycle.decisions.filter((item) =>
      retainedCellRefs.has(item.cellRef),
    );
  input.decisions = input.decisions.filter((item) =>
    retainedCellRefs.has(item.cellRef),
  );
  for (const decision of [
    ...input.predecessorCycle.decisions,
    ...input.decisions,
  ]) {
    decision.requirementCatalogRevision = input.requirementCatalog.revision;
    decision.cellIndexRevision = input.cycle.cellIndexRevision;
  }
  const assuranceDecision = input.decisions.find(
    (item) => item.cellRef === "cell-alpine-assurance",
  );
  assuranceDecision.decisionType = "evidence-confirmed";
  assuranceDecision.evidenceRefs = ["evidence-alpine-assurance-report"];
  assuranceDecision.remediationRef = null;
  input.remediations = [];
  input.exceptions = [];
  input.riskAcceptanceAttempts = [];
  input.principals = input.principals.filter(
    (item) =>
      ![
        "principal-service-owner-ethan",
        "principal-remediation-owner-sam",
        "principal-exception-authority-jordan",
      ].includes(item.id),
  );
  input.ownerManifests = input.ownerManifests.filter(
    (item) =>
      item.kind === "requirement-catalog" || item.subjectRef === serviceRef,
  );
  const catalogManifest = input.ownerManifests.find(
    (item) => item.kind === "requirement-catalog",
  );
  catalogManifest.subjectDigest = input.requirementCatalog.revision;
  input.evidence = input.evidence.filter(
    (item) =>
      item.id === input.cycle.approvalEvidenceRef ||
      retainedCellRefs.has(item.subjectRef) ||
      item.subjectRef === "subprocessor-shared-cloud",
  );
  const subprocessorEvidence = input.evidence.find(
    (item) => item.id === "evidence-shared-subprocessor-disclosure",
  );
  subprocessorEvidence.cellRefs = ["cell-alpine-subprocessor"];
  const assuranceEvidence = input.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  );
  assuranceEvidence.observedAt = "2026-01-10T12:00:00Z";
  assuranceEvidence.validUntil = "2027-01-10T12:00:00Z";
  const evidenceRefs = new Set(input.evidence.map((item) => item.id));
  receipts.receipts = receipts.receipts.filter((item) =>
    evidenceRefs.has(item.evidenceRef),
  );

  input.predecessorCycle.artifactDigest = computePredecessorArtifactDigest(
    input.predecessorCycle,
    input.evidence,
  );
  signDetachedWithEphemeralTrust({
    record: input.predecessorCycle.sourceAuthority,
    payload: () => predecessorAuthorityPayload(input.predecessorCycle),
    trust,
    replacedKeyId: "key-third-party-review-predecessor-2026",
    signingKeyId: "key-ready-predecessor",
  });
  signDetachedWithEphemeralTrust({
    record: catalogManifest,
    payload: () => ownerManifestPayload(catalogManifest),
    trust,
    replacedKeyId: "key-catalog-owner-2026",
    signingKeyId: "key-ready-catalog-owner",
  });
  signDetachedWithEphemeralTrust({
    record: receipts,
    payload: () => sourceReceiptsPayload(receipts),
    trust,
    replacedKeyId: "key-evidence-receipts-2026",
    signingKeyId: "key-ready-evidence-receipts",
  });
  signDetachedWithEphemeralTrust({
    record: input.sourceAuthority,
    payload: () => sourceAuthorityPayload(input),
    trust,
    replacedKeyId: "key-third-party-review-2026",
    signingKeyId: "key-ready-current",
  });
  return { input, trust, receipts };
}

function exceptionTransitionPortfolio({ reopen }) {
  const input = clone();
  const trust = structuredClone(publicTrust);
  const receipts = structuredClone(sourceReceipts);
  const cellRef = "cell-brightpay-security";
  input.principals.find(
    (item) => item.id === "principal-exception-authority-jordan",
  ).authorityObservedAt = "2026-01-01T12:35:00Z";
  input.evidence = input.evidence.filter(
    (item) => item.id !== "evidence-brightpay-security-questionnaire",
  );
  receipts.receipts = receipts.receipts.filter(
    (item) => item.evidenceRef !== "evidence-brightpay-security-questionnaire",
  );
  const oldExceptionEvidence = {
    ...structuredClone(
      input.evidence.find(
        (item) => item.id === "evidence-exception-brightpay-security",
      ),
    ),
    id: "evidence-exception-brightpay-security-predecessor",
    subjectRef: "exception-brightpay-security-predecessor",
    sourceRef:
      "controlled://third-party-review/exceptions/brightpay-security-2026-q2",
    sourceVersion: "v1",
    observedAt: "2026-01-20T16:05:00Z",
    validUntil: "2026-07-31T23:59:59Z",
  };
  const addReceipt = (evidenceItem, text) => {
    const bytes = Buffer.from(text, "utf8");
    evidenceItem.sourceContentDigest = `sha256:${createHash("sha256")
      .update(bytes)
      .digest("hex")}`;
    receipts.receipts.push({
      evidenceRef: evidenceItem.id,
      sourceRef: evidenceItem.sourceRef,
      sourceVersion: evidenceItem.sourceVersion,
      contentBase64: bytes.toString("base64"),
      contentDigest: evidenceItem.sourceContentDigest,
    });
  };
  addReceipt(oldExceptionEvidence, "predecessor exception approval\n");
  input.evidence.push(oldExceptionEvidence);
  const oldException = {
    ...structuredClone(input.exceptions[0]),
    id: "exception-brightpay-security-predecessor",
    status: "expired",
    approvedAt: "2026-01-20T16:00:00Z",
    expiresAt: "2026-07-31T23:59:59Z",
    evidenceRef: oldExceptionEvidence.id,
  };
  oldException.scopeDigest = computeExceptionScopeDigest(oldException);
  input.exceptions.push(oldException);
  const predecessorDecision = input.predecessorCycle.decisions.find(
    (item) => item.cellRef === cellRef,
  );
  predecessorDecision.decisionType = "exception-recorded";
  predecessorDecision.evidenceRefs = [oldExceptionEvidence.id];

  if (reopen) {
    const currentException = input.exceptions.find(
      (item) => item.id === "exception-brightpay-security",
    );
    input.exceptions = input.exceptions.filter(
      (item) => item.id !== currentException.id,
    );
    input.evidence = input.evidence.filter(
      (item) => item.id !== currentException.evidenceRef,
    );
    receipts.receipts = receipts.receipts.filter(
      (item) => item.evidenceRef !== currentException.evidenceRef,
    );
    const remediationEvidence = {
      id: "evidence-remediation-brightpay-security",
      kind: "remediation-record",
      subjectType: "remediation",
      subjectRef: "remediation-brightpay-security",
      cellRefs: [cellRef],
      sourceClass: "owner-controlled",
      sourceRef:
        "controlled://third-party-review/remediations/brightpay-security-2026-q3",
      sourceVersion: "v1",
      observedAt: "2026-09-01T14:05:00Z",
      validUntil: "2026-12-01T14:05:00Z",
      suppliedByRef: "principal-remediation-owner-sam",
      sourceContentDigest: "",
    };
    addReceipt(remediationEvidence, "brightpay remediation record\n");
    input.evidence.push(remediationEvidence);
    const remediation = {
      id: "remediation-brightpay-security",
      cellRef,
      ownerRef: "principal-remediation-owner-sam",
      state: "in-progress",
      cause: "evidence-expired",
      expiredEvidenceRef: oldExceptionEvidence.id,
      predecessorDecisionRef: predecessorDecision.id,
      openedAt: "2026-09-01T14:00:00Z",
      dueAt: "2026-09-30T17:00:00Z",
      evidenceRef: remediationEvidence.id,
    };
    input.remediations.push(remediation);
    const currentDecision = input.decisions.find(
      (item) => item.cellRef === cellRef,
    );
    currentDecision.decisionType = "evidence-expired-reopened";
    currentDecision.evidenceRefs = [
      oldExceptionEvidence.id,
      remediationEvidence.id,
    ];
    currentDecision.remediationRef = remediation.id;
    currentDecision.exceptionRef = null;
  }

  input.predecessorCycle.artifactDigest = computePredecessorArtifactDigest(
    input.predecessorCycle,
    input.evidence,
  );
  signDetachedWithEphemeralTrust({
    record: input.predecessorCycle.sourceAuthority,
    payload: () => predecessorAuthorityPayload(input.predecessorCycle),
    trust,
    replacedKeyId: "key-third-party-review-predecessor-2026",
    signingKeyId: "key-exception-transition-predecessor",
  });
  signDetachedWithEphemeralTrust({
    record: receipts,
    payload: () => sourceReceiptsPayload(receipts),
    trust,
    replacedKeyId: "key-source-receipts-2026",
    signingKeyId: "key-exception-transition-receipts",
  });
  signDetachedWithEphemeralTrust({
    record: input.sourceAuthority,
    payload: () => sourceAuthorityPayload(input),
    trust,
    replacedKeyId: "key-third-party-review-2026",
    signingKeyId: "key-exception-transition-current",
  });
  return { input, trust, receipts };
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
      subprocessorRefs: evaluation.result.scope.subprocessorRefs,
      publicTrustEvidenceRefs: evaluation.result.scope.publicTrustEvidenceRefs,
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

test("authenticated variable portfolio reaches owner-ready with no blockers", () => {
  const { input, trust, receipts } = readyOneServicePortfolio();
  const evaluation = evaluateRecurringThirdPartyReview(input, {
    asOf,
    publicTrust: trust,
    sourceReceipts: receipts,
  });
  assert.equal(evaluation.valid, true, JSON.stringify(evaluation.findings, null, 2));
  assert.deepEqual(evaluation.findings, []);
  assert.deepEqual(evaluation.result.scope.vendorServiceRefs, [
    "vendor-service-alpine-support",
  ]);
  assert.equal(evaluation.result.coverage.declaredCellRefs.length, 3);
  assert.deepEqual(evaluation.result.scope.remediationRefs, []);
  assert.deepEqual(evaluation.result.scope.exceptionRefs, []);
  assert.deepEqual(evaluation.result.scope.riskAcceptanceAttemptRefs, []);
  assert.deepEqual(evaluation.result.reopenedCells, []);
  assert.deepEqual(evaluation.result.blockers, []);
  assert.equal(evaluation.result.handoff.state, "ready-for-owner-review");
});

test("owner freshness rules may derive expiry without an explicit validUntil", () => {
  const { input, trust, receipts } = readyOneServicePortfolio();
  input.freshnessRules.find(
    (item) => item.evidenceKind === "assurance-report",
  ).explicitValidUntilRequired = false;
  delete input.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).validUntil;
  const freshnessRuleRevision = computeFreshnessRuleRevision(
    input.freshnessRules,
  );
  input.cycle.freshnessRuleRevision = freshnessRuleRevision;
  input.predecessorCycle.freshnessRuleRevision = freshnessRuleRevision;
  for (const decision of [
    ...input.predecessorCycle.decisions,
    ...input.decisions,
  ]) {
    decision.freshnessRuleRevision = freshnessRuleRevision;
  }
  input.predecessorCycle.artifactDigest = computePredecessorArtifactDigest(
    input.predecessorCycle,
    input.evidence,
  );
  signDetachedWithEphemeralTrust({
    record: input.predecessorCycle.sourceAuthority,
    payload: () => predecessorAuthorityPayload(input.predecessorCycle),
    trust,
    replacedKeyId: "key-ready-predecessor",
    signingKeyId: "key-age-derived-predecessor",
  });
  signDetachedWithEphemeralTrust({
    record: input.sourceAuthority,
    payload: () => sourceAuthorityPayload(input),
    trust,
    replacedKeyId: "key-ready-current",
    signingKeyId: "key-age-derived-current",
  });
  const evaluation = evaluateRecurringThirdPartyReview(input, {
    asOf,
    publicTrust: trust,
    sourceReceipts: receipts,
  });
  assert.equal(evaluation.valid, true, JSON.stringify(evaluation.findings, null, 2));
  assert.equal(
    evaluation.result.evidenceStates.find(
      (item) => item.evidenceRef === "evidence-alpine-assurance-report",
    ).state,
    "current",
  );

  const required = clone();
  delete required.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).validUntil;
  assert.ok(
    evaluate(required).findings.some(
      (item) => item.code === "missing-explicit-evidence-expiry",
    ),
  );
});

test("expired predecessor exceptions can be renewed or reopened", () => {
  for (const reopen of [false, true]) {
    const { input, trust, receipts } = exceptionTransitionPortfolio({ reopen });
    const evaluation = evaluateRecurringThirdPartyReview(input, {
      asOf,
      publicTrust: trust,
      sourceReceipts: receipts,
    });
    assert.equal(
      evaluation.valid,
      true,
      `${reopen ? "reopen" : "renew"}: ${JSON.stringify(evaluation.findings, null, 2)}`,
    );
    const reopenedCell = evaluation.result.reopenedCells.find(
      (item) => item.cellRef === "cell-brightpay-security",
    );
    if (reopen) {
      assert.deepEqual(reopenedCell, {
        cellRef: "cell-brightpay-security",
        predecessorDecisionRef: "predecessor-decision-brightpay-security",
        expiredEvidenceRefs: [
          "evidence-exception-brightpay-security-predecessor",
        ],
        remediationRef: "remediation-brightpay-security",
      });
    } else {
      assert.equal(reopenedCell, undefined);
    }
  }
});

test("semantic registry exposes the public validator and example context", () => {
  assert.equal(
    hasArtifactSemanticValidator(
      "recurring-third-party-review-evidence-reconciler",
    ),
    true,
  );
  assert.deepEqual(
    artifactSemanticValidationOptions(
      "recurring-third-party-review-evidence-reconciler",
    ),
    RECURRING_THIRD_PARTY_REVIEW_EXAMPLE_OPTIONS,
  );
  assert.deepEqual(
    recurringThirdPartyReviewFindings(
      fixture,
      artifactSemanticValidationOptions(
        "recurring-third-party-review-evidence-reconciler",
      ),
    ),
    [],
  );
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

  for (const hostile of [
    {
      toJSON() {
        throw new Error("hostile input toJSON");
      },
    },
    {
      toJSON() {
        return undefined;
      },
    },
  ]) {
    assert.doesNotThrow(() => evaluateRecurringThirdPartyReview(hostile));
    assert.ok(
      evaluateRecurringThirdPartyReview(hostile).findings.some(
        (item) => item.code === "invalid-json-input",
      ),
    );
  }
});

test("validator normalizes null and non-record contexts and hostile trust serialization", () => {
  for (const context of [null, [], "not-a-context", 42]) {
    assert.doesNotThrow(() =>
      evaluateRecurringThirdPartyReview(fixture, context),
    );
    const evaluation = evaluateRecurringThirdPartyReview(fixture, context);
    assert.equal(evaluation.valid, false);
    assert.equal(evaluation.result, null);
    assert.ok(
      evaluation.findings.some(
        (item) => item.code === "invalid-validation-context",
      ),
    );
    assert.doesNotThrow(() =>
      recurringThirdPartyReviewFindings(fixture, context),
    );
    assert.ok(
      recurringThirdPartyReviewFindings(fixture, context).some(
        (item) => item.code === "invalid-validation-context",
      ),
    );
  }
  let optionProxyRead = false;
  const optionProxy = new Proxy(
    {},
    {
      get() {
        optionProxyRead = true;
        throw new Error("semantic option proxy executed");
      },
    },
  );
  assert.doesNotThrow(() =>
    recurringThirdPartyReviewFindings(fixture, optionProxy),
  );
  assert.equal(optionProxyRead, false);
  assert.ok(
    recurringThirdPartyReviewFindings(fixture, optionProxy).some(
      (item) => item.code === "invalid-validation-context",
    ),
  );
  for (const publicTrustValue of [
    {
      toJSON() {
        throw new Error("hostile public trust toJSON");
      },
    },
    {
      toJSON() {
        return undefined;
      },
    },
  ]) {
    assert.doesNotThrow(() =>
      evaluateRecurringThirdPartyReview(fixture, {
        asOf,
        publicTrust: publicTrustValue,
      }),
    );
    assert.ok(
      evaluateRecurringThirdPartyReview(fixture, {
        asOf,
        publicTrust: publicTrustValue,
      }).findings.some((item) => item.code === "invalid-validation-context"),
    );
  }
  let getterRead = false;
  const getterContext = { asOf, sourceReceipts };
  Object.defineProperty(getterContext, "publicTrust", {
    enumerable: true,
    get() {
      getterRead = true;
      throw new Error("context getter executed");
    },
  });
  assert.doesNotThrow(() =>
    evaluateRecurringThirdPartyReview(fixture, getterContext),
  );
  assert.equal(getterRead, false);
  assert.ok(
    evaluateRecurringThirdPartyReview(fixture, getterContext).findings.some(
      (item) => item.code === "invalid-validation-context",
    ),
  );

  const privateReceipts = structuredClone(sourceReceipts);
  privateReceipts.privateKeyMaterial =
    "-----BEGIN PRIVATE KEY-----\nsecret-context\n-----END PRIVATE KEY-----";
  const privateReceiptResult = evaluateRecurringThirdPartyReview(fixture, {
    asOf,
    publicTrust,
    sourceReceipts: privateReceipts,
  });
  assert.equal(
    privateReceiptResult.findings[0].code,
    "invalid-validation-context",
  );
  assert.doesNotMatch(
    JSON.stringify(privateReceiptResult),
    /secret-context/u,
  );
});

test("normalization rejects private keys and pre-read resource attacks without echo", () => {
  const privateValue =
    "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-material\n-----END OPENSSH PRIVATE KEY-----";
  const privateEnvelope = clone();
  privateEnvelope.privateKeyMaterial = privateValue;
  const privateResult = evaluate(privateEnvelope);
  assert.equal(privateResult.valid, false);
  assert.equal(privateResult.findings[0].code, "private-key-material-prohibited");
  assert.doesNotMatch(JSON.stringify(privateResult), /secret-material/u);

  const hiddenPrivate = clone();
  Object.defineProperty(hiddenPrivate, "privateKeyMaterial", {
    enumerable: false,
    value: privateValue,
  });
  const hiddenPrivateResult = evaluate(hiddenPrivate);
  assert.equal(
    hiddenPrivateResult.findings[0].code,
    "private-key-material-prohibited",
  );
  assert.doesNotMatch(
    JSON.stringify(hiddenPrivateResult),
    /secret-material/u,
  );

  let hiddenGetterRead = false;
  const hiddenGetter = clone();
  Object.defineProperty(hiddenGetter, "hidden", {
    enumerable: false,
    get() {
      hiddenGetterRead = true;
      throw new Error("hidden getter executed");
    },
  });
  assert.doesNotThrow(() => evaluate(hiddenGetter));
  assert.equal(hiddenGetterRead, false);
  assert.equal(evaluate(hiddenGetter).findings[0].code, "invalid-json-input");

  const symbolInput = clone();
  symbolInput[Symbol("hidden")] = "value";
  assert.equal(evaluate(symbolInput).findings[0].code, "invalid-json-input");

  const hiddenValue = clone();
  Object.defineProperty(hiddenValue, "hidden", {
    enumerable: false,
    value: "value",
  });
  assert.equal(evaluate(hiddenValue).findings[0].code, "invalid-json-input");

  let getterRead = false;
  const getterEnvelope = clone();
  Object.defineProperty(getterEnvelope, "hostile", {
    enumerable: true,
    get() {
      getterRead = true;
      throw new Error("candidate getter executed");
    },
  });
  assert.doesNotThrow(() => evaluate(getterEnvelope));
  assert.equal(getterRead, false);
  assert.equal(evaluate(getterEnvelope).findings[0].code, "invalid-json-input");

  const deep = clone();
  let cursor = {};
  deep.excessiveDepth = cursor;
  for (let index = 0; index < 40; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.equal(evaluate(deep).findings[0].code, "input-limit-exceeded");

  const oversized = clone();
  oversized.oversized = "x".repeat(1024 * 1024);
  let lateGetterRead = false;
  Object.defineProperty(oversized, "lateGetter", {
    enumerable: true,
    get() {
      lateGetterRead = true;
      throw new Error("late getter executed");
    },
  });
  assert.equal(evaluate(oversized).findings[0].code, "input-limit-exceeded");
  assert.equal(lateGetterRead, false);

  const excessiveCardinality = clone();
  excessiveCardinality.excessive = Array.from({ length: 65 }, () => null);
  assert.equal(
    evaluate(excessiveCardinality).findings[0].code,
    "input-limit-exceeded",
  );

  const excessiveProperties = clone();
  excessiveProperties.excessive = Object.fromEntries(
    Array.from({ length: 129 }, (_, index) => [
      `field${index}`,
      "x".repeat(16 * 1024),
    ]),
  );
  assert.equal(
    evaluate(excessiveProperties).findings[0].code,
    "input-limit-exceeded",
  );

  let lengthRead = false;
  const proxyArray = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") {
        lengthRead = true;
        throw new Error("array length getter executed");
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const proxyInput = clone();
  proxyInput.evidence = proxyArray;
  assert.doesNotThrow(() => evaluate(proxyInput));
  assert.equal(lengthRead, false);
  assert.ok(
    evaluate(proxyInput).findings.some((item) => item.code === "invalid-json-input"),
  );

  const nestedProxyInput = clone();
  nestedProxyInput.ownerManifests[0] = new Proxy(
    nestedProxyInput.ownerManifests[0],
    {},
  );
  assert.doesNotThrow(() => evaluate(nestedProxyInput));
  assert.equal(
    evaluate(nestedProxyInput).findings[0].code,
    "invalid-json-input",
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
  assert.equal(fixture.ownerManifests.length, 3);
  assert.equal(sourceReceipts.receipts.length, fixture.evidence.length);
  assert.equal(
    fixture.predecessorCycle.artifactDigest,
    computePredecessorArtifactDigest(
      fixture.predecessorCycle,
      fixture.evidence,
    ),
  );
  for (const decision of [
    ...fixture.predecessorCycle.decisions,
    ...fixture.decisions,
  ]) {
    assert.equal(
      decision.cellDigest,
      computeCellDigest(
        fixture.requirementCatalog.cells.find(
          (cell) => cell.id === decision.cellRef,
        ),
      ),
    );
  }
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
      (item) => item.code === "invalid-validation-context",
    ),
  );
});

test("public trust is strict and rejects every private PEM label anywhere", () => {
  const crlfTrust = structuredClone(publicTrust);
  crlfTrust.signers[0].publicKeyPem =
    crlfTrust.signers[0].publicKeyPem.replaceAll("\n", "\r\n");
  const crlfResult = evaluate(fixture, { publicTrust: crlfTrust });
  assert.equal(crlfResult.valid, true, JSON.stringify(crlfResult.findings));

  const rootExtra = structuredClone(publicTrust);
  rootExtra.metadata = "not trusted";
  assert.ok(
    evaluate(fixture, { publicTrust: rootExtra }).findings.some(
      (item) =>
        item.code === "invalid-public-trust-input" &&
        item.message.includes("additional properties"),
    ),
  );

  const signerExtra = structuredClone(publicTrust);
  signerExtra.signers[0].metadata = "not trusted";
  assert.ok(
    evaluate(fixture, { publicTrust: signerExtra }).findings.some(
      (item) =>
        item.code === "invalid-public-trust-input" &&
        item.message.includes("additional properties"),
    ),
  );

  const tooManySigners = structuredClone(publicTrust);
  while (tooManySigners.signers.length < 65) {
    tooManySigners.signers.push({
      ...structuredClone(tooManySigners.signers[0]),
      signingKeyId: `key-extra-${tooManySigners.signers.length}`,
    });
  }
  assert.ok(
    evaluate(fixture, { publicTrust: tooManySigners }).findings.some(
      (item) =>
        item.code === "invalid-public-trust-input" ||
        item.code === "invalid-validation-context",
    ),
  );

  for (const label of [
    "RSA PRIVATE KEY",
    "EC PRIVATE KEY",
    "OPENSSH PRIVATE KEY",
    "ENCRYPTED PRIVATE KEY",
    "PRIVATE KEY",
  ]) {
    const changed = structuredClone(publicTrust);
    changed.signers[0].publicKeyPem =
      `-----BEGIN ${label}-----\nZmFrZQ==\n-----END ${label}-----\n`;
    const evaluation = evaluate(fixture, { publicTrust: changed });
    assert.ok(
      evaluation.findings.some(
        (item) => item.code === "invalid-public-trust-key",
      ),
      label,
    );
  }

  const nestedPrivateMaterial = structuredClone(publicTrust);
  nestedPrivateMaterial.signers[0].metadata = {
    note: "-----BEGIN RSA PRIVATE KEY-----\nZmFrZQ==\n-----END RSA PRIVATE KEY-----",
  };
  assert.ok(
    evaluate(fixture, { publicTrust: nestedPrivateMaterial }).findings.some(
      (item) => item.code === "invalid-public-trust-key",
    ),
  );

  const privateProperty = structuredClone(publicTrust);
  privateProperty.signers[0].privateKeyMaterial = "redacted";
  assert.ok(
    evaluate(fixture, { publicTrust: privateProperty }).findings.some(
      (item) => item.code === "invalid-public-trust-key",
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

test("decisions bind immutable cell and revision context", () => {
  for (const field of [
    "requirementCatalogRevision",
    "cellIndexRevision",
    "freshnessRuleRevision",
    "cellDigest",
  ]) {
    const current = clone();
    current.decisions[0][field] =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const currentTrust = signWithEphemeralTrust(current);
    const currentResult = evaluate(current, { publicTrust: currentTrust });
    assert.equal(
      currentResult.findings.some(
        (item) => item.code === "source-envelope-signature-invalid",
      ),
      false,
    );
    assert.ok(
      currentResult.findings.some(
        (item) => item.code === "invalid-typed-human-decision",
      ),
      field,
    );

    const predecessor = clone();
    predecessor.predecessorCycle.decisions[0][field] =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    predecessor.predecessorCycle.artifactDigest =
      computePredecessorArtifactDigest(
        predecessor.predecessorCycle,
        predecessor.evidence,
      );
    const predecessorTrust = signWithEphemeralTrust(predecessor);
    const predecessorResult = evaluate(predecessor, {
      publicTrust: predecessorTrust,
    });
    assert.equal(
      predecessorResult.findings.some(
        (item) => item.code === "source-envelope-signature-invalid",
      ),
      false,
    );
    assert.ok(
      predecessorResult.findings.some(
        (item) => item.code === "invalid-predecessor-artifact-signature",
      ),
      field,
    );
    assert.ok(
      predecessorResult.findings.some(
        (item) => item.code === "invalid-predecessor-decision",
      ),
      field,
    );
  }

  const backdatedAuthority = clone();
  backdatedAuthority.principals.find(
    (item) => item.id === "principal-program-owner-ava",
  ).authorityObservedAt = "2026-07-02T12:00:00Z";
  const backdatedTrust = signWithEphemeralTrust(backdatedAuthority);
  const backdatedResult = evaluate(backdatedAuthority, {
    publicTrust: backdatedTrust,
  });
  assert.equal(
    backdatedResult.findings.some(
      (item) => item.code === "source-envelope-signature-invalid",
    ),
    false,
  );
  assert.ok(
    backdatedResult.findings.some(
      (item) => item.code === "invalid-predecessor-artifact-signature",
    ),
  );
});

test("owner manifests independently reject omission and service reassignment", () => {
  const omitted = clone();
  omitted.ownerManifests.find(
    (item) => item.subjectRef === "vendor-service-alpine-support",
  ).cellRefs.pop();
  const omittedTrust = signWithEphemeralTrust(omitted);
  const omittedResult = evaluate(omitted, { publicTrust: omittedTrust });
  assert.equal(
    omittedResult.findings.some(
      (item) => item.code === "source-envelope-signature-invalid",
    ),
    false,
  );
  assert.ok(
    omittedResult.findings.some(
      (item) =>
        item.code === "invalid-owner-manifest" ||
        item.code === "invalid-owner-manifest-signature",
    ),
  );

  const swapped = clone();
  const cell = swapped.requirementCatalog.cells.find(
    (item) => item.id === "cell-alpine-security",
  );
  cell.vendorServiceRef = "vendor-service-brightpay-payroll";
  cell.ownerRef = "principal-service-owner-ethan";
  swapped.cycle.cellIndexRevision = computeCellIndexRevision(
    swapped.requirementCatalog,
  );
  swapped.predecessorCycle.cellIndexRevision = swapped.cycle.cellIndexRevision;
  for (const decision of swapped.decisions) {
    decision.cellIndexRevision = swapped.cycle.cellIndexRevision;
    decision.cellDigest = computeCellDigest(
      swapped.requirementCatalog.cells.find(
        (candidate) => candidate.id === decision.cellRef,
      ),
    );
  }
  for (const decision of swapped.predecessorCycle.decisions) {
    decision.cellIndexRevision = swapped.predecessorCycle.cellIndexRevision;
    decision.cellDigest = computeCellDigest(
      swapped.requirementCatalog.cells.find(
        (candidate) => candidate.id === decision.cellRef,
      ),
    );
  }
  swapped.predecessorCycle.artifactDigest =
    computePredecessorArtifactDigest(
      swapped.predecessorCycle,
      swapped.evidence,
    );
  const swappedTrust = signWithEphemeralTrust(swapped);
  const swappedResult = evaluate(swapped, { publicTrust: swappedTrust });
  assert.ok(
    swappedResult.findings.some(
      (item) => item.code === "invalid-owner-manifest",
    ),
  );

  const duplicateService = clone();
  duplicateService.ownerManifests[2] = structuredClone(
    duplicateService.ownerManifests[1],
  );
  const duplicateTrust = signWithEphemeralTrust(duplicateService);
  const duplicateResult = evaluate(duplicateService, {
    publicTrust: duplicateTrust,
  });
  assert.ok(
    duplicateResult.findings.some(
      (item) => item.code === "inexact-owner-manifest-closure",
    ),
  );

  const late = clone();
  const lateManifest = late.ownerManifests.find(
    (item) => item.subjectRef === "vendor-service-alpine-support",
  );
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  lateManifest.signingKeyId = "key-adversarial-late-owner";
  lateManifest.issuedAt = "2026-09-16T19:30:00Z";
  lateManifest.signature = signPayload(
    null,
    ownerManifestPayload(lateManifest),
    privateKey,
  ).toString("base64");
  const lateTrust = signWithEphemeralTrust(late);
  lateTrust.signers = lateTrust.signers.filter(
    (item) => item.ownerRef !== lateManifest.ownerRef,
  );
  lateTrust.signers.push({
    ownerRef: lateManifest.ownerRef,
    signingKeyId: lateManifest.signingKeyId,
    algorithm: "Ed25519",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2027-01-01T00:00:00Z",
  });
  const lateResult = evaluate(late, { publicTrust: lateTrust });
  assert.equal(
    lateResult.findings.some(
      (item) => item.code === "source-envelope-signature-invalid",
    ),
    false,
  );
  assert.ok(
    lateResult.findings.some(
      (item) => item.code === "invalid-owner-manifest-signature",
    ),
  );
});

test("independent owners cannot share public key material", () => {
  const changed = clone();
  const changedTrust = structuredClone(publicTrust);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  for (const signingKeyId of [
    changed.sourceAuthority.signingKeyId,
    "key-catalog-owner-2026",
  ]) {
    changedTrust.signers.find(
      (item) => item.signingKeyId === signingKeyId,
    ).publicKeyPem = publicKeyPem;
  }
  const catalogManifest = changed.ownerManifests.find(
    (item) => item.kind === "requirement-catalog",
  );
  catalogManifest.signature = signPayload(
    null,
    ownerManifestPayload(catalogManifest),
    privateKey,
  ).toString("base64");
  changed.sourceAuthority.signature = signPayload(
    null,
    sourceAuthorityPayload(changed),
    privateKey,
  ).toString("base64");
  const evaluation = evaluate(changed, { publicTrust: changedTrust });
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "non-independent-public-trust-key",
    ),
  );
});

test("signed source receipts reject HTTPS digest substitution", () => {
  const changed = clone();
  changed.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).sourceContentDigest =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const changedTrust = signWithEphemeralTrust(changed);
  const evaluation = evaluate(changed, { publicTrust: changedTrust });
  assert.equal(
    evaluation.findings.some(
      (item) => item.code === "source-envelope-signature-invalid",
    ),
    false,
  );
  assert.ok(
    evaluation.findings.some(
      (item) => item.code === "invalid-source-receipt",
    ),
  );

  const changedReceipts = structuredClone(sourceReceipts);
  changedReceipts.receipts.find(
    (item) => item.evidenceRef === "evidence-alpine-assurance-report",
  ).contentBase64 = Buffer.from("attacker-controlled bytes").toString("base64");
  const receiptResult = evaluate(fixture, {
    sourceReceipts: changedReceipts,
  });
  assert.ok(
    receiptResult.findings.some(
      (item) =>
        item.code === "invalid-source-receipt" ||
        item.code === "invalid-source-receipt-authority",
    ),
  );

  const coherentInput = clone();
  const coherentReceipts = structuredClone(sourceReceipts);
  const attackerBytes = Buffer.from("attacker-controlled https response");
  const attackerDigest = `sha256:${createHash("sha256")
    .update(attackerBytes)
    .digest("hex")}`;
  coherentInput.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).sourceContentDigest = attackerDigest;
  const attackerReceipt = coherentReceipts.receipts.find(
    (item) => item.evidenceRef === "evidence-alpine-assurance-report",
  );
  attackerReceipt.contentBase64 = attackerBytes.toString("base64");
  attackerReceipt.contentDigest = attackerDigest;
  coherentInput.predecessorCycle.artifactDigest =
    computePredecessorArtifactDigest(
      coherentInput.predecessorCycle,
      coherentInput.evidence,
    );
  const coherentTrust = signWithEphemeralTrust(coherentInput);
  const coherentResult = evaluate(coherentInput, {
    publicTrust: coherentTrust,
    sourceReceipts: coherentReceipts,
  });
  assert.equal(
    coherentResult.findings.some(
      (item) => item.code === "source-envelope-signature-invalid",
    ),
    false,
  );
  assert.ok(
    coherentResult.findings.some(
      (item) => item.code === "invalid-source-receipt-authority",
    ),
  );
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

  const sharedVendor = clone();
  sharedVendor.vendorServices[1].vendorId =
    sharedVendor.vendorServices[0].vendorId;
  assert.equal(
    evaluate(sharedVendor).findings.some(
      (item) => item.code === "invalid-vendor-service-universe",
    ),
    false,
  );

  const duplicateVendorService = clone();
  duplicateVendorService.vendorServices[1].vendorId =
    duplicateVendorService.vendorServices[0].vendorId;
  duplicateVendorService.vendorServices[1].serviceId =
    duplicateVendorService.vendorServices[0].serviceId;
  assert.ok(
    evaluate(duplicateVendorService).findings.some(
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

  const incomplete = clone();
  const trust = structuredClone(publicTrust);
  const receipts = structuredClone(sourceReceipts);
  const secondaryEvidence = {
    ...structuredClone(
      incomplete.evidence.find(
        (item) => item.id === "evidence-alpine-assurance-report",
      ),
    ),
    id: "evidence-alpine-assurance-report-secondary",
    sourceRef: "https://trust.alpine.example/assurance/soc3-2025-secondary",
    sourceVersion: "2025-secondary",
  };
  const secondaryBytes = Buffer.from("secondary expired assurance report\n");
  secondaryEvidence.sourceContentDigest = `sha256:${createHash("sha256")
    .update(secondaryBytes)
    .digest("hex")}`;
  incomplete.evidence.push(secondaryEvidence);
  incomplete.predecessorCycle.decisions[0].evidenceRefs.push(
    secondaryEvidence.id,
  );
  receipts.receipts.push({
    evidenceRef: secondaryEvidence.id,
    sourceRef: secondaryEvidence.sourceRef,
    sourceVersion: secondaryEvidence.sourceVersion,
    contentBase64: secondaryBytes.toString("base64"),
    contentDigest: secondaryEvidence.sourceContentDigest,
  });
  incomplete.predecessorCycle.artifactDigest =
    computePredecessorArtifactDigest(
      incomplete.predecessorCycle,
      incomplete.evidence,
    );
  signDetachedWithEphemeralTrust({
    record: incomplete.predecessorCycle.sourceAuthority,
    payload: () => predecessorAuthorityPayload(incomplete.predecessorCycle),
    trust,
    replacedKeyId: "key-third-party-review-predecessor-2026",
    signingKeyId: "key-multiple-expired-predecessor",
  });
  signDetachedWithEphemeralTrust({
    record: receipts,
    payload: () => sourceReceiptsPayload(receipts),
    trust,
    replacedKeyId: "key-source-receipts-2026",
    signingKeyId: "key-multiple-expired-receipts",
  });
  signDetachedWithEphemeralTrust({
    record: incomplete.sourceAuthority,
    payload: () => sourceAuthorityPayload(incomplete),
    trust,
    replacedKeyId: "key-third-party-review-2026",
    signingKeyId: "key-multiple-expired-current",
  });
  const incompleteResult = evaluateRecurringThirdPartyReview(incomplete, {
    asOf,
    publicTrust: trust,
    sourceReceipts: receipts,
  });
  assert.ok(
    incompleteResult.findings.some(
      (item) => item.code === "invalid-reopened-decision",
    ),
    JSON.stringify(incompleteResult.findings, null, 2),
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

test("typed owner cardinality and evidence closure are exact", () => {
  const extraProgramOwner = clone();
  extraProgramOwner.principals.push({
    ...extraProgramOwner.principals.find(
      (item) => item.id === "principal-reviewer-riley",
    ),
    id: "principal-program-owner-taylor",
    name: "Taylor Gray",
    humanIdentityRef: "controlled://identity/taylor-gray",
    role: "review-program-owner",
  });
  const principalResult = evaluate(extraProgramOwner);
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

test("subprocessor relationships are reciprocal across declared services and cells", () => {
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

  const staleSecond = clone();
  const secondSubprocessor = {
    ...structuredClone(staleSecond.subprocessors[0]),
    id: "subprocessor-shared-cloud-secondary",
    name: "Shared Cloud Secondary",
    declarationEvidenceRef: "evidence-shared-subprocessor-disclosure-secondary",
  };
  staleSecond.subprocessors.push(secondSubprocessor);
  for (const service of staleSecond.vendorServices) {
    service.subprocessorRefs.push(secondSubprocessor.id);
  }
  const staleEvidence = {
    ...structuredClone(
      staleSecond.evidence.find(
        (item) => item.id === "evidence-shared-subprocessor-disclosure",
      ),
    ),
    id: secondSubprocessor.declarationEvidenceRef,
    subjectRef: secondSubprocessor.id,
    sourceRef:
      "controlled://third-party-review/subprocessors/shared-cloud-secondary-2025",
    validUntil: "2026-09-01T00:00:00Z",
  };
  staleSecond.evidence.push(staleEvidence);
  assert.ok(
    evaluate(staleSecond).findings.some(
      (item) => item.code === "invalid-shared-subprocessor-evidence",
    ),
  );
});

test("evidence source classes require their declared URI scheme", () => {
  const changed = clone();
  changed.evidence.find(
    (item) => item.id === "evidence-alpine-assurance-report",
  ).sourceClass = "owner-controlled";
  const evaluation = evaluate(changed);
  assert.ok(
    evaluation.findings.some((item) => item.code === "invalid-evidence-source-class"),
  );

  for (const sourceRef of [
    "https://localhost/private",
    "https://user:password@example.com/report",
    "https://trust.example/report?access_token=secret",
    "https://storage.example/report?X-Amz-Credential=temporary",
    "https://storage.example/report?X-Amz-Signature=abcdef",
    "https://storage.example/report?X-Goog-Signature=abcdef",
    "https://storage.example/report?sv=1&sig=abcdef",
    "https://[::]/private",
    "https://[::ffff:127.0.0.1]/private",
  ]) {
    const unsafePublic = clone();
    unsafePublic.evidence.find(
      (item) => item.id === "evidence-alpine-assurance-report",
    ).sourceRef = sourceRef;
    assert.ok(
      evaluate(unsafePublic).findings.some(
        (item) => item.code === "invalid-evidence-source-class",
      ),
      sourceRef,
    );
  }

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

test("public CLI accepts the trusted fixture but reports a blocked handoff", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(here, "recurring-third-party-review-evidence-reconciler.mjs"),
      resolve(sourceRoot, "fixtures", "recurring-third-party-review-evidence-reconciler.example.json"),
      asOf,
      resolve(sourceRoot, "fixtures", "public-trust.example.json"),
      resolve(sourceRoot, "fixtures", "source-receipts.example.json"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.result.handoff.state, "blocked");
  assert.deepEqual(output.result.handoff.blockerCodes, expected.handoff.blockerCodes);
});

test("packaged Agent Skill verifier executes without repository dependencies", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(
        sourceRoot,
        "skills",
        "recurring-third-party-review-validator",
        "scripts",
        "verify.mjs",
      ),
      resolve(
        sourceRoot,
        "fixtures",
        "recurring-third-party-review-evidence-reconciler.example.json",
      ),
      asOf,
      resolve(sourceRoot, "fixtures", "public-trust.example.json"),
      resolve(sourceRoot, "fixtures", "source-receipts.example.json"),
    ],
    {
      cwd: sourceRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.result.handoff.state, "blocked");
  assert.deepEqual(output.result.handoff.blockerCodes, expected.handoff.blockerCodes);
});

test("generic artifact CLI validates the packaged public fixture", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "scripts", "validate-artifact.mjs"),
      "recurring-third-party-review-evidence-reconciler",
      resolve(
        sourceRoot,
        "fixtures",
        "recurring-third-party-review-evidence-reconciler.example.json",
      ),
      "--as-of",
      asOf,
      "--public-trust",
      resolve(sourceRoot, "fixtures", "public-trust.example.json"),
      "--source-receipts",
      resolve(sourceRoot, "fixtures", "source-receipts.example.json"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("public CLI bounds every file and never echoes parser or file failures", async () => {
  const scratch = resolve(root, ".tmp", `third-party-review-cli-${process.pid}`);
  await mkdir(scratch, { recursive: true });
  const invalidPath = resolve(scratch, "invalid.json");
  const oversizedPath = resolve(scratch, "oversized.json");
  await writeFile(invalidPath, '{"secret-token":');
  await writeFile(oversizedPath, "x".repeat(2 * 1024 * 1024 + 1));
  const validArgs = [
    resolve(sourceRoot, "fixtures", "recurring-third-party-review-evidence-reconciler.example.json"),
    asOf,
    resolve(sourceRoot, "fixtures", "public-trust.example.json"),
    resolve(sourceRoot, "fixtures", "source-receipts.example.json"),
  ];
  try {
    for (const badPath of [invalidPath, oversizedPath]) {
      for (const index of [0, 2, 3]) {
        const args = [...validArgs];
        args[index] = badPath;
        const result = spawnSync(
          process.execPath,
          [resolve(here, "recurring-third-party-review-evidence-reconciler.mjs"), ...args],
          { cwd: root, encoding: "utf8" },
        );
        assert.equal(result.status, 1);
        assert.equal(result.stderr, "");
        const output = JSON.parse(result.stdout);
        assert.equal(output.valid, false);
        assert.deepEqual(output.findings.map((item) => item.code), [
          "invalid-cli-file",
        ]);
        assert.doesNotMatch(result.stdout, /secret-token|SyntaxError|stack|ENOENT/u);
      }
    }
    const missing = spawnSync(
      process.execPath,
      [
        resolve(here, "recurring-third-party-review-evidence-reconciler.mjs"),
        resolve(scratch, "missing.json"),
        asOf,
        validArgs[2],
        validArgs[3],
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(missing.status, 1);
    assert.equal(missing.stderr, "");
    assert.deepEqual(JSON.parse(missing.stdout).findings.map((item) => item.code), [
      "invalid-cli-file",
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
