import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computeVideoConceptManifestDigest,
  computeVideoGenerationApprovalEvidence,
  computeVideoGenerationRequestDigest,
  computeVideoOutputIdentityDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/video-concept-producer/schemas/video-concept-generation-manifest.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/video-concept-producer/fixtures/video-concept-generation-manifest.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/video-concept-producer/templates/video-concept-generation-manifest.md",
    import.meta.url,
  ),
  "utf8",
);
const reference = await readFile(
  new URL(
    "../sources/video-concept-producer/references/video-concept-generation-manifest-contract.md",
    import.meta.url,
  ),
  "utf8",
);
const contribution = JSON.parse(
  await readFile(
    new URL("../contributions/video-concept-producer.json", import.meta.url),
    "utf8",
  ),
);
const catalog = JSON.parse(
  await readFile(new URL("../catalog.json", import.meta.url), "utf8"),
);
const catalogEntry = catalog.entries.find(
  (entry) => entry.id === "video-concept-producer",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = (value = fixture) => structuredClone(value);
const digest = (character) => `sha256:${character.repeat(64)}`;
const validationTime = "2026-09-01T17:01:00Z";
const semanticFindings = (value, options = {}) =>
  validateArtifactSemantics("video-concept-producer", value, {
    validationTime,
    ...options,
  });
const hasFinding = (value, code, options) =>
  semanticFindings(value, options).some((item) => item.code === code);

function provenance(suffix, issuedAt) {
  return {
    issuer: "Test evidence authority",
    system: "test-evidence-system",
    recordId: `record-${suffix}`,
    recordDigest: digest("a"),
    issuedAt,
    signature: null,
    externalRecordRef: `https://evidence.example/records/${suffix}`,
  };
}

function replaceStrings(item, replacements) {
  if (typeof item === "string") return replacements.get(item) ?? item;
  if (Array.isArray(item)) {
    return item.map((child) => replaceStrings(child, replacements));
  }
  if (!item || typeof item !== "object") return item;
  return Object.fromEntries(
    Object.entries(item).map(([key, child]) => [
      key,
      replaceStrings(child, replacements),
    ]),
  );
}

function allCoveredObjects(value) {
  const reviewFindings = value.reviewBoards.flatMap(
    (board) => board.findings ?? [],
  );
  return [
    value.manifest,
    value.providerConfiguration,
    ...value.authorityRegistry.principals,
    ...value.authorityRegistry.attestations,
    ...value.plannedInputAssets,
    ...value.assetInspectionReceipts,
    ...value.inputAssets,
    ...value.variants,
    ...value.approvalReceipts,
    ...value.preGenerationApprovals,
    ...value.generationAttempts,
    ...value.providerReceipts,
    ...value.billingReceipts,
    ...value.materializationReceipts,
    ...value.outputs,
    ...value.conceptPlans,
    ...value.concepts,
    ...value.shots,
    ...value.reviewBoards,
    ...reviewFindings,
    ...value.proposedOwnerActions,
    ...value.questions,
    ...value.blockers,
    ...value.controlPolicies,
    ...value.externalActions,
    value.handoff,
  ];
}

function refreshCoverage(value) {
  const ids = allCoveredObjects(value).map((item) => item.id);
  value.controlBindings = ids.map((objectRef) => ({
    objectRef,
    policyRef: value.manifest.controlPolicyRef,
  }));
  value.handoff.principalRefs = value.authorityRegistry.principals.map(
    (item) => item.id,
  );
  value.handoff.policyRefs = value.controlPolicies.map((item) => item.id);
  value.handoff.coveredObjectRefs = ids;
}

function refreshManifest(value) {
  const manifestDigest = computeVideoConceptManifestDigest(value);
  value.manifest.contentDigest = manifestDigest;
  value.handoff.manifestDigest = manifestDigest;
}

function refreshApproval(value, approval) {
  Object.assign(
    approval,
    computeVideoGenerationApprovalEvidence(value, approval),
  );
}

function makeProductionManifest() {
  let value = clone();
  value = replaceStrings(
    value,
    new Map([
      ["planned-role-creative-owner", "person-alice-creative"],
      ["planned-role-cost-owner", "person-carmen-cost"],
      ["planned-role-rights-safety-owner", "person-riley-rights-safety"],
      ["planned-role-review-owner", "person-reese-review"],
    ]),
  );
  value.manifest.artifactMode = "production";
  value.manifest.readiness = "ready-for-human-review";
  value.manifest.objective =
    "Produce two private abstract motion concepts under exact observed evidence and nonpublication controls.";
  value.manifest.presentationUse =
    "Private human concept review for an internal presentation.";
  value.manifest.syntheticDisclosure =
    "Synthetic abstract motion for private review.";
  value.handoff.state = "ready-for-human-review";
  value.handoff.summary =
    "Observed private generation evidence is covered for human review; publication remains unauthorized.";
  value.providerConfiguration.evidenceStatus = "observed";
  value.providerConfiguration.toolAvailability = {
    sourceSystem: "openclaw",
    sourceRecordRef: "video_generate list result test-record",
    evidenceDigest: digest("1"),
    observedAt: "2026-09-01T15:00:00Z",
    toolName: "video_generate",
    provider: "pixverse",
    model: "v6",
  };
  value.providerConfiguration.budget = {
    currency: "USD",
    cap: 12,
    reservedTotal: 8,
    actualBilledTotal: null,
    committedTotal: 8,
    remainingCapacity: 4,
    reconciliationState: "unobserved",
    additionalCreditPurchaseAllowed: false,
  };
  value.authorityRegistry.principals = [
    {
      id: "person-alice-creative",
      recordKind: "attested-human",
      name: "Alice Creative",
      type: "human",
      role: "creative-owner",
      authorityScopes: ["approve-generation", "own-private-handoff"],
      attestationRef: "authority-attestation-alice",
    },
    {
      id: "person-carmen-cost",
      recordKind: "attested-human",
      name: "Carmen Cost",
      type: "human",
      role: "cost-owner",
      authorityScopes: ["approve-generation-cost"],
      attestationRef: "authority-attestation-carmen",
    },
    {
      id: "person-riley-rights-safety",
      recordKind: "attested-human",
      name: "Riley Rights",
      type: "human",
      role: "rights-safety-owner",
      authorityScopes: [
        "approve-asset-rights",
        "approve-prompt-rights",
        "approve-prompt-safety",
        "review-rights",
        "review-safety",
      ],
      attestationRef: "authority-attestation-riley",
    },
    {
      id: "person-reese-review",
      recordKind: "attested-human",
      name: "Reese Review",
      type: "human",
      role: "review-owner",
      authorityScopes: [
        "review-editorial",
        "review-factual",
        "review-brand",
        "review-accessibility",
        "own-private-handoff",
      ],
      attestationRef: "authority-attestation-reese",
    },
  ];
  value.authorityRegistry.attestations =
    value.authorityRegistry.principals.map((principal, index) => ({
      id: principal.attestationRef,
      principalRef: principal.id,
      principalType: "human",
      role: principal.role,
      scopes: principal.authorityScopes,
      receipt: provenance(`authority-${index + 1}`, "2026-09-01T14:00:00Z"),
    }));
  value.plannedInputAssets = [];
  value.assetInspectionReceipts = [
    {
      id: "asset-inspection-radial",
      assetRef: "asset-radial-grid",
      evidenceStatus: "observed",
      sourceSystem: "workspace-asset-inspector",
      sourceRecordRef: "inspection radial",
      evidenceDigest: digest("2"),
      observedAt: "2026-09-01T15:10:00Z",
      exists: true,
      byteDigest: digest("3"),
      byteLength: 1024,
      mime: "image/png",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      geometryKind: "raster-image",
    },
    {
      id: "asset-inspection-flow",
      assetRef: "asset-flow-arcs",
      evidenceStatus: "observed",
      sourceSystem: "workspace-asset-inspector",
      sourceRecordRef: "inspection flow",
      evidenceDigest: digest("4"),
      observedAt: "2026-09-01T15:11:00Z",
      exists: true,
      byteDigest: digest("5"),
      byteLength: 2048,
      mime: "image/png",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      geometryKind: "raster-image",
    },
  ];
  const rights = (suffix) => ({
    status: "rights-cleared",
    licenseId: "license-abstract-brand-assets",
    licenseVersion: "2026.3",
    rightsScope: ["derivative-generation", "internal-presentation-review"],
    permittedTransformations: ["animation", "color-preserving-motion"],
    permittedUses: [
      "private-concept-generation",
      "internal-presentation-review",
    ],
    permittedAudience: [
      "internal-creative-team",
      "internal-leadership",
    ],
    territory: ["worldwide"],
    expiresAt: "2027-09-01T00:00:00Z",
    reviewerRef: "person-riley-rights-safety",
    reviewedAt: "2026-09-01T15:20:00Z",
    receipt: provenance(`rights-${suffix}`, "2026-09-01T15:20:00Z"),
  });
  const safetyFlags = {
    containsIdentity: false,
    containsRealPerson: false,
    containsPrivatePerson: false,
    containsBiometricData: false,
    containsCustomerData: false,
    containsSensitiveEvent: false,
    containsTrademarkedCharacter: false,
    containsConfidentialContent: false,
  };
  value.inputAssets = [
    {
      id: "asset-radial-grid",
      path: "inputs/brand/renewable/radial-grid.png",
      version: "test-radial-v1",
      ownerRef: "person-riley-rights-safety",
      classification: "internal",
      inspectionReceiptRef: "asset-inspection-radial",
      approvedSubjectTerms: ["circle", "line"],
      permittedBrandVocabulary: ["teal", "gold"],
      rights: rights("radial"),
      safetyFlags,
      controlPolicyRef: value.manifest.controlPolicyRef,
    },
    {
      id: "asset-flow-arcs",
      path: "inputs/brand/renewable/flow-arcs.png",
      version: "test-flow-v1",
      ownerRef: "person-riley-rights-safety",
      classification: "internal",
      inspectionReceiptRef: "asset-inspection-flow",
      approvedSubjectTerms: ["arc", "triangle"],
      permittedBrandVocabulary: ["blue", "green"],
      rights: rights("flow"),
      safetyFlags,
      controlPolicyRef: value.manifest.controlPolicyRef,
    },
  ];
  value.variants[0].sourceAssetRef = "asset-radial-grid";
  value.variants[1].sourceAssetRef = "asset-flow-arcs";
  for (const variant of value.variants) {
    variant.sourceEvidenceKind = "inspected-input";
  }
  const makeRequest = (variant, asset, filename) => ({
    action: "generate",
    prompt: variant.prompt,
    image: asset.path,
    model: variant.settings.model,
    durationSeconds: variant.settings.durationSeconds,
    aspectRatio: variant.settings.requestedAspectRatio,
    resolution: variant.settings.resolution,
    filename,
    timeoutMs: variant.settings.timeoutMs,
    audio: variant.settings.audio,
    providerOptions: {
      seed: variant.settings.seed,
      negativePrompt: variant.negativePrompt,
      quality: variant.settings.quality,
      motionMode: variant.settings.motionMode,
      cameraMovement: variant.settings.cameraMovement,
    },
  });
  value.generationAttempts = value.variants.map((variant, index) => {
    const request = makeRequest(
      variant,
      value.inputAssets[index],
      index === 0 ? "radial.mp4" : "flow.mp4",
    );
    return {
      id: index === 0 ? "attempt-radial-01" : "attempt-flow-01",
      kind: "initial",
      variantRef: variant.id,
      approvalRef:
        index === 0 ? "approval-radial-initial" : "approval-flow-initial",
      retryOfAttemptRef: null,
      request,
      requestDigest: computeVideoGenerationRequestDigest(request),
      invokedAt: index === 0 ? "2026-09-01T15:40:00Z" : "2026-09-01T15:41:00Z",
      completedAt:
        index === 0 ? "2026-09-01T15:45:00Z" : "2026-09-01T15:46:00Z",
      status: "succeeded",
      receiptRef:
        index === 0
          ? "provider-receipt-radial"
          : "provider-receipt-flow",
      error: null,
    };
  });
  value.preGenerationApprovals = value.variants.map((variant, index) => ({
    id: index === 0 ? "approval-radial-initial" : "approval-flow-initial",
    kind: "initial",
    variantRef: variant.id,
    attemptRef: value.generationAttempts[index].id,
    retryOfAttemptRef: null,
    generationApproverRef: "person-alice-creative",
    costApproverRef: "person-carmen-cost",
    safetyRightsReviewerRef: "person-riley-rights-safety",
    providerConfigurationRef: value.providerConfiguration.id,
    provider: "pixverse",
    region: "international",
    model: "pixverse/v6",
    modelVersion: "v6",
    termsVersion: value.providerConfiguration.termsVersion,
    retentionVersion: value.providerConfiguration.retentionVersion,
    credentialRef: value.providerConfiguration.credentialRef,
    evidenceReviewedAt:
      index === 0 ? "2026-09-01T15:30:00Z" : "2026-09-01T15:31:00Z",
    approvedAt:
      index === 0 ? "2026-09-01T15:35:00Z" : "2026-09-01T15:36:00Z",
    promptDigest: digest("0"),
    assetDigest: digest("0"),
    settingsDigest: digest("0"),
    expectedMaxCharge: variant.plannedMaxCharge,
    budgetReservation: {
      id: index === 0 ? "reservation-radial" : "reservation-flow",
      amount: 4,
      currency: "USD",
      reservedAt:
        index === 0 ? "2026-09-01T15:32:00Z" : "2026-09-01T15:33:00Z",
    },
    approvalContentDigest: digest("0"),
    receiptRef:
      index === 0 ? "approval-receipt-radial" : "approval-receipt-flow",
    decision: "approved-for-one-exact-generation",
  }));
  for (const approval of value.preGenerationApprovals) {
    refreshApproval(value, approval);
  }
  value.approvalReceipts = value.preGenerationApprovals.map(
    (approval, index) => ({
      id: approval.receiptRef,
      approvalRef: approval.id,
      approvalContentDigest: approval.approvalContentDigest,
      receipt: provenance(
        `approval-${index + 1}`,
        index === 0 ? "2026-09-01T15:35:00Z" : "2026-09-01T15:36:00Z",
      ),
    }),
  );
  value.providerReceipts = value.generationAttempts.map((attempt, index) => ({
    id: attempt.receiptRef,
    attemptRef: attempt.id,
    evidenceStatus: "observed",
    sourceSystem: "openclaw",
    sourceRecordRef: `tool result ${index + 1}`,
    evidenceDigest: index === 0 ? digest("6") : digest("7"),
    observedAt:
      index === 0 ? "2026-09-01T15:45:00Z" : "2026-09-01T15:46:00Z",
    toolName: "video_generate",
    toolCallId: index === 0 ? "tool-call-radial" : "tool-call-flow",
    task: null,
    provider: "pixverse",
    model: "v6",
    endpoint: "/video/img/generate",
    videoId: index === 0 ? 101 : 102,
    terminalStatus: 1,
    hostedUrl:
      index === 0
        ? "https://media.pixverse.ai/test-radial.mp4"
        : "https://media.pixverse.ai/test-flow.mp4",
    mime: "video/mp4",
    outputWidth: 1920,
    outputHeight: 1080,
    normalizedDurationSeconds: 6,
    ignoredOverrides: [{ key: "aspectRatio", value: "16:9" }],
  }));
  value.billingReceipts = [];
  value.outputs = value.variants.map((variant, index) => ({
    id: index === 0 ? "output-radial" : "output-flow",
    variantRef: variant.id,
    providerReceiptRef: value.providerReceipts[index].id,
    materializationReceiptRef:
      index === 0
        ? "materialization-receipt-radial"
        : "materialization-receipt-flow",
    evidenceStatus: "observed",
    delivery: "materialized-private-file",
    hostedUrl: value.providerReceipts[index].hostedUrl,
    providerVideoId: value.providerReceipts[index].videoId,
    mime: "video/mp4",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    sourceAssetRef: variant.sourceAssetRef,
    synthetic: true,
    identityDigest: digest("0"),
    controlPolicyRef: value.manifest.controlPolicyRef,
  }));
  value.materializationReceipts = value.outputs.map((output, index) => ({
    id: output.materializationReceiptRef,
    outputRef: output.id,
    providerReceiptRef: output.providerReceiptRef,
    evidenceStatus: "observed",
    sourceSystem: "approved-media-materializer",
    sourceRecordRef: `materialization ${index + 1}`,
    evidenceDigest: index === 0 ? digest("8") : digest("9"),
    materializedAt:
      index === 0 ? "2026-09-01T15:50:00Z" : "2026-09-01T15:51:00Z",
    path:
      index === 0
        ? "outputs/concepts/radial.mp4"
        : "outputs/concepts/flow.mp4",
    contentDigest: index === 0 ? digest("b") : digest("c"),
    byteLength: index === 0 ? 4096 : 8192,
    mime: "video/mp4",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    durationSeconds: 6,
    frameRate: 24,
    frameCount: 144,
    probe: {
      tool: "ffprobe",
      version: "test",
      probedAt:
        index === 0 ? "2026-09-01T15:50:00Z" : "2026-09-01T15:51:00Z",
    },
  }));
  for (const output of value.outputs) {
    output.identityDigest = computeVideoOutputIdentityDigest(output);
  }
  value.concepts = value.outputs.map((output, index) => ({
    id: index === 0 ? "concept-radial" : "concept-flow",
    variantRef: output.variantRef,
    outputRef: output.id,
    title: index === 0 ? "Observed radial concept" : "Observed flow concept",
    treatment: "Observed private abstract treatment.",
    shotRefs: [
      `shot-${index === 0 ? "radial" : "flow"}-01`,
      `shot-${index === 0 ? "radial" : "flow"}-02`,
      `shot-${index === 0 ? "radial" : "flow"}-03`,
    ],
    disclosures: {
      synthetic: "Synthetic abstract media.",
      factual: "No factual performance claim.",
      caveats: ["Private nonfinal concept."],
    },
    controlPolicyRef: value.manifest.controlPolicyRef,
  }));
  value.shots = value.concepts.flatMap((concept, conceptIndex) =>
    [0, 2, 4].map((startSeconds, index) => ({
      id: concept.shotRefs[index],
      conceptRef: concept.id,
      variantRef: concept.variantRef,
      outputRef: concept.outputRef,
      ordinal: index + 1,
      startSeconds,
      endSeconds: startSeconds + 2,
      startFrame: startSeconds * 24,
      endFrame: (startSeconds + 2) * 24 - 1,
      motion: "Observed abstract motion segment.",
      visualElements:
        conceptIndex === 0
          ? ["circle", "line", "teal", "gold"]
          : ["arc", "triangle", "blue", "green"],
      controlPolicyRef: value.manifest.controlPolicyRef,
    })),
  );
  const reviewerByDiscipline = {
    editorial: "person-reese-review",
    rights: "person-riley-rights-safety",
    factual: "person-reese-review",
    brand: "person-reese-review",
    accessibility: "person-reese-review",
    safety: "person-riley-rights-safety",
  };
  value.reviewBoards = value.outputs.map((output, outputIndex) => ({
    id: outputIndex === 0 ? "review-board-radial" : "review-board-flow",
    outputRef: output.id,
    outputIdentityDigest: output.identityDigest,
    materializedContentDigest:
      value.materializationReceipts[outputIndex].contentDigest,
    findings: [
      "editorial",
      "rights",
      "factual",
      "brand",
      "accessibility",
      "safety",
    ].map((discipline, findingIndex) => {
      const reviewedAt = `2026-09-01T16:${String(
        outputIndex * 10 + findingIndex,
      ).padStart(2, "0")}:00Z`;
      return {
        id: `finding-${outputIndex === 0 ? "radial" : "flow"}-${discipline}`,
        discipline,
        reviewerRef: reviewerByDiscipline[discipline],
        reviewedAt,
        status: "passed-nonfinal",
        summary: `Nonfinal ${discipline} review found no blocking concern.`,
        finalApprovalClaimed: false,
        receipt: provenance(
          `review-${outputIndex + 1}-${findingIndex + 1}`,
          reviewedAt,
        ),
      };
    }),
    missingDisciplines: [],
    state: "passed-nonfinal",
    finalApprovalClaimed: false,
  }));
  value.proposedOwnerActions = [];
  value.questions = [];
  value.blockers = [];
  value.controlPolicies[0].evidenceStatus = "observed";
  value.externalActions = value.generationAttempts.map((attempt, index) => ({
    id: index === 0 ? "external-action-radial" : "external-action-flow",
    kind: "approved-video-generate-call",
    attemptRef: attempt.id,
    approvalRef: attempt.approvalRef,
    toolCallId: value.providerReceipts[index].toolCallId,
    status: "observed",
  }));
  value.publication.externalUploadState = "approved-provider-inputs-only";
  refreshCoverage(value);
  refreshManifest(value);
  return value;
}

const production = makeProductionManifest();

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function assertHas(value, code, options) {
  assertSchemaValid(value);
  assert.equal(
    hasFinding(value, code, options),
    true,
    `${code}: ${JSON.stringify(semanticFindings(value, options))}`,
  );
}

test("ships a strict blocked illustrative plan with no fictional evidence", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(semanticFindings(fixture), []);
  assert.equal(fixture.manifest.artifactMode, "illustrative-fixture");
  assert.equal(fixture.manifest.readiness, "blocked");
  assert.equal(fixture.handoff.state, "blocked");
  assert.equal(fixture.variants.length, 2);
  assert.equal(fixture.conceptPlans.length, 2);
  for (const field of [
    "assetInspectionReceipts",
    "inputAssets",
    "approvalReceipts",
    "preGenerationApprovals",
    "generationAttempts",
    "providerReceipts",
    "billingReceipts",
    "materializationReceipts",
    "outputs",
    "concepts",
    "shots",
    "reviewBoards",
    "externalActions",
  ]) {
    assert.deepEqual(fixture[field], [], field);
  }
  assert.equal(fixture.providerConfiguration.budget.actualBilledTotal, null);
  assert.equal(fixture.providerConfiguration.budget.reservedTotal, 0);
});

