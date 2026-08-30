import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/website-evidence-collector/schemas/website-capture-evidence-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/website-evidence-collector/fixtures/website-capture-evidence-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../claws/website-evidence-collector/templates/website-capture-evidence-ledger.md",
    import.meta.url,
  ),
  "utf8",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("website-evidence-collector", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function target(value, id) {
  return value.targets.find((item) => item.id === id);
}

function attempt(value, id) {
  return value.attempts.find((item) => item.id === id);
}

function snapshot(value, id) {
  return value.snapshots.find((item) => item.id === id);
}

function change(value, id) {
  return value.changes.find((item) => item.id === id);
}

function setOwner(value, owner) {
  value.collection.decisionOwner = owner;
  value.handoff.owner = owner;
  value.ownerReview.owner = owner;
  for (const item of [...value.reviewQuestions, ...value.gapsAndBlockers]) {
    item.owner = owner;
  }
}

function makeBlocked(value) {
  value.collection.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "blocker-retention-window-review",
    kind: "blocker",
    description:
      "The Vendor Risk Review Board must confirm the retention window for the retained excerpts before it reviews the capture set.",
    owner: "Vendor Risk Review Board",
    targetRefs: ["target-northwind-security"],
    changeRefs: ["change-northwind-security"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-retention-window-review");
  value.handoff.blockerRefs = ["blocker-retention-window-review"];
  value.ownerReview.gapAndBlockerRefs.push("blocker-retention-window-review");
}

function makeZeroSuccess(value) {
  value.collection.state = "blocked";
  value.handoff.state = "blocked";
  value.collection.run.outcome = "zero-success";
  value.snapshots = [];
  value.handoff.snapshotRefs = [];
  for (const item of value.attempts) {
    item.disposition = "failure";
    item.httpStatus = 504;
    item.contentType = null;
    item.bytes = null;
    item.contentHash = null;
    item.robots = "allowed";
    item.accessOutcome = "timeout";
    item.snapshotRef = null;
  }
  for (const item of value.targets) {
    item.disposition = item.attemptRefs.length === 0 ? "not-attempted" : "failed";
    item.snapshotRef = null;
    item.freshness = "unavailable";
    item.recheckState = "recheck-required";
    item.omissionReason =
      "The provider timed out for every approved target in this run, so no page was captured and no comparison is claimed.";
  }
  for (const item of value.changes) {
    item.classification = "unavailable";
    item.currentSnapshotRef = null;
    item.currentContentHash = null;
    item.materiality = {
      state: "not-assessable",
      rationale: "No current capture exists, so no change or absence of change can be stated.",
    };
  }
  value.collection.usage.pagesRetrieved = 0;
  value.collection.usage.bytesRetained = 0;
  value.gapsAndBlockers.push({
    id: "blocker-provider-outage",
    kind: "blocker",
    description:
      "Every approved target timed out during the run, so the quarter has no capture evidence and the board must decide whether to schedule another run.",
    owner: "Vendor Risk Review Board",
    targetRefs: value.targets.map((item) => item.id),
    changeRefs: value.changes.map((item) => item.id),
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("blocker-provider-outage");
  value.handoff.blockerRefs = ["blocker-provider-outage"];
  value.ownerReview.gapAndBlockerRefs.push("blocker-provider-outage");
}

test("website capture fixture is a complete private capture and change ledger", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
  assert.match(template, /zero-result search/u);
  assert.match(template, /Identical normalized hashes are never reported as a change/u);
  assert.match(template, /Neither state means unchanged/u);

  const zeroResultDiscovery = fixture.collection.discovery.find(
    (item) => item.resultTargetRefs.length === 0,
  );
  assert.ok(zeroResultDiscovery, "the fixture keeps an explicit zero-result discovery search");
  assert.deepEqual(
    [...new Set(fixture.changes.map((item) => item.classification))].toSorted(),
    ["added", "modified", "removed", "unavailable", "unchanged"],
  );

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));

  const zeroSuccess = clone();
  makeZeroSuccess(zeroSuccess);
  assert.equal(isValid(zeroSuccess), true, JSON.stringify(findings(zeroSuccess)));
});

test("collection control, caps, chronology, and destination stay bounded", () => {
  const duplicate = clone();
  duplicate.targets[1].id = duplicate.targets[0].id;
  assertSchemaValid(duplicate);
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);

  const duplicateDomain = clone();
  duplicateDomain.collection.scope.domains[1].domain =
    duplicateDomain.collection.scope.domains[0].domain;
  assertSchemaValid(duplicateDomain);
  assert.equal(hasFinding(duplicateDomain, "duplicate_reference"), true);

  const duplicateTargetUrl = clone();
  target(duplicateTargetUrl, "target-northwind-privacy").requestedUrl =
    target(duplicateTargetUrl, "target-northwind-security").requestedUrl;
  assertSchemaValid(duplicateTargetUrl);
  assert.equal(hasFinding(duplicateTargetUrl, "duplicate_reference"), true);

  const dangling = clone();
  target(dangling, "target-northwind-security").attemptRefs = ["attempt-missing"];
  assertSchemaValid(dangling);
  assert.equal(hasFinding(dangling, "dangling_reference"), true);

  const chronology = clone();
  chronology.collection.run.completedAt = "2026-08-30T14:59:00Z";
  assertSchemaValid(chronology);
  assert.equal(hasFinding(chronology, "invalid_collection_chronology"), true);

  const lateBaseline = clone();
  lateBaseline.collection.baseline.asOf = "2026-08-30T15:30:00Z";
  assertSchemaValid(lateBaseline);
  assert.equal(hasFinding(lateBaseline, "invalid_collection_chronology"), true);

  const contradictoryFirstRun = clone();
  contradictoryFirstRun.collection.baseline.state = "first-run";
  assertSchemaValid(contradictoryFirstRun);
  assert.equal(hasFinding(contradictoryFirstRun, "invalid_collection_chronology"), true);

  const lateComparison = clone();
  change(lateComparison, "change-northwind-security").comparedAt = "2026-08-30T16:30:00Z";
  assertSchemaValid(lateComparison);
  assert.equal(hasFinding(lateComparison, "invalid_collection_chronology"), true);

  const futureTargetBaseline = clone();
  target(futureTargetBaseline, "target-northwind-security").baseline.capturedAt =
    "2027-01-01T00:00:00Z";
  assertSchemaValid(futureTargetBaseline);
  assert.equal(hasFinding(futureTargetBaseline, "unsupported_baseline_claim"), true);

  const traversal = clone();
  traversal.collection.destination = "outputs/../outside.md";
  traversal.handoff.destination = "outputs/../outside.md";
  assertSchemaValid(traversal);
  assert.equal(hasFinding(traversal, "unsafe_handoff_destination"), true);

  const usageDrift = clone();
  usageDrift.collection.usage.pagesRetrieved = 3;
  assertSchemaValid(usageDrift);
  assert.equal(hasFinding(usageDrift, "invalid_usage_accounting"), true);

  const overCap = clone();
  overCap.collection.caps.maxPages = 3;
  assertSchemaValid(overCap);
  assert.equal(hasFinding(overCap, "exceeded_collection_cap"), true);

  const fakeZeroSuccess = clone();
  fakeZeroSuccess.collection.run.outcome = "zero-success";
  assertSchemaValid(fakeZeroSuccess);
  assert.equal(hasFinding(fakeZeroSuccess, "invalid_zero_success_run"), true);

  const emptyCapturedRun = clone();
  makeZeroSuccess(emptyCapturedRun);
  emptyCapturedRun.collection.run.outcome = "captured";
  assertSchemaValid(emptyCapturedRun);
  assert.equal(hasFinding(emptyCapturedRun, "invalid_zero_success_run"), true);
});

