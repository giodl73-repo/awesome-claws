import { createHash } from "node:crypto";

export const REPOSITORY_OPERATIONS_SCHEMA_VERSION =
  "awesomeClaws.repositoryOperations.v1";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const CLAW_PRINCIPAL_ID = "principal-repository-operations-claw";
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const REQUIRED_AUTHORITY_GATES = Object.freeze({
  codeChangeClaim: "not-claimed",
  branchChangeClaim: "not-claimed",
  mergeClaim: "not-claimed",
  buildActionClaim: "not-claimed",
  releaseClaim: "not-claimed",
  settingsClaim: "not-claimed",
  riskAcceptanceClaim: "not-claimed",
  approvalClaim: "not-claimed",
  externalCommunicationClaim: "dispatch-receipts-only",
});
const ENTITY_STATES = Object.freeze({
  repository: new Set(["current", "missing"]),
  "pull-request": new Set(["open", "merged", "closed"]),
  review: new Set(["approved", "changes-requested", "commented", "dismissed", "stale"]),
  check: new Set(["passed", "failed", "pending", "cancelled", "missing", "superseded"]),
  build: new Set(["succeeded", "failed", "running", "cancelled", "missing", "superseded"]),
  "release-train": new Set([
    "planned",
    "partial",
    "failed",
    "rolled-back",
    "superseded",
    "released",
  ]),
});
const FORBIDDEN_ACTION =
  String.raw`(?:accept(?:s|ed|ing)?|author(?:s|ed|ing)?|commit(?:s|ted|ting)?|push(?:es|ed|ing)?|merg(?:e|es|ed|ing)|clos(?:e|es|ed|ing)|delet(?:e|es|ed|ing)|dismiss(?:es|ed|ing)?|rerun(?:s|ning)?|reran|cancel(?:s|led|ling|ed|ing)?|waiv(?:e|es|ed|ing)|approv(?:e|es|ed|ing)|releas(?:e|es|ed|ing)|publish(?:es|ed|ing)?|deploy(?:s|ed|ing)?|chang(?:e|es|ed|ing)|tag(?:s|ged|ging)?|notif(?:y|ies|ied|ying)|contact(?:s|ed|ing)?|send(?:s|ing)?|sent)`;
const FORBIDDEN_TARGET =
  String.raw`(?:code|repository|branch|pull request|pr|review|build|check|release|artifact|settings|risk|change|approver|recipient|owner|message|(?:approval\s+)?request)`;
const FORBIDDEN_ACTOR =
  String.raw`(?:(?:(?:the|this|an?)\s+)?(?:repository operations manager|claw|agent|assistant)|we|i)`;
const NON_NEGATED_CLAUSE =
  String.raw`(?:(?!\b(?:not|never|neither|no)\b|n't|[.!?])[\s\S]){0,120}?`;
