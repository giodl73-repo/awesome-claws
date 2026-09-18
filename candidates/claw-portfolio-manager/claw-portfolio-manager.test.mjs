import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CANDIDATE_LIMITS,
  CLASSIFICATIONS,
  assessStrongestComposition,
  canonicalJson,
  compositionProofPayload,
  compositionValidatorDigest,
  computeIssueManifestRevision,
  computeIssueUniverseRoot,
  computePortfolioManifestRevision,
  computeSourceReceiptsRevision,
  createFutureCompositionFactArtifact,
  createFutureCompositionSourceArtifacts,
  evaluateClawPortfolio,
  hasExactMockPlusCoverage,
  renderPortfolioProof,
} from "./claw-portfolio-manager.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const fixture = JSON.parse(
  await readFile(new URL("portfolio.input.json", fixtureRoot), "utf8"),
);
const publicTrust = JSON.parse(
  await readFile(new URL("public-trust.test.json", fixtureRoot), "utf8"),
);
const sourceReceipts = JSON.parse(
  await readFile(new URL("source-receipts.test.json", fixtureRoot), "utf8"),
);
const expected = JSON.parse(
  await readFile(new URL("./expected/portfolio.expected.json", import.meta.url), "utf8"),
);
const expectedProof = await readFile(
  new URL("./proof/portfolio-handoff.md", import.meta.url),
  "utf8",
);
const AS_OF = "2026-09-17T19:00:00Z";

function clone(value = fixture) {
  return structuredClone(value);
}

async function evaluate(input = fixture, options = {}) {
  return evaluateClawPortfolio(input, {
    asOf: AS_OF,
    publicTrust,
    sourceReceipts,
    ...options,
  });
}

function findingCodes(result) {
  return new Set(result.findings.map((item) => item.code));
}

async function assertInvalid(input, code, options = {}) {
  const result = await evaluate(input, options);
  assert.equal(result.resultStatus, "invalid");
  assert.ok(
    findingCodes(result).has(code),
    `${code} absent from ${JSON.stringify(result.findings, null, 2)}`,
  );
  assert.deepEqual(result.authority, {
    merge: false,
    publish: false,
    budgetIncrease: false,
    riskAcceptance: false,
    externalMutation: false,
    productionClawMutation: false,
    sensitivePersonalInference: false,
    reseal: false,
  });
  assert.equal(JSON.stringify(result).includes("BEGIN PRIVATE KEY"), false);
  return result;
}

test("accepted fixture produces the exact bounded owner handoff", async () => {
  const result = await evaluate();
  assert.deepEqual(result, expected);
  assert.equal(result.resultStatus, "blocked-owner-handoff");
  assert.equal(result.portfolio.exactCoverage, true);
  assert.equal(result.portfolio.productionMutation, false);
  assert.equal(result.budget.withinCaps, true);
  assert.equal(result.budget.increaseAllowed, false);
  assert.equal(result.usage.classificationAuthority, false);
  assert.equal(result.usage.correctnessOrSafetyOverride, false);
  assert.equal(result.usage.productionMutation, false);
  assert.equal(result.antiCountIncentives.composeFirstSatisfied, true);
  assert.equal(result.antiCountIncentives.rawClawCountObjective, false);
  assert.equal(renderPortfolioProof(result), expectedProof);
});

