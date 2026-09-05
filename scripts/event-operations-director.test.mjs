import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL("../claws/event-operations-director/fixtures/run-of-show.example.json", import.meta.url),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/event-operations-director/schemas/run-of-show.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("event-operations-director", value).length === 0
  );
}

test("event run-of-show fixture keeps gates, items, and handoff consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("event-operations-director", fixture), []);
});

test("event run-of-show validator is total over schema-valid malformed nested records", () => {
  // vendors/evidence/gates/incidents/changes are declared as bare
  // `{"type":"array"}` with no `items` constraint, so a schema-valid object
  // member like `{}` must not crash the validator on any nested dereference.
  const malformedGate = clone();
  malformedGate.gates.push({});
  assert.equal(validateSchema(malformedGate), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedGate));
  assert.equal(isValid(malformedGate), false);

  const malformedChange = clone();
  malformedChange.changes.push({});
  assert.equal(validateSchema(malformedChange), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedChange));
  assert.equal(isValid(malformedChange), false);

  const malformedIncident = clone();
  malformedIncident.incidents.push({});
  assert.equal(validateSchema(malformedIncident), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedIncident));
  assert.equal(isValid(malformedIncident), false);

  const malformedEvidence = clone();
  malformedEvidence.evidence.push({});
  assert.equal(validateSchema(malformedEvidence), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedEvidence));
  assert.equal(isValid(malformedEvidence), false);

  const malformedVendor = clone();
  malformedVendor.vendors.push({});
  assert.equal(validateSchema(malformedVendor), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedVendor));
  assert.equal(isValid(malformedVendor), false);

  // `items` restores this claw's original nested `required` item constraint
  // (time/owner/state), now extended with id/dependsOn/completion fields, so
  // a bare `{}` is no longer schema-valid there; exercise the validator's
  // totality instead with every required key present but degenerate-typed.
  const hollowItem = clone();
  hollowItem.items.push({
    id: "item-hollow",
    time: {},
    owner: {},
    state: {},
    dependsOn: null,
    completedBy: null,
    completedAt: null,
    completionEvidenceRef: null,
  });
  assert.equal(validateSchema(hollowItem), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", hollowItem));
  assert.equal(isValid(hollowItem), false);
});

test("event run-of-show schema restores the original nested item required-field constraint", () => {
  // Before checkpoint 2, `items[].{time,owner,state}` were required by the
  // schema itself. A hollow item missing any of those must fail schema
  // validation, not merely semantic validation.
  for (const field of ["time", "owner", "state"]) {
    const hollowArtifact = clone();
    const item = {
      id: "item-hollow", time: "t", owner: "o", state: "planned", dependsOn: null,
      completedBy: null, completedAt: null, completionEvidenceRef: null,
    };
    delete item[field];
    hollowArtifact.items.push(item);
    assert.equal(
      validateSchema(hollowArtifact),
      false,
      `expected schema to reject an item missing "${field}"`,
    );
  }

  // A wholly hollow artifact (missing every top-level required field) must
  // never validate against the schema, ready-state text notwithstanding.
  assert.equal(validateSchema({ handoff: { state: "ready" } }), false);
});

test("event run-of-show validator handles a non-array prohibitedActions without throwing", () => {
  const malformedProhibitedActions = clone();
  malformedProhibitedActions.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformedProhibitedActions), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedProhibitedActions));
  const findings = validateArtifactSemantics("event-operations-director", malformedProhibitedActions);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("event run-of-show validator handles a non-array reference list without throwing", () => {
  const malformedVendorRefs = clone();
  malformedVendorRefs.handoff.vendorRefs = {};
  assert.equal(validateSchema(malformedVendorRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedVendorRefs));
  const findings = validateArtifactSemantics("event-operations-director", malformedVendorRefs);
  assert.ok(findings.some((item) => item.code === "invalid_reference_list"));
});

