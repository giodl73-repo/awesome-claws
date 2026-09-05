import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL("../claws/procurement-evaluator/fixtures/vendor-evaluation.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/procurement-evaluator/schemas/vendor-evaluation.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/procurement-evaluator/fixtures/vendor-evaluation.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("procurement-evaluator", value).length === 0
  );
}

test("procurement evaluation fixture keeps evidence, scores, and reviews consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("procurement-evaluator", fixture), []);
});

test("procurement evaluation rejects unsupported or fabricated scoring evidence", () => {
  const scoreOnMissingEvidence = clone();
  scoreOnMissingEvidence.scores.push({
    id: "score-alpha-privacy",
    vendorRef: "vendor-alpha-desk",
    criterionRef: "criterion-privacy-review",
    rating: 3,
    weightedScore: 0.45,
    evidenceRefs: ["evidence-alpha-privacy"],
  });
  assert.equal(isValid(scoreOnMissingEvidence), false);

  const fabricatedMissingEvidence = clone();
  fabricatedMissingEvidence.evidence.find((item) => item.id === "evidence-alpha-privacy").sourceRef =
    "Invented privacy attestation";
  assert.equal(isValid(fabricatedMissingEvidence), false);

  const wrongArithmetic = clone();
  wrongArithmetic.scores.find((item) => item.id === "score-alpha-uptime").weightedScore = 3;
  assert.equal(isValid(wrongArithmetic), false);

  const disqualifiedScored = clone();
  disqualifiedScored.scores.push({
    id: "score-beacon-uptime",
    vendorRef: "vendor-beacon-support",
    criterionRef: "criterion-uptime-sla",
    rating: 2,
    weightedScore: 0.5,
    evidenceRefs: ["evidence-beacon-uptime"],
  });
  assert.equal(isValid(disqualifiedScored), false);
});

test("procurement evaluation rejects more than one score for the same vendor/criterion pair", () => {
  // A distinct score id does not create a distinct vendor/criterion pairing:
  // exactly one score may exist per vendorRef+criterionRef combination.
  const duplicateScorePair = clone();
  duplicateScorePair.scores.push({
    id: "score-alpha-uptime-second",
    vendorRef: "vendor-alpha-desk",
    criterionRef: "criterion-uptime-sla",
    rating: 3,
    weightedScore: 0.75,
    evidenceRefs: ["evidence-alpha-uptime"],
  });
  assert.equal(validateSchema(duplicateScorePair), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(duplicateScorePair), false);
  const duplicateFindings = validateArtifactSemantics("procurement-evaluator", duplicateScorePair);
  assert.equal(
    duplicateFindings.filter((item) => item.code === "duplicate_vendor_criterion_score").length,
    2,
  );
});

test("procurement evaluation rejects missing specialist-review coverage and dangling references", () => {
  const missingReview = clone();
  missingReview.specialistReviews = missingReview.specialistReviews.filter(
    (item) => item.id !== "review-crestline-privacy",
  );
  assert.equal(isValid(missingReview), false);

  const danglingCriterion = clone();
  danglingCriterion.evidence[0].criterionRef = "criterion-does-not-exist";
  assert.equal(isValid(danglingCriterion), false);

  const duplicateVendorId = clone();
  duplicateVendorId.vendors.push({ ...clone().vendors[0] });
  assert.equal(isValid(duplicateVendorId), false);
});

test("procurement evaluation rejects premature readiness and missing authority gates", () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  prematureReady.evaluation.state = "ready";
  assert.equal(isValid(prematureReady), false);

  const agentOwner = clone();
  agentOwner.handoff.owner = "the agent";
  agentOwner.evaluation.decisionOwner.id = "the agent";
  assert.equal(isValid(agentOwner), false);

  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "approve-spend",
  );
  assert.equal(isValid(missingGate), false);

  const unauthorizedNarrative = clone();
  unauthorizedNarrative.handoff.recommendationRange =
    "AlphaDesk was selected and the purchase was made this week.";
  assert.equal(isValid(unauthorizedNarrative), false);
});

