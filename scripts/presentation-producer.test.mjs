import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  computePresentationApprovalContentDigest,
  computePresentationContentQaDigest,
  computePresentationTemplateInventoryDigest,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/presentation-producer/schemas/presentation-evidence-manifest.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/presentation-producer/fixtures/presentation-evidence-manifest.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/presentation-producer/templates/presentation-evidence-manifest.md",
    import.meta.url,
  ),
  "utf8",
);
const reference = await readFile(
  new URL(
    "../sources/presentation-producer/references/presentation-evidence-manifest-contract.md",
    import.meta.url,
  ),
  "utf8",
);
const catalog = JSON.parse(
  await readFile(new URL("../catalog.json", import.meta.url), "utf8"),
);
const contribution = JSON.parse(
  await readFile(
    new URL("../contributions/presentation-producer.json", import.meta.url),
    "utf8",
  ),
);
const catalogEntry = catalog.entries.find(
  (entry) => entry.id === "presentation-producer",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function presentationEvidenceManifestFindings(",
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
  validateArtifactSemantics("presentation-producer", value);
const hasFinding = (value, code) =>
  findings(value).some((item) => item.code === code);

function refreshApprovalIntegrity(value) {
  value.manifest.contentDigest =
    computePresentationApprovalContentDigest(value);
  for (const approval of value.approvals) {
    approval.contentDigest = value.manifest.contentDigest;
  }
}

function refreshContentQaIntegrity(value) {
  value.contentQa.contentDigest = computePresentationContentQaDigest(
    value.contentQa,
  );
  for (const approval of value.approvals) {
    approval.contentQaDigest = value.contentQa.contentDigest;
  }
  refreshApprovalIntegrity(value);
}

function refreshTemplateIntegrity(value) {
  value.deck.templateInventory.inventoryDigest =
    computePresentationTemplateInventoryDigest(value.deck.templateInventory);
  value.deck.preservation.templateInventoryDigest =
    value.deck.templateInventory.inventoryDigest;
  value.deck.preservation.templateInventoryVersion =
    value.deck.templateInventory.version;
  refreshApprovalIntegrity(value);
}

function assertHas(value, code) {
  assert.equal(
    hasFinding(value, code),
    true,
    `${code}: ${JSON.stringify(findings(value))}`,
  );
}

test("presentation producer ships a strict valid exact-version X3 manifest", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.schemaVersion, "awesomeClaws.presentationEvidenceManifest.v1");
  assert.equal(fixture.slides.length, 12);
  assert.equal(
    fixture.renderSets.every((set) => set.renderedSlides.length === 12),
    true,
  );
  assert.equal(fixture.renderSets[0].status, "failed");
  assert.equal(fixture.renderSets.at(-1).status, "passed");
  assert.equal(fixture.visualQaFindings.some((item) => item.status === "fixed"), true);
  assert.equal(fixture.deck.reviewCopy.primaryDeliverable, true);
  assert.equal(fixture.handoff.output.deliveryState, "not-delivered");

  const duplicateSlideModel = clone();
  duplicateSlideModel.slides[0].body = {
    textRuns: ["This would duplicate PowerPoint runtime state."],
  };
  assert.equal(validateSchema(duplicateSlideModel), false);
});

test("presentation package preserves the PPTX-primary sidecar contract", () => {
  for (const phrase of [
    "PPTX is the primary deliverable",
    "does not duplicate PowerPoint object state",
    "exact review-copy",
    "later full-deck rerender",
    "cycle-safe",
    "not delivered",
    "illustrative manifest evidence only",
  ]) {
    assert.match(`${template}\n${reference}`, new RegExp(phrase, "iu"));
  }
  for (const heading of [
    "## Request, audience, setting, and owners",
    "## Immutable authorized inputs",
    "## Source, template, and review-copy identity",
    "## Exact 12-slide inventory",
    "## Material claims and evidence",
    "## Citations and approved speaker notes",
    "## Full-deck render and visual QA history",
    "## Content extraction and placeholder QA",
    "## Exact-version review approval",
    "## Caveats, questions, blockers, and private handoff",
  ]) {
    assert.ok(template.includes(heading), heading);
  }
  assert.deepEqual(contribution.entry, catalogEntry);
  assert.ok(
    catalogEntry.resources.some(
      (item) =>
        item.path === "schemas/presentation-evidence-manifest.schema.json" &&
        item.role === "schema",
    ),
  );
  assert.match(
    catalogEntry.capabilityGuidance.join(" "),
    /does not include or claim to have created a real PPTX/iu,
  );
});

