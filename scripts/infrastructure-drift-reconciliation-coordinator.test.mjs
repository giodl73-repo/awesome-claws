import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clawId = "infrastructure-drift-reconciliation-coordinator";
const fixturePath = new URL(
  `../claws/${clawId}/fixtures/infrastructure-drift-reconciliation.example.json`,
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const schema = JSON.parse(
  await readFile(
    new URL(
      `../claws/${clawId}/schemas/infrastructure-drift-reconciliation.schema.json`,
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

function findings(candidate) {
  return validateArtifactSemantics(clawId, candidate);
}

function codes(candidate) {
  return new Set(findings(candidate).map((item) => item.code));
}

function assertSchemaValid(candidate, label) {
  assert.equal(validateSchema(candidate), true, `${label}: ${JSON.stringify(validateSchema.errors)}`);
}

function assertFinding(candidate, expectedCode, label) {
  assertSchemaValid(candidate, label);
  assert.ok(codes(candidate).has(expectedCode), `${label}: ${JSON.stringify(findings(candidate))}`);
}

function appKey() {
  return structuredClone(
    fixture.dispositions.find((row) => row.id === "disposition-app").resourceKey,
  );
}

function unresolvedAppArtifact() {
  return mutate((value) => {
    for (const row of [
      value.desiredResources.find((item) => item.id === "desired-app"),
      value.observedResources.find((item) => item.id === "observed-app"),
    ]) {
      row.identityState = "unresolved";
      row.canonicalResourceId = null;
      row.comparableDigest = null;
    }
    value.dispositions = value.dispositions.filter((row) => row.id !== "disposition-app");
    value.snapshot.dispositionRefs = value.snapshot.dispositionRefs.filter(
      (ref) => ref !== "disposition-app",
    );
    value.handoff.coveredKeys = value.handoff.coveredKeys.filter(
      (key) => key.canonicalResourceId !== "aws://123/us-west-2/ecs/service/app",
    );
    value.blockers.push({
      id: "blocker-app-identity",
      snapshotRef: value.snapshot.id,
      code: "identity-correspondence-unresolved",
      status: "open",
      ownerRef: "principal-rhea-park",
      targetRefs: ["desired-app", "observed-app"],
      evidenceRefs: ["evidence-desired-export", "evidence-observed-export"],
    });
    value.snapshot.blockerRefs = ["blocker-app-identity"];
    value.handoff.blockingRefs = ["blocker-app-identity"];
    value.handoff.state = "blocked";
  });
}

test("drift reconciliation fixture, public CLI, and contribution contract validate", async () => {
  assertSchemaValid(fixture, "fixture");
  assert.deepEqual(findings(fixture), []);

  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      clawId,
      fileURLToPath(fixturePath),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);

  const contribution = JSON.parse(
    await readFile(
      new URL(`../contributions/${clawId}.json`, import.meta.url),
      "utf8",
    ),
  );
  assert.equal(contribution.entry.id, clawId);
  assert.ok(
    contribution.entry.resources.some(
      (resource) =>
        resource.role === "schema" &&
        resource.path === "schemas/infrastructure-drift-reconciliation.schema.json",
    ),
  );
});

test("schema is strict and semantic validation is total over malformed direct input", () => {
  const unknown = mutate((value) => {
    value.unexpected = true;
  });
  assert.equal(validateSchema(unknown), false);

  for (const candidate of [
    null,
    [],
    {},
    { snapshot: null, evidence: {}, desiredResources: 42, observedResources: "bad" },
    mutate((value) => {
      value.evidence = [null, 7, "not-a-record"];
      value.desiredResources = {};
      value.handoff = null;
    }),
  ]) {
    assert.doesNotThrow(() => findings(candidate));
    assert.ok(findings(candidate).length > 0);
  }
});

test("current, desired, observed, resource, and destination bindings fail closed", () => {
  assertFinding(
    mutate((value) => {
      value.desiredSnapshot.reconciliationSnapshotRef = "desired-snapshot-0907";
    }),
    "invalid_infrastructure_drift_snapshot_binding",
    "desired source snapshot binding",
  );
  assertFinding(
    mutate((value) => {
      value.observedResources[0].reconciliationSnapshotRef = "other-snapshot";
    }),
    "invalid_infrastructure_drift_resource_binding",
    "observed resource current snapshot binding",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.destinationRef = "controlled://infra-reconciliation/reviews/other";
    }),
    "invalid_infrastructure_drift_handoff",
    "handoff destination binding",
  );
});

test("snapshot and resource evidence is reciprocal and exact on digest and time", () => {
  for (const [label, change, expected] of [
    [
      "desired export digest",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-desired-export").snapshotDigest =
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      },
      "invalid_infrastructure_drift_snapshot_binding",
    ],
    [
      "observed export time",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-observed-export").observedAt =
          "2026-09-07T17:06:00Z";
      },
      "invalid_infrastructure_drift_snapshot_binding",
    ],
    [
      "current export digest",
      (value) => {
        value.evidence.find(
          (row) => row.id === "evidence-reconciliation-export",
        ).snapshotDigest =
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      },
      "invalid_infrastructure_drift_snapshot_binding",
    ],
    [
      "resource no longer reciprocally named",
      (value) => {
        const exportEvidence = value.evidence.find(
          (row) => row.id === "evidence-desired-export",
        );
        exportEvidence.subjectRefs = exportEvidence.subjectRefs.filter(
          (ref) => ref !== "desired-app",
        );
      },
      "invalid_infrastructure_drift_resource_binding",
    ],
  ]) {
    assertFinding(mutate(change), expected, label);
  }
});

