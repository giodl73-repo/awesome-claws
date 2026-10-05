import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { documentControlFindings, renderDocumentControl } from "./project-document-controller.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";
import { validateOpenClawProfile } from "./catalog-contract.mjs";

const root = new URL("../sources/project-document-controller/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/project-document-control.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/project-document-control.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = documentControlFindings;
const direction = () => ({ id: "DIR-1", project: "DEMO", documentId: "D-101", baselineRef: "D101-C",
  revisionRef: "D101-B", purpose: "construction", owner: "Project engineer",
  decidedAt: "2026-10-02T09:00:00+01:00", reference: "ENGINEER-DIRECTION-1" });

function continuedUse() {
  const value = clone();
  value.useDirections.push(direction());
  Object.assign(value.register[0], { currentUseRef: "D101-B", state: "usable", question: null });
  value.transmittals[0].holdReasons.shift();
  value.handoff.unresolvedRefs.shift();
  return value;
}

function authorizedDraft() {
  const value = continuedUse();
  for (const [kind, owner] of [["recipient-access", "Information owner"], ["issue", "Document controller"]]) {
    value.authorizations.push({ id: `AUTH-${kind}`, kind, project: "DEMO", transmittalId: "T-9", transmittalRevision: "T1",
      recipient: "Site team", purpose: "construction", revisionRefs: ["D101-B"], owner,
      decidedAt: "2026-10-02T10:00:00+01:00", validUntil: "2026-10-03T10:00:00+01:00", reference: `RECEIPT-${kind}` });
  }
  Object.assign(value.transmittals[0], { state: "ready-for-owner-issue", holdReasons: [] });
  value.handoff.unresolvedRefs.pop();
  return value;
}

test("document example separates latest receipt, historical approval and unresolved current use", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("project-document-controller", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["project-document-controller"], "project-document-control.schema.json");
  assert.equal(fixture.register[0].latestReceivedRef, "D101-C");
  assert.equal(fixture.register[0].lastApprovedRef, "D101-B");
  assert.equal(fixture.register[0].currentUseRef, null);
  assert.equal(fixture.workItems[1].revisionRefs[0], "D101-A");
  const rendered = renderDocumentControl(fixture);
  assert.match(rendered, /RFI-8: rfi/);
  assert.match(rendered, /Original references: D-101 A/);
  assert.match(rendered, /No explicit supersession relationship supplied/);
});

const mutations = [
  ["duplicate record", "document_duplicate", (x) => x.revisions.push(structuredClone(x.revisions[0]))],
  ["duplicate status definition", "document_duplicate", (x) => x.policy.codes.push(structuredClone(x.policy.codes[0]))],
  ["foreign project receipt", "document_scope", (x) => { x.revisions[0].project = "OTHER"; }],
  ["receipt for unknown document", "document_scope", (x) => { x.revisions[0].documentId = "OTHER"; }],
  ["future receipt", "document_chronology", (x) => { x.revisions[2].receivedAt = "2027-01-01T00:00:00Z"; }],
  ["review before receipt", "document_chronology", (x) => { x.useReviews[0].decidedAt = "2026-09-01T00:00:00Z"; }],
  ["foreign review owner", "document_review_scope", (x) => { x.useReviews[0].reviewer = "Another owner"; }],
  ["review for another document", "document_review_scope", (x) => { x.useReviews[0].documentId = "D-102"; }],
  ["review for missing revision", "document_review_scope", (x) => { x.useReviews[0].revisionRef = "MISSING"; }],
  ["missing required document", "document_register_coverage", (x) => x.register.pop()],
  ["reordered register", "document_register_coverage", (x) => x.register.reverse()],
  ["new receipt treated as approval", "document_register_state", (x) => { x.register[0].lastApprovedRef = "D101-C"; }],
  ["old approval treated as current use", "document_register_state", (x) => { x.register[0].currentUseRef = "D101-B"; }],
  ["missing document question", "document_question", (x) => { x.register[1].question = "  "; }],
  ["missing original follow-up", "document_followup_coverage", (x) => x.followUps.pop()],
  ["unknown RFI revision", "document_work_reference", (x) => { x.workItems[1].revisionRefs = ["MISSING"]; }],
  ["overdue RFI declared open", "document_followup_state", (x) => { x.followUps[1].state = "open"; }],
  ["missing follow-up question", "document_followup_state", (x) => { x.followUps[0].question = null; }],
  ["rewritten response reference", "document_response", (x) => { x.workItems[1].response = { reference: "RESP-1", revisionRefs: ["D101-C"], respondedAt: x.asOf, summary: "Supplied answer" }; }],
  ["response before receipt", "document_response", (x) => { x.workItems[0].response = { reference: "RESP-1", revisionRefs: ["D101-C"], respondedAt: "2026-09-01T00:00:00Z", summary: "Supplied answer" }; }],
  ["foreign transmittal", "document_scope", (x) => { x.transmittals[0].project = "OTHER"; }],
  ["dropped permission hold", "document_transmittal_state", (x) => x.transmittals[0].holdReasons.pop()],
  ["premature ready transmittal", "document_transmittal_state", (x) => { x.transmittals[0].state = "ready-for-owner-issue"; }],
  ["lost unresolved reference", "document_handoff", (x) => x.handoff.unresolvedRefs.pop()],
  ["issue claim", "document_authority", (x) => { x.handoff.issued = "issued"; }],
  ["engineering approval claim", "document_authority", (x) => { x.handoff.engineeringApproval = "approved"; }],
  ["EDMS mutation claim", "document_authority", (x) => { x.handoff.edmsChanges = "performed"; }],
  ["contact claim", "document_authority", (x) => { x.handoff.contacts = "sent"; }],
  ["agent engineering owner", "document_owner", (x) => { x.engineeringOwner = "assistant"; }],
];
for (const [name, code, mutate] of mutations) test(`document control rejects ${name}`, () => {
  const value = clone();
  mutate(value);
  assert.ok(findings(value).some((f) => f.code === code), code);
  assert.throws(() => renderDocumentControl(value));
});

