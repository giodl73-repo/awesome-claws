import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/research-scout/schemas/research-evidence-delta.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/research-scout/fixtures/research-evidence-delta.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL("../claws/research-scout/templates/research-evidence-delta.md", import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("research-scout", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function findingFor(value, code) {
  return findings(value).find((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function source(value, id) {
  return value.sources.find((item) => item.id === id);
}

function makePublicationSupersession(value) {
  const preprintSource = source(value, "source-arxiv-followup");
  preprintSource.publishedAt = "2025-07-15T00:00:00Z";
  preprintSource.updatedAt = "2025-07-15T00:00:00Z";

  const versionOfRecordSource = {
    ...structuredClone(source(value, "source-crossref-mobile")),
    id: "source-crossref-followup",
    persistentId: {
      kind: "doi",
      value: "10.1001/jama.2025.9999",
    },
    canonicalUrl: "https://api.crossref.org/works/10.1001%2Fjama.2025.9999",
    title: "Representative peer-reviewed follow-up record",
    publishedAt: "2025-08-20T00:00:00Z",
    updatedAt: "2025-08-20T00:00:00Z",
    retrievedAt: "2025-08-29T18:17:00Z",
    publicationState: "version-of-record",
    version: "version-of-record",
    supersedesSourceRef: "source-arxiv-followup",
    correctsSourceRef: null,
    retractsSourceRef: null,
    digest: `sha256:${"a".repeat(64)}`,
    screeningRationale:
      "The public version of record supersedes the included preprint for the same evidence item.",
    scope: "Current peer-reviewed version of the included preprint.",
  };
  const newPreprintSource = {
    ...structuredClone(preprintSource),
    id: "source-arxiv-new",
    persistentId: {
      kind: "arxiv",
      value: "2508.54321",
    },
    canonicalUrl: "https://arxiv.org/abs/2508.54321",
    title: "Representative new preprint record",
    publishedAt: "2025-08-21T00:00:00Z",
    updatedAt: "2025-08-21T00:00:00Z",
    retrievedAt: "2025-08-29T18:18:00Z",
    version: "v1",
    digest: `sha256:${"b".repeat(64)}`,
    scope: "New preprint retained separately from the superseded record.",
  };
  value.sources.push(versionOfRecordSource, newPreprintSource);
  value.watch.protocol.queries
    .find((item) => item.authorityRef === "authority-arxiv")
    .resultSourceRefs.push("source-arxiv-new");
  value.watch.protocol.queries
    .find((item) => item.authorityRef === "authority-crossref")
    .resultSourceRefs.push("source-crossref-followup");

  const supersededEvidence = value.evidenceItems.find(
    (item) => item.id === "evidence-followup-preprint",
  );
  supersededEvidence.persistentIds.push({
    kind: "doi",
    value: "10.1001/jama.2025.9999",
  });
  supersededEvidence.sourceRefs.push("source-crossref-followup");
  supersededEvidence.publicationState = "version-of-record";
  supersededEvidence.lifecycle.push({
    state: "version-of-record",
    observedAt: "2025-08-20T00:00:00Z",
    sourceRef: "source-crossref-followup",
  });

  const newEvidence = structuredClone(supersededEvidence);
  newEvidence.id = "evidence-new-preprint";
  newEvidence.deduplicationKey = "study-new-preprint-2025";
  newEvidence.persistentIds = [
    {
      kind: "arxiv",
      value: "2508.54321",
    },
  ];
  newEvidence.sourceRefs = ["source-arxiv-new"];
  newEvidence.publicationState = "preprint";
  newEvidence.lifecycle = [
    {
      state: "preprint",
      observedAt: "2025-08-21T00:00:00Z",
      sourceRef: "source-arxiv-new",
    },
  ];
  newEvidence.claimLinks[0].id = "claim-new-preprint-method";
  newEvidence.claimLinks[0].sourceRefs = ["source-arxiv-new"];
  value.evidenceItems.push(newEvidence);

  value.watch.baseline.sourceRefs.push("source-arxiv-followup");
  value.watch.baseline.evidenceItemRefs.push("evidence-followup-preprint");
  value.deltas.find((item) => item.id === "delta-new-preprint").evidenceItemRefs = [
    "evidence-new-preprint",
  ];
  const updatedDelta = value.deltas.find((item) => item.id === "delta-trial-update");
  updatedDelta.evidenceItemRefs = ["evidence-followup-preprint"];
  updatedDelta.baselineEvidenceItemRefs = ["evidence-followup-preprint"];
  value.handoff.sourceRefs.push("source-crossref-followup", "source-arxiv-new");
  value.handoff.evidenceItemRefs.push("evidence-new-preprint");
  return value;
}

function makeBlocked(value) {
  value.watch.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "blocker-unreviewed-retraction",
    kind: "blocker",
    description:
      "The canonical retraction notice must be reviewed by the accountable owner before this private handoff can be ready.",
    owner: "Evidence Review Team",
    sourceRefs: ["source-journal-retraction"],
    evidenceItemRefs: ["evidence-retracted-pilot"],
    deltaRefs: ["delta-pilot-retraction"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-unreviewed-retraction");
  value.handoff.blockerRefs = ["blocker-unreviewed-retraction"];
}

test("research scout fixture is a complete private scholarly evidence delta handoff", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);

  const zeroResultQuery = clone();
  zeroResultQuery.watch.protocol.queries.push({
    id: "query-crossref-zero-results",
    authorityRef: "authority-crossref",
    query: "bounded query with no matching records",
    executedAt: "2025-08-29T18:30:00Z",
    resultSourceRefs: [],
  });
  assert.equal(isValid(zeroResultQuery), true, JSON.stringify(findings(zeroResultQuery)));
});

test("research scout rejects duplicate identities and dangling scholarly references", () => {
  const duplicateSource = clone();
  duplicateSource.sources[1].id = duplicateSource.sources[0].id;
  assert.equal(hasFinding(duplicateSource, "duplicate_reference"), true);

  const duplicateEvidence = clone();
  duplicateEvidence.evidenceItems[1].deduplicationKey =
    duplicateEvidence.evidenceItems[0].deduplicationKey;
  assert.equal(hasFinding(duplicateEvidence, "duplicate_reference"), true);

  const caseVariantSource = clone();
  const duplicateRecord = structuredClone(
    source(caseVariantSource, "source-crossref-mobile"),
  );
  duplicateRecord.id = "source-crossref-mobile-case-variant";
  duplicateRecord.persistentId.value = "10.1001/JAMA.2021.7449";
  duplicateRecord.canonicalUrl =
    "https://api.crossref.org/works/10.1001%2FJAMA.2021.7449";
  caseVariantSource.sources.push(duplicateRecord);
  assert.equal(hasFinding(caseVariantSource, "duplicate_reference"), true);

  const dangling = clone();
  dangling.evidenceItems[0].sourceRefs = ["source-missing"];
  assert.equal(hasFinding(dangling, "dangling_reference"), true);
});

test("canonical scholarly URLs bind to approved public authority and provider identifiers", () => {
  for (const canonicalUrl of [
    "http://api.crossref.org/works/10.1001%2Fjama.2021.7449",
    "https://api.crossref.org/works/10.1001%2Fjama.2021.7449?token=secret",
    "https://127.0.0.1/works/10.1001%2Fjama.2021.7449",
    "https://example.com/works/10.1001%2Fjama.2021.7449",
    "https://api.crossref.org/works/10.1001%2Fjama.2021.9999",
  ]) {
    const unsafe = clone();
    source(unsafe, "source-crossref-mobile").canonicalUrl = canonicalUrl;
    assert.equal(hasFinding(unsafe, "unsafe_source_reference"), true, canonicalUrl);
  }

  for (const [id, canonicalUrl] of [
    ["source-pubmed-mobile", "https://pubmed.ncbi.nlm.nih.gov/34077498/"],
    ["source-arxiv-followup", "https://arxiv.org/abs/2508.12346"],
    ["source-clinicaltrials-mobile", "https://clinicaltrials.gov/study/NCT00000000"],
    ["source-orcid-attribution", "https://orcid.org/0000-0002-1825-0098"],
    ["source-journal-correction", "https://jamanetwork.com/"],
  ]) {
    const unsafe = clone();
    source(unsafe, id).canonicalUrl = canonicalUrl;
    assert.equal(hasFinding(unsafe, "unsafe_source_reference"), true, id);
  }

  const unapprovedAuthority = clone();
  source(unapprovedAuthority, "source-crossref-mobile").authorityRef = "authority-jama";
  assert.equal(hasFinding(unapprovedAuthority, "source_authority_mismatch"), true);
  assert.equal(hasFinding(unapprovedAuthority, "unsafe_source_reference"), true);
});

test("protocol, baseline, source chronology, and lifecycle lineage stay reproducible", () => {
  const outsideWindow = clone();
  outsideWindow.watch.protocol.queries[0].executedAt = "2025-07-31T23:59:00Z";
  assert.equal(hasFinding(outsideWindow, "query_outside_review_window"), true);

  const chronology = clone();
  source(chronology, "source-arxiv-followup").retrievedAt = "2025-08-01T00:00:00Z";
  assert.equal(hasFinding(chronology, "invalid_source_chronology"), true);

  const baselineRun = clone();
  baselineRun.watch.baseline.runId = baselineRun.watch.run.id;
  assert.equal(hasFinding(baselineRun, "invalid_watch_chronology"), true);

  const wrongCorrection = clone();
  source(wrongCorrection, "source-journal-correction").correctsSourceRef = null;
  assert.equal(hasFinding(wrongCorrection, "incoherent_lifecycle_state"), true);

  const unrelatedCorrection = clone();
  source(unrelatedCorrection, "source-journal-correction").correctsSourceRef =
    "source-crossref-pilot";
  assert.equal(hasFinding(unrelatedCorrection, "invalid_lifecycle_lineage"), true);

  const unrelatedRetraction = clone();
  source(unrelatedRetraction, "source-journal-retraction").retractsSourceRef =
    "source-clinicaltrials-mobile";
  assert.equal(hasFinding(unrelatedRetraction, "invalid_lifecycle_lineage"), true);

  const wrongSupersession = clone();
  source(wrongSupersession, "source-crossref-mobile").supersedesSourceRef =
    "source-crossref-pilot";
  assert.equal(hasFinding(wrongSupersession, "invalid_lifecycle_lineage"), true);

  const excludedPriorSource = clone();
  source(excludedPriorSource, "source-arxiv-followup").supersedesSourceRef =
    "source-orcid-attribution";
  assert.equal(hasFinding(excludedPriorSource, "invalid_lifecycle_lineage"), false);

  const outOfOrderLifecycle = clone();
  outOfOrderLifecycle.evidenceItems[0].lifecycle[1].observedAt =
    "2020-01-01T00:00:00Z";
  assert.equal(hasFinding(outOfOrderLifecycle, "invalid_evidence_lifecycle"), true);

  const omittedBaselineEvidence = clone();
  for (const delta of omittedBaselineEvidence.deltas) {
    delta.baselineEvidenceItemRefs = delta.baselineEvidenceItemRefs.filter(
      (id) => id !== "evidence-mobile-trial",
    );
  }
  assertSchemaValid(omittedBaselineEvidence);
  assert.equal(hasFinding(omittedBaselineEvidence, "untracked_baseline_evidence"), true);

  const unrelatedBaselineSource = clone();
  unrelatedBaselineSource.watch.baseline.sourceRefs.push("source-arxiv-followup");
  assertSchemaValid(unrelatedBaselineSource);
  assert.equal(hasFinding(unrelatedBaselineSource, "unrelated_baseline_source"), true);

  const staleCurrentSource = clone();
  source(staleCurrentSource, "source-crossref-mobile").retrievedAt =
    "2025-07-31T23:59:59Z";
  assertSchemaValid(staleCurrentSource);
  assert.equal(hasFinding(staleCurrentSource, "stale_current_source"), true);

  const unqueriedSources = clone();
  for (const query of unqueriedSources.watch.protocol.queries) {
    query.resultSourceRefs = [];
  }
  assertSchemaValid(unqueriedSources);
  assert.equal(hasFinding(unqueriedSources, "unqueried_source"), true);
});

test("included evidence remains deduplicated, linked, and quality-scored", () => {
  const unclassifiedEvidence = clone();
  const extraSource = structuredClone(source(unclassifiedEvidence, "source-arxiv-followup"));
  extraSource.id = "source-arxiv-unclassified";
  extraSource.persistentId.value = "2508.54321";
  extraSource.canonicalUrl = "https://arxiv.org/abs/2508.54321";
  unclassifiedEvidence.sources.push(extraSource);
  unclassifiedEvidence.watch.protocol.queries
    .find((item) => item.authorityRef === "authority-arxiv")
    .resultSourceRefs.push(extraSource.id);
  const extraEvidence = structuredClone(unclassifiedEvidence.evidenceItems[2]);
  extraEvidence.id = "evidence-unclassified-preprint";
  extraEvidence.deduplicationKey = "study-unclassified-preprint-2025";
  extraEvidence.persistentIds[0].value = "2508.54321";
  extraEvidence.sourceRefs = [extraSource.id];
  extraEvidence.lifecycle[0].sourceRef = extraSource.id;
  extraEvidence.claimLinks[0].sourceRefs = [extraSource.id];
  unclassifiedEvidence.evidenceItems.push(extraEvidence);
  unclassifiedEvidence.handoff.sourceRefs.push(extraSource.id);
  unclassifiedEvidence.handoff.evidenceItemRefs.push(extraEvidence.id);
  assertSchemaValid(unclassifiedEvidence);
  assert.equal(hasFinding(unclassifiedEvidence, "unclassified_evidence"), true);

  const excludedSource = clone();
  excludedSource.evidenceItems[0].sourceRefs.push("source-orcid-attribution");
  excludedSource.evidenceItems[0].persistentIds.push({
    kind: "orcid",
    value: "0000-0002-1825-0097",
  });
  assert.equal(hasFinding(excludedSource, "invalid_evidence_source"), true);

  const duplicatePersistentId = clone();
  duplicatePersistentId.evidenceItems[2].persistentIds[0] = {
    kind: "doi",
    value: "10.1001/jama.2021.7449",
  };
  assert.equal(hasFinding(duplicatePersistentId, "duplicate_evidence_identity"), true);

  const fabricatedPersistentId = clone();
  fabricatedPersistentId.evidenceItems[0].persistentIds.push({
    kind: "doi",
    value: "10.1001/fabricated.9999",
  });
  assertSchemaValid(fabricatedPersistentId);
  assert.equal(hasFinding(fabricatedPersistentId, "unbound_evidence_identity"), true);

  const wrongRubric = clone();
  wrongRubric.evidenceItems[0].quality.rubricRef = "rubric-other";
  assert.equal(hasFinding(wrongRubric, "quality_rubric_mismatch"), true);

  const retractedSupport = clone();
  retractedSupport.evidenceItems[1].quality.rating = "low";
  assert.equal(hasFinding(retractedSupport, "unsupported_evidence_quality"), true);

  const preprintConfidence = clone();
  preprintConfidence.evidenceItems[2].confidence.rating = "moderate";
  assert.equal(hasFinding(preprintConfidence, "unsupported_evidence_quality"), true);

  const unrelatedClaimSource = clone();
  unrelatedClaimSource.evidenceItems[0].claimLinks[0].sourceRefs = [
    "source-journal-retraction",
  ];
  assert.equal(hasFinding(unrelatedClaimSource, "claim_source_mismatch"), true);
});

test("delta classification, scholarly supersession, contradictions, consensus, and review queues stay explicit", () => {
  const newWithBaseline = clone();
  newWithBaseline.deltas[2].baselineEvidenceItemRefs = ["evidence-mobile-trial"];
  assert.equal(hasFinding(newWithBaseline, "invalid_delta_classification"), true);

  const baselineEvidenceClaimedAsNew = clone();
  baselineEvidenceClaimedAsNew.deltas[2].evidenceItemRefs = ["evidence-mobile-trial"];
  assert.equal(
    hasFinding(baselineEvidenceClaimedAsNew, "invalid_delta_classification"),
    true,
  );

  const correctionWithoutState = clone();
  correctionWithoutState.deltas[0].evidenceItemRefs = ["evidence-followup-preprint"];
  assert.equal(hasFinding(correctionWithoutState, "delta_lifecycle_mismatch"), true);

  const peerReviewedSupersession = makePublicationSupersession(clone());
  assertSchemaValid(peerReviewedSupersession);
  assert.equal(
    isValid(peerReviewedSupersession),
    true,
    JSON.stringify(findings(peerReviewedSupersession)),
  );

  const unsupportedUpdate = clone();
  unsupportedUpdate.watch.baseline.sourceRefs.push("source-arxiv-followup");
  unsupportedUpdate.watch.baseline.evidenceItemRefs.push("evidence-followup-preprint");
  const unsupportedDelta = unsupportedUpdate.deltas.find(
    (item) => item.id === "delta-trial-update",
  );
  unsupportedDelta.evidenceItemRefs = ["evidence-followup-preprint"];
  unsupportedDelta.baselineEvidenceItemRefs = ["evidence-followup-preprint"];
  assertSchemaValid(unsupportedUpdate);
  assert.equal(hasFinding(unsupportedUpdate, "delta_lifecycle_mismatch"), true);

  const contradictionWithoutLink = clone();
  contradictionWithoutLink.deltas[4].contradictsDeltaRefs = [];
  assert.equal(hasFinding(contradictionWithoutLink, "invalid_delta_classification"), true);

  const uncitedConsensus = clone();
  uncitedConsensus.synthesis.consensus.evidenceItemRefs = ["evidence-mobile-trial"];
  assert.equal(hasFinding(uncitedConsensus, "unsupported_consensus_state"), true);

  const missingReplication = clone();
  missingReplication.reviewQueue = missingReplication.reviewQueue.filter(
    (item) => item.kind !== "replication",
  );
  missingReplication.handoff.reviewQueueRefs =
    missingReplication.handoff.reviewQueueRefs.filter(
      (id) => id !== "review-preprint-replication",
    );
  assert.equal(hasFinding(missingReplication, "missing_review_queue"), true);

  const agentOwner = clone();
  agentOwner.watch.decisionOwner = "Research Scout";
  agentOwner.handoff.owner = "Research Scout";
  for (const item of agentOwner.reviewQueue) item.owner = "Research Scout";
  for (const item of agentOwner.gapsAndBlockers) item.owner = "Research Scout";
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);
});

test("research scout reaches each explicit protocol, ownership, and handoff finding", () => {
  const wrongAuthorityPurpose = clone();
  wrongAuthorityPurpose.watch.protocol.authorities[0].purpose = "trial-registry";
  assertSchemaValid(wrongAuthorityPurpose);
  assert.equal(hasFinding(wrongAuthorityPurpose, "authority_purpose_mismatch"), true);

  const wrongQueryAuthority = clone();
  wrongQueryAuthority.watch.protocol.queries[0].resultSourceRefs = [
    "source-pubmed-mobile",
  ];
  assertSchemaValid(wrongQueryAuthority);
  assert.equal(hasFinding(wrongQueryAuthority, "query_authority_mismatch"), true);

  const wrongPublicationState = clone();
  wrongPublicationState.evidenceItems[0].publicationState = "peer-reviewed";
  assertSchemaValid(wrongPublicationState);
  assert.equal(hasFinding(wrongPublicationState, "publication_state_mismatch"), true);

  const incoherentQueue = clone();
  incoherentQueue.reviewQueue[0].status = "open";
  incoherentQueue.reviewQueue[0].resolution = "An open item cannot have a resolution.";
  assertSchemaValid(incoherentQueue);
  assert.equal(hasFinding(incoherentQueue, "incoherent_review_queue"), true);

  const wrongGapOwner = clone();
  wrongGapOwner.gapsAndBlockers[0].owner = "Other team";
  assertSchemaValid(wrongGapOwner);
  assert.equal(hasFinding(wrongGapOwner, "owner_mismatch"), true);

  const mismatchedHandoff = clone();
  mismatchedHandoff.handoff.destination = "outputs/other-handoff.md";
  assertSchemaValid(mismatchedHandoff);
  assert.equal(hasFinding(mismatchedHandoff, "private_handoff_mismatch"), true);

  const inconsistentReadyState = clone();
  inconsistentReadyState.handoff.state = "draft";
  assertSchemaValid(inconsistentReadyState);
  assert.equal(hasFinding(inconsistentReadyState, "inconsistent_ready_state"), true);

  const traversalDestination = clone();
  traversalDestination.watch.destination = "outputs/../outside.md";
  traversalDestination.handoff.destination = "outputs/../outside.md";
  assertSchemaValid(traversalDestination);
  assert.equal(hasFinding(traversalDestination, "unsafe_handoff_destination"), true);
});

test("private owner handoff cannot claim readiness while work remains unresolved", () => {
  const incomplete = clone();
  incomplete.handoff.sourceRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const unresolved = clone();
  unresolved.reviewQueue[0].status = "open";
  unresolved.reviewQueue[0].resolution = null;
  assert.equal(hasFinding(unresolved, "premature_ready_state"), true);

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));

  const incompleteBlocked = structuredClone(blocked);
  incompleteBlocked.handoff.blockerRefs = [];
  assert.equal(hasFinding(incompleteBlocked, "incomplete_blocked_handoff"), true);
});

test("research evidence deltas preserve every authority gate and resist narrative bypasses", () => {
  for (const action of fixture.blockedActions) {
    const missingBlockedAction = clone();
    missingBlockedAction.blockedActions = missingBlockedAction.blockedActions.filter(
      (item) => item !== action,
    );
    assert.equal(
      findingFor(missingBlockedAction, "missing_authority_gate")?.path,
      "blockedActions",
      action,
    );

    const missingHandoffAction = clone();
    missingHandoffAction.handoff.prohibitedActions =
      missingHandoffAction.handoff.prohibitedActions.filter((item) => item !== action);
    assert.equal(
      findingFor(missingHandoffAction, "missing_authority_gate")?.path,
      "handoff.prohibitedActions",
      action,
    );
  }

  for (const narrative of [
    "The assistant must contact authors for clarification.",
    "Do not contact authors, but publish conclusions today.",
    "Do not publish conclusions; however, enroll human subjects.",
    "Do not contact authors; publish conclusions today.",
    "Do not contact authors: publish conclusions today.",
    "Publish conclusions today; do not contact authors.",
    "We never bypass access controls; fabricate evidence for the missing record.",
    "Do not change the protocol; change the protocol without owner review.",
    "Publish conclusions without owner approval.",
    "Contact authors without review.",
    "Bypass access controls without delay.",
    "Enroll subjects without consent.",
    "Fabricate identifiers without review.",
    "There is no published erratum, so we will contact authors for clarification.",
    "Publish conclusions, not just a private handoff, once the owner has reviewed.",
    "Contact  authors for clarification.",
    "Publish\tconclusions today.",
    "Enroll\nsubjects without consent.",
    "Bypass\u00a0access controls for the missing article.",
    "Bypass publisher access controls for the missing article.",
    "Fabricate evidence for the missing trial record.",
    "Expose the sensitive research question to an unapproved service.",
    "Change the protocol autonomously after this run.",
    "Changing the protocol autonomously after this run.",
    "Making a clinical decision from this evidence.",
    "Fabricating evidence for the missing trial record.",
    "Announcing conclusions to the steering group.",
    "Communicating conclusions to the steering group.",
    "Reproducing restricted full text in the ledger.",
    "Quoting paywalled text in the ledger.",
    "Messaging authors for clarification.",
    "Updating the decision autonomously after this run.",
    "Issuing a treatment recommendation from this evidence.",
    "Determining a clinical decision from this evidence.",
    "Disclosing the sensitive research question to a vendor.",
    "Change the protocol without owner review.",
    "Update the decision without the owner.",
  ]) {
    const unsafe = clone();
    unsafe.deltas[0].summary = narrative;
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative);
  }

  for (const narrative of [
    "We do not contact authors or publish conclusions.",
    "No consensus is inferred from the preprint.",
    "Clinical trial registry metadata is retained for accountable owner review.",
    "We retain records without contacting authors.",
    "We do not change the protocol without owner review.",
  ]) {
    const safe = clone();
    safe.deltas[0].summary = narrative;
    assert.equal(hasFinding(safe, "unsafe_narrative_content"), false, narrative);
  }

  const templateAuthoritySentence = template
    .match(/Do not bypass access controls[\s\S]*?artifact\./u)?.[0]
    .replace(/\s+/gu, " ");
  assert.ok(templateAuthoritySentence);
  const templateSafe = clone();
  templateSafe.deltas[0].summary = templateAuthoritySentence;
  assert.equal(hasFinding(templateSafe, "unsafe_narrative_content"), false);
});
