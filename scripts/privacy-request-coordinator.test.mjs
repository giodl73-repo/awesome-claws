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
  new URL("../claws/privacy-request-coordinator/fixtures/privacy-request.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/privacy-request-coordinator/schemas/privacy-request.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/privacy-request-coordinator/fixtures/privacy-request.example.json",
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
    validateArtifactSemantics("privacy-request-coordinator", value).length === 0
  );
}

test("privacy request fixture keeps verification, holds, and evidence consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("privacy-request-coordinator", fixture), []);
});

test("privacy request rejects unverified disclosure states and raw personal data", () => {
  const falseVerification = clone();
  falseVerification.subject.verifiedBy = null;
  falseVerification.subject.verifiedAt = null;
  assert.equal(isValid(falseVerification), false);

  const rawEmail = clone();
  rawEmail.holds[0].reason = "Contact the requester at pat.requester@example.com about the hold.";
  assert.equal(isValid(rawEmail), false);

  const rawSsn = clone();
  rawSsn.responseHandoff.summary = "Subject identifier 123-45-6789 remains under review.";
  assert.equal(isValid(rawSsn), false);

  const unrestrictedSource = clone();
  unrestrictedSource.sources[0].ref = "https://internal.example.com/raw-export.csv";
  assert.equal(isValid(unrestrictedSource), false);
});

test("privacy request rejects unapproved holds, exemptions, and dangling references", () => {
  const unapprovedHold = clone();
  unapprovedHold.holds[0].approvedBy = "";
  assert.equal(isValid(unapprovedHold), false);

  const unapprovedExemption = clone();
  unapprovedExemption.exemptions[0].approvedBy = "";
  assert.equal(isValid(unapprovedExemption), false);

  const danglingHoldRef = clone();
  danglingHoldRef.systems[1].holdRef = "hold-does-not-exist";
  assert.equal(isValid(danglingHoldRef), false);

  const duplicateSystemId = clone();
  duplicateSystemId.systems.push({ ...clone().systems[0] });
  assert.equal(isValid(duplicateSystemId), false);
});

test("privacy request rejects an unmodeled 'closed' hold status used to bypass readiness", () => {
  const unknownHoldStatus = clone();
  unknownHoldStatus.holds[0].status = "closed";
  assert.equal(validateSchema(unknownHoldStatus), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownHoldStatus), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", unknownHoldStatus).some(
      (item) => item.code === "unknown_hold_status",
    ),
  );

  // Only the modeled "released" status may be excluded from
  // readiness-blocking; an unrecognized status like "closed" must fail closed
  // even after every other blocker is resolved.
  const closedHoldReadyBypass = clone();
  closedHoldReadyBypass.holds[0].status = "closed";
  closedHoldReadyBypass.systems[2].searchStatus = "complete";
  closedHoldReadyBypass.systems[2].recordsFound = false;
  for (const gate of closedHoldReadyBypass.reviewGates) {
    gate.status = "closed";
  }
  closedHoldReadyBypass.responseHandoff.state = "ready";
  closedHoldReadyBypass.responseHandoff.unresolvedRefs = [];
  assert.equal(isValid(closedHoldReadyBypass), false);
  const bypassFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    closedHoldReadyBypass,
  );
  assert.ok(bypassFindings.some((item) => item.code === "unknown_hold_status"));
  assert.ok(bypassFindings.some((item) => item.code === "premature_response_ready"));
});

