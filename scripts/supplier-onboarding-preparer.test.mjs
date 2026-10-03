import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { supplierOnboardingFindings, renderSupplierOnboarding } from "./supplier-onboarding-preparer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";
import { validateOpenClawProfile } from "./catalog-contract.mjs";

const root = new URL("../sources/supplier-onboarding-preparer/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/supplier-onboarding.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/supplier-onboarding.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = supplierOnboardingFindings;

test("supplier catalog and contribution preserve the workspace-only v1 profile", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const contribution = JSON.parse(await readFile(new URL("../contributions/supplier-onboarding-preparer.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === "supplier-onboarding-preparer");
  const expected = {
    schemaVersion: 1,
    agent: { tools: { profile: "minimal", alsoAllow: ["read", "write", "edit"], fs: { workspaceOnly: true } } },
  };
  for (const profile of [entry.openclawProfile, contribution.entry.openclawProfile]) {
    assert.doesNotThrow(() => validateOpenClawProfile(profile));
    assert.deepEqual(profile, expected);
  }
});

function resolvedExample() {
  const value = clone();
  value.entityDecision = { id: "RESOLUTION", reference: "PROCUREMENT-RESOLUTION-1", legalEntity: "Example Services LLC",
    identityRefs: ["INTAKE", "CONTRACT"], scopeRevision: "S2", decidedBy: "Procurement owner", decidedAt: "2026-10-02T10:00:00-07:00" };
  value.setup.legalEntity = "Example Services LLC";
  value.setup.entityState = "resolved-by-owner";
  value.reviews.push(
    { ...value.reviews[0], id: "PRIVACY-P2", reference: "CONTROLLED-PRIVACY-P2", scopeRevision: "S2", decidedAt: "2026-10-02T11:00:00-07:00" },
    { ...value.reviews[0], id: "FINANCE-F1", reference: "CONTROLLED-FINANCE-F1", requirementId: "PAYMENT", kind: "payment", scopeRevision: "S2", reviewer: "Finance owner", decidedAt: "2026-10-02T11:15:00-07:00" },
  );
  for (const row of value.coverage) { row.state = "satisfied"; row.requestId = null; }
  value.coverage[0].evidenceRefs.push("RESOLUTION");
  value.coverage[3].evidenceRefs.push("PRIVACY-P2");
  value.coverage[4].evidenceRefs.push("FINANCE-F1");
  value.requests = [];
  value.handoff.state = "review-draft";
  value.handoff.blockingRequirementIds = [];
  return value;
}

test("supplier example validates with usable fields, conflict and reopened Privacy review", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("supplier-onboarding-preparer", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["supplier-onboarding-preparer"], "supplier-onboarding.schema.json");
  assert.equal(fixture.coverage.length, 5);
  assert.equal(fixture.setup.legalEntity, null);
  assert.equal(fixture.coverage[3].state, "reopened");
});

const mutations = [
  ["omitted checklist mapping", "supplier_coverage", (x) => x.coverage.pop()],
  ["duplicate checklist mapping", "supplier_coverage", (x) => x.coverage.push(structuredClone(x.coverage[0]))],
  ["changed checklist order", "supplier_coverage", (x) => x.coverage.reverse()],
  ["duplicate identity", "supplier_duplicate", (x) => x.identities.push(structuredClone(x.identities[0]))],
  ["silent legal-name choice", "supplier_entity_conflict", (x) => { x.setup.legalEntity = "Example Services LLC"; x.setup.entityState = "consistent"; }],
  ["scope rewritten to fit old review", "supplier_scope", (x) => { x.setup.personalData = false; }],
  ["service rewritten", "supplier_scope", (x) => { x.setup.service = "Different engagement"; }],
  ["selection from another supplier", "supplier_selection", (x) => { x.selection.supplier = "SUP-99"; }],
  ["selection from another buyer", "supplier_selection", (x) => { x.selection.buyingEntity = "BUY-OTHER"; }],
  ["old Privacy review carried forward", "supplier_item_state", (x) => { x.coverage[3].state = "satisfied"; }],
  ["invented Finance evidence", "supplier_evidence_coverage", (x) => { x.coverage[4].evidenceRefs = ["MISSING-RECEIPT"]; }],
  ["missing contradictory entity reference", "supplier_evidence_coverage", (x) => { x.coverage[0].evidenceRefs.pop(); }],
  ["borrowed receipt", "supplier_evidence_coverage", (x) => { x.coverage[4].evidenceRefs = ["PRIVACY-P1"]; }],
  ["review for another requirement", "supplier_review_target", (x) => { x.reviews[0].requirementId = "PAYMENT"; }],
  ["future review", "supplier_review_time", (x) => { x.reviews[0].decidedAt = "2027-01-01T00:00:00Z"; }],
  ["review expires before decision", "supplier_review_time", (x) => { x.reviews[0].validUntil = "2026-01-01T00:00:00Z"; }],
  ["missing owner question", "supplier_request", (x) => x.requests.pop()],
  ["wrong owner route", "supplier_request", (x) => { x.requests[2].owner = "Privacy owner"; }],
  ["blank question", "supplier_request", (x) => { x.requests[0].question = "  "; }],
  ["orphan question", "supplier_request", (x) => { x.requests[0].requirementId = "OTHER"; }],
  ["lost prerequisite", "supplier_handoff", (x) => x.handoff.blockingRequirementIds.pop()],
  ["premature draft clearance", "supplier_handoff", (x) => { x.handoff.state = "review-draft"; }],
  ["activation claim", "supplier_authority", (x) => { x.handoff.activation = "activated"; }],
  ["payment verification claim", "supplier_authority", (x) => { x.handoff.paymentVerification = "verified"; }],
  ["contact claim", "supplier_authority", (x) => { x.handoff.contact = "sent"; }],
  ["specialist approval claim", "supplier_authority", (x) => { x.handoff.specialistApproval = "granted"; }],
  ["agent owner", "supplier_owner", (x) => { x.owner = "assistant"; }],
  ["personal contact in question", "supplier_sensitive_text", (x) => { x.requests[2].question += " person@example.invalid"; }],
  ["SSN-shaped identifier", "supplier_sensitive_text", (x) => { x.requests[2].question += " 000-12-3456"; }],
  ["IBAN-shaped identifier", "supplier_sensitive_text", (x) => { x.requests[2].question += " ZZ000000000000000"; }],
];
for (const [name, code, mutate] of mutations) test(`supplier rejects ${name}`, () => {
  const value = clone();
  mutate(value);
  assert.ok(findings(value).some((f) => f.code === code), code);
  assert.throws(() => renderSupplierOnboarding(value));
});

test("resolved identity and current owner receipts yield only a review draft", () => {
  const value = resolvedExample();
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  assert.equal(value.handoff.activation, "not-performed");
  assert.match(renderSupplierOnboarding(value), /No unresolved checklist questions/);
  assert.ok(value.reviews.some((r) => r.id === "PRIVACY-P1"));
});

for (const [name, mutate] of [
  ["supplier", (r) => { r.supplier = "SUP-OTHER"; }],
  ["buying entity", (r) => { r.buyingEntity = "BUY-OTHER"; }],
  ["legal entity", (r) => { r.legalEntity = "Another entity"; }],
  ["scope revision", (r) => { r.scopeRevision = "S1"; }],
  ["policy revision", (r) => { r.policyRevision = "ONB-2"; }],
  ["review owner", (r) => { r.reviewer = "Different reviewer"; }],
  ["expired validity", (r) => { r.validUntil = "2026-10-02T11:30:00-07:00"; }],
]) test(`supplier reopens a receipt with different ${name}`, () => {
  const value = resolvedExample();
  mutate(value.reviews.find((r) => r.id === "PRIVACY-P2"));
  assert.ok(findings(value).some((f) => f.code === "supplier_item_state"));
});

test("entity decisions bind all records, the owner, current scope and supplied time", () => {
  for (const mutate of [
    (x) => x.entityDecision.identityRefs.pop(),
    (x) => { x.entityDecision.scopeRevision = "S1"; },
    (x) => { x.entityDecision.decidedBy = "Another owner"; },
    (x) => { x.entityDecision.decidedAt = "2027-01-01T00:00:00Z"; },
  ]) {
    const value = resolvedExample();
    mutate(value);
    assert.ok(findings(value).some((f) => f.code === "supplier_entity_decision"));
  }
});

test("a contradictory current receipt cannot be hidden or treated as satisfaction", () => {
  const value = resolvedExample();
  value.reviews.push({ ...value.reviews[1], id: "PRIVACY-P3", reference: "CONTROLLED-P3", result: "changes-needed" });
  assert.ok(findings(value).some((f) => f.code === "supplier_evidence_coverage"));
  value.coverage[3].evidenceRefs.push("PRIVACY-P3");
  assert.ok(findings(value).some((f) => f.code === "supplier_item_state"));
});

test("not-applicable requires an exact current owner receipt", () => {
  const value = resolvedExample();
  value.requirements[4].applicability = "owner-not-applicable";
  value.coverage[4].state = "not-applicable";
  const receipt = value.reviews.find((r) => r.id === "FINANCE-F1");
  assert.ok(findings(value).some((f) => f.code === "supplier_item_state"));
  receipt.kind = "not-applicable";
  receipt.result = "not-applicable";
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  receipt.scopeRevision = "S1";
  assert.ok(findings(value).some((f) => f.code === "supplier_item_state"));
});

test("schema excludes raw financial fields and whitespace-only content", () => {
  for (const field of ["bankAccount", "taxId", "credentials", "activated"]) {
    const value = clone();
    value.setup[field] = "SYNTHETIC-NOT-A-REAL-IDENTIFIER";
    assert.equal(validate(value), false, field);
  }
  const value = clone();
  value.scope.description = "  ";
  assert.equal(validate(value), false);
});

test("supplier renderer produces the checked-in useful setup packet", async () => {
  assert.equal(renderSupplierOnboarding(fixture), await readFile(new URL("fixtures/setup-packet.example.md", root), "utf8"));
  assert.match(renderSupplierOnboarding(fixture), /Example Services Holdings LLC/);
  assert.match(renderSupplierOnboarding(fixture), /P1 covered S1 without personal data/);
  assert.match(renderSupplierOnboarding(fixture), /Do not send account numbers/);
});

test("malformed top-level supplier input returns a finding", () => {
  assert.equal(findings(null)[0].code, "supplier_structure");
});
