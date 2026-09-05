import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertAddPreview,
  assertInspectResult,
  assertPreviewEnvelope,
  createProofEnvironment,
  failureRecord,
  readCatalog,
  root,
} from "./openclaw-proof-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

test("the proof catalog covers every materialized Claw", async () => {
  const catalog = await readCatalog();
  assert.ok(catalog.entries.length > 0);
  assert.equal(
    new Set(catalog.entries.map((entry) => entry.id)).size,
    catalog.entries.length,
  );
});

test("Experience cases cover every Claw with enforceable surfaces", async () => {
  const catalog = await readCatalog();
  const cases = await readExperienceCases(catalog);
  assert.equal(cases.length, catalog.entries.length);
  for (const target of [3, 4, 5]) {
    assert.ok(cases.some((item) => item.target === target));
  }
  for (const item of cases.filter((experience) => experience.target >= 4)) {
    const instructions = await readFile(
      join(root, "claws", item.id, "workspace", "AGENTS.md"),
      "utf8",
    );
    for (const requiredInstruction of [
      item.asset,
      item.output,
      item.fallback,
      "show_widget",
    ]) {
      assert.match(instructions, new RegExp(requiredInstruction.replaceAll(".", "\\."), "u"));
    }
    assert.match(instructions, /never as current or live evidence/iu);
  }
});

test("add previews require a bounded, consent-addressable plan", () => {
  const plan = {
    schemaVersion: "openclaw.clawAddPlan.v1",
    dryRun: true,
    mutationAllowed: false,
    planIntegrity: "sha256:proof",
    summary: { blockedActions: 0 },
    blockers: [],
  };
  assert.equal(assertAddPreview({ harness: { outcome: plan } }), plan);
  assert.throws(
    () => assertAddPreview({ harness: { outcome: { ...plan, mutationAllowed: true } } }),
    /bounded non-mutating add plan/,
  );
});

test("blocked previews retain a bounded plan for failure classification", () => {
  const plan = {
    schemaVersion: "openclaw.clawAddPlan.v1",
    dryRun: true,
    mutationAllowed: false,
    planIntegrity: "sha256:proof",
    summary: { blockedActions: 1 },
    blockers: [{ code: "clawhub_security_unavailable" }],
  };
  assert.equal(assertPreviewEnvelope({ harness: { outcome: plan } }), plan);
  assert.throws(() => assertAddPreview(plan), /complete non-mutating add plan/);
});

test("inspect requires the complete public package contract", () => {
  const inspected = {
    schemaVersion: "openclaw.clawInspect.v1",
    stability: "experimental",
    valid: true,
    source: { kind: "package", version: "1.0.0" },
    manifest: { schemaVersion: 1, agent: { id: "customer-support" } },
  };
  assert.equal(assertInspectResult(inspected, "customer-support"), inspected);
  assert.throws(
    () =>
      assertInspectResult(
        { ...inspected, manifest: { schemaVersion: 1, agent: {} } },
        "customer-support",
      ),
    /complete package contract/u,
  );
  assert.throws(
    () => assertInspectResult(inspected, "different-id"),
    /complete package contract/u,
  );
});

test("failures retain a phase and concise message", () => {
  assert.deepEqual(failureRecord("status", new Error("drift")), {
    phase: "status",
    message: "drift",
  });
});

test("each proof environment isolates adapter snapshots", async () => {
  const testRoot = join(root, ".tmp");
  await mkdir(testRoot, { recursive: true });
  const proofRoot = await mkdtemp(join(testRoot, "proof-test-"));
  try {
    const first = await createProofEnvironment(proofRoot, "first");
    const second = await createProofEnvironment(proofRoot, "second");
    assert.equal(first.env.TMPDIR, first.temp);
    assert.equal(first.env.TMP, first.temp);
    assert.equal(first.env.TEMP, first.temp);
    assert.equal(first.env.HOME, first.home);
    assert.equal(first.env.USERPROFILE, first.home);
    assert.notEqual(first.temp, second.temp);
  } finally {
    await rm(proofRoot, { recursive: true, force: true });
  }
});
