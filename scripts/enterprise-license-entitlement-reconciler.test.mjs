import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  computeAuthorityGrantDigest,
  computeAuthorityRosterDigest,
  computeCoverageDigest,
  computeDestinationApprovalDigest,
  computeEvidencePayloadDigest,
  computeEvidenceRecordDigest,
  computeHandoffDigest,
  computeRightsManifestDigest,
  computeRoundDigest,
  computeRowDigest,
  computeSkuMappingDigest,
  computeSourceExportDigest,
  contentAddressedEvidenceRef,
  enterpriseLicenseEntitlementFindings,
  resealEnterpriseLicenseEntitlement,
} from "./enterprise-license-entitlement-reconciler.mjs";

const root = new URL("..", import.meta.url);
const source = new URL(
  "../sources/enterprise-license-entitlement-reconciler/",
  import.meta.url,
);
const fixture = JSON.parse(
  await readFile(
    new URL("fixtures/license-entitlement-reconciliation.example.json", source),
    "utf8",
  ),
);
const trustRoot = JSON.parse(
  await readFile(new URL("fixtures/license-trust-root.example.json", source), "utf8"),
);
const schema = JSON.parse(
  await readFile(
    new URL("schemas/license-entitlement-reconciliation.schema.json", source),
    "utf8",
  ),
);
const template = await readFile(
  new URL("templates/license-entitlement-review.md", source),
  "utf8",
);
const contractReference = await readFile(
  new URL("references/license-reconciliation-contract.md", source),
  "utf8",
);
const visual = await readFile(
  new URL("assets/license-position-review.html", source),
  "utf8",
);
const AS_OF = "2026-09-03T18:00:00Z";
const options = { asOf: AS_OF, licenseTrustRoot: trustRoot };
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function resealed(change) {
  const candidate = clone();
  change(candidate);
  return resealEnterpriseLicenseEntitlement(candidate);
}

function findings(value, context = options) {
  return enterpriseLicenseEntitlementFindings(value, context);
}

function codes(value, context = options) {
  return new Set(findings(value, context).map((finding) => finding.code));
}

function assertSchemaValid(value, label) {
  assert.equal(
    validateSchema(value),
    true,
    `${label}: ${ajv.errorsText(validateSchema.errors)}`,
  );
}

function applyMutation(value, mutation) {
  const parent = mutation.path
    .slice(0, -1)
    .reduce((current, part) => current[part], value);
  const key = mutation.path.at(-1);
  if (mutation.operator === "remove") delete parent[key];
  else parent[key] = mutation.value;
  return value;
}

function addBlocker(value, { id, code, targetRef, detectedAt = "2026-09-02T13:00:00Z" }) {
  let blockerEvidence = value.evidence.find((row) => row.id === "evidence-blockers");
  if (!blockerEvidence) {
    blockerEvidence = structuredClone(
      value.evidence.find((row) => row.id === "evidence-exceptions"),
    );
    blockerEvidence.id = "evidence-blockers";
    blockerEvidence.kind = "blocker-record";
    blockerEvidence.observedAt = detectedAt;
    blockerEvidence.sourceRecordDigest = `sha256:${"c".repeat(64)}`;
    value.evidence.push(blockerEvidence);
  }
  value.blockers.push({
    id,
    code,
    targetRef,
    ownerRef: "principal-taylor-reviewer",
    detectedAt,
    evidenceRef: blockerEvidence.id,
  });
}

function splitReviewerEvidence(
  value,
  ledger,
  targetId,
  evidenceId,
  sourceDigit,
  producerRef = "principal-alex-reviewer",
) {
  const target = value[ledger].find((row) => row.id === targetId);
  const original = value.evidence.find((row) => row.id === target.evidenceRef);
  const partition = structuredClone(original);
  partition.id = evidenceId;
  partition.suppliedByRef = producerRef;
  partition.sourceRecordDigest = `sha256:${sourceDigit.repeat(64)}`;
  target.evidenceRef = evidenceId;
  value.evidence.push(partition);
  if (!value[ledger].some((row) => row.evidenceRef === original.id)) {
    value.evidence = value.evidence.filter((row) => row.id !== original.id);
  }
}

