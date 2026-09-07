import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeRetentionDispositionBatchDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/records-retention-disposition-coordinator/fixtures/retention-disposition.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/records-retention-disposition-coordinator/schemas/retention-disposition.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const ledgerFields = [
  "principals",
  "evidence",
  "schedules",
  "series",
  "records",
  "copies",
  "classifications",
  "triggerTypes",
  "triggerEvents",
  "rules",
  "eligibilities",
  "holds",
  "exceptions",
  "proposals",
  "batches",
  "approvals",
  "custodyEvents",
  "outcomes",
  "certificates",
  "residuals",
  "reviewGates",
  "authorityGates",
  "blockers",
];
const snapshotRefFields = new Map([
  ["principals", "principalRefs"],
  ["evidence", "evidenceRefs"],
  ["schedules", "scheduleRefs"],
  ["series", "seriesRefs"],
  ["records", "recordRefs"],
  ["copies", "copyRefs"],
  ["classifications", "classificationRefs"],
  ["triggerTypes", "triggerTypeRefs"],
  ["triggerEvents", "triggerEventRefs"],
  ["rules", "ruleRefs"],
  ["eligibilities", "eligibilityRefs"],
  ["holds", "holdRefs"],
  ["exceptions", "exceptionRefs"],
  ["proposals", "proposalRefs"],
  ["batches", "batchRefs"],
  ["approvals", "approvalRefs"],
  ["custodyEvents", "custodyEventRefs"],
  ["outcomes", "outcomeRefs"],
  ["certificates", "certificateRefs"],
  ["residuals", "residualRefs"],
  ["reviewGates", "reviewGateRefs"],
  ["authorityGates", "authorityGateRefs"],
  ["blockers", "blockerRefs"],
]);

function findings(candidate) {
  return validateArtifactSemantics(
    "records-retention-disposition-coordinator",
    candidate,
  );
}

function codes(candidate) {
  return new Set(findings(candidate).map((item) => item.code));
}

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

function allIds(candidate) {
  return ledgerFields.flatMap((field) =>
    Array.isArray(candidate[field])
      ? candidate[field]
          .filter((item) => item && typeof item.id === "string")
          .map((item) => item.id)
      : [],
  );
}

function refreshIndexes(candidate) {
  for (const [ledger, field] of snapshotRefFields) {
    candidate.snapshot[field] = candidate[ledger].map((item) => item.id);
  }
  const known = new Set(allIds(candidate));
  for (const evidence of candidate.evidence) {
    evidence.subjectRefs = evidence.subjectRefs.filter((ref) => known.has(ref));
  }
  for (const gate of candidate.reviewGates) {
    gate.targetRefs = gate.targetRefs.filter((ref) => known.has(ref));
  }
  candidate.handoff.coveredRefs = [...known];
  candidate.handoff.reviewGateRefs = candidate.reviewGates.map((item) => item.id);
  candidate.handoff.authorityGateRefs = candidate.authorityGates.map(
    (item) => item.id,
  );
  candidate.handoff.blockingRefs = candidate.blockers
    .filter((item) => item.status === "open")
    .map((item) => item.id);
}

function readyArtifact() {
  const candidate = structuredClone(fixture);
  const removedEvidenceKinds = new Set([
    "disposition-request",
    "disposition-attempt",
    "custodian-outcome",
    "authoritative-disposition-certificate",
  ]);
  candidate.evidence = candidate.evidence.filter(
    (item) => !removedEvidenceKinds.has(item.kind),
  );
  candidate.outcomes = [];
  candidate.certificates = [];
  for (const copy of candidate.copies) {
    copy.outcomeRefs = [];
    copy.certificateRefs = [];
  }
  for (const residual of candidate.residuals) {
    residual.state = "remaining";
    residual.certificateRef = null;
  }
  candidate.handoff.state = "ready-for-owner-action";
  candidate.handoff.summary =
    "The exact owner decision is recorded and the batch is ready for named-custodian action. This Claw performed no consequential action and makes no compliance or certification claim.";
  refreshIndexes(candidate);
  return candidate;
}

