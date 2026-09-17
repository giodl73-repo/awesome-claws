import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "awesomeClaws.securityAlertReviewCandidate.v1";
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const CONTROLLED_URI = /^controlled:\/\/[^/?#]+\/[^?#]+$/u;
const ZONED_TIMESTAMP =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?(?:Z|[+-]([0-9]{2}):([0-9]{2}))$/u;
const BARE_HUMAN_ROLE =
  /^(?:security(?: team| analyst| engineer| owner| operations team)?|incident response|alert owner|reviewer|approver|the owner)$/iu;
const GROUP_HUMAN_LABEL = /\b(?:team|group|committee|department|operations)\b/iu;
const DIRECTORY_PERSON = /^directory:\/\/people\/[^/?#]+$/u;
const DISPOSITION_GRANT = Object.freeze({
  "false-positive": "record-false-positive",
  duplicate: "record-duplicate",
  "incident-review-escalation": "request-incident-review",
});
const AUTHORITY = Object.freeze({
  siemQuery: "not-performed",
  correlationInference: "not-performed",
  severityInference: "not-performed",
  sourceSuppression: "not-performed",
  sourceClosure: "not-performed",
  containment: "not-performed",
  incidentDeclaration: "not-performed",
  ticketMutation: "not-performed",
  riskAcceptance: "not-claimed",
  securityClaim: "not-claimed",
});

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
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function sorted(value) {
  return [...values(value)].sort(compare);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compare)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function alertKey(alert) {
  return canonicalJson([alert?.source, alert?.nativeAlertId, alert?.revision]);
}

export function computeSnapshotRoot(snapshot) {
  return digest({
    id: snapshot?.id,
    revision: snapshot?.revision,
    capturedAt: snapshot?.capturedAt,
    suppliedByRef: snapshot?.suppliedByRef,
    complete: snapshot?.complete,
    alerts: rows(snapshot?.alerts)
      .map((alert) => ({
        id: alert.id,
        source: alert.source,
        nativeAlertId: alert.nativeAlertId,
        revision: alert.revision,
        supersedesRevision: alert.supersedesRevision,
        detectorRef: alert.detectorRef,
        sourceState: alert.sourceState,
        sourceSeverity: alert.sourceSeverity,
        assetIdentityState: alert.assetIdentityState,
        assetRef: alert.assetRef,
        ownerRef: alert.ownerRef,
        observedAt: alert.observedAt,
        evidenceRef: alert.evidenceRef,
      }))
      .sort((left, right) => compare(alertKey(left), alertKey(right))),
  });
}

export function computePolicyDigest(policy) {
  return digest({
    id: policy?.id,
    revision: policy?.revision,
    effectiveAt: policy?.effectiveAt,
    suppliedByRef: policy?.suppliedByRef,
    trustInputRefs: sorted(policy?.trustInputRefs),
    trustInputDigests: sorted(policy?.trustInputDigests),
    detectorRules: rows(policy?.detectorRules)
      .map((rule) => ({
        id: rule.id,
        source: rule.source,
        category: rule.category,
        reviewRequired: rule.reviewRequired,
        allowedDispositionKinds: sorted(rule.allowedDispositionKinds),
      }))
      .sort((left, right) => compare(left.id, right.id)),
  });
}

export function computePublicTrustDigest(record) {
  return digest({
    id: record?.id,
    kind: record?.kind,
    publisher: record?.publisher,
    source: record?.source,
    uri: record?.uri,
    retrievedAt: record?.retrievedAt,
    contentDigest: record?.contentDigest,
    authorityEffect: record?.authorityEffect,
  });
}

export function computeEvidenceRoot(evidence) {
  return digest(
    rows(evidence)
      .map((record) => ({
        id: record.id,
        kind: record.kind,
        authorRef: record.authorRef,
        observedAt: record.observedAt,
        controlledUri: record.controlledUri,
        contentDigest: record.contentDigest,
        subjectRefs: sorted(record.subjectRefs),
        subjectDigest: record.subjectDigest,
      }))
      .sort((left, right) => compare(left.id, right.id)),
  );
}

export function computeGrantDigest(grant) {
  return digest({
    id: grant?.id,
    type: grant?.type,
    granteeRef: grant?.granteeRef,
    issuedByRef: grant?.issuedByRef,
    source: grant?.source,
    detectorRefs: sorted(grant?.detectorRefs),
    issuedAt: grant?.issuedAt,
    validFrom: grant?.validFrom,
    validUntil: grant?.validUntil,
    policyRevisionDigest: grant?.policyRevisionDigest,
  });
}

export function computePrincipalRosterDigest(roster, principals) {
  return digest({
    id: roster?.id,
    revision: roster?.revision,
    capturedAt: roster?.capturedAt,
    suppliedByRef: roster?.suppliedByRef,
    principals: rows(principals)
      .map((principal) => ({
        id: principal.id,
        kind: principal.kind,
        identityKind: principal.identityKind,
        name: principal.name,
        directoryObjectRef: principal.directoryObjectRef,
        scopes: sorted(principal.scopes),
      }))
      .sort((left, right) => compare(left.id, right.id)),
  });
}

export function computeDuplicateGroupDigest(group) {
  return digest({
    id: group?.id,
    source: group?.source,
    detectorRef: group?.detectorRef,
    memberAlertKeys: sorted(group?.memberAlertKeys),
    primaryAlertKey: group?.primaryAlertKey,
    declaredByRef: group?.declaredByRef,
    declaredAt: group?.declaredAt,
    grantRef: group?.grantRef,
  });
}

export function computeSuppressionAttemptDigest(attempt) {
  return digest({
    id: attempt?.id,
    alertKey: attempt?.alertKey,
    requestedByRef: attempt?.requestedByRef,
    requestedAt: attempt?.requestedAt,
    requestedAction: attempt?.requestedAction,
  });
}

export function computePriorDecisionDigest(decision) {
  return digest({
    id: decision?.id,
    source: decision?.source,
    nativeAlertId: decision?.nativeAlertId,
    revision: decision?.revision,
    detectorRef: decision?.detectorRef,
    alertKey: decision?.alertKey,
    policyRevisionDigest: decision?.policyRevisionDigest,
    outcome: decision?.outcome,
    decidedByRef: decision?.decidedByRef,
    decidedAt: decision?.decidedAt,
    grantRef: decision?.grantRef,
    invalidatedByAlertKey: decision?.invalidatedByAlertKey,
  });
}

export function computeReviewRecordDigest(record) {
  return digest({
    id: record?.id,
    alertKey: record?.alertKey,
    snapshotRoot: record?.snapshotRoot,
    policyRevisionDigest: record?.policyRevisionDigest,
    kind: record?.kind,
    disposition: record?.disposition,
    nonDecision: record?.nonDecision,
    decidedByRef: record?.decidedByRef,
    recordedAt: record?.recordedAt,
    grantRef: record?.grantRef,
    duplicateGroupRef: record?.duplicateGroupRef,
    incidentEscalationRef: record?.incidentEscalationRef,
  });
}

export function computeIncidentEscalationDigest(escalation) {
  return digest({
    id: escalation?.id,
    alertKey: escalation?.alertKey,
    requestedByRef: escalation?.requestedByRef,
    requestedAt: escalation?.requestedAt,
    grantRef: escalation?.grantRef,
    incidentOwnerRef: escalation?.incidentOwnerRef,
    state: escalation?.state,
    incidentRef: escalation?.incidentRef,
    declarationEffect: escalation?.declarationEffect,
  });
}

function timestamp(value) {
  const match = typeof value === "string" ? ZONED_TIMESTAMP.exec(value) : null;
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHour,
    offsetMinute,
  ] = match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetHour !== undefined &&
      (Number(offsetHour) > 23 || Number(offsetMinute) > 59))
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function byId(value) {
  return new Map(
    rows(value)
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, row]),
  );
}