test("event run-of-show validator fails closed on a matching-length object masquerading as a reference list", () => {
  // `sameSet` must begin with Array.isArray on both sides before any
  // length/Set work: an object with a matching `.length` (e.g. `{ length: 2 }`)
  // must not be treated as equal to a genuine two-element reference array.
  const fakeArrayVendorRefs = clone();
  fakeArrayVendorRefs.handoff.vendorRefs = { length: 2 };
  assert.equal(validateSchema(fakeArrayVendorRefs), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", fakeArrayVendorRefs));
  assert.equal(isValid(fakeArrayVendorRefs), false);
});

test("event run-of-show validator rejects agent, assistant, and self-attested gate approvers", () => {
  const agentApprover = clone();
  agentApprover.gates.find((item) => item.id === "gate-capacity").approvedBy = "the assistant";
  assert.equal(isValid(agentApprover), false);

  const selfApprover = clone();
  selfApprover.gates.find((item) => item.id === "gate-capacity").approvedBy = "Event Operations Director";
  assert.equal(isValid(selfApprover), false);

  // A legitimate, unrelated human title (not the package's own role name)
  // must not be rejected.
  const legitimateApprover = clone();
  legitimateApprover.gates.find((item) => item.id === "gate-capacity").approvedBy = "Venue Fire Marshal";
  assert.equal(isValid(legitimateApprover), true, JSON.stringify(validateArtifactSemantics("event-operations-director", legitimateApprover)));
});

test("event run-of-show validator rejects a gate cleared without grounding evidence of the matching kind", () => {
  const ungroundedClearance = clone();
  const gate = ungroundedClearance.gates.find((item) => item.id === "gate-capacity");
  gate.evidenceRefs = ["evidence-avline-permit"]; // vendor-kind evidence, not attendee-kind
  assert.equal(isValid(ungroundedClearance), false);
  const findings = validateArtifactSemantics("event-operations-director", ungroundedClearance);
  assert.ok(findings.some((item) => item.code === "self_attested_gate_clearance"));
});

test("event run-of-show validator fails closed on an unknown gate kind", () => {
  const unknownGateKind = clone();
  const gate = unknownGateKind.gates.find((item) => item.id === "gate-capacity");
  gate.kind = "closed";
  assert.equal(validateSchema(unknownGateKind), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownGateKind), false);
  const findings = validateArtifactSemantics("event-operations-director", unknownGateKind);
  assert.ok(findings.some((item) => item.code === "invalid_gate_kind"));
  // An unknown gate kind must remain unresolved for readiness, not vanish
  // from the unresolved-gate accounting.
  assert.ok(!findings.some((item) => item.code === "self_attested_gate_clearance"));
});

test("event run-of-show validator fails closed on an unknown incident status", () => {
  const unknownIncidentStatus = clone();
  unknownIncidentStatus.incidents.find((item) => item.id === "incident-catering-delay").status =
    "resolved-ish";
  assert.equal(validateSchema(unknownIncidentStatus), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownIncidentStatus), false);
  const findings = validateArtifactSemantics("event-operations-director", unknownIncidentStatus);
  assert.ok(findings.some((item) => item.code === "invalid_incident_status"));
});

test("event run-of-show validator rejects a change applied before the incident it references was reported, including timestamp variants", () => {
  const earlyChange = clone();
  earlyChange.changes.find((item) => item.id === "change-breakfast-window").appliedAt =
    "2026-09-09T10:00:00Z";
  assert.equal(isValid(earlyChange), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", earlyChange).some(
      (item) => item.code === "invalid_change_chronology",
    ),
  );

  // A raw epoch-millisecond timestamp string must not bypass the chronology
  // check merely by failing to parse as an ISO date.
  const timestampChange = clone();
  const change = timestampChange.changes.find((item) => item.id === "change-breakfast-window");
  const incident = timestampChange.incidents.find((item) => item.id === "incident-catering-delay");
  incident.reportedAt = "1789000000000";
  change.appliedAt = "1788000000000";
  assert.equal(isValid(timestampChange), false);

  const malformedTimestamp = clone();
  malformedTimestamp.changes.find((item) => item.id === "change-breakfast-window").appliedAt =
    "not-a-real-timestamp";
  assert.doesNotThrow(() => validateArtifactSemantics("event-operations-director", malformedTimestamp));
  assert.equal(isValid(malformedTimestamp), false);
});

