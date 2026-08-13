import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import { isSafePackagePath, pathsConflict, portablePathKey } from "./portable-paths.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const check = process.argv.includes("--check");
const safeAgentIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
for (const entry of catalog.entries) {
  if (!safeAgentIdPattern.test(entry.id)) {
    throw new Error(`Catalog id is not a safe portable agent id: ${JSON.stringify(entry.id)}`);
  }
}
const screenshots = new Map(
  await Promise.all(
    catalog.entries.map(async (entry) => [
      entry.id,
      await readFile(join(root, "screenshots", `${entry.id}.png`)),
    ]),
  ),
);

function bullets(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function numbered(values) {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function capabilitySummary(entry) {
  const capabilities = [];
  const tools = entry.openclawProfile?.agent?.tools;
  if (tools) {
    const policy = tools.allow?.length
      ? ` bounded to ${tools.allow.map((tool) => `\`${tool}\``).join(", ")}`
      : tools.alsoAllow?.length
        ? ` plus ${tools.alsoAllow.map((tool) => `\`${tool}\``).join(", ")}`
      : "";
    const filesystem = tools.fs?.workspaceOnly ? " with workspace-only filesystem access" : "";
    capabilities.push(`OpenClaw tool profile \`${tools.profile}\`${policy}${filesystem}`);
  }
  for (const pkg of entry.packages ?? []) {
    capabilities.push(`${pkg.kind} \`${pkg.ref}@${pkg.version}\``);
  }
  for (const extension of entry.openclawProfile?.extensions ?? []) {
    capabilities.push(
      `${extension.format} ${extension.kind} \`${extension.ref}@${extension.version}\``,
    );
  }
  const mcpNames = Object.keys(entry.mcpServers ?? {});
  if (mcpNames.length > 0) {
    capabilities.push(`MCP server${mcpNames.length === 1 ? "" : "s"} ${mcpNames.map((name) => `\`${name}\``).join(", ")}`);
  }
  for (const job of entry.cronJobs ?? []) {
    capabilities.push(`scheduled job \`${job.id}\` (${job.schedule.cron} ${job.schedule.timezone})`);
  }
  return capabilities;
}

function filesFor(entry) {
  const packages = entry.packages ?? [];
  const mcpServers = entry.mcpServers ?? {};
  const cronJobs = entry.cronJobs ?? [];
  const capabilities = capabilitySummary(entry);
  const capabilityGuidance = entry.capabilityGuidance ?? [];
  const resources = entry.resources ?? [];
  const needsStructuredManifest =
    capabilities.length > 0 || entry.openclawProfile || resources.length > 0;
  const capabilityBoundarySection =
    capabilityGuidance.length > 0
      ? `\n\n## Included capability boundaries\n\n${bullets(capabilityGuidance)}`
      : "";
  const packageContents = [
    "- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.",
    "- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.",
    ...capabilities.map((capability) => `- Declared capability: ${capability}.`),
    ...capabilityGuidance.map((guidance) => `- Capability boundary: ${guidance}`),
    ...(entry.bootstrap
      ? ["- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers."]
      : []),
  ].join("\n");
  const soul = `# ${entry.name}

## Purpose

${entry.description}

## Best fit

${entry.audience}

## Operating principles

${bullets(entry.principles)}

## Boundaries

${bullets(entry.boundaries)}
- Do not claim access, authority, approval, or completion that has not been verified.
- Keep personal, confidential, and credential material out of durable outputs. When sensitive material is necessary, require verified authority and an approved destination, minimize or redact it, and prefer controlled references over copies.
- Ask before external communication, publication, destructive action, or irreversible commitment.
- State uncertainty, missing evidence, and the accountable human decision clearly.
`;
  const manifest = {
    schemaVersion: 1,
    agent: {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      identity: { name: entry.name },
    },
    workspace: {
      bootstrapFiles: { "AGENTS.md": { source: "workspace/AGENTS.md" } },
      files: resources.map(({ source, path }) => ({ source, path })),
    },
    packages,
    mcpServers,
    cronJobs,
  };
  const claw = needsStructuredManifest
    ? `---\n${stringifyYaml(manifest, { lineWidth: 0 })}---\n\n${soul}`
    : `---
schemaVersion: 1
agent:
  id: ${entry.id}
  name: ${JSON.stringify(entry.name)}
  description: ${JSON.stringify(entry.description)}
  identity:
    name: ${JSON.stringify(entry.name)}
workspace:
  bootstrapFiles:
    AGENTS.md:
      source: workspace/AGENTS.md
  files: []
packages: []
mcpServers: {}
cronJobs: []
---
\n${soul}`;
  const agents = `# Operating workflow

## Start here

Ask for or confirm:

${bullets(entry.intake)}${capabilityBoundarySection}

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

${numbered(entry.workflow)}

## Example setting

**Request:** ${entry.example.request}

**Expected outcome:** ${entry.example.outcome}

## Standard deliverables

${bullets(entry.deliverables)}

## Done when

${bullets(entry.doneWhen)}

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
`;
  const packageJson = `${JSON.stringify(
    {
      name: `@awesome-claws/${entry.id}`,
      version: "0.1.0",
      private: true,
      type: "module",
      openclaw: { claw: "CLAW.md" },
    },
    null,
    2,
  )}\n`;
  const readme = `# ${entry.name}

${entry.description}

**Best for:** ${entry.audience}

## Example

**Request:** ${entry.example.request}

**Expected outcome:** ${entry.example.outcome}

## Package contents

${packageContents}

Review the package before applying it. Claws can create agents and may declare
additional capabilities${capabilities.length === 0 ? "; this starter currently has no package, MCP, or cron dependencies." : ". Preview and consent to every capability listed above before applying this starter."}
`;
  return new Map([
    ["CLAW.md", claw],
    ["README.md", readme],
    ["package.json", packageJson],
    ["screenshot.png", screenshots.get(entry.id)],
    ["workspace/AGENTS.md", agents],
    ...resources.map((resource) => [resource.source, `${resource.content.trim()}\n`]),
    ...(entry.bootstrap ? [["BOOTSTRAP.md", `${entry.bootstrap.trim()}\n`]] : []),
    ...(entry.openclawProfile
      ? [["profiles/openclaw.yml", stringifyYaml(entry.openclawProfile, { lineWidth: 0 })]]
      : []),
  ]);
}