function uniqueIds(value) {
  if (!Array.isArray(value) || value.some((row) => !isRecord(row))) return false;
  const ids = value.map((row) => row.id);
  return ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length;
}

function sameSet(actual, expected) {
  const left = sorted(actual);
  const right = sorted(expected);
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item, index) => item === right[index])
  );
}

function isNamedHuman(principal) {
  return (
    principal?.kind === "named-human" &&
    principal?.identityKind === "person" &&
    typeof principal.name === "string" &&
    principal.name.trim().includes(" ") &&
    !BARE_HUMAN_ROLE.test(principal.name.trim()) &&
    !GROUP_HUMAN_LABEL.test(principal.name.trim()) &&
    DIRECTORY_PERSON.test(principal.directoryObjectRef ?? "")
  );
}

function sameHuman(left, right) {
  return (
    isNamedHuman(left) &&
    isNamedHuman(right) &&
    left.directoryObjectRef === right.directoryObjectRef
  );
}

function grantIsActive(grant, instant) {
  const at = timestamp(instant);
  const from = timestamp(grant?.validFrom);
  const until = timestamp(grant?.validUntil);
  return at !== null && from !== null && until !== null && from <= at && at < until;
}

function grantCovers(grant, principalRef, type, alert, policyDigest, instant) {
  return (
    grant?.granteeRef === principalRef &&
    grant?.type === type &&
    grant?.source === alert?.source &&
    values(grant?.detectorRefs).includes(alert?.detectorRef) &&
    grant?.policyRevisionDigest === policyDigest &&
    grantIsActive(grant, instant)
  );
}

function evidenceSupports(
  evidence,
  { kind, authorRef, observedAt, subjectRef, subjectRefs, subjectDigest },
) {
  const expectedSubjectRefs = subjectRefs ?? [subjectRef];
  return (
    evidence?.kind === kind &&
    evidence?.authorRef === authorRef &&
    timestamp(evidence?.observedAt) === timestamp(observedAt) &&
    sameSet(evidence?.subjectRefs, expectedSubjectRefs) &&
    evidence?.subjectDigest === subjectDigest
  );
}

function finding(code, path, refs = []) {
  return { code, path, refs: sorted(refs) };
}

function findingOrder(left, right) {
  return (
    compare(left.code, right.code) ||
    compare(left.path, right.path) ||
    compare(canonicalJson(left.refs), canonicalJson(right.refs))
  );
}

