import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  commercialDealDeskFindings,
  computeCoverageDigest,
  computeHandoffDigest,
  computeHistoryDigest,
  computeInputSnapshotDigest,
  computeLinePayloadDigest,
  computePayloadDigestMaps,
  computeProductPayloadDigest,
  deriveCommercialBlockers,
  exactCommercialLineArithmetic,
  resealCommercialDealDesk,
} from "./commercial-deal-desk-coordinator.mjs";

const AS_OF = "2026-09-14T12:00:00Z";
const clawId = "commercial-deal-desk-coordinator";
const fixturePath = new URL(
  "../sources/commercial-deal-desk-coordinator/fixtures/commercial-deal-desk.example.json",
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/commercial-deal-desk-coordinator/schemas/commercial-deal-desk.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/commercial-deal-desk-coordinator/templates/commercial-deal-desk.md",
    import.meta.url,
  ),
  "utf8",
);
const visual = await readFile(
  new URL(
    "../sources/commercial-deal-desk-coordinator/assets/deal-readiness.html",
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

function mutate(change, { reseal = false } = {}) {
  const candidate = clone();
  change(candidate);
  return reseal ? resealCommercialDealDesk(candidate) : candidate;
}

function findings(candidate, context = { asOf: AS_OF }) {
  return commercialDealDeskFindings(candidate, context);
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

function assertFinding(candidate, expectedCode, label) {
  assertSchemaValid(candidate, label);
  assert.ok(codes(candidate).has(expectedCode), `${label}: ${JSON.stringify(findings(candidate))}`);
}

function blockedDependencyArtifact() {
  return mutate((value) => {
    value.lines.find((row) => row.id === "line-platform").dependencySkus = [
      "SUPPORT-PREM",
    ];
    value.findings.find((row) => row.id === "finding-platform-dependency").status =
      "blocked";
    value.blockers.push({
      id: "blocker-finding-platform-dependency",
      code: "dependency-unresolved",
      subjectRefs: ["finding-platform-dependency", "line-platform"],
      ownerRef: "principal-quote-owner",
      detectedAt: "2026-09-10T10:21:00Z",
      evidenceRefs: ["evidence-blocker-platform-dependency"],
    });
    value.evidence.push({
      id: "evidence-blocker-platform-dependency",
      kind: "blocker-record",
      opportunityId: value.review.opportunityId,
      quoteId: value.review.quoteId,
      quoteRevision: value.review.quoteRevision,
      observedAt: "2026-09-10T10:21:00Z",
      suppliedByRef: "principal-quote-owner",
      subjectRefs: [
        "blocker-finding-platform-dependency",
        "finding-platform-dependency",
        "line-platform",
      ],
      sourceRecordDigest:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      payloadDigest: null,
    });
    value.coverage.blockerRefs = ["blocker-finding-platform-dependency"];
    value.handoff.blockerRefs = ["blocker-finding-platform-dependency"];
    value.handoff.state = "blocked";
  }, { reseal: true });
}

test("accepted fixture is strict, content-bound, semantically clean, and CLI-valid", () => {
  assertSchemaValid(fixture, "fixture");
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.review.inputSnapshotDigest, computeInputSnapshotDigest(fixture.inputs));
  assert.equal(fixture.history.contentDigest, computeHistoryDigest(fixture.history));
  const historyInput = fixture.inputs.find((row) => row.kind === "approval-history");
  const historyEvidence = fixture.evidence.find(
    (row) => row.id === fixture.history.evidenceRef,
  );
  assert.equal(historyInput.digest, fixture.history.contentDigest);
  assert.equal(historyEvidence.sourceRecordDigest, historyInput.digest);
  assert.equal(fixture.coverage.historyEvidenceRef, historyEvidence.id);
  assert.equal(
    fixture.coverage.historySourceRecordDigest,
    historyEvidence.sourceRecordDigest,
  );
  assert.equal(fixture.handoff.historyEvidenceRef, historyEvidence.id);
  assert.equal(
    fixture.handoff.historySourceRecordDigest,
    historyEvidence.sourceRecordDigest,
  );
  const payloads = computePayloadDigestMaps(fixture);
  assert.deepEqual(fixture.coverage.productPayloadDigests, payloads.products);
  assert.deepEqual(fixture.coverage.linePayloadDigests, payloads.lines);
  assert.equal(fixture.coverage.payloadRootDigest, payloads.root);
  assert.equal(fixture.coverage.contentDigest, computeCoverageDigest(fixture.coverage));
  assert.equal(fixture.handoff.contentDigest, computeHandoffDigest(fixture.handoff));

  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      clawId,
      "claws/commercial-deal-desk-coordinator/fixtures/commercial-deal-desk.example.json",
      "--as-of",
      AS_OF,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("fixture covers the exact commercial surface and independent approval lanes", () => {
  assert.equal(fixture.inputs.length, 12);
  assert.equal(fixture.history.approvalRefs.length, 4);
  assert.equal(fixture.history.conflictRefs.length, 1);
  assert.equal(fixture.lines.length, 2);
  assert.equal(fixture.findings.length, 16);
  assert.equal(fixture.exceptions.length, 4);
  assert.deepEqual(
    new Set(fixture.findings.map((row) => row.domain)),
    new Set([
      "configuration",
      "pricing",
      "discount",
      "margin",
      "licensing",
      "legal",
      "dependency",
      "validity",
    ]),
  );
  assert.deepEqual(
    new Set(
      fixture.approvals.filter((row) => row.status === "current").map((row) => row.domain),
    ),
    new Set(["pricing", "legal", "licensing"]),
  );
  assert.equal(fixture.conflicts[0].kind, "cross-revision-approval");
  assert.equal(fixture.handoff.state, "ready-for-order-review");
});

test("X3 template and X4 visual preserve the complete contract and fallback", () => {
  for (const required of [
    "## Exact opportunity and quote revision",
    "{{review.inputSnapshotDigest}}",
    "## Immutable input ledger",
    "{{inputs[].quoteRevision}}",
    "## Complete eight-domain finding matrix",
    "{{findings[].exceptionRef}}",
    "## Exact exception coverage",
    "{{exceptions[].currentApprovalRef}}",
    "## Independent approvals and chronology",
    "{{approvals[].supersedesRef}}",
    "{{conflicts[].resolvedByApprovalRef}}",
    "## Exact coverage and blockers",
    "{{coverage.contentDigest}}",
    "## Order-readiness handoff and authority non-claims",
    "{{handoff.customerCommunicationClaim}}",
    "{{handoff.discountApprovalClaim}}",
    "{{handoff.termApprovalClaim}}",
    "{{handoff.legalConclusionClaim}}",
    "{{handoff.signatureClaim}}",
    "{{handoff.bookingClaim}}",
    "{{handoff.invoicingClaim}}",
    "{{handoff.contractModificationClaim}}",
    "{{handoff.revenueClaim}}",
  ]) {
    assert.ok(template.includes(required), required);
  }
  for (const required of [
    'aria-labelledby="deal-title"',
    "Ready for order review",
    "12 / 12",
    "16 / 16",
    "4 / 4",
    "R6 pricing approval is superseded",
    "outputs/commercial-deal-desk.md",
    "No negotiation, customer communication",
  ]) {
    assert.ok(visual.includes(required), required);
  }
});

test("derived blocker universe is exact and exclusively controls readiness", () => {
  const blocked = blockedDependencyArtifact();
  assertSchemaValid(blocked, "blocked artifact");
  assert.deepEqual(findings(blocked), []);
  assert.deepEqual(
    deriveCommercialBlockers(blocked, { asOf: AS_OF }).map((row) => row.id),
    ["blocker-finding-platform-dependency"],
  );

  const omitted = structuredClone(blocked);
  omitted.blockers = [];
  omitted.coverage.blockerRefs = [];
  omitted.handoff.blockerRefs = [];
  omitted.handoff.state = "ready-for-order-review";
  const resealedOmission = resealCommercialDealDesk(omitted);
  assertFinding(
    resealedOmission,
    "invalid_commercial_blocker_equality",
    "derived blocker omitted",
  );
  assert.ok(codes(resealedOmission).has("invalid_commercial_handoff_state"));

  const extra = mutate((value) => {
    value.blockers.push({
      id: "blocker-invented",
      code: "coverage-incomplete",
      subjectRefs: [value.review.id],
      ownerRef: value.review.quoteOwnerRef,
      detectedAt: "2026-09-10T10:22:00Z",
      evidenceRefs: ["evidence-invented-blocker"],
    });
    value.evidence.push({
      id: "evidence-invented-blocker",
      kind: "blocker-record",
      opportunityId: value.review.opportunityId,
      quoteId: value.review.quoteId,
      quoteRevision: value.review.quoteRevision,
      observedAt: "2026-09-10T10:22:00Z",
      suppliedByRef: value.review.quoteOwnerRef,
      subjectRefs: ["blocker-invented", value.review.id],
      sourceRecordDigest:
        "sha256:edededededededededededededededededededededededededededededededed",
      payloadDigest: null,
    });
    value.coverage.blockerRefs = ["blocker-invented"];
    value.handoff.blockerRefs = ["blocker-invented"];
    value.handoff.state = "blocked";
  }, { reseal: true });
  assertFinding(extra, "invalid_commercial_blocker_equality", "invented blocker");

  const openConflict = clone();
  openConflict.conflicts[0].status = "open";
  openConflict.conflicts[0].resolvedByApprovalRef = null;
  assert.ok(
    deriveCommercialBlockers(openConflict, { asOf: AS_OF }).some(
      (row) => row.id === "blocker-conflict-pricing-cross-revision",
    ),
  );

  const missingPricingApproval = clone();
  missingPricingApproval.approvals.find((row) => row.id === "approval-pricing-r7").status =
    "revoked";
  assert.deepEqual(
    deriveCommercialBlockers(missingPricingApproval, { asOf: AS_OF })
      .filter((row) => row.code === "threshold-exception-unapproved")
      .map((row) => row.id),
    ["blocker-exception-discount-approval", "blocker-exception-margin-approval"],
  );

  assert.deepEqual(
    deriveCommercialBlockers(fixture, { asOf: "2026-10-01T00:00:00Z" })
      .filter((row) => row.code === "quote-expired")
      .map((row) => row.id),
    [
      "blocker-finding-platform-validity",
      "blocker-finding-support-validity",
      "blocker-quote-expired",
    ],
  );
});

test("canonical products and lines are source-bound through exact payload maps and root", () => {
  for (const [label, change, expected] of [
    [
      "product payload",
      (value) => {
        value.products[0].listUnitAmount += 1;
      },
      "invalid_commercial_product_payload",
    ],
    [
      "line payload",
      (value) => {
        value.lines[0].quantity += 1;
      },
      "invalid_commercial_line_evidence",
    ],
    [
      "product source record",
      (value) => {
        value.evidence.find((row) => row.id === "evidence-product-platform").sourceRecordDigest =
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      },
      "invalid_commercial_coverage_digest",
    ],
    [
      "line payload map",
      (value) => {
        value.coverage.linePayloadDigests[0].digest =
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      },
      "invalid_commercial_coverage_digest",
    ],
    [
      "handoff payload root",
      (value) => {
        value.handoff.payloadRootDigest =
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      },
      "invalid_commercial_handoff",
    ],
  ]) {
    assertFinding(mutate(change), expected, label);
  }

  assert.equal(fixture.products[0].payloadDigest, computeProductPayloadDigest(fixture.products[0]));
  assert.equal(fixture.lines[0].payloadDigest, computeLinePayloadDigest(fixture.lines[0]));
});

test("authenticated history prevents clean approval, conflict, and edge erasure", () => {
  const erasedApproval = mutate((value) => {
    value.approvals = value.approvals.filter((row) => row.id !== "approval-pricing-r6");
    value.history.approvalRefs = value.history.approvalRefs.filter(
      (ref) => ref !== "approval-pricing-r6",
    );
    value.history.supersessionEdges = [];
  }, { reseal: true });
  assertFinding(
    erasedApproval,
    "invalid_commercial_history_binding",
    "approval deleted but authenticated history retained",
  );

  const erasedConflict = mutate((value) => {
    value.conflicts = [];
    value.history.conflictRefs = [];
    value.history.conflictEdges = [];
    value.coverage.conflictRefs = [];
    value.handoff.conflictRefs = [];
  }, { reseal: true });
  assertFinding(
    erasedConflict,
    "invalid_commercial_history_binding",
    "conflict deleted but authenticated history retained",
  );

  assertFinding(
    mutate((value) => {
      value.history.supersessionEdges = [];
    }, { reseal: true }),
    "invalid_commercial_history_binding",
    "supersession edge erased",
  );
  assertFinding(
    mutate((value) => {
      value.history.conflictEdges[0].resolvedByApprovalRef = null;
    }, { reseal: true }),
    "invalid_commercial_history_binding",
    "conflict resolution edge erased",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find(
        (row) => row.id === "evidence-input-approval-history",
      ).subjectRefs.pop();
    }),
    "invalid_commercial_history_binding",
    "history source index omission",
  );
});

test("approval-history input digest remains an immutable external trust anchor", () => {
  const originalAnchor = fixture.inputs.find(
    (row) => row.kind === "approval-history",
  ).digest;
  const tampered = clone();
  tampered.history.approvalRefs.pop();
  const resealed = resealCommercialDealDesk(tampered);
  assert.equal(
    resealed.inputs.find((row) => row.kind === "approval-history").digest,
    originalAnchor,
  );
  assert.notEqual(resealed.history.contentDigest, originalAnchor);
  assertFinding(
    resealed,
    "invalid_commercial_history_binding",
    "history payload changed beneath immutable input anchor",
  );

  const sourceTamper = mutate((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-input-approval-history",
    ).sourceRecordDigest =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  }, { reseal: true });
  assert.equal(
    sourceTamper.inputs.find((row) => row.kind === "approval-history").digest,
    originalAnchor,
  );
  assertFinding(
    sourceTamper,
    "invalid_commercial_history_binding",
    "authenticated history source digest differs from input anchor",
  );

  assertFinding(
    mutate((value) => {
      value.coverage.historySourceRecordDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_commercial_coverage_digest",
    "coverage history source digest drift",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.historyEvidenceRef = "evidence-input-quote";
    }),
    "invalid_commercial_handoff",
    "handoff history evidence drift",
  );
});

test("quote, event-evidence, decision, handoff, and trusted-asOf chronology is closed", () => {
  assertFinding(
    mutate((value) => {
      value.exceptions[0].raisedAt = "2026-09-10T09:59:59Z";
    }),
    "invalid_commercial_exception_evidence",
    "exception before quote issuance",
  );
  assertFinding(
    mutate((value) => {
      const approval = value.approvals.find((row) => row.id === "approval-legal-r7");
      approval.decidedAt = "2026-09-10T09:59:59Z";
      approval.validFrom = approval.decidedAt;
      value.evidence.find((row) => row.id === approval.evidenceRef).observedAt =
        approval.decidedAt;
    }),
    "invalid_commercial_current_approval",
    "approval before quote issuance",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-approval-legal-r7").observedAt =
        "2026-09-10T11:06:00Z";
    }),
    "invalid_commercial_approval_evidence",
    "approval evidence not at decision",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-conflict-pricing").observedAt =
        "2026-09-10T10:41:00Z";
    }),
    "invalid_commercial_conflict_evidence",
    "conflict evidence not at detection",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.handedOffAt = "2026-09-10T11:04:00Z";
      value.evidence.find((row) => row.id === "evidence-handoff").observedAt =
        value.handoff.handedOffAt;
    }, { reseal: true }),
    "invalid_commercial_current_approval",
    "handoff before approvals",
  );
  assert.ok(
    codes(fixture, { asOf: "2026-09-10T11:29:59Z" }).has(
      "invalid_commercial_handoff_state",
    ),
  );
});

