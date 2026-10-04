import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeApprovalResponseRevision,
  computeBlockerResolutionRevision,
  computeBuildRevision,
  computeCheckRevision,
  computeCheckpointDigest,
  computeDependencyRevision,
  computeDispatchReceiptRevision,
  computeEscalationDedupeKey,
  computeEscalationRouteAuthorizationRevision,
  computePredecessorCheckpointDigest,
  computePullRequestSourceRevision,
  computeReleaseEvidenceRevision,
  computeReviewRevision,
  computeRepositoryRevision,
  computeRosterCompletenessRoot,
  computeSnapshotSetRoot,
  computeSupersededRevisionRef,
  repositoryOperationsFindings,
  resealRepositoryOperationsArtifact,
} from "./repository-operations-manager.mjs";

const AS_OF = "2026-09-13T17:00:00Z";
const base = "../sources/repository-operations-manager";
const fixture = JSON.parse(
  await readFile(
    new URL(`${base}/fixtures/repository-operations.example.json`, import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(`${base}/schemas/repository-operations.schema.json`, import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL(`${base}/templates/repository-operations.md`, import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function mutate(change, reseal = true) {
  const value = clone();
  change(value);
  return reseal ? resealRepositoryOperationsArtifact(value) : value;
}

function findings(value, context = { asOf: AS_OF }) {
  return repositoryOperationsFindings(value, context);
}

function assertHas(value, code, context = { asOf: AS_OF }) {
  const result = findings(value, context);
  assert.ok(result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

function assertNotHas(value, code, context = { asOf: AS_OF }) {
  const result = findings(value, context);
  assert.ok(!result.some((row) => row.code === code), JSON.stringify(result, null, 2));
}

function reconcileChangedRevision(value, entityRef, kind, afterRevision) {
  const predecessorRevision = value.predecessor.entities.find(
    (row) => row.entityRef === entityRef,
  ).revision;
  const existing = value.delta.entries.find((row) => row.entityRef === entityRef);
  if (existing) {
    existing.afterRevision = afterRevision;
    return;
  }
  value.delta.unchangedRefs = value.delta.unchangedRefs.filter((ref) => ref !== entityRef);
  value.delta.entries.push({
    id: `delta-${entityRef}-rebound`,
    entityRef,
    kind,
    beforeRevision: predecessorRevision,
    afterRevision,
  });
  value.delta.supersededRefs.push(
    computeSupersededRevisionRef(entityRef, predecessorRevision),
  );
}

function removeResolvedMissingEvidenceHistory(value) {
  const blocker = value.blockers.find(
    (row) => row.category === "missing-evidence" && row.state === "resolved",
  );
  if (!blocker) return;
  value.blockers = value.blockers.filter((row) => row.id !== blocker.id);
  value.evidence = value.evidence.filter(
    (row) => row.id !== blocker.resolutionEvidenceRef,
  );
}

function rebindResolvedMissingClosure(value, previousEvidenceRef, nextEvidenceRef) {
  const blocker = value.blockers.find(
    (row) =>
      row.category === "missing-evidence" &&
      row.state === "resolved" &&
      row.missingEvidenceHistory?.closureEvidenceRef === previousEvidenceRef,
  );
  if (!blocker) return;
  blocker.evidenceRefs = [nextEvidenceRef];
  blocker.missingEvidenceHistory.closureEvidenceRef = nextEvidenceRef;
  const resolution = value.evidence.find((row) => row.id === blocker.resolutionEvidenceRef);
  resolution.subjectRefs = resolution.subjectRefs.map((ref) =>
    ref === previousEvidenceRef ? nextEvidenceRef : ref,
  );
  resolution.revision = computeBlockerResolutionRevision(blocker);
}

test("accepted portfolio fixture is schema-valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(
    fixture.roster.completenessRoot,
    computeRosterCompletenessRoot(fixture.roster, fixture.repositories, fixture.principals),
  );
  assert.equal(
    fixture.evidence.find((row) => row.id === fixture.roster.evidenceRef).digest,
    fixture.roster.completenessRoot,
  );
  assert.equal(fixture.run.snapshotSetRoot, computeSnapshotSetRoot(fixture.snapshots));
  assert.equal(fixture.run.currentCheckpointDigest, computeCheckpointDigest(fixture));
  for (const request of fixture.escalations) {
    assert.equal(request.dedupeKey, computeEscalationDedupeKey(request));
  }
  for (const build of fixture.builds) {
    const buildEvidence = fixture.evidence.find((row) => row.id === build.evidenceRef);
    assert.equal(buildEvidence.revision, computeBuildRevision(build));
    assert.equal(buildEvidence.sourceRecordDigest, build.evidenceDigest);
  }
  for (const review of fixture.reviews) {
    const reviewEvidence = fixture.evidence.find((row) => row.id === review.evidenceRef);
    assert.equal(reviewEvidence.revision, computeReviewRevision(review));
    assert.equal(reviewEvidence.sourceRecordDigest, review.evidenceDigest);
  }
  for (const check of fixture.checks) {
    const checkEvidence = fixture.evidence.find((row) => row.id === check.evidenceRef);
    assert.equal(checkEvidence.revision, computeCheckRevision(check));
    assert.equal(checkEvidence.sourceRecordDigest, check.evidenceDigest);
  }
  for (const pullRequest of fixture.pullRequests) {
    const sourceEvidence = fixture.evidence.find(
      (row) => row.id === pullRequest.sourceEvidenceRef,
    );
    assert.equal(sourceEvidence.revision, computePullRequestSourceRevision(pullRequest));
    assert.equal(sourceEvidence.sourceRecordDigest, pullRequest.sourceEvidenceDigest);
    assert.equal(pullRequest.evidenceRevision, computePullRequestSourceRevision(pullRequest));
  }
  for (const releaseTrain of fixture.releaseTrains) {
    const releaseEvidence = fixture.evidence.find(
      (row) => row.id === releaseTrain.releaseEvidenceRef,
    );
    assert.equal(releaseEvidence.revision, computeReleaseEvidenceRevision(releaseTrain));
    assert.equal(releaseEvidence.sourceRecordDigest, releaseTrain.releaseEvidenceDigest);
  }
});

test("pull request source fields require exact controlled immutable evidence", () => {
  const mutations = [
    (value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").number = 19;
    },
    (value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").previousHeadSha =
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    },
    (value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").sourceEvidenceDigest =
        `sha256:${"9".repeat(64)}`;
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-pr-sdk-18").kind = "review";
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-pr-sdk-18").subjectRefs = [
        "pr-sdk-18",
      ];
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-pr-sdk-18").observedAt =
        "2026-09-13T15:20:01Z";
    },
  ];
  for (const change of mutations) {
    const value = mutate(change);
    assertHas(value, "invalid_evidence_binding");
  }
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-pr-sdk-18").revision =
        "invalid-pr-source-revision";
      const repositoryState = value.readiness.repositoryStates.find(
        (row) => row.subjectRef === "repo-sdk",
      );
      repositoryState.state = "ready-for-owner-review";
      repositoryState.blockerRefs = [];
    }),
    "invalid_repository_readiness",
  );
  assertNotHas(fixture, "invalid_evidence_binding");
  for (const response of fixture.responses) {
    const responseEvidence = fixture.evidence.find((row) => row.id === response.evidenceRef);
    assert.equal(responseEvidence.revision, computeApprovalResponseRevision(response));
  }
});

test("representative fixture preserves required adverse and response states", () => {
  assert.equal(fixture.repositories.length, 3);
  assert.ok(fixture.reviews.some((row) => row.state === "stale"));
  assert.ok(fixture.builds.some((row) => row.state === "failed"));
  assert.deepEqual(
    new Set(fixture.artifacts.map((row) => row.state)),
    new Set(["verified", "missing", "failed"]),
  );
  assert.ok(fixture.releaseTrains.some((row) => row.state === "partial"));
  assert.ok(
    fixture.releaseTrains.some((train) =>
      train.entries.some((row) => row.state === "rolled-back"),
    ),
  );
  assert.ok(fixture.dependencies.some((row) => row.state === "blocked"));
  assert.deepEqual(
    new Set(fixture.responses.map((row) => row.outcome)),
    new Set(["approved", "rejected", "no-response"]),
  );
  assert.equal(fixture.readiness.portfolioState, "blocked");
});

test("explicit first run is accepted only with a complete opened partition", () => {
  const value = clone();
  value.run.firstRun = true;
  value.run.predecessorCheckpointRef = null;
  value.predecessor = null;
  value.snapshots = value.snapshots.filter((row) => row.kind !== "predecessor-checkpoint");
  removeResolvedMissingEvidenceHistory(value);
  value.delta.predecessorCheckpointRef = null;
  value.delta.entries = [
    ...value.repositories.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeRepositoryRevision(row),
    })),
    ...value.pullRequests.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computePullRequestSourceRevision(row),
    })),
    ...value.reviews.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeReviewRevision(row),
    })),
    ...value.checks.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeCheckRevision(row),
    })),
    ...value.builds.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeBuildRevision(row),
    })),
    ...value.releaseTrains.map((row) => ({
      id: `delta-first-${row.id}`,
      entityRef: row.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeReleaseEvidenceRevision(row),
    })),
  ];
  value.delta.unchangedRefs = [];
  value.delta.supersededRefs = [];
  assert.deepEqual(findings(resealRepositoryOperationsArtifact(value)), []);
});

test("roster, predecessor, delta, and snapshot roots fail closed", () => {
  assertHas(
    mutate((value) => value.roster.repositoryRefs.pop()),
    "invalid_roster_completeness",
  );
  assertHas(
    mutate((value) => {
      value.predecessor.custodianRef = "principal-api-owner";
    }),
    "invalid_checkpoint_lineage",
  );
  assert.equal(
    fixture.predecessor.checkpointDigest,
    computePredecessorCheckpointDigest(fixture.predecessor),
  );
  assertHas(
    mutate((value) => {
      value.predecessor.entities[0].revision = "policy-rewritten";
    }),
    "invalid_checkpoint_lineage",
  );
  assertHas(
    mutate((value) => {
      value.predecessor.entities.push({
        ...structuredClone(value.predecessor.entities[0]),
        revision: "alternate-revision",
      });
      value.predecessor.checkpointDigest = computePredecessorCheckpointDigest(value.predecessor);
      value.snapshots.find(
        (row) => row.kind === "predecessor-checkpoint",
      ).sourceRecordDigest = value.predecessor.checkpointDigest;
    }),
    "invalid_checkpoint_lineage",
  );
  assertHas(
    mutate((value) => value.delta.unchangedRefs.pop()),
    "invalid_checkpoint_delta",
  );
  assertHas(
    mutate((value) => value.run.sourceSnapshotRoots.pop(), false),
    "invalid_source_snapshot_roots",
  );
  assertHas(
    mutate((value) => {
      value.repositories[0].defaultBranch = "develop";
    }, false),
    "invalid_roster_completeness",
  );
  assertHas(
    mutate((value) => {
      value.repositories[0].requiredApprovalCount = 2;
    }, false),
    "invalid_roster_completeness",
  );
  assertHas(
    mutate((value) => {
      value.repositories[0].snapshotRefs = [];
    }),
    "invalid_repository_roster_entry",
  );
  assertHas(
    mutate((value) => {
      value.repositories[1].canonicalName = value.repositories[0].canonicalName;
    }),
    "invalid_repository_roster_entry",
  );
  assertHas(
    mutate((value) => {
      value.repositories[0].defaultBranch = "develop";
    }),
    "invalid_checkpoint_delta",
  );
});

test("current snapshots stay inside the review window with only exact predecessor evidence exempted", () => {
  assert.ok(
    Date.parse(fixture.snapshots.find((row) => row.kind === "predecessor-checkpoint").capturedAt) <
      Date.parse(fixture.run.windowStart),
  );
  assertNotHas(fixture, "invalid_source_snapshot");
  assertHas(
    mutate((value) => {
      value.run.windowStart = "2026-09-13T15:46:00Z";
    }),
    "invalid_source_snapshot",
  );
  assertHas(
    mutate((value) => {
      value.snapshots.find((row) => row.id === "snapshot-predecessor").kind = "release";
    }),
    "invalid_source_snapshot",
  );
});

test("checkpoint digest commits roster provenance and principal authority records", () => {
  const shiftedRosterCapture = mutate((value) => {
    value.roster.capturedAt = "2026-09-13T15:01:00Z";
  }, false);
  assert.notEqual(computeCheckpointDigest(shiftedRosterCapture), fixture.run.currentCheckpointDigest);
  assertHas(shiftedRosterCapture, "invalid_checkpoint_digest");
  assert.deepEqual(findings(resealRepositoryOperationsArtifact(shiftedRosterCapture)), []);

  assertHas(
    mutate((value) => {
      value.principals.find((row) => row.id === "principal-repository-operations-claw").kind =
        "system";
      value.evidence.find((row) => row.id === "evidence-dispatch-merge").authorRef =
        "principal-repository-operations-claw";
    }),
    "invalid_principal_authority",
  );
  const changedPrincipal = mutate((value) => {
    value.principals.find((row) => row.id === "principal-source-system").name =
      "Replacement evidence collector";
  }, false);
  assertHas(changedPrincipal, "invalid_checkpoint_digest");

  const resealed = resealRepositoryOperationsArtifact(changedPrincipal);
  assert.deepEqual(findings(resealed), []);

  const forgedReviewer = mutate((value) => {
    value.principals.push({
      id: "principal-forged-reviewer",
      name: "Forged reviewer",
      kind: "human",
      scopes: ["independent-review-author"],
    });
    const repository = value.repositories.find((row) => row.id === "repo-sdk");
    repository.eligibleReviewerRefs = ["principal-forged-reviewer"];
    const review = value.reviews.find((row) => row.id === "review-sdk-current");
    review.authorRef = "principal-forged-reviewer";
    const reviewEvidence = value.evidence.find((row) => row.id === review.evidenceRef);
    reviewEvidence.authorRef = review.authorRef;
    reviewEvidence.revision = `${review.pullRequestRef}@${review.headSha}:${review.authorRef}:${review.state}:${review.submittedAt}`;
  });
  assertHas(forgedReviewer, "invalid_roster_completeness");

  assertHas(
    mutate((value) => {
      value.principals
        .find((row) => row.id === "principal-repository-operations-claw")
        .scopes.push("policy-bounded-escalation-dispatch");
    }),
    "invalid_principal_authority",
  );
});

test("roster capture and controlled evidence obey exact run chronology", () => {
  assert.equal(fixture.roster.capturedAt, fixture.evidence.find(
    (row) => row.id === fixture.roster.evidenceRef,
  ).observedAt);
  assertNotHas(fixture, "invalid_roster_completeness");

  const evidenceBeforeCapture = mutate((value) => {
    value.evidence.find((row) => row.id === value.roster.evidenceRef).observedAt =
      "2026-09-13T14:59:59Z";
  });
  assertNotHas(evidenceBeforeCapture, "invalid_roster_completeness");

  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === value.roster.evidenceRef).observedAt =
        "2026-09-13T15:00:01Z";
    }),
    "invalid_roster_completeness",
  );

  const captureAtWindowStart = mutate((value) => {
    value.roster.capturedAt = value.run.windowStart;
    value.evidence.find((row) => row.id === value.roster.evidenceRef).observedAt =
      value.run.windowStart;
  });
  assertNotHas(captureAtWindowStart, "invalid_roster_completeness");

  const captureAtAsOf = mutate((value) => {
    value.roster.capturedAt = value.run.asOf;
  });
  assertNotHas(captureAtAsOf, "invalid_roster_completeness");

  assertHas(
    mutate((value) => {
      value.roster.capturedAt = "2026-09-06T16:59:59Z";
      value.evidence.find((row) => row.id === value.roster.evidenceRef).observedAt =
        value.roster.capturedAt;
    }),
    "invalid_roster_completeness",
  );
  assertHas(
    mutate((value) => {
      value.roster.capturedAt = "2026-09-13T17:00:01Z";
    }),
    "invalid_roster_completeness",
  );
});