async function ensureFile(path, expected) {
  if (check) {
    const file = await lstat(path).catch(() => undefined);
    if (!file?.isFile()) {
      throw new Error(`Generated catalog path is not a regular file: ${path}`);
    }
    const actual = await readFile(path).catch(() => undefined);
    const matches =
      actual !== undefined &&
      (Buffer.isBuffer(expected) ? actual.equals(expected) : actual.toString("utf8") === expected);
    if (!matches) {
      throw new Error(`Generated catalog file is stale or missing: ${path}`);
    }
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, expected, Buffer.isBuffer(expected) ? undefined : "utf8");
}

for (const entry of catalog.entries) {
  const generatedSources = (entry.resources ?? []).map((resource) => resource.source);
  const generatedFiles = entry.resources ?? [];
  if (
    generatedFiles.some(
      (file) => typeof file.content !== "string" || file.content.trim().length === 0,
    )
  ) {
    throw new Error(`${entry.id} contains missing or empty generated file content.`);
  }
  const reservedSources = [
    "CLAW.md",
    "README.md",
    "package.json",
    "workspace/AGENTS.md",
    "BOOTSTRAP.md",
    ...(entry.openclawProfile ? ["profiles/openclaw.yml"] : []),
  ];
  const sourceKeys = generatedSources.map(portablePathKey);
  if (
    generatedSources.some((source) => !isSafePackagePath(source)) ||
    sourceKeys.some((source, index) =>
      [...sourceKeys.slice(0, index), ...reservedSources.map(portablePathKey)].some((other) =>
        pathsConflict(source, other),
      ),
    )
  ) {
    throw new Error(`${entry.id} contains unsafe or colliding generated package source paths.`);
  }
  const generatedTargets = (entry.resources ?? []).map((resource) => resource.path);
  const targetKeys = generatedTargets.map(portablePathKey);
  const reservedTargets = ["AGENTS.md", "SOUL.md"].map(portablePathKey);
  if (
    generatedTargets.some((target) => !isSafePackagePath(target)) ||
    targetKeys.some((target, index) =>
      [...targetKeys.slice(0, index), ...reservedTargets].some((other) =>
        pathsConflict(target, other),
      ),
    )
  ) {
    throw new Error(`${entry.id} contains unsafe or colliding generated workspace targets.`);
  }
}
const expectedIds = new Set(catalog.entries.map((entry) => entry.id));
const clawsRoot = join(root, "claws");
if (!check) {
  const resolvedRoot = resolve(root);
  const resolvedClawsRoot = resolve(clawsRoot);
  if (!resolvedClawsRoot.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Refusing to replace a generated path outside the repository: ${clawsRoot}`);
  }
  await rm(resolvedClawsRoot, { recursive: true, force: true });
}
await mkdir(clawsRoot, { recursive: true });
for (const entry of catalog.entries) {
  for (const [relativePath, content] of filesFor(entry)) {
    await ensureFile(join(clawsRoot, entry.id, relativePath), content);
  }
}

if (check) {
  const rootEntries = await readdir(clawsRoot, { withFileTypes: true });
  const actualIds = new Set(
    rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );
  const unexpected = rootEntries
    .filter((entry) => !entry.isDirectory() || !expectedIds.has(entry.name))
    .map((entry) => entry.name);
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  if (unexpected.length || missing.length) {
    throw new Error(
      `Catalog directories differ (unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}).`,
    );
  }
  for (const entry of catalog.entries) {
    const packageRoot = join(clawsRoot, entry.id);
    const expectedEntries = new Set([
      "directory:workspace",
      "file:CLAW.md",
      "file:README.md",
      "file:package.json",
      "file:screenshot.png",
      "file:workspace/AGENTS.md",
      ...(entry.resources ?? []).map((resource) => `file:${resource.source}`),
      ...(entry.bootstrap ? ["file:BOOTSTRAP.md"] : []),
      ...(entry.openclawProfile
        ? ["directory:profiles", "file:profiles/openclaw.yml"]
        : []),
    ]);
    for (const file of entry.resources ?? []) {
      const parts = file.source.split("/");
      for (let index = 1; index < parts.length; index += 1) {
        expectedEntries.add(`directory:${parts.slice(0, index).join("/")}`);
      }
    }
    const actualEntries = new Set(
      (await readdir(packageRoot, { recursive: true, withFileTypes: true })).map((item) => {
        const parent = item.parentPath
          .slice(packageRoot.length)
          .replaceAll("\\", "/")
          .replace(/^\//, "");
        const relativePath = parent ? `${parent}/${item.name}` : item.name;
        const kind = item.isDirectory() ? "directory" : item.isFile() ? "file" : "unsupported";
        return `${kind}:${relativePath}`;
      }),
    );
    const mismatches = [...new Set([...expectedEntries, ...actualEntries])].filter(
      (item) => expectedEntries.has(item) !== actualEntries.has(item),
    );
    if (mismatches.length) {
      throw new Error(`${entry.id} generated tree differs: ${mismatches.join(", ")}`);
    }
  }
}

console.log(`${check ? "Checked" : "Materialized"} ${catalog.entries.length} Claw packages.`);