test("approved domain scope and bounded discovery cannot be widened", () => {
  const duplicateRule = clone();
  duplicateRule.collection.scope.domains[1].allowRules.push({
    kind: "path-prefix",
    path: "/trust",
  });
  assertSchemaValid(duplicateRule);
  assert.equal(hasFinding(duplicateRule, "invalid_domain_scope"), true);

  const selfExcluded = clone();
  selfExcluded.collection.scope.domains[1].excludedPaths.push("/trust");
  assertSchemaValid(selfExcluded);
  assert.equal(hasFinding(selfExcluded, "invalid_domain_scope"), true);

  const caseVariantSelfExclusion = clone();
  caseVariantSelfExclusion.collection.scope.domains[1].excludedPaths.push("/Trust");
  assertSchemaValid(caseVariantSelfExclusion);
  assert.equal(hasFinding(caseVariantSelfExclusion, "invalid_domain_scope"), true);

  const earlySearch = clone();
  earlySearch.collection.discovery[0].executedAt = "2026-08-30T14:59:00Z";
  assertSchemaValid(earlySearch);
  assert.equal(hasFinding(earlySearch, "search_outside_collection_run"), true);

  const crossDomainSearch = clone();
  crossDomainSearch.collection.discovery[1].resultTargetRefs = [
    "target-northwind-subprocessors",
  ];
  assertSchemaValid(crossDomainSearch);
  assert.equal(hasFinding(crossDomainSearch, "discovery_domain_mismatch"), true);

  const unearnedDiscovery = clone();
  target(unearnedDiscovery, "target-northwind-privacy").discoveryRef =
    "search-northwind-subprocessors";
  assertSchemaValid(unearnedDiscovery);
  assert.equal(hasFinding(unearnedDiscovery, "invalid_discovery_provenance"), true);

  const unlinkedDiscovery = clone();
  target(unlinkedDiscovery, "target-northwind-subprocessors").discoveryRef = null;
  assertSchemaValid(unlinkedDiscovery);
  assert.equal(hasFinding(unlinkedDiscovery, "invalid_discovery_provenance"), true);
});

