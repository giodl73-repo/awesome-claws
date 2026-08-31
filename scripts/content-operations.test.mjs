import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/content-operations/schemas/publication-readiness-record.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/content-operations/fixtures/publication-readiness-record.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/content-operations/templates/publication-readiness-record.md",
    import.meta.url,
  ),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function publicationReadinessRecordFindings(",
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
  validateArtifactSemantics("content-operations", value);
const hasFinding = (value, code) =>
  findings(value).some((item) => item.code === code);

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function readyForOwnerReview() {
  const value = clone();
  value.sources.find((item) => item.id === "source-quote-consent").freshness =
    "current";
  value.claims.find((item) => item.id === "claim-design-partner-quote").state =
    "supported";
  value.brief.acceptanceCriteria.find(
    (item) => item.id === "criterion-approved-customer-quote",
  ).state = "met";
  value.assets.find((item) => item.id === "asset-launch-page").state =
    "ready-for-owner-review";
  value.reviewQuestions = [];
  value.package.state = "ready-for-owner-review";
  value.handoff.state = "ready-for-owner-review";
  value.handoff.reviewQuestionRefs = [];
  value.handoff.blockingRefs = [];
  return value;
}

function readyForPublication() {
  const value = readyForOwnerReview();
  value.approvals = [];
  for (const asset of value.assets) {
    asset.state = "approved";
    const kinds = new Set(["channel-owner"]);
    for (const claimRef of asset.claimRefs) {
      for (const kind of value.claims.find((item) => item.id === claimRef)
        .requiredApprovalKinds) {
        kinds.add(kind);
      }
    }
    for (const kind of kinds) {
      value.approvals.push({
        id: `approval-${asset.id.slice(6)}-${kind}`,
        kind,
        reviewer:
          kind === "channel-owner"
            ? value.package.channelOwner
            : `${kind} review team`,
        reviewerType: "team",
        assetRef: asset.id,
        assetVersion: asset.version,
        claimRefs: [...asset.claimRefs],
        evidenceSourceRefs:
          kind === "factual"
            ? [
                ...new Set(
                  asset.claimRefs.flatMap(
                    (claimRef) =>
                      value.claims.find((item) => item.id === claimRef)
                        .sourceRefs,
                  ),
                ),
              ]
            : [
                kind === "legal"
                  ? "source-legal-guidance"
                  : kind === "brand"
                    ? "source-brand-guide"
                    : kind === "channel-owner"
                      ? "source-channel-guide"
                      : "source-product-brief",
              ],
        decision: "approved",
        decidedAt: "2026-08-31T15:00:00-07:00",
      });
    }
  }
  value.package.state = "ready-for-publication";
  value.handoff.state = "ready-for-publication";
  value.handoff.approvalRefs = value.approvals.map((item) => item.id);
  return value;
}

test("the publication readiness fixture is schema-valid and semantically honest", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(findings(fixture), []);
});

test("the template preserves the complete readiness and authority contract", () => {
  for (const heading of [
    "## Request, owner, and deadline",
    "## Audience, channels, and acceptance criteria",
    "## Source and claim ledger",
    "## Versioned assets",
    "## Approval record",
    "## Measurement handoff",
    "## Questions, blockers, and honest state",
    "## Authority and private handoff",
  ]) {
    assert.ok(template.includes(heading), heading);
  }
});

test("owner-review and publication-ready states are representable without publishing", () => {
  const ownerReview = readyForOwnerReview();
  assertSchemaValid(ownerReview);
  assert.deepEqual(findings(ownerReview), []);

  const publicationReady = readyForPublication();
  assertSchemaValid(publicationReady);
  assert.deepEqual(findings(publicationReady), []);
  assert.ok(
    publicationReady.assets.every(
      (item) => item.publicationState === "not-published",
    ),
  );
});

test("chronology, timezone, paths, and source support are enforced", () => {
  const badDeadline = clone();
  badDeadline.package.deadline = "2026-08-30T17:00:00-07:00";
  assert.equal(hasFinding(badDeadline, "invalid_package_chronology"), true);

  const badZone = clone();
  badZone.package.timeZone = "Mars/Olympus";
  assert.equal(hasFinding(badZone, "invalid_time_zone"), true);

  const futureSource = clone();
  futureSource.sources[0].observedAt = "2026-09-01T09:00:00-07:00";
  assert.equal(hasFinding(futureSource, "future_source_evidence"), true);

  const unsafeSource = clone();
  unsafeSource.sources[0].reference = "../private.md";
  assert.equal(hasFinding(unsafeSource, "unsafe_source_reference"), true);

  const privateUrl = clone();
  privateUrl.sources[0].reference = "https://localhost/internal";
  assert.equal(hasFinding(privateUrl, "unsafe_source_reference"), true);

  const credentialUrl = clone();
  credentialUrl.sources[0].reference = "https://user:secret@example.com/brief";
  assert.equal(hasFinding(credentialUrl, "unsafe_source_reference"), true);

  const unsupported = clone();
  unsupported.sources[0].freshness = "stale";
  assert.equal(hasFinding(unsupported, "unsupported_claim_state"), true);
});