test("retention fixture and public CLI validate", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(
    fixture.batches[0].digest,
    computeRetentionDispositionBatchDigest(fixture.batches[0]),
  );
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "records-retention-disposition-coordinator",
      "claws/records-retention-disposition-coordinator/fixtures/retention-disposition.example.json",
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("retention validator is total over malformed arrays, rows, and nested lists", () => {
  for (const field of ledgerFields) {
    for (const malformed of [null, {}, [null, 7, "row"]]) {
      const candidate = mutate((value) => {
        value[field] = malformed;
      });
      assert.doesNotThrow(
        () => findings(candidate),
        `${field}: ${JSON.stringify(malformed)}`,
      );
      assert.ok(findings(candidate).length > 0, field);
    }
  }
  const nested = mutate((value) => {
    value.evidence[0].subjectRefs = {};
    value.records[0].copyRefs = null;
    value.proposals[0].recordRefs = "record-finance-close-2020";
    value.batches[0].proposalRefs = [null, "proposal-finance-close-2020"];
    value.handoff.coveredRefs = 42;
  });
  assert.doesNotThrow(() => findings(nested));
  assert.ok(codes(nested).has("invalid_string_list"));
});

test("retention schema is strict and rejects version or hybrid state", () => {
  const extraTopLevel = mutate((value) => {
    value.legacyDispositionState = "complete";
  });
  assert.equal(validateSchema(extraTopLevel), false);

  const wrongVersion = mutate((value) => {
    value.schemaVersion = "awesomeClaws.retentionDisposition.v0";
  });
  assert.equal(validateSchema(wrongVersion), false);
  assert.ok(codes(wrongVersion).has("invalid_retention_disposition_schema_version"));

  const hybridHandoff = mutate((value) => {
    value.handoff.state = "completed";
  });
  assert.equal(validateSchema(hybridHandoff), false);
});

test("retention accepts complete, ready, and explicitly blocked lifecycle states", () => {
  const ready = readyArtifact();
  assert.equal(validateSchema(ready), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(ready), []);

  const blocked = structuredClone(ready);
  blocked.snapshot.inventoryState = "incomplete";
  blocked.blockers.push({
    id: "blocker-inventory-incomplete",
    snapshotRef: blocked.snapshot.id,
    code: "inventory-incomplete",
    status: "open",
    ownerRef: "principal-jordan-lee",
    targetRefs: ["record-finance-close-2020"],
    evidenceRefs: ["evidence-inventory"],
  });
  blocked.handoff.state = "blocked";
  blocked.handoff.summary =
    "Inventory evidence is incomplete, so the lifecycle remains blocked for the named owner.";
  refreshIndexes(blocked);
  assert.equal(validateSchema(blocked), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(blocked), []);
});

test("retention rejects duplicate, dangling, reverse, orphan, and cross-snapshot state", () => {
  const duplicate = mutate((value) => {
    value.records[0].id = value.series[0].id;
  });
  assert.ok(codes(duplicate).has("duplicate_reference"));

  const dangling = mutate((value) => {
    value.records[0].copyRefs = ["copy-missing"];
  });
  assert.ok(codes(dangling).has("dangling_reference"));

  const reverse = mutate((value) => {
    value.classifications[0].recordRefs = [];
  });
  assert.ok(codes(reverse).has("missing_reverse_retention_reference"));

  for (const [ledger, index] of [
    ["records", 0],
    ["copies", 0],
    ["rules", 0],
  ]) {
    const missingEvidenceSubject = mutate((value) => {
      const row = value[ledger][index];
      const evidenceRef = row.evidenceRef ?? row.evidenceRefs[0];
      const evidence = value.evidence.find((item) => item.id === evidenceRef);
      evidence.subjectRefs = evidence.subjectRefs.filter((ref) => ref !== row.id);
    });
    assert.ok(
      codes(missingEvidenceSubject).has("missing_reverse_retention_reference"),
      ledger,
    );
  }

  const orphan = mutate((value) => {
    value.handoff.coveredRefs.pop();
  });
  assert.ok(codes(orphan).has("incomplete_retention_disposition_index"));

  const crossSnapshot = mutate((value) => {
    value.copies[0].snapshotRef = "SNAP-RET-OTHER";
  });
  assert.ok(codes(crossSnapshot).has("cross_retention_snapshot"));
});

test("retention enforces controlled evidence, stable digests, and minimized content", () => {
  for (const controlledRef of [
    "controlled://",
    "controlled:///record",
    "controlled://authority",
    "https://example.test/record",
  ]) {
    const candidate = mutate((value) => {
      value.evidence[0].controlledRef = controlledRef;
    });
    assert.ok(codes(candidate).has("invalid_retention_evidence"), controlledRef);
  }

  const badDigest = mutate((value) => {
    value.evidence[0].digest = "sha256:short";
  });
  assert.ok(codes(badDigest).has("invalid_retention_evidence"));

  const exposedPersonalData = mutate((value) => {
    value.handoff.summary = "Send the record to person@example.test.";
  });
  assert.ok(codes(exposedPersonalData).has("unminimized_retention_content"));

  const secret = mutate((value) => {
    value.handoff.summary = "Bearer sk_live_example_secret_123456";
  });
  assert.ok(codes(secret).has("unminimized_retention_content"));
});

test("retention eligibility requires exact schedule, classification, trigger, rule, and time", () => {
  const unsupportedSchedule = mutate((value) => {
    value.schedules[0].supported = false;
  });
  assert.ok(codes(unsupportedSchedule).has("unsupported_retention_schedule"));
  assert.ok(codes(unsupportedSchedule).has("invalid_retention_eligibility"));

  const inferredClassification = mutate((value) => {
    value.classifications[0].supplied = false;
  });
  assert.ok(
    codes(inferredClassification).has("unsupported_supplied_classification"),
  );

  const unsupportedTrigger = mutate((value) => {
    value.triggerEvents[0].supported = false;
  });
  assert.ok(codes(unsupportedTrigger).has("unsupported_retention_trigger"));

  const invalidTimezone = mutate((value) => {
    value.triggerEvents[0].timezone = "Not/AZone";
  });
  assert.ok(codes(invalidTimezone).has("unsupported_retention_trigger"));

  const dateDrift = mutate((value) => {
    value.eligibilities[0].eligibleOn = "2026-09-01";
  });
  assert.ok(codes(dateDrift).has("invalid_retention_eligibility"));

  const ruleMismatch = mutate((value) => {
    value.rules[0].classificationLabels = ["other"];
  });
  assert.ok(codes(ruleMismatch).has("invalid_retention_eligibility"));

  const crossScheduleTrigger = mutate((value) => {
    const secondSchedule = structuredClone(value.schedules[0]);
    secondSchedule.id = "schedule-finance-v8";
    secondSchedule.version = "8.0";
    secondSchedule.seriesRefs = [];
    secondSchedule.ruleRefs = [];
    const secondEvidence = structuredClone(
      value.evidence.find((item) => item.id === secondSchedule.evidenceRef),
    );
    secondEvidence.id = "evidence-schedule-v8";
    secondEvidence.subjectRefs = [secondSchedule.id];
    secondSchedule.evidenceRef = secondEvidence.id;
    value.schedules.push(secondSchedule);
    value.evidence.push(secondEvidence);
    value.triggerTypes[0].scheduleRef = secondSchedule.id;
    refreshIndexes(value);
  });
  assert.equal(
    validateSchema(crossScheduleTrigger),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.ok(codes(crossScheduleTrigger).has("invalid_retention_eligibility"));

  const inclusiveLocalBoundary = mutate((value) => {
    value.schedules[0].effectiveThrough = value.triggerEvents[0].occurredOn;
  });
  assert.equal(
    validateSchema(inclusiveLocalBoundary),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.deepEqual(findings(inclusiveLocalBoundary), []);
});

test("retention holds fail closed and require scoped ordered human evidence", () => {
  for (const state of ["active", "unknown", "conflicting", "incomplete"]) {
    const candidate = mutate((value) => {
      value.holds[0].state = state;
      value.holds[0].releasedByRef = null;
      value.holds[0].releasedAt = null;
      value.holds[0].releaseEvidenceRef = null;
    });
    assert.ok(
      codes(candidate).has("hold_blocks_retention_eligibility"),
      state,
    );
    assert.ok(codes(candidate).has("invalid_retention_handoff_state"), state);
  }

  const broader = mutate((value) => {
    value.holds[0].scopeKind = "broader";
  });
  assert.ok(codes(broader).has("hold_blocks_retention_eligibility"));

  const unscopedRelease = mutate((value) => {
    value.principals[3].scopes = ["hold-issuance"];
  });
  assert.ok(codes(unscopedRelease).has("missing_retention_authority_scope"));

  const invertedRelease = mutate((value) => {
    value.holds[0].releasedAt = "2025-12-01T00:00:00Z";
  });
  assert.ok(codes(invertedRelease).has("invalid_retention_hold_evidence"));

  const wrongTargetType = mutate((value) => {
    value.holds[0].coveredRefs = [value.principals[0].id];
  });
  assert.ok(codes(wrongTargetType).has("dangling_reference"));

  const incompleteRecordScope = mutate((value) => {
    value.holds[0].coveredRefs = [value.records[0].id];
  });
  assert.ok(codes(incompleteRecordScope).has("invalid_retention_hold_evidence"));
});

test("retention exceptions prohibit self approval, expiry, unscoped roles, and inverted chronology", () => {
  const selfApproved = mutate((value) => {
    value.exceptions[0].approvedByRef = value.exceptions[0].requestedByRef;
  });
  assert.ok(codes(selfApproved).has("invalid_retention_exception"));

  const expired = mutate((value) => {
    value.exceptions[0].expiresAt = "2026-09-01T18:30:00Z";
  });
  assert.ok(codes(expired).has("invalid_retention_exception"));

  const unscoped = mutate((value) => {
    value.principals[5].scopes = ["disposition-approval"];
  });
  assert.ok(codes(unscoped).has("missing_retention_authority_scope"));

  const inverted = mutate((value) => {
    value.exceptions[0].approvedAt = "2026-09-01T17:00:00Z";
  });
  assert.ok(codes(inverted).has("invalid_retention_exception"));

  const bareRole = mutate((value) => {
    value.principals[5].name = "Disposition approver";
  });
  assert.ok(codes(bareRole).has("bare_retention_role_principal"));

  const wrongTargetType = mutate((value) => {
    value.exceptions[0].targetRefs = [value.principals[0].id];
  });
  assert.ok(codes(wrongTargetType).has("dangling_reference"));

  const incompleteRecordScope = mutate((value) => {
    value.exceptions[0].targetRefs = [value.records[0].id];
  });
  assert.ok(codes(incompleteRecordScope).has("invalid_retention_exception"));
});

test("retention batches and approvals bind exact items, digest, destination, and chronology", () => {
  const changedItem = mutate((value) => {
    value.batches[0].copyRefs.pop();
  });
  assert.ok(codes(changedItem).has("invalid_disposition_batch_digest"));

  const changedDigest = mutate((value) => {
    value.batches[0].digest = `sha256:${"f".repeat(64)}`;
  });
  assert.ok(codes(changedDigest).has("invalid_disposition_batch_digest"));

  const staleApproval = mutate((value) => {
    value.approvals[0].decidedAt = "2026-09-01T16:00:00Z";
  });
  assert.ok(codes(staleApproval).has("invalid_disposition_approval"));

  const selfApproval = mutate((value) => {
    value.approvals[0].decidedByRef = value.batches[0].createdByRef;
  });
  assert.ok(codes(selfApproval).has("invalid_disposition_approval"));

  const methodDrift = mutate((value) => {
    value.approvals[0].method = "other-method";
  });
  assert.ok(codes(methodDrift).has("invalid_disposition_approval"));

  const revoked = mutate((value) => {
    const rejection = structuredClone(value.approvals[0]);
    rejection.id = "approval-finance-2026-09-a-rejected";
    rejection.decision = "rejected";
    rejection.decidedAt = "2026-09-02T12:30:00Z";
    rejection.evidenceRef = "evidence-batch-rejection";
    const evidence = structuredClone(
      value.evidence.find((item) => item.id === "evidence-batch-approval"),
    );
    evidence.id = rejection.evidenceRef;
    evidence.observedAt = "2026-09-02T12:31:00Z";
    evidence.subjectRefs = [rejection.id];
    value.approvals.push(rejection);
    value.evidence.push(evidence);
    refreshIndexes(value);
  });
  assert.equal(validateSchema(revoked), true, JSON.stringify(validateSchema.errors));
  assert.ok(codes(revoked).has("invalid_retention_handoff_state"));
});

test("retention separates requests and attempts from independently proven outcomes", () => {
  const attemptedOnly = mutate((value) => {
    value.outcomes[2].status = "attempted";
  });
  assert.ok(codes(attemptedOnly).has("invalid_authoritative_disposition_certificate"));
  assert.ok(codes(attemptedOnly).has("invalid_retention_handoff_state"));

  for (const state of ["failed", "partial", "unknown"]) {
    const candidate = mutate((value) => {
      value.outcomes[2].status = state;
    });
    assert.ok(
      codes(candidate).has("invalid_authoritative_disposition_certificate"),
      state,
    );
    assert.ok(codes(candidate).has("invalid_retention_handoff_state"), state);
  }

  const commandAsCertificate = mutate((value) => {
    value.certificates[0].outcomeRef = "outcome-primary-requested";
  });
  assert.ok(
    codes(commandAsCertificate).has(
      "invalid_authoritative_disposition_certificate",
    ),
  );
});

test("retention completion needs independent exact certificates and residual closure", () => {
  const sameObserver = mutate((value) => {
    value.certificates[0].observedByRef = value.certificates[0].custodianRef;
  });
  assert.ok(
    codes(sameObserver).has("invalid_authoritative_disposition_certificate"),
  );

  const wrongBatch = mutate((value) => {
    value.certificates[0].batchDigest = `sha256:${"e".repeat(64)}`;
  });
  assert.ok(codes(wrongBatch).has("invalid_authoritative_disposition_certificate"));

  const earlyCertificate = mutate((value) => {
    value.certificates[0].observedAt = "2026-09-02T11:00:00Z";
  });
  assert.ok(
    codes(earlyCertificate).has("invalid_authoritative_disposition_certificate"),
  );

  for (const state of ["remaining", "unknown"]) {
    const candidate = mutate((value) => {
      value.residuals[1].state = state;
    });
    assert.ok(codes(candidate).has("invalid_retention_handoff_state"), state);
  }

  const hiddenReplica = mutate((value) => {
    value.residuals[1].locationKind = "unknown";
    value.residuals[1].locationRef = null;
  });
  assert.ok(codes(hiddenReplica).has("invalid_residual_copy_closure"));

  const contradictoryKind = mutate((value) => {
    value.residuals[1].locationKind = "replica";
  });
  assert.ok(codes(contradictoryKind).has("invalid_residual_copy_closure"));
});

test("retention requires exact blocker equality and independent post-evidence review", () => {
  const hiddenBlocker = mutate((value) => {
    value.blockers.push({
      id: "blocker-hidden",
      snapshotRef: value.snapshot.id,
      code: "hidden",
      status: "open",
      ownerRef: "principal-jordan-lee",
      targetRefs: ["record-finance-close-2020"],
      evidenceRefs: ["evidence-inventory"],
    });
    value.snapshot.blockerRefs = ["blocker-hidden"];
    value.handoff.coveredRefs.push("blocker-hidden");
  });
  assert.ok(
    codes(hiddenBlocker).has("incomplete_retention_disposition_index"),
  );

  const nonIndependent = mutate((value) => {
    value.reviewGates.at(-1).reviewerRef = "principal-dana-brooks";
  });
  assert.ok(codes(nonIndependent).has("invalid_independent_retention_review"));

  const earlyReview = mutate((value) => {
    value.reviewGates[0].reviewedAt = "2026-09-01T00:00:00Z";
  });
  assert.ok(codes(earlyReview).has("invalid_retention_review_gate"));
});

test("retention rejects prohibited affirmative narratives and preserves genuine negation", () => {
  const prohibited = [
    "Interpret the retention schedule.",
    "Interpreted the retention schedule.",
    "Classify the record.",
    "Classified the record.",
    "Determine the legal obligation.",
    "Determined the legal obligations.",
    "Issue the hold.",
    "Released the hold.",
    "Grant the exception.",
    "Approved the disposition.",
    "Approve the batch.",
    "Accepted the risk.",
    "Delete the record.",
    "Deleted the records.",
    "Destroy the copy.",
    "Destroyed the data.",
    "Move the record.",
    "Moved the copies.",
    "Transfer custody.",
    "Transferred the records.",
    "Mutated the owner system.",
    "Declared compliance.",
    "Certified the disposition.",
    "The disposition is certified.",
    "Contacted the custodian.",
    "Publish the artifact.",
    "Issued a hold.",
    "Granted an exception.",
    "Approved a batch.",
    "Destroyed a copy.",
    "Interpreted retention schedules.",
  ];
  for (const text of prohibited) {
    const candidate = mutate((value) => {
      value.handoff.summary = text;
    });
    assert.ok(
      codes(candidate).has("unauthorized_retention_narrative_action"),
      text,
    );
  }

  const safe = [
    "Do not interpret the retention schedule.",
    "The team did not classify the record.",
    "No hold was released.",
    "We did not approve the batch.",
    "The custodian never deleted the records or moved the records.",
    "The artifact is not certified.",
    "No compliance declaration occurred.",
    "We didn't approve the batch.",
    "The records aren't deleted or moved.",
  ];
  for (const text of safe) {
    const candidate = mutate((value) => {
      value.handoff.summary = text;
    });
    assert.equal(
      codes(candidate).has("unauthorized_retention_narrative_action"),
      false,
      text,
    );
  }

  const mixed = mutate((value) => {
    value.handoff.summary =
      "We did not approve the batch but deleted the records.";
  });
  assert.ok(codes(mixed).has("unauthorized_retention_narrative_action"));

  const bareCounsel = mutate((value) => {
    value.principals[0].name = "Legal counsel";
  });
  assert.ok(codes(bareCounsel).has("bare_retention_role_principal"));

  const namedCounsel = mutate((value) => {
    value.principals[0].name = "Jordan Lee, Legal counsel";
  });
  assert.equal(codes(namedCounsel).has("bare_retention_role_principal"), false);
});

test("retention starter remains base-only", async () => {
  const manifest = await readFile(
    new URL(
      "../claws/records-retention-disposition-coordinator/CLAW.md",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(manifest, /\npackages: \[\]\n/u);
  assert.match(manifest, /\nmcpServers: \{\}\n/u);
  assert.match(manifest, /\ncronJobs: \[\]\n/u);
  assert.doesNotMatch(
    manifest,
    /\n(?:skills|plugins|bootstrap|dashboard|delegation|browser|shell|messaging|openclawProfile):/u,
  );
});
