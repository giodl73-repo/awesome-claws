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

const representatives = [
  { id: "incident-response", expectedSummary: { cronJobActions: 1 } },
  {
    id: "software-maintainer",
    expectedReady: false,
    expectedRequirements: ["oauth"],
    expectedSummary: { packageActions: 1, mcpServerActions: 1 },
  },
  { id: "financial-analyst", expectedSummary: { packageActions: 1 } },
  { id: "customer-support", expectedSummary: { packageActions: 1 } },
  {
    id: "executive-briefing",
    expectedSummary: { packageActions: 2, cronJobActions: 1 },
  },
  { id: "meeting-intelligence", expectedSummary: { packageActions: 2 } },
  { id: "spreadsheet-analyst", expectedSummary: { packageActions: 1 } },
  { id: "knowledge-gardener", expectedSummary: { packageActions: 1 } },
  {
    id: "research-monitor",
    expectedSummary: { packageActions: 1, cronJobActions: 1 },
  },
  { id: "presentation-producer", expectedSummary: { packageActions: 1 } },
  { id: "document-intake-analyst", expectedSummary: { packageActions: 1 } },
  { id: "media-evidence-reviewer", expectedSummary: { packageActions: 2 } },
  { id: "release-coordinator", expectedSummary: { packageActions: 2 } },
  {
    id: "feed-intelligence-monitor",
    expectedSummary: { packageActions: 1, cronJobActions: 1 },
  },
  { id: "travel-planner", expectedSummary: { packageActions: 2 } },
  { id: "travel-concierge", expectedSummary: { packageActions: 1 } },
  { id: "web-evidence-researcher", expectedSummary: { packageActions: 1 } },
  { id: "website-evidence-collector", expectedSummary: { packageActions: 1 } },
  { id: "video-concept-producer", expectedSummary: { packageActions: 1 } },
  { id: "workflow-operator", expectedSummary: { packageActions: 1 } },
  {
    id: "public-company-watcher",
    expectedSummary: { packageActions: 1, cronJobActions: 1 },
  },
  { id: "research-scout", expectedSummary: { packageActions: 1, cronJobActions: 1 } },
  {
    id: "public-safety-monitor",
    expectedSummary: { packageActions: 2, cronJobActions: 1 },
  },
  { id: "civic-data-analyst", expectedSummary: { packageActions: 1 } },
  { id: "executive-assistant" },
  { id: "compliance-reviewer" },
];
const proofRoot = await mkdtemp(join(tmpdir(), "awesome-claws-openclaw-proof-"));
const results = [];

try {
  for (const representative of representatives) {
    const { id, expectedReady = true, expectedRequirements = [], expectedSummary = {} } =
      representative;
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
      plan.readiness?.ready !== expectedReady ||
      plan.summary?.blockedActions !== 0 ||
      (plan.blockers?.length ?? 0) !== 0 ||
      JSON.stringify((plan.readiness?.requirements ?? []).map((item) => item.kind)) !==
        JSON.stringify(expectedRequirements) ||
      Object.entries(expectedSummary).some(([key, value]) => plan.summary?.[key] !== value)
    ) {
      throw new Error(`${id} did not return the expected non-mutating OpenClaw plan.`);
    }
    results.push({
      id,
      actions: plan.summary.totalActions,
      ready: plan.readiness.ready,
      requirements: expectedRequirements,
      integrity: plan.planIntegrity,
    });
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