test("finding, exception, and blocker evidence is reciprocal and subject-exact", () => {
  assertFinding(
    mutate((value) => {
      value.findings[0].evidenceRefs = ["evidence-missing"];
    }),
    "invalid_commercial_finding_evidence",
    "dangling finding evidence",
  );
  assertFinding(
    mutate((value) => {
      value.findings[0].evidenceRefs = ["evidence-exceptions"];
    }),
    "invalid_commercial_finding_evidence",
    "wrong-kind finding evidence",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-exceptions").subjectRefs =
        value.evidence
          .find((row) => row.id === "evidence-exceptions")
          .subjectRefs.filter((ref) => ref !== "finding-support-discount");
    }),
    "invalid_commercial_exception_evidence",
    "exception evidence missing finding subject",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-findings").subjectRefs.push(
        "approval-pricing-r7",
      );
    }),
    "invalid_commercial_finding_evidence",
    "finding evidence carries unrelated subject",
  );

  const blocked = blockedDependencyArtifact();
  blocked.blockers[0].ownerRef = "principal-seller";
  assertFinding(
    blocked,
    "invalid_commercial_blocker_equality",
    "blocker owner differs from derived owner",
  );
  const unrelated = blockedDependencyArtifact();
  unrelated.blockers[0].evidenceRefs = ["evidence-findings"];
  assertFinding(
    unrelated,
    "invalid_commercial_blocker_evidence",
    "unrelated blocker evidence",
  );
});