test("event run-of-show validator prevents a dependent item from closing before its dependency is done", () => {
  const prematureCompletion = clone();
  // item-breakout-tracks depends on item-general-session, which remains
  // "in-progress"; marking the dependent item done first must not bypass the
  // dependency-completion check.
  prematureCompletion.items.find((item) => item.id === "item-breakout-tracks").state = "done";
  assert.equal(isValid(prematureCompletion), false);
  const findings = validateArtifactSemantics("event-operations-director", prematureCompletion);
  assert.ok(findings.some((item) => item.code === "premature_item_completion"));
});

test("event run-of-show validator requires a named, non-agent, non-self event and handoff owner", () => {
  const blankOwner = clone();
  blankOwner.handoff.owner = "  ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const agentOwner = clone();
  agentOwner.eventOwnerId = "system";
  assert.equal(isValid(agentOwner), false);

  const selfOwner = clone();
  selfOwner.handoff.owner = "Event Operations Director";
  assert.equal(isValid(selfOwner), false);
});

test("event run-of-show validator requires every evidence record to carry a controlled source reference and a parseable assertedAt timestamp", () => {
  const fabricatedSource = clone();
  fabricatedSource.evidence.find((item) => item.id === "evidence-headcount-final").sourceRef =
    "trust me, it happened";
  assert.equal(isValid(fabricatedSource), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", fabricatedSource).some(
      (item) => item.code === "untrusted_evidence_source",
    ),
  );

  const missingSource = clone();
  delete missingSource.evidence.find((item) => item.id === "evidence-headcount-final").sourceRef;
  assert.equal(validateSchema(missingSource), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingSource), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", missingSource).some(
      (item) => item.code === "untrusted_evidence_source",
    ),
  );

  const missingAssertedAt = clone();
  delete missingAssertedAt.evidence.find((item) => item.id === "evidence-headcount-final").assertedAt;
  assert.equal(validateSchema(missingAssertedAt), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingAssertedAt), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", missingAssertedAt).some(
      (item) => item.code === "invalid_evidence_timestamp",
    ),
  );

  const malformedAssertedAt = clone();
  malformedAssertedAt.evidence.find((item) => item.id === "evidence-headcount-final").assertedAt =
    "not-a-real-timestamp";
  assert.equal(isValid(malformedAssertedAt), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", malformedAssertedAt).some(
      (item) => item.code === "invalid_evidence_timestamp",
    ),
  );
});

test("event run-of-show validator requires incident reportedAt and item time to be parseable timestamps", () => {
  const malformedReportedAt = clone();
  malformedReportedAt.incidents.find((item) => item.id === "incident-catering-delay").reportedAt =
    "not-a-real-timestamp";
  assert.equal(isValid(malformedReportedAt), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", malformedReportedAt).some(
      (item) => item.code === "invalid_timestamp" && item.path === "incidents[0].reportedAt",
    ),
  );

  const malformedItemTime = clone();
  malformedItemTime.items.find((item) => item.id === "item-general-session").time = "not-a-real-timestamp";
  assert.equal(isValid(malformedItemTime), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", malformedItemTime).some(
      (item) => item.code === "invalid_timestamp" && item.path === "items[1].time",
    ),
  );
});

test("event run-of-show validator rejects incident resolution timestamped before the incident was reported", () => {
  const earlyResolution = clone();
  const incident = earlyResolution.incidents.find((item) => item.id === "incident-catering-delay");
  incident.status = "resolved";
  incident.resolvedBy = "owner-event-director";
  incident.resolvedAt = "2026-09-08"; // before reportedAt (2026-09-09T14:00:00Z)
  incident.resolutionEvidenceRef = null;
  assert.equal(isValid(earlyResolution), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", earlyResolution).some(
      (item2) => item2.code === "self_attested_incident_resolution",
    ),
  );
});

