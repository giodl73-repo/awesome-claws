import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeKnowledgeSpaceChangePlanDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/knowledge-gardener/schemas/knowledge-space-change-plan.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/knowledge-gardener/fixtures/knowledge-space-change-plan.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/knowledge-gardener/templates/knowledge-space-change-plan.md",
    import.meta.url,
  ),
  "utf8",
);
const reference = await readFile(
  new URL(
    "../sources/knowledge-gardener/references/knowledge-space-change-plan-contract.md",
    import.meta.url,
  ),
  "utf8",
);
const catalog = JSON.parse(
  await readFile(new URL("../catalog.json", import.meta.url), "utf8"),
);
const contribution = JSON.parse(
  await readFile(
    new URL("../contributions/knowledge-gardener.json", import.meta.url),
    "utf8",
  ),
);
const catalogEntry = catalog.entries.find(
  (entry) => entry.id === "knowledge-gardener",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function knowledgeSpaceChangePlanFindings(",
);
const validatorBody = validatorSource.slice(
  validatorStart,
  validatorSource.indexOf("\nfunction ", validatorStart + 1),
);
const emittedFindingCodes = new Set(
  [...validatorBody.matchAll(/finding\(\s*"([a-z_]+)"/gu)].map(
    (match) => match[1],
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("knowledge-gardener", value);
const hasFinding = (value, code) =>
  findings(value).some((item) => item.code === code);
const refreshDigest = (value) => {
  const digest = computeKnowledgeSpaceChangePlanDigest(value);
  value.integrity.digest = digest;
  for (const approval of value.approvals) approval.planDigest = digest;
};

test("knowledge gardener ships a strict valid plan-only X3 contract", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(
    fixture.integrity.digest,
    computeKnowledgeSpaceChangePlanDigest(fixture),
  );
  assert.equal(
    fixture.operations.some((item) =>
      ["executed", "applied", "completed"].includes(item.state),
    ),
    false,
  );
  assert.equal(
    fixture.operations.every(
      (item) => item.applicationMode === "external-human",
    ),
    true,
  );

  const applied = clone();
  applied.operations[0].state = "applied";
  assert.equal(validateSchema(applied), false);

  const liveIntegration = clone();
  liveIntegration.plan.integration = {
    provider: "notion",
    stableId: "notion-reader",
  };
  delete liveIntegration.plan.observationInput;
  assert.equal(validateSchema(liveIntegration), false);

  const labelOnlyExclusion = clone();
  labelOnlyExclusion.plan.scope.excludedAreas = ["People operations"];
  assert.equal(validateSchema(labelOnlyExclusion), false);

  for (const phrase of [
    "exact shared roots",
    "exact target version",
    "external-human",
    "cycle-safe",
    "not delivered",
    "operator-supplied",
    "authorization receipt",
    "no network",
  ]) {
    assert.match(`${template}\n${reference}`, new RegExp(phrase, "iu"));
  }
});

test("knowledge gardener has only workspace artifact authority", () => {
  assert.deepEqual(catalogEntry.packages, []);
  assert.deepEqual(catalogEntry.openclawProfile, {
    schemaVersion: 1,
    agent: {
      tools: {
        profile: "coding",
        allow: ["read", "write", "edit"],
        fs: {
          workspaceOnly: true,
        },
      },
    },
  });
  assert.equal(
    JSON.stringify(catalogEntry).includes("@steipete/notion"),
    false,
  );
  assert.equal(JSON.stringify(catalogEntry.openclawProfile).includes("exec"), false);
  assert.equal(
    JSON.stringify(catalogEntry).includes("notion-observation-export"),
    true,
  );
  assert.deepEqual(contribution.entry, catalogEntry);
});

test("knowledge gardener exercises every direct semantic finding code", () => {
  const cases = new Map([
    [
      "duplicate_reference",
      (value) => value.handoff.snapshotRefs.push(value.handoff.snapshotRefs[0]),
    ],
    [
      "dangling_reference",
      (value) => {
        value.operations[0].issueRefs[0] = "issue-missing";
      },
    ],
    [
      "duplicate_object_id",
      (value) => {
        value.issues[0].id = value.snapshots[0].id;
      },
    ],
    [
      "duplicate_notion_identity",
      (value) => {
        value.snapshots[1].notionObjectId = value.snapshots[0].notionObjectId;
      },
    ],
    [
      "invalid_plan_chronology",
      (value) => {
        value.plan.reviewHorizon.endsAt = value.plan.reviewHorizon.startsAt;
      },
    ],
    [
      "invalid_scope",
      (value) => {
        value.plan.observationInput.authorizationReceipt.authorizedObjectIds.pop();
      },
    ],
    [
      "invalid_observation_export",
      (value) => {
        value.plan.observationInput.observationExportId =
          "ntn_credential-shaped-export-id";
      },
    ],
    [
      "invalid_integration_authorization",
      (value) => {
        value.plan.observationInput.authorizationReceipt.accessMode =
          "notion-api";
      },
    ],
    [
      "invalid_snapshot_chronology",
      (value) => {
        value.snapshots[0].observation.includedAt =
          "2026-08-31T17:01:00Z";
      },
    ],
    [
      "invalid_observed_version",
      (value) => {
        value.snapshots[0].observedVersion.value =
          "2026-08-28T12:00:00Z";
      },
    ],
    [
      "unsafe_snapshot_reference",
      (value) => {
        value.snapshots[0].url += "?token=secret";
      },
    ],
    [
      "out_of_scope_snapshot",
      (value) => {
        value.snapshots.at(-1).scopeProof.sharedViaObjectId =
          "33333333333333333333333333333333";
      },
    ],
    [
      "excluded_scope_snapshot",
      (value) => {
        value.snapshots.at(-1).scopeProof.ancestryObjectIds.push(
          value.plan.scope.excludedObjects[0].objectId,
        );
      },
    ],
    [
      "invalid_issue_evidence",
      (value) => {
        value.issues[0].evidenceSnapshotRefs = ["snapshot-project-root"];
      },
    ],
    [
      "asymmetric_issue_link",
      (value) => {
        value.issues.find(
          (item) => item.id === "issue-missing-owner-property",
        ).relatedIssueRefs = [];
      },
    ],
    [
      "autonomous_conflict_resolution",
      (value) => {
        value.issues.find(
          (item) => item.id === "issue-hosting-conflict",
        ).resolution = "Use the platform-owned side.";
      },
    ],
    [
      "false_duplicate",
      (value) => {
        value.snapshots.find(
          (item) => item.id === "snapshot-api-versioning-copy",
        ).topicFingerprint = "api-versioning-copy";
      },
    ],
    [
      "false_staleness",
      (value) => {
        value.snapshots.find(
          (item) => item.id === "snapshot-api-versioning-old",
        ).lastEditedAt = "2026-08-30T10:00:00Z";
      },
    ],
    [
      "false_conflict",
      (value) => {
        value.snapshots.find(
          (item) => item.id === "snapshot-hosting-decision-b",
        ).decisionKey = "decision-different";
      },
    ],
    [
      "invalid_operation_target",
      (value) => {
        value.operations[0].target.observedVersion.value =
          "2025-01-01T00:00:00Z";
      },
    ],
    [
      "invalid_operation_evidence",
      (value) => {
        value.operations[0].sourceSnapshotRefs.pop();
      },
    ],
    [
      "invalid_operation_chronology",
      (value) => {
        value.operations[0].proposedAt = "2026-08-31T17:30:00Z";
      },
    ],
    [
      "invalid_operation_patch",
      (value) => {
        value.operations[0].beforeValue = "already linked";
      },
    ],
    [
      "irreversible_operation",
      (value) => {
        value.operations.find((item) => item.kind === "archive").reversible =
          false;
      },
    ],
    [
      "invalid_operation_readiness",
      (value) => {
        value.operations.find((item) => item.kind === "rename").blockerRefs = [
          "blocker-stale-owner-review",
        ];
      },
    ],
    [
      "conflict_operation_approval",
      (value) => {
        const operation = value.operations.find(
          (item) => item.kind === "archive",
        );
        operation.state = "approved-for-human-application";
        operation.approvalRef = "approval-conflict-bypass";
      },
    ],
    [
      "dependency_cycle",
      (value) => {
        value.operations.find((item) => item.kind === "rename").dependsOn = [
          "operation-move-api-notes",
        ];
      },
    ],
    [
      "invalid_approval_reference",
      (value) => {
        value.operations[0].approvalRef = "approval-missing";
      },
    ],
    [
      "blanket_approval",
      (value) => {
        value.approvals[0].scope = "plan-wide";
      },
    ],
    [
      "stale_approval",
      (value) => {
        value.approvals[0].targetVersions[0].observedVersion.value =
          "2025-01-01T00:00:00Z";
      },
    ],
    [
      "invalid_approval_chronology",
      (value) => {
        value.approvals[0].approvedAt = "2026-08-31T16:00:00Z";
      },
    ],
    [
      "incomplete_blocker_coverage",
      (value) => {
        value.blockers[0].operationRefs = ["operation-archive-hosting-b"];
      },
    ],
    [
      "premature_plan_readiness",
      (value) => {
        value.plan.status = "ready-for-human-review";
        value.handoff.state = "ready-for-human-review";
      },
    ],
    [
      "incomplete_handoff",
      (value) => {
        value.handoff.issueRefs.pop();
      },
    ],
    [
      "control_inheritance_mismatch",
      (value) => {
        const item = value.snapshots.find(
          (snapshot) => snapshot.id === "snapshot-hosting-decision-a",
        );
        item.handling.classification = "confidential";
        item.handling.audienceScope = [
          "decision-owners",
          "architecture-team",
        ];
        item.handling.retention.policyRefs = ["project-decisions-records"];
        item.handling.retention.retainUntil = "2032-12-31T23:59:59Z";
      },
    ],
    [
      "control_broadening",
      (value) => {
        const item = value.operations.find(
          (operation) => operation.kind === "archive",
        );
        item.expectedAccessState = "available";
      },
    ],
    [
      "invalid_plan_digest",
      (value) => {
        value.integrity.digest =
          "0000000000000000000000000000000000000000000000000000000000000000";
      },
    ],
    [
      "unsafe_output_state",
      (value) => {
        value.handoff.output.deliveryState = "delivered";
      },
    ],
    [
      "agent_owned_authority",
      (value) => {
        value.plan.maintenanceOwner = {
          id: "team-knowledge-bot-maintainers",
          name: "Knowledge bot maintainers",
          type: "team",
        };
      },
    ],
    [
      "missing_authority_gate",
      (value) => {
        value.prohibitedActions.pop();
      },
    ],
    [
      "unauthorized_narrative_action",
      (value) => {
        value.handoff.summary =
          "I renamed the page and edited its properties.";
      },
    ],
  ]);

  for (const [code, mutate] of cases) {
    const value = clone();
    mutate(value);
    assert.equal(
      hasFinding(value, code),
      true,
      `${code}: ${JSON.stringify(findings(value))}`,
    );
  }

  const directCases = new Set(cases.keys());
  directCases.delete("duplicate_reference");
  directCases.delete("dangling_reference");
  assert.deepEqual(emittedFindingCodes, directCases);
});

test("knowledge gardener rejects scope and exact-version approval bypasses", () => {
  const plausibleOutOfScope = clone();
  const outsider = plausibleOutOfScope.snapshots.at(-1);
  outsider.scopeProof.sharedViaObjectId =
    "33333333333333333333333333333333";
  assert.match(outsider.url, /^https:\/\/www\.notion\.so\//u);
  assert.equal(
    hasFinding(plausibleOutOfScope, "out_of_scope_snapshot"),
    true,
  );

  const excluded = clone();
  excluded.snapshots.at(-1).scopeProof.ancestryObjectIds.push(
    excluded.plan.scope.excludedObjects[0].objectId,
  );
  assert.equal(hasFinding(excluded, "excluded_scope_snapshot"), true);

  const versionDrift = clone();
  const changed = versionDrift.snapshots.find(
    (item) => item.id === "snapshot-api-versioning-copy",
  );
  changed.lastEditedAt = "2026-08-31T17:10:30Z";
  changed.observedVersion.value = "2026-08-31T17:10:30Z";
  assert.equal(hasFinding(versionDrift, "stale_approval"), true);

  const blanket = clone();
  blanket.approvals[0].scope = "plan-wide";
  assert.equal(hasFinding(blanket, "blanket_approval"), true);

  const early = clone();
  early.approvals[0].approvedAt = "2026-08-31T17:00:00Z";
  assert.equal(hasFinding(early, "invalid_approval_chronology"), true);

  const simultaneousApproval = clone();
  simultaneousApproval.approvals[0].approvedAt =
    simultaneousApproval.operations[0].proposedAt;
  assert.equal(
    hasFinding(simultaneousApproval, "invalid_approval_chronology"),
    true,
  );

  const sourceClosureBypass = clone();
  sourceClosureBypass.operations[0].sourceSnapshotRefs.pop();
  assert.equal(
    hasFinding(sourceClosureBypass, "invalid_operation_evidence"),
    true,
  );
  assert.equal(hasFinding(sourceClosureBypass, "stale_approval"), true);

  const unseenTarget = clone();
  unseenTarget.approvals[0].targetVersions[1].objectRef =
    "snapshot-project-root";
  assert.equal(hasFinding(unseenTarget, "stale_approval"), true);
});

test("knowledge gardener represents database-only, page-only, and unexcluded scopes", () => {
  const databaseOnly = clone();
  databaseOnly.plan.scope.sharedPages = [];
  assert.equal(
    validateSchema(databaseOnly),
    true,
    JSON.stringify(validateSchema.errors),
  );

  const pageOnly = clone();
  pageOnly.plan.scope.sharedDatabases = [];
  assert.equal(
    validateSchema(pageOnly),
    true,
    JSON.stringify(validateSchema.errors),
  );

  const unexcluded = clone();
  unexcluded.plan.scope.excludedObjects = [];
  unexcluded.plan.observationInput.authorizationReceipt.excludedObjectIds = [];
  refreshDigest(unexcluded);
  assert.equal(
    validateSchema(unexcluded),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.deepEqual(findings(unexcluded), []);
});

test("knowledge gardener rejects false issues and one-way conflict evidence", () => {
  const falseStale = clone();
  const decision = falseStale.snapshots.find(
    (item) => item.id === "snapshot-api-versioning-old",
  );
  decision.lastEditedAt = "2026-08-30T10:00:00Z";
  decision.observedVersion.value = decision.lastEditedAt;
  falseStale.operations[0].target.observedVersion.value = decision.lastEditedAt;
  falseStale.operations[1].target.observedVersion.value = decision.lastEditedAt;
  falseStale.approvals[0].targetVersions[0].observedVersion.value =
    decision.lastEditedAt;
  refreshDigest(falseStale);
  assert.equal(hasFinding(falseStale, "false_staleness"), true);

  const falseDuplicate = clone();
  falseDuplicate.snapshots.find(
    (item) => item.id === "snapshot-api-versioning-copy",
  ).topicFingerprint = "different-topic";
  assert.equal(hasFinding(falseDuplicate, "false_duplicate"), true);

  const falseConflict = clone();
  falseConflict.snapshots.find(
    (item) => item.id === "snapshot-hosting-decision-b",
  ).contentDigest =
    "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  assert.equal(hasFinding(falseConflict, "false_conflict"), true);

  const oneWay = clone();
  oneWay.issues.find(
    (item) => item.id === "issue-missing-owner-property",
  ).relatedIssueRefs = [];
  assert.equal(hasFinding(oneWay, "asymmetric_issue_link"), true);

  const incompleteSides = clone();
  incompleteSides.issues.find(
    (item) => item.id === "issue-hosting-conflict",
  ).conflictSides.pop();
  assert.equal(hasFinding(incompleteSides, "invalid_issue_evidence"), true);

  const incompleteDuplicate = clone();
  incompleteDuplicate.issues.find(
    (item) => item.id === "issue-duplicate-api-topic",
  ).evidenceSnapshotRefs.pop();
  assert.equal(
    hasFinding(incompleteDuplicate, "invalid_issue_evidence"),
    true,
  );

  const staleCoverageDuplicate = clone();
  const secondStale = staleCoverageDuplicate.snapshots.find(
    (item) => item.id === "snapshot-hosting-decision-a",
  );
  secondStale.lastEditedAt = "2026-01-02T10:00:00Z";
  secondStale.observedVersion.value = secondStale.lastEditedAt;
  staleCoverageDuplicate.issues
    .find((item) => item.id === "issue-hosting-conflict")
    .conflictSides.find(
      (side) => side.objectRef === secondStale.id,
    ).observedVersion.value = secondStale.lastEditedAt;
  const duplicateStaleIssue = structuredClone(
    staleCoverageDuplicate.issues.find(
      (item) => item.id === "issue-stale-api-decision",
    ),
  );
  duplicateStaleIssue.id = "issue-stale-api-decision-duplicate";
  staleCoverageDuplicate.issues.push(duplicateStaleIssue);
  staleCoverageDuplicate.handoff.issueRefs.push(duplicateStaleIssue.id);
  refreshDigest(staleCoverageDuplicate);
  assert.equal(
    hasFinding(staleCoverageDuplicate, "invalid_issue_evidence"),
    true,
  );
});

test("knowledge gardener rejects control, reversibility, dependency, and readiness bypasses", () => {
  const restrictedToPublic = clone();
  const archive = restrictedToPublic.operations.find(
    (item) => item.kind === "archive",
  );
  archive.expectedAccessState = "available";
  archive.handling.classification = "public";
  archive.handling.audienceScope = ["public"];
  assert.equal(hasFinding(restrictedToPublic, "control_broadening"), true);

  for (const kind of ["archive", "move"]) {
    const irreversible = clone();
    irreversible.operations.find(
      (item) => item.kind === kind,
    ).reversible = false;
    assert.equal(
      hasFinding(irreversible, "irreversible_operation"),
      true,
      kind,
    );
  }

  const cycle = clone();
  cycle.operations.find((item) => item.kind === "rename").dependsOn = [
    "operation-move-api-notes",
  ];
  assert.equal(hasFinding(cycle, "dependency_cycle"), true);

  const premature = clone();
  premature.plan.status = "ready-for-human-review";
  premature.handoff.state = "ready-for-human-review";
  assert.equal(hasFinding(premature, "premature_plan_readiness"), true);

  const transitiveLaundering = clone();
  const referencingSnapshot = transitiveLaundering.snapshots.find(
    (item) => item.id === "snapshot-hosting-decision-a",
  );
  assert.deepEqual(referencingSnapshot.referenceRefs, [
    "snapshot-security-boundary",
  ]);
  referencingSnapshot.handling.classification = "confidential";
  referencingSnapshot.handling.audienceScope.push("architecture-team");
  referencingSnapshot.handling.retention.policyRefs = [
    "project-decisions-records",
  ];
  referencingSnapshot.handling.retention.retainUntil =
    "2032-12-31T23:59:59Z";
  assert.equal(
    hasFinding(transitiveLaundering, "control_inheritance_mismatch"),
    true,
  );

  const approvedConflictArchive = clone();
  const conflictArchive = approvedConflictArchive.operations.find(
    (item) => item.kind === "archive",
  );
  conflictArchive.state = "approved-for-human-application";
  conflictArchive.approvalRef = "approval-conflict-bypass";
  assert.equal(
    hasFinding(approvedConflictArchive, "conflict_operation_approval"),
    true,
  );

  const duplicateHandoffBlocker = clone();
  duplicateHandoffBlocker.handoff.blockerRefs[1] =
    duplicateHandoffBlocker.handoff.blockerRefs[0];
  assert.equal(
    hasFinding(duplicateHandoffBlocker, "incomplete_blocker_coverage"),
    true,
  );
});

test("knowledge gardener scans agent narrative but not the verbatim request", () => {
  for (const claim of [
    "I renamed the page and edited its properties.",
    "The page is now archived and its property was modified.",
    "Morgan Lee linked the record and updated the database.",
    "We wrote the page, moved it, and deleted the old record.",
  ]) {
    const value = clone();
    value.handoff.summary = claim;
    assert.equal(
      hasFinding(value, "unauthorized_narrative_action"),
      true,
      claim,
    );
  }

  const verbatimRequest = clone();
  verbatimRequest.plan.request =
    "The page was archived and the database was updated; inspect the supplied exact versions and prepare a plan.";
  refreshDigest(verbatimRequest);
  assert.deepEqual(findings(verbatimRequest), []);

  const proposedOwnerAction = clone();
  proposedOwnerAction.handoff.summary =
    "Proposed owner action: Morgan Lee should rename the page and edit its properties after a separate current-version review.";
  refreshDigest(proposedOwnerAction);
  assert.deepEqual(findings(proposedOwnerAction), []);
});

test("knowledge gardener rejects credential-shaped ids and secret-bearing exports", () => {
  for (const credential of [
    "ntn_1234567890abcdefghijklmnop",
    "secret_1234567890abcdefghijklmnop",
    "token_v2_1234567890abcdefghijklmnop",
    "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN",
  ]) {
    const value = clone();
    value.plan.observationInput.integrationRegistrationId = credential;
    assert.equal(validateSchema(value), false, credential);
    assert.equal(
      hasFinding(value, "invalid_observation_export"),
      true,
      credential,
    );
  }

  const secretBearing = clone();
  secretBearing.snapshots[0].observedValues[0].value =
    "secret_1234567890abcdefghijklmnop";
  assert.equal(
    hasFinding(secretBearing, "invalid_observation_export"),
    true,
  );

  const legacySecretBearing = clone();
  legacySecretBearing.snapshots[0].observedValues[0].value =
    "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN";
  assert.equal(
    hasFinding(legacySecretBearing, "invalid_observation_export"),
    true,
  );
});

test("knowledge gardener rejects embedded agent principals without substring false positives", () => {
  for (const principal of [
    { id: "team-planning-agent-owners", name: "Planning owners", type: "team" },
    { id: "team-maintainers", name: "Knowledge bot owners", type: "team" },
    { id: "human-claw-reviewer", name: "Casey Morgan", type: "human" },
    { id: "team-maintainers", name: "AI review team", type: "team" },
  ]) {
    const value = clone();
    value.questions[0].owner = principal;
    assert.equal(hasFinding(value, "agent_owned_authority"), true, principal.id);
  }

  const legitimate = clone();
  legitimate.questions[0].owner = {
    id: "team-robotics-aisha-clawson",
    name: "Aisha Clawson and Robotics",
    type: "team",
  };
  refreshDigest(legitimate);
  assert.deepEqual(findings(legitimate), []);
});

test("knowledge gardener rejects duplicate stable and canonical Notion identities", () => {
  const duplicateStableId = clone();
  duplicateStableId.snapshots[1].notionObjectId =
    duplicateStableId.snapshots[0].notionObjectId;
  assert.equal(
    hasFinding(duplicateStableId, "duplicate_notion_identity"),
    true,
  );

  const duplicateCanonicalUrl = clone();
  duplicateCanonicalUrl.snapshots[1].url = duplicateCanonicalUrl.snapshots[0].url;
  assert.equal(
    hasFinding(duplicateCanonicalUrl, "duplicate_notion_identity"),
    true,
  );
});

test("knowledge gardener binds issue grounding and proposal chronology exactly", () => {
  const ungrounded = clone();
  const draft = ungrounded.operations.find(
    (item) => item.id === "operation-draft-api-summary",
  );
  draft.issueRefs = ["issue-duplicate-api-topic"];
  assert.equal(hasFinding(ungrounded, "invalid_operation_evidence"), true);

  const beforeEvidence = clone();
  beforeEvidence.operations[0].proposedAt = "2026-08-31T17:29:59Z";
  assert.equal(
    hasFinding(beforeEvidence, "invalid_operation_chronology"),
    true,
  );

  const afterAsOf = clone();
  afterAsOf.operations[0].proposedAt = "2026-08-31T20:00:01Z";
  assert.equal(
    hasFinding(afterAsOf, "invalid_operation_chronology"),
    true,
  );
});

test("knowledge gardener digest binds export and authorization receipts", () => {
  const changedExport = clone();
  changedExport.plan.observationInput.exportVersion += 1;
  assert.equal(hasFinding(changedExport, "invalid_plan_digest"), true);

  const changedReceipt = clone();
  changedReceipt.plan.observationInput.authorizationReceipt.receiptId =
    "notion-authorization-receipt-replacement";
  assert.equal(hasFinding(changedReceipt, "invalid_plan_digest"), true);
});
