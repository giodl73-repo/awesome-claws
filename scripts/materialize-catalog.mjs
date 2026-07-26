import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const check = process.argv.includes("--check");

function bullets(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function numbered(values) {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function filesFor(entry) {
  const claw = `---
schemaVersion: 1
agent:
  id: ${entry.id}
  name: ${JSON.stringify(entry.name)}
  description: ${JSON.stringify(entry.description)}
workspace:
  bootstrapFiles:
    AGENTS.md:
      source: workspace/AGENTS.md
    SOUL.md:
      source: workspace/SOUL.md
  files: []
packages: []
mcpServers: {}
cronJobs: []
---
`;
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
  const agents = `# Operating workflow

## Start here

Ask for or confirm:

${bullets(entry.intake)}

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
      name: `@awesome-claws-private/${entry.id}`,
      version: "0.1.0",
      private: true,
      type: "module",
      openclaw: { claw: "CLAW.md" },
    },
    null,
    2,
  )}\n`;
  return new Map([
    ["CLAW.md", claw],
    ["package.json", packageJson],
    ["workspace/AGENTS.md", agents],
    ["workspace/SOUL.md", soul],
  ]);
}

async function ensureFile(path, expected) {
  if (check) {
    const file = await lstat(path).catch(() => undefined);
    if (!file?.isFile()) {
      throw new Error(`Generated catalog path is not a regular file: ${path}`);
    }
    const actual = await readFile(path, "utf8").catch(() => undefined);
    if (actual !== expected) {
      throw new Error(`Generated catalog file is stale or missing: ${path}`);
    }
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, expected, "utf8");
}

for (const entry of catalog.entries) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(entry.id)) {
    throw new Error(`Catalog id is not a safe portable agent id: ${JSON.stringify(entry.id)}`);
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
      "file:package.json",
      "file:workspace/AGENTS.md",
      "file:workspace/SOUL.md",
    ]);
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