test("privacy request rejects an unmodeled review-gate status and fails closed for readiness", () => {
  const unknownGateStatus = clone();
  unknownGateStatus.reviewGates[0].status = "escalated";
  assert.equal(validateSchema(unknownGateStatus), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownGateStatus), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", unknownGateStatus).some(
      (item) => item.code === "unknown_review_gate_status",
    ),
  );

  // An unrecognized gate status must still count as blocking (not the
  // modeled "closed"), so it stays in responseHandoff.unresolvedRefs and the
  // response cannot be marked ready.
  const gateReadyBypass = clone();
  gateReadyBypass.reviewGates[0].status = "escalated";
  gateReadyBypass.reviewGates[1].status = "closed";
  gateReadyBypass.holds[0].status = "released";
  gateReadyBypass.systems[2].searchStatus = "complete";
  gateReadyBypass.systems[2].recordsFound = false;
  gateReadyBypass.responseHandoff.unresolvedRefs = ["gate-legal-hold-review"];
  gateReadyBypass.responseHandoff.state = "ready";
  assert.equal(isValid(gateReadyBypass), false);
  const gateBypassFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    gateReadyBypass,
  );
  assert.ok(gateBypassFindings.some((item) => item.code === "unknown_review_gate_status"));
  assert.ok(gateBypassFindings.some((item) => item.code === "premature_response_ready"));
});

test("privacy request rejects a completed search with a null/unknown recordsFound result and fails closed for readiness", () => {
  const nullRecordsFound = clone();
  nullRecordsFound.systems[2].searchStatus = "complete";
  nullRecordsFound.systems[2].recordsFound = null;
  assert.equal(validateSchema(nullRecordsFound), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(nullRecordsFound), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", nullRecordsFound).some(
      (item) => item.code === "invalid_search_result",
    ),
  );

  // Resolve every other blocker so the only remaining gap is the marketing
  // CRM search reporting "complete" with a null (not true/false) result.
  const readyBypass = clone();
  readyBypass.systems[2].searchStatus = "complete";
  readyBypass.systems[2].recordsFound = null;
  readyBypass.holds[0].status = "released";
  for (const gate of readyBypass.reviewGates) {
    gate.status = "closed";
  }
  readyBypass.responseHandoff.state = "ready";
  readyBypass.responseHandoff.unresolvedRefs = [];
  assert.equal(isValid(readyBypass), false);
  const bypassFindings = validateArtifactSemantics("privacy-request-coordinator", readyBypass);
  assert.ok(bypassFindings.some((item) => item.code === "invalid_search_result"));
  assert.ok(bypassFindings.some((item) => item.code === "premature_response_ready"));
});

test("privacy request rejects premature readiness and missing authority gates", () => {
  const prematureReady = clone();
  prematureReady.responseHandoff.state = "ready";
  prematureReady.responseHandoff.unresolvedRefs = [];
  assert.equal(isValid(prematureReady), false);

  const agentOwner = clone();
  agentOwner.responseHandoff.owner = "the agent";
  assert.equal(isValid(agentOwner), false);

  const missingGate = clone();
  missingGate.responseHandoff.prohibitedActions =
    missingGate.responseHandoff.prohibitedActions.filter(
      (action) => action !== "disclose-personal-data",
    );
  assert.equal(isValid(missingGate), false);

  const unauthorizedNarrative = clone();
  unauthorizedNarrative.responseHandoff.summary =
    "The final response was sent to the requester and the records were deleted.";
  assert.equal(isValid(unauthorizedNarrative), false);
});

test("privacy request rejects agent-named hold and exemption approvers", () => {
  const agentApprovedHold = clone();
  agentApprovedHold.holds[0].approvedBy = "the agent";
  assert.equal(isValid(agentApprovedHold), false);

  const agentApprovedExemption = clone();
  agentApprovedExemption.exemptions[0].approvedBy = "the agent";
  assert.equal(isValid(agentApprovedExemption), false);
});

test("privacy request rejects a ready handoff before identity verification completes", () => {
  const pendingVerificationReady = clone();
  pendingVerificationReady.verificationState = "pending";
  pendingVerificationReady.subject.verifiedBy = null;
  pendingVerificationReady.subject.verifiedAt = null;
  pendingVerificationReady.systems[2].searchStatus = "complete";
  pendingVerificationReady.systems[2].recordsFound = false;
  pendingVerificationReady.holds[0].status = "released";
  for (const gate of pendingVerificationReady.reviewGates) {
    gate.status = "closed";
  }
  pendingVerificationReady.responseHandoff.state = "ready";
  pendingVerificationReady.responseHandoff.unresolvedRefs = [];
  // Every gate, hold, and system search is otherwise resolved, but the requester's
  // identity is still only "pending" verification, so the handoff cannot be ready.
  assert.equal(isValid(pendingVerificationReady), false);
});

