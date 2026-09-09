import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  canonicalJson,
  compareUtf16CodeUnits,
  computeAuthorityRosterDigest,
  computeAuthorityGrantPayloadDigest,
  computeEvidenceRecordDigest,
  computeExportManifestDigest,
  computePartitionEvidenceRootDigest,
  computePrincipalPayloadDigest,
  computeRoundRootDigest,
  computeRowDigest,
  computeSourceEvidenceRootDigest,
  contentAddressedControlledRef,
  financialAccountReconciliationFindings,
  recomputeArtifactDigests,
} from "./financial-account-reconciliation-coordinator.mjs";

const VALIDATION_CONTEXT = Object.freeze({ asOf: "2026-09-02T00:00:00Z" });

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/financial-account-reconciliation-coordinator/fixtures/financial-account-reconciliation.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/financial-account-reconciliation-coordinator/schemas/financial-account-reconciliation.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/financial-account-reconciliation-coordinator/templates/financial-account-reconciliation.md",
    import.meta.url,
  ),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

function resign(change) {
  const candidate = mutate(change);
  recomputeArtifactDigests(candidate);
  return candidate;
}

function findings(candidate) {
  return financialAccountReconciliationFindings(candidate, VALIDATION_CONTEXT);
}

function codes(candidate) {
  return new Set(findings(candidate).map((item) => item.code));
}

function assertSchemaValid(candidate, label) {
  assert.equal(
    validateSchema(candidate),
    true,
    `${label}: ${JSON.stringify(validateSchema.errors)}`,
  );
}

function assertFinding(candidate, expectedCode, label, schemaValid = true) {
  if (schemaValid) assertSchemaValid(candidate, label);
  assert.ok(
    codes(candidate).has(expectedCode),
    `${label}: ${JSON.stringify(findings(candidate))}`,
  );
}

function omitLedgerResidual(candidate) {
  candidate.residuals = candidate.residuals.filter(
    (row) => row.id !== "residual-ledger-review",
  );
  candidate.evidence = candidate.evidence.filter(
    (row) => row.id !== "evidence-residual-ledger",
  );
  candidate.coverage.residualLedgerRowRefs = [];
  candidate.coverage.residualRefs = candidate.coverage.residualRefs.filter(
    (ref) => ref !== "residual-ledger-review",
  );
  candidate.handoff.counts.ledgerResiduals = 0;
  candidate.handoff.indexes.residualRefs =
    candidate.handoff.indexes.residualRefs.filter(
      (ref) => ref !== "residual-ledger-review",
    );
}

function addBlocker(
  candidate,
  code,
  targetRefs = ["group-deposit-split"],
  suffix = "current-defect",
) {
  const blockerId = `blocker-${suffix}`;
  const evidenceId = `evidence-blocker-${suffix}`;
  candidate.blockers.push({
    id: blockerId,
    roundRef: candidate.round.id,
    code,
    ownerRef: "principal-ruth-abara",
    raisedAt: "2026-09-01T02:50:00Z",
    targetRefs,
    evidenceRefs: [evidenceId],
  });
  candidate.evidence.push({
    id: evidenceId,
    kind: "blocker-record",
    controlledSource: "finance-reconciliation",
    controlledPurpose: "blocker-record",
    controlledRef:
      "controlled://finance-reconciliation/blocker-record@sha256-0000000000000000000000000000000000000000000000000000000000000000",
    payloadDigest:
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    recordDigest:
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    observedAt: "2026-09-01T02:50:00Z",
    suppliedByRef: "principal-ruth-abara",
    subjectRefs: [blockerId, ...targetRefs],
  });
  candidate.handoff.counts.blockers = candidate.blockers.length;
  candidate.handoff.indexes.blockerRefs = candidate.blockers.map((row) => row.id);
}

test("fixture is schema-valid, content-bound, and has zero semantic findings", () => {
  assertSchemaValid(fixture, "fixture");
  assert.deepEqual(findings(fixture), []);

  assert.equal(
    fixture.authorityRoster.rosterDigest,
    computeAuthorityRosterDigest(fixture.principals),
  );
  assert.equal(fixture.round.roundRootDigest, computeRoundRootDigest(fixture));
  for (const grant of fixture.authorityGrants) {
    const issuer = fixture.principals.find((row) => row.id === grant.issuedByRef);
    const grantee = fixture.principals.find((row) => row.id === grant.granteeRef);
    assert.equal(grant.issuerPrincipalDigest, computePrincipalPayloadDigest(issuer));
    assert.equal(grant.granteePrincipalDigest, computePrincipalPayloadDigest(grantee));
    for (const decision of fixture.matchGroups
      .map((row) => row.decision)
      .filter((row) => row.authorityGrantRef === grant.id)) {
      assert.equal(
        decision.authorityGrantPayloadDigest,
        computeAuthorityGrantPayloadDigest(grant),
      );
    }
  }
  assert.equal(
    fixture.ledgerExport.rowManifestDigest,
    computeExportManifestDigest(fixture.ledgerRows),
  );
  assert.equal(
    fixture.ledgerExport.sourceEvidenceRootDigest,
    computeSourceEvidenceRootDigest(fixture.ledgerRows, fixture.evidence),
  );
  assert.equal(
    fixture.statementExport.rowManifestDigest,
    computeExportManifestDigest(fixture.statementRows),
  );
  assert.equal(
    fixture.statementExport.sourceEvidenceRootDigest,
    computeSourceEvidenceRootDigest(fixture.statementRows, fixture.evidence),
  );
  assert.equal(
    fixture.handoff.partitionEvidenceRootDigest,
    computePartitionEvidenceRootDigest(fixture),
  );
  for (const row of [...fixture.ledgerRows, ...fixture.statementRows]) {
    assert.equal(row.rowDigest, computeRowDigest(row));
  }
  for (const row of fixture.evidence) {
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
    assert.equal(row.controlledRef, contentAddressedControlledRef(row));
    assert.match(row.controlledRef, new RegExp(`${row.recordDigest.slice(7)}$`, "u"));
  }
});

