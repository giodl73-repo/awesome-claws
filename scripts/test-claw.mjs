import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readCatalog, root } from "./catalog-source.mjs";
import {
  inapplicableRequestedLanes,
  parseClawCommandArgs,
  proofPlanFor,
  renderClawWorkflowSummary,
  runLoggedCommand,
  selectClaws,
  writeClawWorkflowArtifacts,
} from "./claw-workflow.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

const options = parseClawCommandArgs(process.argv.slice(2));
const catalog = await readCatalog({ loadResources: false });
const selected = selectClaws(catalog.entries, options.selectors);
const experienceById = new Map(
  (await readExperienceCases(await readCatalog())).map((item) => [item.id, item]),
);
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const runRoot = join(root, ".tmp", "claw-runs", runId);
await mkdir(runRoot, { recursive: true });
const entries = selected.map((entry) => ({
  id: entry.id,
  plan: proofPlanFor(entry, experienceById.get(entry.id)),
}));
const runs = [];

async function run(
  name,
  script,
  { entryId, env, importTsx = false, scriptArgs = [], timeout } = {},
) {
  process.stderr.write(`RUN  ${name}\n`);
  const result = await runLoggedCommand({
    name,
    command: process.execPath,
    args: [
      ...(importTsx ? ["--import", "tsx"] : []),
      join(root, "scripts", script),
      ...scriptArgs,
    ],
    cwd: root,
    env,
    logRoot: entryId ? join(runRoot, entryId) : runRoot,
    timeout,
  });
  const prefix = entryId ? `${entryId}/` : "";
  runs.push({
    ...result,
    ...(entryId ? { entryId } : {}),
    logs: {
      stdout: `${prefix}${result.logs.stdout}`,
      stderr: `${prefix}${result.logs.stderr}`,
    },
  });
  process.stderr.write(`${result.status === "passed" ? "PASS" : "FAIL"} ${name}\n`);
  return result;
}

await run("materialize", "materialize-catalog.mjs", { scriptArgs: ["--check"] });
if (runs.at(-1).status === "passed") {
  for (const entry of selected) {
    await run("regression", "regression-cases.mjs", {
      entryId: entry.id,
      env: { REGRESSION_ONLY: entry.id },
    });
  }
}

const laneFailures = inapplicableRequestedLanes(entries, options);
for (const failure of laneFailures) {
  process.stderr.write(`FAIL ${failure.name}: ${failure.message}\n`);
}

if (options.installed && runs.every((item) => item.status === "passed")) {
  for (const entry of selected) {
    await run(`installed-${entry.id}`, "prove-portfolio.mjs", {
      entryId: entry.id,
      importTsx: true,
      env: {
        PORTFOLIO_ONLY: entry.id,
        PORTFOLIO_PROOF_DIR: join(runRoot, entry.id, "installed"),
        PORTFOLIO_VISUAL_RUNTIME:
          entry.id === "data-analyst" && experienceById.get(entry.id).target >= 4 ? "1" : "0",
      },
      timeout: 75 * 60 * 1000,
    });
  }
}

if (options.visual && runs.every((item) => item.status === "passed")) {
  const visualEntries = entries.filter((entry) => entry.plan.lanes.visual.applicable);
  for (const entry of visualEntries) {
    await run("visual", "prove-experience-assets.mjs", {
      entryId: entry.id,
      env: {
        EXPERIENCE_ONLY: entry.id,
        EXPERIENCE_PROOF_DIR: join(runRoot, entry.id, "visual"),
      },
    });
  }
}

if (options.live && runs.every((item) => item.status === "passed")) {
  const liveEntries = entries.filter((entry) => entry.plan.lanes.dependencyLive.applicable);
  for (const entry of liveEntries) {
    await run("dependency-live", "check-dependency-health.mjs", {
      entryId: entry.id,
      env: {
        DEPENDENCY_HEALTH_ONLY: entry.id,
        DEPENDENCY_HEALTH_DIR: join(runRoot, entry.id, "dependency-live"),
      },
    });
  }
}

runs.push(
  ...laneFailures.map((failure) => ({
    name: failure.name,
    status: "failed",
    exitCode: null,
    signal: null,
    error: failure.message,
  })),
);

const summary = {
  schemaVersion: "awesomeClaws.clawWorkflow.v1",
  mode: "test",
  runId,
  generatedAt: new Date().toISOString(),
  status: runs.every((item) => item.status === "passed") ? "passed" : "failed",
  options,
  entries,
  runs,
};
await writeClawWorkflowArtifacts(summary, runRoot);
console.log(renderClawWorkflowSummary(summary));
if (summary.status !== "passed") {
  process.exitCode = 1;
}