test("privacy request stays total over schema-valid records missing optional sections", () => {
  const partial = {
    requestId: "privacy-req-partial",
    requestType: "access",
    receivedAt: "2026-01-01",
    verificationState: "pending",
    deadline: "2026-01-31",
    systems: [],
  };
  assert.equal(validateSchema(partial), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("privacy-request-coordinator", partial));
  assert.ok(validateArtifactSemantics("privacy-request-coordinator", partial).length > 0);
});

test("privacy request rejects the package's own role name as a hold or exemption approver", () => {
  const selfApprovedHold = clone();
  selfApprovedHold.holds[0].approvedBy = "privacy request coordinator";
  assert.equal(isValid(selfApprovedHold), false);

  const selfApprovedExemption = clone();
  selfApprovedExemption.exemptions[0].approvedBy = "privacy request coordinator";
  assert.equal(isValid(selfApprovedExemption), false);

  // A legitimate human coordinator title that merely contains the word
  // "coordinator" must not be rejected by the same check.
  const legitimateCoordinator = clone();
  legitimateCoordinator.holds[0].approvedBy = "records retention coordinator";
  assert.equal(isValid(legitimateCoordinator), true);
});

test("privacy request rejects a ready handoff when evidence-source coverage is removed for a system that still reports records found", () => {
  const missingSourceCoverage = clone();
  // Resolve every other blocker so the only remaining gap is evidence coverage.
  missingSourceCoverage.systems[2].searchStatus = "complete";
  missingSourceCoverage.systems[2].recordsFound = false;
  missingSourceCoverage.holds[0].status = "released";
  for (const gate of missingSourceCoverage.reviewGates) {
    gate.status = "closed";
  }
  // Remove the controlled source coverage for a system that still reports
  // recordsFound true; the search itself remains complete.
  missingSourceCoverage.sources = missingSourceCoverage.sources.filter(
    (source) => source.systemRef !== "system-support-ticketing",
  );
  missingSourceCoverage.responseHandoff.state = "ready";
  missingSourceCoverage.responseHandoff.unresolvedRefs = [];
  assert.equal(isValid(missingSourceCoverage), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", missingSourceCoverage).some(
      (item) => item.code === "missing_system_evidence_coverage",
    ),
  );
});

test("privacy request stays total when arrays contain null or non-object members", () => {
  const nullSystems = clone();
  nullSystems.systems = [null];
  assert.equal(validateSchema(nullSystems), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("privacy-request-coordinator", nullSystems));
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", nullSystems).some(
      (item) => item.code === "invalid_array_record" && item.path === "systems[0]",
    ),
  );

  const nullOtherArrays = clone();
  nullOtherArrays.holds = [null];
  nullOtherArrays.exemptions = [null];
  nullOtherArrays.sources = [null];
  nullOtherArrays.reviewGates = [null];
  nullOtherArrays.reviewQuestions = [null];
  assert.doesNotThrow(() => validateArtifactSemantics("privacy-request-coordinator", nullOtherArrays));
  assert.ok(validateArtifactSemantics("privacy-request-coordinator", nullOtherArrays).length > 0);
});

test("privacy request stays total when schema-valid reviewGates/reviewQuestions entries omit their reference lists", () => {
  // reviewGates and reviewQuestions items have no declared schema shape (the
  // top-level schema only constrains requestId/requestType/receivedAt/
  // verificationState/deadline/systems), so `{}` is schema-valid and leaves
  // `blockingRefs`/`refs` undefined. The semantic validator must not throw when
  // it tries to resolve those (absent) reference lists.
  const malformedGate = clone();
  malformedGate.reviewGates = [{}];
  assert.equal(validateSchema(malformedGate), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("privacy-request-coordinator", malformedGate));

  const malformedQuestion = clone();
  malformedQuestion.reviewQuestions = [{}];
  assert.equal(validateSchema(malformedQuestion), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedQuestion),
  );
});

