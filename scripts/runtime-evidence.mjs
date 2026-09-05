import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readCatalog, root } from "./catalog-source.mjs";
import { readRegressionCases } from "./regression-cases.mjs";
import {
  buildRunManifest,
  deterministicEvidenceView,
  inspectLiveConfig,
  runRuntimeEvidence,
} from "./runtime-evidence-lib.mjs";

function parseArguments(argv) {
  const options = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected runtime evidence argument: ${argument}`);
    }
    if (argument === "--check") {
      flags.add("check");
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  return { options, flags };
}

function numberOption(options, name, fallback) {
  if (!Object.hasOwn(options, name)) return fallback;
  const value = Number(options[name]);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a finite number.`);
  }
  return value;
}

function integerOption(options, name, fallback) {
  const value = numberOption(options, name, fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`--${name} must be an integer.`);
  }
  return value;
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(resolve(path), "utf8"));
  } catch (error) {
    throw new Error(`${label} is not readable JSON: ${error.message}`);
  }
}

async function inputs() {
  const [catalog, regressionRegistry, catalogScores] = await Promise.all([
    readCatalog({ loadResources: false }),
    readRegressionCases(),
    readFile(join(root, "catalog-quality-scores.json"), "utf8").then(JSON.parse),
  ]);
  return { catalog, regressionRegistry, catalogScores };
}