test("PR reviews, checks, and builds are invalidated by a head change", () => {
  assertHas(
    mutate((value) => {
      value.reviews.find((row) => row.id === "review-api-old").state = "approved";
    }),
    "invalid_head_bound_review",
  );
  assertHas(
    mutate((value) => {
      value.checks.find((row) => row.id === "check-api-old").state = "passed";
    }),
    "invalid_head_bound_check",
  );
  assertHas(
    mutate((value) => {
      value.builds.find((row) => row.id === "build-api-old").state = "succeeded";
    }),
    "invalid_head_bound_build",
  );
  assertHas(
    mutate((value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").currentHeadSha =
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    }),
    "invalid_pull_request_closure",
  );
});

test("PR, review, and check snapshots cannot cross repository scope", () => {
  assertHas(
    mutate((value) => {
      value.snapshots.find((row) => row.id === "snapshot-prs").repositoryRef = "repo-sdk";
    }),
    "invalid_pull_request_closure",
  );
  assertHas(
    mutate((value) => {
      value.snapshots.find((row) => row.id === "snapshot-reviews").repositoryRef = "repo-sdk";
    }),
    "invalid_head_bound_review",
  );
  assertHas(
    mutate((value) => {
      value.snapshots.find((row) => row.id === "snapshot-checks").repositoryRef = "repo-sdk";
    }),
    "invalid_head_bound_check",
  );
  assertHas(
    mutate((value) => {
      value.reviews.find((row) => row.id === "review-api-current").submittedAt =
        "2026-09-13T15:26:00Z";
    }),
    "invalid_head_bound_review",
  );
  assertHas(
    mutate((value) => {
      value.checks.find((row) => row.id === "check-api-current").completedAt =
        "2026-09-13T15:31:00Z";
    }),
    "invalid_head_bound_check",
  );
});

test("pull requests accept controlled repository-scoped snapshots", () => {
  const value = mutate((candidate) => {
    const sharedSnapshot = candidate.snapshots.find(
      (row) => row.id === "snapshot-prs",
    );
    candidate.snapshots.push({
      ...structuredClone(sharedSnapshot),
      id: "snapshot-pr-sdk",
      repositoryRef: "repo-sdk",
      sourceUri: "controlled://github/acme/sdk/pulls/18/snapshot/801",
      sourceRecordDigest: `sha256:${"7".repeat(64)}`,
      completenessRoot: `sha256:${"8".repeat(64)}`,
    });
    const pullRequest = candidate.pullRequests.find(
      (row) => row.id === "pr-sdk-18",
    );
    pullRequest.snapshotRef = "snapshot-pr-sdk";
    pullRequest.evidenceRevision = computePullRequestSourceRevision(pullRequest);
    candidate.evidence.find(
      (row) => row.id === pullRequest.sourceEvidenceRef,
    ).revision = computePullRequestSourceRevision(pullRequest);
    candidate.delta.entries.find(
      (row) => row.entityRef === pullRequest.id,
    ).afterRevision = computePullRequestSourceRevision(pullRequest);
  });
  assert.deepEqual(findings(value), []);
});

test("current-head review, check, and build ledgers require reverse PR coverage", () => {
  for (const field of ["reviewRefs", "checkRefs", "buildRefs"]) {
    assertHas(
      mutate((value) => {
        const pr = value.pullRequests.find((row) => row.id === "pr-api-41");
        pr[field] = pr[field].filter((ref) => !ref.endsWith("current") && ref !== "build-api-new");
      }),
      "incomplete_pull_request_evidence_coverage",
    );
  }
  assertHas(
    mutate((value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").artifactRefs = [];
    }),
    "incomplete_pull_request_evidence_coverage",
  );
});

test("only independent human review authority can satisfy approval readiness", () => {
  for (const authorRef of [
    "principal-repository-operations-claw",
    "principal-source-system",
    "principal-sdk-owner",
  ]) {
    const value = mutate((candidate) => {
      candidate.reviews.find((row) => row.id === "review-sdk-current").authorRef = authorRef;
    });
    assertHas(value, "invalid_review_authority");
  }
  assertHas(
    mutate((value) => {
      value.reviews.find((row) => row.id === "review-api-current").state = "approved";
    }),
    "invalid_head_bound_review",
  );
  const insufficientApproval = mutate((value) => {
    value.principals.push({
      id: "principal-second-reviewer",
      name: "Second reviewer",
      kind: "human",
      scopes: ["independent-review-author"],
    });
    const repository = value.repositories.find((row) => row.id === "repo-sdk");
    repository.requiredApprovalCount = 2;
    repository.eligibleReviewerRefs.push("principal-second-reviewer");
  });
  assertHas(insufficientApproval, "missing_required_blocker");
  assertNotHas(fixture, "invalid_review_authority");
});

test("repository ownership requires accountable human authority", () => {
  const value = mutate((candidate) => {
    const sourceSystem = candidate.principals.find(
      (row) => row.id === "principal-source-system",
    );
    sourceSystem.scopes.push("repository-owner");
    candidate.repositories.find((row) => row.id === "repo-sdk").ownerRef =
      sourceSystem.id;
  });
  assertHas(value, "invalid_repository_roster_entry");
  assertNotHas(fixture, "invalid_repository_roster_entry");
});

test("a valid current change request blocks readiness despite sufficient approvals", () => {
  const addCurrentChangeRequest = (value) => {
    const review = value.reviews.find((row) => row.id === "review-api-old");
    review.pullRequestRef = "pr-sdk-18";
    review.headSha = "cccccccccccccccccccccccccccccccccccccccc";
    review.state = "changes-requested";
    review.submittedAt = "2026-09-13T14:30:00Z";
    const evidence = value.evidence.find((row) => row.id === review.evidenceRef);
    evidence.observedAt = review.submittedAt;
    evidence.subjectRefs = [review.id, review.pullRequestRef];
    evidence.revision = computeReviewRevision(review);
    value.pullRequests.find((row) => row.id === "pr-api-41").reviewRefs =
      value.pullRequests
        .find((row) => row.id === "pr-api-41")
        .reviewRefs.filter((ref) => ref !== review.id);
    value.pullRequests.find((row) => row.id === "pr-sdk-18").reviewRefs.push(review.id);
    value.delta.entries.find((row) => row.id === "delta-review-api-old").afterRevision =
      evidence.revision;
  };

  const missingBlocker = mutate(addCurrentChangeRequest);
  assertHas(missingBlocker, "missing_required_blocker");

  const exactBlocker = mutate((value) => {
    addCurrentChangeRequest(value);
    value.blockers.push({
      id: "blocker-sdk-change-requested",
      category: "changes-requested-review",
      subjectRefs: ["pr-sdk-18", "review-api-old"],
      ownerRef: "principal-sdk-owner",
      evidenceRefs: ["evidence-review-api-old"],
      state: "open",
      resolutionEvidenceRef: null,
    });
    const pr = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    pr.blockerRefs.push("blocker-sdk-change-requested");
    pr.readiness = "blocked";
    const repositoryState = value.readiness.repositoryStates.find(
      (row) => row.subjectRef === "repo-sdk",
    );
    repositoryState.blockerRefs.push("blocker-sdk-change-requested");
    repositoryState.state = "blocked";
    value.readiness.releaseTrainStates[0].blockerRefs.push(
      "blocker-sdk-change-requested",
    );
    value.readiness.blockerRefs.push("blocker-sdk-change-requested");
  });
  assert.deepEqual(findings(exactBlocker), []);
});

test("review and check revisions participate in typed checkpoint deltas", () => {
  assertHas(
    mutate((value) => {
      value.delta.unchangedRefs = value.delta.unchangedRefs.filter(
        (ref) => ref !== "review-sdk-current",
      );
    }),
    "invalid_checkpoint_delta",
  );
  assertHas(
    mutate((value) => {
      value.delta.entries.find((row) => row.id === "delta-check-api-old").kind =
        "review-changed";
    }),
    "invalid_checkpoint_delta",
  );
  assertHas(
    mutate((value) => {
      value.delta.entries.find((row) => row.id === "delta-pr-cli").kind =
        "release-changed";
    }),
    "invalid_checkpoint_delta",
  );
  const duplicateDeltaId = mutate((value) => {
    value.delta.entries[1].id = value.delta.entries[0].id;
  });
  assertHas(duplicateDeltaId, "duplicate_identity");
  assertHas(duplicateDeltaId, "invalid_checkpoint_delta");
  const ledgerCollision = mutate((value) => {
    value.delta.entries[0].id = value.evidence[0].id;
  });
  assertHas(ledgerCollision, "duplicate_identity");
  assertHas(ledgerCollision, "invalid_checkpoint_delta");
});

test("checkpoint deltas reject entity type changes for changed and unchanged identities", () => {
  const unchangedTypeChange = mutate((value) => {
    value.predecessor.entities.find((row) => row.entityRef === "build-api-old").entityType =
      "check";
    value.predecessor.checkpointDigest = computePredecessorCheckpointDigest(value.predecessor);
    value.snapshots.find((row) => row.kind === "predecessor-checkpoint").sourceRecordDigest =
      value.predecessor.checkpointDigest;
  });
  assertNotHas(unchangedTypeChange, "invalid_checkpoint_lineage");
  assertHas(unchangedTypeChange, "invalid_checkpoint_delta");

  const changedTypeChange = mutate((value) => {
    const entityRef = "build-sdk";
    const predecessorEntry = value.predecessor.entities.find(
      (row) => row.entityRef === entityRef,
    );
    predecessorEntry.entityType = "check";
    predecessorEntry.state = "superseded";
    predecessorEntry.revision = `sha256:${"9".repeat(64)}`;
    value.predecessor.checkpointDigest = computePredecessorCheckpointDigest(value.predecessor);
    value.snapshots.find((row) => row.kind === "predecessor-checkpoint").sourceRecordDigest =
      value.predecessor.checkpointDigest;
    reconcileChangedRevision(
      value,
      entityRef,
      "build-changed",
      computeBuildRevision(value.builds.find((row) => row.id === entityRef)),
    );
  });
  assertNotHas(changedTypeChange, "invalid_checkpoint_lineage");
  assertHas(changedTypeChange, "invalid_checkpoint_delta");
});

test("pull request terminal delta kinds only describe transitions into terminal state", () => {
  for (const terminalState of ["merged", "closed"]) {
    const value = mutate((candidate) => {
      const pullRequest = candidate.pullRequests.find((row) => row.id === "pr-cli-9");
      pullRequest.state = terminalState;
      pullRequest.evidenceRevision = computePullRequestSourceRevision(pullRequest);
      const sourceEvidence = candidate.evidence.find(
        (row) => row.id === pullRequest.sourceEvidenceRef,
      );
      sourceEvidence.revision = computePullRequestSourceRevision(pullRequest);

      const predecessorEntry = candidate.predecessor.entities.find(
        (row) => row.entityRef === pullRequest.id,
      );
      predecessorEntry.state = terminalState;
      predecessorEntry.revision = computePullRequestSourceRevision({
        ...pullRequest,
        number: pullRequest.number - 1,
      });
      candidate.predecessor.checkpointDigest = computePredecessorCheckpointDigest(
        candidate.predecessor,
      );
      candidate.snapshots.find(
        (row) => row.kind === "predecessor-checkpoint",
      ).sourceRecordDigest = candidate.predecessor.checkpointDigest;

      const deltaEntry = candidate.delta.entries.find(
        (row) => row.entityRef === pullRequest.id,
      );
      const priorBeforeRevision = deltaEntry.beforeRevision;
      deltaEntry.kind = "updated";
      deltaEntry.beforeRevision = predecessorEntry.revision;
      deltaEntry.afterRevision = computePullRequestSourceRevision(pullRequest);
      const supersededIndex = candidate.delta.supersededRefs.indexOf(
        computeSupersededRevisionRef(pullRequest.id, priorBeforeRevision),
      );
      candidate.delta.supersededRefs[supersededIndex] =
        computeSupersededRevisionRef(pullRequest.id, predecessorEntry.revision);
    });

    assert.equal(validateSchema(value), true, ajv.errorsText(validateSchema.errors));
    assert.deepEqual(findings(value), []);

    const repeatedTerminalTransition = structuredClone(value);
    repeatedTerminalTransition.delta.entries.find(
      (row) => row.entityRef === "pr-cli-9",
    ).kind = terminalState;
    assertHas(
      resealRepositoryOperationsArtifact(repeatedTerminalTransition),
      "invalid_checkpoint_delta",
    );
  }
});

test("passed checks require complete chronology while pending and missing remain representable", () => {
  assertHas(
    mutate((value) => {
      value.checks.find((row) => row.id === "check-sdk-current").startedAt =
        "2026-09-12T14:01:00Z";
    }),
    "invalid_check_chronology",
  );
  assertHas(
    mutate((value) => {
      value.checks.find((row) => row.id === "check-sdk-current").completedAt = null;
    }),
    "invalid_check_chronology",
  );
  assertNotHas(fixture, "invalid_check_chronology");
});

test("same-head check and build retries may supersede earlier attempts", () => {
  const value = mutate((candidate) => {
    const pullRequest = candidate.pullRequests.find((row) => row.id === "pr-sdk-18");
    const check = {
      id: "check-sdk-retried",
      pullRequestRef: pullRequest.id,
      headSha: pullRequest.currentHeadSha,
      context: "required-ci",
      required: true,
      state: "superseded",
      startedAt: "2026-09-12T11:00:00Z",
      completedAt: "2026-09-12T11:30:00Z",
      snapshotRef: "snapshot-checks",
      evidenceRef: "evidence-check-sdk-retried",
      evidenceDigest: `sha256:${"b".repeat(64)}`,
    };
    const build = {
      id: "build-sdk-retried",
      repositoryRef: "repo-sdk",
      pullRequestRef: pullRequest.id,
      headSha: pullRequest.currentHeadSha,
      runId: "run-sdk-179",
      state: "superseded",
      artifactRefs: [],
      snapshotRef: "snapshot-build-sdk",
      evidenceRef: "evidence-build-sdk-retried",
      evidenceDigest: `sha256:${"c".repeat(64)}`,
    };
    candidate.checks.push(check);
    candidate.builds.push(build);
    pullRequest.checkRefs.push(check.id);
    pullRequest.buildRefs.push(build.id);
    candidate.evidence.push(
      {
        id: check.evidenceRef,
        kind: "check",
        sourceRef: "controlled://ci/acme/sdk/checks/retried",
        sourceRecordDigest: check.evidenceDigest,
        observedAt: check.completedAt,
        authorRef: "principal-source-system",
        subjectRefs: [check.id, pullRequest.id],
        revision: computeCheckRevision(check),
      },
      {
        id: build.evidenceRef,
        kind: "build",
        sourceRef: "controlled://ci/acme/sdk/runs/179",
        sourceRecordDigest: build.evidenceDigest,
        observedAt: "2026-09-12T13:00:00Z",
        authorRef: "principal-source-system",
        subjectRefs: [build.id, pullRequest.id],
        revision: computeBuildRevision(build),
      },
    );
    candidate.delta.entries.push(
      {
        id: "delta-check-sdk-retried",
        entityRef: check.id,
        kind: "opened",
        beforeRevision: null,
        afterRevision: computeCheckRevision(check),
      },
      {
        id: "delta-build-sdk-retried",
        entityRef: build.id,
        kind: "opened",
        beforeRevision: null,
        afterRevision: computeBuildRevision(build),
      },
    );
  });
  assert.deepEqual(findings(value), []);
});