test("accepts a complete production-shaped test vector from exposed evidence", () => {
  assertSchemaValid(production);
  assert.deepEqual(semanticFindings(production), []);
  assert.equal(
    production.providerReceipts.every(
      (receipt) =>
        receipt.videoId &&
        receipt.hostedUrl &&
        receipt.mime === "video/mp4" &&
        !("actualCharge" in receipt) &&
        !("providerRequestId" in receipt) &&
        !("providerOutputId" in receipt) &&
        !("responseDigest" in receipt),
    ),
    true,
  );
});

test("allows both variants to reuse one inspected rights-cleared input", () => {
  const shared = clone(production);
  const asset = shared.inputAssets[0];
  asset.approvedSubjectTerms = ["circle", "line", "arc", "triangle"];
  asset.permittedBrandVocabulary = ["teal", "gold", "blue", "green"];
  shared.inputAssets = [asset];
  shared.assetInspectionReceipts = [
    shared.assetInspectionReceipts.find(
      (receipt) => receipt.id === asset.inspectionReceiptRef,
    ),
  ];
  for (const [index, variant] of shared.variants.entries()) {
    variant.sourceAssetRef = asset.id;
    variant.prompt =
      "Abstract circle line arc triangle teal gold blue green motion.";
    variant.subjectDeclaration.elements = [...asset.approvedSubjectTerms];
    variant.subjectDeclaration.brandVocabulary = [
      ...asset.permittedBrandVocabulary,
    ];
    const attempt = shared.generationAttempts[index];
    attempt.request.prompt = variant.prompt;
    attempt.request.image = asset.path;
    attempt.requestDigest = computeVideoGenerationRequestDigest(attempt.request);
    const approval = shared.preGenerationApprovals[index];
    refreshApproval(shared, approval);
    shared.approvalReceipts[index].approvalContentDigest =
      approval.approvalContentDigest;
    const output = shared.outputs[index];
    output.sourceAssetRef = asset.id;
    output.identityDigest = computeVideoOutputIdentityDigest(output);
    shared.reviewBoards[index].outputIdentityDigest = output.identityDigest;
  }
  refreshCoverage(shared);
  refreshManifest(shared);
  assertSchemaValid(shared);
  assert.deepEqual(semanticFindings(shared), []);
});

