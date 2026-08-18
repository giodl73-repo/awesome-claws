import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeChangePlanDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const worker = join(root, "scripts", "capstone-runtime-worker.mjs");
const capstones = [
  "change-control-operator",
  "case-continuity-coordinator",
  "delegation-coordinator",
];

async function readFixture(id, name) {
  return JSON.parse(
    await readFile(join(root, "claws", id, "fixtures", `${name}.example.json`), "utf8"),
  );
}

async function validator(id, name) {
  const schema = JSON.parse(
    await readFile(join(root, "claws", id, "schemas", `${name}.schema.json`), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (value, label) => {
    assert.equal(validate(value), true, `${label}: ${JSON.stringify(validate.errors)}`);
    const findings = validateArtifactSemantics(id, value);
    assert.deepEqual(findings, [], `${label}: ${JSON.stringify(findings)}`);
  };
}

function assertRejected(id, candidate, code) {
  const findings = validateArtifactSemantics(id, candidate);
  assert.ok(findings.some((finding) => finding.code === code), `Expected ${code}.`);
}

async function executeApprovedChange(candidate, workspace) {
  const currentDigest = computeChangePlanDigest(candidate.plan);
  if (
    candidate.plan.digest !== currentDigest ||
    candidate.decision.state !== "approved-by-owner" ||
    candidate.decision.planDigest !== currentDigest ||
    candidate.execution.planDigest !== currentDigest
  ) {
    const error = new Error("Current plan content does not match the approved digest.");
    error.code = "stale_approval";
    throw error;
  }
  await writeFile(join(workspace, "config", "staging.yml"), "retryLimit: 5\n");
}

async function proveChangeControl(runtimeRoot, evidenceRoot) {
  const id = "change-control-operator";
  const fixture = await readFixture(id, "change-plan");
  const validate = await validator(id, "change-plan");
  validate(fixture, "Packaged approved change plan");

  const workspace = join(runtimeRoot, "change-workspace");
  await mkdir(join(workspace, "config"), { recursive: true });
  await mkdir(join(workspace, "tests"), { recursive: true });
  await writeFile(join(workspace, "config", "staging.yml"), "retryLimit: 3\n");
  await writeFile(
    join(workspace, "tests", "config.test.mjs"),
    'import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nassert.equal(await readFile(new URL("../config/staging.yml", import.meta.url), "utf8"), "retryLimit: 5\\n");\n',
  );

  const approvedDigest = computeChangePlanDigest(fixture.plan);
  assert.equal(fixture.plan.digest, approvedDigest);
  assert.equal(fixture.decision.planDigest, approvedDigest);

  const drifted = structuredClone(fixture);
  drifted.plan.steps[0].summary = "Change retry limit from 3 to 6.";
  assert.notEqual(computeChangePlanDigest(drifted.plan), drifted.decision.planDigest);
  assertRejected(id, drifted, "invalid_plan_digest");
  await assert.rejects(
    executeApprovedChange(drifted, workspace),
    (error) => error.code === "stale_approval",
  );
  assert.equal(await readFile(join(workspace, "config", "staging.yml"), "utf8"), "retryLimit: 3\n");

  await executeApprovedChange(fixture, workspace);
  const testRun = spawnSync(process.execPath, ["tests/config.test.mjs"], {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(testRun.status, 0, testRun.stderr);
  assert.deepEqual((await readdir(join(workspace, "config"))).sort(), ["staging.yml"]);
  assert.equal(await readFile(join(workspace, "config", "staging.yml"), "utf8"), "retryLimit: 5\n");

  const evidence = {
    status: "passed",
    approvedDigest,
    mutation: "workspace-only edit applied",
    focusedCommandExitCode: testRun.status,
    staleApproval: "rejected before mutation",
  };
  await writeFile(join(evidenceRoot, `${id}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

async function runWorker(args) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [worker, ...args], {
    maxBuffer: 1024 * 1024,
  });
  assert.equal(stderr, "");
  return JSON.parse(stdout);
}

async function proveContinuity(runtimeRoot, evidenceRoot) {
  const id = "case-continuity-coordinator";
  const fixturePath = join(root, "claws", id, "fixtures", "case-checkpoint.example.json");
  const statePath = join(runtimeRoot, "case-checkpoint.json");
  const validate = await validator(id, "case-checkpoint");

  const first = await runWorker(["continuity-v1", fixturePath, statePath]);
  const firstState = JSON.parse(await readFile(statePath, "utf8"));
  validate(firstState, "First process checkpoint");
  const second = await runWorker(["continuity-v2", fixturePath, statePath]);
  const resumed = JSON.parse(await readFile(statePath, "utf8"));
  validate(resumed, "Restarted process checkpoint");
  assert.notEqual(first.pid, second.pid);
  assert.equal(resumed.checkpoints[1].previousRef, resumed.checkpoints[0].id);

  const staleEvidence = structuredClone(resumed);
  staleEvidence.evidence[0].expiresAt = "2026-08-18T14:50:00Z";
  assertRejected(id, staleEvidence, "stale_evidence_state");
  const staleResume = structuredClone(resumed);
  staleResume.resume.checkpointRef = staleResume.checkpoints[0].id;
  assertRejected(id, staleResume, "stale_resume_point");

  const evidence = {
    status: "passed",
    processIds: [first.pid, second.pid],
    checkpointChain: resumed.checkpoints.map((item) => item.id),
    staleEvidence: "rejected",
    staleResumePoint: "rejected",
  };
  await writeFile(join(evidenceRoot, `${id}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

async function proveDelegation(runtimeRoot, evidenceRoot) {
  const id = "delegation-coordinator";
  const fixture = await readFixture(id, "delegation-ledger");
  const validate = await validator(id, "delegation-ledger");
  const sourceRoot = join(runtimeRoot, "delegation-sources");
  await mkdir(sourceRoot, { recursive: true });
  const workerInputs = [];
  for (const [index, assignment] of fixture.assignments.entries()) {
    const sourceRef = assignment.sourceRefs[0];
    const sourcePath = join(sourceRoot, `${sourceRef}.txt`);
    const expectedMarker = `bounded-source:${sourceRef}`;
    await writeFile(sourcePath, `${expectedMarker}\n`);
    const inputPath = join(runtimeRoot, `${assignment.id}.json`);
    await writeFile(
      inputPath,
      `${JSON.stringify({
        id: assignment.id,
        sourceRefs: assignment.sourceRefs,
        sourcePath,
        expectedMarker,
        summary: fixture.results[index].summary,
        confidence: fixture.results[index].confidence,
      })}\n`,
    );
    workerInputs.push(inputPath);
  }

  const workerResults = await Promise.all(
    workerInputs.map((inputPath) => runWorker(["delegation", inputPath])),
  );
  const ledger = structuredClone(fixture);
  ledger.assignments = ledger.assignments.map((assignment, index) => ({
    ...assignment,
    workerSessionRef: `process:${workerResults[index].pid}`,
  }));
  ledger.results = workerResults.map((result) => ({
    id: result.id,
    assignmentRef: result.assignmentRef,
    workerSessionRef: `process:${result.pid}`,
    sourceRefs: result.sourceRefs,
    summary: result.summary,
    confidence: result.confidence,
  }));
  ledger.conflicts = [
    {
      id: "cross-domain-evidence-conflict",
      resultRefs: [ledger.results[0].id, ledger.results[2].id],
      state: "owner-decision-needed",
      summary: "Security recovery evidence and operating continuity evidence require owner reconciliation.",
    },
  ];
  ledger.synthesis.resultRefs = ledger.results.map((result) => result.id);
  validate(ledger, "Parallel worker ledger");

  const mismatched = structuredClone(ledger);
  mismatched.results[0].workerSessionRef = "process:unrelated";
  assertRejected(id, mismatched, "session_mismatch");
  const broadened = structuredClone(ledger);
  broadened.results[0].sourceRefs.push("operations-pack");
  assertRejected(id, broadened, "scope_expansion");

  const evidence = {
    status: "passed",
    workerSessionRefs: ledger.assignments.map((item) => item.workerSessionRef),
    resultCount: ledger.results.length,
    conflictState: ledger.conflicts[0].state,
    mismatchedSession: "rejected",
    broadenedScope: "rejected",
  };
  await writeFile(join(evidenceRoot, `${id}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

export async function proveCapstones(options = {}) {
  const evidenceRoot = resolve(
    options.evidenceRoot ??
      process.env.CAPSTONE_PROOF_DIR ??
      join(root, ".tmp", "capstone-runtime-proof"),
  );
  const runtimeRoot = await mkdtemp(join(tmpdir(), "awesome-claws-capstones-"));
  await mkdir(evidenceRoot, { recursive: true });
  try {
    const results = {
      "change-control-operator": await proveChangeControl(runtimeRoot, evidenceRoot),
      "case-continuity-coordinator": await proveContinuity(runtimeRoot, evidenceRoot),
      "delegation-coordinator": await proveDelegation(runtimeRoot, evidenceRoot),
    };
    const summary = {
      schemaVersion: "awesomeClaws.capstoneRuntimeProof.v1",
      generatedAt: new Date().toISOString(),
      status: "passed",
      capstoneCount: capstones.length,
      evidenceClaims: {
        changeControl: "digest-gated workspace mutation plus focused command execution",
        continuity: "durable checkpoint resumed by a distinct Node process",
        delegation: "parallel bounded worker processes with provenance and conflict preservation",
      },
      results,
    };
    await writeFile(join(evidenceRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await proveCapstones(), null, 2));
}
