import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const useReferenceCli = process.argv.includes("--reference");
const cliEntry = useReferenceCli
  ? resolve(
      process.env.CLAWS_CLI_ENTRY ??
        join(root, "..", "standalone-claw-cli-prototype", "packages", "cli", "dist", "cli.mjs"),
    )
  : undefined;
const expectedFiles = ["CLAW.md", "README.md", "package.json", "workspace/AGENTS.md"];
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
    throw new Error(`${entry.id} must remain non-publishable and exactly versioned.`);
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
  const workspaceTargets = [
    ...Object.keys(manifest?.workspace?.bootstrapFiles ?? {}),
    ...(manifest?.workspace?.files ?? []).map((file) => file.path),
  ].map((path) => {
    if (typeof path !== "string") {
      throw new Error(`${entry.id}/CLAW.md workspace targets must be strings.`);
    }
    const normalized = path.replaceAll("\\", "/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`${entry.id}/CLAW.md workspace targets must be safe relative paths.`);
    }
    return normalized.normalize("NFC").toLowerCase();
  });
  if (
    workspaceTargets.some(
      (path) =>
        path === "soul.md" || path.startsWith("soul.md/") || "soul.md".startsWith(`${path}/`),
    )
  ) {
    throw new Error(`${entry.id}/CLAW.md must not declare a workspace target conflicting with SOUL.md.`);
  }

  for (const relativePath of expectedFiles) {
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

console.log(
  `Validated ${catalog.entries.length} Claws${useReferenceCli ? " with the standalone reference CLI" : ""}.`,
);
