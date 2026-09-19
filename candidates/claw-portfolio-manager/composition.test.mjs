import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  composePortfolioPlan,
  continuationModeFindings,
  deriveAdmissionClassification,
  deriveAdmissionScorecard,
  renderCompositionPlan,
  trustRevision,
} from "./composition.mjs";
import { canonicalJson } from "./candidate-utils.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const candidateRoot = dirname(fileURLToPath(import.meta.url));
const evaluationTime = "2026-09-17T19:00:00Z";
const [input, trust, trustPin, expected, proof] = await Promise.all([
  readFile(new URL("composition-input.test.json", fixtureRoot), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("composition-trust.test.json", fixtureRoot), "utf8").then(
    JSON.parse,
  ),
  readFile(
    new URL("composition-trust-pin.test.json", fixtureRoot),
    "utf8",
  ).then(JSON.parse),
  readFile(
    new URL("./expected/composition.expected.json", import.meta.url),
    "utf8",
  ).then(JSON.parse),
  readFile(new URL("./proof/composition-plan.md", import.meta.url), "utf8"),
]);

function clone(value = input) {
  return structuredClone(value);
}

function signRecord(value, keyId, privateKey) {
  delete value.signature;
  value.signature = {
    keyId,
    algorithm: "Ed25519",
    value: signBytes(
      null,
      Buffer.from(canonicalJson(value), "utf8"),
      privateKey,
    ).toString("base64"),
  };
}

function continuationFixture(mode) {
  const nextInput = clone();
  const nextTrust = structuredClone(trust);
  const nextPin = structuredClone(trustPin);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const key = nextTrust.keys.find((item) => item.domain === "continuation");
  key.publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  nextTrust.revision = trustRevision(nextTrust);
  nextPin.trustRevision = nextTrust.revision;
  nextInput.continuation.mode = mode;
  if (mode === "bootstrap") {
    nextInput.continuation.predecessorCheckpointRef = null;
    nextInput.continuation.priorReceiptIds = [];
    nextInput.idempotencyReceipts = [];
  }
  signRecord(nextInput.continuation, key.keyId, privateKey);
  return { nextInput, nextTrust, nextPin };
}

async function compose(value = input, options = {}) {
  return composePortfolioPlan(
    value,
    options.trust ?? trust,
    options.trustPin ?? trustPin,
    { asOf: options.asOf ?? evaluationTime },
  );
}

test("actual owner artifacts compose the exact eight-port portfolio plan", async () => {
  const result = await compose();
  assert.deepEqual(result, expected);
  assert.equal(result.verdict, "IMPROVE_COMPOSE");
  assert.equal(result.standaloneCandidateAccepted, false);
  assert.equal(result.confidence, 0.92);
  assert.equal(result.admissionScorecard.candidates.length, 8);
  assert.equal(result.optionalEvidence.advisoryOnly, true);
  assert.equal(
    result.ports["provider-issue-snapshot"].body.contentBase64,
    input.providerIssue.body.contentBase64,
  );
  assert.deepEqual(Object.keys(result.ports).sort(), [
    "externally-pinned-trust",
    "minimized-usage-evidence",
    "portfolio-run-lineage",
    "proposal-owner-handoff",
    "provider-issue-snapshot",
    "signed-package-tree",
    "stateless-budget-plan",
    "typed-admission-decision",
  ]);
  assert.deepEqual(result.reachableAuthority, []);
  assert.deepEqual(result.authority, {
    merge: false,
    publish: false,
    externalMutation: false,
    atomicMutation: false,
    budgetIncrease: false,
    riskAcceptance: false,
    hrInference: false,
    sensitivePersonalInference: false,
  });
  assert.equal(renderCompositionPlan(result), proof);
});

