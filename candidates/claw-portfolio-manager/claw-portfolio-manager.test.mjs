import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  budgetPeriodContains,
  compositionAdmissionFinding,
  computeBudgetLedgerRevision,
  computeBudgetHistoryEntryDigest,
  computeBudgetHistoryRoot,
  computePackageManifestRevision,
  computePackageManifestRoot,
  computePackageTreeRoot,
  computeProviderIssueRevision,
  computeProviderSnapshotRevision,
  computeProviderSnapshotRoot,
  computeReservationIdempotency,
  computeRunIdempotencyKey,
  evaluatePortfolioV2,
  grantActiveAt,
  planIdForIssue,
  renderPortfolioV2Proof,
  reservationIdForIssue,
} from "./claw-portfolio-manager.mjs";
import {
  compositionVerdictFor,
  futureControlTimestamp,
  inspectPinnedFile,
  reachableTargetPorts,
  runStrongestComposition,
} from "./strongest-composition.mjs";
import { sha256Digest } from "./candidate-utils.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const [
  manage,
  bootstrap,
  adopt,
  publicTrust,
  packageTree,
  futureControls,
  expected,
  proof,
] =
  await Promise.all([
    "manage-v2.input.json",
    "bootstrap-v2.input.json",
    "adopt-v2.input.json",
    "public-trust-v2.test.json",
    "package-tree-v1.test.json",
    "future-controls.test.json",
  ].map((name) =>
    readFile(new URL(name, fixtureRoot), "utf8").then(JSON.parse),
  ).concat([
    readFile(new URL("./expected/manage-v2.expected.json", import.meta.url), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("./proof/manage-v2-handoff.md", import.meta.url), "utf8"),
  ]));

function clone(value = manage) {
  return structuredClone(value);
}

async function evaluate(input = manage, options = {}) {
  return evaluatePortfolioV2(input, {
    asOf: input?.run?.asOf ?? "2026-09-17T19:00:00Z",
    publicTrust,
    packageTree,
    ...options,
  });
}

function codes(result) {
  return new Set(result.findings.map((item) => item.code));
}

async function assertInvalid(input, code, options = {}) {
  const result = await evaluate(input, options);
  assert.equal(result.resultStatus, "invalid");
  assert.ok(codes(result).has(code), JSON.stringify(result.findings, null, 2));
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
  return result;
}

test("manage fixture produces the exact provider-bound candidate result", async () => {
  const result = await evaluate();
  assert.deepEqual(result, expected);
  assert.equal(renderPortfolioV2Proof(result), proof);
  assert.equal(result.run.mode, "manage");
  assert.equal(result.onboarding.firstRun, false);
  assert.equal(result.issues.length, 8);
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
  assert.ok(
    result.issues.every(
      (item) =>
        item.provider.providerIssueId &&
        item.provider.number &&
        item.provider.url &&
        item.provider.etag &&
        item.provider.titleDigest &&
        item.provider.bodyDigest,
    ),
  );
  const previousBudget = JSON.parse(
    Buffer.from(manage.predecessor.budget.contentBase64, "base64").toString(
      "utf8",
    ),
  );
  assert.equal(previousBudget.periodId, "budget-period-august");
  assert.equal(previousBudget.periodStart, "2026-08-01");
  assert.equal(previousBudget.periodEnd, "2026-08-31");
  assert.equal(manage.budgetLedger.period.id, "budget-period-september");
  assert.deepEqual(manage.budgetLedger.cumulativeBefore, {
    candidateCount: 0,
    admissions: 0,
    workUnits: 0,
    costMicros: 0,
    durationMinutes: 0,
  });
});

test("bootstrap and adopt are genuine accepted first-run modes", async () => {
  const bootstrapResult = await evaluate(bootstrap);
  const adoptResult = await evaluate(adopt);
  assert.notEqual(bootstrapResult.resultStatus, "invalid");
  assert.notEqual(adoptResult.resultStatus, "invalid");
  assert.deepEqual(
    [bootstrapResult.run.mode, adoptResult.run.mode],
    ["bootstrap", "adopt"],
  );
  assert.equal(bootstrapResult.onboarding.firstRun, true);
  assert.equal(adoptResult.onboarding.firstRun, true);
  assert.ok(bootstrap.onboarding.roles.length > 0);
  assert.ok(bootstrap.onboarding.jobs.length > 0);
  assert.ok(bootstrap.onboarding.processes.length > 0);
  assert.ok(bootstrap.onboarding.capabilities.length > 0);
  assert.deepEqual(adopt.onboarding.roles, []);
  assert.equal(bootstrap.predecessor, null);
  assert.equal(adopt.predecessor, null);

  const inventedBaseline = clone(bootstrap);
  inventedBaseline.budgetLedger.cumulativeBefore.workUnits = 1;
  await assertInvalid(
    inventedBaseline,
    "invalid-first-run-budget-baseline",
  );
});

test("mode and predecessor state must agree exactly", async () => {
  const missing = clone();
  missing.predecessor = null;
  await assertInvalid(missing, "missing-predecessor");

  const polluted = clone(bootstrap);
  polluted.predecessor = structuredClone(manage.predecessor);
  await assertInvalid(polluted, "unexpected-first-run-predecessor");

  const emptyBootstrap = clone(bootstrap);
  emptyBootstrap.onboarding.roles = [];
  await assertInvalid(emptyBootstrap, "invalid-onboarding-mode");
});

test("provider issue snapshot rejects omission, substitution, and duplicate identities", async () => {
  const omitted = clone();
  omitted.providerSnapshot.issues.pop();
  omitted.providerSnapshot.issueRefs.pop();
  omitted.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    omitted.providerSnapshot.issues,
  );
  omitted.providerSnapshot.revision = computeProviderSnapshotRevision(
    omitted.providerSnapshot,
  );
  await assertInvalid(omitted, "issue-decision-coverage-mismatch");

  const substituted = clone();
  const issue = substituted.providerSnapshot.issues[0];
  issue.providerIssueId = substituted.providerSnapshot.issues[1].providerIssueId;
  issue.revision = computeProviderIssueRevision(issue);
  substituted.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    substituted.providerSnapshot.issues,
  );
  await assertInvalid(substituted, "invalid-provider-snapshot");

  const wrongRepository = clone();
  wrongRepository.providerSnapshot.issues[0].repository.name = "other-repo";
  await assertInvalid(wrongRepository, "invalid-provider-issue-receipt");

  const noncanonicalUrl = clone();
  noncanonicalUrl.providerSnapshot.issues[0].url += "/comments";
  noncanonicalUrl.providerSnapshot.issues[0].revision =
    computeProviderIssueRevision(noncanonicalUrl.providerSnapshot.issues[0]);
  noncanonicalUrl.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(noncanonicalUrl.providerSnapshot.issues);
  await assertInvalid(noncanonicalUrl, "invalid-provider-issue-receipt");

  const missingDuplicate = clone();
  const duplicate = missingDuplicate.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-duplicate",
  );
  const duplicateBody = JSON.parse(
    Buffer.from(duplicate.body.contentBase64, "base64").toString("utf8"),
  );
  duplicateBody.duplicateOfIssueNumber = 999999;
  const duplicateBytes = Buffer.from(JSON.stringify(duplicateBody), "utf8");
  duplicate.body.contentBase64 = duplicateBytes.toString("base64");
  duplicate.body.byteLength = duplicateBytes.length;
  duplicate.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", duplicateBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  duplicate.revision = computeProviderIssueRevision(duplicate);
  missingDuplicate.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(missingDuplicate.providerSnapshot.issues);
  await assertInvalid(missingDuplicate, "invalid-duplicate-target");
});