test("documents the pinned provider and separate receipt boundaries", () => {
  const contractText = `${template}\n${reference}`.replace(/\s+/gu, " ");
  for (const phrase of [
    "@openclaw/pixverse-provider@2026.7.1",
    "v2026.7.1",
    "videoId",
    "hosted URL",
    "separate billing receipt",
    "separate materialization receipt",
    "illustrative only",
  ]) {
    assert.match(contractText, new RegExp(phrase, "iu"));
  }
  assert.deepEqual(contribution.entry, catalogEntry);
});

test("approval binds prompt, asset inspection, settings, actors, policy, and budget", () => {
  for (const approval of production.preGenerationApprovals) {
    assert.deepEqual(
      {
        promptDigest: approval.promptDigest,
        assetDigest: approval.assetDigest,
        settingsDigest: approval.settingsDigest,
        approvalContentDigest: approval.approvalContentDigest,
      },
      computeVideoGenerationApprovalEvidence(production, approval),
    );
  }
  const stale = clone(production);
  stale.preGenerationApprovals[0].termsVersion = "different-terms";
  refreshManifest(stale);
  assertHas(stale, "stale_pre_generation_approval");

  const renamedOutput = clone(production);
  renamedOutput.generationAttempts[0].request.filename = "renamed.mp4";
  renamedOutput.generationAttempts[0].requestDigest =
    computeVideoGenerationRequestDigest(
      renamedOutput.generationAttempts[0].request,
    );
  refreshManifest(renamedOutput);
  assertHas(renamedOutput, "stale_pre_generation_approval");

  const wrongCostOwner = clone(production);
  wrongCostOwner.preGenerationApprovals[0].costApproverRef =
    "person-alice-creative";
  refreshManifest(wrongCostOwner);
  assertHas(wrongCostOwner, "nonhuman_authority");
});

