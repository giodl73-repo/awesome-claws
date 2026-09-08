import { createHash } from "node:crypto";

export const ACCESS_ENTITLEMENT_REVIEW_SCHEMA_VERSION =
  "awesomeClaws.accessEntitlementReview.spike.v1";

const LEDGERS = [
  ["principals", "Principal"],
  ["evidence", "Evidence"],
  ["assignments", "Assignment"],
  ["authorityGrants", "Reviewer authority grant"],
  ["sourceSignals", "Owner source signal"],
  ["decisions", "Decision"],
  ["nonDecisions", "Non-decision"],
  ["blockers", "Blocker"],
];

const DECISION_SCOPE = "entitlement-review-decision";
const PRIVILEGED_SCOPE = "privileged-review";
const ISSUER_SCOPE = "review-authority-issuer";
const DESTINATION_SCOPE = "review-destination-approver";
const COORDINATOR_SCOPE = "review-round-coordinator";
const HANDOFF_SCOPE = "review-execution-handoff-owner";
const SNAPSHOT_SUPPLIER_SCOPE = "assignment-snapshot-supplier";
const SIGNAL_SUPPLIER_SCOPE = "source-signal-supplier";
const HUMAN_SCOPES = [ISSUER_SCOPE, DESTINATION_SCOPE, COORDINATOR_SCOPE, HANDOFF_SCOPE];
const SYSTEM_SCOPES = [SNAPSHOT_SUPPLIER_SCOPE, SIGNAL_SUPPLIER_SCOPE];
const PERMITTED_DECISION_SOURCE = "named-human-review";
const PERMITTED_DECISION_BASIS = "independent-human-judgment";
const PERMITTED_RECERTIFICATION_BASIS = "fresh-decision-each-round";
const PERMITTED_AUTHORITY_BASIS = "owner-supplied-roster-not-derived";
const PERMITTED_SIGNAL_PRESENTATION = "source-system-signal-not-a-decision";
const PRIVILEGE_ABSENT_BLOCKER = "privilege-classification-absent";
const PRIVILEGE_UNKNOWN_BLOCKER = "assignment-privilege-unknown";

// V1 discloses one fixed set of access paths it never reaches. A subset is not a
// smaller disclosure, it is a quieter completeness claim, so the set is exact.
const REQUIRED_NOT_COVERED_PATH_KINDS = [
  "inherited-group-membership",
  "nested-group-expansion",
  "effective-access-computation",
  "standing-role-assignment",
  "break-glass-account",
  "external-federated-access",
];

// Every owner-supplied assignment field that can move identity, scope, coverage,
// or decision validity feeds the manifest digest. Anything outside this list
// cannot change what was reviewed.
const ASSIGNMENT_MANIFEST_FIELDS = [
  "id",
  "snapshotRef",
  "principalRef",
  "resourceRef",
  "entitlementRef",
  "assignmentRef",
  "assignmentDigest",
  "inScope",
  "exclusionCode",
  "resolutionMode",
  "privileged",
  "grantedByRef",
  "evidenceRefs",
];

// Every principal field that can confer, widen, or move authority feeds the
// roster digest, so a scope cannot appear without a re-issued owner roster.
const ROSTER_PRINCIPAL_FIELDS = ["id", "name", "kind", "scopes"];

// A controlled record binds two things: the semantic payload of the exact row it
// supports, and the envelope that says who supplied it, when, and about what.
// The payload digest is what stops an unchanged reference from supporting a
// changed decision state, grant interval, signal value, non-decision, or blocker.
const EVIDENCE_RECORD_FIELDS = [
  "kind",
  "controlledSource",
  "controlledPurpose",
  "snapshotDigest",
  "observedAt",
  "suppliedByRef",
  "subjectRefs",
  "payloadDigest",
];

const GRANT_PAYLOAD_FIELDS = [
  "id",
  "granteeRef",
  "grantedByRef",
  "resourceRef",
  "entitlementRef",
  "scopes",
  "activeFrom",
  "activeUntil",
];

const DECISION_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "snapshotDigest",
  "assignmentRowRef",
  "assignmentRef",
  "assignmentDigest",
  "state",
  "decisionBasis",
  "decisionSource",
  "decidedByRef",
  "decidedAt",
  "authorityGrantRef",
  "privilegedReview",
  "replacementRequest",
  "sourceSignalRefs",
];

const SIGNAL_PAYLOAD_FIELDS = [
  "id",
  "kind",
  "roundRef",
  "snapshotRef",
  "snapshotDigest",
  "assignmentRowRef",
  "assignmentRef",
  "assignmentDigest",
  "suppliedByRef",
  "observedAt",
  "recommendation",
  "inactiveDays",
];

const NON_DECISION_PAYLOAD_FIELDS = [
  "id",
  "roundRef",
  "assignmentRowRef",
  "assignmentRef",
  "assignmentDigest",
  "state",
  "recordedByRef",
  "recordedAt",
  "escalation",
];

const BLOCKER_PAYLOAD_FIELDS = [
  "id",
  "code",
  "targetRefs",
  "status",
  "ownedByRef",
  "raisedAt",
];

export const ROUND_SNAPSHOT_EXPORT_BOUND_FIELDS = {
  round: [
    "id",
    "priorRoundRef",
    "snapshotRef",
    "snapshotDigest",
    "asOf",
    "window",
    "cadence",
    "destination",
    "authorityBoundary",
    "handoffOwnerRef",
    "assignmentRefs",
    "sourceSignalRefs",
  ],
  snapshot: [
    "id",
    "digest",
    "asOf",
    "coverageBasis",
    "privilegeClassification",
    "sourceSystemRef",
    "entitlementCatalogRefs",
    "notCoveredAccessPaths",
  ],
};

export const ROUND_SNAPSHOT_EXPORT_DERIVED_FIELDS = {
  round: [
    "exportEvidenceRef",
    "authorityGrantRefs",
    "decisionRefs",
    "nonDecisionRefs",
    "blockerRefs",
  ],
  snapshot: ["exportEvidenceRef"],
};

// The owner-supplied kind is the identity control. This closed denylist is only
// defence in depth against common job-title, queue, and rota labels.
const BARE_ROLE =
  /^(?:access(?: reviewer| owner| review board| approver| management)?|entitlement(?: owner| reviewer| review)?|reviewer|approver|decision maker|manager|line manager|resource owner|application owner|system owner|group owner|security(?: team| operations)?|iam(?: team| admin| operations)?|identity(?: team| governance)?|it(?: security| operations)?|helpdesk|service desk|automation|system|the owner|owner|access-entitlement-review-coordinator)$/iu;

function finding(code, path, message) {
  return { code, path, message };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
}