test("procurement evaluation rejects score evidence from a different vendor or criterion", () => {
  const crossVendorEvidence = clone();
  crossVendorEvidence.scores.find((item) => item.id === "score-alpha-uptime").evidenceRefs = [
    "evidence-crestline-uptime",
  ];
  assert.equal(isValid(crossVendorEvidence), false);

  const crossCriterionEvidence = clone();
  crossCriterionEvidence.scores.find((item) => item.id === "score-alpha-uptime").evidenceRefs = [
    "evidence-alpha-security",
  ];
  assert.equal(isValid(crossCriterionEvidence), false);
});

test("procurement evaluation rejects ready state when non-disqualified vendor criterion coverage is incomplete", () => {
  const incompleteCoverageReady = clone();
  for (const review of incompleteCoverageReady.specialistReviews) {
    review.status = "complete";
    review.completedAt = review.completedAt ?? "2026-08-25";
  }
  incompleteCoverageReady.unresolvedReviews = [];
  incompleteCoverageReady.handoff.unresolvedReviewRefs = [];
  incompleteCoverageReady.handoff.state = "ready";
  incompleteCoverageReady.evaluation.state = "ready";
  // AlphaDesk's privacy-review evidence and Crestline Care's accessibility-review
  // evidence are both explicitly "missing" and were never scored; neither vendor is
  // disqualified, so criterion coverage is incomplete and readiness must stay blocked.
  assert.equal(isValid(incompleteCoverageReady), false);
});

test("procurement evaluation stays total over schema-valid records missing optional sections", () => {
  const partial = {
    criteria: clone().criteria,
    vendors: clone().vendors,
    unresolvedReviews: [],
  };
  assert.equal(validateSchema(partial), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("procurement-evaluator", partial));
  assert.ok(validateArtifactSemantics("procurement-evaluator", partial).length > 0);
});

test("procurement evaluation rejects a score with empty evidenceRefs", () => {
  const emptyEvidenceRefs = clone();
  emptyEvidenceRefs.scores.find((item) => item.id === "score-alpha-uptime").evidenceRefs = [];
  assert.equal(isValid(emptyEvidenceRefs), false);
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", emptyEvidenceRefs).some(
      (item) => item.code === "missing_score_evidence",
    ),
  );
});

test("procurement evaluation rejects a ready state reached by scoring missing evidence with empty evidenceRefs", () => {
  const groundlessReady = clone();
  // AlphaDesk's privacy-review evidence and Crestline Care's accessibility-review
  // evidence are both explicitly "missing". Scoring those criteria with empty
  // evidenceRefs must not be treated as coverage: readiness has to stay blocked even
  // after every specialist review is resolved.
  groundlessReady.scores.push(
    {
      id: "score-alpha-privacy",
      vendorRef: "vendor-alpha-desk",
      criterionRef: "criterion-privacy-review",
      rating: 1,
      weightedScore: 0.15,
      evidenceRefs: [],
    },
    {
      id: "score-crestline-accessibility",
      vendorRef: "vendor-crestline-care",
      criterionRef: "criterion-accessibility-review",
      rating: 1,
      weightedScore: 0.1,
      evidenceRefs: [],
    },
  );
  for (const review of groundlessReady.specialistReviews) {
    review.status = "complete";
    review.completedAt = review.completedAt ?? "2026-08-25";
  }
  groundlessReady.unresolvedReviews = [];
  groundlessReady.handoff.unresolvedReviewRefs = [];
  groundlessReady.handoff.state = "ready";
  groundlessReady.evaluation.state = "ready";
  assert.equal(isValid(groundlessReady), false);
  const groundlessFindings = validateArtifactSemantics("procurement-evaluator", groundlessReady);
  assert.ok(groundlessFindings.some((item) => item.code === "missing_score_evidence"));
  assert.ok(groundlessFindings.some((item) => item.code === "premature_ready_state"));
});

