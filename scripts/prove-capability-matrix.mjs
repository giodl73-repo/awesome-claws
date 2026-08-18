import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCapabilityMatrix } from "./capability-classes.mjs";
import { root } from "./catalog-source.mjs";

const matrix = await readCapabilityMatrix();
const runs = [];
const failures = [];
for (const representative of matrix.representatives) {
  process.stderr.write(
    `PROVE ${representative.id}: ${representative.classes.join(", ")}\n`,
  );
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", join(root, "scripts", "prove-portfolio.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PORTFOLIO_ONLY: representative.id,
        PORTFOLIO_VISUAL_RUNTIME:
          representative.proofMode === "visual-runtime" ? "1" : "0",
      },
      timeout: 75 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  process.stderr.write(result.stderr ?? "");
  if (result.error) {
    failures.push({
      id: representative.id,
      message: `Capability proof failed to start: ${result.error.message}`,
    });
    continue;
  }
  if (result.status !== 0) {
    failures.push({
      id: representative.id,
      message: `Capability proof failed (${result.status}):\n${result.stdout || result.stderr}`,
    });
    continue;
  }
  let summary;
  try {
    summary = JSON.parse(result.stdout);
  } catch (error) {
    failures.push({
      id: representative.id,
      message: `Capability proof returned invalid JSON: ${error.message}`,
    });
    continue;
  }
  if (
    summary.packageCount !== 1 ||
    summary.lifecyclePassed !== 1 ||
    summary.lifecycleFailed !== 0 ||
    summary.applicationScenariosPassed !== 1
  ) {
    failures.push({
      id: representative.id,
      message: "Capability proof returned incomplete lifecycle evidence.",
    });
    continue;
  }
  runs.push({
    id: representative.id,
    classes: representative.classes,
    proofMode: representative.proofMode,
    proofRoot: summary.proofRoot,
    revisions: summary.revisions,
    lifecyclePassed: summary.lifecyclePassed,
    applicationScenariosPassed: summary.applicationScenariosPassed,
  });
}

const revisionSets = new Set(runs.map((run) => JSON.stringify(run.revisions)));
if (
  revisionSets.size !== 1 ||
  Object.values(runs[0]?.revisions ?? {}).some(
    (revision) => revision === "unknown" || revision.endsWith("-dirty"),
  )
) {
  failures.push({
    id: "revisions",
    message: "Capability proof requires clean, exact Awesome Claws, CLI, and OpenClaw revisions.",
  });
}

const summary = {
  schemaVersion: "awesomeClaws.capabilityProof.v1",
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 ? "passed" : "failed",
  matrix,
  revisions: runs[0]?.revisions,
  runs,
  failures,
  classCount: matrix.classCount,
  representativeCount: matrix.representativeCount,
  lifecyclePassed: runs.reduce((total, run) => total + run.lifecyclePassed, 0),
  applicationScenariosPassed: runs.reduce(
    (total, run) => total + run.applicationScenariosPassed,
    0,
  ),
};
const evidenceRoot = join(root, ".tmp", "capability-proof");
await mkdir(evidenceRoot, { recursive: true });
await writeFile(join(evidenceRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) {
  throw new Error(`Capability proof failures:\n${JSON.stringify(failures, null, 2)}`);
}