test("target URLs, page types, and redirects stay inside the approved allowlist", () => {
  for (const requestedUrl of [
    "http://trust.northwind.example/security/overview",
    "https://trust.northwind.example/security/overview#internal",
    "https://trust.northwind.example/security/overview?token=secret",
    "https://127.0.0.1/security/overview",
    "https://trust.other.example/security/overview",
    "https://staging.trust.northwind.example/security/overview",
    "https://trust.northwind.example/",
    "https://trust.northwind.example/marketing/overview",
    "https://trust.northwind.example/legal/archive/2024-privacy-notice",
    "https://trust.northwind.example/legal/Archive/2024-privacy-notice",
    "https://trust.northwind.example/legal/%61rchive/2024-privacy-notice",
    "https://trust.northwind.example/security%2Foverview",
    "https://trust.northwind.example/%73ecurity%2Foverview",
    "https://trust.northwind.example/legal%2Fprivacy-notice",
    "https://trust.northwind.example/legal/..%2Faccount",
    "https://",
  ]) {
    const unsafe = clone();
    target(unsafe, "target-northwind-security").requestedUrl = requestedUrl;
    assertSchemaValid(unsafe);
    assert.equal(
      hasFinding(unsafe, "target_outside_approved_scope"),
      true,
      requestedUrl,
    );
  }

  const unapprovedPageType = clone();
  target(unapprovedPageType, "target-northwind-security").pageType = "terms";
  assertSchemaValid(unapprovedPageType);
  assert.equal(hasFinding(unapprovedPageType, "target_outside_approved_scope"), true);

  const escapingRedirect = clone();
  const redirected = attempt(escapingRedirect, "attempt-contoso-security");
  redirected.redirectChain = ["https://policies.contoso.example/account/security-overview"];
  redirected.finalUrl = "https://policies.contoso.example/account/security-overview";
  assertSchemaValid(escapingRedirect);
  assert.equal(hasFinding(escapingRedirect, "capture_outside_approved_scope"), true);

  const swappedRequest = clone();
  attempt(swappedRequest, "attempt-northwind-privacy").requestedUrl =
    "https://trust.northwind.example/legal/subprocessors";
  assertSchemaValid(swappedRequest);
  assert.equal(hasFinding(swappedRequest, "capture_outside_approved_scope"), true);

  const unrecordedRedirect = clone();
  attempt(unrecordedRedirect, "attempt-northwind-security").finalUrl =
    "https://trust.northwind.example/legal/privacy-notice";
  assertSchemaValid(unrecordedRedirect);
  assert.equal(hasFinding(unrecordedRedirect, "invalid_redirect_lineage"), true);

  const truncatedRedirect = clone();
  attempt(truncatedRedirect, "attempt-contoso-security").redirectChain = [
    "https://policies.contoso.example/trust/security-overview",
    "https://policies.contoso.example/trust/security-detail",
  ];
  assertSchemaValid(truncatedRedirect);
  assert.equal(hasFinding(truncatedRedirect, "invalid_redirect_lineage"), true);

  const loopingRedirect = clone();
  attempt(loopingRedirect, "attempt-contoso-security").redirectChain = [
    "https://policies.contoso.example/trust/security",
    "https://policies.contoso.example/trust/security-overview",
  ];
  assertSchemaValid(loopingRedirect);
  assert.equal(hasFinding(loopingRedirect, "invalid_redirect_lineage"), true);
});