test("provider issue identity is stable across observation time", () => {
  const issue = manage.providerSnapshot.issues[0];
  const observedLater = structuredClone(issue);
  observedLater.observedAt = "2026-09-17T17:06:00Z";
  assert.equal(
    computeProviderIssueRevision(observedLater),
    computeProviderIssueRevision(issue),
  );
});

test("classification derives from exact typed provider bytes, not caller booleans", async () => {
  assert.ok(
    manage.providerSnapshot.issues.every(
      (item) => !Object.hasOwn(item, "signals"),
    ),
  );
  const changed = clone();
  const issue = changed.providerSnapshot.issues[2];
  const body = JSON.parse(
    Buffer.from(issue.body.contentBase64, "base64").toString("utf8"),
  );
  body.requestType = "variant";
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  issue.body.contentBase64 = bytes.toString("base64");
  issue.body.byteLength = bytes.length;
  issue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", bytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  issue.revision = computeProviderIssueRevision(issue);
  changed.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    changed.providerSnapshot.issues,
  );
  changed.providerSnapshot.revision = computeProviderSnapshotRevision(
    changed.providerSnapshot,
  );
  await assertInvalid(changed, "invalid-classification-decision");

  const inventedInvariant = clone();
  const newIssue = inventedInvariant.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-new",
  );
  const newBody = JSON.parse(
    Buffer.from(newIssue.body.contentBase64, "base64").toString("utf8"),
  );
  newBody.newInvariantIds = ["invented-invariant"];
  const newBytes = Buffer.from(JSON.stringify(newBody), "utf8");
  newIssue.body.contentBase64 = newBytes.toString("base64");
  newIssue.body.byteLength = newBytes.length;
  newIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", newBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  newIssue.revision = computeProviderIssueRevision(newIssue);
  inventedInvariant.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(inventedInvariant.providerSnapshot.issues);
  await assertInvalid(inventedInvariant, "invalid-composition-assessment");

  const malformedList = clone();
  const improveIssue = malformedList.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-improve",
  );
  const malformedBody = JSON.parse(
    Buffer.from(improveIssue.body.contentBase64, "base64").toString("utf8"),
  );
  malformedBody.requiredPortTypes = [42];
  const malformedBytes = Buffer.from(JSON.stringify(malformedBody), "utf8");
  improveIssue.body.contentBase64 = malformedBytes.toString("base64");
  improveIssue.body.byteLength = malformedBytes.length;
  improveIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", malformedBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  improveIssue.revision = computeProviderIssueRevision(improveIssue);
  malformedList.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(malformedList.providerSnapshot.issues);
  await assertInvalid(malformedList, "invalid-typed-issue-body");

  const zeroCostNew = clone();
  const zeroIssue = zeroCostNew.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-new",
  );
  const zeroBody = JSON.parse(
    Buffer.from(zeroIssue.body.contentBase64, "base64").toString("utf8"),
  );
  zeroBody.demand.candidateCount = 0;
  zeroBody.demand.admissions = 0;
  const zeroBytes = Buffer.from(JSON.stringify(zeroBody), "utf8");
  zeroIssue.body.contentBase64 = zeroBytes.toString("base64");
  zeroIssue.body.byteLength = zeroBytes.length;
  zeroIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", zeroBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  zeroIssue.revision = computeProviderIssueRevision(zeroIssue);
  zeroCostNew.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(zeroCostNew.providerSnapshot.issues);
  await assertInvalid(zeroCostNew, "invalid-classification-decision");

  const weakNewReview = clone();
  const newDecision = weakNewReview.classificationDecisions.find(
    (item) => item.classification === "NEW",
  );
  newDecision.comparison.nearestClawIds = ["not-a-real-claw"];
  await assertInvalid(weakNewReview, "invalid-classification-decision");

  const incompleteProposal = clone();
  const incompleteIssue = incompleteProposal.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-new",
  );
  const incompleteBody = JSON.parse(
    Buffer.from(incompleteIssue.body.contentBase64, "base64").toString("utf8"),
  );
  delete incompleteBody.candidateProposal.proposal.entry.workflow;
  const incompleteBytes = Buffer.from(
    JSON.stringify(incompleteBody),
    "utf8",
  );
  incompleteIssue.body.contentBase64 = incompleteBytes.toString("base64");
  incompleteIssue.body.byteLength = incompleteBytes.length;
  incompleteIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", incompleteBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  incompleteIssue.revision = computeProviderIssueRevision(incompleteIssue);
  incompleteProposal.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(incompleteProposal.providerSnapshot.issues);
  await assertInvalid(incompleteProposal, "invalid-typed-issue-body");

  const mismatchedProposal = clone();
  const mismatchedIssue = mismatchedProposal.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-new",
  );
  const mismatchedBody = JSON.parse(
    Buffer.from(mismatchedIssue.body.contentBase64, "base64").toString("utf8"),
  );
  mismatchedBody.candidateProposal.comparison.job = "same";
  const mismatchedBytes = Buffer.from(
    JSON.stringify(mismatchedBody),
    "utf8",
  );
  mismatchedIssue.body.contentBase64 = mismatchedBytes.toString("base64");
  mismatchedIssue.body.byteLength = mismatchedBytes.length;
  mismatchedIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", mismatchedBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  mismatchedIssue.revision = computeProviderIssueRevision(mismatchedIssue);
  mismatchedProposal.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(mismatchedProposal.providerSnapshot.issues);
  await assertInvalid(
    mismatchedProposal,
    "invalid-classification-decision",
  );

  const audienceOnly = clone();
  const audienceDecision = audienceOnly.classificationDecisions.find(
    (item) => item.classification === "NEW",
  );
  audienceDecision.comparison = {
    user: "different",
    job: "same",
    workflow: "same",
    outputs: "same",
    authority: "same",
    proof: "same",
    nearestClawIds: [
      "repository-operations-manager",
      "repository-compliance-program-manager",
      "work-chief-of-staff",
    ],
  };
  await assertInvalid(audienceOnly, "invalid-classification-decision");

  const evidenceChangingVariant = clone();
  evidenceChangingVariant.classificationDecisions.find(
    (item) => item.classification === "VARIANT",
  ).comparison.proof = "different";
  await assertInvalid(
    evidenceChangingVariant,
    "invalid-classification-decision",
  );
});