test("build provider identities are unique while distinct retry runs remain valid", () => {
  const duplicate = mutate((value) => {
    const pullRequest = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    const original = value.builds.find((row) => row.id === "build-sdk");
    const build = {
      ...structuredClone(original),
      id: "build-sdk-duplicate",
      artifactRefs: [],
      evidenceRef: "evidence-build-sdk-duplicate",
      evidenceDigest: `sha256:${"a".repeat(64)}`,
    };
    const evidence = {
      ...structuredClone(
        value.evidence.find((row) => row.id === original.evidenceRef),
      ),
      id: build.evidenceRef,
      sourceRef: "controlled://ci/acme/sdk/runs/180/duplicate",
      sourceRecordDigest: build.evidenceDigest,
      subjectRefs: [build.id, pullRequest.id],
      revision: computeBuildRevision(build),
    };
    value.builds.push(build);
    value.evidence.push(evidence);
    pullRequest.buildRefs.push(build.id);
    value.delta.entries.push({
      id: "delta-build-sdk-duplicate",
      entityRef: build.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeBuildRevision(build),
    });
  });
  const duplicateFindings = findings(duplicate).filter(
    (row) => row.code === "invalid_head_bound_build",
  );
  assert.deepEqual(
    new Set(duplicateFindings.flatMap((row) => row.refs)),
    new Set(["build-sdk", "build-sdk-duplicate"]),
  );

  const retry = mutate((value) => {
    const pullRequest = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    const current = value.builds.find((row) => row.id === "build-sdk");
    const build = {
      ...structuredClone(current),
      id: "build-sdk-prior-attempt",
      runId: "run-sdk-179",
      state: "superseded",
      artifactRefs: [],
      evidenceRef: "evidence-build-sdk-prior-attempt",
      evidenceDigest: `sha256:${"b".repeat(64)}`,
    };
    const evidence = {
      ...structuredClone(
        value.evidence.find((row) => row.id === current.evidenceRef),
      ),
      id: build.evidenceRef,
      sourceRef: "controlled://ci/acme/sdk/runs/179",
      sourceRecordDigest: build.evidenceDigest,
      observedAt: "2026-09-12T13:00:00Z",
      subjectRefs: [build.id, pullRequest.id],
      revision: computeBuildRevision(build),
    };
    value.builds.push(build);
    value.evidence.push(evidence);
    pullRequest.buildRefs.push(build.id);
    value.delta.entries.push({
      id: "delta-build-sdk-prior-attempt",
      entityRef: build.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeBuildRevision(build),
    });
  });
  assertNotHas(retry, "invalid_head_bound_build");
});

test("check results require exact immutable evidence and snapshot chronology", () => {
  const semanticMutations = [
    (value) => {
      value.checks.find((row) => row.id === "check-sdk-current").context = "different-context";
    },
    (value) => {
      value.checks.find((row) => row.id === "check-sdk-current").required = false;
    },
    (value) => {
      value.checks.find((row) => row.id === "check-sdk-current").state = "failed";
    },
    (value) => {
      value.checks.find((row) => row.id === "check-sdk-current").startedAt =
        "2026-09-12T13:44:00Z";
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-check-sdk-current").revision =
        "wrong-check-revision";
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-check-sdk-current").kind = "build";
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-check-sdk-current").subjectRefs = [
        "check-sdk-current",
      ];
    },
    (value) => {
      value.evidence.find(
        (row) => row.id === "evidence-check-sdk-current",
      ).sourceRecordDigest = `sha256:${"9".repeat(64)}`;
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-check-sdk-current").observedAt =
        "2026-09-12T13:59:59Z";
    },
    (value) => {
      value.evidence.find((row) => row.id === "evidence-check-sdk-current").observedAt =
        "2026-09-13T15:30:01Z";
    },
  ];
  for (const change of semanticMutations) {
    const value = mutate(change);
    assertHas(value, "invalid_head_bound_check");
  }

  const reboundDigest = mutate((value) => {
    const check = value.checks.find((row) => row.id === "check-sdk-current");
    const checkEvidence = value.evidence.find((row) => row.id === check.evidenceRef);
    check.evidenceDigest = `sha256:${"9".repeat(64)}`;
    checkEvidence.sourceRecordDigest = check.evidenceDigest;
  });
  assertHas(reboundDigest, "invalid_head_bound_check");
  assertHas(reboundDigest, "invalid_checkpoint_delta");

  const missingEvidenceRef = clone();
  delete missingEvidenceRef.checks[0].evidenceRef;
  assert.equal(validateSchema(missingEvidenceRef), false);
});

test("check revisions bind immutable evidence identity and require a delta when rebound", () => {
  const originalCheck = fixture.checks.find((row) => row.id === "check-sdk-current");
  const originalRevision = computeCheckRevision(originalCheck);
  const rebound = mutate((value) => {
    const check = value.checks.find((row) => row.id === originalCheck.id);
    const originalEvidence = value.evidence.find((row) => row.id === check.evidenceRef);
    const replacementEvidence = {
      ...structuredClone(originalEvidence),
      id: "evidence-check-sdk-rebound",
      sourceRef: "controlled://github/acme/sdk/checks/180-rebound",
      sourceRecordDigest: `sha256:${"9".repeat(64)}`,
    };
    check.evidenceRef = replacementEvidence.id;
    check.evidenceDigest = replacementEvidence.sourceRecordDigest;
    replacementEvidence.revision = computeCheckRevision(check);
    value.evidence.push(replacementEvidence);
    rebindResolvedMissingClosure(value, originalEvidence.id, replacementEvidence.id);
    value.evidence = value.evidence.filter((row) => row.id !== originalEvidence.id);
  });
  const reboundCheck = rebound.checks.find((row) => row.id === originalCheck.id);
  const reboundRevision = computeCheckRevision(reboundCheck);

  assert.notEqual(reboundRevision, originalRevision);
  assertNotHas(rebound, "invalid_head_bound_check");
  assertHas(rebound, "invalid_checkpoint_delta");

  const reconciled = structuredClone(rebound);
  reconcileChangedRevision(
    reconciled,
    reboundCheck.id,
    "check-changed",
    reboundRevision,
  );

  assert.deepEqual(findings(resealRepositoryOperationsArtifact(reconciled)), []);
});

test("invalid optional current-head check evidence blocks PR readiness", () => {
  const value = mutate((candidate) => {
    const pullRequest = candidate.pullRequests.find((row) => row.id === "pr-sdk-18");
    const check = {
      ...structuredClone(
        candidate.checks.find((row) => row.id === "check-sdk-current"),
      ),
      id: "check-sdk-optional",
      context: "optional-ci",
      required: false,
      evidenceRef: "evidence-check-sdk-optional",
      evidenceDigest: `sha256:${"a".repeat(64)}`,
    };
    const checkEvidence = {
      ...structuredClone(
        candidate.evidence.find((row) => row.id === "evidence-check-sdk-current"),
      ),
      id: check.evidenceRef,
      sourceRef: "controlled://github/acme/sdk/checks/180/optional",
      sourceRecordDigest: check.evidenceDigest,
      subjectRefs: [check.id, pullRequest.id],
      revision: computeCheckRevision(check),
    };
    candidate.checks.push(check);
    candidate.evidence.push(checkEvidence);
    pullRequest.checkRefs.push(check.id);
    candidate.delta.entries.push({
      id: "delta-check-sdk-optional",
      entityRef: check.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeCheckRevision(check),
    });
  });
  assert.deepEqual(findings(value), []);

  const invalid = structuredClone(value);
  invalid.evidence.find(
    (row) => row.id === "evidence-check-sdk-optional",
  ).sourceRecordDigest = `sha256:${"b".repeat(64)}`;
  invalid.pullRequests.find((row) => row.id === "pr-sdk-18").readiness =
    "ready-for-owner-review";
  const invalidFindings = findings(resealRepositoryOperationsArtifact(invalid));
  assert.ok(
    invalidFindings.some((row) => row.code === "invalid_head_bound_check"),
    JSON.stringify(invalidFindings, null, 2),
  );
  assert.ok(
    invalidFindings.some((row) => row.code === "invalid_pull_request_readiness"),
    JSON.stringify(invalidFindings, null, 2),
  );
});

test("PR, review, and build evidence rebinding requires a changed delta", () => {
  const cases = [
    {
      entityRef: "pr-sdk-18",
      kind: "updated",
      revision: computePullRequestSourceRevision,
      rebind(value) {
        const row = value.pullRequests.find((candidate) => candidate.id === this.entityRef);
        const originalEvidence = value.evidence.find(
          (candidate) => candidate.id === row.sourceEvidenceRef,
        );
        const replacement = {
          ...structuredClone(originalEvidence),
          id: "evidence-pr-sdk-rebound",
          sourceRef: "controlled://github/acme/sdk/pulls/18/rebound",
          sourceRecordDigest: `sha256:${"5".repeat(64)}`,
        };
        row.sourceEvidenceRef = replacement.id;
        row.sourceEvidenceDigest = replacement.sourceRecordDigest;
        row.evidenceRevision = this.revision(row);
        replacement.revision = this.revision(row);
        value.evidence.push(replacement);
        value.evidence = value.evidence.filter(
          (candidate) => candidate.id !== originalEvidence.id,
        );
        return row;
      },
    },
    {
      entityRef: "review-sdk-current",
      kind: "review-changed",
      revision: computeReviewRevision,
      rebind(value) {
        const row = value.reviews.find((candidate) => candidate.id === this.entityRef);
        const originalEvidence = value.evidence.find(
          (candidate) => candidate.id === row.evidenceRef,
        );
        const replacement = {
          ...structuredClone(originalEvidence),
          id: "evidence-review-sdk-rebound",
          sourceRef: "controlled://github/acme/sdk/reviews/18/rebound",
          sourceRecordDigest: `sha256:${"6".repeat(64)}`,
        };
        row.evidenceRef = replacement.id;
        row.evidenceDigest = replacement.sourceRecordDigest;
        replacement.revision = this.revision(row);
        value.evidence.push(replacement);
        value.evidence = value.evidence.filter(
          (candidate) => candidate.id !== originalEvidence.id,
        );
        return row;
      },
    },
    {
      entityRef: "build-sdk",
      kind: "build-changed",
      revision: computeBuildRevision,
      rebind(value) {
        const row = value.builds.find((candidate) => candidate.id === this.entityRef);
        const originalEvidence = value.evidence.find(
          (candidate) => candidate.id === row.evidenceRef,
        );
        const replacement = {
          ...structuredClone(originalEvidence),
          id: "evidence-build-sdk-rebound",
          sourceRef: "controlled://ci/acme/sdk/runs/180/rebound",
          sourceRecordDigest: `sha256:${"7".repeat(64)}`,
        };
        row.evidenceRef = replacement.id;
        row.evidenceDigest = replacement.sourceRecordDigest;
        replacement.revision = this.revision(row);
        value.evidence.push(replacement);
        value.evidence = value.evidence.filter(
          (candidate) => candidate.id !== originalEvidence.id,
        );
        return row;
      },
    },
  ];

  for (const scenario of cases) {
    const originalRevision = scenario.revision(
      fixture.pullRequests.find((row) => row.id === scenario.entityRef) ??
        fixture.reviews.find((row) => row.id === scenario.entityRef) ??
        fixture.builds.find((row) => row.id === scenario.entityRef),
    );
    const rebound = mutate((value) => {
      scenario.rebind(value);
    });
    const reboundRow =
      rebound.pullRequests.find((row) => row.id === scenario.entityRef) ??
      rebound.reviews.find((row) => row.id === scenario.entityRef) ??
      rebound.builds.find((row) => row.id === scenario.entityRef);
    const reboundRevision = scenario.revision(reboundRow);

    assert.notEqual(reboundRevision, originalRevision);
    assertHas(rebound, "invalid_checkpoint_delta");

    const reconciled = structuredClone(rebound);
    reconcileChangedRevision(reconciled, scenario.entityRef, scenario.kind, reboundRevision);
    assert.deepEqual(findings(resealRepositoryOperationsArtifact(reconciled)), []);
  }
});

test("build artifacts require exact build, head, digest, and provenance binding", () => {
  const clawAuthoredEvidence = mutate((value) => {
    value.evidence.find((row) => row.id === "evidence-build-sdk").authorRef =
      "principal-repository-operations-claw";
    value.evidence.find((row) => row.id === "evidence-artifact-sdk").authorRef =
      "principal-repository-operations-claw";
  });

  test("artifact provenance subjects are exact", () => {
    assertHas(
      mutate((value) => {
        value.evidence.find((row) => row.id === "evidence-artifact-sdk").subjectRefs.push(
          "repo-api",
        );
      }),
      "invalid_build_artifact_provenance",
    );
  });
  assertHas(clawAuthoredEvidence, "invalid_evidence_record");
  assertHas(
    mutate((value) => {
      value.builds.find((row) => row.id === "build-api-new").state = "succeeded";
    }),
    "invalid_head_bound_build",
  );
  assertHas(
    mutate((value) => {
      value.artifacts[0].headSha = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    }),
    "invalid_build_artifact_provenance",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-artifact-sdk").digest =
        `sha256:${"f".repeat(64)}`;
    }),
    "invalid_build_artifact_provenance",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-artifact-sdk").observedAt =
        "2026-09-13T16:30:00Z";
    }),
    "invalid_build_artifact_provenance",
  );
  const predatesBuild = mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-artifact-sdk").observedAt =
        "2026-09-12T14:04:59Z";
    });
  assertHas(predatesBuild, "invalid_build_artifact_provenance");
  assertHas(
    mutate((value) => {
      value.builds.find((row) => row.id === "build-api-old").artifactRefs = [
        "artifact-sdk",
      ];
    }),
    "invalid_head_bound_build",
  );
});

test("artifact state remains coherent without collapsing missing and failed evidence", () => {
  for (const state of ["missing", "failed"]) {
    const value = mutate((candidate) => {
      candidate.artifacts.find((row) => row.id === "artifact-cli").state = state;
      candidate.pullRequests.find((row) => row.id === "pr-cli-9").readiness = "blocked";
    });
    assertNotHas(value, "invalid_build_artifact_provenance");
  }
  assertHas(
    mutate((value) => {
      value.artifacts.find((row) => row.id === "artifact-api-failed").state = "verified";
    }),
    "invalid_build_artifact_provenance",
  );
});

test("release entries require repository-local build, artifact, and snapshot closure", () => {
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-release").revision =
        "unrelated-release";
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.releaseTrains[0].entries[1].artifactRefs = ["artifact-cli"];
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.artifacts.find((row) => row.id === "artifact-sdk").snapshotRef =
        "snapshot-artifact-cli";
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.releaseTrains[0].entries[1].artifactRefs = ["artifact-does-not-exist"];
    }),
    "invalid_release_entry",
  );
  assertNotHas(fixture, "invalid_release_entry");
});