test("attempt dispositions, chronology, and target accounting stay truthful", () => {
  const earlyAttempt = clone();
  attempt(earlyAttempt, "attempt-northwind-security").requestedAt = "2026-08-30T14:59:00Z";
  assertSchemaValid(earlyAttempt);
  assert.equal(hasFinding(earlyAttempt, "invalid_attempt_chronology"), true);

  const reversedAttempt = clone();
  attempt(reversedAttempt, "attempt-northwind-security").completedAt =
    "2026-08-30T15:09:00Z";
  assertSchemaValid(reversedAttempt);
  assert.equal(hasFinding(reversedAttempt, "invalid_attempt_chronology"), true);

  for (const mutate of [
    (value) => {
      attempt(value, "attempt-northwind-security").httpStatus = 404;
    },
    (value) => {
      attempt(value, "attempt-northwind-security").contentType = null;
    },
    (value) => {
      attempt(value, "attempt-northwind-security").robots = "unavailable";
    },
    (value) => {
      attempt(value, "attempt-northwind-security").accessOutcome = "paywalled";
    },
    (value) => {
      attempt(value, "attempt-contoso-status-notice").robots = "disallowed";
    },
    (value) => {
      attempt(value, "attempt-contoso-status-notice").accessOutcome = "forbidden";
    },
    (value) => {
      attempt(value, "attempt-contoso-subprocessors").robots = "allowed";
      attempt(value, "attempt-contoso-subprocessors").accessOutcome = "not-found";
    },
    (value) => {
      attempt(value, "attempt-contoso-subprocessors").bytes = 1024;
    },
  ]) {
    const invalid = clone();
    mutate(invalid);
    assertSchemaValid(invalid);
    assert.equal(hasFinding(invalid, "invalid_attempt_disposition"), true);
  }

  const capturedWithOmission = clone();
  target(capturedWithOmission, "target-northwind-security").omissionReason =
    "The capture succeeded, so no omission exists.";
  assertSchemaValid(capturedWithOmission);
  assert.equal(hasFinding(capturedWithOmission, "invalid_target_accounting"), true);

  const unattemptedWithAttempt = clone();
  target(unattemptedWithAttempt, "target-northwind-retention-appendix").attemptRefs = [
    "attempt-northwind-security",
  ];
  assertSchemaValid(unattemptedWithAttempt);
  assert.equal(hasFinding(unattemptedWithAttempt, "invalid_target_accounting"), true);

  for (const [attemptRef, disposition] of [
    ["attempt-contoso-status-notice", "failed"],
    ["attempt-contoso-subprocessors", "blocked"],
  ]) {
    const borrowedAttempt = clone();
    const borrowedTarget = target(
      borrowedAttempt,
      "target-northwind-retention-appendix",
    );
    borrowedTarget.attemptRefs = [attemptRef];
    borrowedTarget.disposition = disposition;
    assertSchemaValid(borrowedAttempt);
    assert.equal(hasFinding(borrowedAttempt, "invalid_target_accounting"), true);
  }

  const failedWithoutReason = clone();
  target(failedWithoutReason, "target-contoso-status-notice").omissionReason = null;
  assertSchemaValid(failedWithoutReason);
  assert.equal(hasFinding(failedWithoutReason, "invalid_target_accounting"), true);

  const blockedClaimedCaptured = clone();
  target(blockedClaimedCaptured, "target-contoso-subprocessors").disposition = "captured";
  assertSchemaValid(blockedClaimedCaptured);
  assert.equal(hasFinding(blockedClaimedCaptured, "invalid_target_accounting"), true);

  const orphanAttempt = clone();
  target(orphanAttempt, "target-northwind-security").attemptRefs = [];
  assertSchemaValid(orphanAttempt);
  assert.equal(hasFinding(orphanAttempt, "incomplete_target_coverage"), true);
});

