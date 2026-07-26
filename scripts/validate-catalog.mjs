import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const cliEntry = resolve(
  process.env.CLAWS_CLI_ENTRY ??
    join(root, "..", "standalone-claw-cli-prototype", "packages", "cli", "dist", "cli.mjs"),
);
const expectedFiles = ["CLAW.md", "package.json", "workspace/AGENTS.md", "workspace/SOUL.md"];
const expectedStarterIds = [
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

if (!Array.isArray(catalog.entries)) {
  throw new Error("The private catalog must contain an entries array.");
}
const catalogIds = catalog.entries.map((entry) => entry.id).sort();
if (JSON.stringify(catalogIds) !== JSON.stringify(expectedStarterIds)) {
  throw new Error("The private catalog must contain the exact 15 reviewed starter identities.");
}

const ids = new Set();
const names = new Set();
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

  const packageRoot = join(root, "claws", entry.id);
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
    throw new Error(`${entry.id} must remain private and exactly versioned during incubation.`);
  }

  for (const relativePath of expectedFiles) {
    const content = await readFile(join(packageRoot, relativePath), "utf8");
    if (/(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,})/.test(content)) {
      throw new Error(`${entry.id}/${relativePath} contains secret-like material.`);
    }
  }

  const inspected = spawnSync(process.execPath, [cliEntry, "inspect", packageRoot, "--json"], {
    encoding: "utf8",
    env: { ...process.env, OPENCLAW_EXPERIMENTAL_CLAWS: "1" },
  });
  if (inspected.status !== 0) {
    throw new Error(`${entry.id} failed reference inspection:\n${inspected.stderr || inspected.stdout}`);
  }
  const outcome = JSON.parse(inspected.stdout);
  if (outcome.ok !== true || outcome.claw?.agent?.id !== entry.id) {
    throw new Error(`${entry.id} returned an inconsistent inspection result.`);
  }
}

console.log(`Validated ${catalog.entries.length} Claws with the standalone reference CLI.`);
