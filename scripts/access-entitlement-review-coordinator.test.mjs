import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  accessEntitlementReviewFindings,
  computeAssignmentManifestDigest,
  computeAuthorityRosterDigest,
  computeEvidencePayloadDigest,
  computeEvidenceRecordDigest,
  contentAddressedControlledRef,
  evidencePayloadProjection,
  ROUND_SNAPSHOT_EXPORT_BOUND_FIELDS,
  ROUND_SNAPSHOT_EXPORT_DERIVED_FIELDS,
} from "./access-entitlement-review-coordinator.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/access-entitlement-review-coordinator/fixtures/access-entitlement-review.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/access-entitlement-review-coordinator/schemas/access-entitlement-review.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const FOREIGN_DIGEST = `sha256:${"f".repeat(64)}`;
const OWNER_SYSTEM = "principal-access-export-system";
const HANDOFF_OWNER = "principal-ruth-abara";
const CLOSES_AT = "2026-09-30T00:00:00Z";
const CUTOFF = "2026-09-01T00:00:00Z";
const CRM_KEY =
  "principal-leo-brandt|resource://crm-platform/prod|entitlement://crm-platform/case-reader|crm-asg-4417";

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

// Any defect also revokes readiness, so adversarial candidates declare the blocked
// handoff their defect implies. That keeps each assertion about the defect itself
// rather than about the readiness rule it trivially trips.
function broken(change) {
  return mutate((value) => {
    change(value);
    value.handoff.state = "blocked";
  });
}

// A controlled record binds the semantic payload of the exact row it supports.
// Resolving that row is how both the validator and these helpers know what the
// record is supposed to say.
function payloadSourceFor(value, row) {
  const subjects = row.subjectRefs ?? [];
  const find = (rows) => rows.find((item) => subjects.includes(item.id));
  switch (row.kind) {
    case "assignment-record":
      return find(value.assignments);
    case "authority-grant-record":
      return find(value.authorityGrants);
    case "decision-record":
      return find(value.decisions);
    case "source-signal-record":
      return find(value.sourceSignals);
    case "non-decision-record":
      return find(value.nonDecisions);
    case "blocker-record":
      return find(value.blockers);
    case "authority-roster-export":
      return { authorityRoster: value.authorityRoster, principals: value.principals };
    case "round-snapshot-export":
      return { round: value.round, snapshot: value.snapshot, assignments: value.assignments };
    default:
      return undefined;
  }
}

function sealEnvelope(row) {
  row.recordDigest = computeEvidenceRecordDigest(row);
  row.controlledRef = contentAddressedControlledRef(row);
  return row;
}

function sealRecord(value, row) {
  const digest = computeEvidencePayloadDigest(row.kind, payloadSourceFor(value, row));
  if (digest !== null) row.payloadDigest = digest;
  return sealEnvelope(row);
}

function syncRosterRef(value) {
  const rosterRecord = value.evidence.find(
    (row) => row.id === value.authorityRoster.evidenceRef,
  );
  if (rosterRecord) value.authorityRoster.controlledRef = rosterRecord.controlledRef;
  return value;
}

// An honest owner re-issue: recompute every semantic payload, then every record
// digest and controlled reference. Adversarial candidates skip one layer or all
// of it, so a stale binding is what the validator sees.
function sealAll(value) {
  for (const row of value.evidence) sealRecord(value, row);
  return syncRosterRef(value);
}

function sealEnvelopesOnly(value) {
  for (const row of value.evidence) sealEnvelope(row);
  return syncRosterRef(value);
}

function reseal(value) {
  const digest = computeAssignmentManifestDigest(value.assignments);
  value.snapshot.digest = digest;
  value.round.snapshotDigest = digest;
  for (const row of value.evidence) row.snapshotDigest = digest;
  for (const row of value.decisions) row.snapshotDigest = digest;
  for (const row of value.sourceSignals) row.snapshotDigest = digest;
  return sealAll(value);
}

function resealHeaderOnly(value) {
  const digest = computeAssignmentManifestDigest(value.assignments);
  value.snapshot.digest = digest;
  value.round.snapshotDigest = digest;
  return value;
}

// The custodian re-issuing the roster is the only legitimate way a scope moves.
function resealRoster(value) {
  value.authorityRoster.rosterDigest = computeAuthorityRosterDigest(value.principals);
  const rosterRecord = value.evidence.find(
    (row) => row.id === value.authorityRoster.evidenceRef,
  );
  rosterRecord.subjectRefs = [
    value.authorityRoster.id,
    ...value.principals.map((row) => row.id),
  ];
  return sealAll(value);
}

function codes(candidate) {
  return new Set(accessEntitlementReviewFindings(candidate).map((row) => row.code));
}

function sortedCodes(candidate) {
  return [...codes(candidate)].sort();
}

function assertSchemaValid(candidate, label) {
  assert.equal(
    validateSchema(candidate),
    true,
    `${label}: ${JSON.stringify(validateSchema.errors)}`,
  );
}

function assertSchemaInvalid(candidate, label) {
  assert.equal(validateSchema(candidate), false, `${label} should be rejected by the schema`);
}

function decision(candidate, id) {
  return candidate.decisions.find((row) => row.id === id);
}

function grant(candidate, id) {
  return candidate.authorityGrants.find((row) => row.id === id);
}

function evidenceRow(candidate, id) {
  return candidate.evidence.find((row) => row.id === id);
}

function assignment(candidate, id) {
  return candidate.assignments.find((row) => row.id === id);
}

function principal(candidate, id) {
  return candidate.principals.find((row) => row.id === id);
}

function signal(candidate, id) {
  return candidate.sourceSignals.find((row) => row.id === id);
}

function dropDecision(value, id) {
  value.decisions = value.decisions.filter((row) => row.id !== id);
  value.round.decisionRefs = value.round.decisionRefs.filter((ref) => ref !== id);
  const consumed = fixture.decisions.find((row) => row.id === id)?.evidenceRefs ?? [];
  value.evidence = value.evidence.filter((row) => !consumed.includes(row.id));
}

function dropSignal(value, id) {
  const consumed = fixture.sourceSignals.find((row) => row.id === id)?.evidenceRefs ?? [];
  value.sourceSignals = value.sourceSignals.filter((row) => row.id !== id);
  value.round.sourceSignalRefs = value.round.sourceSignalRefs.filter((ref) => ref !== id);
  value.handoff.renderedSignalRefs = value.handoff.renderedSignalRefs.filter(
    (ref) => ref !== id,
  );
  value.evidence = value.evidence.filter((row) => !consumed.includes(row.id));
}

function addDecision(value, options) {
  const {
    id,
    rowRef,
    decidedByRef,
    decidedAt,
    authorityGrantRef,
    state = "retain",
    privilegedReview = false,
  } = options;
  const row = assignment(value, rowRef);
  const evidenceId = `evidence-${id}`;
  value.decisions.push({
    id,
    roundRef: "round-2026-q3",
    snapshotDigest: value.snapshot.digest,
    assignmentRowRef: rowRef,
    assignmentRef: row.assignmentRef,
    assignmentDigest: row.assignmentDigest,
    state,
    decisionBasis: "independent-human-judgment",
    decisionSource: "named-human-review",
    decidedByRef,
    decidedAt,
    authorityGrantRef,
    privilegedReview,
    replacementRequest: null,
    sourceSignalRefs: [],
    evidenceRefs: [evidenceId],
  });
  value.round.decisionRefs.push(id);
  value.evidence.push(
    sealRecord(value, {
      id: evidenceId,
      kind: "decision-record",
      controlledSource: "access-reviews",
      controlledPurpose: `2026-q3/${id}`,
      controlledRef: null,
      recordDigest: null,
      payloadDigest: null,
      observedAt: decidedAt,
      suppliedByRef: decidedByRef,
      snapshotDigest: value.snapshot.digest,
      subjectRefs: [id, rowRef],
    }),
  );
}

function addNonDecision(value, options) {
  const {
    id,
    rowRef,
    recordedByRef,
    recordedAt,
    state = "not-reviewed",
    escalation = null,
    withEvidence = true,
  } = options;
  const row = assignment(value, rowRef);
  const evidenceId = `evidence-${id}`;
  value.nonDecisions.push({
    id,
    roundRef: "round-2026-q3",
    assignmentRowRef: rowRef,
    assignmentRef: row.assignmentRef,
    assignmentDigest: row.assignmentDigest,
    state,
    recordedByRef,
    recordedAt,
    escalation,
    evidenceRefs: withEvidence ? [evidenceId] : [],
  });
  value.round.nonDecisionRefs.push(id);
  value.handoff.blockingRefs.push(id);
  if (withEvidence) {
    value.evidence.push(
      sealRecord(value, {
        id: evidenceId,
        kind: "non-decision-record",
        controlledSource: "access-reviews",
        controlledPurpose: `2026-q3/${id}`,
        controlledRef: null,
        recordDigest: null,
        payloadDigest: null,
        observedAt: recordedAt,
        suppliedByRef: recordedByRef,
        snapshotDigest: value.snapshot.digest,
        subjectRefs: [id, rowRef],
      }),
    );
  }
}

function addBlocker(value, options) {
  const {
    id,
    code,
    targetRefs,
    ownedByRef = "principal-omar-diaz",
    raisedAt = "2026-09-02T00:00:00Z",
  } = options;
  const evidenceId = `evidence-${id}`;
  value.blockers.push({
    id,
    code,
    targetRefs,
    status: "open",
    ownedByRef,
    raisedAt,
    evidenceRefs: [evidenceId],
  });
  value.round.blockerRefs.push(id);
  value.handoff.blockingRefs.push(id);
  value.evidence.push(
    sealRecord(value, {
      id: evidenceId,
      kind: "blocker-record",
      controlledSource: "access-reviews",
      controlledPurpose: `2026-q3/${id}`,
      controlledRef: null,
      recordDigest: null,
      payloadDigest: null,
      observedAt: raisedAt,
      suppliedByRef: ownedByRef,
      snapshotDigest: value.snapshot.digest,
      subjectRefs: [id, ...targetRefs],
    }),
  );
}

// A round exercising all eight controlled record kinds at once.
function everyEvidenceKind(value) {
  assignment(value, "assignment-crm-reader-leo").privileged = null;
  dropDecision(value, "decision-warehouse-analyst-retain");
  reseal(value);
  addBlocker(value, {
    id: "blocker-crm-privilege-unknown",
    code: "assignment-privilege-unknown",
    targetRefs: ["assignment-crm-reader-leo"],
  });
  addNonDecision(value, {
    id: "non-decision-warehouse-coordinator",
    rowRef: "assignment-warehouse-analyst-leo",
    recordedByRef: "principal-omar-diaz",
    recordedAt: "2026-09-20T00:00:00Z",
  });
  value.handoff.state = "blocked";
  return value;
}

test("the complete round is schema-strict and semantically clean", () => {
  assertSchemaValid(fixture, "fixture");
  assert.deepEqual(accessEntitlementReviewFindings(fixture), []);
  assert.equal(fixture.handoff.state, "ready-for-owner-execution");
  assert.equal(
    fixture.snapshot.digest,
    computeAssignmentManifestDigest(fixture.assignments),
  );
  assert.equal(
    fixture.authorityRoster.rosterDigest,
    computeAuthorityRosterDigest(fixture.principals),
  );
  for (const row of fixture.evidence) {
    assert.equal(row.recordDigest, computeEvidenceRecordDigest(row));
    assert.equal(row.controlledRef, contentAddressedControlledRef(row));
    assert.equal(
      row.payloadDigest,
      computeEvidencePayloadDigest(row.kind, payloadSourceFor(fixture, row)),
    );
  }

  assertSchemaInvalid(
    mutate((value) => {
      value.unexpected = true;
    }),
    "unknown top-level property",
  );
  assertSchemaInvalid(
    mutate((value) => {
      decision(value, "decision-crm-reader-retain").confidence = 0.9;
    }),
    "unknown decision property",
  );
});