test("procurement evaluation stays total when arrays contain null or non-object members", () => {
  const nullCriteria = clone();
  nullCriteria.criteria = [null];
  assert.equal(validateSchema(nullCriteria), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("procurement-evaluator", nullCriteria));
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", nullCriteria).some(
      (item) => item.code === "invalid_array_record" && item.path === "criteria[0]",
    ),
  );

  const nullVendors = clone();
  nullVendors.vendors = [null];
  assert.equal(validateSchema(nullVendors), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("procurement-evaluator", nullVendors));
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", nullVendors).some(
      (item) => item.code === "invalid_array_record" && item.path === "vendors[0]",
    ),
  );

  const nullOtherArrays = clone();
  nullOtherArrays.evidence = [null];
  nullOtherArrays.scores = [null];
  nullOtherArrays.specialistReviews = [null];
  nullOtherArrays.disqualifiers = [null];
  nullOtherArrays.reviewQuestions = [null];
  assert.doesNotThrow(() => validateArtifactSemantics("procurement-evaluator", nullOtherArrays));
  assert.ok(validateArtifactSemantics("procurement-evaluator", nullOtherArrays).length > 0);
});

test("procurement evaluation stays total when a schema-valid reviewQuestions entry omits refs", () => {
  // reviewQuestions items have no declared schema shape (the top-level schema only
  // constrains criteria/vendors/unresolvedReviews), so `{}` is schema-valid and
  // leaves `refs` undefined. The semantic validator must not throw when it tries
  // to resolve that (absent) reference list.
  const malformedReviewQuestion = clone();
  malformedReviewQuestion.reviewQuestions = [{}];
  assert.equal(validateSchema(malformedReviewQuestion), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("procurement-evaluator", malformedReviewQuestion),
  );
});

