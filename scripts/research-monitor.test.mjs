import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/research-monitor/schemas/topic-watch-delta-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/research-monitor/fixtures/topic-watch-delta-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL("../claws/research-monitor/templates/topic-watch-delta-ledger.md", import.meta.url),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("research-monitor", value);
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

function observation(value, id) {
  return value.observations.find((item) => item.id === id);
}

function review(value, id) {
  return value.reviewQueue.find((item) => item.id === id);
}

function makeBlocked(value) {
  value.watch.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "blocker-applicability-review",
    kind: "blocker",
    description: "The owner must verify applicability before this private handoff can be ready.",
    owner: "Governance Review Team",
    sourceRefs: ["source-eu-commission-implementation-notice"],
    observationRefs: ["observation-commission-implementation-notice"],
    deltaRefs: ["delta-new-commission-notice"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-applicability-review");
  value.handoff.blockerRefs = ["blocker-applicability-review"];
}

test("research monitor fixture is a complete private topic-watch delta handoff", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.match(template, /approved query-disclosure rule/u);

  const zeroResultQuery = clone();
  zeroResultQuery.watch.queries.push({
    id: "query-ai-office-zero-result",
    authorityRef: "authority-ai-office",
    query: "bounded query with no matching update",
    executedAt: "2026-08-29T14:25:00Z",
    resultSourceRefs: [],
  });
  assert.equal(isValid(zeroResultQuery), true, JSON.stringify(findings(zeroResultQuery)));
});

test("topic-watch references, bounded chronology, and query provenance remain complete", () => {
  const duplicate = clone();
  duplicate.sources[1].id = duplicate.sources[0].id;
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);

  const dangling = clone();
  dangling.observations[0].sourceRefs = ["source-missing"];
  assertSchemaValid(dangling);
  assert.equal(hasFinding(dangling, "dangling_reference"), true);

  const chronology = clone();
  chronology.watch.baseline.runId = chronology.watch.run.id;
  assert.equal(hasFinding(chronology, "invalid_watch_chronology"), true);

  const traversal = clone();
  traversal.watch.destination = "outputs/../outside.md";
  traversal.handoff.destination = "outputs/../outside.md";
  assertSchemaValid(traversal);
  assert.equal(hasFinding(traversal, "unsafe_handoff_destination"), true);

  const badAuthorityPurpose = clone();
  badAuthorityPurpose.watch.authorities[0].purpose = "official-notice";
  assertSchemaValid(badAuthorityPurpose);
  assert.equal(hasFinding(badAuthorityPurpose, "authority_purpose_mismatch"), true);

  const outsideWindow = clone();
  outsideWindow.watch.queries[0].executedAt = "2026-07-31T23:59:00Z";
  assert.equal(hasFinding(outsideWindow, "query_outside_review_window"), true);

  const wrongQueryAuthority = clone();
  wrongQueryAuthority.watch.queries[0].resultSourceRefs = [
    "source-ai-office-guidance-july",
  ];
  assert.equal(hasFinding(wrongQueryAuthority, "query_authority_mismatch"), true);

  const unqueried = clone();
  for (const query of unqueried.watch.queries) {
    query.resultSourceRefs = query.resultSourceRefs.filter(
      (id) => id !== "source-eu-commission-implementation-notice",
    );
  }
  assert.equal(hasFinding(unqueried, "unqueried_source"), true);
});

test("sources bind to approved public authorities, chronology, and lifecycle lineage", () => {
  const wrongProvider = clone();
  source(wrongProvider, "source-eur-lex-ai-act").provider = "official";
  assertSchemaValid(wrongProvider);
  assert.equal(hasFinding(wrongProvider, "source_authority_mismatch"), true);

  for (const canonicalUrl of [
    "http://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    "https://user:pass@eur-lex.europa.eu/eli/reg/2024/1689/oj",
    "https://eur-lex.europa.eu/eli/reg/2024/1689/oj#private",
    "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?token=secret",
    "https://127.0.0.1/eli/reg/2024/1689/oj",
    "https://172.16.0.1/eli/reg/2024/1689/oj",
    "https://example.com/eli/reg/2024/1689/oj",
    "https://eur-lex.europa.eu/"
  ]) {
    const unsafe = clone();
    source(unsafe, "source-eur-lex-ai-act").canonicalUrl = canonicalUrl;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_source_reference"), true, canonicalUrl);
  }

  const invalidChronology = clone();
  source(invalidChronology, "source-eur-lex-ai-act").publishedAt =
    "2026-08-30T00:00:00Z";
  assert.equal(hasFinding(invalidChronology, "invalid_source_chronology"), true);

  const invalidLineage = clone();
  source(invalidLineage, "source-ai-office-guidance-august").supersedesSourceRef =
    "source-ai-office-guidance-august";
  assert.equal(hasFinding(invalidLineage, "invalid_source_lineage"), true);

  const incoherentLifecycle = clone();
  source(incoherentLifecycle, "source-ai-office-guidance-correction").correctsSourceRef =
    null;
  assert.equal(hasFinding(incoherentLifecycle, "incoherent_source_lifecycle"), true);

  const stale = clone();
  source(stale, "source-eur-lex-ai-act").freshness = "stale";
  assert.equal(hasFinding(stale, "stale_current_source"), true);
});

