import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cron } from "croner";
import { parseDocument } from "yaml";
import {
  validateManifestMetadata,
  validateOpenClawProfile,
} from "./catalog-contract.mjs";
import { isSafePackagePath, pathsConflict, portablePathKey } from "./portable-paths.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const useReferenceCli = process.argv.includes("--reference");
const cliEntry = useReferenceCli
  ? resolve(
      process.env.CLAWS_CLI_ENTRY ??
        join(root, "..", "standalone-claw-cli-prototype", "packages", "cli", "dist", "cli.mjs"),
    )
  : undefined;
const baseExpectedFiles = [
  "CLAW.md",
  "README.md",
  "package.json",
  "screenshot.png",
  "workspace/AGENTS.md",
];
const baselineStarterIds = [
  "compliance-reviewer",
  "content-operations",
  "customer-support",
  "data-analyst",
  "executive-assistant",
  "financial-analyst",
  "incident-response",
  "knowledge-curator",
  "product-manager",
  "project-manager",
  "recruiting-coordinator",
  "research-briefing",
  "sales-operations",
  "security-analyst",
  "software-maintainer",
];
const exactVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

if (!Array.isArray(catalog.entries)) {
  throw new Error("The catalog must contain an entries array.");
}
const catalogIds = catalog.entries.map((entry) => entry.id).sort();
const missingBaselineIds = baselineStarterIds.filter((id) => !catalogIds.includes(id));
if (missingBaselineIds.length > 0) {
  throw new Error(`The catalog is missing baseline starters: ${missingBaselineIds.join(", ")}.`);
}

const ids = new Set();
const names = new Set();
const demonstratedCapabilities = new Set();

function hasValidCronSchedule(schedule) {
  if (
    typeof schedule?.cron !== "string" ||
    schedule.cron.trim().split(/\s+/).length !== 5 ||
    typeof schedule.timezone !== "string" ||
    !schedule.timezone.trim()
  ) {
    return false;
  }
  try {
    return new Cron(schedule.cron, {
      timezone: schedule.timezone,
      catch: false,
    }).nextRun(new Date()) instanceof Date;
  } catch {
    return false;
  }
}

function hasValidCronDelivery(delivery) {
  if (delivery === undefined) {
    return true;
  }
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return false;
  }
  const keys = Object.keys(delivery);
  return (
    (delivery.mode === "none" && delivery.channel === undefined && keys.length === 1) ||
    (delivery.mode === "announce" && delivery.channel === "last" && keys.length === 2)
  );
}

function hasOnlyKeys(value, allowed) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}

function hasValidToolFilter(filter) {
  if (filter === undefined) {
    return true;
  }
  if (!hasOnlyKeys(filter, ["include", "exclude"])) {
    return false;
  }
  for (const field of ["include", "exclude"]) {
    const values = filter[field];
    if (values === undefined) {
      continue;
    }
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value !== value.trim() ||
          value.includes("?") ||
          value.includes("[") ||
          value.includes("]"),
      ) ||
      new Set(values).size !== values.length
    ) {
      return false;
    }
  }
  return true;
}