test("BigInt arithmetic rejects unsafe values and intermediate overflow exactly", () => {
  assert.equal(exactCommercialLineArithmetic(fixture.lines[0]), true);
  assert.equal(
    exactCommercialLineArithmetic({
      ...fixture.lines[0],
      quantity: Number.MAX_SAFE_INTEGER,
      listUnitAmount: 2,
      netUnitAmount: 2,
      unitCostAmount: 1,
      extendedListAmount: Number.MAX_SAFE_INTEGER,
      extendedNetAmount: Number.MAX_SAFE_INTEGER,
      extendedCostAmount: Number.MAX_SAFE_INTEGER,
      discountBps: 0,
      marginBps: 5000,
    }),
    false,
  );
  assert.equal(
    exactCommercialLineArithmetic({
      ...fixture.lines[0],
      quantity: Number.MAX_SAFE_INTEGER + 1,
    }),
    false,
  );

  const unsafe = mutate((value) => {
    value.lines[0].quantity = Number.MAX_SAFE_INTEGER + 1;
  });
  assert.equal(validateSchema(unsafe), false);

  assertFinding(
    mutate((value) => {
      value.lines[0].quantity = Number.MAX_SAFE_INTEGER;
      value.lines[0].listUnitAmount = 2;
      value.lines[0].netUnitAmount = 2;
      value.lines[0].unitCostAmount = 1;
      value.lines[0].extendedListAmount = Number.MAX_SAFE_INTEGER;
      value.lines[0].extendedNetAmount = Number.MAX_SAFE_INTEGER;
      value.lines[0].extendedCostAmount = Number.MAX_SAFE_INTEGER;
      value.lines[0].discountBps = 0;
      value.lines[0].marginBps = 5000;
    }),
    "invalid_commercial_line_arithmetic",
    "safe fields with overflowing multiplication",
  );
});

