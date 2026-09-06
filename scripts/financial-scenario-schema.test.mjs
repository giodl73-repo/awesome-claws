import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL(
    "../claws/financial-analyst/fixtures/financial-scenario.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/financial-analyst/schemas/financial-scenario.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("financial-analyst", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  question: "Does adding two support engineers pay back within 12 months?",
  asOf: "2026-08-01T12:00:00Z",
  currency: "USD",
  sources: [
    {
      id: "actuals-q2",
      kind: "actual",
      reference: "finance/q2-support-actuals",
      observedAt: "2026-07-31T18:00:00Z",
      state: "supported",
    },
    {
      id: "growth-plan",
      kind: "forecast",
      reference: "planning/q3-ticket-growth",
      observedAt: "2026-07-28T16:00:00Z",
      state: "limited",
    },
  ],
  assumptions: [
    {
      id: "loaded-cost",
      statement: "Two engineers cost 240000 USD fully loaded for twelve months.",
      sourceRefs: ["actuals-q2"],
    },
    {
      id: "ticket-growth",
      statement: "Ticket volume follows the approved base growth plan.",
      sourceRefs: ["growth-plan"],
    },
  ],
  scenarios: [
    {
      id: "downside",
      name: "Downside",
      assumptionRefs: ["loaded-cost"],
      outcomes: [{ name: "paybackMonths", value: 18, unit: "months" }],
    },
    {
      id: "base",
      name: "Base",
      assumptionRefs: ["loaded-cost", "ticket-growth"],
      outcomes: [{ name: "paybackMonths", value: 11, unit: "months" }],
    },
  ],
  risks: [
    {
      id: "growth-uncertainty",
      description: "The ticket-growth plan has not yet been observed.",
      sourceRefs: ["growth-plan"],
      scenarioRefs: ["base"],
    },
  ],
  decisionOwner: "Finance director",
  decisionState: "ready-for-owner-review",
};

test("financial fixture is a valid exact-scope enriched analysis", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("financial validator is total over every malformed array and row", () => {
  for (const field of [
    "principals",
    "inputs",
    "evidence",
    "assumptionRegister",
    "scenarioModels",
    "calculations",
    "outcomes",
    "reconciliations",
    "sensitivityRegister",
    "riskRegister",
    "exceptions",
  ]) {
    const malformed = clone();
    malformed[field].push(null);
    assert.equal(validateSchema(malformed), true, field);
    assert.doesNotThrow(() => findings(malformed), field);
    assert.ok(
      findings(malformed).some((item) => item.code === "invalid_array_record"),
      field,
    );
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed), field);
    assert.ok(
      findings(malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      field,
    );
  }

  const malformedTerms = clone();
  malformedTerms.calculations[0].terms.push(null);
  assert.doesNotThrow(() => findings(malformedTerms));
  assert.ok(
    findings(malformedTerms).some(
      (item) =>
        item.code === "invalid_array_record" &&
        item.path === "calculations[0].terms[3]",
    ),
  );

  const malformedEvidenceRefs = clone();
  malformedEvidenceRefs.assumptionRegister[0].evidenceRefs = {};
  assert.doesNotThrow(() => findings(malformedEvidenceRefs));
  assert.ok(
    findings(malformedEvidenceRefs).some(
    (item) =>
      item.code === "invalid_reference_list" &&
      item.path === "assumptionRegister[0].evidenceRefs",
    ),
  );
});

test("financial exact marker, unknown fields, and every legacy hybrid field fail closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.financialAnalysis.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));

  for (const field of [
    "question",
    "asOf",
    "currency",
    "sources",
    "assumptions",
    "scenarios",
    "risks",
    "decisionOwner",
    "decisionState",
  ]) {
    const hybrid = clone();
    hybrid[field] = legacy[field];
    assert.equal(isValid(hybrid), false, field);
    assert.ok(
      findings(hybrid).some(
        (item) =>
          item.code === "legacy_field_in_enriched_record" &&
          item.path === field,
      ),
      field,
    );
  }

  const partial = { ...clone(), ...legacy };
  delete partial.principals;
  assert.equal(validateSchema(partial), false);
  assert.ok(
    findings(partial).some(
      (item) =>
        item.code === "invalid_array_list" && item.path === "principals",
    ),
  );
  assert.equal(validateSchema({ ...clone(), credentials: "not-a-real-secret" }), false);
});