test("typed observations and claims remain source-linked, deduplicated, and owner-prioritized", () => {
  const wrongPolicyOwner = clone();
  wrongPolicyOwner.watch.priorityPolicy.owner = "Other review team";
  assert.equal(hasFinding(wrongPolicyOwner, "invalid_priority_policy"), true);

  const wrongThreshold = clone();
  observation(wrongThreshold, "observation-ai-act-legal-text").priority.thresholdRef =
    "threshold-high-checklist-impact";
  assert.equal(hasFinding(wrongThreshold, "invalid_priority_policy"), true);

  const duplicateObservation = clone();
  observation(
    duplicateObservation,
    "observation-implementation-faq",
  ).deduplicationKey = observation(
    duplicateObservation,
    "observation-implementation-guidance",
  ).deduplicationKey;
  assert.equal(hasFinding(duplicateObservation, "duplicate_observation_identity"), true);

  const statusMismatch = clone();
  observation(statusMismatch, "observation-implementation-guidance").status = "current";
  assert.equal(hasFinding(statusMismatch, "incoherent_observation_status"), true);

  const claimMismatch = clone();
  observation(claimMismatch, "observation-ai-act-legal-text").claims[0].sourceRefs = [
    "source-ai-office-guidance-july",
  ];
  assert.equal(hasFinding(claimMismatch, "claim_source_mismatch"), true);

  const unobserved = clone();
  observation(unobserved, "observation-ai-act-legal-text").sourceRefs = [
    "source-ai-office-guidance-july",
  ];
  observation(unobserved, "observation-ai-act-legal-text").claims[0].sourceRefs = [
    "source-ai-office-guidance-july",
  ];
  assertSchemaValid(unobserved);
  assert.equal(hasFinding(unobserved, "unobserved_source"), true);
});

test("delta classifications preserve lifecycle, baseline coverage, and linked contradiction state", () => {
  const invalidClassification = clone();
  invalidClassification.deltas[0].baselineObservationRefs = [
    "observation-ai-act-legal-text",
  ];
  assert.equal(hasFinding(invalidClassification, "invalid_delta_classification"), true);

  const lifecycleMismatch = clone();
  const changed = lifecycleMismatch.deltas.find(
    (item) => item.id === "delta-guidance-changed",
  );
  changed.observationRefs = ["observation-ai-act-legal-text"];
  changed.baselineObservationRefs = ["observation-ai-act-legal-text"];
  assert.equal(hasFinding(lifecycleMismatch, "delta_lifecycle_mismatch"), true);

  const unclassified = clone();
  const extra = structuredClone(observation(unclassified, "observation-ai-act-legal-text"));
  extra.id = "observation-unclassified-topic";
  extra.deduplicationKey = "topic-unclassified-topic";
  extra.claims[0].id = "claim-unclassified-topic";
  unclassified.observations.push(extra);
  unclassified.handoff.observationRefs.push(extra.id);
  assertSchemaValid(unclassified);
  assert.equal(hasFinding(unclassified, "unclassified_observation"), true);

  const missingBaselineCoverage = clone();
  for (const delta of missingBaselineCoverage.deltas) {
    delta.baselineObservationRefs = delta.baselineObservationRefs.filter(
      (id) => id !== "observation-implementation-faq",
    );
  }
  assertSchemaValid(missingBaselineCoverage);
  assert.equal(
    hasFinding(missingBaselineCoverage, "untracked_baseline_observation"),
    true,
  );

  const unrelatedBaseline = clone();
  unrelatedBaseline.watch.baseline.sourceRefs.push(
    "source-eu-commission-implementation-notice",
  );
  assertSchemaValid(unrelatedBaseline);
  assert.equal(hasFinding(unrelatedBaseline, "unrelated_baseline_source"), true);
});