test("snapshots bind to their capture and minimize retained page content", () => {
  const rebound = clone();
  snapshot(rebound, "snapshot-northwind-security").canonicalUrl =
    "https://trust.northwind.example/legal/privacy-notice";
  assertSchemaValid(rebound);
  assert.equal(hasFinding(rebound, "invalid_snapshot_binding"), true);

  const rehashed = clone();
  snapshot(rehashed, "snapshot-northwind-security").bytes = 48121;
  assertSchemaValid(rehashed);
  assert.equal(hasFinding(rehashed, "invalid_snapshot_binding"), true);

  const retimed = clone();
  snapshot(retimed, "snapshot-northwind-security").capturedAt = "2026-08-30T15:11:00Z";
  assertSchemaValid(retimed);
  assert.equal(hasFinding(retimed, "invalid_snapshot_binding"), true);

  const oversizedExcerpt = clone();
  const oversized = snapshot(oversizedExcerpt, "snapshot-northwind-security");
  oversized.excerpt = "x".repeat(401);
  oversized.excerptCharacters = 401;
  assertSchemaValid(oversizedExcerpt);
  assert.equal(hasFinding(oversizedExcerpt, "excessive_retained_content"), true);

  const miscountedExcerpt = clone();
  snapshot(miscountedExcerpt, "snapshot-northwind-security").excerptCharacters = 12;
  assertSchemaValid(miscountedExcerpt);
  assert.equal(hasFinding(miscountedExcerpt, "excessive_retained_content"), true);

  const hashOnlyWithText = clone();
  snapshot(hashOnlyWithText, "snapshot-northwind-privacy").excerpt =
    "Retained page text that the hash-only retention mode does not permit.";
  snapshot(hashOnlyWithText, "snapshot-northwind-privacy").excerptCharacters = 69;
  assertSchemaValid(hashOnlyWithText);
  assert.equal(hasFinding(hashOnlyWithText, "excessive_retained_content"), true);

  const missingExcerpt = clone();
  const emptied = snapshot(missingExcerpt, "snapshot-northwind-security");
  emptied.excerpt = null;
  emptied.excerptCharacters = 0;
  assertSchemaValid(missingExcerpt);
  assert.equal(hasFinding(missingExcerpt, "excessive_retained_content"), true);

  const mergedNote = clone();
  const merged = snapshot(mergedNote, "snapshot-northwind-security");
  merged.analystNote = merged.excerpt;
  assertSchemaValid(mergedNote);
  assert.equal(hasFinding(mergedNote, "excessive_retained_content"), true);

  const oversizedForSchema = clone();
  snapshot(oversizedForSchema, "snapshot-northwind-security").excerpt = "x".repeat(601);
  assert.equal(validateSchema(oversizedForSchema), false);
});