test("provider evidence requires credential-free public hosted URLs", () => {
  for (const hostedUrl of [
    "https://localhost/private.mp4",
    "https://user:password@media.pixverse.ai/private.mp4",
  ]) {
    const invalid = clone(production);
    invalid.providerReceipts[0].hostedUrl = hostedUrl;
    assertHas(invalid, "invalid_generation_evidence");
  }
});

test("schema requires immutable approval provenance beyond a recomputable hash", () => {
  const unsigned = clone(production);
  unsigned.approvalReceipts[0].receipt.signature = null;
  unsigned.approvalReceipts[0].receipt.externalRecordRef = null;
  assert.equal(validateSchema(unsigned), false);
});

test("retry requires an exact failed parent and renewed lineage", () => {
  const replay = clone(production);
  replay.generationAttempts[1].requestDigest =
    replay.generationAttempts[0].requestDigest;
  refreshManifest(replay);
  assertHas(replay, "blind_replay");

  const invalidRetry = clone(production);
  invalidRetry.generationAttempts[1].kind = "retry";
  invalidRetry.generationAttempts[1].retryOfAttemptRef =
    invalidRetry.generationAttempts[0].id;
  invalidRetry.preGenerationApprovals[1].kind = "retry";
  invalidRetry.preGenerationApprovals[1].retryOfAttemptRef =
    invalidRetry.generationAttempts[0].id;
  refreshApproval(invalidRetry, invalidRetry.preGenerationApprovals[1]);
  invalidRetry.approvalReceipts[1].approvalContentDigest =
    invalidRetry.preGenerationApprovals[1].approvalContentDigest;
  refreshManifest(invalidRetry);
  assertHas(invalidRetry, "invalid_retry_lineage");
});