const FORBIDDEN_NARRATIVE = new RegExp(
  [
    String.raw`\b${FORBIDDEN_ACTOR}\b${NON_NEGATED_CLAUSE}\b${FORBIDDEN_ACTION}\s+(?:the\s+)?${FORBIDDEN_TARGET}\b`,
    String.raw`\b${FORBIDDEN_ACTOR}\b(?:(?![.!?])[\s\S]){0,160}?\b(?:but|yet)\s+\b${FORBIDDEN_ACTION}\s+(?:the\s+)?${FORBIDDEN_TARGET}\b`,
    String.raw`\b(?:the\s+)?${FORBIDDEN_TARGET}\b${NON_NEGATED_CLAUSE}\b${FORBIDDEN_ACTION}\b${NON_NEGATED_CLAUSE}\bby\s+${FORBIDDEN_ACTOR}\b`,
    String.raw`(?:^|[.!?]\s+)\s*\b${FORBIDDEN_ACTION}\s+(?:the\s+)?${FORBIDDEN_TARGET}\b`,
  ].join("|"),
  "gimu",
);
const ADJACENT_NEGATION =
  /\b(?:did not|does not|do not|is not|are not|was not|were not|has not|have not|will not|would not|should not|could not|not|no|neither|never|without|cannot|must not|didn't|doesn't|don't|isn't|aren't|wasn't|weren't|hasn't|haven't|won't|wouldn't|shouldn't|couldn't|can't|mustn't)\s*$/iu;
const COORDINATED_NEGATION =
  /^\s*(?:(?:[A-Za-z0-9_-]+\s+){0,6})(?:,?\s*(?:and|or)\s*)$/iu;

const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "artifactId",
  "run",
  "roster",
  "predecessor",
  "snapshots",
  "repositories",
  "pullRequests",
  "reviews",
  "checks",
  "builds",
  "artifacts",
  "releaseTrains",
  "dependencies",
  "principals",
  "escalationPolicy",
  "escalations",
  "responses",
  "evidence",
  "delta",
  "blockers",
  "readiness",
  "handoff",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function compare(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function sorted(value) {
  return [...strings(value)].sort(compare);
}

function sortedRecords(value) {
  return [...records(value)].sort((left, right) => compare(left.id, right.id));
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort(compare)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonInner(value[key], next)}`)
      .join(",")}}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "bigint") return JSON.stringify(String(value));
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  return "null";
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function timestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isControlledUri(value) {
  // Controlled refs are opaque internal locators; they are not fetched as network URLs.
  return typeof value === "string" && /^controlled:\/\/.+/u.test(value);
}

function sameSet(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  const left = sorted(actual);
  const right = sorted(expected);
  return (
    left.length === actual.length &&
    right.length === expected.length &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function mapById(value) {
  return new Map(
    records(value)
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, row]),
  );
}

function expectedEscalationState(escalation, responses, responseValidity) {
  const response = escalation?.responseRef ? responses.get(escalation.responseRef) : null;
  if (!response || responseValidity.get(response.id) !== true) return "dispatched";
  return response?.outcome === "approved"
    ? "approved"
    : response?.outcome === "rejected"
      ? "rejected"
      : response?.outcome === "change-requested"
        ? "change-requested"
        : response?.outcome === "expired"
          ? "expired"
          : response?.outcome === "no-response"
            ? "no-response"
            : "dispatched";
}

function escalationBlockerCategory(state) {
  return {
    dispatched: "approval-required",
    rejected: "approval-rejected",
    "change-requested": "approval-change-requested",
    expired: "approval-expired",
    "no-response": "approval-no-response",
  }[state];
}

function releaseBlockerCategory(state) {
  return {
    planned: "missing-evidence",
    partial: "partial-release",
    failed: "failed-release",
    "rolled-back": "rolled-back-release",
    superseded: "superseded-release",
  }[state];
}

export function computeReviewRevision(review) {
  const row = object(review);
  return digest({
    id: row.id ?? null,
    pullRequestRef: row.pullRequestRef ?? null,
    headSha: row.headSha ?? null,
    authorRef: row.authorRef ?? null,
    state: row.state ?? null,
    submittedAt: row.submittedAt ?? null,
    snapshotRef: row.snapshotRef ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceDigest: row.evidenceDigest ?? null,
  });
}

export function computeBlockerResolutionRevision(blocker) {
  const row = object(blocker);
  const history = object(row.missingEvidenceHistory);
  return digest({
    id: row.id ?? null,
    category: row.category ?? null,
    subjectRefs: sorted(row.subjectRefs),
    ownerRef: row.ownerRef ?? null,
    evidenceRefs: sorted(row.evidenceRefs),
    state: row.state ?? null,
    missingEvidenceHistory:
      row.missingEvidenceHistory === undefined
        ? null
        : {
            checkpointRef: history.checkpointRef ?? null,
            subjectRef: history.subjectRef ?? null,
            priorRevision: history.priorRevision ?? null,
            priorState: history.priorState ?? null,
            closureEvidenceRef: history.closureEvidenceRef ?? null,
          },
  });
}

export function computeCheckRevision(check) {
  const row = object(check);
  return digest({
    id: row.id ?? null,
    pullRequestRef: row.pullRequestRef ?? null,
    headSha: row.headSha ?? null,
    context: row.context ?? null,
    required: row.required ?? null,
    state: row.state ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    snapshotRef: row.snapshotRef ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceDigest: row.evidenceDigest ?? null,
  });
}

export function computePullRequestSourceRevision(pullRequest) {
  const row = object(pullRequest);
  return digest({
    id: row.id ?? null,
    repositoryRef: row.repositoryRef ?? null,
    number: row.number ?? null,
    previousHeadSha: row.previousHeadSha ?? null,
    currentHeadSha: row.currentHeadSha ?? null,
    state: row.state ?? null,
    snapshotRef: row.snapshotRef ?? null,
    sourceEvidenceRef: row.sourceEvidenceRef ?? null,
    sourceEvidenceDigest: row.sourceEvidenceDigest ?? null,
  });
}

export function computeBuildRevision(build) {
  const row = object(build);
  return digest({
    id: row.id ?? null,
    repositoryRef: row.repositoryRef ?? null,
    pullRequestRef: row.pullRequestRef ?? null,
    headSha: row.headSha ?? null,
    runId: row.runId ?? null,
    state: row.state ?? null,
    artifactRefs: sorted(row.artifactRefs),
    snapshotRef: row.snapshotRef ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceDigest: row.evidenceDigest ?? null,
  });
}

export function computeReleaseEvidenceRevision(releaseTrain) {
  const row = object(releaseTrain);
  return digest({
    id: row.id ?? null,
    revision: row.revision ?? null,
    repositoryRefs: sorted(row.repositoryRefs),
    entries: records(row.entries)
      .map((entry) => ({
        repositoryRef: entry.repositoryRef ?? null,
        targetHeadSha: entry.targetHeadSha ?? null,
        order: entry.order ?? null,
        state: entry.state ?? null,
        artifactRefs: sorted(entry.artifactRefs),
      }))
      .sort((left, right) => compare(left.repositoryRef, right.repositoryRef)),
    state: row.state ?? null,
    snapshotRef: row.snapshotRef ?? null,
    releaseEvidenceRef: row.releaseEvidenceRef ?? null,
    releaseEvidenceDigest: row.releaseEvidenceDigest ?? null,
  });
}

export function computeApprovalResponseRevision(response) {
  const row = object(response);
  return digest({
    id: row.id ?? null,
    kind: row.kind ?? null,
    requestRef: row.requestRef ?? null,
    requestDedupeKey: row.requestDedupeKey ?? null,
    targetRef: row.targetRef ?? null,
    targetRevision: row.targetRevision ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceRevision: row.evidenceRevision ?? null,
    authorRef: row.authorRef ?? null,
    outcome: row.outcome ?? null,
    authoredAt: row.authoredAt ?? null,
  });
}

function finding(code, path, refs = []) {
  return { code, path, refs: [...new Set(strings(refs))].sort(compare) };
}

function currentRevisionEntries(artifact) {
  return [
    ...records(artifact.repositories).map((row) => ({
      entityRef: row.id,
      entityType: "repository",
      revision: computeRepositoryRevision(row),
      state: row.state,
    })),
    ...records(artifact.pullRequests).map((row) => ({
      entityRef: row.id,
      entityType: "pull-request",
      revision: computePullRequestSourceRevision(row),
      state: row.state,
    })),
    ...records(artifact.reviews).map((row) => ({
      entityRef: row.id,
      entityType: "review",
      revision: computeReviewRevision(row),
      state: row.state,
    })),
    ...records(artifact.checks).map((row) => ({
      entityRef: row.id,
      entityType: "check",
      revision: computeCheckRevision(row),
      state: row.state,
    })),
    ...records(artifact.builds).map((row) => ({
      entityRef: row.id,
      entityType: "build",
      revision: computeBuildRevision(row),
      state: row.state,
    })),
    ...records(artifact.releaseTrains).map((row) => ({
      entityRef: row.id,
      entityType: "release-train",
      revision: computeReleaseEvidenceRevision(row),
      state: row.state,
    })),
  ].sort((left, right) => compare(left.entityRef, right.entityRef));
}

export function computeRepositoryRevision(repository) {
  const row = object(repository);
  return digest({
    id: row.id ?? null,
    canonicalName: row.canonicalName ?? null,
    defaultBranch: row.defaultBranch ?? null,
    ownerRef: row.ownerRef ?? null,
    policyRevision: row.policyRevision ?? null,
    requiredCheckContexts: sorted(row.requiredCheckContexts),
    requiredApprovalCount: row.requiredApprovalCount ?? null,
    eligibleReviewerRefs: sorted(row.eligibleReviewerRefs),
    rosterRevision: row.rosterRevision ?? null,
    snapshotRefs: sorted(row.snapshotRefs),
    state: row.state ?? null,
  });
}

function expectedDeltaKind(before, after) {
  if (!before) return "opened";
  if (!after) return "removed";
  switch (after.entityType) {
    case "pull-request":
      if (after.state === "merged" && before.state !== "merged") return "merged";
      if (after.state === "closed" && before.state !== "closed") return "closed";
      return "updated";
    case "review":
      return "review-changed";
    case "check":
      return "check-changed";
    case "build":
      return "build-changed";
    case "release-train":
      return "release-changed";
    default:
      return "updated";
  }
}

export function computeDependencyRevision(dependency, train, upstream, downstream) {
  return digest({
    id: dependency.id ?? null,
    requirement: dependency.requirement ?? null,
    releaseTrainRef: dependency.releaseTrainRef ?? null,
    releaseTrainRevision: train?.revision ?? null,
    upstreamRepositoryRef: dependency.upstreamRepositoryRef ?? null,
    upstream: {
      targetHeadSha: upstream?.targetHeadSha ?? null,
      state: upstream?.state ?? null,
      order: upstream?.order ?? null,
    },
    downstreamRepositoryRef: dependency.downstreamRepositoryRef ?? null,
    downstream: {
      targetHeadSha: downstream?.targetHeadSha ?? null,
      state: downstream?.state ?? null,
      order: downstream?.order ?? null,
    },
    state: dependency.state ?? null,
  });
}

export function computeRosterCompletenessRoot(roster, repositories, principals) {
  const rows = sortedRecords(repositories);
  const authorityRefs = new Set([
    object(roster).custodianRef,
    ...rows.flatMap((row) => [
      row.ownerRef,
      ...strings(row.eligibleReviewerRefs),
    ]),
  ]);
  return digest({
    id: object(roster).id ?? null,
    revision: object(roster).revision ?? null,
    custodianRef: object(roster).custodianRef ?? null,
    repositories: rows.map((row) => ({
      id: row.id ?? null,
      canonicalName: row.canonicalName ?? null,
      defaultBranch: row.defaultBranch ?? null,
      ownerRef: row.ownerRef ?? null,
      policyRevision: row.policyRevision ?? null,
      requiredCheckContexts: sorted(row.requiredCheckContexts),
      requiredApprovalCount: row.requiredApprovalCount ?? null,
      eligibleReviewerRefs: sorted(row.eligibleReviewerRefs),
      rosterRevision: row.rosterRevision ?? null,
    })),
    authorities: sortedRecords(principals)
      .filter((row) => authorityRefs.has(row.id))
      .map((row) => ({
        id: row.id ?? null,
        kind: row.kind ?? null,
        scopes: sorted(row.scopes),
      })),
  });
}

export function computeSnapshotSetRoot(snapshots) {
  return digest(
    sortedRecords(snapshots).map((row) => ({
      id: row.id ?? null,
      kind: row.kind ?? null,
      repositoryRef: row.repositoryRef ?? null,
      capturedAt: row.capturedAt ?? null,
      sourceUri: row.sourceUri ?? null,
      sourceRecordDigest: row.sourceRecordDigest ?? null,
      completenessRoot: row.completenessRoot ?? null,
    })),
  );
}

export function computeEscalationDedupeKey(escalation) {
  const row = object(escalation);
  return digest({
    category: row.category ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceRevision: row.evidenceRevision ?? null,
    recipientRef: row.recipientRef ?? null,
    routeRef: row.routeRef ?? null,
    targetRef: row.targetRef ?? null,
    targetRevision: row.targetRevision ?? null,
  });
}

export function computeEscalationRouteAuthorizationRevision(route) {
  const row = object(route);
  return digest({
    id: row.id ?? null,
    policyRevision: row.policyRevision ?? null,
    destination: row.destination ?? null,
    allowedCategory: row.allowedCategory ?? null,
    recipientRefs: sorted(row.recipientRefs),
    authorizedByRef: row.authorizedByRef ?? null,
    templateRevision: row.templateRevision ?? null,
    deadlineHours: row.deadlineHours ?? null,
  });
}

export function computeDispatchReceiptRevision(escalation) {
  const row = object(escalation);
  const dispatch = object(row.dispatch);
  return digest({
    escalationId: row.id ?? null,
    category: row.category ?? null,
    targetRef: row.targetRef ?? null,
    targetRevision: row.targetRevision ?? null,
    evidenceRef: row.evidenceRef ?? null,
    evidenceRevision: row.evidenceRevision ?? null,
    routeRef: row.routeRef ?? null,
    recipientRef: row.recipientRef ?? null,
    deadline: row.deadline ?? null,
    dedupeKey: row.dedupeKey ?? null,
    destination: dispatch.destination ?? null,
    templateRevision: dispatch.templateRevision ?? null,
    providerMessageId: dispatch.providerMessageId ?? null,
    dispatchedAt: dispatch.dispatchedAt ?? null,
  });
}

export function computeSupersededRevisionRef(entityRef, revision) {
  return digest({
    entityRef: entityRef ?? null,
    revision: revision ?? null,
  });
}

export function computePredecessorCheckpointDigest(predecessor) {
  const row = object(predecessor);
  return digest({
    checkpointId: row.checkpointId ?? null,
    rosterRevision: row.rosterRevision ?? null,
    custodianRef: row.custodianRef ?? null,
    createdAt: row.createdAt ?? null,
    sourceSnapshotRootRefs: sorted(row.sourceSnapshotRootRefs),
    entities: [...records(row.entities)].sort((left, right) =>
      compare(left.entityRef, right.entityRef),
    ),
  });
}

export function computeCheckpointDigest(input) {
  const value = object(input);
  return digest({
    artifactId: value.artifactId ?? null,
    schemaVersion: value.schemaVersion ?? null,
    run: {
      id: object(value.run).id ?? null,
      asOf: object(value.run).asOf ?? null,
      windowStart: object(value.run).windowStart ?? null,
      rosterRef: object(value.run).rosterRef ?? null,
      rosterRevision: object(value.run).rosterRevision ?? null,
      rosterCompletenessRoot: object(value.run).rosterCompletenessRoot ?? null,
      escalationPolicyRevision: object(value.run).escalationPolicyRevision ?? null,
      predecessorCheckpointRef: object(value.run).predecessorCheckpointRef ?? null,
      firstRun: object(value.run).firstRun ?? null,
      sourceSnapshotRoots: sorted(object(value.run).sourceSnapshotRoots),
      snapshotSetRoot: object(value.run).snapshotSetRoot ?? null,
      currentCheckpointId: object(value.run).currentCheckpointId ?? null,
      custodianRef: object(value.run).custodianRef ?? null,
      destination: object(value.run).destination ?? null,
    },
    roster: value.roster ?? null,
    predecessor: value.predecessor ?? null,
    repositories: sortedRecords(value.repositories),
    pullRequests: sortedRecords(value.pullRequests),
    reviews: sortedRecords(value.reviews),
    checks: sortedRecords(value.checks),
    builds: sortedRecords(value.builds),
    artifacts: sortedRecords(value.artifacts),
    releaseTrains: sortedRecords(value.releaseTrains),
    dependencies: sortedRecords(value.dependencies),
    principals: sortedRecords(value.principals),
    escalationPolicy: value.escalationPolicy ?? null,
    escalations: sortedRecords(value.escalations),
    responses: sortedRecords(value.responses),
    evidence: sortedRecords(value.evidence),
    delta: value.delta ?? null,
    blockers: sortedRecords(value.blockers),
    readiness: value.readiness ?? null,
  });
}

export function resealRepositoryOperationsArtifact(input) {
  const value = structuredClone(input);
  value.roster.completenessRoot = computeRosterCompletenessRoot(
    value.roster,
    value.repositories,
    value.principals,
  );
  value.run.rosterCompletenessRoot = value.roster.completenessRoot;
  value.run.sourceSnapshotRoots = sorted(
    records(value.snapshots).map((row) => row.completenessRoot),
  );
  value.run.snapshotSetRoot = computeSnapshotSetRoot(value.snapshots);
  for (const escalation of records(value.escalations)) {
    escalation.dedupeKey = computeEscalationDedupeKey(escalation);
  }
  const escalationById = mapById(value.escalations);
  for (const response of records(value.responses)) {
    const escalation = escalationById.get(response.requestRef);
    if (escalation) response.requestDedupeKey = escalation.dedupeKey;
  }
  value.run.currentCheckpointDigest = computeCheckpointDigest(value);
  value.handoff.checkpointDigest = value.run.currentCheckpointDigest;
  return value;
}

function hasForbiddenNarrative(value) {
  const texts = [];
  const visit = (item) => {
    if (typeof item === "string") texts.push(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (isRecord(item)) Object.values(item).forEach(visit);
  };
  visit(value);
  return texts.some((text) => {
    let previousEnd = 0;
    let previousNegated = false;
    for (const match of text.matchAll(FORBIDDEN_NARRATIVE)) {
      const prefix = text.slice(0, match.index);
      const connector = text.slice(previousEnd, match.index);
      const directlyNegated = ADJACENT_NEGATION.test(prefix);
      const negated =
        directlyNegated || (previousNegated && COORDINATED_NEGATION.test(connector));
      if (!negated) return true;
      previousEnd = match.index + match[0].length;
      previousNegated = true;
    }
    return false;
  });
}

export function repositoryOperationsFindings(input, context = {}) {
  if (!isRecord(input)) return [finding("invalid_artifact", "$")];
  const value = input;
  const findings = [];
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  const run = object(value.run);
  const roster = object(value.roster);
  const predecessor = isRecord(value.predecessor) ? value.predecessor : null;
  const policy = object(value.escalationPolicy);
  const handoff = object(value.handoff);
  const readiness = object(value.readiness);
  const delta = object(value.delta);

  for (const key of Object.keys(value).sort(compare)) {
    if (!TOP_LEVEL_FIELDS.has(key)) add("prohibited_contract_field", `$.${key}`);
  }
  if (value.schemaVersion !== REPOSITORY_OPERATIONS_SCHEMA_VERSION) {
    add("invalid_schema_version", "$.schemaVersion");
  }

  const asOfMs = timestamp(context.asOf);
  const runAsOfMs = timestamp(run.asOf);
  const windowStartMs = timestamp(run.windowStart);
  if (asOfMs === null || runAsOfMs === null || context.asOf !== run.asOf) {
    add("invalid_validation_context", "$.run.asOf");
  }
  if (windowStartMs === null || runAsOfMs === null || windowStartMs > runAsOfMs) {
    add("invalid_review_window", "$.run.windowStart");
  }

  const ledgerNames = [
    "snapshots",
    "repositories",
    "pullRequests",
    "reviews",
    "checks",
    "builds",
    "artifacts",
    "releaseTrains",
    "dependencies",
    "principals",
    "escalations",
    "responses",
    "evidence",
    "blockers",
  ];
  for (const name of ledgerNames) {
    if (!Array.isArray(value[name])) add("invalid_ledger", `$.${name}`);
    else if (value[name].some((row) => !isRecord(row))) add("invalid_ledger_record", `$.${name}`);
  }

  const ids = new Map();
  for (const name of ledgerNames) {
    for (const [index, row] of records(value[name]).entries()) {
      if (typeof row.id !== "string" || row.id.length === 0) {
        add("invalid_identity", `$.${name}[${index}].id`);
      } else if (ids.has(row.id)) {
        add("duplicate_identity", `$.${name}[${index}].id`, [row.id, ids.get(row.id)]);
      } else {
        ids.set(row.id, name);
      }
    }
  }
  for (const [index, route] of records(policy.routes).entries()) {
    if (typeof route.id !== "string" || route.id.length === 0) {
      add("invalid_identity", `$.escalationPolicy.routes[${index}].id`);
    } else if (ids.has(route.id)) {
      add("duplicate_identity", `$.escalationPolicy.routes[${index}].id`, [
        route.id,
        ids.get(route.id),
      ]);
    } else {
      ids.set(route.id, "escalationPolicy.routes");
    }
  }

  const repositories = mapById(value.repositories);
  const snapshots = mapById(value.snapshots);
  const pullRequests = mapById(value.pullRequests);
  const reviews = mapById(value.reviews);
  const checks = mapById(value.checks);
  const builds = mapById(value.builds);
  const artifacts = mapById(value.artifacts);
  const releaseTrains = mapById(value.releaseTrains);
  const dependencies = mapById(value.dependencies);
  const principals = mapById(value.principals);
  const escalations = mapById(value.escalations);
  const evidence = mapById(value.evidence);
  const blockers = mapById(value.blockers);
  const responses = mapById(value.responses);
  const routes = mapById(policy.routes);
  const nextSubjectRef = (subjectRef) => {
    const response = responses.get(subjectRef);
    if (response) return response.requestRef;
    return escalations.get(subjectRef)?.targetRef ?? null;
  };
  const releaseTrainForSubject = (subjectRef) => {
    const visited = new Set();
    let currentRef = subjectRef;
    while (typeof currentRef === "string") {
      if (visited.has(currentRef)) return null;
      visited.add(currentRef);
      if (releaseTrains.has(currentRef)) return currentRef;
      const dependency = dependencies.get(currentRef);
      if (dependency) return dependency.releaseTrainRef;
      currentRef = nextSubjectRef(currentRef);
    }
    return null;
  };
  const reportedSubjectCycles = new Set();
  for (const startRef of [...escalations.keys(), ...responses.keys()]) {
    const path = [];
    const positions = new Map();
    let currentRef = startRef;
    while (typeof currentRef === "string") {
      if (positions.has(currentRef)) {
        const cycleRefs = path.slice(positions.get(currentRef));
        const cycleKey = sorted(cycleRefs).join("\0");
        if (!reportedSubjectCycles.has(cycleKey)) {
          reportedSubjectCycles.add(cycleKey);
          add("cyclic_subject_reference", "$.escalations", cycleRefs);
        }
        break;
      }
      positions.set(currentRef, path.length);
      path.push(currentRef);
      currentRef = nextSubjectRef(currentRef);
    }
  }
  const clawPrincipals = records(value.principals).filter((row) => row.kind === "claw");
  const designatedClaw = principals.get(CLAW_PRINCIPAL_ID);
  if (
    clawPrincipals.length !== 1 ||
    designatedClaw?.kind !== "claw" ||
    !sameSet(designatedClaw.scopes, [
      "dispatch-receipt-reconciliation",
      "read-only-reconciliation",
    ])
  ) {
    add("invalid_principal_authority", "$.principals", [CLAW_PRINCIPAL_ID]);
  }
  const targetRevisions = new Map([
    ...records(value.repositories).map((row) => [row.id, computeRepositoryRevision(row)]),
    ...records(value.pullRequests).map((row) => [
      row.id,
      computePullRequestSourceRevision(row),
    ]),
    ...records(value.releaseTrains).map((row) => [
      row.id,
      computeReleaseEvidenceRevision(row),
    ]),
    ...records(value.dependencies).map((row) => [row.id, row.evidenceRevision]),
  ]);
  const sourceRecordDigests = new Set();
  const evidenceValidity = new Map();
  let operationalBlocker = false;

  for (const [index, row] of records(value.evidence).entries()) {
    const observedMs = timestamp(row.observedAt);
    const author = principals.get(row.authorRef);
    const requiredAuthorScope = {
      "pull-request": "evidence-author",
      check: "evidence-author",
      build: "evidence-author",
      "artifact-provenance": "evidence-author",
      release: "evidence-author",
      dependency: "evidence-author",
      "escalation-dispatch-receipt": "evidence-author",
    }[row.kind];
    const valid =
      observedMs !== null &&
      observedMs <= runAsOfMs &&
      Boolean(author) &&
      author?.kind !== "claw" &&
      row.authorRef !== CLAW_PRINCIPAL_ID &&
      (!requiredAuthorScope || strings(author?.scopes).includes(requiredAuthorScope)) &&
      strings(row.subjectRefs).every((ref) => ids.has(ref)) &&
      DIGEST_PATTERN.test(row.sourceRecordDigest ?? "") &&
      isControlledUri(row.sourceRef);
    evidenceValidity.set(row.id, valid);
    if (!valid) {
      add("invalid_evidence_record", `$.evidence[${index}]`, [row.id]);
    }
    if (sourceRecordDigests.has(row.sourceRecordDigest)) {
      add("duplicate_source_record_digest", `$.evidence[${index}].sourceRecordDigest`);
    }
    sourceRecordDigests.add(row.sourceRecordDigest);
  }
  const hasExactEvidenceConsumer = (row) => {
    const hasExplicitCoverageRole =
      records(value.escalations).some(
        (consumer) =>
          consumer.evidenceRef === row.id &&
          consumer.evidenceRevision === row.revision &&
          strings(row.subjectRefs).includes(consumer.targetRef),
      ) ||
      records(value.blockers).some((consumer) =>
        strings(consumer.evidenceRefs).includes(row.id),
      );
    if (hasExplicitCoverageRole) return true;
    switch (row.kind) {
      case "roster":
        return roster.evidenceRef === row.id;
      case "pull-request":
        return records(value.pullRequests).some((consumer) => consumer.sourceEvidenceRef === row.id);
      case "review":
        return records(value.reviews).some((consumer) => consumer.evidenceRef === row.id);
      case "check":
        return records(value.checks).some((consumer) => consumer.evidenceRef === row.id);
      case "build":
        return records(value.builds).some((consumer) => consumer.evidenceRef === row.id);
      case "artifact-provenance":
        return records(value.artifacts).some(
          (consumer) => consumer.provenanceEvidenceRef === row.id,
        );
      case "release":
        return records(value.releaseTrains).some(
          (consumer) => consumer.releaseEvidenceRef === row.id,
        );
      case "dependency":
        return records(value.dependencies).some((consumer) => consumer.evidenceRef === row.id);
      case "escalation-route-authorization":
        return records(policy.routes).some(
          (consumer) => consumer.authorizationEvidenceRef === row.id,
        );
      case "escalation-dispatch-receipt":
        return records(value.escalations).some(
          (consumer) => object(consumer.dispatch).receiptEvidenceRef === row.id,
        );
      case "decision-response":
      case "deadline-observation":
        return records(value.responses).some((consumer) => consumer.evidenceRef === row.id);
      case "blocker":
        return records(value.blockers).some(
          (consumer) =>
            consumer.state === "resolved" && consumer.resolutionEvidenceRef === row.id,
        );
      default:
        return false;
    }
  };
  for (const [index, row] of records(value.evidence).entries()) {
    if (!hasExactEvidenceConsumer(row)) {
      add("orphan_evidence_record", `$.evidence[${index}]`, [row.id]);
    }
  }

  const routeValidity = new Map();
  for (const route of records(policy.routes)) {
    const authorizer = principals.get(route.authorizedByRef);
    const authorization = evidence.get(route.authorizationEvidenceRef);
    routeValidity.set(
      route.id,
      policy.revision === run.escalationPolicyRevision &&
        principals.has(policy.custodianRef) &&
        policy.custodianRef !== clawPrincipals[0]?.id &&
        route.policyRevision === policy.revision &&
        isControlledUri(route.destination) &&
        authorizer?.kind === "human" &&
        route.authorizedByRef === policy.custodianRef &&
        evidenceValidity.get(route.authorizationEvidenceRef) === true &&
        authorization?.kind === "escalation-route-authorization" &&
        authorization.authorRef === route.authorizedByRef &&
        authorization.revision === computeEscalationRouteAuthorizationRevision(route) &&
        sameSet(authorization.subjectRefs, [
          route.id,
          route.authorizedByRef,
          ...strings(route.recipientRefs),
        ]) &&
        strings(route.recipientRefs).every(
          (ref) =>
            principals.get(ref)?.kind === "human" &&
            strings(principals.get(ref)?.scopes).includes("eligible-approver") &&
            strings(principals.get(ref)?.scopes).includes(
              `decision-authority:${route.allowedCategory}`,
            ),
        ),
    );
  }
  const responseRefCounts = new Map();
  const dedupeCounts = new Map();
  const dispatchIdentityCounts = new Map();
  const dispatchReceiptRefCounts = new Map();
  for (const escalation of records(value.escalations)) {
    const dispatch = object(escalation.dispatch);
    if (typeof escalation.responseRef === "string") {
      responseRefCounts.set(
        escalation.responseRef,
        (responseRefCounts.get(escalation.responseRef) ?? 0) + 1,
      );
    }
    if (typeof escalation.dedupeKey === "string") {
      dedupeCounts.set(escalation.dedupeKey, (dedupeCounts.get(escalation.dedupeKey) ?? 0) + 1);
    }
    if (
      typeof dispatch.destination === "string" &&
      typeof dispatch.providerMessageId === "string"
    ) {
      const dispatchIdentity = canonicalJson([
        dispatch.destination,
        dispatch.providerMessageId,
      ]);
      dispatchIdentityCounts.set(
        dispatchIdentity,
        (dispatchIdentityCounts.get(dispatchIdentity) ?? 0) + 1,
      );
    }
    if (typeof dispatch.receiptEvidenceRef === "string") {
      dispatchReceiptRefCounts.set(
        dispatch.receiptEvidenceRef,
        (dispatchReceiptRefCounts.get(dispatch.receiptEvidenceRef) ?? 0) + 1,
      );
    }
  }
  const escalationDispatchValidity = new Map();
  for (const escalation of records(value.escalations)) {
    const route = routes.get(escalation.routeRef);
    const recipient = principals.get(escalation.recipientRef);
    const routeEvidence = evidence.get(route?.authorizationEvidenceRef);
    const supportingEvidence = evidence.get(escalation.evidenceRef);
    const dispatch = object(escalation.dispatch);
    const receiptEvidence = evidence.get(dispatch.receiptEvidenceRef);
    const supportingObservedMs = timestamp(supportingEvidence?.observedAt);
    const routeObservedMs = timestamp(routeEvidence?.observedAt);
    const dispatchedMs = timestamp(dispatch.dispatchedAt);
    const deadlineMs = timestamp(escalation.deadline);
    const dispatchIdentity = canonicalJson([
      dispatch.destination ?? null,
      dispatch.providerMessageId ?? null,
    ]);
    const targetCategoryValid =
      (["merge-approval", "change-request"].includes(escalation.category) &&
        pullRequests.has(escalation.targetRef)) ||
      (escalation.category === "release-approval" &&
        releaseTrains.has(escalation.targetRef)) ||
      (escalation.category === "risk-decision" && dependencies.has(escalation.targetRef));
    escalationDispatchValidity.set(
      escalation.id,
      routeValidity.get(escalation.routeRef) === true &&
        route?.allowedCategory === escalation.category &&
      targetCategoryValid &&
        strings(route?.recipientRefs).includes(escalation.recipientRef) &&
        recipient?.kind === "human" &&
        strings(recipient.scopes).includes("eligible-approver") &&
        strings(recipient.scopes).includes(
          `decision-authority:${escalation.category}`,
        ) &&
        targetRevisions.get(escalation.targetRef) === escalation.targetRevision &&
        evidenceValidity.get(escalation.evidenceRef) === true &&
        supportingEvidence?.revision === escalation.evidenceRevision &&
        strings(supportingEvidence?.subjectRefs).includes(escalation.targetRef) &&
        supportingObservedMs !== null &&
        dispatchedMs !== null &&
        supportingObservedMs <= dispatchedMs &&
        routeEvidence?.kind === "escalation-route-authorization" &&
        routeObservedMs !== null &&
        routeObservedMs <= dispatchedMs &&
        evidenceValidity.get(dispatch.receiptEvidenceRef) === true &&
        receiptEvidence?.kind === "escalation-dispatch-receipt" &&
        receiptEvidence.revision === computeDispatchReceiptRevision(escalation) &&
        sameSet(receiptEvidence.subjectRefs, [escalation.id, escalation.routeRef]) &&
        dispatchReceiptRefCounts.get(dispatch.receiptEvidenceRef) === 1 &&
        dispatchIdentityCounts.get(dispatchIdentity) === 1 &&
        dispatch.destination === route?.destination &&
        dispatch.templateRevision === route?.templateRevision &&
        timestamp(receiptEvidence.observedAt) === dispatchedMs &&
        deadlineMs !== null &&
        dispatchedMs <= deadlineMs &&
        deadlineMs - dispatchedMs <= route?.deadlineHours * 60 * 60 * 1000 &&
        escalation.dedupeKey === computeEscalationDedupeKey(escalation) &&
        dedupeCounts.get(escalation.dedupeKey) === 1,
    );
  }
  const responseValidity = new Map();
  for (const response of records(value.responses)) {
    const request = escalations.get(response.requestRef);
    const author = principals.get(response.authorRef);
    const responseEvidence = evidence.get(response.evidenceRef);
    const authoredMs = timestamp(response.authoredAt);
    const observedMs = timestamp(responseEvidence?.observedAt);
    const dispatchedMs = timestamp(object(request?.dispatch).dispatchedAt);
    const deadlineMs = timestamp(request?.deadline);
    const decisionResponse =
      response.kind === "human-decision" &&
      ["approved", "rejected", "change-requested"].includes(response.outcome);
    const deadlineObservation =
      response.kind === "deadline-observation" &&
      ["expired", "no-response"].includes(response.outcome);
    const roleValid = decisionResponse
      ? author?.kind === "human" &&
        strings(author.scopes).includes("eligible-approver") &&
        strings(author.scopes).includes(`decision-authority:${request?.category}`) &&
        response.authorRef === request?.recipientRef
      : deadlineObservation &&
        author?.kind === "system" &&
        strings(author.scopes).includes(
          `trusted-deadline-observer:${request?.category}`,
        );
    const expectedEvidenceKind = decisionResponse
      ? "decision-response"
      : deadlineObservation
        ? "deadline-observation"
        : null;
    responseValidity.set(
      response.id,
      escalationDispatchValidity.get(request?.id) === true &&
        request?.responseRef === response.id &&
        responseRefCounts.get(response.id) === 1 &&
        response.requestRef === request.id &&
        response.requestDedupeKey === request.dedupeKey &&
        response.targetRef === request.targetRef &&
        response.targetRevision === request.targetRevision &&
        response.evidenceRevision === request.evidenceRevision &&
        author?.kind !== "claw" &&
        author?.id !== CLAW_PRINCIPAL_ID &&
        roleValid &&
        evidenceValidity.get(response.evidenceRef) === true &&
        responseEvidence?.kind === expectedEvidenceKind &&
        responseEvidence.authorRef === response.authorRef &&
        responseEvidence.revision === computeApprovalResponseRevision(response) &&
        sameSet(responseEvidence.subjectRefs, [response.id, request.id]) &&
        authoredMs !== null &&
        authoredMs <= runAsOfMs &&
        observedMs === authoredMs &&
        dispatchedMs !== null &&
        observedMs >= dispatchedMs &&
        deadlineMs !== null &&
        (deadlineObservation ? authoredMs > deadlineMs : authoredMs <= deadlineMs),
    );
  }
  const effectiveEscalationStates = new Map(
    records(value.escalations).map((row) => [
      row.id,
      expectedEscalationState(row, responses, responseValidity),
    ]),
  );
  const unresolvedEscalations = records(value.escalations).filter((row) =>
    escalationBlockerCategory(effectiveEscalationStates.get(row.id)),
  );

  const repositoryRefs = records(value.repositories).map((row) => row.id);
  const canonicalNameCounts = new Map();
  for (const repository of records(value.repositories)) {
    canonicalNameCounts.set(
      repository.canonicalName,
      (canonicalNameCounts.get(repository.canonicalName) ?? 0) + 1,
    );
  }
  const pullRequestIdentityCounts = new Map();
  for (const pullRequest of records(value.pullRequests)) {
    const identity = canonicalJson({
      repositoryRef: pullRequest.repositoryRef ?? null,
      number: pullRequest.number ?? null,
    });
    pullRequestIdentityCounts.set(
      identity,
      (pullRequestIdentityCounts.get(identity) ?? 0) + 1,
    );
  }
  const rosterRoot = computeRosterCompletenessRoot(
    roster,
    value.repositories,
    value.principals,
  );
  const rosterEvidence = evidence.get(roster.evidenceRef);
  const rosterCapturedMs = timestamp(roster.capturedAt);
  const rosterObservedMs = timestamp(rosterEvidence?.observedAt);
  if (
    run.rosterRef !== roster.id ||
    run.rosterRevision !== roster.revision ||
    run.rosterCompletenessRoot !== roster.completenessRoot ||
    roster.completenessRoot !== rosterRoot ||
    !sameSet(roster.repositoryRefs, repositoryRefs) ||
    run.custodianRef !== roster.custodianRef ||
    !principals.has(roster.custodianRef) ||
    principals.get(roster.custodianRef)?.kind !== "human" ||
    !strings(principals.get(roster.custodianRef)?.scopes).includes("portfolio-custodian") ||
    evidenceValidity.get(roster.evidenceRef) !== true ||
    rosterEvidence?.kind !== "roster" ||
    rosterEvidence.revision !== roster.revision ||
    rosterEvidence.digest !== roster.completenessRoot ||
    rosterEvidence.authorRef !== roster.custodianRef ||
    !sameSet(rosterEvidence.subjectRefs, repositoryRefs) ||
    rosterCapturedMs === null ||
    rosterCapturedMs < windowStartMs ||
    rosterCapturedMs > runAsOfMs ||
    rosterObservedMs === null ||
    rosterObservedMs > rosterCapturedMs
  ) {
    add("invalid_roster_completeness", "$.roster");
  }
  for (const [index, repository] of records(value.repositories).entries()) {
    if (
      canonicalNameCounts.get(repository.canonicalName) !== 1 ||
      repository.rosterRevision !== roster.revision ||
      !principals.has(repository.ownerRef) ||
      principals.get(repository.ownerRef)?.kind !== "human" ||
      !strings(principals.get(repository.ownerRef)?.scopes).includes("repository-owner") ||
      !Number.isInteger(repository.requiredApprovalCount) ||
      repository.requiredApprovalCount < 1 ||
      repository.requiredApprovalCount > strings(repository.eligibleReviewerRefs).length ||
      strings(repository.eligibleReviewerRefs).some((ref) => {
        const reviewer = principals.get(ref);
        return (
          reviewer?.kind !== "human" ||
          !strings(reviewer.scopes).includes("independent-review-author") ||
          ref === repository.ownerRef
        );
      }) ||
      !Array.isArray(repository.snapshotRefs) ||
      (repository.state === "current" && repository.snapshotRefs.length === 0) ||
      repository.snapshotRefs.some(
        (ref) =>
          !snapshots.has(ref) ||
          snapshots.get(ref)?.repositoryRef !== repository.id ||
          snapshots.get(ref)?.kind !== "repository",
      )
    ) {
      add("invalid_repository_roster_entry", `$.repositories[${index}]`, [repository.id]);
    }
    if (repository.state === "missing") operationalBlocker = true;
  }

  const predecessorSnapshots = records(value.snapshots).filter(
    (row) => row.kind === "predecessor-checkpoint",
  );
  const predecessorValid =
    (run.firstRun === true &&
      value.predecessor === null &&
      run.predecessorCheckpointRef === null &&
      predecessorSnapshots.length === 0) ||
    (run.firstRun === false &&
      predecessor !== null &&
      run.predecessorCheckpointRef === predecessor.checkpointId &&
      predecessor.rosterRevision === roster.revision &&
      predecessor.custodianRef === roster.custodianRef &&
      timestamp(predecessor.createdAt) !== null &&
      timestamp(predecessor.createdAt) <= windowStartMs &&
      Array.isArray(predecessor.entities) &&
      predecessor.entities.length > 0 &&
      new Set(predecessor.entities.map((row) => row.entityRef)).size ===
        predecessor.entities.length &&
      predecessor.entities.every(
        (row) => ENTITY_STATES[row.entityType]?.has(row.state) === true,
      ) &&
      predecessor.checkpointDigest === computePredecessorCheckpointDigest(predecessor) &&
      predecessorSnapshots.length === 1 &&
      predecessorSnapshots[0].sourceRecordDigest === predecessor.checkpointDigest &&
      predecessorSnapshots[0].capturedAt === predecessor.createdAt &&
      sameSet(
        predecessor.sourceSnapshotRootRefs,
        predecessorSnapshots.map((row) => row.completenessRoot),
      ));
  if (!predecessorValid) add("invalid_checkpoint_lineage", "$.predecessor");

  const snapshotRoots = records(value.snapshots).map((row) => row.completenessRoot);
  for (const [index, snapshot] of records(value.snapshots).entries()) {
    const capturedMs = timestamp(snapshot.capturedAt);
    const isPredecessorCheckpointEvidence =
      run.firstRun === false &&
      predecessor !== null &&
      snapshot.kind === "predecessor-checkpoint" &&
      predecessorSnapshots.length === 1 &&
      snapshot.id === predecessorSnapshots[0].id &&
      snapshot.sourceRecordDigest === predecessor.checkpointDigest &&
      snapshot.capturedAt === predecessor.createdAt;
    if (
      capturedMs === null ||
      (capturedMs < windowStartMs && !isPredecessorCheckpointEvidence) ||
      capturedMs > runAsOfMs ||
      !isControlledUri(snapshot.sourceUri) ||
      !DIGEST_PATTERN.test(snapshot.completenessRoot ?? "") ||
      !DIGEST_PATTERN.test(snapshot.sourceRecordDigest ?? "") ||
      (snapshot.repositoryRef !== null && !repositories.has(snapshot.repositoryRef))
    ) {
      add("invalid_source_snapshot", `$.snapshots[${index}]`, [snapshot.id]);
    }
    if (sourceRecordDigests.has(snapshot.sourceRecordDigest)) {
      add("duplicate_source_record_digest", `$.snapshots[${index}].sourceRecordDigest`);
    }
    sourceRecordDigests.add(snapshot.sourceRecordDigest);
  }
  if (
    !sameSet(run.sourceSnapshotRoots, snapshotRoots) ||
    run.snapshotSetRoot !== computeSnapshotSetRoot(value.snapshots)
  ) {
    add("invalid_source_snapshot_roots", "$.run.sourceSnapshotRoots");
  }

  const reviewValidity = new Map();
  for (const [index, review] of records(value.reviews).entries()) {
    const pr = pullRequests.get(review.pullRequestRef);
    const repository = repositories.get(pr?.repositoryRef);
    const author = principals.get(review.authorRef);
    const reviewEvidence = evidence.get(review.evidenceRef);
    const snapshot = snapshots.get(review.snapshotRef);
    const submittedMs = timestamp(review.submittedAt);
    const capturedMs = timestamp(snapshot?.capturedAt);
    const stale = pr && review.headSha !== pr.currentHeadSha;
    const valid =
      Boolean(pr) &&
      principals.has(review.authorRef) &&
      submittedMs !== null &&
      submittedMs <= runAsOfMs &&
      evidenceValidity.get(review.evidenceRef) === true &&
      reviewEvidence?.kind === "review" &&
      reviewEvidence.authorRef === review.authorRef &&
      reviewEvidence.sourceRecordDigest === review.evidenceDigest &&
      reviewEvidence.revision === computeReviewRevision(review) &&
      sameSet(reviewEvidence.subjectRefs, [review.id, review.pullRequestRef]) &&
      timestamp(reviewEvidence.observedAt) === submittedMs &&
      snapshot?.kind === "review" &&
      (snapshot.repositoryRef === null || snapshot.repositoryRef === repository?.id) &&
      capturedMs !== null &&
      submittedMs <= capturedMs &&
      (!stale || review.state === "stale") &&
      (stale || review.state !== "stale");
    reviewValidity.set(review.id, valid);
    if (!valid) {
      add("invalid_head_bound_review", `$.reviews[${index}]`, [review.id]);
    }
    if (
      review.state === "approved" &&
      (author?.kind !== "human" ||
        !strings(author.scopes).includes("independent-review-author") ||
        author.id === repository?.ownerRef)
    ) {
      add("invalid_review_authority", `$.reviews[${index}].authorRef`, [review.id]);
    }
  }

  const checkValidity = new Map();
  for (const [index, check] of records(value.checks).entries()) {
    const pr = pullRequests.get(check.pullRequestRef);
    const repository = repositories.get(pr?.repositoryRef);
    const snapshot = snapshots.get(check.snapshotRef);
    const checkEvidence = evidence.get(check.evidenceRef);
    const stale = pr && check.headSha !== pr.currentHeadSha;
    const startedMs = timestamp(check.startedAt);
    const completedMs = timestamp(check.completedAt);
    const capturedMs = timestamp(snapshot?.capturedAt);
    const observedMs = timestamp(checkEvidence?.observedAt);
    const supersededByRetry =
      check.state === "superseded" &&
      records(value.checks).some(
        (candidate) =>
          candidate.id !== check.id &&
          candidate.pullRequestRef === check.pullRequestRef &&
          candidate.headSha === check.headSha &&
          candidate.context === check.context &&
          candidate.state !== "superseded" &&
          timestamp(evidence.get(candidate.evidenceRef)?.observedAt) > observedMs,
      );
    const completedState = ["passed", "failed", "cancelled", "superseded"].includes(check.state);
    const chronologyValid =
      (check.state === "missing" && check.startedAt === null && check.completedAt === null) ||
      (check.state === "pending" &&
        startedMs !== null &&
        startedMs <= runAsOfMs &&
        check.completedAt === null) ||
      (completedState &&
        startedMs !== null &&
        completedMs !== null &&
        startedMs <= completedMs &&
        completedMs <= runAsOfMs);
    const valid =
      Boolean(pr) &&
      snapshot?.kind === "check-suite" &&
      (snapshot.repositoryRef === null || snapshot.repositoryRef === repository?.id) &&
      capturedMs !== null &&
      (startedMs === null || startedMs <= capturedMs) &&
      (completedMs === null || completedMs <= capturedMs) &&
      (!stale || check.state === "superseded") &&
      (stale || check.state !== "superseded" || supersededByRetry) &&
      chronologyValid &&
      evidenceValidity.get(check.evidenceRef) === true &&
      checkEvidence?.kind === "check" &&
      checkEvidence.authorRef !== CLAW_PRINCIPAL_ID &&
      checkEvidence.revision === computeCheckRevision(check) &&
      check.evidenceDigest === checkEvidence.sourceRecordDigest &&
      sameSet(checkEvidence.subjectRefs, [check.id, check.pullRequestRef]) &&
      observedMs !== null &&
      (completedMs === null || observedMs >= completedMs) &&
      (completedMs !== null || startedMs === null || observedMs >= startedMs) &&
      observedMs <= capturedMs;
    checkValidity.set(check.id, valid);
    if (!valid) {
      add("invalid_head_bound_check", `$.checks[${index}]`, [check.id]);
    }
    if (!chronologyValid) {
      add("invalid_check_chronology", `$.checks[${index}]`, [check.id]);
    }
  }

  const buildProviderIdentityCounts = new Map();
  for (const build of records(value.builds)) {
    const identity = canonicalJson([
      build.repositoryRef ?? null,
      build.runId ?? null,
    ]);
    buildProviderIdentityCounts.set(
      identity,
      (buildProviderIdentityCounts.get(identity) ?? 0) + 1,
    );
  }
  const buildValidity = new Map();
  for (const [index, build] of records(value.builds).entries()) {
    const pr = pullRequests.get(build.pullRequestRef);
    const stale = pr && build.headSha !== pr.currentHeadSha;
    const buildEvidence = evidence.get(build.evidenceRef);
    const buildSnapshot = snapshots.get(build.snapshotRef);
    const buildObservedMs = timestamp(buildEvidence?.observedAt);
    const providerIdentity = canonicalJson([
      build.repositoryRef ?? null,
      build.runId ?? null,
    ]);
    const supersededByRetry =
      build.state === "superseded" &&
      records(value.builds).some(
        (candidate) =>
          candidate.id !== build.id &&
          candidate.pullRequestRef === build.pullRequestRef &&
          candidate.headSha === build.headSha &&
          candidate.state !== "superseded" &&
          timestamp(evidence.get(candidate.evidenceRef)?.observedAt) > buildObservedMs,
      );
    const valid =
      Boolean(pr) &&
      buildProviderIdentityCounts.get(providerIdentity) === 1 &&
      build.repositoryRef === pr.repositoryRef &&
      buildSnapshot?.kind === "workflow-run" &&
      buildSnapshot.repositoryRef === build.repositoryRef &&
      evidenceValidity.get(build.evidenceRef) === true &&
      buildEvidence?.kind === "build" &&
      buildEvidence.sourceRecordDigest === build.evidenceDigest &&
      buildEvidence.revision === computeBuildRevision(build) &&
      sameSet(buildEvidence.subjectRefs, [build.id, build.pullRequestRef]) &&
      buildObservedMs !== null &&
      buildObservedMs <= timestamp(buildSnapshot.capturedAt) &&
      (!stale || build.state === "superseded") &&
      (stale || build.state !== "superseded" || supersededByRetry) &&
      !strings(build.artifactRefs).some((ref) => {
        const artifact = artifacts.get(ref);
        return (
          !artifact ||
          artifact.buildRef !== build.id ||
          artifact.repositoryRef !== build.repositoryRef ||
          artifact.headSha !== build.headSha
        );
      });
    buildValidity.set(build.id, valid);
    if (!valid) {
      add("invalid_head_bound_build", `$.builds[${index}]`, [build.id]);
    }
  }

  const artifactValidity = new Map();
  for (const [index, artifact] of records(value.artifacts).entries()) {
    const build = builds.get(artifact.buildRef);
    const buildEvidence = evidence.get(build?.evidenceRef);
    const provenance = evidence.get(artifact.provenanceEvidenceRef);
    const snapshot = snapshots.get(artifact.snapshotRef);
    const provenanceObservedMs = timestamp(provenance?.observedAt);
    const buildObservedMs = timestamp(buildEvidence?.observedAt);
    const snapshotCapturedMs = timestamp(snapshot?.capturedAt);
    const stateMatchesBuild =
      (artifact.state === "verified" && build?.state === "succeeded") ||
      (artifact.state === "missing" &&
        ["succeeded", "failed", "running", "cancelled", "missing"].includes(build?.state)) ||
      (artifact.state === "failed" &&
        ["succeeded", "failed", "cancelled"].includes(build?.state)) ||
      (artifact.state === "superseded" && build?.state === "superseded");
    const valid =
      build &&
      artifact.repositoryRef === build.repositoryRef &&
      artifact.headSha === build.headSha &&
      strings(build.artifactRefs).includes(artifact.id) &&
      snapshot?.kind === "artifact" &&
      snapshot.repositoryRef === artifact.repositoryRef &&
      DIGEST_PATTERN.test(artifact.digest ?? "") &&
      evidenceValidity.get(artifact.provenanceEvidenceRef) === true &&
      provenance?.kind === "artifact-provenance" &&
      provenance.revision === artifact.headSha &&
      provenance.digest === artifact.digest &&
      provenanceObservedMs !== null &&
      buildObservedMs !== null &&
      snapshotCapturedMs !== null &&
      provenanceObservedMs >= buildObservedMs &&
      provenanceObservedMs <= snapshotCapturedMs &&
      provenanceObservedMs <= runAsOfMs &&
      sameSet(provenance.subjectRefs, [artifact.id, build.id]) &&
      stateMatchesBuild;
    artifactValidity.set(artifact.id, valid);
    if (!valid) add("invalid_build_artifact_provenance", `$.artifacts[${index}]`, [artifact.id]);
  }

  const releaseEvidenceByTrain = new Map();
  const releaseEvidenceValidity = new Map();
  const releaseSnapshotValidity = new Map();
  for (const train of records(value.releaseTrains)) {
    const trainSnapshot = snapshots.get(train.snapshotRef);
    const releaseSnapshotMs = timestamp(trainSnapshot?.capturedAt);
    const trainSnapshotValid =
      trainSnapshot?.kind === "release" &&
      trainSnapshot.repositoryRef === null &&
      releaseSnapshotMs !== null &&
      releaseSnapshotMs >= windowStartMs &&
      releaseSnapshotMs <= runAsOfMs &&
      isControlledUri(trainSnapshot.sourceUri) &&
      DIGEST_PATTERN.test(trainSnapshot.sourceRecordDigest ?? "") &&
      DIGEST_PATTERN.test(trainSnapshot.completenessRoot ?? "");
    const releaseEvidence = evidence.get(train.releaseEvidenceRef);
    const releaseObservedMs = timestamp(releaseEvidence?.observedAt);
    const memberEvidenceRows = records(train.entries).flatMap((entry) => {
      const memberPullRequests = records(value.pullRequests).filter(
        (row) =>
          row.repositoryRef === entry.repositoryRef &&
          row.currentHeadSha === entry.targetHeadSha,
      );
      const artifactRefs = strings(entry.artifactRefs);
      const buildRefs = [
        ...new Set(artifactRefs.map((ref) => artifacts.get(ref)?.buildRef).filter(Boolean)),
      ];
      return [
        ...memberPullRequests.flatMap((pullRequest) => [
          evidence.get(pullRequest.sourceEvidenceRef),
          ...records(value.reviews)
            .filter(
              (review) =>
                review.pullRequestRef === pullRequest.id &&
                review.headSha === pullRequest.currentHeadSha,
            )
            .map((review) => evidence.get(review.evidenceRef)),
          ...records(value.checks)
            .filter(
              (check) =>
                check.pullRequestRef === pullRequest.id &&
                check.headSha === pullRequest.currentHeadSha &&
                check.required &&
                check.state !== "superseded",
            )
            .map((check) => evidence.get(check.evidenceRef)),
        ]),
        ...artifactRefs.map((ref) =>
          evidence.get(artifacts.get(ref)?.provenanceEvidenceRef),
        ),
        ...buildRefs.map((ref) => evidence.get(builds.get(ref)?.evidenceRef)),
      ];
    });
    const releaseChronologyValid =
      releaseObservedMs !== null &&
      releaseSnapshotMs !== null &&
      releaseObservedMs <= releaseSnapshotMs &&
      memberEvidenceRows.every((row) => {
        const observedMs = timestamp(row?.observedAt);
        return (
          row &&
          evidenceValidity.get(row.id) === true &&
          observedMs !== null &&
          observedMs <= releaseObservedMs
        );
      });
    releaseEvidenceByTrain.set(train.id, releaseEvidence);
    releaseSnapshotValidity.set(train.id, trainSnapshotValid);
    releaseEvidenceValidity.set(
      train.id,
      trainSnapshotValid &&
        evidenceValidity.get(train.releaseEvidenceRef) === true &&
        releaseEvidence?.kind === "release" &&
        releaseEvidence.sourceRecordDigest === train.releaseEvidenceDigest &&
        releaseEvidence.revision === computeReleaseEvidenceRevision(train) &&
        sameSet(releaseEvidence.subjectRefs, [train.id, ...strings(train.repositoryRefs)]) &&
        releaseChronologyValid,
    );
  }

  const pullRequestReadiness = new Map();
  const pullRequestBlockers = new Map();
  const pullRequestValidity = new Map();
  for (const [index, pr] of records(value.pullRequests).entries()) {
    const pullRequestIdentity = canonicalJson({
      repositoryRef: pr.repositoryRef ?? null,
      number: pr.number ?? null,
    });
    if (pullRequestIdentityCounts.get(pullRequestIdentity) !== 1) {
      add("duplicate_identity", `$.pullRequests[${index}].number`, [pr.id]);
    }
    const repository = repositories.get(pr.repositoryRef);
    const snapshot = snapshots.get(pr.snapshotRef);
    const sourceEvidence = evidence.get(pr.sourceEvidenceRef);
    const sourceEvidenceValid =
      evidenceValidity.get(pr.sourceEvidenceRef) === true &&
      sourceEvidence?.kind === "pull-request" &&
      sourceEvidence.sourceRecordDigest === pr.sourceEvidenceDigest &&
      sourceEvidence.revision === computePullRequestSourceRevision(pr) &&
      sameSet(sourceEvidence.subjectRefs, [pr.id, pr.repositoryRef]) &&
      timestamp(sourceEvidence.observedAt) !== null &&
      timestamp(snapshot?.capturedAt) !== null &&
      timestamp(sourceEvidence.observedAt) <= timestamp(snapshot.capturedAt);
    pullRequestValidity.set(
      pr.id,
      Boolean(
        repository &&
          snapshot?.kind === "pull-request" &&
          (snapshot.repositoryRef === null ||
            snapshot.repositoryRef === pr.repositoryRef) &&
          sourceEvidenceValid,
      ),
    );
    if (!sourceEvidenceValid) {
      add("invalid_evidence_binding", `$.pullRequests[${index}].sourceEvidenceRef`, [
        pr.sourceEvidenceRef,
        pr.id,
      ]);
    }
    const linkedReviews = strings(pr.reviewRefs).map((ref) => reviews.get(ref));
    const linkedChecks = strings(pr.checkRefs).map((ref) => checks.get(ref));
    const linkedBuilds = strings(pr.buildRefs).map((ref) => builds.get(ref));
    const currentReviews = records(value.reviews).filter(
      (row) => row.pullRequestRef === pr.id && row.headSha === pr.currentHeadSha,
    );
    const currentChecks = records(value.checks).filter(
      (row) => row.pullRequestRef === pr.id && row.headSha === pr.currentHeadSha,
    );
    const currentBuildRows = records(value.builds).filter(
      (row) => row.pullRequestRef === pr.id && row.headSha === pr.currentHeadSha,
    );
    const activeCurrentBuildRows = currentBuildRows.filter(
      (row) => row.state !== "superseded",
    );
    const allCurrentArtifactRefs = [
      ...new Set(currentBuildRows.flatMap((row) => strings(row.artifactRefs))),
    ];
    const currentArtifactRefs = [
      ...new Set(activeCurrentBuildRows.flatMap((row) => strings(row.artifactRefs))),
    ];
    const reverseCoverageValid =
      currentReviews.every((row) => strings(pr.reviewRefs).includes(row.id)) &&
      currentChecks.every((row) => strings(pr.checkRefs).includes(row.id)) &&
      currentBuildRows.every((row) => strings(pr.buildRefs).includes(row.id)) &&
      sameSet(pr.artifactRefs, allCurrentArtifactRefs);
    if (!reverseCoverageValid) {
      add("incomplete_pull_request_evidence_coverage", `$.pullRequests[${index}]`, [pr.id]);
    }
    const approvedReviewAuthors = new Set(
      linkedReviews
        .filter((row) => {
          const author = principals.get(row?.authorRef);
          return (
            row?.headSha === pr.currentHeadSha &&
            row.state === "approved" &&
            reviewValidity.get(row.id) === true &&
            author?.kind === "human" &&
            strings(author.scopes).includes("independent-review-author") &&
            author.id !== repository?.ownerRef &&
            strings(repository?.eligibleReviewerRefs).includes(author.id)
          );
        })
        .map((row) => row.authorRef),
    );
    const currentReviewApproved =
      approvedReviewAuthors.size >= repository?.requiredApprovalCount;
    const validCurrentChangeRequests = currentReviews.filter(
      (row) =>
        row.state === "changes-requested" &&
        reviewValidity.get(row.id) === true,
    );
    const currentReviewsValid = currentReviews.every(
      (row) => reviewValidity.get(row.id) === true,
    );
    const currentRequiredChecks = linkedChecks.filter(
      (row) =>
        row?.headSha === pr.currentHeadSha &&
        row.required &&
        row.state !== "superseded",
    );
    const requiredCheckCoverage = sameSet(
      currentRequiredChecks.map((row) => row.context),
      repository?.requiredCheckContexts,
    );
    const requiredChecksPass =
      requiredCheckCoverage &&
      currentRequiredChecks.every(
        (row) => row.state === "passed" && checkValidity.get(row.id) === true,
      );
    const currentChecksValid = currentChecks.every(
      (row) => checkValidity.get(row.id) === true,
    );
    if (!requiredCheckCoverage) {
      add("missing_required_check_evidence", `$.pullRequests[${index}].checkRefs`, [pr.id]);
    }
    const currentBuildsPass =
      activeCurrentBuildRows.length > 0 &&
      activeCurrentBuildRows.every(
        (row) => row.state === "succeeded" && buildValidity.get(row.id) === true,
      );
    const currentArtifactsVerified = currentArtifactRefs.every((ref) => {
      const artifact = artifacts.get(ref);
      return artifact?.state === "verified" && artifactValidity.get(ref) === true;
    });
    const prSubjectRefs = new Set([
      pr.id,
      ...strings(pr.reviewRefs),
      ...strings(pr.checkRefs),
      ...strings(pr.buildRefs),
      ...strings(pr.artifactRefs),
    ]);
    const releaseBlockerCategories = new Set([
      "partial-release",
      "failed-release",
      "rolled-back-release",
      "superseded-release",
      "missing-evidence",
    ]);
    const expectedPrBlockers = records(value.blockers)
      .filter(
        (blocker) =>
          blocker.state === "open" &&
          (strings(blocker.subjectRefs).some((ref) => prSubjectRefs.has(ref)) ||
            (releaseBlockerCategories.has(blocker.category) &&
              strings(pr.releaseTrainRefs).some(
                (trainRef) =>
                  strings(blocker.subjectRefs).includes(trainRef) &&
                  (sameSet(blocker.subjectRefs, [trainRef]) ||
                    strings(blocker.subjectRefs).includes(pr.repositoryRef)),
              ))),
      )
      .map((row) => row.id);
    pullRequestBlockers.set(pr.id, expectedPrBlockers);
    if (!sameSet(pr.blockerRefs, expectedPrBlockers)) {
      add("invalid_pull_request_blockers", `$.pullRequests[${index}].blockerRefs`, [pr.id]);
    }
    const requiredBlockers = [];
    if (validCurrentChangeRequests.length > 0) {
      const adverseReviews = validCurrentChangeRequests;
      requiredBlockers.push(
        ...adverseReviews.map((row) => ({
          category: "changes-requested-review",
          subjectRef: row.id,
        })),
      );
    } else if (!currentReviewApproved) {
      const staleReviews = linkedReviews.filter((row) => row?.state === "stale");
      if (currentReviews.length === 0 && staleReviews.length > 0) {
        requiredBlockers.push(
          ...staleReviews.map((row) => ({ category: "stale-review", subjectRef: row.id })),
        );
      } else {
        requiredBlockers.push({
          category: "missing-evidence",
          subjectRef: currentReviews[0]?.id ?? pr.id,
        });
      }
    }
    for (const check of currentChecks.filter(
      (row) => row.required && !["passed", "superseded"].includes(row.state),
    )) {
      requiredBlockers.push({
        category: ["failed", "cancelled"].includes(check.state)
          ? "failed-check"
          : "missing-evidence",
        subjectRef: check.id,
      });
    }
    if (!requiredCheckCoverage) {
      requiredBlockers.push({ category: "missing-evidence", subjectRef: pr.id });
    }
    for (const build of activeCurrentBuildRows.filter((row) => row.state !== "succeeded")) {
      requiredBlockers.push({
        category: ["failed", "cancelled"].includes(build.state)
          ? "failed-build"
          : "missing-evidence",
        subjectRef: build.id,
      });
    }
    if (currentBuildRows.length === 0) {
      requiredBlockers.push({ category: "missing-evidence", subjectRef: pr.id });
    }
    for (const artifactRef of currentArtifactRefs) {
      const artifact = artifacts.get(artifactRef);
      if (artifact?.state === "missing") {
        requiredBlockers.push({ category: "missing-artifact", subjectRef: artifact.id });
      } else if (artifact?.state === "failed") {
        requiredBlockers.push({ category: "failed-artifact", subjectRef: artifact.id });
      }
    }
    for (const required of requiredBlockers) {
      const hasRequiredBlocker = records(value.blockers).some(
        (blocker) =>
          blocker.state === "open" &&
          blocker.category === required.category &&
          strings(blocker.subjectRefs).includes(pr.id) &&
          strings(blocker.subjectRefs).includes(required.subjectRef),
      );
      if (!hasRequiredBlocker) {
        add("missing_required_blocker", `$.pullRequests[${index}].blockerRefs`, [
          pr.id,
          required.subjectRef,
        ]);
      }
    }
    const prSnapshot = snapshots.get(pr.snapshotRef);
    const refsResolve =
      repository?.state === "current" &&
      SHA_PATTERN.test(pr.currentHeadSha ?? "") &&
      (pr.previousHeadSha === null || SHA_PATTERN.test(pr.previousHeadSha ?? "")) &&
      pr.evidenceRevision === computePullRequestSourceRevision(pr) &&
      prSnapshot?.kind === "pull-request" &&
      (prSnapshot.repositoryRef === null || prSnapshot.repositoryRef === pr.repositoryRef) &&
      linkedReviews.every((row) => row?.pullRequestRef === pr.id) &&
      linkedChecks.every((row) => row?.pullRequestRef === pr.id) &&
      linkedBuilds.every((row) => row?.pullRequestRef === pr.id) &&
      reverseCoverageValid &&
      strings(pr.artifactRefs).every((ref) => {
        const artifact = artifacts.get(ref);
        return (
          artifact?.repositoryRef === pr.repositoryRef &&
          artifact.headSha === pr.currentHeadSha
        );
      }) &&
      strings(pr.releaseTrainRefs).every((ref) =>
        records(releaseTrains.get(ref)?.entries).some(
          (entry) =>
            entry.repositoryRef === pr.repositoryRef &&
            entry.targetHeadSha === pr.currentHeadSha,
        ),
      ) &&
      records(value.releaseTrains)
        .filter((train) =>
          records(train.entries).some(
            (entry) =>
              entry.repositoryRef === pr.repositoryRef &&
              entry.targetHeadSha === pr.currentHeadSha,
          ),
        )
        .every((train) => strings(pr.releaseTrainRefs).includes(train.id));
    const releaseMembershipReady = strings(pr.releaseTrainRefs).every((trainRef) => {
      const train = releaseTrains.get(trainRef);
      const entry = records(train?.entries).find(
        (row) =>
          row.repositoryRef === pr.repositoryRef &&
          row.targetHeadSha === pr.currentHeadSha,
      );
      return (
        train?.state === "released" &&
        entry?.state === "released" &&
        releaseEvidenceValidity.get(trainRef) === true
      );
    });
    const shouldBeReady =
      refsResolve &&
      pullRequestValidity.get(pr.id) === true &&
      currentReviewApproved &&
      currentReviewsValid &&
      validCurrentChangeRequests.length === 0 &&
      currentChecksValid &&
      requiredChecksPass &&
      currentBuildsPass &&
      currentArtifactsVerified &&
      releaseMembershipReady &&
      !unresolvedEscalations.some((row) => row.targetRef === pr.id) &&
      expectedPrBlockers.length === 0;
    pullRequestReadiness.set(pr.id, shouldBeReady);
    if (!refsResolve) add("invalid_pull_request_closure", `$.pullRequests[${index}]`, [pr.id]);
    if (pr.readiness !== (shouldBeReady ? "ready-for-owner-review" : "blocked")) {
      add("invalid_pull_request_readiness", `$.pullRequests[${index}].readiness`, [pr.id]);
    }
    if (!shouldBeReady) operationalBlocker = true;
  }

  const releaseTrainReady = new Map();
  const releaseTrainMemberPrs = new Map();
  const dependencyIsValid = (dependency) => {
    const train = releaseTrains.get(dependency.releaseTrainRef);
    const upstream = records(train?.entries).find(
      (row) => row.repositoryRef === dependency.upstreamRepositoryRef,
    );
    const downstream = records(train?.entries).find(
      (row) => row.repositoryRef === dependency.downstreamRepositoryRef,
    );
    const releaseOrderSatisfied =
      upstream?.state === "released" &&
      downstream?.state === "released" &&
      upstream.order < downstream.order;
    const dependencyEvidence = evidence.get(dependency.evidenceRef);
    const releaseEvidence = releaseEvidenceByTrain.get(dependency.releaseTrainRef);
    const dependencyObservedMs = timestamp(dependencyEvidence?.observedAt);
    const releaseObservedMs = timestamp(releaseEvidence?.observedAt);
    const releaseSnapshotMs = timestamp(snapshots.get(train?.snapshotRef)?.capturedAt);
    const expectedRevision = computeDependencyRevision(dependency, train, upstream, downstream);
    return (
      Boolean(train && upstream && downstream) &&
      dependency.upstreamRepositoryRef !== dependency.downstreamRepositoryRef &&
      evidenceValidity.get(dependency.evidenceRef) === true &&
      dependencyEvidence?.kind === "dependency" &&
      releaseEvidenceValidity.get(dependency.releaseTrainRef) === true &&
      dependencyObservedMs !== null &&
      releaseObservedMs !== null &&
      releaseSnapshotMs !== null &&
      dependencyObservedMs >= releaseObservedMs &&
      dependencyObservedMs <= releaseSnapshotMs &&
      dependency.evidenceRevision === expectedRevision &&
      dependencyEvidence.revision === expectedRevision &&
      sameSet(dependencyEvidence.subjectRefs, [
        dependency.id,
        dependency.releaseTrainRef,
        dependency.upstreamRepositoryRef,
        dependency.downstreamRepositoryRef,
      ]) &&
      (dependency.state !== "satisfied" || releaseOrderSatisfied)
    );
  };
  for (const [trainIndex, train] of records(value.releaseTrains).entries()) {
    const trainSnapshotValid = releaseSnapshotValidity.get(train.id) === true;
    const releaseEvidenceValid = releaseEvidenceValidity.get(train.id) === true;
    const hasUnresolvedEscalation = unresolvedEscalations.some(
      (row) =>
        row.targetRef === train.id ||
        records(value.dependencies).some(
          (dependency) =>
            dependency.id === row.targetRef && dependency.releaseTrainRef === train.id,
        ),
    );
    const hasBlockedDependency = records(value.dependencies).some(
      (dependency) =>
        dependency.releaseTrainRef === train.id &&
        (dependency.state !== "satisfied" || !dependencyIsValid(dependency)),
    );
    let trainReady =
      train.state === "released" &&
      trainSnapshotValid &&
      !hasUnresolvedEscalation &&
      !hasBlockedDependency &&
      releaseEvidenceValid;
    const memberPrRefs = [];
    if (!releaseEvidenceValid) {
      add("invalid_release_entry", `$.releaseTrains[${trainIndex}]`, [train.id]);
    }
    if (!trainSnapshotValid) {
      add("invalid_release_snapshot", `$.releaseTrains[${trainIndex}].snapshotRef`, [train.id]);
    }
    if (!sameSet(train.repositoryRefs, records(train.entries).map((row) => row.repositoryRef))) {
      add("invalid_release_roster", `$.releaseTrains[${trainIndex}].repositoryRefs`, [train.id]);
      trainReady = false;
    }
    if (
      new Set(records(train.entries).map((entry) => entry.order)).size !==
      records(train.entries).length
    ) {
      add("invalid_release_entry", `$.releaseTrains[${trainIndex}].entries`, [train.id]);
      trainReady = false;
    }
    for (const [entryIndex, entry] of records(train.entries).entries()) {
      const repository = repositories.get(entry.repositoryRef);
      const matchingPrs = records(value.pullRequests).filter(
        (row) =>
          row.repositoryRef === entry.repositoryRef && row.currentHeadSha === entry.targetHeadSha,
      );
      const matchingPr = matchingPrs.length === 1 ? matchingPrs[0] : null;
      if (matchingPr) memberPrRefs.push(matchingPr.id);
      const releaseArtifacts = strings(entry.artifactRefs).map((ref) => artifacts.get(ref));
      const artifactClosureValid = releaseArtifacts.every((artifact) => {
        const build = builds.get(artifact?.buildRef);
        const snapshot = snapshots.get(artifact?.snapshotRef);
        const buildSnapshot = snapshots.get(build?.snapshotRef);
        const provenance = evidence.get(artifact?.provenanceEvidenceRef);
        return (
          artifact &&
          artifactValidity.get(artifact.id) === true &&
          artifact.repositoryRef === entry.repositoryRef &&
          artifact.headSha === entry.targetHeadSha &&
          build?.repositoryRef === entry.repositoryRef &&
          buildValidity.get(build.id) === true &&
          build.headSha === entry.targetHeadSha &&
          build.pullRequestRef === matchingPr?.id &&
          strings(matchingPr?.buildRefs).includes(build.id) &&
          strings(matchingPr?.artifactRefs).includes(artifact.id) &&
          strings(build.artifactRefs).includes(artifact.id) &&
          snapshot?.kind === "artifact" &&
          snapshot.repositoryRef === entry.repositoryRef &&
          buildSnapshot?.kind === "workflow-run" &&
          buildSnapshot.repositoryRef === entry.repositoryRef &&
          provenance?.kind === "artifact-provenance" &&
          provenance.revision === entry.targetHeadSha &&
          provenance.digest === artifact.digest &&
          strings(provenance.subjectRefs).includes(artifact.id) &&
          strings(provenance.subjectRefs).includes(build.id)
        );
      });
      if (
        repository?.state !== "current" ||
        matchingPrs.length !== 1 ||
        !artifactClosureValid ||
        (entry.state === "released" &&
          (releaseArtifacts.length === 0 ||
            releaseArtifacts.some((artifact) => artifact?.state !== "verified")))
      ) {
        add(
          "invalid_release_entry",
          `$.releaseTrains[${trainIndex}].entries[${entryIndex}]`,
          [train.id],
        );
        trainReady = false;
      }
      if (pullRequestReadiness.get(matchingPr?.id) !== true) {
        trainReady = false;
      }
      releaseTrainMemberPrs.set(train.id, memberPrRefs);
      if (entry.state !== "released") {
        trainReady = false;
        const requiredCategory = releaseBlockerCategory(entry.state);
        const hasRequiredBlocker = records(value.blockers).some(
          (blocker) =>
            blocker.state === "open" &&
            blocker.category === requiredCategory &&
            strings(blocker.subjectRefs).includes(train.id) &&
            strings(blocker.subjectRefs).includes(entry.repositoryRef) &&
            sameSet(blocker.evidenceRefs, [train.releaseEvidenceRef]),
        );
        if (!hasRequiredBlocker) {
          add(
            "missing_required_blocker",
            `$.releaseTrains[${trainIndex}].entries[${entryIndex}]`,
            [train.id, entry.repositoryRef],
          );
        }
      }
    }
    if (["planned", "partial", "failed", "rolled-back", "superseded"].includes(train.state)) {
      const requiredCategory = releaseBlockerCategory(train.state);
      const hasAggregateBlocker = records(value.blockers).some(
        (blocker) =>
          blocker.state === "open" &&
          blocker.category === requiredCategory &&
          sameSet(blocker.subjectRefs, [train.id]) &&
          blocker.ownerRef === roster.custodianRef &&
          sameSet(blocker.evidenceRefs, [train.releaseEvidenceRef]) &&
          releaseEvidenceValid,
      );
      if (!hasAggregateBlocker) {
        add("missing_required_blocker", `$.releaseTrains[${trainIndex}].blockerRefs`, [
          train.id,
          requiredCategory,
        ]);
      }
      trainReady = false;
      operationalBlocker = true;
    }
    if (train.state === "released" && !trainReady) {
      add("invalid_release_state", `$.releaseTrains[${trainIndex}].state`, [train.id]);
    }
    if (!trainReady) operationalBlocker = true;
    releaseTrainReady.set(train.id, trainReady);
  }

  for (const [index, dependency] of records(value.dependencies).entries()) {
    const dependencyValid = dependencyIsValid(dependency);
    if (!dependencyValid) {
      add("invalid_cross_repository_dependency", `$.dependencies[${index}]`, [dependency.id]);
    }
    if (dependency.state !== "satisfied" || !dependencyValid) operationalBlocker = true;
    if (dependency.state !== "satisfied" || !dependencyValid) {
      const hasRequiredBlocker = records(value.blockers).some(
        (blocker) =>
          blocker.state === "open" &&
          blocker.category === "cross-repository-ordering" &&
          strings(blocker.subjectRefs).includes(dependency.id) &&
          strings(blocker.subjectRefs).includes(dependency.downstreamRepositoryRef) &&
          strings(blocker.subjectRefs).includes(dependency.releaseTrainRef) &&
          strings(blocker.evidenceRefs).includes(dependency.evidenceRef),
      );
      if (!hasRequiredBlocker) {
        add("missing_required_blocker", `$.dependencies[${index}]`, [dependency.id]);
      }
    }
  }

  const currentEntries = currentRevisionEntries(value);
  const previousEntries = records(predecessor?.entities);
  const deltaEntryIdCounts = new Map();
  for (const row of records(delta.entries)) {
    deltaEntryIdCounts.set(row.id, (deltaEntryIdCounts.get(row.id) ?? 0) + 1);
  }
  const currentById = new Map(currentEntries.map((row) => [row.entityRef, row]));
  const previousById = new Map(previousEntries.map((row) => [row.entityRef, row]));
  const universe = [...new Set([...currentById.keys(), ...previousById.keys()])].sort(compare);
  const changedRefs = records(delta.entries).map((row) => row.entityRef);
  const partition = [...changedRefs, ...strings(delta.unchangedRefs)];
  let deltaValid =
    delta.predecessorCheckpointRef === run.predecessorCheckpointRef &&
    delta.currentCheckpointRef === run.currentCheckpointId &&
    sameSet(partition, universe) &&
    new Set(partition).size === partition.length;
  for (const row of records(delta.entries)) {
    if (
      typeof row.id !== "string" ||
      deltaEntryIdCounts.get(row.id) !== 1 ||
      ids.has(row.id)
    ) {
      deltaValid = false;
      add("duplicate_identity", "$.delta.entries", [row.id]);
    }
    const before = previousById.get(row.entityRef);
    const after = currentById.get(row.entityRef);
    if (
      row.beforeRevision !== (before?.revision ?? null) ||
      row.afterRevision !== (after?.revision ?? null) ||
      (before && after && before.entityType !== after.entityType) ||
      (before && after && before.revision === after.revision) ||
      row.kind !== expectedDeltaKind(before, after)
    ) {
      deltaValid = false;
    }
  }
  for (const ref of strings(delta.unchangedRefs)) {
    if (
      !previousById.has(ref) ||
      previousById.get(ref).entityType !== currentById.get(ref)?.entityType ||
      previousById.get(ref).revision !== currentById.get(ref)?.revision
    ) {
      deltaValid = false;
    }
  }
  const expectedSuperseded = records(delta.entries)
    .filter((row) => row.beforeRevision !== null)
    .map((row) => computeSupersededRevisionRef(row.entityRef, row.beforeRevision));
  if (!sameSet(delta.supersededRefs, expectedSuperseded)) deltaValid = false;
  if (!deltaValid) add("invalid_checkpoint_delta", "$.delta");

  if (
    policy.revision !== run.escalationPolicyRevision ||
    !principals.has(policy.custodianRef) ||
    policy.custodianRef === clawPrincipals[0]?.id
  ) {
    add("invalid_escalation_policy", "$.escalationPolicy");
  }
  for (const [index, route] of records(policy.routes).entries()) {
    if (routeValidity.get(route.id) !== true) {
      add("invalid_escalation_route", `$.escalationPolicy.routes[${index}]`, [route.id]);
    }
  }
  for (const [index, escalation] of records(value.escalations).entries()) {
    const dispatch = object(escalation.dispatch);
    const deadlineMs = timestamp(escalation.deadline);
    if (escalationDispatchValidity.get(escalation.id) !== true) {
      add("invalid_escalation_dispatch", `$.escalations[${index}]`, [escalation.id]);
    }

    const response = escalation.responseRef ? responses.get(escalation.responseRef) : null;
    const validResponse = response && responseValidity.get(response.id) === true ? response : null;
    const expectedState = effectiveEscalationStates.get(escalation.id);
    if (escalation.state !== expectedState) {
      add("invalid_escalation_state", `$.escalations[${index}].state`, [escalation.id]);
    }
    if (
      response &&
      (response.requestRef !== escalation.id ||
        responseRefCounts.get(escalation.responseRef) !== 1)
    ) {
      add("invalid_response_binding", `$.escalations[${index}].responseRef`, [escalation.id]);
    }
    if (!response && deadlineMs !== null && runAsOfMs > deadlineMs) {
      add("missing_response_evidence", `$.escalations[${index}].responseRef`, [escalation.id]);
    }
    const requiredBlockerCategory = escalationBlockerCategory(expectedState);
    if (requiredBlockerCategory) {
      operationalBlocker = true;
      const requiredEvidenceRef = validResponse?.evidenceRef ?? dispatch.receiptEvidenceRef;
      const hasRequiredBlocker = records(value.blockers).some(
        (blocker) =>
          blocker.state === "open" &&
          blocker.category === requiredBlockerCategory &&
          blocker.ownerRef === escalation.recipientRef &&
          strings(blocker.subjectRefs).includes(escalation.id) &&
          strings(blocker.subjectRefs).includes(escalation.targetRef) &&
          (!validResponse || strings(blocker.subjectRefs).includes(validResponse.id)) &&
          strings(blocker.evidenceRefs).includes(requiredEvidenceRef),
      );
      if (!hasRequiredBlocker) {
        add("missing_required_blocker", `$.escalations[${index}]`, [
          escalation.id,
          escalation.targetRef,
        ]);
      }
    }
  }

  for (const [index, response] of records(value.responses).entries()) {
    if (responseValidity.get(response.id) !== true) {
      add("invalid_independent_response", `$.responses[${index}]`, [response.id]);
    }
  }

  const repositoryOwnerAuthority = (repositoryRef) => {
    const ownerRef = repositories.get(repositoryRef)?.ownerRef;
    return ownerRef ? { ownerRef, scopes: ["repository-owner"] } : null;
  };
  const blockerAuthority = (blocker) => {
    const subjectRefs = strings(blocker.subjectRefs);
    const escalation = records(value.escalations).find((row) => subjectRefs.includes(row.id));
    if (blocker.category.startsWith("approval-")) {
      return escalation?.recipientRef
        ? {
            ownerRef: escalation.recipientRef,
            scopes: [
              "eligible-approver",
              `decision-authority:${escalation.category}`,
            ],
          }
        : null;
    }
    if (blocker.category === "cross-repository-ordering") {
      return roster.custodianRef
        ? { ownerRef: roster.custodianRef, scopes: ["portfolio-custodian"] }
        : null;
    }
    if (
      [
        "partial-release",
        "failed-release",
        "rolled-back-release",
        "superseded-release",
      ].includes(blocker.category) ||
      blocker.category === "missing-evidence"
    ) {
      const releaseTrain = records(value.releaseTrains).find((row) =>
        subjectRefs.includes(row.id),
      );
      const releaseRepositoryRef = records(value.repositories).find((row) =>
        subjectRefs.includes(row.id),
      )?.id;
      if (releaseTrain && releaseRepositoryRef) {
        return repositoryOwnerAuthority(releaseRepositoryRef);
      }
      if (releaseTrain && sameSet(subjectRefs, [releaseTrain.id])) {
        return roster.custodianRef
          ? { ownerRef: roster.custodianRef, scopes: ["portfolio-custodian"] }
          : null;
      }
    }
    const review = records(value.reviews).find((row) => subjectRefs.includes(row.id));
    const check = records(value.checks).find((row) => subjectRefs.includes(row.id));
    const build = records(value.builds).find((row) => subjectRefs.includes(row.id));
    const artifact = records(value.artifacts).find((row) => subjectRefs.includes(row.id));
    const pullRequest =
      pullRequests.get(review?.pullRequestRef) ??
      pullRequests.get(check?.pullRequestRef) ??
      pullRequests.get(build?.pullRequestRef) ??
      pullRequests.get(builds.get(artifact?.buildRef)?.pullRequestRef) ??
      records(value.pullRequests).find((row) => subjectRefs.includes(row.id));
    if (pullRequest) return repositoryOwnerAuthority(pullRequest.repositoryRef);
    if (build?.repositoryRef) return repositoryOwnerAuthority(build.repositoryRef);
    if (artifact?.repositoryRef) return repositoryOwnerAuthority(artifact.repositoryRef);
    const repository = records(value.repositories).find((row) =>
      subjectRefs.includes(row.id),
    );
    return repository ? repositoryOwnerAuthority(repository.id) : null;
  };
  const blockerOwnerHasAuthority = (blocker) => {
    const authority = blockerAuthority(blocker);
    const principal = principals.get(authority?.ownerRef);
    return (
      authority !== null &&
      blocker.ownerRef === authority.ownerRef &&
      principal?.kind === "human" &&
      authority.scopes.every((scope) => strings(principal.scopes).includes(scope))
    );
  };

  const openBlockerSupported = (blocker) => {
    const subjectRefs = strings(blocker.subjectRefs);
    const evidenceRefs = strings(blocker.evidenceRefs);
    const review = records(value.reviews).find((row) => subjectRefs.includes(row.id));
    const check = records(value.checks).find((row) => subjectRefs.includes(row.id));
    const build = records(value.builds).find((row) => subjectRefs.includes(row.id));
    const artifact = records(value.artifacts).find((row) => subjectRefs.includes(row.id));
    const dependency = records(value.dependencies).find((row) => subjectRefs.includes(row.id));
    const escalation = records(value.escalations).find((row) => subjectRefs.includes(row.id));
    const releaseMatch = records(value.releaseTrains)
      .flatMap((train) =>
        records(train.entries).map((entry) => ({ train, entry })),
      )
      .find(
        ({ train, entry }) =>
          subjectRefs.includes(train.id) && subjectRefs.includes(entry.repositoryRef),
      );
    const aggregateReleaseTrain = records(value.releaseTrains).find((train) =>
      sameSet(subjectRefs, [train.id]),
    );
    const reviewPr = pullRequests.get(review?.pullRequestRef);
    const buildPr = pullRequests.get(build?.pullRequestRef);
    const artifactBuild = builds.get(artifact?.buildRef);
    const artifactPr = pullRequests.get(artifactBuild?.pullRequestRef);
    const response = escalation?.responseRef ? responses.get(escalation.responseRef) : null;
    const validResponse = responseValidity.get(response?.id) === true ? response : null;
    const approvalEvidenceRef =
      validResponse?.evidenceRef ?? object(escalation?.dispatch).receiptEvidenceRef;
    const releaseEvidenceBound = evidenceRefs.some((ref) => {
      const row = evidence.get(ref);
      return (
        ref === releaseMatch?.train.releaseEvidenceRef &&
        row?.sourceRecordDigest === releaseMatch?.train.releaseEvidenceDigest &&
        row?.kind === "release" &&
        row.revision === computeReleaseEvidenceRevision(releaseMatch?.train) &&
        sameSet(row.subjectRefs, [
          releaseMatch?.train.id,
          ...strings(releaseMatch?.train.repositoryRefs),
        ])
      );
    });
    const aggregateReleaseEvidenceBound = evidenceRefs.some((ref) => {
      const row = evidence.get(ref);
      return (
        ref === aggregateReleaseTrain?.releaseEvidenceRef &&
        row?.sourceRecordDigest === aggregateReleaseTrain?.releaseEvidenceDigest &&
        evidenceValidity.get(ref) === true &&
        row?.kind === "release" &&
        row.revision === computeReleaseEvidenceRevision(aggregateReleaseTrain) &&
        sameSet(row.subjectRefs, [
          aggregateReleaseTrain?.id,
          ...strings(aggregateReleaseTrain?.repositoryRefs),
        ])
      );
    });
    switch (blocker.category) {
      case "stale-review":
        return (
          review?.state === "stale" &&
          sameSet(subjectRefs, [reviewPr?.id, review.id]) &&
          sameSet(evidenceRefs, [review.evidenceRef]) &&
          blocker.ownerRef === repositories.get(reviewPr?.repositoryRef)?.ownerRef
        );
      case "changes-requested-review":
        return (
          review?.state === "changes-requested" &&
          sameSet(subjectRefs, [reviewPr?.id, review.id]) &&
          sameSet(evidenceRefs, [review.evidenceRef]) &&
          blocker.ownerRef === repositories.get(reviewPr?.repositoryRef)?.ownerRef
        );
      case "failed-check":
        return (
          ["failed", "cancelled"].includes(check?.state) &&
          checkValidity.get(check?.id) === true &&
          sameSet(subjectRefs, [check?.pullRequestRef, check?.id]) &&
          sameSet(evidenceRefs, [check?.evidenceRef]) &&
          blocker.ownerRef ===
            repositories.get(pullRequests.get(check?.pullRequestRef)?.repositoryRef)?.ownerRef
        );
      case "failed-build":
        return (
          ["failed", "cancelled"].includes(build?.state) &&
          buildValidity.get(build?.id) === true &&
          sameSet(subjectRefs, [buildPr?.id, build.id]) &&
          sameSet(evidenceRefs, [build.evidenceRef]) &&
          blocker.ownerRef === repositories.get(build?.repositoryRef)?.ownerRef
        );
      case "missing-artifact":
      case "failed-artifact":
        return (
          artifact?.state === (blocker.category === "missing-artifact" ? "missing" : "failed") &&
          artifactValidity.get(artifact?.id) === true &&
          sameSet(subjectRefs, [artifactPr?.id, artifact.id]) &&
          sameSet(evidenceRefs, [artifact.provenanceEvidenceRef]) &&
          blocker.ownerRef === repositories.get(artifact?.repositoryRef)?.ownerRef
        );
      case "cross-repository-ordering":
        return (
          dependency?.state !== "satisfied" &&
          sameSet(subjectRefs, [
            dependency?.id,
            dependency?.downstreamRepositoryRef,
            dependency?.releaseTrainRef,
          ]) &&
          sameSet(evidenceRefs, [dependency?.evidenceRef]) &&
          blocker.ownerRef === roster.custodianRef
        );
      case "partial-release":
      case "failed-release":
      case "rolled-back-release":
      case "superseded-release":
        return (
          (releaseMatch?.entry.state === blocker.category.replace("-release", "") &&
            sameSet(subjectRefs, [
              releaseMatch?.train.id,
              releaseMatch?.entry.repositoryRef,
            ]) &&
            evidenceRefs.length === 1 &&
            releaseEvidenceBound &&
            blocker.ownerRef === repositories.get(releaseMatch?.entry.repositoryRef)?.ownerRef) ||
          (aggregateReleaseTrain?.state === blocker.category.replace("-release", "") &&
            evidenceRefs.length === 1 &&
            aggregateReleaseEvidenceBound &&
            blocker.ownerRef === roster.custodianRef)
        );
      case "approval-required":
      case "approval-rejected":
      case "approval-change-requested":
      case "approval-expired":
      case "approval-no-response":
        return (
          escalationBlockerCategory(effectiveEscalationStates.get(escalation?.id)) ===
            blocker.category &&
          sameSet(subjectRefs, [
            escalation?.id,
            escalation?.targetRef,
            ...(validResponse ? [validResponse.id] : []),
          ]) &&
          sameSet(evidenceRefs, [approvalEvidenceRef]) &&
          blocker.ownerRef === escalation?.recipientRef
        );
      case "missing-evidence":
        if (["missing", "pending"].includes(check?.state)) {
          return (
            checkValidity.get(check?.id) === true &&
            sameSet(subjectRefs, [check.pullRequestRef, check.id]) &&
            sameSet(evidenceRefs, [check.evidenceRef]) &&
            blocker.ownerRef ===
            repositories.get(pullRequests.get(check.pullRequestRef)?.repositoryRef)?.ownerRef
          );
        }
        if (["missing", "running"].includes(build?.state)) {
          return (
            buildValidity.get(build?.id) === true &&
            sameSet(subjectRefs, [build.pullRequestRef, build.id]) &&
            sameSet(evidenceRefs, [build.evidenceRef]) &&
            blocker.ownerRef === repositories.get(build.repositoryRef)?.ownerRef
          );
        }
        if (releaseMatch?.entry.state === "planned") {
          return (
            sameSet(subjectRefs, [
              releaseMatch.train.id,
              releaseMatch.entry.repositoryRef,
            ]) &&
            evidenceRefs.length === 1 &&
            releaseEvidenceBound &&
            blocker.ownerRef === repositories.get(releaseMatch.entry.repositoryRef)?.ownerRef
          );
        }
        if (aggregateReleaseTrain?.state === "planned") {
          return (
            sameSet(subjectRefs, [aggregateReleaseTrain.id]) &&
            sameSet(evidenceRefs, [aggregateReleaseTrain.releaseEvidenceRef]) &&
            aggregateReleaseEvidenceBound &&
            blocker.ownerRef === roster.custodianRef
          );
        }
        {
          const missingReviewPr =
            reviewPr ??
            records(value.pullRequests).find((row) => subjectRefs.includes(row.id));
          const repository = repositories.get(missingReviewPr?.repositoryRef);
          const currentReviews = records(value.reviews).filter(
            (row) =>
              row.pullRequestRef === missingReviewPr?.id &&
              row.headSha === missingReviewPr?.currentHeadSha,
          );
          const currentChecks = records(value.checks).filter(
            (row) =>
              row.pullRequestRef === missingReviewPr?.id &&
              row.headSha === missingReviewPr?.currentHeadSha,
          );
          const currentBuilds = records(value.builds).filter(
            (row) =>
              row.pullRequestRef === missingReviewPr?.id &&
              row.headSha === missingReviewPr?.currentHeadSha,
          );
          const approvedAuthors = new Set(
            currentReviews
              .filter((row) => {
                const author = principals.get(row.authorRef);
                return (
                  row.state === "approved" &&
                  author?.kind === "human" &&
                  strings(author.scopes).includes("independent-review-author") &&
                  author.id !== repository?.ownerRef &&
                  strings(repository?.eligibleReviewerRefs).includes(author.id)
                );
              })
              .map((row) => row.authorRef),
          );
          const reviewScopeValid = review
            ? review.pullRequestRef === missingReviewPr?.id &&
              review.headSha === missingReviewPr?.currentHeadSha &&
              strings(missingReviewPr?.reviewRefs).includes(review.id) &&
              sameSet(subjectRefs, [missingReviewPr.id, review.id]) &&
              sameSet(evidenceRefs, [review.evidenceRef])
            : currentReviews.length === 0 &&
              sameSet(subjectRefs, [missingReviewPr?.id]) &&
              evidenceRefs.length === 0;
          const requiredCheckCoverage = sameSet(
            currentChecks
              .filter((row) => row.required && row.state !== "superseded")
              .map((row) => row.context),
            repository?.requiredCheckContexts,
          );
          const absentPrEvidence =
            sameSet(subjectRefs, [missingReviewPr?.id]) &&
            evidenceRefs.length === 0 &&
            (!requiredCheckCoverage || currentBuilds.length === 0);
          if (
            missingReviewPr &&
            ((approvedAuthors.size < repository?.requiredApprovalCount &&
              reviewScopeValid) ||
              absentPrEvidence)
          ) {
            return blocker.ownerRef === repository.ownerRef;
          }
        }
        return records(value.repositories).some(
          (row) =>
            sameSet(subjectRefs, [row.id]) &&
            evidenceRefs.length === 0 &&
            row.state === "missing" &&
            blocker.ownerRef === row.ownerRef,
        );
      default:
        return false;
    }
  };

  const resolvedBlockerSourceSupported = (blocker) => {
    const subjectRefs = strings(blocker.subjectRefs);
    const evidenceRefs = strings(blocker.evidenceRefs);
    if (evidenceRefs.length === 0 || evidenceRefs.includes(blocker.resolutionEvidenceRef)) {
      return false;
    }
    const onlyEvidence = (predicate) =>
      evidenceRefs.length === 1 && predicate(evidence.get(evidenceRefs[0]));
    const review = records(value.reviews).find((row) => subjectRefs.includes(row.id));
    const check = records(value.checks).find((row) => subjectRefs.includes(row.id));
    const build = records(value.builds).find((row) => subjectRefs.includes(row.id));
    const artifact = records(value.artifacts).find((row) => subjectRefs.includes(row.id));
    const dependency = records(value.dependencies).find((row) => subjectRefs.includes(row.id));
    const escalation = records(value.escalations).find((row) => subjectRefs.includes(row.id));
    const releaseMatch = records(value.releaseTrains)
      .flatMap((train) => records(train.entries).map((entry) => ({ train, entry })))
      .find(
        ({ train, entry }) =>
          subjectRefs.includes(train.id) && subjectRefs.includes(entry.repositoryRef),
      );
    const aggregateReleaseTrain = records(value.releaseTrains).find((train) =>
      sameSet(subjectRefs, [train.id]),
    );
    switch (blocker.category) {
      case "stale-review":
      case "changes-requested-review":
        return onlyEvidence(
          (row) =>
            review?.state ===
              (blocker.category === "stale-review" ? "stale" : "changes-requested") &&
            reviewValidity.get(review?.id) === true &&
            sameSet(subjectRefs, [review?.pullRequestRef, review?.id]) &&
            row?.kind === "review" &&
            evidenceRefs[0] === review?.evidenceRef &&
            strings(row.subjectRefs).includes(review?.id) &&
            strings(row.subjectRefs).includes(review?.pullRequestRef),
        );
      case "failed-check":
        return onlyEvidence(
          (row) =>
            ["failed", "cancelled"].includes(check?.state) &&
            checkValidity.get(check?.id) === true &&
            sameSet(subjectRefs, [check?.pullRequestRef, check?.id]) &&
            row?.kind === "check" &&
            evidenceRefs[0] === check?.evidenceRef &&
            strings(row.subjectRefs).includes(check?.id) &&
            strings(row.subjectRefs).includes(check?.pullRequestRef),
        );
      case "failed-build":
        return onlyEvidence(
          (row) =>
            ["failed", "cancelled"].includes(build?.state) &&
            buildValidity.get(build?.id) === true &&
            sameSet(subjectRefs, [build?.pullRequestRef, build?.id]) &&
            row?.kind === "build" &&
            evidenceRefs[0] === build?.evidenceRef &&
            strings(row.subjectRefs).includes(build?.id) &&
            strings(row.subjectRefs).includes(build?.pullRequestRef),
        );
      case "missing-artifact":
      case "failed-artifact":
        return onlyEvidence(
          (row) =>
            artifact?.state ===
              (blocker.category === "missing-artifact" ? "missing" : "failed") &&
            artifactValidity.get(artifact?.id) === true &&
            sameSet(subjectRefs, [
              builds.get(artifact?.buildRef)?.pullRequestRef,
              artifact?.id,
            ]) &&
            row?.kind === "artifact-provenance" &&
            evidenceRefs[0] === artifact?.provenanceEvidenceRef &&
            strings(row.subjectRefs).includes(artifact?.id) &&
            strings(row.subjectRefs).includes(artifact?.buildRef),
        );
      case "cross-repository-ordering":
        return onlyEvidence(
          (row) =>
            dependency?.state !== "satisfied" &&
            sameSet(subjectRefs, [
              dependency?.id,
              dependency?.downstreamRepositoryRef,
              dependency?.releaseTrainRef,
            ]) &&
            row?.kind === "dependency" &&
            evidenceRefs[0] === dependency?.evidenceRef &&
            strings(row.subjectRefs).includes(dependency?.id) &&
            strings(row.subjectRefs).includes(dependency?.releaseTrainRef) &&
            strings(row.subjectRefs).includes(dependency?.downstreamRepositoryRef),
        );
      case "partial-release":
      case "failed-release":
      case "rolled-back-release":
      case "superseded-release":
        return onlyEvidence(
          (row) =>
            evidenceRefs[0] ===
              (releaseMatch?.train ?? aggregateReleaseTrain)?.releaseEvidenceRef &&
            row?.sourceRecordDigest ===
              (releaseMatch?.train ?? aggregateReleaseTrain)?.releaseEvidenceDigest &&
            row?.kind === "release" &&
            ((releaseMatch?.entry.state === blocker.category.replace("-release", "") &&
              sameSet(subjectRefs, [
                releaseMatch?.train.id,
                releaseMatch?.entry.repositoryRef,
              ])) ||
              (aggregateReleaseTrain?.state ===
                blocker.category.replace("-release", "") &&
                sameSet(subjectRefs, [aggregateReleaseTrain?.id]))) &&
            row.revision ===
              computeReleaseEvidenceRevision(
                releaseMatch?.train ?? aggregateReleaseTrain,
              ),
        );
      case "approval-required":
        return onlyEvidence(
          (row) =>
            effectiveEscalationStates.get(escalation?.id) === "dispatched" &&
            sameSet(subjectRefs, [escalation?.id, escalation?.targetRef]) &&
            row?.kind === "escalation-dispatch-receipt" &&
            evidenceRefs[0] === object(escalation?.dispatch).receiptEvidenceRef &&
            strings(row.subjectRefs).includes(escalation?.id) &&
            strings(row.subjectRefs).includes(escalation?.routeRef),
        );
      case "approval-rejected":
      case "approval-change-requested":
      case "approval-expired":
      case "approval-no-response": {
        const response = escalation?.responseRef ? responses.get(escalation.responseRef) : null;
        return onlyEvidence(
          (row) =>
            responseValidity.get(response?.id) === true &&
            escalationBlockerCategory(effectiveEscalationStates.get(escalation?.id)) ===
              blocker.category &&
            sameSet(subjectRefs, [
              escalation?.id,
              escalation?.targetRef,
              response?.id,
            ]) &&
            row?.kind ===
              (response?.kind === "human-decision"
                ? "decision-response"
                : "deadline-observation") &&
            evidenceRefs[0] === response?.evidenceRef &&
            strings(row.subjectRefs).includes(response?.id) &&
            strings(row.subjectRefs).includes(escalation?.id),
        );
      }
      case "missing-evidence":
        {
          const history = object(blocker.missingEvidenceHistory);
          const prior = records(predecessor?.entities).find(
            (row) => row.entityRef === history.subjectRef,
          );
          const closureEvidence = evidence.get(history.closureEvidenceRef);
          const closureObservedMs = timestamp(closureEvidence?.observedAt);
          const priorObservedMs = timestamp(predecessor?.createdAt);
          const expectedClosureKind =
            prior?.entityType === "repository" ? "roster" : prior?.entityType;
          const closesExactGap =
            (prior?.entityType === "repository" &&
              repositories.get(prior.entityRef)?.state === "current" &&
              roster.evidenceRef === history.closureEvidenceRef &&
              strings(closureEvidence?.subjectRefs).includes(prior.entityRef)) ||
            (prior?.entityType === "check" &&
              !["missing", "pending"].includes(checks.get(prior.entityRef)?.state) &&
              checks.get(prior.entityRef)?.evidenceRef === history.closureEvidenceRef &&
              checkValidity.get(prior.entityRef) === true) ||
            (prior?.entityType === "build" &&
              !["missing", "running"].includes(builds.get(prior.entityRef)?.state) &&
              builds.get(prior.entityRef)?.evidenceRef === history.closureEvidenceRef &&
              buildValidity.get(prior.entityRef) === true);
          return (
            predecessor !== null &&
            history.checkpointRef === predecessor.checkpointId &&
            subjectRefs.includes(history.subjectRef) &&
            ["missing", "pending"].includes(history.priorState) &&
            prior?.state === history.priorState &&
            prior?.revision === history.priorRevision &&
            sameSet(evidenceRefs, [history.closureEvidenceRef]) &&
            evidenceValidity.get(history.closureEvidenceRef) === true &&
            closureEvidence?.kind === expectedClosureKind &&
            strings(closureEvidence?.subjectRefs).includes(history.subjectRef) &&
            priorObservedMs !== null &&
            closureObservedMs !== null &&
            priorObservedMs <= closureObservedMs &&
            closesExactGap
          );
        }
      default:
        return false;
    }
  };

  for (const [index, blocker] of records(value.blockers).entries()) {
    const resolutionEvidence = evidence.get(blocker.resolutionEvidenceRef);
    const sourceEvidenceRefs = strings(blocker.evidenceRefs);
    const sourceEvidence = sourceEvidenceRefs
      .map((ref) => evidence.get(ref))
      .filter(Boolean);
    const resolutionObservedMs = timestamp(resolutionEvidence?.observedAt);
    const latestSourceObservedMs = Math.max(
      ...sourceEvidence.map((row) => timestamp(row.observedAt) ?? Number.POSITIVE_INFINITY),
    );
    const missingHistory = object(blocker.missingEvidenceHistory);
    const expectedResolutionSubjects =
      blocker.category === "missing-evidence"
        ? [
            blocker.id,
            ...strings(blocker.subjectRefs),
            missingHistory.closureEvidenceRef,
          ]
        : [blocker.id, ...strings(blocker.subjectRefs)];
    const resolutionValid =
      blocker.state !== "resolved" ||
      (resolvedBlockerSourceSupported(blocker) &&
        sourceEvidence.length === sourceEvidenceRefs.length &&
        !sourceEvidenceRefs.includes(blocker.resolutionEvidenceRef) &&
        blockerOwnerHasAuthority(blocker) &&
        resolutionEvidence?.kind === "blocker" &&
        resolutionEvidence.authorRef === blockerAuthority(blocker)?.ownerRef &&
        resolutionEvidence.revision === computeBlockerResolutionRevision(blocker) &&
        sameSet(resolutionEvidence.subjectRefs, expectedResolutionSubjects) &&
        resolutionObservedMs !== null &&
        resolutionObservedMs >= latestSourceObservedMs);
    const missingHistoryShapeValid =
      blocker.category === "missing-evidence" && blocker.state === "resolved"
        ? isRecord(blocker.missingEvidenceHistory)
        : blocker.missingEvidenceHistory === undefined;
    if (
      !principals.has(blocker.ownerRef) ||
      strings(blocker.subjectRefs).some((ref) => !ids.has(ref)) ||
      strings(blocker.evidenceRefs).some((ref) => !evidence.has(ref)) ||
      (blocker.state === "open" &&
        (blocker.resolutionEvidenceRef !== null ||
          !blockerOwnerHasAuthority(blocker) ||
          !openBlockerSupported(blocker))) ||
      !missingHistoryShapeValid ||
      !resolutionValid
    ) {
      add("invalid_blocker", `$.blockers[${index}]`, [blocker.id]);
    }
    if (blocker.state === "open") operationalBlocker = true;
  }

  const expectedReadiness =
    operationalBlocker || findings.length > 0 ? "blocked" : "ready-for-owner-review";
  const openBlockers = records(value.blockers).filter((row) => row.state === "open");
  const repositoryForSubject = (subjectRef) => {
    if (repositories.has(subjectRef)) return subjectRef;
    if (pullRequests.has(subjectRef)) return pullRequests.get(subjectRef)?.repositoryRef;
    if (reviews.has(subjectRef)) {
      return pullRequests.get(reviews.get(subjectRef)?.pullRequestRef)?.repositoryRef;
    }
    if (checks.has(subjectRef)) {
      return pullRequests.get(checks.get(subjectRef)?.pullRequestRef)?.repositoryRef;
    }
    if (builds.has(subjectRef)) return builds.get(subjectRef)?.repositoryRef;
    if (artifacts.has(subjectRef)) return artifacts.get(subjectRef)?.repositoryRef;
    if (releaseTrains.has(subjectRef)) return null;
    const dependency = records(value.dependencies).find((row) => row.id === subjectRef);
    if (dependency) return dependency.downstreamRepositoryRef;
    return null;
  };
  const expectedRepositoryBlockers = (repositoryRef) =>
    [
      ...new Set([
        ...openBlockers
          .filter((blocker) =>
            strings(blocker.subjectRefs).some(
              (subjectRef) => repositoryForSubject(subjectRef) === repositoryRef,
            ),
          )
          .map((row) => row.id),
        ...openBlockers
          .filter(
            (blocker) =>
              records(value.releaseTrains).some(
                (train) =>
                  records(train.entries).some(
                    (entry) => entry.repositoryRef === repositoryRef,
                  ) &&
                  sameSet(blocker.subjectRefs, [train.id]) &&
                  blocker.category === releaseBlockerCategory(train.state),
              ),
          )
          .map((row) => row.id),
      ]),
    ];
  const expectedTrainBlockers = (trainRef) =>
    [
      ...new Set([
        ...openBlockers
          .filter((blocker) =>
            strings(blocker.subjectRefs).some(
              (subjectRef) => releaseTrainForSubject(subjectRef) === trainRef,
            ),
          )
          .map((row) => row.id),
        ...strings(releaseTrainMemberPrs.get(trainRef)).flatMap(
          (prRef) => pullRequestBlockers.get(prRef) ?? [],
        ),
      ]),
    ];
  const readinessRepositoryRefs = records(readiness.repositoryStates).map((row) => row.subjectRef);
  const readinessTrainRefs = records(readiness.releaseTrainStates).map((row) => row.subjectRef);
  if (
    readiness.portfolioState !== expectedReadiness ||
    handoff.state !== expectedReadiness ||
    !sameSet(readinessRepositoryRefs, [...repositories.keys()]) ||
    !sameSet(readinessTrainRefs, [...releaseTrains.keys()]) ||
    !sameSet(readiness.blockerRefs, records(value.blockers).filter((row) => row.state === "open").map((row) => row.id))
  ) {
    add("premature_readiness", "$.readiness");
  }
  for (const [index, row] of records(readiness.repositoryStates).entries()) {
    const repository = repositories.get(row.subjectRef);
    const repositoryBlockers = expectedRepositoryBlockers(row.subjectRef);
    const hasBlockedPr = records(value.pullRequests).some(
      (pr) =>
        pr.repositoryRef === row.subjectRef &&
        pullRequestReadiness.get(pr.id) !== true,
    );
    const expectedState =
      repository?.state === "current" &&
      !hasBlockedPr &&
      repositoryBlockers.length === 0 &&
      !unresolvedEscalations.some(
          (escalation) => repositoryForSubject(escalation.targetRef) === row.subjectRef,
      ) &&
      !records(value.dependencies).some(
          (dependency) =>
            dependency.downstreamRepositoryRef === row.subjectRef &&
            (dependency.state !== "satisfied" || !dependencyIsValid(dependency)),
      ) &&
      !records(value.releaseTrains).some((train) =>
          records(train.entries).some((entry) => entry.repositoryRef === row.subjectRef) &&
          (train.state !== "released" ||
            records(train.entries).some(
              (entry) => entry.repositoryRef === row.subjectRef && entry.state !== "released",
            )),
      )
        ? "ready-for-owner-review"
        : "blocked";
    if (
      !repository ||
      row.state !== expectedState ||
      !sameSet(row.blockerRefs, repositoryBlockers)
    ) {
      add("invalid_repository_readiness", `$.readiness.repositoryStates[${index}]`, [
        row.subjectRef,
      ]);
    }
  }
  for (const [index, row] of records(readiness.releaseTrainStates).entries()) {
    const train = releaseTrains.get(row.subjectRef);
    const trainBlockers = expectedTrainBlockers(row.subjectRef);
    const expectedState =
      releaseTrainReady.get(row.subjectRef) === true &&
      trainBlockers.length === 0
        ? "ready-for-owner-review"
        : "blocked";
    if (!train || row.state !== expectedState || !sameSet(row.blockerRefs, trainBlockers)) {
      add("invalid_release_train_readiness", `$.readiness.releaseTrainStates[${index}]`, [
        row.subjectRef,
      ]);
    }
  }

  if (
    run.currentCheckpointDigest !== computeCheckpointDigest(value) ||
    handoff.checkpointRef !== run.currentCheckpointId ||
    handoff.checkpointDigest !== run.currentCheckpointDigest
  ) {
    add("invalid_checkpoint_digest", "$.run.currentCheckpointDigest");
  }
  if (
    principals.get(handoff.nextOwnerRef)?.kind !== "human" ||
    !strings(principals.get(handoff.nextOwnerRef)?.scopes).includes("portfolio-custodian")
  ) {
    add("invalid_handoff_owner", "$.handoff.nextOwnerRef", [handoff.nextOwnerRef]);
  }
  for (const [field, expected] of Object.entries(REQUIRED_AUTHORITY_GATES)) {
    if (handoff[field] !== expected) add("forbidden_authority_claim", `$.handoff.${field}`);
  }
  if (hasForbiddenNarrative({ summary: handoff.summary })) {
    add("forbidden_authority_claim", "$.handoff.summary");
  }

  const unique = new Map(findings.map((row) => [canonicalJson(row), row]));
  return [...unique.values()].sort((left, right) =>
    compare(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
  );
}