test("schema rejects unknown fields and authority claims", () => {
  const unknown = mutate((value) => {
    value.unexpected = true;
  });
  assert.equal(validateSchema(unknown), false);

  for (const field of [
    "negotiationClaim",
    "customerCommunicationClaim",
    "discountApprovalClaim",
    "termApprovalClaim",
    "legalConclusionClaim",
    "signatureClaim",
    "bookingClaim",
    "invoicingClaim",
    "contractModificationClaim",
    "revenueClaim",
  ]) {
    const candidate = mutate((value) => {
      value.handoff[field] = "claimed";
    });
    assert.equal(validateSchema(candidate), false, field);
  }
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
    { review: null, inputs: {}, lines: "bad", findings: [null], handoff: false },
    {
      review: {},
      inputs: [null, {}],
      principals: {},
      products: [7],
      lines: [{}],
      findings: [{}],
      exceptions: null,
      approvals: [{}],
      conflicts: [{}],
      evidence: [{}],
      coverage: null,
      blockers: {},
      handoff: {},
    },
  ]) {
    assert.doesNotThrow(() => findings(candidate));
    assert.ok(findings(candidate).length > 0);
  }
});

test("trusted asOf is mandatory and quote expiry fails closed", () => {
  assert.ok(codes(fixture, {}).has("invalid_commercial_validation_context"));
  assert.ok(codes(fixture, { asOf: "2026-09-14T12:00:00" }).has(
    "invalid_commercial_validation_context",
  ));
  assert.ok(
    codes(fixture, { asOf: "2026-10-01T00:00:00Z" }).has(
      "invalid_commercial_quote_validity",
    ),
  );
});