test("release entries reject ambiguous repository and head PR matches", () => {
  const value = mutate((candidate) => {
    const original = candidate.pullRequests.find((row) => row.id === "pr-sdk-18");
    const duplicate = structuredClone(original);
    duplicate.id = "pr-sdk-duplicate";
    duplicate.number = original.number;
    duplicate.sourceEvidenceRef = "evidence-pr-sdk-duplicate";
    duplicate.sourceEvidenceDigest = `sha256:${"a".repeat(64)}`;
    duplicate.reviewRefs = [];
    duplicate.checkRefs = [];
    duplicate.buildRefs = [];
    duplicate.artifactRefs = [];
    duplicate.blockerRefs = [];
    duplicate.readiness = "blocked";
    candidate.pullRequests.push(duplicate);
    candidate.evidence.push({
      id: duplicate.sourceEvidenceRef,
      kind: "pull-request",
      sourceRef: "controlled://github/acme/sdk/pulls/181",
      sourceRecordDigest: duplicate.sourceEvidenceDigest,
      observedAt: "2026-09-13T15:19:00Z",
      authorRef: "principal-source-system",
      subjectRefs: [duplicate.id, duplicate.repositoryRef],
      revision: computePullRequestSourceRevision(duplicate),
    });
  });
  assertHas(value, "duplicate_identity");
  assertHas(value, "invalid_release_entry");
  assertNotHas(fixture, "invalid_release_entry");
});

test("release evidence binds every entry field and entry order is unique", () => {
  assertHas(
    mutate((value) => {
      const entry = value.releaseTrains[0].entries.find(
        (row) => row.repositoryRef === "repo-cli",
      );
      entry.state = "failed";
      value.blockers.find((row) => row.id === "blocker-cli-rollback").category =
        "failed-release";
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.releaseTrains[0].entries.find(
        (row) => row.repositoryRef === "repo-cli",
      ).order = 2;
    }),
    "invalid_release_entry",
  );
  assertNotHas(fixture, "invalid_release_entry");
});

test("release trains resolve one exact evidence record and evidence rebinding changes the delta", () => {
  const duplicateSubjectEvidence = mutate((value) => {
    const releaseEvidence = value.evidence.find((row) => row.id === "evidence-release");
    value.evidence.push({
      ...structuredClone(releaseEvidence),
      id: "evidence-release-unreferenced",
      sourceRef: "controlled://release/train-weekly/revision/8/unreferenced",
      sourceRecordDigest: `sha256:${"8".repeat(64)}`,
    });
  });
  assertNotHas(duplicateSubjectEvidence, "invalid_release_entry");

  assertHas(
    mutate((value) => {
      value.releaseTrains[0].releaseEvidenceRef = "evidence-dependency";
    }),
    "invalid_release_entry",
  );

  const originalRevision = computeReleaseEvidenceRevision(fixture.releaseTrains[0]);
  const rebound = mutate((value) => {
    const train = value.releaseTrains[0];
    const originalEvidence = value.evidence.find(
      (row) => row.id === train.releaseEvidenceRef,
    );
    const replacementEvidence = {
      ...structuredClone(originalEvidence),
      id: "evidence-release-rebound",
      sourceRef: "controlled://release/train-weekly/revision/8/rebound",
      sourceRecordDigest: `sha256:${"8".repeat(64)}`,
    };
    train.releaseEvidenceRef = replacementEvidence.id;
    train.releaseEvidenceDigest = replacementEvidence.sourceRecordDigest;
    replacementEvidence.revision = computeReleaseEvidenceRevision(train);
    value.evidence.push(replacementEvidence);

    for (const blocker of value.blockers.filter((row) =>
      row.evidenceRefs.includes(originalEvidence.id),
    )) {
      blocker.evidenceRefs = [replacementEvidence.id];
    }

    const request = value.escalations.find(
      (row) => row.id === "escalation-train-release",
    );
    request.targetRevision = replacementEvidence.revision;
    request.evidenceRef = replacementEvidence.id;
    request.evidenceRevision = replacementEvidence.revision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRevision = request.targetRevision;
    response.evidenceRevision = request.evidenceRevision;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
    value.evidence = value.evidence.filter((row) => row.id !== originalEvidence.id);
  });
  const reboundRevision = computeReleaseEvidenceRevision(rebound.releaseTrains[0]);

  assert.notEqual(reboundRevision, originalRevision);
  assertNotHas(rebound, "invalid_release_entry");
  assertHas(rebound, "invalid_checkpoint_delta");

  const reconciled = structuredClone(rebound);
  reconcileChangedRevision(
    reconciled,
    "train-weekly",
    "release-changed",
    reboundRevision,
  );
  assert.deepEqual(findings(resealRepositoryOperationsArtifact(reconciled)), []);
});

test("release evidence follows producing evidence and precedes its snapshot", () => {
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-release").observedAt =
        "2026-09-13T15:18:00Z";
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-release").observedAt =
        "2026-09-11T14:04:59Z";
    }),
    "invalid_release_entry",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-release").observedAt =
        "2026-09-13T15:45:01Z";
    }),
    "invalid_release_entry",
  );
  const lateReview = mutate((value) => {
    const review = value.reviews.find((row) => row.id === "review-sdk-current");
    const reviewEvidence = value.evidence.find((row) => row.id === review.evidenceRef);
    review.submittedAt = "2026-09-13T15:46:00Z";
    reviewEvidence.observedAt = review.submittedAt;
    value.snapshots.find((row) => row.id === review.snapshotRef).capturedAt =
      "2026-09-13T15:50:00Z";
    reviewEvidence.revision = computeReviewRevision(review);
    reconcileChangedRevision(value, review.id, "review-changed", reviewEvidence.revision);
  });
  assertNotHas(lateReview, "invalid_head_bound_review");
  assertHas(lateReview, "invalid_release_entry");

  const lateRequiredCheck = mutate((value) => {
    const check = value.checks.find((row) => row.id === "check-sdk-current");
    const checkEvidence = value.evidence.find((row) => row.id === check.evidenceRef);
    check.completedAt = "2026-09-13T15:46:00Z";
    checkEvidence.observedAt = check.completedAt;
    value.snapshots.find((row) => row.id === check.snapshotRef).capturedAt =
      "2026-09-13T15:50:00Z";
    checkEvidence.revision = computeCheckRevision(check);
    reconcileChangedRevision(value, check.id, "check-changed", checkEvidence.revision);
  });
  assertNotHas(lateRequiredCheck, "invalid_head_bound_check");
  assertHas(lateRequiredCheck, "invalid_release_entry");

  const unrelatedMemberOutput = mutate((value) => {
    const pullRequest = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    const build = {
      ...structuredClone(value.builds.find((row) => row.id === "build-sdk")),
      id: "build-sdk-non-release",
      runId: "run-sdk-181",
      artifactRefs: ["artifact-sdk-non-release"],
      snapshotRef: "snapshot-build-sdk-non-release",
      evidenceRef: "evidence-build-sdk-non-release",
      evidenceDigest: `sha256:${"e".repeat(64)}`,
    };
    const artifact = {
      ...structuredClone(value.artifacts.find((row) => row.id === "artifact-sdk")),
      id: "artifact-sdk-non-release",
      buildRef: build.id,
      digest: `sha256:${"9".repeat(64)}`,
      provenanceEvidenceRef: "evidence-artifact-sdk-non-release",
      snapshotRef: "snapshot-artifact-sdk-non-release",
    };
    value.snapshots.push(
      {
        ...structuredClone(
          value.snapshots.find((row) => row.id === "snapshot-build-sdk"),
        ),
        id: build.snapshotRef,
        capturedAt: "2026-09-13T15:50:00Z",
        sourceUri: "controlled://ci/acme/sdk/runs/181/snapshot",
        sourceRecordDigest: `sha256:${"a".repeat(64)}`,
        completenessRoot: `sha256:${"b".repeat(64)}`,
      },
      {
        ...structuredClone(
          value.snapshots.find((row) => row.id === "snapshot-artifact-sdk"),
        ),
        id: artifact.snapshotRef,
        capturedAt: "2026-09-13T15:50:00Z",
        sourceUri: "controlled://ci/artifacts/sdk/181/snapshot",
        sourceRecordDigest: `sha256:${"c".repeat(64)}`,
        completenessRoot: `sha256:${"d".repeat(64)}`,
      },
    );
    value.evidence.push(
      {
        id: build.evidenceRef,
        kind: "build",
        sourceRef: "controlled://ci/acme/sdk/runs/181",
        sourceRecordDigest: build.evidenceDigest,
        observedAt: "2026-09-13T15:46:00Z",
        authorRef: "principal-source-system",
        subjectRefs: [build.id, pullRequest.id],
        revision: computeBuildRevision(build),
      },
      {
        id: artifact.provenanceEvidenceRef,
        kind: "artifact-provenance",
        sourceRef: "controlled://ci/artifacts/sdk/181",
        sourceRecordDigest: `sha256:${"f".repeat(64)}`,
        observedAt: "2026-09-13T15:47:00Z",
        authorRef: "principal-source-system",
        subjectRefs: [artifact.id, build.id],
        revision: artifact.headSha,
        digest: artifact.digest,
      },
    );
    value.builds.push(build);
    value.artifacts.push(artifact);
    pullRequest.buildRefs.push(build.id);
    pullRequest.artifactRefs.push(artifact.id);
    value.delta.entries.push({
      id: "delta-build-sdk-non-release",
      entityRef: build.id,
      kind: "opened",
      beforeRevision: null,
      afterRevision: computeBuildRevision(build),
    });
  });
  assert.deepEqual(findings(unrelatedMemberOutput), []);
  assertNotHas(fixture, "invalid_release_entry");
});

test("PR validation consumes complete check, build, and artifact validity", () => {
  const invalidCheck = mutate((value) => {
    value.checks.find((row) => row.id === "check-sdk-current").snapshotRef =
      "snapshot-artifact-sdk";
  });
  assertHas(invalidCheck, "invalid_head_bound_check");

  const invalidBuildEvidence = mutate((value) => {
    value.evidence.find((row) => row.id === "evidence-build-sdk").sourceRecordDigest =
      "not-a-digest";
  });
  assertHas(invalidBuildEvidence, "invalid_head_bound_build");

  const invalidArtifactEvidence = mutate((value) => {
    value.evidence.find((row) => row.id === "evidence-artifact-sdk").revision =
      "wrong-head";
  });
  assertHas(invalidArtifactEvidence, "invalid_build_artifact_provenance");
});

test("cross-repository dependency and release ordering never imply readiness", () => {
  assertHas(
    mutate((value) => {
      value.dependencies[0].state = "satisfied";
    }),
    "invalid_cross_repository_dependency",
  );
  for (const state of ["partial", "failed", "rolled-back", "superseded"]) {
    const value = mutate((candidate) => {
      candidate.releaseTrains[0].state = state;
      candidate.readiness.portfolioState = "ready-for-owner-review";
      candidate.handoff.state = "ready-for-owner-review";
    });
    assertHas(value, "premature_readiness");
  }
  assertHas(
    mutate((value) => {
      value.releaseTrains[0].state = "released";
    }),
    "invalid_release_state",
  );
  assertHas(
    mutate((value) => {
      value.releaseTrains[0].state = "released";
      value.releaseTrains[0].entries[0].state = "planned";
    }),
    "invalid_release_state",
  );
  const falseCleanRelease = mutate((value) => {
    value.blockers = value.blockers.filter((row) => row.id !== "blocker-cli-rollback");
    value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
      (ref) => ref !== "blocker-cli-rollback",
    );
    value.readiness.releaseTrainStates[0].blockerRefs =
      value.readiness.releaseTrainStates[0].blockerRefs.filter(
        (ref) => ref !== "blocker-cli-rollback",
      );
    const cliReadiness = value.readiness.repositoryStates.find(
      (row) => row.subjectRef === "repo-cli",
    );
    cliReadiness.blockerRefs = [];
    cliReadiness.state = "ready-for-owner-review";
  });
  assertHas(falseCleanRelease, "missing_required_blocker");
  assertHas(falseCleanRelease, "invalid_repository_readiness");
});

test("invalid release evidence blocks each declared member PR", () => {
  const value = mutate((candidate) => {
    const train = candidate.releaseTrains[0];
    train.state = "released";
    const releaseRevision = computeReleaseEvidenceRevision(train);
    const releaseEvidence = candidate.evidence.find(
      (row) => row.id === train.releaseEvidenceRef,
    );
    releaseEvidence.revision = releaseRevision;
    reconcileChangedRevision(candidate, train.id, "release-changed", releaseRevision);

    const request = candidate.escalations.find(
      (row) => row.id === "escalation-train-release",
    );
    request.targetRevision = releaseRevision;
    request.evidenceRevision = releaseRevision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = candidate.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRevision = releaseRevision;
    response.evidenceRevision = releaseRevision;
    candidate.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    candidate.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);

    candidate.blockers = candidate.blockers.filter(
      (row) => row.id !== "blocker-train-partial",
    );
    for (const pullRequest of candidate.pullRequests) {
      pullRequest.blockerRefs = pullRequest.blockerRefs.filter(
        (ref) => ref !== "blocker-train-partial",
      );
    }
    for (const repositoryState of candidate.readiness.repositoryStates) {
      repositoryState.blockerRefs = repositoryState.blockerRefs.filter(
        (ref) => ref !== "blocker-train-partial",
      );
    }
    candidate.readiness.releaseTrainStates[0].blockerRefs =
      candidate.readiness.releaseTrainStates[0].blockerRefs.filter(
        (ref) => ref !== "blocker-train-partial",
      );
    candidate.readiness.blockerRefs = candidate.readiness.blockerRefs.filter(
      (ref) => ref !== "blocker-train-partial",
    );

    candidate.pullRequests.find((row) => row.id === "pr-sdk-18").readiness =
      "ready-for-owner-review";
    releaseEvidence.sourceRecordDigest = `sha256:${"9".repeat(64)}`;
  });

  assertHas(value, "invalid_release_entry");
  assertHas(value, "invalid_pull_request_readiness");
});

test("dependency evidence binds kind, subjects, exact revision, and state", () => {
  assertHas(
    mutate((value) => {
      value.dependencies[0].downstreamRepositoryRef =
        value.dependencies[0].upstreamRepositoryRef;
    }),
    "invalid_cross_repository_dependency",
  );
  assertHas(
    mutate((value) => {
      value.dependencies[0].requirement = "SDK may release before the API.";
    }),
    "invalid_cross_repository_dependency",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-dependency").kind = "release";
    }),
    "invalid_cross_repository_dependency",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-dependency").subjectRefs.pop();
    }),
    "invalid_cross_repository_dependency",
  );
  assertHas(
    mutate((value) => {
      value.dependencies[0].evidenceRevision = "evidence-r8";
    }),
    "invalid_cross_repository_dependency",
  );
  assertNotHas(fixture, "invalid_cross_repository_dependency");
  const falseCleanDependency = mutate((value) => {
    value.blockers = value.blockers.filter((row) => row.id !== "blocker-dependency");
    value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
      (ref) => ref !== "blocker-dependency",
    );
    value.readiness.repositoryStates.find((row) => row.subjectRef === "repo-sdk").blockerRefs =
      value.readiness.repositoryStates
        .find((row) => row.subjectRef === "repo-sdk")
        .blockerRefs.filter((ref) => ref !== "blocker-dependency");
    value.readiness.releaseTrainStates[0].blockerRefs =
      value.readiness.releaseTrainStates[0].blockerRefs.filter(
        (ref) => ref !== "blocker-dependency",
      );
  });

  test("dependency evidence follows its release evidence within the release snapshot", () => {
    assertHas(
      mutate((value) => {
        value.evidence.find((row) => row.id === "evidence-dependency").observedAt =
          "2026-09-13T15:44:59Z";
      }),
      "invalid_cross_repository_dependency",
    );
    assertHas(
      mutate((value) => {
        value.evidence.find((row) => row.id === "evidence-dependency").observedAt =
          "2026-09-13T15:45:01Z";
      }),
      "invalid_cross_repository_dependency",
    );
    assertNotHas(fixture, "invalid_cross_repository_dependency");

    const dependency = structuredClone(fixture.dependencies[0]);
    const train = structuredClone(fixture.releaseTrains[0]);
    const upstream = train.entries[0];
    const downstream = train.entries[1];
    dependency.requirement = "a:b";
    train.revision = "c";
    const left = computeDependencyRevision(dependency, train, upstream, downstream);
    dependency.requirement = "a";
    train.revision = "b:c";
    assert.notEqual(
      left,
      computeDependencyRevision(dependency, train, upstream, downstream),
    );
  });
  assertHas(falseCleanDependency, "missing_required_blocker");
});