test("bounded scenario covers every required classification and state", async () => {
  const result = await evaluate();
  const byId = new Map(result.issues.map((item) => [item.issueRef, item]));
  assert.deepEqual(
    result.issues.map((item) => item.classification),
    [
      "COMPOSE",
      "IMPROVE",
      "NEW",
      "VARIANT",
      "PRODUCT_DECISION",
      "RETIRE",
      "DUPLICATE",
      "UNSUPPORTED",
    ],
  );
  assert.deepEqual(CLASSIFICATIONS, [
    "NEW",
    "IMPROVE",
    "COMPOSE",
    "VARIANT",
    "PRODUCT_DECISION",
    "RETIRE",
    "DUPLICATE",
    "UNSUPPORTED",
  ]);
  assert.equal(byId.get("issue-compose-release-portfolio").state, "plan-ready");
  assert.equal(
    byId.get("issue-compose-release-portfolio").plan.kind,
    "composition-plan",
  );
  assert.equal(
    byId.get("issue-improve-repository-operations").plan.kind,
    "improvement-plan",
  );
  assert.deepEqual(
    byId.get("issue-new-claw-builder").blockedBudgetDimensions,
    [
      "candidateCount",
      "admissions",
      "workUnits",
      "costMicros",
      "durationMinutes",
    ],
  );
  assert.equal(
    byId.get("issue-product-catalog-policy").state,
    "blocked-conflicting-evidence",
  );
  assert.equal(
    byId.get("issue-stale-theme-variant").state,
    "blocked-stale-evidence",
  );
  assert.equal(
    byId.get("issue-publish-directly").state,
    "blocked-authority",
  );
  assert.equal(
    byId.get("issue-duplicate-operations").classification,
    "DUPLICATE",
  );
});

test("incomplete improvement signals and duplicate cycles fail closed", async () => {
  const incompleteImprove = clone();
  const newIssue = incompleteImprove.issues.find(
    (item) => item.id === "issue-new-claw-builder",
  );
  newIssue.signals.sameRepeatableJob = true;
  newIssue.signals.newInvariantIds = [];
  await assertInvalid(
    incompleteImprove,
    "incomplete-classification-signal",
  );

  const unsubstantiatedNew = clone();
  unsubstantiatedNew.issues.find(
    (item) => item.id === "issue-new-claw-builder",
  ).signals.newInvariantIds = [];
  await assertInvalid(
    unsubstantiatedNew,
    "incomplete-classification-signal",
  );

  const targetlessRetirement = clone();
  targetlessRetirement.issues.find(
    (item) => item.id === "issue-retire-legacy-claw",
  ).affectedClaws = [];
  await assertInvalid(
    targetlessRetirement,
    "incomplete-classification-signal",
  );

  const duplicateCycle = clone();
  duplicateCycle.issues.find(
    (item) => item.id === "issue-improve-repository-operations",
  ).signals.duplicateOfIssueRef = "issue-duplicate-operations";
  await assertInvalid(duplicateCycle, "invalid-duplicate-reference");

  const nonOpposingConflict = clone();
  nonOpposingConflict.evidenceEnvelopes
    .flatMap((item) => item.records)
    .find((item) => item.id === "evidence-product-oppose").claim = "request";
  await assertInvalid(
    nonOpposingConflict,
    "invalid-conflicting-evidence",
  );
});

test("budget allocation is exact, deterministic, and cannot overrun", async () => {
  const result = await evaluate();
  assert.deepEqual(result.budget.used, {
    candidateCount: 0,
    admissions: 2,
    workUnits: 7,
    costMicros: 300000,
    durationMinutes: 45,
  });
  for (const key of Object.keys(result.budget.limits)) {
    assert.ok(result.budget.used[key] <= result.budget.limits[key], key);
  }
  const mutated = clone();
  mutated.issues.find(
    (item) => item.id === "issue-compose-release-portfolio",
  ).demand.candidateSlots = 1;
  await assertInvalid(mutated, "invalid-budget-demand");
});