function milliseconds(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

// Every canonical ordering in this file is UTF-16 code-unit ordering. String
// collation is locale-dependent -- da-DK sorts "aa" after "z" and en-US does not
// -- so a digest computed with localeCompare would depend on the process locale
// of whoever recomputed it. This comparator does not.
function byCodeUnit(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedCopy(values) {
  return [...values].map((item) => String(item)).sort(byCodeUnit);
}

function sameExactList(declared, expected) {
  if (!Array.isArray(declared)) return false;
  const left = sortedCopy(declared);
  const right = sortedCopy(expected);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort(byCodeUnit)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function manifestField(value) {
  if (Array.isArray(value)) return sortedCopy(value);
  return value === undefined ? null : value;
}

function project(fields, row) {
  return Object.fromEntries(fields.map((field) => [field, manifestField(object(row)[field])]));
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digestRows(fields, rows) {
  const projected = (Array.isArray(rows) ? rows : [])
    .filter((row) => isRecord(row))
    .map((row) => project(fields, row))
    .sort((left, right) => byCodeUnit(String(left.id), String(right.id)));
  return sha256(canonicalJson(projected));
}

// The reviewed universe is exactly this manifest. The snapshot digest is not an
// owner-asserted label: it is recomputed here from every assignment field that
// can change identity, scope, coverage, or decision validity.
export function computeAssignmentManifestDigest(assignments) {
  return digestRows(ASSIGNMENT_MANIFEST_FIELDS, assignments);
}

// The owner roster is content-bound the same way. A scope, a name, a kind, or a
// principal appearing or disappearing moves this digest, so the roster record
// has to be re-issued before any scope in the artifact means anything.
export function computeAuthorityRosterDigest(principals) {
  return digestRows(ROSTER_PRINCIPAL_FIELDS, principals);
}

// The semantic payload of a controlled record: the exact canonical projection of
// the row that record is supposed to support. Returns null for an unknown kind
// or an unresolvable source, which the caller treats as a finding rather than a
// pass.
export function evidencePayloadProjection(kind, source) {
  switch (kind) {
    case "assignment-record":
      return isRecord(source) ? project(ASSIGNMENT_MANIFEST_FIELDS, source) : null;
    case "authority-grant-record":
      return isRecord(source) ? project(GRANT_PAYLOAD_FIELDS, source) : null;
    case "decision-record":
      return isRecord(source) ? project(DECISION_PAYLOAD_FIELDS, source) : null;
    case "source-signal-record":
      return isRecord(source) ? project(SIGNAL_PAYLOAD_FIELDS, source) : null;
    case "non-decision-record":
      return isRecord(source) ? project(NON_DECISION_PAYLOAD_FIELDS, source) : null;
    case "blocker-record":
      return isRecord(source) ? project(BLOCKER_PAYLOAD_FIELDS, source) : null;
    case "authority-roster-export": {
      if (!isRecord(source)) return null;
      const roster = object(source.authorityRoster);
      const principals = Array.isArray(source.principals) ? source.principals : null;
      if (principals === null) return null;
      return {
        rosterId: manifestField(roster.id),
        rosterDigest: manifestField(roster.rosterDigest),
        custodianRef: manifestField(roster.custodianRef),
        principalRefs: manifestField(
          principals.filter((row) => isRecord(row)).map((row) => row.id),
        ),
      };
    }
    case "round-snapshot-export": {
      if (!isRecord(source)) return null;
      const round = object(source.round);
      const snapshot = object(source.snapshot);
      const assignments = Array.isArray(source.assignments) ? source.assignments : null;
      if (assignments === null) return null;
      return {
        round: {
          id: manifestField(round.id),
          priorRoundRef: manifestField(round.priorRoundRef),
          snapshotRef: manifestField(round.snapshotRef),
          snapshotDigest: manifestField(round.snapshotDigest),
          asOf: manifestField(round.asOf),
          window: project(["opensAt", "closesAt"], round.window),
          cadence: project(["intervalDays", "recertificationBasis"], round.cadence),
          destination: project(
            ["controlledRef", "visibility", "approvedByRef"],
            round.destination,
          ),
          authorityBoundary: project(["rosterRef", "basis"], round.authorityBoundary),
          handoffOwnerRef: manifestField(round.handoffOwnerRef),
          assignmentRefs: manifestField(round.assignmentRefs),
          sourceSignalRefs: manifestField(round.sourceSignalRefs),
        },
        snapshot: {
          id: manifestField(snapshot.id),
          digest: manifestField(snapshot.digest),
          asOf: manifestField(snapshot.asOf),
          coverageBasis: manifestField(snapshot.coverageBasis),
          privilegeClassification: manifestField(snapshot.privilegeClassification),
          sourceSystemRef: manifestField(snapshot.sourceSystemRef),
          entitlementCatalogRefs: manifestField(snapshot.entitlementCatalogRefs),
          notCoveredAccessPaths: (Array.isArray(snapshot.notCoveredAccessPaths)
            ? snapshot.notCoveredAccessPaths
            : []
          )
            .filter((row) => isRecord(row))
            .map((row) => project(["id", "pathKind"], row))
            .sort((left, right) => byCodeUnit(String(left.id), String(right.id))),
        },
        assignmentRefs: manifestField(
          assignments.filter((row) => isRecord(row)).map((row) => row.id),
        ),
      };
    }
    default:
      return null;
  }
}

export function computeEvidencePayloadDigest(kind, source) {
  const payload = evidencePayloadProjection(kind, source);
  return payload === null ? null : sha256(canonicalJson({ kind, payload }));
}

export function computeEvidenceRecordDigest(row) {
  return sha256(canonicalJson(project(EVIDENCE_RECORD_FIELDS, row)));
}

// The controlled record URI ends in its own record digest, so the owner cannot
// change what a record says while keeping the reference that was reviewed.
export function contentAddressedControlledRef(row) {
  const source = object(row).controlledSource;
  const purpose = object(row).controlledPurpose;
  const token = computeEvidenceRecordDigest(row).slice("sha256:".length);
  return `controlled://${source}/${purpose}@sha256-${token}`;
}

function readLedger(value, field, label, findings) {
  const raw = value[field];
  if (!Array.isArray(raw)) {
    findings.push(
      finding("invalid_ledger_shape", field, `The ${label} ledger must be an array.`),
    );
    return [];
  }
  const rows = [];
  for (const [index, row] of raw.entries()) {
    if (!isRecord(row) || typeof row.id !== "string" || row.id.length === 0) {
      findings.push(
        finding(
          "invalid_ledger_shape",
          `${field}[${index}]`,
          `Every ${label} row must be an object carrying a string id.`,
        ),
      );
      continue;
    }
    rows.push(row);
  }
  return rows;
}

function assignmentKey(row) {
  const parts = [row.principalRef, row.resourceRef, row.entitlementRef, row.assignmentRef];
  return parts.every((part) => typeof part === "string" && part.length > 0)
    ? parts.join("|")
    : null;
}

export function accessEntitlementReviewFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [
      finding("invalid_review_artifact", "$", "The review artifact must be an object."),
    ];
  }
  if (value.schemaVersion !== ACCESS_ENTITLEMENT_REVIEW_SCHEMA_VERSION) {
    findings.push(
      finding(
        "invalid_review_artifact",
        "schemaVersion",
        `The artifact must declare ${ACCESS_ENTITLEMENT_REVIEW_SCHEMA_VERSION}.`,
      ),
    );
  }

  const ledgers = Object.fromEntries(
    LEDGERS.map(([field, label]) => [field, readLedger(value, field, label, findings)]),
  );
  const principals = ledgers.principals;
  const evidence = ledgers.evidence;
  const assignments = ledgers.assignments;
  const grants = ledgers.authorityGrants;
  const signals = ledgers.sourceSignals;
  const decisions = ledgers.decisions;
  const nonDecisions = ledgers.nonDecisions;
  const blockers = ledgers.blockers;

  const round = object(value.round);
  const snapshot = object(value.snapshot);
  const roster = object(value.authorityRoster);
  const reviewWindow = object(round.window);
  const cadence = object(round.cadence);
  const destination = object(round.destination);
  const boundary = object(round.authorityBoundary);
  const handoff = object(value.handoff);
  const accessPaths = Array.isArray(snapshot.notCoveredAccessPaths)
    ? snapshot.notCoveredAccessPaths.filter((row) => isRecord(row) && typeof row.id === "string")
    : [];
  const catalog = new Set(stringList(snapshot.entitlementCatalogRefs));

  const principalById = new Map(principals.map((row) => [row.id, row]));
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const assignmentById = new Map(assignments.map((row) => [row.id, row]));
  const grantById = new Map(grants.map((row) => [row.id, row]));
  const signalById = new Map(signals.map((row) => [row.id, row]));
  const decisionById = new Map(decisions.map((row) => [row.id, row]));
  const nonDecisionById = new Map(nonDecisions.map((row) => [row.id, row]));
  const blockerById = new Map(blockers.map((row) => [row.id, row]));

  const roundAsOf = milliseconds(round.asOf);
  const snapshotAsOf = milliseconds(snapshot.asOf);
  const opensAt = milliseconds(reviewWindow.opensAt);
  const closesAt = milliseconds(reviewWindow.closesAt);

  // One window rule for every human act in the round: strictly after the owner
  // snapshot cutoff, no earlier than the window opens, and no later than it
  // closes. The close bound is inclusive; the cutoff bound is not.
  function insideReviewWindow(instant) {
    const at = milliseconds(instant);
    return (
      at !== null &&
      snapshotAsOf !== null &&
      opensAt !== null &&
      closesAt !== null &&
      at > snapshotAsOf &&
      at >= opensAt &&
      at <= closesAt
    );
  }

  // Every controlled record is consumed exactly once by the ledger row it backs.
  // Orphans, shared registers, and second copies are all laundering vectors.
  const evidenceUse = new Map();
  function consume(ref) {
    if (typeof ref !== "string") return;
    evidenceUse.set(ref, (evidenceUse.get(ref) ?? 0) + 1);
  }

  function isNamedHuman(ref) {
    const principal = principalById.get(ref);
    return (
      principal?.kind === "named-human" &&
      typeof principal.name === "string" &&
      !BARE_ROLE.test(principal.name.trim())
    );
  }

  function evidenceMatches(
    ref,
    { kind, subjects, supplierRef, observedAt, observedNoLaterThan, payloadDigest },
  ) {
    const row = evidenceById.get(ref);
    if (!row || row.kind !== kind) return false;
    if (row.snapshotDigest !== snapshot.digest) return false;
    if (row.recordDigest !== computeEvidenceRecordDigest(row)) return false;
    if (row.controlledRef !== contentAddressedControlledRef(row)) return false;
    if (payloadDigest === null || row.payloadDigest !== payloadDigest) return false;
    if (!sameExactList(row.subjectRefs, subjects)) return false;
    if (supplierRef !== undefined && row.suppliedByRef !== supplierRef) return false;
    if (observedAt !== undefined && row.observedAt !== observedAt) return false;
    if (observedNoLaterThan !== undefined) {
      const seen = milliseconds(row.observedAt);
      const bound = milliseconds(observedNoLaterThan);
      if (seen === null || bound === null || seen > bound) return false;
    }
    return true;
  }

  function onlyEvidence(refs, expectation) {
    const declared = stringList(refs);
    return (
      Array.isArray(refs) &&
      refs.length === 1 &&
      declared.length === 1 &&
      evidenceMatches(declared[0], expectation)
    );
  }

  const allIds = [
    ...Object.values(ledgers).flat().map((row) => row.id),
    ...accessPaths.map((row) => row.id),
    round.id,
    snapshot.id,
    roster.id,
  ].filter((id) => typeof id === "string");
  const seenIds = new Set();
  for (const id of allIds) {
    if (seenIds.has(id)) {
      findings.push(
        finding("duplicate_review_id", "$", `Ledger id ${JSON.stringify(id)} must be globally unique.`),
      );
    }
    seenIds.add(id);
  }

  const manifestDigest = computeAssignmentManifestDigest(assignments);
  if (snapshot.digest !== manifestDigest) {
    findings.push(
      finding(
        "invalid_snapshot_manifest",
        "snapshot.digest",
        "The snapshot digest must be the recomputed digest of the exact owner assignment manifest; a changed row, scope flag, or row population with a stale digest is not the reviewed universe.",
      ),
    );
  }

  // Everyone this round actually acts through. The roster custodian and the
  // owner source system are trust roots precisely because they are outside it.
  const assignmentSubjectRefs = new Set(
    assignments.map((row) => row.principalRef).filter((ref) => typeof ref === "string"),
  );
  const operationalActorRefs = new Set(
    [
      ...assignmentSubjectRefs,
      ...grants.map((row) => row.granteeRef),
      ...grants.map((row) => row.grantedByRef),
      ...decisions.map((row) => row.decidedByRef),
      ...nonDecisions.map((row) => row.recordedByRef),
      ...blockers.map((row) => row.ownedByRef),
      destination.approvedByRef,
      round.handoffOwnerRef,
      handoff.nextOwnerRef,
    ].filter((ref) => typeof ref === "string"),
  );

  const rosterDigest = computeAuthorityRosterDigest(principals);
  const custodianRef = roster.custodianRef;
  consume(roster.evidenceRef);

  const rosterDigestOk = roster.rosterDigest === rosterDigest;
  if (!rosterDigestOk) {
    findings.push(
      finding(
        "invalid_authority_roster",
        "authorityRoster.rosterDigest",
        "The roster digest must be the recomputed digest of every principal id, name, kind, and exact scope set; a scope cannot appear behind an unchanged roster.",
      ),
    );
  }
  const rosterBoundaryOk =
    boundary.rosterRef === roster.id &&
    typeof roster.id === "string" &&
    boundary.basis === PERMITTED_AUTHORITY_BASIS;
  if (!rosterBoundaryOk) {
    findings.push(
      finding(
        "invalid_authority_roster",
        "round.authorityBoundary.rosterRef",
        "The round must name the exact owner-supplied roster it ran under and declare that roster owner-supplied rather than derived.",
      ),
    );
  }
  const custodianOk =
    isNamedHuman(custodianRef) &&
    stringList(principalById.get(custodianRef)?.scopes).length === 0 &&
    !operationalActorRefs.has(custodianRef) &&
    custodianRef !== snapshot.sourceSystemRef;
  if (!custodianOk) {
    findings.push(
      finding(
        "invalid_authority_roster",
        "authorityRoster.custodianRef",
        "The roster custodian must be a named human who holds no scope the roster confers and is not a reviewed subject, grant holder, grant issuer, decision maker, non-decision recorder, blocker owner, destination approver, handoff owner, or the owner source system.",
      ),
    );
  }
  const rosterEvidenceOk =
    evidenceMatches(roster.evidenceRef, {
      kind: "authority-roster-export",
      subjects: [roster.id, ...principals.map((row) => row.id)],
      supplierRef: custodianRef,
      observedNoLaterThan: round.asOf,
      payloadDigest: computeEvidencePayloadDigest("authority-roster-export", {
        authorityRoster: roster,
        principals,
      }),
    }) && evidenceById.get(roster.evidenceRef)?.controlledRef === roster.controlledRef;
  if (!rosterEvidenceOk) {
    findings.push(
      finding(
        "invalid_authority_roster",
        "authorityRoster.evidenceRef",
        "The roster needs exactly one content-addressed controlled export supplied by its custodian no later than the round cutoff, binding the exact roster digest, the exact roster identity and controlled reference, and every principal in the ledger as its semantic payload.",
      ),
    );
  }
  const rosterOk = rosterDigestOk && rosterBoundaryOk && custodianOk && rosterEvidenceOk;

  for (const [index, row] of principals.entries()) {
    const scopes = stringList(row.scopes);
    if (scopes.length === 0) continue;
    const humanScopes = scopes.filter((scope) => HUMAN_SCOPES.includes(scope));
    const systemScopes = scopes.filter((scope) => SYSTEM_SCOPES.includes(scope));
    const mixed = humanScopes.length > 0 && systemScopes.length > 0;
    if (
      mixed ||
      (humanScopes.length > 0 && !isNamedHuman(row.id)) ||
      (systemScopes.length > 0 && row.kind !== "system")
    ) {
      findings.push(
        finding(
          "invalid_principal_scope",
          `principals[${index}].scopes`,
          "A round-running scope belongs to a named human and a supplier scope belongs to a system principal; no principal may hold both classes.",
        ),
      );
    }
  }

  function holdsScope(ref, scope) {
    if (!rosterOk) return false;
    const principal = principalById.get(ref);
    if (!principal || !stringList(principal.scopes).includes(scope)) return false;
    return HUMAN_SCOPES.includes(scope) ? isNamedHuman(ref) : principal.kind === "system";
  }

  // Source signals enter the round from one declared owner system that can
  // supply and can never decide, approve, or hold review authority.
  const ownerSystemRef = snapshot.sourceSystemRef;
  const ownerSystemScopes = stringList(principalById.get(ownerSystemRef)?.scopes);
  const ownerSystemOk =
    holdsScope(ownerSystemRef, SNAPSHOT_SUPPLIER_SCOPE) &&
    holdsScope(ownerSystemRef, SIGNAL_SUPPLIER_SCOPE) &&
    ownerSystemScopes.every((scope) => SYSTEM_SCOPES.includes(scope)) &&
    !operationalActorRefs.has(ownerSystemRef);
  if (!ownerSystemOk) {
    findings.push(
      finding(
        "invalid_source_authority",
        "snapshot.sourceSystemRef",
        `The snapshot must name one roster-bound system principal holding ${SNAPSHOT_SUPPLIER_SCOPE} and ${SIGNAL_SUPPLIER_SCOPE} and nothing else, which never decides, approves, reviews, or is reviewed.`,
      ),
    );
  }

  if (round.snapshotRef !== snapshot.id || round.snapshotDigest !== snapshot.digest) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.snapshotDigest",
        "The round must bind the exact assignment snapshot id and digest it reviewed.",
      ),
    );
  }
  if (roundAsOf === null || snapshotAsOf === null || roundAsOf !== snapshotAsOf) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.asOf",
        "The round cutoff must equal the supplied snapshot as-of instant.",
      ),
    );
  }
  if (round.priorRoundRef === round.id) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.priorRoundRef",
        "A prior-round reference cannot name the current round.",
      ),
    );
  }
  if (
    opensAt === null ||
    closesAt === null ||
    roundAsOf === null ||
    opensAt < roundAsOf ||
    closesAt <= opensAt
  ) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.window",
        "The review window must open no earlier than the cutoff and close after it opens.",
      ),
    );
  }
  if (cadence.recertificationBasis !== PERMITTED_RECERTIFICATION_BASIS) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.cadence.recertificationBasis",
        `Every round recertifies from scratch; the cadence must declare ${PERMITTED_RECERTIFICATION_BASIS}.`,
      ),
    );
  }
  if (snapshot.coverageBasis !== "owner-declared-assignment-rows-only") {
    findings.push(
      finding(
        "invalid_round_binding",
        "snapshot.coverageBasis",
        "The snapshot may only claim owner-declared assignment rows as its coverage basis.",
      ),
    );
  }

  consume(round.exportEvidenceRef);
  if (snapshot.exportEvidenceRef !== round.exportEvidenceRef) {
    consume(snapshot.exportEvidenceRef);
    findings.push(
      finding(
        "invalid_round_binding",
        "snapshot.exportEvidenceRef",
        "One controlled export record covers the round and its snapshot; two competing exports mean two universes.",
      ),
    );
  }
  if (
    !evidenceMatches(round.exportEvidenceRef, {
      kind: "round-snapshot-export",
      subjects: [round.id, snapshot.id, ...assignments.map((row) => row.id)],
      supplierRef: ownerSystemRef,
      observedAt: round.asOf,
      payloadDigest: computeEvidencePayloadDigest("round-snapshot-export", {
        round,
        snapshot,
        assignments,
      }),
    })
  ) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.exportEvidenceRef",
        "The controlled export must come from the declared owner source system, bind the reviewed round and snapshot identity, cutoff, and digest as its semantic payload, and name the round, the snapshot, and every assignment row exactly.",
      ),
    );
  }

  for (const [field, expected] of [
    ["assignmentRefs", assignments.map((row) => row.id)],
    ["authorityGrantRefs", grants.map((row) => row.id)],
    ["sourceSignalRefs", signals.map((row) => row.id)],
    ["decisionRefs", decisions.map((row) => row.id)],
    ["nonDecisionRefs", nonDecisions.map((row) => row.id)],
    ["blockerRefs", blockers.map((row) => row.id)],
  ]) {
    if (!sameExactList(round[field], expected)) {
      findings.push(
        finding(
          "invalid_round_index",
          `round.${field}`,
          `The round index must name the exact ${field} ledger with no hidden, duplicate, or extra row.`,
        ),
      );
    }
  }

  if (
    typeof destination.controlledRef !== "string" ||
    destination.controlledRef.length === 0 ||
    destination.visibility !== "private"
  ) {
    findings.push(
      finding(
        "invalid_round_binding",
        "round.destination",
        "The round needs a private controlled destination.",
      ),
    );
  }
  if (!holdsScope(destination.approvedByRef, DESTINATION_SCOPE)) {
    findings.push(
      finding(
        "invalid_principal_scope",
        "round.destination.approvedByRef",
        `The destination approver must be a named human the roster-bound owner ledger grants ${DESTINATION_SCOPE}.`,
      ),
    );
  }

  // The handoff recipient is declared by the round and carries its own owner
  // scope. Receiving a recertification package for execution is an accountable
  // role, not a courtesy address on the last line.
  if (
    typeof round.handoffOwnerRef !== "string" ||
    handoff.nextOwnerRef !== round.handoffOwnerRef ||
    !holdsScope(handoff.nextOwnerRef, HANDOFF_SCOPE) ||
    assignmentSubjectRefs.has(handoff.nextOwnerRef)
  ) {
    findings.push(
      finding(
        "invalid_handoff_authority",
        "handoff.nextOwnerRef",
        `The handoff must go to the exact recipient the round declared, who must be a named human the roster-bound owner ledger grants ${HANDOFF_SCOPE} and who is not the subject of any reviewed assignment row.`,
      ),
    );
  }

  // Evidence totality: every controlled record resolves the exact row it claims
  // to support and binds that row's semantic payload, not just its envelope.
  function payloadSource(row) {
    const subjects = stringList(row.subjectRefs);
    const first = (index) => subjects.map((ref) => index.get(ref)).find((item) => item !== undefined);
    switch (row.kind) {
      case "assignment-record":
        return first(assignmentById);
      case "authority-grant-record":
        return first(grantById);
      case "decision-record":
        return first(decisionById);
      case "source-signal-record":
        return first(signalById);
      case "non-decision-record":
        return first(nonDecisionById);
      case "blocker-record":
        return first(blockerById);
      case "authority-roster-export":
        return { authorityRoster: roster, principals };
      case "round-snapshot-export":
        return { round, snapshot, assignments };
      default:
        return undefined;
    }
  }

  const controlledRefOwners = new Map();
  for (const [index, row] of evidence.entries()) {
    const observedAt = milliseconds(row.observedAt);
    if (
      !principalById.has(row.suppliedByRef) ||
      observedAt === null ||
      snapshotAsOf === null ||
      closesAt === null ||
      observedAt < snapshotAsOf ||
      observedAt > closesAt
    ) {
      findings.push(
        finding(
          "invalid_evidence_provenance",
          `evidence[${index}]`,
          "Evidence needs a known supplier and a timestamp inside the current snapshot-to-close interval.",
        ),
      );
    }
    if (row.snapshotDigest !== snapshot.digest) {
      findings.push(
        finding(
          "invalid_evidence_binding",
          `evidence[${index}].snapshotDigest`,
          "Every controlled record must bind the exact reviewed snapshot digest; a record raised against another snapshot proves nothing about this round.",
        ),
      );
    }
    const expectedPayload = computeEvidencePayloadDigest(row.kind, payloadSource(row));
    if (expectedPayload === null || row.payloadDigest !== expectedPayload) {
      findings.push(
        finding(
          "invalid_evidence_payload_binding",
          `evidence[${index}].payloadDigest`,
          "A controlled record must bind the exact canonical payload of the row it supports; an unchanged record can never support a changed decision state, authority interval, entitlement pair, signal value, non-decision, or blocker.",
        ),
      );
    }
    if (
      row.recordDigest !== computeEvidenceRecordDigest(row) ||
      row.controlledRef !== contentAddressedControlledRef(row)
    ) {
      findings.push(
        finding(
          "invalid_evidence_content_address",
          `evidence[${index}].controlledRef`,
          "A controlled record is content-addressed: its record digest must be the recomputed digest of its kind, controlled source and purpose, snapshot digest, instant, supplier, exact subjects, and payload digest, and its controlled reference must end in that exact digest.",
        ),
      );
    }
    if (typeof row.controlledRef === "string") {
      const owners = controlledRefOwners.get(row.controlledRef) ?? [];
      owners.push(row.id);
      controlledRefOwners.set(row.controlledRef, owners);
    }
  }
  for (const [ref, owners] of controlledRefOwners) {
    if (owners.length > 1) {
      findings.push(
        finding(
          "duplicate_controlled_record",
          "evidence",
          `Controlled record ${JSON.stringify(ref)} is declared by ${owners.length} evidence rows; one underlying controlled record has exactly one identity in this artifact.`,
        ),
      );
    }
  }

  const privilegeSupplied = snapshot.privilegeClassification === "supplied";
  const privilegeAbsent = snapshot.privilegeClassification === "absent";
  if (!privilegeSupplied && !privilegeAbsent) {
    findings.push(
      finding(
        "invalid_privilege_classification",
        "snapshot.privilegeClassification",
        "The snapshot must declare whether the owner supplied privilege classification.",
      ),
    );
  }

  function openBlockerCovers(code, targetRef) {
    return blockers.some(
      (row) =>
        row.code === code &&
        row.status === "open" &&
        stringList(row.targetRefs).includes(targetRef),
    );
  }

  if (privilegeAbsent && !openBlockerCovers(PRIVILEGE_ABSENT_BLOCKER, snapshot.id)) {
    findings.push(
      finding(
        "invalid_privilege_classification",
        "snapshot.privilegeClassification",
        `Absent privilege classification needs an open ${PRIVILEGE_ABSENT_BLOCKER} blocker naming the snapshot; absence never means not privileged.`,
      ),
    );
  }

  const inScopeByKey = new Map();
  const allAssignmentKeys = new Set();
  const excludedIds = [];
  const privilegeUnknownRows = [];
  for (const [index, row] of assignments.entries()) {
    const path = `assignments[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    if (row.snapshotRef !== snapshot.id) {
      findings.push(
        finding(
          "invalid_assignment_evidence",
          path,
          "Every assignment row must belong to the exact reviewed snapshot.",
        ),
      );
    }
    if (
      !onlyEvidence(row.evidenceRefs, {
        kind: "assignment-record",
        subjects: [row.id],
        supplierRef: ownerSystemRef,
        observedAt: snapshot.asOf,
        payloadDigest: computeEvidencePayloadDigest("assignment-record", row),
      })
    ) {
      findings.push(
        finding(
          "invalid_assignment_evidence",
          path,
          "Every assignment row needs exactly one content-addressed controlled record from the declared owner source system at the exact snapshot instant that binds the snapshot digest, that row's exact manifest payload, and that row alone.",
        ),
      );
    }
    if (!principalById.has(row.principalRef)) {
      findings.push(
        finding(
          "unknown_principal_reference",
          `${path}.principalRef`,
          "The assignment subject must exist in the supplied principal ledger.",
        ),
      );
    }
    if (row.grantedByRef !== null && !principalById.has(row.grantedByRef)) {
      findings.push(
        finding(
          "unknown_principal_reference",
          `${path}.grantedByRef`,
          "An owner-supplied grantor must exist in the supplied principal ledger.",
        ),
      );
    }
    if (typeof row.entitlementRef === "string" && !catalog.has(row.entitlementRef)) {
      findings.push(
        finding(
          "unknown_entitlement_catalog_ref",
          `${path}.entitlementRef`,
          "Every reviewed entitlement must appear in the owner-supplied entitlement catalog.",
        ),
      );
    }
    const key = assignmentKey(row);
    if (key !== null) {
      if (allAssignmentKeys.has(key)) {
        findings.push(
          finding(
            "duplicate_assignment_key",
            path,
            "An assignment key may appear only once across the complete owner-supplied manifest.",
          ),
        );
      }
      allAssignmentKeys.add(key);
    }
    if (row.inScope !== true) {
      excludedIds.push(row.id);
      if (row.privileged !== null) {
        findings.push(
          finding(
            "invalid_privilege_classification",
            `${path}.privileged`,
            "An excluded row is outside the reviewed universe and cannot assert a privilege classification.",
          ),
        );
      }
      if (typeof row.exclusionCode !== "string") {
        findings.push(
          finding(
            "excluded_assignment_laundering",
            `${path}.exclusionCode`,
            "An excluded row must stay visible carrying the owner-supplied exclusion code.",
          ),
        );
      }
      continue;
    }
    if (row.exclusionCode !== null) {
      findings.push(
        finding(
          "excluded_assignment_laundering",
          `${path}.exclusionCode`,
          "An in-scope row must not carry an exclusion code.",
        ),
      );
    }
    if (privilegeAbsent && row.privileged !== null) {
      findings.push(
        finding(
          "invalid_privilege_classification",
          `${path}.privileged`,
          "A row cannot supply privilege while the snapshot declares privilege classification absent.",
        ),
      );
    }
    if (privilegeSupplied && row.privileged === null) {
      privilegeUnknownRows.push(row.id);
      if (!openBlockerCovers(PRIVILEGE_UNKNOWN_BLOCKER, row.id)) {
        findings.push(
          finding(
            "invalid_privilege_classification",
            `${path}.privileged`,
            `Unknown privilege needs an open ${PRIVILEGE_UNKNOWN_BLOCKER} blocker naming the exact row; unknown is never not privileged.`,
          ),
        );
      }
    }
    if (key === null) {
      findings.push(
        finding(
          "invalid_assignment_evidence",
          path,
          "An in-scope row needs a complete principal, resource, entitlement, and assignment identity.",
        ),
      );
      continue;
    }
    if (inScopeByKey.has(key)) continue;
    inScopeByKey.set(key, row);
  }

  for (const [index, row] of grants.entries()) {
    const path = `authorityGrants[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    const activeFrom = milliseconds(row.activeFrom);
    const activeUntil = milliseconds(row.activeUntil);
    if (
      !isNamedHuman(row.granteeRef) ||
      !isNamedHuman(row.grantedByRef) ||
      row.granteeRef === row.grantedByRef ||
      activeFrom === null ||
      activeUntil === null ||
      snapshotAsOf === null ||
      activeFrom < snapshotAsOf ||
      closesAt === null ||
      activeUntil > closesAt ||
      activeFrom >= activeUntil ||
      !stringList(row.scopes).includes(DECISION_SCOPE) ||
      !onlyEvidence(row.evidenceRefs, {
        kind: "authority-grant-record",
        subjects: [row.id, row.granteeRef],
        supplierRef: row.grantedByRef,
        observedNoLaterThan: row.activeFrom,
        payloadDigest: computeEvidencePayloadDigest("authority-grant-record", row),
      })
    ) {
      findings.push(
        finding(
          "invalid_authority_grant",
          path,
          "A reviewer authority grant needs a named-human grantee, a different named-human issuer, an active interval contained by the current round, the review-decision scope, and exactly one content-addressed controlled record its issuer supplied no later than the instant the grant went live, binding that grant's exact holder, issuer, resource, entitlement, scope set, and interval.",
        ),
      );
    }
    if (!holdsScope(row.grantedByRef, ISSUER_SCOPE)) {
      findings.push(
        finding(
          "invalid_principal_scope",
          `${path}.grantedByRef`,
          `A reviewer authority grant may only be issued by a named human the roster-bound owner ledger grants ${ISSUER_SCOPE}.`,
        ),
      );
    }
    const issuerIsSubject = assignments.some(
      (assignmentRow) =>
        assignmentRow.principalRef === row.grantedByRef &&
        assignmentRow.resourceRef === row.resourceRef &&
        assignmentRow.entitlementRef === row.entitlementRef,
    );
    if (issuerIsSubject) {
      findings.push(
        finding(
          "subject_issued_authority_grant",
          `${path}.grantedByRef`,
          "The subject of a reviewed assignment may not issue the reviewer authority over that same resource and entitlement.",
        ),
      );
    }
  }

  for (const [index, row] of signals.entries()) {
    const path = `sourceSignals[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    const target = assignmentById.get(row.assignmentRowRef);
    if (
      !target ||
      target.inScope !== true ||
      row.roundRef !== round.id ||
      row.snapshotRef !== snapshot.id ||
      row.snapshotDigest !== snapshot.digest ||
      row.assignmentRef !== target.assignmentRef ||
      row.assignmentDigest !== target.assignmentDigest ||
      row.suppliedByRef !== ownerSystemRef ||
      !ownerSystemOk ||
      row.observedAt !== snapshot.asOf ||
      !onlyEvidence(row.evidenceRefs, {
        kind: "source-signal-record",
        subjects: [row.id, row.assignmentRowRef],
        supplierRef: ownerSystemRef,
        observedAt: row.observedAt,
        payloadDigest: computeEvidencePayloadDigest("source-signal-record", row),
      })
    ) {
      findings.push(
        finding(
          "invalid_signal_binding",
          path,
          "A source signal must come from the declared owner source system at the snapshot instant, name the current round, the current snapshot and its digest, one exact in-scope row with its current reference and row digest, and exactly one reciprocal content-addressed record binding that signal's exact typed value.",
        ),
      );
    }
    // The value surface is closed: a typed count or a typed recommendation code,
    // never an owner sentence the handoff would have to reproduce.
    const carriesDays = row.kind === "inactivity" || row.kind === "last-sign-in";
    const carriesRecommendation = row.kind === "recommendation";
    if (
      (carriesDays ? !Number.isInteger(row.inactiveDays) : row.inactiveDays !== null) ||
      (carriesRecommendation
        ? typeof row.recommendation !== "string"
        : row.recommendation !== null)
    ) {
      findings.push(
        finding(
          "invalid_signal_value",
          path,
          "A source signal carries exactly the typed value its kind defines: an inactive-day count for inactivity and last-sign-in, a recommendation code for a recommendation, and nothing at all otherwise.",
        ),
      );
    }
  }
  if (
    !sameExactList(handoff.renderedSignalRefs, signals.map((row) => row.id)) ||
    handoff.signalPresentation !== PERMITTED_SIGNAL_PRESENTATION
  ) {
    findings.push(
      finding(
        "invalid_signal_binding",
        "handoff.renderedSignalRefs",
        `Owner recommendations and signals are rendered, never consumed; the handoff must render exactly the supplied signal ledger under the constant ${PERMITTED_SIGNAL_PRESENTATION}.`,
      ),
    );
  }

  const terminalsByKey = new Map();
  function countTerminal(key) {
    if (key === null) return;
    terminalsByKey.set(key, (terminalsByKey.get(key) ?? 0) + 1);
  }

  function bindAssignment(row, path, code) {
    const target = assignmentById.get(row.assignmentRowRef);
    if (!target) {
      findings.push(
        finding(
          "invalid_assignment_binding",
          `${path}.assignmentRowRef`,
          "The referenced assignment row does not exist in the reviewed snapshot.",
        ),
      );
      return null;
    }
    if (target.inScope !== true) {
      findings.push(
        finding(
          code,
          `${path}.assignmentRowRef`,
          "An owner-excluded row is outside the reviewed universe and can carry no review record.",
        ),
      );
      return null;
    }
    if (
      row.assignmentRef !== target.assignmentRef ||
      row.assignmentDigest !== target.assignmentDigest
    ) {
      findings.push(
        finding(
          "invalid_assignment_binding",
          path,
          "A review record must bind the exact assignment reference and row digest it reviewed.",
        ),
      );
    }
    if (row.roundRef !== round.id) {
      findings.push(
        finding(
          "invalid_round_binding",
          `${path}.roundRef`,
          "A review record must bind the current round.",
        ),
      );
    }
    return target;
  }

  for (const [index, row] of decisions.entries()) {
    const path = `decisions[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    const target = bindAssignment(row, path, "excluded_assignment_laundering");
    if (target) countTerminal(assignmentKey(target));

    // A decision is about one exact reviewed universe. A resealed manifest is a
    // different universe, and every decision in it has to be taken again.
    if (row.snapshotDigest !== snapshot.digest) {
      findings.push(
        finding(
          "invalid_decision_snapshot_binding",
          `${path}.snapshotDigest`,
          "A current decision must bind the current snapshot manifest digest; a decision carrying a superseded manifest belongs to a universe this round no longer reviews.",
        ),
      );
    }

    if (
      row.decisionSource !== PERMITTED_DECISION_SOURCE ||
      row.decisionBasis !== PERMITTED_DECISION_BASIS ||
      row.replacementRequest !== null
    ) {
      findings.push(
        finding(
          "invalid_decision_source",
          `${path}.decisionSource`,
          "A recertification is an independent human act with no replacement lane; system defaults, auto-apply, no-response defaults, and accepted recommendations are never decisions.",
        ),
      );
    }
    if (!isNamedHuman(row.decidedByRef)) {
      findings.push(
        finding(
          "invalid_decision_maker",
          `${path}.decidedByRef`,
          "Only a named human may record a recertification decision; teams, services, systems, agents, and bare roles cannot.",
        ),
      );
    }
    if (target && row.decidedByRef === target.principalRef) {
      findings.push(
        finding(
          "self_review_not_permitted",
          `${path}.decidedByRef`,
          "A reviewer may not recertify their own assignment.",
        ),
      );
    }

    const decidedAt = milliseconds(row.decidedAt);
    const grant = grantById.get(row.authorityGrantRef);
    const grantFrom = milliseconds(grant?.activeFrom);
    const grantUntil = milliseconds(grant?.activeUntil);
    if (
      !grant ||
      !target ||
      grant.granteeRef !== row.decidedByRef ||
      grant.resourceRef !== target.resourceRef ||
      grant.entitlementRef !== target.entitlementRef ||
      !stringList(grant.scopes).includes(DECISION_SCOPE) ||
      decidedAt === null ||
      grantFrom === null ||
      grantUntil === null ||
      decidedAt < grantFrom ||
      decidedAt > grantUntil
    ) {
      findings.push(
        finding(
          "authority_grant_coverage_missing",
          `${path}.authorityGrantRef`,
          "Every decision maker needs an owner-supplied grant covering the exact resource and entitlement and active at the decision instant.",
        ),
      );
    }

    const privilegedRow = target?.privileged === true;
    if (row.privilegedReview !== privilegedRow) {
      findings.push(
        finding(
          "unsupported_privileged_sod_claim",
          `${path}.privilegedReview`,
          "A privileged-review assertion must match the owner-supplied privilege of the exact row.",
        ),
      );
    }
    if (row.privilegedReview === true) {
      if (!privilegeSupplied) {
        findings.push(
          finding(
            "unsupported_privileged_sod_claim",
            `${path}.privilegedReview`,
            "Privileged separation of duties cannot be asserted while the owner supplied no privilege classification.",
          ),
        );
      }
      if (
        !grant ||
        !stringList(grant.scopes).includes(PRIVILEGED_SCOPE) ||
        !target ||
        target.grantedByRef === null ||
        target.grantedByRef === undefined ||
        row.decidedByRef === target.grantedByRef
      ) {
        findings.push(
          finding(
            "privileged_review_separation_violated",
            path,
            "A privileged row needs a reviewer holding privileged-review scope who is neither the subject nor the owner-supplied grantor.",
          ),
        );
      }
    }

    const decisionEvidence = stringList(row.evidenceRefs);
    if (
      !onlyEvidence(row.evidenceRefs, {
        kind: "decision-record",
        subjects: [row.id, row.assignmentRowRef],
        supplierRef: row.decidedByRef,
        observedAt: row.decidedAt,
        payloadDigest: computeEvidencePayloadDigest("decision-record", row),
      })
    ) {
      findings.push(
        finding(
          "invalid_decision_evidence",
          `${path}.evidenceRefs`,
          "A decision needs exactly one content-addressed controlled decision record, authored by its named-human decider at the decision instant, binding the reviewed snapshot digest and that decision's exact state, source, basis, authority grant, row and round bindings, replacement request, and rendered signal set.",
        ),
      );
    }
    for (const ref of decisionEvidence) {
      const supporting = evidenceById.get(ref);
      if (supporting?.kind === "source-signal-record") {
        findings.push(
          finding(
            "recommendation_used_as_decision_evidence",
            `${path}.evidenceRefs`,
            "An owner recommendation or signal export is never terminal evidence for a decision.",
          ),
        );
      } else if (supporting?.kind !== "decision-record") {
        findings.push(
          finding(
            "invalid_decision_evidence",
            `${path}.evidenceRefs`,
            "Decision evidence must be a controlled decision record.",
          ),
        );
      }
    }
    for (const ref of stringList(row.sourceSignalRefs)) {
      if (decisionEvidence.includes(ref)) {
        findings.push(
          finding(
            "recommendation_used_as_decision_evidence",
            `${path}.sourceSignalRefs`,
            "A rendered signal may not double as the evidence that supports the decision.",
          ),
        );
      }
      const signal = signalById.get(ref);
      if (!signal || signal.assignmentRowRef !== row.assignmentRowRef) {
        findings.push(
          finding(
            "invalid_signal_binding",
            `${path}.sourceSignalRefs`,
            "A decision may render only signals the owner bound to the exact same assignment row.",
          ),
        );
      }
    }

    // There is no carry-forward lane. Every decision is taken inside this round
    // against this snapshot, so a new owner snapshot always costs a fresh human
    // recertification.
    if (!insideReviewWindow(row.decidedAt)) {
      findings.push(
        finding(
          "invalid_decision_chronology",
          `${path}.decidedAt`,
          "Every decision must be recorded after the snapshot cutoff, no earlier than the review window opens, and no later than the round closes.",
        ),
      );
    }

  }

  for (const [index, row] of nonDecisions.entries()) {
    const path = `nonDecisions[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    const target = bindAssignment(row, path, "excluded_assignment_laundering");
    if (target) countTerminal(assignmentKey(target));

    const recordedAt = milliseconds(row.recordedAt);
    if (
      !isNamedHuman(row.recordedByRef) ||
      !insideReviewWindow(row.recordedAt) ||
      (target && row.recordedByRef === target.principalRef) ||
      !onlyEvidence(row.evidenceRefs, {
        kind: "non-decision-record",
        subjects: [row.id, row.assignmentRowRef],
        supplierRef: row.recordedByRef,
        observedAt: row.recordedAt,
        payloadDigest: computeEvidencePayloadDigest("non-decision-record", row),
      })
    ) {
      findings.push(
        finding(
          "invalid_non_decision",
          path,
          "A non-decision must be recorded after the snapshot cutoff, no earlier than the window opens and no later than the round closes, by a named human who is not the subject, with exactly one content-addressed controlled record that person supplied at the recorded instant binding that non-decision's exact state and escalation.",
        ),
      );
    }
    // Recording that a row went unreviewed is itself an accountable act: it needs
    // this round's reviewer authority for that exact row, or the owner's explicit
    // round-coordinator scope.
    const recorderGrant = grants.find(
      (grantRow) =>
        grantRow.granteeRef === row.recordedByRef &&
        target &&
        grantRow.resourceRef === target.resourceRef &&
        grantRow.entitlementRef === target.entitlementRef &&
        stringList(grantRow.scopes).includes(DECISION_SCOPE) &&
        recordedAt !== null &&
        milliseconds(grantRow.activeFrom) !== null &&
        milliseconds(grantRow.activeUntil) !== null &&
        recordedAt >= milliseconds(grantRow.activeFrom) &&
        recordedAt <= milliseconds(grantRow.activeUntil),
    );
    if (!recorderGrant && !holdsScope(row.recordedByRef, COORDINATOR_SCOPE)) {
      findings.push(
        finding(
          "invalid_non_decision",
          `${path}.recordedByRef`,
          `A non-decision recorder needs this round's reviewer authority over that exact row or the owner-supplied ${COORDINATOR_SCOPE} scope.`,
        ),
      );
    }
    if (row.state === "escalated") {
      const escalation = row.escalation;
      const dueAt = milliseconds(escalation?.dueAt);
      const grant = grantById.get(escalation?.authorityGrantRef);
      const grantFrom = milliseconds(grant?.activeFrom);
      const grantUntil = milliseconds(grant?.activeUntil);
      if (
        !isRecord(escalation) ||
        !isNamedHuman(escalation.nextReviewerRef) ||
        escalation.nextReviewerRef === row.recordedByRef ||
        !target ||
        escalation.nextReviewerRef === target.principalRef ||
        !grant ||
        grant.granteeRef !== escalation.nextReviewerRef ||
        grant.resourceRef !== target.resourceRef ||
        grant.entitlementRef !== target.entitlementRef ||
        !stringList(grant.scopes).includes(DECISION_SCOPE) ||
        dueAt === null ||
        recordedAt === null ||
        closesAt === null ||
        dueAt <= recordedAt ||
        dueAt > closesAt ||
        grantFrom === null ||
        grantUntil === null ||
        dueAt < grantFrom ||
        dueAt > grantUntil
      ) {
        findings.push(
          finding(
            "invalid_non_decision",
            `${path}.escalation`,
            "An escalation must name a different named-human reviewer whose grant covers the exact resource and entitlement, at a due date after the record, inside that grant, and no later than the round closes.",
          ),
        );
      }
    } else if (row.escalation !== null) {
      findings.push(
        finding(
          "invalid_non_decision",
          `${path}.escalation`,
          "Only an escalated non-decision may name a next reviewer and due date.",
        ),
      );
    }
  }

  // A blocker is not free text: each one corresponds to exactly one owner-visible
  // gap that actually exists, and each gap is carried by exactly one blocker.
  const blockerConditions = new Map();
  if (privilegeAbsent) {
    blockerConditions.set(`${PRIVILEGE_ABSENT_BLOCKER}|${snapshot.id}`, 0);
  }
  for (const rowId of privilegeUnknownRows) {
    blockerConditions.set(`${PRIVILEGE_UNKNOWN_BLOCKER}|${rowId}`, 0);
  }
  for (const [index, row] of blockers.entries()) {
    const path = `blockers[${index}]`;
    for (const ref of stringList(row.evidenceRefs)) consume(ref);
    const targets = stringList(row.targetRefs);
    const key = targets.length === 1 ? `${row.code}|${targets[0]}` : null;
    if (key === null || !blockerConditions.has(key) || row.status !== "open") {
      findings.push(
        finding(
          "unsupported_blocker_condition",
          path,
          "A blocker must be open and name the exact single subject of a condition this round actually has; there is no resolution lane and no blocker without a gap.",
        ),
      );
    } else {
      blockerConditions.set(key, blockerConditions.get(key) + 1);
    }
    if (
      !holdsScope(row.ownedByRef, COORDINATOR_SCOPE) ||
      !insideReviewWindow(row.raisedAt) ||
      !onlyEvidence(row.evidenceRefs, {
        kind: "blocker-record",
        subjects: [row.id, ...targets],
        supplierRef: row.ownedByRef,
        observedAt: row.raisedAt,
        payloadDigest: computeEvidencePayloadDigest("blocker-record", row),
      })
    ) {
      findings.push(
        finding(
          "unsupported_blocker_condition",
          `${path}.ownedByRef`,
          `A blocker must be owned by a named human the roster-bound owner ledger grants ${COORDINATOR_SCOPE}, raised after the snapshot cutoff and inside the review window, and backed by exactly one content-addressed controlled record that person supplied binding that blocker's exact code, targets, status, and owner.`,
        ),
      );
    }
  }
  for (const [key, count] of blockerConditions) {
    if (count > 1) {
      findings.push(
        finding(
          "unsupported_blocker_condition",
          "blockers",
          `The gap ${JSON.stringify(key)} must be carried by exactly one open blocker.`,
        ),
      );
    }
  }

  for (const [key] of inScopeByKey) {
    const count = terminalsByKey.get(key) ?? 0;
    if (count === 0) {
      findings.push(
        finding(
          "missing_assignment_terminal",
          key,
          "Every in-scope assignment key needs one current retain or revoke decision or one exact non-decision.",
        ),
      );
    } else if (count > 1) {
      findings.push(
        finding(
          "duplicate_assignment_terminal",
          key,
          "An in-scope assignment key may carry only one decision or non-decision.",
        ),
      );
    }
  }
  if (!sameExactList(handoff.coveredAssignmentKeys, [...inScopeByKey.keys()])) {
    findings.push(
      finding(
        "incomplete_assignment_coverage",
        "handoff.coveredAssignmentKeys",
        "The coverage index must equal the exact owner-supplied in-scope assignment key set.",
      ),
    );
  }
  if (!sameExactList(handoff.excludedAssignmentRefs, excludedIds)) {
    findings.push(
      finding(
        "excluded_assignment_laundering",
        "handoff.excludedAssignmentRefs",
        "Every owner-excluded row must stay visibly accounted for in the exclusion index.",
      ),
    );
  }

  if (!sameExactList(accessPaths.map((row) => row.pathKind), REQUIRED_NOT_COVERED_PATH_KINDS)) {
    findings.push(
      finding(
        "incomplete_access_path_disclosure",
        "snapshot.notCoveredAccessPaths",
        `The snapshot must declare each of ${REQUIRED_NOT_COVERED_PATH_KINDS.join(", ")} exactly once; a subset is a quieter completeness claim, not a smaller disclosure.`,
      ),
    );
  }
  if (
    !sameExactList(handoff.renderedNotCoveredPathRefs, accessPaths.map((row) => row.id)) ||
    handoff.effectiveAccessCoverage !== "not-claimed"
  ) {
    findings.push(
      finding(
        "incomplete_access_path_disclosure",
        "handoff.renderedNotCoveredPathRefs",
        "The handoff must render every owner-declared not-covered access path and never claim effective-access coverage.",
      ),
    );
  }

  for (const [ref, uses] of evidenceUse) {
    if (!evidenceById.has(ref)) {
      findings.push(
        finding(
          "invalid_evidence_binding",
          "evidence",
          `Controlled record ${JSON.stringify(ref)} is referenced but absent from the evidence ledger.`,
        ),
      );
    } else if (uses > 1) {
      findings.push(
        finding(
          "invalid_evidence_binding",
          "evidence",
          `Controlled record ${JSON.stringify(ref)} is consumed ${uses} times; one record backs exactly one ledger row.`,
        ),
      );
    }
  }
  for (const row of evidence) {
    if ((evidenceUse.get(row.id) ?? 0) === 0) {
      findings.push(
        finding(
          "invalid_evidence_binding",
          "evidence",
          `Controlled record ${JSON.stringify(row.id)} backs no ledger row; an unconsumed record is provenance nobody claimed.`,
        ),
      );
    }
  }

  const blocking = [
    ...blockers.filter((row) => row.status === "open").map((row) => row.id),
    ...nonDecisions.map((row) => row.id),
  ];
  if (
    !sameExactList(handoff.blockingRefs, blocking) ||
    handoff.attestationClaim !== "not-claimed" ||
    handoff.complianceClaim !== "not-claimed"
  ) {
    findings.push(
      finding(
        "invalid_review_handoff",
        "handoff.blockingRefs",
        "Every open blocker and every non-decision must be indexed, and the handoff may claim no attestation or compliance.",
      ),
    );
  }
  const mustBlock = blocking.length > 0 || findings.length > 0;
  if (handoff.state !== (mustBlock ? "blocked" : "ready-for-owner-execution")) {
    findings.push(
      finding(
        "invalid_review_handoff",
        "handoff.state",
        "A round is ready for owner execution only when every in-scope row carries a valid decision and nothing blocks it.",
      ),
    );
  }

  const seen = new Set();
  return findings
    .filter((row) => {
      const signature = `${row.code}\u0000${row.path}\u0000${row.message}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .sort(
      (left, right) =>
        byCodeUnit(left.code, right.code) ||
        byCodeUnit(left.path, right.path) ||
        byCodeUnit(left.message, right.message),
    );
}
