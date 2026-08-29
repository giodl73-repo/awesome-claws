import { execFile } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import { hasArtifactSemanticValidator } from "./artifact-semantics.mjs";
import { capabilityClassesForEntry } from "./capability-classes.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { root } from "./openclaw-proof-lib.mjs";
import { regressionCaseFor } from "./regression-cases.mjs";

const jsonPath = join(root, "catalog-quality-scores.json");
const markdownPath = join(root, "docs", "catalog-quality-scorecard.md");
const execFileAsync = promisify(execFile);
const sessionResources = [
  "fixtures/session-demo.json",
  "templates/session-report.template.json",
  "templates/session-handoff.md",
];

const dimensions = Object.freeze({
  distinctness: 15,
  operatingContract: 20,
  evidenceModel: 20,
  authoritySafety: 20,
  experience: 10,
  verificationPortability: 10,
  stewardship: 5,
});

const authorityPattern =
  /\b(?:approval|approve|authorization|authority|consent|owner|do not|must not|without explicit|draft only|human review)\b/iu;
const evidencePattern =
  /\b(?:evidence|source|verify|verified|unverified|uncertain|unknown|missing|conflict|invent|assum|fabricat|confidence)\w*/iu;

function points(condition, value) {
  return condition ? value : 0;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function dayDifference(from, to) {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function bandFor(score) {
  if (score >= 90) return "exemplary";
  if (score >= 80) return "strong";
  if (score >= 70) return "solid";
  if (score >= 60) return "needs-uplift";
  return "priority-remediation";
}

async function isRegularFile(path) {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

function completeContribution(record) {
  const contribution = record?.contribution;
  return Boolean(
    text(contribution?.problem) &&
      text(contribution?.repeatableJob) &&
      text(contribution?.proofPlan),
  );
}

function comparedAlternatives(record) {
  return list(record?.contribution?.existingAlternatives).filter(
    (item) => text(item?.id) && text(item?.overlap) && text(item?.difference),
  ).length;
}

async function scoreEntry({
  entry,
  contribution,
  experience,
  regression,
  asOf,
}) {
  const resources = list(entry.resources);
  const resourcePaths = new Set(resources.map((resource) => resource.path));
  const hasFixture = resources.some((resource) => resource.role === "fixture");
  const hasTemplate = resources.some((resource) => resource.role === "template");
  const hasSchema = resources.some((resource) => resource.role === "schema");
  const hasSemanticValidator = hasArtifactSemanticValidator(entry.id);
  const hasStructuredTrio =
    hasSchema &&
    resources.some(
      (resource) =>
        resource.role === "fixture" &&
        resource.path !== "fixtures/session-demo.json",
    ) &&
    resources.some(
      (resource) =>
        resource.role === "template" &&
        resource.path !== "templates/session-report.template.json" &&
        resource.path !== "templates/session-handoff.md",
    );
  const contributionComplete = completeContribution(contribution);
  const alternativeCount = comparedAlternatives(contribution);
  const combinedPolicyText = [
    ...list(entry.principles),
    ...list(entry.boundaries),
    ...list(entry.doneWhen),
    ...list(entry.capabilityGuidance),
  ].join(" ");
  const capabilityClasses = capabilityClassesForEntry(entry, experience);
  const capabilityContract =
    capabilityClasses.length === 0 ||
    (entry.openclawProfile &&
      list(entry.capabilityGuidance).length >= 1);
  const experienceRegistered = Boolean(experience);
  const experienceContract = experienceRegistered && [3, 4, 5].includes(experience.target);
  const regressionValid =
    experienceRegistered &&
    Boolean(regression) &&
    isDeepStrictEqual(regression, regressionCaseFor(entry, experience));
  const experienceResources =
    experience?.target === 3
      ? sessionResources.every((path) => resourcePaths.has(path))
      : Boolean(
          experience?.asset &&
            resourcePaths.has(experience.asset) &&
            experience?.fallback &&
            experience?.output,
        );
  const clawRoot = join(root, "claws", entry.id);
  const hasSourcePackage =
    (await isRegularFile(join(clawRoot, "CLAW.md"))) &&
    (await isRegularFile(join(clawRoot, "package.json")));
  const resourceFilesPresent = (
    await Promise.all(
      resources.map((resource) => isRegularFile(join(clawRoot, resource.source))),
    )
  ).every(Boolean);
  const screenshotPresent = await isRegularFile(join(clawRoot, "screenshot.png"));
  const maintenanceAge = dayDifference(entry.maintenance?.lastVerified, asOf);
  const freshMaintenance =
    Number.isFinite(maintenanceAge) && maintenanceAge >= 0 && maintenanceAge <= 90;

  const score = {
    distinctness:
      points(text(entry.description), 3) +
      points(text(entry.audience), 2) +
      points(text(entry.example?.request) && text(entry.example?.outcome), 3) +
      points(list(entry.boundaries).length >= 2, 2) +
      points(contributionComplete, 2) +
      points(alternativeCount >= 3, 3),
    operatingContract:
      points(list(entry.principles).length >= 3, 3) +
      points(list(entry.intake).length >= 3, 4) +
      points(list(entry.workflow).length >= 4, 5) +
      points(list(entry.deliverables).length >= 4, 4) +
      points(list(entry.doneWhen).length >= 3, 4),
    evidenceModel:
      points(hasFixture, 3) +
      points(hasTemplate, 3) +
      points(hasSchema, 5) +
      points(hasSemanticValidator, 6) +
      points(hasStructuredTrio, 3),
    authoritySafety:
      points(list(entry.boundaries).length >= 3, 5) +
      points(list(entry.boundaries).length === 2, 4) +
      points(authorityPattern.test(combinedPolicyText), 6) +
      points(evidencePattern.test(combinedPolicyText), 4) +
      points(capabilityContract, 5),
    experience:
      points(experienceRegistered, 3) +
      points(experienceContract, 3) +
      points(screenshotPresent, 2) +
      points(experienceResources, 2),
    verificationPortability:
      points(regressionValid, 4) +
      points(hasSourcePackage, 2) +
      points(resourceFilesPresent, 2) +
      points(hasSemanticValidator, 2),
    stewardship:
      points(entry.maintenance?.status === "active", 2) +
      points(list(entry.maintenance?.maintainers).length > 0, 1) +
      points(freshMaintenance, 2),
  };
  const total = Object.values(score).reduce((sum, value) => sum + value, 0);
  const recommendations = [];
  if (!contributionComplete || alternativeCount < 3) {
    recommendations.push(
      "Add a retrospective contribution record with a proof plan and at least three specific alternatives.",
    );
  }
  if (!hasSchema) {
    recommendations.push(
      "Add a structured decision artifact with a schema, example fixture, and semantic validator.",
    );
  } else if (!hasSemanticValidator) {
    recommendations.push(
      "Add semantic validation for cross-field evidence and authority invariants.",
    );
  }
  if (!freshMaintenance) {
    recommendations.push("Re-verify the Claw and refresh maintenance.lastVerified.");
  }

  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    total,
    band: bandFor(total),
    dimensions: score,
    gates: {
      regressionCase: regressionValid,
      experienceCase: experienceRegistered,
      sourcePackage: hasSourcePackage,
      resourcesPresent: resourceFilesPresent,
      qualified:
        regressionValid &&
        experienceRegistered &&
        hasSourcePackage &&
        resourceFilesPresent,
    },
    evidence: {
      contributionRecord: contributionComplete,
      comparedAlternatives: alternativeCount,
      schema: hasSchema,
      semanticValidator: hasSemanticValidator,
      screenshot: screenshotPresent,
      experienceTarget: experience?.target ?? null,
      capabilityClasses,
      maintenanceAgeDays: maintenanceAge,
    },
    recommendations,
  };
}

function average(values) {
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1),
  );
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[midpoint]
    : Number(((sorted[midpoint - 1] + sorted[midpoint]) / 2).toFixed(1));
}