test("optional usage is authenticated, minimized, scoped, and advisory only", async () => {
  const result = await evaluate();
  assert.deepEqual(result.usage.effects, [
    {
      evidenceRef: "evidence-usage-improve",
      sourceIssueRef: "issue-improve-repository-operations",
      proposedIssueRef: "draft-usage-followup-evidence-usage-improve",
      effect: "create-draft-issue",
      affectedClaws:
        fixture.issues.find(
          (item) => item.id === "issue-improve-repository-operations",
        ).affectedClaws,
      requiresOwnerAdmission: true,
      classificationChanged: false,
      productionMutation: false,
    },
    {
      evidenceRef: "evidence-usage-improve",
      issueRef: "issue-improve-repository-operations",
      effect: "reprioritize-existing-issue",
      basePriority: 80,
      advisoryPriority: 81,
      classificationChanged: false,
      productionMutation: false,
    },
  ]);
  const classificationBefore = result.issues.map((item) => [
    item.issueRef,
    item.classification,
    item.state,
  ]);
  const withoutUsage = clone();
  withoutUsage.evidenceEnvelopes = withoutUsage.evidenceEnvelopes.filter(
    (item) => item.kind !== "usage-evidence",
  );
  withoutUsage.coverage.evidenceRefs =
    withoutUsage.coverage.evidenceRefs.filter(
      (item) => item !== "evidence-usage-improve",
    );
  const noUsage = await evaluate(withoutUsage);
  assert.equal(noUsage.resultStatus, "blocked-owner-handoff");
  assert.deepEqual(
    noUsage.issues.map((item) => [
      item.issueRef,
      item.classification,
      item.state,
    ]),
    classificationBefore,
  );
  assert.equal(noUsage.usage.supplied, false);


  const wrongTenant = clone();
  wrongTenant.evidenceEnvelopes.find(
    (item) => item.kind === "usage-evidence",
  ).records[0].tenantRef = "tenant-other";
  await assertInvalid(wrongTenant, "invalid-usage-record");
  await assertInvalid(wrongTenant, "usage-policy-violation");

  const admissionEvidence = clone();
  admissionEvidence.issues[0].evidenceRefs.push("evidence-usage-improve");
  await assertInvalid(
    admissionEvidence,
    "usage-evidence-cannot-drive-admission",
  );

  const missingSubject = clone();
  missingSubject.evidenceEnvelopes.find(
    (item) => item.kind === "usage-evidence",
  ).records[0].subjectRef = "issue-not-in-owner-manifest";
  const missingSubjectResult = await assert.doesNotReject(() =>
    evaluate(missingSubject),
  );
  assert.equal(missingSubjectResult, undefined);
  await assertInvalid(
    missingSubject,
    "usage-subject-outside-issue-universe",
  );
});

test("catalog source receipts bind exact current canonical entry bytes", async () => {
  const result = await evaluate();
  assert.notEqual(result.resultStatus, "invalid");
  const mutatedReceipts = structuredClone(sourceReceipts);
  const receipt = mutatedReceipts.receipts[0];
  const bytes = Buffer.from(receipt.contentBase64, "base64");
  bytes[0] ^= 1;
  receipt.contentBase64 = bytes.toString("base64");
  await assertInvalid(fixture, "invalid-source-byte-receipt", {
    sourceReceipts: mutatedReceipts,
  });
  await assertInvalid(fixture, "catalog-source-bytes-mismatch", {
    sourceReceipts: mutatedReceipts,
  });

  const attacker = generateKeyPairSync("ed25519");
  const attackerTrust = structuredClone(publicTrust);
  attackerTrust.signers.push({
    keyId: "attacker-catalog-key",
    principalRef: "principal-not-declared",
    kind: "system",
    purposes: ["catalog-source-receipt"],
    validFrom: "2026-09-01T00:00:00Z",
    validUntil: "2026-10-01T00:00:00Z",
    publicKeyPem: attacker.publicKey
      .export({ type: "spki", format: "pem" })
      .toString(),
  });
  const attackerReceipts = structuredClone(sourceReceipts);
  attackerReceipts.issuerRef = "principal-not-declared";
  attackerReceipts.revision =
    computeSourceReceiptsRevision(attackerReceipts);
  attackerReceipts.signature = {
    keyId: "attacker-catalog-key",
    algorithm: "Ed25519",
    value: sign(
      null,
      Buffer.from(
        canonicalJson(
          Object.fromEntries(
            Object.entries(attackerReceipts).filter(
              ([key]) => key !== "signature",
            ),
          ),
        ),
        "utf8",
      ),
      attacker.privateKey,
    ).toString("base64"),
  };
  await assertInvalid(fixture, "invalid-catalog-source-custodian", {
    publicTrust: attackerTrust,
    sourceReceipts: attackerReceipts,
  });
});