test("accepted artifact is strict, fully sealed, and semantically clean", () => {
  assertSchemaValid(fixture, "accepted fixture");
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.rightsManifest.contentDigest, computeRightsManifestDigest(fixture));
  assert.equal(fixture.skuMappingRegister.contentDigest, computeSkuMappingDigest(fixture));
  assert.equal(fixture.authorityRoster.contentDigest, computeAuthorityRosterDigest(fixture));
  assert.equal(fixture.round.roundDigest, computeRoundDigest(fixture));
  assert.equal(
    fixture.coverage.contentDigest,
    computeCoverageDigest(fixture.coverage, fixture),
  );
  assert.equal(
    fixture.destinationApproval.payloadDigest,
    computeDestinationApprovalDigest(fixture.destinationApproval),
  );
  assert.equal(
    fixture.handoff.payloadDigest,
    computeHandoffDigest(fixture.handoff, fixture),
  );
  for (const row of [...fixture.assignments, ...fixture.consumption]) {
    assert.equal(row.rowDigest, computeRowDigest(row));
  }
  for (const sourceExport of fixture.sourceExports) {
    const rows =
      sourceExport.kind === "assignment-export"
        ? fixture.assignments
        : fixture.consumption;
    assert.equal(
      sourceExport.contentDigest,
      computeSourceExportDigest(sourceExport, rows),
    );
  }
  for (const grant of fixture.authorityGrants) {
    assert.equal(grant.payloadDigest, computeAuthorityGrantDigest(grant));
  }
  for (const row of fixture.evidence) {
    assert.equal(
      row.payloadDigest,
      computeEvidencePayloadDigest(row.kind, fixture, row),
    );
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
    assert.equal(row.controlledRef, contentAddressedEvidenceRef(row));
  }
});