test("source and template identities cannot alias or mutate into the output", () => {
  const samePath = clone();
  samePath.deck.reviewCopy.path = samePath.deck.sourceDeck.path;
  samePath.manifest.outputPaths.deck = samePath.deck.sourceDeck.path;
  samePath.handoff.deckPath = samePath.deck.sourceDeck.path;
  assertHas(samePath, "source_preservation_failure");

  const sameDigest = clone();
  sameDigest.deck.reviewCopy.digest = sameDigest.deck.sourceDeck.digest;
  assertHas(sameDigest, "source_preservation_failure");

  const sourceMutation = clone();
  sourceMutation.deck.sourceDeck.digest =
    "sha256:abababababababababababababababababababababababababababababababab";
  assertHas(sourceMutation, "source_preservation_failure");

  const templateMutation = clone();
  templateMutation.deck.templateDeck.version = "unapproved-v2";
  assertHas(templateMutation, "source_preservation_failure");
});

test("slide order, material claim coverage, and exact citations are enforced", () => {
  const wrongOrder = clone();
  [wrongOrder.slides[1], wrongOrder.slides[2]] = [
    wrongOrder.slides[2],
    wrongOrder.slides[1],
  ];
  assertHas(wrongOrder, "invalid_slide_inventory");

  const wrongCount = clone();
  wrongCount.slides.pop();
  assertHas(wrongCount, "invalid_slide_inventory");

  const missingClaimCoverage = clone();
  missingClaimCoverage.slides[1].claimRefs = [];
  missingClaimCoverage.slides[1].citationRefs = [];
  assertHas(missingClaimCoverage, "unsupported_claim");

  const wrongCitationVersion = clone();
  wrongCitationVersion.citations[0].sourceVersion = "2026-q1";
  assertHas(wrongCitationVersion, "invalid_citation_binding");
});

test("claims preserve current authority, epistemic type, and human decisions", () => {
  const staleSource = clone();
  staleSource.sourceUseAssessments.find(
    (item) => item.id === "assessment-claim-q2-revenue",
  ).freshnessStatus = "stale";
  assertHas(staleSource, "invalid_source_use_assessment");
  assertHas(staleSource, "unsupported_claim");

  const unauthorizedSource = clone();
  unauthorizedSource.sources[0].authority = "asset-rights-owner";
  assertHas(unauthorizedSource, "stale_or_unauthorized_source");
  assertHas(unauthorizedSource, "unsupported_claim");

  const assumptionRelabeledObserved = clone();
  assumptionRelabeledObserved.claims.find(
    (item) => item.id === "claim-retention-risk",
  ).epistemicType = "observed";
  assertHas(assumptionRelabeledObserved, "invalid_claim_epistemic_state");

  const agentDecisionOwner = clone();
  agentDecisionOwner.manifest.decisionOwner = {
    id: "person-presentation-producer",
    name: "Presentation producer",
    type: "human",
  };
  assertHas(agentDecisionOwner, "agent_owned_authority");
  assertHas(agentDecisionOwner, "invalid_claim_epistemic_state");
});

test("citations and notes cannot leak hidden comments or source notes", () => {
  const commentCopied = clone();
  commentCopied.citations[0].includesCommentContent = true;
  assertHas(commentCopied, "hidden_content_exposure");

  const hiddenNoteCopied = clone();
  hiddenNoteCopied.speakerNotes[0].hiddenSourceContentIncluded = true;
  assertHas(hiddenNoteCopied, "hidden_content_exposure");

  const publicNote = clone();
  publicNote.speakerNotes[0].approvedAudienceScope = ["public"];
  assertHas(publicNote, "hidden_content_exposure");
});

test("every slide render and honest fix-rerender visual QA are required", () => {
  const missingRender = clone();
  missingRender.renderSets.at(-1).renderedSlides.pop();
  assertHas(missingRender, "incomplete_visual_qa");

  for (const field of [
    "overflow",
    "clipping",
    "contrast",
    "placeholders",
    "citationCollision",
  ]) {
    const falsePass = clone();
    falsePass.renderSets.at(-1).renderedSlides[0].checks[field] = "failed";
    assertHas(falsePass, "failed_visual_qa");
  }

  const noFixCycle = clone();
  noFixCycle.renderSets[0].status = "passed";
  assertHas(noFixCycle, "missing_fix_rerender_cycle");

  const dishonestFix = clone();
  dishonestFix.visualQaFindings[0].fixedInRenderRef = "render-slide-07-v1";
  assertHas(dishonestFix, "invalid_visual_qa_finding");
});