test("procurement evaluation stays total when handoff.prohibitedActions is a non-array object", () => {
  // handoff.prohibitedActions is a bare `{"type":"array"}` field, so `{}` is
  // schema-valid. Calling `.includes()` on it directly would throw; the
  // validator must instead flag it and safely treat it as an empty list, so
  // every required action still trips its own missing_authority_gate finding.
  const malformedProhibitedActions = clone();
  malformedProhibitedActions.handoff.prohibitedActions = {};
  assert.equal(
    validateSchema(malformedProhibitedActions),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("procurement-evaluator", malformedProhibitedActions),
  );
  const malformedFindings = validateArtifactSemantics(
    "procurement-evaluator",
    malformedProhibitedActions,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_string_list"));
  assert.ok(
    malformedFindings.filter((item) => item.code === "missing_authority_gate").length >= 7,
  );
  assert.equal(isValid(malformedProhibitedActions), false);
});

test("procurement evaluation stays total when handoff.vendorRefs is a non-array object", () => {
  // handoff.vendorRefs is threaded through requireReferences(), which fans out
  // to both uniqueFindings()/duplicates() (duplicate check) and
  // referenceFindings() (resolution check). A non-array-but-truthy value like
  // `{}` is schema-valid and slips past the `?? []` fallback; duplicates()
  // used to call `.filter()` on it directly and throw before it could ever
  // reach referenceFindings()'s own totality guard.
  const malformedVendorRefs = clone();
  malformedVendorRefs.handoff.vendorRefs = {};
  assert.equal(validateSchema(malformedVendorRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("procurement-evaluator", malformedVendorRefs),
  );
  const malformedFindings = validateArtifactSemantics("procurement-evaluator", malformedVendorRefs);
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  // The shared duplicates() totality fix must not also emit its own malformed
  // finding on top of referenceFindings()'s invalid_reference_list for the
  // very same field.
  assert.equal(
    malformedFindings.filter(
      (item) => item.path === "handoff.vendorRefs" && item.code === "duplicate_reference",
    ).length,
    0,
  );
  assert.equal(isValid(malformedVendorRefs), false);
});

test("procurement evaluation stays total when handoff.vendorRefs is a matching-length non-array object", () => {
  // sameSet() previously skipped straight to `left.length === right.length`
  // and `new Set(left)`: a schema-valid non-array object whose own `length`
  // property happens to match the vendor count (e.g. `{ length: 3 }`) would
  // pass the length check but throw once passed to `new Set(...)`, which
  // requires an iterable. sameSet() must fail closed (not equal) whenever
  // either side isn't actually an array, before any length/Set work.
  const malformedVendorRefs = clone();
  const vendorCount = malformedVendorRefs.vendors.length;
  malformedVendorRefs.handoff.vendorRefs = { length: vendorCount };
  assert.equal(validateSchema(malformedVendorRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("procurement-evaluator", malformedVendorRefs),
  );
  const malformedFindings = validateArtifactSemantics("procurement-evaluator", malformedVendorRefs);
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  assert.ok(
    malformedFindings.some(
      (item) => item.code === "incomplete_handoff" && item.path === "handoff.vendorRefs",
    ),
  );
  assert.equal(isValid(malformedVendorRefs), false);
});

test("procurement evaluation rejects a missing or blank owner even in an otherwise ready-shaped case", () => {
  // Both evaluation.decisionOwner.id and handoff.owner must independently
  // carry a trimmed, non-empty, accountable identity: neither
  // isAgentIdentityName() nor the self-role pattern reject undefined/blank
  // strings, so a missing or whitespace-only owner must be checked
  // explicitly and must block a clean (zero-finding) result.
  const blankHandoffOwner = clone();
  blankHandoffOwner.handoff.owner = "   ";
  assert.equal(validateSchema(blankHandoffOwner), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", blankHandoffOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(blankHandoffOwner), false);

  const missingDecisionOwner = clone();
  delete missingDecisionOwner.evaluation.decisionOwner.id;
  assert.equal(
    validateSchema(missingDecisionOwner),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", missingDecisionOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(missingDecisionOwner), false);
});

test("procurement evaluation rejects a self-attested specialist review and blocks readiness", () => {
  const selfAttestedReviewer = clone();
  const privacyReview = selfAttestedReviewer.specialistReviews.find(
    (item) => item.id === "review-alpha-privacy",
  );
  privacyReview.reviewer = "procurement evaluator";
  privacyReview.status = "complete";
  privacyReview.completedAt = "2026-08-25";
  assert.equal(isValid(selfAttestedReviewer), false);
  assert.ok(
    validateArtifactSemantics("procurement-evaluator", selfAttestedReviewer).some(
      (item) => item.code === "self_attested_specialist_review",
    ),
  );

  const agentReviewer = clone();
  const accessibilityReview = agentReviewer.specialistReviews.find(
    (item) => item.id === "review-crestline-accessibility",
  );
  accessibilityReview.reviewer = "the agent";
  accessibilityReview.status = "complete";
  accessibilityReview.completedAt = "2026-08-25";
  assert.equal(isValid(agentReviewer), false);

  const missingCompletedAt = clone();
  const securityReview = missingCompletedAt.specialistReviews.find(
    (item) => item.id === "review-alpha-security",
  );
  securityReview.completedAt = null;
  assert.equal(isValid(missingCompletedAt), false);

  // Attempting to unlock readiness with a self-attested review, after resolving
  // every other blocker, must still fail: the self-attested review keeps its
  // vendor's criterion coverage incomplete and its id in unresolvedReviews.
  const readyWithSelfAttestation = clone();
  for (const review of readyWithSelfAttestation.specialistReviews) {
    review.status = "complete";
    review.completedAt = review.completedAt ?? "2026-08-25";
  }
  const selfAttestedPrivacyReview = readyWithSelfAttestation.specialistReviews.find(
    (item) => item.id === "review-alpha-privacy",
  );
  selfAttestedPrivacyReview.reviewer = "procurement evaluator";
  readyWithSelfAttestation.unresolvedReviews = ["review-alpha-privacy"];
  readyWithSelfAttestation.handoff.unresolvedReviewRefs = ["review-alpha-privacy"];
  readyWithSelfAttestation.handoff.state = "ready";
  readyWithSelfAttestation.evaluation.state = "ready";
  assert.equal(isValid(readyWithSelfAttestation), false);
  const bypassFindings = validateArtifactSemantics(
    "procurement-evaluator",
    readyWithSelfAttestation,
  );
  assert.ok(bypassFindings.some((item) => item.code === "self_attested_specialist_review"));
  assert.ok(bypassFindings.some((item) => item.code === "premature_ready_state"));

  // A legitimate human reviewer whose title happens to contain unrelated words
  // must not be rejected by the same narrow check.
  const legitimateReviewer = clone();
  const legitimatePrivacyReview = legitimateReviewer.specialistReviews.find(
    (item) => item.id === "review-alpha-privacy",
  );
  legitimatePrivacyReview.reviewer = "Senior procurement counsel";
  legitimatePrivacyReview.status = "complete";
  legitimatePrivacyReview.completedAt = "2026-08-25";
  legitimateReviewer.unresolvedReviews = legitimateReviewer.unresolvedReviews.filter(
    (id) => id !== "review-alpha-privacy",
  );
  legitimateReviewer.handoff.unresolvedReviewRefs =
    legitimateReviewer.handoff.unresolvedReviewRefs.filter((id) => id !== "review-alpha-privacy");
  assert.ok(
    !validateArtifactSemantics("procurement-evaluator", legitimateReviewer).some(
      (item) => item.code === "self_attested_specialist_review",
    ),
  );
});

test("procurement evaluation rejects a vendor disqualification lacking a valid same-vendor disqualifier", () => {
  // A vendor cannot bypass score/review coverage merely by toggling
  // disqualified: every disqualified vendor needs at least one valid,
  // same-vendor disqualifier grounded in unsupported evidence.
  const allDisqualifiedNoDisqualifiers = clone();
  for (const vendor of allDisqualifiedNoDisqualifiers.vendors) {
    vendor.disqualified = true;
  }
  allDisqualifiedNoDisqualifiers.disqualifiers = [];
  assert.equal(
    validateSchema(allDisqualifiedNoDisqualifiers),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(isValid(allDisqualifiedNoDisqualifiers), false);
  const allDisqualifiedFindings = validateArtifactSemantics(
    "procurement-evaluator",
    allDisqualifiedNoDisqualifiers,
  );
  assert.equal(
    allDisqualifiedFindings.filter((item) => item.code === "unsupported_vendor_disqualification")
      .length,
    3,
  );

  // Removing vendor-beacon-support's sole grounding disqualifier while it is
  // still marked disqualified must be caught even though every other vendor
  // and disqualifier record stays untouched.
  const removedDisqualifier = clone();
  removedDisqualifier.disqualifiers = [];
  assert.equal(isValid(removedDisqualifier), false);
  const removedDisqualifierFindings = validateArtifactSemantics(
    "procurement-evaluator",
    removedDisqualifier,
  );
  assert.ok(
    removedDisqualifierFindings.some(
      (item) => item.code === "unsupported_vendor_disqualification",
    ),
  );

  // Attempting to reach ready state after resolving every other blocker must
  // still fail while a disqualified vendor has no valid grounding.
  const bypassAttempt = clone();
  for (const review of bypassAttempt.specialistReviews) {
    review.status = "complete";
    review.completedAt = review.completedAt ?? "2026-08-25";
  }
  bypassAttempt.disqualifiers = [];
  bypassAttempt.unresolvedReviews = [];
  bypassAttempt.handoff.unresolvedReviewRefs = [];
  bypassAttempt.handoff.state = "ready";
  bypassAttempt.evaluation.state = "ready";
  assert.equal(isValid(bypassAttempt), false);
  const bypassFindings = validateArtifactSemantics("procurement-evaluator", bypassAttempt);
  assert.ok(bypassFindings.some((item) => item.code === "unsupported_vendor_disqualification"));
});

test("procurement evaluation rejects a disqualifier grounded in a criterion that is not disqualifying", () => {
  // vendor-beacon-support remains disqualified and its disqualifier still
  // resolves and is grounded in unsupported evidence, but the criterion it
  // targets no longer allows disqualification at all.
  const nonDisqualifyingCriterion = clone();
  nonDisqualifyingCriterion.criteria.find(
    (item) => item.id === "criterion-uptime-sla",
  ).disqualifying = false;
  assert.equal(
    validateSchema(nonDisqualifyingCriterion),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(isValid(nonDisqualifyingCriterion), false);
  const findings = validateArtifactSemantics("procurement-evaluator", nonDisqualifyingCriterion);
  assert.ok(findings.some((item) => item.code === "unsupported_vendor_disqualification"));
  assert.ok(findings.some((item) => item.code === "ungrounded_disqualifier"));
});

test("validate-artifact CLI accepts the packaged procurement-evaluator fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "procurement-evaluator", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready procurement artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  prematureReady.evaluation.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `procurement-evaluator-cli-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "procurement-evaluator", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_ready_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