test("the exercised round covers every declared distinctness case", () => {
  const crm = decision(fixture, "decision-crm-reader-retain");
  const payments = decision(fixture, "decision-payments-admin-revoke");
  const warehouse = decision(fixture, "decision-warehouse-analyst-retain");
  assert.equal(assignment(fixture, crm.assignmentRowRef).resolutionMode, "direct");
  assert.equal(assignment(fixture, crm.assignmentRowRef).privileged, false);
  assert.equal(crm.state, "retain");
  assert.equal(assignment(fixture, payments.assignmentRowRef).resolutionMode, "owner-expanded");
  assert.equal(assignment(fixture, payments.assignmentRowRef).privileged, true);
  assert.equal(payments.state, "revoke");
  assert.notEqual(payments.decidedByRef, assignment(fixture, payments.assignmentRowRef).principalRef);
  assert.notEqual(payments.decidedByRef, assignment(fixture, payments.assignmentRowRef).grantedByRef);
  assert.equal(warehouse.state, "retain");

  // Every decision is this round's work: three distinct named humans, three
  // instants inside the window, and nothing inherited from an earlier round.
  assert.equal(fixture.decisions.length, 3);
  assert.equal(new Set(fixture.decisions.map((row) => row.decidedByRef)).size, 3);
  for (const row of fixture.decisions) {
    assert.equal(row.decisionBasis, "independent-human-judgment");
    assert.equal(row.decisionSource, "named-human-review");
    assert.equal(row.snapshotDigest, fixture.snapshot.digest);
    assert.ok(Date.parse(row.decidedAt) > Date.parse(fixture.snapshot.asOf));
    assert.ok(Date.parse(row.decidedAt) >= Date.parse(fixture.round.window.opensAt));
    assert.ok(Date.parse(row.decidedAt) <= Date.parse(fixture.round.window.closesAt));
    assert.equal(Object.hasOwn(row, "origin"), false);
    assert.equal(Object.hasOwn(row, "carryForwardRef"), false);
  }
  assert.equal(Object.hasOwn(fixture, "carryForwards"), false);
  assert.equal(fixture.round.cadence.recertificationBasis, "fresh-decision-each-round");

  assert.equal(fixture.principals.length, 16);
  assert.equal(fixture.evidence.length, 16);
  assert.equal(new Set(fixture.evidence.map((row) => row.controlledRef)).size, 16);
  assert.equal(new Set(fixture.evidence.map((row) => row.payloadDigest)).size, 16);
  assert.equal(fixture.handoff.nextOwnerRef, fixture.round.handoffOwnerRef);
  assert.equal(fixture.assignments.filter((row) => row.inScope === false).length, 1);
  assert.ok(fixture.sourceSignals.some((row) => row.kind === "inactivity"));
  assert.ok(fixture.sourceSignals.some((row) => row.kind === "recommendation"));
  assert.deepEqual(
    fixture.snapshot.notCoveredAccessPaths.map((row) => row.pathKind).sort(),
    [
      "break-glass-account",
      "effective-access-computation",
      "external-federated-access",
      "inherited-group-membership",
      "nested-group-expansion",
      "standing-role-assignment",
    ],
  );
  assert.equal(fixture.nonDecisions.length, 0);
  assert.equal(fixture.blockers.length, 0);
});

test("only retain and revoke are decisions and no outcome lane exists", () => {
  for (const state of ["modify", "certify", "approve", "complete"]) {
    assertSchemaInvalid(
      mutate((value) => {
        decision(value, "decision-crm-reader-retain").state = state;
      }),
      `decision state ${state}`,
    );
  }
  for (const state of ["complete", "applied", "certified"]) {
    assertSchemaInvalid(
      mutate((value) => {
        value.handoff.state = state;
      }),
      `handoff state ${state}`,
    );
  }
  assertSchemaInvalid(
    mutate((value) => {
      value.handoff.effectiveAccessCoverage = "complete";
    }),
    "effective access completeness",
  );
  assertSchemaInvalid(
    mutate((value) => {
      value.handoff.attestationClaim = "claimed";
    }),
    "attestation claim",
  );
});

test("the validator is total over malformed inputs", () => {
  for (const candidate of [
    null,
    undefined,
    [],
    {},
    "round",
    42,
    { schemaVersion: "awesomeClaws.accessEntitlementReview.spike.v1" },
    { round: "q3", snapshot: null, assignments: 7, decisions: "none", handoff: [] },
    { ...structuredClone(fixture), assignments: [null, 3, { id: 4 }], evidence: {} },
    { ...structuredClone(fixture), principals: [{ id: "p", scopes: 3 }] },
    { ...structuredClone(fixture), authorityRoster: "roster" },
  ]) {
    assert.doesNotThrow(() => accessEntitlementReviewFindings(candidate));
    assert.ok(accessEntitlementReviewFindings(candidate).length > 0);
  }
  assert.equal(evidencePayloadProjection("carry-forward-source", {}), null);
  assert.equal(computeEvidencePayloadDigest("carry-forward-source", {}), null);
  assert.equal(computeEvidencePayloadDigest("decision-record", undefined), null);
  assert.equal(computeEvidencePayloadDigest("authority-roster-export", {}), null);
});

test("canonical digests order by code unit and never by process locale", () => {
  // Danish collation sorts "aa" after "z"; the default and en-US collations do
  // not. Any digest built with localeCompare therefore depends on whose machine
  // recomputed it, which makes it useless as a shared binding.
  assert.equal(Math.sign("aa".localeCompare("z", "da-DK")), 1);
  assert.equal(Math.sign("aa".localeCompare("z", "en-US")), -1);

  const codeUnit = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
  const danish = (left, right) => left.localeCompare(right, "da-DK");

  // An independent oracle: the same canonical serialisation, with the row and
  // array ordering supplied explicitly rather than taken from the implementation.
  function oracleCanonical(value) {
    if (Array.isArray(value)) return `[${value.map(oracleCanonical).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort(codeUnit)
        .map((key) => `${JSON.stringify(key)}:${oracleCanonical(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }
  function oracleDigest(rows, fields, comparator) {
    const projected = rows
      .map((row) =>
        Object.fromEntries(
          fields.map((field) => {
            const raw = row[field];
            if (Array.isArray(raw)) return [field, [...raw].map(String).sort(comparator)];
            return [field, raw === undefined ? null : raw];
          }),
        ),
      )
      .sort((left, right) => comparator(String(left.id), String(right.id)));
    return `sha256:${createHash("sha256").update(oracleCanonical(projected)).digest("hex")}`;
  }

  const ASSIGNMENT_FIELDS = [
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
  const collationRows = ["aa", "ab", "z"].map((token) => ({
    id: `assignment-${token}-row`,
    snapshotRef: "snapshot-collation",
    principalRef: `principal-${token}-holm`,
    resourceRef: "resource://crm-platform/prod",
    entitlementRef: "entitlement://crm-platform/case-reader",
    assignmentRef: `crm-asg-${token}`,
    assignmentDigest: `sha256:${"a".repeat(64)}`,
    inScope: true,
    exclusionCode: null,
    resolutionMode: "direct",
    privileged: false,
    grantedByRef: "principal-iris-tanaka",
    evidenceRefs: [`evidence-${token}`],
  }));

  const manifest = computeAssignmentManifestDigest(collationRows);
  assert.equal(manifest, oracleDigest(collationRows, ASSIGNMENT_FIELDS, codeUnit));
  assert.notEqual(manifest, oracleDigest(collationRows, ASSIGNMENT_FIELDS, danish));
  for (const permutation of [
    [2, 1, 0],
    [1, 2, 0],
    [0, 2, 1],
  ]) {
    assert.equal(
      computeAssignmentManifestDigest(permutation.map((index) => collationRows[index])),
      manifest,
    );
  }

  const ROSTER_FIELDS = ["id", "name", "kind", "scopes"];
  const collationPrincipals = ["aa", "ab", "z"].map((token) => ({
    id: `principal-${token}-holm`,
    name: `${token.toUpperCase()} Holm`,
    kind: "named-human",
    scopes: [],
  }));
  const rosterDigest = computeAuthorityRosterDigest(collationPrincipals);
  assert.equal(rosterDigest, oracleDigest(collationPrincipals, ROSTER_FIELDS, codeUnit));
  assert.notEqual(rosterDigest, oracleDigest(collationPrincipals, ROSTER_FIELDS, danish));
  for (const permutation of [
    [2, 1, 0],
    [1, 2, 0],
    [0, 2, 1],
  ]) {
    assert.equal(
      computeAuthorityRosterDigest(permutation.map((index) => collationPrincipals[index])),
      rosterDigest,
    );
  }

  // Array-valued fields sort the same way, so a reordered scope or evidence list
  // is the same manifest under any locale.
  assert.equal(
    computeAuthorityRosterDigest([
      { id: "principal-aa-holm", name: "AA Holm", kind: "named-human", scopes: ["review-round-coordinator", "review-authority-issuer"] },
    ]),
    computeAuthorityRosterDigest([
      { id: "principal-aa-holm", name: "AA Holm", kind: "named-human", scopes: ["review-authority-issuer", "review-round-coordinator"] },
    ]),
  );
});

test("the artifact has no narrative surface for a claim to hide in", () => {
  // Nothing in the machine record is prose, so there is nothing to scan. The
  // only free-text values are principal display names.
  const strings = [];
  (function walk(node, path) {
    if (typeof node === "string") {
      strings.push([path, node]);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, item] of Object.entries(node)) walk(item, `${path}.${key}`);
    }
  })(fixture, "$");
  const prosed = strings.filter(
    ([path, text]) => text.includes(" ") && !/^\$\.principals\[\d+\]\.name$/u.test(path),
  );
  assert.deepEqual(prosed, []);

  const PROSE_FIELDS = [
    "note",
    "notes",
    "summary",
    "rationale",
    "justification",
    "reason",
    "exclusionReason",
    "renderedText",
    "narrative",
    "comment",
    "description",
  ];
  (function walkFields(node) {
    if (Array.isArray(node)) {
      for (const item of node) walkFields(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const field of PROSE_FIELDS) {
        assert.equal(Object.hasOwn(node, field), false, `unexpected ${field}`);
      }
      for (const item of Object.values(node)) walkFields(item);
    }
  })(fixture);

  // Each demonstrated laundering sentence now fails at the schema because the
  // field it needed does not exist, rather than at a phrase regex.
  for (const [label, change] of [
    [
      "handoff execution summary",
      (value) => {
        value.handoff.summary =
          "The owner executed every revoke and this round is certified and audit-ready.";
      },
    ],
    [
      "decision automation note",
      (value) => {
        decision(value, "decision-crm-reader-retain").note =
          "I accepted the automated recommendation and let it make this retain decision for the row.";
      },
    ],
    [
      "decision rationale prose",
      (value) => {
        decision(value, "decision-crm-reader-retain").rationale =
          "Access certified under least privilege.";
      },
    ],
    [
      "signal rendered text",
      (value) => {
        signal(value, "signal-crm-inactivity").renderedText =
          "Access revoked and the entitlement was removed by the platform.";
      },
    ],
    [
      "access path note",
      (value) => {
        value.snapshot.notCoveredAccessPaths[0].note =
          "Effective access was verified out of band and is compliant.";
      },
    ],
    [
      "assignment exclusion prose",
      (value) => {
        assignment(value, "assignment-billing-writer-service").exclusionReason =
          "Reviewed elsewhere and already attested.";
      },
    ],
    [
      "replacement prose",
      (value) => {
        decision(value, "decision-payments-admin-revoke").replacementRequest = {
          justification: "The owner already applied the replacement grant.",
        };
      },
    ],
    [
      "roster prose",
      (value) => {
        value.authorityRoster.note = "The custodian is trusted and non-repudiation holds.";
      },
    ],
    [
      "non-decision prose",
      (value) => {
        dropDecision(value, "decision-crm-reader-retain");
        addNonDecision(value, {
          id: "non-decision-crm-reader-not-reviewed",
          rowRef: "assignment-crm-reader-leo",
          recordedByRef: "principal-omar-diaz",
          recordedAt: "2026-09-20T00:00:00Z",
        });
        value.nonDecisions[0].note = "Nobody reviewed it, but the campaign is compliant.";
      },
    ],
    [
      "blocker prose",
      (value) => {
        assignment(value, "assignment-crm-reader-leo").privileged = null;
        reseal(value);
        addBlocker(value, {
          id: "blocker-crm-privilege-unknown",
          code: "assignment-privilege-unknown",
          targetRefs: ["assignment-crm-reader-leo"],
        });
        value.blockers[0].note = "Risk accepted by the owner.";
      },
    ],
    [
      "outcome lane",
      (value) => {
        value.outcomes = [];
      },
    ],
    [
      "certificate lane",
      (value) => {
        value.handoff.certificateRef = "controlled://access-reviews/2026-q3/certificate.json";
      },
    ],
    [
      "applied timestamp",
      (value) => {
        decision(value, "decision-payments-admin-revoke").appliedAt = "2026-09-06T00:00:00Z";
      },
    ],
    [
      "signal presentation rewritten",
      (value) => {
        value.handoff.signalPresentation = "owner-recommendation-accepted";
      },
    ],
  ]) {
    assertSchemaInvalid(mutate(change), label);
  }
});

test("the snapshot digest is the recomputed owner assignment manifest", () => {
  // A scope transition with every index honestly updated is still refused while
  // the manifest the owner signed says otherwise.
  const scopeTransition = broken((value) => {
    const row = assignment(value, "assignment-warehouse-analyst-leo");
    row.inScope = false;
    row.exclusionCode = "owner-withdrew-row";
    dropDecision(value, "decision-warehouse-analyst-retain");
    dropSignal(value, "signal-warehouse-recommendation");
    value.handoff.coveredAssignmentKeys = value.handoff.coveredAssignmentKeys.filter(
      (key) => !key.includes("dwh-asg-0091"),
    );
    value.handoff.excludedAssignmentRefs.push(row.id);
  });
  assertSchemaValid(scopeTransition, "scope transition with a stale manifest");
  assert.ok(codes(scopeTransition).has("invalid_snapshot_manifest"));

  const rowDigestChanged = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").assignmentDigest = FOREIGN_DIGEST;
    decision(value, "decision-crm-reader-retain").assignmentDigest = FOREIGN_DIGEST;
    signal(value, "signal-crm-inactivity").assignmentDigest = FOREIGN_DIGEST;
  });
  assertSchemaValid(rowDigestChanged, "row digest changed with a stale manifest");
  assert.ok(codes(rowDigestChanged).has("invalid_snapshot_manifest"));

  const staleEvidence = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").assignmentDigest = FOREIGN_DIGEST;
    decision(value, "decision-crm-reader-retain").assignmentDigest = FOREIGN_DIGEST;
    signal(value, "signal-crm-inactivity").assignmentDigest = FOREIGN_DIGEST;
    resealHeaderOnly(value);
  });
  assertSchemaValid(staleEvidence, "manifest resealed while evidence stays stale");
  assert.ok(codes(staleEvidence).has("invalid_evidence_binding"));
  assert.ok(!codes(staleEvidence).has("invalid_snapshot_manifest"));

  const hiddenRow = broken((value) => {
    value.assignments = value.assignments.filter(
      (row) => row.id !== "assignment-billing-writer-service",
    );
    value.round.assignmentRefs = value.round.assignmentRefs.filter(
      (ref) => ref !== "assignment-billing-writer-service",
    );
    value.evidence = value.evidence.filter(
      (row) => row.id !== "evidence-assignment-billing-writer",
    );
    const exportRow = evidenceRow(value, "evidence-round-snapshot-export");
    exportRow.subjectRefs = exportRow.subjectRefs.filter(
      (ref) => ref !== "assignment-billing-writer-service",
    );
    sealRecord(value, exportRow);
    value.handoff.excludedAssignmentRefs = [];
  });
  assertSchemaValid(hiddenRow, "row population shrunk without an owner re-export");
  assert.ok(codes(hiddenRow).has("invalid_snapshot_manifest"));
});