test("content QA and exact deck approval cannot be stale or early", () => {
  const leftoverPlaceholder = clone();
  leftoverPlaceholder.contentQa.leftoverPlaceholders = ["Lorem ipsum"];
  assertHas(leftoverPlaceholder, "incomplete_content_qa");

  const missingTextCoverage = clone();
  missingTextCoverage.contentQa.slideRefs.pop();
  assertHas(missingTextCoverage, "incomplete_content_qa");

  const staleApproval = clone();
  staleApproval.approvals[0].deckDigest =
    "sha256:9999999999999999999999999999999999999999999999999999999999999999";
  assertHas(staleApproval, "stale_approval");

  const approvalBeforeFinalRenderReview = clone();
  approvalBeforeFinalRenderReview.approvals[0].approvedAt =
    "2026-09-01T18:45:00Z";
  assertHas(approvalBeforeFinalRenderReview, "invalid_approval_chronology");

  const blanketApproval = clone();
  blanketApproval.approvals[0].scope = "all-decks";
  assertHas(blanketApproval, "invalid_approval_scope");
});

test("handoff, blockers, controls, and authority gates remain exact", () => {
  const incompleteHandoff = clone();
  incompleteHandoff.handoff.sourceRefs.pop();
  assertHas(incompleteHandoff, "incomplete_handoff");

  const missingBlockerQuestion = clone();
  missingBlockerQuestion.blockers[0].questionRefs = [];
  assertHas(missingBlockerQuestion, "incomplete_blocker_coverage");

  const premature = clone();
  premature.manifest.state = "ready-for-human-review";
  premature.handoff.state = "ready-for-human-review";
  assertHas(premature, "premature_readiness");

  const classificationLaundering = clone();
  classificationLaundering.controlPolicies.find(
    (item) => item.id === "control-derived-review",
  ).classification = "internal";
  assertHas(classificationLaundering, "control_inheritance_mismatch");

  const audienceLaundering = clone();
  audienceLaundering.controlPolicies.find(
    (item) => item.id === "control-derived-review",
  ).audienceScope = ["presentation-production"];
  assertHas(audienceLaundering, "control_inheritance_mismatch");

  const missingGate = clone();
  missingGate.prohibitedActions.pop();
  assertHas(missingGate, "missing_authority_gate");

  const delivered = clone();
  delivered.handoff.output.deliveryState = "delivered";
  assertHas(delivered, "unsafe_output_state");
});

test("narrative scanner rejects completed actions but excludes the request", () => {
  const passiveViolation = clone();
  passiveViolation.handoff.summary =
    "The deck was distributed and the source presentation was overwritten.";
  assertHas(passiveViolation, "unauthorized_narrative_action");

  const completedReview = clone();
  completedReview.handoff.summary = "The review was completed.";
  assertHas(completedReview, "unauthorized_narrative_action");

  const verbatimRequest = clone();
  verbatimRequest.manifest.verbatimRequest =
    "The deck was distributed last quarter; create a new private review copy without distribution.";
  refreshApprovalIntegrity(verbatimRequest);
  assert.deepEqual(findings(verbatimRequest), []);

  const proposedOwnerAction = clone();
  proposedOwnerAction.speakerNotes[11].contentSummary =
    "Proposed owner action: reviewer to inspect the deck after we published it.";
  assertHas(proposedOwnerAction, "unauthorized_narrative_action");
});

test("approval digest binds claims, slide content, renders, and content QA", () => {
  const changedClaim = clone();
  changedClaim.claims[0].statement = "Changed material claim.";
  assertHas(changedClaim, "stale_approval");

  const changedTitle = clone();
  changedTitle.slides[1].title = "Changed material title";
  assertHas(changedTitle, "invalid_slide_inventory");
  assertHas(changedTitle, "stale_approval");

  const changedRender = clone();
  changedRender.renderSets.at(-1).renderedSlides[0].digest =
    "sha256:abababababababababababababababababababababababababababababababab";
  assertHas(changedRender, "stale_approval");

  const changedExtraction = clone();
  changedExtraction.contentQa.textDigest =
    "sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
  assertHas(changedExtraction, "incomplete_content_qa");
  assertHas(changedExtraction, "stale_approval");

  const unregisteredBody = clone();
  unregisteredBody.contentQa.extractedSlides[1].contentItems.push({
    id: "content-slide-02-body-unregistered",
    role: "body",
    text: "A new material claim was inserted directly into the slide body.",
    material: true,
    claimRefs: [],
  });
  unregisteredBody.slides[1].contentItemRefs.push(
    "content-slide-02-body-unregistered",
  );
  assertHas(unregisteredBody, "invalid_slide_inventory");
  assertHas(unregisteredBody, "stale_approval");
});

