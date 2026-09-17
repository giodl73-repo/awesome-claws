import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptedFixture,
  failureCases,
  irreducibilityWitness,
  materializeFailureCase,
} from "./fixture-loader.mjs";
import {
  computeLineManifestDigest,
  evaluateIrreducibilityWitness,
  validateThreeWayMatch,
} from "./three-way-match.validator.mjs";

const context = Object.freeze({
  cutoffAt: acceptedFixture.review.cutoffAt,
  asOf: "2026-09-16T12:00:00Z",
});

function codes(candidate, validationContext = context) {
  return [
    ...new Set(
      validateThreeWayMatch(candidate, validationContext).map((finding) => finding.code),
    ),
  ].sort();
}

test("accepted fixture proves the bounded three-way partition", () => {
  assert.deepEqual(validateThreeWayMatch(acceptedFixture, context), []);
  assert.equal(acceptedFixture.purchaseOrderRevision.revisionNumber, 2);
  assert.equal(acceptedFixture.amendment.changes.length, 1);
  assert.deepEqual(acceptedFixture.amendment.changes[0], {
    lineRef: "po-line-cable",
    field: "quantity",
    from: "5",
    to: "4",
  });

  const serverGroup = acceptedFixture.matchGroups.find(
    (group) => group.id === "group-server-kit",
  );
  assert.equal(serverGroup.receiptLineRefs.length, 2, "split receipts");
  assert.equal(serverGroup.invoiceLineRefs.length, 2, "partial invoices");

  const cableGroup = acceptedFixture.matchGroups.find((group) => group.id === "group-cable");
  assert.ok(
    cableGroup.receiptLineRefs.some((ref) => ref.includes("return")),
    "return is explicit",
  );
  assert.ok(
    cableGroup.invoiceLineRefs.some((ref) => ref.includes("credit")),
    "credit is explicit",
  );

  assert.deepEqual(acceptedFixture.residuals, [
    {
      id: "residual-po-support",
      side: "purchase-order",
      lineRef: "po-line-support",
      poLineRef: "po-line-support",
      reasonCode: "no-receipt-or-invoice-by-cutoff",
      ownerRef: "principal-anika-shah",
      recordedAt: "2026-09-16T01:10:00Z",
    },
  ]);
  assert.equal(acceptedFixture.result.state, "accepted-for-owner-review");
});

test("all three source manifests are exact and content-sensitive", () => {
  const linesBySide = {
    "purchase-order": acceptedFixture.purchaseOrderLines,
    receipt: acceptedFixture.receiptLines,
    invoice: acceptedFixture.invoiceLines,
  };
  for (const manifest of acceptedFixture.manifests) {
    assert.deepEqual(
      [...manifest.lineRefs].sort(),
      linesBySide[manifest.side].map((line) => line.id).sort(),
    );
    assert.equal(
      manifest.lineManifestDigest,
      computeLineManifestDigest(manifest.side, linesBySide[manifest.side]),
    );
  }

  const tampered = structuredClone(acceptedFixture);
  tampered.receiptLines[0].quantity = "7";
  assert.deepEqual(codes(tampered), [
    "invalid_line_manifest",
    "invalid_result",
    "three_way_mismatch",
  ]);
});

test("every line is consumed exactly once by a group or side-specific residual", () => {
  const count = (refs, id) => refs.filter((ref) => ref === id).length;
  const consumed = {
    "purchase-order": [
      ...acceptedFixture.matchGroups.flatMap((group) => group.poLineRefs),
      ...acceptedFixture.residuals
        .filter((residual) => residual.side === "purchase-order")
        .map((residual) => residual.lineRef),
    ],
    receipt: [
      ...acceptedFixture.matchGroups.flatMap((group) => group.receiptLineRefs),
      ...acceptedFixture.residuals
        .filter((residual) => residual.side === "receipt")
        .map((residual) => residual.lineRef),
    ],
    invoice: [
      ...acceptedFixture.matchGroups.flatMap((group) => group.invoiceLineRefs),
      ...acceptedFixture.residuals
        .filter((residual) => residual.side === "invoice")
        .map((residual) => residual.lineRef),
    ],
  };
  for (const [side, lines] of Object.entries({
    "purchase-order": acceptedFixture.purchaseOrderLines,
    receipt: acceptedFixture.receiptLines,
    invoice: acceptedFixture.invoiceLines,
  })) {
    for (const line of lines) assert.equal(count(consumed[side], line.id), 1, line.id);
  }
});