test("ordered releases preserve an explicit evidence-backed dependency blocker", () => {
  const bindReleaseEvidence = (value) => {
    const train = value.releaseTrains[0];
    const revision = computeReleaseEvidenceRevision(train);
    value.evidence.find((row) => row.id === train.releaseEvidenceRef).revision = revision;
    const request = value.escalations.find(
      (row) => row.id === "escalation-train-release",
    );
    request.targetRevision = revision;
    request.evidenceRevision = revision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRevision = revision;
    response.evidenceRevision = revision;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  };
  const bindDependencyEscalation = (value) => {
    const dependency = value.dependencies[0];
    const request = value.escalations.find(
      (row) => row.id === "escalation-dependency-risk",
    );
    request.targetRevision = dependency.evidenceRevision;
    request.evidenceRevision = dependency.evidenceRevision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRevision = request.targetRevision;
    response.evidenceRevision = request.evidenceRevision;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  };
  const orderedButBlocked = mutate((value) => {
    const dependency = value.dependencies[0];
    const train = value.releaseTrains[0];
    const upstream = train.entries.find(
      (row) => row.repositoryRef === dependency.upstreamRepositoryRef,
    );
    const downstream = train.entries.find(
      (row) => row.repositoryRef === dependency.downstreamRepositoryRef,
    );
    upstream.state = "released";
    bindReleaseEvidence(value);
    dependency.evidenceRevision = computeDependencyRevision(
      dependency,
      train,
      upstream,
      downstream,
    );
    value.evidence.find((row) => row.id === dependency.evidenceRef).revision =
      dependency.evidenceRevision;
    bindDependencyEscalation(value);
  });
  assertNotHas(orderedButBlocked, "invalid_cross_repository_dependency");
  assertNotHas(orderedButBlocked, "missing_required_blocker");

  const blockerRemoved = mutate((value) => {
    const dependency = value.dependencies[0];
    const train = value.releaseTrains[0];
    const upstream = train.entries.find(
      (row) => row.repositoryRef === dependency.upstreamRepositoryRef,
    );
    const downstream = train.entries.find(
      (row) => row.repositoryRef === dependency.downstreamRepositoryRef,
    );
    upstream.state = "released";
    bindReleaseEvidence(value);
    dependency.evidenceRevision = computeDependencyRevision(
      dependency,
      train,
      upstream,
      downstream,
    );
    value.evidence.find((row) => row.id === dependency.evidenceRef).revision =
      dependency.evidenceRevision;
    bindDependencyEscalation(value);
    value.blockers = value.blockers.filter((row) => row.id !== "blocker-dependency");
    value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
      (ref) => ref !== "blocker-dependency",
    );
    value.readiness.repositoryStates.find((row) => row.subjectRef === "repo-sdk").blockerRefs =
      value.readiness.repositoryStates
        .find((row) => row.subjectRef === "repo-sdk")
        .blockerRefs.filter((ref) => ref !== "blocker-dependency");
    value.readiness.releaseTrainStates[0].blockerRefs =
      value.readiness.releaseTrainStates[0].blockerRefs.filter(
        (ref) => ref !== "blocker-dependency",
      );
  });
  assertHas(blockerRemoved, "missing_required_blocker");

  const evidenceBackedSatisfaction = mutate((value) => {
    const dependency = value.dependencies[0];
    const train = value.releaseTrains[0];
    const upstream = train.entries.find(
      (row) => row.repositoryRef === dependency.upstreamRepositoryRef,
    );
    const downstream = train.entries.find(
      (row) => row.repositoryRef === dependency.downstreamRepositoryRef,
    );
    upstream.state = "released";
    dependency.state = "satisfied";
    bindReleaseEvidence(value);
    dependency.evidenceRevision = computeDependencyRevision(
      dependency,
      train,
      upstream,
      downstream,
    );
    value.evidence.find((row) => row.id === dependency.evidenceRef).revision =
      dependency.evidenceRevision;
    bindDependencyEscalation(value);
  });
  assertNotHas(evidenceBackedSatisfaction, "invalid_cross_repository_dependency");

  const invalidSatisfiedDependency = structuredClone(evidenceBackedSatisfaction);
  invalidSatisfiedDependency.evidence.find(
    (row) => row.id === invalidSatisfiedDependency.dependencies[0].evidenceRef,
  ).revision = "invalid-satisfied-dependency-evidence";
  invalidSatisfiedDependency.blockers = invalidSatisfiedDependency.blockers.filter(
    (row) => row.id !== "blocker-dependency",
  );
  invalidSatisfiedDependency.readiness.blockerRefs =
    invalidSatisfiedDependency.readiness.blockerRefs.filter(
      (ref) => ref !== "blocker-dependency",
    );
  const sdkReadiness = invalidSatisfiedDependency.readiness.repositoryStates.find(
    (row) => row.subjectRef === "repo-sdk",
  );
  sdkReadiness.blockerRefs = sdkReadiness.blockerRefs.filter(
    (ref) => ref !== "blocker-dependency",
  );
  sdkReadiness.state = "ready-for-owner-review";
  const invalidSatisfiedFindings = findings(
    resealRepositoryOperationsArtifact(invalidSatisfiedDependency),
  );
  assert.ok(
    invalidSatisfiedFindings.some(
      (row) => row.code === "invalid_cross_repository_dependency",
    ),
    JSON.stringify(invalidSatisfiedFindings, null, 2),
  );
  assert.ok(
    invalidSatisfiedFindings.some((row) => row.code === "missing_required_blocker"),
    JSON.stringify(invalidSatisfiedFindings, null, 2),
  );
  assert.ok(
    invalidSatisfiedFindings.some((row) => row.code === "invalid_repository_readiness"),
    JSON.stringify(invalidSatisfiedFindings, null, 2),
  );
});

test("escalations require exact authorization, recipient, deadline, dedupe, and receipt", () => {
  assertHas(
    mutate((value) => {
      value.escalations[0].recipientRef = "principal-risk-approver";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalations[0].deadline = "2026-09-14T15:00:00Z";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalations[1].dedupeKey = value.escalations[0].dedupeKey;
    }, false),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalationPolicy.routes[0].authorizationEvidenceRef = "evidence-route-risk";
    }),
    "invalid_escalation_route",
  );
  assertHas(
    mutate((value) => {
      value.escalations[0].dispatch.receiptEvidenceRef = "evidence-missing";
    }),
    "invalid_escalation_dispatch",
  );
  const duplicateDispatchIdentity = mutate((value) => {
    const first = value.escalations.find((row) => row.id === "escalation-api-merge");
    const duplicate = value.escalations.find(
      (row) => row.id === "escalation-train-release",
    );
    const duplicateRoute = value.escalationPolicy.routes.find(
      (row) => row.id === duplicate.routeRef,
    );
    duplicateRoute.destination = first.dispatch.destination;
    duplicate.dispatch.destination = first.dispatch.destination;
    duplicate.dispatch.providerMessageId = first.dispatch.providerMessageId;
    value.evidence.find(
      (row) => row.id === duplicateRoute.authorizationEvidenceRef,
    ).revision = computeEscalationRouteAuthorizationRevision(duplicateRoute);
    value.evidence.find(
      (row) => row.id === duplicate.dispatch.receiptEvidenceRef,
    ).revision = computeDispatchReceiptRevision(duplicate);
  });
  const duplicateDispatchFindings = findings(duplicateDispatchIdentity).filter(
    (row) => row.code === "invalid_escalation_dispatch",
  );
  assert.deepEqual(
    new Set(duplicateDispatchFindings.flatMap((row) => row.refs)),
    new Set(["escalation-api-merge", "escalation-train-release"]),
  );
  assertHas(
    mutate((value) => {
      value.escalations[1].dispatch.receiptEvidenceRef =
        value.escalations[0].dispatch.receiptEvidenceRef;
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-dispatch-merge").authorRef =
        "principal-repository-operations-claw";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalations[0].targetRevision = "pr-api-41@stale";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalations[0].evidenceRevision = "invented-evidence";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-api-review").observedAt =
        "2026-09-13T16:00:01Z";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalationPolicy.routes[0].destination =
        "controlled://teams/unapproved-destination";
    }),
    "invalid_escalation_route",
  );
  const bareDestination = clone();
  bareDestination.escalationPolicy.routes[0].destination = "controlled://";
  assert.equal(validateSchema(bareDestination), false);
  assertHas(
    mutate((value) => {
      value.escalations[0].dispatch.destination =
        "controlled://teams/unapproved-destination";
    }),
    "invalid_escalation_dispatch",
  );
  assertHas(
    mutate((value) => {
      value.escalationPolicy.routes.push(structuredClone(value.escalationPolicy.routes[0]));
    }),
    "duplicate_identity",
  );
  for (const route of fixture.escalationPolicy.routes) {
    const authorization = fixture.evidence.find(
      (row) => row.id === route.authorizationEvidenceRef,
    );
    assert.equal(
      authorization.revision,
      computeEscalationRouteAuthorizationRevision(route),
    );
  }
  for (const escalation of fixture.escalations) {
    const receipt = fixture.evidence.find(
      (row) => row.id === escalation.dispatch.receiptEvidenceRef,
    );
    assert.equal(receipt.revision, computeDispatchReceiptRevision(escalation));
  }
  assertHas(
    mutate((value) => {
      const blocker = value.blockers.find((row) => row.id === "blocker-approval-rejected");
      blocker.subjectRefs = blocker.subjectRefs.filter((ref) => ref !== "train-weekly");
    }),
    "missing_required_blocker",
  );
  const falseCleanEscalation = mutate((value) => {
    const removed = new Set(["blocker-dependency", "blocker-approval-no-response"]);
    value.blockers = value.blockers.filter((row) => !removed.has(row.id));
    value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
      (ref) => !removed.has(ref),
    );
    value.readiness.repositoryStates.find((row) => row.subjectRef === "repo-sdk").state =
      "ready-for-owner-review";
    value.readiness.repositoryStates.find(
      (row) => row.subjectRef === "repo-sdk",
    ).blockerRefs = [];
    value.readiness.releaseTrainStates[0].blockerRefs =
      value.readiness.releaseTrainStates[0].blockerRefs.filter((ref) => !removed.has(ref));
  });
  assertHas(falseCleanEscalation, "missing_required_blocker");
  assertHas(falseCleanEscalation, "invalid_repository_readiness");
});

test("unanswered escalations remain dispatched through the exact deadline", () => {
  const withoutRiskResponse = (value, deadline) => {
    const request = value.escalations.find(
      (row) => row.id === "escalation-dependency-risk",
    );
    const responseRef = request.responseRef;
    const response = value.responses.find((row) => row.id === responseRef);
    const blocker = value.blockers.find(
      (row) => row.id === "blocker-approval-no-response",
    );
    request.deadline = deadline;
    request.responseRef = null;
    request.state = "dispatched";
    value.responses = value.responses.filter((row) => row.id !== responseRef);
    value.evidence = value.evidence.filter((row) => row.id !== response.evidenceRef);
    blocker.category = "approval-required";
    blocker.subjectRefs = [request.id, request.targetRef];
    blocker.evidenceRefs = [request.dispatch.receiptEvidenceRef];
    value.evidence.find(
      (row) => row.id === request.dispatch.receiptEvidenceRef,
    ).revision = computeDispatchReceiptRevision(request);
  };

  for (const deadline of ["2026-09-13T17:00:01Z", AS_OF]) {
    const value = mutate((candidate) => withoutRiskResponse(candidate, deadline));
    assertNotHas(value, "missing_response_evidence");
    assertNotHas(value, "invalid_escalation_state");
    assertNotHas(value, "invalid_blocker");
  }

  assertHas(
    mutate((value) => withoutRiskResponse(value, "2026-09-13T16:59:59Z")),
    "missing_response_evidence",
  );

  const exactDeadlineEvidence = mutate((value) => {
    const request = value.escalations.find(
      (row) => row.id === "escalation-dependency-risk",
    );
    const response = value.responses.find((row) => row.id === request.responseRef);
    const responseEvidence = value.evidence.find((row) => row.id === response.evidenceRef);
    request.deadline = response.authoredAt;
    responseEvidence.revision = computeApprovalResponseRevision(response);
    value.evidence.find(
      (row) => row.id === request.dispatch.receiptEvidenceRef,
    ).revision = computeDispatchReceiptRevision(request);
  });
  assertHas(exactDeadlineEvidence, "invalid_independent_response");
  assertNotHas(fixture, "invalid_independent_response");
});

test("escalation categories require compatible target entity types", () => {
  const incompatible = mutate((value) => {
    const request = value.escalations.find((row) => row.id === "escalation-api-merge");
    const route = value.escalationPolicy.routes.find((row) => row.id === request.routeRef);
    route.allowedCategory = "risk-decision";
    request.category = "risk-decision";
    value.evidence.find((row) => row.id === route.authorizationEvidenceRef).revision =
      computeEscalationRouteAuthorizationRevision(route);
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  });
  assertHas(incompatible, "invalid_escalation_dispatch");
  assertNotHas(fixture, "invalid_escalation_dispatch");

  const changeRequest = mutate((value) => {
    const request = value.escalations.find((row) => row.id === "escalation-api-merge");
    const route = value.escalationPolicy.routes.find((row) => row.id === request.routeRef);
    route.allowedCategory = "change-request";
    request.category = "change-request";
    value.principals
      .find((row) => row.id === request.recipientRef)
      .scopes.push("decision-authority:change-request");
    value.evidence.find((row) => row.id === route.authorizationEvidenceRef).revision =
      computeEscalationRouteAuthorizationRevision(route);
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  });
  assert.deepEqual(findings(changeRequest), []);
});

test("cyclic escalation and response targets produce a structured finding", () => {
  const value = mutate((candidate) => {
    const first = candidate.escalations.find(
      (row) => row.id === "escalation-api-merge",
    );
    const second = candidate.escalations.find(
      (row) => row.id === "escalation-train-release",
    );
    first.targetRef = second.responseRef;
    second.targetRef = first.responseRef;
  });

  let result;
  assert.doesNotThrow(() => {
    result = findings(value);
  });
  assert.ok(
    result.some((row) => row.code === "cyclic_subject_reference"),
    JSON.stringify(result, null, 2),
  );
});