test("admission scorecard covers all dispositions and keeps NEW last", () => {
  const sameJobDifference = {
    user: "same",
    job: "same",
    workflow: "different",
    outputs: "same",
    evidence: "same",
    authority: "same",
  };
  const distinctJobDifference = {
    ...sameJobDifference,
    job: "different",
  };
  const noDifference = Object.fromEntries(
    Object.keys(sameJobDifference).map((key) => [key, "same"]),
  );
  const audienceOnlyDifference = {
    ...noDifference,
    user: "different",
  };
  const cases = [
    ["UNSUPPORTED", sameJobDifference, { supported: false }],
    ["DUPLICATE", sameJobDifference, { exactDuplicate: true }],
    ["RETIRE", sameJobDifference, { retirementRequested: true }],
    ["COMPOSE", distinctJobDifference, { compositionFeasible: true }],
    ["IMPROVE", sameJobDifference, {}],
    [
      "VARIANT",
      audienceOnlyDifference,
      { variantRequired: true, improvementFeasible: false },
    ],
    ["NEW", distinctJobDifference, {}],
    ["PRODUCT_DECISION", noDifference, {}],
  ];
  for (const [classification, comparison, options] of cases) {
    assert.equal(
      deriveAdmissionClassification(comparison, options),
      classification,
    );
  }
  const composeFirst = deriveAdmissionScorecard(distinctJobDifference, {
    compositionFeasible: true,
  });
  assert.equal(composeFirst.selected, "COMPOSE");
  assert.equal(
    composeFirst.candidates.find((item) => item.classification === "NEW")
      .eligible,
    false,
  );
  assert.deepEqual(
    new Set(composeFirst.candidates.map((item) => item.classification)),
    new Set([
      "NEW",
      "IMPROVE",
      "COMPOSE",
      "VARIANT",
      "PRODUCT_DECISION",
      "RETIRE",
      "DUPLICATE",
      "UNSUPPORTED",
    ]),
  );
});

test("source, provider, proposal, and package substitutions fail closed", async () => {
  const sourceChanged = clone();
  sourceChanged.sourceBindings[0].digest = `sha256:${"0".repeat(64)}`;
  assert.equal((await compose(sourceChanged)).verdict, "INVALID");

  const providerChanged = clone();
  providerChanged.providerIssue.state = "closed";
  assert.equal((await compose(providerChanged)).verdict, "INVALID");

  const proposalChanged = clone();
  proposalChanged.admission.proposal.entry.workflow = [];
  assert.equal((await compose(proposalChanged)).verdict, "INVALID");

  const packageChanged = clone();
  packageChanged.packageManifest.files[0].digest = `sha256:${"0".repeat(64)}`;
  assert.equal((await compose(packageChanged)).verdict, "INVALID");
});

test("continuation and external receipts are exact without atomic mutation claims", async () => {
  const result = await compose();
  assert.equal(result.ports["stateless-budget-plan"].reservationClaim, false);
  assert.equal(result.ports["stateless-budget-plan"].atomicMutationClaim, false);
  assert.equal(
    result.ports["stateless-budget-plan"].externalReceiptRequired,
    true,
  );
  assert.equal(result.ports["stateless-budget-plan"].committedDemand, 24);
  assert.equal(result.ports["stateless-budget-plan"].remainingAmount, -4);
  assert.equal(result.ports["stateless-budget-plan"].overCapacity, true);
  assert.deepEqual(result.ports["stateless-budget-plan"].conflictRefs, [
    "conflict-engineering-capacity",
  ]);

  const missingReceipt = clone();
  missingReceipt.idempotencyReceipts = [];
  assert.equal((await compose(missingReceipt)).verdict, "INVALID");

  const staleContinuation = clone();
  staleContinuation.continuation.validUntil = "2026-09-17T18:00:00Z";
  assert.equal((await compose(staleContinuation)).verdict, "INVALID");

  const insufficientRuntimeBudget = clone();
  insufficientRuntimeBudget.runtimeBudget.maxTotalTokens = 1;
  assert.equal(
    (await compose(insufficientRuntimeBudget)).verdict,
    "INVALID",
  );
});

test("bootstrap, adopt, and manage produce verified signed continuation plans", async () => {
  for (const mode of ["bootstrap", "adopt", "manage"]) {
    const { nextInput, nextTrust, nextPin } = continuationFixture(mode);
    assert.deepEqual(
      continuationModeFindings(
        nextInput.continuation,
        "checkpoint-weekly-2026-09-13",
      ),
      [],
    );
    const result = await composePortfolioPlan(nextInput, nextTrust, nextPin, {
      asOf: evaluationTime,
    });
    assert.equal(result.verdict, "IMPROVE_COMPOSE", JSON.stringify(result));
    assert.equal(result.ports["portfolio-run-lineage"].mode, mode);
    assert.deepEqual(
      result.ports["portfolio-run-lineage"].signature,
      nextInput.continuation.signature,
    );
  }
});

