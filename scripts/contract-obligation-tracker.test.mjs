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
  computeRegisterDigest,
  computeRoundDigest,
  contractObligationTrackerFindings,
  resealContractObligationTracker,
} from "./contract-obligation-tracker.mjs";

const AS_OF = "2026-09-05T17:00:00Z";
const LATER_AS_OF = "2026-10-05T17:00:00Z";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/contract-obligation-tracker/fixtures/contract-obligation-tracker.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/contract-obligation-tracker/schemas/contract-obligation-tracker.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/contract-obligation-tracker/templates/contract-obligation-tracker.md",
    import.meta.url,
  ),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function mutate(change, resealOptions = null) {
  const candidate = clone();
  change(candidate);
  return resealOptions
    ? resealContractObligationTracker(
        candidate,
        resealOptions === true ? {} : resealOptions,
      )
    : candidate;
}

function findings(candidate, context = { asOf: AS_OF }) {
  return contractObligationTrackerFindings(candidate, context);
}

function codes(candidate, context = { asOf: AS_OF }) {
  return new Set(findings(candidate, context).map((row) => row.code));
}

function assertSchemaValid(candidate, label) {
  assert.equal(
    validateSchema(candidate),
    true,
    `${label}: ${ajv.errorsText(validateSchema.errors)}`,
  );
}

