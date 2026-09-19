import assert from "node:assert/strict";
import {
  createHash,
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
  expectedSourceBindings,
  localModuleClosure,
  localModuleSpecifiers,
  renderCompositionPlan,
  trustRevision,
} from "./composition.mjs";
import {
  canonicalJson,
  sha256Digest,
} from "./candidate-utils.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const candidateRoot = dirname(fileURLToPath(import.meta.url));
const evaluationTime = "2026-09-17T19:00:00Z";
const [
  input,
  trust,
  trustPin,
  expected,
  proof,
  packageManifest,
  catalog,
  readme,
] =
  await Promise.all([
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
    readFile(new URL("../../package.json", import.meta.url), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("../../catalog.json", import.meta.url), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("./README.md", import.meta.url), "utf8"),
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

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function operatingContractDigest(entry) {
  return sha256Digest({
    audience: entry.audience,
    principles: entry.principles,
    boundaries: entry.boundaries,
    intake: entry.intake,
    workflow: entry.workflow,
    deliverables: entry.deliverables,
    doneWhen: entry.doneWhen,
    capabilityGuidance: entry.capabilityGuidance,
  });
}

function providerRevision(value) {
  const {
    revision: _revision,
    completenessRoot: _completenessRoot,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function contentRevision(value) {
  const {
    revision: _revision,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function authenticatedFixture(mutate = () => {}) {
  const nextInput = clone();
  const nextTrust = structuredClone(trust);
  const nextPin = structuredClone(trustPin);
  nextInput.runtimeBudget = null;
  const providerBody = JSON.parse(
    Buffer.from(
      nextInput.providerIssue.body.contentBase64,
      "base64",
    ).toString("utf8"),
  );
  mutate({ input: nextInput, providerBody });

  const keys = new Map();
  for (const record of nextTrust.keys) {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    record.publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
    keys.set(record.domain, { record, privateKey });
  }
  nextTrust.revision = trustRevision(nextTrust);
  nextPin.trustRevision = nextTrust.revision;

  nextInput.admission.proposalDigest = sha256Digest(
    nextInput.admission.proposal,
  );
  nextInput.portfolio.revision = sha256Digest({
    id: nextInput.portfolio.id,
    selectedClawIds: nextInput.portfolio.selectedClawIds,
    sourceBindingsRoot: nextInput.portfolio.sourceBindingsRoot,
    capacityEnvelopeRef: nextInput.portfolio.capacityEnvelopeRef,
  });
  nextInput.continuation.portfolioRevision = nextInput.portfolio.revision;
  if (nextInput.admission.compositionContract) {
    nextInput.admission.compositionContract.proposalDigest =
      nextInput.admission.proposalDigest;
  }
  providerBody.proposalDigest = nextInput.admission.proposalDigest;
  const bodyBytes = Buffer.from(canonicalJson(providerBody), "utf8");
  Object.assign(nextInput.providerIssue.body, {
    byteLength: bodyBytes.length,
    digest: digestBytes(bodyBytes),
    contentBase64: bodyBytes.toString("base64"),
  });
  nextInput.providerIssue.ownerContentMapping.replacementDigest = sha256Digest({
    titleDigest: nextInput.providerIssue.title.digest,
    bodyDigest: nextInput.providerIssue.body.digest,
  });
  nextInput.providerIssue.revision = providerRevision(
    nextInput.providerIssue,
  );
  nextInput.providerIssue.completenessRoot = sha256Digest({
    id: nextInput.providerIssue.id,
    revision: nextInput.providerIssue.revision,
  });
  nextInput.admission.issueRevision = nextInput.providerIssue.revision;
  for (const receipt of nextInput.idempotencyReceipts) {
    receipt.issueRevision = nextInput.providerIssue.revision;
  }
  if (nextInput.usageEvidence) {
    nextInput.usageEvidence.issueRevision = nextInput.providerIssue.revision;
    nextInput.usageEvidence.revision = contentRevision(
      nextInput.usageEvidence,
    );
  }

  for (const [domain, values] of [
    ["provider", [nextInput.providerIssue]],
    ["continuation", [nextInput.continuation]],
    ["admission", [nextInput.admission]],
    ["catalog", [nextInput.packageManifest]],
    ["receipt", nextInput.idempotencyReceipts],
    ["usage", nextInput.usageEvidence ? [nextInput.usageEvidence] : []],
    [
      "runtime-budget",
      nextInput.runtimeBudget ? [nextInput.runtimeBudget] : [],
    ],
  ]) {
    const key = keys.get(domain);
    for (const value of values) {
      signRecord(value, key.record.keyId, key.privateKey);
    }
  }
  return { input: nextInput, trust: nextTrust, trustPin: nextPin };
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
  assert.deepEqual(result.ports["provider-issue-snapshot"].decodedBody, {
    evidenceRefs: [
      {
        authority: "provider-custodian-attestation",
        id: "issue-api",
        kind: "provider-issue",
        subjectRef: "claw-portfolio-manager",
      },
      {
        authority: "repository-operations-attestation",
        id: "checkpoint-weekly-2026-09-13",
        kind: "continuation-checkpoint",
        subjectRef: "continuation-portfolio-composition",
      },
    ],
    proposalDigest: input.admission.proposalDigest,
    request:
      "Compose the owner Claws into an issue-native portfolio stewardship workflow.",
  });

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

test("archival proof remains explicit and outside the default check gate", () => {
  assert.equal(
    packageManifest.scripts.check.includes("claw-portfolio-composition"),
    false,
  );
  assert.equal(
    packageManifest.scripts["check:claw-portfolio-composition"],
    "node --test candidates/claw-portfolio-manager/composition.test.mjs && node candidates/claw-portfolio-manager/verify.mjs",
  );
  assert.match(
    packageManifest.scripts["check:claw-portfolio-owners"],
    /repository-operations-manager\.test\.mjs/u,
  );
  assert.match(readme, /npm run regenerate:claw-portfolio-composition/u);
});

test("source bindings cover the complete transitive local import closure", async () => {
  assert.deepEqual(
    localModuleSpecifiers(`
      import "./side-effect.mjs";
      import {
        value,
      } from "../shared/value.mjs";
      export { other } from "./other.mjs";
      export * from "./export-all.mjs";
      import /* comment */ "./commented.mjs";
      const lazy = import("./lazy.mjs", { with: { type: "json" } });
      import Ajv from "ajv";
    `),
    [
     "../shared/value.mjs",
     "./commented.mjs",
     "./export-all.mjs",
     "./lazy.mjs",
     "./other.mjs",
     "./side-effect.mjs",
    ],
  );
  assert.throws(
    () => localModuleSpecifiers('import("./" + moduleName);'),
    /not statically bindable/u,
  );
  const [closure, bindings] = await Promise.all([
    localModuleClosure(),
    expectedSourceBindings(),
  ]);
  const boundPaths = new Set(bindings.map((item) => item.path));
  assert.deepEqual(
    closure.filter((path) => !boundPaths.has(path)),
    [],
  );
  for (const required of [
    "scripts/openclaw-proof-lib.mjs",
    "scripts/narrative-authority.mjs",
    "scripts/narrative-safety.mjs",
    "scripts/artifact-semantics.mjs",
    "scripts/repository-operations-manager.mjs",
    "scripts/repository-compliance-program-manager.mjs",
  ]) {
    assert.ok(closure.includes(required), required);
    assert.ok(
      input.sourceBindings.some((item) => item.path === required),
      `${required} is missing from the signed fixture`,
    );
  }
  assert.deepEqual(
    input.sourceBindings.map((item) => item.path),
    bindings.map((item) => item.path),
  );
  for (const modulePath of closure) {
    assert.ok(boundPaths.has(modulePath), `${modulePath} is not bound`);
  }
  const missingReachableModule = clone();
  missingReachableModule.runtimeBudget = null;
  missingReachableModule.sourceBindings =
    missingReachableModule.sourceBindings.filter(
      (item) => item.path !== "scripts/narrative-authority.mjs",
    );
  const rejected = await compose(missingReachableModule);
  assert.equal(rejected.verdict, "INVALID");
  assert.ok(rejected.findings.includes("source-binding-mismatch"));
  assert.ok(
    bindings.some(
      (item) =>
        item.path === "package-lock.json" && item.role === "dependency-lock",
    ),
  );
  assert.deepEqual(
    input.packageManifest.files.map((item) => item.path),
    bindings.map((item) => item.path),
  );
});

test("authenticated owner evidence derives every admission disposition", async () => {
  const same = {
    user: "same",
    job: "same",
    workflow: "same",
    outputs: "same",
    evidence: "same",
    authority: "same",
  };
  const cases = [
    [
      "UNSUPPORTED",
      ({ input: value }) => {
        value.admission.dispositionEvidence.availableOwnerIds =
          value.admission.dispositionEvidence.availableOwnerIds.filter(
            (ownerId) => ownerId !== "repository-compliance-program-manager",
          );
      },
    ],
    [
      "DUPLICATE",
      ({ input: value }) => {
        const existing = catalog.entries.find(
          (entry) => entry.id === "benefits-realization-manager",
        );
        for (const field of [
          "audience",
          "principles",
          "boundaries",
          "intake",
          "workflow",
          "deliverables",
          "doneWhen",
          "capabilityGuidance",
        ]) {
          value.admission.proposal.entry[field] = structuredClone(
            existing[field],
          );
        }
        value.admission.comparison = { ...same };
        value.admission.dispositionEvidence.existingMatch = {
          id: existing.id,
          operatingContractDigest: operatingContractDigest(existing),
        };
      },
    ],
    ["COMPOSE", () => {}],
    [
      "RETIRE",
      ({ input: value, providerBody }) => {
        providerBody.evidenceRefs.push({
          id: "retirement-decision",
          kind: "lifecycle-retirement",
          subjectRef: value.admission.proposal.entry.id,
          authority: "catalog-maintainer-decision",
        });
        value.admission.dispositionEvidence.lifecycle = {
          action: "retire",
          evidenceRefs: ["retirement-decision"],
        };
      },
    ],
    [
      "IMPROVE",
      ({ input: value }) => {
        value.admission.compositionContract = null;
      },
    ],
    [
      "NEW",
      ({ input: value }) => {
        value.admission.compositionContract = null;
        value.admission.comparison = {
          ...same,
          job: "different",
          workflow: "different",
        };
      },
    ],
    [
      "PRODUCT_DECISION",
      ({ input: value, providerBody }) => {
        value.admission.compositionContract = null;
        value.admission.comparison = { ...same };
        providerBody.evidenceRefs.push({
          id: "product-decision-required",
          kind: "product-decision-required",
          subjectRef: value.admission.proposal.entry.id,
          authority: "catalog-maintainer-decision",
        });
        value.admission.dispositionEvidence.productDecisionRefs = [
          "product-decision-required",
        ];
      },
    ],
  ];
  for (const [classification, mutate] of cases) {
    const signed = authenticatedFixture(mutate);
    const result = await composePortfolioPlan(
      signed.input,
      signed.trust,
      signed.trustPin,
      { asOf: evaluationTime },
    );
    assert.equal(result.verdict, "IMPROVE_COMPOSE", JSON.stringify(result));
    assert.equal(result.classification, classification);
    assert.equal(
      result.ports["typed-admission-decision"].classification,
      classification,
    );
    assert.equal(
      result.ports["proposal-owner-handoff"].classification,
      classification,
    );
  }

  for (const variantBasis of [
    "audience",
    "industry-vocabulary",
    "personality",
    "branding",
    "presentation",
  ]) {
    const signed = authenticatedFixture(({ input: value }) => {
      value.admission.compositionContract = null;
      value.admission.comparison = {
        ...same,
        user: variantBasis === "audience" ? "different" : "same",
      };
      value.admission.dispositionEvidence.variantBasis = variantBasis;
    });
    const result = await composePortfolioPlan(
      signed.input,
      signed.trust,
      signed.trustPin,
      { asOf: evaluationTime },
    );
    assert.equal(result.verdict, "IMPROVE_COMPOSE", variantBasis);
    assert.equal(result.classification, "VARIANT", variantBasis);
  }

  const composeFirst = authenticatedFixture(({ input: value }) => {
    value.admission.comparison.job = "different";
    value.admission.comparison.workflow = "different";
  });
  const composeFirstResult = await composePortfolioPlan(
    composeFirst.input,
    composeFirst.trust,
    composeFirst.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(composeFirstResult.classification, "COMPOSE");
  assert.equal(
    composeFirstResult.admissionScorecard.candidates.find(
      (item) => item.classification === "NEW",
    ).eligible,
    false,
  );

  const humanDecisionFirst = authenticatedFixture(
    ({ input: value, providerBody }) => {
      providerBody.evidenceRefs.push({
        id: "product-decision-required",
        kind: "product-decision-required",
        subjectRef: value.admission.proposal.entry.id,
        authority: "catalog-maintainer-decision",
      });
      value.admission.dispositionEvidence.productDecisionRefs = [
        "product-decision-required",
      ];
    },
  );
  const humanDecisionFirstResult = await composePortfolioPlan(
    humanDecisionFirst.input,
    humanDecisionFirst.trust,
    humanDecisionFirst.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(humanDecisionFirstResult.classification, "PRODUCT_DECISION");
  assert.equal(
    humanDecisionFirstResult.admissionScorecard.candidates
      .filter((item) => item.classification !== "PRODUCT_DECISION")
      .some((item) => item.eligible),
    false,
  );

  const incompleteOwnerSet = authenticatedFixture(({ input: value }) => {
    value.admission.dispositionEvidence.requiredOwnerIds =
      value.admission.dispositionEvidence.requiredOwnerIds.slice(1);
  });
  const incompleteOwnerSetResult = await composePortfolioPlan(
    incompleteOwnerSet.input,
    incompleteOwnerSet.trust,
    incompleteOwnerSet.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(incompleteOwnerSetResult.verdict, "INVALID");
  assert.ok(
    incompleteOwnerSetResult.findings.includes("invalid-disposition-evidence"),
  );

  for (const field of ["lifecycle", "productDecisionRefs"]) {
    const unrelatedEvidence = authenticatedFixture(({ input: value }) => {
      if (field === "lifecycle") {
        value.admission.dispositionEvidence.lifecycle = {
          action: "retire",
          evidenceRefs: ["issue-api"],
        };
      } else {
        value.admission.dispositionEvidence.productDecisionRefs = ["issue-api"];
      }
    });
    const unrelatedEvidenceResult = await composePortfolioPlan(
      unrelatedEvidence.input,
      unrelatedEvidence.trust,
      unrelatedEvidence.trustPin,
      { asOf: evaluationTime },
    );
    assert.equal(unrelatedEvidenceResult.verdict, "INVALID", field);
    assert.ok(
      unrelatedEvidenceResult.findings.includes(
        "invalid-disposition-evidence",
      ),
      field,
    );
  }

  const maximumEvidence = authenticatedFixture(
    ({ input: value, providerBody }) => {
      const lifecycleRefs = [];
      for (let index = 1; index <= 14; index += 1) {
        const id = `retirement-decision-${index}`;
        lifecycleRefs.push(id);
        providerBody.evidenceRefs.push({
          id,
          kind: "lifecycle-retirement",
          subjectRef: value.admission.proposal.entry.id,
          authority: "catalog-maintainer-decision",
        });
      }
      value.admission.dispositionEvidence.lifecycle = {
        action: "retire",
        evidenceRefs: lifecycleRefs,
      };
    },
  );
  const maximumEvidenceResult = await composePortfolioPlan(
    maximumEvidence.input,
    maximumEvidence.trust,
    maximumEvidence.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(
    maximumEvidenceResult.verdict,
    "IMPROVE_COMPOSE",
    JSON.stringify(maximumEvidenceResult),
  );
  assert.equal(maximumEvidenceResult.classification, "RETIRE");
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

test("provider body reconstruction rejects unknown sensitive fields without echo", async () => {
  const signed = authenticatedFixture(({ providerBody }) => {
    providerBody.sensitiveEmployeeRecord = "DO_NOT_ECHO";
  });
  const result = await composePortfolioPlan(
    signed.input,
    signed.trust,
    signed.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(result.verdict, "INVALID");
  assert.ok(result.findings.includes("invalid-provider-request"));
  assert.equal(JSON.stringify(result).includes("DO_NOT_ECHO"), false);
  assert.equal(
    JSON.stringify(result).includes("sensitiveEmployeeRecord"),
    false,
  );
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
  assert.equal(result.ports["stateless-budget-plan"].proposedDemand, 4);
  assert.equal(result.ports["stateless-budget-plan"].totalDemand, 28);
  assert.equal(result.ports["stateless-budget-plan"].remainingAmount, -8);
  assert.equal(result.ports["stateless-budget-plan"].overCapacity, true);
  assert.deepEqual(result.ports["stateless-budget-plan"].allocation, {
    state: "blocked",
    allocatedAmount: 0,
    blockedAmount: 4,
    reason: "capacity-conflict",
  });
  assert.deepEqual(result.ports["stateless-budget-plan"].conflictRefs, [
    "conflict-engineering-capacity",
  ]);

  const resolvedConflict = authenticatedFixture(({ input: value }) => {
    value.portfolio.capacityEnvelopeRef = "capacity-product";
    value.admission.dispositionEvidence.proposedDemand = {
      capacityEnvelopeRef: "capacity-product",
      amount: 4,
      unit: "person-weeks",
    };
  });
  const resolvedConflictResult = await composePortfolioPlan(
    resolvedConflict.input,
    resolvedConflict.trust,
    resolvedConflict.trustPin,
    { asOf: evaluationTime },
  );
  assert.equal(
    resolvedConflictResult.verdict,
    "IMPROVE_COMPOSE",
    JSON.stringify(resolvedConflictResult),
  );
  assert.deepEqual(
    resolvedConflictResult.ports["stateless-budget-plan"].conflictRefs,
    [],
  );
  assert.deepEqual(
    resolvedConflictResult.ports["stateless-budget-plan"].allocation,
    {
      state: "allocated",
      allocatedAmount: 4,
      blockedAmount: 0,
      reason: null,
    },
  );

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

  const invalidDemand = authenticatedFixture(({ input: value }) => {
    value.admission.dispositionEvidence.proposedDemand.capacityEnvelopeRef =
      "capacity-unknown";
  });
  assert.equal(
    (
      await composePortfolioPlan(
        invalidDemand.input,
        invalidDemand.trust,
        invalidDemand.trustPin,
        { asOf: evaluationTime },
      )
    ).verdict,
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

test("composition API is total and bounded for hostile values in every argument", async () => {
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
  const hostileValues = [
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
  ];
  for (const value of hostileValues) {
    const calls = [
      [value, trust, trustPin, { asOf: evaluationTime }],
      [input, value, trustPin, { asOf: evaluationTime }],
      [input, trust, value, { asOf: evaluationTime }],
      [input, trust, trustPin, value],
    ];
    for (const args of calls) {
      let result;
      await assert.doesNotReject(async () => {
        result = await composePortfolioPlan(...args);
      });
      assert.equal(result.verdict, "INVALID");
      assert.equal(JSON.stringify(result).includes("DO_NOT_ECHO"), false);
    }
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
