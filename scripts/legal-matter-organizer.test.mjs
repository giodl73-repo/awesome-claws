import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/legal-matter-organizer/fixtures/legal-matter.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/legal-matter-organizer/schemas/legal-matter.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function findings(candidate) {
  return validateArtifactSemantics("legal-matter-organizer", candidate);
}

function codes(candidate) {
  return new Set(findings(candidate).map((item) => item.code));
}

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

test("legal matter fixture and public CLI validate", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "legal-matter-organizer",
      "claws/legal-matter-organizer/fixtures/legal-matter.example.json",
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("legal matter validator is total over malformed arrays and rows", () => {
  const ledgerFields = [
    "principals",
    "parties",
    "workstreams",
    "sources",
    "custodyEvents",
    "records",
    "chronology",
    "deadlines",
    "privilegeLabels",
    "holds",
    "conflicts",
    "tasks",
    "decisions",
    "reviewGates",
    "authorityGates",
  ];
  for (const field of ledgerFields) {
    for (const malformed of [null, {}, [null, 7, "row"]]) {
      const candidate = mutate((value) => {
        value[field] = malformed;
      });
      assert.doesNotThrow(() => findings(candidate), `${field}: ${JSON.stringify(malformed)}`);
      assert.ok(findings(candidate).length > 0, field);
    }
  }
  const nested = mutate((value) => {
    value.sources[0].recordRefs = {};
    value.records[0].partyRefs = null;
    value.deadlines[0].candidates = [null, "candidate"];
    value.handoff.coveredRefs = 42;
  });
  assert.doesNotThrow(() => findings(nested));
  assert.ok(codes(nested).has("invalid_string_list"));
  assert.ok(codes(nested).has("invalid_array_record"));
});

test("legal matter rejects duplicate, dangling, reverse, orphan, and cross-snapshot state", () => {
  const duplicate = mutate((value) => {
    value.records[1].id = value.records[0].id;
  });
  assert.ok(codes(duplicate).has("duplicate_reference"));

  const dangling = mutate((value) => {
    value.records[0].sourceRefs = ["source-missing"];
  });
  assert.ok(codes(dangling).has("dangling_reference"));

  const missingReverse = mutate((value) => {
    value.sources[0].recordRefs = [];
  });
  assert.ok(codes(missingReverse).has("missing_reverse_legal_reference"));

  const orphan = mutate((value) => {
    value.handoff.coveredRefs = value.handoff.coveredRefs.filter(
      (ref) => ref !== "task-index-records",
    );
  });
  assert.ok(codes(orphan).has("incomplete_legal_matter_index"));

  const crossMatter = mutate((value) => {
    value.tasks[0].matterRef = "MAT-2026-999";
  });
  assert.ok(codes(crossMatter).has("cross_legal_matter_snapshot"));

  const crossSnapshot = mutate((value) => {
    value.holds[0].snapshotRef = "SNAP-MAT-2026-014-OTHER";
  });
  assert.ok(codes(crossSnapshot).has("cross_legal_matter_snapshot"));
});

test("legal matter enforces chronology and authoritative deadline reconciliation", () => {
  const invalidUnknown = mutate((value) => {
    value.chronology[0].temporalState = "unknown";
  });
  assert.ok(codes(invalidUnknown).has("invalid_legal_chronology"));

  const futureOccurred = mutate((value) => {
    value.chronology[0].eventAt = "2027-01-01T10:00:00-08:00";
  });
  assert.ok(codes(futureOccurred).has("invalid_legal_chronology"));

  for (const state of ["unverified", "conflicting", "stale", "unsupported", "inferred"]) {
    const candidate = mutate((value) => {
      value.deadlines[0].verificationState = state;
    });
    assert.ok(codes(candidate).has("unready_legal_deadline"), state);
  }

  const missingTimezone = mutate((value) => {
    value.deadlines[0].timezone = "Not/AZone";
  });
  assert.ok(codes(missingTimezone).has("unready_legal_deadline"));

  const unknownAuthority = mutate((value) => {
    value.deadlines[0].authority = "unknown";
  });
  assert.ok(codes(unknownAuthority).has("unready_legal_deadline"));

  const unsupportedResolvedAuthority = mutate((value) => {
    value.deadlines[0].authority = "internal-system";
  });
  assert.ok(codes(unsupportedResolvedAuthority).has("unready_legal_deadline"));

  const conflictingCandidates = mutate((value) => {
    value.deadlines[0].candidates[1].dueAt = "2026-10-16T17:00:00-07:00";
  });
  assert.ok(codes(conflictingCandidates).has("unready_legal_deadline"));

  const staleConfirmation = mutate((value) => {
    value.deadlines[0].confirmedAt = "2026-09-01T12:00:00Z";
  });
  assert.ok(codes(staleConfirmation).has("unready_legal_deadline"));

  const unsupportedAuthority = mutate((value) => {
    value.deadlines[0].candidates[0].authority = "internal-system";
  });
  assert.ok(codes(unsupportedAuthority).has("invalid_deadline_candidate"));
});

test("legal matter requires scoped named counsel for privilege and review", () => {
  for (const state of ["unreviewed-claim", "not-assessed"]) {
    const candidate = mutate((value) => {
      value.privilegeLabels[0].state = state;
      value.privilegeLabels[0].counselRef = null;
      value.privilegeLabels[0].decidedAt = null;
    });
    assert.ok(codes(candidate).has("unresolved_privilege_label"), state);
  }

  const unscoped = mutate((value) => {
    value.deadlines[0].confirmingCounselRef = "principal-priya-shah";
  });
  assert.ok(codes(unscoped).has("missing_legal_authority_scope"));

  const bareRole = mutate((value) => {
    value.principals[0].name = "Supervising counsel";
  });
  assert.ok(codes(bareRole).has("bare_legal_role_principal"));

  const titledHuman = mutate((value) => {
    value.principals[0].name = "Jordan Lee, Supervising counsel";
  });
  assert.deepEqual(findings(titledHuman), []);

  const namedOperationsSpecialist = mutate((value) => {
    value.principals[2].name = "Alex Morgan, Legal operations specialist";
  });
  assert.deepEqual(findings(namedOperationsSpecialist), []);

  const bareOperationsRole = mutate((value) => {
    value.principals[2].name = "Legal operations specialist";
  });
  assert.ok(codes(bareOperationsRole).has("bare_legal_role_principal"));

  const nonIndependent = mutate((value) => {
    value.reviewGates.at(-1).reviewerRef = "principal-jordan-lee";
  });
  assert.ok(codes(nonIndependent).has("invalid_independent_counsel_review"));

  const nonCounselReviewer = mutate((value) => {
    value.principals[1].title = "Legal operations specialist";
  });
  assert.ok(codes(nonCounselReviewer).has("invalid_independent_counsel_review"));

  const earlyReview = mutate((value) => {
    value.reviewGates.at(-1).reviewedAt = "2026-09-06T18:00:00Z";
  });
  assert.ok(codes(earlyReview).has("invalid_independent_counsel_review"));
});

test("legal matter preserves active holds and blocks destructive or released state", () => {
  const missingCoverage = mutate((value) => {
    value.holds[0].coveredSourceRefs.pop();
  });
  assert.ok(codes(missingCoverage).has("incomplete_legal_matter_index"));

  for (const state of ["released", "contradicted", "missing-coverage"]) {
    const candidate = mutate((value) => {
      value.holds[0].state = state;
    });
    assert.ok(codes(candidate).has("unsafe_legal_hold_state"), state);
  }

  const releaseReceipt = mutate((value) => {
    value.holds[0].releasedByRef = "principal-jordan-lee";
    value.holds[0].releasedAt = "2026-09-06T20:30:00Z";
  });
  assert.ok(codes(releaseReceipt).has("unsafe_legal_hold_state"));

  const taskBlocker = mutate((value) => {
    value.tasks[0].status = "blocked";
    value.tasks[0].completedAt = null;
  });
  assert.ok(codes(taskBlocker).has("invalid_legal_task_state"));
  assert.ok(codes(taskBlocker).has("premature_counsel_review_handoff"));

  const taskBeforeEvidence = mutate((value) => {
    value.tasks[0].completedAt = "2026-09-01T00:00:00Z";
  });
  assert.ok(codes(taskBeforeEvidence).has("invalid_legal_task_state"));
});

test("legal matter enforces synthetic confidentiality, controlled refs, source integrity, and custody", () => {
  const personalData = mutate((value) => {
    value.parties[0].label = "Person person@example.com 212-555-0100";
  });
  assert.ok(codes(personalData).has("unminimized_legal_party_data"));

  for (const controlledRef of [
    "controlled://",
    "controlled:///record",
    "controlled://authority",
    "https://example.test/matter",
  ]) {
    const candidate = mutate((value) => {
      value.sources[0].controlledRef = controlledRef;
    });
    assert.ok(codes(candidate).has("invalid_legal_source_integrity"), controlledRef);
  }

  const badDigest = mutate((value) => {
    value.sources[0].integrityDigest = "sha256:short";
  });
  assert.ok(codes(badDigest).has("invalid_legal_source_integrity"));

  const changedCustodyDigest = mutate((value) => {
    value.custodyEvents[0].integrityDigest = `sha256:${"f".repeat(64)}`;
  });
  assert.ok(codes(changedCustodyDigest).has("invalid_custody_event"));

  const brokenCustody = mutate((value) => {
    value.custodyEvents[0].sequence = 2;
  });
  assert.ok(codes(brokenCustody).has("broken_custody_chain"));

  const transferClaim = mutate((value) => {
    value.custodyEvents[0].custodyEffect = "transferred";
  });
  assert.ok(codes(transferClaim).has("invalid_custody_event"));
});

test("legal matter rejects every prohibited affirmative narrative and permits genuine negation", () => {
  const prohibited = [
    "Interpreted the law.",
    "Gave legal advice.",
    "Determined legal strategy.",
    "Created privilege.",
    "Filed the motion.",
    "Served the papers.",
    "Contacted the parties.",
    "Contacted witnesses.",
    "Contacted counsel.",
    "Contacted the court.",
    "Contacted the regulator.",
    "Contacted the agency.",
    "Signed the agreement.",
    "Negotiated with the opposing party.",
    "Settled the matter.",
    "Waived privilege.",
    "Committed the client.",
    "Deleted the original.",
    "Altered the evidence.",
    "Moved the records.",
    "Transferred custody.",
    "Released the hold.",
    "Counsel approved the handoff.",
    "The handoff was approved.",
    "Determine legal strategy.",
    "Create privilege.",
    "File the motion.",
    "Serve the papers.",
    "Negotiate with the opposing party.",
    "Settle the matter.",
    "Waive privilege.",
    "Delete the original.",
    "Alter the evidence.",
    "Move the records.",
    "Destroy the evidence.",
    "Transfer custody.",
    "Release the hold.",
  ];
  for (const text of prohibited) {
    const candidate = mutate((value) => {
      value.decisions[0].outcome = text;
    });
    assert.ok(codes(candidate).has("unauthorized_legal_narrative_action"), text);
  }

  const safe = [
    "No filing occurred.",
    "We did not contact counsel.",
    "The team did not sign the agreement.",
    "No negotiation or settlement occurred.",
    "Counsel did not approve the handoff.",
    "The custodian never moved or destroyed the originals.",
    "The hold was not released.",
  ];
  for (const text of safe) {
    const candidate = mutate((value) => {
      value.decisions[0].outcome = text;
    });
    assert.equal(
      codes(candidate).has("unauthorized_legal_narrative_action"),
      false,
      text,
    );
  }

  const mixedNegation = mutate((value) => {
    value.decisions[0].outcome = "We did not contact counsel and signed the agreement.";
  });
  assert.ok(codes(mixedNegation).has("unauthorized_legal_narrative_action"));
});

test("legal matter requires exact authority gates and stays base-only", async () => {
  const missingGate = mutate((value) => {
    value.authorityGates.pop();
    value.matter.authorityGateRefs.pop();
    value.handoff.authorityGateRefs.pop();
    value.handoff.coveredRefs = value.handoff.coveredRefs.filter(
      (ref) => ref !== "authority-approve-handoff",
    );
  });
  assert.ok(codes(missingGate).has("incomplete_legal_matter_index"));

  const weakenedGate = mutate((value) => {
    value.authorityGates[0].state = "allowed";
  });
  assert.ok(codes(weakenedGate).has("invalid_legal_authority_gate"));

  const manifest = await readFile(
    new URL("../claws/legal-matter-organizer/CLAW.md", import.meta.url),
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
