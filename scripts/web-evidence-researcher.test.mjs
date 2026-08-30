import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/web-evidence-researcher/schemas/claim-evidence-investigation-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/web-evidence-researcher/fixtures/claim-evidence-investigation-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../claws/web-evidence-researcher/templates/claim-evidence-investigation-ledger.md",
    import.meta.url,
  ),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("web-evidence-researcher", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function source(value, id) {
  return value.sources.find((item) => item.id === id);
}

function claim(value, id) {
  return value.claims.find((item) => item.id === id);
}

function evidence(value, id) {
  return value.evidence.find((item) => item.id === id);
}

function makeBlocked(value) {
  value.investigation.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "blocker-private-environment-review",
    kind: "blocker",
    description:
      "The Architecture Review Team must review approved private environment evidence before considering the public-web handoff.",
    owner: "Architecture Review Team",
    claimRefs: ["claim-rollout-readiness"],
    evidenceRefs: ["evidence-microsoft-readiness-limit"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-private-environment-review");
  value.handoff.blockerRefs = ["blocker-private-environment-review"];
  value.ownerReview.gapAndBlockerRefs.push("blocker-private-environment-review");
}

test("web evidence fixture is a complete private claim-evidence investigation", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.match(template, /zero-result search/u);
  assert.match(template, /derived page as independent corroboration/u);

  const zeroResult = clone();
  zeroResult.investigation.queries.push({
    id: "query-w3c-zero-result",
    authorityRef: "authority-w3c",
    query: "site:w3.org/TR approved bounded query with no matching result",
    executedAt: "2026-08-30T15:31:00Z",
    resultSourceRefs: [],
  });
  assert.equal(isValid(zeroResult), true, JSON.stringify(findings(zeroResult)));

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));
});

test("investigation control, authorities, query provenance, and source identity stay bounded", () => {
  const duplicate = clone();
  duplicate.sources[1].id = duplicate.sources[0].id;
  assertSchemaValid(duplicate);
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);

  const chronology = clone();
  chronology.investigation.run.completedAt = "2026-08-30T14:59:00Z";
  assertSchemaValid(chronology);
  assert.equal(hasFinding(chronology, "invalid_investigation_chronology"), true);

  const traversal = clone();
  traversal.investigation.destination = "outputs/../outside.md";
  traversal.handoff.destination = "outputs/../outside.md";
  assertSchemaValid(traversal);
  assert.equal(hasFinding(traversal, "unsafe_handoff_destination"), true);

  const queryOutsideRun = clone();
  queryOutsideRun.investigation.queries[0].executedAt = "2026-08-30T14:59:00Z";
  assertSchemaValid(queryOutsideRun);
  assert.equal(hasFinding(queryOutsideRun, "query_outside_investigation_run"), true);

  const wrongQueryAuthority = clone();
  wrongQueryAuthority.investigation.queries[0].resultSourceRefs = ["source-fido-ctap"];
  assertSchemaValid(wrongQueryAuthority);
  assert.equal(hasFinding(wrongQueryAuthority, "query_authority_mismatch"), true);

  const queryProvenance = clone();
  source(queryProvenance, "source-w3c-webauthn").queryRefs = ["query-fido-ctap"];
  assertSchemaValid(queryProvenance);
  assert.equal(hasFinding(queryProvenance, "invalid_query_provenance"), true);

  const missingQueryResult = clone();
  missingQueryResult.investigation.queries[0].resultSourceRefs = [];
  assertSchemaValid(missingQueryResult);
  assert.equal(hasFinding(missingQueryResult, "invalid_query_provenance"), true);

  const missingSourceQuery = clone();
  missingSourceQuery.investigation.queries.push({
    id: "query-microsoft-unacknowledged",
    authorityRef: "authority-microsoft",
    query: "site:learn.microsoft.com approved bounded duplicate result query",
    executedAt: "2026-08-30T15:31:00Z",
    resultSourceRefs: ["source-microsoft-security-key"],
  });
  assertSchemaValid(missingSourceQuery);
  assert.equal(hasFinding(missingSourceQuery, "invalid_query_provenance"), true);

  const unapprovedType = clone();
  source(unapprovedType, "source-w3c-webauthn").sourceType = "vendor-document";
  assertSchemaValid(unapprovedType);
  assert.equal(hasFinding(unapprovedType, "source_authority_mismatch"), true);

  const duplicateIdentity = clone();
  source(duplicateIdentity, "source-fido-ctap").authorityRef = "authority-w3c";
  source(duplicateIdentity, "source-fido-ctap").canonicalKey =
    source(duplicateIdentity, "source-w3c-webauthn").canonicalKey;
  assertSchemaValid(duplicateIdentity);
  assert.equal(hasFinding(duplicateIdentity, "duplicate_source_identity"), true);

  const sourceChronology = clone();
  source(sourceChronology, "source-w3c-webauthn").updatedAt = "2024-01-01T00:00:00Z";
  assertSchemaValid(sourceChronology);
  assert.equal(hasFinding(sourceChronology, "invalid_source_chronology"), true);
});