test("baseline comparison cannot invent, hide, or relabel a change", () => {
  const unclassified = clone();
  change(unclassified, "change-northwind-security").targetRef = "target-northwind-privacy";
  assertSchemaValid(unclassified);
  assert.equal(hasFinding(unclassified, "unclassified_target"), true);

  const unrecordedBaseline = clone();
  change(unrecordedBaseline, "change-northwind-subprocessors").priorSnapshotRef =
    "snapshot-northwind-subprocessors-20260529";
  assertSchemaValid(unrecordedBaseline);
  assert.equal(hasFinding(unrecordedBaseline, "unsupported_baseline_claim"), true);

  const driftedBaseline = clone();
  change(driftedBaseline, "change-northwind-security").priorContentHash = `sha256:${"0".repeat(64)}`;
  assertSchemaValid(driftedBaseline);
  assert.equal(hasFinding(driftedBaseline, "unsupported_baseline_claim"), true);

  const droppedBaseline = clone();
  const dropped = change(droppedBaseline, "change-northwind-privacy");
  dropped.priorSnapshotRef = null;
  dropped.priorContentHash = null;
  dropped.priorCapturedAt = null;
  assertSchemaValid(droppedBaseline);
  assert.equal(hasFinding(droppedBaseline, "unsupported_baseline_claim"), true);

  for (const mutate of [
    (value) => {
      const baseline = target(value, "target-northwind-security").baseline;
      baseline.runId = null;
      baseline.capturedAt = null;
      baseline.contentHash = null;
      baseline.snapshotRef = null;
    },
    (value) => {
      const baseline = target(value, "target-northwind-retention-appendix").baseline;
      baseline.runId = "run-vendor-pages-2026q2";
      baseline.capturedAt = "2026-05-29T12:05:00Z";
      baseline.contentHash = `sha256:${"0".repeat(64)}`;
      baseline.snapshotRef = "snapshot-retention-appendix-2026q2";
    },
  ]) {
    const incoherentBaseline = clone();
    mutate(incoherentBaseline);
    assert.equal(validateSchema(incoherentBaseline), false);
  }

  const firstRunNotFound = clone();
  const firstRunTarget = target(firstRunNotFound, "target-contoso-status-notice");
  firstRunTarget.baseline = {
    state: "none",
    runId: null,
    capturedAt: null,
    contentHash: null,
    snapshotRef: null,
  };
  const firstRunChange = change(firstRunNotFound, "change-contoso-status-notice");
  firstRunChange.classification = "unavailable";
  firstRunChange.priorSnapshotRef = null;
  firstRunChange.priorContentHash = null;
  firstRunChange.priorCapturedAt = null;
  firstRunChange.materiality = {
    state: "not-assessable",
    rationale: "The first-run target returned 404, so no current or prior capture exists.",
  };
  assertSchemaValid(firstRunNotFound);
  assert.equal(isValid(firstRunNotFound), true, JSON.stringify(findings(firstRunNotFound)));

  const comparisonBeforeCapture = clone();
  change(comparisonBeforeCapture, "change-northwind-security").comparedAt =
    "2026-08-30T15:10:03Z";
  assertSchemaValid(comparisonBeforeCapture);
  assert.equal(hasFinding(comparisonBeforeCapture, "invalid_collection_chronology"), true);

  const unboundSnapshot = clone();
  change(unboundSnapshot, "change-northwind-privacy").currentSnapshotRef =
    "snapshot-northwind-security";
  assertSchemaValid(unboundSnapshot);
  assert.equal(hasFinding(unboundSnapshot, "invalid_change_classification"), true);

  const removedWithoutNotFound = clone();
  change(removedWithoutNotFound, "change-contoso-subprocessors").classification = "removed";
  assertSchemaValid(removedWithoutNotFound);
  assert.equal(hasFinding(removedWithoutNotFound, "invalid_change_classification"), true);

  const unavailableForCapture = clone();
  change(unavailableForCapture, "change-northwind-privacy").classification = "unavailable";
  assertSchemaValid(unavailableForCapture);
  assert.equal(hasFinding(unavailableForCapture, "invalid_change_classification"), true);

  const notFoundClaimedUnavailable = clone();
  change(notFoundClaimedUnavailable, "change-contoso-status-notice").classification =
    "unavailable";
  assertSchemaValid(notFoundClaimedUnavailable);
  assert.equal(
    hasFinding(notFoundClaimedUnavailable, "invalid_change_classification"),
    true,
  );

  const inventedChange = clone();
  change(inventedChange, "change-northwind-privacy").classification = "modified";
  assertSchemaValid(inventedChange);
  assert.equal(hasFinding(inventedChange, "false_change_claim"), true);

  const hiddenChange = clone();
  change(hiddenChange, "change-northwind-security").classification = "unchanged";
  assertSchemaValid(hiddenChange);
  assert.equal(hasFinding(hiddenChange, "false_change_claim"), true);

  const identicalRedirectedPage = clone();
  assert.equal(
    change(identicalRedirectedPage, "change-contoso-security").classification,
    "unchanged",
  );
  assert.equal(isValid(identicalRedirectedPage), true);
});

test("materiality stays an owner-review input rather than a collector conclusion", () => {
  const decidedMateriality = clone();
  change(decidedMateriality, "change-northwind-security").materiality.state = "no-change";
  assertSchemaValid(decidedMateriality);
  assert.equal(hasFinding(decidedMateriality, "invalid_materiality_state"), true);

  const escalatedUnchanged = clone();
  change(escalatedUnchanged, "change-northwind-privacy").materiality.state =
    "owner-review-required";
  assertSchemaValid(escalatedUnchanged);
  assert.equal(hasFinding(escalatedUnchanged, "invalid_materiality_state"), true);

  const assessedUnavailable = clone();
  change(assessedUnavailable, "change-contoso-subprocessors").materiality.state = "no-change";
  assertSchemaValid(assessedUnavailable);
  assert.equal(hasFinding(assessedUnavailable, "invalid_materiality_state"), true);

  const unroutedChange = clone();
  unroutedChange.reviewQuestions[0].changeRefs = [];
  assertSchemaValid(unroutedChange);
  assert.equal(hasFinding(unroutedChange, "missing_owner_review_routing"), true);

  const unroutedOmission = clone();
  unroutedOmission.gapsAndBlockers[0].targetRefs = [];
  assertSchemaValid(unroutedOmission);
  assert.equal(hasFinding(unroutedOmission, "missing_owner_review_routing"), true);
});