test("accepted fixture is schema-valid, content-bound, and semantically clean", () => {
  assertSchemaValid(fixture, "fixture");
  assert.deepEqual(findings(fixture), []);
  assert.equal(
    fixture.register.contentDigest,
    computeRegisterDigest(fixture.register, fixture.obligations, fixture.agreements),
  );
  assert.equal(
    fixture.authorityRoster.contentDigest,
    computeAuthorityRosterDigest(fixture.principals),
  );
  assert.equal(fixture.round.roundDigest, computeRoundDigest(fixture.round, fixture));
  assert.equal(fixture.coverage.contentDigest, computeCoverageDigest(fixture.coverage, fixture));
  assert.equal(
    fixture.destinationApproval.payloadDigest,
    computeDestinationApprovalDigest(fixture.destinationApproval),
  );
  assert.equal(fixture.handoff.payloadDigest, computeHandoffDigest(fixture.handoff));
  for (const grant of fixture.authorityGrants) {
    assert.equal(grant.payloadDigest, computeAuthorityGrantDigest(grant));
  }
  for (const row of fixture.evidence) {
    assert.equal(row.payloadDigest, computeEvidencePayloadDigest(row.kind, fixture, row.id));
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
  }
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "contract-obligation-tracker",
      "claws/contract-obligation-tracker/fixtures/contract-obligation-tracker.example.json",
      "--as-of",
      AS_OF,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("handoff template renders the complete reviewable contract", () => {
  for (const required of [
    "## Round and trust roots",
    "{{schemaVersion}}",
    "{{artifactId}}",
    "{{round.registerDigest}}",
    "{{round.authorityRosterDigest}}",
    "{{round.closesAt}}",
    "sourceRecordDigest authenticity",
    "register completeness and reseal authorization",
    "caller-supplied `asOf`",
    "owner-supplied clause and obligation semantics",
    "## Executed agreements",
    "{{agreements[].agreementId}}",
    "{{agreements[].repositoryRef}}",
    "{{agreements[].sourceEvidenceRef}}",
    "## Owner-confirmed obligation register",
    "{{register.confirmedByRef}}",
    "{{register.agreementVersionRefs}}",
    "{{register.obligationRefs}}",
    "{{register.contentDigest}}",
    "## Obligation ledger",
    "{{obligations[].agreementVersionRef}}",
    "{{obligations[].clauseLocator}}",
    "{{obligations[].clauseDigest}}",
    "{{obligations[].obligationDigest}}",
    "{{obligations[].performanceEvidenceSupplierRef}}",
    "{{obligations[].requiredEvidenceRefs}}",
    "## Principals, roster, and grants",
    "{{principals[].name}}",
    "{{authorityRoster.contentDigest}}",
    "{{authorityGrants[].obligationRef}}",
    "{{authorityGrants[].payloadDigest}}",
    "## Evidence ledger",
    "{{evidence[].sourceRecordDigest}}",
    "{{evidence[].payloadDigest}}",
    "{{evidence[].recordDigest}}",
    "## Current observations",
    "{{observations[].dueState}}",
    "{{observations[].reliedEvidenceRefs}}",
    "{{observations[].completion.confirmedByRef}}",
    "{{observations[].completion.authorityGrantRef}}",
    "## Exact blockers",
    "{{blockers[].exactMissingEvidenceRefs}}",
    "## Exact coverage",
    "{{coverage.entries[].resolutionKind}}",
    "{{coverage.contentDigest}}",
    "## Approved destination",
    "{{destinationApproval.destination}}",
    "{{destinationApproval.payloadDigest}}",
    "## Owner handoff and structural not-claims",
    "{{handoff.observationRefs}}",
    "{{handoff.blockerRefs}}",
    "{{handoff.legalConclusionClaim}}",
    "{{handoff.performanceAcceptanceClaim}}",
    "{{handoff.complianceClaim}}",
    "{{handoff.auditClaim}}",
    "{{handoff.noticeSentClaim}}",
    "{{handoff.paymentMadeClaim}}",
    "{{handoff.amendmentClaim}}",
    "{{handoff.renewalClaim}}",
    "{{handoff.terminationClaim}}",
    "{{handoff.systemMutationClaim}}",
    "{{handoff.payloadDigest}}",
  ]) {
    assert.match(template, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("accepted fixture exercises all four bounded obligation outcomes", () => {
  assert.deepEqual(
    fixture.observations.map((row) => row.state).sort(),
    ["not-yet-due", "owner-confirmation-pending", "owner-confirmed-complete"],
  );
  assert.equal(fixture.blockers.length, 1);
  assert.equal(fixture.blockers[0].category, "source-evidence-missing");
  assert.equal(fixture.handoff.state, "blocked");
});

test("not-yet-due permits missing required evidence but relies on none in V1", () => {
  const obligation = fixture.obligations.find((row) => row.id === "obligation-future");
  const observation = fixture.observations.find((row) => row.obligationRef === obligation.id);
  assert.ok(Date.parse(obligation.dueAt) > Date.parse(fixture.round.closesAt));
  assert.equal(
    fixture.evidence.some((row) => obligation.requiredEvidenceRefs.includes(row.id)),
    false,
  );
  assert.deepEqual(observation.reliedEvidenceRefs, []);
  assert.equal(
    fixture.blockers.some((row) => row.obligationRef === obligation.id),
    false,
  );
});

test("not-yet-due rejects relied evidence and blockers", () => {
  const relied = mutate((value) => {
    value.observations.find((row) => row.id === "observation-future").reliedEvidenceRefs = [
      "evidence-performance-complete",
    ];
  }, true);
  assert.equal(validateSchema(relied), false);
  assert.ok(codes(relied).has("invalid_due_state"));

  const blocked = mutate((value) => {
    value.obligations.find((row) => row.id === "obligation-blocked").dueAt =
      "2026-10-02T12:00:00Z";
  }, { resealRegister: true });
  assertSchemaValid(blocked, "not-yet-due blocker candidate");
  assert.ok(codes(blocked).has("invalid_obligation_resolution"));
});

test("due states require complete bound evidence or the exact missing-evidence blocker", () => {
  const pending = fixture.observations.find(
    (row) => row.state === "owner-confirmation-pending",
  );
  const pendingObligation = fixture.obligations.find(
    (row) => row.id === pending.obligationRef,
  );
  assert.deepEqual(pending.reliedEvidenceRefs, pendingObligation.requiredEvidenceRefs);
  assert.equal(pending.completion, null);

  const blocked = fixture.blockers[0];
  const blockedObligation = fixture.obligations.find(
    (row) => row.id === blocked.obligationRef,
  );
  assert.deepEqual(blocked.exactMissingEvidenceRefs, blockedObligation.requiredEvidenceRefs);
  assert.equal(
    fixture.observations.some((row) => row.obligationRef === blocked.obligationRef),
    false,
  );

  const missingEvidenceWithObservation = mutate((value) => {
    value.evidence = value.evidence.filter(
      (row) => row.id !== "evidence-performance-owner-confirmation-pending",
    );
  }, true);
  assertSchemaValid(missingEvidenceWithObservation, "due observation missing evidence");
  assert.ok(codes(missingEvidenceWithObservation).has("invalid_blocker_equality"));
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const candidate of [
    null,
    undefined,
    true,
    7,
    "artifact",
    [],
    {},
    {
      agreements: {},
      obligations: [null, 1],
      principals: "bad",
      authorityGrants: null,
      observations: false,
      blockers: {},
      evidence: [null],
      coverage: { entries: "bad" },
    },
    {
      agreements: [{}],
      obligations: [{ requiredEvidenceRefs: [] }],
      principals: [{}],
      authorityGrants: [{}],
      observations: [{ reliedEvidenceRefs: [] }],
      blockers: [{}],
      evidence: [{}],
      round: { agreementVersionRefs: [] },
      register: { agreementVersionRefs: [], obligationRefs: [] },
      authorityRoster: { principalRefs: [] },
      coverage: { entries: [] },
    },
  ]) {
    assert.doesNotThrow(() => findings(candidate));
    assert.ok(findings(candidate).length > 0);
  }
});

test("trusted asOf is mandatory and no wall clock is consulted", () => {
  assert.ok(
    new Set(contractObligationTrackerFindings(fixture).map((row) => row.code)).has(
      "invalid_validation_context",
    ),
  );
  assert.ok(codes(fixture, {}).has("invalid_validation_context"));
  assert.ok(codes(fixture, { asOf: "not-a-time" }).has("invalid_validation_context"));
  assert.deepEqual(findings(fixture), []);
});

test("offset-less timestamps fail identically in every process timezone", () => {
  const offsetless = "2026-09-05T17:00:00";
  assert.ok(codes(fixture, { asOf: offsetless }).has("invalid_validation_context"));

  const candidate = mutate((value) => {
    value.observations[1].observedAt = "2026-09-05T09:00:00";
  }, true);
  assert.equal(validateSchema(candidate), false);
  assert.ok(codes(candidate).has("invalid_timestamp"));

  const validatorUrl = new URL(
    "./contract-obligation-tracker.mjs",
    import.meta.url,
  ).href;
  const fixtureUrl = new URL(
    "../sources/contract-obligation-tracker/fixtures/contract-obligation-tracker.example.json",
    import.meta.url,
  ).href;
  const script = `
    import { readFile } from "node:fs/promises";
    import { contractObligationTrackerFindings } from ${JSON.stringify(validatorUrl)};
    const value = JSON.parse(await readFile(new URL(${JSON.stringify(fixtureUrl)}), "utf8"));
    const rows = contractObligationTrackerFindings(value, { asOf: ${JSON.stringify(offsetless)} });
    if (!rows.some((row) => row.code === "invalid_validation_context")) process.exit(1);
  `;
  for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      encoding: "utf8",
      env: { ...process.env, TZ: timezone },
    });
    assert.equal(child.status, 0, `${timezone}: ${child.stderr || child.stdout}`);
  }
});

test("duplicate obligations fail global identity and exact register coverage", () => {
  const candidate = mutate((value) => {
    value.obligations.push(clone(value.obligations[0]));
  }, true);
  assertSchemaValid(candidate, "duplicate obligation candidate");
  assert.ok(codes(candidate).has("duplicate_identity"));
  assert.ok(codes(candidate).has("invalid_register_binding"));
});

test("every obligation requires evidence at schema and semantic levels", () => {
  const candidate = mutate((value) => {
    value.obligations[0].requiredEvidenceRefs = [];
  });
  assert.equal(validateSchema(candidate), false);
  assert.ok(codes(candidate).has("invalid_required_evidence"));
});

test("owner-confirmed completion requires non-empty relied evidence at both levels", () => {
  const candidate = mutate((value) => {
    value.observations[0].reliedEvidenceRefs = [];
  });
  assert.equal(validateSchema(candidate), false);
  assert.ok(codes(candidate).has("invalid_required_evidence"));
});

test("owner-confirmation-pending requires all evidence and forbids completion", () => {
  const candidate = mutate((value) => {
    const observation = value.observations.find(
      (row) => row.state === "owner-confirmation-pending",
    );
    observation.completion = clone(value.observations[0].completion);
  }, true);
  assert.equal(validateSchema(candidate), false);
  assert.ok(codes(candidate).has("invalid_observation_binding"));
});

test("coverage approval cannot be replayed across a newly confirmed completion", () => {
  const candidate = mutate((value) => {
    const observation = value.observations.find(
      (row) => row.state === "owner-confirmation-pending",
    );
    observation.state = "owner-confirmed-complete";
    observation.completion = {
      confirmedByRef: "principal-completion-owner",
      confirmedAt: observation.observedAt,
      authorityGrantRef: "grant-owner-confirmation-pending",
      confirmationEvidenceRef: "evidence-confirmation-owner-confirmation-pending",
    };
    value.authorityGrants.push({
      id: "grant-owner-confirmation-pending",
      obligationRef: observation.obligationRef,
      granteeRef: "principal-completion-owner",
      issuedByRef: "principal-grant-issuer",
      scope: "owner-completion-confirmation",
      activeFrom: "2026-09-01T00:00:00Z",
      activeUntil: "2026-09-05T23:59:59Z",
      rosterRef: value.authorityRoster.id,
      rosterDigest: value.authorityRoster.contentDigest,
      evidenceRef: "evidence-grant-owner-confirmation-pending",
      payloadDigest: fixture.authorityGrants[0].payloadDigest,
    });
    value.evidence.push(
      {
        id: "evidence-grant-owner-confirmation-pending",
        kind: "authority-grant-record",
        roundRef: value.round.id,
        roundDigest: value.round.roundDigest,
        observedAt: "2026-09-01T00:00:00Z",
        suppliedByRef: "principal-grant-issuer",
        subjectRefs: [
          "grant-owner-confirmation-pending",
          observation.obligationRef,
          "principal-completion-owner",
        ],
        sourceRecordDigest:
          "sha256:1818181818181818181818181818181818181818181818181818181818181818",
        payloadDigest: fixture.evidence[0].payloadDigest,
        recordDigest: fixture.evidence[0].recordDigest,
      },
      {
        id: "evidence-confirmation-owner-confirmation-pending",
        kind: "completion-confirmation",
        roundRef: value.round.id,
        roundDigest: value.round.roundDigest,
        observedAt: observation.observedAt,
        suppliedByRef: "principal-completion-owner",
        subjectRefs: [
          observation.id,
          observation.obligationRef,
          "principal-completion-owner",
        ],
        sourceRecordDigest:
          "sha256:1919191919191919191919191919191919191919191919191919191919191919",
        payloadDigest: fixture.evidence[0].payloadDigest,
        recordDigest: fixture.evidence[0].recordDigest,
      },
    );
  }, true);

  assertSchemaValid(candidate, "newly confirmed completion");
  assert.deepEqual(findings(candidate), []);
  assert.deepEqual(candidate.coverage.entries, fixture.coverage.entries);
  assert.equal(candidate.register.contentDigest, fixture.register.contentDigest);
  assert.equal(candidate.round.roundDigest, fixture.round.roundDigest);
  assert.notEqual(candidate.coverage.contentDigest, fixture.coverage.contentDigest);
  assert.notEqual(
    candidate.destinationApproval.payloadDigest,
    fixture.destinationApproval.payloadDigest,
  );
  assert.notEqual(candidate.handoff.payloadDigest, fixture.handoff.payloadDigest);
});

test("resolution, grant, and evidence content changes flow through downstream roots", async (t) => {
  const cases = [
    [
      "blocker",
      (value) => {
        value.blockers[0].detectedAt = "2026-09-05T09:11:00Z";
        value.evidence.find((row) => row.id === value.blockers[0].evidenceRef).observedAt =
          "2026-09-05T09:11:00Z";
      },
    ],
    [
      "grant",
      (value) => {
        value.authorityGrants[0].activeFrom = "2026-09-01T00:00:01Z";
        value.evidence.find(
          (row) => row.id === value.authorityGrants[0].evidenceRef,
        ).observedAt = "2026-09-01T00:00:01Z";
      },
    ],
    [
      "evidence",
      (value) => {
        value.evidence.find(
          (row) => row.id === "evidence-performance-complete",
        ).sourceRecordDigest =
          "sha256:2020202020202020202020202020202020202020202020202020202020202020";
      },
    ],
  ];

  for (const [label, change] of cases) {
    await t.test(label, () => {
      const candidate = mutate(change, true);
      assertSchemaValid(candidate, `${label} content change`);
      assert.deepEqual(findings(candidate), []);
      assert.notEqual(candidate.coverage.contentDigest, fixture.coverage.contentDigest);
      assert.notEqual(
        candidate.destinationApproval.payloadDigest,
        fixture.destinationApproval.payloadDigest,
      );
      assert.notEqual(candidate.handoff.payloadDigest, fixture.handoff.payloadDigest);
    });
  }
});

test("one clause locator may hold multiple distinct obligation semantics", () => {
  const candidate = mutate((value) => {
    value.obligations[1].clauseLocator = value.obligations[0].clauseLocator;
    value.obligations[1].clauseDigest = value.obligations[0].clauseDigest;
    value.observations[1].clauseDigest = value.obligations[0].clauseDigest;
  }, { resealRegister: true });
  assertSchemaValid(candidate, "shared clause locator candidate");
  assert.deepEqual(findings(candidate), []);
});

test("one clause locator cannot identify different clause content in an agreement version", () => {
  const candidate = mutate((value) => {
    value.obligations[1].clauseLocator = value.obligations[0].clauseLocator;
  }, { resealRegister: true });
  assertSchemaValid(candidate, "conflicting clause locator candidate");
  assert.ok(codes(candidate).has("invalid_clause_identity"));
});

test("same clause content cannot be replayed under a different locator", () => {
  const candidate = mutate((value) => {
    value.obligations[1].clauseDigest = value.obligations[0].clauseDigest;
    value.observations[1].clauseDigest = value.obligations[0].clauseDigest;
  }, { resealRegister: true });
  assertSchemaValid(candidate, "clause replay candidate");
  assert.ok(codes(candidate).has("invalid_clause_identity"));
});

test("different IDs cannot conceal exact duplicate obligation semantics", () => {
  const candidate = mutate((value) => {
    value.obligations[1].obligationDigest = value.obligations[0].obligationDigest;
    value.observations[1].obligationDigest = value.obligations[0].obligationDigest;
  }, { resealRegister: true });
  assertSchemaValid(candidate, "duplicate obligation semantics candidate");
  assert.ok(codes(candidate).has("duplicate_obligation_semantics"));
});

test("one logical agreement cannot appear under multiple version-record IDs", () => {
  const candidate = mutate((value) => {
    const duplicate = clone(value.agreements[0]);
    duplicate.id = "agreement-services-v3";
    duplicate.version = "v3";
    duplicate.sourceEvidenceRef = "evidence-agreement-copy-v3";
    value.agreements.push(duplicate);
  }, true);
  assertSchemaValid(candidate, "duplicate agreement ID candidate");
  assert.ok(codes(candidate).has("duplicate_agreement_id"));
});

test("invented obligations cannot enter outside the confirmed register", () => {
  const candidate = mutate((value) => {
    const invented = clone(value.obligations[1]);
    invented.id = "obligation-invented";
    invented.clauseLocator = "S99.1";
    value.obligations.push(invented);
  }, true);
  assertSchemaValid(candidate, "invented obligation candidate");
  assert.ok(codes(candidate).has("invalid_register_binding"));
  assert.ok(codes(candidate).has("invalid_blocker_equality"));
});

test("omitted obligations cannot disappear from the confirmed register", () => {
  const candidate = mutate((value) => {
    value.obligations = value.obligations.filter(
      (row) => row.id !== "obligation-owner-confirmation-pending",
    );
  }, true);
  assertSchemaValid(candidate, "omitted obligation candidate");
  assert.ok(codes(candidate).has("invalid_register_binding"));
  assert.ok(codes(candidate).has("invalid_coverage"));
});

test("executed agreement version drift invalidates its exact source binding", () => {
  const candidate = mutate((value) => {
    value.agreements[0].version = "v3";
  });
  assertSchemaValid(candidate, "agreement version drift");
  assert.ok(codes(candidate).has("invalid_evidence_digest"));
});

test("default resealing cannot bless agreement version or content drift", () => {
  for (const change of [
    (value) => {
      value.agreements[0].version = "v3";
    },
    (value) => {
      value.agreements[0].contentDigest =
        "sha256:bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc";
    },
  ]) {
    const candidate = mutate(change, true);
    assertSchemaValid(candidate, "resealed agreement drift");
    assert.equal(candidate.register.contentDigest, fixture.register.contentDigest);
    assert.ok(codes(candidate).has("invalid_register_digest"));
  }
});

test("observation clause drift is rejected even after all derived digests are resealed", () => {
  const candidate = mutate((value) => {
    value.observations[0].clauseDigest =
      "sha256:abababababababababababababababababababababababababababababababab";
  }, true);
  assertSchemaValid(candidate, "clause drift");
  assert.ok(codes(candidate).has("invalid_observation_binding"));
});

test("executed source digest tampering invalidates the reciprocal evidence payload", () => {
  const candidate = mutate((value) => {
    value.agreements[0].contentDigest =
      "sha256:bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc";
  });
  assertSchemaValid(candidate, "source digest tampering");
  assert.ok(codes(candidate).has("invalid_evidence_digest"));
});

test("register digest tampering invalidates register, round, coverage, and handoff roots", () => {
  const candidate = mutate((value) => {
    value.register.contentDigest =
      "sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
  });
  assertSchemaValid(candidate, "register digest tampering");
  const result = codes(candidate);
  assert.ok(result.has("invalid_register_digest"));
  assert.ok(result.has("invalid_round_binding"));
  assert.ok(result.has("invalid_evidence_digest"));
});

test("performance evidence may predate the round when it follows agreement execution", () => {
  assert.ok(
    Date.parse(
      fixture.evidence.find((row) => row.id === "evidence-performance-complete").observedAt,
    ) < Date.parse(fixture.round.opensAt),
  );
  assert.deepEqual(findings(fixture), []);
});

test("performance evidence cannot predate its executed agreement", () => {
  const candidate = mutate((value) => {
    value.evidence.find((row) => row.id === "evidence-performance-complete").observedAt =
      "2026-01-15T17:59:59Z";
  }, true);
  assertSchemaValid(candidate, "pre-execution performance evidence");
  assert.ok(codes(candidate).has("invalid_evidence_chronology"));
});

test("performance evidence must precede its consuming observation and completion", () => {
  for (const observedAt of ["2026-09-04T10:00:00Z", "2026-09-04T10:00:01Z"]) {
    const candidate = mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-performance-complete").observedAt =
        observedAt;
    }, true);
    assertSchemaValid(candidate, `late performance evidence ${observedAt}`);
    assert.ok(codes(candidate).has("invalid_evidence_chronology"));
  }
});