test("exact immutable input kind, identity, digest, validity, and evidence are enforced", () => {
  assertFinding(
    mutate((value) => {
      value.inputs.find((row) => row.kind === "price-book").kind = "product-catalog";
    }, { reseal: true }),
    "incomplete_commercial_input_coverage",
    "duplicate catalog and missing price book",
  );
  assertFinding(
    mutate((value) => {
      value.inputs[0].quoteRevision = "r6";
    }, { reseal: true }),
    "invalid_commercial_input_binding",
    "cross revision input",
  );
  assertFinding(
    mutate((value) => {
      value.inputs[0].validUntil = "2026-09-12T00:00:00Z";
    }, { reseal: true }),
    "invalid_commercial_input_validity",
    "expired input",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-input-price-book").subjectRefs = [
        "input-margin-policy",
      ];
    }),
    "invalid_commercial_input_evidence",
    "nonreciprocal source evidence",
  );
  assertFinding(
    mutate((value) => {
      value.review.inputSnapshotDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_commercial_input_digest",
    "input root drift",
  );
});

test("quote line arithmetic, currency, product, licensing, and extension drift are rejected", () => {
  for (const [label, change, expected] of [
    [
      "extended amount",
      (value) => {
        value.lines[0].extendedNetAmount += 1;
      },
      "invalid_commercial_line_arithmetic",
    ],
    [
      "discount basis points",
      (value) => {
        value.lines[1].discountBps = 2999;
      },
      "invalid_commercial_line_arithmetic",
    ],
    [
      "margin basis points",
      (value) => {
        value.lines[1].marginBps = 4001;
      },
      "invalid_commercial_line_arithmetic",
    ],
    [
      "price-book list",
      (value) => {
        value.lines[0].listUnitAmount = 10001;
      },
      "invalid_commercial_line_arithmetic",
    ],
    [
      "licensing scope",
      (value) => {
        value.lines[0].licensingRuleRefs = ["input-legal-baseline"];
      },
      "invalid_commercial_licensing_binding",
    ],
  ]) {
    assertFinding(mutate(change, { reseal: true }), expected, label);
  }
});