test("source URLs, derivation, freshness, and recheck state reject laundering", () => {
  for (const canonicalUrl of [
    "http://www.w3.org/TR/webauthn-3/",
    "https://www.w3.org/TR/webauthn-3/#private",
    "https://www.w3.org/TR/webauthn-3/?token=secret",
    "https://127.0.0.1/TR/webauthn-3/",
    "https://example.com/TR/webauthn-3/",
    "https://www.w3.org/"
  ]) {
    const unsafe = clone();
    source(unsafe, "source-w3c-webauthn").canonicalUrl = canonicalUrl;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_source_reference"), true, canonicalUrl);
  }

  const invalidPrimaryDerivation = clone();
  source(invalidPrimaryDerivation, "source-w3c-webauthn").derivedFromSourceRefs = [
    "source-fido-ctap",
  ];
  assertSchemaValid(invalidPrimaryDerivation);
  assert.equal(hasFinding(invalidPrimaryDerivation, "invalid_source_derivation"), true);

  const missingDerivedOrigin = clone();
  source(
    missingDerivedOrigin,
    "source-microsoft-passwordless-overview",
  ).derivedFromSourceRefs = [];
  assertSchemaValid(missingDerivedOrigin);
  assert.equal(hasFinding(missingDerivedOrigin, "invalid_source_derivation"), true);

  const stale = clone();
  source(stale, "source-w3c-webauthn").freshness = "stale";
  assertSchemaValid(stale);
  assert.equal(hasFinding(stale, "stale_current_source"), true);

  const recheckNeeded = clone();
  source(recheckNeeded, "source-w3c-webauthn").recheckState = "recheck-required";
  assertSchemaValid(recheckNeeded);
  assert.equal(hasFinding(recheckNeeded, "stale_current_source"), true);

  const aged = clone();
  source(aged, "source-w3c-webauthn").retrievedAt = "2026-08-20T15:06:00Z";
  assertSchemaValid(aged);
  assert.equal(hasFinding(aged, "stale_current_source"), true);
});