test("strict public trust accepts only scoped Ed25519 SPKI and no private material", async () => {
  const rsaTrust = structuredClone(publicTrust);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  rsaTrust.signers[0].publicKeyPem = rsa.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  await assertInvalid(fixture, "invalid-ed25519-spki", {
    publicTrust: rsaTrust,
  });

  const privateTrust = structuredClone(publicTrust);
  privateTrust.privateKey = "-----BEGIN PRIVATE KEY-----\nnot-allowed\n-----END PRIVATE KEY-----";
  const privateResult = await evaluate(fixture, { publicTrust: privateTrust });
  assert.equal(privateResult.resultStatus, "invalid");
  assert.ok(
    ["invalid-schema", "private-or-credential-material"].some((code) =>
      findingCodes(privateResult).has(code),
    ),
  );

  const reusedTrust = structuredClone(publicTrust);
  reusedTrust.signers[1].publicKeyPem = reusedTrust.signers[0].publicKeyPem;
  await assertInvalid(fixture, "cross-principal-key-reuse", {
    publicTrust: reusedTrust,
  });

  const wrongKind = structuredClone(publicTrust);
  wrongKind.signers.find((item) => item.keyId === "owner-key").kind = "system";
  await assertInvalid(fixture, "invalid-signature", {
    publicTrust: wrongKind,
  });
});

test("unsafe references and credential-shaped content fail closed", async () => {
  const unsafe = clone();
  unsafe.evidenceEnvelopes[0].sourceRef = "https://127.0.0.1/private";
  await assertInvalid(unsafe, "unsafe-source-reference");

  for (const host of ["[::]", "[::ffff:127.0.0.1]"]) {
    const unsafeIpv6 = clone();
    unsafeIpv6.evidenceEnvelopes[0].sourceRef = `https://${host}/private`;
    await assertInvalid(unsafeIpv6, "unsafe-source-reference");
  }

  const credential = clone();
  credential.evidenceEnvelopes[0].sourceRef =
    "controlled://owner/issues?access_token=secret";
  await assertInvalid(credential, "private-or-credential-material");
});

test("strict chronology and predecessor binding reject stale lineage", async () => {
  const wrongPredecessor = clone();
  wrongPredecessor.issues.find(
    (item) => item.id === "issue-improve-repository-operations",
  ).previousRevision = `sha256:${"0".repeat(64)}`;
  await assertInvalid(wrongPredecessor, "invalid-issue-history");

  const futureIssue = clone();
  futureIssue.issues[0].observedAt = "2026-09-17T20:00:00Z";
  await assertInvalid(futureIssue, "invalid-issue-chronology");

  const latePredecessorIssue = clone();
  latePredecessorIssue.issues.find(
    (item) => item.id === "issue-compose-release-portfolio",
  ).openedAt = "2026-09-17T16:00:00Z";
  await assertInvalid(latePredecessorIssue, "invalid-issue-chronology");

  const earlyNewIssue = clone();
  earlyNewIssue.issues.find(
    (item) => item.id === "issue-new-claw-builder",
  ).openedAt = "2026-09-16T17:00:00Z";
  await assertInvalid(earlyNewIssue, "invalid-issue-chronology");

  const futureEnvelope = clone();
  futureEnvelope.evidenceEnvelopes[0].issuedAt =
    "2026-09-17T20:00:00Z";
  await assertInvalid(futureEnvelope, "invalid-evidence-envelope");

  const postIssueEvidence = clone();
  postIssueEvidence.evidenceEnvelopes[0].records.find(
    (item) => item.id === "evidence-compose",
  ).observedAt = "2026-09-17T17:10:00Z";
  await assertInvalid(
    postIssueEvidence,
    "evidence-after-issue-snapshot",
  );
});

test("closed-world coverage rejects coherent omission and duplicate identity", async () => {
  const omitted = clone();
  const omittedId = "issue-new-claw-builder";
  omitted.issues = omitted.issues.filter((item) => item.id !== omittedId);
  omitted.issueManifest.issueRefs =
    omitted.issueManifest.issueRefs.filter((item) => item !== omittedId);
  omitted.coverage.issueRefs =
    omitted.coverage.issueRefs.filter((item) => item !== omittedId);
  omitted.issueManifest.issueUniverseRoot = computeIssueUniverseRoot(
    omitted.issues,
  );
  omitted.portfolioManifest.issueUniverseRoot =
    omitted.issueManifest.issueUniverseRoot;
  omitted.issueManifest.revision =
    computeIssueManifestRevision(omitted.issueManifest);
  omitted.portfolioManifest.revision =
    computePortfolioManifestRevision(omitted.portfolioManifest);
  await assertInvalid(omitted, "invalid-signature");

  const duplicated = clone();
  duplicated.issues.push(structuredClone(duplicated.issues[0]));
  await assertInvalid(duplicated, "duplicate-global-identity");

  const duplicateSelected = clone();
  duplicateSelected.portfolioManifest.selectedClaws[1] = structuredClone(
    duplicateSelected.portfolioManifest.selectedClaws[0],
  );
  await assertInvalid(duplicateSelected, "invalid-closed-world-coverage");
});