test("future-dated evidence is rejected against caller-supplied asOf", () => {
  const candidate = mutate((value) => {
    value.evidence.find((row) => row.id === "evidence-performance-complete").observedAt =
      "2026-09-06T16:00:00Z";
  }, true);
  assertSchemaValid(candidate, "future evidence");
  assert.ok(codes(candidate).has("future_record"));
});

test("completion confirmation requires the exact authorized named human", () => {
  const candidate = mutate((value) => {
    value.observations[0].completion.confirmedByRef = "principal-obligation-owner";
  }, true);
  assertSchemaValid(candidate, "unauthorized confirmation");
  assert.ok(codes(candidate).has("invalid_completion_authority"));
});

test("completion grant grantee must be a scoped obligation owner", () => {
  const candidate = mutate((value) => {
    value.authorityGrants[0].granteeRef = "principal-performance-supplier";
  }, true);
  assertSchemaValid(candidate, "unscoped grant grantee");
  assert.ok(codes(candidate).has("invalid_authority_grant"));
});

test("completion grant grantee cannot be the destination approver or handoff owner", () => {
  for (const roleRef of [
    "principal-destination-approver",
    "principal-handoff-owner",
  ]) {
    const candidate = mutate((value) => {
      value.principals.find((row) => row.id === roleRef).scopes.push("obligation-owner");
      value.authorityGrants[0].granteeRef = roleRef;
    }, true);
    assertSchemaValid(candidate, `grant grantee ${roleRef}`);
    assert.ok(codes(candidate).has("invalid_authority_grant"));
    assert.ok(codes(candidate).has("invalid_role_separation"));
  }
});