test("empty receipt and invoice sources produce a residual-only review", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.receiptLines = [];
  candidate.invoiceLines = [];
  candidate.matchGroups = [];
  candidate.residuals = candidate.purchaseOrderLines.map((line, index) => ({
    id: `residual-po-empty-source-${index + 1}`,
    side: "purchase-order",
    lineRef: line.id,
    poLineRef: line.id,
    reasonCode: "no-receipt-or-invoice-by-cutoff",
    ownerRef: "principal-anika-shah",
    recordedAt: `2026-09-16T01:1${index}:00Z`,
  }));
  for (const side of ["receipt", "invoice"]) {
    const manifest = candidate.manifests.find((item) => item.side === side);
    manifest.lineRefs = [];
    manifest.lineManifestDigest = computeLineManifestDigest(side, []);
  }
  candidate.coverage.receiptLineRefs = [];
  candidate.coverage.invoiceLineRefs = [];
  candidate.coverage.groupRefs = [];
  candidate.coverage.residualRefs = candidate.residuals.map((residual) => residual.id);
  candidate.result.groupRefs = [];
  candidate.result.residualRefs = candidate.residuals.map((residual) => residual.id);

  assert.deepEqual(validateThreeWayMatch(candidate, context), []);
});

test("an exact three-way match cannot be relabeled as side residuals", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.matchGroups = candidate.matchGroups.filter((group) => group.id !== "group-cable");
  candidate.residuals.push(
    {
      id: "residual-po-cable",
      side: "purchase-order",
      lineRef: "po-line-cable",
      poLineRef: "po-line-cable",
      reasonCode: "three-way-mismatch-needs-owner-review",
      ownerRef: "principal-anika-shah",
      recordedAt: "2026-09-16T01:11:00Z",
    },
    ...candidate.receiptLines
      .filter((line) => line.poLineRef === "po-line-cable")
      .map((line, index) => ({
        id: `residual-receipt-cable-${index + 1}`,
        side: "receipt",
        lineRef: line.id,
        poLineRef: "po-line-cable",
        reasonCode: "receipt-needs-owner-review",
        ownerRef: "principal-anika-shah",
        recordedAt: `2026-09-16T01:1${index + 2}:00Z`,
      })),
    ...candidate.invoiceLines
      .filter((line) => line.poLineRef === "po-line-cable")
      .map((line, index) => ({
        id: `residual-invoice-cable-${index + 1}`,
        side: "invoice",
        lineRef: line.id,
        poLineRef: "po-line-cable",
        reasonCode: "invoice-needs-owner-review",
        ownerRef: "principal-anika-shah",
        recordedAt: `2026-09-16T01:1${index + 4}:00Z`,
      })),
  );
  candidate.coverage.groupRefs = ["group-server-kit"];
  candidate.coverage.residualRefs = candidate.residuals.map((residual) => residual.id);
  candidate.result.groupRefs = ["group-server-kit"];
  candidate.result.residualRefs = candidate.residuals.map((residual) => residual.id);

  assert.ok(codes(candidate).includes("invalid_side_residual"));
  assert.ok(codes(candidate).includes("invalid_result"));
});

