import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/feed-intelligence-monitor/schemas/feed-intelligence-delta-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/feed-intelligence-monitor/fixtures/feed-intelligence-delta-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../claws/feed-intelligence-monitor/templates/feed-intelligence-delta-ledger.md",
    import.meta.url,
  ),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("feed-intelligence-monitor", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function item(value, id) {
  return value.items.find((entry) => entry.id === id);
}

function signal(value, id) {
  return value.signals.find((entry) => entry.id === id);
}

function delta(value, id) {
  return value.deltas.find((entry) => entry.id === id);
}

function review(value, id) {
  return value.reviewQueue.find((entry) => entry.id === id);
}

function makeBlocked(value) {
  value.monitor.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "blocker-owner-confirmation",
    kind: "blocker",
    description: "The named owner must confirm the private environment scope before this handoff is ready.",
    owner: "Platform Security Review Team",
    subscriptionRefs: ["subscription-openclaw-releases"],
    itemRefs: ["item-compatibility-note"],
    signalRefs: ["signal-compatibility-note"],
    deltaRefs: ["delta-compatibility-contradictory"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-owner-confirmation");
  value.handoff.blockerRefs = ["blocker-owner-confirmation"];
}

function makeDraftWithOpenReview(value, id = "review-release-compatibility") {
  value.monitor.state = "draft";
  value.handoff.state = "draft";
  value.deliveryQueue[0].state = "held";
  review(value, id).status = "open";
  review(value, id).resolution = null;
}

function makeZeroItemRun() {
  const value = clone();
  value.monitor.run.outcome = "zero-items";
  value.monitor.baseline.itemRefs = [];
  value.items = [];
  value.signals = [];
  value.deltas = [];
  value.reviewQueue = [];
  value.deliveryQueue = [];
  value.gapsAndBlockers = [];
  value.handoff.itemRefs = [];
  value.handoff.signalRefs = [];
  value.handoff.deltaRefs = [];
  value.handoff.reviewQueueRefs = [];
  value.handoff.deliveryQueueRefs = [];
  value.handoff.gapAndBlockerRefs = [];
  value.handoff.blockerRefs = [];
  return value;
}

test("feed intelligence fixture is a complete private delta and triage handoff", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.match(template, /idempotency key/u);
  assert.match(template, /zero-item run/u);

  const zeroItemRun = makeZeroItemRun();
  assert.equal(isValid(zeroItemRun), true, JSON.stringify(findings(zeroItemRun)));

  zeroItemRun.monitor.run.outcome = "items-found";
  assertSchemaValid(zeroItemRun);
  assert.equal(hasFinding(zeroItemRun, "invalid_zero_item_run"), true);
});

test("feed subscription identity, approval, cursor, and retrieval state remain bounded", () => {
  const duplicate = clone();
  duplicate.subscriptions[1].id = duplicate.subscriptions[0].id;
  assertSchemaValid(duplicate);
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);

  const incompleteCheckpoint = clone();
  incompleteCheckpoint.monitor.baseline.subscriptionRefs = [
    "subscription-openclaw-releases",
  ];
  assertSchemaValid(incompleteCheckpoint);
  assert.equal(hasFinding(incompleteCheckpoint, "incomplete_subscription_coverage"), true);

  const badOwner = clone();
  badOwner.subscriptions[0].owner = "Other review team";
  assertSchemaValid(badOwner);
  assert.equal(hasFinding(badOwner, "subscription_owner_gate"), true);

  for (const url of [
    "http://github.com/openclaw/openclaw/releases.atom",
    "https://user:secret@github.com/openclaw/openclaw/releases.atom",
    "https://github.com/openclaw/openclaw/releases.atom#private",
    "https://github.com/openclaw/openclaw/releases.atom?token=secret",
    "https://127.0.0.1/openclaw/openclaw/releases.atom",
    "https://example.com/openclaw/openclaw/releases.atom",
    "https://github.com/"
  ]) {
    const unsafe = clone();
    unsafe.subscriptions[0].canonicalFeedUrl = url;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_subscription_reference"), true, url);
  }

  const cursor = clone();
  cursor.subscriptions[0].cursor.checkpoint = "checkpoint-other";
  assertSchemaValid(cursor);
  assert.equal(hasFinding(cursor, "invalid_cursor_chronology"), true);

  const retrieval = clone();
  retrieval.subscriptions[0].retrieval.lastSuccessfulAt = null;
  assertSchemaValid(retrieval);
  assert.equal(hasFinding(retrieval, "invalid_retrieval_state"), true);

  const partial = clone();
  partial.monitor.state = "draft";
  partial.handoff.state = "draft";
  partial.deliveryQueue[0].state = "held";
  partial.subscriptions[0].cursor.advancedAt = "2026-08-30T13:29:00Z";
  partial.subscriptions[0].retrieval = {
    state: "partial",
    lastAttemptedAt: "2026-08-30T13:31:00Z",
    lastSuccessfulAt: "2026-08-30T13:29:00Z",
    freshness: "recheck-needed",
    recheckState: "requested",
  };
  for (const entry of partial.items.filter(
    (entry) => entry.subscriptionRef === "subscription-openclaw-releases",
  )) {
    entry.retrievedAt = "2026-08-30T13:29:00Z";
  }
  assertSchemaValid(partial);
  assert.equal(isValid(partial), true, JSON.stringify(findings(partial)));

  const failed = structuredClone(partial);
  failed.subscriptions[0].retrieval.state = "failed";
  assertSchemaValid(failed);
  assert.equal(isValid(failed), true, JSON.stringify(findings(failed)));

  const failedChronology = structuredClone(failed);
  failedChronology.subscriptions[0].retrieval.lastSuccessfulAt =
    "2026-08-30T13:32:00Z";
  assertSchemaValid(failedChronology);
  assert.equal(hasFinding(failedChronology, "invalid_retrieval_state"), true);

  const stale = clone();
  stale.monitor.run.asOf = "2026-08-30T14:40:00Z";
  stale.monitor.freshnessPolicy.maxAgeHours = 1;
  assertSchemaValid(stale);
  assert.equal(hasFinding(stale, "stale_subscription"), true);

  const blockedFirstRun = clone();
  makeBlocked(blockedFirstRun);
  blockedFirstRun.subscriptions[0].retrieval = {
    state: "not-run",
    lastAttemptedAt: "2026-08-30T13:31:00Z",
    lastSuccessfulAt: null,
    freshness: "stale",
    recheckState: "requested",
  };
  assert.equal(isValid(blockedFirstRun), true, JSON.stringify(findings(blockedFirstRun)));

  const chronology = clone();
  chronology.monitor.baseline.runId = chronology.monitor.run.id;
  assertSchemaValid(chronology);
  assert.equal(hasFinding(chronology, "invalid_monitor_chronology"), true);

  const traversal = clone();
  traversal.monitor.destination = "outputs/../outside.md";
  traversal.handoff.destination = "outputs/../outside.md";
  assertSchemaValid(traversal);
  assert.equal(hasFinding(traversal, "unsafe_handoff_destination"), true);
});