test("performance evidence supplier must be scoped and exactly bound", () => {
  const unscoped = mutate((value) => {
    value.obligations[0].performanceEvidenceSupplierRef = "principal-agreement-system";
    value.evidence.find(
      (row) => row.id === "evidence-performance-complete",
    ).suppliedByRef = "principal-agreement-system";
  }, true);
  assertSchemaValid(unscoped, "unscoped performance supplier");
  assert.ok(codes(unscoped).has("invalid_performance_evidence_supplier"));

  const differentlyBound = mutate((value) => {
    value.principals
      .find((row) => row.id === "principal-obligation-owner")
      .scopes.push("performance-evidence-supplier");
    value.evidence.find(
      (row) => row.id === "evidence-performance-complete",
    ).suppliedByRef = "principal-obligation-owner";
  }, true);
  assertSchemaValid(differentlyBound, "differently bound performance supplier");
  assert.ok(codes(differentlyBound).has("invalid_evidence_closure"));
});

test("roster membership is structural and does not independently authenticate principals", () => {
  const candidate = mutate((value) => {
    value.authorityRoster.principalRefs = value.authorityRoster.principalRefs.filter(
      (ref) => ref !== "principal-performance-supplier",
    );
  }, true);
  assertSchemaValid(candidate, "structurally incomplete roster");
  const result = codes(candidate);
  assert.ok(result.has("invalid_authority_roster"));
  assert.equal(result.has("invalid_performance_evidence_supplier"), false);
});