test("net-zero exact receipt and invoice additions cannot be hidden as side residuals", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.receiptLines.push(
    {
      id: "receipt-line-cable-extra",
      manifestRef: "manifest-receipts-po-450",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      receiptId: "receipt-7004",
      kind: "receipt",
      quantity: "1",
      recordedAt: "2026-09-14T14:00:00Z",
      currency: "USD",
    },
    {
      id: "receipt-line-cable-extra-return",
      manifestRef: "manifest-receipts-po-450",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      receiptId: "return-7004-1",
      kind: "return",
      quantity: "-1",
      recordedAt: "2026-09-15T14:00:00Z",
      currency: "USD",
    },
  );
  candidate.invoiceLines.push(
    {
      id: "invoice-line-cable-extra",
      manifestRef: "manifest-invoices-po-450",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      invoiceId: "invoice-9004",
      kind: "invoice",
      quantity: "1",
      unitMinorUnits: "500",
      lineMinorUnits: "500",
      recordedAt: "2026-09-14T16:00:00Z",
      currency: "USD",
    },
    {
      id: "invoice-line-cable-extra-credit",
      manifestRef: "manifest-invoices-po-450",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      invoiceId: "credit-9004-1",
      kind: "credit",
      quantity: "-1",
      unitMinorUnits: "500",
      lineMinorUnits: "-500",
      recordedAt: "2026-09-15T16:00:00Z",
      currency: "USD",
    },
  );
  candidate.residuals.push(
    ...candidate.receiptLines.slice(-2).map((line, index) => ({
      id: `residual-receipt-extra-${index + 1}`,
      side: "receipt",
      lineRef: line.id,
      poLineRef: "po-line-cable",
      reasonCode: "receipt-needs-owner-review",
      ownerRef: "principal-anika-shah",
      recordedAt: `2026-09-16T01:2${index}:00Z`,
    })),
    ...candidate.invoiceLines.slice(-2).map((line, index) => ({
      id: `residual-invoice-extra-${index + 1}`,
      side: "invoice",
      lineRef: line.id,
      poLineRef: "po-line-cable",
      reasonCode: "invoice-needs-owner-review",
      ownerRef: "principal-anika-shah",
      recordedAt: `2026-09-16T01:2${index + 2}:00Z`,
    })),
  );
  for (const [side, lines] of [
    ["receipt", candidate.receiptLines],
    ["invoice", candidate.invoiceLines],
  ]) {
    const manifest = candidate.manifests.find((item) => item.side === side);
    manifest.lineRefs = lines.map((line) => line.id);
    manifest.lineManifestDigest = computeLineManifestDigest(side, lines);
  }
  candidate.coverage.receiptLineRefs = candidate.receiptLines.map((line) => line.id);
  candidate.coverage.invoiceLineRefs = candidate.invoiceLines.map((line) => line.id);
  candidate.coverage.residualRefs = candidate.residuals.map((residual) => residual.id);
  candidate.result.residualRefs = candidate.residuals.map((residual) => residual.id);

  assert.ok(codes(candidate).includes("invalid_side_residual"));
  assert.ok(codes(candidate).includes("invalid_result"));
});

test("structured failure fixtures fail closed with exact finding codes", () => {
  for (const definition of failureCases) {
    const candidate = materializeFailureCase(definition);
    assert.deepEqual(codes(candidate), [...definition.expectedCodes].sort(), definition.id);
    const findings = validateThreeWayMatch(candidate, context);
    for (const finding of findings) {
      assert.deepEqual(Object.keys(finding), ["code", "path", "message", "targetRefs"]);
      assert.equal(typeof finding.path, "string");
      assert.ok(finding.path.startsWith("/"));
    }
  }
});

test("duplicate invoice-line reuse cannot hide inside otherwise valid groups", () => {
  const definition = failureCases.find(
    (failure) => failure.id === "duplicate-invoice-line-reuse",
  );
  const findings = validateThreeWayMatch(materializeFailureCase(definition), context);
  assert.ok(
    findings.some(
      (finding) =>
        finding.code === "line_reused" &&
        finding.targetRefs.includes("invoice-line-kit-partial-1"),
    ),
  );
});

test("caller controls cutoff and validation never consults wall-clock time", () => {
  assert.ok(codes(acceptedFixture, {}).includes("invalid_validation_context"));
  assert.ok(
    codes(acceptedFixture, {
      cutoffAt: "2026-09-14T23:59:59Z",
      asOf: context.asOf,
    }).includes("invalid_validation_context"),
  );

  const afterCutoff = structuredClone(acceptedFixture);
  afterCutoff.invoiceLines[0].recordedAt = "2026-09-16T00:00:00Z";
  assert.ok(codes(afterCutoff).includes("record_after_cutoff"));
  assert.deepEqual(validateThreeWayMatch(acceptedFixture, context), []);
});

