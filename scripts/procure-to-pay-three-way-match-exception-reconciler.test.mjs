import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  acceptedFixture,
  failureCases,
  irreducibilityWitness,
  materializeFailureCase,
  ownerTrustPolicy,
} from "./procure-to-pay-three-way-match-exception-reconciler-fixtures.mjs";
import {
  computeAmendmentPayloadDigest,
  computeAuthorityLedgerDigest,
  computeLineManifestDigest,
  computeMatchGroupPayloadDigest,
  computeMatchingPolicyPayloadDigest,
  computePartitionRootDigest,
  computePurchaseOrderRevisionPayloadDigest,
  evaluateIrreducibilityWitness,
  validateThreeWayMatch,
} from "./procure-to-pay-three-way-match-exception-reconciler.mjs";

const context = Object.freeze({
  cutoffAt: acceptedFixture.review.cutoffAt,
  asOf: "2026-09-16T12:00:00Z",
  ownerTrustPolicy,
});
const template = await readFile(
  new URL(
    "../sources/procure-to-pay-three-way-match-exception-reconciler/templates/procure-to-pay-three-way-match.md",
    import.meta.url,
  ),
  "utf8",
);
const visual = await readFile(
  new URL(
    "../sources/procure-to-pay-three-way-match-exception-reconciler/assets/three-way-match-review.html",
    import.meta.url,
  ),
  "utf8",
);

function codes(candidate, validationContext = context) {
  return [
    ...new Set(
      validateThreeWayMatch(candidate, validationContext).map((finding) => finding.code),
    ),
  ].sort();
}

function refreshManifest(candidate, side) {
  const lines = {
    "purchase-order": candidate.purchaseOrderLines,
    receipt: candidate.receiptLines,
    invoice: candidate.invoiceLines,
  }[side];
  const manifest = candidate.manifests.find((item) => item.side === side);
  manifest.lineRefs = lines.map((line) => line.id);
  manifest.lineManifestDigest = computeLineManifestDigest(side, lines);
  if (side === "purchase-order") {
    candidate.purchaseOrderRevision.lineManifestDigest = manifest.lineManifestDigest;
  }
}

function bindDecisionsToCurrentPayloads(candidate) {
  const manifests = new Map(
    candidate.manifests.map((manifest) => [manifest.side, manifest.lineManifestDigest]),
  );
  for (const group of candidate.matchGroups) {
    group.decision.policyRef = candidate.matchingPolicy.id;
    group.decision.policyVersion = candidate.matchingPolicy.version;
    group.decision.policyPayloadDigest = candidate.matchingPolicy.approvedPayloadDigest;
    group.decision.groupPayloadDigest = computeMatchGroupPayloadDigest(group);
    group.decision.purchaseOrderManifestDigest = manifests.get("purchase-order");
    group.decision.receiptManifestDigest = manifests.get("receipt");
    group.decision.invoiceManifestDigest = manifests.get("invoice");
  }
}

function refreshPartitionRoot(candidate) {
  candidate.result.partitionRootDigest = computePartitionRootDigest(candidate);
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
  assert.equal(acceptedFixture.result.state, "pending-owner-review");
});

test("result state is accepted only when the clean partition has no residuals", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.purchaseOrderLines = candidate.purchaseOrderLines.filter(
    (line) => line.id !== "po-line-support",
  );
  candidate.residuals = [];
  candidate.coverage.purchaseOrderLineRefs = candidate.purchaseOrderLines.map(
    (line) => line.id,
  );
  candidate.coverage.residualRefs = [];
  candidate.result.state = "accepted-for-owner-review";
  candidate.result.residualRefs = [];
  refreshManifest(candidate, "purchase-order");
  candidate.purchaseOrderRevision.approvedPayloadDigest =
    computePurchaseOrderRevisionPayloadDigest(candidate.purchaseOrderRevision);
  bindDecisionsToCurrentPayloads(candidate);
  refreshPartitionRoot(candidate);

  assert.deepEqual(validateThreeWayMatch(candidate, context), []);
});

