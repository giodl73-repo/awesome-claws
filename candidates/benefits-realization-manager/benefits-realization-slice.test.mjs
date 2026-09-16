import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  allocateMinorUnits,
  BENEFITS_REALIZATION_LIMITS,
  evaluateBenefitsRealizationSlice,
  formatMinorUnits,
  renderBenefitsRealizationProof,
} from "./benefits-realization-slice.mjs";
import { resealInternalFixture } from "./benefits-realization-fixture-tools.mjs";

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const fixture = await readJson("./fixtures/benefits-realization.input.json");
const secondFixture = await readJson(
  "./fixtures/municipal-permit-cost.input.json",
);
const unsupportedFixture = await readJson(
  "./fixtures/unsupported-attribution.input.json",
);
const unsupportedWithEvidenceFixture = await readJson(
  "./fixtures/unsupported-with-evidence.input.json",
);
const absentFinanceCloseFixture = await readJson(
  "./fixtures/absent-finance-close.input.json",
);
const trustStore = await readJson("./fixtures/trust-store.test.json");
const sourceBundle = await readJson("./fixtures/source-bytes.test.json");
const municipalSourceBundle = await readJson(
  "./fixtures/source-bytes-municipal.test.json",
);
const accepted = await readJson("./expected/accepted-result.json");
const secondAccepted = await readJson(
  "./expected/municipal-permit-cost.accepted.json",
);
const unsupportedFailure = await readJson(
  "./expected/unsupported-attribution.failure.json",
);
const proof = await readFile(
  new URL("./proof/accepted-ledger.md", import.meta.url),
  "utf8",
);
const evaluate = (value, options = {}) => {
  const sourceCandidates =
    value?.request?.ledgerId === "ledger-municipal-permit-q2"
      ? municipalSourceBundle
      : sourceBundle;
  const referenced = new Set(
    value?.evidence?.map(
      (record) => `${record.sourceRef}\0${record.sourceVersion}`,
    ) ?? [],
  );
  const defaultSourceBundle = {
    ...sourceCandidates,
    sources: sourceCandidates.sources.filter((record) =>
      referenced.has(`${record.sourceRef}\0${record.sourceVersion}`),
    ),
  };
  return evaluateBenefitsRealizationSlice(value, {
    trustStore,
    sourceBundle: defaultSourceBundle,
    ...options,
  });
};

test("raw non-zero increase baseline derives the accepted closed ledger", () => {
  const result = evaluate(fixture);
  assert.deepEqual(result, accepted);
  assert.equal(result.sharedKpi.observedDeltaMinor, 12000000);
  assert.equal(result.finance.grossBenefitMinor, 12000000);
  assert.equal(result.finance.netRealizedMinor, 10500000);
  assert.equal(renderBenefitsRealizationProof(result), proof);
});

test("proof formatting preserves max-safe minor-unit cents without floating conversion", () => {
  const result = structuredClone(accepted);
  result.finance.grossBenefitMinor = 9007199254740991;
  assert.equal(
    formatMinorUnits(result.finance.grossBenefitMinor, "USD", 100),
    "$90,071,992,547,409.91",
  );
  assert.match(
    renderBenefitsRealizationProof(result),
    /- Gross benefit: \$90,071,992,547,409\.91/u,
  );
});

test("production evaluation has no embedded trust or source-content default", () => {
  const noInjection = evaluateBenefitsRealizationSlice(fixture);
  assert.equal(noInjection.status, "invalid-contract");
  assert.ok(
    noInjection.contractFindings.some(
      (item) => item.code === "missing-trust-store",
    ),
  );
  assert.ok(
    noInjection.contractFindings.some(
      (item) => item.code === "missing-source-bytes",
    ),
  );

  const wrongOwnerTrust = {
    authorities: {
      "principal-finance-owner-wrong":
        trustStore.authorities["principal-finance-owner-erin"],
    },
  };
  const wrongOwner = evaluateBenefitsRealizationSlice(fixture, {
    trustStore: wrongOwnerTrust,
    sourceBundle,
  });
  assert.ok(
    wrongOwner.contractFindings.some(
      (item) => item.code === "missing-trust-store",
    ),
  );
});

