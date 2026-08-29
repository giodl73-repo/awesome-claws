import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogQualityScorecard,
  renderCatalogQualityScorecard,
} from "./catalog-quality-score.mjs";
import { regressionCaseFor } from "./regression-cases.mjs";

const baseEntry = {
  id: "score-test",
  name: "Score test",
  category: "analysis",
  maintenance: {
    status: "active",
    maintainers: ["@octocat"],
    lastVerified: "2026-08-01",
  },
  description: "Produces a bounded, evidence-backed score.",
  audience: "Catalog maintainers.",
  principles: ["Use evidence", "Preserve uncertainty", "Keep owners in control"],
  boundaries: [
    "Do not act without owner approval",
    "Do not invent missing evidence",
    "Keep sensitive personal data private",
  ],
  intake: ["Catalog", "Rubric", "Score date"],
  workflow: ["Read", "Evaluate", "Rank", "Report"],
  deliverables: ["Score", "Evidence", "Band", "Recommendation"],
  doneWhen: ["Every item is scored", "Gaps are visible", "The owner can review"],
  example: { request: "Score this.", outcome: "A deterministic score." },
  capabilityGuidance: ["No runtime integrations are granted."],
  resources: [],
};

test("missing contribution evidence is recorded without failing qualification", async () => {
  const experience = {
    id: "score-test",
    target: 3,
    primary: "artifact",
    fallback: "text",
    output: "outputs/score-test-handoff.md",
  };
  const scorecard = await buildCatalogQualityScorecard({
    catalog: { entries: [baseEntry] },
    contributions: [],
    experienceCases: [experience],
    regressionCases: [regressionCaseFor(baseEntry, experience)],
    asOf: "2026-08-29",
  });
  const [score] = scorecard.scores;
  assert.equal(score.dimensions.distinctness, 10);
  assert.equal(score.gates.qualified, false);
  assert.match(score.recommendations[0], /retrospective contribution record/u);
});

test("complete admission evidence adds only its documented five points", async () => {
  const experience = {
    id: "score-test",
    target: 3,
    primary: "artifact",
    fallback: "text",
    output: "outputs/score-test-handoff.md",
  };
  const inputs = {
    catalog: { entries: [baseEntry] },
    experienceCases: [experience],
    regressionCases: [regressionCaseFor(baseEntry, experience)],
    asOf: "2026-08-29",
  };
  const withoutContribution = await buildCatalogQualityScorecard({
    ...inputs,
    contributions: [],
  });
  const withContribution = await buildCatalogQualityScorecard({
    ...inputs,
    contributions: [
      {
        entry: { id: "score-test" },
        contribution: {
          problem: "Scoring evidence is inconsistent.",
          repeatableJob: "Score every catalog entry.",
          proofPlan: "Generate and check deterministic artifacts.",
          existingAlternatives: ["one", "two", "three"].map((id) => ({
            id,
            overlap: "Both score catalog evidence.",
            difference: "This contract uses a distinct evidence boundary.",
          })),
        },
      },
    ],
  });
  assert.equal(withContribution.scores[0].dimensions.distinctness, 15);
  assert.equal(
    withContribution.scores[0].total - withoutContribution.scores[0].total,
    5,
  );
});

test("invalid calendar score dates are rejected", async () => {
  await assert.rejects(
    buildCatalogQualityScorecard({
      catalog: { entries: [] },
      contributions: [],
      experienceCases: [],
      regressionCases: [],
      asOf: "2026-02-31",
    }),
    /Invalid --as-of date/u,
  );
});

test("renderer includes every scored Claw and the recorded date", () => {
  const markdown = renderCatalogQualityScorecard({
    asOf: "2026-08-29",
    summary: {
      entryCount: 1,
      average: 75,
      median: 75,
      qualifiedCount: 1,
      bands: {
        exemplary: 0,
        strong: 0,
        solid: 1,
        "needs-uplift": 0,
        "priority-remediation": 0,
      },
      dimensionAverages: {
        distinctness: 10,
        operatingContract: 20,
        evidenceModel: 6,
        authoritySafety: 20,
        experience: 10,
        verificationPortability: 7,
        stewardship: 2,
      },
    },
    scores: [
      {
        rank: 1,
        id: "score-test",
        total: 75,
        band: "solid",
        dimensions: {
          distinctness: 10,
          operatingContract: 20,
          evidenceModel: 6,
          authoritySafety: 20,
          experience: 10,
          verificationPortability: 7,
          stewardship: 2,
        },
        recommendations: ["Add proof."],
      },
    ],
  });
  assert.match(markdown, /all 1 maintained Claws as of 2026-08-29/u);
  assert.match(markdown, /`score-test`/u);
});