test("hypotheses, claims, evidence stances, and corroboration retain their source meaning", () => {
  const dangling = clone();
  claim(dangling, "claim-public-protocol-basis").evidenceRefs = ["evidence-missing"];
  assertSchemaValid(dangling);
  assert.equal(hasFinding(dangling, "dangling_reference"), true);

  const hypothesisMismatch = clone();
  claim(hypothesisMismatch, "claim-public-protocol-basis").hypothesisRef =
    "hypothesis-vendor-prerequisites";
  assertSchemaValid(hypothesisMismatch);
  assert.equal(hasFinding(hypothesisMismatch, "claim_hypothesis_mismatch"), true);

  const reverseHypothesisMismatch = clone();
  reverseHypothesisMismatch.hypotheses[1].claimRefs.push("claim-public-protocol-basis");
  assertSchemaValid(reverseHypothesisMismatch);
  assert.equal(hasFinding(reverseHypothesisMismatch, "claim_hypothesis_mismatch"), true);

  const evidenceMismatch = clone();
  claim(evidenceMismatch, "claim-public-protocol-basis").evidenceRefs = [
    "evidence-microsoft-prerequisites",
  ];
  claim(evidenceMismatch, "claim-public-protocol-basis").corroboration = {
    requiredIndependentSources: 0,
    independentEvidenceRefs: [],
  };
  assertSchemaValid(evidenceMismatch);
  assert.equal(hasFinding(evidenceMismatch, "claim_evidence_mismatch"), true);

  const assessmentMismatch = clone();
  evidence(assessmentMismatch, "evidence-w3c-protocol").stance = "refutes";
  evidence(assessmentMismatch, "evidence-fido-protocol").stance = "refutes";
  assertSchemaValid(assessmentMismatch);
  assert.equal(hasFinding(assessmentMismatch, "invalid_claim_assessment"), true);

  const unknownConfidence = clone();
  claim(unknownConfidence, "claim-rollout-readiness").confidence = "low";
  assertSchemaValid(unknownConfidence);
  assert.equal(hasFinding(unknownConfidence, "invalid_claim_assessment"), true);

  const unclassified = clone();
  claim(unclassified, "claim-public-protocol-basis").evidenceRefs =
    claim(unclassified, "claim-public-protocol-basis").evidenceRefs.filter(
      (id) => id !== "evidence-fido-protocol",
    );
  claim(unclassified, "claim-public-protocol-basis").corroboration = {
    requiredIndependentSources: 1,
    independentEvidenceRefs: ["evidence-w3c-protocol"],
  };
  assertSchemaValid(unclassified);
  assert.equal(hasFinding(unclassified, "unclassified_evidence"), true);

  const invalidStance = clone();
  evidence(invalidStance, "evidence-microsoft-context").stance = "supports";
  assertSchemaValid(invalidStance);
  assert.equal(hasFinding(invalidStance, "invalid_evidence_stance"), true);

  const launderedCorroboration = clone();
  source(launderedCorroboration, "source-fido-ctap").derivation = "derived";
  source(launderedCorroboration, "source-fido-ctap").derivedFromSourceRefs = [
    "source-w3c-webauthn",
  ];
  assertSchemaValid(launderedCorroboration);
  assert.equal(hasFinding(launderedCorroboration, "invalid_corroboration"), true);

  const duplicateOrigin = clone();
  source(duplicateOrigin, "source-fido-ctap").independenceKey =
    source(duplicateOrigin, "source-w3c-webauthn").independenceKey;
  assertSchemaValid(duplicateOrigin);
  assert.equal(hasFinding(duplicateOrigin, "invalid_corroboration"), true);

  const refuted = clone();
  claim(refuted, "claim-public-protocol-basis").assessment = "refuted";
  evidence(refuted, "evidence-w3c-protocol").stance = "refutes";
  evidence(refuted, "evidence-fido-protocol").stance = "refutes";
  assertSchemaValid(refuted);
  assert.equal(isValid(refuted), true, JSON.stringify(findings(refuted)));

  const mismatchedRefutation = clone();
  claim(mismatchedRefutation, "claim-public-protocol-basis").assessment = "refuted";
  evidence(mismatchedRefutation, "evidence-fido-protocol").stance = "refutes";
  assertSchemaValid(mismatchedRefutation);
  assert.equal(hasFinding(mismatchedRefutation, "invalid_corroboration"), true);

  const oversizedExcerpt = clone();
  evidence(oversizedExcerpt, "evidence-w3c-protocol").excerpt = "x".repeat(601);
  assert.equal(validateSchema(oversizedExcerpt), false);
});

test("conflicts, questions, gaps, and owner review remain explicit and owner-controlled", () => {
  const conflict = clone();
  conflict.conflicts[0].status = "open";
  assertSchemaValid(conflict);
  assert.equal(hasFinding(conflict, "invalid_conflict_state"), true);

  const question = clone();
  question.reviewQuestions[0].status = "open";
  assertSchemaValid(question);
  assert.equal(hasFinding(question, "incoherent_review_question"), true);

  const wrongGapOwner = clone();
  wrongGapOwner.gapsAndBlockers[0].owner = "Other Review Team";
  assertSchemaValid(wrongGapOwner);
  assert.equal(hasFinding(wrongGapOwner, "owner_mismatch"), true);

  const wrongHandoffOwner = clone();
  wrongHandoffOwner.handoff.owner = "Other Review Team";
  assertSchemaValid(wrongHandoffOwner);
  assert.equal(hasFinding(wrongHandoffOwner, "owner_mismatch"), true);

  const agentOwner = clone();
  agentOwner.investigation.decisionOwner = "Web Evidence Researcher";
  agentOwner.handoff.owner = "Web Evidence Researcher";
  agentOwner.ownerReview.owner = "Web Evidence Researcher";
  for (const item of [
    ...agentOwner.conflicts,
    ...agentOwner.reviewQuestions,
    ...agentOwner.gapsAndBlockers,
  ]) {
    item.owner = "Web Evidence Researcher";
  }
  assertSchemaValid(agentOwner);
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);

  for (const owner of ["GPT-5", "Claw", "language model"]) {
    const syntheticOwner = clone();
    syntheticOwner.investigation.decisionOwner = owner;
    assertSchemaValid(syntheticOwner);
    assert.equal(hasFinding(syntheticOwner, "agent_owned_authority"), true, owner);
  }

  for (const owner of [
    "UX Researcher Team",
    "Lead Researcher",
    "Agent Operations Team",
    "Assistant General Counsel",
  ]) {
    const humanOwner = clone();
    humanOwner.investigation.decisionOwner = owner;
    humanOwner.handoff.owner = owner;
    humanOwner.ownerReview.owner = owner;
    for (const item of [
      ...humanOwner.conflicts,
      ...humanOwner.reviewQuestions,
      ...humanOwner.gapsAndBlockers,
    ]) {
      item.owner = owner;
    }
    assertSchemaValid(humanOwner);
    assert.equal(hasFinding(humanOwner, "agent_owned_authority"), false, owner);
  }

  const incompleteOwnerReview = clone();
  incompleteOwnerReview.ownerReview.claimRefs.pop();
  assertSchemaValid(incompleteOwnerReview);
  assert.equal(hasFinding(incompleteOwnerReview, "incomplete_handoff"), true);

  const incoherentOwnerReview = clone();
  incoherentOwnerReview.ownerReview.status = "pending";
  assertSchemaValid(incoherentOwnerReview);
  assert.equal(hasFinding(incoherentOwnerReview, "incoherent_owner_review"), true);
});