test("signed source digests are verified against the injected source bytes", () => {
  const changedBundle = structuredClone(sourceBundle);
  changedBundle.sources.find(
    (record) =>
      record.sourceRef ===
      "controlled://metrics/support-cost-avoidance/baseline",
  ).bytesBase64 = Buffer.from("different owner-supplied bytes").toString(
    "base64",
  );
  const result = evaluateBenefitsRealizationSlice(fixture, {
    trustStore,
    sourceBundle: changedBundle,
  });
  assert.equal(result.status, "invalid-contract");
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "source-content-digest-mismatch",
    ),
  );
});

test("aggregate source cap counts every supplied record once including unreferenced extras", () => {
  const bytesBase64 = Buffer.alloc(
    BENEFITS_REALIZATION_LIMITS.maxSourceBytesPerRecord,
  ).toString("base64");
  const oversizedBundle = {
    sources: Array.from({ length: 5 }, (_, index) => ({
      sourceRef: `controlled://unreferenced/oversized-${index}`,
      sourceVersion: "v1",
      bytesBase64,
    })),
  };
  const result = evaluateBenefitsRealizationSlice(fixture, {
    trustStore,
    sourceBundle: oversizedBundle,
  });
  assert.ok(
    result.contractFindings.some(
      (item) =>
        item.code === "source-total-too-large" &&
        item.message.includes("1310720 decoded bytes"),
    ),
  );
  assert.equal(
    result.contractFindings.filter(
      (item) => item.code === "unreferenced-source-record",
    ).length,
    5,
  );
});

test("shared supplied source is counted once even when referenced by multiple evidence rows", () => {
  const value = structuredClone(fixture);
  const sharedBytes = Buffer.alloc(200 * 1024, 7);
  const sharedDigest = `sha256:${createHash("sha256").update(sharedBytes).digest("hex")}`;
  for (const evidence of value.evidence.slice(0, 6)) {
    evidence.sourceRef = "controlled://shared/source";
    evidence.sourceVersion = "v1";
    evidence.sourceContentDigest = sharedDigest;
  }
  const result = evaluateBenefitsRealizationSlice(
    resealInternalFixture(value),
    {
      trustStore,
      sourceBundle: {
        sources: [
          {
            sourceRef: "controlled://shared/source",
            sourceVersion: "v1",
            bytesBase64: sharedBytes.toString("base64"),
          },
        ],
      },
    },
  );
  assert.equal(
    result.contractFindings.some(
      (item) => item.code === "source-total-too-large",
    ),
    false,
  );
  assert.equal(
    result.contractFindings.some(
      (item) => item.code === "unreferenced-source-record",
    ),
    false,
  );
});

test("second raw decrease vector derives direction-aware values and allocates residual cents", () => {
  const result = evaluate(secondFixture);
  assert.deepEqual(result, secondAccepted);
  assert.equal(result.sharedKpi.observedDeltaMinor, 1200002);
  assert.equal(
    result.benefitResults
      .filter((record) => record.kind === "benefit")
      .reduce((sum, record) => sum + record.recognizedDeltaMinor, 0),
    1200002,
  );
  assert.equal(result.finance.netRealizedMinor, 1075001);
  assert.deepEqual(
    [...allocateMinorUnits(2, secondFixture.allocationRules[0].allocations)],
    [
      ["benefit-intake-automation", 1],
      ["benefit-triage-standardization", 0],
      ["benefit-knowledge-assisted-resolution", 1],
    ],
  );
});

test("BigInt aggregate arithmetic rejects an unsafe net minor-unit result", () => {
  const value = structuredClone(fixture);
  const maximum = Number.MAX_SAFE_INTEGER;
  value.kpis[0].baseline.valueMinor = maximum;
  value.kpis[0].target.valueMinor = maximum;
  value.kpis[0].observed.valueMinor = 0;
  value.benefits[3].directMeasure.baselineMinor = 0;
  value.benefits[3].directMeasure.targetMinor = maximum;
  value.benefits[3].directMeasure.observedMinor = maximum;
  const result = evaluate(resealInternalFixture(value));
  assert.equal(result.status, "invalid-contract");
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "aggregate-out-of-supported-range",
    ),
  );
  assert.equal(result.finance.grossBenefitMinor, null);
  assert.equal(result.finance.netRealizedMinor, null);
});