test("immutable issue, source, and usage revisions reject evidence laundering", async () => {
  const issueRevision = clone();
  issueRevision.issues[0].basePriority += 1;
  await assertInvalid(issueRevision, "invalid-issue-revision");

  const evidenceRevision = clone();
  evidenceRevision.evidenceEnvelopes[0].records[0].claim = "supports";
  await assertInvalid(evidenceRevision, "invalid-evidence-revision");
  await assertInvalid(evidenceRevision, "invalid-evidence-envelope-revision");

  const usageIssuer = clone();
  const usageEnvelope = usageIssuer.evidenceEnvelopes.find(
    (item) => item.kind === "usage-evidence",
  );
  usageEnvelope.issuerRef = "principal-catalog-custodian";
  await assertInvalid(usageIssuer, "invalid-evidence-issuer");
});

test("typed human grants are scoped and active at caller-controlled time", async () => {
  const wrongScope = clone();
  wrongScope.grants.find(
    (item) => item.id === "grant-product-decisions",
  ).issueRefs = [];
  await assertInvalid(wrongScope, "missing-exact-human-grant");

  const expired = clone();
  expired.grants[0].expiresAt = "2026-09-17T18:59:59Z";
  await assertInvalid(expired, "invalid-human-grant");

  const wrongRole = clone();
  wrongRole.grants.find(
    (item) => item.id === "grant-product-decisions",
  ).granteeRef = "principal-evidence-custodian";
  await assertInvalid(wrongRole, "invalid-human-grant");

  const wrongBudgetGrant = clone();
  wrongBudgetGrant.budget.grantRef = "grant-issue-admission";
  await assertInvalid(wrongBudgetGrant, "invalid-budget-binding");

  const overlapping = clone();
  const duplicateGrant = structuredClone(
    overlapping.grants.find((item) => item.id === "grant-issue-admission"),
  );
  duplicateGrant.id = "grant-issue-admission-overlap";
  overlapping.grants.push(duplicateGrant);
  await assertInvalid(overlapping, "ambiguous-human-grant");

  const noZone = await evaluate(fixture, {
    asOf: "2026-09-17T19:00:00",
  });
  assert.equal(noZone.resultStatus, "invalid");
  assert.ok(findingCodes(noZone).has("invalid-run-context"));
});

test("a variant stays outside the curated catalog and consumes no budget", async () => {
  const variant = fixture.issues.find(
    (item) => item.id === "issue-stale-theme-variant",
  );
  assert.deepEqual(variant.demand, {
    candidateSlots: 0,
    admissionSlots: 0,
    workUnits: 0,
    costMicros: 0,
    durationMinutes: 0,
  });
  const result = await evaluate();
  const outcome = result.issues.find((item) => item.issueRef === variant.id);
  assert.equal(outcome.classification, "VARIANT");
  assert.equal(outcome.plan, null);
  assert.equal(outcome.ownerHandoff.prHandoff, "outside-curated-catalog");
});

test("structural authority gates cannot be enabled or smuggled in narrative state", async () => {
  for (const key of Object.keys(fixture.authority)) {
    const mutated = clone();
    mutated.authority[key] = true;
    const result = await evaluate(mutated);
    assert.equal(result.resultStatus, "invalid", key);
    assert.ok(findingCodes(result).has("invalid-schema"), key);
  }
  const inferred = clone();
  inferred.issues.find((item) => item.id === "issue-publish-directly")
    .requestedAuthority = ["infer-sensitive-personal-facts"];
  const result = await evaluate(inferred);
  assert.equal(result.resultStatus, "invalid");
  assert.ok(findingCodes(result).has("invalid-issue-revision"));
});