test("handoff template renders the complete reviewable evidence contract", () => {
  for (const required of [
    "## Principals and authority",
    "{{authorityRoster.rosterDigest}}",
    "{{authorityGrants[].granteePrincipalDigest}}",
    "{{authorityGrants[].issuerPrincipalDigest}}",
    "{{authorityGrants[].authorityRosterEvidenceControlledRef}}",
    "## Evidence ledger",
    "{{evidence[].recordDigest}}",
    "## Source-row ledgers",
    "{{ledgerExport.sourceSystemRef}}",
    "{{ledgerExport.rowRefs}}",
    "{{ledgerExport.exportedAt}}",
    "{{ledgerExport.evidenceRef}}",
    "{{ledgerRows[].exportRef}}",
    "{{ledgerRows[].minorUnits}}",
    "{{statementRows[].exportRef}}",
    "{{statementRows[].minorUnits}}",
    "{{matchGroups[].decision.authorityGrantRef}}",
    "{{matchGroups[].decision.authorityGrantPayloadDigest}}",
    "{{matchGroups[].decision.authorityGrantEvidenceControlledRef}}",
    "{{matchGroups[].decision.authorityRosterDigest}}",
    "resolve",
    "exactly one source-row ledger entry by exact `id`",
    "fail rendering on a missing or",
    "{{residuals[].ledgerManifestDigest}}",
    "{{round.destination.approvedByRef}}",
    "{{round.destination.approvedAt}}",
    "{{round.destination.authorityRosterDigest}}",
    "{{round.destination.authorityGrantPayloadDigest}}",
    "{{round.destination.authorityGrantEvidenceControlledRef}}",
    "{{handoff.destinationApprovalEvidenceControlledRef}}",
    "{{handoff.authorityGrantPayloadDigest}}",
    "{{handoff.authorityGrantEvidenceControlledRef}}",
    "{{handoff.indexes.blockerRefs}}",
  ]) {
    assert.ok(template.includes(required), required);
  }
});

test("principal names cannot alter the Markdown evidence tables", () => {
  for (const name of ["Mara | owner", "Mara\nowner", "Mara `owner`"]) {
    const candidate = mutate((value) => {
      value.principals[1].name = name;
    });
    assert.equal(validateSchema(candidate), false, name);
  }
});

test("semantic validation is total over malformed direct input", () => {
  for (const candidate of [
    null,
    undefined,
    true,
    42,
    "artifact",
    [],
    {},
    {
      round: null,
      principals: {},
      authorityGrants: "bad",
      evidence: [null, 7, "bad"],
      ledgerRows: 42,
      statementRows: false,
      matchGroups: {},
      residuals: null,
      blockers: "bad",
    },
    {
      evidence: [
        {
          id: "evidence-without-export",
          kind: "ledger-export-record",
        },
      ],
      principals: [],
      authorityGrants: [],
      ledgerRows: [],
      statementRows: [],
      matchGroups: [],
      residuals: [],
      blockers: [],
    },
  ]) {
    assert.doesNotThrow(() => findings(candidate));
    assert.ok(findings(candidate).length > 0);
  }
});

test("validation requires an explicit trusted asOf and never consults wall-clock time", () => {
  const contextlessFindings = financialAccountReconciliationFindings(fixture);
  assert.ok(
    contextlessFindings.some((item) => item.code === "invalid_validation_context"),
  );
  assert.ok(
    contextlessFindings.some(
      (item) => item.code === "invalid_handoff" && item.path === "handoff.state",
    ),
  );
  assert.deepEqual(findings(fixture), []);
});

test("offset-less timestamps fail semantic validation under every process timezone", () => {
  const offsetlessAsOf = "2026-09-02T00:00:00";
  assert.ok(
    financialAccountReconciliationFindings(fixture, { asOf: offsetlessAsOf }).some(
      (item) => item.code === "invalid_validation_context",
    ),
  );

  const offsetlessArtifact = resign((value) => {
    value.ledgerExport.exportedAt = "2026-09-01T00:15:00";
    for (const row of value.evidence.filter(
      (item) =>
        item.kind === "ledger-export-record" || item.kind === "ledger-row-record",
    )) {
      row.observedAt = "2026-09-01T00:15:00";
    }
  });
  assert.ok(
    codes(offsetlessArtifact).has("stale_export"),
    JSON.stringify(findings(offsetlessArtifact)),
  );

  const moduleUrl = new URL(
    "./financial-account-reconciliation-coordinator.mjs",
    import.meta.url,
  ).href;
  const fixtureUrl = new URL(
    "../sources/financial-account-reconciliation-coordinator/fixtures/financial-account-reconciliation.example.json",
    import.meta.url,
  ).href;
  const script = `
    import { readFile } from "node:fs/promises";
    import { financialAccountReconciliationFindings } from ${JSON.stringify(moduleUrl)};
    const fixture = JSON.parse(await readFile(new URL(${JSON.stringify(fixtureUrl)}), "utf8"));
    const invalid = financialAccountReconciliationFindings(
      fixture,
      { asOf: ${JSON.stringify(offsetlessAsOf)} },
    ).some((item) => item.code === "invalid_validation_context");
    if (!invalid) process.exit(1);
  `;
  for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      {
        encoding: "utf8",
        env: { ...process.env, TZ: timezone },
      },
    );
    assert.equal(
      child.status,
      0,
      `${timezone}: ${child.stderr || child.stdout}`,
    );
  }
});