test("every controlled record is content-addressed and singly identified", () => {
  const payloadChanged = broken((value) => {
    evidenceRow(value, "evidence-decision-crm-retain").observedAt = "2026-09-04T14:21:00Z";
  });
  assertSchemaValid(payloadChanged, "record payload changed under an unchanged URI");
  assert.ok(codes(payloadChanged).has("invalid_evidence_content_address"));

  const digestOnly = broken((value) => {
    evidenceRow(value, "evidence-decision-crm-retain").recordDigest = FOREIGN_DIGEST;
  });
  assertSchemaValid(digestOnly, "record digest asserted rather than recomputed");
  assert.ok(codes(digestOnly).has("invalid_evidence_content_address"));

  const relabelled = broken((value) => {
    evidenceRow(value, "evidence-decision-crm-retain").controlledPurpose =
      "2026-q3/decision-crm-asg-4417-final";
  });
  assertSchemaValid(relabelled, "controlled purpose moved without a new address");
  assert.ok(codes(relabelled).has("invalid_evidence_content_address"));

  // Two evidence ids, one underlying controlled record. Different local ids do
  // not make it two independent pieces of provenance.
  const duplicateControlledRef = broken((value) => {
    const source = evidenceRow(value, "evidence-decision-crm-retain");
    const copy = structuredClone(source);
    copy.id = "evidence-decision-crm-retain-duplicate";
    value.evidence.push(copy);
    decision(value, "decision-crm-reader-retain").evidenceRefs.push(copy.id);
  });
  assertSchemaValid(duplicateControlledRef, "duplicate controlled record");
  assert.ok(codes(duplicateControlledRef).has("duplicate_controlled_record"));

  const forgedAddress = broken((value) => {
    evidenceRow(value, "evidence-decision-crm-retain").controlledRef =
      `controlled://access-reviews/2026-q3/decision-crm-asg-4417@sha256-${"0".repeat(64)}`;
  });
  assertSchemaValid(forgedAddress, "controlled reference not ending in its record digest");
  assert.ok(codes(forgedAddress).has("invalid_evidence_content_address"));

  assertSchemaInvalid(
    mutate((value) => {
      evidenceRow(value, "evidence-decision-crm-retain").controlledRef =
        "controlled://access-reviews/2026-q3/decision-crm-asg-4417.json";
    }),
    "controlled reference without a content address",
  );
});

test("a controlled record binds the semantic payload of the row it supports", () => {
  // Each of these was a schema-valid, zero-finding artifact before the payload
  // binding existed: the envelope named the right row, the right author, and the
  // right instant while the row underneath said something else entirely.
  for (const [label, change, expected] of [
    [
      "retain flipped to revoke under an unchanged record",
      (value) => {
        decision(value, "decision-crm-reader-retain").state = "revoke";
      },
      ["invalid_decision_evidence", "invalid_evidence_payload_binding"],
    ],
    [
      "authority interval extended under an unchanged record",
      (value) => {
        grant(value, "grant-mara-crm-case-reader").activeUntil = "2026-12-15T00:00:00Z";
      },
      ["invalid_authority_grant", "invalid_evidence_payload_binding"],
    ],
    [
      "authority repointed to another resource and entitlement",
      (value) => {
        const row = grant(value, "grant-priya-crm-case-reader");
        row.resourceRef = "resource://analytics-warehouse/prod";
        row.entitlementRef = "entitlement://analytics-warehouse/analyst";
      },
      ["invalid_authority_grant", "invalid_evidence_payload_binding"],
    ],
    [
      "signal recommendation flipped from deny to approve",
      (value) => {
        signal(value, "signal-warehouse-recommendation").recommendation = "approve";
      },
      ["invalid_evidence_payload_binding", "invalid_signal_binding"],
    ],
  ]) {
    const candidate = broken(change);
    assertSchemaValid(candidate, label);
    assert.deepEqual(sortedCodes(candidate), expected, label);
  }

  const escalationRetargeted = broken((value) => {
    dropDecision(value, "decision-crm-reader-retain");
    addNonDecision(value, {
      id: "non-decision-crm-reader-escalated",
      rowRef: "assignment-crm-reader-leo",
      recordedByRef: "principal-mara-quinn",
      recordedAt: "2026-09-04T14:20:00Z",
      state: "escalated",
      escalation: {
        nextReviewerRef: "principal-priya-raman",
        authorityGrantRef: "grant-priya-crm-case-reader",
        dueAt: "2026-09-20T00:00:00Z",
      },
    });
    value.nonDecisions[0].escalation.dueAt = "2026-09-25T00:00:00Z";
  });
  assertSchemaValid(escalationRetargeted, "escalation retargeted under an unchanged record");
  assert.deepEqual(sortedCodes(escalationRetargeted), [
    "invalid_evidence_payload_binding",
    "invalid_non_decision",
  ]);

  const blockerRetargeted = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    assignment(value, "assignment-warehouse-analyst-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
    addBlocker(value, {
      id: "blocker-warehouse-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-warehouse-analyst-leo"],
      raisedAt: "2026-09-03T00:00:00Z",
    });
    value.blockers[0].targetRefs = ["assignment-warehouse-analyst-leo"];
    value.blockers[1].targetRefs = ["assignment-crm-reader-leo"];
  });
  assertSchemaValid(blockerRetargeted, "blocker targets swapped under unchanged records");
  assert.ok(codes(blockerRetargeted).has("invalid_evidence_payload_binding"));
  assert.ok(codes(blockerRetargeted).has("unsupported_blocker_condition"));

  // Envelope resealed, payload left behind: the reference moves, the promise
  // underneath does not.
  const envelopeOnly = broken((value) => {
    assignment(value, "assignment-payments-admin-nadia").resolutionMode = "direct";
    const digest = computeAssignmentManifestDigest(value.assignments);
    value.snapshot.digest = digest;
    value.round.snapshotDigest = digest;
    for (const row of value.evidence) row.snapshotDigest = digest;
    for (const row of value.decisions) row.snapshotDigest = digest;
    for (const row of value.sourceSignals) row.snapshotDigest = digest;
    sealEnvelopesOnly(value);
  });
  assertSchemaValid(envelopeOnly, "envelope resealed while the payload stays stale");
  assert.ok(codes(envelopeOnly).has("invalid_evidence_payload_binding"));

  // A record may not borrow another kind's payload to look bound.
  const borrowedPayload = broken((value) => {
    const record = evidenceRow(value, "evidence-decision-crm-retain");
    record.payloadDigest = evidenceRow(value, "evidence-authority-roster-export").payloadDigest;
    sealEnvelope(record);
  });
  assertSchemaValid(borrowedPayload, "decision record carrying the roster payload");
  assert.deepEqual(sortedCodes(borrowedPayload), [
    "invalid_decision_evidence",
    "invalid_evidence_payload_binding",
  ]);
});

test("a resealed manifest needs genuinely new owner decision records", () => {
  // The owner re-exports with a changed row. Everything derived is resealed
  // except the decision records, which keep the URI and digest they had.
  const staleDecisionRecords = broken((value) => {
    assignment(value, "assignment-payments-admin-nadia").resolutionMode = "direct";
    const frozen = new Map(
      value.evidence
        .filter((row) => row.kind === "decision-record")
        .map((row) => [row.id, { controlledRef: row.controlledRef, recordDigest: row.recordDigest }]),
    );
    reseal(value);
    for (const row of value.evidence) {
      const stale = frozen.get(row.id);
      if (stale) Object.assign(row, stale);
    }
  });
  assertSchemaValid(staleDecisionRecords, "resealed manifest with stale decision records");
  assert.ok(codes(staleDecisionRecords).has("invalid_evidence_content_address"));
  assert.ok(codes(staleDecisionRecords).has("invalid_decision_evidence"));

  // Once the owner supplies genuinely new decision records -- new semantic
  // payload digest, new record digest, new controlled reference, and new
  // decision instants inside the window -- the round is accepted. That is the
  // declared trust boundary, stated plainly: the package verifies internal
  // consistency and provenance, never whether a human truly re-read the row
  // behind that new owner record.
  const genuinelyNewRecords = mutate((value) => {
    assignment(value, "assignment-payments-admin-nadia").resolutionMode = "direct";
    const rerecorded = {
      "decision-crm-reader-retain": "2026-09-12T09:00:00Z",
      "decision-payments-admin-revoke": "2026-09-12T10:30:00Z",
      "decision-warehouse-analyst-retain": "2026-09-12T11:45:00Z",
    };
    for (const row of value.decisions) row.decidedAt = rerecorded[row.id];
    for (const row of value.evidence) {
      if (row.kind === "decision-record") {
        row.observedAt = rerecorded[row.subjectRefs.find((ref) => ref in rerecorded)];
      }
    }
    reseal(value);
  });
  assertSchemaValid(genuinelyNewRecords, "resealed manifest with new owner records");
  assert.deepEqual(accessEntitlementReviewFindings(genuinelyNewRecords), []);
  for (const id of [
    "evidence-decision-crm-retain",
    "evidence-decision-payments-revoke",
    "evidence-decision-warehouse-retain",
  ]) {
    assert.notEqual(
      evidenceRow(genuinelyNewRecords, id).payloadDigest,
      evidenceRow(fixture, id).payloadDigest,
    );
    assert.notEqual(
      evidenceRow(genuinelyNewRecords, id).controlledRef,
      evidenceRow(fixture, id).controlledRef,
    );
  }
});

test("a current decision binds the current snapshot manifest digest", () => {
  const foreignBinding = broken((value) => {
    decision(value, "decision-crm-reader-retain").snapshotDigest = FOREIGN_DIGEST;
  });
  assertSchemaValid(foreignBinding, "decision bound to another snapshot");
  assert.ok(codes(foreignBinding).has("invalid_decision_snapshot_binding"));

  const supersededBinding = broken((value) => {
    const previous = value.snapshot.digest;
    assignment(value, "assignment-crm-reader-leo").resolutionMode = "owner-expanded";
    reseal(value);
    for (const row of value.decisions) row.snapshotDigest = previous;
    sealAll(value);
  });
  assertSchemaValid(supersededBinding, "decision carrying the superseded manifest");
  assert.ok(codes(supersededBinding).has("invalid_decision_snapshot_binding"));

  for (const row of fixture.decisions) {
    assert.equal(row.snapshotDigest, fixture.snapshot.digest);
  }
});