test("direct API is total and non-echoing for hostile non-JSON values", async () => {
  const cycle = {};
  cycle.self = cycle;
  const deep = {};
  let cursor = deep;
  for (let index = 0; index < CANDIDATE_LIMITS.maxDepth + 2; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  const getter = {};
  Object.defineProperty(getter, "secret", {
    enumerable: true,
    get() {
      throw new Error("SHOULD_NOT_BE_ECHOED");
    },
  });
  const hidden = { visible: true };
  Object.defineProperty(hidden, "hidden", {
    enumerable: false,
    value: "SHOULD_NOT_BE_ECHOED",
  });
  const symbolKey = { visible: true };
  symbolKey[Symbol("SHOULD_NOT_BE_ECHOED")] = true;
  const sparse = [];
  sparse.length = 2;
  sparse[1] = "SHOULD_NOT_BE_ECHOED";
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("SHOULD_NOT_BE_ECHOED");
      },
    },
  );
  const cases = [
    null,
    undefined,
    Symbol("SHOULD_NOT_BE_ECHOED"),
    1n,
    () => "SHOULD_NOT_BE_ECHOED",
    new Date(),
    cycle,
    deep,
    getter,
    hidden,
    symbolKey,
    sparse,
    proxy,
    JSON.parse(`{"__proto__":${JSON.stringify(fixture)}}`),
    "x".repeat(CANDIDATE_LIMITS.maxStringLength + 1),
    Array.from({ length: CANDIDATE_LIMITS.maxArrayLength + 1 }, () => null),
  ];
  for (const value of cases) {
    let result;
    await assert.doesNotReject(async () => {
      result = await evaluateClawPortfolio(value, {
        asOf: AS_OF,
        publicTrust,
        sourceReceipts,
      });
    });
    assert.equal(result.resultStatus, "invalid");
    assert.equal(JSON.stringify(result).includes("SHOULD_NOT_BE_ECHOED"), false);
    assert.ok(JSON.stringify(result).length < 2048);
  }
});

test("direct API enforces separate trust and receipt byte limits", async () => {
  const oversizedTrust = {
    ...publicTrust,
    paddingA: "x".repeat(40_000),
    paddingB: "x".repeat(40_000),
  };
  await assertInvalid(fixture, "unsafe-or-oversized-validation-context", {
    publicTrust: oversizedTrust,
  });
  const oversizedReceipts = {
    ...sourceReceipts,
    paddingA: "x".repeat(100_000),
    paddingB: "x".repeat(100_000),
    paddingC: "x".repeat(100_000),
  };
  await assertInvalid(fixture, "unsafe-or-oversized-validation-context", {
    sourceReceipts: oversizedReceipts,
  });
});

test("CLI bounds malformed and oversized files without echoing content", async (t) => {
  const scratch = join(
    fileURLToPath(new URL(".", import.meta.url)),
    ".test-output",
  );
  await mkdir(scratch, { recursive: true });
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const malformed = join(scratch, "malformed.json");
  const oversized = join(scratch, "oversized.json");
  const marker = "SHOULD_NOT_BE_ECHOED";
  await writeFile(malformed, `{"marker":"${marker}"`);
  await writeFile(
    oversized,
    `{"marker":"${marker}","padding":"${"x".repeat(
      CANDIDATE_LIMITS.inputBytes,
    )}"}`,
  );
  for (const path of [malformed, oversized]) {
    const run = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("./claw-portfolio-manager.mjs", import.meta.url)),
        path,
        "--as-of",
        AS_OF,
        "--trust",
        fileURLToPath(new URL("public-trust.test.json", fixtureRoot)),
        "--source-receipts",
        fileURLToPath(new URL("source-receipts.test.json", fixtureRoot)),
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout.includes(marker), false);
    assert.ok(run.stdout.length < 2048);
    assert.equal(JSON.parse(run.stdout).resultStatus, "invalid");
  }
});