export function securityAlertReviewFindings(value, options = {}) {
  if (!isRecord(value)) {
    return [finding("invalid_artifact", "$")];
  }

  const findings = [];
  const add = (code, path, refs = []) => findings.push(finding(code, path, refs));
  if (value.schemaVersion !== SCHEMA_VERSION) {
    add("invalid_schema_version", "schemaVersion");
  }

  const asOf = timestamp(options.asOf);
  if (asOf === null || timestamp(value.asOf) !== asOf) {
    add("invalid_as_of", "asOf");
    return findings.sort(findingOrder);
  }

  const collectionNames = [
    "publicTrustInputs",
    "principals",
    "grants",
    "evidence",
    "duplicateGroups",
    "suppressionAttempts",
    "priorDecisions",
    "reviewRecords",
    "incidentEscalations",
  ];
  for (const name of collectionNames) {
    if (!uniqueIds(value[name])) add("invalid_identity_set", name);
  }
  if (!uniqueIds(value.snapshot?.alerts)) {
    add("invalid_identity_set", "snapshot.alerts");
  }
  if (!uniqueIds(value.detectorPolicy?.detectorRules)) {
    add("invalid_identity_set", "detectorPolicy.detectorRules");
  }
  const identityCounts = new Map();
  for (const id of [
    value.artifactId,
    value.snapshot?.id,
    value.detectorPolicy?.id,
    value.principalRoster?.id,
    ...collectionNames.flatMap((name) => rows(value[name]).map((row) => row.id)),
    ...rows(value.snapshot?.alerts).map((row) => row.id),
    ...rows(value.detectorPolicy?.detectorRules).map((row) => row.id),
  ]) {
    if (typeof id === "string") {
      identityCounts.set(id, (identityCounts.get(id) ?? 0) + 1);
    }
  }
  for (const [id, count] of identityCounts) {
    if (count > 1) add("duplicate_global_identity", "identities", [id]);
  }

  const principals = byId(value.principals);
  const evidence = byId(value.evidence);
  const grants = byId(value.grants);
  const trustInputs = byId(value.publicTrustInputs);
  const alerts = byId(value.snapshot?.alerts);
  const detectorRules = byId(value.detectorPolicy?.detectorRules);
  const duplicateGroups = byId(value.duplicateGroups);
  const suppressionAttempts = byId(value.suppressionAttempts);
  const priorDecisions = byId(value.priorDecisions);
  const reviewRecords = byId(value.reviewRecords);
  const escalations = byId(value.incidentEscalations);

  for (const principal of principals.values()) {
    const identityShape =
      (principal.kind === "named-human" &&
        principal.identityKind === "person" &&
        DIRECTORY_PERSON.test(principal.directoryObjectRef ?? "")) ||
      (principal.kind === "system" && principal.identityKind === "system") ||
      (principal.kind === "claw" && principal.identityKind === "agent");
    if (
      !["named-human", "system", "claw"].includes(principal.kind) ||
      typeof principal.name !== "string" ||
      !Array.isArray(principal.scopes) ||
      !identityShape
    ) {
      add("invalid_principal", `principals.${principal.id}`, [principal.id]);
    }
    if (principal.kind === "named-human" && !isNamedHuman(principal)) {
      add("bare_role_principal", `principals.${principal.id}.name`, [principal.id]);
    }
  }
  const humanDirectoryRefs = [...principals.values()]
    .filter((principal) => principal.kind === "named-human")
    .map((principal) => principal.directoryObjectRef);
  if (
    humanDirectoryRefs.some((ref) => typeof ref !== "string") ||
    new Set(humanDirectoryRefs).size !== humanDirectoryRefs.length
  ) {
    add("duplicate_human_identity", "principals");
  }

  for (const row of evidence.values()) {
    if (
      !principals.has(row.authorRef) ||
      timestamp(row.observedAt) === null ||
      asOf === null ||
      timestamp(row.observedAt) > asOf ||
      !CONTROLLED_URI.test(row.controlledUri ?? "") ||
      !DIGEST.test(row.contentDigest ?? "") ||
      !DIGEST.test(row.subjectDigest ?? "") ||
      !Array.isArray(row.subjectRefs) ||
      row.subjectRefs.length === 0
    ) {
      add("invalid_evidence", `evidence.${row.id}`, [row.id]);
    }
  }
  const evidenceRoot = computeEvidenceRoot(value.evidence);
  if (
    value.evidenceRoot !== evidenceRoot ||
    options.evidenceRoot !== evidenceRoot
  ) {
    add("invalid_evidence_root", "evidenceRoot");
  }

  const rosterDigest = computePrincipalRosterDigest(value.principalRoster, value.principals);
  const rosterEvidence = evidence.get(value.principalRoster?.evidenceRef);
  if (
    !isRecord(value.principalRoster) ||
    value.principalRoster.digest !== rosterDigest ||
    options.principalRosterDigest !== rosterDigest ||
    !sameSet(value.principalRoster.principalRefs, [...principals.keys()]) ||
    !isNamedHuman(principals.get(value.principalRoster.suppliedByRef)) ||
    !values(
      principals.get(value.principalRoster.suppliedByRef)?.scopes,
    ).includes("supply-principal-roster") ||
    timestamp(value.principalRoster.capturedAt) === null ||
    timestamp(value.principalRoster.capturedAt) >
      timestamp(value.detectorPolicy?.effectiveAt) ||
    timestamp(value.principalRoster.capturedAt) >
      timestamp(value.snapshot?.capturedAt) ||
    [...alerts.values()].some(
      (alert) =>
        timestamp(value.principalRoster.capturedAt) > timestamp(alert.observedAt),
    ) ||
    timestamp(value.principalRoster.capturedAt) > asOf ||
    !evidenceSupports(rosterEvidence, {
      kind: "principal-authority-roster",
      authorRef: value.principalRoster.suppliedByRef,
      observedAt: value.principalRoster.capturedAt,
      subjectRef: value.principalRoster.id,
      subjectDigest: rosterDigest,
    })
  ) {
    add("invalid_principal_roster_trust", "principalRoster");
  }

  const policyDigest = computePolicyDigest(value.detectorPolicy);
  const policySupplier = principals.get(value.detectorPolicy?.suppliedByRef);
  const policyEvidence = evidence.get(value.detectorPolicy?.evidenceRef);
  if (
    !isRecord(value.detectorPolicy) ||
    value.detectorPolicy.revisionDigest !== policyDigest ||
    !isNamedHuman(policySupplier) ||
    !values(policySupplier?.scopes).includes("supply-detector-policy") ||
    timestamp(value.detectorPolicy.effectiveAt) === null ||
    asOf === null ||
    timestamp(value.detectorPolicy.effectiveAt) > asOf ||
    !evidenceSupports(policyEvidence, {
      kind: "detector-policy-revision",
      authorRef: value.detectorPolicy.suppliedByRef,
      observedAt: value.detectorPolicy.effectiveAt,
      subjectRef: value.detectorPolicy.id,
      subjectDigest: policyDigest,
    })
  ) {
    add("invalid_detector_policy", "detectorPolicy");
  }

  const trustSources = new Map();
  const policySources = new Set(
    [...detectorRules.values()].map((rule) => rule.source),
  );
  for (const trust of trustInputs.values()) {
    const valid =
      trust.kind === "public-detector-contract" &&
      typeof trust.uri === "string" &&
      trust.uri.startsWith("https://") &&
      timestamp(trust.retrievedAt) !== null &&
      asOf !== null &&
      timestamp(trust.retrievedAt) <= asOf &&
      timestamp(trust.retrievedAt) <=
        timestamp(value.detectorPolicy?.effectiveAt) &&
      policySources.has(trust.source) &&
      DIGEST.test(trust.contentDigest ?? "") &&
      trust.authorityEffect === "context-only" &&
      trust.recordDigest === computePublicTrustDigest(trust);
    if (!valid) {
      add("invalid_public_trust_input", `publicTrustInputs.${trust.id}`, [trust.id]);
    }
    const existing = trustSources.get(trust.source) ?? [];
    existing.push(trust.id);
    trustSources.set(trust.source, existing);
  }
  const policyTrustRefs = values(value.detectorPolicy?.trustInputRefs);
  if (!sameSet(policyTrustRefs, [...trustInputs.keys()])) {
    add("invalid_public_trust_coverage", "detectorPolicy.trustInputRefs");
  }
  if (
    !sameSet(
      value.detectorPolicy?.trustInputDigests,
      [...trustInputs.values()].map((record) => record.recordDigest),
    )
  ) {
    add("invalid_public_trust_coverage", "detectorPolicy.trustInputDigests");
  }
  for (const rule of detectorRules.values()) {
    if (
      rule.reviewRequired !== true ||
      !Array.isArray(rule.allowedDispositionKinds) ||
      rule.allowedDispositionKinds.length === 0 ||
      (trustSources.get(rule.source)?.length ?? 0) !== 1
    ) {
      add("invalid_detector_rule", `detectorPolicy.detectorRules.${rule.id}`, [rule.id]);
    }
  }

  const snapshotRoot = computeSnapshotRoot(value.snapshot);
  const snapshotEvidence = evidence.get(value.snapshot?.evidenceRef);
  if (
    !isRecord(value.snapshot) ||
    value.snapshot.complete !== true ||
    value.snapshot.completenessRoot !== snapshotRoot ||
    timestamp(value.snapshot.capturedAt) === null ||
    asOf === null ||
    timestamp(value.snapshot.capturedAt) > asOf ||
    principals.get(value.snapshot.suppliedByRef)?.kind !== "system" ||
    !values(principals.get(value.snapshot.suppliedByRef)?.scopes).includes(
      "supply-alert-snapshot",
    ) ||
    !evidenceSupports(snapshotEvidence, {
      kind: "alert-snapshot",
      authorRef: value.snapshot.suppliedByRef,
      observedAt: value.snapshot.capturedAt,
      subjectRef: value.snapshot.id,
      subjectRefs: [value.snapshot.id, ...alerts.keys()],
      subjectDigest: snapshotRoot,
    })
  ) {
    add("invalid_snapshot", "snapshot");
  }
  if (!sameSet(value.snapshot?.alertRefs, [...alerts.keys()])) {
    add("incomplete_snapshot_index", "snapshot.alertRefs");
  }
  if (
    !sameSet(snapshotEvidence?.subjectRefs, [value.snapshot?.id, ...alerts.keys()])
  ) {
    add("incomplete_snapshot_evidence", `evidence.${snapshotEvidence?.id ?? "missing"}`);
  }

  const alertsByKey = new Map();
  for (const alert of alerts.values()) {
    const key = alertKey(alert);
    const rule = detectorRules.get(alert.detectorRef);
    const owner = principals.get(alert.ownerRef);
    if (alertsByKey.has(key)) {
      add("duplicate_alert_key", "snapshot.alerts", [key]);
    }
    alertsByKey.set(key, alert);
    const assetShape =
      (alert.assetIdentityState === "known" &&
        typeof alert.assetRef === "string" &&
        alert.assetRef.length > 0) ||
      (alert.assetIdentityState === "unknown" && alert.assetRef === null);
    if (
      !rule ||
      rule.source !== alert.source ||
      rule.reviewRequired !== true ||
      !isNamedHuman(owner) ||
      !values(owner?.scopes).includes("own-alert-snapshot") ||
      !assetShape ||
      (alert.supersedesRevision !== null &&
        alert.supersedesRevision === alert.revision) ||
      timestamp(alert.observedAt) === null ||
      timestamp(alert.observedAt) > timestamp(value.snapshot?.capturedAt) ||
      alert.evidenceRef !== value.snapshot?.evidenceRef
    ) {
      add("invalid_alert", `snapshot.alerts.${alert.id}`, [key]);
    }
  }
  const usedDetectorRefs = new Set([...alerts.values()].map((alert) => alert.detectorRef));
  for (const detectorRef of detectorRules.keys()) {
    if (!usedDetectorRefs.has(detectorRef)) {
      add("unused_detector_rule", "detectorPolicy.detectorRules", [detectorRef]);
    }
  }

  for (const grant of grants.values()) {
    const issuer = principals.get(grant.issuedByRef);
    const grantee = principals.get(grant.granteeRef);
    const grantEvidence = evidence.get(grant.evidenceRef);
    const detectorScopeValid =
      values(grant.detectorRefs).length > 0 &&
      values(grant.detectorRefs).every((ref) => detectorRules.get(ref)?.source === grant.source);
    const granteeScopeValid =
      grant.type === "declare-duplicate-group"
        ? values(grantee?.scopes).includes("own-alert-snapshot")
        : values(grantee?.scopes).includes("review-alert");
    if (
      !isNamedHuman(issuer) ||
      !isNamedHuman(grantee) ||
      sameHuman(issuer, grantee) ||
      !values(issuer.scopes).includes("issue-alert-review-grant") ||
      !granteeScopeValid ||
      !detectorScopeValid ||
      timestamp(grant.issuedAt) === null ||
      timestamp(grant.validFrom) === null ||
      timestamp(grant.validUntil) === null ||
      timestamp(grant.issuedAt) < timestamp(value.detectorPolicy?.effectiveAt) ||
      timestamp(grant.issuedAt) > timestamp(grant.validFrom) ||
      timestamp(grant.validFrom) >= timestamp(grant.validUntil) ||
      grant.policyRevisionDigest !== policyDigest ||
      grant.grantDigest !== computeGrantDigest(grant) ||
      !evidenceSupports(grantEvidence, {
        kind: "authority-grant",
        authorRef: grant.issuedByRef,
        observedAt: grant.issuedAt,
        subjectRef: grant.id,
        subjectDigest: grant.grantDigest,
      })
    ) {
      add("invalid_grant", `grants.${grant.id}`, [grant.id]);
    }
  }

  const groupedAlertKeys = new Set();
  for (const group of duplicateGroups.values()) {
    const groupGrant = grants.get(group.grantRef);
    const groupEvidence = evidence.get(group.evidenceRef);
    const memberAlerts = values(group.memberAlertKeys).map((key) => alertsByKey.get(key));
    const validMembers =
      memberAlerts.length >= 2 &&
      memberAlerts.every(
        (alert) => alert?.source === group.source && alert?.detectorRef === group.detectorRef,
      );
    for (const key of values(group.memberAlertKeys)) {
      if (groupedAlertKeys.has(key)) {
        add("duplicate_group_membership", `duplicateGroups.${group.id}`, [key]);
      }
      groupedAlertKeys.add(key);
    }
    if (
      !validMembers ||
      memberAlerts.some((alert) => alert.ownerRef !== group.declaredByRef) ||
      !values(group.memberAlertKeys).includes(group.primaryAlertKey) ||
      timestamp(group.declaredAt) === null ||
      timestamp(group.declaredAt) < timestamp(value.snapshot?.capturedAt) ||
      timestamp(group.declaredAt) > asOf ||
      !grantCovers(
        groupGrant,
        group.declaredByRef,
        "declare-duplicate-group",
        memberAlerts[0],
        policyDigest,
        group.declaredAt,
      ) ||
      group.groupDigest !== computeDuplicateGroupDigest(group) ||
      !evidenceSupports(groupEvidence, {
        kind: "duplicate-declaration",
        authorRef: group.declaredByRef,
        observedAt: group.declaredAt,
        subjectRef: group.id,
        subjectDigest: group.groupDigest,
      })
    ) {
      add("invalid_duplicate_group", `duplicateGroups.${group.id}`, [group.id]);
    }
  }

  const attemptsByAlert = new Map();
  for (const attempt of suppressionAttempts.values()) {
    const alert = alertsByKey.get(attempt.alertKey);
    const attemptEvidence = evidence.get(attempt.evidenceRef);
    const existing = attemptsByAlert.get(attempt.alertKey) ?? [];
    existing.push(attempt);
    attemptsByAlert.set(attempt.alertKey, existing);
    if (
      !alert ||
      attempt.requestedByRef !== alert.ownerRef ||
      timestamp(attempt.requestedAt) === null ||
      timestamp(attempt.requestedAt) < timestamp(alert.observedAt) ||
      timestamp(attempt.requestedAt) > asOf ||
      attempt.attemptDigest !== computeSuppressionAttemptDigest(attempt) ||
      !evidenceSupports(attemptEvidence, {
        kind: "suppression-attempt",
        authorRef: attempt.requestedByRef,
        observedAt: attempt.requestedAt,
        subjectRef: attempt.id,
        subjectDigest: attempt.attemptDigest,
      })
    ) {
      add("invalid_suppression_attempt", `suppressionAttempts.${attempt.id}`, [attempt.id]);
    }
  }

  const priorByInvalidatingKey = new Map();
  const priorAlertKeys = new Set();
  for (const prior of priorDecisions.values()) {
    const priorAlertKey = alertKey(prior);
    if (priorAlertKeys.has(priorAlertKey)) {
      add("duplicate_prior_decision", "priorDecisions", [priorAlertKey]);
    }
    priorAlertKeys.add(priorAlertKey);
    const current = alertsByKey.get(prior.invalidatedByAlertKey);
    const priorEvidence = evidence.get(prior.evidenceRef);
    const priorGrant = grants.get(prior.grantRef);
    const priorRule = detectorRules.get(prior.detectorRef);
    const existing = priorByInvalidatingKey.get(prior.invalidatedByAlertKey) ?? [];
    existing.push(prior);
    priorByInvalidatingKey.set(prior.invalidatedByAlertKey, existing);
    if (
      prior.alertKey !== priorAlertKey ||
      alertsByKey.has(prior.alertKey) ||
      !current ||
      current.source !== prior.source ||
      current.nativeAlertId !== prior.nativeAlertId ||
      current.supersedesRevision !== prior.revision ||
      current.detectorRef !== prior.detectorRef ||
      prior.policyRevisionDigest !== policyDigest ||
      !values(priorRule?.allowedDispositionKinds).includes(prior.outcome) ||
      !isNamedHuman(principals.get(prior.decidedByRef)) ||
      sameHuman(
        principals.get(prior.decidedByRef),
        principals.get(current.ownerRef),
      ) ||
      !values(principals.get(prior.decidedByRef)?.scopes).includes("review-alert") ||
      !grantCovers(
        priorGrant,
        prior.decidedByRef,
        DISPOSITION_GRANT[prior.outcome],
        prior,
        policyDigest,
        prior.decidedAt,
      ) ||
      timestamp(prior.decidedAt) === null ||
      timestamp(prior.decidedAt) >= timestamp(current.observedAt) ||
      prior.decisionDigest !== computePriorDecisionDigest(prior) ||
      !evidenceSupports(priorEvidence, {
        kind: "prior-decision",
        authorRef: prior.decidedByRef,
        observedAt: prior.decidedAt,
        subjectRef: prior.id,
        subjectDigest: prior.decisionDigest,
      })
    ) {
      add("invalid_prior_decision", `priorDecisions.${prior.id}`, [prior.id]);
    }
  }

  for (const escalation of escalations.values()) {
    const alert = alertsByKey.get(escalation.alertKey);
    const escalationGrant = grants.get(escalation.grantRef);
    const escalationEvidence = evidence.get(escalation.evidenceRef);
    const incidentOwner = principals.get(escalation.incidentOwnerRef);
    if (
      !alert ||
      !isNamedHuman(principals.get(escalation.requestedByRef)) ||
      !grantCovers(
        escalationGrant,
        escalation.requestedByRef,
        "request-incident-review",
        alert,
        policyDigest,
        escalation.requestedAt,
      ) ||
      timestamp(escalation.requestedAt) < timestamp(value.snapshot?.capturedAt) ||
      timestamp(escalation.requestedAt) > asOf ||
      !isNamedHuman(incidentOwner) ||
      !values(incidentOwner?.scopes).includes("receive-incident-review") ||
      sameHuman(incidentOwner, principals.get(escalation.requestedByRef)) ||
      escalation.state !== "requested-owner-review" ||
      escalation.incidentRef !== null ||
      escalation.declarationEffect !== "none" ||
      escalation.escalationDigest !== computeIncidentEscalationDigest(escalation) ||
      !evidenceSupports(escalationEvidence, {
        kind: "incident-escalation",
        authorRef: escalation.requestedByRef,
        observedAt: escalation.requestedAt,
        subjectRef: escalation.id,
        subjectDigest: escalation.escalationDigest,
      })
    ) {
      add("invalid_incident_escalation", `incidentEscalations.${escalation.id}`, [
        escalation.id,
      ]);
    }
  }

  const recordsByAlert = new Map();
  for (const record of reviewRecords.values()) {
    const existing = recordsByAlert.get(record.alertKey) ?? [];
    existing.push(record);
    recordsByAlert.set(record.alertKey, existing);
    const alert = alertsByKey.get(record.alertKey);
    const rule = detectorRules.get(alert?.detectorRef);
    const fresh =
      timestamp(record.recordedAt) !== null &&
      timestamp(record.recordedAt) >= timestamp(alert?.observedAt) &&
      timestamp(record.recordedAt) >= timestamp(value.snapshot?.capturedAt) &&
      timestamp(record.recordedAt) >= timestamp(value.detectorPolicy?.effectiveAt) &&
      asOf !== null &&
      timestamp(record.recordedAt) <= asOf;
    if (
      !alert ||
      record.snapshotRoot !== snapshotRoot ||
      record.policyRevisionDigest !== policyDigest ||
      record.recordDigest !== computeReviewRecordDigest(record) ||
      !fresh
    ) {
      add("invalid_review_record", `reviewRecords.${record.id}`, [record.id]);
      continue;
    }

    if (record.kind === "human-disposition") {
      const expectedGrantType = DISPOSITION_GRANT[record.disposition];
      const grant = grants.get(record.grantRef);
      const decisionEvidence = evidence.get(record.evidenceRef);
      const decider = principals.get(record.decidedByRef);
      if (
        record.nonDecision !== null ||
        !expectedGrantType ||
        record.decidedByRef === null ||
        !isNamedHuman(decider) ||
        !values(decider?.scopes).includes("review-alert") ||
        sameHuman(decider, principals.get(alert.ownerRef)) ||
        !grantCovers(
          grant,
          record.decidedByRef,
          expectedGrantType,
          alert,
          policyDigest,
          record.recordedAt,
        ) ||
        !values(rule?.allowedDispositionKinds).includes(record.disposition) ||
        !evidenceSupports(decisionEvidence, {
          kind: "human-disposition",
          authorRef: record.decidedByRef,
          observedAt: record.recordedAt,
          subjectRef: record.id,
          subjectDigest: record.recordDigest,
        })
      ) {
        add("unauthorized_human_disposition", `reviewRecords.${record.id}`, [record.id]);
      }
      if (["muted", "suppressed"].includes(alert.sourceState)) {
        add("source_state_not_disposition", `reviewRecords.${record.id}`, [record.id]);
      }
      if (alert.assetIdentityState === "unknown") {
        add("unknown_asset_not_disposition", `reviewRecords.${record.id}`, [record.id]);
      }
      if ((attemptsByAlert.get(record.alertKey)?.length ?? 0) > 0) {
        add("self_suppression_not_disposition", `reviewRecords.${record.id}`, [record.id]);
      }
      if (record.disposition === "false-positive") {
        if (record.duplicateGroupRef !== null || record.incidentEscalationRef !== null) {
          add("invalid_false_positive_disposition", `reviewRecords.${record.id}`, [record.id]);
        }
      } else if (record.disposition === "duplicate") {
        const group = duplicateGroups.get(record.duplicateGroupRef);
        if (
          !group ||
          !values(group.memberAlertKeys).includes(record.alertKey) ||
          group.primaryAlertKey === record.alertKey ||
          timestamp(group.declaredAt) > timestamp(record.recordedAt) ||
          record.incidentEscalationRef !== null
        ) {
          add("invalid_duplicate_disposition", `reviewRecords.${record.id}`, [record.id]);
        }
      } else if (record.disposition === "incident-review-escalation") {
        const escalation = escalations.get(record.incidentEscalationRef);
        if (
          !escalation ||
          escalation.alertKey !== record.alertKey ||
          escalation.requestedByRef !== record.decidedByRef ||
          timestamp(escalation.requestedAt) !== timestamp(record.recordedAt) ||
          record.duplicateGroupRef !== null
        ) {
          add("invalid_incident_disposition", `reviewRecords.${record.id}`, [record.id]);
        }
      }
    } else if (record.kind === "non-decision") {
      if (
        record.disposition !== null ||
        record.decidedByRef !== null ||
        record.grantRef !== null ||
        record.evidenceRef !== null ||
        record.duplicateGroupRef !== null ||
        record.incidentEscalationRef !== null
      ) {
        add("invalid_non_decision", `reviewRecords.${record.id}`, [record.id]);
      }
      const reasonIsExact =
        (record.nonDecision === "source-muted-or-suppressed" &&
          ["muted", "suppressed"].includes(alert.sourceState)) ||
        (record.nonDecision === "unknown-asset-identity" &&
          alert.assetIdentityState === "unknown" &&
          alert.assetRef === null) ||
        (record.nonDecision === "self-suppression-attempt" &&
          (attemptsByAlert.get(record.alertKey)?.length ?? 0) > 0 &&
          attemptsByAlert
            .get(record.alertKey)
            .every(
              (attempt) =>
                timestamp(attempt.requestedAt) <= timestamp(record.recordedAt),
            )) ||
        (record.nonDecision === "revision-invalidated-prior-decision" &&
          currentRevisionWasInvalidated(alert, priorByInvalidatingKey.get(record.alertKey)));
      if (!reasonIsExact) {
        add("invalid_non_decision_reason", `reviewRecords.${record.id}.nonDecision`, [
          record.id,
        ]);
      }
    } else {
      add("invalid_review_record_kind", `reviewRecords.${record.id}.kind`, [record.id]);
    }
  }

  for (const key of alertsByKey.keys()) {
    const matches = recordsByAlert.get(key) ?? [];
    if (matches.length === 0) add("missing_review_record", "reviewRecords", [key]);
    if (matches.length > 1) add("duplicate_review_record", "reviewRecords", [key]);
  }
  for (const key of recordsByAlert.keys()) {
    if (!alertsByKey.has(key)) add("unknown_review_record", "reviewRecords", [key]);
  }

  const records = [...reviewRecords.values()];
  const humanRecords = records.filter((record) => record.kind === "human-disposition");
  const nonDecisions = records.filter((record) => record.kind === "non-decision");
  const incidentRecords = humanRecords.filter(
    (record) => record.disposition === "incident-review-escalation",
  );
  if (
    !sameSet(
      incidentRecords.map((record) => record.incidentEscalationRef),
      [...escalations.keys()],
    ) ||
    incidentRecords.some(
      (record) =>
        incidentRecords.filter(
          (candidate) =>
            candidate.incidentEscalationRef === record.incidentEscalationRef,
        ).length !== 1,
    )
  ) {
    add("invalid_incident_escalation_coverage", "incidentEscalations");
  }

  const expectedEvidenceRefs = new Set(
    [
      value.snapshot?.evidenceRef,
      value.detectorPolicy?.evidenceRef,
      value.principalRoster?.evidenceRef,
      ...[...alerts.values()].map((row) => row.evidenceRef),
      ...[...grants.values()].map((row) => row.evidenceRef),
      ...[...duplicateGroups.values()].map((row) => row.evidenceRef),
      ...[...suppressionAttempts.values()].map((row) => row.evidenceRef),
      ...[...priorDecisions.values()].map((row) => row.evidenceRef),
      ...humanRecords.map((row) => row.evidenceRef),
      ...[...escalations.values()].map((row) => row.evidenceRef),
    ].filter((ref) => typeof ref === "string"),
  );
  if (!sameSet([...evidence.keys()], [...expectedEvidenceRefs])) {
    add("invalid_evidence_coverage", "evidence");
  }
  const expectedCoverage = {
    expectedAlertCount: alertsByKey.size,
    alertKeys: [...alertsByKey.keys()],
    reviewRecordRefs: records.map((record) => record.id),
    humanDispositionCount: humanRecords.length,
    nonDecisionCount: nonDecisions.length,
    humanDispositionAlertKeys: humanRecords.map((record) => record.alertKey),
    nonDecisionAlertKeys: nonDecisions.map((record) => record.alertKey),
  };
  if (
    value.coverage?.expectedAlertCount !== expectedCoverage.expectedAlertCount ||
    !sameSet(value.coverage?.alertKeys, expectedCoverage.alertKeys) ||
    !sameSet(value.coverage?.reviewRecordRefs, expectedCoverage.reviewRecordRefs) ||
    value.coverage?.humanDispositionCount !== expectedCoverage.humanDispositionCount ||
    value.coverage?.nonDecisionCount !== expectedCoverage.nonDecisionCount ||
    !sameSet(
      value.coverage?.humanDispositionAlertKeys,
      expectedCoverage.humanDispositionAlertKeys,
    ) ||
    !sameSet(value.coverage?.nonDecisionAlertKeys, expectedCoverage.nonDecisionAlertKeys)
  ) {
    add("invalid_coverage", "coverage");
  }

  if (
    !isRecord(value.authority) ||
    Object.entries(AUTHORITY).some(([key, expected]) => value.authority[key] !== expected)
  ) {
    add("invalid_authority_claim", "authority");
  }

  if (
    value.handoff?.published !== false ||
    value.handoff?.state !== "complete-covered" ||
    !CONTROLLED_URI.test(value.handoff?.destination ?? "") ||
    timestamp(value.handoff?.generatedAt) !== asOf ||
    !isNamedHuman(principals.get(value.handoff?.nextOwnerRef)) ||
    !values(principals.get(value.handoff?.nextOwnerRef)?.scopes).includes(
      "receive-alert-review",
    ) ||
    !sameSet(
      value.handoff?.humanDispositionRefs,
      humanRecords.map((record) => record.id),
    ) ||
    !sameSet(
      value.handoff?.nonDecisionRefs,
      nonDecisions.map((record) => record.id),
    ) ||
    !sameSet(
      value.handoff?.incidentEscalationRefs,
      [...escalations.keys()],
    )
  ) {
    add("invalid_handoff", "handoff");
  }

  return findings.sort(findingOrder);
}