test("integer quantity and minor-unit arithmetic rejects drift without tolerances", () => {
  const fractional = structuredClone(acceptedFixture);
  fractional.purchaseOrderLines[0].quantity = "10.0";
  assert.ok(codes(fractional).includes("schema_invalid"));
  assert.ok(codes(fractional).includes("invalid_integer_arithmetic"));

  const unitDrift = structuredClone(acceptedFixture);
  unitDrift.invoiceLines[0].unitMinorUnits = "2501";
  unitDrift.invoiceLines[0].lineMinorUnits = "10004";
  assert.ok(codes(unitDrift).includes("three_way_mismatch"));
});

test("policy, revision, match, and handoff acts require typed human authority", () => {
  const selfIssued = structuredClone(acceptedFixture);
  selfIssued.authorityGrants[2].issuedByRef = "principal-maya-chen";
  assert.ok(codes(selfIssued).includes("invalid_authority_grant"));
  assert.ok(codes(selfIssued).includes("invalid_human_authority"));

  const staleGrant = structuredClone(acceptedFixture);
  staleGrant.authorityGrants[2].activeUntil = "2026-09-15T23:59:59Z";
  assert.ok(codes(staleGrant).includes("invalid_human_authority"));

  const ownerDrift = structuredClone(acceptedFixture);
  ownerDrift.review.nextOwnerRef = "principal-maya-chen";
  assert.ok(codes(ownerDrift).includes("invalid_side_residual"));
  assert.ok(codes(ownerDrift).includes("invalid_result"));
});

test("blocked results carry the exact distinct structured finding summary", () => {
  const definition = failureCases.find(
    (failure) => failure.id === "duplicate-invoice-line-reuse",
  );
  const blocked = materializeFailureCase(definition);
  blocked.result.state = "blocked";
  blocked.result.findingCodes = [
    "cross_po_line_group",
    "line_reused",
    "three_way_mismatch",
  ];
  assert.deepEqual(codes(blocked), [
    "cross_po_line_group",
    "line_reused",
    "three_way_mismatch",
  ]);

  blocked.result.findingCodes = [];
  assert.ok(codes(blocked).includes("invalid_result"));
});

test("schema exposes no fuzzy, tolerance, tax, action, or mutation escape hatch", () => {
  for (const [key, value] of [
    ["toleranceMinorUnits", "5"],
    ["fuzzyConfidence", 0.99],
    ["taxTreatment", "recoverable"],
    ["postingAction", "post"],
    ["supplierMessage", "send"],
  ]) {
    const candidate = structuredClone(acceptedFixture);
    candidate.matchingPolicy[key] = value;
    assert.ok(codes(candidate).includes("schema_invalid"), key);
  }
  assert.deepEqual(acceptedFixture.authorityClaims, {
    posting: "not-claimed",
    payment: "not-claimed",
    supplierContact: "not-claimed",
    accountingInterpretation: "not-claimed",
    taxInterpretation: "not-claimed",
    sourceMutation: "not-claimed",
  });
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const candidate of [
    null,
    undefined,
    true,
    42,
    "candidate",
    [],
    {},
    {
      review: null,
      principals: {},
      authorityGrants: "bad",
      manifests: [null],
      purchaseOrderLines: false,
      receiptLines: {},
      invoiceLines: 7,
      matchGroups: null,
      residuals: "bad",
    },
  ]) {
    assert.doesNotThrow(() => validateThreeWayMatch(candidate, context));
    assert.ok(validateThreeWayMatch(candidate, context).length > 0);
  }
});

test("pairwise financial partitions can pass while the atomic three-way partition fails", () => {
  const proof = evaluateIrreducibilityWitness(irreducibilityWitness);
  assert.deepEqual(
    {
      poReceiptAccepted: proof.poReceiptAccepted,
      poInvoiceAccepted: proof.poInvoiceAccepted,
      threeWayPartitionAccepted: proof.threeWayPartitionAccepted,
    },
    irreducibilityWitness.expected,
  );
  assert.match(proof.reason, /forbids splitting or reusing that invoice line/u);

  const malformed = structuredClone(irreducibilityWitness);
  malformed.purchaseOrderLines[0].quantity = "bad";
  assert.equal(evaluateIrreducibilityWitness(malformed).poReceiptAccepted, false);
});