test("asset inspection and materialization claims require exact receipts", () => {
  const crossedInspection = clone(production);
  crossedInspection.inputAssets[0].inspectionReceiptRef =
    "asset-inspection-flow";
  refreshManifest(crossedInspection);
  assertHas(crossedInspection, "invalid_asset_inspection");

  const badGeometry = clone(production);
  badGeometry.assetInspectionReceipts[0].width = 1000;
  badGeometry.assetInspectionReceipts[0].height = 1000;
  refreshManifest(badGeometry);
  assertHas(badGeometry, "invalid_asset_inspection");

  const falseLocalClaim = clone(production);
  falseLocalClaim.outputs[0].materializationReceiptRef = null;
  refreshManifest(falseLocalClaim);
  assertHas(falseLocalClaim, "output_metadata_mismatch");
});

test("positive prompt uses an exact allowlist while negative exclusions may name entities", () => {
  assert.match(production.variants[0].negativePrompt, /Joe Biden.*Nike.*earthquake/iu);
  const unsafe = clone(production);
  unsafe.variants[0].prompt += " Joe Biden Nike earthquake";
  refreshManifest(unsafe);
  assertHas(unsafe, "unsafe_prompt_subject");
});

test("enforces successful output, concept, review board, and shot bijections", () => {
  const missingConcept = clone(production);
  missingConcept.concepts.shift();
  refreshCoverage(missingConcept);
  refreshManifest(missingConcept);
  assertHas(missingConcept, "invalid_output_bijection");

  const orphan = clone(production);
  orphan.shots.push({
    ...orphan.shots[0],
    id: "shot-orphan-01",
  });
  refreshCoverage(orphan);
  refreshManifest(orphan);
  assertHas(orphan, "orphan_shot");
});