test("review-copy and manifest controls exactly close over actual deck content", () => {
  const publicManifest = clone();
  publicManifest.manifest.classification = "public";
  assertHas(publicManifest, "control_inheritance_mismatch");

  const weakerDeck = clone();
  weakerDeck.deck.reviewCopy.classification = "internal";
  assertHas(weakerDeck, "control_inheritance_mismatch");

  const broaderAudience = clone();
  broaderAudience.deck.reviewCopy.audienceScope.push("public");
  assertHas(broaderAudience, "control_inheritance_mismatch");

  const missingLicense = clone();
  missingLicense.manifest.licenseTerms.pop();
  assertHas(missingLicense, "control_inheritance_mismatch");
});

test("visual provenance is exact, audience-safe, and scanned as authored content", () => {
  const hiddenContent = clone();
  hiddenContent.visualAssets[0].provenance.hiddenContentIncluded = true;
  assertHas(hiddenContent, "hidden_content_exposure");

  const audienceLeak = clone();
  audienceLeak.visualAssets[0].provenance.approvedAudienceScope = ["public"];
  assertHas(audienceLeak, "hidden_content_exposure");

  const altTextAction = clone();
  altTextAction.visualAssets[0].altText =
    "We published the deck after review.";
  assertHas(altTextAction, "unauthorized_narrative_action");

  const relevanceAction = clone();
  relevanceAction.sourceUseAssessments[0].rationale =
    "The presentation producer uploaded the deck.";
  assertHas(relevanceAction, "unauthorized_narrative_action");
});

test("the first render is the observed failure and fixes precede rerender", () => {
  const cleanFirstRender = clone();
  cleanFirstRender.renderSets[0].status = "passed";
  assertHas(cleanFirstRender, "missing_fix_rerender_cycle");

  const fixAfterRerender = clone();
  fixAfterRerender.visualQaFindings[0].fixedAt =
    "2026-09-01T18:45:00Z";
  assertHas(fixAfterRerender, "invalid_visual_qa_finding");
});

test("as-of is the deterministic chronology boundary and deadlines become blockers", () => {
  const missedDeadline = clone();
  missedDeadline.manifest.asOf = "2026-09-04T12:00:00Z";
  for (const assessment of missedDeadline.sourceUseAssessments) {
    assessment.asOf = missedDeadline.manifest.asOf;
  }
  const deadlineBlocker = {
    id: "blocker-missed-deadline",
    kind: "deadline",
    description:
      "The presentation deadline elapsed before the review handoff completed.",
    targetRefs: [missedDeadline.manifest.id],
    questionRefs: [],
    owner: structuredClone(missedDeadline.manifest.decisionOwner),
    status: "open",
    deadline: missedDeadline.manifest.deadline,
  };
  missedDeadline.blockers.push(deadlineBlocker);
  missedDeadline.handoff.blockerRefs.push(deadlineBlocker.id);
  missedDeadline.controlBindings
    .find((item) => item.policyRef === "control-derived-review")
    .objectRefs.push(deadlineBlocker.id);
  refreshApprovalIntegrity(missedDeadline);
  assert.deepEqual(findings(missedDeadline), []);

  const missingDeadlineBlocker = clone();
  missingDeadlineBlocker.manifest.asOf = "2026-09-04T12:00:00Z";
  for (const assessment of missingDeadlineBlocker.sourceUseAssessments) {
    assessment.asOf = missingDeadlineBlocker.manifest.asOf;
  }
  refreshApprovalIntegrity(missingDeadlineBlocker);
  assertHas(missingDeadlineBlocker, "incomplete_blocker_coverage");
});

test("template inventory preserves exact masters, layouts, and either standard ratio", () => {
  const fourByThree = clone();
  fourByThree.deck.templateInventory.aspectRatio = "4:3";
  fourByThree.deck.preservation.aspectRatio = "4:3";
  fourByThree.deck.reviewCopy.aspectRatio = "4:3";
  refreshTemplateIntegrity(fourByThree);
  assert.equal(validateSchema(fourByThree), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fourByThree), []);

  const fabricatedLayout = clone();
  fabricatedLayout.slides[0].layoutId = "layout-fabricated";
  fabricatedLayout.deck.preservation.layoutIds.push("layout-fabricated");
  assertHas(fabricatedLayout, "template_fidelity_failure");
});