test("financial ledgers reject unstable, dangling, duplicate, and orphan rows", () => {
  const unstable = clone();
  delete unstable.calculations[0].id;
  assert.ok(
    findings(unstable).some(
      (item) =>
        item.code === "invalid_array_record" &&
        item.path === "calculations[0].id",
    ),
  );

  const dangling = clone();
  dangling.riskRegister[0].scenarioRefs = ["scenario-missing"];
  assert.ok(findings(dangling).some((item) => item.code === "dangling_reference"));

  const duplicate = clone();
  duplicate.riskRegister[0].evidenceRefs.push(
    duplicate.riskRegister[0].evidenceRefs[0],
  );
  assert.ok(
    findings(duplicate).some((item) => item.code === "duplicate_reference"),
  );

  const orphan = clone();
  orphan.evidence.push({
    ...orphan.evidence[0],
    id: "evidence-orphan",
  });
  assert.ok(
    findings(orphan).some(
      (item) =>
        item.code === "orphan_financial_row" &&
        item.path === "evidence[5]",
    ),
  );
});

test("financial evidence binds exact scope, current snapshot, provenance, and safe storage", () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].entity = "Contoso";
    },
    (value) => {
      value.evidence[0].inputSnapshotRef = "inputs-old";
    },
    (value) => {
      value.evidence[0].currency = "EUR";
    },
    (value) => {
      value.evidence[0].value = 119999;
    },
  ]) {
    const invalid = clone();
    mutate(invalid);
    assert.equal(isValid(invalid), false);
    assert.ok(
      findings(invalid).some((item) =>
        ["cross_scope_evidence", "unproven_financial_input"].includes(item.code),
      ),
    );
  }

  const unsafe = clone();
  unsafe.evidence[0].containsPersonalData = true;
  assert.ok(
    findings(unsafe).some((item) => item.code === "unsafe_financial_evidence"),
  );
  const secret = clone();
  secret.evidence[0].apiKey = "sk_live_not-a-real-key";
  assert.ok(findings(secret).some((item) => item.code === "secret_in_evidence"));
});

test("financial scope rejects impossible dates and malformed coverage identifiers", () => {
  const impossibleDate = clone();
  impossibleDate.analysis.periodEnd = "2026-02-31";
  assert.ok(
    findings(impossibleDate).some(
      (item) => item.code === "invalid_financial_scope",
    ),
  );

  for (const [field, item] of [
    ["requiredScenarioKinds", ""],
    ["requiredScenarioKinds", 42],
    ["requiredMetricIds", ""],
    ["requiredMetricIds", 42],
  ]) {
    const malformed = clone();
    malformed.analysis[field][0] = item;
    assert.ok(
      findings(malformed).some(
        (findingItem) => findingItem.code === "invalid_financial_scope",
      ),
      `${field}:${JSON.stringify(item)}`,
    );
  }
});

test("financial readiness blocks stale, missing, conflicting, and ungrounded evidence", () => {
  const stale = clone();
  stale.evidence[0].observedAt = "2026-09-04T08:00:00Z";
  assert.ok(findings(stale).some((item) => item.code === "stale_evidence"));
  assert.ok(
    findings(stale).some((item) => item.code === "premature_financial_readiness"),
  );

  for (const state of ["missing", "conflicting"]) {
    const unavailable = clone();
    unavailable.evidence[0].sourceState = state;
    assert.ok(
      findings(unavailable).some(
        (item) => item.code === "missing_or_conflicting_evidence",
      ),
      state,
    );
  }

  const ungrounded = clone();
  ungrounded.assumptionRegister[0].evidenceRefs = [];
  assert.ok(
    findings(ungrounded).some((item) => item.code === "ungrounded_assumption"),
  );
});

test("financial calculations and reconciliation enforce integrity and chronology", () => {
  const invalidCalculation = clone();
  invalidCalculation.calculations[0].value = -59999;
  assert.ok(
    findings(invalidCalculation).some(
      (item) => item.code === "invalid_financial_calculation",
    ),
  );

  const crossBasis = clone();
  crossBasis.assumptionRegister[0].accountingBasis = "cash";
  assert.ok(
    findings(crossBasis).some(
      (item) => item.code === "invalid_financial_calculation",
    ),
  );

  const materialDifference = clone();
  materialDifference.reconciliations[0].actualValue = -59990;
  materialDifference.reconciliations[0].difference = 10;
  assert.ok(
    findings(materialDifference).some(
      (item) => item.code === "material_unreconciled_difference",
    ),
  );

  const earlyCalculation = clone();
  earlyCalculation.calculations[0].calculatedAt = "2026-09-05T09:00:00Z";
  assert.ok(
    findings(earlyCalculation).some(
      (item) => item.code === "invalid_financial_calculation",
    ),
  );

  const earlyReview = clone();
  earlyReview.recommendation.reviewedAt = "2026-09-05T11:00:00Z";
  assert.ok(
    findings(earlyReview).some(
      (item) => item.code === "premature_financial_readiness",
    ),
  );
});