test("rejects AI identities across structural authority fields", () => {
  const nonhuman = clone(production);
  nonhuman.authorityRegistry.principals[3].name = "GPT Review Bot";
  refreshManifest(nonhuman);
  assertHas(nonhuman, "nonhuman_authority");
});

test("recursive secret scan catches strings nested directly in arrays", () => {
  const leaked = clone(fixture);
  leaked.conceptPlans[0].plannedBeats.push(
    "pv-live-0123456789abcdefghijklmnopqrstuv",
  );
  refreshManifest(leaked);
  assertHas(leaked, "credential_leakage");
});

test("proposal, question, and blocker owner and target references resolve", () => {
  const badOwner = clone(fixture);
  badOwner.blockers[0].ownerRef = "person-missing-owner";
  refreshManifest(badOwner);
  assertHas(badOwner, "dangling_reference");

  const badTarget = clone(fixture);
  badTarget.blockers[0].targetRefs.push("missing-target");
  refreshManifest(badTarget);
  assertHas(badTarget, "dangling_reference");
});

test("typed future proposal text cannot claim completed effects or final approval", () => {
  const completed = clone(fixture);
  completed.proposedOwnerActions.push({
    id: "proposal-review-output",
    ownerRef: "planned-role-review-owner",
    actionKind: "complete-output-review",
    statement: "The videos were published and the review was fully approved.",
    targetRefs: ["concept-plan-radial-pulse"],
    status: "proposed-not-executed",
  });
  refreshCoverage(completed);
  refreshManifest(completed);
  assertHas(completed, "unauthorized_narrative_action");
});