test("ready handoffs reject stale, unresolved, or incomplete capture records", () => {
  const stale = clone();
  target(stale, "target-northwind-security").freshness = "stale";
  assertSchemaValid(stale);
  assert.equal(hasFinding(stale, "stale_capture"), true);

  const recheckPending = clone();
  target(recheckPending, "target-northwind-security").recheckState = "recheck-required";
  assertSchemaValid(recheckPending);
  assert.equal(hasFinding(recheckPending, "stale_capture"), true);

  const unrequestedRecheck = clone();
  target(unrequestedRecheck, "target-contoso-subprocessors").recheckState = "current";
  assertSchemaValid(unrequestedRecheck);
  assert.equal(hasFinding(unrequestedRecheck, "stale_capture"), true);

  const aged = clone();
  aged.collection.asOf = "2026-09-05T16:00:00Z";
  aged.collection.run.asOf = "2026-09-05T16:00:00Z";
  aged.collection.deadline = "2026-09-06T17:00:00Z";
  assertSchemaValid(aged);
  assert.equal(hasFinding(aged, "stale_capture"), true);

  const inconsistent = clone();
  inconsistent.handoff.state = "draft";
  assertSchemaValid(inconsistent);
  assert.equal(hasFinding(inconsistent, "inconsistent_ready_state"), true);

  const blockedMismatch = clone();
  blockedMismatch.collection.state = "blocked";
  assertSchemaValid(blockedMismatch);
  assert.equal(hasFinding(blockedMismatch, "inconsistent_ready_state"), true);

  for (const mutate of [
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
    (value) => {
      value.ownerReview.reviewedAt = "2026-08-30T16:30:00Z";
    },
    (value) => {
      value.ownerReview.reviewedAt = "2020-01-01T00:00:00Z";
    },
    (value) => {
      value.collection.run.outcome = "zero-success";
    },
  ]) {
    const premature = clone();
    mutate(premature);
    assertSchemaValid(premature);
    assert.equal(hasFinding(premature, "premature_ready_state"), true);
  }

  const openBlockerWithoutHandoff = clone();
  makeBlocked(openBlockerWithoutHandoff);
  openBlockerWithoutHandoff.handoff.blockerRefs = [];
  assertSchemaValid(openBlockerWithoutHandoff);
  assert.equal(hasFinding(openBlockerWithoutHandoff, "incomplete_blocked_handoff"), true);

  const resolvedBlockerStillListed = clone();
  makeBlocked(resolvedBlockerStillListed);
  resolvedBlockerStillListed.gapsAndBlockers.at(-1).status = "resolved";
  assertSchemaValid(resolvedBlockerStillListed);
  assert.equal(hasFinding(resolvedBlockerStillListed, "incomplete_blocked_handoff"), true);
});