test("event run-of-show validator rejects item completion timestamped before the item's scheduled time", () => {
  const earlyCompletion = clone();
  const item = earlyCompletion.items.find((entry) => entry.id === "item-general-session");
  item.state = "done";
  item.completedBy = "owner-program-lead";
  item.completedAt = "2026-09-11T08:30:00-04:00"; // before the item's own 09:00 scheduled time
  item.completionEvidenceRef = null;
  assert.equal(isValid(earlyCompletion), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", earlyCompletion).some(
      (item2) => item2.code === "self_attested_item_completion",
    ),
  );
});

test("event run-of-show validator rejects grounding evidence asserted outside the incident report-to-resolution window", () => {
  // Evidence dated after the claimed resolution timestamp must not ground it.
  const lateEvidence = clone();
  lateEvidence.evidence.push({
    id: "evidence-catering-delay-resolution",
    kind: "run-of-show",
    refId: "incident-catering-delay",
    vendorRef: null,
    sourceRef: "controlled://event-evidence/customer-summit-2026/catering-delay-resolution-late",
    note: "Evidence asserted after the claimed resolution timestamp.",
    assertedAt: "2026-09-11T00:00:00Z",
    assertion: "resolution",
  });
  const incident = lateEvidence.incidents.find((item) => item.id === "incident-catering-delay");
  incident.status = "resolved";
  incident.resolvedBy = "owner-event-director";
  incident.resolvedAt = "2026-09-10";
  incident.resolutionEvidenceRef = "evidence-catering-delay-resolution";
  assert.equal(isValid(lateEvidence), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", lateEvidence).some(
      (item2) => item2.code === "self_attested_incident_resolution",
    ),
  );

  // Evidence dated before the incident was even reported must likewise not
  // ground the resolution.
  const earlyEvidence = clone();
  earlyEvidence.evidence.push({
    id: "evidence-catering-delay-resolution",
    kind: "run-of-show",
    refId: "incident-catering-delay",
    vendorRef: null,
    sourceRef: "controlled://event-evidence/customer-summit-2026/catering-delay-resolution-early",
    note: "Evidence asserted before the incident was reported.",
    assertedAt: "2026-09-08T00:00:00Z",
    assertion: "resolution",
  });
  const incident2 = earlyEvidence.incidents.find((item) => item.id === "incident-catering-delay");
  incident2.status = "resolved";
  incident2.resolvedBy = "owner-event-director";
  incident2.resolvedAt = "2026-09-10";
  incident2.resolutionEvidenceRef = "evidence-catering-delay-resolution";
  assert.equal(isValid(earlyEvidence), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", earlyEvidence).some(
      (item2) => item2.code === "self_attested_incident_resolution",
    ),
  );
});