async function buildFromOptions(options, overrides = {}) {
  const source = await inputs();
  const mode = overrides.mode ?? options.mode ?? "mock";
  const schedule = overrides.schedule ?? options.schedule ?? "baseline";
  const onlyIds = (options.only ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const modelSettings = options["model-settings"]
    ? await readJson(options["model-settings"], "Model settings")
    : {};
  const repetitions = schedule === "seven-day" ? 7 : 1;
  const infrastructureRetries = integerOption(
    options,
    "infrastructure-retries",
    1,
  );
  const selectedClawCount = onlyIds.length || source.catalog.entries.length;
  const defaultTotalTokens =
    selectedClawCount *
    3 *
    repetitions *
    (infrastructureRetries + 1) *
    (integerOption(options, "max-input-tokens", 4_000) +
      integerOption(options, "max-output-tokens", 2_000));
  const configIdentity =
    mode === "live" && options["openclaw-config"]
      ? await inspectLiveConfig(options["openclaw-config"], {
          provider: options.provider,
          model: options.model,
        })
      : {};
  const manifest = await buildRunManifest({
    ...source,
    onlyIds,
    mode,
    schedule,
    openclaw: {
      version: options["openclaw-version"],
      revision: options["openclaw-revision"],
    },
    model: {
      provider: options.provider,
      model: options.model,
      modelRevision: options["model-revision"],
      modelSettings,
      ...configIdentity,
    },
    limits: {
      concurrency: integerOption(options, "concurrency", 4),
      trialTimeoutMs: integerOption(options, "trial-timeout-ms", 120_000),
      cleanupTimeoutMs: integerOption(options, "cleanup-timeout-ms", 30_000),
      infrastructureRetries,
      maxInputTokensPerTrial: integerOption(options, "max-input-tokens", 4_000),
      maxOutputTokensPerTrial: integerOption(options, "max-output-tokens", 2_000),
      maxTotalTokens: integerOption(options, "max-total-tokens", defaultTotalTokens),
      maxUsd: numberOption(options, "max-usd", null),
    },
    pricing: {
      inputUsdPerMillion: numberOption(options, "input-usd-per-million", 0),
      outputUsdPerMillion: numberOption(options, "output-usd-per-million", 0),
    },
  });
  return { ...source, manifest };
}

async function runCheck(options) {
  if (options.mode && options.mode !== "mock") {
    throw new Error("--check is an offline deterministic mock check.");
  }
  const firstInput = await buildFromOptions(options, {
    mode: "mock",
    schedule: "baseline",
  });
  if (
    firstInput.manifest.schedule.clawCount !== firstInput.catalog.entries.length ||
    firstInput.manifest.schedule.trialCount !== firstInput.catalog.entries.length * 3
  ) {
    throw new Error(
      `Runtime evidence check requires the full ${firstInput.catalog.entries.length}-Claw/${firstInput.catalog.entries.length * 3}-trial catalog, received ${firstInput.manifest.schedule.clawCount}/${firstInput.manifest.schedule.trialCount}.`,
    );
  }
  const first = await runRuntimeEvidence({
    ...firstInput,
    outputRoot: null,
    persist: false,
  });
  const secondInput = await buildFromOptions(options, {
    mode: "mock",
    schedule: "baseline",
  });
  const second = await runRuntimeEvidence({
    ...secondInput,
    outputRoot: null,
    persist: false,
  });
  if (deterministicEvidenceView(first) !== deterministicEvidenceView(second)) {
    throw new Error("Runtime evidence deterministic score/report generation drifted.");
  }
  const representativeIds = new Set([
    "customer-support",
    "data-analyst",
    "sales-operations",
    "software-maintainer",
  ]);
  const representatives = first.report.claws.filter((claw) =>
    representativeIds.has(claw.id),
  );
  if (
    representatives.length !== representativeIds.size ||
    representatives.some(
      (claw) =>
        claw.runtimeEvidenceQuality.status !== "qualified" ||
        claw.runtimeEvidenceQuality.score !== 100,
    )
  ) {
    throw new Error("Runtime evidence representative X3, visual, or capability shape failed.");
  }
  console.log(
    `Runtime evidence is deterministic (${first.results.length} trials, ${first.report.portfolio.qualifiedClaws} qualified mock Claws).`,
  );
}

async function run(options) {
  const input = await buildFromOptions(options);
  const outputRoot = resolve(
    options.output ?? join(root, ".tmp", "runtime-evidence", input.manifest.runId),
  );
  const result = await runRuntimeEvidence({
    ...input,
    outputRoot,
    live:
      input.manifest.mode === "live"
        ? {
            openclawEntry: resolve(options["openclaw-entry"] ?? ""),
            openclawConfig: resolve(options["openclaw-config"] ?? ""),
          }
        : null,
  });
  console.log(
    `${result.manifest.mode} runtime evidence: ${result.report.portfolio.passed}/${result.results.length} trials passed; report ${join(outputRoot, "report.json")}`,
  );
  if (
    result.results.some(
      (trial) =>
        trial.status !== "passed" ||
        trial.gateFailures.length > 0,
    )
  ) {
    process.exitCode = 1;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { options, flags } = parseArguments(argv);
  const known = new Set([
    "mode",
    "schedule",
    "only",
    "output",
    "openclaw-entry",
    "openclaw-config",
    "openclaw-version",
    "openclaw-revision",
    "provider",
    "model",
    "model-revision",
    "model-settings",
    "concurrency",
    "trial-timeout-ms",
    "cleanup-timeout-ms",
    "infrastructure-retries",
    "max-input-tokens",
    "max-output-tokens",
    "max-total-tokens",
    "max-usd",
    "input-usd-per-million",
    "output-usd-per-million",
  ]);
  const unknown = Object.keys(options).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown runtime evidence options: ${unknown.join(", ")}.`);
  }
  if (flags.has("check")) {
    if (options.only) {
      throw new Error("--check always covers the full catalog; do not combine it with --only.");
    }
    await runCheck(options);
    return;
  }
  if (!options.mode) {
    throw new Error("Specify --mode mock or --mode live.");
  }
  if (options.mode === "live") {
    for (const required of [
      "openclaw-entry",
      "openclaw-config",
      "openclaw-version",
      "openclaw-revision",
      "provider",
      "model",
      "model-revision",
      "max-usd",
      "input-usd-per-million",
      "output-usd-per-million",
    ]) {
      if (!options[required]) {
        throw new Error(`Live runtime evidence requires --${required}.`);
      }
    }
  }
  await run(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
