import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertAddPreview,
  assertPreviewEnvelope,
  createProofEnvironment,
  failureRecord,
  readCatalog,
} from "./openclaw-proof-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

test("the proof catalog covers all 50 materialized Claws", async () => {
  const catalog = await readCatalog();
  assert.equal(catalog.entries.length, 50);
  assert.equal(new Set(catalog.entries.map((entry) => entry.id)).size, 50);
});

test("Experience cases cover all 50 Claws with enforceable surfaces", async () => {
  const catalog = await readCatalog();
  const cases = await readExperienceCases(catalog);
  assert.equal(cases.length, 50);
  assert.equal(cases.filter((item) => item.target === 5).length, 7);
  assert.equal(cases.filter((item) => item.target === 4).length, 8);
  assert.equal(cases.filter((item) => item.target === 3).length, 35);
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

test("failures retain a phase and concise message", () => {
  assert.deepEqual(failureRecord("status", new Error("drift")), {
    phase: "status",
    message: "drift",
  });
});

test("each proof environment isolates adapter snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "awesome-claws-proof-test-"));
  try {
    const first = await createProofEnvironment(root, "first");
    const second = await createProofEnvironment(root, "second");
    assert.equal(first.env.TMPDIR, first.temp);
    assert.equal(first.env.TMP, first.temp);
    assert.equal(first.env.TEMP, first.temp);
    assert.notEqual(first.temp, second.temp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
