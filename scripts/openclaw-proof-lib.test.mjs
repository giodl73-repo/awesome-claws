import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertAddPreview,
  assertPreviewEnvelope,
  createProofEnvironment,
  failureRecord,
  readCatalog,
  root,
} from "./openclaw-proof-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

test("the proof catalog covers all 51 materialized Claws", async () => {
  const catalog = await readCatalog();
  assert.equal(catalog.entries.length, 51);
  assert.equal(new Set(catalog.entries.map((entry) => entry.id)).size, 51);
});

test("Experience cases cover all 51 Claws with enforceable surfaces", async () => {
  const catalog = await readCatalog();
  const cases = await readExperienceCases(catalog);
  assert.equal(cases.length, 51);
  assert.equal(cases.filter((item) => item.target === 5).length, 7);
  assert.equal(cases.filter((item) => item.target === 4).length, 16);
  assert.equal(cases.filter((item) => item.target === 3).length, 28);
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
  const testRoot = join(root, ".tmp");
  await mkdir(testRoot, { recursive: true });
  const proofRoot = await mkdtemp(join(testRoot, "proof-test-"));
  try {
    const first = await createProofEnvironment(proofRoot, "first");
    const second = await createProofEnvironment(proofRoot, "second");
    assert.equal(first.env.TMPDIR, first.temp);
    assert.equal(first.env.TMP, first.temp);
    assert.equal(first.env.TEMP, first.temp);
    assert.notEqual(first.temp, second.temp);
  } finally {
    await rm(proofRoot, { recursive: true, force: true });
  }
});
