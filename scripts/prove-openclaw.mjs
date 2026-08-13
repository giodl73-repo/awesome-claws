import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  assertAddPreview,
  assertPreviewEnvelope,
  assertStandaloneSuccess,
  createProofEnvironment,
  readCatalog,
  resolveProofConfig,
  root,
  runStandalone,
} from "./openclaw-proof-lib.mjs";

const { cliEntry, openClawEntry } = resolveProofConfig();
const catalog = await readCatalog();
const requestedIds = new Set(
  (process.env.PORTFOLIO_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const entries =
  requestedIds.size === 0
    ? catalog.entries
    : catalog.entries.filter((entry) => requestedIds.has(entry.id));
const unknownIds = [...requestedIds].filter(
  (id) => !catalog.entries.some((entry) => entry.id === id),
);
if (unknownIds.length > 0) {
  throw new Error(`Unknown PORTFOLIO_ONLY package ids: ${unknownIds.join(", ")}`);
}
await mkdir(join(root, ".tmp"), { recursive: true });
const proofRoot = await mkdtemp(join(root, ".tmp", "openclaw-proof-"));
const previews = [];

try {
  for (const [index, entry] of entries.entries()) {
    process.stderr.write(`RUN  ${index + 1}/${entries.length} ${entry.id}\n`);
    const proof = await createProofEnvironment(proofRoot, entry.id);
    const outcome = runStandalone(
        cliEntry,
        [join(root, "claws", entry.id), "--agent", "openclaw", "--dry-run"],
        { ...proof.env, OPENCLAW_CLI_ENTRY: openClawEntry },
        `${entry.id} OpenClaw preview`,
        [0, 3],
      ).payload;
    const plan = assertPreviewEnvelope(outcome);
    const blockerCodes = (plan.blockers ?? []).map((blocker) => blocker.code);
    const providerBlocked = blockerCodes.includes("clawhub_security_unavailable");
    const allowedBlockers = new Set(["clawhub_security_unavailable"]);
    if (blockerCodes.some((code) => !allowedBlockers.has(code))) {
      throw new Error(`${entry.id} returned unexpected blockers: ${blockerCodes.join(", ")}.`);
    }
    let adapterStatus;
    if (providerBlocked) {
      adapterStatus = "provider-blocked";
    } else {
      assertAddPreview(assertStandaloneSuccess(outcome, "preview"));
      adapterStatus = "passed";
    }
    previews.push({
      id: entry.id,
      actions: plan.summary.totalActions,
      ready: plan.readiness?.ready ?? true,
      requirements: (plan.readiness?.requirements ?? []).map((item) => item.kind),
      integrity: plan.planIntegrity,
      adapterStatus,
    });
  }
} finally {
  await rm(proofRoot, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      schemaVersion: "awesomeClaws.openClawProof.v1",
      packageCount: entries.length,
      passedCount: previews.filter((preview) => preview.adapterStatus === "passed").length,
      providerBlockedCount: previews.filter(
        (preview) => preview.adapterStatus === "provider-blocked",
      ).length,
      previews,
      disposableStateRemoved: true,
    },
    null,
    2,
  ),
);