test("unsupported attribution returns one blocker and derives no aggregate realization", () => {
  const result = evaluate(unsupportedFixture);
  assert.deepEqual(result, unsupportedFailure);
  assert.equal(result.blockers[0].code, "unsupported-attribution");
  assert.equal(result.finance.grossBenefitMinor, null);
  assert.equal(result.finance.netRealizedMinor, null);
});

test("unsupported attribution blocks even when non-supporting evidence remains", () => {
  const result = evaluate(unsupportedWithEvidenceFixture);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].code, "unsupported-attribution");
  assert.deepEqual(result.blockers[0].evidenceRefs, [
    "evidence-attribution-routing",
  ]);
  assert.equal(result.finance.grossBenefitMinor, null);
  assert.equal(result.finance.netRealizedMinor, null);
});

test("all supported attributions cannot produce totals without a valid finance close", () => {
  const result = evaluate(absentFinanceCloseFixture);
  assert.equal(result.status, "invalid-contract");
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "invalid-finance-close",
    ),
  );
  assert.equal(result.finance.grossBenefitMinor, null);
  assert.equal(result.finance.netRealizedMinor, null);
});

test("schema validation rejects an unknown root field before semantic evaluation", () => {
  const value = structuredClone(fixture);
  value.unknown = true;
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.deepEqual(result.contractFindings, []);
  assert.ok(
    result.schemaFindings.some(
      (item) =>
        item.code === "schema-additional-properties" &&
        item.path === "/unknown",
    ),
  );
});

test("schema validation rejects missing request currency before semantic evaluation", () => {
  const value = structuredClone(fixture);
  delete value.request.currency;
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.deepEqual(result.contractFindings, []);
  assert.ok(
    result.schemaFindings.some(
      (item) =>
        item.code === "schema-required" &&
        item.path === "/request/currency",
    ),
  );
});

test("schema validation rejects a wrong observed minor-unit type", () => {
  const value = structuredClone(fixture);
  value.kpis[0].observed.valueMinor = "14000000";
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.deepEqual(result.contractFindings, []);
  assert.ok(
    result.schemaFindings.some(
      (item) =>
        item.code === "schema-type" &&
        item.path === "/kpis/0/observed/valueMinor",
    ),
  );
});

test("evidence cardinality and input/source byte limits fail structurally without throwing", () => {
  const tooManyEvidence = structuredClone(fixture);
  while (
    tooManyEvidence.evidence.length <=
    BENEFITS_REALIZATION_LIMITS.maxEvidenceRecords
  ) {
    const index = tooManyEvidence.evidence.length;
    tooManyEvidence.evidence.push({
      ...structuredClone(tooManyEvidence.evidence[0]),
      id: `evidence-overflow-${index}`,
    });
  }
  assert.doesNotThrow(() => evaluate(tooManyEvidence));
  const evidenceResult = evaluate(tooManyEvidence);
  assert.equal(evidenceResult.status, "invalid-schema");
  assert.ok(
    evidenceResult.schemaFindings.some(
      (item) => item.code === "schema-max-items",
    ),
  );

  const oversizedInput = structuredClone(fixture);
  oversizedInput.principals[0].name = "x".repeat(
    BENEFITS_REALIZATION_LIMITS.maxInputBytes,
  );
  assert.doesNotThrow(() => evaluate(oversizedInput));
  const inputResult = evaluate(oversizedInput);
  assert.equal(inputResult.status, "invalid-schema");
  assert.ok(
    inputResult.schemaFindings.some(
      (item) => item.code === "input-too-large",
    ),
  );

  const oversizedSources = structuredClone(sourceBundle);
  oversizedSources.sources[0].bytesBase64 = Buffer.alloc(
    BENEFITS_REALIZATION_LIMITS.maxSourceBytesPerRecord + 1,
  ).toString("base64");
  assert.doesNotThrow(() =>
    evaluateBenefitsRealizationSlice(fixture, {
      trustStore,
      sourceBundle: oversizedSources,
    }),
  );
  const sourceResult = evaluateBenefitsRealizationSlice(fixture, {
    trustStore,
    sourceBundle: oversizedSources,
  });
  assert.equal(sourceResult.status, "invalid-contract");
  assert.ok(
    sourceResult.contractFindings.some(
      (item) => item.code === "source-item-too-large",
    ),
  );
});