test("actual pinned analogue stack executes before the NEW verdict", async () => {
  const assessment = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust,
    sourceReceipts,
  });

  assert.equal(assessment.verdict, "NEW");
  assert.equal(assessment.confidence, 0.9);
  assert.equal(assessment.analogueValidation.valid, true);
  assert.deepEqual(assessment.analogueValidation.proposalErrors, []);
  assert.ok(
    assessment.analogueValidation.nearestMatches.some(
      (item) => item.id === "repository-operations-manager",
    ),
  );
  assert.equal(assessment.analogueValidation.regression.length, 5);
  assert.ok(
    assessment.analogueValidation.quality.every(
      (item) => item.qualified && item.total >= 90,
    ),
  );
  assert.ok(
    assessment.analogueValidation.mockPlus.every(
      (item) => item.schema && item.semantics,
    ),
  );
  assert.deepEqual(assessment.preservedInvariantIds, []);
  assert.deepEqual(assessment.missingInvariantIds, [
    "closed-claw-source-coverage",
    "closed-issue-admission-coverage",
    "multi-axis-owner-budget",
    "advisory-usage-isolation",
    "proposal-only-authority",
    "immutable-predecessor-lineage",
  ]);
  assert.equal(assessment.deleteCandidate, false);
});

test("composition assessment snapshots caller inputs before awaiting", async () => {
  const mutableInput = clone();
  const pending = assessStrongestComposition({
    input: mutableInput,
    asOf: AS_OF,
    publicTrust,
    sourceReceipts,
  });
  mutableInput.principals.length = 0;
  mutableInput.predecessor.issueRevisions.length = 0;
  const assessment = await pending;
  assert.equal(assessment.verdict, "NEW");
  assert.equal(assessment.candidateEvaluation.resultStatus, "blocked-owner-handoff");
  assert.ok(
    assessment.requiredFacts.some(
      (item) => item.id === "immutable-predecessor-lineage",
    ),
  );
});

test("Mock+ analogue coverage requires the complete exact ID set", () => {
  const ids = ["one", "two"];
  const entries = ids.map((id) => ({
    id,
    semanticValidator: true,
    applicableFamilies: {
      schema: true,
      semantics: true,
    },
  }));
  assert.equal(hasExactMockPlusCoverage(ids, entries), true);
  assert.equal(hasExactMockPlusCoverage(ids, entries.slice(1)), false);
  assert.equal(
    hasExactMockPlusCoverage(ids, [
      entries[0],
      {
        ...entries[1],
        semanticValidator: false,
      },
    ]),
    false,
  );
});