test("private handoff cannot hide incomplete or unresolved work", () => {
  const privateMismatch = clone();
  privateMismatch.handoff.destination = "outputs/other-handoff.md";
  assertSchemaValid(privateMismatch);
  assert.equal(hasFinding(privateMismatch, "private_handoff_mismatch"), true);

  const incomplete = clone();
  incomplete.handoff.sourceRefs.pop();
  assertSchemaValid(incomplete);
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const blocked = clone();
  makeBlocked(blocked);
  blocked.handoff.blockerRefs = [];
  assertSchemaValid(blocked);
  assert.equal(hasFinding(blocked, "incomplete_blocked_handoff"), true);

  const inconsistent = clone();
  inconsistent.handoff.state = "draft";
  assertSchemaValid(inconsistent);
  assert.equal(hasFinding(inconsistent, "inconsistent_ready_state"), true);

  for (const mutate of [
    (value) => {
      claim(value, "claim-public-protocol-basis").status = "unresolved";
    },
    (value) => {
      value.hypotheses[0].status = "unresolved";
    },
    (value) => {
      value.conflicts[0].status = "open";
      value.conflicts[0].resolution = null;
    },
    (value) => {
      value.reviewQuestions[0].status = "open";
      value.reviewQuestions[0].resolution = null;
    },
    (value) => {
      value.gapsAndBlockers[0].status = "open";
    },
    (value) => {
      value.ownerReview.status = "pending";
      value.ownerReview.resolution = null;
    },
  ]) {
    const premature = clone();
    mutate(premature);
    assertSchemaValid(premature);
    assert.equal(hasFinding(premature, "premature_ready_state"), true);
  }
});

test("authority gates and normalized narrative safety resist action bypasses", () => {
  for (const action of fixture.blockedActions) {
    const missingTopLevel = clone();
    missingTopLevel.blockedActions = missingTopLevel.blockedActions.filter(
      (item) => item !== action,
    );
    assertSchemaValid(missingTopLevel);
    assert.equal(hasFinding(missingTopLevel, "missing_authority_gate"), true, action);

    const missingHandoff = clone();
    missingHandoff.handoff.prohibitedActions =
      missingHandoff.handoff.prohibitedActions.filter((item) => item !== action);
    assertSchemaValid(missingHandoff);
    assert.equal(hasFinding(missingHandoff, "missing_authority_gate"), true, action);
  }

  for (const narrative of [
    "Publish  an external report today.",
    "Do not publish an external report; however, contact an external authority.",
    "Do not publish an external report, but change an account.",
    "Do not contact an external authority: fabricate a claim.",
    "Expose the token to an external service.",
    "Bypass\u00a0access controls for the missing record.",
    "Give a legal conclusion from these sources.",
    "The update establishes a causal effect on deployment outcomes.",
    "Automatically change the decision without owner review."
  ]) {
    const unsafe = clone();
    unsafe.claims[0].decisionImplication = narrative;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative);
  }

  for (const narrative of [
    "We do not publish an external report or contact an external authority.",
    "No consensus is inferred from the retained source records.",
    "The source change does not establish a causal effect on deployment outcomes.",
    "We retain the private handoff without changing an account."
  ]) {
    const safe = clone();
    safe.claims[0].decisionImplication = narrative;
    assertSchemaValid(safe);
    assert.equal(hasFinding(safe, "unsafe_narrative_content"), false, narrative);
  }
});