test("every line requires exactly one finding in all eight domains", () => {
  const missing = mutate((value) => {
    value.findings = value.findings.filter(
      (row) => row.id !== "finding-platform-configuration",
    );
    value.coverage.findingRefs = value.coverage.findingRefs.filter(
      (ref) => ref !== "finding-platform-configuration",
    );
    value.handoff.findingRefs = value.handoff.findingRefs.filter(
      (ref) => ref !== "finding-platform-configuration",
    );
  }, { reseal: true });
  assertFinding(
    missing,
    "incomplete_commercial_finding_coverage",
    "missing configuration cell",
  );

  assertFinding(
    mutate((value) => {
      value.findings.find((row) => row.id === "finding-support-discount").status =
        "conforms";
    }),
    "invalid_commercial_domain_finding",
    "threshold exception laundered as conforming",
  );
  assertFinding(
    mutate((value) => {
      value.findings.find((row) => row.id === "finding-support-legal").ruleInputRef =
        "input-licensing-rules";
    }),
    "invalid_commercial_domain_finding",
    "wrong domain rule",
  );
});

test("exception coverage is one-to-one and domain-exact", () => {
  assertFinding(
    mutate((value) => {
      value.exceptions[0].findingRef = "finding-support-margin";
    }),
    "invalid_commercial_exception_binding",
    "exception rebound to another finding",
  );
  assertFinding(
    mutate((value) => {
      value.exceptions[0].approvalDomain = "legal";
    }),
    "invalid_commercial_exception_binding",
    "discount sent to legal lane",
  );
  assertFinding(
    mutate((value) => {
      value.exceptions.pop();
      value.coverage.exceptionRefs.pop();
      value.handoff.exceptionRefs.pop();
    }, { reseal: true }),
    "incomplete_commercial_exception_coverage",
    "hidden legal exception",
  );
});