function currentRevisionWasInvalidated(alert, priors) {
  return (
    typeof alert?.supersedesRevision === "string" &&
    Array.isArray(priors) &&
    priors.length === 1 &&
    priors[0].source === alert.source &&
    priors[0].nativeAlertId === alert.nativeAlertId &&
    priors[0].revision === alert.supersedesRevision &&
    priors[0].invalidatedByAlertKey === alertKey(alert)
  );
}

export function resealSecurityAlertReview(value) {
  const output = structuredClone(value);
  for (const trust of rows(output.publicTrustInputs)) {
    trust.recordDigest = computePublicTrustDigest(trust);
  }
  output.principalRoster.principalRefs = rows(output.principals).map(
    (principal) => principal.id,
  );
  output.principalRoster.digest = computePrincipalRosterDigest(
    output.principalRoster,
    output.principals,
  );
  output.detectorPolicy.trustInputDigests = rows(output.publicTrustInputs).map(
    (record) => record.recordDigest,
  );
  output.detectorPolicy.revisionDigest = computePolicyDigest(output.detectorPolicy);
  output.snapshot.alertRefs = rows(output.snapshot.alerts).map((alert) => alert.id);
  output.snapshot.completenessRoot = computeSnapshotRoot(output.snapshot);

  for (const grant of rows(output.grants)) {
    grant.policyRevisionDigest = output.detectorPolicy.revisionDigest;
    grant.grantDigest = computeGrantDigest(grant);
  }
  for (const group of rows(output.duplicateGroups)) {
    group.groupDigest = computeDuplicateGroupDigest(group);
  }
  for (const attempt of rows(output.suppressionAttempts)) {
    attempt.attemptDigest = computeSuppressionAttemptDigest(attempt);
  }
  for (const prior of rows(output.priorDecisions)) {
    prior.alertKey = alertKey(prior);
    prior.policyRevisionDigest = output.detectorPolicy.revisionDigest;
    prior.decisionDigest = computePriorDecisionDigest(prior);
  }
  for (const escalation of rows(output.incidentEscalations)) {
    escalation.escalationDigest = computeIncidentEscalationDigest(escalation);
  }
  for (const record of rows(output.reviewRecords)) {
    record.snapshotRoot = output.snapshot.completenessRoot;
    record.policyRevisionDigest = output.detectorPolicy.revisionDigest;
    record.recordDigest = computeReviewRecordDigest(record);
  }

  const subjects = new Map();
  subjects.set(output.snapshot.id, output.snapshot.completenessRoot);
  subjects.set(output.detectorPolicy.id, output.detectorPolicy.revisionDigest);
  subjects.set(output.principalRoster.id, output.principalRoster.digest);
  for (const grant of rows(output.grants)) subjects.set(grant.id, grant.grantDigest);
  for (const group of rows(output.duplicateGroups)) subjects.set(group.id, group.groupDigest);
  for (const attempt of rows(output.suppressionAttempts)) {
    subjects.set(attempt.id, attempt.attemptDigest);
  }
  for (const prior of rows(output.priorDecisions)) {
    subjects.set(prior.id, prior.decisionDigest);
  }
  for (const record of rows(output.reviewRecords)) {
    subjects.set(record.id, record.recordDigest);
  }
  for (const escalation of rows(output.incidentEscalations)) {
    subjects.set(escalation.id, escalation.escalationDigest);
  }
  for (const row of rows(output.evidence)) {
    const subject = values(row.subjectRefs).find((ref) => subjects.has(ref));
    if (subject) row.subjectDigest = subjects.get(subject);
  }
  output.evidenceRoot = computeEvidenceRoot(output.evidence);

  const records = rows(output.reviewRecords);
  const humanRecords = records.filter((record) => record.kind === "human-disposition");
  const nonDecisions = records.filter((record) => record.kind === "non-decision");
  output.coverage = {
    expectedAlertCount: rows(output.snapshot.alerts).length,
    alertKeys: rows(output.snapshot.alerts).map(alertKey),
    reviewRecordRefs: records.map((record) => record.id),
    humanDispositionCount: humanRecords.length,
    nonDecisionCount: nonDecisions.length,
    humanDispositionAlertKeys: humanRecords.map((record) => record.alertKey),
    nonDecisionAlertKeys: nonDecisions.map((record) => record.alertKey),
  };
  output.handoff.generatedAt = output.asOf;
  output.handoff.humanDispositionRefs = humanRecords.map((record) => record.id);
  output.handoff.nonDecisionRefs = nonDecisions.map((record) => record.id);
  output.handoff.incidentEscalationRefs = rows(output.incidentEscalations).map(
    (row) => row.id,
  );
  return output;
}