test("assets require safe paths, channel fit, bidirectional criteria, and evidence", () => {
  const unsafePath = clone();
  unsafePath.assets[0].path = "../launch.md";
  assert.equal(hasFinding(unsafePath, "unsafe_asset_path"), true);

  const channelMismatch = clone();
  unsafePath.assets[1].channel = "social";
  assert.equal(hasFinding(unsafePath, "claim_channel_mismatch"), true);

  const assetMissingCriterion = clone();
  assetMissingCriterion.assets[1].criterionRefs = [
    "criterion-supported-capabilities",
    "criterion-measurement-handoff",
  ];
  assert.equal(
    hasFinding(assetMissingCriterion, "missing_criterion_asset_coverage"),
    true,
  );

  const criterionMissingAsset = clone();
  criterionMissingAsset.brief.acceptanceCriteria[0].assetRefs = [
    "asset-launch-page",
    "asset-beta-guide",
  ];
  assert.equal(
    hasFinding(criterionMissingAsset, "missing_asset_criterion_coverage"),
    true,
  );

  const overstated = clone();
  overstated.assets[0].state = "ready-for-owner-review";
  assert.equal(hasFinding(overstated, "unsupported_asset_state"), true);
});

test("approvals bind evidence, reviewers, claims, versions, and time", () => {
  const staleVersion = clone();
  staleVersion.approvals[0].assetVersion = "v1";
  assert.equal(hasFinding(staleVersion, "invalid_approval_scope"), true);

  const pendingWithDecisionTime = clone();
  pendingWithDecisionTime.approvals[3].decidedAt =
    "2026-08-31T15:00:00-07:00";
  assert.equal(
    hasFinding(pendingWithDecisionTime, "invalid_approval_chronology"),
    true,
  );

  const futureDecision = clone();
  futureDecision.approvals[0].decidedAt = "2026-09-01T15:00:00-07:00";
  assert.equal(hasFinding(futureDecision, "future_approval_decision"), true);

  const staleEvidence = clone();
  staleEvidence.approvals[0].evidenceSourceRefs = ["source-quote-consent"];
  assert.equal(
    hasFinding(staleEvidence, "unsupported_approval_decision"),
    true,
  );

  const unrelatedEvidence = clone();
  unrelatedEvidence.approvals[1].evidenceSourceRefs = [
    "source-measurement-plan",
  ];
  assert.equal(
    hasFinding(unrelatedEvidence, "unsupported_approval_decision"),
    true,
  );

  const quoteApprovalWithoutConsent = readyForOwnerReview();
  quoteApprovalWithoutConsent.approvals[4].decision = "approved";
  quoteApprovalWithoutConsent.approvals[4].decidedAt =
    "2026-08-31T15:00:00-07:00";
  quoteApprovalWithoutConsent.approvals[4].evidenceSourceRefs = [
    "source-product-brief",
  ];
  assert.equal(
    hasFinding(
      quoteApprovalWithoutConsent,
      "unsupported_approval_decision",
    ),
    true,
  );

  const wrongChannelOwner = clone();
  wrongChannelOwner.approvals[3].reviewer = "Another team";
  assert.equal(
    hasFinding(wrongChannelOwner, "channel_owner_approval_mismatch"),
    true,
  );

  const incomplete = readyForOwnerReview();
  incomplete.assets[1].state = "approved";
  assert.equal(hasFinding(incomplete, "incomplete_asset_approval"), true);
});

test("metrics, handoff completeness, blockers, and readiness remain truthful", () => {
  const unsupportedMetric = clone();
  unsupportedMetric.metrics[0].sourceRefs = ["source-product-brief"];
  assert.equal(hasFinding(unsupportedMetric, "unsupported_metric_state"), true);

  const incomplete = clone();
  incomplete.handoff.sourceRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const missingBlocker = clone();
  missingBlocker.handoff.blockingRefs.pop();
  assert.equal(hasFinding(missingBlocker, "incomplete_blocked_handoff"), true);

  const earlyOwnerReview = clone();
  earlyOwnerReview.handoff.state = "ready-for-owner-review";
  earlyOwnerReview.package.state = "ready-for-owner-review";
  assert.equal(
    hasFinding(earlyOwnerReview, "premature_owner_review_state"),
    true,
  );

  const earlyPublication = readyForOwnerReview();
  earlyPublication.handoff.state = "ready-for-publication";
  earlyPublication.package.state = "ready-for-publication";
  assert.equal(
    hasFinding(earlyPublication, "premature_publication_ready_state"),
    true,
  );

  const inconsistent = clone();
  inconsistent.package.owner = "Different owner";
  assert.equal(hasFinding(inconsistent, "inconsistent_package_handoff"), true);
});

test("authority remains human-owned and prohibited actions stay explicit", () => {
  const agentOwner = clone();
  agentOwner.package.owner = "Content Operations Claw";
  agentOwner.handoff.owner = "Content Operations Claw";
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);

  const missingGate = clone();
  missingGate.prohibitedActions.splice(0, 1);
  assert.equal(hasFinding(missingGate, "missing_authority_gate"), true);

  const claimedPublication = clone();
  claimedPublication.brief.voice =
    "We published the launch page after completing the draft.";
  assert.equal(
    hasFinding(claimedPublication, "unauthorized_narrative_action"),
    true,
  );
});

test("every direct semantic finding code has focused coverage", () => {
  const exercised = new Set([
    "invalid_package_chronology",
    "invalid_time_zone",
    "future_source_evidence",
    "unsafe_source_reference",
    "unsupported_claim_state",
    "unsafe_asset_path",
    "unsupported_asset_state",
    "missing_asset_criterion_coverage",
    "claim_channel_mismatch",
    "missing_criterion_asset_coverage",
    "incomplete_asset_approval",
    "invalid_approval_scope",
    "invalid_approval_chronology",
    "future_approval_decision",
    "unsupported_approval_decision",
    "channel_owner_approval_mismatch",
    "unsupported_metric_state",
    "incomplete_handoff",
    "incomplete_blocked_handoff",
    "premature_owner_review_state",
    "premature_publication_ready_state",
    "inconsistent_package_handoff",
    "agent_owned_authority",
    "missing_authority_gate",
    "unauthorized_narrative_action",
  ]);
  assert.deepEqual(emittedFindingCodes, exercised);
});