test("performance evidence supplier cannot confirm the same completion", () => {
  const candidate = mutate((value) => {
    value.principals
      .find((row) => row.id === "principal-completion-owner")
      .scopes.push("performance-evidence-supplier");
    value.obligations[0].performanceEvidenceSupplierRef = "principal-completion-owner";
    value.evidence.find(
      (row) => row.id === "evidence-performance-complete",
    ).suppliedByRef = "principal-completion-owner";
  }, true);
  assertSchemaValid(candidate, "supplier-confirmer collision");
  assert.ok(codes(candidate).has("invalid_performance_evidence_supplier"));
});

test("observation owner must exactly match the obligation responsible owner", () => {
  const candidate = mutate((value) => {
    value.observations[0].ownerRef = "principal-completion-owner";
    value.evidence.find(
      (row) => row.id === "evidence-observation-complete",
    ).suppliedByRef = "principal-completion-owner";
  }, true);
  assertSchemaValid(candidate, "observation owner mismatch");
  assert.ok(codes(candidate).has("invalid_observation_binding"));
});

test("authority, responsible-owner, and evidence-supplier roles are pairwise separated", () => {
  const roleRefs = {
    "register-confirmer": "principal-register-owner",
    "roster-custodian": "principal-roster-custodian",
    "grant-issuer": "principal-grant-issuer",
    "grant-grantee": "principal-completion-owner",
    "destination-approver": "principal-destination-approver",
    "handoff-owner": "principal-handoff-owner",
    "obligation-responsible-owner": "principal-obligation-owner",
    "performance-evidence-supplier": "principal-performance-supplier",
  };
  const setRole = {
    "register-confirmer": (value, ref) => {
      value.register.confirmedByRef = ref;
    },
    "roster-custodian": (value, ref) => {
      value.authorityRoster.custodianRef = ref;
    },
    "grant-issuer": (value, ref) => {
      value.authorityGrants[0].issuedByRef = ref;
    },
    "grant-grantee": (value, ref) => {
      value.authorityGrants[0].granteeRef = ref;
    },
    "destination-approver": (value, ref) => {
      value.round.destinationApproverRef = ref;
      value.destinationApproval.approvedByRef = ref;
    },
    "handoff-owner": (value, ref) => {
      value.round.handoffOwnerRef = ref;
      value.handoff.nextOwnerRef = ref;
    },
    "obligation-responsible-owner": (value, ref) => {
      value.obligations[0].responsibleOwnerRef = ref;
      value.observations[0].ownerRef = ref;
      value.evidence.find(
        (row) => row.id === "evidence-observation-complete",
      ).suppliedByRef = ref;
    },
    "performance-evidence-supplier": (value, ref) => {
      value.obligations[0].performanceEvidenceSupplierRef = ref;
      value.evidence.find(
        (row) => row.id === "evidence-performance-complete",
      ).suppliedByRef = ref;
    },
  };
  const roles = Object.keys(roleRefs);
  for (let leftIndex = 0; leftIndex < roles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < roles.length; rightIndex += 1) {
      const leftRole = roles[leftIndex];
      const rightRole = roles[rightIndex];
      const candidate = mutate((value) => {
        const principal = value.principals.find((row) => row.id === roleRefs[leftRole]);
        if (
          rightRole === "obligation-responsible-owner" &&
          !principal.scopes.includes("obligation-owner")
        ) {
          principal.scopes.push("obligation-owner");
        }
        if (
          rightRole === "performance-evidence-supplier" &&
          !principal.scopes.includes("performance-evidence-supplier")
        ) {
          principal.scopes.push("performance-evidence-supplier");
        }
        setRole[rightRole](value, roleRefs[leftRole]);
      }, true);
      assertSchemaValid(candidate, `${leftRole}/${rightRole}`);
      assert.ok(
        codes(candidate).has("invalid_role_separation"),
        `${leftRole}/${rightRole}: ${JSON.stringify(findings(candidate))}`,
      );
    }
  }
});