test("billing stays absent unless account evidence exists and reconciles exactly", () => {
  assert.equal(production.billingReceipts.length, 0);
  assert.equal(production.providerConfiguration.budget.actualBilledTotal, null);
  assert.equal(production.providerConfiguration.budget.reservedTotal, 8);

  const unsupportedActual = clone(production);
  unsupportedActual.providerConfiguration.budget.actualBilledTotal = 8;
  refreshManifest(unsupportedActual);
  assertHas(unsupportedActual, "budget_exceeded");

  const invalidNotBilled = clone(production);
  invalidNotBilled.billingReceipts.push({
    id: "billing-receipt-radial",
    attemptRef: "attempt-radial-01",
    evidenceStatus: "observed",
    sourceSystem: "pixverse-account-billing",
    sourceRecordRef: "billing test record",
    evidenceDigest: digest("d"),
    observedAt: "2026-09-01T16:30:00Z",
    chargeStatus: "not-billed",
    amount: 1,
    currency: "USD",
    usage: null,
  });
  refreshCoverage(invalidNotBilled);
  refreshManifest(invalidNotBilled);
  assertHas(invalidNotBilled, "invalid_billing_receipt");
});

test("production asOf is bounded by injectable validation time and all events", () => {
  const future = clone(production);
  future.manifest.asOf = "2026-09-02T17:00:00Z";
  future.manifest.deadline = "2026-09-03T00:00:00Z";
  refreshManifest(future);
  assertHas(future, "invalid_chronology", {
    validationTime: "2026-09-01T17:01:00Z",
  });

  const lateEvent = clone(production);
  lateEvent.providerReceipts[0].observedAt = "2026-09-01T18:00:00Z";
  refreshManifest(lateEvent);
  assertHas(lateEvent, "invalid_chronology");
});

