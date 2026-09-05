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
  new URL(
    "../claws/accessibility-review-coordinator/fixtures/accessibility-finding.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/accessibility-review-coordinator/schemas/accessibility-finding.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/accessibility-review-coordinator/fixtures/accessibility-finding.example.json",
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
    validateArtifactSemantics("accessibility-review-coordinator", value).length === 0
  );
}

test("accessibility review fixture keeps evidence kind, verification, and closure consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("accessibility-review-coordinator", fixture), []);
});

test("accessibility review rejects mismatched automated, manual, and assistive evidence", () => {
  const mismatchedFlag = clone();
  mismatchedFlag.findings.find(
    (item) => item.id === "finding-error-announcement-screenreader",
  ).assistiveTechnologyUsed = false;
  assert.equal(isValid(mismatchedFlag), false);

  const wrongSourceKind = clone();
  wrongSourceKind.findings.find((item) => item.id === "finding-focus-visible-checkout").sourceRef =
    "source-assistive-session";
  assert.equal(isValid(wrongSourceKind), false);

  const danglingCriterion = clone();
  danglingCriterion.findings[0].criterionRef = "std-does-not-exist";
  assert.equal(isValid(danglingCriterion), false);
});

test("accessibility review rejects premature finding states and unauthorized waivers", () => {
  const prematureVerified = clone();
  prematureVerified.findings.find(
    (item) => item.id === "finding-error-announcement-screenreader",
  ).state = "verified";
  assert.equal(isValid(prematureVerified), false);

  const unapprovedWaiver = clone();
  unapprovedWaiver.knownExceptions[0].approvedBy = "";
  assert.equal(isValid(unapprovedWaiver), false);

  const acceptedRiskWithoutException = clone();
  acceptedRiskWithoutException.knownExceptions = [];
  assert.equal(isValid(acceptedRiskWithoutException), false);
});

test("accessibility review rejects an unmodeled 'closed' finding state used to bypass readiness", () => {
  const unknownState = clone();
  unknownState.findings.find(
    (item) => item.id === "finding-error-announcement-screenreader",
  ).state = "closed";
  assert.equal(validateSchema(unknownState), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownState), false);
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", unknownState).some(
      (item) => item.code === "unknown_finding_state" && item.path.startsWith("findings["),
    ),
  );

  // "closed" is schema-valid (state is a bare string) but is not one of the
  // modeled terminal states (verified, accepted-risk); it must stay in
  // unresolvedFindingRefs and block readiness even if the handoff and
  // top-level state both claim "ready".
  const closedReadyBypass = clone();
  closedReadyBypass.findings.find(
    (item) => item.id === "finding-error-announcement-screenreader",
  ).state = "closed";
  closedReadyBypass.handoff.unresolvedFindingRefs = [];
  closedReadyBypass.handoff.state = "ready";
  closedReadyBypass.state = "ready";
  assert.equal(isValid(closedReadyBypass), false);
  const bypassFindings = validateArtifactSemantics(
    "accessibility-review-coordinator",
    closedReadyBypass,
  );
  assert.ok(bypassFindings.some((item) => item.code === "unknown_finding_state"));
  assert.ok(
    bypassFindings.some(
      (item) =>
        item.code === "incomplete_handoff" && item.path === "handoff.unresolvedFindingRefs",
    ),
  );
  assert.ok(bypassFindings.some((item) => item.code === "premature_ready_state"));
});

test("accessibility review rejects conformance claims and missing authority gates", () => {
  const conformanceClaim = clone();
  conformanceClaim.handoff.conformanceClaim = "compliant";
  assert.equal(isValid(conformanceClaim), false);

  const narrativeClaim = clone();
  narrativeClaim.handoff.summary =
    "The checkout flow is now fully WCAG conformant and certified for release.";
  assert.equal(isValid(narrativeClaim), false);

  const agentOwner = clone();
  agentOwner.handoff.owner = "the agent";
  assert.equal(isValid(agentOwner), false);

  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "claim-certification",
  );
  assert.equal(isValid(missingGate), false);
});

test("accessibility review rejects an agent-named known-exception approver", () => {
  const agentApprovedException = clone();
  agentApprovedException.knownExceptions[0].approvedBy = "the agent";
  assert.equal(isValid(agentApprovedException), false);
});