test("event run-of-show validator rejects grounding evidence asserted outside the item's schedule-to-completion window", () => {
  // Evidence dated after the claimed completion timestamp must not ground it.
  const lateEvidence = clone();
  lateEvidence.evidence.push({
    id: "evidence-general-session-completion",
    kind: "run-of-show",
    refId: "item-general-session",
    vendorRef: null,
    sourceRef: "controlled://event-evidence/customer-summit-2026/general-session-late",
    note: "Evidence asserted after the claimed completion timestamp.",
    assertedAt: "2026-09-11T10:00:00-04:00",
    assertion: "completion",
  });
  const item = lateEvidence.items.find((entry) => entry.id === "item-general-session");
  item.state = "done";
  item.completedBy = "owner-program-lead";
  item.completedAt = "2026-09-11T09:45:00-04:00";
  item.completionEvidenceRef = "evidence-general-session-completion";
  assert.equal(isValid(lateEvidence), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", lateEvidence).some(
      (entry) => entry.code === "self_attested_item_completion",
    ),
  );

  // Evidence dated before the item's own scheduled time must likewise not
  // ground its completion.
  const earlyEvidence = clone();
  earlyEvidence.evidence.push({
    id: "evidence-general-session-completion",
    kind: "run-of-show",
    refId: "item-general-session",
    vendorRef: null,
    sourceRef: "controlled://event-evidence/customer-summit-2026/general-session-early",
    note: "Evidence asserted before the item's scheduled time.",
    assertedAt: "2026-09-11T08:00:00-04:00",
    assertion: "completion",
  });
  const item2 = earlyEvidence.items.find((entry) => entry.id === "item-general-session");
  item2.state = "done";
  item2.completedBy = "owner-program-lead";
  item2.completedAt = "2026-09-11T09:45:00-04:00";
  item2.completionEvidenceRef = "evidence-general-session-completion";
  assert.equal(isValid(earlyEvidence), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", earlyEvidence).some(
      (entry) => entry.code === "self_attested_item_completion",
    ),
  );
});

