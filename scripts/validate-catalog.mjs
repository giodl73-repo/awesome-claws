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

if (!Array.isArray(catalog.entries) || catalog.entries.length < 12) {
  throw new Error("The private catalog must contain at least 12 substantive starters.");
}

const ids = new Set();
const names = new Set();
for (const entry of catalog.entries) {
  if (ids.has(entry.id) || names.has(entry.name)) {
    throw new Error(`Duplicate catalog identity: ${entry.id}`);
  }
  ids.add(entry.id);
  names.add(entry.name);

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