test("accessibility review rejects a verification whose remediation resolves to a different finding", () => {
  const mismatchedRemediation = clone();
  mismatchedRemediation.verifications[0].remediationRef = "remediation-error-announcement";
  assert.equal(isValid(mismatchedRemediation), false);
});

test("accessibility review stays total over schema-valid records missing optional sections", () => {
  const partial = {
    id: "review-partial",
    criterion: "Primary criterion under review",
    impact: "Impact placeholder",
    evidence: "controlled://accessibility-evidence/partial",
    state: "blocked",
  };
  assert.equal(validateSchema(partial), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("accessibility-review-coordinator", partial));
  assert.ok(validateArtifactSemantics("accessibility-review-coordinator", partial).length > 0);
});

test("accessibility review rejects a passing verification whose remediation is not complete", () => {
  const prematureVerificationPass = clone();
  const remediation = prematureVerificationPass.remediations.find(
    (item) => item.id === "remediation-focus-visible",
  );
  // The verification still reports outcome "pass" and points at this remediation,
  // but the remediation itself has reverted to planned/in-progress work.
  remediation.status = "in-progress";
  remediation.completedAt = null;
  assert.equal(isValid(prematureVerificationPass), false);
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", prematureVerificationPass).some(
      (item) => item.code === "premature_verification_pass",
    ),
  );

  // Completed status without completion metadata is equally insufficient.
  const missingCompletionMetadata = clone();
  const remediationMissingMetadata = missingCompletionMetadata.remediations.find(
    (item) => item.id === "remediation-focus-visible",
  );
  remediationMissingMetadata.completedAt = null;
  assert.equal(isValid(missingCompletionMetadata), false);
});

test("accessibility review rejects the package's own role name as a known-exception approver", () => {
  const selfApprovedException = clone();
  selfApprovedException.knownExceptions[0].approvedBy = "accessibility review coordinator";
  assert.equal(isValid(selfApprovedException), false);

  // A legitimate human coordinator title that merely contains the word
  // "coordinator" must not be rejected by the same check.
  const legitimateCoordinator = clone();
  legitimateCoordinator.knownExceptions[0].approvedBy = "design system coordinator";
  assert.equal(isValid(legitimateCoordinator), true);
});

test("accessibility review stays total when arrays contain null or non-object members", () => {
  const nullFindings = clone();
  nullFindings.findings = [null];
  assert.equal(validateSchema(nullFindings), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("accessibility-review-coordinator", nullFindings));
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", nullFindings).some(
      (item) => item.code === "invalid_array_record" && item.path === "findings[0]",
    ),
  );

  const nullOtherArrays = clone();
  nullOtherArrays.standardsReferences = [null];
  nullOtherArrays.sources = [null];
  nullOtherArrays.remediations = [null];
  nullOtherArrays.verifications = [null];
  nullOtherArrays.knownExceptions = [null];
  nullOtherArrays.reviewQuestions = [null];
  assert.doesNotThrow(() =>
    validateArtifactSemantics("accessibility-review-coordinator", nullOtherArrays),
  );
  assert.ok(validateArtifactSemantics("accessibility-review-coordinator", nullOtherArrays).length > 0);
});

test("accessibility review stays total when a schema-valid reviewQuestions entry omits refs", () => {
  // reviewQuestions items have no declared schema shape (the top-level schema
  // only constrains id/criterion/impact/evidence/state), so `{}` is schema-valid
  // and leaves `refs` undefined. The semantic validator must not throw when it
  // tries to resolve that (absent) reference list.
  const malformedReviewQuestion = clone();
  malformedReviewQuestion.reviewQuestions = [{}];
  assert.equal(validateSchema(malformedReviewQuestion), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("accessibility-review-coordinator", malformedReviewQuestion),
  );
});

test("accessibility review stays total when handoff.prohibitedActions is a non-array object", () => {
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
    validateArtifactSemantics("accessibility-review-coordinator", malformedProhibitedActions),
  );
  const malformedFindings = validateArtifactSemantics(
    "accessibility-review-coordinator",
    malformedProhibitedActions,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_string_list"));
  assert.ok(
    malformedFindings.filter((item) => item.code === "missing_authority_gate").length >= 7,
  );
  assert.equal(isValid(malformedProhibitedActions), false);
});