test("event run-of-show validator blocks a ready state until every gate, item, and incident is resolved, and rejects a closed-incident bypass", () => {
  const readyAttempt = clone();
  readyAttempt.gates.find((item) => item.id === "gate-safety").status = "cleared";
  readyAttempt.gates.find((item) => item.id === "gate-safety").approvedBy = "Venue Fire Marshal";
  readyAttempt.gates.find((item) => item.id === "gate-safety").approvedAt = "2026-09-10";
  readyAttempt.evidence.push(
    {
      id: "evidence-catering-delay-resolution",
      kind: "run-of-show",
      refId: "incident-catering-delay",
      vendorRef: null,
      sourceRef: "controlled://event-evidence/customer-summit-2026/catering-delay-resolution-2026-09-10",
      note: "Metro Catering confirmed the breakfast delivery arrived within the shifted window.",
      assertedAt: "2026-09-09T20:00:00Z",
      assertion: "resolution",
    },
    {
      id: "evidence-general-session-completion",
      kind: "run-of-show",
      refId: "item-general-session",
      vendorRef: null,
      sourceRef: "controlled://event-evidence/customer-summit-2026/general-session-completion-2026-09-11",
      note: "Program lead confirmed the general session ran and closed on schedule.",
      assertedAt: "2026-09-11T09:40:00-04:00",
      assertion: "completion",
    },
    {
      id: "evidence-breakout-tracks-completion",
      kind: "run-of-show",
      refId: "item-breakout-tracks",
      vendorRef: null,
      sourceRef: "controlled://event-evidence/customer-summit-2026/breakout-tracks-completion-2026-09-11",
      note: "Program lead confirmed all breakout tracks concluded on schedule.",
      assertedAt: "2026-09-11T11:10:00-04:00",
      assertion: "completion",
    },
  );
  readyAttempt.incidents.find((item) => item.id === "incident-catering-delay").status = "resolved";
  Object.assign(readyAttempt.incidents.find((item) => item.id === "incident-catering-delay"), {
    resolvedBy: "owner-event-director",
    resolvedAt: "2026-09-10",
    resolutionEvidenceRef: "evidence-catering-delay-resolution",
  });
  Object.assign(readyAttempt.items.find((item) => item.id === "item-general-session"), {
    state: "done",
    completedBy: "owner-program-lead",
    completedAt: "2026-09-11T09:45:00-04:00",
    completionEvidenceRef: "evidence-general-session-completion",
  });
  Object.assign(readyAttempt.items.find((item) => item.id === "item-breakout-tracks"), {
    state: "done",
    completedBy: "owner-program-lead",
    completedAt: "2026-09-11T11:15:00-04:00",
    completionEvidenceRef: "evidence-breakout-tracks-completion",
  });
  readyAttempt.handoff.state = "ready";
  readyAttempt.handoff.unresolvedGateRefs = [];
  readyAttempt.handoff.unresolvedItemRefs = [];
  readyAttempt.handoff.unresolvedIncidentRefs = [];
  assert.equal(isValid(readyAttempt), true, JSON.stringify(validateArtifactSemantics("event-operations-director", readyAttempt)));

  // An unmodeled terminal-looking incident status ("closed") must not bypass
  // readiness the way the genuinely modeled "resolved" status does.
  const closedIncidentBypass = clone(readyAttempt);
  closedIncidentBypass.incidents.find((item) => item.id === "incident-catering-delay").status = "closed";
  assert.equal(validateSchema(closedIncidentBypass), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(closedIncidentBypass), false);
  const findings = validateArtifactSemantics("event-operations-director", closedIncidentBypass);
  assert.ok(findings.some((item) => item.code === "invalid_incident_status"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("event run-of-show validator rejects self-attested incident resolution and item completion, and enforces resolution/completion evidence linkage", () => {
  const selfResolvedIncident = clone();
  const incident = selfResolvedIncident.incidents.find((item) => item.id === "incident-catering-delay");
  incident.status = "resolved";
  incident.resolvedBy = "Event Operations Director";
  incident.resolvedAt = "2026-09-10";
  incident.resolutionEvidenceRef = null;
  assert.equal(isValid(selfResolvedIncident), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", selfResolvedIncident).some(
      (item) => item.code === "self_attested_incident_resolution",
    ),
  );

  // Reusing an *observation*-assertion evidence record (not resolution) must
  // not satisfy the incident's resolution grounding.
  const wrongAssertionIncident = clone();
  const incident2 = wrongAssertionIncident.incidents.find((item) => item.id === "incident-catering-delay");
  incident2.status = "resolved";
  incident2.resolvedBy = "owner-event-director";
  incident2.resolvedAt = "2026-09-10";
  incident2.resolutionEvidenceRef = "evidence-safety-plan"; // observation-assertion, unrelated to this incident
  assert.equal(isValid(wrongAssertionIncident), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", wrongAssertionIncident).some(
      (item) => item.code === "self_attested_incident_resolution",
    ),
  );

  // A "done" item without a completer, timestamp, or grounding completion
  // evidence must not bypass readiness even though its own status text says
  // done.
  const selfCompletedItem = clone();
  const item = selfCompletedItem.items.find((entry) => entry.id === "item-general-session");
  item.state = "done";
  item.completedBy = "the assistant";
  item.completedAt = "2026-09-11T09:45:00-04:00";
  item.completionEvidenceRef = null;
  assert.equal(isValid(selfCompletedItem), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", selfCompletedItem).some(
      (item2) => item2.code === "self_attested_item_completion",
    ),
  );
});

test("event run-of-show validator requires the full prohibited-action gate list and rejects narrative bypass claims", () => {
  const missingGate = clone();
  missingGate.handoff.prohibitedActions = missingGate.handoff.prohibitedActions.filter(
    (action) => action !== "contact-vendor",
  );
  assert.equal(isValid(missingGate), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", missingGate).some(
      (item) => item.code === "missing_authority_gate",
    ),
  );

  const narrativeBypass = clone();
  narrativeBypass.handoff.summary = "We already contacted the vendor to confirm delivery.";
  assert.equal(isValid(narrativeBypass), false);
  assert.ok(
    validateArtifactSemantics("event-operations-director", narrativeBypass).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
  );

  // A negated claim about the very same prohibited action must not trip the
  // narrative check.
  const negatedNarrative = clone();
  negatedNarrative.handoff.summary = "We have not contacted the vendor and will not until approved.";
  assert.equal(
    validateArtifactSemantics("event-operations-director", negatedNarrative).some(
      (item) => item.code === "unauthorized_narrative_action",
    ),
    false,
  );
});

test("validate-artifact CLI accepts the packaged event-operations-director fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "event-operations-director", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI reports semantic findings for a premature-ready event artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `event-operations-director-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "event-operations-director", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_ready_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