test("feed item provenance, identity, chronology, and lifecycle remain explicit", () => {
  const dangling = clone();
  item(dangling, "item-openclaw-release-august").subscriptionRef =
    "subscription-missing";
  assertSchemaValid(dangling);
  assert.equal(hasFinding(dangling, "dangling_reference"), true);

  for (const url of [
    "http://github.com/openclaw/openclaw/releases/tag/v2026.8.1",
    "https://github.com/openclaw/openclaw/releases/tag/v2026.8.1?token=secret",
    "https://localhost/openclaw/openclaw/releases/tag/v2026.8.1",
    "https://example.com/openclaw/openclaw/releases/tag/v2026.8.1"
  ]) {
    const unsafe = clone();
    item(unsafe, "item-openclaw-release-august").canonicalUrl = url;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_item_reference"), true, url);
  }

  const chronology = clone();
  item(chronology, "item-openclaw-release-august").publishedAt =
    "2026-08-31T12:00:00Z";
  assertSchemaValid(chronology);
  assert.equal(hasFinding(chronology, "invalid_item_chronology"), true);

  const duplicate = clone();
  item(duplicate, "item-compatibility-note").canonicalUrl =
    item(duplicate, "item-openclaw-release-august").canonicalUrl;
  assertSchemaValid(duplicate);
  assert.equal(hasFinding(duplicate, "duplicate_item_identity"), true);

  const duplicateGuid = clone();
  item(duplicateGuid, "item-compatibility-note").guid =
    item(duplicateGuid, "item-openclaw-release-august").guid;
  assertSchemaValid(duplicateGuid);
  assert.equal(hasFinding(duplicateGuid, "duplicate_item_identity"), true);

  const duplicateDigest = clone();
  item(duplicateDigest, "item-compatibility-note").contentDigest =
    item(duplicateDigest, "item-openclaw-release-august").contentDigest;
  assertSchemaValid(duplicateDigest);
  assert.equal(hasFinding(duplicateDigest, "duplicate_item_identity"), true);

  const lineage = clone();
  item(lineage, "item-openclaw-release-august").supersedesItemRef =
    "item-openclaw-release-august";
  assertSchemaValid(lineage);
  assert.equal(hasFinding(lineage, "invalid_item_lineage"), true);

  const lifecycle = clone();
  item(lifecycle, "item-advisory-correction").correctsItemRef = null;
  assertSchemaValid(lifecycle);
  assert.equal(hasFinding(lifecycle, "incoherent_item_lifecycle"), true);
});