test("X3, X4, and public owner-policy surfaces preserve the complete contract", () => {
  for (const required of [
    "{{matchingPolicy.approvedPayloadDigest}}",
    "{{purchaseOrderRevision.approvedPayloadDigest}}",
    "{{purchaseOrderLines[].sourceNativeLineId}}",
    "{{receiptLines[].reversesLineRef}}",
    "{{invoiceLines[].reversesLineRef}}",
    "{{matchGroups[].decision.groupPayloadDigest}}",
    "{{matchGroups[].decision.receiptManifestDigest}}",
    "{{result.partitionRootDigest}}",
    "{{authorityClaims.accountingInterpretation}}",
    "{{authorityClaims.receiptCreation}}",
  ]) {
    assert.ok(template.includes(required), required);
  }
  for (const required of [
    'aria-labelledby="p2p-title"',
    "Pending owner review",
    "11 / 11",
    "split receipts 6 + 4",
    "exact return lineage",
    "exact credit lineage",
    "outputs/procure-to-pay-three-way-match.md",
    "new URLSearchParams(window.location.search).get(\"scoutTheme\")",
    "--cp-accent",
    "var(--cp-bg)",
  ]) {
    assert.ok(visual.includes(required), required);
  }
  assert.equal(
    ownerTrustPolicy.schemaVersion,
    "awesomeClaws.procureToPayOwnerTrustPolicy.v1",
  );
  assert.equal(ownerTrustPolicy.sourceTrustRoots.length, 3);
  assert.equal(ownerTrustPolicy.matchingPolicy.tolerancesPermitted, false);
  assert.equal(ownerTrustPolicy.validation.wallClockFallbackPermitted, false);
  assert.equal(
    ownerTrustPolicy.authority.authorityLedgerDigest,
    computeAuthorityLedgerDigest(
      acceptedFixture.principals,
      acceptedFixture.authorityGrants,
    ),
  );
});