test("composition assessment is graph-bound and compose-first", async () => {
  const result = await evaluate();
  assert.equal(result.composition.currentVerdict, "NEW");
  assert.ok(result.composition.typedLossIds.length > 0);
  const compose = result.issues.find(
    (item) => item.issueRef === "provider-issue-compose",
  );
  const improve = result.issues.find(
    (item) => item.issueRef === "provider-issue-improve",
  );
  const newRequest = result.issues.find(
    (item) => item.issueRef === "provider-issue-new",
  );
  assert.equal(compose.state, "plan-ready");
  assert.equal(improve.state, "plan-ready");
  assert.equal(newRequest.state, "blocked-budget");
  assert.equal(
    compose.ownerHandoff.prReadyPlan.schemaVersion,
    "awesomeClaws.clawPortfolioPrReadyPlan.v1",
  );
  assert.deepEqual(compose.ownerHandoff.prReadyPlan.composition.clawRefs, [
    "repository-compliance-program-manager",
    "repository-operations-manager",
    "work-chief-of-staff",
  ]);
  assert.equal(improve.ownerHandoff.prReadyPlan.composition, null);
  assert.equal(compose.ownerHandoff.prReadyPlan.authority.merge, false);
  assert.deepEqual(
    result.budget.reservations.map((item) => item.classification),
    ["COMPOSE", "IMPROVE"],
  );

  const danglingAssessment = clone();
  danglingAssessment.classificationDecisions[0].compositionAssessmentRef =
    "missing-composition-assessment";
  await assert.doesNotReject(async () => {
    await assertInvalid(
      danglingAssessment,
      "invalid-composition-assessment",
    );
  });
  assert.equal(
    manage.providerSnapshot.issues.find(
      (item) => item.id === "provider-issue-new",
    ).number,
    203,
  );

  const unrelated = clone();
  const composeIssue = unrelated.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-compose",
  );
  const body = JSON.parse(
    Buffer.from(composeIssue.body.contentBase64, "base64").toString("utf8"),
  );
  body.compositionClawIds = [
    "repository-compliance-program-manager",
    "work-chief-of-staff",
  ];
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  composeIssue.body.contentBase64 = bytes.toString("base64");
  composeIssue.body.byteLength = bytes.length;
  composeIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", bytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  composeIssue.revision = computeProviderIssueRevision(composeIssue);
  unrelated.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    unrelated.providerSnapshot.issues,
  );
  await assertInvalid(unrelated, "invalid-composition-assessment");

  const unrelatedOutput = clone();
  const unrelatedIssue = unrelatedOutput.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-compose",
  );
  const unrelatedBody = JSON.parse(
    Buffer.from(unrelatedIssue.body.contentBase64, "base64").toString("utf8"),
  );
  unrelatedBody.requiredOutputType = "claw-portfolio.usage-evidence.v2";
  const unrelatedBytes = Buffer.from(JSON.stringify(unrelatedBody), "utf8");
  unrelatedIssue.body.contentBase64 = unrelatedBytes.toString("base64");
  unrelatedIssue.body.byteLength = unrelatedBytes.length;
  unrelatedIssue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", unrelatedBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  unrelatedIssue.revision = computeProviderIssueRevision(unrelatedIssue);
  unrelatedOutput.providerSnapshot.completenessRoot =
    computeProviderSnapshotRoot(unrelatedOutput.providerSnapshot.issues);
  await assertInvalid(unrelatedOutput, "invalid-composition-assessment");
});

test("NEW cannot displace feasible COMPOSE or IMPROVE even with higher priority", async () => {
  const tampered = clone();
  const composeReservation = tampered.budgetLedger.reservations.shift();
  const newIssue = tampered.providerSnapshot.issues.find(
    (item) => item.id === "provider-issue-new",
  );
  tampered.budgetLedger.reservations.push({
    ...composeReservation,
    id: "reservation-provider-issue-new",
    issueRef: newIssue.id,
    classification: "NEW",
    amounts: {
      candidateCount: 1,
      admissions: 1,
      workUnits: 5,
      costMicros: 300000,
      durationMinutes: 30,
    },
  });
  await assertInvalid(tampered, "invalid-cumulative-budget-ledger");
});

test("budget period, cumulative state, and idempotency prevent replay", async () => {
  const replayRun = clone();
  replayRun.run.id = replayRun.predecessor.runId;
  await assertInvalid(replayRun, "replayed-run-or-budget");

  const olderReplay = clone();
  olderReplay.run.id = "portfolio-run-older";
  await assertInvalid(olderReplay, "replayed-run-or-budget");

  const staleLease = clone();
  staleLease.budgetLedger.lease.expectedCheckpointDigest =
    `sha256:${"0".repeat(64)}`;
  await assertInvalid(staleLease, "invalid-cumulative-budget-ledger");

  const replayReservation = clone();
  replayReservation.predecessor.budget.contentBase64 =
    Buffer.from(
      JSON.stringify({
        schemaVersion: "awesomeClaws.clawPortfolioPreviousBudget.v1",
        periodId: replayReservation.budgetLedger.period.id,
        cumulativeAfter: replayReservation.budgetLedger.cumulativeBefore,
        reservations: [
          {
            idempotencyKey:
              replayReservation.budgetLedger.reservations[0].idempotencyKey,
          },
        ],
      }),
      "utf8",
    ).toString("base64");
  await assertInvalid(replayReservation, "invalid-exact-bytes");

  const wrongPeriod = clone();
  wrongPeriod.budgetLedger.period.endsOn = "2026-09-16";
  await assertInvalid(wrongPeriod, "invalid-cumulative-budget-ledger");

  const narrowedGrant = clone();
  narrowedGrant.grants.find(
    (item) => item.id === "grant-budget",
  ).issueRefs = ["provider-issue-improve"];
  await assertInvalid(narrowedGrant, "invalid-cumulative-budget-ledger");

  const overCap = clone();
  overCap.budgetLedger.cumulativeBefore.admissions = 3;
  overCap.budgetLedger.cumulativeAfter.admissions = 3;
  overCap.budgetLedger.reservations = [];
  await assertInvalid(overCap, "invalid-cumulative-budget-ledger");
});

