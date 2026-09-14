import { createHash } from "node:crypto";

export const REPOSITORY_COMPLIANCE_SCHEMA_VERSION =
  "awesomeClaws.repositoryComplianceProgram.v1";

const TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const CLAW_PRINCIPAL = "principal-compliance-program-claw";
const TOP_LEVEL = new Set([
  "schemaVersion",
  "artifactId",
  "run",
  "snapshots",
  "principals",
  "controls",
  "slaRules",
  "assets",
  "signals",
  "canonicalFindings",
  "obligations",
  "issuePolicy",
  "issues",
  "issueMutations",
  "issueReceipts",
  "extensions",
  "exceptions",
  "remediationEvidence",
  "verifications",
  "nonQualifyingClosureSignals",
  "escalationPolicy",
  "escalations",
  "predecessor",
  "delta",
  "blockers",
  "coverage",
  "evidence",
  "authority",
  "handoff",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rows(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function values(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function compare(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function sorted(value) {
  return [...values(value)].sort(compare);
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
  if (typeof value !== "string" || !TIMESTAMP.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function byId(value) {
  return new Map(rows(value).map((row) => [row.id, row]));
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

function finding(code, path, refs = []) {
  return { code, path, refs: [...new Set(values(refs))].sort(compare) };
}

function uniqueIds(items) {
  const ids = rows(items).map((row) => row.id);
  return ids.length === new Set(ids).size && ids.every((id) => typeof id === "string");
}

function exactRef(items, ref) {
  return rows(items).filter((row) => row.id === ref).length === 1;
}

function narrativeTexts(value) {
  const output = [];
  const visit = (item) => {
    if (typeof item === "string") {
      output.push(item);
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (isRecord(item)) {
      Object.values(item).forEach(visit);
    }
  };
  visit(value);
  return output;
}

const FORBIDDEN_NARRATIVE =
  /\b(?:the\s+)?(?:claw|agent|assistant|program manager|we|i)\b(?:(?!\b(?:not|never|cannot|can't|didn't|did not|doesn't|does not|without)\b|[.!?])[\s\S]){0,100}?\b(?:closed?|fixed?|remediated?|approved?|waived?|accepted risk|suppressed?|dismissed?|changed code|changed settings|merged?|deployed?|certified?|compliant)\b/iu;

export function computeSnapshotRoot(snapshot) {
  return digest({
    id: snapshot.id,
    kind: snapshot.kind,
    revision: snapshot.revision,
    capturedAt: snapshot.capturedAt,
    sourceUri: snapshot.sourceUri,
    sourceRecordDigest: snapshot.sourceRecordDigest,
    complete: snapshot.complete,
    indexRefs: sorted(snapshot.indexRefs),
  });
}

export function computeControlRevision(control) {
  return digest({
    id: control.id,
    catalogRef: control.catalogRef,
    catalogVersion: control.catalogVersion,
    controlKey: control.controlKey,
    applicability: control.applicability,
    slaRuleRef: control.slaRuleRef,
    signalTypes: sorted(control.signalTypes),
    sourceRef: control.sourceRef,
  });
}

export function computeAssetRevision(asset) {
  return digest({
    id: asset.id,
    kind: asset.kind,
    canonicalName: asset.canonicalName,
    repositoryDestinationRef: asset.repositoryDestinationRef,
    serviceRef: asset.serviceRef,
    teamRef: asset.teamRef,
    ownerRef: asset.ownerRef,
    sourceRef: asset.sourceRef,
  });
}

export function computeSignalRevision(signal) {
  return digest({
    id: signal.id,
    sourceIdentity: signal.sourceIdentity,
    sourceRef: signal.sourceRef,
    signalType: signal.signalType,
    controlRef: signal.controlRef,
    assetRef: signal.assetRef,
    findingRevision: signal.findingRevision,
    canonicalFindingKey: signal.canonicalFindingKey,
    sourceSeverity: signal.sourceSeverity,
    sourceApplicability: signal.sourceApplicability,
    sourceStatus: signal.sourceStatus,
    observedAt: signal.observedAt,
    evidenceRef: signal.evidenceRef,
  });
}

export function computeFindingRevision(row) {
  return digest({
    id: row.id,
    canonicalFindingKey: row.canonicalFindingKey,
    controlRef: row.controlRef,
    controlRevision: row.controlRevision,
    assetRef: row.assetRef,
    assetRevision: row.assetRevision,
    findingRevision: row.findingRevision,
    sourceSignalRefs: sorted(row.sourceSignalRefs),
    state: row.state,
  });
}

export function computeObligationKey(row) {
  return digest({
    controlRef: row.controlRef,
    controlRevision: row.controlRevision,
    assetRef: row.assetRef,
    assetRevision: row.assetRevision,
    findingRevision: row.findingRevision,
  });
}

export function computeObligationRevision(row) {
  return digest({
    id: row.id,
    obligationKey: row.obligationKey,
    canonicalFindingRef: row.canonicalFindingRef,
    controlRef: row.controlRef,
    controlRevision: row.controlRevision,
    assetRef: row.assetRef,
    assetRevision: row.assetRevision,
    findingRevision: row.findingRevision,
    ownerRef: row.ownerRef,
    teamRef: row.teamRef,
    sourcePriority: row.sourcePriority,
    openedAt: row.openedAt,
    dueAt: row.dueAt,
    etaAt: row.etaAt,
    slaState: row.slaState,
    state: row.state,
    issueRef: row.issueRef,
    extensionRef: row.extensionRef,
    exceptionRef: row.exceptionRef,
    remediationEvidenceRef: row.remediationEvidenceRef,
    verificationRef: row.verificationRef,
    reopenOfObligationRef: row.reopenOfObligationRef,
    reopenReason: row.reopenReason,
    blockerRefs: sorted(row.blockerRefs),
  });
}

export function computeIssueIdempotencyKey(obligation, issuePolicy) {
  return digest({
    programRef: issuePolicy.programRef,
    policyRevision: issuePolicy.revision,
    obligationKey: obligation.obligationKey,
    destinationRef: issuePolicy.destinationRef,
    templateRef: issuePolicy.templateRef,
  });
}

export function computeIssuePolicyDigest(policy) {
  return digest({
    id: policy.id,
    programRef: policy.programRef,
    revision: policy.revision,
    capability: policy.capability,
    dependencyRef: policy.dependencyRef,
    dependencyEndpoint: policy.dependencyEndpoint,
    dependencyTransport: policy.dependencyTransport,
    dependencyAuth: policy.dependencyAuth,
    provenanceDigest: policy.provenanceDigest,
    destinationRef: policy.destinationRef,
    approvedRepositoryRefs: sorted(policy.approvedRepositoryRefs),
    templateRef: policy.templateRef,
    mutableFieldAllowlist: sorted(policy.mutableFieldAllowlist),
    allowedLabels: sorted(policy.allowedLabels),
    routeRef: policy.routeRef,
    allowedOperations: sorted(policy.allowedOperations),
    ownerAuthoredContentPolicy: policy.ownerAuthoredContentPolicy,
    dryRunRequired: policy.dryRunRequired,
    conflictDetectionRequired: policy.conflictDetectionRequired,
    externalReceiptRequired: policy.externalReceiptRequired,
    closeAllowed: policy.closeAllowed,
  });
}

export function computeIssueMutationPreview(mutation) {
  return digest({
    id: mutation.id,
    issueRef: mutation.issueRef,
    obligationRef: mutation.obligationRef,
    obligationRevision: mutation.obligationRevision,
    policyDigest: mutation.policyDigest,
    operation: mutation.operation,
    idempotencyKey: mutation.idempotencyKey,
    destinationRef: mutation.destinationRef,
    templateRef: mutation.templateRef,
    routeRef: mutation.routeRef,
    labels: sorted(mutation.labels),
    mutableFields: sorted(mutation.mutableFields),
    proposedValues: mutation.proposedValues,
    expectedIssueRevision: mutation.expectedIssueRevision,
    expectedOwnerContentDigest: mutation.expectedOwnerContentDigest,
  });
}

export function computeIssueReceiptResultDigest(receipt) {
  return digest({
    mutationRef: receipt.mutationRef,
    issueRef: receipt.issueRef,
    operation: receipt.operation,
    idempotencyKey: receipt.idempotencyKey,
    providerIssueId: receipt.providerIssueId,
    afterRevision: receipt.afterRevision,
  });
}

export function computeAuthorityScopeDigest(record) {
  return digest({
    obligationRef: record.obligationRef,
    controlRef: record.controlRef,
    controlRevision: record.controlRevision,
    assetRef: record.assetRef,
    assetRevision: record.assetRevision,
    issueRef: record.issueRef,
  });
}

export function computeCheckpointDigest(value) {
  const sealed = structuredClone(value);
  if (isRecord(sealed.run)) sealed.run.currentCheckpointDigest = null;
  if (isRecord(sealed.handoff)) sealed.handoff.checkpointDigest = null;
  return digest(sealed);
}

function expectedSlaState(obligation, slaRule, asOf) {
  const due = timestamp(obligation.dueAt);
  if (due === null || asOf === null || !slaRule) return null;
  if (asOf > due) return "out";
  const nearStart = due - slaRule.nearWindowHours * 60 * 60 * 1000;
  return asOf >= nearStart ? "near" : "within";
}

function expectedEscalationCategories(obligation) {
  if (["verified", "exception-active"].includes(obligation.state)) return [];
  const categories = [];
  if (obligation.etaAt === null) {
    categories.push("missing-eta");
  }
  if (["critical", "high"].includes(obligation.sourcePriority)) {
    categories.push("priority");
  }
  if (obligation.slaState === "near") categories.push("near-sla");
  if (obligation.slaState === "out") categories.push("out-of-sla");
  return categories;
}

function authorityIsIndependent(principals, authorityRef, subjectOwnerRef, role) {
  const authority = principals.get(authorityRef);
  return (
    authority &&
    authority.kind === "human" &&
    authority.role === role &&
    authority.id !== CLAW_PRINCIPAL &&
    authority.id !== subjectOwnerRef
  );
}

function expectedProposedValues(obligation, mutableFields) {
  const sourceFields = {
    ownerRef: "ownerRef",
    etaAt: "etaAt",
    dueAt: "dueAt",
    slaState: "slaState",
    obligationState: "state",
  };
  return Object.fromEntries(
    values(mutableFields).map((field) => [field, obligation?.[sourceFields[field]]]),
  );
}

export function repositoryComplianceProgramFindings(value, options = {}) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_artifact", "$")];
  }
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  if (value.schemaVersion !== REPOSITORY_COMPLIANCE_SCHEMA_VERSION) {
    add("invalid_schema_version", "schemaVersion");
  }
  const unknown = Object.keys(value).filter((key) => !TOP_LEVEL.has(key));
  if (unknown.length > 0) add("unknown_top_level_field", "$", unknown);

  const collections = [
    "snapshots",
    "principals",
    "controls",
    "slaRules",
    "assets",
    "signals",
    "canonicalFindings",
    "obligations",
    "issues",
    "issueMutations",
    "issueReceipts",
    "extensions",
    "exceptions",
    "remediationEvidence",
    "verifications",
    "nonQualifyingClosureSignals",
    "escalations",
    "blockers",
    "evidence",
  ];
  for (const collection of collections) {
    if (!Array.isArray(value[collection]) || !uniqueIds(value[collection])) {
      add("invalid_identity_set", collection);
    }
  }

  const snapshots = byId(value.snapshots);
  const principals = byId(value.principals);
  const controls = byId(value.controls);
  const slaRules = byId(value.slaRules);
  const assets = byId(value.assets);
  const signals = byId(value.signals);
  const canonicalFindings = byId(value.canonicalFindings);
  const obligations = byId(value.obligations);
  const issues = byId(value.issues);
  const mutations = byId(value.issueMutations);
  const receipts = byId(value.issueReceipts);
  const extensions = byId(value.extensions);
  const exceptions = byId(value.exceptions);
  const remediations = byId(value.remediationEvidence);
  const verifications = byId(value.verifications);
  const nonQualifying = byId(value.nonQualifyingClosureSignals);
  const escalations = byId(value.escalations);
  const blockers = byId(value.blockers);
  const evidence = byId(value.evidence);

  const asOf = timestamp(options.asOf ?? value.run?.asOf);
  if (asOf === null || timestamp(value.run?.asOf) !== asOf) add("invalid_as_of", "run.asOf");
  const requiredSnapshotKinds = new Set([
    "program",
    "control-catalog",
    "sla-policy",
    "signal",
    "asset-owner-graph",
    "issue-tracker",
    "predecessor-checkpoint",
  ]);
  for (const snapshot of snapshots.values()) {
    if (
      snapshot.complete !== true ||
      !requiredSnapshotKinds.has(snapshot.kind) ||
      !DIGEST.test(snapshot.sourceRecordDigest ?? "") ||
      snapshot.completenessRoot !== computeSnapshotRoot(snapshot) ||
      timestamp(snapshot.capturedAt) === null ||
      timestamp(snapshot.capturedAt) > asOf ||
      !/^controlled:\/\/.+/u.test(snapshot.sourceUri ?? "")
    ) {
      add("invalid_snapshot", `snapshots.${snapshot.id}`, [snapshot.id]);
    }
  }
  for (const kind of requiredSnapshotKinds) {
    if (![...snapshots.values()].some((row) => row.kind === kind)) {
      add("missing_snapshot_kind", "snapshots", [kind]);
    }
  }
  if (
    !sameSet(
      value.run?.sourceSnapshotRoots,
      [...snapshots.values()].map((row) => row.completenessRoot),
    )
  ) {
    add("invalid_snapshot_totality", "run.sourceSnapshotRoots");
  }

  for (const principal of principals.values()) {
    if (
      !["human", "system", "claw"].includes(principal.kind) ||
      principal.authorityEvidenceRef === undefined ||
      !evidence.has(principal.authorityEvidenceRef)
    ) {
      add("invalid_principal", `principals.${principal.id}`, [principal.id]);
    }
  }
  if (principals.get(CLAW_PRINCIPAL)?.kind !== "claw") {
    add("missing_claw_principal", "principals", [CLAW_PRINCIPAL]);
  }
  for (const row of evidence.values()) {
    if (
      !principals.has(row.authorRef) ||
      timestamp(row.observedAt) === null ||
      timestamp(row.observedAt) > asOf ||
      !/^controlled:\/\/.+/u.test(row.sourceUri ?? "") ||
      !DIGEST.test(row.digest ?? "")
    ) {
      add("invalid_evidence_chronology", `evidence.${row.id}`, [row.id]);
    }
  }

  for (const control of controls.values()) {
    if (
      control.revision !== computeControlRevision(control) ||
      control.applicability !== "source-assigned" ||
      !slaRules.has(control.slaRuleRef) ||
      !snapshots.has(control.sourceRef)
    ) {
      add("invalid_control_binding", `controls.${control.id}`, [control.id]);
    }
  }
  for (const asset of assets.values()) {
    if (
      asset.revision !== computeAssetRevision(asset) ||
      !["repository", "service"].includes(asset.kind) ||
      !principals.has(asset.ownerRef) ||
      !principals.has(asset.teamRef) ||
      !snapshots.has(asset.sourceRef)
    ) {
      add("invalid_asset_owner_binding", `assets.${asset.id}`, [asset.id]);
    }
  }

  const signalGroups = new Map();
  for (const signal of signals.values()) {
    if (
      signal.revision !== computeSignalRevision(signal) ||
      !controls.has(signal.controlRef) ||
      !assets.has(signal.assetRef) ||
      !snapshots.has(signal.sourceRef) ||
      !evidence.has(signal.evidenceRef) ||
      timestamp(signal.observedAt) === null ||
      timestamp(signal.observedAt) > asOf
    ) {
      add("invalid_signal_binding", `signals.${signal.id}`, [signal.id]);
    }
    const list = signalGroups.get(signal.canonicalFindingKey) ?? [];
    list.push(signal.id);
    signalGroups.set(signal.canonicalFindingKey, list);
  }
  if (
    new Set([...signals.values()].map((row) => row.sourceIdentity)).size !== signals.size
  ) {
    add("duplicate_source_identity", "signals");
  }
  for (const canonical of canonicalFindings.values()) {
    const groupedSignals = rows(value.signals).filter(
      (row) => row.canonicalFindingKey === canonical.canonicalFindingKey,
    );
    const first = groupedSignals[0];
    if (
      groupedSignals.length === 0 ||
      !sameSet(
        canonical.sourceSignalRefs,
        groupedSignals.map((row) => row.id),
      ) ||
      groupedSignals.some(
        (row) =>
          row.controlRef !== canonical.controlRef ||
          row.assetRef !== canonical.assetRef ||
          row.findingRevision !== canonical.findingRevision,
      ) ||
      controls.get(canonical.controlRef)?.revision !== canonical.controlRevision ||
      assets.get(canonical.assetRef)?.revision !== canonical.assetRevision ||
      canonical.revision !== computeFindingRevision(canonical) ||
      first === undefined
    ) {
      add("invalid_signal_canonicalization", `canonicalFindings.${canonical.id}`, [canonical.id]);
    }
  }
  if (
    !sameSet(
      [...signalGroups.keys()],
      [...canonicalFindings.values()].map((row) => row.canonicalFindingKey),
    )
  ) {
    add("invalid_finding_totality", "canonicalFindings");
  }

  const obligationKeys = new Set();
  for (const obligation of obligations.values()) {
    const canonical = canonicalFindings.get(obligation.canonicalFindingRef);
    const control = controls.get(obligation.controlRef);
    const asset = assets.get(obligation.assetRef);
    const slaRule = slaRules.get(control?.slaRuleRef);
    const expectedKey = computeObligationKey(obligation);
    if (
      !canonical ||
      canonical.controlRef !== obligation.controlRef ||
      canonical.assetRef !== obligation.assetRef ||
      canonical.findingRevision !== obligation.findingRevision ||
      control?.revision !== obligation.controlRevision ||
      asset?.revision !== obligation.assetRevision ||
      obligation.obligationKey !== expectedKey ||
      obligation.revision !== computeObligationRevision(obligation) ||
      obligationKeys.has(expectedKey)
    ) {
      add("invalid_obligation_identity", `obligations.${obligation.id}`, [obligation.id]);
    }
    obligationKeys.add(expectedKey);
    if (
      !principals.has(obligation.ownerRef) ||
      asset?.ownerRef !== obligation.ownerRef ||
      asset?.teamRef !== obligation.teamRef
    ) {
      add("invalid_obligation_owner", `obligations.${obligation.id}`, [obligation.id]);
    }
    if (expectedSlaState(obligation, slaRule, asOf) !== obligation.slaState) {
      add("invalid_sla_state", `obligations.${obligation.id}.slaState`, [obligation.id]);
    }
    if (!exactRef(value.issues, obligation.issueRef)) {
      add("missing_exact_issue", `obligations.${obligation.id}.issueRef`, [obligation.id]);
    }
  }
  if (
    !sameSet(
      [...canonicalFindings.keys()],
      [...obligations.values()].map((row) => row.canonicalFindingRef),
    )
  ) {
    add("invalid_obligation_totality", "obligations");
  }

  const policy = value.issuePolicy;
  const expectedMutable = ["dueAt", "etaAt", "obligationState", "ownerRef", "slaState"];
  if (
    !isRecord(policy) ||
    policy.capability !== "issue-tracker-create-update" ||
    policy.programRef !== value.run?.programRef ||
    policy.destinationRef !== value.run?.issueDestinationRef ||
    !sameSet(policy.allowedOperations, ["create", "update"]) ||
    !sameSet(policy.mutableFieldAllowlist, expectedMutable) ||
    policy.ownerAuthoredContentPolicy !== "preserve-or-block" ||
    !DIGEST.test(policy.provenanceDigest ?? "") ||
    !sameSet(policy.approvedRepositoryRefs, [...assets.keys()]) ||
    policy.closeAllowed !== false
  ) {
    add("invalid_issue_policy", "issuePolicy");
  }
  const providerIds = new Set();
  for (const issue of issues.values()) {
    const obligation = obligations.get(issue.obligationRef);
    if (
      !obligation ||
      obligation.issueRef !== issue.id ||
      issue.destinationRef !== policy?.destinationRef ||
      issue.templateRef !== policy?.templateRef ||
      issue.routeRef !== policy?.routeRef ||
      !sameSet(issue.labels, policy?.allowedLabels) ||
      issue.idempotencyKey !== computeIssueIdempotencyKey(obligation, policy) ||
      issue.status !== "open" ||
      !DIGEST.test(issue.ownerContentDigest ?? "") ||
      !DIGEST.test(issue.revision ?? "") ||
      providerIds.has(issue.providerIssueId)
    ) {
      add("invalid_issue_binding", `issues.${issue.id}`, [issue.id]);
    }
    providerIds.add(issue.providerIssueId);
  }
  if (
    !sameSet(
      [...issues.values()].map((row) => row.obligationRef),
      [...obligations.keys()],
    )
  ) {
    add("invalid_issue_totality", "issues");
  }
  const expectedSnapshotIndices = new Map([
    ["program", [value.run?.programRef]],
    ["control-catalog", [...controls.keys()]],
    ["sla-policy", [...slaRules.keys()]],
    ["signal", [...signals.keys()]],
    ["asset-owner-graph", [...assets.keys()]],
    ["issue-tracker", [...issues.keys()]],
    ["predecessor-checkpoint", [value.predecessor?.checkpointId]],
  ]);
  for (const [kind, expected] of expectedSnapshotIndices) {
    const matches = [...snapshots.values()].filter((row) => row.kind === kind);
    if (
      matches.length !== 1 ||
      !sameSet(matches[0].indexRefs, expected.filter((item) => typeof item === "string"))
    ) {
      add("invalid_snapshot", `snapshots.${kind}`, expected);
    }
  }

  const mutationKeys = new Set();
  for (const mutation of mutations.values()) {
    const issue = issues.get(mutation.issueRef);
    const obligation = obligations.get(mutation.obligationRef);
    const allowedFields = new Set(policy?.mutableFieldAllowlist ?? []);
    const receipt = mutation.receiptRef ? receipts.get(mutation.receiptRef) : null;
    const mutationReceipts = [...receipts.values()].filter(
      (row) => row.mutationRef === mutation.id,
    );
    const proposedValues = isRecord(mutation.proposedValues) ? mutation.proposedValues : {};
    const expectedValues = expectedProposedValues(obligation, mutation.mutableFields);
    if (
      !issue ||
      !obligation ||
      issue.obligationRef !== obligation.id ||
      mutation.obligationRevision !== obligation.revision ||
      mutation.policyDigest !== computeIssuePolicyDigest(policy ?? {}) ||
      mutation.idempotencyKey !== issue.idempotencyKey ||
      mutation.destinationRef !== policy?.destinationRef ||
      mutation.templateRef !== policy?.templateRef ||
      mutation.routeRef !== policy?.routeRef ||
      !sameSet(mutation.labels, policy?.allowedLabels) ||
      values(mutation.mutableFields).some((field) => !allowedFields.has(field)) ||
      !sameSet(mutation.mutableFields, Object.keys(proposedValues)) ||
      Object.entries(expectedValues).some(
        ([field, expected]) => proposedValues[field] !== expected,
      ) ||
      mutation.previewDigest !== computeIssueMutationPreview(mutation) ||
      mutationKeys.has(mutation.idempotencyKey)
    ) {
      add("invalid_issue_mutation", `issueMutations.${mutation.id}`, [mutation.id]);
    }
    mutationKeys.add(mutation.idempotencyKey);
    if (!issue || !obligation) continue;
    const ownerConflict = mutation.expectedOwnerContentDigest !== issue.ownerContentDigest;
    if (ownerConflict) {
      if (
        mutation.conflictState !== "owner-content-conflict" ||
        mutation.state !== "blocked" ||
        mutation.receiptRef !== null ||
        mutation.expectedIssueRevision !== issue.revision ||
        mutationReceipts.length !== 0
      ) {
        add("owner_content_overwrite", `issueMutations.${mutation.id}`, [mutation.id]);
      }
      continue;
    }
    const priorReceipt = receipt?.priorReceiptRef
      ? receipts.get(receipt.priorReceiptRef)
      : null;
    const commonReceiptInvalid =
      mutation.conflictState !== "none" ||
      !receipt ||
      receipt.idempotencyKey !== mutation.idempotencyKey ||
      receipt.issueRef !== issue.id ||
      receipt.operation !== mutation.operation ||
      receipt.mutationRef !== mutation.id ||
      receipt.providerIssueId !== issue.providerIssueId ||
      receipt.afterRevision !== issue.revision ||
      receipt.external !== true ||
      receipt.resultDigest !== computeIssueReceiptResultDigest(receipt) ||
      timestamp(receipt.observedAt) === null ||
      timestamp(receipt.observedAt) > asOf;
    const appliedInvalid =
      mutation.state === "applied" &&
      (receipt?.replayed !== false ||
        receipt?.priorReceiptRef !== null ||
        mutation.expectedIssueRevision !== receipt?.beforeRevision ||
        (mutation.operation === "create" && receipt?.beforeRevision !== null) ||
        (mutation.operation === "update" && receipt?.beforeRevision === null) ||
        mutationReceipts.length !== 1);
    const replayInvalid =
      mutation.state === "idempotent-replay" &&
      (!priorReceipt ||
        receipt?.replayed !== true ||
        priorReceipt.replayed !== false ||
        priorReceipt.priorReceiptRef !== null ||
        priorReceipt.mutationRef !== mutation.id ||
        priorReceipt.issueRef !== receipt?.issueRef ||
        priorReceipt.operation !== receipt?.operation ||
        priorReceipt.idempotencyKey !== receipt?.idempotencyKey ||
        priorReceipt.providerIssueId !== receipt?.providerIssueId ||
        priorReceipt.afterRevision !== receipt?.beforeRevision ||
        priorReceipt.afterRevision !== receipt?.afterRevision ||
        priorReceipt.resultDigest !== receipt?.resultDigest ||
        priorReceipt.resultDigest !== computeIssueReceiptResultDigest(priorReceipt) ||
        mutation.expectedIssueRevision !== priorReceipt.beforeRevision ||
        timestamp(priorReceipt.observedAt) === null ||
        timestamp(priorReceipt.observedAt) >= timestamp(receipt?.observedAt) ||
        mutationReceipts.length !== 2 ||
        mutationReceipts.some(
          (row) => row.id !== receipt?.id && row.id !== priorReceipt.id,
        ));
    if (
      commonReceiptInvalid ||
      !["applied", "idempotent-replay"].includes(mutation.state) ||
      appliedInvalid ||
      replayInvalid
    ) {
      add("invalid_issue_receipt", `issueMutations.${mutation.id}`, [mutation.id]);
    }
  }
  for (const receipt of receipts.values()) {
    const mutation = mutations.get(receipt.mutationRef);
    const issue = issues.get(receipt.issueRef);
    if (
      !mutation ||
      !issue ||
      mutation.issueRef !== receipt.issueRef ||
      mutation.operation !== receipt.operation ||
      mutation.idempotencyKey !== receipt.idempotencyKey ||
      issue.providerIssueId !== receipt.providerIssueId ||
      receipt.external !== true ||
      timestamp(receipt.observedAt) === null ||
      timestamp(receipt.observedAt) > asOf ||
      receipt.resultDigest !== computeIssueReceiptResultDigest(receipt) ||
      (receipt.replayed === false && receipt.priorReceiptRef !== null) ||
      (receipt.replayed === true && !receipts.has(receipt.priorReceiptRef))
    ) {
      add("invalid_issue_receipt", `issueReceipts.${receipt.id}`, [receipt.id]);
    }
  }

  for (const record of [...extensions.values(), ...exceptions.values()]) {
    const obligation = obligations.get(record.obligationRef);
    const expectedRole = record.kind === "extension" ? "extension-authority" : "exception-authority";
    if (
      !obligation ||
      record.controlRef !== obligation.controlRef ||
      record.controlRevision !== obligation.controlRevision ||
      record.assetRef !== obligation.assetRef ||
      record.assetRevision !== obligation.assetRevision ||
      record.issueRef !== obligation.issueRef ||
      record.scopeDigest !== computeAuthorityScopeDigest(record) ||
      !authorityIsIndependent(principals, record.authorityRef, obligation.ownerRef, expectedRole) ||
      timestamp(record.approvedAt) === null ||
      timestamp(record.expiresAt) === null ||
      timestamp(record.approvedAt) >= timestamp(record.expiresAt) ||
      timestamp(record.expiresAt) <= asOf ||
      record.state !== "active" ||
      evidence.get(record.evidenceRef)?.authorRef !== record.authorityRef ||
      timestamp(evidence.get(record.evidenceRef)?.observedAt) !== timestamp(record.approvedAt)
    ) {
      add("invalid_scoped_authority", `${record.kind}s.${record.id}`, [record.id]);
    }
  }

  for (const obligation of obligations.values()) {
    if (
      obligation.extensionRef !== null &&
      extensions.get(obligation.extensionRef)?.obligationRef !== obligation.id
    ) {
      add("invalid_scoped_authority", `obligations.${obligation.id}.extensionRef`, [obligation.id]);
    }
    if (
      obligation.exceptionRef !== null &&
      exceptions.get(obligation.exceptionRef)?.obligationRef !== obligation.id
    ) {
      add("invalid_scoped_authority", `obligations.${obligation.id}.exceptionRef`, [obligation.id]);
    }
    if (obligation.state === "verified") {
      const remediation = remediations.get(obligation.remediationEvidenceRef);
      const verification = verifications.get(obligation.verificationRef);
      if (
        !remediation ||
        !verification ||
        remediation.obligationRef !== obligation.id ||
        remediation.controlRevision !== obligation.controlRevision ||
        remediation.assetRevision !== obligation.assetRevision ||
        remediation.issueRevision !== issues.get(obligation.issueRef)?.revision ||
        verification.remediationEvidenceRef !== remediation.id ||
        verification.obligationRevision !== obligation.revision ||
        verification.controlRevision !== obligation.controlRevision ||
        verification.assetRevision !== obligation.assetRevision ||
        verification.issueRevision !== issues.get(obligation.issueRef)?.revision ||
        verification.authorRef === remediation.authorRef ||
        verification.authorRef === obligation.ownerRef ||
        verification.authorRef === CLAW_PRINCIPAL ||
        principals.get(verification.authorRef)?.role !== "independent-verifier" ||
        verification.outcome !== "verified" ||
        evidence.get(remediation.evidenceRef)?.authorRef !== remediation.authorRef ||
        evidence.get(verification.evidenceRef)?.authorRef !== verification.authorRef ||
        timestamp(evidence.get(remediation.evidenceRef)?.observedAt) !==
          timestamp(remediation.authoredAt) ||
        timestamp(evidence.get(verification.evidenceRef)?.observedAt) !==
          timestamp(verification.verifiedAt) ||
        timestamp(remediation.authoredAt) >= timestamp(verification.verifiedAt)
      ) {
        add("invalid_independent_verification", `obligations.${obligation.id}`, [obligation.id]);
      }
    } else if (obligation.verificationRef !== null) {
      add("invalid_verification_state", `obligations.${obligation.id}`, [obligation.id]);
    }
    if (obligation.state === "reopened") {
      const predecessor = rows(value.predecessor?.obligations).find(
        (row) => row.obligationRef === obligation.reopenOfObligationRef,
      );
      if (
        !predecessor ||
        predecessor.state !== "verified" ||
        predecessor.controlRef !== obligation.controlRef ||
        predecessor.assetRef !== obligation.assetRef ||
        predecessor.obligationKey === obligation.obligationKey ||
        !["control-revision", "asset-revision", "finding-revision"].includes(
          obligation.reopenReason,
        )
      ) {
        add("invalid_revision_reopen", `obligations.${obligation.id}`, [obligation.id]);
      }
    }
  }
  for (const signal of nonQualifying.values()) {
    if (
      !["pull-request-merge", "passing-check", "scanner-status", "incident-recovery"].includes(
        signal.kind,
      ) ||
      !obligations.has(signal.obligationRef) ||
      signal.closureEffect !== "none" ||
      !evidence.has(signal.evidenceRef)
    ) {
      add("invalid_nonqualifying_closure_signal", `nonQualifyingClosureSignals.${signal.id}`, [
        signal.id,
      ]);
    }
  }

  const expectedEscalations = [];
  for (const obligation of obligations.values()) {
    for (const category of expectedEscalationCategories(obligation)) {
      expectedEscalations.push(`${obligation.id}:${category}`);
    }
  }
  for (const escalation of escalations.values()) {
    const obligation = obligations.get(escalation.obligationRef);
    if (
      !obligation ||
      escalation.controlRef !== obligation.controlRef ||
      escalation.controlRevision !== obligation.controlRevision ||
      escalation.assetRef !== obligation.assetRef ||
      escalation.assetRevision !== obligation.assetRevision ||
      escalation.issueRef !== obligation.issueRef ||
      escalation.scopeDigest !== computeAuthorityScopeDigest(escalation) ||
      !expectedEscalationCategories(obligation).includes(escalation.category) ||
      escalation.routeRef !== value.escalationPolicy?.routes?.[escalation.category] ||
      escalation.dedupeKey !==
        digest({
          policyRevision: value.escalationPolicy?.revision,
          scopeDigest: escalation.scopeDigest,
          category: escalation.category,
        }) ||
      !["queued", "dispatched"].includes(escalation.state) ||
      escalation.approvalEffect !== "none"
    ) {
      add("invalid_escalation", `escalations.${escalation.id}`, [escalation.id]);
    }
  }
  if (
    !sameSet(
      expectedEscalations,
      [...escalations.values()].map((row) => `${row.obligationRef}:${row.category}`),
    )
  ) {
    add("invalid_escalation_totality", "escalations");
  }

  const predecessorIds = new Set(rows(value.predecessor?.obligations).map((row) => row.obligationRef));
  const deltaRefs = [
    ...rows(value.delta?.entries).map((row) => row.obligationRef),
    ...values(value.delta?.unchangedRefs),
  ];
  if (
    value.run?.predecessorCheckpointRef !== value.predecessor?.checkpointId ||
    value.delta?.predecessorCheckpointRef !== value.predecessor?.checkpointId ||
    !sameSet(deltaRefs, [...obligations.keys()]) ||
    rows(value.delta?.entries).some((row) => {
      const obligation = obligations.get(row.obligationRef);
      if (!obligation) return true;
      if (row.kind === "opened") return row.beforeRevision !== null || predecessorIds.has(row.obligationRef);
      if (row.kind === "reopened") {
        return (
          row.beforeRevision === null ||
          row.afterRevision !== obligation.revision ||
          !predecessorIds.has(obligation.reopenOfObligationRef)
        );
      }
      return (
        !predecessorIds.has(row.obligationRef) ||
        row.afterRevision !== obligation.revision ||
        row.beforeRevision === null
      );
    })
  ) {
    add("invalid_checkpoint_delta", "delta");
  }

  const expectedCoverage = {
    snapshotRefs: [...snapshots.keys()],
    controlRefs: [...controls.keys()],
    assetRefs: [...assets.keys()],
    signalRefs: [...signals.keys()],
    canonicalFindingRefs: [...canonicalFindings.keys()],
    obligationRefs: [...obligations.keys()],
    issueRefs: [...issues.keys()],
  };
  for (const [field, expected] of Object.entries(expectedCoverage)) {
    if (!sameSet(value.coverage?.[field], expected)) {
      add("invalid_coverage", `coverage.${field}`);
    }
  }

  for (const blocker of blockers.values()) {
    if (
      !["open", "resolved"].includes(blocker.state) ||
      blocker.ownerRef === CLAW_PRINCIPAL ||
      !principals.has(blocker.ownerRef) ||
      values(blocker.subjectRefs).length === 0
    ) {
      add("invalid_blocker", `blockers.${blocker.id}`, [blocker.id]);
    }
  }
  for (const obligation of obligations.values()) {
    if (values(obligation.blockerRefs).some((ref) => !blockers.has(ref))) {
      add("invalid_blocker_reference", `obligations.${obligation.id}.blockerRefs`, [obligation.id]);
    }
  }

  const authority = value.authority;
  const requiredNonClaims = [
    "severityAssignment",
    "applicabilityDecision",
    "codeChange",
    "settingsChange",
    "findingSuppression",
    "exceptionApproval",
    "extensionApproval",
    "riskAcceptance",
    "issueClosure",
    "remediation",
    "complianceClaim",
    "certification",
  ];
  if (
    !isRecord(authority) ||
    requiredNonClaims.some((field) => authority[field] !== "not-claimed") ||
    authority.issueMutation !== "approved-create-update-receipts-only"
  ) {
    add("invalid_authority_claim", "authority");
  }
  if (narrativeTexts(value).some((text) => FORBIDDEN_NARRATIVE.test(text))) {
    add("prohibited_narrative_claim", "$");
  }

  const openBlockers = [...blockers.values()].filter((row) => row.state === "open").map((row) => row.id);
  if (
    value.handoff?.destination !== "private-repository-compliance-handoff" ||
    value.handoff?.published !== false ||
    value.handoff?.ownerRef === CLAW_PRINCIPAL ||
    !principals.has(value.handoff?.ownerRef) ||
    !sameSet(value.handoff?.blockerRefs, openBlockers) ||
    value.handoff?.state !== (openBlockers.length === 0 ? "ready-for-owner-review" : "blocked") ||
    value.handoff?.checkpointDigest !== computeCheckpointDigest(value) ||
    value.run?.currentCheckpointDigest !== value.handoff?.checkpointDigest
  ) {
    add("invalid_private_handoff", "handoff");
  }

  return findings.sort(
    (left, right) => compare(left.code, right.code) || compare(left.path, right.path),
  );
}

export function resealRepositoryComplianceArtifact(value) {
  const output = structuredClone(value);
  for (const snapshot of rows(output.snapshots)) {
    snapshot.completenessRoot = computeSnapshotRoot(snapshot);
  }
  for (const control of rows(output.controls)) {
    control.revision = computeControlRevision(control);
  }
  for (const asset of rows(output.assets)) {
    asset.revision = computeAssetRevision(asset);
  }
  for (const signal of rows(output.signals)) {
    signal.revision = computeSignalRevision(signal);
  }
  const controls = byId(output.controls);
  const assets = byId(output.assets);
  for (const row of rows(output.canonicalFindings)) {
    row.controlRevision = controls.get(row.controlRef)?.revision ?? row.controlRevision;
    row.assetRevision = assets.get(row.assetRef)?.revision ?? row.assetRevision;
    row.revision = computeFindingRevision(row);
  }
  const canonicalFindings = byId(output.canonicalFindings);
  for (const row of rows(output.obligations)) {
    const canonical = canonicalFindings.get(row.canonicalFindingRef);
    if (canonical) {
      row.controlRevision = canonical.controlRevision;
      row.assetRevision = canonical.assetRevision;
      row.findingRevision = canonical.findingRevision;
    }
    row.obligationKey = computeObligationKey(row);
    row.revision = computeObligationRevision(row);
  }
  const obligations = byId(output.obligations);
  for (const issue of rows(output.issues)) {
    const obligation = obligations.get(issue.obligationRef);
    if (obligation) {
      issue.idempotencyKey = computeIssueIdempotencyKey(obligation, output.issuePolicy);
    }
  }
  const issues = byId(output.issues);
  for (const mutation of rows(output.issueMutations)) {
    const issue = issues.get(mutation.issueRef);
    const obligation = obligations.get(mutation.obligationRef);
    if (issue) mutation.idempotencyKey = issue.idempotencyKey;
    if (obligation) mutation.obligationRevision = obligation.revision;
    mutation.policyDigest = computeIssuePolicyDigest(output.issuePolicy ?? {});
    mutation.previewDigest = computeIssueMutationPreview(mutation);
  }
  for (const receipt of rows(output.issueReceipts)) {
    const issue = issues.get(receipt.issueRef);
    if (issue) receipt.idempotencyKey = issue.idempotencyKey;
    receipt.resultDigest = computeIssueReceiptResultDigest(receipt);
  }
  for (const record of [...rows(output.extensions), ...rows(output.exceptions)]) {
    record.scopeDigest = computeAuthorityScopeDigest(record);
  }
  for (const remediation of rows(output.remediationEvidence)) {
    const obligation = obligations.get(remediation.obligationRef);
    const issue = issues.get(obligation?.issueRef);
    if (obligation && issue) {
      remediation.controlRevision = obligation.controlRevision;
      remediation.assetRevision = obligation.assetRevision;
      remediation.issueRevision = issue.revision;
    }
  }
  const resealedObligations = byId(output.obligations);
  for (const verification of rows(output.verifications)) {
    const obligation = resealedObligations.get(verification.obligationRef);
    const issue = issues.get(obligation?.issueRef);
    if (obligation && issue) {
      verification.obligationRevision = obligation.revision;
      verification.controlRevision = obligation.controlRevision;
      verification.assetRevision = obligation.assetRevision;
      verification.issueRevision = issue.revision;
    }
  }
  for (const escalation of rows(output.escalations)) {
    escalation.scopeDigest = computeAuthorityScopeDigest(escalation);
    escalation.dedupeKey = digest({
      policyRevision: output.escalationPolicy?.revision,
      scopeDigest: escalation.scopeDigest,
      category: escalation.category,
    });
  }
  output.run.sourceSnapshotRoots = rows(output.snapshots).map((row) => row.completenessRoot);
  output.coverage = {
    snapshotRefs: rows(output.snapshots).map((row) => row.id),
    controlRefs: rows(output.controls).map((row) => row.id),
    assetRefs: rows(output.assets).map((row) => row.id),
    signalRefs: rows(output.signals).map((row) => row.id),
    canonicalFindingRefs: rows(output.canonicalFindings).map((row) => row.id),
    obligationRefs: rows(output.obligations).map((row) => row.id),
    issueRefs: rows(output.issues).map((row) => row.id),
  };
  for (const entry of rows(output.delta?.entries)) {
    const obligation = resealedObligations.get(entry.obligationRef);
    if (obligation) entry.afterRevision = obligation.revision;
  }
  output.run.currentCheckpointDigest = null;
  output.handoff.checkpointDigest = null;
  const checkpointDigest = computeCheckpointDigest(output);
  output.run.currentCheckpointDigest = checkpointDigest;
  output.handoff.checkpointDigest = checkpointDigest;
  return output;
}
