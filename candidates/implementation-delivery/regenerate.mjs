import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compose, digest, handoff, json, owners, root, validateOwners } from "./composition.mjs";

const here = new URL("./", import.meta.url);
const intake = await json("candidates/implementation-delivery/intake.json");
const code = (await readFile(new URL("adapter.mjs", here), "utf8")).replaceAll("\r\n", "\n");
const adapterSourceDigest = createHash("sha256").update(code).digest("hex");
// The maintainer contract requires real Git ancestry and a local commit.
// Build an isolated reproducible two-commit repository, never the user's tree.
await mkdir(new URL(".tmp/", root), { recursive: true });
const repo = await mkdtemp(fileURLToPath(new URL(".tmp/delivery-fixture-", root)));
const env = { ...process.env, GIT_AUTHOR_NAME: "Synthetic Example", GIT_AUTHOR_EMAIL: "example@example.invalid", GIT_COMMITTER_NAME: "Synthetic Example", GIT_COMMITTER_EMAIL: "example@example.invalid", GIT_AUTHOR_DATE: "2026-10-02T12:00:00Z", GIT_COMMITTER_DATE: "2026-10-02T12:00:00Z" };
const git = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=NUL", ...args], { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
git("init", "--initial-branch=example/service-desk");
for (const name of ["acceptance.mjs", "intake.json", "run.mjs"]) await writeFile(`${repo}/${name}`, (await readFile(new URL(name, here), "utf8")).replaceAll("\r\n", "\n"));
await writeFile(`${repo}/adapter.mjs`, (await readFile(new URL("baseline-adapter.mjs", here), "utf8")).replaceAll("\r\n", "\n"));
git("add", ".");
git("commit", "-m", "Synthetic incomplete baseline");
const baseRevision = git("rev-parse", "HEAD");
let baselineFailed = false;
try { execFileSync(process.execPath, ["run.mjs"], { cwd: repo, stdio: "pipe" }); } catch (error) { baselineFailed = error.status === 1; }
assert.equal(baselineFailed, true, "Baseline must fail the actual acceptance assertions.");
await writeFile(`${repo}/adapter.mjs`, code);
git("add", "adapter.mjs");
git("commit", "-m", "Implement bounded service-desk mapping and isolated restore");
const revision = git("rev-parse", "HEAD");
git("merge-base", "--is-ancestor", baseRevision, revision);
const startedAt = new Date().toISOString();
const results = JSON.parse(execFileSync(process.execPath, ["run.mjs"], { cwd: repo, encoding: "utf8" }));
const finishedAt = new Date().toISOString();
const artifacts = {};
for (const [key, [id, stem]] of Object.entries(owners)) {
  artifacts[key] = await json(`sources/${id}/fixtures/${stem}.example.json`);
}

const p = artifacts.project;
p.project = intake.project;
p.sponsor = "Neil Prakash";
p.outcome = "Review a synthetic service-desk handover; no production operation authorized.";
p.targetDate = "2026-10-09";
p.scope = { in: ["Local adapter", "Mapping", "Acceptance tests", "Cutover and support drafts"], out: ["Production execution", "Support acceptance"], acceptanceCriteria: intake.requirements.map((r) => `${r.id}: ${r.description}`) };
p.milestones = intake.requirements.map((r, i) => ({ id: `M${i + 1}`, name: r.id, owner: "Dana Ruiz", dueDate: "2026-10-02", state: "accepted", dependencies: i ? [`M${i}`] : [], evidenceRefs: [`artifacts/qa.json#${r.id}`] }));
p.risks = [{ risk: "Local tests do not exercise live recovery or permissions", likelihood: "medium", impact: "high", owner: "Neil Prakash", trigger: "Any failed acceptance test or source drift", response: "Stop; obtain scoped evidence and owner review" }];
p.decisions = [{ decision: "Authorize cutover and obtain support acceptance", owner: "Neil Prakash", state: "needed", rationale: "Local evidence is not live authorization", downstreamImpact: "No production transition yet" }];
p.statusState = "blocked";