test("trust and optional usage remain independently scoped", async () => {
  const wrongPin = structuredClone(trustPin);
  wrongPin.trustRevision = `sha256:${"0".repeat(64)}`;
  assert.equal(
    (await compose(input, { trustPin: wrongPin })).verdict,
    "INVALID",
  );

  const changedUsage = clone();
  changedUsage.usageEvidence.tenantRef = "tenant-other";
  assert.equal((await compose(changedUsage)).verdict, "INVALID");

  const noUsage = clone();
  noUsage.usageEvidence = null;
  const noUsageResult = await compose(noUsage);
  assert.equal(noUsageResult.verdict, "IMPROVE_COMPOSE");
  assert.equal(noUsageResult.ports["minimized-usage-evidence"], null);
  assert.equal(noUsageResult.classification, "COMPOSE");

  const noOptionalProof = clone();
  noOptionalProof.runtimeBudget = null;
  const noOptionalProofResult = await compose(noOptionalProof);
  assert.equal(noOptionalProofResult.verdict, "IMPROVE_COMPOSE");
  assert.equal(noOptionalProofResult.optionalEvidence, null);

  const expiredPin = structuredClone(trustPin);
  expiredPin.expiresAt = "2026-09-17T18:00:00Z";
  assert.equal(
    (await compose(input, { trustPin: expiredPin })).verdict,
    "INVALID",
  );

  for (const mutate of [
    (value) => {
      value.keys.find((item) => item.domain === "usage").domain = "provider";
    },
    (value) => {
      value.keys.find((item) => item.domain === "usage").publicKeyPem =
        value.keys.find((item) => item.domain === "provider").publicKeyPem;
    },
  ]) {
    const incompatibleTrust = structuredClone(trust);
    const incompatiblePin = structuredClone(trustPin);
    mutate(incompatibleTrust);
    incompatibleTrust.revision = trustRevision(incompatibleTrust);
    incompatiblePin.trustRevision = incompatibleTrust.revision;
    assert.equal(
      (
        await compose(input, {
          trust: incompatibleTrust,
          trustPin: incompatiblePin,
        })
      ).verdict,
      "INVALID",
    );
  }

  assert.equal(
    (
      await compose(input, {
        asOf: "2026-09-19T00:00:00Z",
      })
    ).verdict,
    "INVALID",
  );
});

test("composition API is total and bounded for hostile values", async () => {
  const cycle = {};
  cycle.self = cycle;
  const getter = {};
  Object.defineProperty(getter, "secret", {
    enumerable: true,
    get() {
      throw new Error("DO_NOT_ECHO");
    },
  });
  const hidden = {};
  Object.defineProperty(hidden, "hidden", {
    enumerable: false,
    value: "DO_NOT_ECHO",
  });
  const symbolKey = {
    [Symbol("DO_NOT_ECHO")]: true,
  };
  for (const value of [
    null,
    undefined,
    Symbol("secret"),
    1n,
    cycle,
    getter,
    hidden,
    symbolKey,
    new Date(),
    { oversized: "x".repeat(1024 * 1024 + 1) },
    new Proxy({}, { ownKeys: () => { throw new Error("DO_NOT_ECHO"); } }),
  ]) {
    let result;
    await assert.doesNotReject(async () => {
      result = await composePortfolioPlan(value, trust, trustPin, {
        asOf: evaluationTime,
      });
    });
    assert.equal(result.verdict, "INVALID");
    assert.equal(JSON.stringify(result).includes("DO_NOT_ECHO"), false);
  }
});

test("CLI file handling is bounded, total, and non-echoing", async () => {
  const baseArgs = [
    "--input",
    join(candidateRoot, "fixtures", "composition-input.test.json"),
    "--trust",
    join(candidateRoot, "fixtures", "composition-trust.test.json"),
    "--trust-pin",
    join(candidateRoot, "fixtures", "composition-trust-pin.test.json"),
    "--as-of",
    evaluationTime,
  ];
  const valid = spawnSync(process.execPath, [join(candidateRoot, "composition.mjs"), ...baseArgs], {
    cwd: join(candidateRoot, "..", ".."),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.deepEqual(JSON.parse(valid.stdout), expected);

  const scratch = await mkdtemp(join(candidateRoot, ".composition-cli-test-"));
  try {
    const malformed = join(scratch, "malformed.json");
    const oversized = join(scratch, "oversized.json");
    await writeFile(malformed, '{"value":"DO_NOT_ECHO"');
    await writeFile(oversized, `"${"x".repeat(1024 * 1024)}"`);
    for (const path of [malformed, oversized]) {
      const args = [...baseArgs];
      args[1] = path;
      const result = spawnSync(
        process.execPath,
        [join(candidateRoot, "composition.mjs"), ...args],
        {
          cwd: join(candidateRoot, "..", ".."),
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        },
      );
      assert.equal(result.status, 1);
      assert.equal(result.stdout.includes("DO_NOT_ECHO"), false);
      assert.equal(result.stdout.includes(path), false);
      assert.equal(JSON.parse(result.stdout).verdict, "INVALID");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