test("privacy request stays total when responseHandoff.prohibitedActions is a non-array object", () => {
  // responseHandoff.prohibitedActions is a bare `{"type":"array"}` field, so
  // `{}` is schema-valid. Calling `.includes()` on it directly would throw;
  // the validator must instead flag it and safely treat it as an empty list,
  // so every required action still trips its own missing_authority_gate
  // finding.
  const malformedProhibitedActions = clone();
  malformedProhibitedActions.responseHandoff.prohibitedActions = {};
  assert.equal(
    validateSchema(malformedProhibitedActions),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedProhibitedActions),
  );
  const malformedFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    malformedProhibitedActions,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_string_list"));
  assert.ok(
    malformedFindings.filter((item) => item.code === "missing_authority_gate").length >= 6,
  );
  assert.equal(isValid(malformedProhibitedActions), false);
});

test("privacy request stays total when responseHandoff.unresolvedRefs is a non-array object", () => {
  // responseHandoff.unresolvedRefs is threaded through requireReferences(),
  // which fans out to both uniqueFindings()/duplicates() (duplicate check)
  // and referenceFindings() (resolution check). A non-array-but-truthy value
  // like `{}` is schema-valid and slips past the `?? []` fallback;
  // duplicates() used to call `.filter()` on it directly and throw before it
  // could ever reach referenceFindings()'s own totality guard.
  const malformedUnresolvedRefs = clone();
  malformedUnresolvedRefs.responseHandoff.unresolvedRefs = {};
  assert.equal(
    validateSchema(malformedUnresolvedRefs),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedUnresolvedRefs),
  );
  const malformedFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    malformedUnresolvedRefs,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  // The shared duplicates() totality fix must not also emit its own malformed
  // finding on top of referenceFindings()'s invalid_reference_list for the
  // very same field.
  assert.equal(
    malformedFindings.filter(
      (item) =>
        item.path === "responseHandoff.unresolvedRefs" && item.code === "duplicate_reference",
    ).length,
    0,
  );
  assert.equal(isValid(malformedUnresolvedRefs), false);
});

test("privacy request stays total when responseHandoff.unresolvedRefs is a matching-length non-array object", () => {
  // sameSet() previously skipped straight to `left.length === right.length`
  // and `new Set(left)`: a schema-valid non-array object whose own `length`
  // property happens to match the open-gate count (e.g. `{ length: 2 }`)
  // would pass the length check but throw once passed to `new Set(...)`,
  // which requires an iterable. sameSet() must fail closed (not equal)
  // whenever either side isn't actually an array, before any length/Set work.
  const malformedUnresolvedRefs = clone();
  const openGateCount = malformedUnresolvedRefs.reviewGates.filter(
    (gate) => gate.status !== "closed",
  ).length;
  malformedUnresolvedRefs.responseHandoff.unresolvedRefs = { length: openGateCount };
  assert.equal(
    validateSchema(malformedUnresolvedRefs),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedUnresolvedRefs),
  );
  const malformedFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    malformedUnresolvedRefs,
  );
  assert.ok(malformedFindings.some((item) => item.code === "invalid_reference_list"));
  assert.ok(
    malformedFindings.some(
      (item) =>
        item.code === "incomplete_handoff" && item.path === "responseHandoff.unresolvedRefs",
    ),
  );
  assert.equal(isValid(malformedUnresolvedRefs), false);
});