test("stale completion authority cannot be replayed into the current confirmation", () => {
  const candidate = mutate((value) => {
    value.authorityGrants[0].activeUntil = "2026-09-03T23:59:59Z";
  }, true);
  assertSchemaValid(candidate, "stale completion authority");
  const result = codes(candidate);
  assert.ok(result.has("invalid_authority_grant"));
  assert.ok(result.has("invalid_completion_authority"));
});

test("an obligation cannot have both a current observation and a blocker", () => {
  const candidate = mutate((value) => {
    const observation = clone(value.observations[1]);
    observation.id = "observation-blocked";
    observation.obligationRef = "obligation-blocked";
    observation.clauseDigest = value.obligations[3].clauseDigest;
    observation.obligationDigest = value.obligations[3].obligationDigest;
    observation.reliedEvidenceRefs = ["evidence-performance-blocked-missing"];
    observation.observationEvidenceRef = "evidence-observation-blocked";
    value.observations.push(observation);
  }, true);
  assertSchemaValid(candidate, "observation and blocker candidate");
  assert.ok(codes(candidate).has("invalid_blocker_equality"));
});

test("false blocker targets fail exact missing-evidence equality", () => {
  const candidate = mutate((value) => {
    value.blockers[0].exactMissingEvidenceRefs = ["evidence-unrelated-missing"];
  }, true);
  assertSchemaValid(candidate, "false blocker target");
  assert.ok(codes(candidate).has("invalid_blocker_equality"));
});

test("another obligation's performance evidence remains semantically missing", () => {
  const wrongRef = "evidence-performance-complete";
  const candidate = mutate((value) => {
    value.obligations.find(
      (row) => row.id === "obligation-blocked",
    ).requiredEvidenceRefs = [wrongRef];
  }, { resealRegister: true });
  assertSchemaValid(candidate, "cross-obligation performance evidence");
  const blockerFinding = findings(candidate).find(
    (row) => row.code === "invalid_blocker_equality",
  );
  assert.ok(blockerFinding);
  assert.ok(blockerFinding.refs.includes(wrongRef));
});

