import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readCatalog, root } from "./catalog-source.mjs";
import {
  buildCompatibilityReport,
  renderCompatibilityReport,
} from "./compatibility-canary.mjs";

const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const evidenceRoot = resolve(
  process.env.COMPATIBILITY_CANARY_DIR ?? join(root, ".tmp", "compatibility-canary"),
);
const runRoot = join(evidenceRoot, "runs", runId);
const portfolioRoot = join(runRoot, "portfolio");
await mkdir(portfolioRoot, { recursive: true });

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", join(root, "scripts", "prove-portfolio.mjs")],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PORTFOLIO_PROOF_DIR: portfolioRoot,
    },
    timeout: 150 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  },
);
await Promise.all([
  writeFile(join(runRoot, "portfolio.stdout.log"), result.stdout ?? "", "utf8"),
  writeFile(join(runRoot, "portfolio.stderr.log"), result.stderr ?? "", "utf8"),
]);
process.stderr.write(result.stderr ?? "");

let portfolioSummary;
try {
  portfolioSummary = JSON.parse(await readFile(join(portfolioRoot, "summary.json"), "utf8"));
} catch (error) {
  if (result.status === 0 && !result.error) {
    throw new Error(`Compatibility proof did not produce a valid summary: ${error.message}`, {
      cause: error,
    });
  }
}

const report = buildCompatibilityReport({
  catalog: await readCatalog({ loadResources: false }),
  portfolioSummary,
  execution: {
    status: result.status,
    signal: result.signal,
    ...(result.error ? { error: result.error.message } : {}),
  },
});
const markdown = renderCompatibilityReport(report);
await Promise.all([
  writeFile(join(runRoot, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(join(runRoot, "summary.md"), markdown, "utf8"),
  writeFile(join(evidenceRoot, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(join(evidenceRoot, "summary.md"), markdown, "utf8"),
]);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") {
  process.exitCode = 1;
}