test("globally unique ids and exact current indexes are mandatory", () => {
  assertFinding(
    mutate((value) => {
      value.observedResources[0].id = "desired-app";
    }),
    "duplicate_infrastructure_drift_id",
    "global duplicate resource id",
  );
  assertFinding(
    mutate((value) => {
      value.snapshot.principalRefs = [];
    }),
    "incomplete_infrastructure_drift_snapshot_index",
    "principal index omission",
  );
  assertFinding(
    mutate((value) => {
      value.snapshot.dispositionRefs.push("disposition-app");
    }),
    "incomplete_infrastructure_drift_snapshot_index",
    "duplicate disposition index",
  );
});

test("the four states derive only from symmetric membership and supplied comparable digests", () => {
  assert.deepEqual(
    new Set(fixture.dispositions.map((row) => row.state)),
    new Set(["converged", "drifted", "missing", "unmanaged"]),
  );
  assert.deepEqual(
    findings(
      mutate((value) => {
        value.desiredResources.find((row) => row.id === "desired-queue").nativeId =
          value.observedResources.find((row) => row.id === "observed-shadow").nativeId;
      }),
    ),
    [],
    "matching native provider/IaC ids must not invent correspondence",
  );
  assertFinding(
    mutate((value) => {
      value.observedResources.find((row) => row.id === "observed-app").comparableDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_infrastructure_drift_disposition",
    "changed owner-supplied comparable digest",
  );
});

test("matched, unmatched, and unresolved identity states cannot be laundered", () => {
  assertFinding(
    mutate((value) => {
      value.desiredResources.find((row) => row.id === "desired-app").identityState = "unmatched";
    }),
    "invalid_infrastructure_drift_identity_state",
    "two-sided tuple marked unmatched",
  );
  assertFinding(
    mutate((value) => {
      value.desiredResources.find((row) => row.id === "desired-queue").identityState = "matched";
    }),
    "invalid_infrastructure_drift_identity_state",
    "one-sided tuple marked matched",
  );

  const unresolved = unresolvedAppArtifact();
  assertSchemaValid(unresolved, "valid unresolved identity artifact");
  assert.deepEqual(findings(unresolved), []);

  const hidden = unresolvedAppArtifact();
  hidden.blockers = [];
  hidden.snapshot.blockerRefs = [];
  hidden.handoff.blockingRefs = [];
  assertFinding(
    hidden,
    "unresolved_infrastructure_drift_identity",
    "unresolved identity without exact blocker",
  );

  const unrelatedEvidence = unresolvedAppArtifact();
  unrelatedEvidence.desiredResources
    .find((row) => row.id === "desired-app")
    .evidenceRefs.push("evidence-principal-rhea");
  unrelatedEvidence.blockers[0].evidenceRefs = [
    "evidence-principal-rhea",
    "evidence-observed-export",
  ];
  assertFinding(
    unrelatedEvidence,
    "invalid_infrastructure_drift_blocker",
    "unresolved blocker with unrelated desired-side evidence",
  );

  const dispositioned = unresolvedAppArtifact();
  dispositioned.dispositions.push({
    id: "disposition-unresolved",
    snapshotRef: dispositioned.snapshot.id,
    resourceKey: appKey(),
    state: "converged",
    deviationRef: null,
  });
  dispositioned.snapshot.dispositionRefs.push("disposition-unresolved");
  assertFinding(
    dispositioned,
    "undeclared_infrastructure_drift_disposition",
    "unresolved identity must derive no disposition",
  );
});

test("coverage cannot hide, duplicate, or add a resource disposition", () => {
  assertFinding(
    mutate((value) => {
      value.dispositions.pop();
      value.snapshot.dispositionRefs.pop();
    }),
    "missing_infrastructure_drift_disposition",
    "missing disposition",
  );
  assertFinding(
    mutate((value) => {
      value.dispositions.push({
        ...structuredClone(value.dispositions[0]),
        id: "disposition-app-copy",
      });
      value.snapshot.dispositionRefs.push("disposition-app-copy");
    }),
    "duplicate_infrastructure_drift_disposition",
    "duplicate disposition",
  );
  assertFinding(
    mutate((value) => {
      value.dispositions.push({
        ...structuredClone(value.dispositions[0]),
        id: "disposition-extra",
        resourceKey: {
          environment: "production",
          providerScope: "aws-account-123",
          canonicalResourceId: "aws://123/us-west-2/s3/undeclared",
        },
      });
      value.snapshot.dispositionRefs.push("disposition-extra");
    }),
    "undeclared_infrastructure_drift_disposition",
    "extra disposition",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.coveredKeys.pop();
    }),
    "incomplete_infrastructure_drift_coverage",
    "hidden coverage key",
  );
});