test("cardinality conditionals reject four benefits and no disbenefit without throwing", () => {
  const value = structuredClone(fixture);
  value.benefits[3].kind = "benefit";
  assert.doesNotThrow(() => evaluate(value));
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.ok(
    result.schemaFindings.some((item) => item.keyword === "contains"),
  );
});

test("shape conditionals reject a disbenefit without a direct measure", () => {
  const value = structuredClone(fixture);
  value.benefits[3].directMeasure = null;
  assert.doesNotThrow(() => evaluate(value));
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.ok(
    result.schemaFindings.some(
      (item) =>
        item.keyword === "type" &&
        item.path === "/benefits/3/directMeasure",
    ),
  );
});

test("schema-valid dangling attribution reference returns a deterministic contract finding", () => {
  const value = structuredClone(fixture);
  value.benefits[0].attributionRef = "attribution-missing";
  const resealed = resealInternalFixture(value);
  assert.doesNotThrow(() => evaluate(resealed));
  const result = evaluate(resealed);
  assert.equal(result.status, "invalid-contract");
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "invalid-benefit-profile",
    ),
  );
  assert.equal(result.benefitResults[0].attributionState, "missing");
  assert.equal(result.benefitResults[0].recognizedDeltaMinor, null);
});

test("proof rendering refuses invalid results without throwing", () => {
  const value = structuredClone(fixture);
  value.extra = true;
  const result = evaluate(value);
  assert.doesNotThrow(() => renderBenefitsRealizationProof(result));
  assert.equal(
    renderBenefitsRealizationProof(result),
    [
      "# Benefits Realization Manager proof refused",
      "",
      "- Status: **invalid-schema**",
      "- Findings: 1",
      "- Reason: invalid input or contract state cannot be rendered as realization proof.",
      "",
    ].join("\n"),
  );
});