for (const entry of catalog.entries) {
  if (ids.has(entry.id) || names.has(entry.name)) {
    throw new Error(`Duplicate catalog identity: ${entry.id}`);
  }
  ids.add(entry.id);
  names.add(entry.name);

  const minimumItems = {
    principles: 3,
    workflow: 4,
    deliverables: 4,
    intake: 3,
    boundaries: 2,
    doneWhen: 3,
  };
  for (const [field, minimum] of Object.entries(minimumItems)) {
    const values = entry[field];
    if (
      !Array.isArray(values) ||
      values.length < minimum ||
      values.some((value) => typeof value !== "string" || !value.trim()) ||
      new Set(values).size !== values.length
    ) {
      throw new Error(
        `${entry.id}.${field} must contain at least ${minimum} unique substantive entries.`,
      );
    }
  }
  if (
    typeof entry.audience !== "string" ||
    !entry.audience.trim() ||
    typeof entry.example?.request !== "string" ||
    !entry.example.request.trim() ||
    typeof entry.example?.outcome !== "string" ||
    !entry.example.outcome.trim()
  ) {
    throw new Error(`${entry.id} must define an audience and complete example setting.`);
  }
  const generatedFiles = entry.resources ?? [];
  if (
    generatedFiles.some(
      (file) => typeof file.content !== "string" || file.content.trim().length === 0,
    )
  ) {
    throw new Error(`${entry.id} contains missing or empty generated file content.`);
  }
  if (entry.bootstrap !== undefined && (typeof entry.bootstrap !== "string" || !entry.bootstrap.trim())) {
    throw new Error(`${entry.id}.bootstrap must contain seed-once setup instructions.`);
  }
  const generatedSources = generatedFiles.map((file) => file.source);
  const reservedSources = [
    "CLAW.md",
    "README.md",
    "package.json",
    "workspace/AGENTS.md",
    "BOOTSTRAP.md",
    ...(entry.openclawProfile ? ["profiles/openclaw.yml"] : []),
  ].map(portablePathKey);
  const sourceKeys = generatedSources.map(portablePathKey);
  if (
    generatedSources.some((source) => !isSafePackagePath(source)) ||
    sourceKeys.some((source, index) =>
      [...sourceKeys.slice(0, index), ...reservedSources].some((other) =>
        pathsConflict(source, other),
      ),
    )
  ) {
    throw new Error(`${entry.id} contains unsafe or colliding generated package source paths.`);
  }

  for (const pkg of entry.packages ?? []) {
    if (
      !["skill", "plugin"].includes(pkg?.kind) ||
      pkg?.source !== "clawhub" ||
      typeof pkg?.ref !== "string" ||
      !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.ref) ||
      typeof pkg?.version !== "string" ||
      !exactVersionPattern.test(pkg.version)
    ) {
      throw new Error(`${entry.id} contains an invalid pinned ClawHub package declaration.`);
    }
    demonstratedCapabilities.add(pkg.kind);
  }
  for (const [name, server] of Object.entries(entry.mcpServers ?? {})) {
    if (
      !/^[a-z][a-z0-9_-]{0,63}$/.test(name) ||
      !hasOnlyKeys(server, ["url", "transport", "auth", "toolFilter", "timeout", "connectTimeout"]) ||
      typeof server?.url !== "string" ||
      server.transport !== "streamable-http" ||
      (server.auth !== undefined && server.auth !== "oauth") ||
      !hasValidToolFilter(server.toolFilter) ||
      (server.timeout !== undefined &&
        (typeof server.timeout !== "number" || !Number.isFinite(server.timeout) || server.timeout <= 0)) ||
      (server.connectTimeout !== undefined &&
        (typeof server.connectTimeout !== "number" ||
          !Number.isFinite(server.connectTimeout) ||
          server.connectTimeout <= 0))
    ) {
      throw new Error(`${entry.id} contains an invalid remote MCP declaration.`);
    }
    const url = new URL(server.url);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      throw new Error(`${entry.id} remote MCP URLs must be credential-free HTTPS URLs.`);
    }
    demonstratedCapabilities.add("mcp");
  }
  for (const job of entry.cronJobs ?? []) {
    if (
      !hasOnlyKeys(job, ["id", "name", "schedule", "session", "message", "delivery"]) ||
      !/^[a-z][a-z0-9_-]{0,63}$/.test(job?.id) ||
      (job.name !== undefined && (typeof job.name !== "string" || !job.name.trim())) ||
      !hasOnlyKeys(job?.schedule, ["cron", "timezone"]) ||
      !hasValidCronSchedule(job?.schedule) ||
      !["main", "isolated"].includes(job?.session) ||
      typeof job?.message !== "string" ||
      !job.message.trim() ||
      !hasValidCronDelivery(job?.delivery)
    ) {
      throw new Error(`${entry.id} contains an invalid scheduled-work declaration.`);
    }
    demonstratedCapabilities.add("cron");
  }
  const capabilityCount =
    (entry.packages?.length ?? 0) +
    Object.keys(entry.mcpServers ?? {}).length +
    (entry.cronJobs?.length ?? 0) +
    (entry.openclawProfile ? 1 : 0);
  if (
    capabilityCount > 0 &&
    (!Array.isArray(entry.capabilityGuidance) ||
      entry.capabilityGuidance.length === 0 ||
      entry.capabilityGuidance.some(
        (guidance) => typeof guidance !== "string" || !guidance.trim(),
      ))
  ) {
    throw new Error(`${entry.id} must explain the boundaries of every integrated capability set.`);
  }
  if (entry.openclawProfile) {
    validateOpenClawProfile(entry.openclawProfile, entry.id);
    for (const extension of entry.openclawProfile.extensions ?? []) {
      demonstratedCapabilities.add("plugin");
    }
  }

  const packageRoot = join(root, "claws", entry.id);
  const expectedFiles = [
    ...baseExpectedFiles,
    ...(entry.openclawProfile ? ["profiles/openclaw.yml"] : []),
    ...(entry.resources ?? []).map((resource) => resource.source),
    ...(entry.bootstrap ? ["BOOTSTRAP.md"] : []),
  ];
  const actualFiles = (await readdir(packageRoot, { recursive: true, withFileTypes: true }))
    .filter((item) => item.isFile())
    .map((item) => item.parentPath.slice(packageRoot.length + 1).replaceAll("\\", "/") + "/" + item.name)
    .map((path) => path.replace(/^\//, ""))
    .sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error(`${entry.id} has an unexpected package file set: ${actualFiles.join(", ")}`);
  }

  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (packageJson.private !== true || packageJson.version !== "0.1.0") {
    throw new Error(`${entry.id} must remain non-publishable and exactly versioned.`);
  }
  if (entry.openclawProfile) {
    const profile = parseDocument(
      await readFile(join(packageRoot, "profiles", "openclaw.yml"), "utf8"),
      { prettyErrors: false, uniqueKeys: true },
    );
    if (
      profile.errors.length > 0 ||
      JSON.stringify(profile.toJS()) !== JSON.stringify(entry.openclawProfile)
    ) {
      throw new Error(`${entry.id}/profiles/openclaw.yml does not match the catalog profile.`);
    }
  }

  const clawMarkdown = await readFile(join(packageRoot, "CLAW.md"), "utf8");
  if (!clawMarkdown.startsWith("---\n")) {
    throw new Error(`${entry.id}/CLAW.md must start with a YAML frontmatter delimiter.`);
  }
  const closingFrontmatter = clawMarkdown.indexOf("\n---\n", 4);
  if (closingFrontmatter < 0 || !clawMarkdown.slice(closingFrontmatter + 5).trim()) {
    throw new Error(`${entry.id}/CLAW.md must contain a non-empty portable agent prompt.`);
  }
  const frontmatter = clawMarkdown.slice(4, closingFrontmatter);
  const document = parseDocument(frontmatter, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`${entry.id}/CLAW.md must contain valid, unique-key YAML frontmatter.`);
  }
  const manifest = document.toJS();
  validateManifestMetadata(manifest, `${entry.id}/CLAW.md`);
  if (manifest.schemaVersion !== 1) {
    throw new Error(`${entry.id}/CLAW.md has the wrong schema version.`);
  }
  if (
    manifest.agent?.id !== entry.id ||
    manifest.agent?.name !== entry.name ||
    manifest.agent?.description !== entry.description ||
    manifest.agent?.identity?.name !== entry.name
  ) {
    throw new Error(`${entry.id}/CLAW.md agent identity does not match the catalog.`);
  }
  if (
    manifest.setup !== undefined ||
    manifest.personalization !== undefined ||
    JSON.stringify(manifest.workspace?.bootstrapFiles) !==
      JSON.stringify({ "AGENTS.md": { source: "workspace/AGENTS.md" } })
  ) {
    throw new Error(`${entry.id}/CLAW.md contains retired schema-v2 fields or inconsistent bootstrap wiring.`);
  }
  for (const field of ["packages", "mcpServers", "cronJobs"]) {
    const expected = entry[field] ?? (field === "mcpServers" ? {} : []);
    if (JSON.stringify(manifest?.[field]) !== JSON.stringify(expected)) {
      throw new Error(`${entry.id}/CLAW.md does not match catalog.${field}.`);
    }
  }
  const expectedWorkspaceFiles = (entry.resources ?? []).map(({ source, path }) => ({
    source,
    path,
  }));
  if (JSON.stringify(manifest.workspace?.files ?? []) !== JSON.stringify(expectedWorkspaceFiles)) {
    throw new Error(`${entry.id}/CLAW.md does not match catalog workspace files.`);
  }
  if (entry.bootstrap) {
    const bootstrap = await readFile(join(packageRoot, "BOOTSTRAP.md"), "utf8");
    if (bootstrap !== `${entry.bootstrap.trim()}\n`) {
      throw new Error(`${entry.id}/BOOTSTRAP.md does not match catalog bootstrap instructions.`);
    }
  }
  const workspaceTargets = [
    ...Object.keys(manifest?.workspace?.bootstrapFiles ?? {}),
    ...(manifest?.workspace?.files ?? []).map((file) => file.path),
  ];
  if (workspaceTargets.some((path) => !isSafePackagePath(path))) {
    throw new Error(`${entry.id}/CLAW.md workspace targets must be safe relative paths.`);
  }
  const targetKeys = workspaceTargets.map(portablePathKey);
  if (
    targetKeys.some((target, index) =>
      [...targetKeys.slice(0, index), "soul.md"].some((other) => pathsConflict(target, other)),
    )
  ) {
    throw new Error(`${entry.id}/CLAW.md contains colliding workspace targets.`);
  }

  const screenshot = await readFile(join(packageRoot, "screenshot.png"));
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (screenshot.length < 50_000 || !screenshot.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${entry.id}/screenshot.png must be a non-empty PNG advertising screenshot.`);
  }

  for (const relativePath of expectedFiles) {
    if (relativePath.endsWith(".png")) {
      continue;
    }
    const content = await readFile(join(packageRoot, relativePath), "utf8");
    if (/(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,})/.test(content)) {
      throw new Error(`${entry.id}/${relativePath} contains secret-like material.`);
    }
  }

  if (cliEntry) {
    const inspected = spawnSync(process.execPath, [cliEntry, "inspect", packageRoot, "--json"], {
      encoding: "utf8",
      env: { ...process.env, OPENCLAW_EXPERIMENTAL_CLAWS: "1" },
    });
    if (inspected.status !== 0) {
      throw new Error(
        `${entry.id} failed reference inspection:\n${inspected.stderr || inspected.stdout}`,
      );
    }
    const outcome = JSON.parse(inspected.stdout);
    if (outcome.ok !== true || outcome.claw?.agent?.id !== entry.id) {
      throw new Error(`${entry.id} returned an inconsistent inspection result.`);
    }
  }
}

for (const capability of ["skill", "plugin", "mcp", "cron"]) {
  if (!demonstratedCapabilities.has(capability)) {
    throw new Error(`The catalog must retain at least one reviewed ${capability} example.`);
  }
}

console.log(
  `Validated ${catalog.entries.length} Claws${useReferenceCli ? " with the standalone reference CLI" : ""}.`,
);