export async function buildCatalogQualityScorecard({
  catalog,
  contributions,
  experienceCases,
  regressionCases,
  asOf,
}) {
  if (!isIsoDate(asOf)) {
    throw new Error(`Invalid --as-of date: ${asOf}`);
  }
  const contributionById = new Map(
    contributions.map((record) => [record.entry.id, record]),
  );
  const experienceById = new Map(experienceCases.map((item) => [item.id, item]));
  const regressionById = new Map(regressionCases.map((item) => [item.id, item]));
  const scores = await Promise.all(
    catalog.entries.map((entry) =>
      scoreEntry({
        entry,
        contribution: contributionById.get(entry.id),
        experience: experienceById.get(entry.id),
        regression: regressionById.get(entry.id),
        asOf,
      }),
    ),
  );
  const ranked = [...scores].sort(
    (left, right) => right.total - left.total || left.id.localeCompare(right.id),
  );
  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });
  const rankById = new Map(ranked.map((item) => [item.id, item.rank]));
  scores.forEach((item) => {
    item.rank = rankById.get(item.id);
  });

  return {
    schemaVersion: "awesomeClaws.catalogQuality.v1",
    rubricVersion: 1,
    asOf,
    methodology:
      "Deterministic repository-observable evidence; no live-model or real-world outcome claims.",
    dimensions,
    summary: {
      entryCount: scores.length,
      average: average(scores.map((item) => item.total)),
      median: median(scores.map((item) => item.total)),
      qualifiedCount: scores.filter((item) => item.gates.qualified).length,
      bands: Object.fromEntries(
        [
          "exemplary",
          "strong",
          "solid",
          "needs-uplift",
          "priority-remediation",
        ].map((band) => [band, scores.filter((item) => item.band === band).length]),
      ),
      dimensionAverages: Object.fromEntries(
        Object.keys(dimensions).map((dimension) => [
          dimension,
          average(scores.map((item) => item.dimensions[dimension])),
        ]),
      ),
      evidenceCoverage: {
        contributionRecords: scores.filter(
          (item) => item.evidence.contributionRecord,
        ).length,
        schemas: scores.filter((item) => item.evidence.schema).length,
        semanticValidators: scores.filter(
          (item) => item.evidence.semanticValidator,
        ).length,
        screenshots: scores.filter((item) => item.evidence.screenshot).length,
      },
    },
    scores,
  };
}