test("handoff evidence remains semantically missing for a blocked obligation", () => {
  const wrongRef = "evidence-handoff";
  const candidate = mutate((value) => {
    value.obligations.find(
      (row) => row.id === "obligation-blocked",
    ).requiredEvidenceRefs = [wrongRef];
  }, { resealRegister: true });
  assertSchemaValid(candidate, "handoff evidence as required performance evidence");
  const blockerFinding = findings(candidate).find(
    (row) => row.code === "invalid_blocker_equality",
  );
  assert.ok(blockerFinding);
  assert.ok(blockerFinding.refs.includes(wrongRef));
});

test("missing blocker fails closed for the exact unresolved obligation", () => {
  const candidate = mutate((value) => {
    value.blockers = [];
    value.evidence = value.evidence.filter((row) => row.id !== "evidence-blocker");
  }, true);
  assertSchemaValid(candidate, "missing blocker");
  assert.ok(codes(candidate).has("invalid_blocker_equality"));
});

test("destination approval cannot drift to an unscoped principal", () => {
  const candidate = mutate((value) => {
    value.round.destinationApproverRef = "principal-handoff-owner";
    value.destinationApproval.approvedByRef = "principal-handoff-owner";
  }, true);
  assertSchemaValid(candidate, "destination drift");
  assert.ok(codes(candidate).has("invalid_destination"));
});

test("handoff cannot drift from its exact recipient or coverage bindings", () => {
  const recipientDrift = mutate((value) => {
    value.round.handoffOwnerRef = "principal-destination-approver";
    value.handoff.nextOwnerRef = "principal-destination-approver";
  }, true);
  assertSchemaValid(recipientDrift, "handoff recipient drift");
  assert.ok(codes(recipientDrift).has("invalid_handoff"));

  const coverageDrift = mutate((value) => {
    value.handoff.observationRefs.pop();
  }, true);
  assertSchemaValid(coverageDrift, "handoff coverage drift");
  assert.ok(codes(coverageDrift).has("invalid_handoff"));
});

test("fixed due timestamps determine the only accepted due state", () => {
  const candidate = mutate((value) => {
    value.observations.find((row) => row.id === "observation-future").state =
    "owner-confirmation-pending";
    value.observations.find((row) => row.id === "observation-future").dueState = "due";
    value.observations.find((row) => row.id === "observation-future").reliedEvidenceRefs = [
    "evidence-performance-future",
    ];
  }, true);
  assertSchemaValid(candidate, "due state drift");
  assert.ok(codes(candidate).has("invalid_due_state"));
});

test("sealed due state is stable at every later valid asOf", () => {
  assert.deepEqual(findings(fixture, { asOf: AS_OF }), []);
  assert.deepEqual(findings(fixture, { asOf: LATER_AS_OF }), []);
});

test("round identity digest binds artifact ID and schema version", () => {
  const artifactDrift = mutate((value) => {
    value.artifactId = "artifact-contract-review-2026-10";
  });
  assertSchemaValid(artifactDrift, "artifact ID drift");
  assert.ok(codes(artifactDrift).has("invalid_round_digest"));

  const schemaDrift = mutate((value) => {
    value.schemaVersion = "awesomeClaws.contractObligationTracker.v2";
  });
  assert.equal(validateSchema(schemaDrift), false);
  const result = codes(schemaDrift);
  assert.ok(result.has("invalid_artifact"));
  assert.ok(result.has("invalid_round_digest"));
});

test("directive-valued destination fails semantic validation after full reseal", () => {
  const candidate = mutate((value) => {
    const destination = { directive: "contract-owner-review-queue" };
    value.round.destination = destination;
    value.destinationApproval.destination = destination;
  }, { resealRegister: true });
  assert.equal(validateSchema(candidate), false);
  assert.ok(
    findings(candidate).some(
      (row) => row.code === "invalid_destination" && row.path === "$.round.destination",
    ),
  );
});

test("malformed register versions fail semantic validation after full reseal", () => {
  const candidate = mutate((value) => {
    value.register.version = "v0";
    value.round.registerVersion = "v0";
    value.coverage.registerVersion = "v0";
  }, { resealRegister: true });
  assert.equal(validateSchema(candidate), false);
  assert.deepEqual(
    findings(candidate)
      .filter((row) => row.code === "invalid_version")
      .map((row) => row.path),
    ["$.coverage.registerVersion", "$.register.version", "$.round.registerVersion"],
  );
});

test("semantic findings are deterministic for the same malformed artifact", () => {
  const candidate = mutate((value) => {
    value.obligations[0].requiredEvidenceRefs = [];
    value.round.destinationApproverRef = value.round.handoffOwnerRef;
  });
  assert.deepEqual(findings(candidate), findings(clone(candidate)));
});

test("reciprocal evidence subjects and consumers close exactly once", () => {
  const candidate = mutate((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-observation-owner-confirmation-pending",
    ).subjectRefs = ["obligation-owner-confirmation-pending"];
  }, true);
  assertSchemaValid(candidate, "evidence subject drift");
  assert.ok(codes(candidate).has("invalid_evidence_closure"));
});

test("source record digests cannot be reused across obligations", () => {
  const candidate = mutate((value) => {
    const complete = value.evidence.find((row) => row.id === "evidence-performance-complete");
    const pending = value.evidence.find(
      (row) => row.id === "evidence-performance-owner-confirmation-pending",
    );
    pending.sourceRecordDigest = complete.sourceRecordDigest;
  }, true);
  assertSchemaValid(candidate, "cross-obligation source digest replay");
  const duplicate = findings(candidate).find(
    (row) => row.code === "duplicate_source_record_digest",
  );
  assert.deepEqual(duplicate?.refs, [
    "evidence-performance-complete",
    "evidence-performance-owner-confirmation-pending",
    fixture.evidence.find((row) => row.id === "evidence-performance-complete")
      .sourceRecordDigest,
  ].sort());
});