test("privacy request rejects a missing or blank owner even in an otherwise ready-shaped case", () => {
  // Both the case's accountable owner (value.owner) and the response
  // handoff's owner must independently carry a trimmed, non-empty,
  // accountable identity: neither isAgentIdentityName() nor the self-role
  // pattern reject undefined/blank strings, so a missing or whitespace-only
  // owner must be checked explicitly and must block a clean (zero-finding)
  // result.
  const blankHandoffOwner = clone();
  blankHandoffOwner.responseHandoff.owner = "   ";
  assert.equal(validateSchema(blankHandoffOwner), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", blankHandoffOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(blankHandoffOwner), false);

  const missingAccountableOwner = clone();
  delete missingAccountableOwner.owner;
  assert.equal(
    validateSchema(missingAccountableOwner),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", missingAccountableOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
  assert.equal(isValid(missingAccountableOwner), false);
});

test("privacy request rejects a self-attested identity verification and blocks readiness", () => {
  const agentVerified = clone();
  agentVerified.subject.verifiedBy = "the agent";
  assert.equal(isValid(agentVerified), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", agentVerified).some(
      (item) => item.code === "self_attested_identity_verification",
    ),
  );

  const selfCoordinatorVerified = clone();
  selfCoordinatorVerified.subject.verifiedBy = "privacy request coordinator";
  assert.equal(isValid(selfCoordinatorVerified), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", selfCoordinatorVerified).some(
      (item) => item.code === "self_attested_identity_verification",
    ),
  );

  // Resolving every other blocker cannot unlock readiness when the verifier is
  // the package's own role: verificationState is falsified to "verified" to
  // confirm the ready gate checks the derived verifier identity, not merely the
  // raw verificationState field.
  const readyWithSelfAttestation = clone();
  readyWithSelfAttestation.subject.verifiedBy = "the agent";
  readyWithSelfAttestation.verificationState = "verified";
  readyWithSelfAttestation.systems[2].searchStatus = "complete";
  readyWithSelfAttestation.systems[2].recordsFound = false;
  readyWithSelfAttestation.holds[0].status = "released";
  for (const gate of readyWithSelfAttestation.reviewGates) {
    gate.status = "closed";
  }
  readyWithSelfAttestation.responseHandoff.state = "ready";
  readyWithSelfAttestation.responseHandoff.unresolvedRefs = [];
  assert.equal(isValid(readyWithSelfAttestation), false);
  const bypassFindings = validateArtifactSemantics(
    "privacy-request-coordinator",
    readyWithSelfAttestation,
  );
  assert.ok(bypassFindings.some((item) => item.code === "self_attested_identity_verification"));
  assert.ok(bypassFindings.some((item) => item.code === "premature_response_ready"));

  // A legitimate human verifier title that merely contains the word
  // "coordinator" must not be rejected by the same narrow check.
  const legitimateVerifier = clone();
  legitimateVerifier.subject.verifiedBy = "identity verification coordinator";
  assert.equal(isValid(legitimateVerifier), true);
});

test("privacy request rejects whitespace-only verifiedBy/verifiedAt metadata in an otherwise ready case", () => {
  // Boolean("   ") is true, so a naive presence check would let whitespace-only
  // verification metadata masquerade as a real verified identity. Resolve every
  // other blocker so this is the only remaining gap.
  function resolveOtherBlockers(target) {
    target.systems[2].searchStatus = "complete";
    target.systems[2].recordsFound = false;
    target.holds[0].status = "released";
    for (const gate of target.reviewGates) {
      gate.status = "closed";
    }
    target.responseHandoff.state = "ready";
    target.responseHandoff.unresolvedRefs = [];
  }

  const whitespaceVerifiedBy = clone();
  whitespaceVerifiedBy.subject.verifiedBy = "   ";
  resolveOtherBlockers(whitespaceVerifiedBy);
  assert.equal(
    validateSchema(whitespaceVerifiedBy),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(isValid(whitespaceVerifiedBy), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", whitespaceVerifiedBy).some(
      (item) => item.code === "premature_response_ready",
    ),
  );

  const whitespaceVerifiedAt = clone();
  whitespaceVerifiedAt.subject.verifiedAt = "   ";
  resolveOtherBlockers(whitespaceVerifiedAt);
  assert.equal(isValid(whitespaceVerifiedAt), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", whitespaceVerifiedAt).some(
      (item) => item.code === "premature_response_ready",
    ),
  );
});