test("numeric and nonlexical revision labels do not change receipt ordering", () => {
  const value = clone();
  [value.revisions[0].label, value.revisions[1].label, value.revisions[2].label] = ["10", "2", "01 / review"];
  value.registerRevision = "001";
  value.transmittals[0].revision = "01";
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
});

test("tied latest receipt stays unresolved", () => {
  const value = clone();
  value.revisions[1].receivedAt = value.revisions[2].receivedAt;
  value.useReviews[0].decidedAt = value.asOf;
  value.register[0].latestReceivedRef = null;
  assert.deepEqual(findings(value), []);
});

test("current baseline direction may retain older approved use without granting issue", () => {
  const value = continuedUse();
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  assert.equal(value.transmittals[0].state, "held");
  assert.equal(value.handoff.issued, "not-performed");
});

for (const [name, mutate, code] of [
  ["foreign owner", (d) => { d.owner = "Other owner"; }, "document_direction_scope"],
  ["foreign project", (d) => { d.project = "OTHER"; }, "document_direction_scope"],
  ["foreign document", (d) => { d.documentId = "D-102"; }, "document_direction_scope"],
  ["before baseline", (d) => { d.decidedAt = "2026-09-20T00:00:00Z"; }, "document_chronology"],
  ["stale baseline", (d) => { d.baselineRef = "D101-B"; }, "document_register_state"],
  ["unapproved target", (d) => { d.revisionRef = "D101-A"; }, "document_register_state"],
]) test(`continued use rejects ${name}`, () => {
  const value = continuedUse();
  mutate(value.useDirections[0]);
  assert.ok(findings(value).some((f) => f.code === code));
});

test("contradictory or unusable directions do not silently fall back to a usable revision", () => {
  const value = continuedUse();
  value.useDirections.push({ ...direction(), id: "DIR-2", revisionRef: "D101-A" });
  assert.ok(findings(value).some((f) => f.code === "document_register_state"));
});

test("explicit withdrawal removes current use but preserves historical approval", () => {
  const value = clone();
  value.supersessions.push({ id: "WITHDRAW-1", project: "DEMO", fromRef: "D101-B", toRef: null,
    effect: "withdrawn", owner: "Project engineer", decidedAt: value.asOf, reference: "WITHDRAWAL-1" });
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  value.useDirections.push(direction());
  assert.deepEqual(findings(value), []);
  value.register[0].currentUseRef = "D101-B";
  assert.ok(findings(value).some((f) => f.code === "document_register_state"));
});

