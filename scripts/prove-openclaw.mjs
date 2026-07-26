import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = resolve(
  process.env.CLAWS_CLI_ENTRY ??
    join(root, "..", "standalone-claw-cli-prototype", "packages", "cli", "dist", "cli.mjs"),
);
const openClawEntry = process.env.OPENCLAW_CLI_ENTRY;
if (!openClawEntry) {
  throw new Error("Set OPENCLAW_CLI_ENTRY to a compatible OpenClaw entry point.");
}

const representativeIds = [
  "incident-response",
  "financial-analyst",
  "customer-support",
  "executive-assistant",
  "compliance-reviewer",
];
const proofRoot = await mkdtemp(join(tmpdir(), "awesome-claws-openclaw-proof-"));
const results = [];

try {
  for (const id of representativeIds) {
    const stateRoot = join(proofRoot, id, "state");
    const home = join(proofRoot, id, "home");
    await mkdir(stateRoot, { recursive: true });
    await mkdir(home, { recursive: true });
    const preview = spawnSync(
      process.execPath,
      [cliEntry, join(root, "claws", id), "--agent", "openclaw", "--dry-run", "--json"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: home,
          OPENCLAW_CLI_ENTRY: openClawEntry,
          OPENCLAW_CONFIG_PATH: join(stateRoot, "openclaw.json"),
          OPENCLAW_EXPERIMENTAL_CLAWS: "1",
          OPENCLAW_HOME: stateRoot,
          OPENCLAW_STATE_DIR: stateRoot,
        },
        timeout: 6 * 60 * 1000,
      },
    );
    if (preview.status !== 0) {
      throw new Error(`${id} OpenClaw preview failed:\n${preview.stderr || preview.stdout}`);
    }
    const outcome = JSON.parse(preview.stdout);
    const plan = outcome.harness?.outcome;
    if (
      outcome.ok !== true ||
      plan?.schemaVersion !== "openclaw.clawAddPlan.v1" ||
      plan.dryRun !== true ||
      plan.mutationAllowed !== false ||
      plan.readiness?.ready !== true ||
      plan.summary?.blockedActions !== 0
    ) {
      throw new Error(`${id} did not return a ready non-mutating OpenClaw plan.`);
    }
    results.push({ id, actions: plan.summary.totalActions, integrity: plan.planIntegrity });
  }
} finally {
  await rm(proofRoot, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      schemaVersion: "awesomeClaws.openClawProof.v0",
      previews: results,
      disposableStateRemoved: true,
    },
    null,
    2,
  ),
);