test("public artifact CLI validates the exact fixture with owner policy and caller time", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-artifact.mjs",
      "procure-to-pay-three-way-match-exception-reconciler",
      "claws/procure-to-pay-three-way-match-exception-reconciler/fixtures/procure-to-pay-three-way-match.example.json",
      "--as-of",
      context.asOf,
      "--p2p-cutoff-at",
      context.cutoffAt,
      "--p2p-owner-policy",
      "claws/procure-to-pay-three-way-match-exception-reconciler/fixtures/owner-trust-policy.example.json",
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test("human approvals and handoff bind exact immutable payloads", () => {
  assert.equal(
    acceptedFixture.matchingPolicy.approvedPayloadDigest,
    computeMatchingPolicyPayloadDigest(acceptedFixture.matchingPolicy),
  );
  assert.equal(
    acceptedFixture.amendment.approvedPayloadDigest,
    computeAmendmentPayloadDigest(acceptedFixture.amendment),
  );
  assert.equal(
    acceptedFixture.purchaseOrderRevision.approvedPayloadDigest,
    computePurchaseOrderRevisionPayloadDigest(acceptedFixture.purchaseOrderRevision),
  );
  for (const group of acceptedFixture.matchGroups) {
    assert.equal(group.decision.groupPayloadDigest, computeMatchGroupPayloadDigest(group));
  }
  assert.equal(
    acceptedFixture.result.partitionRootDigest,
    computePartitionRootDigest(acceptedFixture),
  );
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

test("owner source line identity is opaque, exact, and unique per manifest", () => {
  const linesBySide = {
    "purchase-order": acceptedFixture.purchaseOrderLines,
    receipt: acceptedFixture.receiptLines,
    invoice: acceptedFixture.invoiceLines,
  };
  for (const manifest of acceptedFixture.manifests) {
    const identities = linesBySide[manifest.side].map((line) =>
      JSON.stringify([line.sourceSystemRef, line.exportRef, line.sourceNativeLineId]),
    );
    assert.equal(new Set(identities).size, identities.length);
    assert.ok(linesBySide[manifest.side].every((line) => line.sourceSystemRef.includes("://")));
    assert.ok(
      linesBySide[manifest.side].every((line) => /[/@#]/u.test(line.sourceNativeLineId)),
    );
  }
});

test("row splitting cannot duplicate one owner source identity after resealing", () => {
  const candidate = structuredClone(acceptedFixture);
  const original = candidate.receiptLines.find(
    (line) => line.id === "receipt-line-kit-partial-1",
  );
  original.quantity = "3";
  candidate.receiptLines.push({
    ...structuredClone(original),
    id: "receipt-line-kit-split-shadow",
    quantity: "3",
  });
  const group = candidate.matchGroups.find((item) => item.id === "group-server-kit");
  group.receiptLineRefs.push("receipt-line-kit-split-shadow");
  candidate.coverage.receiptLineRefs.push("receipt-line-kit-split-shadow");
  refreshManifest(candidate, "receipt");
  bindDecisionsToCurrentPayloads(candidate);
  refreshPartitionRoot(candidate);

  assert.deepEqual(codes(candidate), [
    "duplicate_source_line_identity",
    "invalid_result",
  ]);
});

test("returns and credits require exact prior source-line bindings", () => {
  const beforeSource = structuredClone(acceptedFixture);
  const returnLine = beforeSource.receiptLines.find(
    (line) => line.id === "receipt-line-cable-return",
  );
  returnLine.recordedAt = "2026-09-10T13:59:59Z";
  refreshManifest(beforeSource, "receipt");
  bindDecisionsToCurrentPayloads(beforeSource);
  refreshPartitionRoot(beforeSource);
  assert.deepEqual(codes(beforeSource), ["invalid_result", "invalid_reversal"]);

  const wrongUnit = structuredClone(acceptedFixture);
  const creditLine = wrongUnit.invoiceLines.find(
    (line) => line.id === "invoice-line-cable-credit",
  );
  creditLine.unitOfMeasure = "BOX";
  refreshManifest(wrongUnit, "invoice");
  bindDecisionsToCurrentPayloads(wrongUnit);
  refreshPartitionRoot(wrongUnit);
  assert.ok(codes(wrongUnit).includes("invalid_reversal"));
  assert.ok(codes(wrongUnit).includes("three_way_mismatch"));
});

test("an invalid reversal is representable only through residuals", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.invoiceLines.find(
    (line) => line.id === "invoice-line-cable-credit",
  ).reversesLineRef = "invoice-line-missing";
  candidate.matchGroups = candidate.matchGroups.filter((group) => group.id !== "group-cable");
  candidate.residuals.push(
    {
      id: "residual-po-cable-reversal",
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
        id: `residual-receipt-reversal-${index + 1}`,
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
        id: `residual-invoice-reversal-${index + 1}`,
        side: "invoice",
        lineRef: line.id,
        poLineRef: "po-line-cable",
        reasonCode: "invoice-needs-owner-review",
        ownerRef: "principal-anika-shah",
        recordedAt: `2026-09-16T01:1${index + 4}:00Z`,
      })),
  );
  refreshManifest(candidate, "invoice");
  candidate.coverage.groupRefs = ["group-server-kit"];
  candidate.coverage.residualRefs = candidate.residuals.map((residual) => residual.id);
  candidate.result.groupRefs = ["group-server-kit"];
  candidate.result.residualRefs = candidate.residuals.map((residual) => residual.id);
  bindDecisionsToCurrentPayloads(candidate);
  refreshPartitionRoot(candidate);

  assert.deepEqual(validateThreeWayMatch(candidate, context), []);
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
  refreshPartitionRoot(candidate);

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
  refreshPartitionRoot(candidate);

  assert.ok(codes(candidate).includes("invalid_side_residual"));
  assert.ok(codes(candidate).includes("invalid_result"));
});

test("net-zero exact receipt and invoice additions cannot be hidden as side residuals", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.receiptLines.push(
    {
      id: "receipt-line-cable-extra",
      manifestRef: "manifest-receipts-po-450",
      sourceSystemRef: "WMS://Receiving/DC-04",
      exportRef: "RCV-PO450@2026-09-15T235959Z",
      sourceNativeLineId: "RCV7004/20",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      receiptId: "receipt-7004",
      kind: "receipt",
      reversesLineRef: null,
      unitOfMeasure: "EA",
      quantity: "1",
      recordedAt: "2026-09-14T14:00:00Z",
      currency: "USD",
    },
    {
      id: "receipt-line-cable-extra-return",
      manifestRef: "manifest-receipts-po-450",
      sourceSystemRef: "WMS://Receiving/DC-04",
      exportRef: "RCV-PO450@2026-09-15T235959Z",
      sourceNativeLineId: "RTN7004/20/1",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      receiptId: "return-7004-1",
      kind: "return",
      reversesLineRef: "receipt-line-cable-extra",
      unitOfMeasure: "EA",
      quantity: "-1",
      recordedAt: "2026-09-15T14:00:00Z",
      currency: "USD",
    },
  );
  candidate.invoiceLines.push(
    {
      id: "invoice-line-cable-extra",
      manifestRef: "manifest-invoices-po-450",
      sourceSystemRef: "AP://Invoices/Tenant-7",
      exportRef: "AP-PO450@2026-09-15T235959Z",
      sourceNativeLineId: "INV9004/1",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      invoiceId: "invoice-9004",
      kind: "invoice",
      reversesLineRef: null,
      unitOfMeasure: "EA",
      quantity: "1",
      unitMinorUnits: "500",
      lineMinorUnits: "500",
      recordedAt: "2026-09-14T16:00:00Z",
      currency: "USD",
    },
    {
      id: "invoice-line-cable-extra-credit",
      manifestRef: "manifest-invoices-po-450",
      sourceSystemRef: "AP://Invoices/Tenant-7",
      exportRef: "AP-PO450@2026-09-15T235959Z",
      sourceNativeLineId: "CR9004/1",
      poLineRef: "po-line-cable",
      purchaseOrderRevisionRef: "po-450-r2",
      invoiceId: "credit-9004-1",
      kind: "credit",
      reversesLineRef: "invoice-line-cable-extra",
      unitOfMeasure: "EA",
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
  bindDecisionsToCurrentPayloads(candidate);
  refreshPartitionRoot(candidate);

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
      ownerTrustPolicy,
    }).includes("invalid_validation_context"),
  );

  const afterCutoff = structuredClone(acceptedFixture);
  afterCutoff.invoiceLines[0].recordedAt = "2026-09-16T00:00:00Z";
  assert.ok(codes(afterCutoff).includes("record_after_cutoff"));
  for (const invalidTime of [
    "2026-09-31T12:00:00Z",
    "2026-09-16T24:00:00Z",
  ]) {
    assert.ok(
      codes(acceptedFixture, {
        ...context,
        asOf: invalidTime,
      }).includes("invalid_validation_context"),
      invalidTime,
    );
  }
  assert.deepEqual(validateThreeWayMatch(acceptedFixture, context), []);
});