test("an independent signed complete future composition can delete the candidate", async () => {
  const current = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust,
    sourceReceipts,
  });
  const sourceArtifacts = createFutureCompositionSourceArtifacts(
    fixture,
    expected,
  );
  const artifact = createFutureCompositionFactArtifact(sourceArtifacts);
  const pair = generateKeyPairSync("ed25519");
  const trust = {
    ...structuredClone(publicTrust),
    trustId: "candidate-and-future-composition-test-trust",
    signers: [
      ...structuredClone(publicTrust.signers),
      {
        keyId: "future-composition-key",
        principalRef: "future-composition-owner",
        kind: "human",
        purposes: ["composition-proof"],
        validFrom: "2026-09-01T00:00:00Z",
        validUntil: "2026-10-01T00:00:00Z",
        publicKeyPem: pair.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
      },
    ],
  };
  const proof = {
    schemaVersion:
      "awesomeClaws.clawPortfolioManagerCompositionProof.v1",
    graphId: "future-composition-graph",
    validatorDigest: compositionValidatorDigest(),
    artifact: {
      id: "future-composition-facts",
      digest: artifact.digest,
      bytesBase64: artifact.bytesBase64,
    },
    authority: {
      inventedSemantics: false,
      productionMutation: false,
      riskAcceptance: false,
      ownerDecision: false,
    },
    signedAt: "2026-09-17T18:30:00Z",
    signerRef: "future-composition-owner",
    signature: {
      keyId: "future-composition-key",
      algorithm: "Ed25519",
      value: "",
    },
  };
  proof.signature.value = sign(
    null,
    compositionProofPayload(proof),
    pair.privateKey,
  ).toString("base64");

  const composed = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust: trust,
    sourceReceipts,
    futureComposition: proof,
  });
  assert.equal(composed.verdict, "COMPOSE");
  assert.equal(composed.deleteCandidate, true);
  assert.deepEqual(composed.missingInvariantIds, []);

  const unboundSource = structuredClone(proof);
  unboundSourceArtifact(unboundSource);
  unboundSource.signature.value = sign(
    null,
    compositionProofPayload(unboundSource),
    pair.privateKey,
  ).toString("base64");
  const unbound = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust: trust,
    sourceReceipts,
    futureComposition: unboundSource,
  });
  assert.equal(unbound.verdict, "NEW");
  assert.equal(unbound.deleteCandidate, false);
  assert.ok(
    unbound.futureComposition.findings.some(
      (item) => item.code === "incomplete-composition-fact-graph",
    ),
  );

  const reusedPrincipalTrust = structuredClone(trust);
  reusedPrincipalTrust.signers.find(
    (item) => item.keyId === "future-composition-key",
  ).principalRef = "principal-owner";
  const reusedPrincipalProof = structuredClone(proof);
  reusedPrincipalProof.signerRef = "principal-owner";
  reusedPrincipalProof.signature.value = sign(
    null,
    compositionProofPayload(reusedPrincipalProof),
    pair.privateKey,
  ).toString("base64");
  const reusedPrincipal = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust: reusedPrincipalTrust,
    sourceReceipts,
    futureComposition: reusedPrincipalProof,
  });
  assert.equal(reusedPrincipal.verdict, "NEW");
  assert.equal(reusedPrincipal.deleteCandidate, false);
  assert.ok(
    reusedPrincipal.futureComposition.findings.some(
      (item) => item.code === "non-independent-composition-authority",
    ),
  );

  const incompleteSources = structuredClone(sourceArtifacts);
  mutateCompositionSource(incompleteSources[1], (value) => {
    value.issues.shift();
  });
  const incompleteArtifact =
    createFutureCompositionFactArtifact(incompleteSources);
  proof.artifact.digest = incompleteArtifact.digest;
  proof.artifact.bytesBase64 = incompleteArtifact.bytesBase64;
  proof.signature.value = sign(
    null,
    compositionProofPayload(proof),
    pair.privateKey,
  ).toString("base64");
  const incomplete = await assessStrongestComposition({
    input: fixture,
    asOf: AS_OF,
    publicTrust: trust,
    sourceReceipts,
    futureComposition: proof,
  });

  function unboundSourceArtifact(proof) {
    const artifact = JSON.parse(
      Buffer.from(proof.artifact.bytesBase64, "base64").toString("utf8"),
    );
    artifact.sourceArtifacts[0].digest = `sha256:${"3".repeat(64)}`;
    const bytes = Buffer.from(canonicalJson(artifact), "utf8");
    proof.artifact.bytesBase64 = bytes.toString("base64");
    proof.artifact.digest = `sha256:${createHash("sha256")
      .update(bytes)
      .digest("hex")}`;
    return artifact.sourceArtifacts[0];
  }
  assert.equal(incomplete.verdict, "NEW");
  assert.equal(incomplete.deleteCandidate, false);
  assert.ok(
    incomplete.futureComposition.findings.some(
      (item) => item.code === "incomplete-composition-fact-graph",
    ),
  );
});

function mutateCompositionSource(source, change) {
  const value = JSON.parse(
    Buffer.from(source.bytesBase64, "base64").toString("utf8"),
  );
  change(value);
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  source.bytesBase64 = bytes.toString("base64");
  source.digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

test("proof output contains no direct mutation or authority claim", async () => {
  const result = await evaluate();
  const proof = renderPortfolioProof(result);
  assert.match(proof, /proposal or owner handoff/u);
  assert.match(proof, /structurally false/u);
  assert.doesNotMatch(
    proof,
    /\b(?:manager|agent|assistant|we|I)\s+(?:merged|published|increased|accepted risk|mutated)\b/iu,
  );
  assert.equal(
    canonicalJson(result.authority),
    canonicalJson({
      merge: false,
      publish: false,
      budgetIncrease: false,
      riskAcceptance: false,
      externalMutation: false,
      productionClawMutation: false,
      sensitivePersonalInference: false,
      reseal: false,
    }),
  );
});