test("typed feed signals stay item-linked, state-aware, and policy-routed", () => {
  const sourceMismatch = clone();
  signal(sourceMismatch, "signal-release-august").sourceUrl =
    "https://github.com/advisories/GHSA-1111-2222-3333";
  assertSchemaValid(sourceMismatch);
  assert.equal(hasFinding(sourceMismatch, "signal_provenance_mismatch"), true);

  const signalState = clone();
  signal(signalState, "signal-advisory-withdrawal").status = "current";
  assertSchemaValid(signalState);
  assert.equal(hasFinding(signalState, "incoherent_signal_state"), true);

  const policyOwner = clone();
  policyOwner.monitor.triagePolicy.owner = "Other review team";
  assertSchemaValid(policyOwner);
  assert.equal(hasFinding(policyOwner, "invalid_triage_policy"), true);

  const threshold = clone();
  signal(threshold, "signal-release-august").priority.thresholdRef =
    "threshold-normal-retained-context";
  assertSchemaValid(threshold);
  assert.equal(hasFinding(threshold, "invalid_triage_policy"), true);

  const untriaged = clone();
  untriaged.signals = untriaged.signals.filter(
    (entry) => entry.id !== "signal-advisory-unchanged",
  );
  untriaged.deliveryQueue[0].signalRefs = untriaged.deliveryQueue[0].signalRefs.filter(
    (id) => id !== "signal-advisory-unchanged",
  );
  untriaged.handoff.signalRefs = untriaged.handoff.signalRefs.filter(
    (id) => id !== "signal-advisory-unchanged",
  );
  assertSchemaValid(untriaged);
  assert.equal(hasFinding(untriaged, "untriaged_item"), true);
});