export function renderCatalogQualityScorecard(scorecard) {
  const sorted = [...scorecard.scores].sort(
    (left, right) => left.rank - right.rank,
  );
  const bandRows = Object.entries(scorecard.summary.bands)
    .map(([band, count]) => `| ${band} | ${count} |`)
    .join("\n");
  const dimensionLabels = {
    distinctness: "Distinct job and admission case",
    operatingContract: "Operating contract completeness",
    evidenceModel: "Evidence and artifact model",
    authoritySafety: "Authority and safety",
    experience: "Experience and usability",
    verificationPortability: "Verification and portability",
    stewardship: "Stewardship and maintenance",
  };
  const dimensionRows = Object.entries(dimensions)
    .map(
      ([dimension, maximum]) =>
        `| ${dimensionLabels[dimension]} | ${maximum} | ${scorecard.summary.dimensionAverages[dimension]} |`,
    )
    .join("\n");
  const scoreRows = sorted
    .map(
      (item) =>
        `| ${item.rank} | \`${item.id}\` | ${item.total} | ${item.band} | ` +
        `${item.dimensions.distinctness} | ${item.dimensions.operatingContract} | ` +
        `${item.dimensions.evidenceModel} | ${item.dimensions.authoritySafety} | ` +
        `${item.dimensions.experience} | ${item.dimensions.verificationPortability} | ` +
        `${item.dimensions.stewardship} |`,
    )
    .join("\n");
  const upliftRows = sorted
    .slice(-15)
    .reverse()
    .map(
      (item) =>
        `| \`${item.id}\` | ${item.total} | ${item.recommendations.join(" ")} |`,
    )
    .join("\n");

  return `# Catalog quality scorecard

This report scores all ${scorecard.summary.entryCount} maintained Claws as of ${scorecard.asOf}. It uses only repository-observable evidence and does not claim live-model quality or real-world outcomes. See [the rubric](catalog-quality-rubric.md) for interpretation and point rules.

## Portfolio result

- Average: **${scorecard.summary.average}/100**
- Median: **${scorecard.summary.median}/100**
- Qualified through all non-negotiable gates: **${scorecard.summary.qualifiedCount}/${scorecard.summary.entryCount}**

| Band | Count |
| --- | ---: |
${bandRows}

| Dimension | Maximum | Portfolio average |
| --- | ---: | ---: |
${dimensionRows}

## Highest-priority uplift queue

The queue is ordered from lowest score upward. It is a documentation and contract-hardening queue, not a claim that lower-scoring Claws perform poorly in a live model.

| Claw | Score | Recommended uplift |
| --- | ---: | --- |
${upliftRows}

## All Claws

| Rank | Claw | Total | Band | Distinct | Contract | Evidence | Safety | UX | Verify | Steward |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${scoreRows}

The machine-readable source for this report is [\`catalog-quality-scores.json\`](../catalog-quality-scores.json).
`;
}

