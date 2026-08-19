import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { capabilityClassesForEntry } from "./capability-classes.mjs";

export function selectClaws(entries, selectors) {
  if (!Array.isArray(selectors) || selectors.length === 0) {
    throw new Error("Provide a Claw id or filter. Use --all to select the complete catalog.");
  }
  if (selectors.includes("*")) {
    return [...entries];
  }
  const selected = new Set();
  for (const selector of selectors.flatMap((value) => value.split(",")).filter(Boolean)) {
    const exact = entries.find((entry) => entry.id === selector);
    const matches = exact
      ? [exact]
      : entries.filter(
          (entry) =>
            entry.id.includes(selector.toLowerCase()) ||
            entry.name.toLowerCase().includes(selector.toLowerCase()),
        );
    if (matches.length === 0) {
      throw new Error(`No Claw matches ${JSON.stringify(selector)}.`);
    }
    for (const entry of matches) {
      selected.add(entry.id);
    }
  }
  return entries.filter((entry) => selected.has(entry.id));
}

export function proofPlanFor(entry, experience) {
  const dependencyLive =
    (entry.packages?.length ?? 0) > 0 ||
    (entry.openclawProfile?.extensions?.length ?? 0) > 0 ||
    Object.keys(entry.mcpServers ?? {}).length > 0;
  return {
    id: entry.id,
    experienceTier: `X${experience.target}`,
    capabilityClasses: capabilityClassesForEntry(entry, experience),
    lanes: {
      static: { applicable: true, default: true },
      regression: { applicable: true, default: true },
      installed: { applicable: true, default: false },
      visual: { applicable: experience.target >= 4, default: false },
      dependencyLive: { applicable: dependencyLive, default: false },
      providerLive: {
        applicable: false,
        default: false,
        reason: "No provider-live lane is declared by this repository.",
      },
    },
  };
}

export function parseClawCommandArgs(argv) {
  const flags = new Set(argv.filter((value) => value.startsWith("--")));
  const unknownFlags = [...flags].filter(
    (flag) => !["--all", "--installed", "--live", "--visual"].includes(flag),
  );
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown option(s): ${unknownFlags.join(", ")}`);
  }
  return {
    selectors: flags.has("--all")
      ? ["*"]
      : argv.filter((value) => !value.startsWith("--")),
    installed: flags.has("--installed"),
    live: flags.has("--live"),
    visual: flags.has("--visual"),
  };
}

export function inapplicableRequestedLanes(entries, options) {
  return [
    ...(options.visual &&
    !entries.some((entry) => entry.plan.lanes.visual.applicable)
      ? [
          {
            name: "visual",
            message: "--visual was requested, but no selected Claw has an applicable visual lane.",
          },
        ]
      : []),
    ...(options.live &&
    !entries.some((entry) => entry.plan.lanes.dependencyLive.applicable)
      ? [
          {
            name: "dependency-live",
            message:
              "--live was requested, but no selected Claw declares a dependency-live lane.",
          },
        ]
      : []),
  ];
}

export async function runLoggedCommand({
  name,
  command,
  args,
  cwd,
  env,
  logRoot,
  timeout = 30 * 60 * 1000,
}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  await mkdir(logRoot, { recursive: true });
  await Promise.all([
    writeFile(join(logRoot, `${name}.stdout.log`), result.stdout ?? "", "utf8"),
    writeFile(join(logRoot, `${name}.stderr.log`), result.stderr ?? "", "utf8"),
  ]);
  return {
    name,
    status: result.status === 0 && !result.error ? "passed" : "failed",
    exitCode: result.status,
    signal: result.signal ?? null,
    ...(result.error ? { error: result.error.message } : {}),
    logs: {
      stdout: `${name}.stdout.log`,
      stderr: `${name}.stderr.log`,
    },
  };
}

export function renderClawWorkflowSummary(summary) {
  const rows = summary.entries
    .map((entry) => {
      const enabled = Object.entries(entry.plan.lanes)
        .filter(([, lane]) => lane.applicable)
        .map(([name]) => name)
        .join(", ");
      return `| \`${entry.id}\` | ${entry.plan.experienceTier} | ${enabled} |`;
    })
    .join("\n");
  const runs = summary.runs
    .map(
      (run) =>
        `- ${run.status === "passed" ? "PASS" : "FAIL"} \`${run.name}\`${run.entryId ? ` (\`${run.entryId}\`)` : ""}`,
    )
    .join("\n");
  return `# Claw ${summary.mode} summary

**Status:** ${summary.status}
**Run:** \`${summary.runId}\`

| Claw | Experience | Applicable lanes |
| --- | --- | --- |
${rows}

## Executed

${runs || "- No commands executed."}

Static and deterministic lanes do not establish provider-live behavior.
\`--live\` checks declared external dependency endpoints and registries only.
`;
}

export async function writeClawWorkflowArtifacts(summary, runRoot) {
  await Promise.all([
    writeFile(join(runRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(join(runRoot, "summary.md"), renderClawWorkflowSummary(summary), "utf8"),
    ...summary.entries.flatMap((entry) => {
      const entryRoot = join(runRoot, entry.id);
      const entrySummary = {
        ...summary,
        entries: [entry],
        runs: summary.runs.filter((run) => !run.entryId || run.entryId === entry.id),
      };
      return [
        mkdir(entryRoot, { recursive: true }).then(() =>
          writeFile(
            join(entryRoot, "summary.json"),
            `${JSON.stringify(entrySummary, null, 2)}\n`,
            "utf8",
          ),
        ),
        mkdir(entryRoot, { recursive: true }).then(() =>
          writeFile(
            join(entryRoot, "summary.md"),
            renderClawWorkflowSummary(entrySummary),
            "utf8",
          ),
        ),
      ];
    }),
  ]);
}