async function runCli() {
  const args = process.argv.slice(2);
  const inputPath = args.find((arg) => !arg.startsWith("--"));
  const asOfIndex = args.indexOf("--as-of");
  const asOf = asOfIndex >= 0 ? args[asOfIndex + 1] : undefined;
  const rosterIndex = args.indexOf("--principal-roster-digest");
  const principalRosterDigest = rosterIndex >= 0 ? args[rosterIndex + 1] : undefined;
  const evidenceIndex = args.indexOf("--evidence-root");
  const evidenceRoot = evidenceIndex >= 0 ? args[evidenceIndex + 1] : undefined;
  if (!inputPath || !asOf || !principalRosterDigest || !evidenceRoot) {
    process.stderr.write(
      "usage: node validate.mjs <artifact.json> --as-of <timestamp> --principal-roster-digest <sha256:digest> --evidence-root <sha256:digest>\n",
    );
    process.exitCode = 2;
    return;
  }

  const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([
    import("ajv/dist/2020.js"),
    import("ajv-formats"),
  ]);
  const [schemaText, inputText] = await Promise.all([
    readFile(new URL("./security-alert-review.schema.json", import.meta.url), "utf8"),
    readFile(resolve(inputPath), "utf8"),
  ]);
  const schema = JSON.parse(schemaText);
  const input = JSON.parse(inputText);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  const schemaValid = validateSchema(input);
  const semanticFindings = securityAlertReviewFindings(input, {
    asOf,
    principalRosterDigest,
    evidenceRoot,
  });
  const schemaFindings = schemaValid
    ? []
    : (validateSchema.errors ?? []).map((error) =>
        finding("schema_validation_error", error.instancePath || "$", [
          error.keyword,
        ]),
      );
  const findings = [...schemaFindings, ...semanticFindings].sort(findingOrder);
  process.stdout.write(`${JSON.stringify({ valid: findings.length === 0, findings }, null, 2)}\n`);
  if (findings.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await runCli();
}