test("source uses require dated human relevance and freshness assessments", () => {
  const staleDeclaration = clone();
  const assessment = staleDeclaration.sourceUseAssessments.find(
    (item) => item.id === "assessment-asset-revenue-chart",
  );
  assessment.currentThrough = "2026-08-29T16:05:00Z";
  assessment.freshnessStatus = "current";
  assertHas(staleDeclaration, "invalid_source_use_assessment");

  const wrongUse = clone();
  wrongUse.sourceUseAssessments.find(
    (item) => item.id === "assessment-claim-q2-revenue",
  ).useRef = "claim-gross-margin";
  assertHas(wrongUse, "invalid_source_use_assessment");
  assertHas(wrongUse, "unsupported_claim");
});

test("authority requires registered provenance and rejects Copilot-named teams", () => {
  const unregistered = clone();
  unregistered.handoff.owner = {
    id: "person-unregistered-owner",
    name: "Unregistered Owner",
    type: "human",
  };
  assertHas(unregistered, "invalid_authority_registry");

  const copilotTeam = clone();
  copilotTeam.authorityRegistry.principals.push({
    id: "team-microsoft-copilot",
    name: "Microsoft Copilot team",
    type: "team",
    authorityScopes: ["approve-review-copy"],
    provenance: {
      recordType: "team-charter",
      recordId: "charter-microsoft-copilot",
      version: "1",
      digest:
        "sha256:abababababababababababababababababababababababababababababababab",
      verifiedAt: "2026-08-27T16:00:00Z",
    },
  });
  assertHas(copilotTeam, "agent_owned_authority");
  assertHas(copilotTeam, "invalid_authority_registry");
});

test("blocked pre-review handoffs may omit approvals exactly", () => {
  const preReview = clone();
  const approvalIds = new Set(preReview.approvals.map((item) => item.id));
  preReview.approvals = [];
  preReview.handoff.approvalRefs = [];
  for (const binding of preReview.controlBindings) {
    binding.objectRefs = binding.objectRefs.filter(
      (ref) => !approvalIds.has(ref),
    );
  }
  refreshApprovalIntegrity(preReview);
  assert.deepEqual(findings(preReview), []);
});

test("placeholder QA requires standard and template-derived scan patterns", () => {
  const sentinelOnly = clone();
  sentinelOnly.contentQa.placeholderScan.baselinePatterns = [
    "unlikely-sentinel-9f84",
  ];
  sentinelOnly.contentQa.placeholderScan.templatePatterns = [
    "unlikely-sentinel-9f84",
  ];
  sentinelOnly.contentQa.placeholderScan.effectivePatterns = [
    "unlikely-sentinel-9f84",
  ];
  refreshContentQaIntegrity(sentinelOnly);
  assertHas(sentinelOnly, "incomplete_content_qa");
});