test("source record digests cannot be reused across evidence kinds", () => {
  const candidate = mutate((value) => {
    const performance = value.evidence.find(
      (row) => row.id === "evidence-performance-complete",
    );
    const observation = value.evidence.find(
      (row) => row.id === "evidence-observation-complete",
    );
    observation.sourceRecordDigest = performance.sourceRecordDigest;
  }, true);
  assertSchemaValid(candidate, "cross-kind source digest replay");
  assert.ok(codes(candidate).has("duplicate_source_record_digest"));
});

test("source record digests cannot equal any internally derived digest", () => {
  const derivedDigests = [
    ["register", fixture.register.contentDigest],
    ["roster", fixture.authorityRoster.contentDigest],
    ["round", fixture.round.roundDigest],
    ["coverage", fixture.coverage.contentDigest],
    ["agreement content", fixture.agreements[0].contentDigest],
    ["obligation clause", fixture.obligations[0].clauseDigest],
    ["obligation payload", fixture.obligations[0].obligationDigest],
    ["authority grant", fixture.authorityGrants[0].payloadDigest],
    ["destination approval", fixture.destinationApproval.payloadDigest],
    ["handoff", fixture.handoff.payloadDigest],
    [
      "evidence payload",
      fixture.evidence.find(
        (row) => row.id === "evidence-performance-owner-confirmation-pending",
      ).payloadDigest,
    ],
    [
      "evidence record",
      fixture.evidence.find(
        (row) => row.id === "evidence-performance-owner-confirmation-pending",
      ).recordDigest,
    ],
  ];
  for (const [label, derivedDigest] of derivedDigests) {
    const candidate = mutate((value) => {
      value.evidence.find(
        (row) => row.id === "evidence-agreement-copy",
      ).sourceRecordDigest = derivedDigest;
    }, true);
    assertSchemaValid(candidate, `${label} source digest collision`);
    assert.ok(
      codes(candidate).has("derived_source_record_digest"),
      `${label}: ${JSON.stringify(findings(candidate))}`,
    );
  }
});

test("prohibited action, legal, compliance, and assurance fields fail without schema reliance", () => {
  for (const [field, value] of [
    ["action", "send-notice"],
    ["legalOpinion", "enforceable"],
    ["complianceStatus", "compliant"],
    ["assurance", "audited"],
  ]) {
    const candidate = mutate((artifact) => {
      artifact.handoff[field] = value;
    });
    assert.equal(validateSchema(candidate), false, field);
    assert.ok(
      codes(candidate).has("prohibited_contract_field") ||
        codes(candidate).has("prohibited_contract_claim"),
      `${field}: ${JSON.stringify(findings(candidate))}`,
    );
  }
});

test("schema-controlled domain identifiers may use contract vocabulary", () => {
  const candidate = mutate((value) => {
    value.artifactId = "payment-renewal-termination-dispute-audit";
    value.obligations[0].clauseLocator = "PAYMENT-RENEWAL";
    value.principals[0].name = "Payment Renewal Termination Audit";
  }, { resealRegister: true });
  assertSchemaValid(candidate, "legitimate domain identifiers");
  assert.deepEqual(findings(candidate), []);
});

test("prohibited unknown action and claim keys fail recursively without schema reliance", () => {
  for (const [field, value] of [
    ["notice-was-sent", true],
    ["performanceAccepted", true],
    ["amendmentClaimed", true],
    ["auditClaim", "not-claimed"],
  ]) {
    const candidate = mutate((artifact) => {
      artifact.handoff.unmodeled = {
        nested: {
          [field]: value,
        },
      };
    });
    assert.equal(validateSchema(candidate), false, field);
    assert.ok(
      findings(candidate).some(
        (row) =>
          row.code === "prohibited_contract_field" &&
          row.path === `$.handoff.unmodeled.nested.${field}`,
      ),
      `${field}: ${JSON.stringify(findings(candidate))}`,
    );
  }
});

test("every handoff authority disclaimer remains not-claimed", () => {
  for (const field of [
    "legalConclusionClaim",
    "performanceAcceptanceClaim",
    "complianceClaim",
    "auditClaim",
    "noticeSentClaim",
    "paymentMadeClaim",
    "amendmentClaim",
    "renewalClaim",
    "terminationClaim",
    "systemMutationClaim",
  ]) {
    const candidate = mutate((value) => {
      value.handoff[field] = "claimed";
    }, true);
    assert.equal(validateSchema(candidate), false, field);
    assert.ok(codes(candidate).has("invalid_handoff"), field);
  }
});

test("every modeled record remains closed to unknown properties", () => {
  for (const candidate of [
    mutate((value) => {
      value.unexpected = true;
    }),
    mutate((value) => {
      value.round.unexpected = true;
    }),
    mutate((value) => {
      value.obligations[0].unexpected = true;
    }),
    mutate((value) => {
      value.observations[0].completion.unexpected = true;
    }),
    mutate((value) => {
      value.coverage.entries[0].unexpected = true;
    }),
  ]) {
    assert.equal(validateSchema(candidate), false);
    assert.ok(codes(candidate).has("prohibited_contract_field"));
  }
});