test("later runs bind exact predecessor result, decisions, and budget bytes", async () => {
  for (const field of ["result", "decisions", "budget"]) {
    const changed = clone();
    const bytes = Buffer.from(changed.predecessor[field].contentBase64, "base64");
    bytes[0] ^= 1;
    changed.predecessor[field].contentBase64 = bytes.toString("base64");
    await assertInvalid(changed, "invalid-exact-bytes");
  }
  const mismatched = clone();
  mismatched.run.predecessorDecisionDigest = `sha256:${"0".repeat(64)}`;
  await assertInvalid(mismatched, "invalid-predecessor-lineage");

  const omittedHistory = clone();
  const budget = JSON.parse(
    Buffer.from(
      omittedHistory.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  budget.usedRunIds = [];
  const bytes = Buffer.from(JSON.stringify(budget), "utf8");
  omittedHistory.predecessor.budget.contentBase64 = bytes.toString("base64");
  omittedHistory.predecessor.budget.byteLength = bytes.length;
  omittedHistory.predecessor.budget.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", bytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  omittedHistory.run.predecessorBudgetDigest =
    omittedHistory.predecessor.budget.digest;
  omittedHistory.budgetLedger.predecessorBudgetDigest =
    omittedHistory.predecessor.budget.digest;
  await assertInvalid(omittedHistory, "invalid-predecessor-lineage");

  const stalePredecessor = clone();
  const staleResult = JSON.parse(
    Buffer.from(
      stalePredecessor.predecessor.result.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  staleResult.runId = "portfolio-run-older";
  staleResult.decisionId = "portfolio-decision-older";
  staleResult.idempotencyKey =
    "sha256:d0812d5f9faf82b1965aa4524646799b2436b094cbb8eeee496e73a4b13ba6f4";
  const staleResultBytes = Buffer.from(JSON.stringify(staleResult), "utf8");
  stalePredecessor.predecessor.result.contentBase64 =
    staleResultBytes.toString("base64");
  stalePredecessor.predecessor.result.byteLength = staleResultBytes.length;
  stalePredecessor.predecessor.result.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", staleResultBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  stalePredecessor.predecessor.runId = staleResult.runId;
  stalePredecessor.predecessor.decisionId = staleResult.decisionId;
  stalePredecessor.run.predecessorResultDigest =
    stalePredecessor.predecessor.result.digest;
  await assertInvalid(stalePredecessor, "invalid-predecessor-lineage");

  const changedLineage = structuredClone(manage.run);
  changedLineage.predecessorResultDigest = `sha256:${"0".repeat(64)}`;
  assert.notEqual(
    computeRunIdempotencyKey(changedLineage),
    manage.run.idempotencyKey,
  );

  const overlappingRollover = clone();
  const priorBudget = JSON.parse(
    Buffer.from(
      overlappingRollover.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  priorBudget.periodStart = "2026-09-01";
  priorBudget.periodEnd = "2026-09-30";
  const overlappingBytes = Buffer.from(
    JSON.stringify(priorBudget),
    "utf8",
  );
  overlappingRollover.predecessor.budget.contentBase64 =
    overlappingBytes.toString("base64");
  overlappingRollover.predecessor.budget.byteLength =
    overlappingBytes.length;
  overlappingRollover.predecessor.budget.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", overlappingBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  overlappingRollover.run.predecessorBudgetDigest =
    overlappingRollover.predecessor.budget.digest;
  overlappingRollover.budgetLedger.predecessorBudgetDigest =
    overlappingRollover.predecessor.budget.digest;
  await assertInvalid(overlappingRollover, "invalid-predecessor-lineage");

  const malformedPeriod = clone();
  const malformedPeriodBudget = JSON.parse(
    Buffer.from(
      malformedPeriod.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  malformedPeriodBudget.periodEnd = "not-a-date";
  const malformedPeriodBytes = Buffer.from(
    JSON.stringify(malformedPeriodBudget),
    "utf8",
  );
  malformedPeriod.predecessor.budget.contentBase64 =
    malformedPeriodBytes.toString("base64");
  malformedPeriod.predecessor.budget.byteLength =
    malformedPeriodBytes.length;
  malformedPeriod.predecessor.budget.digest =
    `sha256:${await crypto.subtle
      .digest("SHA-256", malformedPeriodBytes)
      .then((value) => Buffer.from(value).toString("hex"))}`;
  malformedPeriod.run.predecessorBudgetDigest =
    malformedPeriod.predecessor.budget.digest;
  malformedPeriod.budgetLedger.predecessorBudgetDigest =
    malformedPeriod.predecessor.budget.digest;
  await assertInvalid(malformedPeriod, "invalid-predecessor-lineage");

  const raisedSamePeriodCaps = clone();
  const samePeriodBudget = JSON.parse(
    Buffer.from(
      raisedSamePeriodCaps.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  samePeriodBudget.periodId = raisedSamePeriodCaps.budgetLedger.period.id;
  samePeriodBudget.periodStart =
    raisedSamePeriodCaps.budgetLedger.period.startsOn;
  samePeriodBudget.periodEnd = raisedSamePeriodCaps.budgetLedger.period.endsOn;
  samePeriodBudget.caps.admissions = 1;
  const samePeriodBytes = Buffer.from(
    JSON.stringify(samePeriodBudget),
    "utf8",
  );
  raisedSamePeriodCaps.predecessor.budget.contentBase64 =
    samePeriodBytes.toString("base64");
  raisedSamePeriodCaps.predecessor.budget.byteLength = samePeriodBytes.length;
  raisedSamePeriodCaps.predecessor.budget.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", samePeriodBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  raisedSamePeriodCaps.run.predecessorBudgetDigest =
    raisedSamePeriodCaps.predecessor.budget.digest;
  raisedSamePeriodCaps.budgetLedger.predecessorBudgetDigest =
    raisedSamePeriodCaps.predecessor.budget.digest;
  await assertInvalid(raisedSamePeriodCaps, "invalid-predecessor-lineage");

  const repeatedIssueRevision = clone();
  const priorDecisions = JSON.parse(
    Buffer.from(
      repeatedIssueRevision.predecessor.decisions.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  const composeDecision = repeatedIssueRevision.classificationDecisions.find(
    (item) => item.classification === "COMPOSE",
  );
  const priorCompose = priorDecisions.decisions.find(
    (item) => item.issueRef === composeDecision.issueRef,
  );
  priorCompose.issueRevision = composeDecision.issueRevision;
  priorCompose.classification = composeDecision.classification;
  const priorDecisionBytes = Buffer.from(
    JSON.stringify(priorDecisions),
    "utf8",
  );
  repeatedIssueRevision.predecessor.decisions.contentBase64 =
    priorDecisionBytes.toString("base64");
  repeatedIssueRevision.predecessor.decisions.byteLength =
    priorDecisionBytes.length;
  repeatedIssueRevision.predecessor.decisions.digest =
    `sha256:${await crypto.subtle
      .digest("SHA-256", priorDecisionBytes)
      .then((value) => Buffer.from(value).toString("hex"))}`;
  repeatedIssueRevision.run.predecessorDecisionDigest =
    repeatedIssueRevision.predecessor.decisions.digest;
  await assertInvalid(repeatedIssueRevision, "replayed-run-or-budget");

  const retryBlocked = clone();
  const blockedDecisions = JSON.parse(
    Buffer.from(
      retryBlocked.predecessor.decisions.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  const currentNew = retryBlocked.classificationDecisions.find(
    (item) => item.classification === "NEW",
  );
  const priorNew = blockedDecisions.decisions.find(
    (item) => item.classification === "NEW",
  );
  priorNew.issueRevision = currentNew.issueRevision;
  const blockedDecisionBytes = Buffer.from(
    JSON.stringify(blockedDecisions),
    "utf8",
  );
  retryBlocked.predecessor.decisions.contentBase64 =
    blockedDecisionBytes.toString("base64");
  retryBlocked.predecessor.decisions.byteLength = blockedDecisionBytes.length;
  retryBlocked.predecessor.decisions.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", blockedDecisionBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  retryBlocked.run.predecessorDecisionDigest =
    retryBlocked.predecessor.decisions.digest;
  const retryResult = await evaluate(retryBlocked);
  assert.equal(codes(retryResult).has("replayed-run-or-budget"), false);

  const completedWork = clone();
  const completedDecisions = JSON.parse(
    Buffer.from(
      completedWork.predecessor.decisions.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  const completedCompose = completedDecisions.decisions.find(
    (item) => item.classification === "COMPOSE",
  );
  completedCompose.issueRevision =
    completedWork.classificationDecisions.find(
      (item) => item.classification === "COMPOSE",
    ).issueRevision;
  completedCompose.classification = "NEW";
  const completedDecisionBytes = Buffer.from(
    JSON.stringify(completedDecisions),
    "utf8",
  );
  completedWork.predecessor.decisions.contentBase64 =
    completedDecisionBytes.toString("base64");
  completedWork.predecessor.decisions.byteLength =
    completedDecisionBytes.length;
  completedWork.predecessor.decisions.digest =
    `sha256:${await crypto.subtle
      .digest("SHA-256", completedDecisionBytes)
      .then((value) => Buffer.from(value).toString("hex"))}`;
  completedWork.run.predecessorDecisionDigest =
    completedWork.predecessor.decisions.digest;
  completedWork.budgetLedger.reservations =
    completedWork.budgetLedger.reservations.filter(
      (item) => item.classification !== "COMPOSE",
    );
  const newDecision = completedWork.classificationDecisions.find(
    (item) => item.classification === "NEW",
  );
  const newIssue = completedWork.providerSnapshot.issues.find(
    (item) => item.id === newDecision.issueRef,
  );
  const newRequest = JSON.parse(
    Buffer.from(newIssue.body.contentBase64, "base64").toString("utf8"),
  );
  const newReservation = {
    id: reservationIdForIssue(newIssue.id, newIssue.revision),
    periodId: completedWork.budgetLedger.period.id,
    runId: completedWork.run.id,
    decisionId: completedWork.run.decisionId,
    issueRef: newIssue.id,
    issueRevision: newIssue.revision,
    classification: "NEW",
    idempotencyKey: "",
    amounts: newRequest.demand,
    state: "reserved",
  };
  newReservation.idempotencyKey =
    computeReservationIdempotency(newReservation);
  completedWork.budgetLedger.reservations.push(newReservation);
  completedWork.budgetLedger.cumulativeAfter = {
    candidateCount: 1,
    admissions: 2,
    workUnits: 8,
    costMicros: 420000,
    durationMinutes: 50,
  };
  completedWork.budgetLedger.revision =
    computeBudgetLedgerRevision(completedWork.budgetLedger);
  const completedResult = await evaluate(completedWork);
  assert.equal(
    codes(completedResult).has("invalid-completed-work-reclassification"),
    true,
  );
  assert.equal(
    codes(completedResult).has("invalid-cumulative-budget-ledger"),
    false,
  );
  assert.equal(codes(completedResult).has("replayed-run-or-budget"), false);

  const hiddenDecision = clone();
  const hiddenBudget = JSON.parse(
    Buffer.from(
      hiddenDecision.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  const hiddenReservation = hiddenBudget.reservations[0];
  const previousKey = hiddenReservation.idempotencyKey;
  hiddenReservation.decisionId = "portfolio-decision-hidden";
  hiddenReservation.idempotencyKey =
    computeReservationIdempotency(hiddenReservation);
  const historyEntry = hiddenBudget.history.find(
    (item) => item.runId === hiddenReservation.runId,
  );
  historyEntry.reservationIdempotencyKeys =
    historyEntry.reservationIdempotencyKeys.map((item) =>
      item === previousKey ? hiddenReservation.idempotencyKey : item,
    );
  historyEntry.entryDigest = computeBudgetHistoryEntryDigest(historyEntry);
  hiddenBudget.historyRoot = computeBudgetHistoryRoot(hiddenBudget.history);
  hiddenBudget.usedIdempotencyKeys = hiddenBudget.usedIdempotencyKeys.map(
    (item) =>
      item === previousKey ? hiddenReservation.idempotencyKey : item,
  );
  const hiddenBudgetBytes = Buffer.from(
    JSON.stringify(hiddenBudget),
    "utf8",
  );
  hiddenDecision.predecessor.budget.contentBase64 =
    hiddenBudgetBytes.toString("base64");
  hiddenDecision.predecessor.budget.byteLength = hiddenBudgetBytes.length;
  hiddenDecision.predecessor.budget.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", hiddenBudgetBytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  hiddenDecision.run.predecessorBudgetDigest =
    hiddenDecision.predecessor.budget.digest;
  hiddenDecision.budgetLedger.predecessorBudgetDigest =
    hiddenDecision.predecessor.budget.digest;
  await assertInvalid(hiddenDecision, "invalid-predecessor-lineage");

  const duplicateHistorical = clone();
  const duplicateBudget = JSON.parse(
    Buffer.from(
      duplicateHistorical.predecessor.budget.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  const duplicateReservation = structuredClone(
    duplicateBudget.reservations[0],
  );
  duplicateReservation.id = "prior-reservation-duplicate";
  duplicateReservation.amounts = {
    candidateCount: 0,
    admissions: 1,
    workUnits: 1,
    costMicros: 1,
    durationMinutes: 1,
  };
  duplicateReservation.idempotencyKey =
    computeReservationIdempotency(duplicateReservation);
  duplicateBudget.reservations.push(duplicateReservation);
  duplicateBudget.caps = {
    candidateCount: 1,
    admissions: 3,
    workUnits: 8,
    costMicros: 300001,
    durationMinutes: 46,
  };
  duplicateBudget.cumulativeAfter = {
    candidateCount: 0,
    admissions: 3,
    workUnits: 8,
    costMicros: 300001,
    durationMinutes: 46,
  };
  const duplicateHistoryEntry = duplicateBudget.history.find(
    (item) => item.runId === duplicateReservation.runId,
  );
  duplicateHistoryEntry.reservationIdempotencyKeys.push(
    duplicateReservation.idempotencyKey,
  );
  duplicateHistoryEntry.entryDigest =
    computeBudgetHistoryEntryDigest(duplicateHistoryEntry);
  duplicateBudget.historyRoot =
    computeBudgetHistoryRoot(duplicateBudget.history);
  duplicateBudget.usedIdempotencyKeys.push(
    duplicateReservation.idempotencyKey,
  );
  const duplicateBudgetBytes = Buffer.from(
    JSON.stringify(duplicateBudget),
    "utf8",
  );
  duplicateHistorical.predecessor.budget.contentBase64 =
    duplicateBudgetBytes.toString("base64");
  duplicateHistorical.predecessor.budget.byteLength =
    duplicateBudgetBytes.length;
  duplicateHistorical.predecessor.budget.digest =
    `sha256:${await crypto.subtle
      .digest("SHA-256", duplicateBudgetBytes)
      .then((value) => Buffer.from(value).toString("hex"))}`;
  duplicateHistorical.run.predecessorBudgetDigest =
    duplicateHistorical.predecessor.budget.digest;
  duplicateHistorical.budgetLedger.predecessorBudgetDigest =
    duplicateHistorical.predecessor.budget.digest;
  await assertInvalid(duplicateHistorical, "invalid-predecessor-lineage");

  const malformedPreviousResult = clone();
  const previousResult = JSON.parse(
    Buffer.from(
      malformedPreviousResult.predecessor.result.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  previousResult.schemaVersion = "unknown.previous.v1";
  previousResult.resultDigest = "not-a-digest";
  const malformedResultBytes = Buffer.from(
    JSON.stringify(previousResult),
    "utf8",
  );
  malformedPreviousResult.predecessor.result.contentBase64 =
    malformedResultBytes.toString("base64");
  malformedPreviousResult.predecessor.result.byteLength =
    malformedResultBytes.length;
  malformedPreviousResult.predecessor.result.digest =
    `sha256:${await crypto.subtle
      .digest("SHA-256", malformedResultBytes)
      .then((value) => Buffer.from(value).toString("hex"))}`;
  malformedPreviousResult.run.predecessorResultDigest =
    malformedPreviousResult.predecessor.result.digest;
  await assertInvalid(
    malformedPreviousResult,
    "invalid-predecessor-lineage",
  );
});

test("provider evidence references resolve to exact source issue revisions", async () => {
  const changed = clone();
  const issue = changed.providerSnapshot.issues[0];
  const body = JSON.parse(
    Buffer.from(issue.body.contentBase64, "base64").toString("utf8"),
  );
  body.evidenceRefs = ["fabricated-evidence"];
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  issue.body.contentBase64 = bytes.toString("base64");
  issue.body.byteLength = bytes.length;
  issue.body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", bytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  issue.revision = computeProviderIssueRevision(issue);
  changed.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    changed.providerSnapshot.issues,
  );
  await assertInvalid(changed, "unresolved-issue-evidence");
});

test("owner-signed run binds provider snapshot revision and completeness root", async () => {
  const changedRevision = clone();
  changedRevision.run.providerSnapshotRevision = `sha256:${"0".repeat(64)}`;
  await assertInvalid(changedRevision, "invalid-run-binding");

  const changedRoot = clone();
  changedRoot.run.providerSnapshotCompletenessRoot = `sha256:${"0".repeat(64)}`;
  await assertInvalid(changedRoot, "invalid-run-binding");

  const lateDecision = clone();
  lateDecision.classificationDecisions[0].decidedAt =
    "2026-09-17T18:00:00Z";
  lateDecision.run.signedAt = "2026-09-17T17:40:00Z";
  await assertInvalid(lateDecision, "invalid-run-binding");

  const lateAssessment = clone();
  lateAssessment.compositionAssessments[0].assessedAt =
    "2026-09-17T17:21:00Z";
  lateAssessment.classificationDecisions[0].decidedAt =
    "2026-09-17T17:20:00Z";
  await assertInvalid(lateAssessment, "invalid-composition-assessment");

  const prematureAssessment = clone();
  prematureAssessment.compositionAssessments[0].assessedAt =
    "2026-09-17T17:04:59Z";
  await assertInvalid(prematureAssessment, "invalid-composition-assessment");
});

test("affected Claws stay inside the signed selected portfolio", async () => {
  const changed = clone();
  changed.providerSnapshot.issues[1].body.contentBase64 = Buffer.from(
    JSON.stringify({
      ...JSON.parse(
        Buffer.from(
          changed.providerSnapshot.issues[1].body.contentBase64,
          "base64",
        ).toString("utf8"),
      ),
      affectedClawIds: ["not-selected"],
    }),
    "utf8",
  ).toString("base64");
  const bytes = Buffer.from(
    changed.providerSnapshot.issues[1].body.contentBase64,
    "base64",
  );
  changed.providerSnapshot.issues[1].body.byteLength = bytes.length;
  changed.providerSnapshot.issues[1].body.digest = `sha256:${await crypto.subtle
    .digest("SHA-256", bytes)
    .then((value) => Buffer.from(value).toString("hex"))}`;
  changed.providerSnapshot.issues[1].revision =
    computeProviderIssueRevision(changed.providerSnapshot.issues[1]);
  changed.providerSnapshot.completenessRoot = computeProviderSnapshotRoot(
    changed.providerSnapshot.issues,
  );
  await assertInvalid(changed, "invalid-classification-decision");
});

test("human decisions require signer-specific grants active at decision time", async () => {
  const wrongSignerGrant = clone();
  wrongSignerGrant.grants.find(
    (item) => item.id === "grant-classification",
  ).granteeRef = "principal-product-owner";
  await assertInvalid(wrongSignerGrant, "invalid-decision-review-grant");

  const retroactive = clone();
  retroactive.grants.find(
    (item) => item.id === "grant-classification",
  ).notBefore = "2026-09-17T18:00:00Z";
  await assertInvalid(retroactive, "invalid-decision-review-grant");

  const lateBudget = clone();
  lateBudget.grants.find((item) => item.id === "grant-budget").notBefore =
    "2026-09-17T18:00:00Z";
  await assertInvalid(lateBudget, "invalid-cumulative-budget-ledger");

  const prematureBudget = clone();
  prematureBudget.budgetLedger.issuedAt = "2026-09-17T17:10:00Z";
  await assertInvalid(prematureBudget, "invalid-cumulative-budget-ledger");

  const decisionGrant = manage.grants.find(
    (item) => item.id === "grant-classification",
  );
  assert.equal(grantActiveAt(decisionGrant, "2026-09-17T17:20:00Z"), true);
  assert.equal(grantActiveAt(decisionGrant, "2026-09-19T17:20:00Z"), false);
  assert.equal(
    grantActiveAt({ ...decisionGrant, notBefore: "not-a-time" }, manage.run.asOf),
    false,
  );
  assert.equal(
    grantActiveAt({ ...decisionGrant, expiresAt: null }, manage.run.asOf),
    false,
  );
});

test("principal roles are derived from the externally signed key domains", async () => {
  const escalated = clone();
  escalated.principals.find(
    (item) => item.id === "principal-decision-owner",
  ).roles.push("budget-owner");
  await assertInvalid(escalated, "unauthenticated-principal-roster");

  const reassigned = clone();
  reassigned.principals.find(
    (item) => item.id === "principal-budget-owner",
  ).kind = "system";
  await assertInvalid(reassigned, "unauthenticated-principal-roster");
});

test("budget period includes the complete final date", () => {
  assert.equal(
    budgetPeriodContains(
      manage.budgetLedger.period,
      "2026-09-30T23:59:59.999Z",
    ),
    true,
  );
  assert.equal(
    budgetPeriodContains(
      manage.budgetLedger.period,
      "2026-10-01T00:00:00Z",
    ),
    false,
  );
  assert.equal(
    budgetPeriodContains(
      { startsOn: "2026-02-30", endsOn: "2026-03-31" },
      "2026-03-02T00:00:00Z",
    ),
    false,
  );
});

test("generated reservation IDs remain schema-bounded", () => {
  const revisionA = `sha256:${"a".repeat(64)}`;
  const revisionB = `sha256:${"b".repeat(64)}`;
  assert.ok(
    reservationIdForIssue("a".repeat(120), revisionA).length <= 120,
  );
  assert.notEqual(
    reservationIdForIssue("provider-issue-compose", revisionA),
    reservationIdForIssue("provider-issue-compose", revisionB),
  );
  assert.ok(
    planIdForIssue("d".repeat(120), "i".repeat(120)).length <= 120,
  );
  assert.equal(
    planIdForIssue(
      "portfolio-decision-september-v2",
      "provider-issue-compose",
    ),
    "plan-portfolio-decision-september-v2-provider-issue-compose",
  );
});

test("provider title and body media types are fixed", async () => {
  const changed = clone();
  changed.providerSnapshot.issues[0].title.mediaType = "application/json";
  changed.providerSnapshot.issues[0].body.mediaType =
    "text/plain; charset=utf-8";
  await assertInvalid(changed, "invalid-issue-media-type");
});

test("package tree covers every material catalog, source, and package file", async (t) => {
  const result = await evaluate();
  assert.notEqual(result.resultStatus, "invalid");
  assert.ok(
    packageTree.trees.every(
      (tree) =>
        tree.files.some((item) => item.path === "catalog-entry.json") &&
        tree.files.some((item) => item.path.startsWith("sources/")) &&
        tree.files.some((item) => item.path.startsWith("claws/")),
    ),
  );
  const changed = structuredClone(packageTree);
  changed.trees[0].files[1].digest = `sha256:${"0".repeat(64)}`;
  changed.trees[0].root = computePackageTreeRoot(changed.trees[0].files);
  changed.root = computePackageManifestRoot(changed.trees);
  changed.revision = computePackageManifestRevision(changed);
  await assertInvalid(manage, "package-tree-resource-substitution", {
    packageTree: changed,
  });

  const staleRevision = clone();
  const staleTree = structuredClone(packageTree);
  staleRevision.run.catalogRevision = "1".repeat(40);
  staleTree.catalogRevision = "1".repeat(40);
  await assertInvalid(staleRevision, "invalid-package-tree-root", {
    packageTree: staleTree,
  });

  const unknownTree = structuredClone(packageTree);
  unknownTree.trees[0].clawId = "unknown-claw";
  let unknownResult;
  await assert.doesNotReject(async () => {
    unknownResult = await evaluatePortfolioV2(manage, {
      asOf: manage.run.asOf,
      publicTrust,
      packageTree: unknownTree,
    });
  });
  assert.equal(unknownResult.resultStatus, "invalid");
  assert.ok(
    codes(unknownResult).has("package-tree-resource-substitution"),
  );

  const scratch = join(
    fileURLToPath(new URL(".", import.meta.url)),
    ".package-tree-symlink-test",
  );
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const target = join(scratch, "target");
  await mkdir(target, { recursive: true });
  for (const clawId of manage.onboarding.selectedClawIds) {
    await mkdir(join(scratch, "sources", clawId), { recursive: true });
    await mkdir(join(scratch, "claws", clawId), { recursive: true });
  }
  await symlink(
    target,
    join(
      scratch,
      "sources",
      manage.onboarding.selectedClawIds[0],
      "unmanifested-link",
    ),
    "junction",
  );
  await assertInvalid(manage, "package-tree-resource-substitution", {
    targetRoot: scratch,
  });

  let missingDirectoryResult;
  await assert.doesNotReject(async () => {
    missingDirectoryResult = await evaluatePortfolioV2(manage, {
      asOf: manage.run.asOf,
      publicTrust,
      packageTree,
      targetRoot: join(scratch, "missing-root"),
    });
  });
  assert.ok(
    codes(missingDirectoryResult).has("package-tree-resource-substitution"),
  );
});

test("externally pinned trust enforces root, lifecycle, revocation, and domain separation", async () => {
  const rootChanged = structuredClone(publicTrust);
  rootChanged.root.revision = `sha256:${"0".repeat(64)}`;
  await assertInvalid(manage, "invalid-externally-pinned-trust-root", {
    publicTrust: rootChanged,
  });

  const shared = structuredClone(publicTrust);
  shared.keys[1].publicKeyPem = shared.keys[0].publicKeyPem;
  await assertInvalid(manage, "shared-or-duplicate-trust-key", {
    publicTrust: shared,
  });

  const revoked = clone();
  revoked.providerSnapshot.signature.keyId = "catalog-key-retired";
  await assertInvalid(revoked, "invalid-domain-signature");

  const chronology = structuredClone(publicTrust);
  chronology.keys.find((item) => item.status === "active").activatedAt =
    "2026-10-02T00:00:00Z";
  await assertInvalid(manage, "invalid-trust-key-lifecycle", {
    publicTrust: chronology,
  });

  const notYetActive = structuredClone(publicTrust);
  notYetActive.keys.find((item) => item.keyId === "product-classification-key")
    .activatedAt = "2026-09-20T00:00:00Z";
  await assertInvalid(manage, "invalid-trust-key-lifecycle", {
    publicTrust: notYetActive,
  });

  const futureSigned = clone();
  futureSigned.budgetLedger.issuedAt = "2026-09-18T20:00:00Z";
  await assertInvalid(futureSigned, "invalid-domain-signature");
});

test("usage is tenant/source scoped, minimized, current, and advisory only", async () => {
  const result = await evaluate();
  assert.equal(result.usage.supplied, true);
  assert.equal(result.usage.correctnessOrSafetyOverride, false);
  assert.ok(
    result.usage.effects.every(
      (item) => item.advisoryOnly && !item.productionMutation,
    ),
  );

  const sharedSource = clone();
  sharedSource.usageEnvelopes[0].records[0].tenantRef = "tenant-other";
  await assertInvalid(sharedSource, "invalid-minimized-usage");

  const unapprovedScope = clone();
  unapprovedScope.usageEnvelopes[0].tenantRef = "tenant-other";
  unapprovedScope.usageEnvelopes[0].sourceRef =
    "controlled://tenant-other/minimized-usage";
  unapprovedScope.usageEnvelopes[0].records[0].tenantRef = "tenant-other";
  unapprovedScope.usageEnvelopes[0].records[0].sourceRef =
    "controlled://tenant-other/minimized-usage";
  await assertInvalid(unapprovedScope, "invalid-usage-envelope");

  const ownerScopeTampering = clone();
  ownerScopeTampering.onboarding.approvedUsageScopes[0].tenantRef =
    "tenant-other";
  await assertInvalid(ownerScopeTampering, "invalid-domain-signature");

  const expanded = clone();
  expanded.usageEnvelopes[0].records[0].minimizedFields = [
    "event-count",
    "success-count",
  ];
  await assertInvalid(expanded, "invalid-schema");

  const expired = clone();
  expired.usageEnvelopes[0].records[0].validUntil =
    "2026-09-17T18:00:00Z";
  await assertInvalid(expired, "invalid-minimized-usage");
});

test("structural authority remains false in accepted and rejected paths", async () => {
  const result = await evaluate();
  assert.deepEqual(result.authority, manage.authority);
  for (const key of Object.keys(manage.authority)) {
    const changed = clone();
    changed.authority[key] = true;
    await assertInvalid(changed, "invalid-schema");
  }
});

test("V2 API is total and bounded for hostile JSON-like values", async () => {
  const cycle = {};
  cycle.self = cycle;
  const getter = {};
  Object.defineProperty(getter, "secret", {
    enumerable: true,
    get() {
      throw new Error("DO_NOT_ECHO");
    },
  });

  const hidden = { visible: true };
  Object.defineProperty(hidden, "hidden", {
    enumerable: false,
    value: "DO_NOT_ECHO",
  });
  const values = [
    null,
    undefined,
    Symbol("DO_NOT_ECHO"),
    1n,
    () => "DO_NOT_ECHO",
    new Proxy({}, { ownKeys() { throw new Error("DO_NOT_ECHO"); } }),
    cycle,
    getter,
    hidden,
    JSON.parse(`{"__proto__":${JSON.stringify(manage)}}`),
  ];
  for (const value of values) {
    let result;
    await assert.doesNotReject(async () => {
      result = await evaluatePortfolioV2(value, {
        asOf: manage.run.asOf,
        publicTrust,
        packageTree,
      });
    });
    assert.equal(result.resultStatus, "invalid");
    assert.equal(JSON.stringify(result).includes("DO_NOT_ECHO"), false);
    assert.ok(JSON.stringify(result).length < 4096);
  }
});

test("V2 API rejects malformed trust and package-tree inputs without throwing", async () => {
  for (const options of [
    { publicTrust: null, packageTree },
    { publicTrust, packageTree: null },
    { publicTrust: [], packageTree },
    { publicTrust, packageTree: [] },
  ]) {
    let result;
    await assert.doesNotReject(async () => {
      result = await evaluatePortfolioV2(manage, {
        asOf: manage.run.asOf,
        ...options,
      });
    });
    assert.equal(result.resultStatus, "invalid");
    assert.ok(result.findings.some((item) => item.code === "invalid-schema"));
    assert.ok(JSON.stringify(result).length < 4096);
  }
});

test("V2 CLI is bounded and non-echoing", async (t) => {
  const scratch = join(
    fileURLToPath(new URL(".", import.meta.url)),
    ".v2-test-output",
  );
  await mkdir(scratch, { recursive: true });
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const malformed = join(scratch, "malformed.json");
  await writeFile(malformed, '{"marker":"DO_NOT_ECHO"');
  const run = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./claw-portfolio-manager.mjs", import.meta.url)),
      malformed,
      "--as-of",
      manage.run.asOf,
      "--trust",
      fileURLToPath(new URL("public-trust-v2.test.json", fixtureRoot)),
      "--package-tree",
      fileURLToPath(new URL("package-tree-v1.test.json", fixtureRoot)),
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout.includes("DO_NOT_ECHO"), false);
  assert.equal(JSON.parse(run.stdout).resultStatus, "invalid");
});

test("strongest composition executes exact analogue validators and derives only typed losses", async () => {
  const graph = await runStrongestComposition();
  assert.equal(graph.verdict, "NEW");
  assert.equal(graph.candidateSidecarUsed, false);
  assert.equal(graph.sourceMode, "repository-owner-artifacts-only");
  assert.ok(graph.pins.every((item) => item.valid));
  assert.deepEqual(graph.execution.schemaValid, {
    repositoryOperations: true,
    repositoryCompliance: true,
    workChiefOfStaff: true,
  });

  assert.deepEqual(graph.execution.semanticFindingCounts, {
    repositoryOperations: 0,
    repositoryCompliance: 0,
    workChiefOfStaff: 0,
  });
  assert.equal(
    graph.execution.contribution.candidate.id,
    "claw-portfolio-manager",
  );
  assert.deepEqual(graph.execution.contribution.proposalErrors, []);
  assert.equal(graph.execution.contribution.nearestMatchesCovered, true);
  assert.ok(graph.execution.contribution.nearestMatches.length >= 3);
  assert.deepEqual(
    graph.execution.contribution.discussedAlternativeIds,
    graph.execution.contribution.nearestMatches,
  );
  assert.deepEqual(graph.reachableAuthority, []);
  assert.deepEqual(graph.unusedAuthorityPorts, [
    {
      nodeId: "repository-compliance-program-manager",
      portId: "issue-mutation",
      authority: ["external-mutation"],
    },
  ]);
  assert.deepEqual(
    graph.losses.map((item) => item.targetPort),
    [
      "portfolio-run-lineage",
      "provider-issue-snapshot",
      "typed-admission-decision",
      "signed-package-tree",
      "cumulative-budget-ledger",
      "externally-pinned-trust",
      "minimized-usage-evidence",
      "proposal-owner-handoff",
    ],
  );
  const modeledAdapterTargets = new Set(
    graph.edges
      .filter(
        (edge) =>
          edge.from.node === "strongest-current-composition-adapter" &&
          edge.to.node === "target-claw-portfolio-manager",
      )
      .map((edge) => edge.to.port),
  );
  assert.deepEqual(
    [...modeledAdapterTargets].sort(),
    graph.losses
      .map((item) => item.targetPort)
      .filter((item) => item !== "externally-pinned-trust")
      .sort(),
  );
  assert.ok(
    graph.losses
      .filter((item) => item.targetPort !== "externally-pinned-trust")
      .every((item) =>
        item.availableRelatedPorts.some(
          (port) =>
            port.nodeId === "strongest-current-composition-adapter" &&
            port.type === item.requiredType &&
            port.missingFields.length > 0,
        ),
      ),
  );
});

test("stale analogue pins block rather than masquerading as NEW", async () => {
  const graph = await runStrongestComposition();
  const stale = structuredClone(graph);
  stale.pins[0].valid = false;
  assert.equal(compositionVerdictFor(stale), "BLOCKED");

  const invalidExecution = structuredClone(graph);
  invalidExecution.execution.semanticFindingCounts.workChiefOfStaff = 1;
  assert.equal(compositionVerdictFor(invalidExecution), "BLOCKED");

  const wrongCandidate = structuredClone(graph);
  wrongCandidate.execution.contribution.candidate.id =
    "repository-operations-manager";
  assert.equal(compositionVerdictFor(wrongCandidate), "BLOCKED");

  const missingNearest = structuredClone(graph);
  missingNearest.execution.contribution.nearestMatchesCovered = false;
  assert.equal(compositionVerdictFor(missingNearest), "BLOCKED");

  const missingPin = await inspectPinnedFile(
    "missing-artifact.json",
    `sha256:${"0".repeat(64)}`,
    async () => {
      throw new Error("missing");
    },
  );
  assert.deepEqual(missingPin, {
    path: "missing-artifact.json",
    expectedDigest: `sha256:${"0".repeat(64)}`,
    observedDigest: null,
    valid: false,
  });

  const targetOnly = graph.nodes.filter(
    (item) => item.id === "target-claw-portfolio-manager",
  );
  assert.doesNotThrow(() => reachableTargetPorts(targetOnly, graph.edges));
  assert.deepEqual(
    [...reachableTargetPorts(targetOnly, graph.edges).keys()],
    [],
  );
});

test("every typed loss is independently clearable and complete composition stops NEW", async () => {
  assert.equal(
    futureControlTimestamp("2026-09-31T00:00:00Z"),
    null,
  );
  const graph = await runStrongestComposition();
  for (const loss of graph.losses) {
    const control = futureControls.controls.find(
      (item) => item.output.type === loss.requiredType,
    );
    const next = await runStrongestComposition({
      futureControls: [control],
      asOf: manage.run.asOf,
    });
    assert.ok(next.reachableTargetPorts.includes(loss.targetPort));
    assert.ok(
      !next.losses.some((item) => item.targetPort === loss.targetPort),
    );
  }
  const controls = futureControls.controls;
  const complete = await runStrongestComposition({
    futureControls: controls,
    asOf: manage.run.asOf,
  });
  assert.equal(complete.verdict, "COMPOSE");
  assert.deepEqual(complete.losses, []);
  assert.deepEqual(complete.reachableAuthority, []);
  assert.equal(
    compositionAdmissionFinding(complete).code,
    "lossless-composition-requires-candidate-deletion",
  );

  const staleControls = await runStrongestComposition({
    futureControls: controls,
    asOf: "2026-09-19T00:00:00Z",
  });
  assert.equal(staleControls.verdict, "BLOCKED");
  assert.ok(
    staleControls.rejectedFutureControls.every(
      (item) => item.code === "invalid-control",
    ),
  );

  const duplicateNode = await runStrongestComposition({
    futureControls: [controls[0], controls[0]],
    asOf: manage.run.asOf,
  });
  assert.equal(duplicateNode.verdict, "BLOCKED");
  assert.ok(
    duplicateNode.rejectedFutureControls.some(
      (item) => item.code === "duplicate-node-id",
    ),
  );

  const tampered = structuredClone(controls);
  tampered[0].validatorDigest = `sha256:${"0".repeat(64)}`;
  const rejected = await runStrongestComposition({
    futureControls: tampered,
    asOf: manage.run.asOf,
  });
  assert.equal(rejected.verdict, "BLOCKED");
  assert.ok(
    rejected.losses.some(
      (item) => item.targetPort === graph.losses[0].targetPort,
    ),
  );

  const nullValue = structuredClone(controls);
  const [field] = Object.keys(nullValue[0].output.value);
  nullValue[0].output.value[field].value = null;
  nullValue[0].output.value[field].evidenceDigest = sha256Digest({
    type: nullValue[0].output.type,
    field,
    value: null,
  });
  nullValue[0].artifactDigest = sha256Digest({
    type: nullValue[0].output.type,
    value: nullValue[0].output.value,
  });
  const nullRejected = await runStrongestComposition({
    futureControls: nullValue,
    asOf: manage.run.asOf,
  });
  assert.equal(nullRejected.verdict, "BLOCKED");
  assert.ok(
    nullRejected.losses.some(
      (item) => item.targetPort === graph.losses[0].targetPort,
    ),
  );

  const unsafe = await runStrongestComposition({
    futureControls: [
      futureControls.unsafeControl,
      ...controls.slice(1),
    ],
    asOf: manage.run.asOf,
  });
  assert.equal(unsafe.authoritySafe, false);
  assert.ok(unsafe.reachableAuthority.includes("publish"));
  assert.equal(unsafe.verdict, "BLOCKED");

  const unknownAuthority = structuredClone(futureControls.unsafeControl);
  unknownAuthority.output.authority = ["delete-repository"];
  const unknown = await runStrongestComposition({
    futureControls: [unknownAuthority, ...controls.slice(1)],
    asOf: manage.run.asOf,
  });
  assert.equal(unknown.verdict, "BLOCKED");
  assert.ok(
    unknown.rejectedFutureControls.some(
      (item) => item.code === "invalid-control",
    ),
  );

  const cyclic = structuredClone(controls[0]);
  cyclic.output.value.cycle = cyclic;
  let cyclicResult;
  await assert.doesNotReject(async () => {
    cyclicResult = await runStrongestComposition({
      futureControls: [cyclic],
      asOf: manage.run.asOf,
    });
  });
  assert.equal(cyclicResult.verdict, "BLOCKED");
  assert.deepEqual(cyclicResult.rejectedFutureControls, [
    { id: "unknown-control", code: "invalid-control" },
  ]);
});