test("owner review queue, private handoff, and ready state remain accountable and complete", () => {
  const incoherentReview = clone();
  review(incoherentReview, "review-guidance-priority").status = "open";
  assert.equal(hasFinding(incoherentReview, "incoherent_review_queue"), true);

  const missingPriority = clone();
  for (const item of missingPriority.reviewQueue) item.priority = "normal";
  assert.equal(hasFinding(missingPriority, "missing_priority_review"), true);

  const missingRequired = clone();
  review(missingRequired, "review-notice-contradiction").deltaRefs =
    review(missingRequired, "review-notice-contradiction").deltaRefs.filter(
      (id) => id !== "delta-new-commission-notice",
    );
  assert.equal(hasFinding(missingRequired, "missing_required_review"), true);

  const wrongGapOwner = clone();
  wrongGapOwner.gapsAndBlockers[0].owner = "Other review team";
  assert.equal(hasFinding(wrongGapOwner, "owner_mismatch"), true);

  const privateMismatch = clone();
  privateMismatch.handoff.destination = "outputs/other-handoff.md";
  assert.equal(hasFinding(privateMismatch, "private_handoff_mismatch"), true);

  for (const owner of ["Research Monitor", "AI"]) {
    const agentOwner = clone();
    agentOwner.watch.decisionOwner = owner;
    agentOwner.handoff.owner = owner;
    for (const item of agentOwner.reviewQueue) item.owner = owner;
    for (const item of agentOwner.gapsAndBlockers) item.owner = owner;
    agentOwner.watch.priorityPolicy.owner = owner;
    assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true, owner);
  }

  const incomplete = clone();
  incomplete.handoff.sourceRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));

  const incompleteBlocked = structuredClone(blocked);
  incompleteBlocked.handoff.blockerRefs = [];
  assert.equal(hasFinding(incompleteBlocked, "incomplete_blocked_handoff"), true);

  const inconsistentReady = clone();
  inconsistentReady.handoff.state = "draft";
  assert.equal(hasFinding(inconsistentReady, "inconsistent_ready_state"), true);

  const prematureReady = clone();
  review(prematureReady, "review-guidance-priority").status = "open";
  review(prematureReady, "review-guidance-priority").resolution = null;
  assert.equal(hasFinding(prematureReady, "premature_ready_state"), true);
});

test("authority gates and normalized narrative safety resist action bypasses", () => {
  for (const action of fixture.blockedActions) {
    const missingTopLevel = clone();
    missingTopLevel.blockedActions = missingTopLevel.blockedActions.filter(
      (item) => item !== action,
    );
    assert.equal(hasFinding(missingTopLevel, "missing_authority_gate"), true, action);

    const missingHandoff = clone();
    missingHandoff.handoff.prohibitedActions =
      missingHandoff.handoff.prohibitedActions.filter((item) => item !== action);
    assert.equal(hasFinding(missingHandoff, "missing_authority_gate"), true, action);
  }

  for (const narrative of [
    "Publish  an external report today.",
    "Do not publish an external report; however, contact an external authority.",
    "Do not publish an external report, but change an account.",
    "Do not contact an external authority: fabricate a claim.",
    "Expose the token to an external service.",
    "Bypass\u00a0access controls for the missing record.",
    "Change the action without owner review.",
    "Declare a consensus from these sources.",
    "The update establishes a causal effect on deployment outcomes."
  ]) {
    const unsafe = clone();
    unsafe.observations[0].summary = narrative;
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative);
  }

  for (const narrative of [
    "We do not publish an external report or contact an external authority.",
    "No consensus is inferred from the retained source records.",
    "The source change does not establish a causal effect on deployment outcomes.",
    "We retain the private handoff without changing an account."
  ]) {
    const safe = clone();
    safe.observations[0].summary = narrative;
    assert.equal(hasFinding(safe, "unsafe_narrative_content"), false, narrative);
  }

  const inferredConsensus = clone();
  inferredConsensus.synthesis.consensus.state = "inferred";
  assert.equal(validateSchema(inferredConsensus), false);
});