// Adapt the existing enriched API contract using structured traversal. These
// rows are illustrative supplied evidence, not a claim that HTTP tests ran.
function replaceValues(value, replacements) {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceValues(v, replacements));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceValues(v, replacements)]));
  return value;
}
let a = artifacts.integration;
const replacements = new Map([
  [a.integration.targetCommit, revision], [a.integration.repository, intake.repository],
  [a.integration.id, "integration-service-desk-read"], [a.integration.snapshotRef, intake.sourceSnapshot],
  [a.integration.contractVersion, intake.targetVersion], [a.integration.specVersion, "synthetic-service-desk-v2"],
  ["/items", "/tickets"], ["listItems", "listTickets"],
]);
for (const row of a.evidence) replacements.set(row.sourceRef, `controlled://synthetic-supplied/service-desk/${row.id}`);
a = artifacts.integration = replaceValues(a, replacements);
a.limitations = ["Illustrative supplied contract/auth/rate-limit/idempotency/error evidence only; no HTTP server or live integration was exercised. Local mapping assertions are separate in receipt.json."];
a.incompatibilities = [];
a.evidence = a.evidence.filter((e) => e.kind !== "incompatibility-resolution");
a.readiness.rollout.plan = "Operator reviews the ordered intake.json cutover draft; no deployment permission is conferred.";
a.readiness.rollback.plan = intake.cutover.rollback.steps.join(" ");
a.handoff.summary = "Synthetic supplied contract evidence for owner review only; no live integration or deployment proof.";
a.recommendation.rationale = "Illustrative contract rows are internally bound to the synthetic target. Local assertions cover mapping and in-memory restoration only.";

const m = artifacts.migration;
m.sourceVersion = intake.sourceVersion;
m.targetVersion = intake.targetVersion;
m.systems.source = { id: intake.sourceSystem, name: "Legacy service desk", snapshotId: intake.sourceSnapshot, asOf: "2026-08-30" };
m.systems.target = { id: intake.targetSystem, name: "New service desk", snapshotId: intake.targetSnapshot, asOf: "2026-08-30" };
m.requiredFields = ["userId", "status"];
m.mappings = [
  { id: "map-user-id", sourceField: "userId", targetField: "assigneeId", transform: "lookup; unknown or blank blocks", required: true, lookup: intake.mappings.users },
  { id: "map-status", sourceField: "status", targetField: "state", transform: "lookup; unknown blocks", required: true, lookup: intake.mappings.statuses },
];
m.reconciliation = [{ id: "batch-rehearsal-1", kind: "rehearsal", sourceCount: 3, migratedCount: 3, rejectedCount: 0, heldCount: 0, sourceChecksum: "synthetic-ticket-count-3", targetChecksum: "synthetic-ticket-count-3", evidenceRef: "evidence-rehearsal-1" }];
m.evidence = m.evidence.filter((e) => e.id !== "evidence-rehearsal-2").map((e) => ({ ...e, batchRef: "batch-rehearsal-1", sourceSnapshotId: intake.sourceSnapshot, targetSnapshotId: intake.targetSnapshot, sourceRef: `controlled://synthetic-supplied/service-desk/${e.id}` }));
m.exceptions = [];
m.dataQualityFindings = [];
m.rollback.plan = "Synthetic supplied in-memory snapshot restoration only; production recovery remains unverified. " + intake.cutover.rollback.steps.join(" ");
m.cutoverApproval = { state: "pending" };
m.handoff.state = "blocked";
m.handoff.summary = "Synthetic supplied mapping/rehearsal record; independent cutover permission is pending. No live-system operation occurred.";

const q = artifacts.qa;
q.release = { id: "release-service-desk-example", buildId: revision, environment: intake.environment, scope: intake.project, requestedAt: "2026-08-28T00:00:00Z" };
q.requirements = intake.requirements.map((r) => ({ ...r, priority: "critical" }));
q.testCases = intake.requirements.map((r) => ({ id: `tc-${r.id}`, requirementRef: r.id, description: `${r.description} See acceptance.mjs.` }));
q.testRuns = intake.requirements.map((r) => ({ id: `run-${r.id}`, testCaseRef: `tc-${r.id}`, buildId: revision, environment: intake.environment, executedAt: "2026-09-05T10:00:00Z", executedById: "principal-qa-engineer-alex", result: "passed", evidenceRef: `evidence-${r.id}` }));
q.evidence = intake.requirements.map((r) => ({ id: `evidence-${r.id}`, kind: "execution-result", testRunRef: `run-${r.id}`, buildId: revision, outcome: "passed", sourceRef: `controlled://synthetic-supplied/service-desk/${r.id}`, assertedAt: "2026-09-05T10:05:00Z" }));
q.defects = [];
q.limitations = ["Illustrative supplied QA owner rows, not historical real execution. Actual current local assertions are recorded in receipt.json. No live service, load, permissions or production rollback proof."];
q.recommendation = { state: "recommend-release", rationale: "Synthetic local-example coverage only; this is not a production release recommendation.", reviewerId: "principal-qa-lead-morgan", reviewedAt: "2026-09-05T11:00:00Z" };
q.handoff.summary = "Illustrative QA recommendation is limited to the synthetic local example. No release approval or production action occurred.";