test("owner authority, review coherence, and the private handoff stay human-owned", () => {
  const openQuestion = clone();
  openQuestion.reviewQuestions[0].status = "open";
  assertSchemaValid(openQuestion);
  assert.equal(hasFinding(openQuestion, "incoherent_review_question"), true);

  const foreignQuestionOwner = clone();
  foreignQuestionOwner.reviewQuestions[0].owner = "Other Review Team";
  assertSchemaValid(foreignQuestionOwner);
  assert.equal(hasFinding(foreignQuestionOwner, "incoherent_review_question"), true);

  const wrongGapOwner = clone();
  wrongGapOwner.gapsAndBlockers[0].owner = "Other Review Team";
  assertSchemaValid(wrongGapOwner);
  assert.equal(hasFinding(wrongGapOwner, "owner_mismatch"), true);

  const wrongHandoffOwner = clone();
  wrongHandoffOwner.handoff.owner = "Other Review Team";
  assertSchemaValid(wrongHandoffOwner);
  assert.equal(hasFinding(wrongHandoffOwner, "owner_mismatch"), true);

  for (const owner of [
    "Website evidence collector",
    "GPT-5",
    "Claw",
    "the assistant",
    "language model",
    "the bot",
    "AI agent",
    "Claw agent",
    "Automated capture agent",
    "Autonomous review bot",
    "Copilot",
    "The collector",
  ]) {
    const agentOwner = clone();
    setOwner(agentOwner, owner);
    assertSchemaValid(agentOwner);
    assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true, owner);
  }

  for (const owner of [
    "Vendor Risk Review Board",
    "Lead Web Archivist",
    "Agent Operations Team",
    "Assistant General Counsel",
    "AI Risk Committee",
    "Responsible AI Council",
    "AI Model Governance Board",
    "AI System Review Board",
  ]) {
    const humanOwner = clone();
    setOwner(humanOwner, owner);
    assertSchemaValid(humanOwner);
    assert.equal(hasFinding(humanOwner, "agent_owned_authority"), false, owner);
  }

  const privateMismatch = clone();
  privateMismatch.handoff.destination = "outputs/other-handoff.md";
  assertSchemaValid(privateMismatch);
  assert.equal(hasFinding(privateMismatch, "private_handoff_mismatch"), true);

  const reviewMismatch = clone();
  reviewMismatch.handoff.ownerReviewRef = "owner-review-other-20260830";
  assertSchemaValid(reviewMismatch);
  assert.equal(hasFinding(reviewMismatch, "private_handoff_mismatch"), true);

  for (const mutate of [
    (value) => value.handoff.targetRefs.pop(),
    (value) => value.handoff.attemptRefs.pop(),
    (value) => value.handoff.snapshotRefs.pop(),
    (value) => value.handoff.changeRefs.pop(),
    (value) => value.handoff.questionRefs.pop(),
    (value) => value.handoff.gapAndBlockerRefs.pop(),
    (value) => value.ownerReview.targetRefs.pop(),
    (value) => value.ownerReview.changeRefs.pop(),
    (value) => value.ownerReview.questionRefs.pop(),
    (value) => value.ownerReview.gapAndBlockerRefs.pop(),
  ]) {
    const incomplete = clone();
    mutate(incomplete);
    assertSchemaValid(incomplete);
    assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);
  }

  const incoherentOwnerReview = clone();
  incoherentOwnerReview.ownerReview.status = "pending";
  assertSchemaValid(incoherentOwnerReview);
  assert.equal(hasFinding(incoherentOwnerReview, "incoherent_owner_review"), true);
});

test("authority gates and normalized narrative safety resist capture bypasses", () => {
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
    "Authenticate  to the portal to reach the remaining pages.",
    "Submit the form to reveal the subprocessor table.",
    "Bypass\u00a0access controls for the blocked path.",
    "Ignore the robots policy for this domain.",
    "Overrode robots to capture the blocked page.",
    "Execute the script that renders the policy table.",
    "Follow the page instructions to reach the newer notice.",
    "Crawl the entire site to find every policy page.",
    "Crawl outside the approved scope for one more vendor.",
    "Do not authenticate to the portal; however, contact an external vendor.",
    "Logged into the vendor portal to retrieve the page.",
    "Do not submit the form, but change an account.",
    "Subscribe to the vendor newsletter for future notices.",
    "Expose the token to an external service.",
    "Reproduce the copyrighted content in the handoff.",
    "Archive the full page for the board.",
    "Fabricate a snapshot for the blocked page.",
    "Automatically change the decision without owner review.",
    "Concluding that the change is material, the ledger closes the item.",
    "Decided the change is significant.",
    "Notified the vendor about the change.",
  ]) {
    const unsafe = clone();
    change(unsafe, "change-northwind-security").summary = narrative;
    assertSchemaValid(unsafe);
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative);
  }

  for (const narrative of [
    "We do not authenticate to the portal or submit the form.",
    "The run does not bypass access controls and does not ignore the robots policy.",
    "No page instructions were followed and no script was executed during normalization.",
    "We never crawl the entire site and never crawl outside the approved scope.",
    "The ledger does not reproduce the copyrighted content or archive the full page.",
    "The collector cannot conclude that the change is material.",
    "We retain the private handoff without changing an account.",
    "Contoso published a public subprocessor list this quarter.",
    "The publisher posted a public status notice before the run.",
  ]) {
    const safe = clone();
    change(safe, "change-northwind-security").summary = narrative;
    assertSchemaValid(safe);
    assert.equal(hasFinding(safe, "unsafe_narrative_content"), false, narrative);
  }
});