test("CLI accepts valid input and emits structured schema failure for invalid input", async () => {
  const modulePath = fileURLToPath(
    new URL("./benefits-realization-slice.mjs", import.meta.url),
  );
  const validInputPath = fileURLToPath(
    new URL("./fixtures/benefits-realization.input.json", import.meta.url),
  );
  const trustStorePath = fileURLToPath(
    new URL("./fixtures/trust-store.test.json", import.meta.url),
  );
  const sourceBundlePath = fileURLToPath(
    new URL("./fixtures/source-bytes.test.json", import.meta.url),
  );
  const validOutputPath = fileURLToPath(
    new URL(`./.cli-valid-${process.pid}.result.json`, import.meta.url),
  );
  const validProofPath = fileURLToPath(
    new URL(`./.cli-valid-${process.pid}.md`, import.meta.url),
  );
  const untrustedOutputPath = fileURLToPath(
    new URL(`./.cli-untrusted-${process.pid}.result.json`, import.meta.url),
  );
  const oversizedInputPath = fileURLToPath(
    new URL(`./.cli-oversized-${process.pid}.json`, import.meta.url),
  );
  const oversizedOutputPath = fileURLToPath(
    new URL(`./.cli-oversized-${process.pid}.result.json`, import.meta.url),
  );
  const inputPath = fileURLToPath(
    new URL(`./.cli-invalid-${process.pid}.json`, import.meta.url),
  );
  const outputPath = fileURLToPath(
    new URL(`./.cli-invalid-${process.pid}.result.json`, import.meta.url),
  );
  const proofPath = fileURLToPath(
    new URL(`./.cli-invalid-${process.pid}.md`, import.meta.url),
  );
  const invalid = structuredClone(fixture);
  invalid.unknown = true;
  await writeFile(inputPath, `${JSON.stringify(invalid)}\n`);
  const oversized = structuredClone(fixture);
  oversized.principals[0].name = "x".repeat(
    BENEFITS_REALIZATION_LIMITS.maxInputBytes,
  );
  await writeFile(oversizedInputPath, `${JSON.stringify(oversized)}\n`);
  try {
    const validRun = spawnSync(
      process.execPath,
      [
        modulePath,
        "evaluate",
        validInputPath,
        validOutputPath,
        "--trust-store",
        trustStorePath,
        "--source-bundle",
        sourceBundlePath,
        "--proof",
        validProofPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(validRun.status, 0, validRun.stderr);
    assert.deepEqual(
      JSON.parse(await readFile(validOutputPath, "utf8")),
      accepted,
    );
    assert.equal(await readFile(validProofPath, "utf8"), proof);

    const untrustedRun = spawnSync(
      process.execPath,
      [modulePath, "evaluate", validInputPath, untrustedOutputPath],
      { encoding: "utf8" },
    );
    assert.equal(untrustedRun.status, 2, untrustedRun.stderr);
    const untrustedResult = JSON.parse(
      await readFile(untrustedOutputPath, "utf8"),
    );
    assert.ok(
      untrustedResult.contractFindings.some(
        (item) => item.code === "missing-trust-store",
      ),
    );

    const oversizedRun = spawnSync(
      process.execPath,
      [modulePath, "evaluate", oversizedInputPath, oversizedOutputPath],
      { encoding: "utf8" },
    );
    assert.equal(oversizedRun.status, 2, oversizedRun.stderr);
    const oversizedResult = JSON.parse(
      await readFile(oversizedOutputPath, "utf8"),
    );
    assert.ok(
      oversizedResult.schemaFindings.some(
        (item) => item.code === "input-too-large",
      ),
    );

    const run = spawnSync(
      process.execPath,
      [
        modulePath,
        "evaluate",
        inputPath,
        outputPath,
        "--trust-store",
        trustStorePath,
        "--source-bundle",
        sourceBundlePath,
        "--proof",
        proofPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 2, run.stderr);
    const result = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(result.status, "invalid-schema");
    assert.ok(
      result.schemaFindings.some(
        (item) => item.code === "schema-additional-properties",
      ),
    );
    assert.match(await readFile(proofPath, "utf8"), /proof refused/u);
  } finally {
    await Promise.all([
      rm(inputPath, { force: true }),
      rm(outputPath, { force: true }),
      rm(proofPath, { force: true }),
      rm(validOutputPath, { force: true }),
      rm(validProofPath, { force: true }),
      rm(untrustedOutputPath, { force: true }),
      rm(oversizedInputPath, { force: true }),
      rm(oversizedOutputPath, { force: true }),
    ]);
  }
});

test("financial V1 rejects a non-currency shared KPI", () => {
  const value = structuredClone(fixture);
  value.kpis[0].unit = "hours";
  const result = evaluate(resealInternalFixture(value));
  assert.equal(result.status, "invalid-contract");
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "incompatible-kpi-unit",
    ),
  );
});

test("fixture resealing cannot bless changed source evidence or its signed trust root", () => {
  for (const mutate of [
    (record) => {
      record.sourceRef = "controlled://metrics/changed-source";
    },
    (record) => {
      record.sourceVersion = "changed-version";
    },
    (record) => {
      record.sourceContentDigest =
        "sha256:abababababababababababababababababababababababababababababababab";
    },
  ]) {
    const sourceChanged = structuredClone(fixture);
    mutate(sourceChanged.evidence[0]);
    const sourceChangedResult = evaluate(resealInternalFixture(sourceChanged));
    assert.ok(
      sourceChangedResult.contractFindings.some(
        (item) => item.code === "untrusted-source-evidence",
      ),
    );
  }

  const sourceChanged = structuredClone(fixture);
  sourceChanged.evidence[0].sourceContentDigest =
    "sha256:abababababababababababababababababababababababababababababababab";
  const rootChanged = resealInternalFixture(sourceChanged);
  rootChanged.sourceAuthority.records.find(
    (record) => record.evidenceRef === rootChanged.evidence[0].id,
  ).sourceContentDigest = rootChanged.evidence[0].sourceContentDigest;
  const rootChangedResult = evaluate(rootChanged);
  assert.ok(
    rootChangedResult.contractFindings.some(
      (item) => item.code === "invalid-source-authority",
    ),
  );
});

test("the signed envelope covers request, principal, and result-driving subject fields", () => {
  for (const mutate of [
    (value) => {
      value.request.cutoffAt = "2026-10-07T18:00:00Z";
    },
    (value) => {
      value.principals[0].name = "Changed owner";
    },
    (value) => {
      value.kpis[0].observed.valueMinor += 1;
    },
  ]) {
    const changed = structuredClone(fixture);
    mutate(changed);
    const result = evaluate(resealInternalFixture(changed));
    assert.ok(
      result.contractFindings.some(
        (item) => item.code === "invalid-source-authority",
      ),
    );
  }
});

test("allocation approvals require both owners and must precede attribution and finance close", () => {
  const missingFinanceApproval = structuredClone(fixture);
  missingFinanceApproval.evidence.find(
    (record) => record.id === "evidence-allocation-finance-approval",
  ).suppliedByRef = "principal-metric-owner-dan";
  const missingResult = evaluate(
    resealInternalFixture(missingFinanceApproval),
  );
  assert.ok(
    missingResult.contractFindings.some(
      (item) => item.code === "invalid-allocation-rule",
    ),
  );

  const lateApproval = structuredClone(fixture);
  lateApproval.allocationRules[0].approvedAt = "2026-10-06T16:30:00Z";
  for (const evidenceRef of lateApproval.allocationRules[0].evidenceRefs) {
    lateApproval.evidence.find(
      (record) => record.id === evidenceRef,
    ).observedAt = lateApproval.allocationRules[0].approvedAt;
  }
  const lateResult = evaluate(resealInternalFixture(lateApproval));
  assert.ok(
    lateResult.contractFindings.some(
      (item) => item.code === "invalid-attribution-binding",
    ),
  );
  assert.ok(
    lateResult.contractFindings.some(
      (item) => item.code === "invalid-finance-close",
    ),
  );
});

test("target approval strictly predates period start and target due time", () => {
  for (const approvedAt of [
    `${fixture.request.periodStart}T00:00:00Z`,
    fixture.kpis[0].target.dueAt,
  ]) {
    const value = structuredClone(fixture);
    value.kpis[0].target.approvedAt = approvedAt;
    value.evidence.find(
      (record) => record.id === "evidence-kpi-support-target",
    ).observedAt = approvedAt;
    const result = evaluate(resealInternalFixture(value));
    assert.ok(
      result.contractFindings.some(
        (item) => item.code === "invalid-shared-kpi-chronology",
      ),
    );
  }
});

test("finance close must be strictly later than the final attribution", () => {
  const value = structuredClone(fixture);
  const latestAttribution =
    value.attributions[value.attributions.length - 1].assessedAt;
  value.financeReview.reviewedAt = latestAttribution;
  value.evidence.find(
    (record) => record.id === "evidence-finance-reconciliation",
  ).observedAt = latestAttribution;
  const result = evaluate(resealInternalFixture(value));
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "invalid-finance-close",
    ),
  );
});