test("supersession cannot cross document or owner boundaries", () => {
  const value = clone();
  value.supersessions.push({ id: "CHANGE-1", project: "DEMO", fromRef: "D101-B", toRef: "MISSING",
    effect: "replaced", owner: "Other owner", decidedAt: value.asOf, reference: "CHANGE-RECEIPT" });
  assert.ok(findings(value).some((f) => f.code === "document_supersession"));
});

test("unknown status, unavailable bytes and unknown draft revisions are explicit holds", () => {
  const value = clone();
  value.revisions[1].bytesSupplied = false;
  value.revisions[1].statusCode = "UNKNOWN";
  value.register[0].unknownStatusCodes = ["UNKNOWN"];
  value.transmittals[0].revisionRefs.push("MISSING");
  value.transmittals[0].holdReasons.push("missing-file", "unknown-status", "unknown-revision");
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  assert.match(renderDocumentControl(value), /MISSING \(revision not supplied\)/);
});

test("exact recipient and issue evidence only prepares a human issue draft", () => {
  const value = authorizedDraft();
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  assert.match(renderDocumentControl(value), /human issue remains separate/);
  assert.equal(value.handoff.issued, "not-performed");
});

for (const [field, replacement] of Object.entries({ project: "OTHER", transmittalId: "OTHER", transmittalRevision: "T2",
  recipient: "Other recipient", purpose: "review", revisionRefs: ["D101-C"], owner: "Other owner",
  validUntil: "2026-10-02T10:30:00+01:00" })) test(`issue evidence cannot be reused after ${field} changes`, () => {
  const value = authorizedDraft();
  value.authorizations[1][field] = replacement;
  assert.ok(findings(value).some((f) => f.code === "document_transmittal_state"));
});

test("RFI answers preserve original revision even after later receipts", () => {
  const value = clone();
  value.workItems[1].response = { reference: "RFI-ANSWER-8", respondedAt: value.asOf, revisionRefs: ["D101-A"], summary: "Owner supplied a response against A; applicability to later revisions requires separate review." };
  Object.assign(value.followUps[1], { state: "answered", question: null });
  value.handoff.unresolvedRefs = value.handoff.unresolvedRefs.filter((id) => id !== "RFI-8");
  assert.deepEqual(findings(value), []);
  assert.match(renderDocumentControl(value), /RFI-ANSWER-8/);
});

test("deadline comparisons honor timezone offsets", () => {
  const value = clone();
  value.workItems[1].deadline = "2026-10-02T05:00:00-07:00";
  value.followUps[1].state = "open";
  assert.deepEqual(findings(value), []);
});

test("schema rejects unknown fields, blank labels and timezone-free deadlines", () => {
  for (const mutate of [(x) => { x.handoff.approved = true; }, (x) => { x.revisions[0].label = " "; }, (x) => { x.workItems[0].deadline = "2026-10-03T12:00:00"; }]) {
    const value = clone();
    mutate(value);
    assert.equal(validate(value), false);
  }
});

test("malformed document control input returns a structure finding", () => {
  assert.equal(findings(null)[0].code, "document_structure");
  assert.equal(findings({})[0].code, "document_structure");
});

test("issue authorization cannot predate its referenced receipt", () => {
  const value = authorizedDraft();
  value.authorizations[1].decidedAt = "2026-09-01T00:00:00Z";
  assert.ok(findings(value).some((f) => f.code === "document_chronology"));
});

test("document controller retains a valid workspace-only profile in both declarations", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const contribution = JSON.parse(await readFile(new URL("../contributions/project-document-controller.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === "project-document-controller");
  for (const profile of [entry.openclawProfile, contribution.entry.openclawProfile]) {
    assert.doesNotThrow(() => validateOpenClawProfile(profile));
    assert.deepEqual(profile, { schemaVersion: 1, agent: { tools: { profile: "minimal", alsoAllow: ["read", "write", "edit"], fs: { workspaceOnly: true } } } });
  }
});

test("document renderer reproduces the checked-in useful register and handoff", async () => {
  const expected = await readFile(new URL("fixtures/document-package.example.md", root), "utf8");
  assert.equal(renderDocumentControl(fixture), expected.replaceAll("\r\n", "\n"));
});