const s = artifacts.maintainer;
s.request = { ...s.request, id: "request-service-desk-example", runId: "run-service-desk-example", statement: "Implement and test the bounded in-memory service-desk mapping example; no production authority.", receivedAt: startedAt, asOf: finishedAt, state: "draft" };
s.repository = { identity: intake.repository, worktreePath: "synthetic-service-desk-repo", targetBranch: "example/service-desk", baseRevision, headRevision: revision, baseIsAncestorOfHead: true, dirtyStateAtStart: { state: "clean", entries: [] } };
s.scope = { authorizedPaths: ["adapter.mjs"], protectedPaths: ["production"], authorizationSourceRef: "source-owner-delivery-authority", publicBehaviorChangeAuthorized: false, dependencyChangeAuthorized: false };
s.sources = [
  { id: "source-owner-delivery-authority", kind: "owner-instruction", label: "Synthetic example scope: local-only mapping implementation; no external delivery", path: null, reference: null, revision: null, capturedAt: startedAt, provenance: "user-supplied", integrity: "verified" },
  { id: "source-adapter", kind: "repository-file", label: "adapter.mjs in the actual isolated fixture repository at head", path: "adapter.mjs", reference: null, revision, capturedAt: startedAt, provenance: "workspace-read", integrity: "verified" },
  { id: "source-local-test-output", kind: "test-output", label: "Actual node run.mjs assertions in the isolated fixture repository; see receipt.json", path: null, reference: null, revision: null, capturedAt: finishedAt, provenance: "command-output", integrity: "verified" },
];
s.acceptanceCriteria = intake.requirements.map((r) => ({ id: r.id.replace("req-", "criterion-"), statement: r.description, kind: "feature-behavior", origin: "stated-by-requester", state: "met", changeRefs: ["change-adapter"], verificationRefs: ["verification-local-acceptance"], notMetReason: null }));
s.changes = [{ id: "change-adapter", path: "adapter.mjs", previousPath: null, changeKind: "modified", rationale: "Implement pure mapping with missing-value rejection and independent snapshot restoration; actual diff saved as adapter.patch.", criterionRefs: s.acceptanceCriteria.map((c) => c.id), sourceRefs: ["source-adapter"], linesAdded: Number(git("diff", "--numstat", baseRevision, revision).split(/\s+/)[0]), linesRemoved: Number(git("diff", "--numstat", baseRevision, revision).split(/\s+/)[1]), publicBehaviorChange: false }];
s.verifications = [{ id: "verification-local-acceptance", command: "node run.mjs", kind: "focused-test", scope: "changed-behavior", baselineResult: "failed-before-change", revision, startedAt, finishedAt, result: "passed", criterionRefs: s.acceptanceCriteria.map((c) => c.id), evidenceSourceRef: "source-local-test-output", failureSummary: null }];
s.reviews = [];
s.findings = [];
s.risks = [];
s.delivery = { ...s.delivery, authority: "local-only", performed: "local-commit" };
s.handoff = { ...s.handoff, state: "draft", residualRiskSummary: "Actual isolated fixture commit and local tests only; no complete repository or human review, live-system verification or external delivery claimed.", criterionRefs: s.acceptanceCriteria.map((c) => c.id), changeRefs: ["change-adapter"], verificationRefs: ["verification-local-acceptance"], reviewRefs: [], findingRefs: [], riskRefs: [], blockingRefs: [] };

const receipt = { evidenceKind: "actual-local-assertions-plus-illustrative-owner-fixtures", startedAt, finishedAt, baseRevision, adapterRevision: revision, adapterSourceDigest, baselineFailed, revisionKind: "isolated-fixture-git-commit", intakeDigest: digest(intake), ownerDigests: Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, digest(value)])), acceptance: results };
assert.deepEqual(validateOwners(artifacts), []);
const result = compose(intake, artifacts, receipt, adapterSourceDigest);
assert.deepEqual(result.gaps, []);
await mkdir(new URL("artifacts/", here), { recursive: true });
for (const [key, value] of Object.entries(artifacts)) await writeFile(new URL(`artifacts/${key}.json`, here), JSON.stringify(value, null, 2) + "\n");
for (const [name, value] of [["receipt", receipt], ["result", result]]) await writeFile(new URL(`${name}.json`, here), JSON.stringify(value, null, 2) + "\n");
await writeFile(new URL("handoff.md", here), handoff(intake, result, receipt));
await writeFile(new URL("adapter.patch", here), git("diff", baseRevision, revision) + "\n");
console.log(JSON.stringify({ owners: Object.keys(owners).length, acceptance: results, result }));