test("every direct presentation semantic finding code has focused coverage", () => {
  const cases = new Map([
    [
      "duplicate_object_id",
      (value) => {
        value.visualAssets[0].id = value.claims[0].id;
      },
    ],
    [
      "invalid_content_digest",
      (value) => {
        value.manifest.audience = "Changed audience";
      },
    ],
    [
      "unsafe_output_path",
      (value) => {
        value.manifest.outputPaths.handoff = "../handoff.md";
      },
    ],
    [
      "invalid_source_chronology",
      (value) => {
        value.sources[0].retrievedAt = "2026-09-02T00:00:00Z";
      },
    ],
    [
      "stale_or_unauthorized_source",
      (value) => {
        value.sources[0].authority = "asset-rights-owner";
      },
    ],
    [
      "invalid_source_use_assessment",
      (value) => {
        value.sourceUseAssessments[0].useRef = "claim-q2-revenue";
      },
    ],
    [
      "source_preservation_failure",
      (value) => {
        value.deck.reviewCopy.digest = value.deck.sourceDeck.digest;
      },
    ],
    [
      "template_fidelity_failure",
      (value) => {
        value.slides[0].masterId = "master-unapproved";
      },
    ],
    [
      "invalid_visual_asset",
      (value) => {
        value.visualAssets[0].sourceVersion = "wrong-version";
      },
    ],
    [
      "unsupported_claim",
      (value) => {
        value.claims[0].evidence[0].sourceDigest =
          "sha256:abababababababababababababababababababababababababababababababab";
      },
    ],
    [
      "invalid_claim_epistemic_state",
      (value) => {
        value.claims.find(
          (item) => item.id === "claim-retention-risk",
        ).epistemicType = "observed";
      },
    ],
    [
      "invalid_citation_binding",
      (value) => {
        value.citations[0].sourceVersion = "wrong-version";
      },
    ],
    [
      "hidden_content_exposure",
      (value) => {
        value.speakerNotes[0].commentContentIncluded = true;
      },
    ],
    [
      "invalid_slide_inventory",
      (value) => {
        value.slides[0].order = 2;
      },
    ],
    [
      "invalid_render_chronology",
      (value) => {
        value.renderSets[1].reviewedAt = "2026-09-01T18:30:00Z";
      },
    ],
    [
      "incomplete_visual_qa",
      (value) => {
        value.renderSets.at(-1).renderedSlides.pop();
      },
    ],
    [
      "failed_visual_qa",
      (value) => {
        value.renderSets.at(-1).renderedSlides[0].checks.overflow = "failed";
      },
    ],
    [
      "invalid_visual_qa_finding",
      (value) => {
        value.visualQaFindings[0].fixedInRenderRef = "render-slide-07-v1";
      },
    ],
    [
      "missing_fix_rerender_cycle",
      (value) => {
        value.renderSets[0].status = "passed";
      },
    ],
    [
      "incomplete_content_qa",
      (value) => {
        value.contentQa.leftoverPlaceholders.push("xxxx");
      },
    ],
    [
      "invalid_approval_scope",
      (value) => {
        value.approvals[0].scope = "all-decks";
      },
    ],
    [
      "stale_approval",
      (value) => {
        value.approvals[0].deckVersion = "v1";
      },
    ],
    [
      "invalid_approval_chronology",
      (value) => {
        value.approvals[0].approvedAt = value.contentQa.reviewedAt;
      },
    ],
    [
      "incomplete_caveat_coverage",
      (value) => {
        value.claims.find(
          (item) => item.id === "claim-enterprise-concentration",
        ).caveatRefs = [];
      },
    ],
    [
      "incomplete_blocker_coverage",
      (value) => {
        value.blockers[0].questionRefs = [];
      },
    ],
    [
      "incomplete_handoff",
      (value) => {
        value.handoff.sourceRefs.pop();
      },
    ],
    [
      "premature_readiness",
      (value) => {
        value.manifest.state = "ready-for-human-review";
        value.handoff.state = "ready-for-human-review";
      },
    ],
    [
      "unsafe_output_state",
      (value) => {
        value.handoff.output.deliveryState = "delivered";
      },
    ],
    [
      "control_inheritance_mismatch",
      (value) => {
        value.controlPolicies.find(
          (item) => item.id === "control-derived-review",
        ).classification = "internal";
      },
    ],
    [
      "agent_owned_authority",
      (value) => {
        value.manifest.reviewer = {
          id: "team-presentation-bot",
          name: "Presentation bot",
          type: "team",
        };
      },
    ],
    [
      "invalid_authority_registry",
      (value) => {
        value.authorityRegistry.principals[0].authorityScopes = [
          "review-visual-qa",
        ];
      },
    ],
    [
      "invalid_proposed_owner_action",
      (value) => {
        value.proposedOwnerActions[0].ownerRef =
          "team-leadership-communications";
      },
    ],
    [
      "missing_authority_gate",
      (value) => {
        value.prohibitedActions.pop();
      },
    ],
    [
      "unauthorized_narrative_action",
      (value) => {
        value.handoff.summary =
          "The deck was distributed and the source presentation was overwritten.";
      },
    ],
  ]);

  for (const [code, mutate] of cases) {
    const value = clone();
    mutate(value);
    assertHas(value, code);
  }

  assert.deepEqual(emittedFindingCodes, new Set(cases.keys()));
});

test("presentation references reject duplicate and dangling ids", () => {
  const duplicate = clone();
  duplicate.handoff.sourceRefs.push(duplicate.handoff.sourceRefs[0]);
  assertHas(duplicate, "duplicate_reference");

  const dangling = clone();
  dangling.slides[0].visualAssetRefs[0] = "asset-missing";
  assertHas(dangling, "dangling_reference");
});