test("pricing, legal, and licensing approvals are exact, independent, and current", () => {
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-legal-r7").approverRef =
        "principal-pricing-approver";
    }),
    "invalid_commercial_current_approval",
    "wrong legal role",
  );
  const shared = mutate((value) => {
    const legal = value.principals.find((row) => row.id === "principal-legal-approver");
    legal.roles.push("licensing-approver");
    value.approvals.find((row) => row.id === "approval-licensing-r7").approverRef =
      legal.id;
    value.evidence.find((row) => row.id === "evidence-approval-licensing-r7").suppliedByRef =
      legal.id;
  });
  assertFinding(shared, "invalid_commercial_approval_independence", "shared specialist");
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-pricing-r7").quoteRevision =
        "r6";
    }),
    "invalid_commercial_current_approval",
    "replayed pricing approval",
  );
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-legal-r7").validUntil =
        "2026-09-12T00:00:00Z";
    }),
    "invalid_commercial_current_approval",
    "expired legal approval",
  );
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-licensing-r7").decision =
        "rejected";
    }),
    "invalid_commercial_current_approval",
    "rejected current approval",
  );
});

test("approval evidence and exact exception scope cannot be borrowed", () => {
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-pricing-r7").exceptionRefs = [
        "exception-discount",
      ];
    }),
    "invalid_commercial_current_approval",
    "partial pricing exception scope",
  );
  assertFinding(
    mutate((value) => {
      value.evidence.find((row) => row.id === "evidence-approval-legal-r7").suppliedByRef =
        "principal-quote-owner";
    }),
    "invalid_commercial_approval_evidence",
    "borrowed approval evidence",
  );
  assertFinding(
    mutate((value) => {
      value.exceptions.find((row) => row.id === "exception-licensing").currentApprovalRef =
        "approval-legal-r7";
    }),
    "invalid_commercial_approval_chronology",
    "cross-domain current approval",
  );
});

test("supersession and conflict chronology cannot be erased or reversed", () => {
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-pricing-r6").status = "current";
    }),
    "incomplete_commercial_approval_coverage",
    "two current pricing approvals",
  );
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-pricing-r7").supersedesRef =
        "approval-legal-r7";
    }),
    "invalid_commercial_approval_supersession",
    "cross-domain supersession",
  );
  assertFinding(
    mutate((value) => {
      value.approvals.find((row) => row.id === "approval-pricing-r7").supersedesRef =
        null;
      value.history.supersessionEdges = [];
    }, { reseal: true }),
    "invalid_commercial_approval_supersession",
    "superseded approval orphaned outside current-successor branch",
  );
  assertFinding(
    mutate((value) => {
      value.conflicts[0].detectedAt = "2026-09-10T11:02:00Z";
    }),
    "invalid_commercial_conflict_chronology",
    "conflict resolved before detection",
  );
  assertFinding(
    mutate((value) => {
      value.conflicts[0].status = "open";
      value.conflicts[0].resolvedByApprovalRef = null;
    }),
    "invalid_commercial_blocker_equality",
    "unresolved cross-revision conflict without its derived blocker",
  );
});

test("coverage, destination, readiness, and content digests fail closed", () => {
  assertFinding(
    mutate((value) => {
      value.coverage.findingRefs.pop();
    }, { reseal: true }),
    "incomplete_commercial_coverage",
    "coverage omission",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.destination = "order-readiness-review-queue";
      value.handoff.nextOwnerRef = "principal-quote-owner";
    }, { reseal: true }),
    "invalid_commercial_handoff",
    "destination owner drift",
  );
  assertFinding(
    mutate((value) => {
      value.coverage.contentDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_commercial_coverage_digest",
    "coverage digest drift",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.contentDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }),
    "invalid_commercial_handoff",
    "handoff digest drift",
  );
  assertFinding(
    mutate((value) => {
      value.handoff.state = "blocked";
    }, { reseal: true }),
    "invalid_commercial_handoff_state",
    "false blocked state",
  );
});