test("financial scenario, metric, sensitivity, risk, and exception coverage is complete", () => {
  const missingScenario = clone();
  missingScenario.scenarioModels.pop();
  assert.ok(
    findings(missingScenario).some(
      (item) => item.code === "incomplete_scenario_coverage",
    ),
  );

  const missingMetric = clone();
  missingMetric.analysis.requiredMetricIds.push("payback-months");
  assert.ok(
    findings(missingMetric).some(
      (item) => item.code === "incomplete_metric_coverage",
    ),
  );

  const missingSensitivity = clone();
  missingSensitivity.sensitivityRegister = missingSensitivity.sensitivityRegister.filter(
    (item) => item.scenarioRef !== "scenario-downside",
  );
  assert.ok(
    findings(missingSensitivity).some(
      (item) => item.code === "unsupported_financial_sensitivity",
    ),
  );

  const materialRisk = clone();
  materialRisk.riskRegister[0].severity = "high";
  materialRisk.riskRegister[0].state = "open";
  assert.ok(
    findings(materialRisk).some(
      (item) => item.code === "unresolved_material_financial_risk",
    ),
  );
  for (const [field, value] of [
    ["severity", undefined],
    ["severity", "unknown"],
    ["state", undefined],
    ["state", "unknown"],
  ]) {
    const unclassified = clone();
    unclassified.riskRegister[0][field] = value;
    assert.ok(
      findings(unclassified).some(
        (item) => item.code === "unsupported_financial_risk",
      ),
      `${field}:${String(value)}`,
    );
  }

  const exception = clone();
  exception.exceptions.push({
    id: "exception-conflicting-plan",
    state: "open",
    ownerId: "principal-analysis-owner-alex",
    evidenceRefs: ["evidence-base-savings-assumption"],
    resolvedAt: null,
  });
  assert.ok(
    findings(exception).some(
      (item) => item.code === "unresolved_financial_exception",
    ),
  );
});

test("financial authority requires independent named humans after all grounding records", () => {
  const selfReviewed = clone();
  selfReviewed.recommendation.reviewerId = selfReviewed.ownerId;
  assert.ok(
    findings(selfReviewed).some(
      (item) => item.code === "premature_financial_readiness",
    ),
  );

  const bare = clone();
  bare.owner = " Financial Analyst ";
  bare.handoff.owner = " Financial Analyst ";
  bare.principals.find((item) => item.id === bare.ownerId).name =
    " Financial Analyst ";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));

  const titledHuman = clone();
  titledHuman.owner = "Jamie Ortiz, Financial Analyst";
  titledHuman.handoff.owner = "Jamie Ortiz, Financial Analyst";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Jamie Ortiz, Financial Analyst";
  assert.equal(isValid(titledHuman), true);
});

test("financial analysis rejects direct prohibited-action claims and missing gates", () => {
  for (const claim of [
    "We executed a transaction.",
    "We completed the trade.",
    "We bought the shares.",
    "Sell the stock.",
    "We recommended holding.",
    "We issued an investment recommendation.",
    "We approved the accounting.",
    "We certified the financial statements.",
    "We provided financial advice.",
    "We gave investment advice.",
    "We published the analysis.",
    "We sent the report.",
    "We mutated the source data.",
  ]) {
    const invalid = clone();
    invalid.handoff.summary = claim;
    assert.ok(
      findings(invalid).some(
        (item) => item.code === "unauthorized_narrative_action",
      ),
      claim,
    );
  }

  const missingGate = clone();
  missingGate.handoff.prohibitedActions =
    missingGate.handoff.prohibitedActions.filter(
      (item) => item !== "execute-transactions",
    );
  assert.ok(
    findings(missingGate).some((item) => item.code === "missing_authority_gate"),
  );
  assert.ok(
    findings(missingGate).some(
      (item) => item.code === "premature_financial_readiness",
    ),
  );
});

test("financial schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  for (const [mutate, code] of [
    [
      (value) => {
        value.sources[1].id = value.sources[0].id;
      },
      "duplicate_reference",
    ],
    [
      (value) => {
        value.assumptions[0].sourceRefs = ["source-missing"];
      },
      "dangling_reference",
    ],
    [
      (value) => {
        value.scenarios[0].assumptionRefs = ["assumption-missing"];
      },
      "dangling_reference",
    ],
    [
      (value) => {
        value.risks[0].sourceRefs = ["source-missing"];
      },
      "dangling_reference",
    ],
    [
      (value) => {
        value.risks[0].scenarioRefs = ["scenario-missing"];
      },
      "dangling_reference",
    ],
  ]) {
    const invalidReferences = structuredClone(legacy);
    mutate(invalidReferences);
    assert.equal(validateSchema(invalidReferences), true);
    assert.ok(
      findings(invalidReferences).some((item) => item.code === code),
      code,
    );
  }
  assert.equal(validateSchema({ ...legacy, scenarios: [] }), false);
  assert.equal(
    validateSchema({
      ...legacy,
      sources: [{ ...legacy.sources[0], state: "probably-current" }],
    }),
    false,
  );
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("financial CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `financial-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(
        process.execPath,
        [
          resolve(root, "scripts", "validate-artifact.mjs"),
          "financial-analyst",
          path,
        ],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