test("public CLI requires and accepts explicit asOf and license trust root", () => {
  const baseArgs = [
    "scripts/validate-artifact.mjs",
    "enterprise-license-entitlement-reconciler",
    "claws/enterprise-license-entitlement-reconciler/fixtures/license-entitlement-reconciliation.example.json",
  ];
  const missing = spawnSync(process.execPath, baseArgs, {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(missing.status, 1, missing.stderr);
  assert.ok(
    new Set(
      JSON.parse(missing.stdout).semanticFindings.map((finding) => finding.code),
    ).has("invalid_validation_context"),
  );

  const accepted = spawnSync(
    process.execPath,
    [
      ...baseArgs,
      "--as-of",
      AS_OF,
      "--license-trust-root",
      "claws/enterprise-license-entitlement-reconciler/fixtures/license-trust-root.example.json",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  assert.equal(JSON.parse(accepted.stdout).valid, true);
});

test("caller-controlled time is mandatory and wall clock is never consulted", () => {
  assert.ok(codes(fixture, {}).has("invalid_validation_context"));
  assert.ok(
    codes(fixture, {
      asOf: "2026-09-03T18:00:00",
      licenseTrustRoot: trustRoot,
    }).has("invalid_validation_context"),
  );
  assert.ok(
    codes(fixture, {
      asOf: "2026-09-31T18:00:00Z",
      licenseTrustRoot: trustRoot,
    }).has("invalid_validation_context"),
  );
  assert.deepEqual(
    findings(fixture, {
      asOf: "2026-09-03T18:00:00.123456Z",
      licenseTrustRoot: trustRoot,
    }),
    [],
  );
  assert.ok(
    codes(fixture, {
      asOf: "2026-09-03T16:59:59Z",
      licenseTrustRoot: trustRoot,
    }).has("future_evidence"),
  );
  const originalNow = Date.now;
  Date.now = () => {
    throw new Error("wall clock must not be read");
  };
  try {
    assert.deepEqual(findings(fixture), []);
  } finally {
    Date.now = originalNow;
  }
});

test("semantic validation is total and deterministically ordered over malformed input", () => {
  const malformed = [
    null,
    undefined,
    true,
    7,
    "artifact",
    [],
    {},
    {
      round: {},
      rightsManifest: {},
      skuMappingRegister: {},
      rights: [null],
      pools: {},
      skuMappings: false,
      sourceExports: [1],
      assignments: null,
      consumption: "bad",
      principals: [],
      authorityRoster: {},
      authorityGrants: [{}],
      positions: [{}],
      exceptions: [{}],
      decisions: [{}],
      blockers: [{}],
      evidence: [{}],
      coverage: {},
      destinationApproval: {},
      handoff: {},
    },
  ];
  for (const value of malformed) {
    assert.doesNotThrow(() => findings(value));
    const first = findings(value);
    const second = findings(value);
    assert.ok(first.length > 0);
    assert.deepEqual(first, second);
    assert.deepEqual(
      first,
      [...first].sort(
        (left, right) =>
          left.code.localeCompare(right.code) ||
          left.path.localeCompare(right.path) ||
          left.message.localeCompare(right.message),
      ),
    );
  }
});

test("packaged schema-valid adversarial fixtures trigger stable finding codes", async () => {
  for (const name of [
    "adversarial-trust-root-drift.json",
    "adversarial-unapproved-authority.json",
    "adversarial-unmapped-sku.json",
  ]) {
    const adversarial = JSON.parse(
      await readFile(new URL(`fixtures/${name}`, source), "utf8"),
    );
    const candidate = applyMutation(clone(), adversarial.mutation);
    assertSchemaValid(candidate, name);
    const actual = codes(candidate);
    for (const expected of adversarial.expectedFindingCodes) {
      assert.ok(actual.has(expected), `${name} should emit ${expected}`);
    }
  }
});

test("owner resealing cannot replace the external rights and SKU trust root", () => {
  const candidate = clone();
  candidate.rights[0].purchasedUnits = 121;
  candidate.pools[0].entitledUnits = 81;
  resealEnterpriseLicenseEntitlement(candidate);
  assertSchemaValid(candidate, "resealed rights mutation");
  assert.ok(codes(candidate).has("invalid_trust_root"));
});

test("public trust roots commit to immutable source-evidence anchors", () => {
  const candidate = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-rights",
    ).sourceRecordDigest = `sha256:${"d".repeat(64)}`;
  });
  assertSchemaValid(candidate, "substituted rights source evidence");
  assert.ok(codes(candidate).has("invalid_trust_root"));
});

test("mapping, pool arithmetic, closed coverage, and fresh decisions fail closed", () => {
  const mapping = clone();
  mapping.assignments[0].mappingRef = "mapping-not-owner-supplied";
  assert.ok(codes(mapping).has("invalid_mapping_binding"));

  const arithmetic = clone();
  arithmetic.positions[0].assignedUnits += 1;
  assert.ok(codes(arithmetic).has("invalid_position_arithmetic"));

  const coverage = clone();
  coverage.coverage.assignmentRefs.pop();
  assert.ok(codes(coverage).has("invalid_coverage"));

  const predecessorReplay = clone();
  predecessorReplay.decisions[0].predecessorDecisionRef = "decision-prior-round";
  assert.equal(validateSchema(predecessorReplay), false);
  assert.ok(codes(predecessorReplay).has("invalid_human_decision"));
});

test("decision authority is bound to the exact referenced grant", () => {
  const candidate = resealed((value) => {
    value.decisions[0].authorityGrantRef = "grant-review-field";
  });
  assertSchemaValid(candidate, "swapped same-reviewer grant");
  assert.ok(codes(candidate).has("invalid_human_decision"));
});

test("decision evidence requires the exact authorized producer and bounded chronology", () => {
  for (const decision of fixture.decisions) {
    const acceptedEvidence = fixture.evidence.find(
      (row) => row.id === decision.evidenceRef,
    );
    assert.ok(
      Date.parse(acceptedEvidence.observedAt) >
        Math.max(...fixture.positions.map((row) => Date.parse(row.reconciledAt))),
    );
    assert.equal(acceptedEvidence.observedAt, decision.reviewedAt);
  }

  const reassignedProducer = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-decisions",
    ).suppliedByRef = "principal-avery-rights";
  });
  assertSchemaValid(reassignedProducer, "reassigned decision evidence producer");
  assert.ok(codes(reassignedProducer).has("invalid_decision_evidence"));

  const preReconciliationEvidence = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-decisions",
    ).observedAt = "2026-09-02T11:59:59Z";
  });
  assertSchemaValid(preReconciliationEvidence, "pre-reconciliation decision evidence");
  assert.ok(codes(preReconciliationEvidence).has("invalid_decision_evidence"));

  const afterDecisionEvidence = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-decisions",
    ).observedAt = "2026-09-02T15:00:01Z";
  });
  assertSchemaValid(afterDecisionEvidence, "post-decision evidence");
  assert.ok(codes(afterDecisionEvidence).has("invalid_decision_evidence"));

  const beforeExceptionEvidence = resealed((value) => {
    for (const exception of value.exceptions) {
      exception.detectedAt = "2026-09-02T13:00:00Z";
    }
    value.evidence.find(
      (row) => row.id === "evidence-exceptions",
    ).observedAt = "2026-09-02T13:00:00Z";
    value.evidence.find(
      (row) => row.id === "evidence-decisions",
    ).observedAt = "2026-09-02T12:30:00Z";
  });
  assertSchemaValid(beforeExceptionEvidence, "decision evidence before exception");
  assert.ok(codes(beforeExceptionEvidence).has("invalid_decision_evidence"));
});