test("authority, policy, binding, and handoff coverage reject unused records", () => {
  const unusedPrincipal = clone(production);
  unusedPrincipal.authorityRegistry.principals.push({
    id: "planned-role-unused-owner",
    recordKind: "planned-role",
    name: "Unassigned unused owner",
    type: "planned-human-role",
    role: "discipline-reviewer",
    authorityScopes: ["review-editorial"],
    attestationRef: null,
  });
  refreshCoverage(unusedPrincipal);
  refreshManifest(unusedPrincipal);
  assertHas(unusedPrincipal, "authority_coverage_mismatch");

  const unusedPolicy = clone(production);
  unusedPolicy.controlPolicies.push({
    ...unusedPolicy.controlPolicies[0],
    id: "control-unused-policy",
  });
  refreshCoverage(unusedPolicy);
  refreshManifest(unusedPolicy);
  assertHas(unusedPolicy, "control_inheritance_mismatch");
});

test("schema and semantics accept honest blocked partial failure", () => {
  const partial = clone(production);
  partial.generationAttempts[1].status = "failed";
  partial.generationAttempts[1].receiptRef = null;
  partial.generationAttempts[1].error = {
    message: "Provider generation failed.",
    retryable: true,
  };
  partial.providerReceipts = partial.providerReceipts.slice(0, 1);
  partial.outputs = partial.outputs.slice(0, 1);
  partial.materializationReceipts = partial.materializationReceipts.slice(0, 1);
  partial.concepts = partial.concepts.slice(0, 1);
  partial.shots = partial.shots.filter(
    (shot) => shot.conceptRef === "concept-radial",
  );
  partial.reviewBoards = partial.reviewBoards.slice(0, 1);
  partial.blockers = [
    {
      id: "blocker-flow-generation",
      kind: "generation-evidence",
      description: "The flow variant has a failed provider attempt and no output.",
      ownerRef: "person-alice-creative",
      targetRefs: ["attempt-flow-01", "variant-flow-transition"],
      findingRefs: [],
      questionRefs: [],
      status: "open",
    },
  ];
  partial.manifest.readiness = "blocked";
  partial.handoff.state = "blocked";
  refreshCoverage(partial);
  refreshManifest(partial);
  assertSchemaValid(partial);
  assert.deepEqual(semanticFindings(partial), []);
});

test("schema and semantics accept incomplete review only while exactly blocked", () => {
  const incomplete = clone(production);
  const board = incomplete.reviewBoards[0];
  board.findings = board.findings.filter(
    (finding) => finding.discipline !== "safety",
  );
  board.missingDisciplines = ["safety"];
  board.state = "incomplete";
  incomplete.blockers = [
    {
      id: "blocker-radial-review",
      kind: "review",
      description: "The radial output still needs its safety review.",
      ownerRef: "person-reese-review",
      targetRefs: [board.id, board.outputRef],
      findingRefs: [],
      questionRefs: [],
      status: "open",
    },
  ];
  incomplete.manifest.readiness = "blocked";
  incomplete.handoff.state = "blocked";
  refreshCoverage(incomplete);
  refreshManifest(incomplete);
  assertSchemaValid(incomplete);
  assert.deepEqual(semanticFindings(incomplete), []);

  incomplete.manifest.readiness = "ready-for-human-review";
  incomplete.handoff.state = "ready-for-human-review";
  refreshManifest(incomplete);
  assertHas(incomplete, "premature_readiness");
});

test("schema-valid dangling approval references produce findings instead of crashes", () => {
  const invalid = clone(production);
  invalid.generationAttempts[0].approvalRef = "approval-missing";
  assert.equal(
    validateSchema(invalid),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() => semanticFindings(invalid));
  assertHas(invalid, "dangling_reference");
});

test("public artifact validator executes semantic findings for schema-valid input", async () => {
  const invalid = clone(fixture);
  invalid.manifest.readiness = "ready-for-human-review";
  invalid.handoff.state = "ready-for-human-review";
  refreshManifest(invalid);
  assertSchemaValid(invalid);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `video-concept-producer-semantic-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(invalid, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "scripts", "validate-artifact.mjs"),
        "video-concept-producer",
        scratchPath,
      ],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some(
        (finding) => finding.code === "premature_readiness",
      ),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
