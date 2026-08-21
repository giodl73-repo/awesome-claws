import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { proveCapstones } from "./prove-capstones.mjs";

test("capstone runtime proof exercises authority, restart, delegation, household, and work-portfolio boundaries", async () => {
  const evidenceRoot = await mkdtemp(join(tmpdir(), "awesome-claws-capstone-evidence-"));
  try {
    const summary = await proveCapstones({ evidenceRoot });
    assert.equal(summary.status, "passed");
    assert.equal(summary.capstoneCount, 5);
    assert.equal(summary.results["change-control-operator"].staleApproval, "rejected before mutation");
    assert.equal(summary.results["case-continuity-coordinator"].staleResumePoint, "rejected");
    assert.equal(summary.results["delegation-coordinator"].broadenedScope, "rejected");
    assert.equal(summary.results["household-steward"].broadenedScope, "rejected");
    assert.equal(summary.results["household-steward"].sharedPrivateLeak, "rejected");
    assert.equal(summary.results["household-steward"].singleMemberFalseConsensus, "rejected");
    assert.equal(summary.results["work-chief-of-staff"].broadenedScope, "rejected");
    assert.equal(summary.results["work-chief-of-staff"].confidentialViewLeak, "rejected");
    assert.equal(summary.results["work-chief-of-staff"].singleLeaderFalseConsensus, "rejected");
    assert.equal(summary.results["work-chief-of-staff"].completedJointCommitment, "accepted");
    const persisted = JSON.parse(await readFile(join(evidenceRoot, "summary.json"), "utf8"));
    assert.deepEqual(persisted.results, summary.results);
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});