test("responses must be independently authored and exactly request/revision bound", () => {
  assertHas(
    mutate((value) => {
      const response = value.responses[0];
      response.authorRef = "principal-reviewer";
      value.evidence.find((row) => row.id === response.evidenceRef).authorRef =
        "principal-reviewer";
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      value.responses[1].outcome = "approved";
      value.escalations[1].state = "approved";
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      const response = value.responses[0];
      response.authorRef = "principal-repository-operations-claw";
      value.evidence.find((row) => row.id === response.evidenceRef).authorRef =
        "principal-repository-operations-claw";
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      value.responses[0].targetRevision = "pr-api-41@stale";
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      const request = value.escalations.find((row) => row.id === "escalation-dependency-risk");
      request.responseRef = null;
      request.state = "dispatched";
      value.responses = value.responses.filter((row) => row.id !== "response-risk-no-response");
    }),
    "missing_response_evidence",
  );
});

test("responses bind one-to-one and cannot predate dispatch", () => {
  assertHas(
    mutate((value) => {
      value.escalations[1].responseRef = "response-api-approved";
      value.escalations[1].state = "approved";
    }),
    "invalid_response_binding",
  );
  assertHas(
    mutate((value) => {
      value.responses[0].authoredAt = "2026-09-12T15:59:59Z";
      value.evidence.find((row) => row.id === "evidence-response-approved").observedAt =
        "2026-09-12T15:59:59Z";
    }),
    "invalid_independent_response",
  );
});

test("human decisions and system deadline observations require distinct exact authority", () => {
  const decision = fixture.responses.find((row) => row.id === "response-api-approved");
  const decisionRequest = fixture.escalations.find((row) => row.id === decision.requestRef);
  const decisionAuthor = fixture.principals.find((row) => row.id === decision.authorRef);
  assert.equal(decision.kind, "human-decision");
  assert.equal(decisionAuthor.kind, "human");
  assert.equal(decision.authorRef, decisionRequest.recipientRef);
  assert.ok(
    decisionAuthor.scopes.includes(`decision-authority:${decisionRequest.category}`),
  );

  const observation = fixture.responses.find(
    (row) => row.id === "response-risk-no-response",
  );
  const observationRequest = fixture.escalations.find(
    (row) => row.id === observation.requestRef,
  );
  const observationAuthor = fixture.principals.find(
    (row) => row.id === observation.authorRef,
  );
  assert.equal(observation.kind, "deadline-observation");
  assert.equal(observationAuthor.kind, "system");
  assert.ok(
    observationAuthor.scopes.includes(
      `trusted-deadline-observer:${observationRequest.category}`,
    ),
  );

  assertHas(
    mutate((value) => {
      value.principals
        .find((row) => row.id === "principal-release-approver")
        .scopes = ["eligible-approver"];
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      const response = value.responses.find((row) => row.id === "response-api-approved");
      const evidence = value.evidence.find((row) => row.id === response.evidenceRef);
      const system = value.principals.find(
        (row) => row.id === "principal-approval-observer",
      );
      system.scopes.push("eligible-approver", "decision-authority:merge-approval");
      response.authorRef = system.id;
      evidence.authorRef = system.id;
      evidence.revision = computeApprovalResponseRevision(response);
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      const response = value.responses.find(
        (row) => row.id === "response-risk-no-response",
      );
      const evidence = value.evidence.find((row) => row.id === response.evidenceRef);
      const human = value.principals.find((row) => row.id === "principal-risk-approver");
      human.scopes.push("trusted-deadline-observer:risk-decision");
      response.authorRef = human.id;
      evidence.authorRef = human.id;
      evidence.revision = computeApprovalResponseRevision(response);
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      value.principals.find(
        (row) => row.id === "principal-approval-observer",
      ).scopes = ["trusted-deadline-observer:release-approval"];
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      const response = value.responses.find(
        (row) => row.id === "response-risk-no-response",
      );
      const evidence = value.evidence.find((row) => row.id === response.evidenceRef);
      const claw = value.principals.find(
        (row) => row.id === "principal-repository-operations-claw",
      );
      claw.scopes.push("trusted-deadline-observer:risk-decision");
      response.authorRef = claw.id;
      evidence.authorRef = claw.id;
      evidence.revision = computeApprovalResponseRevision(response);
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find(
        (row) => row.id === "evidence-response-approved",
      ).kind = "deadline-observation";
    }),
    "invalid_independent_response",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find(
        (row) => row.id === "evidence-response-no-response",
      ).kind = "decision-response";
    }),
    "invalid_independent_response",
  );

  const observationAsDecision = clone();
  observationAsDecision.responses.find(
    (row) => row.id === "response-risk-no-response",
  ).kind = "human-decision";
  assert.equal(validateSchema(observationAsDecision), false);
  const decisionAsObservation = clone();
  decisionAsObservation.responses.find(
    (row) => row.id === "response-api-approved",
  ).kind = "deadline-observation";
  assert.equal(validateSchema(decisionAsObservation), false);
});

test("only a fully valid escalation response resolves its exact PR request", () => {
  const retargetApprovedRequest = (value) => {
    const request = value.escalations.find((row) => row.id === "escalation-api-merge");
    const response = value.responses.find((row) => row.id === request.responseRef);
    const supportingEvidence = value.evidence.find(
      (row) => row.id === "evidence-review-sdk-current",
    );
    request.targetRef = "pr-sdk-18";
    request.targetRevision = computePullRequestSourceRevision(
      value.pullRequests.find((row) => row.id === "pr-sdk-18"),
    );
    request.evidenceRef = supportingEvidence.id;
    request.evidenceRevision = supportingEvidence.revision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRef = request.targetRef;
    response.targetRevision = request.targetRevision;
    response.evidenceRevision = request.evidenceRevision;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  };
  const accepted = mutate(retargetApprovedRequest);
  assert.deepEqual(findings(accepted), []);
  assert.equal(
    accepted.pullRequests.find((row) => row.id === "pr-sdk-18").readiness,
    "blocked",
  );

  const invalidResponses = [
    (value, response, responseEvidence) => {
      response.authorRef = "principal-reviewer";
      responseEvidence.authorRef = response.authorRef;
      responseEvidence.revision = computeApprovalResponseRevision(response);
    },
    (_value, response) => {
      response.requestRef = "escalation-train-release";
    },
    (_value, response) => {
      response.targetRef = "pr-api-41";
    },
    (_value, response) => {
      response.targetRevision = "pr-sdk-18@stale";
    },
    (_value, _response, responseEvidence) => {
      responseEvidence.kind = "review";
    },
    (_value, response, responseEvidence) => {
      response.authoredAt = "2026-09-13T15:59:59Z";
      responseEvidence.observedAt = response.authoredAt;
      responseEvidence.revision = computeApprovalResponseRevision(response);
    },
  ];
  for (const invalidate of invalidResponses) {
    const value = mutate((candidate) => {
      retargetApprovedRequest(candidate);
      const request = candidate.escalations.find(
        (row) => row.id === "escalation-api-merge",
      );
      const response = candidate.responses.find((row) => row.id === request.responseRef);
      const responseEvidence = candidate.evidence.find(
        (row) => row.id === response.evidenceRef,
      );
      invalidate(candidate, response, responseEvidence);
    });
    assertHas(value, "invalid_independent_response");
    assertHas(value, "invalid_escalation_state");
    assertHas(value, "missing_required_blocker");
  }

  const blocked = mutate((value) => {
    retargetApprovedRequest(value);
    const request = value.escalations.find((row) => row.id === "escalation-api-merge");
    const response = value.responses.find((row) => row.id === request.responseRef);
    const responseEvidence = value.evidence.find((row) => row.id === response.evidenceRef);
    response.authorRef = "principal-reviewer";
    responseEvidence.authorRef = response.authorRef;
    responseEvidence.revision = computeApprovalResponseRevision(response);
    request.state = "dispatched";
    const blockerId = "blocker-sdk-approval-required";
    value.blockers.push({
      id: blockerId,
      category: "approval-required",
      subjectRefs: [request.id, request.targetRef],
      ownerRef: request.recipientRef,
      evidenceRefs: [request.dispatch.receiptEvidenceRef],
      state: "open",
      resolutionEvidenceRef: null,
    });
    value.pullRequests.find((row) => row.id === request.targetRef).blockerRefs.push(blockerId);
    value.pullRequests.find((row) => row.id === request.targetRef).readiness = "blocked";
    value.readiness.repositoryStates
      .find((row) => row.subjectRef === "repo-sdk")
      .blockerRefs.push(blockerId);
    value.readiness.releaseTrainStates[0].blockerRefs.push(blockerId);
    value.readiness.blockerRefs.push(blockerId);
  });
  assertHas(blocked, "invalid_independent_response");
  assertNotHas(blocked, "invalid_escalation_state");
  assertNotHas(blocked, "missing_required_blocker");
  assertNotHas(blocked, "invalid_pull_request_readiness");
  assertNotHas(blocked, "invalid_release_train_readiness");
});

test("change-request and expiry evidence retain exact independent binding", () => {
  const changeRequested = mutate((value) => {
    value.responses[0].outcome = "change-requested";
    value.escalations[0].state = "change-requested";
    value.evidence.find((row) => row.id === "evidence-response-approved").revision =
      computeApprovalResponseRevision(value.responses[0]);
    value.blockers.push({
      id: "blocker-approval-change-requested",
      category: "approval-change-requested",
      subjectRefs: [
        "escalation-api-merge",
        "pr-api-41",
        "response-api-approved",
      ],
      ownerRef: "principal-release-approver",
      evidenceRefs: ["evidence-response-approved"],
      state: "open",
      resolutionEvidenceRef: null,
    });
    value.pullRequests
      .find((row) => row.id === "pr-api-41")
      .blockerRefs.push("blocker-approval-change-requested");
    value.readiness.repositoryStates
      .find((row) => row.subjectRef === "repo-api")
      .blockerRefs.push("blocker-approval-change-requested");
    value.readiness.releaseTrainStates[0].blockerRefs.push(
      "blocker-approval-change-requested",
    );
    value.readiness.blockerRefs.push("blocker-approval-change-requested");
  });
  assert.deepEqual(findings(changeRequested), []);

  const expired = mutate((value) => {
    value.responses[2].outcome = "expired";
    value.escalations[2].state = "expired";
    value.evidence.find((row) => row.id === "evidence-response-no-response").revision =
      computeApprovalResponseRevision(value.responses[2]);
    value.blockers.find((row) => row.id === "blocker-approval-no-response").category =
      "approval-expired";
  });
  assert.deepEqual(findings(expired), []);
  assertHas(
    mutate((value) => {
      const request = value.escalations[2];
      const response = value.responses.find((row) => row.id === request.responseRef);
      response.outcome = "expired";
      response.authoredAt = request.deadline;
      request.state = "expired";
      const responseEvidence = value.evidence.find(
        (row) => row.id === response.evidenceRef,
      );
      responseEvidence.observedAt = response.authoredAt;
      responseEvidence.revision = computeApprovalResponseRevision(response);
      value.blockers.find((row) => row.id === "blocker-approval-no-response").category =
        "approval-expired";
    }),
    "invalid_independent_response",
  );
});

test("missing evidence and every unresolved state block readiness", () => {
  assertHas(
    mutate((value) => {
      const check = value.checks.find((row) => row.id === "check-cli-current");
      check.state = "pending";
      check.completedAt = null;
      value.blockers.push({
        id: "blocker-wrong-owner",
        category: "missing-evidence",
        subjectRefs: ["pr-cli-9", "check-cli-current"],
        ownerRef: "principal-repository-operations-claw",
        evidenceRefs: [],
        state: "open",
        resolutionEvidenceRef: null,
      });

      test("absent current checks and builds accept an exact PR-level missing-evidence blocker", () => {
        const value = mutate((candidate) => {
          const pullRequest = candidate.pullRequests.find((row) => row.id === "pr-sdk-18");
          candidate.checks.find((row) => row.id === "check-sdk-current").headSha =
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          candidate.builds.find((row) => row.id === "build-sdk").headSha =
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          removeResolvedMissingEvidenceHistory(candidate);
          pullRequest.artifactRefs = [];
          pullRequest.blockerRefs = ["blocker-sdk-missing-current-evidence"];
          pullRequest.readiness = "blocked";
          candidate.blockers.push({
            id: "blocker-sdk-missing-current-evidence",
            category: "missing-evidence",
            subjectRefs: [pullRequest.id],
            ownerRef: "principal-sdk-owner",
            evidenceRefs: [],
            state: "open",
            resolutionEvidenceRef: null,
          });
          const repositoryState = candidate.readiness.repositoryStates.find(
            (row) => row.subjectRef === "repo-sdk",
          );
          repositoryState.blockerRefs.push("blocker-sdk-missing-current-evidence");
          repositoryState.state = "blocked";
          candidate.readiness.releaseTrainStates[0].blockerRefs.push(
            "blocker-sdk-missing-current-evidence",
          );
          candidate.readiness.blockerRefs.push("blocker-sdk-missing-current-evidence");
        });
        assertNotHas(value, "invalid_blocker");
      });
    }),
    "invalid_blocker",
  );
  assertHas(
    mutate((value) => {
      value.blockers.push({
        id: "blocker-fabricated-build",
        category: "failed-build",
        subjectRefs: ["principal-portfolio-custodian"],
        ownerRef: "principal-portfolio-custodian",
        evidenceRefs: ["evidence-roster"],
        state: "open",
        resolutionEvidenceRef: null,
      });
      value.readiness.blockerRefs.push("blocker-fabricated-build");
    }),
    "invalid_blocker",
  );
  assertHas(
    mutate((value) => {
      value.readiness.portfolioState = "ready-for-owner-review";
      value.handoff.state = "ready-for-owner-review";
    }),
    "premature_readiness",
  );
  assertHas(
    mutate((value) => {
      value.readiness.blockerRefs.pop();
    }),
    "premature_readiness",
  );
  assertHas(
    mutate((value) => {
      value.pullRequests.find((row) => row.id === "pr-api-41").checkRefs = [];
    }),
    "missing_required_check_evidence",
  );
  assertHas(
    mutate((value) => {
      value.repositories.find((row) => row.id === "repo-sdk").requiredCheckContexts.push(
        "security-scan",
      );
    }),
    "missing_required_check_evidence",
  );
  assertHas(
    mutate((value) => {
      value.pullRequests.find((row) => row.id === "pr-api-41").blockerRefs = [];
    }),
    "invalid_pull_request_blockers",
  );
  assertHas(
    mutate((value) => {
      value.blockers = value.blockers.filter((row) => row.id !== "blocker-api-build");
      value.pullRequests.find((row) => row.id === "pr-api-41").blockerRefs =
        value.pullRequests
          .find((row) => row.id === "pr-api-41")
          .blockerRefs.filter((ref) => ref !== "blocker-api-build");
      value.readiness.repositoryStates.find(
        (row) => row.subjectRef === "repo-api",
      ).blockerRefs = value.readiness.repositoryStates
        .find((row) => row.subjectRef === "repo-api")
        .blockerRefs.filter((ref) => ref !== "blocker-api-build");
      value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
        (ref) => ref !== "blocker-api-build",
      );
    }),
    "missing_required_blocker",
  );
});

