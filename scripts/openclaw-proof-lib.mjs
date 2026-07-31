import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveProofConfig() {
  const cliEntry = resolve(
    process.env.CLAWS_CLI_ENTRY ??
      join(root, "..", "standalone-claw-cli-prototype", "packages", "cli", "dist", "cli.mjs"),
  );
  const openClawEntry = process.env.OPENCLAW_CLI_ENTRY;
  if (!openClawEntry) {
    throw new Error("Set OPENCLAW_CLI_ENTRY to a compatible OpenClaw entry point.");
  }
  return { cliEntry, openClawEntry: resolve(openClawEntry) };
}

export async function readCatalog() {
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) {
    throw new Error("catalog.json must contain a schemaVersion 1 entries array.");
  }
  return catalog;
}

export async function createProofEnvironment(proofRoot, id) {
  const packageRoot = join(proofRoot, id);
  const stateRoot = join(packageRoot, "state");
  const home = join(packageRoot, "home");
  const temp = join(packageRoot, "tmp");
  await mkdir(stateRoot, { recursive: true });
  await mkdir(home, { recursive: true });
  await mkdir(temp, { recursive: true });
  return {
    packageRoot,
    stateRoot,
    home,
    temp,
    env: {
      ...process.env,
      HOME: home,
      OPENCLAW_CONFIG_PATH: join(stateRoot, "openclaw.json"),
      OPENCLAW_EXPERIMENTAL_CLAWS: "1",
      OPENCLAW_HOME: stateRoot,
      OPENCLAW_STATE_DIR: stateRoot,
      TEMP: temp,
      TMP: temp,
      TMPDIR: temp,
    },
  };
}

function parseJsonOutput(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit JSON: ${error.message}\n${stdout}`);
  }
}

export function runJson(entry, args, options) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    encoding: "utf8",
    env: options.env,
    timeout: options.timeout ?? 6 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const invocation = [process.execPath, entry, ...args];
  const record = {
    invocation,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  if (result.error) {
    throw Object.assign(new Error(`${options.label} failed to start: ${result.error.message}`), {
      record,
    });
  }
  const acceptedStatuses = options.acceptedStatuses ?? [0];
  if (!acceptedStatuses.includes(result.status)) {
    throw Object.assign(
      new Error(`${options.label} failed (${result.status}):\n${result.stderr || result.stdout}`),
      { record },
    );
  }
  const jsonOutput = result.stdout.trim().length > 0 ? result.stdout : result.stderr;
  return { payload: parseJsonOutput(jsonOutput, options.label), record };
}

export function runStandalone(cliEntry, args, env, label, acceptedStatuses) {
  return runJson(cliEntry, [...args, "--json"], { env, label, acceptedStatuses });
}

export function runOpenClaw(openClawEntry, args, env, label, acceptedStatuses) {
  return runJson(openClawEntry, [...args, "--json"], { env, label, acceptedStatuses });
}

export function assertStandaloneSuccess(payload, operation) {
  if (payload.ok !== true || payload.operation !== operation || payload.diagnostics?.length !== 0) {
    throw new Error(`Standalone ${operation} returned an unsuccessful outcome.`);
  }
  return payload;
}

export function assertPreviewEnvelope(payload) {
  const plan = payload.harness?.outcome ?? payload;
  if (
    plan.schemaVersion !== "openclaw.clawAddPlan.v1" ||
    plan.dryRun !== true ||
    plan.mutationAllowed !== false ||
    typeof plan.planIntegrity !== "string"
  ) {
    throw new Error("OpenClaw did not return a bounded non-mutating add plan.");
  }
  return plan;
}

export function assertAddPreview(payload) {
  const plan = assertPreviewEnvelope(payload);
  if (
    plan.summary?.blockedActions !== 0 ||
    (plan.blockers?.length ?? 0) !== 0
  ) {
    throw new Error("OpenClaw did not return a complete non-mutating add plan.");
  }
  return plan;
}

export function failureRecord(phase, error) {
  return {
    phase,
    message: error instanceof Error ? error.message : String(error),
    ...(error?.record ? { command: error.record } : {}),
  };
}