test("checkpoint dispositions cover every retained item and preserve lineage", () => {
  const invalidDisposition = clone();
  delta(invalidDisposition, "delta-compatibility-new").baselineItemRefs = [
    "item-openclaw-release-july",
  ];
  assertSchemaValid(invalidDisposition);
  assert.equal(hasFinding(invalidDisposition, "invalid_delta_disposition"), true);

  const lifecycle = clone();
  delta(lifecycle, "delta-release-changed").itemRefs = [
    "item-advisory-unchanged",
  ];
  assertSchemaValid(lifecycle);
  assert.equal(hasFinding(lifecycle, "delta_lifecycle_mismatch"), true);

  for (const [deltaId, reviewId] of [
    ["delta-advisory-corrected", "review-advisory-correction"],
    ["delta-advisory-withdrawn", "review-advisory-withdrawal"],
  ]) {
    const missingLifecycleReview = clone();
    review(missingLifecycleReview, reviewId).deltaRefs = ["delta-release-changed"];
    assertSchemaValid(missingLifecycleReview);
    assert.equal(
      hasFinding(missingLifecycleReview, "missing_required_review"),
      true,
      deltaId,
    );
  }

  const unclassified = clone();
  const extra = structuredClone(item(unclassified, "item-compatibility-note"));
  extra.id = "item-unclassified";
  extra.guid = "unclassified-feed-item";
  extra.canonicalUrl = "https://github.com/openclaw/openclaw/discussions/5678";
  extra.contentDigest =
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  extra.title = "Representative unclassified feed item";
  unclassified.items.push(extra);
  unclassified.handoff.itemRefs.push(extra.id);
  assertSchemaValid(unclassified);
  assert.equal(hasFinding(unclassified, "unclassified_item"), true);

  const missingBaseline = clone();
  for (const entry of missingBaseline.deltas) {
    entry.baselineItemRefs = entry.baselineItemRefs.filter(
      (id) => id !== "item-advisory-unchanged",
    );
  }
  assertSchemaValid(missingBaseline);
  assert.equal(hasFinding(missingBaseline, "untracked_baseline_item"), true);
});

test("configured correction, withdrawal, and contradiction rechecks remain explicit", () => {
  for (const [deltaId, reviewId] of [
    ["delta-advisory-corrected", "review-advisory-correction"],
    ["delta-advisory-withdrawn", "review-advisory-withdrawal"],
    ["delta-compatibility-contradictory", "review-compatibility-contradiction"],
  ]) {
    const missingRecheck = clone();
    const affectedDelta = delta(missingRecheck, deltaId);
    affectedDelta.recheckState = "not-required";
    for (const itemId of affectedDelta.itemRefs) {
      item(missingRecheck, itemId).recheckState = "not-required";
      for (const entry of missingRecheck.signals.filter(
        (signal) => signal.itemRef === itemId,
      )) {
        entry.recheckState = "not-required";
      }
      const subscription = missingRecheck.subscriptions.find(
        (entry) => entry.id === item(missingRecheck, itemId).subscriptionRef,
      );
      subscription.retrieval.recheckState = "not-required";
    }
    review(missingRecheck, reviewId).deltaRefs = ["delta-release-changed"];
    assertSchemaValid(missingRecheck);
    assert.equal(
      hasFinding(missingRecheck, "missing_recheck_handling"),
      true,
      deltaId,
    );
  }
});