test("insufficient reviews require and accept correctly owned missing-evidence blockers", () => {
  const applyInsufficientReviewPolicy = (value) => {
    const repository = value.repositories.find((row) => row.id === "repo-sdk");
    repository.requiredApprovalCount = 2;
    repository.eligibleReviewerRefs.push("principal-second-reviewer");
    value.principals.push({
      id: "principal-second-reviewer",
      name: "Second reviewer",
      kind: "human",
      scopes: ["independent-review-author"],
    });
    value.evidence.find((row) => row.id === value.roster.evidenceRef).digest =
      computeRosterCompletenessRoot(value.roster, value.repositories, value.principals);
    const beforeRevision = value.predecessor.entities.find(
      (row) => row.entityRef === repository.id,
    ).revision;
    value.delta.unchangedRefs = value.delta.unchangedRefs.filter(
      (ref) => ref !== repository.id,
    );
    value.delta.entries.push({
      id: "delta-repo-sdk-approval-policy",
      entityRef: repository.id,
      kind: "updated",
      beforeRevision,
      afterRevision: computeRepositoryRevision(repository),
    });
    value.delta.supersededRefs.push(
      computeSupersededRevisionRef(repository.id, beforeRevision),
    );
    value.pullRequests.find((row) => row.id === "pr-sdk-18").readiness = "blocked";
    value.readiness.repositoryStates.find((row) => row.subjectRef === repository.id).state =
      "blocked";
    return repository;
  };

  const insufficientWithoutBlocker = mutate((value) => {
    applyInsufficientReviewPolicy(value);
  });
  assertHas(insufficientWithoutBlocker, "missing_required_blocker");

  const withReviewBlocker = mutate((value) => {
    const repository = applyInsufficientReviewPolicy(value);
    value.blockers.push({
      id: "blocker-sdk-review-evidence",
      category: "missing-evidence",
      subjectRefs: ["pr-sdk-18", "review-sdk-current"],
      ownerRef: "principal-sdk-owner",
      evidenceRefs: ["evidence-review-sdk-current"],
      state: "open",
      resolutionEvidenceRef: null,
    });
    const pr = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    pr.blockerRefs.push("blocker-sdk-review-evidence");
    pr.readiness = "blocked";
    const repositoryReadiness = value.readiness.repositoryStates.find(
      (row) => row.subjectRef === repository.id,
    );
    repositoryReadiness.blockerRefs.push("blocker-sdk-review-evidence");
    value.readiness.releaseTrainStates[0].blockerRefs.push(
      "blocker-sdk-review-evidence",
    );
    value.readiness.blockerRefs.push("blocker-sdk-review-evidence");
  });
  assert.deepEqual(findings(withReviewBlocker), []);

  const wrongOwner = clone(withReviewBlocker);
  wrongOwner.blockers.find((row) => row.id === "blocker-sdk-review-evidence").ownerRef =
    "principal-api-owner";
  assertHas(resealRepositoryOperationsArtifact(wrongOwner), "invalid_blocker");

  const withPrBlocker = mutate((value) => {
    const review = value.reviews.find((row) => row.id === "review-sdk-current");
    const beforeRevision = value.predecessor.entities.find(
      (row) => row.entityRef === review.id,
    ).revision;
    value.pullRequests.find((row) => row.id === review.pullRequestRef).reviewRefs = [];
    value.reviews = value.reviews.filter((row) => row.id !== review.id);
    value.evidence = value.evidence.filter((row) => row.id !== review.evidenceRef);
    value.delta.unchangedRefs = value.delta.unchangedRefs.filter((ref) => ref !== review.id);
    value.delta.entries.push({
      id: "delta-review-sdk-removed",
      entityRef: review.id,
      kind: "removed",
      beforeRevision,
      afterRevision: null,
    });
    value.delta.supersededRefs.push(computeSupersededRevisionRef(review.id, beforeRevision));
    value.blockers.push({
      id: "blocker-sdk-review-missing",
      category: "missing-evidence",
      subjectRefs: ["pr-sdk-18"],
      ownerRef: "principal-sdk-owner",
      evidenceRefs: [],
      state: "open",
      resolutionEvidenceRef: null,
    });
    const pr = value.pullRequests.find((row) => row.id === "pr-sdk-18");
    pr.blockerRefs.push("blocker-sdk-review-missing");
    pr.readiness = "blocked";
    const repositoryReadiness = value.readiness.repositoryStates.find(
      (row) => row.subjectRef === "repo-sdk",
    );
    repositoryReadiness.blockerRefs.push("blocker-sdk-review-missing");
    repositoryReadiness.state = "blocked";
    value.readiness.releaseTrainStates[0].blockerRefs.push(
      "blocker-sdk-review-missing",
    );
    value.readiness.blockerRefs.push("blocker-sdk-review-missing");
  });
  assert.deepEqual(findings(withPrBlocker), []);
});

test("resolved blockers require exact owner-authored resolution evidence", () => {
  assertHas(
    mutate((value) => {
      const blocker = value.blockers.find((row) => row.id === "blocker-api-review");
      blocker.state = "resolved";
      blocker.resolutionEvidenceRef = "evidence-roster";
    }),
    "invalid_blocker",
  );

  const resolved = mutate((value) => {
    const blocker = {
      id: "blocker-resolved-stale-review",
      category: "stale-review",
      subjectRefs: ["pr-api-41", "review-api-old"],
      ownerRef: "principal-api-owner",
      evidenceRefs: ["evidence-review-api-old"],
      state: "resolved",
      resolutionEvidenceRef: "evidence-blocker-stale-review",
    };
    const resolutionEvidence = {
      id: "evidence-blocker-stale-review",
      kind: "blocker",
      sourceRef: "controlled://github/acme/api/blockers/stale-review/resolution",
      sourceRecordDigest: `sha256:${"5".repeat(64)}`,
      observedAt: "2026-09-13T15:00:00Z",
      authorRef: "principal-api-owner",
      subjectRefs: [
        "blocker-resolved-stale-review",
        "pr-api-41",
        "review-api-old",
      ],
      revision: computeBlockerResolutionRevision(blocker),
    };
    value.blockers.push(blocker);
    value.evidence.push(resolutionEvidence);
  });
  assert.deepEqual(findings(resolved), []);

  const launderedStaleReview = clone(resolved);
  const launderedStaleBlocker = launderedStaleReview.blockers.find(
    (row) => row.id === "blocker-resolved-stale-review",
  );
  const launderedStaleResolution = launderedStaleReview.evidence.find(
    (row) => row.id === launderedStaleBlocker.resolutionEvidenceRef,
  );
  launderedStaleBlocker.ownerRef = "principal-sdk-owner";
  launderedStaleResolution.authorRef = launderedStaleBlocker.ownerRef;
  launderedStaleResolution.revision =
    computeBlockerResolutionRevision(launderedStaleBlocker);
  assertHas(
    resealRepositoryOperationsArtifact(launderedStaleReview),
    "invalid_blocker",
  );

  const launderedSdkClosure = mutate((value) => {
    const blocker = value.blockers.find((row) => row.id === "blocker-sdk-check-resolved");
    const resolution = value.evidence.find(
      (row) => row.id === blocker.resolutionEvidenceRef,
    );
    blocker.ownerRef = "principal-api-owner";
    resolution.authorRef = blocker.ownerRef;
    resolution.revision = computeBlockerResolutionRevision(blocker);
  });
  assertHas(launderedSdkClosure, "invalid_blocker");

  const addResolvedBlocker = (value, sourceBlockerId, suffix) => {
    const source = value.blockers.find((row) => row.id === sourceBlockerId);
    const blocker = {
      ...structuredClone(source),
      id: `blocker-resolved-${suffix}`,
      state: "resolved",
      resolutionEvidenceRef: `evidence-blocker-resolved-${suffix}`,
    };
    const resolution = {
      id: blocker.resolutionEvidenceRef,
      kind: "blocker",
      sourceRef: `controlled://portfolio/blockers/${suffix}/resolution`,
      sourceRecordDigest: `sha256:${String(7 + value.evidence.length % 3).repeat(64)}`,
      observedAt: AS_OF,
      authorRef: blocker.ownerRef,
      subjectRefs: [blocker.id, ...blocker.subjectRefs],
      revision: computeBlockerResolutionRevision(blocker),
    };
    value.blockers.push(blocker);
    value.evidence.push(resolution);
    return { blocker, resolution };
  };
  for (const [sourceBlockerId, suffix, launderingOwner] of [
    ["blocker-dependency", "dependency", "principal-sdk-owner"],
    ["blocker-release-partial", "release", "principal-sdk-owner"],
    ["blocker-approval-rejected", "approval", "principal-risk-approver"],
  ]) {
    const valid = mutate((value) => {
      addResolvedBlocker(value, sourceBlockerId, suffix);
    });
    assertNotHas(valid, "invalid_blocker");

    const laundered = mutate((value) => {
      const { blocker, resolution } = addResolvedBlocker(
        value,
        sourceBlockerId,
        suffix,
      );
      blocker.ownerRef = launderingOwner;
      resolution.authorRef = launderingOwner;
      resolution.revision = computeBlockerResolutionRevision(blocker);
    });
    assertHas(laundered, "invalid_blocker");
  }

  const blockerCategories = [
    "stale-review",
    "changes-requested-review",
    "failed-check",
    "failed-build",
    "missing-artifact",
    "failed-artifact",
    "cross-repository-ordering",
    "partial-release",
    "failed-release",
    "rolled-back-release",
    "superseded-release",
    "approval-required",
    "approval-rejected",
    "approval-change-requested",
    "approval-expired",
    "approval-no-response",
    "missing-evidence",
  ];
  for (const category of blockerCategories) {
    const blocker = {
      id: "blocker-resolution-revision",
      category,
      subjectRefs: ["subject-a"],
      ownerRef: "owner-a",
      evidenceRefs: ["evidence-a"],
      state: "resolved",
      resolutionEvidenceRef: "resolution-a",
      ...(category === "missing-evidence"
        ? {
            missingEvidenceHistory: {
              checkpointRef: "checkpoint-a",
              subjectRef: "subject-a",
              priorRevision: `sha256:${"1".repeat(64)}`,
              priorState: "missing",
              closureEvidenceRef: "evidence-a",
            },
          }
        : {}),
    };
    const revision = computeBlockerResolutionRevision(blocker);
    for (const change of [
      (row) => {
        row.id = "blocker-resolution-revision-b";
      },
      (row) => {
        row.category =
          category === "stale-review" ? "failed-check" : "stale-review";
      },
      (row) => {
        row.subjectRefs = ["subject-b"];
      },
      (row) => {
        row.ownerRef = "owner-b";
      },
      (row) => {
        row.evidenceRefs = ["evidence-b"];
      },
      (row) => {
        row.state = "open";
      },
    ]) {
      const changed = structuredClone(blocker);
      change(changed);
      assert.notEqual(computeBlockerResolutionRevision(changed), revision);
    }
  }

  const staleSourceReboundWithoutResolution = clone(resolved);
  const staleBlocker = staleSourceReboundWithoutResolution.blockers.find(
    (row) => row.id === "blocker-resolved-stale-review",
  );
  const staleReview = staleSourceReboundWithoutResolution.reviews.find(
    (row) => row.id === "review-api-old",
  );
  const oldEvidence = staleSourceReboundWithoutResolution.evidence.find(
    (row) => row.id === staleReview.evidenceRef,
  );
  const replacementEvidence = {
    ...structuredClone(oldEvidence),
    id: "evidence-review-api-old-rebound",
    sourceRef: "controlled://github/acme/api/reviews/40/rebound",
    sourceRecordDigest: `sha256:${"6".repeat(64)}`,
  };
  staleReview.evidenceRef = replacementEvidence.id;
  staleReview.evidenceDigest = replacementEvidence.sourceRecordDigest;
  replacementEvidence.revision = computeReviewRevision(staleReview);
  staleBlocker.evidenceRefs = [replacementEvidence.id];
  staleSourceReboundWithoutResolution.evidence =
    staleSourceReboundWithoutResolution.evidence
      .filter((row) => row.id !== oldEvidence.id)
      .concat(replacementEvidence);
  reconcileChangedRevision(
    staleSourceReboundWithoutResolution,
    staleReview.id,
    "review-changed",
    replacementEvidence.revision,
  );
  assertHas(
    resealRepositoryOperationsArtifact(staleSourceReboundWithoutResolution),
    "invalid_blocker",
  );

  const staleSourceAndResolutionRebound = structuredClone(
    staleSourceReboundWithoutResolution,
  );
  staleSourceAndResolutionRebound.evidence.find(
    (row) => row.id === staleBlocker.resolutionEvidenceRef,
  ).revision = computeBlockerResolutionRevision(
    staleSourceAndResolutionRebound.blockers.find(
      (row) => row.id === staleBlocker.id,
    ),
  );
  assert.deepEqual(
    findings(resealRepositoryOperationsArtifact(staleSourceAndResolutionRebound)),
    [],
  );

  const emptySourceEvidence = clone(resolved);
  emptySourceEvidence.blockers.find(
    (row) => row.id === "blocker-resolved-stale-review",
  ).evidenceRefs = [];
  assertHas(resealRepositoryOperationsArtifact(emptySourceEvidence), "invalid_blocker");

  const unrelatedSourceEvidence = clone(resolved);
  unrelatedSourceEvidence.blockers.find(
    (row) => row.id === "blocker-resolved-stale-review",
  ).evidenceRefs = ["evidence-roster"];
  assertHas(resealRepositoryOperationsArtifact(unrelatedSourceEvidence), "invalid_blocker");

  const fabricatedMissingHistory = mutate((value) => {
    const blocker = value.blockers.find((row) => row.id === "blocker-sdk-check-resolved");
    const resolution = value.evidence.find(
      (row) => row.id === blocker.resolutionEvidenceRef,
    );
    const prior = value.predecessor.entities.find(
      (row) => row.entityRef === "check-cli-current",
    );
    blocker.subjectRefs = ["pr-cli-9", "check-cli-current"];
    blocker.ownerRef = "principal-cli-owner";
    blocker.evidenceRefs = ["evidence-check-cli-current"];
    blocker.missingEvidenceHistory = {
      checkpointRef: value.predecessor.checkpointId,
      subjectRef: prior.entityRef,
      priorRevision: prior.revision,
      priorState: "pending",
      closureEvidenceRef: "evidence-check-cli-current",
    };
    resolution.authorRef = blocker.ownerRef;
    resolution.subjectRefs = [
      blocker.id,
      ...blocker.subjectRefs,
      blocker.missingEvidenceHistory.closureEvidenceRef,
    ];
    resolution.revision = computeBlockerResolutionRevision(blocker);
  });
  assertHas(fabricatedMissingHistory, "invalid_blocker");

  const wrongGapClosure = mutate((value) => {
    const blocker = value.blockers.find((row) => row.id === "blocker-sdk-check-resolved");
    blocker.evidenceRefs = ["evidence-review-sdk-current"];
    blocker.missingEvidenceHistory.closureEvidenceRef = "evidence-review-sdk-current";
    const resolution = value.evidence.find(
      (row) => row.id === blocker.resolutionEvidenceRef,
    );
    resolution.subjectRefs = [
      blocker.id,
      ...blocker.subjectRefs,
      blocker.missingEvidenceHistory.closureEvidenceRef,
    ];
    resolution.revision = computeBlockerResolutionRevision(blocker);
  });
  assertHas(wrongGapClosure, "invalid_blocker");

  const missingHistoryBinding = clone(fixture);
  delete missingHistoryBinding.blockers.find(
    (row) => row.id === "blocker-sdk-check-resolved",
  ).missingEvidenceHistory;
  assert.equal(validateSchema(missingHistoryBinding), false);
  assertHas(
    resealRepositoryOperationsArtifact(missingHistoryBinding),
    "invalid_blocker",
  );
});

