import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readCatalog, root } from "./catalog-source.mjs";
import {
  parseClawCommandArgs,
  proofPlanFor,
  renderClawWorkflowSummary,
  runLoggedCommand,
  selectClaws,
  writeClawWorkflowArtifacts,
} from "./claw-workflow.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

const options = parseClawCommandArgs(process.argv.slice(2));
if (options.installed || options.live || options.visual) {
  throw new Error("prepare:claw reports optional proof lanes; run them with test:claw.");
}
const catalog = await readCatalog();
const selected = selectClaws(catalog.entries, options.selectors);
const experienceById = new Map(
  (await readExperienceCases(catalog)).map((item) => [item.id, item]),
);
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const runRoot = join(root, ".tmp", "claw-runs", runId);
await mkdir(runRoot, { recursive: true });
if (!process.env.npm_execpath) {
  throw new Error("Run this command through npm: npm run prepare:claw -- <id-or-filter>");
}
const runs = [];
for (const [name, args] of [
  ["build", ["run", "build"]],
  ["check", ["run", "check"]],
]) {
  process.stderr.write(`RUN  ${name}\n`);
  const result = await runLoggedCommand({
    name,
    command: process.execPath,
    args: [process.env.npm_execpath, ...args],
    cwd: root,
    logRoot: runRoot,
    timeout: 30 * 60 * 1000,
  });
  runs.push(result);
  process.stderr.write(`${result.status === "passed" ? "PASS" : "FAIL"} ${name}\n`);
  if (result.status !== "passed") {
    break;
  }
}
const summary = {
  schemaVersion: "awesomeClaws.clawWorkflow.v1",
  mode: "prepare",
  runId,
  generatedAt: new Date().toISOString(),
  status: runs.every((item) => item.status === "passed") ? "passed" : "failed",
  options,
  entries: selected.map((entry) => ({
    id: entry.id,
    plan: proofPlanFor(entry, experienceById.get(entry.id)),
  })),
  runs,
};
await writeClawWorkflowArtifacts(summary, runRoot);
console.log(renderClawWorkflowSummary(summary));
if (summary.status !== "passed") {
  process.exitCode = 1;
}