test("public owner trust policy is required and target-bound", () => {
  assert.ok(
    codes(acceptedFixture, {
      cutoffAt: context.cutoffAt,
      asOf: context.asOf,
    }).includes("invalid_owner_trust_policy"),
  );
  const drifted = structuredClone(ownerTrustPolicy);
  drifted.sourceTrustRoots[1].exportRef = "RCV-OTHER";
  assert.ok(
    codes(acceptedFixture, {
      ...context,
      ownerTrustPolicy: drifted,
    }).includes("invalid_owner_trust_policy"),
  );
  for (const mutate of [
    (policy) => {
      policy.allowFuzzyMatching = true;
    },
    (policy) => {
      policy.matchingPolicy.allowFuzzyMatching = true;
    },
    (policy) => {
      policy.authority.agentMayApprove = true;
    },
    (policy) => {
      policy.sourceTrustRoots[0].agentMayMutate = true;
    },
  ]) {
    const extended = structuredClone(ownerTrustPolicy);
    mutate(extended);
    assert.ok(
      codes(acceptedFixture, {
        ...context,
        ownerTrustPolicy: extended,
      }).includes("invalid_owner_trust_policy"),
    );
  }

  const selfAttested = structuredClone(acceptedFixture);
  selfAttested.principals[0].name = "Forged Authority Issuer";
  refreshPartitionRoot(selfAttested);
  assert.ok(codes(selfAttested).includes("invalid_owner_trust_policy"));
});

test("every authority grant has a valid interval even when unused", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.authorityGrants.push({
    ...structuredClone(candidate.authorityGrants[2]),
    id: "grant-unused-match-review",
    issuedAt: "2026-09-02T00:00:00Z",
    activeFrom: "2026-09-01T00:00:00Z",
  });
  refreshPartitionRoot(candidate);
  const trustedPolicy = structuredClone(ownerTrustPolicy);
  trustedPolicy.authority.authorityLedgerDigest = computeAuthorityLedgerDigest(
    candidate.principals,
    candidate.authorityGrants,
  );

  assert.ok(
    codes(candidate, {
      ...context,
      ownerTrustPolicy: trustedPolicy,
    }).includes("invalid_authority_grant"),
  );
});

