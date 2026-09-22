import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { root } from "./catalog-source.mjs";

const [catalog, quality, readme, roadmap, mockPlus, runtimeEvidenceRubric] = await Promise.all([
  readFile(join(root, "catalog.json"), "utf8").then(JSON.parse),
  readFile(join(root, "catalog-quality-scores.json"), "utf8").then(JSON.parse),
  readFile(join(root, "README.md"), "utf8"),
  readFile(join(root, "docs", "roadmap.md"), "utf8"),
  readFile(join(root, "docs", "mock-plus.md"), "utf8"),
  readFile(join(root, "docs", "runtime-evidence-quality-rubric.md"), "utf8"),
]);

const entryCount = catalog.entries.length;
const qualityCounts = {
  qualified: quality.scores.filter((score) => score.gates.qualified).length,
  contributions: quality.scores.filter((score) => score.evidence.contributionRecord).length,
  schemas: quality.scores.filter((score) => score.evidence.schema).length,
  semanticValidators: quality.scores.filter((score) => score.evidence.semanticValidator).length,
};

function expectCountClaim(document, pattern, expected, label) {
  const match = document.match(pattern);
  assert.ok(match, `Missing ${label} count claim`);
  assert.equal(
    Number.parseInt(match[1].replaceAll(",", ""), 10),
    expected,
    `${label} count is stale`,
  );
}

function expectRatioClaim(document, pattern, actual, total, label) {
  const match = document.match(pattern);
  assert.ok(match, `Missing ${label} ratio claim`);
  assert.equal(Number.parseInt(match[1], 10), actual, `${label} numerator is stale`);
  assert.equal(Number.parseInt(match[2], 10), total, `${label} denominator is stale`);
}

test("current catalog counts in README stay aligned with catalog.json", () => {
  const claims = [
    [/The (\d+)-Claw catalog/u, "catalog summary"],
    [/quality baseline across all (\d+) Claws/u, "quality baseline"],
    [/complete (\d+)-Claw catalog/u, "catalog chooser"],
    [/dry-runs all (\d+) packages/u, "OpenClaw proof"],
    [/agreement with all (\d+) generated packages/u, "generated package agreement"],
    [/for all (\d+) packages in isolated local state/u, "portfolio proof"],
  ];
  for (const [pattern, label] of claims) {
    expectCountClaim(readme, pattern, entryCount, label);
  }
});

test("roadmap inventory and quality baselines stay aligned with generated evidence", () => {
  expectCountClaim(
    roadmap,
    /Awesome Claws has (\d+) maintained starter Claws/u,
    entryCount,
    "roadmap catalog",
  );

  const expectedCategories = catalog.entries.reduce((counts, entry) => {
    const label = entry.category[0].toUpperCase() + entry.category.slice(1);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map());
  const documentedCategories = new Map(
    [...roadmap.matchAll(/^\| (Productivity|Operations|Analysis|Engineering|Governance|Product) \| (\d+) \|/gmu)].map(
      ([, category, count]) => [category, Number.parseInt(count, 10)],
    ),
  );
  assert.deepEqual(documentedCategories, expectedCategories, "roadmap category counts are stale");

  expectRatioClaim(
    roadmap,
    /current baseline has (\d+) of (\d+) Claws passing/u,
    qualityCounts.qualified,
    entryCount,
    "qualified Claws",
  );
  expectRatioClaim(
    roadmap,
    /Retrospective admission records \| (\d+) of (\d+) \|/u,
    qualityCounts.contributions,
    entryCount,
    "retrospective admission records",
  );
  expectRatioClaim(
    roadmap,
    /Structured artifact schemas \| (\d+) of (\d+) \|/u,
    qualityCounts.schemas,
    entryCount,
    "structured artifact schemas",
  );
  expectRatioClaim(
    roadmap,
    /Semantic artifact validators \| (\d+) of (\d+) \|/u,
    qualityCounts.semanticValidators,
    entryCount,
    "semantic artifact validators",
  );
});

test("portfolio and runtime documentation stays aligned with the catalog", () => {
  expectCountClaim(
    mockPlus,
    /safety recipes for all (\d+) maintained Claws/u,
    entryCount,
    "mock-plus schema portfolio",
  );

  const baselineTrials = entryCount * 3;
  const sevenDayTrials = baselineTrials * 7;
  expectCountClaim(
    readme,
    /(\d+)-trial baseline/u,
    baselineTrials,
    "README runtime baseline",
  );
  expectCountClaim(
    readme,
    /([\d,]+)-trial seven-day plan/u,
    sevenDayTrials,
    "README seven-day runtime plan",
  );
  expectCountClaim(
    runtimeEvidenceRubric,
    /catalog-derived (\d+) Claws x 3 scenarios/u,
    entryCount,
    "runtime evidence catalog",
  );
  expectCountClaim(
    runtimeEvidenceRubric,
    /\*\*([\d,]+) trials\*\*/u,
    baselineTrials,
    "runtime evidence baseline",
  );
  expectCountClaim(
    runtimeEvidenceRubric,
    /repetitions = \*\*([\d,]+) trials\*\*/u,
    sevenDayTrials,
    "runtime evidence seven-day plan",
  );
});