test("privacy request rejects a system whose hold or exemption reference resolves to a different system", () => {
  const crossSystemHold = clone();
  // hold-billing-dispute is scoped to system-billing-platform; borrowing it for
  // system-support-ticketing must not be accepted even though the id resolves.
  crossSystemHold.systems[0].holdRef = "hold-billing-dispute";
  assert.equal(validateSchema(crossSystemHold), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(crossSystemHold), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", crossSystemHold).some(
      (item) => item.code === "inconsistent_system_reference" && item.path === "systems[0].holdRef",
    ),
  );

  const crossSystemExemption = clone();
  // exemption-fraud-records is scoped to system-support-ticketing; borrowing it
  // for system-billing-platform must likewise be rejected.
  crossSystemExemption.systems[1].exemptionRef = "exemption-fraud-records";
  assert.equal(
    validateSchema(crossSystemExemption),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(isValid(crossSystemExemption), false);
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", crossSystemExemption).some(
      (item) =>
        item.code === "inconsistent_system_reference" && item.path === "systems[1].exemptionRef",
    ),
  );

  // A dangling reference (one that does not resolve at all) must still be
  // reported as dangling_reference, not confused with the new cross-system check.
  const danglingExemption = clone();
  danglingExemption.systems[1].exemptionRef = "exemption-does-not-exist";
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", danglingExemption).some(
      (item) => item.code === "dangling_reference" && item.path === "systems[1].exemptionRef",
    ),
  );
});

test("validate-artifact CLI accepts the packaged privacy-request-coordinator fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "privacy-request-coordinator", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready privacy artifact", async () => {
  const prematureReady = clone();
  prematureReady.responseHandoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(
    scratchDir,
    `privacy-request-coordinator-cli-negative-${process.pid}.json`,
  );
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "privacy-request-coordinator", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_response_ready"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});

test("privacy request rejects a timestamp receivedAt that falls after an earlier deadline instead of silently bypassing chronology", () => {
  // The prior check force-appended "T00:00:00Z"/"T23:59:59Z" to both fields,
  // so a receivedAt that already carries a time component (e.g. an ISO
  // timestamp rather than a bare date) produced a doubled, unparseable
  // string whose Date.parse result is NaN -- silently skipping the
  // comparison. Late in the received day, after an earlier bare-date
  // deadline, is exactly the case that must not bypass the check.
  const timestampReceivedAt = clone();
  timestampReceivedAt.receivedAt = "2026-09-09T23:30:00Z";
  timestampReceivedAt.deadline = "2026-09-08";
  assert.equal(
    validateSchema(timestampReceivedAt),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", timestampReceivedAt),
  );
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", timestampReceivedAt).some(
      (item) => item.code === "invalid_deadline_chronology",
    ),
  );
  assert.equal(isValid(timestampReceivedAt), false);

  // A legitimate ISO timestamp receivedAt that lands on or before the
  // deadline (compared at end-of-day for a bare date) must still validate
  // cleanly -- the fix must not turn every timestamp receivedAt into a
  // false positive.
  const timestampReceivedAtOnTime = clone();
  timestampReceivedAtOnTime.receivedAt = "2026-08-10T09:00:00Z";
  assert.equal(
    validateSchema(timestampReceivedAtOnTime),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.deepEqual(
    validateArtifactSemantics("privacy-request-coordinator", timestampReceivedAtOnTime),
    [],
  );
});

test("privacy request stays total and fails closed for malformed receivedAt/deadline chronology fields", () => {
  const malformedReceivedAt = clone();
  malformedReceivedAt.receivedAt = "not-a-timestamp";
  assert.equal(
    validateSchema(malformedReceivedAt),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedReceivedAt),
  );
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", malformedReceivedAt).some(
      (item) => item.code === "invalid_deadline_chronology",
    ),
  );
  assert.equal(isValid(malformedReceivedAt), false);

  const malformedDeadline = clone();
  malformedDeadline.deadline = "not-a-date";
  assert.equal(validateSchema(malformedDeadline), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() =>
    validateArtifactSemantics("privacy-request-coordinator", malformedDeadline),
  );
  assert.ok(
    validateArtifactSemantics("privacy-request-coordinator", malformedDeadline).some(
      (item) => item.code === "invalid_deadline_chronology",
    ),
  );
  assert.equal(isValid(malformedDeadline), false);
});