async function readContributions() {
  const catalog = await readCatalog();
  const records = await Promise.all(
    catalog.entries.map(async (entry) => {
      const path = join(root, "contributions", `${entry.id}.json`);
      try {
        return JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    }),
  );
  return records.filter(Boolean);
}

async function readInputs() {
  const catalog = await readCatalog();
  const [contributions, experienceCases, regressionRegistry] = await Promise.all([
    readContributions(),
    readExperienceCases(catalog),
    readFile(join(root, "regression-cases.json"), "utf8").then(JSON.parse),
  ]);
  return {
    catalog,
    contributions,
    experienceCases,
    regressionCases: regressionRegistry.cases,
  };
}

async function run() {
  const check = process.argv.includes("--check");
  const dateIndex = process.argv.indexOf("--as-of");
  let asOf = dateIndex >= 0 ? process.argv[dateIndex + 1] : null;
  if (!asOf && check) {
    asOf = JSON.parse(await readFile(jsonPath, "utf8")).asOf;
  }
  asOf ??= new Date().toISOString().slice(0, 10);
  try {
    await execFileAsync(
      process.execPath,
      [join(root, "scripts", "materialize-catalog.mjs"), "--check"],
      { windowsHide: true },
    );
  } catch (error) {
    const detail = text(error?.stderr) || text(error?.message);
    throw new Error(
      `Catalog packages must be current before scoring. Run npm run build.${detail ? `\n${detail}` : ""}`,
      { cause: error },
    );
  }
  const scorecard = await buildCatalogQualityScorecard({
    ...(await readInputs()),
    asOf,
  });
  const json = `${JSON.stringify(scorecard, null, 2)}\n`;
  const markdown = renderCatalogQualityScorecard(scorecard);
  if (check) {
    const [existingJson, existingMarkdown] = await Promise.all([
      readFile(jsonPath, "utf8"),
      readFile(markdownPath, "utf8"),
    ]);
    if (existingJson !== json || existingMarkdown !== markdown) {
      throw new Error(
        "Catalog quality score artifacts are stale. Run npm run score:catalog.",
      );
    }
    console.log(
      `Catalog quality scorecard is current (${scorecard.summary.entryCount} Claws).`,
    );
    return;
  }
  await Promise.all([
    writeFile(jsonPath, json),
    writeFile(markdownPath, markdown),
  ]);
  console.log(
    `Scored ${scorecard.summary.entryCount} Claws: average ${scorecard.summary.average}, median ${scorecard.summary.median}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