test("the separately-owned claim requires three distinct benefit owners", () => {
  const value = structuredClone(fixture);
  value.benefits[1].ownerRef = value.benefits[0].ownerRef;
  const result = evaluate(resealInternalFixture(value));
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "benefits-not-separately-owned",
    ),
  );
});

test("owner authority predates actions and aliases cannot share human identity or authority roots", () => {
  const lateAuthority = structuredClone(fixture);
  lateAuthority.principals.find(
    (record) => record.id === "principal-metric-owner-dan",
  ).authorityObservedAt = "2026-10-05T16:00:00Z";
  const lateResult = evaluate(resealInternalFixture(lateAuthority));
  assert.ok(
    lateResult.contractFindings.some(
      (item) => item.code === "authority-after-action",
    ),
  );

  const alias = structuredClone(fixture);
  const first = alias.principals[0];
  const second = alias.principals[1];
  second.name = first.name;
  second.humanIdentityRef = first.humanIdentityRef;
  second.authoritySourceRef = first.authoritySourceRef;
  const aliasResult = evaluate(resealInternalFixture(alias));
  assert.equal(
    aliasResult.contractFindings.filter(
      (item) => item.code === "duplicate-owner-identity",
    ).length,
    1,
  );
});

test("metric-owner authority must strictly predate the KPI baseline", () => {
  const value = structuredClone(fixture);
  value.principals.find(
    (record) => record.id === "principal-metric-owner-dan",
  ).authorityObservedAt = value.kpis[0].baseline.asOf;
  const result = evaluate(resealInternalFixture(value));
  assert.ok(
    result.contractFindings.some(
      (item) => item.code === "authority-after-action",
    ),
  );
});

test("causal overclaim is rejected by the integrated schema boundary", () => {
  const value = structuredClone(fixture);
  value.attributions[0].causalClaim = true;
  const result = evaluate(value);
  assert.equal(result.status, "invalid-schema");
  assert.ok(
    result.schemaFindings.some(
      (item) =>
        item.code === "schema-const" &&
        item.path === "/attributions/0/causalClaim",
    ),
  );
});