test("canonicalization uses deterministic UTF-16 code-unit ordering", () => {
  const astral = "\u{10000}";
  const privateUse = "\uE000";
  assert.equal(compareUtf16CodeUnits(astral, privateUse), -1);
  assert.equal(
    canonicalJson({ [privateUse]: 1, [astral]: 2, z: 3 }),
    `{"z":3,${JSON.stringify(astral)}:2,${JSON.stringify(privateUse)}:1}`,
  );
  assert.equal(
    computeExportManifestDigest([...fixture.ledgerRows].reverse()),
    fixture.ledgerExport.rowManifestDigest,
  );
});

test("row, manifest, evidence payload, record, and controlled-ref tampering is detected", () => {
  assertFinding(
    mutate((value) => {
      value.ledgerRows[0].minorUnits = "10001";
    }),
    "invalid_row_digest",
    "row payload tamper",
  );
  assertFinding(
    mutate((value) => {
      value.ledgerExport.rowManifestDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_export_digest",
    "manifest tamper",
  );
  assertFinding(
    mutate((value) => {
      value.evidence[0].payloadDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_evidence_digest",
    "evidence payload tamper",
  );
  assertFinding(
    mutate((value) => {
      value.evidence[0].controlledRef =
        "controlled://finance-reconciliation/authority/operating-2026-08@sha256-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_evidence_digest",
    "controlled-ref suffix tamper",
  );
});

test("frozen export evidence rejects a re-attested row payload", () => {
  const candidate = structuredClone(fixture);
  const frozenExportEvidence = structuredClone(
    candidate.evidence.find((row) => row.id === "evidence-ledger-export"),
  );
  candidate.ledgerRows.find((row) => row.id === "ledger-row-deposit").effectiveDate =
    "2026-08-06";
  recomputeArtifactDigests(candidate);
  candidate.evidence = candidate.evidence.map((row) =>
    row.id === frozenExportEvidence.id ? frozenExportEvidence : row,
  );

  assertSchemaValid(candidate, "re-attested row payload with frozen export evidence");
  assert.ok(
    findings(candidate).some(
      (item) =>
        item.code === "invalid_evidence_digest" &&
        item.targetRefs.includes("evidence-ledger-export"),
    ),
    JSON.stringify(findings(candidate)),
  );
});

test("frozen export evidence rejects a re-attested row evidence reference", () => {
  const candidate = structuredClone(fixture);
  const frozenExportEvidence = structuredClone(
    candidate.evidence.find((row) => row.id === "evidence-ledger-export"),
  );
  const row = candidate.ledgerRows.find((item) => item.id === "ledger-row-deposit");
  const rowEvidence = candidate.evidence.find(
    (item) => item.id === row.evidenceRef,
  );
  rowEvidence.id = "evidence-ledger-row-deposit-reissued";
  row.evidenceRef = rowEvidence.id;
  recomputeArtifactDigests(candidate);
  candidate.evidence = candidate.evidence.map((item) =>
    item.id === frozenExportEvidence.id ? frozenExportEvidence : item,
  );

  assertSchemaValid(candidate, "re-attested row evidence with frozen export evidence");
  assert.ok(
    findings(candidate).some(
      (item) =>
        item.code === "invalid_evidence_digest" &&
        item.targetRefs.includes("evidence-ledger-export"),
    ),
    JSON.stringify(findings(candidate)),
  );
});

test("frozen export evidence rejects a re-attested row supplier", () => {
  const candidate = structuredClone(fixture);
  const frozenExportEvidence = structuredClone(
    candidate.evidence.find((row) => row.id === "evidence-ledger-export"),
  );
  candidate.principals
    .find((row) => row.id === "principal-statement-export-system")
    .scopes.push("ledger-export-supplier");
  candidate.evidence.find(
    (row) => row.id === "evidence-ledger-row-deposit",
  ).suppliedByRef = "principal-statement-export-system";
  recomputeArtifactDigests(candidate);
  candidate.evidence = candidate.evidence.map((row) =>
    row.id === frozenExportEvidence.id ? frozenExportEvidence : row,
  );

  assertSchemaValid(candidate, "re-attested row supplier with frozen export evidence");
  assert.ok(
    findings(candidate).some(
      (item) =>
        item.code === "invalid_evidence_digest" &&
        item.targetRefs.includes("evidence-ledger-export"),
    ),
    JSON.stringify(findings(candidate)),
  );
});

test("frozen handoff evidence rejects every re-attested partition dependency", () => {
  const attacks = [
    {
      label: "complete coverage object",
      change(value) {
        value.coverage.id = "coverage-operating-2026-08-reissued";
      },
    },
    {
      label: "match group payload",
      change(value) {
        const group = value.matchGroups[0];
        const priorId = group.id;
        group.id = "group-deposit-split-reissued";
        value.coverage.groupRefs = value.coverage.groupRefs.map((ref) =>
          ref === priorId ? group.id : ref,
        );
        value.handoff.indexes.groupRefs = value.handoff.indexes.groupRefs.map((ref) =>
          ref === priorId ? group.id : ref,
        );
        const decisionEvidence = value.evidence.find(
          (row) => row.id === group.decision.evidenceRef,
        );
        decisionEvidence.subjectRefs = decisionEvidence.subjectRefs.map((ref) =>
          ref === priorId ? group.id : ref,
        );
      },
    },
    {
      label: "decision payload",
      change(value) {
        value.matchGroups[0].decision.decidedAt = "2026-09-01T02:01:00Z";
        value.evidence.find(
          (row) => row.id === value.matchGroups[0].decision.evidenceRef,
        ).observedAt = "2026-09-01T02:01:00Z";
      },
    },
    {
      label: "decision evidence reference",
      change(value) {
        const decision = value.matchGroups[0].decision;
        const evidenceRow = value.evidence.find(
          (row) => row.id === decision.evidenceRef,
        );
        evidenceRow.id = "evidence-decision-deposit-reissued";
        decision.evidenceRef = evidenceRow.id;
      },
    },
    {
      label: "residual supplier",
      change(value) {
        const residual = value.residuals[0];
        residual.recordedByRef = "principal-ruth-abara";
        value.evidence.find(
          (row) => row.id === residual.evidenceRef,
        ).suppliedByRef = residual.recordedByRef;
      },
    },
    {
      label: "blocker payload and evidence",
      prepare(value) {
        value.ledgerRows.find(
          (row) => row.id === "ledger-row-deposit",
        ).minorUnits = "10001";
        addBlocker(value, "arithmetic-invalid");
        value.handoff.state = "blocked";
      },
      change(value) {
        value.blockers[0].raisedAt = "2026-09-01T02:51:00Z";
        value.evidence.find(
          (row) => row.id === value.blockers[0].evidenceRefs[0],
        ).observedAt = value.blockers[0].raisedAt;
      },
    },
    {
      label: "consumed authority grant",
      change(value) {
        const grant = value.authorityGrants.find(
          (row) => row.id === value.handoff.authorityGrantRef,
        );
        grant.issuedAt = "2026-09-01T00:31:30Z";
        value.evidence.find(
          (row) => row.id === grant.evidenceRef,
        ).observedAt = grant.issuedAt;
      },
    },
  ];

  for (const attack of attacks) {
    const candidate = structuredClone(fixture);
    if (attack.prepare) {
      attack.prepare(candidate);
      recomputeArtifactDigests(candidate);
    }
    const frozenHandoffEvidence = structuredClone(
      candidate.evidence.find((row) => row.id === "evidence-handoff"),
    );
    attack.change(candidate);
    recomputeArtifactDigests(candidate);
    candidate.evidence = candidate.evidence.map((row) =>
      row.id === frozenHandoffEvidence.id ? frozenHandoffEvidence : row,
    );

    assertSchemaValid(candidate, `${attack.label} with frozen handoff evidence`);
    assert.ok(
      findings(candidate).some(
        (item) =>
          item.code === "invalid_evidence_digest" &&
          item.targetRefs.includes("evidence-handoff"),
      ),
      `${attack.label}: ${JSON.stringify(findings(candidate))}`,
    );
  }
});

test("recursive global id uniqueness includes nested decision ids", () => {
  assertFinding(
    resign((value) => {
      value.matchGroups[0].decision.id = value.matchGroups[0].id;
      value.evidence.find(
        (row) => row.id === "evidence-decision-deposit",
      ).subjectRefs = ["group-deposit-split"];
    }),
    "duplicate_id",
    "nested duplicate id",
  );
});

test("duplicate ids block ready state and require the exact identity blocker target", () => {
  const duplicateId = fixture.handoff.id;
  const readyCandidate = resign((value) => {
    value.coverage.id = duplicateId;
  });
  assertSchemaValid(readyCandidate, "ready artifact with duplicate id");
  const readyFindings = findings(readyCandidate);
  assert.deepEqual(
    readyFindings.find((item) => item.code === "duplicate_id")?.targetRefs,
    [duplicateId],
    JSON.stringify(readyFindings),
  );
  assert.ok(
    readyFindings.some((item) => item.code === "invalid_blocker"),
    JSON.stringify(readyFindings),
  );
  assert.ok(
    readyFindings.some(
      (item) => item.code === "invalid_handoff" && item.path === "handoff.state",
    ),
    JSON.stringify(readyFindings),
  );

  const blockedCandidate = resign((value) => {
    value.coverage.id = duplicateId;
    addBlocker(value, "identity-invalid", [duplicateId], "duplicate-id");
    value.handoff.state = "blocked";
  });
  assertSchemaValid(blockedCandidate, "blocked artifact with duplicate id");
  const blockedFindings = findings(blockedCandidate);
  assert.deepEqual(blockedCandidate.blockers[0].targetRefs, [duplicateId]);
  assert.ok(
    blockedFindings.some((item) => item.code === "duplicate_id"),
    JSON.stringify(blockedFindings),
  );
  assert.ok(
    !blockedFindings.some((item) => item.code === "invalid_blocker"),
    JSON.stringify(blockedFindings),
  );
  assert.ok(
    !blockedFindings.some((item) => item.code === "invalid_handoff"),
    JSON.stringify(blockedFindings),
  );
});

test("omitted, reused, invented, and cross-side rows fail closed", () => {
  assertFinding(
    resign(omitLedgerResidual),
    "incomplete_coverage",
    "omitted ledger row",
  );
  assertFinding(
    resign((value) => {
      value.matchGroups
        .find((row) => row.id === "group-batch-combined")
        .ledgerRowRefs.push("ledger-row-residual");
    }),
    "row_reused",
    "reused ledger row",
  );
  assertFinding(
    resign((value) => {
      value.matchGroups[0].ledgerRowRefs[0] = "ledger-row-invented";
    }),
    "invalid_row_reference",
    "invented ledger row",
  );
  assertFinding(
    resign((value) => {
      value.matchGroups[0].ledgerRowRefs[0] = "statement-row-residual";
    }),
    "invalid_row_reference",
    "cross-side row",
  );
});

test("stale exports and decisions are rejected after all digests are refreshed", () => {
  assertFinding(
    resign((value) => {
      value.ledgerExport.exportedAt = "2026-08-31T23:00:00Z";
      for (const evidenceRow of value.evidence.filter(
        (row) =>
          row.kind === "ledger-export-record" ||
          row.kind === "ledger-row-record",
      )) {
        evidenceRow.observedAt = "2026-08-31T23:00:00Z";
      }
    }),
    "stale_export",
    "stale ledger export",
  );
  assertFinding(
    resign((value) => {
      const group = value.matchGroups[0];
      group.decision.decidedAt = "2026-09-01T00:30:00Z";
      value.evidence.find(
        (row) => row.id === group.decision.evidenceRef,
      ).observedAt = "2026-09-01T00:30:00Z";
    }),
    "stale_decision",
    "decision before cutoff and review window",
  );
});

test("the opaque prior-round reference cannot equal the current round id", () => {
  assertFinding(
    mutate((value) => {
      value.round.priorRoundRef = value.round.id;
    }),
    "invalid_prior_round_ref",
    "prior round equals current round",
    false,
  );
});

test("current prior-round refs block ready state and require the exact round blocker target", () => {
  const roundId = fixture.round.id;
  const readyCandidate = resign((value) => {
    value.round.priorRoundRef = roundId;
  });
  assert.equal(validateSchema(readyCandidate), false);
  const readyFindings = findings(readyCandidate);
  assert.deepEqual(
    readyFindings.find((item) => item.code === "invalid_prior_round_ref")?.targetRefs,
    [roundId],
    JSON.stringify(readyFindings),
  );
  assert.ok(
    readyFindings.some((item) => item.code === "invalid_blocker"),
    JSON.stringify(readyFindings),
  );
  assert.ok(
    readyFindings.some(
      (item) => item.code === "invalid_handoff" && item.path === "handoff.state",
    ),
    JSON.stringify(readyFindings),
  );

  const blockedCandidate = resign((value) => {
    value.round.priorRoundRef = roundId;
    addBlocker(value, "round-invalid", [roundId], "prior-round");
    value.handoff.state = "blocked";
  });
  assert.equal(validateSchema(blockedCandidate), false);
  const blockedFindings = findings(blockedCandidate);
  assert.deepEqual(blockedCandidate.blockers[0].targetRefs, [roundId]);
  assert.ok(
    blockedFindings.some((item) => item.code === "invalid_prior_round_ref"),
    JSON.stringify(blockedFindings),
  );
  assert.ok(
    !blockedFindings.some((item) => item.code === "invalid_blocker"),
    JSON.stringify(blockedFindings),
  );
  assert.ok(
    !blockedFindings.some((item) => item.code === "invalid_handoff"),
    JSON.stringify(blockedFindings),
  );
});

test("prior-round references cannot alias any current artifact id", () => {
  const currentIds = [
    fixture.ledgerExport.id,
    fixture.ledgerRows[0].id,
    fixture.matchGroups[0].id,
    fixture.matchGroups[0].decision.id,
    fixture.residuals[0].id,
    fixture.evidence[0].id,
    fixture.coverage.id,
    fixture.round.destination.id,
    fixture.handoff.id,
  ];
  for (const currentId of currentIds) {
    const candidate = resign((value) => {
      value.round.priorRoundRef = currentId;
    });
    assert.equal(validateSchema(candidate), false, currentId);
    const candidateFindings = findings(candidate);
    assert.ok(
      candidateFindings.some(
        (item) =>
          item.code === "invalid_prior_round_ref" &&
          item.targetRefs.includes(currentId),
      ),
      `${currentId}: ${JSON.stringify(candidateFindings)}`,
    );
    assert.ok(
      candidateFindings.some(
        (item) => item.code === "invalid_handoff" && item.path === "handoff.state",
      ),
      `${currentId}: ${JSON.stringify(candidateFindings)}`,
    );
  }
});

test("grant scope, issuer authority, and self-issuance fail closed", () => {
  assertFinding(
    resign((value) => {
      value.authorityGrants[0].accountId = "operating-999";
    }),
    "invalid_grant",
    "grant for another account",
  );
  assertFinding(
    resign((value) => {
      value.authorityGrants[0].issuedByRef = "principal-ruth-abara";
      value.evidence.find(
        (row) => row.id === "evidence-grant-mara",
      ).suppliedByRef = "principal-ruth-abara";
    }),
    "invalid_grant",
    "issuer lacks authority scope",
  );
  assertFinding(
    resign((value) => {
      value.authorityGrants[0].issuedByRef = "principal-mara-quinn";
      value.evidence.find(
        (row) => row.id === "evidence-grant-mara",
      ).suppliedByRef = "principal-mara-quinn";
    }),
    "invalid_grant",
    "self-issued grant",
  );
});

test("transitive authority bindings reject principal, roster, grant, and causal-order replay", () => {
  const principalReplay = mutate((value) => {
    value.principals.find((row) => row.id === "principal-iris-tanaka").name =
      "Iris Tanaka Replaced";
  });
  assert.ok(
    findings(principalReplay).some(
      (item) =>
        item.code === "invalid_grant" &&
        item.targetRefs.includes("grant-mara-operating-review"),
    ),
    JSON.stringify(findings(principalReplay)),
  );

  const grantReplay = mutate((value) => {
    value.authorityGrants.find(
      (row) => row.id === "grant-mara-operating-review",
    ).activeFrom = "2026-09-01T00:59:00Z";
  });
  assert.ok(
    findings(grantReplay).some(
      (item) =>
        item.code === "invalid_grant" &&
        item.targetRefs.includes("decision-deposit-split"),
    ),
    JSON.stringify(findings(grantReplay)),
  );

  assertFinding(
    resign((value) => {
      const grant = value.authorityGrants[0];
      grant.issuedAt = value.authorityRoster.issuedAt;
      value.evidence.find((row) => row.id === grant.evidenceRef).observedAt =
        grant.issuedAt;
    }),
    "invalid_grant",
    "grant issued without strict causal separation from roster",
  );
});

test("match decisions require a named-human reconciler", () => {
  assertFinding(
    resign((value) => {
      value.principals.find(
        (row) => row.id === "principal-mara-quinn",
      ).kind = "team";
    }),
    "invalid_reconciler",
    "team reconciler",
  );
});

test("the fixture accepts exact 1:1, 1:n, and n:1 cardinalities", () => {
  assert.deepEqual(
    new Set(fixture.matchGroups.map((row) => row.cardinality)),
    new Set(["1:1", "1:n", "n:1"]),
  );
  assert.deepEqual(findings(fixture), []);
});

test("many-to-many grouping is rejected even when the declared enum remains 1:n", () => {
  const candidate = resign((value) => {
    value.matchGroups[0].ledgerRowRefs.push("ledger-row-residual");
  });
  assert.equal(validateSchema(candidate), false, "many-to-many must be structurally impossible");
  assert.ok(
    codes(candidate).has("invalid_group_cardinality"),
    JSON.stringify(findings(candidate)),
  );
});

test("exact BigInt arithmetic rejects a re-signed one-minor-unit imbalance", () => {
  const candidate = resign((value) => {
    value.ledgerRows.find(
      (row) => row.id === "ledger-row-deposit",
    ).minorUnits = "10001";
  });
  assertSchemaValid(candidate, "re-signed unbalanced artifact");
  assert.ok(codes(candidate).has("unbalanced_match"), JSON.stringify(findings(candidate)));
  assert.ok(!codes(candidate).has("invalid_row_digest"), JSON.stringify(findings(candidate)));
  assert.ok(!codes(candidate).has("invalid_export_digest"), JSON.stringify(findings(candidate)));
});

test("cross-currency and cross-account bindings are rejected", () => {
  assertFinding(
    resign((value) => {
      value.statementRows[0].currency = "EUR";
    }),
    "invalid_row_binding",
    "cross-currency row",
  );
  assertFinding(
    resign((value) => {
      value.matchGroups[0].accountId = "operating-999";
    }),
    "invalid_scope_binding",
    "cross-account group",
  );
});

test("residual suppression cannot create a complete-looking partition", () => {
  const candidate = resign(omitLedgerResidual);
  assertSchemaValid(candidate, "suppressed residual");
  assert.ok(codes(candidate).has("incomplete_coverage"), JSON.stringify(findings(candidate)));
  assert.ok(
    findings(candidate).some(
      (item) => item.code === "incomplete_coverage" && item.path === "ledger-row-residual",
    ),
    JSON.stringify(findings(candidate)),
  );
});

test("every residual is invalidated when either source manifest changes", () => {
  for (const [label, rows, rowId] of [
    ["ledger", "ledgerRows", "ledger-row-fee"],
    ["statement", "statementRows", "statement-row-fee"],
  ]) {
    const candidate = structuredClone(fixture);
    const staleResiduals = structuredClone(candidate.residuals);
    const staleEvidence = new Map(
      candidate.evidence
        .filter((row) => row.kind === "residual-record")
        .map((row) => [row.id, structuredClone(row)]),
    );
    candidate[rows].find((row) => row.id === rowId).sourceNativeId += "-reexported";
    recomputeArtifactDigests(candidate);
    candidate.residuals = staleResiduals;
    candidate.evidence = candidate.evidence.map(
      (row) => staleEvidence.get(row.id) ?? row,
    );

    assertSchemaValid(candidate, `${label} manifest residual replay`);
    const replayFindings = findings(candidate);
    assert.equal(
      replayFindings.filter((item) => item.code === "invalid_residual").length,
      fixture.residuals.length,
      `${label}: ${JSON.stringify(replayFindings)}`,
    );
  }
});

test("a prior-period decision replay is not current-round evidence", () => {
  assertFinding(
    resign((value) => {
      value.matchGroups[0].decision.roundRef = "round-operating-2026-07";
    }),
    "stale_decision",
    "prior-period decision replay",
  );
});

test("decision time must be strictly greater than every export and evidence prerequisite", () => {
  const candidate = resign((value) => {
    value.statementExport.exportedAt = value.round.reviewWindow.opensAt;
    for (const evidenceRow of value.evidence.filter(
      (row) =>
        row.kind === "statement-export-record" ||
        row.kind === "statement-row-record",
    )) {
      evidenceRow.observedAt = value.round.reviewWindow.opensAt;
    }
    value.matchGroups[0].decision.decidedAt = value.round.reviewWindow.opensAt;
    value.evidence.find(
      (row) => row.id === value.matchGroups[0].decision.evidenceRef,
    ).observedAt = value.round.reviewWindow.opensAt;
  });
  assertFinding(candidate, "stale_decision", "decision equal to prerequisite time");
});

test("trusted asOf rejects every future-dated record surface", () => {
  const future = "2026-09-03T00:00:00Z";
  const cases = [
    [
      "export",
      (value) => {
        value.ledgerExport.exportedAt = future;
        for (const row of value.evidence.filter(
          (item) =>
            item.kind === "ledger-export-record" ||
            item.kind === "ledger-row-record",
        )) {
          row.observedAt = future;
        }
      },
    ],
    [
      "evidence",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-decision-deposit").observedAt =
          future;
      },
    ],
    [
      "grant",
      (value) => {
        const grant = value.authorityGrants[0];
        grant.issuedAt = future;
        value.evidence.find((row) => row.id === grant.evidenceRef).observedAt = future;
      },
    ],
    [
      "decision",
      (value) => {
        value.matchGroups[0].decision.decidedAt = future;
        value.evidence.find(
          (row) => row.id === value.matchGroups[0].decision.evidenceRef,
        ).observedAt = future;
      },
    ],
    [
      "residual",
      (value) => {
        value.residuals[0].recordedAt = future;
        value.evidence.find(
          (row) => row.id === value.residuals[0].evidenceRef,
        ).observedAt = future;
      },
    ],
    [
      "blocker",
      (value) => {
        value.ledgerRows.find((row) => row.id === "ledger-row-deposit").minorUnits =
          "10001";
        addBlocker(value, "arithmetic-invalid");
        value.blockers[0].raisedAt = future;
        value.evidence.find(
          (row) => row.id === value.blockers[0].evidenceRefs[0],
        ).observedAt = future;
        value.handoff.state = "blocked";
      },
    ],
    [
      "destination approval",
      (value) => {
        value.round.destination.approvedAt = future;
        value.evidence.find(
          (row) => row.id === value.round.destination.evidenceRef,
        ).observedAt = future;
      },
    ],
    [
      "handoff",
      (value) => {
        value.handoff.handedOffAt = future;
        value.evidence.find((row) => row.id === value.handoff.evidenceRef).observedAt =
          future;
      },
    ],
  ];
  for (const [label, change] of cases) {
    const candidate = resign(change);
    assertFinding(candidate, "future_record", `${label} after trusted asOf`);
  }
});

test("handoff counts, indexes, and exact destination are derived rather than trusted", () => {
  assertFinding(
    mutate((value) => {
      value.handoff.counts.groups += 1;
    }),
    "invalid_handoff",
    "handoff count mismatch",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.indexes.groupRefs.pop();
    }),
    "invalid_handoff",
    "handoff index mismatch",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.destinationRef =
        "controlled://finance-reconciliation/operating-001/another-period";
    }),
    "invalid_destination",
    "handoff destination mismatch",
  );
});

test("destination approval and handoff reject stale evidence and wrong-account authority", () => {
  const staleApprovalBinding = structuredClone(fixture);
  const staleHandoffEvidence = structuredClone(
    staleApprovalBinding.evidence.find((row) => row.id === "evidence-handoff"),
  );
  const staleApprovalDigest =
    staleApprovalBinding.handoff.destinationApprovalEvidenceDigest;
  const staleApprovalControlledRef =
    staleApprovalBinding.handoff.destinationApprovalEvidenceControlledRef;
  staleApprovalBinding.round.destination.approvedAt = "2026-09-01T02:41:00Z";
  staleApprovalBinding.evidence.find(
    (row) => row.id === "evidence-destination-approval",
  ).observedAt = "2026-09-01T02:41:00Z";
  recomputeArtifactDigests(staleApprovalBinding);
  staleApprovalBinding.handoff.destinationApprovalEvidenceDigest =
    staleApprovalDigest;
  staleApprovalBinding.handoff.destinationApprovalEvidenceControlledRef =
    staleApprovalControlledRef;
  staleApprovalBinding.evidence = staleApprovalBinding.evidence.map((row) =>
    row.id === staleHandoffEvidence.id ? staleHandoffEvidence : row,
  );
  assertFinding(
    staleApprovalBinding,
    "invalid_handoff",
    "handoff replay against changed destination approval",
  );

  const wrongAccountGrant = resign((value) => {
    value.authorityGrants.find(
      (row) => row.id === "grant-ruth-owner-handoff",
    ).accountId = "operating-999";
  });
  assertFinding(
    wrongAccountGrant,
    "invalid_handoff",
    "wrong-account handoff authority",
  );
});

test("residuals remain valid in ready-for-owner-review", () => {
  assert.equal(fixture.handoff.state, "ready-for-owner-review");
  assert.equal(fixture.residuals.length, 2);
  assert.deepEqual(findings(fixture), []);
});

test("any declared blocker invalidates ready state and false blockers are rejected", () => {
  const candidate = resign((value) => {
    addBlocker(value, "evidence-invalid");
  });
  assertSchemaValid(candidate, "ready artifact with blocker");
  assert.ok(codes(candidate).has("invalid_blocker"), JSON.stringify(findings(candidate)));
  assert.ok(codes(candidate).has("invalid_handoff"), JSON.stringify(findings(candidate)));
});

test("a truthful blocker mirrors a present defect and requires blocked handoff", () => {
  const candidate = resign((value) => {
    value.ledgerRows.find(
      (row) => row.id === "ledger-row-deposit",
    ).minorUnits = "10001";
    addBlocker(value, "arithmetic-invalid");
    value.handoff.state = "blocked";
  });
  assertSchemaValid(candidate, "truthfully blocked artifact");
  assert.ok(codes(candidate).has("unbalanced_match"), JSON.stringify(findings(candidate)));
  assert.ok(!codes(candidate).has("invalid_blocker"), JSON.stringify(findings(candidate)));
  assert.ok(!codes(candidate).has("invalid_handoff"), JSON.stringify(findings(candidate)));
});

test("blocked handoff requires the exact derived blocker categories and target ids", () => {
  const omitted = resign((value) => {
    value.ledgerRows.find(
      (row) => row.id === "ledger-row-deposit",
    ).minorUnits = "10001";
    value.handoff.state = "blocked";
  });
  assert.ok(codes(omitted).has("invalid_blocker"), JSON.stringify(findings(omitted)));
  assert.ok(codes(omitted).has("invalid_handoff"), JSON.stringify(findings(omitted)));

  const unrelated = resign((value) => {
    value.ledgerRows.find(
      (row) => row.id === "ledger-row-deposit",
    ).minorUnits = "10001";
    addBlocker(value, "arithmetic-invalid", ["ledger-row-deposit"]);
    value.handoff.state = "blocked";
  });
  assert.ok(codes(unrelated).has("invalid_blocker"), JSON.stringify(findings(unrelated)));
  assert.ok(codes(unrelated).has("invalid_handoff"), JSON.stringify(findings(unrelated)));

  const duplicate = resign((value) => {
    value.ledgerRows.find(
      (row) => row.id === "ledger-row-deposit",
    ).minorUnits = "10001";
    addBlocker(value, "arithmetic-invalid", ["group-deposit-split"], "first");
    addBlocker(value, "arithmetic-invalid", ["group-deposit-split"], "second");
    value.handoff.state = "blocked";
  });
  assert.ok(codes(duplicate).has("invalid_blocker"), JSON.stringify(findings(duplicate)));
  assert.ok(codes(duplicate).has("invalid_handoff"), JSON.stringify(findings(duplicate)));
});

test("prohibited action, closure, compliance, fuzzy, tolerance, FX, and claim lanes are rejected without schema validation", () => {
  for (const [label, change] of [
    [
      "action",
      (value) => {
        value.handoff.action = "post-entry";
      },
    ],
    [
      "closure",
      (value) => {
        value.handoff.closure = "books-closed";
      },
    ],
    [
      "compliance",
      (value) => {
        value.handoff.complianceClaim = "achieved";
      },
    ],
    [
      "fuzzy tolerance",
      (value) => {
        value.matchGroups[0].fuzzyTolerance = 10;
      },
    ],
    [
      "fx",
      (value) => {
        value.matchGroups[0].exchangeRate = "1.1";
      },
    ],
    [
      "narrative claim",
      (value) => {
        value.handoff.note = "The account is reconciled and the books are closed.";
      },
    ],
  ]) {
    const candidate = mutate(change);
    assert.equal(validateSchema(candidate), false, `${label} unexpectedly passed schema`);
    const resultCodes = codes(candidate);
    assert.ok(
      resultCodes.has("prohibited_financial_field") ||
        resultCodes.has("prohibited_financial_claim"),
      `${label}: ${JSON.stringify(findings(candidate))}`,
    );
  }
});

test("hyphen, slash, and passive-voice claim smuggling has no semantic text lane", () => {
  for (const purpose of [
    "books-closed",
    "books/closed",
    "books-were-closed-by-owner",
  ]) {
    const candidate = mutate((value) => {
      value.evidence[0].controlledPurpose = purpose;
    });
    assert.equal(validateSchema(candidate), false, purpose);
    assert.ok(
      codes(candidate).has("invalid_evidence_binding"),
      `${purpose}: ${JSON.stringify(findings(candidate))}`,
    );
  }

  for (const key of ["books-closed", "books/closed", "booksWereClosedByOwner"]) {
    const candidate = mutate((value) => {
      value.handoff[key] = true;
    });
    assert.equal(validateSchema(candidate), false, key);
    assert.ok(
      codes(candidate).has("prohibited_financial_field"),
      `${key}: ${JSON.stringify(findings(candidate))}`,
    );
  }

  const identityLabel = resign((value) => {
    value.principals.find(
      (row) => row.id === "principal-ledger-export-system",
    ).name = "Books Were Closed";
  });
  assertSchemaValid(identityLabel, "identity label");
  assert.deepEqual(findings(identityLabel), []);
});

test("schema has no unknown-field escape hatch at any modeled record layer", () => {
  for (const candidate of [
    mutate((value) => {
      value.unexpected = true;
    }),
    mutate((value) => {
      value.round.unexpected = true;
    }),
    mutate((value) => {
      value.matchGroups[0].decision.unexpected = true;
    }),
    mutate((value) => {
      value.handoff.counts.unexpected = 0;
    }),
  ]) {
    assert.equal(validateSchema(candidate), false);
  }
});

test("evidence payload helpers recompute every fixture record kind", () => {
  const candidate = structuredClone(fixture);
  recomputeArtifactDigests(candidate);
  assert.deepEqual(candidate, fixture);
  for (const evidenceRow of fixture.evidence) {
    assert.match(evidenceRow.payloadDigest, /^sha256:[a-f0-9]{64}$/u);
  }
});