test("deviation scope, consumption, digest revocation, and expiry are fail closed", () => {
  assertFinding(
    mutate((value) => {
      value.deviations[0].resourceKey = appKey();
    }),
    "invalid_infrastructure_drift_deviation",
    "deviation scope must be a drifted tuple",
  );
  assertFinding(
    mutate((value) => {
      value.dispositions.find((row) => row.id === "disposition-db").deviationRef = null;
    }),
    "unconsumed_infrastructure_drift_deviation",
    "unused deviation",
  );
  assertFinding(
    mutate((value) => {
      value.observedResources.find((row) => row.id === "observed-app").comparableDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const app = value.dispositions.find((row) => row.id === "disposition-app");
      app.state = "drifted";
      app.deviationRef = "deviation-db";
    }),
    "unconsumed_infrastructure_drift_deviation",
    "reused deviation",
  );
  assertFinding(
    mutate((value) => {
      value.observedResources.find((row) => row.id === "observed-app").comparableDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      value.dispositions.find((row) => row.id === "disposition-db").deviationRef = null;
      const app = value.dispositions.find((row) => row.id === "disposition-app");
      app.state = "drifted";
      app.deviationRef = "deviation-db";
    }),
    "invalid_infrastructure_drift_deviation",
    "transferred deviation",
  );
  assertFinding(
    mutate((value) => {
      value.deviations[0].desiredSnapshotDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_infrastructure_drift_deviation",
    "desired digest revocation",
  );
  assertFinding(
    mutate((value) => {
      value.observedSnapshot.digest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_infrastructure_drift_deviation",
    "observed snapshot digest revocation",
  );
  assertFinding(
    mutate((value) => {
      value.snapshot.asOf = "2026-09-15T17:45:00Z";
      value.evidence.find(
        (row) => row.id === "evidence-reconciliation-export",
      ).observedAt = "2026-09-15T17:45:00Z";
    }),
    "invalid_infrastructure_drift_deviation",
    "expired deviation",
  );
});

test("deviation approval needs independent scoped known humans and exact chronology/evidence", () => {
  for (const [label, change] of [
    [
      "unknown requester",
      (value) => {
        value.deviations[0].requestedByRef = "principal-nobody";
      },
    ],
    [
      "self approver",
      (value) => {
        value.deviations[0].approvedByRef = "principal-rhea-park";
      },
    ],
    [
      "approver lacks scope",
      (value) => {
        value.principals.find((row) => row.id === "principal-omar-bello").scopes = [
          "infrastructure-owner",
        ];
      },
    ],
    [
      "approval evidence authored by requester",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-db-deviation").suppliedByRef =
          "principal-rhea-park";
      },
    ],
    [
      "approval predates source snapshots",
      (value) => {
        value.deviations[0].approvedAt = "2026-09-07T16:00:00Z";
        value.evidence.find((row) => row.id === "evidence-db-deviation").observedAt =
          "2026-09-07T16:00:00Z";
      },
    ],
    [
      "approval evidence is not at approval time",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-db-deviation").observedAt =
          "2026-09-07T17:31:00Z";
      },
    ],
  ]) {
    assertFinding(
      mutate(change),
      "invalid_infrastructure_drift_deviation",
      label,
    );
  }
});

test("unapproved drift remains valid and visible, while any semantic finding prevents ready", () => {
  const unapproved = mutate((value) => {
    value.deviations = [];
    value.evidence = value.evidence.filter((row) => row.id !== "evidence-db-deviation");
    value.snapshot.evidenceRefs = value.snapshot.evidenceRefs.filter(
      (ref) => ref !== "evidence-db-deviation",
    );
    value.snapshot.deviationRefs = [];
    value.dispositions.find((row) => row.id === "disposition-db").deviationRef = null;
  });
  assertSchemaValid(unapproved, "unapproved drift");
  assert.deepEqual(findings(unapproved), []);
  assert.equal(
    unapproved.dispositions.find((row) => row.id === "disposition-db").state,
    "drifted",
  );

  const malformedReady = mutate((value) => {
    value.desiredResources[0].sourceSnapshotRef = "observed-snapshot-0907";
  });
  assertFinding(
    malformedReady,
    "invalid_infrastructure_drift_handoff",
    "semantic finding cannot coexist with ready handoff",
  );
});

test("prohibited authority narratives and capability additions cannot masquerade as reconciliation", async () => {
  assertFinding(
    mutate((value) => {
      value.handoff.summary = "The Claw applied remediation and approved the deviation.";
    }),
    "prohibited_infrastructure_drift_authority_narrative",
    "prohibited authority narrative",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.summary =
        "The reconciliation is compliant, secure, correct, safe, and remediated.";
    }),
    "prohibited_infrastructure_drift_authority_narrative",
    "prohibited outcome claim",
  );

  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === clawId);
  assert.deepEqual(entry.packages ?? [], []);
  assert.deepEqual(entry.mcpServers ?? {}, {});
  assert.deepEqual(entry.cronJobs ?? [], []);
  assert.equal(entry.openclawProfile, undefined);
});