test("blockers reject unrelated bindings and fabricated source states", () => {
  assertHas(
    mutate((value) => {
      value.blockers.find((row) => row.id === "blocker-api-review").resolutionEvidenceRef =
        "evidence-response-approved";
    }),
    "invalid_blocker",
  );
  assertHas(
    mutate((value) => {
      value.blockers.find((row) => row.id === "blocker-api-review").subjectRefs.push(
        "repo-sdk",
      );
    }),
    "invalid_blocker",
  );
  assertHas(
    mutate((value) => {
      value.blockers.find((row) => row.id === "blocker-api-review").evidenceRefs.push(
        "evidence-roster",
      );
    }),
    "invalid_blocker",
  );
  assertHas(
    mutate((value) => {
      value.evidence.push({
        id: "evidence-fabricated-check-resolution",
        kind: "blocker",
        sourceRef: "controlled://github/acme/sdk/blockers/check/resolution",
        sourceRecordDigest: `sha256:${"6".repeat(64)}`,
        observedAt: "2026-09-13T15:00:00Z",
        authorRef: "principal-sdk-owner",
        subjectRefs: [
          "blocker-fabricated-failed-check",
          "pr-sdk-18",
          "check-sdk-current",
        ],
        revision: "blocker-fabricated-failed-check:resolved",
      });
      value.blockers.push({
        id: "blocker-fabricated-failed-check",
        category: "failed-check",
        subjectRefs: ["pr-sdk-18", "check-sdk-current"],
        ownerRef: "principal-sdk-owner",
        evidenceRefs: ["evidence-check-sdk-current"],
        state: "resolved",
        resolutionEvidenceRef: "evidence-fabricated-check-resolution",
      });
    }),
    "invalid_blocker",
  );
});

test("missing repositories block their PR and repository readiness", () => {
  const value = mutate((candidate) => {
    candidate.repositories.find((row) => row.id === "repo-sdk").state = "missing";
  });
  assertHas(value, "invalid_pull_request_closure");
  assertHas(value, "invalid_release_entry");
});

test("repository and release-train readiness rows require exact computed blockers", () => {
  const apiPrBlockers = fixture.pullRequests.find(
    (row) => row.id === "pr-api-41",
  ).blockerRefs;
  for (const blockerRef of apiPrBlockers) {
    assert.ok(fixture.readiness.releaseTrainStates[0].blockerRefs.includes(blockerRef));
  }
  assertHas(
    mutate((value) => {
      value.readiness.repositoryStates.find((row) => row.subjectRef === "repo-api").state =
        "ready-for-owner-review";
    }),
    "invalid_repository_readiness",
  );
  assertHas(
    mutate((value) => {
      value.readiness.repositoryStates.find(
        (row) => row.subjectRef === "repo-sdk",
      ).blockerRefs = [];
    }),
    "invalid_repository_readiness",
  );
  assertHas(
    mutate((value) => {
      value.readiness.releaseTrainStates[0].state = "ready-for-owner-review";
    }),
    "invalid_release_train_readiness",
  );
  assertHas(
    mutate((value) => {
      value.readiness.releaseTrainStates[0].blockerRefs.pop();
    }),
    "invalid_release_train_readiness",
  );
  assertHas(
    mutate((value) => {
      value.readiness.releaseTrainStates[0].blockerRefs =
        value.readiness.releaseTrainStates[0].blockerRefs.filter(
          (ref) => ref !== "blocker-api-build",
        );
    }),
    "invalid_release_train_readiness",
  );
});

test("adverse aggregate release state requires an exact train blocker", () => {
  const removeAggregateBlocker = (value) => {
    const removed = "blocker-train-partial";
    value.blockers = value.blockers.filter((row) => row.id !== removed);
    value.readiness.releaseTrainStates[0].blockerRefs =
      value.readiness.releaseTrainStates[0].blockerRefs.filter((ref) => ref !== removed);
    value.readiness.blockerRefs = value.readiness.blockerRefs.filter(
      (ref) => ref !== removed,
    );
  };
  const missing = mutate(removeAggregateBlocker);
  assert.ok(
    findings(missing).some(
      (row) =>
        row.code === "missing_required_blocker" &&
        row.path === "$.releaseTrains[0].blockerRefs",
    ),
    JSON.stringify(findings(missing), null, 2),
  );
  assert.ok(
    !findings(fixture).some(
      (row) =>
        row.code === "missing_required_blocker" &&
        row.path === "$.releaseTrains[0].blockerRefs",
    ),
  );

  const planned = mutate((value) => {
    const train = value.releaseTrains[0];
    train.state = "planned";
    const revision = computeReleaseEvidenceRevision(train);
    value.evidence.find((row) => row.id === train.releaseEvidenceRef).revision = revision;
    value.blockers.find((row) => row.id === "blocker-train-partial").category =
    "missing-evidence";
    value.delta.entries.find((row) => row.entityRef === train.id).afterRevision =
    revision;

    const request = value.escalations.find(
    (row) => row.id === "escalation-train-release",
    );
    request.targetRevision = revision;
    request.evidenceRevision = revision;
    request.dedupeKey = computeEscalationDedupeKey(request);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    response.targetRevision = revision;
    response.evidenceRevision = revision;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
    computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
    computeDispatchReceiptRevision(request);
  });
  assert.deepEqual(findings(planned), []);

  removeAggregateBlocker(planned);
  assertHas(
    resealRepositoryOperationsArtifact(planned),
    "missing_required_blocker",
  );
});

test("release-train and PR membership is bidirectional", () => {
  assertHas(
    mutate((value) => {
      value.pullRequests.find((row) => row.id === "pr-sdk-18").releaseTrainRefs = [];
    }),
    "invalid_pull_request_closure",
  );
});

test("handoff structurally and narratively rejects forbidden authority claims", () => {
  const structural = mutate((value) => {
    value.handoff.mergeClaim = "claimed";
  });
  assert.equal(validateSchema(structural), false);
  assertHas(structural, "forbidden_authority_claim");

  assertHas(
    mutate((value) => {
      value.handoff.summary = "The Repository Operations Manager merged the pull request.";
    }),
    "forbidden_authority_claim",
  );
  assertHas(
    mutate((value) => {
      value.handoff.summary = "The pull request was merged by the Repository Operations Manager.";
    }),
    "forbidden_authority_claim",
  );
  for (const summary of [
    "The Claw merges the pull request.",
    "The Claw will merge the pull request.",
    "The Claw is merging the pull request.",
    "The Claw approves the request.",
    "The Claw will approve the request.",
    "The Claw deploys the release.",
    "The Claw will deploy the release.",
    "The pull request was successfully merged by the Repository Operations Manager.",
    "The pull request will be merged by the Repository Operations Manager.",
    "The approval request is being approved by the Claw.",
    "The pull request has now been merged directly by the Claw.",
    "The agent merged the pull request.",
    "The assistant has approved the request.",
    "The agent will publish the artifact.",
    "The pull request was merged by the assistant.",
    "We merged the pull request.",
    "I approved the request.",
    "Approved the request.",
  ]) {
    assertHas(
      mutate((value) => {
        value.handoff.summary = summary;
      }),
      "forbidden_authority_claim",
    );
  }
  assertNotHas(
    mutate((value) => {
      value.handoff.summary = "The pull request was definitely not merged by the Claw.";
    }),
    "forbidden_authority_claim",
  );
  for (const summary of [
    "The Claw does not merge the pull request.",
    "The Claw will not merge the pull request.",
    "The Claw is not merging the pull request.",
    "The Claw does not approve the request.",
    "The Claw will not approve the request.",
    "The Claw does not deploy the release.",
    "The Claw will not deploy the release.",
    "The agent did not merge the pull request.",
    "I did not approve the request.",
    "We have not published the artifact.",
  ]) {
    assertNotHas(
      mutate((value) => {
        value.handoff.summary = summary;
      }),
      "forbidden_authority_claim",
    );
    for (const summary of [
      "The repository owner merged the pull request.",
      "Riley Kim approved the request.",
      "The trusted system published the artifact evidence.",
      "The portfolio custodian released the artifact.",
      "The repository owner did not merge the pull request.",
    ]) {
      assertNotHas(
        mutate((value) => {
          value.handoff.summary = summary;
        }),
        "forbidden_authority_claim",
      );
    }
  }
  assertNotHas(
    mutate((value) => {
      value.handoff.summary = "No pull request was merged by the Claw.";
    }),
    "forbidden_authority_claim",
  );
  assertHas(
    mutate((value) => {
      value.handoff.summary =
        "The Claw did not change the code but merged the pull request.";
    }),
    "forbidden_authority_claim",
  );
  for (const summary of [
    "The Claw deleted the repository.",
    "The Claw dismissed the review.",
    "The Claw tagged the release.",
    "The Claw notified the approver.",
    "The Repository Operations Manager sent the approval request.",
  ]) {
    assertHas(
      mutate((value) => {
        value.handoff.summary = summary;
      }),
      "forbidden_authority_claim",
    );
  }
  assertHas(
    mutate((value) => {
      value.handoff.nextOwnerRef = "principal-source-system";
    }),
    "invalid_handoff_owner",
  );
});

test("evidence subjects must resolve to current ledger identities", () => {
  assertHas(
    mutate((value) => {
      value.evidence[0].subjectRefs.push("missing-subject");
    }),
    "invalid_evidence_record",
  );
  assertHas(
    mutate((value) => {
      value.evidence.find((row) => row.kind === "roster").authorRef =
        "principal-unregistered";
    }),
    "invalid_evidence_record",
  );

  const orphan = mutate((value) => {
    const source = value.evidence.find((row) => row.id === "evidence-check-cli-current");
    value.evidence.push({
      ...structuredClone(source),
      id: "evidence-check-cli-orphan",
      sourceRef: "controlled://github/acme/cli/checks/90/orphan",
      sourceRecordDigest: `sha256:${"b".repeat(64)}`,
    });
  });
  assertNotHas(orphan, "invalid_evidence_record");
  assertHas(orphan, "orphan_evidence_record");

  const explicitCoverageRole = mutate((value) => {
    const request = value.escalations.find((row) => row.id === "escalation-api-merge");
    const source = value.evidence.find((row) => row.id === request.evidenceRef);
    const supportingEvidence = {
      ...structuredClone(source),
      id: "evidence-api-escalation-support",
      sourceRef: "controlled://github/acme/api/reviews/41/escalation-support",
      sourceRecordDigest: `sha256:${"c".repeat(64)}`,
    };
    request.evidenceRef = supportingEvidence.id;
    request.dedupeKey = computeEscalationDedupeKey(request);
    value.evidence.push(supportingEvidence);
    const response = value.responses.find((row) => row.id === request.responseRef);
    response.requestDedupeKey = request.dedupeKey;
    value.evidence.find((row) => row.id === response.evidenceRef).revision =
      computeApprovalResponseRevision(response);
    value.evidence.find((row) => row.id === request.dispatch.receiptEvidenceRef).revision =
      computeDispatchReceiptRevision(request);
  });
  assert.deepEqual(findings(explicitCoverageRole), []);

  const releaseEvidence = fixture.evidence.find((row) => row.id === "evidence-release");
  assert.ok(
    fixture.releaseTrains.some((row) => row.releaseEvidenceRef === releaseEvidence.id) &&
      fixture.escalations.some((row) => row.evidenceRef === releaseEvidence.id) &&
      fixture.blockers.filter((row) => row.evidenceRefs.includes(releaseEvidence.id)).length > 1,
  );
  assertNotHas(fixture, "orphan_evidence_record");
});

test("semantic validation is total and trusted caller asOf is mandatory", () => {
  for (const value of [
    null,
    undefined,
    true,
    3,
    "artifact",
    [],
    {},
    { repositories: [{}] },
    { pullRequests: [{}] },
    { escalations: [{ dispatch: null }], responses: [{}], releaseTrains: [{ entries: null }] },
  ]) {
    assert.doesNotThrow(() => findings(value));
    assert.ok(findings(value).length > 0);
  }
  assertHas(fixture, "invalid_validation_context", {});
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-13T17:00:00" });
  assertHas(fixture, "invalid_validation_context", { asOf: "2026-09-13T17:00:01Z" });
});

test("schema rejects unknown fields and malformed authority structures", () => {
  const unknown = clone();
  unknown.pullRequests[0].mergeAction = "performed";
  assert.equal(validateSchema(unknown), false);
  const malformed = clone();
  malformed.escalations[0].dispatch = null;
  assert.equal(validateSchema(malformed), false);
  const bareSnapshotSource = clone();
  bareSnapshotSource.snapshots[0].sourceUri = "controlled://";
  assert.equal(validateSchema(bareSnapshotSource), false);
  assertHas(
    resealRepositoryOperationsArtifact(bareSnapshotSource),
    "invalid_source_snapshot",
  );
  for (const [ledger, field] of [
    ["reviews", "evidenceDigest"],
    ["builds", "evidenceDigest"],
    ["releaseTrains", "releaseEvidenceRef"],
    ["releaseTrains", "releaseEvidenceDigest"],
  ]) {
    const missingBinding = clone();
    delete missingBinding[ledger][0][field];
    assert.equal(validateSchema(missingBinding), false, `${ledger}.${field}`);
  }
});

test("Markdown template exposes the complete X3 review matrix", () => {
  for (const token of [
    "## Run, roster, and checkpoint lineage",
    "{{run.sourceSnapshotRoots}}",
    "{{repositories[].requiredCheckContexts}}",
    "{{repositories[].requiredApprovalCount}}",
    "{{repositories[].eligibleReviewerRefs}}",
    "## Exact checkpoint delta",
    "## PR-head-bound status matrix",
    "{{pullRequests[].currentHeadSha}}",
    "{{checks[].startedAt}}",
    "{{checks[].evidenceRef}}",
    "{{checks[].evidenceDigest}}",
    "`independent-review-author`",
    "{{reviews[].evidenceRef}}",
    "{{reviews[].evidenceDigest}}",
    "## Build and artifact provenance",
    "{{builds[].evidenceDigest}}",
    "`verified`, `missing`, `failed`, and `superseded`",
    "## Cross-repository dependency and release ordering",
    "`partial`, `failed`, `rolled-back`, and `superseded`",
    "{{releaseTrains[].releaseEvidenceRef}}",
    "{{releaseTrains[].releaseEvidenceDigest}}",
    "## Policy-authorized approval escalation queue",
    "{{escalations[].dedupeKey}}",
    "{{escalations[].dispatch.receiptEvidenceRef}}",
    "## Independently authored decisions and deadline observations",
    "{{responses[].kind}}",
    "{{responses[].outcome}}",
    "{{responses[].targetRevision}}",
    "## Exact blockers and readiness",
    "`missingEvidenceHistory`",
    "{{handoff.riskAcceptanceClaim}}",
    "{{handoff.externalCommunicationClaim}}",
  ]) {
    assert.ok(template.includes(token), token);
  }
});

test("controlled source evidence requires evidence-author authority", () => {
  for (const evidenceId of [
    "evidence-pr-sdk-18",
    "evidence-check-sdk-current",
    "evidence-build-sdk",
    "evidence-artifact-sdk",
    "evidence-release",
    "evidence-dependency",
  ]) {
    const value = mutate((candidate) => {
      candidate.evidence.find((row) => row.id === evidenceId).authorRef =
        "principal-sdk-owner";
    });
    assertHas(value, "invalid_evidence_record");
  }
  assertNotHas(fixture, "invalid_evidence_record");
});

test("public artifact CLI accepts the materialized fixture with exact asOf", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "repository-operations-manager",
      "claws/repository-operations-manager/fixtures/repository-operations.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});