test("the owner authority roster is a content-bound external trust root", () => {
  // A scope cannot appear behind an unchanged roster: the digest covers every
  // principal id, name, kind, and exact scope set.
  const silentScopeGain = broken((value) => {
    principal(value, "principal-omar-diaz").scopes = [
      "review-authority-issuer",
      "review-round-coordinator",
    ];
  });
  assertSchemaValid(silentScopeGain, "coordinator silently gaining issuer scope");
  assert.ok(codes(silentScopeGain).has("invalid_authority_roster"));

  const scopeIssuedFromInside = broken((value) => {
    principal(value, "principal-mara-quinn").scopes = ["review-round-coordinator"];
    evidenceRow(value, "evidence-authority-roster-export").suppliedByRef = "principal-iris-tanaka";
    resealRoster(value);
  });
  assertSchemaValid(scopeIssuedFromInside, "scope re-issued from inside the artifact");
  assert.ok(codes(scopeIssuedFromInside).has("invalid_authority_roster"));

  // The custodian re-issuing the roster is the one legitimate path, and it is
  // accepted precisely because the custodian is the declared external root.
  const custodianReissued = mutate((value) => {
    principal(value, "principal-mara-quinn").scopes = ["review-round-coordinator"];
    resealRoster(value);
  });
  assertSchemaValid(custodianReissued, "custodian re-issues the roster");
  assert.deepEqual(accessEntitlementReviewFindings(custodianReissued), []);

  const subjectCustodian = broken((value) => {
    value.authorityRoster.custodianRef = "principal-leo-brandt";
    evidenceRow(value, "evidence-authority-roster-export").suppliedByRef = "principal-leo-brandt";
    sealAll(value);
  });
  assertSchemaValid(subjectCustodian, "reviewed subject as roster custodian");
  assert.ok(codes(subjectCustodian).has("invalid_authority_roster"));

  for (const [label, ref] of [
    ["grant issuer as custodian", "principal-iris-tanaka"],
    ["decision maker as custodian", "principal-mara-quinn"],
    ["round coordinator as custodian", "principal-omar-diaz"],
    ["handoff owner as custodian", HANDOFF_OWNER],
    ["owner source system as custodian", OWNER_SYSTEM],
  ]) {
    const candidate = broken((value) => {
      value.authorityRoster.custodianRef = ref;
      evidenceRow(value, "evidence-authority-roster-export").suppliedByRef = ref;
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_authority_roster"), label);
  }

  // round.authorityBoundary.rosterRef is load-bearing, not decorative.
  const decorativeRosterRef = broken((value) => {
    value.round.authorityBoundary.rosterRef = "roster-2025-review-authority";
  });
  assertSchemaValid(decorativeRosterRef, "decorative roster reference");
  assert.ok(codes(decorativeRosterRef).has("invalid_authority_roster"));
  assert.ok(codes(decorativeRosterRef).has("invalid_principal_scope"));

  const decorativeControlledRef = broken((value) => {
    value.authorityRoster.controlledRef =
      `controlled://access-reviews/rosters/2026-review-authority-roster@sha256-${"1".repeat(64)}`;
  });
  assertSchemaValid(decorativeControlledRef, "roster reference detached from its record");
  assert.ok(codes(decorativeControlledRef).has("invalid_authority_roster"));

  const partialRoster = broken((value) => {
    const rosterRecord = evidenceRow(value, "evidence-authority-roster-export");
    rosterRecord.subjectRefs = rosterRecord.subjectRefs.filter(
      (ref) => ref !== "principal-leo-brandt",
    );
    sealAll(value);
  });
  assertSchemaValid(partialRoster, "roster export naming only some principals");
  assert.ok(codes(partialRoster).has("invalid_authority_roster"));

  const unboundRosterDigest = broken((value) => {
    value.authorityRoster.rosterDigest = FOREIGN_DIGEST;
    sealAll(value);
  });
  assertSchemaValid(unboundRosterDigest, "roster asserting a digest it did not recompute");
  assert.ok(codes(unboundRosterDigest).has("invalid_authority_roster"));

  const lateRoster = broken((value) => {
    evidenceRow(value, "evidence-authority-roster-export").observedAt = "2026-09-15T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(lateRoster, "roster issued after the round cutoff");
  assert.ok(codes(lateRoster).has("invalid_authority_roster"));

  const scopedCustodian = broken((value) => {
    principal(value, "principal-hana-bello").scopes = ["review-round-coordinator"];
    resealRoster(value);
  });
  assertSchemaValid(scopedCustodian, "custodian holding a scope the roster confers");
  assert.ok(codes(scopedCustodian).has("invalid_authority_roster"));
});

test("grant issuers and destination approvers hold roster-bound owner scope", () => {
  const unscopedDestination = broken((value) => {
    principal(value, "principal-iris-tanaka").scopes = ["review-authority-issuer"];
    resealRoster(value);
  });
  assertSchemaValid(unscopedDestination, "unscoped destination approver");
  assert.ok(codes(unscopedDestination).has("invalid_principal_scope"));

  const unscopedIssuer = broken((value) => {
    principal(value, "principal-iris-tanaka").scopes = ["review-destination-approver"];
    resealRoster(value);
  });
  assertSchemaValid(unscopedIssuer, "unscoped grant issuer");
  assert.ok(codes(unscopedIssuer).has("invalid_principal_scope"));

  const humanScopeOnATeam = broken((value) => {
    principal(value, "principal-access-review-board").scopes = ["review-round-coordinator"];
    resealRoster(value);
  });
  assertSchemaValid(humanScopeOnATeam, "round-running scope held by a team");
  assert.ok(codes(humanScopeOnATeam).has("invalid_principal_scope"));

  const mixedScopeClasses = broken((value) => {
    principal(value, OWNER_SYSTEM).scopes = [
      "assignment-snapshot-supplier",
      "source-signal-supplier",
      "review-authority-issuer",
    ];
    resealRoster(value);
  });
  assertSchemaValid(mixedScopeClasses, "supplier system also holding issuer scope");
  assert.ok(codes(mixedScopeClasses).has("invalid_principal_scope"));
  assert.ok(codes(mixedScopeClasses).has("invalid_source_authority"));

  const subjectIssued = broken((value) => {
    grant(value, "grant-mara-crm-case-reader").grantedByRef = "principal-leo-brandt";
    evidenceRow(value, "evidence-grant-mara-crm").suppliedByRef = "principal-leo-brandt";
    sealAll(value);
  });
  assertSchemaValid(subjectIssued, "assignment subject issues the reviewer grant");
  assert.ok(codes(subjectIssued).has("subject_issued_authority_grant"));
});

test("the handoff recipient is a declared, scoped, non-subject owner", () => {
  assert.equal(fixture.handoff.nextOwnerRef, HANDOFF_OWNER);
  assert.deepEqual(principal(fixture, HANDOFF_OWNER).scopes, [
    "review-execution-handoff-owner",
  ]);

  for (const [label, ref] of [
    ["reviewed subject receives the handoff", "principal-leo-brandt"],
    ["reviewer receives the handoff", "principal-mara-quinn"],
    ["team receives the handoff", "principal-access-review-board"],
    ["system receives the handoff", "principal-iam-lifecycle-automation"],
    ["grant issuer receives the handoff", "principal-iris-tanaka"],
  ]) {
    const candidate = broken((value) => {
      value.round.handoffOwnerRef = ref;
      value.handoff.nextOwnerRef = ref;
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_handoff_authority"), label);
  }

  // Even with the owner scope conferred by a re-issued roster, a reviewed
  // subject may not be the recipient of the package about their own access.
  const scopedSubject = broken((value) => {
    principal(value, "principal-leo-brandt").scopes = ["review-execution-handoff-owner"];
    value.round.handoffOwnerRef = "principal-leo-brandt";
    value.handoff.nextOwnerRef = "principal-leo-brandt";
    resealRoster(value);
  });
  assertSchemaValid(scopedSubject, "scoped reviewed subject as handoff owner");
  assert.deepEqual(sortedCodes(scopedSubject), ["invalid_handoff_authority"]);

  const drifted = broken((value) => {
    value.handoff.nextOwnerRef = "principal-iris-tanaka";
  });
  assertSchemaValid(drifted, "handoff going somewhere the round never declared");
  assert.ok(codes(drifted).has("invalid_handoff_authority"));

  const custodianRecipient = broken((value) => {
    value.round.handoffOwnerRef = "principal-hana-bello";
    value.handoff.nextOwnerRef = "principal-hana-bello";
  });
  assertSchemaValid(custodianRecipient, "roster custodian as handoff owner");
  assert.ok(codes(custodianRecipient).has("invalid_handoff_authority"));
  assert.ok(codes(custodianRecipient).has("invalid_authority_roster"));

  const unrosteredScope = broken((value) => {
    principal(value, HANDOFF_OWNER).scopes = [];
    resealRoster(value);
  });
  assertSchemaValid(unrosteredScope, "declared recipient stripped of the owner scope");
  assert.deepEqual(sortedCodes(unrosteredScope), ["invalid_handoff_authority"]);
});

test("source signals come only from the declared owner source system", () => {
  const subjectSupplied = broken((value) => {
    signal(value, "signal-crm-inactivity").suppliedByRef = "principal-leo-brandt";
    evidenceRow(value, "evidence-signal-crm-inactivity").suppliedByRef = "principal-leo-brandt";
    sealAll(value);
  });
  assertSchemaValid(subjectSupplied, "reviewed subject supplies a signal");
  assert.ok(codes(subjectSupplied).has("invalid_signal_binding"));

  const reviewerSupplied = broken((value) => {
    signal(value, "signal-crm-inactivity").suppliedByRef = "principal-mara-quinn";
    evidenceRow(value, "evidence-signal-crm-inactivity").suppliedByRef = "principal-mara-quinn";
    sealAll(value);
  });
  assertSchemaValid(reviewerSupplied, "reviewer supplies their own signal");
  assert.ok(codes(reviewerSupplied).has("invalid_signal_binding"));

  const humanSourceSystem = broken((value) => {
    value.snapshot.sourceSystemRef = "principal-iris-tanaka";
  });
  assertSchemaValid(humanSourceSystem, "source system declared as a human");
  assert.ok(codes(humanSourceSystem).has("invalid_source_authority"));

  const unscopedSourceSystem = broken((value) => {
    principal(value, OWNER_SYSTEM).scopes = ["assignment-snapshot-supplier"];
    resealRoster(value);
  });
  assertSchemaValid(unscopedSourceSystem, "source system without the signal-supplier scope");
  assert.ok(codes(unscopedSourceSystem).has("invalid_source_authority"));

  const sourceSystemApproves = broken((value) => {
    value.round.destination.approvedByRef = OWNER_SYSTEM;
  });
  assertSchemaValid(sourceSystemApproves, "source system approving the destination");
  assert.ok(codes(sourceSystemApproves).has("invalid_source_authority"));
  assert.ok(codes(sourceSystemApproves).has("invalid_principal_scope"));

  const humanSuppliedExport = broken((value) => {
    evidenceRow(value, "evidence-round-snapshot-export").suppliedByRef = "principal-iris-tanaka";
    sealAll(value);
  });
  assertSchemaValid(humanSuppliedExport, "round export supplied by a reviewer");
  assert.ok(codes(humanSuppliedExport).has("invalid_round_binding"));

  const humanSuppliedAssignment = broken((value) => {
    evidenceRow(value, "evidence-assignment-crm-reader").suppliedByRef = "principal-iris-tanaka";
    sealAll(value);
  });
  assertSchemaValid(humanSuppliedAssignment, "assignment record supplied by a reviewer");
  assert.ok(codes(humanSuppliedAssignment).has("invalid_assignment_evidence"));
});

test("source signal values are typed, closed, and carry no outcome", () => {
  for (const [label, change] of [
    [
      "inactivity signal with no day count",
      (value) => {
        signal(value, "signal-crm-inactivity").inactiveDays = null;
      },
    ],
    [
      "recommendation signal with no code",
      (value) => {
        signal(value, "signal-warehouse-recommendation").recommendation = null;
      },
    ],
    [
      "peer-affiliation signal carrying a day count",
      (value) => {
        signal(value, "signal-payments-peer-affiliation").inactiveDays = 12;
      },
    ],
    [
      "inactivity signal also recommending",
      (value) => {
        signal(value, "signal-crm-inactivity").recommendation = "deny";
      },
    ],
  ]) {
    const candidate = broken((value) => {
      change(value);
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.deepEqual(sortedCodes(candidate), ["invalid_signal_value"], label);
  }

  for (const code of ["revoked", "applied", "certified", "accept-and-apply"]) {
    assertSchemaInvalid(
      mutate((value) => {
        signal(value, "signal-warehouse-recommendation").recommendation = code;
      }),
      `recommendation code ${code}`,
    );
  }
  assertSchemaInvalid(
    mutate((value) => {
      signal(value, "signal-crm-inactivity").inactiveDays = "thirty four days";
    }),
    "inactive days as free text",
  );
});

test("controlled evidence is consumed exactly once against exact subjects", () => {
  const orphan = broken((value) => {
    value.evidence.push(
      sealRecord(value, {
        id: "evidence-unclaimed-decision-record",
        kind: "decision-record",
        controlledSource: "access-reviews",
        controlledPurpose: "2026-q3/decision-unclaimed",
        controlledRef: null,
        recordDigest: null,
        payloadDigest: null,
        observedAt: "2026-09-04T14:20:00Z",
        suppliedByRef: "principal-mara-quinn",
        snapshotDigest: value.snapshot.digest,
        subjectRefs: ["decision-crm-reader-retain", "assignment-crm-reader-leo"],
      }),
    );
  });
  assertSchemaValid(orphan, "orphan controlled record");
  assert.ok(codes(orphan).has("invalid_evidence_binding"));

  const shared = broken((value) => {
    assignment(value, "assignment-warehouse-analyst-leo").evidenceRefs = [
      "evidence-assignment-crm-reader",
    ];
    value.evidence = value.evidence.filter(
      (row) => row.id !== "evidence-assignment-warehouse-analyst",
    );
    reseal(value);
  });
  assertSchemaValid(shared, "one record consumed by two rows");
  assert.ok(codes(shared).has("invalid_evidence_binding"));

  const crossSubject = broken((value) => {
    const row = evidenceRow(value, "evidence-decision-crm-retain");
    row.subjectRefs = ["decision-crm-reader-retain", "assignment-warehouse-analyst-leo"];
    sealRecord(value, row);
  });
  assertSchemaValid(crossSubject, "decision record naming another row");
  assert.ok(codes(crossSubject).has("invalid_decision_evidence"));

  const wrongSnapshot = broken((value) => {
    const row = evidenceRow(value, "evidence-decision-crm-retain");
    row.snapshotDigest = FOREIGN_DIGEST;
    sealRecord(value, row);
  });
  assertSchemaValid(wrongSnapshot, "record raised against another snapshot");
  assert.ok(codes(wrongSnapshot).has("invalid_evidence_binding"));

  const partialExport = broken((value) => {
    const row = evidenceRow(value, "evidence-round-snapshot-export");
    row.subjectRefs = ["round-2026-q3", "snapshot-2026-q3-workforce"];
    sealRecord(value, row);
  });
  assertSchemaValid(partialExport, "export naming no assignment row");
  assert.ok(codes(partialExport).has("invalid_round_binding"));
});

test("every declared evidence kind has a payload projection and one consumer", () => {
  const kinds = schema.$defs.evidence.properties.kind.enum;
  assert.equal(kinds.length, 8);

  const complete = mutate(everyEvidenceKind);
  assertSchemaValid(complete, "round exercising every evidence kind");
  assert.deepEqual(accessEntitlementReviewFindings(complete), []);
  assert.deepEqual([...new Set(complete.evidence.map((row) => row.kind))].sort(), [...kinds].sort());

  // Every record resolves the exact row it supports, binds that row's payload,
  // and is consumed once. A zero-finding artifact carrying all eight kinds is
  // what proves the projection table is total rather than merely plausible.
  for (const row of complete.evidence) {
    const source = payloadSourceFor(complete, row);
    assert.notEqual(source, undefined, row.kind);
    assert.equal(row.payloadDigest, computeEvidencePayloadDigest(row.kind, source), row.id);
    assert.notEqual(evidencePayloadProjection(row.kind, source), null, row.kind);
  }
  assert.equal(
    new Set(complete.evidence.map((row) => row.controlledRef)).size,
    complete.evidence.length,
  );

  // Each kind, mutated at its own semantic payload, is refused.
  for (const [label, change] of [
    [
      "round export payload",
      (value) => {
        value.round.asOf = "2026-09-01T00:00:01Z";
        value.snapshot.asOf = "2026-09-01T00:00:01Z";
      },
    ],
    [
      "roster export payload",
      (value) => {
        value.authorityRoster.custodianRef = "principal-priya-raman";
      },
    ],
    [
      "assignment record payload",
      (value) => {
        assignment(value, "assignment-crm-reader-leo").resolutionMode = "owner-expanded";
        resealHeaderOnly(value);
      },
    ],
    [
      "grant record payload",
      (value) => {
        grant(value, "grant-sofia-warehouse-analyst").scopes = [
          "entitlement-review-decision",
          "privileged-review",
        ];
      },
    ],
    [
      "signal record payload",
      (value) => {
        signal(value, "signal-crm-inactivity").inactiveDays = 999;
      },
    ],
    [
      "decision record payload",
      (value) => {
        decision(value, "decision-crm-reader-retain").sourceSignalRefs = [];
      },
    ],
    [
      "non-decision record payload",
      (value) => {
        value.nonDecisions[0].recordedAt = "2026-09-21T00:00:00Z";
      },
    ],
    [
      "blocker record payload",
      (value) => {
        value.blockers[0].status = "open";
        value.blockers[0].raisedAt = "2026-09-04T00:00:00Z";
      },
    ],
  ]) {
    const candidate = mutate((value) => {
      everyEvidenceKind(value);
      change(value);
      value.handoff.state = "blocked";
    });

    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_evidence_payload_binding"), label);
  }
});

test("the round export projection covers every schema field explicitly", () => {
  const projection = evidencePayloadProjection("round-snapshot-export", {
    round: fixture.round,
    snapshot: fixture.snapshot,
    assignments: fixture.assignments,
  });
  for (const section of ["round", "snapshot"]) {
    const schemaFields = Object.keys(schema.$defs[section].properties).sort();
    const bound = [...ROUND_SNAPSHOT_EXPORT_BOUND_FIELDS[section]].sort();
    const derived = [...ROUND_SNAPSHOT_EXPORT_DERIVED_FIELDS[section]].sort();
    assert.deepEqual(
      bound.filter((field) => derived.includes(field)),
      [],
      `${section} bound and derived fields must not overlap`,
    );
    assert.deepEqual(
      [...new Set([...bound, ...derived])].sort(),
      schemaFields,
      `every ${section} field must be content-bound or explicitly derived`,
    );
    assert.deepEqual(
      Object.keys(projection[section]).sort(),
      bound,
      `the ${section} projection must implement its declared bound field set`,
    );
  }
  for (const field of ["window", "cadence", "destination", "authorityBoundary"]) {
    assert.deepEqual(
      Object.keys(projection.round[field]).sort(),
      Object.keys(schema.$defs.round.properties[field].properties).sort(),
      `round.${field} must bind every nested schema field`,
    );
  }
  assert.deepEqual(
    Object.keys(projection.snapshot.notCoveredAccessPaths[0]).sort(),
    Object.keys(schema.$defs.accessPath.properties).sort(),
    "each not-covered access path must bind every schema field",
  );
});

test("a stale round export cannot hide changed round controls", () => {
  for (const [label, change] of [
    [
      "review window",
      (value) => {
        value.round.window.closesAt = "2026-10-10T00:00:00Z";
      },
    ],
    [
      "destination",
      (value) => {
        value.round.destination.controlledRef =
          "controlled://access-reviews/2026-q3/alternate-handoff.md";
      },
    ],
    [
      "cadence",
      (value) => {
        value.round.cadence.intervalDays = 60;
      },
    ],
    [
      "handoff owner",
      (value) => {
        value.round.handoffOwnerRef = "principal-iris-tanaka";
        value.handoff.nextOwnerRef = "principal-iris-tanaka";
      },
    ],
    [
      "authority roster",
      (value) => {
        value.round.authorityBoundary.rosterRef = "roster-other-review-authority";
      },
    ],
    [
      "prior round provenance",
      (value) => {
        value.round.priorRoundRef = "access-review-2025-q4";
      },
    ],
  ]) {
    const candidate = broken(change);
    assertSchemaValid(candidate, `stale export after changed ${label}`);
    assert.ok(
      codes(candidate).has("invalid_evidence_payload_binding"),
      `${label} must move the round export payload`,
    );
    assert.ok(codes(candidate).has("invalid_round_binding"), label);
  }
});

test("a stale round export cannot hide changed snapshot controls", () => {
  for (const [label, change] of [
    [
      "privilege classification",
      (value) => {
        value.snapshot.privilegeClassification = "absent";
      },
    ],
    [
      "source system",
      (value) => {
        value.snapshot.sourceSystemRef = "principal-iam-lifecycle-automation";
      },
    ],
    [
      "entitlement catalog",
      (value) => {
        value.snapshot.entitlementCatalogRefs.push(
          "entitlement://payments-platform/unapproved-admin",
        );
      },
    ],
    [
      "not-covered paths",
      (value) => {
        value.snapshot.notCoveredAccessPaths.reverse();
        value.snapshot.notCoveredAccessPaths[0].id = "path-external-federated-renamed";
      },
    ],
  ]) {
    const candidate = broken(change);
    assertSchemaValid(candidate, `stale export after changed ${label}`);
    assert.ok(
      codes(candidate).has("invalid_evidence_payload_binding"),
      `${label} must move the round export payload`,
    );
    assert.ok(codes(candidate).has("invalid_round_binding"), label);
  }
});

test("downstream reissues cannot conceal a stale owner export", () => {
  const laterDecision = broken((value) => {
    value.round.window.closesAt = "2026-10-10T00:00:00Z";
    const row = decision(value, "decision-warehouse-analyst-retain");
    row.decidedAt = "2026-10-05T11:05:00Z";
    const record = evidenceRow(value, "evidence-decision-warehouse-retain");
    record.observedAt = row.decidedAt;
    sealRecord(value, record);
  });
  assertSchemaValid(laterDecision, "later decision under a stale round export");
  assert.ok(codes(laterDecision).has("invalid_evidence_payload_binding"));
  assert.ok(codes(laterDecision).has("invalid_round_binding"));

  const injectedEntitlement = broken((value) => {
    const entitlement = "entitlement://payments-platform/unapproved-admin";
    value.snapshot.entitlementCatalogRefs.push(entitlement);
  });
  assertSchemaValid(injectedEntitlement, "catalog injection under a stale owner export");
  assert.ok(codes(injectedEntitlement).has("invalid_evidence_payload_binding"));
  assert.ok(codes(injectedEntitlement).has("invalid_round_binding"));
});

test("a genuine owner export reissue can bind an intentional control change", () => {
  const candidate = mutate((value) => {
    value.round.destination.controlledRef =
      "controlled://access-reviews/2026-q3/alternate-handoff.md";
    sealRecord(value, evidenceRow(value, value.round.exportEvidenceRef));
  });
  assertSchemaValid(candidate, "content-addressed destination reissue");
  assert.deepEqual(accessEntitlementReviewFindings(candidate), []);
});

test("coverage of in-scope assignment keys is exact", () => {
  const hidden = broken((value) => {
    value.handoff.coveredAssignmentKeys = value.handoff.coveredAssignmentKeys.filter(
      (key) => key !== CRM_KEY,
    );
  });
  assertSchemaValid(hidden, "hidden key");
  assert.ok(codes(hidden).has("incomplete_assignment_coverage"));

  const extra = broken((value) => {
    value.handoff.coveredAssignmentKeys.push(
      "principal-leo-brandt|resource://crm-platform/prod|entitlement://crm-platform/admin|crm-asg-9999",
    );
  });
  assertSchemaValid(extra, "extra key");
  assert.ok(codes(extra).has("incomplete_assignment_coverage"));

  const duplicated = broken((value) => {
    const clone = structuredClone(assignment(value, "assignment-crm-reader-leo"));
    clone.id = "assignment-crm-reader-leo-copy";
    clone.evidenceRefs = ["evidence-assignment-crm-reader-copy"];
    value.assignments.push(clone);
    value.round.assignmentRefs.push(clone.id);
    value.evidence.push({
      id: "evidence-assignment-crm-reader-copy",
      kind: "assignment-record",
      controlledSource: "access-reviews",
      controlledPurpose: "2026-q3/assignment-crm-asg-4417-copy",
      controlledRef: null,
      recordDigest: null,
      payloadDigest: null,
      observedAt: value.snapshot.asOf,
      suppliedByRef: OWNER_SYSTEM,
      snapshotDigest: value.snapshot.digest,
      subjectRefs: [clone.id],
    });
    evidenceRow(value, "evidence-round-snapshot-export").subjectRefs.push(clone.id);
    reseal(value);
  });
  assertSchemaValid(duplicated, "duplicate assignment key");
  assert.ok(codes(duplicated).has("duplicate_assignment_key"));
});

test("owner-excluded rows stay visible and cannot be laundered into the review", () => {
  const unlisted = broken((value) => {
    value.handoff.excludedAssignmentRefs = [];
  });
  assertSchemaValid(unlisted, "unlisted exclusion");
  assert.ok(codes(unlisted).has("excluded_assignment_laundering"));

  const unexplained = broken((value) => {
    assignment(value, "assignment-billing-writer-service").exclusionCode = null;
    reseal(value);
  });
  assertSchemaValid(unexplained, "exclusion with no owner code");
  assert.ok(codes(unexplained).has("excluded_assignment_laundering"));

  const codedInScope = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").exclusionCode = "owner-withdrew-row";
    reseal(value);
  });
  assertSchemaValid(codedInScope, "in-scope row carrying an exclusion code");
  assert.ok(codes(codedInScope).has("excluded_assignment_laundering"));

  const reviewed = broken((value) => {
    addDecision(value, {
      id: "decision-billing-writer-retain",
      rowRef: "assignment-billing-writer-service",
      decidedByRef: "principal-mara-quinn",
      decidedAt: "2026-09-06T10:00:00Z",
      authorityGrantRef: "grant-mara-crm-case-reader",
    });
  });
  assertSchemaValid(reviewed, "excluded row reviewed");
  assert.ok(codes(reviewed).has("excluded_assignment_laundering"));

  const smuggled = broken((value) => {
    value.handoff.coveredAssignmentKeys.push(
      "principal-billing-sync-service|resource://billing-ledger/prod|entitlement://billing-ledger/writer|bil-asg-7734",
    );
  });
  assertSchemaValid(smuggled, "excluded key smuggled into coverage");
  assert.ok(codes(smuggled).has("incomplete_assignment_coverage"));

  const duplicateExcluded = broken((value) => {
    const clone = structuredClone(assignment(value, "assignment-crm-reader-leo"));
    clone.id = "assignment-crm-reader-leo-excluded-copy";
    clone.inScope = false;
    clone.exclusionCode = "owner-withdrew-row";
    clone.privileged = null;
    clone.evidenceRefs = ["evidence-assignment-crm-reader-excluded-copy"];
    value.assignments.push(clone);
    value.round.assignmentRefs.push(clone.id);
    value.handoff.excludedAssignmentRefs.push(clone.id);
    value.evidence.push({
      id: "evidence-assignment-crm-reader-excluded-copy",
      kind: "assignment-record",
      controlledSource: "access-reviews",
      controlledPurpose: "2026-q3/assignment-crm-asg-4417-excluded-copy",
      controlledRef: null,
      recordDigest: null,
      payloadDigest: null,
      observedAt: value.snapshot.asOf,
      suppliedByRef: OWNER_SYSTEM,
      snapshotDigest: value.snapshot.digest,
      subjectRefs: [clone.id],
    });
    evidenceRow(value, value.round.exportEvidenceRef).subjectRefs.push(clone.id);
    reseal(value);
  });
  assertSchemaValid(duplicateExcluded, "one key in reviewed and excluded populations");
  assert.ok(codes(duplicateExcluded).has("duplicate_assignment_key"));
});

test("every in-scope key carries exactly one terminal record", () => {
  const missing = broken((value) => {
    dropDecision(value, "decision-crm-reader-retain");
  });
  assertSchemaValid(missing, "missing terminal");
  assert.ok(codes(missing).has("missing_assignment_terminal"));

  const doubled = broken((value) => {
    addDecision(value, {
      id: "decision-crm-reader-retain-second",
      rowRef: "assignment-crm-reader-leo",
      decidedByRef: "principal-priya-raman",
      decidedAt: "2026-09-06T10:00:00Z",
      authorityGrantRef: "grant-priya-crm-case-reader",
    });
  });
  assertSchemaValid(doubled, "duplicate terminal");
  assert.ok(codes(doubled).has("duplicate_assignment_terminal"));

  const mixed = broken((value) => {
    addNonDecision(value, {
      id: "non-decision-crm-reader-not-reviewed",
      rowRef: "assignment-crm-reader-leo",
      recordedByRef: "principal-priya-raman",
      recordedAt: "2026-09-20T00:00:00Z",
    });
  });
  assertSchemaValid(mixed, "decision and non-decision on one row");
  assert.ok(codes(mixed).has("duplicate_assignment_terminal"));
});

test("only a named human may record a recertification decision", () => {
  for (const ref of [
    "principal-access-review-board",
    "principal-billing-sync-service",
    "principal-iam-lifecycle-automation",
    "principal-entitlement-review-agent",
    "principal-application-owner-role",
    OWNER_SYSTEM,
  ]) {
    const candidate = broken((value) => {
      decision(value, "decision-crm-reader-retain").decidedByRef = ref;
      sealAll(value);
    });
    assertSchemaValid(candidate, `decider ${ref}`);
    assert.ok(codes(candidate).has("invalid_decision_maker"), ref);
  }

  for (const name of ["Access reviewer", "IAM team", "Application owner", "the owner"]) {
    const candidate = broken((value) => {
      principal(value, "principal-mara-quinn").name = name;
      resealRoster(value);
    });
    assertSchemaValid(candidate, `bare role ${name}`);
    assert.ok(codes(candidate).has("invalid_decision_maker"), name);
  }
});

test("separation of duties holds for subjects, grantors, and privileged scope", () => {
  const self = broken((value) => {
    decision(value, "decision-crm-reader-retain").decidedByRef = "principal-leo-brandt";
    sealAll(value);
  });
  assertSchemaValid(self, "self review");
  assert.ok(codes(self).has("self_review_not_permitted"));

  const grantorReview = broken((value) => {
    decision(value, "decision-payments-admin-revoke").decidedByRef = "principal-omar-diaz";
    sealAll(value);
  });
  assertSchemaValid(grantorReview, "grantor review");
  assert.ok(codes(grantorReview).has("privileged_review_separation_violated"));

  const unscoped = broken((value) => {
    grant(value, "grant-devon-payments-settlement-admin").scopes = [
      "entitlement-review-decision",
    ];
    sealAll(value);
  });
  assertSchemaValid(unscoped, "missing privileged-review scope");
  assert.ok(codes(unscoped).has("privileged_review_separation_violated"));

  const grantorUnknown = broken((value) => {
    assignment(value, "assignment-payments-admin-nadia").grantedByRef = null;
    reseal(value);
  });
  assertSchemaValid(grantorUnknown, "unknown grantor on privileged row");
  assert.ok(codes(grantorUnknown).has("privileged_review_separation_violated"));
});

test("reviewer authority must cover the exact row and be live at the decision", () => {
  for (const [label, change] of [
    [
      "wrong resource",
      (value) => {
        grant(value, "grant-mara-crm-case-reader").resourceRef =
          "resource://payments-platform/prod";
      },
    ],
    [
      "wrong entitlement",
      (value) => {
        grant(value, "grant-mara-crm-case-reader").entitlementRef =
          "entitlement://analytics-warehouse/analyst";
      },
    ],
    [
      "expired grant",
      (value) => {
        grant(value, "grant-mara-crm-case-reader").activeUntil = "2026-09-02T00:00:00Z";
      },
    ],
    [
      "not yet active grant",
      (value) => {
        grant(value, "grant-mara-crm-case-reader").activeFrom = "2026-09-10T00:00:00Z";
      },
    ],
    [
      "grant held by another reviewer",
      (value) => {
        decision(value, "decision-crm-reader-retain").authorityGrantRef =
          "grant-priya-crm-case-reader";
      },
    ],
  ]) {
    const candidate = broken((value) => {
      change(value);
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("authority_grant_coverage_missing"), label);
  }

  const unevidenced = broken((value) => {
    const row = evidenceRow(value, "evidence-grant-mara-crm");
    row.subjectRefs = ["principal-mara-quinn"];
    sealRecord(value, row);
  });
  assertSchemaValid(unevidenced, "grant without reciprocal evidence");
  assert.ok(codes(unevidenced).has("invalid_authority_grant"));

  const issuedAfterActivation = broken((value) => {
    const row = evidenceRow(value, "evidence-grant-mara-crm");
    row.observedAt = "2026-09-03T00:00:00Z";
    sealRecord(value, row);
  });
  assertSchemaValid(issuedAfterActivation, "grant evidenced only after it went live");
  assert.ok(codes(issuedAfterActivation).has("invalid_authority_grant"));

  // Issuance at the activation instant is allowed; the rule is no later than.
  const issuedAtActivation = mutate((value) => {
    const row = evidenceRow(value, "evidence-grant-mara-crm");
    row.observedAt = grant(value, "grant-mara-crm-case-reader").activeFrom;
    sealRecord(value, row);
  });
  assertSchemaValid(issuedAtActivation, "grant evidenced exactly at activation");
  assert.deepEqual(accessEntitlementReviewFindings(issuedAtActivation), []);

  const priorRoundGrant = broken((value) => {
    const authority = grant(value, "grant-mara-crm-case-reader");
    authority.activeFrom = "2026-08-15T00:00:00Z";
    const row = evidenceRow(value, "evidence-grant-mara-crm");
    row.observedAt = "2026-08-14T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(priorRoundGrant, "prior-round grant rebound to the current snapshot");
  assert.ok(codes(priorRoundGrant).has("invalid_authority_grant"));
  assert.ok(codes(priorRoundGrant).has("invalid_evidence_provenance"));

  const grantOutlivesRound = broken((value) => {
    grant(value, "grant-mara-crm-case-reader").activeUntil = "2026-10-01T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(grantOutlivesRound, "review authority outliving the round");
  assert.ok(codes(grantOutlivesRound).has("invalid_authority_grant"));

  const selfGranted = broken((value) => {
    grant(value, "grant-mara-crm-case-reader").grantedByRef = "principal-mara-quinn";
    evidenceRow(value, "evidence-grant-mara-crm").suppliedByRef = "principal-mara-quinn";
    sealAll(value);
  });
  assertSchemaValid(selfGranted, "self-granted authority");
  assert.ok(codes(selfGranted).has("invalid_authority_grant"));

  const nonHumanGrantee = broken((value) => {
    grant(value, "grant-mara-crm-case-reader").granteeRef = "principal-access-review-board";
    sealAll(value);
  });
  assertSchemaValid(nonHumanGrantee, "team holds the grant");
  assert.ok(codes(nonHumanGrantee).has("invalid_authority_grant"));
});

test("no default, automation, or accepted recommendation can become a decision", () => {
  for (const source of [
    "system-default",
    "auto-applied",
    "no-response-default",
    "recommendation-accepted",
  ]) {
    const candidate = broken((value) => {
      decision(value, "decision-crm-reader-retain").decisionSource = source;
      sealAll(value);
    });
    assertSchemaValid(candidate, source);
    assert.deepEqual(sortedCodes(candidate), ["invalid_decision_source"], source);
  }
  assertSchemaInvalid(
    mutate((value) => {
      decision(value, "decision-crm-reader-retain").decisionSource = "reviewer-intuition";
    }),
    "unlisted decision source",
  );
  for (const basis of ["recommendation-accepted", "prior-round-decision", "system-derived"]) {
    assertSchemaInvalid(
      mutate((value) => {
        decision(value, "decision-crm-reader-retain").decisionBasis = basis;
      }),
      `decision basis ${basis}`,
    );
  }
});

test("owner recommendations and signals are rendered, never terminal", () => {
  const asEvidence = broken((value) => {
    decision(value, "decision-crm-reader-retain").evidenceRefs = [
      "evidence-signal-crm-inactivity",
    ];
  });
  assertSchemaValid(asEvidence, "signal export as decision evidence");
  assert.ok(codes(asEvidence).has("recommendation_used_as_decision_evidence"));

  const alsoEvidence = broken((value) => {
    decision(value, "decision-crm-reader-retain").evidenceRefs.push(
      "evidence-signal-crm-inactivity",
    );
  });
  assertSchemaValid(alsoEvidence, "signal export alongside decision evidence");
  assert.ok(codes(alsoEvidence).has("recommendation_used_as_decision_evidence"));

  const foreignSignal = broken((value) => {
    decision(value, "decision-crm-reader-retain").sourceSignalRefs = [
      "signal-warehouse-recommendation",
    ];
    sealAll(value);
  });
  assertSchemaValid(foreignSignal, "signal from another row");
  assert.ok(codes(foreignSignal).has("invalid_signal_binding"));

  const unrendered = broken((value) => {
    value.handoff.renderedSignalRefs = value.handoff.renderedSignalRefs.filter(
      (ref) => ref !== "signal-crm-inactivity",
    );
  });
  assertSchemaValid(unrendered, "suppressed signal");
  assert.ok(codes(unrendered).has("invalid_signal_binding"));

  for (const [label, change] of [
    [
      "signal bound to an excluded row",
      (value) => {
        signal(value, "signal-crm-inactivity").assignmentRowRef =
          "assignment-billing-writer-service";
      },
    ],
    [
      "prior round reference",
      (value) => {
        signal(value, "signal-crm-inactivity").roundRef = "round-2026-q2";
      },
    ],
    [
      "prior snapshot reference",
      (value) => {
        signal(value, "signal-crm-inactivity").snapshotRef = "snapshot-2026-q2-workforce";
      },
    ],
    [
      "stale row digest",
      (value) => {
        signal(value, "signal-crm-inactivity").assignmentDigest = FOREIGN_DIGEST;
      },
    ],
    [
      "stale snapshot digest",
      (value) => {
        signal(value, "signal-crm-inactivity").snapshotDigest = FOREIGN_DIGEST;
      },
    ],
    [
      "wrong assignment reference",
      (value) => {
        signal(value, "signal-crm-inactivity").assignmentRef = "crm-asg-9999";
      },
    ],
    [
      "signal timed away from the export",
      (value) => {
        signal(value, "signal-crm-inactivity").observedAt = "2026-09-03T00:00:00Z";
        evidenceRow(value, "evidence-signal-crm-inactivity").observedAt = "2026-09-03T00:00:00Z";
      },
    ],
  ]) {
    const candidate = broken((value) => {
      change(value);
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_signal_binding"), label);
  }

  const priorSignalEvidence = broken((value) => {
    const row = evidenceRow(value, "evidence-signal-crm-inactivity");
    row.observedAt = "2026-06-10T00:00:00Z";
    sealRecord(value, row);
  });
  assertSchemaValid(priorSignalEvidence, "signal evidence taken in a prior round");
  assert.ok(codes(priorSignalEvidence).has("invalid_signal_binding"));
});

test("decisions bind the exact assignment reference, digest, and round", () => {
  for (const [label, change, code] of [
    [
      "assignment reference mismatch",
      (value) => {
        decision(value, "decision-crm-reader-retain").assignmentRef = "crm-asg-9999";
      },
      "invalid_assignment_binding",
    ],
    [
      "assignment digest mismatch",
      (value) => {
        decision(value, "decision-crm-reader-retain").assignmentDigest = FOREIGN_DIGEST;
      },
      "invalid_assignment_binding",
    ],
    [
      "round mismatch",
      (value) => {
        decision(value, "decision-crm-reader-retain").roundRef = "round-2026-q2";
      },
      "invalid_round_binding",
    ],
    [
      "unknown assignment row",
      (value) => {
        decision(value, "decision-crm-reader-retain").assignmentRowRef =
          "assignment-not-supplied";
      },
      "invalid_assignment_binding",
    ],
  ]) {
    const candidate = broken((value) => {
      change(value);
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has(code), label);
  }

  const snapshotDrift = broken((value) => {
    value.round.snapshotDigest = FOREIGN_DIGEST;
  });
  assertSchemaValid(snapshotDrift, "snapshot digest drift");
  assert.ok(codes(snapshotDrift).has("invalid_round_binding"));
});

test("every decision sits inside the declared review window", () => {
  for (const [label, decidedAt] of [
    ["decision before the snapshot cutoff", "2026-08-25T09:00:00Z"],
    ["decision at the snapshot cutoff", CUTOFF],
    ["decision one millisecond after the round closes", "2026-09-30T00:00:00.001Z"],
    ["decision after the round closes", "2026-10-05T09:00:00Z"],
  ]) {
    const candidate = broken((value) => {
      decision(value, "decision-crm-reader-retain").decidedAt = decidedAt;
      evidenceRow(value, "evidence-decision-crm-retain").observedAt = decidedAt;
      sealAll(value);
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_decision_chronology"), label);
  }

  // A window that opens after the cutoff is the case the cutoff rule alone never
  // catches: the decision is genuinely after the snapshot and still too early.
  const beforeOpens = broken((value) => {
    value.round.window.opensAt = "2026-09-06T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(beforeOpens, "decision recorded before the window opens");
  assert.deepEqual(sortedCodes(beforeOpens), ["invalid_decision_chronology"]);

  const atOpens = mutate((value) => {
    value.round.window.opensAt = "2026-09-04T14:20:00Z";
    sealAll(value);
  });
  assertSchemaValid(atOpens, "decision recorded exactly as the window opens");
  assert.deepEqual(accessEntitlementReviewFindings(atOpens), []);

  const atClose = mutate((value) => {
    decision(value, "decision-warehouse-analyst-retain").decidedAt = CLOSES_AT;
    evidenceRow(value, "evidence-decision-warehouse-retain").observedAt = CLOSES_AT;
    sealAll(value);
  });
  assertSchemaValid(atClose, "decision recorded exactly as the round closes");
  assert.deepEqual(accessEntitlementReviewFindings(atClose), []);
});

test("non-decision and blocker instants obey the same window bounds", () => {
  function withNonDecision(recordedAt, extra = () => {}) {
    return mutate((value) => {
      dropDecision(value, "decision-warehouse-analyst-retain");
      extra(value);
      addNonDecision(value, {
        id: "non-decision-warehouse-coordinator",
        rowRef: "assignment-warehouse-analyst-leo",
        recordedByRef: "principal-omar-diaz",
        recordedAt,
      });
      value.handoff.state = "blocked";
      sealAll(value);
    });
  }

  const atCutoff = withNonDecision(CUTOFF);
  assertSchemaValid(atCutoff, "non-decision recorded at the snapshot cutoff");
  assert.deepEqual(sortedCodes(atCutoff), ["invalid_non_decision"]);

  const beforeOpens = withNonDecision("2026-09-02T00:00:00Z", (value) => {
    value.round.window.opensAt = "2026-09-03T00:00:00Z";
  });
  assertSchemaValid(beforeOpens, "non-decision recorded before the window opens");
  assert.deepEqual(sortedCodes(beforeOpens), ["invalid_non_decision"]);

  const atClose = withNonDecision(CLOSES_AT);
  assertSchemaValid(atClose, "non-decision recorded exactly as the round closes");
  assert.deepEqual(accessEntitlementReviewFindings(atClose), []);

  const afterClose = withNonDecision("2026-09-30T00:00:00.001Z");
  assertSchemaValid(afterClose, "non-decision recorded after the round closes");
  assert.ok(codes(afterClose).has("invalid_non_decision"));

  function withBlocker(raisedAt, extra = () => {}) {
    return mutate((value) => {
      assignment(value, "assignment-crm-reader-leo").privileged = null;
      reseal(value);
      extra(value);
      addBlocker(value, {
        id: "blocker-crm-privilege-unknown",
        code: "assignment-privilege-unknown",
        targetRefs: ["assignment-crm-reader-leo"],
        raisedAt,
      });
      value.handoff.state = "blocked";
      sealAll(value);
    });
  }

  const blockerAtCutoff = withBlocker(CUTOFF);
  assertSchemaValid(blockerAtCutoff, "blocker raised at the snapshot cutoff");
  assert.deepEqual(sortedCodes(blockerAtCutoff), ["unsupported_blocker_condition"]);

  const blockerBeforeOpens = withBlocker("2026-09-02T00:00:00Z", (value) => {
    value.round.window.opensAt = "2026-09-03T00:00:00Z";
  });
  assertSchemaValid(blockerBeforeOpens, "blocker raised before the window opens");
  assert.deepEqual(sortedCodes(blockerBeforeOpens), ["unsupported_blocker_condition"]);

  const blockerAtClose = withBlocker(CLOSES_AT);
  assertSchemaValid(blockerAtClose, "blocker raised exactly as the round closes");
  assert.deepEqual(accessEntitlementReviewFindings(blockerAtClose), []);

  const blockerAfterClose = withBlocker("2026-10-01T00:00:00Z");
  assertSchemaValid(blockerAfterClose, "blocker raised after the round closes");
  assert.ok(codes(blockerAfterClose).has("unsupported_blocker_condition"));
});

test("decision evidence is exact, single, and authored by the deciding human", () => {
  const wrongAuthor = broken((value) => {
    const row = evidenceRow(value, "evidence-decision-crm-retain");
    row.suppliedByRef = "principal-iris-tanaka";
    sealRecord(value, row);
  });
  assertSchemaValid(wrongAuthor, "decision record authored by someone else");
  assert.ok(codes(wrongAuthor).has("invalid_decision_evidence"));

  const wrongInstant = broken((value) => {
    const row = evidenceRow(value, "evidence-decision-crm-retain");
    row.observedAt = "2026-09-04T14:21:00Z";
    sealRecord(value, row);
  });
  assertSchemaValid(wrongInstant, "decision record at a different instant");
  assert.ok(codes(wrongInstant).has("invalid_decision_evidence"));

  const extraUnrelated = broken((value) => {
    value.evidence.push(
      sealRecord(value, {
        id: "evidence-decision-crm-retain-supplement",
        kind: "decision-record",
        controlledSource: "access-reviews",
        controlledPurpose: "2026-q3/decision-crm-asg-4417-supplement",
        controlledRef: null,
        recordDigest: null,
        payloadDigest: null,
        observedAt: "2026-09-04T14:20:00Z",
        suppliedByRef: "principal-mara-quinn",
        snapshotDigest: value.snapshot.digest,
        subjectRefs: ["decision-crm-reader-retain", "assignment-crm-reader-leo"],
      }),
    );
    decision(value, "decision-crm-reader-retain").evidenceRefs.push(
      "evidence-decision-crm-retain-supplement",
    );
  });
  assertSchemaValid(extraUnrelated, "second decision record on one decision");
  assert.ok(codes(extraUnrelated).has("invalid_decision_evidence"));

  const unknownSupplier = broken((value) => {
    const row = evidenceRow(value, "evidence-assignment-crm-reader");
    row.suppliedByRef = "principal-not-supplied";
    sealRecord(value, row);
  });
  assertSchemaValid(unknownSupplier, "evidence from an unknown supplier");
  assert.ok(codes(unknownSupplier).has("invalid_evidence_provenance"));

  const afterClose = broken((value) => {
    decision(value, "decision-crm-reader-retain").decidedAt = "2026-10-05T00:00:00Z";
    evidenceRow(value, "evidence-decision-crm-retain").observedAt = "2026-10-05T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(afterClose, "evidence after the round closes");
  assert.ok(codes(afterClose).has("invalid_evidence_provenance"));
});

test("non-decisions block readiness and escalations name a scoped next reviewer", () => {
  function escalate(value) {
    dropDecision(value, "decision-crm-reader-retain");
    addNonDecision(value, {
      id: "non-decision-crm-reader-escalated",
      rowRef: "assignment-crm-reader-leo",
      recordedByRef: "principal-mara-quinn",
      recordedAt: "2026-09-04T14:20:00Z",
      state: "escalated",
      escalation: {
        nextReviewerRef: "principal-priya-raman",
        authorityGrantRef: "grant-priya-crm-case-reader",
        dueAt: "2026-09-20T00:00:00Z",
      },
    });
  }

  const escalated = mutate((value) => {
    escalate(value);
    value.handoff.state = "blocked";
  });
  assertSchemaValid(escalated, "valid escalation");
  assert.deepEqual(accessEntitlementReviewFindings(escalated), []);

  const stillReady = mutate((value) => {
    escalate(value);
    value.handoff.state = "ready-for-owner-execution";
  });
  assertSchemaValid(stillReady, "escalation with ready handoff");
  assert.ok(codes(stillReady).has("invalid_review_handoff"));

  for (const [label, change] of [
    [
      "escalation without a next reviewer",
      (value) => {
        value.nonDecisions[0].escalation = null;
      },
    ],
    [
      "due date before the escalation",
      (value) => {
        value.nonDecisions[0].escalation.dueAt = "2026-09-02T00:00:00Z";
      },
    ],
    [
      "due date after the round closes",
      (value) => {
        value.nonDecisions[0].escalation.dueAt = "2026-10-10T00:00:00Z";
      },
    ],
    [
      "next reviewer without covering authority",
      (value) => {
        value.nonDecisions[0].escalation.nextReviewerRef = "principal-devon-shaw";
        value.nonDecisions[0].escalation.authorityGrantRef =
          "grant-devon-payments-settlement-admin";
      },
    ],
    [
      "escalation to the subject",
      (value) => {
        value.nonDecisions[0].escalation.nextReviewerRef = "principal-leo-brandt";
      },
    ],
    [
      "a non-escalation naming a next reviewer",
      (value) => {
        value.nonDecisions[0].state = "not-reviewed";
      },
    ],
  ]) {
    const candidate = mutate((value) => {
      escalate(value);
      change(value);
      sealAll(value);
      value.handoff.state = "blocked";
    });
    assertSchemaValid(candidate, label);
    assert.ok(codes(candidate).has("invalid_non_decision"), label);
  }
});

test("a non-decision has exactly two observable states", () => {
  // V1 has no assignment-changed lane. A row whose assignment moved is a row the
  // owner has to re-export, not a third way to close it inside this round.
  assert.deepEqual(schema.$defs.nonDecision.properties.state.enum, [
    "not-reviewed",
    "escalated",
  ]);

  for (const state of ["assignment-changed", "resolved", "deferred", "reviewed"]) {
    const candidate = mutate((value) => {
      dropDecision(value, "decision-warehouse-analyst-retain");
      addNonDecision(value, {
        id: "non-decision-warehouse-coordinator",
        rowRef: "assignment-warehouse-analyst-leo",
        recordedByRef: "principal-omar-diaz",
        recordedAt: "2026-09-20T00:00:00Z",
      });
      value.nonDecisions[0].state = state;
      value.handoff.state = "blocked";
    });
    assertSchemaInvalid(candidate, `non-decision state ${state}`);
  }
});

test("blockers and non-decisions carry exact owner accountability", () => {
  const unsupportedBlocker = broken((value) => {
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
  });
  assertSchemaValid(unsupportedBlocker, "privilege blocker on a classified row");
  assert.ok(codes(unsupportedBlocker).has("unsupported_blocker_condition"));

  const unownedBlocker = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
      ownedByRef: "principal-mara-quinn",
    });
  });
  assertSchemaValid(unownedBlocker, "blocker owned outside the coordinator scope");
  assert.ok(codes(unownedBlocker).has("unsupported_blocker_condition"));

  const doubleBlocked = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown-again",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
      raisedAt: "2026-09-03T00:00:00Z",
    });
  });
  assertSchemaValid(doubleBlocked, "one gap carried by two blockers");
  assert.ok(codes(doubleBlocked).has("unsupported_blocker_condition"));

  const resolvedBlocker = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
    value.blockers[0].status = "resolved";
    value.handoff.blockingRefs = value.handoff.blockingRefs.filter(
      (ref) => ref !== "blocker-crm-privilege-unknown",
    );
    sealAll(value);
  });
  assertSchemaValid(resolvedBlocker, "gap closed by declaring the blocker resolved");
  assert.ok(codes(resolvedBlocker).has("unsupported_blocker_condition"));

  const selfRecorded = broken((value) => {
    dropDecision(value, "decision-warehouse-analyst-retain");
    addNonDecision(value, {
      id: "non-decision-warehouse-self-recorded",
      rowRef: "assignment-warehouse-analyst-leo",
      recordedByRef: "principal-leo-brandt",
      recordedAt: "2026-09-20T00:00:00Z",
      withEvidence: false,
    });
  });
  assertSchemaValid(selfRecorded, "subject records their own non-decision");
  assert.ok(codes(selfRecorded).has("invalid_non_decision"));

  const unauthorisedRecorder = broken((value) => {
    dropDecision(value, "decision-warehouse-analyst-retain");
    addNonDecision(value, {
      id: "non-decision-warehouse-unauthorised",
      rowRef: "assignment-warehouse-analyst-leo",
      recordedByRef: "principal-devon-shaw",
      recordedAt: "2026-09-20T00:00:00Z",
    });
  });
  assertSchemaValid(unauthorisedRecorder, "non-decision recorded without row authority");
  assert.ok(codes(unauthorisedRecorder).has("invalid_non_decision"));

  const coordinatorRecorded = mutate((value) => {
    dropDecision(value, "decision-warehouse-analyst-retain");
    addNonDecision(value, {
      id: "non-decision-warehouse-coordinator",
      rowRef: "assignment-warehouse-analyst-leo",
      recordedByRef: "principal-omar-diaz",
      recordedAt: "2026-09-20T00:00:00Z",
    });
    value.handoff.state = "blocked";
  });
  assertSchemaValid(coordinatorRecorded, "round coordinator records the non-decision");
  assert.deepEqual(accessEntitlementReviewFindings(coordinatorRecorded), []);

  const unindexed = mutate((value) => {
    dropDecision(value, "decision-warehouse-analyst-retain");
    addNonDecision(value, {
      id: "non-decision-warehouse-coordinator",
      rowRef: "assignment-warehouse-analyst-leo",
      recordedByRef: "principal-omar-diaz",
      recordedAt: "2026-09-20T00:00:00Z",
    });
    value.handoff.blockingRefs = [];
    value.handoff.state = "blocked";
  });
  assertSchemaValid(unindexed, "non-decision missing from the blocking index");
  assert.ok(codes(unindexed).has("invalid_review_handoff"));
});

test("absent or unknown privilege never means not privileged", () => {
  function classificationAbsent(value) {
    value.snapshot.privilegeClassification = "absent";
    for (const row of value.assignments) row.privileged = null;
    decision(value, "decision-payments-admin-revoke").privilegedReview = false;
    reseal(value);
    addBlocker(value, {
      id: "blocker-privilege-classification-absent",
      code: "privilege-classification-absent",
      targetRefs: ["snapshot-2026-q3-workforce"],
    });
    value.handoff.state = "blocked";
  }

  const absent = mutate(classificationAbsent);
  assertSchemaValid(absent, "absent classification fails closed");
  assert.deepEqual(accessEntitlementReviewFindings(absent), []);

  const claimed = mutate((value) => {
    classificationAbsent(value);
    decision(value, "decision-payments-admin-revoke").privilegedReview = true;
    sealAll(value);
  });
  assertSchemaValid(claimed, "privileged SoD claimed without classification");
  assert.ok(codes(claimed).has("unsupported_privileged_sod_claim"));

  const unblocked = broken((value) => {
    value.snapshot.privilegeClassification = "absent";
    for (const row of value.assignments) row.privileged = null;
    decision(value, "decision-payments-admin-revoke").privilegedReview = false;
    reseal(value);
  });
  assertSchemaValid(unblocked, "absent classification without a blocker");
  assert.ok(codes(unblocked).has("invalid_privilege_classification"));

  const suppliedButSet = broken((value) => {
    value.snapshot.privilegeClassification = "absent";
    addBlocker(value, {
      id: "blocker-privilege-classification-absent",
      code: "privilege-classification-absent",
      targetRefs: ["snapshot-2026-q3-workforce"],
    });
  });
  assertSchemaValid(suppliedButSet, "row privilege supplied under absent classification");
  assert.ok(codes(suppliedButSet).has("invalid_privilege_classification"));

  for (const classification of ["supplied", "absent"]) {
    const excludedClaim = broken((value) => {
      if (classification === "absent") classificationAbsent(value);
      assignment(value, "assignment-billing-writer-service").privileged = true;
      sealAll(value);
    });
    assertSchemaValid(excludedClaim, `excluded privilege under ${classification} classification`);
    assert.ok(codes(excludedClaim).has("invalid_privilege_classification"));
  }

  const unknownAsFalse = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
  });
  assertSchemaValid(unknownAsFalse, "unknown privilege treated as false");
  assert.ok(codes(unknownAsFalse).has("invalid_privilege_classification"));

  const unknownBlocked = mutate((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
    value.handoff.state = "blocked";
  });
  assertSchemaValid(unknownBlocked, "unknown privilege blocked");
  assert.deepEqual(accessEntitlementReviewFindings(unknownBlocked), []);
});

test("the not-covered access path set is fixed and fully rendered", () => {
  const emptyRegister = broken((value) => {
    value.snapshot.notCoveredAccessPaths = [];
    value.handoff.renderedNotCoveredPathRefs = [];
  });
  assertSchemaValid(emptyRegister, "empty register claiming completeness");
  assert.ok(codes(emptyRegister).has("incomplete_access_path_disclosure"));

  for (const kind of [
    "effective-access-computation",
    "inherited-group-membership",
    "external-federated-access",
    "break-glass-account",
  ]) {
    const candidate = broken((value) => {
      const dropped = value.snapshot.notCoveredAccessPaths.find(
        (row) => row.pathKind === kind,
      );
      value.snapshot.notCoveredAccessPaths = value.snapshot.notCoveredAccessPaths.filter(
        (row) => row.pathKind !== kind,
      );
      value.handoff.renderedNotCoveredPathRefs =
        value.handoff.renderedNotCoveredPathRefs.filter((ref) => ref !== dropped.id);
    });
    assertSchemaValid(candidate, `dropped ${kind} with the rest still rendered`);
    assert.ok(codes(candidate).has("incomplete_access_path_disclosure"), kind);
  }

  const duplicatedKind = broken((value) => {
    value.snapshot.notCoveredAccessPaths = value.snapshot.notCoveredAccessPaths.filter(
      (row) => row.pathKind !== "break-glass-account",
    );
    value.snapshot.notCoveredAccessPaths.push({
      id: "path-effective-access-again",
      pathKind: "effective-access-computation",
    });
    value.handoff.renderedNotCoveredPathRefs = value.handoff.renderedNotCoveredPathRefs
      .filter((ref) => ref !== "path-break-glass")
      .concat("path-effective-access-again");
  });
  assertSchemaValid(duplicatedKind, "one kind standing in for another");
  assert.ok(codes(duplicatedKind).has("incomplete_access_path_disclosure"));

  const partiallyRendered = broken((value) => {
    value.handoff.renderedNotCoveredPathRefs =
      value.handoff.renderedNotCoveredPathRefs.filter((ref) => ref !== "path-effective-access");
  });
  assertSchemaValid(partiallyRendered, "hidden effective-access limitation");
  assert.ok(codes(partiallyRendered).has("incomplete_access_path_disclosure"));
});

test("no replacement or modify lane exists", () => {
  assert.equal(schema.$defs.decision.properties.replacementRequest.type, "null");
  assert.equal(schema.$defs.replacementRequest, undefined);
  const replacement = mutate((value) => {
    decision(value, "decision-payments-admin-revoke").replacementRequest = {
      requestedEntitlementRef: "entitlement://payments-platform/settlement-viewer",
      state: "requested-owner-execution",
    };
  });
  assertSchemaInvalid(replacement, "replacement request");
  assert.ok(codes(replacement).has("invalid_decision_source"));
  assertSchemaInvalid(
    mutate((value) => {
      decision(value, "decision-payments-admin-revoke").modify = {
        requestedEntitlementRef: "entitlement://payments-platform/settlement-viewer",
      };
    }),
    "modify lane",
  );
});

test("every round is a fresh round and no carry-forward surface exists", () => {
  assertSchemaInvalid(
    mutate((value) => {
      value.carryForwards = [];
    }),
    "carry-forward ledger",
  );
  assertSchemaInvalid(
    mutate((value) => {
      decision(value, "decision-crm-reader-retain").origin = "carried-forward";
    }),
    "carried-forward origin",
  );
  assertSchemaInvalid(
    mutate((value) => {
      decision(value, "decision-crm-reader-retain").carryForwardRef = "carry-crm-reader";
    }),
    "carry-forward reference",
  );
  assertSchemaInvalid(
    mutate((value) => {
      value.round.cadence.carryForwardPermitted = true;
    }),
    "carry-forward permission",
  );
  assertSchemaInvalid(
    mutate((value) => {
      value.round.cadence.recertificationMaxAgeDays = 180;
    }),
    "recertification age cap",
  );
  assertSchemaInvalid(
    mutate((value) => {
      evidenceRow(value, "evidence-decision-crm-retain").kind = "carry-forward-source";
    }),
    "carry-forward source evidence",
  );

  // A prior-round decision record, however well formed, cannot stand in for the
  // decision this round owes on this row.
  const priorDecisionOffered = broken((value) => {
    dropDecision(value, "decision-warehouse-analyst-retain");
    value.evidence.push(
      sealEnvelope({
        id: "evidence-prior-round-warehouse-retain",
        kind: "decision-record",
        controlledSource: "access-reviews",
        controlledPurpose: "2026-q2/decision-dwh-asg-0091",
        controlledRef: null,
        recordDigest: null,
        payloadDigest: FOREIGN_DIGEST,
        observedAt: "2026-06-10T15:00:00Z",
        suppliedByRef: "principal-sofia-hale",
        snapshotDigest: value.snapshot.digest,
        subjectRefs: ["decision-warehouse-analyst-retain", "assignment-warehouse-analyst-leo"],
      }),
    );
  });
  assertSchemaValid(priorDecisionOffered, "prior-round record offered as this round's decision");
  assert.ok(codes(priorDecisionOffered).has("missing_assignment_terminal"));
  assert.ok(codes(priorDecisionOffered).has("invalid_evidence_binding"));

  const priorDecisionReplayed = broken((value) => {
    decision(value, "decision-warehouse-analyst-retain").decidedAt = "2026-06-10T15:00:00Z";
    evidenceRow(value, "evidence-decision-warehouse-retain").observedAt = "2026-06-10T15:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(priorDecisionReplayed, "last quarter's decision replayed into this round");
  assert.deepEqual(sortedCodes(priorDecisionReplayed), [
    "authority_grant_coverage_missing",
    "invalid_decision_chronology",
    "invalid_evidence_provenance",
  ]);

  // priorRoundRef is opaque provenance with no decision effect either way.
  const withoutPriorRound = mutate((value) => {
    value.round.priorRoundRef = null;
    sealAll(value);
  });
  assertSchemaValid(withoutPriorRound, "no prior round declared");
  assert.deepEqual(accessEntitlementReviewFindings(withoutPriorRound), []);

  const otherPriorRound = mutate((value) => {
    value.round.priorRoundRef = "access-review-2019-q1";
    sealAll(value);
  });
  assertSchemaValid(otherPriorRound, "unrelated prior round declared");
  assert.deepEqual(accessEntitlementReviewFindings(otherPriorRound), []);

  const selfPriorRound = broken((value) => {
    value.round.priorRoundRef = value.round.id;
    sealAll(value);
  });
  assertSchemaValid(selfPriorRound, "current round named as its own predecessor");
  assert.ok(codes(selfPriorRound).has("invalid_round_binding"));
});

test("the round index and identity space stay exact", () => {
  const shortIndex = broken((value) => {
    value.round.decisionRefs = value.round.decisionRefs.filter(
      (id) => id !== "decision-crm-reader-retain",
    );
  });
  assertSchemaValid(shortIndex, "hidden decision index");
  assert.ok(codes(shortIndex).has("invalid_round_index"));

  const longIndex = broken((value) => {
    value.round.assignmentRefs.push("assignment-not-supplied");
  });
  assertSchemaValid(longIndex, "phantom assignment index");
  assert.ok(codes(longIndex).has("invalid_round_index"));

  const unindexedSignal = broken((value) => {
    value.round.sourceSignalRefs = value.round.sourceSignalRefs.filter(
      (id) => id !== "signal-crm-inactivity",
    );
  });
  assertSchemaValid(unindexedSignal, "signal missing from the round index");
  assert.ok(codes(unindexedSignal).has("invalid_round_index"));

  const collision = broken((value) => {
    principal(value, "principal-priya-raman").id = "principal-mara-quinn";
  });
  assertSchemaValid(collision, "identity collision");
  assert.ok(codes(collision).has("duplicate_review_id"));

  const rosterIdCollision = broken((value) => {
    value.authorityRoster.id = "round-2026-q3";
    value.round.authorityBoundary.rosterRef = "round-2026-q3";
  });
  assertSchemaValid(rosterIdCollision, "roster reusing the round identity");
  assert.ok(codes(rosterIdCollision).has("duplicate_review_id"));

  const openBlockerUnindexed = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").privileged = null;
    reseal(value);
    addBlocker(value, {
      id: "blocker-crm-privilege-unknown",
      code: "assignment-privilege-unknown",
      targetRefs: ["assignment-crm-reader-leo"],
    });
    value.handoff.blockingRefs = [];
  });
  assertSchemaValid(openBlockerUnindexed, "unindexed open blocker");
  assert.ok(codes(openBlockerUnindexed).has("invalid_review_handoff"));
});

test("the round destination and cutoff stay owner-approved and coherent", () => {
  const teamApproved = broken((value) => {
    value.round.destination.approvedByRef = "principal-access-review-board";
  });
  assertSchemaValid(teamApproved, "destination approved by a team");
  assert.ok(codes(teamApproved).has("invalid_principal_scope"));

  const publicDestination = broken((value) => {
    value.round.destination.controlledRef = "controlled://access-reviews";
  });
  assertSchemaInvalid(publicDestination, "destination outside the controlled namespace");

  const driftedCutoff = broken((value) => {
    value.round.asOf = "2026-08-30T00:00:00Z";
    sealAll(value);
  });
  assertSchemaValid(driftedCutoff, "cutoff detached from the snapshot");
  assert.ok(codes(driftedCutoff).has("invalid_round_binding"));

  const splitExport = broken((value) => {
    value.snapshot.exportEvidenceRef = "evidence-assignment-crm-reader";
  });
  assertSchemaValid(splitExport, "snapshot exported separately from the round");
  assert.ok(codes(splitExport).has("invalid_round_binding"));

  const freshBasisDropped = broken((value) => {
    value.round.cadence.recertificationBasis = "carry-forward-permitted";
  });
  assertSchemaInvalid(freshBasisDropped, "cadence declaring anything but a fresh round");

  const offCatalogRow = broken((value) => {
    assignment(value, "assignment-crm-reader-leo").entitlementRef =
      "entitlement://crm-platform/administrator";
    reseal(value);
  });
  assertSchemaValid(offCatalogRow, "row outside the owner entitlement catalog");
  assert.ok(codes(offCatalogRow).has("unknown_entitlement_catalog_ref"));

  const closedBeforeOpen = broken((value) => {
    value.round.window.closesAt = "2026-09-01T00:00:00Z";
  });
  assertSchemaValid(closedBeforeOpen, "window closing when it opens");
  assert.ok(codes(closedBeforeOpen).has("invalid_round_binding"));
});