test("current-revision source rows cannot predate revision approval", () => {
  for (const side of ["receipt", "invoice"]) {
    const candidate = structuredClone(acceptedFixture);
    const lines =
      side === "receipt" ? candidate.receiptLines : candidate.invoiceLines;
    lines[0].recordedAt = "2026-09-02T15:59:59Z";
    refreshManifest(candidate, side);
    bindDecisionsToCurrentPayloads(candidate);
    refreshPartitionRoot(candidate);

    const findings = validateThreeWayMatch(candidate, context);
    assert.ok(
      findings.some(
        (finding) =>
          finding.code === "invalid_source_revision" &&
          finding.path === `/${side}Lines/0`,
      ),
      side,
    );
  }
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

test("approved payloads and decision bindings reject replay after derived resealing", () => {
  const policyReplay = structuredClone(acceptedFixture);
  policyReplay.matchingPolicy.version = "v2";
  refreshPartitionRoot(policyReplay);
  assert.ok(codes(policyReplay).includes("invalid_policy_approval_digest"));
  assert.ok(codes(policyReplay).includes("invalid_match_decision_binding"));

  const amendmentReplay = structuredClone(acceptedFixture);
  amendmentReplay.amendment.changes[0].from = "6";
  refreshPartitionRoot(amendmentReplay);
  assert.ok(codes(amendmentReplay).includes("invalid_amendment_approval_digest"));

  const quantityReplay = structuredClone(acceptedFixture);
  const supportLine = quantityReplay.purchaseOrderLines.find(
    (line) => line.id === "po-line-support",
  );
  supportLine.quantity = "3";
  supportLine.extendedMinorUnits = "4500";
  refreshManifest(quantityReplay, "purchase-order");
  bindDecisionsToCurrentPayloads(quantityReplay);
  refreshPartitionRoot(quantityReplay);
  assert.ok(codes(quantityReplay).includes("invalid_revision_approval_digest"));

  const decisionReplay = structuredClone(acceptedFixture);
  decisionReplay.matchGroups[0].decision.policyVersion = "v2";
  refreshPartitionRoot(decisionReplay);
  assert.ok(codes(decisionReplay).includes("invalid_match_decision_binding"));

  const grantReplay = structuredClone(acceptedFixture);
  grantReplay.authorityGrants[2].currency = "EUR";
  refreshPartitionRoot(grantReplay);
  assert.ok(codes(grantReplay).includes("invalid_authority_grant"));
  assert.ok(codes(grantReplay).includes("invalid_human_authority"));

  const grantRevisionReplay = structuredClone(acceptedFixture);
  grantRevisionReplay.authorityGrants[2].revisionRef = "po-450-r1";
  refreshPartitionRoot(grantRevisionReplay);
  assert.ok(codes(grantRevisionReplay).includes("invalid_authority_grant"));
  assert.ok(codes(grantRevisionReplay).includes("invalid_human_authority"));

  const handoffReplay = structuredClone(acceptedFixture);
  handoffReplay.result.partitionRootDigest =
    "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  assert.ok(codes(handoffReplay).includes("invalid_partition_root"));
});

test("blocked empty partitions cannot predate manifests or other prerequisites", () => {
  const candidate = structuredClone(acceptedFixture);
  candidate.matchGroups = [];
  candidate.residuals = [];
  candidate.coverage.groupRefs = [];
  candidate.coverage.residualRefs = [];
  candidate.result.state = "blocked";
  candidate.result.groupRefs = [];
  candidate.result.residualRefs = [];
  candidate.result.findingCodes = ["line_omitted"];
  candidate.result.generatedAt = "2026-09-15T12:00:00Z";
  refreshPartitionRoot(candidate);

  const findings = validateThreeWayMatch(candidate, context);
  assert.ok(findings.some((finding) => finding.code === "line_omitted"));
  assert.ok(
    findings.some(
      (finding) => finding.code === "invalid_result" && finding.path === "/result",
    ),
  );
});

test("blocked results carry the exact distinct structured finding summary", () => {
  const definition = failureCases.find(
    (failure) => failure.id === "duplicate-invoice-line-reuse",
  );
  const blocked = materializeFailureCase(definition);
  blocked.result.state = "blocked";
  refreshPartitionRoot(blocked);
  blocked.result.findingCodes = [
    "cross_po_line_group",
    "invalid_match_decision_binding",
    "line_reused",
    "three_way_mismatch",
  ];
  assert.deepEqual(codes(blocked), [
    "cross_po_line_group",
    "invalid_match_decision_binding",
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
    receiptCreation: "not-claimed",
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
