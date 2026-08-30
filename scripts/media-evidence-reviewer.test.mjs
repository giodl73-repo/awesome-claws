import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/media-evidence-reviewer/schemas/media-evidence.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/media-evidence-reviewer/fixtures/media-evidence.example.json",
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
    validateArtifactSemantics("media-evidence-reviewer", value).length === 0
  );
}

test("media evidence fixture preserves authority, timestamps, and ambiguity", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("media-evidence-reviewer", fixture), []);
});

test("media evidence rejects invalid scope, chronology, paths, and source identity", () => {
  const invalidWindow = clone();
  invalidWindow.review.windowEndSeconds = 2500;
  assert.equal(isValid(invalidWindow), false);

  const futureSource = clone();
  futureSource.sources[0].capturedAt = "2026-08-29T16:00:00-05:00";
  assert.equal(isValid(futureSource), false);

  const wrongAuthority = clone();
  wrongAuthority.sources[1].authority = "reviewer";
  assert.equal(isValid(wrongAuthority), false);

  const wrongAuthorityRef = clone();
  wrongAuthorityRef.authority.consentSourceRef = "src-retention";
  assert.equal(isValid(wrongAuthorityRef), false);

  const outsideWindow = clone();
  outsideWindow.evidence[0].startSeconds = 700;
  assert.equal(isValid(outsideWindow), false);

  const traversalPath = clone();
  traversalPath.evidence[0].path = "evidence/../private/frame.png";
  assert.equal(isValid(traversalPath), false);

  const traversalDestination = clone();
  traversalDestination.review.destination = "outputs/../../../private/report.md";
  assert.equal(isValid(traversalDestination), false);

  const nonMediaSource = clone();
  nonMediaSource.evidence[0].sourceRef = "src-consent";
  assert.equal(isValid(nonMediaSource), false);
});

test("media evidence preserves transcript and observation confidence", () => {
  const frameTranscript = clone();
  frameTranscript.evidence[0].transcript = {
    text: "Unexpected transcript",
    confidence: 0.99,
    speakerLabel: "participant",
    ambiguity: null,
  };
  assert.equal(isValid(frameTranscript), false);

  const missingTranscript = clone();
  missingTranscript.evidence[1].transcript = null;
  assert.equal(isValid(missingTranscript), false);

  const hiddenAmbiguity = clone();
  hiddenAmbiguity.evidence[4].transcript.ambiguity = null;
  assert.equal(isValid(hiddenAmbiguity), false);

  const partialSupport = clone();
  partialSupport.observations[2].state = "supported";
  assert.equal(isValid(partialSupport), false);

  const prohibitedInference = clone();
  prohibitedInference.observations[2].kind = "intent";
  assert.equal(isValid(prohibitedInference), false);

  const unsupportedQuote = clone();
  unsupportedQuote.observations[2].exactQuote = true;
  assert.equal(isValid(unsupportedQuote), false);

  const missingLimitation = clone();
  missingLimitation.observations[2].limitations = [];
  assert.equal(isValid(missingLimitation), false);
});

test("media evidence requires complete owner-controlled readiness", () => {
  const missingConsent = clone();
  missingConsent.authority.consentState = "missing";
  assert.equal(isValid(missingConsent), false);

  const missingUse = clone();
  missingUse.authority.authorizedUses.pop();
  assert.equal(isValid(missingUse), false);

  const pendingRedaction = clone();
  pendingRedaction.evidence[0].redactionState = "pending";
  assert.equal(isValid(pendingRedaction), false);

  const missingSensitiveRedaction = clone();
  missingSensitiveRedaction.evidence[0].redactionState = "not-required";
  assert.equal(isValid(missingSensitiveRedaction), false);

  const unapprovedUnredacted = clone();
  unapprovedUnredacted.evidence[0].redactionState = "approved-unredacted";
  assert.equal(isValid(unapprovedUnredacted), false);

  const approvedUnredacted = clone();
  approvedUnredacted.evidence[0].redactionState = "approved-unredacted";
  approvedUnredacted.evidence[0].redactionApprovalSourceRef = "src-consent";
  assert.equal(isValid(approvedUnredacted), true);

  const staleApproval = clone(approvedUnredacted);
  staleApproval.sources[2].integrity = "unverified";
  assert.equal(
    validateArtifactSemantics("media-evidence-reviewer", staleApproval).some(
      (item) => item.code === "invalid_redaction_approval",
    ),
    true,
  );

  const incompleteHandoff = clone();
  incompleteHandoff.handoff.observationRefs.pop();
  assert.equal(isValid(incompleteHandoff), false);

  const ownerMismatch = clone();
  ownerMismatch.handoff.owner = "Another owner";
  assert.equal(isValid(ownerMismatch), false);

  const agentOwned = clone();
  agentOwned.review.owner = "Media evidence reviewer";
  agentOwned.handoff.owner = "Media evidence reviewer";
  assert.equal(isValid(agentOwned), false);

  const blocked = clone();
  blocked.observations[2].kind = "intent";
  blocked.observations[2].state = "blocked";
  blocked.review.state = "blocked";
  blocked.handoff.state = "blocked";
  blocked.handoff.blockingObservationRefs = ["observation-ambiguous-return"];
  assert.equal(isValid(blocked), true);

  const missingBlocker = clone(blocked);
  missingBlocker.handoff.blockingObservationRefs = [];
  assert.equal(isValid(missingBlocker), false);
});

test("media evidence requires every authority gate", () => {
  for (const action of fixture.blockedActions) {
    const missingGate = clone();
    missingGate.blockedActions = missingGate.blockedActions.filter(
      (item) => item !== action,
    );
    assert.equal(
      validateArtifactSemantics("media-evidence-reviewer", missingGate).some(
        (item) => item.code === "missing_authority_gate",
      ),
      true,
      action,
    );
  }
});