test("private review, delivery, blockers, and ready state retain owner control", () => {
  const incoherentReview = clone();
  review(incoherentReview, "review-release-compatibility").status = "open";
  assertSchemaValid(incoherentReview);
  assert.equal(hasFinding(incoherentReview, "incoherent_review_queue"), true);

  const missingPriority = clone();
  for (const entry of missingPriority.reviewQueue) entry.priority = "normal";
  assertSchemaValid(missingPriority);
  assert.equal(hasFinding(missingPriority, "missing_priority_review"), true);

  const missingRequired = clone();
  review(missingRequired, "review-compatibility-contradiction").deltaRefs =
    review(missingRequired, "review-compatibility-contradiction").deltaRefs.filter(
      (id) => id !== "delta-compatibility-contradictory",
    );
  assertSchemaValid(missingRequired);
  assert.equal(hasFinding(missingRequired, "missing_required_review"), true);

  const incoherentDelivery = clone();
  incoherentDelivery.deliveryQueue[0].owner = "Other review team";
  assertSchemaValid(incoherentDelivery);
  assert.equal(hasFinding(incoherentDelivery, "incoherent_delivery_queue"), true);

  const duplicateIdempotencyKey = clone();
  const replay = structuredClone(duplicateIdempotencyKey.deliveryQueue[0]);
  replay.id = "delivery-private-critical-dependency-triage-replay";
  duplicateIdempotencyKey.deliveryQueue.push(replay);
  duplicateIdempotencyKey.handoff.deliveryQueueRefs.push(replay.id);
  assertSchemaValid(duplicateIdempotencyKey);
  assert.equal(hasFinding(duplicateIdempotencyKey, "duplicate_reference"), true);

  const draftOpenReview = clone();
  makeDraftWithOpenReview(draftOpenReview);
  draftOpenReview.deliveryQueue[0].reviewRefs = [];
  assertSchemaValid(draftOpenReview);
  assert.equal(hasFinding(draftOpenReview, "incomplete_delivery_review"), true);
  assert.equal(hasFinding(draftOpenReview, "incoherent_delivery_queue"), false);

  const blockedOpenReview = clone();
  makeBlocked(blockedOpenReview);
  blockedOpenReview.deliveryQueue[0].state = "held";
  review(blockedOpenReview, "review-release-compatibility").status = "open";
  review(blockedOpenReview, "review-release-compatibility").resolution = null;
  blockedOpenReview.deliveryQueue[0].reviewRefs = [];
  assertSchemaValid(blockedOpenReview);
  assert.equal(hasFinding(blockedOpenReview, "incomplete_delivery_review"), true);

  const preparedOpenReview = clone();
  review(preparedOpenReview, "review-release-compatibility").status = "open";
  review(preparedOpenReview, "review-release-compatibility").resolution = null;
  preparedOpenReview.deliveryQueue[0].reviewRefs = [];
  assertSchemaValid(preparedOpenReview);
  assert.equal(hasFinding(preparedOpenReview, "incomplete_delivery_review"), true);
  assert.equal(hasFinding(preparedOpenReview, "incoherent_delivery_queue"), true);

  const missingDelivery = clone();
  missingDelivery.deliveryQueue[0].signalRefs = ["signal-release-august"];
  missingDelivery.deliveryQueue[0].deltaRefs = ["delta-release-changed"];
  assertSchemaValid(missingDelivery);
  assert.equal(hasFinding(missingDelivery, "missing_delivery_queue"), true);

  const wrongGapOwner = clone();
  wrongGapOwner.gapsAndBlockers[0].owner = "Other review team";
  assertSchemaValid(wrongGapOwner);
  assert.equal(hasFinding(wrongGapOwner, "owner_mismatch"), true);

  const privateMismatch = clone();
  privateMismatch.handoff.destination = "outputs/other-handoff.md";
  assertSchemaValid(privateMismatch);
  assert.equal(hasFinding(privateMismatch, "private_handoff_mismatch"), true);

  const agentOwner = clone();
  agentOwner.monitor.owner = "Feed Intelligence Monitor";
  agentOwner.monitor.triagePolicy.owner = "Feed Intelligence Monitor";
  agentOwner.handoff.owner = "Feed Intelligence Monitor";
  for (const entry of agentOwner.subscriptions) entry.owner = "Feed Intelligence Monitor";
  for (const entry of agentOwner.reviewQueue) entry.owner = "Feed Intelligence Monitor";
  for (const entry of agentOwner.deliveryQueue) entry.owner = "Feed Intelligence Monitor";
  for (const entry of agentOwner.gapsAndBlockers) entry.owner = "Feed Intelligence Monitor";
  assertSchemaValid(agentOwner);
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);

  const incomplete = clone();
  incomplete.handoff.itemRefs.pop();
  assertSchemaValid(incomplete);
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));

  const incompleteBlocked = structuredClone(blocked);
  incompleteBlocked.handoff.blockerRefs = [];
  assertSchemaValid(incompleteBlocked);
  assert.equal(hasFinding(incompleteBlocked, "incomplete_blocked_handoff"), true);

  const inconsistentReady = clone();
  inconsistentReady.handoff.state = "draft";
  assertSchemaValid(inconsistentReady);
  assert.equal(hasFinding(inconsistentReady, "inconsistent_ready_state"), true);

  const premature = clone();
  review(premature, "review-release-compatibility").status = "open";
  review(premature, "review-release-compatibility").resolution = null;
  assertSchemaValid(premature);
  assert.equal(hasFinding(premature, "premature_ready_state"), true);

  const unresolvedDraft = clone();
  makeDraftWithOpenReview(unresolvedDraft);
  signal(unresolvedDraft, "signal-release-august").relevance.state = "unresolved";
  assertSchemaValid(unresolvedDraft);
  assert.equal(isValid(unresolvedDraft), true, JSON.stringify(findings(unresolvedDraft)));

  const insufficientDraft = clone();
  makeDraftWithOpenReview(insufficientDraft);
  signal(insufficientDraft, "signal-release-august").confidence = "insufficient";
  signal(insufficientDraft, "signal-release-august").relevance.state = "unresolved";
  assertSchemaValid(insufficientDraft);
  assert.equal(isValid(insufficientDraft), true, JSON.stringify(findings(insufficientDraft)));

  const insufficientNotUnresolved = clone();
  signal(insufficientNotUnresolved, "signal-release-august").confidence = "insufficient";
  assertSchemaValid(insufficientNotUnresolved);
  assert.equal(
    hasFinding(insufficientNotUnresolved, "insufficient_confidence_requires_review"),
    true,
  );

  const unresolvedSignalReady = clone();
  signal(unresolvedSignalReady, "signal-release-august").relevance.state = "unresolved";
  assertSchemaValid(unresolvedSignalReady);
  assert.equal(hasFinding(unresolvedSignalReady, "premature_ready_state"), true);

  const unresolvedDeltaReady = clone();
  delta(unresolvedDeltaReady, "delta-release-changed").relevance.state = "unresolved";
  assertSchemaValid(unresolvedDeltaReady);
  assert.equal(hasFinding(unresolvedDeltaReady, "premature_ready_state"), true);

  const unresolvedWithoutReview = clone();
  makeDraftWithOpenReview(unresolvedWithoutReview);
  signal(unresolvedWithoutReview, "signal-release-august").relevance.state = "unresolved";
  for (const entry of unresolvedWithoutReview.reviewQueue) {
    entry.signalRefs = entry.signalRefs.filter(
      (id) => id !== "signal-release-august",
    );
    if (entry.signalRefs.length === 0) {
      entry.signalRefs = ["signal-release-july-baseline"];
    }
  }
  assertSchemaValid(unresolvedWithoutReview);
  assert.equal(hasFinding(unresolvedWithoutReview, "missing_required_review"), true);
});

