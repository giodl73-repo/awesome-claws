import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildCompatibilityReport } from "./compatibility-canary.mjs";
import { writePortfolioSummary } from "./portfolio-summary-file.mjs";

test("timeout preserves completed results without qualifying partial coverage", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "portfolio-checkpoint-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const passed = { id: "one", status: "lifecycle-passed", applicationScenario: { status: "runtime-wiring-passed" } };
  const failed = { id: "two", status: "lifecycle-failed", applicationScenario: { status: "not-run" } };
  const checkpoint = { revisions: { openClaw: "exact-revision" }, results: [passed, failed] };
  await writePortfolioSummary(root, { ...checkpoint, results: [passed] });
  await writePortfolioSummary(root, checkpoint);
  // Simulate interruption of the next write before publication.
  await writeFile(join(root, "summary.json.tmp"), '{"results":');
  const saved = JSON.parse(await readFile(join(root, "summary.json"), "utf8"));
  assert.deepEqual(saved, checkpoint);
  assert.equal(saved.disposableRuntimeRemoved, undefined);
  const catalog = { entries: ["one", "two", "three"].map((id) => ({ id, name: id })) };
  const report = buildCompatibilityReport({ catalog, portfolioSummary: saved, execution: { status: null, signal: "SIGTERM", error: "ETIMEDOUT" } });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.counts, { total: 3, compatible: 1, incompatible: 1, notRun: 1 });
  assert.deepEqual(report.revisions, checkpoint.revisions);
  const final = { ...checkpoint, disposableRuntimeRemoved: true };
  await writePortfolioSummary(root, final);
  assert.deepEqual(JSON.parse(await readFile(join(root, "summary.json"), "utf8")), final);
});

test("timeout cannot qualify even a checkpoint containing every passing result", () => {
  const report = buildCompatibilityReport({
    catalog: { entries: [{ id: "one", name: "one" }] },
    portfolioSummary: { results: [{ id: "one", status: "lifecycle-passed", applicationScenario: { status: "runtime-wiring-passed" } }] },
    execution: { status: null, signal: "SIGTERM", error: "ETIMEDOUT" },
  });
  assert.equal(report.counts.compatible, 1);
  assert.equal(report.status, "failed");
});