test("every evidence class is bound to its modeled producer", () => {
  const candidate = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-rights",
    ).suppliedByRef = "principal-harper-owner";
  });
  assertSchemaValid(candidate, "reassigned rights evidence producer");
  assert.ok(codes(candidate).has("invalid_evidence_producer"));
});

test("reconciliation occurs only after complete source exports exist", () => {
  const candidate = resealed((value) => {
    value.sourceExports.find(
      (row) => row.kind === "consumption-export",
    ).suppliedAt = "2026-09-02T13:00:00Z";
    value.evidence.find(
      (row) => row.id === "evidence-consumption",
    ).observedAt = "2026-09-02T13:00:00Z";
  });
  assertSchemaValid(candidate, "reconciliation before consumption export");
  assert.ok(codes(candidate).has("invalid_reconciliation_chronology"));
});

test("position reconciliation requires its exact target-bound current-round grant", () => {
  const candidate = resealed((value) => {
    value.principals.push({
      id: "principal-alex-reviewer",
      name: "Alex Reviewer",
      kind: "named-human",
      humanIdentityRef: "controlled://northwind/people/alex-reviewer",
      scopes: ["position-reconciler"],
    });
    const position = value.positions[0];
    position.reconciledByRef = "principal-alex-reviewer";
    splitReviewerEvidence(
      value,
      "positions",
      position.id,
      "evidence-position-alex-no-grant",
      "d",
    );
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.authorityRoster.digest =
    candidate.authorityRoster.contentDigest;
  assertSchemaValid(candidate, "second reconciler without exact grant");
  const result = codes(candidate, {
    asOf: AS_OF,
    licenseTrustRoot: candidateTrustRoot,
  });
  assert.ok(result.has("invalid_reconciliation_authority"));
  assert.ok(result.has("invalid_handoff"));
});

test("position reconcilers remain separated from source and control roles", () => {
  const candidate = resealed((value) => {
    const sourceOwner = value.principals.find(
      (row) => row.id === "principal-avery-rights",
    );
    sourceOwner.scopes.push("position-reconciler");
    const position = value.positions[0];
    position.reconciledByRef = sourceOwner.id;
    value.authorityGrants.find(
      (row) => row.id === position.authorityGrantRef,
    ).granteeRef = sourceOwner.id;
    splitReviewerEvidence(
      value,
      "positions",
      position.id,
      "evidence-position-source-owner",
      "c",
      sourceOwner.id,
    );
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.authorityRoster.digest =
    candidate.authorityRoster.contentDigest;
  assertSchemaValid(candidate, "source owner as position reconciler");
  assert.ok(
    codes(candidate, {
      asOf: AS_OF,
      licenseTrustRoot: candidateTrustRoot,
    }).has("invalid_role_separation"),
  );
});

test("role separation follows stable human identity across principal aliases", () => {
  const candidate = resealed((value) => {
    const sourceOwner = value.principals.find(
      (row) => row.id === "principal-avery-rights",
    );
    value.principals.find(
      (row) => row.id === "principal-taylor-reviewer",
    ).humanIdentityRef = sourceOwner.humanIdentityRef;
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.authorityRoster.digest =
    candidate.authorityRoster.contentDigest;
  assertSchemaValid(candidate, "aliased source owner and position reconciler");
  assert.ok(
    codes(candidate, {
      asOf: AS_OF,
      licenseTrustRoot: candidateTrustRoot,
    }).has("invalid_role_separation"),
  );
});

test("every entitlement pool resolves to a declared purchased right", () => {
  const candidate = resealed((value) => {
    value.pools[0].rightRef = "right-not-declared";
    value.positions[0].rightRef = "right-not-declared";
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.rightsManifest.digest =
    candidate.rightsManifest.contentDigest;
  assertSchemaValid(candidate, "pool with dangling right");
  assert.ok(
    codes(candidate, {
      asOf: AS_OF,
      licenseTrustRoot: candidateTrustRoot,
    }).has("invalid_pool_binding"),
  );
});

test("authority roster custodian requires its dedicated human scope", () => {
  const candidate = resealed((value) => {
    value.principals.find(
      (row) => row.id === value.authorityRoster.custodianRef,
    ).scopes = ["position-reconciler"];
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.authorityRoster.digest =
    candidate.authorityRoster.contentDigest;
  assertSchemaValid(candidate, "custodian without custodian scope");
  assert.ok(
    codes(candidate, {
      asOf: AS_OF,
      licenseTrustRoot: candidateTrustRoot,
    }).has("invalid_roster_custodian"),
  );
});

test("authority grants are closed over exact target ledgers and scope pairs", () => {
  const candidate = resealed((value) => {
    const grant = structuredClone(
      value.authorityGrants.find(
        (row) => row.id === "grant-reconcile-hq",
      ),
    );
    grant.id = "grant-phantom-position";
    grant.targetRef = "position-not-declared";
    value.authorityGrants.push(grant);
  });
  assertSchemaValid(candidate, "grant targeting a phantom position");
  assert.ok(codes(candidate).has("invalid_authority_grant"));
});

test("predecessor lineage cannot alias a current artifact identity", () => {
  const candidate = resealed((value) => {
    value.round.predecessorRoundRef = value.rights[0].id;
  });
  assertSchemaValid(candidate, "predecessor aliases current right");
  assert.ok(codes(candidate).has("invalid_predecessor_lineage"));

  const fabricated = resealed((value) => {
    value.round.predecessorRoundRef = "round-fabricated";
    value.round.predecessorRoundDigest = `sha256:${"d".repeat(64)}`;
  });
  assertSchemaValid(fabricated, "fabricated predecessor lineage");
  assert.ok(codes(fabricated).has("invalid_trust_root"));
});

test("source export evidence cannot predate its supplied export", () => {
  for (const evidenceId of [
    "evidence-assignments",
    "evidence-consumption",
  ]) {
    const candidate = resealed((value) => {
      value.evidence.find(
        (row) => row.id === evidenceId,
      ).observedAt = "2020-01-01T00:00:00Z";
    });
    assertSchemaValid(candidate, `${evidenceId} pre-export evidence`);
    assert.ok(
      codes(candidate).has("invalid_evidence_chronology"),
      evidenceId,
    );
  }
});

test("every purchased right covers the complete fixed period", () => {
  const candidate = resealed((value) => {
    value.rights[0].effectiveFrom = "2026-08-02T00:00:00Z";
  });
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.rightsManifest.digest =
    candidate.rightsManifest.contentDigest;
  assertSchemaValid(candidate, "right starts after period");
  const result = codes(candidate, {
    asOf: AS_OF,
    licenseTrustRoot: candidateTrustRoot,
  });
  assert.equal(result.has("invalid_trust_root"), false);
  assert.ok(result.has("invalid_right_period"));
});

test("unsupported blockers cannot manufacture a valid blocked handoff", () => {
  const candidate = resealed((value) => {
    addBlocker(value, {
      id: "blocker-fake-missing-evidence",
      code: "missing-evidence",
      targetRef: value.rights[0].id,
    });
  });
  assertSchemaValid(candidate, "unsupported missing-evidence blocker");
  assert.equal(candidate.handoff.state, "blocked");
  assert.ok(codes(candidate).has("invalid_blocker"));
});

test("exact blockers preserve valid unmapped and out-of-period source rows", () => {
  const unmapped = resealed((value) => {
    const row = structuredClone(value.assignments[0]);
    row.id = "assignment-unmapped";
    row.sourceSku = "UNKNOWN_SKU";
    row.mappingState = "unmapped";
    row.mappingRef = null;
    row.rightRef = null;
    row.poolRef = null;
    row.sourceUnits = 1;
    row.normalizedUnits = null;
    value.assignments.push(row);
    addBlocker(value, {
      id: "blocker-unmapped-assignment",
      code: "unmapped-sku",
      targetRef: row.id,
    });
  });
  assertSchemaValid(unmapped, "blocked unmapped assignment");
  assert.deepEqual(findings(unmapped), []);
  assert.equal(unmapped.handoff.state, "blocked");

  const mislabeledMappedSku = resealed((value) => {
    const row = structuredClone(value.assignments[0]);
    row.id = "assignment-mislabeled-unmapped";
    row.mappingState = "unmapped";
    row.mappingRef = null;
    row.rightRef = null;
    row.poolRef = null;
    row.sourceUnits = 1;
    row.normalizedUnits = null;
    value.assignments.push(row);
    addBlocker(value, {
      id: "blocker-mislabeled-unmapped",
      code: "unmapped-sku",
      targetRef: row.id,
    });
  });
  assertSchemaValid(mislabeledMappedSku, "mapped SKU mislabeled as unmapped");
  const mislabeledCodes = codes(mislabeledMappedSku);
  assert.ok(mislabeledCodes.has("invalid_mapping_resolution"));
  assert.ok(mislabeledCodes.has("invalid_blocker"));

  const outOfPeriod = resealed((value) => {
    const row = structuredClone(value.consumption[0]);
    row.id = "consumption-out-of-period";
    row.sourceUnits = 1;
    row.normalizedUnits = 1;
    row.periodStartsAt = "2026-07-01T00:00:00Z";
    row.periodEndsAt = "2026-08-01T00:00:00Z";
    row.periodState = "out-of-period";
    value.consumption.push(row);
    addBlocker(value, {
      id: "blocker-out-of-period-consumption",
      code: "out-of-period",
      targetRef: row.id,
    });
  });
  assertSchemaValid(outOfPeriod, "blocked out-of-period consumption");
  assert.deepEqual(findings(outOfPeriod), []);
  assert.equal(outOfPeriod.handoff.state, "blocked");

  const postCutoff = resealed((value) => {
    const row = structuredClone(value.assignments[0]);
    row.id = "assignment-post-cutoff";
    row.sourceUnits = 1;
    row.normalizedUnits = 1;
    row.observedAt = "2026-09-01T00:30:00Z";
    row.periodState = "out-of-period";
    value.assignments.push(row);
    addBlocker(value, {
      id: "blocker-post-cutoff-assignment",
      code: "out-of-period",
      targetRef: row.id,
    });
  });
  assertSchemaValid(postCutoff, "blocked post-cutoff assignment");
  assert.deepEqual(findings(postCutoff), []);
  assert.equal(postCutoff.handoff.state, "blocked");
});

test("complete assignment and consumption exports may contain zero rows", () => {
  const candidate = resealed((value) => {
    value.assignments = [];
    value.consumption = [];
    for (const position of value.positions) {
      position.assignedUnits = 0;
      position.consumedUnits = 0;
      position.assignmentDeltaUnits = position.entitledUnits;
      position.consumptionDeltaUnits = position.entitledUnits;
      position.state = "available-rights";
      position.assignmentRefs = [];
      position.consumptionRefs = [];
      const exception = value.exceptions.find(
        (row) => row.positionRef === position.id,
      );
      exception.code = "available-rights";
      exception.assignmentDeltaUnits = position.entitledUnits;
      exception.consumptionDeltaUnits = position.entitledUnits;
    }
  });
  assertSchemaValid(candidate, "complete zero-row source exports");
  assert.deepEqual(findings(candidate), []);
  assert.deepEqual(candidate.round.assignmentRefs, []);
  assert.deepEqual(candidate.round.consumptionRefs, []);
  assert.deepEqual(candidate.coverage.assignmentRefs, []);
  assert.deepEqual(candidate.coverage.consumptionRefs, []);
});

test("evidence partitions remain valid across multiple authorized reviewers", () => {
  const candidate = resealed((value) => {
    value.principals.push({
      id: "principal-alex-reviewer",
      name: "Alex Reviewer",
      kind: "named-human",
      humanIdentityRef: "controlled://northwind/people/alex-reviewer",
      scopes: ["position-reconciler", "exception-reviewer"],
    });
    value.positions.find(
      (row) => row.id === "position-analytics",
    ).reconciledByRef = "principal-alex-reviewer";
    value.exceptions.find(
      (row) => row.id === "exception-analytics",
    ).ownerRef = "principal-alex-reviewer";
    value.decisions.find(
      (row) => row.id === "decision-analytics",
    ).reviewedByRef = "principal-alex-reviewer";
    value.authorityGrants.find(
      (row) => row.id === "grant-review-analytics",
    ).granteeRef = "principal-alex-reviewer";
    value.authorityGrants.find(
      (row) => row.id === "grant-reconcile-analytics",
    ).granteeRef = "principal-alex-reviewer";
    splitReviewerEvidence(
      value,
      "positions",
      "position-analytics",
      "evidence-positions-alex",
      "c",
    );
    splitReviewerEvidence(
      value,
      "exceptions",
      "exception-analytics",
      "evidence-exceptions-alex",
      "f",
    );
    splitReviewerEvidence(
      value,
      "decisions",
      "decision-analytics",
      "evidence-decisions-alex",
      "0",
    );
  });
  assertSchemaValid(candidate, "multiple reviewer evidence partitions");
  const candidateTrustRoot = structuredClone(trustRoot);
  candidateTrustRoot.authorityRoster.digest =
    candidate.authorityRoster.contentDigest;
  assert.deepEqual(
    findings(candidate, {
      asOf: AS_OF,
      licenseTrustRoot: candidateTrustRoot,
    }),
    [],
  );
});

test("approval and handoff are strictly ordered after consumed reconciliation state", () => {
  const earlyApproval = resealed((value) => {
    value.destinationApproval.approvedAt = "2026-09-02T15:10:00Z";
    value.evidence.find(
      (row) => row.id === "evidence-destination",
    ).observedAt = "2026-09-02T15:10:00Z";
  });
  assertSchemaValid(earlyApproval, "approval concurrent with latest decision");
  assert.ok(codes(earlyApproval).has("invalid_approval_chronology"));

  const concurrentHandoff = resealed((value) => {
    value.handoff.handedOffAt = value.destinationApproval.approvedAt;
    value.evidence.find(
      (row) => row.id === "evidence-handoff",
    ).observedAt = value.destinationApproval.approvedAt;
  });
  assertSchemaValid(concurrentHandoff, "handoff concurrent with approval");
  assert.ok(codes(concurrentHandoff).has("invalid_handoff_chronology"));

  const afterWindow = resealed((value) => {
    value.authorityGrants.find(
      (row) => row.id === "grant-destination-approver",
    ).activeUntil = "2026-09-03T18:00:00Z";
    value.authorityGrants.find(
      (row) => row.id === "grant-handoff-owner",
    ).activeUntil = "2026-09-03T18:00:00Z";
    value.destinationApproval.approvedAt = "2026-09-03T17:30:00Z";
    value.evidence.find(
      (row) => row.id === "evidence-destination",
    ).observedAt = "2026-09-03T17:30:00Z";
    value.handoff.handedOffAt = "2026-09-03T17:45:00Z";
    value.evidence.find(
      (row) => row.id === "evidence-handoff",
    ).observedAt = "2026-09-03T17:45:00Z";
  });
  assertSchemaValid(afterWindow, "approval and handoff after round close");
  const afterWindowCodes = codes(afterWindow);
  assert.ok(afterWindowCodes.has("invalid_approval_chronology"));
  assert.ok(afterWindowCodes.has("invalid_handoff_chronology"));
});

test("material reconciliation changes require fresh approval and handoff roots", () => {
  const staleApproval = structuredClone(fixture.destinationApproval);
  const staleHandoff = structuredClone(fixture.handoff);
  const staleApprovalEvidence = structuredClone(
    fixture.evidence.find((row) => row.id === fixture.destinationApproval.evidenceRef),
  );
  const staleHandoffEvidence = structuredClone(
    fixture.evidence.find((row) => row.id === fixture.handoff.evidenceRef),
  );
  const candidate = resealed((value) => {
    value.assignments[0].sourceUnits = 69;
    value.assignments[0].normalizedUnits = 69;
    value.positions[0].assignedUnits = 69;
    value.positions[0].assignmentDeltaUnits = 11;
    value.exceptions[0].assignmentDeltaUnits = 11;
  });
  candidate.destinationApproval = staleApproval;
  candidate.handoff = staleHandoff;
  candidate.evidence = candidate.evidence.map((row) => {
    if (row.id === staleApprovalEvidence.id) return staleApprovalEvidence;
    if (row.id === staleHandoffEvidence.id) return staleHandoffEvidence;
    return row;
  });
  assertSchemaValid(candidate, "material change with stale approval roots");
  const result = codes(candidate);
  assert.ok(result.has("invalid_destination_approval"));
  assert.ok(result.has("invalid_handoff"));
});

test("terminal evidence substitutions invalidate approval or handoff roots", () => {
  const destinationSubstitution = clone();
  const destinationEvidence = destinationSubstitution.evidence.find(
    (row) => row.id === destinationSubstitution.destinationApproval.evidenceRef,
  );
  destinationEvidence.sourceRecordDigest = `sha256:${"d".repeat(64)}`;
  destinationEvidence.recordDigest =
    computeEvidenceRecordDigest(destinationEvidence);
  destinationEvidence.controlledRef =
    contentAddressedEvidenceRef(destinationEvidence);
  assertSchemaValid(
    destinationSubstitution,
    "substituted destination approval evidence",
  );
  const destinationCodes = codes(destinationSubstitution);
  assert.ok(destinationCodes.has("invalid_coverage"));
  assert.ok(destinationCodes.has("invalid_destination_approval"));

  const handoffSubstitution = clone();
  const handoffEvidence = handoffSubstitution.evidence.find(
    (row) => row.id === handoffSubstitution.handoff.evidenceRef,
  );
  handoffEvidence.sourceRecordDigest = `sha256:${"d".repeat(64)}`;
  handoffEvidence.recordDigest = computeEvidenceRecordDigest(handoffEvidence);
  handoffEvidence.controlledRef = contentAddressedEvidenceRef(handoffEvidence);
  assertSchemaValid(handoffSubstitution, "substituted handoff evidence");
  assert.ok(codes(handoffSubstitution).has("invalid_handoff"));
});

test("pending human decisions are schema-valid, covered, and block readiness", () => {
  const candidate = resealed((value) => {
    const exception = value.exceptions[0];
    const removedDecision = value.decisions.find(
      (decision) => decision.exceptionRef === exception.id,
    );
    exception.resolutionState = "pending-human-decision";
    exception.decisionRef = null;
    value.decisions = value.decisions.filter(
      (decision) => decision.exceptionRef !== exception.id,
    );
    value.evidence = value.evidence.filter(
      (row) => row.id !== removedDecision.evidenceRef,
    );
  });
  assertSchemaValid(candidate, "pending decision artifact");
  assert.deepEqual(findings(candidate), []);
  assert.equal(candidate.handoff.state, "blocked");
  assert.equal(candidate.decisions.length, candidate.exceptions.length - 1);
  assert.deepEqual(candidate.coverage.decisionRefs, candidate.round.decisionRefs);
  assert.deepEqual(candidate.handoff.decisionRefs, candidate.round.decisionRefs);

  const pendingWithDecision = clone();
  pendingWithDecision.exceptions[0].resolutionState = "pending-human-decision";
  assert.equal(validateSchema(pendingWithDecision), false);

  const reviewedWithoutDecision = clone();
  reviewedWithoutDecision.exceptions[0].decisionRef = null;
  assert.equal(validateSchema(reviewedWithoutDecision), false);
});

test("unit conversion rejects exact results outside the safe integer range", () => {
  const candidate = clone();
  candidate.skuMappings[0].conversionNumerator = 2;
  candidate.assignments[0].sourceUnits = Number.MAX_SAFE_INTEGER;
  candidate.assignments[0].normalizedUnits = Number.MAX_SAFE_INTEGER;
  assertSchemaValid(candidate, "maximum-safe source conversion");
  assert.doesNotThrow(() => findings(candidate));
  assert.ok(codes(candidate).has("unsupported_conversion_range"));
});

test("schema rejects contract interpretation and non-human authority surfaces", () => {
  const prose = clone();
  prose.rightsManifest.contractText = "interpreted terms";
  assert.equal(validateSchema(prose), false);

  const machineAuthority = clone();
  machineAuthority.principals[0].kind = "system";
  assert.equal(validateSchema(machineAuthority), false);
  assert.ok(codes(machineAuthority).has("invalid_human_authority"));
});

test("X3 and X4 surfaces preserve the same trust, coverage, time, and authority boundary", () => {
  for (const required of [
    "caller-supplied `asOf`",
    "`licenseTrustRoot`",
    "{{round.predecessorRoundDigest}}",
    "{{rightsManifest.contentDigest}}",
    "{{skuMappingRegister.contentDigest}}",
    "{{assignments[].mappingRef}}",
    "{{assignments[].mappingState}}",
    "{{assignments[].periodState}}",
    "{{consumption[].normalizedUnits}}",
    "{{positions[].assignmentDeltaUnits}}",
    "{{positions[].reconciledByRef}}",
    "{{positions[].authorityGrantRef}}",
    "{{exceptions[].resolutionState}}",
    "{{exceptions[].decisionRef}}",
    "{{decisions[].authorityGrantRef}}",
    "{{decisions[].predecessorDecisionRef}}",
    "{{blockers[].code}}",
    "{{blockers[].targetRef}}",
    "{{blockers[].ownerRef}}",
    "{{blockers[].detectedAt}}",
    "{{blockers[].evidenceRef}}",
    "{{handoff.trueUpSubmitted}}",
    "{{handoff.complianceDeclared}}",
    "{{handoff.effectiveAccessInferred}}",
    "{{handoff.effectiveUsageInferred}}",
  ]) {
    assert.ok(template.includes(required), `template must include ${required}`);
  }
  assert.match(contractReference, /--license-trust-root/u);
  assert.match(contractReference, /does not purchase, assign, revoke, renew/u);
  assert.match(visual, /Ready for owner review/u);
  assert.match(visual, /No effective access or effective usage was inferred/u);
  assert.match(visual, /outputs\/license-position-review\.md/u);
});