test("authority gates and normalized narrative safety resist action bypasses", () => {
  for (const action of fixture.blockedActions) {
    const missingTopLevel = clone();
    missingTopLevel.blockedActions = missingTopLevel.blockedActions.filter(
      (entry) => entry !== action,
    );
    assertSchemaValid(missingTopLevel);
    assert.equal(hasFinding(missingTopLevel, "missing_authority_gate"), true, action);

    const missingHandoff = clone();
    missingHandoff.handoff.prohibitedActions =
      missingHandoff.handoff.prohibitedActions.filter((entry) => entry !== action);
    assertSchemaValid(missingHandoff);
    assert.equal(hasFinding(missingHandoff, "missing_authority_gate"), true, action);
  }

  for (const narrative of [
    "Subscribe  to the feed now.",
    "Do not subscribe to the feed; however, publish an external report.",
    "Do not publish an external report, but change an account.",
    "Do not contact an external authority: send a notification.",
    "Expose the token to an external service.",
    "Reproduce restricted content from the item.",
    "Fabricate a signal for the absent feed item.",
    "Declare a consensus from repeated feed items.",
    "The update establishes a causal effect on deployment outcomes.",
    "Automatically take a decision without owner review."
  ]) {
    const unsafe = clone();
    unsafe.signals[0].statement = narrative;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative);
  }

  for (const narrative of [
    "We do not subscribe to the feed or unsubscribe from the subscription.",
    "No consensus is inferred from retained feed items.",
    "The source change does not establish a causal effect on deployment outcomes.",
    "We retain the private handoff without changing an account."
  ]) {
    const safe = clone();
    safe.signals[0].statement = narrative;
    assertSchemaValid(safe);
    assert.equal(hasFinding(safe, "unsafe_narrative_content"), false, narrative);
  }
});
