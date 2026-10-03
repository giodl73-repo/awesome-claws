import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { acceptance } from "../candidates/implementation-delivery/acceptance.mjs";
import { compose, digest, handoff, json, owners, validateOwners } from "../candidates/implementation-delivery/composition.mjs";

const prefix = "candidates/implementation-delivery/";
const intake = await json(`${prefix}intake.json`);
const artifacts = Object.fromEntries(await Promise.all(Object.keys(owners).map(async (k) => [k, await json(`${prefix}artifacts/${k}.json`)])));
const receipt = await json(`${prefix}receipt.json`);
const expected = await json(`${prefix}result.json`);
const adapter = (await readFile(new URL(`../${prefix}adapter.mjs`, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const adapterDigest = createHash("sha256").update(adapter).digest("hex");
const clone = () => structuredClone({ intake, artifacts, receipt });
const run = (x) => compose(x.intake, x.artifacts, x.receipt, adapterDigest);
function rebindForNegativeTest(x) {
  x.receipt.intakeDigest = digest(x.intake);
  x.receipt.ownerDigests = Object.fromEntries(Object.entries(x.artifacts).map(([k, v]) => [k, digest(v)]));
}

test("five actual owner artifacts validate and compose to a draft, never deployment authority", () => {
  assert.deepEqual(validateOwners(artifacts), []);
  assert.deepEqual(run(clone()), expected);
  assert.equal(expected.state, "draft-for-owner-review");
  assert.equal(expected.deployment, "not-authorized");
  assert.equal(expected.support, "acceptance-pending");
  assert.ok(artifacts.project.milestones.every((m) => m.state === "accepted"));
  assert.equal(artifacts.project.statusState, "blocked");
});

test("real local mapping and restoration assertions reproduce independently of supplied QA rows", () => {
  assert.deepEqual(acceptance(intake), receipt.acceptance);
  assert.equal(adapterDigest, receipt.adapterSourceDigest);
  assert.equal(receipt.baselineFailed, true);
  assert.equal(receipt.revisionKind, "isolated-fixture-git-commit");
  assert.notEqual(receipt.baseRevision, receipt.adapterRevision);
  assert.equal(artifacts.maintainer.repository.baseRevision, receipt.baseRevision);
  assert.equal(artifacts.maintainer.repository.headRevision, receipt.adapterRevision);
});

test("handoff preserves the exact owner identities, ordered plan and unaccepted support state", async () => {
  const markdown = (await readFile(new URL(`../${prefix}handoff.md`, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  assert.equal(markdown, handoff(intake, expected, receipt));
  assert.match(markdown, /Any unmapped identity\/status/);
  assert.match(markdown, /acceptance pending, no acknowledgement supplied/);
});

for (const key of Object.keys(owners)) test(`changed ${key} output invalidates the saved receipt`, () => {
  const x = clone();
  x.artifacts[key].owner = "Different supplied owner";
  assert.equal(run(x).state, "blocked");
});

for (const [label, mutate] of [
  ["identity table entry", (x) => { delete x.intake.mappings.users["u-02"]; }],
  ["status mapping", (x) => { x.intake.mappings.statuses.WAITING = "closed"; }],
  ["source snapshot", (x) => { x.intake.sourceSnapshot = "desk-source-r2"; }],
  ["cutover order", (x) => { x.intake.cutover.steps.reverse(); }],
  ["rollback trigger", (x) => { x.intake.cutover.rollback.trigger = ""; }],
  ["invented support acknowledgement", (x) => { x.intake.support.state = "accepted"; }],
]) test(`changed ${label} requires refreshed evidence`, () => {
  const x = clone();
  mutate(x);
  assert.equal(run(x).state, "blocked");
});

test("changed adapter cannot reuse old passing QA and integration results", () => {
  assert.equal(compose(intake, artifacts, receipt, "changed-source-digest").state, "blocked");
});

// Rebinding the receipt in these adversarial cases deliberately removes the
// simple digest guard so the real owner and cross-owner checks are exercised.
for (const [label, mutate, expectedGap] of [
  ["missing identity mapping despite accepted milestones", (x) => { x.artifacts.migration.mappings.shift(); }, /migration: missing_mapping/],
  ["required-field deletion bypass", (x) => { x.artifacts.migration.requiredFields.shift(); x.artifacts.migration.mappings.shift(); }, /Missing required mapping: userId/],
  ["missing lookup row", (x) => { delete x.artifacts.migration.mappings[0].lookup["u-02"]; }, /Mapping values differ/],
  ["wrong lookup target", (x) => { x.artifacts.migration.mappings[1].lookup.WAITING = "closed"; }, /Mapping values differ/],
  ["cross-owner repository", (x) => { x.artifacts.integration.integration.repository = "example/other"; }, /Repository identity/],
  ["cross-owner source snapshot", (x) => { x.intake.sourceSnapshot = "desk-source-r2"; }, /Source\/target identities/],
  ["cross-owner target system", (x) => { x.artifacts.migration.systems.target.id = "other-desk"; }, /Source\/target identities/],
  ["cross-owner source version", (x) => { x.artifacts.migration.sourceVersion = "legacy-desk@9"; }, /Source\/target identities/],
  ["missing project criterion", (x) => { x.artifacts.project.scope.acceptanceCriteria.pop(); }, /Project requirement coverage/],
  ["missing QA requirement", (x) => { x.artifacts.qa.requirements.pop(); }, /qa:/],
  ["stale QA build", (x) => { x.artifacts.qa.release.buildId = "new-build"; }, /qa:/],
  ["stale adapter result", (x) => { x.artifacts.integration.integration.targetCommit = "a".repeat(40); }, /integration:/],
  ["stale maintainer check", (x) => { x.artifacts.maintainer.verifications[0].revision = x.artifacts.maintainer.repository.baseRevision; }, /maintainer:/],
  ["cross-owner environment", (x) => { x.intake.environment = "production"; }, /Owner environments/],
  ["local acceptance missing", (x) => { x.receipt.acceptance.pop(); }, /Local acceptance missing/],
  ["local acceptance failed", (x) => { x.receipt.acceptance[0].result = "failed"; }, /Local acceptance missing/],
  ["rollback proof removed", (x) => { x.artifacts.migration.rollback.verified = false; }, /migration: missing_rollback/],
  ["rollback trigger lost", (x) => { x.intake.cutover.rollback.trigger = ""; }, /Rollback conditions/],
  ["rollback step lost", (x) => { x.intake.cutover.rollback.steps.pop(); }, /Rollback conditions/],
  ["invented production drill", (x) => { x.intake.cutover.rollback.productionProof = "passed"; }, /Rollback conditions/],
  ["out-of-order cutover", (x) => { x.intake.cutover.steps.reverse(); }, /Ordered, permission-gated/],
  ["executed cutover claim", (x) => { x.intake.cutover.state = "executed"; }, /Ordered, permission-gated/],
  ["support acceptance claim", (x) => { x.intake.support.state = "accepted"; x.intake.support.acceptanceEvidence = "invented"; }, /Support handoff/],
  ["missing support owner", (x) => { x.intake.support.owner = ""; }, /Support handoff/],
  ["missing support escalation", (x) => { x.intake.support.escalation = ""; }, /Support handoff/],
  ["self-approved migration", (x) => { x.artifacts.migration.cutoverApproval = { state: "accepted", approverId: x.artifacts.migration.ownerId, approvedAt: "2026-09-06T00:00:00Z" }; }, /migration:/],
  ["removed QA authority gate", (x) => { x.artifacts.qa.handoff.prohibitedActions.pop(); }, /qa:/],
]) test(`composition fails closed for ${label}`, () => {
  const x = clone();
  mutate(x);
  rebindForNegativeTest(x);
  const result = run(x);
  assert.equal(result.state, "blocked");
  assert.ok(result.gaps.some((g) => expectedGap.test(g)), JSON.stringify(result.gaps));
});

for (const key of Object.keys(owners)) test(`missing ${key} owner is blocked rather than replaced by a summary`, () => {
  const x = clone();
  delete x.artifacts[key];
  assert.equal(run(x).state, "blocked");
});