test("accessibility review stays total when handoff.findingRefs is a non-array object", () => {
  // handoff.findingRefs is threaded through requireReferences(), which fans
  // out to both uniqueFindings()/duplicates() (duplicate check) and
  // referenceFindings() (resolution check). A non-array-but-truthy value like
  // `{}` is schema-valid and slips past the `?? []` fallback; duplicates()
  // used to call `.filter()` on it directly and throw before it could ever
  // reach referenceFindings()'s own totality guard.
  const malformedFindingRefs = clone();
  malformedFindingRefs.handoff.findingRefs = {};
  assert.equal(validateSchema(malformedFindingRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("accessibility-review-coordinator", malformedFindingRefs),
  );
  const malformedFindings = validateArtifactSemantics(
    "accessibility-review-coordinator",
    malformedFindingRefs,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  // The shared duplicates() totality fix must not also emit its own malformed
  // finding on top of referenceFindings()'s invalid_reference_list for the
  // very same field.
  assert.equal(
    malformedFindings.filter(
      (item) => item.path === "handoff.findingRefs" && item.code === "duplicate_reference",
    ).length,
    0,
  );
  assert.equal(isValid(malformedFindingRefs), false);
});

test("accessibility review stays total when handoff.findingRefs is a matching-length non-array object", () => {
  // sameSet() previously skipped straight to `left.length === right.length`
  // and `new Set(left)`: a schema-valid non-array object whose own `length`
  // property happens to match the finding count (e.g. `{ length: 3 }`) would
  // pass the length check but throw once passed to `new Set(...)`, which
  // requires an iterable. sameSet() must fail closed (not equal) whenever
  // either side isn't actually an array, before any length/Set work.
  const malformedFindingRefs = clone();
  const findingCount = malformedFindingRefs.findings.length;
  malformedFindingRefs.handoff.findingRefs = { length: findingCount };
  assert.equal(validateSchema(malformedFindingRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("accessibility-review-coordinator", malformedFindingRefs),
  );
  const malformedFindings = validateArtifactSemantics(
    "accessibility-review-coordinator",
    malformedFindingRefs,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  assert.ok(
    malformedFindings.some(
      (item) => item.code === "incomplete_handoff" && item.path === "handoff.findingRefs",
    ),
  );
  assert.equal(isValid(malformedFindingRefs), false);
});

test("accessibility review rejects a missing or blank owner even in an otherwise ready-shaped case", () => {
  // Both the review's owner (review.owner) and the handoff owner must
  // independently carry a trimmed, non-empty, accountable identity: neither
  // isAgentIdentityName() nor the self-role pattern reject undefined/blank
  // strings, so a missing or whitespace-only owner must be checked
  // explicitly and must block a clean (zero-finding) result.
  const blankHandoffOwner = clone();
  blankHandoffOwner.handoff.owner = "   ";
  assert.equal(validateSchema(blankHandoffOwner), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", blankHandoffOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(blankHandoffOwner), false);

  const missingReviewOwner = clone();
  delete missingReviewOwner.review.owner;
  assert.equal(
    validateSchema(missingReviewOwner),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", missingReviewOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(missingReviewOwner), false);
});

test("accessibility review rejects a self-attested verification and blocks closure and readiness", () => {
  const agentVerified = clone();
  agentVerified.verifications[0].verifiedBy = "the agent";
  assert.equal(isValid(agentVerified), false);
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", agentVerified).some(
      (item) => item.code === "self_attested_verification",
    ),
  );

  const selfCoordinatorVerified = clone();
  selfCoordinatorVerified.verifications[0].verifiedBy = "accessibility review coordinator";
  assert.equal(isValid(selfCoordinatorVerified), false);

  // A self-attested verification cannot close the finding it targets: the
  // finding's "verified" state becomes premature even though a "pass" outcome
  // is on record.
  const findingsWithAgentVerifier = validateArtifactSemantics(
    "accessibility-review-coordinator",
    agentVerified,
  );
  assert.ok(findingsWithAgentVerifier.some((item) => item.code === "premature_finding_state"));

  // Resolving every other finding cannot unlock readiness when the only
  // verification closing a finding is self-attested. Give the remaining open
  // finding its own passing, validly-verified verification so every other gate
  // is genuinely satisfied, and only the self-attested verifiedBy remains.
  const readyWithSelfAttestation = clone();
  readyWithSelfAttestation.verifications[0].verifiedBy = "the agent";
  readyWithSelfAttestation.verifications.push({
    id: "verification-error-announcement",
    findingRef: "finding-error-announcement-screenreader",
    remediationRef: null,
    verifiedBy: "assistive-technology-tester",
    verifiedAt: "2026-08-19",
    method: "assistive",
    outcome: "pass",
  });
  readyWithSelfAttestation.findings.find(
    (item) => item.id === "finding-error-announcement-screenreader",
  ).state = "verified";
  readyWithSelfAttestation.handoff.unresolvedFindingRefs = [];
  readyWithSelfAttestation.handoff.state = "ready";
  readyWithSelfAttestation.state = "ready";
  assert.equal(isValid(readyWithSelfAttestation), false);
  const bypassFindings = validateArtifactSemantics(
    "accessibility-review-coordinator",
    readyWithSelfAttestation,
  );
  assert.ok(bypassFindings.some((item) => item.code === "self_attested_verification"));
  assert.ok(bypassFindings.some((item) => item.code === "premature_finding_state"));

  // A legitimate human verifier title that merely contains the word
  // "coordinator" must not be rejected by the same narrow check.
  const legitimateVerifier = clone();
  legitimateVerifier.verifications[0].verifiedBy = "design system coordinator";
  assert.equal(isValid(legitimateVerifier), true);
});

test("accessibility review rejects a passing verification with remediationRef:null when its finding has a planned remediation", () => {
  // finding-error-announcement-screenreader has an existing "planned" (not
  // complete) remediation record. remediationRef:null must not let a passing
  // verification bypass that outstanding remediation work.
  const nullRemediationBypass = clone();
  nullRemediationBypass.verifications.push({
    id: "verification-error-announcement-bypass",
    findingRef: "finding-error-announcement-screenreader",
    remediationRef: null,
    verifiedBy: "assistive-technology-tester",
    verifiedAt: "2026-08-20",
    method: "assistive",
    outcome: "pass",
  });
  assert.equal(
    validateSchema(nullRemediationBypass),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(isValid(nullRemediationBypass), false);
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", nullRemediationBypass).some(
      (item) =>
        item.code === "premature_verification_pass" &&
        item.path === "verifications[1].remediationRef",
    ),
  );

  // A finding with no remediation records at all is unaffected: remediationRef
  // is legitimately null because there is nothing to reference.
  const legitimateNullRemediation = clone();
  legitimateNullRemediation.verifications.push({
    id: "verification-color-contrast-bypass",
    findingRef: "finding-color-contrast-secondary-button",
    remediationRef: null,
    verifiedBy: "assistive-technology-tester",
    verifiedAt: "2026-08-20",
    method: "manual",
    outcome: "pass",
  });
  assert.ok(
    !validateArtifactSemantics(
      "accessibility-review-coordinator",
      legitimateNullRemediation,
    ).some((item) => item.code === "premature_verification_pass"),
  );
});

test("accessibility review rejects a passing verification missing a trimmed verifiedAt timestamp", () => {
  const nullVerifiedAt = clone();
  nullVerifiedAt.verifications[0].verifiedAt = null;
  assert.equal(validateSchema(nullVerifiedAt), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(nullVerifiedAt), false);
  const nullFindings = validateArtifactSemantics("accessibility-review-coordinator", nullVerifiedAt);
  assert.ok(nullFindings.some((item) => item.code === "missing_verification_timestamp"));
  // Missing verifiedAt must also block the finding's own "verified" state, not
  // just flag the verification record in isolation.
  assert.ok(nullFindings.some((item) => item.code === "premature_finding_state"));

  const whitespaceVerifiedAt = clone();
  whitespaceVerifiedAt.verifications[0].verifiedAt = "   ";
  assert.equal(isValid(whitespaceVerifiedAt), false);
  assert.ok(
    validateArtifactSemantics("accessibility-review-coordinator", whitespaceVerifiedAt).some(
      (item) => item.code === "missing_verification_timestamp",
    ),
  );
});

test("validate-artifact CLI accepts the packaged accessibility-review-coordinator fixture", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "scripts", "validate-artifact.mjs"),
      "accessibility-review-coordinator",
      fixturePath,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready accessibility artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `accessibility-review-coordinator-cli-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "scripts", "validate-artifact.mjs"),
        "accessibility-review-coordinator",
        scratchPath,
      ],
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
