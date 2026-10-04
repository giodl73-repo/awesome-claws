import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { derivePayrollReview, payrollReviewFindings, renderPayrollReview } from "./payroll-review-preparer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";
import { validateOpenClawProfile } from "./catalog-contract.mjs";

const root = new URL("../sources/payroll-review-preparer/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/payroll-review.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/payroll-review.schema.json", root), "utf8"));
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = payrollReviewFindings;
const key = (r) => `${r.employee}/${r.component}`;

function refresh(value) {
  const derived = derivePayrollReview(value);
  value.workpaper = derived.workpaper.map((r) => ({ ...r, owner: value.scope.reviewer, question: r.issues.length ? `Reconcile ${key(r)} against its exact supplied inputs and provider rows.` : null }));
  value.summary = derived.summary;
  value.handoff.unresolvedKeys = value.workpaper.filter((r) => r.issues.length).map(key);
  value.handoff.sourceQuestions = derived.sourceQuestionKeys.map((source) => ({ source, question: `Supply complete ${source} evidence and explain any control-total difference.` }));
  value.handoff.cutoffState = derived.cutoffState;
  value.handoff.cutoffQuestion = derived.cutoffState === "before-cutoff" ? null : "Supply the cutoff or the owner's handling of its elapsed deadline.";
  value.handoff.revisionQuestion = value.handoff.unresolvedKeys.length || derived.sourceQuestionKeys.length ? "Supply a corrected exact provider revision or revised owner input decision." : null;
  value.handoff.reviewedDraftRevision = value.draft.revision;
  return value;
}

test("payroll fixture reconciles the accepted gross-pay example without hiding exceptions", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("payroll-review-preparer", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["payroll-review-preparer"], "payroll-review.schema.json");
  assert.equal(fixture.summary.prior.computed, 870000);
  assert.equal(fixture.summary.draft.computed, 900000);
  assert.equal(fixture.summary.expected.computed, 870000);
  assert.equal(fixture.summary.variance, 30000);
  assert.equal(fixture.summary.exceptionCount, 2);
  assert.equal(fixture.workpaper[2].observedMovement, 0);
  assert.equal(fixture.workpaper[2].variance, 20000);
  assert.equal(fixture.workpaper[4].draftAmount, null);
  assert.equal(fixture.workpaper[4].variance, 10000);
  assert.match(renderPayrollReview(fixture), /Absent \(0 comparison placeholder\)/);
});

const mutations = [
  ["foreign employer", "payroll_scope", (x) => { x.draft.employer = "OTHER"; }],
  ["foreign pay group", "payroll_scope", (x) => { x.prior.payGroup = "OTHER"; }],
  ["mixed currency", "payroll_scope", (x) => { x.draft.currency = "EUR"; }],
  ["different amount scale", "payroll_scope", (x) => { x.prior.minorDigits = 0; }],
  ["off-cycle comparison", "payroll_scope", (x) => { x.draft.runType = "off-cycle"; }],
  ["wrong draft period", "payroll_scope", (x) => { x.draft.period = "2026-09"; }],
  ["same comparison period", "payroll_period", (x) => { x.scope.priorPeriod = x.scope.currentPeriod; }],
  ["reversed review dates", "payroll_period", (x) => { x.scope.periodStart = "2027-01-01"; }],
  ["future register", "payroll_chronology", (x) => { x.draft.observedAt = "2027-01-01T00:00:00Z"; }],
  ["duplicate source identity", "payroll_duplicate_id", (x) => { x.draft.rows[0].id = x.prior.rows[0].id; }],
  ["duplicate expected component", "payroll_universe", (x) => x.expectedComponents.push(structuredClone(x.expectedComponents[0]))],
  ["missing roster component universe", "payroll_universe", (x) => x.expectedEmployees.push("E-04")],
  ["omitted workpaper row", "payroll_coverage", (x) => x.workpaper.pop()],
  ["duplicate workpaper row", "payroll_coverage", (x) => x.workpaper.push(structuredClone(x.workpaper[0]))],
  ["invented observed zero", "payroll_comparison", (x) => { x.workpaper[4].draftAmount = 0; }],
  ["forged row link", "payroll_comparison", (x) => { x.workpaper[0].draftRowIds = ["D2"]; }],
  ["bonus silently explained", "payroll_comparison", (x) => { x.workpaper[2].issues = []; }],
  ["total used as clearance", "payroll_totals", (x) => { x.summary.exceptionCount = 0; }],
  ["false control total", "payroll_totals", (x) => { x.summary.draft.computed = 870000; }],
  ["missing exact question", "payroll_question", (x) => { x.workpaper[2].question = " "; }],
  ["wrong reviewer", "payroll_question", (x) => { x.workpaper[2].owner = "Other owner"; }],
  ["dropped unresolved key", "payroll_handoff", (x) => x.handoff.unresolvedKeys.pop()],
  ["stale handoff revision", "payroll_handoff", (x) => { x.handoff.reviewedDraftRevision = "0"; }],
  ["invented cutoff", "payroll_cutoff", (x) => { x.handoff.cutoffState = "before-cutoff"; }],
  ["missing cutoff question", "payroll_cutoff", (x) => { x.handoff.cutoffQuestion = null; }],
  ["missing corrected revision request", "payroll_revision_question", (x) => { x.handoff.revisionQuestion = null; }],
  ["statutory check claimed available", "payroll_authority", (x) => x.handoff.unavailableChecks.pop()],
  ["approval claimed", "payroll_authority", (x) => { x.handoff.approval = "approved"; }],
  ["release claimed", "payroll_authority", (x) => { x.handoff.release = "released"; }],
  ["funding claimed", "payroll_authority", (x) => { x.handoff.funding = "funded"; }],
  ["provider mutation claimed", "payroll_authority", (x) => { x.handoff.systemChanges = "updated"; }],
  ["employee contact claimed", "payroll_authority", (x) => { x.handoff.contacts = "sent"; }],
  ["agent reviewer", "payroll_owner", (x) => { x.scope.reviewer = "assistant"; }],
  ["free-text release claim", "payroll_authority_text", (x) => { x.workpaper[2].question = "We have released payroll."; }],
  ["compliance claim", "payroll_authority_text", (x) => { x.handoff.revisionQuestion = "Payroll is compliant."; }],
  ["personal email", "payroll_sensitive_text", (x) => { x.workpaper[2].question = "Ask person@example.invalid."; }],
  ["SSN-shaped reference", "payroll_sensitive_text", (x) => { x.expectations[0].reference = "123-45-6789"; }],
  ["IBAN-shaped identifier", "payroll_sensitive_text", (x) => { x.expectations[0].supportRefs = ["ZZ000000000000000"]; }],
];
for (const [name, code, mutate] of mutations) test(`payroll rejects ${name}`, () => {
  const value = clone();
  mutate(value);
  assert.ok(findings(value).some((f) => f.code === code), code);
  assert.throws(() => renderPayrollReview(value));
});

test("equal and opposite variances never net away employee exceptions", () => {
  const value = clone();
  value.draft.rows.push({ id: "D5", employee: "E-03", component: "HOURS-ADJUSTMENT", amount: -30000 });
  value.draft.declaredTotal = 870000;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.summary.variance, 0);
  assert.equal(value.summary.absoluteExceptionAmount, 40000);
  assert.equal(value.summary.exceptionCount, 2);
  assert.equal(value.handoff.unresolvedKeys.length, 2);
});

test("duplicate keys remain visible and do not invent joined amounts", () => {
  const value = clone();
  value.draft.rows.push({ ...value.draft.rows[0], id: "D1-DUPLICATE" });
  value.draft.declaredTotal += value.draft.rows[0].amount;
  refresh(value);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
  assert.deepEqual(value.workpaper[0].draftRowIds, ["D1", "D1-DUPLICATE"]);
  assert.equal(value.workpaper[0].draftAmount, null);
  assert.equal(value.summary.variance, null);
  assert.match(renderPayrollReview(value), /Ambiguous duplicate rows/);
});

test("missing expected employee is retained through all required components", () => {
  const value = clone();
  value.draft.rows = value.draft.rows.filter((r) => r.employee !== "E-03");
  value.draft.declaredTotal = 600000;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.ok(value.workpaper.filter((r) => r.employee === "E-03").every((r) => r.issues.includes("missing-draft")));
});

test("unmatched employee and component cannot disappear from the workpaper", () => {
  const value = clone();
  value.draft.rows.push({ id: "D-UNKNOWN", employee: "E-99", component: "BASE", amount: 1000 });
  value.draft.declaredTotal += 1000;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.workpaper.at(-1).employee, "E-99");
  assert.ok(value.workpaper.at(-1).issues.includes("unexpected-component"));
});

for (const [field, replacement] of Object.entries({ employer: "OTHER", payGroup: "OTHER", currency: "EUR", minorDigits: 0,
  runType: "off-cycle", period: "2026-09", draftRevision: "0", owner: "Other owner", decision: "requested",
  effectiveFrom: "2026-10-15", effectiveThrough: "2026-10-20", decidedAt: "2027-01-01T00:00:00Z" })) test(`expectation with mismatched ${field} remains unresolved`, () => {
  const value = clone();
  value.expectations[0][field] = replacement;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.workpaper[0].expectedAmount, null);
  assert.ok(value.workpaper[0].issues.includes("expectation-invalid"));
  assert.equal(value.summary.expected.computed, null);
});

test("one-off expiry needs explicit zero and its supplied rule references", () => {
  for (const mutate of [(e) => { e.amount = 20000; }, (e) => { e.supportRefs = []; }]) {
    const value = clone();
    mutate(value.expectations[2]);
    refresh(value);
    assert.deepEqual(findings(value), []);
    assert.equal(value.workpaper[2].expectedAmount, null);
  }
});

test("conflicting expectation records cannot silently select a convenient amount", () => {
  const value = clone();
  value.expectations.push({ ...value.expectations[0], id: "CONFLICT", amount: 340000 });
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.workpaper[0].expectedAmount, null);
  assert.deepEqual(value.workpaper[0].expectationIds, ["CHANGE-1", "CONFLICT"]);
});

test("incomplete registers do not turn absent rows into arithmetic zero", () => {
  const value = clone();
  value.draft.complete = false;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.workpaper[4].variance, null);
  assert.equal(value.summary.variance, null);
  assert.ok(value.handoff.sourceQuestions.some((q) => q.source === "draft"));
  assert.match(renderPayrollReview(value), /Absent; incomplete source/);
});

test("missing and mismatched control totals get their own exact source questions", () => {
  const value = clone();
  value.prior.declaredTotal = null;
  value.draft.declaredTotal++;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.summary.prior.state, "unavailable");
  assert.equal(value.summary.draft.state, "mismatched");
  value.handoff.sourceQuestions.pop();
  assert.ok(findings(value).some((f) => f.code === "payroll_source_question"));
});

test("a corrected draft requires current scoped inputs and stays a private review", () => {
  const value = clone();
  value.draft.revision = "2";
  value.draft.rows = value.draft.rows.filter((r) => r.component !== "BONUS");
  value.draft.rows.push({ id: "D5", employee: "E-03", component: "HOURS-ADJUSTMENT", amount: -10000 });
  value.draft.declaredTotal = 870000;
  refresh(value);
  assert.ok(value.workpaper.every((r) => r.issues.includes("expectation-invalid")));
  for (const e of value.expectations) e.draftRevision = "2";
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.summary.exceptionCount, 0);
  assert.equal(value.summary.variance, 0);
  assert.equal(value.workpaper[2].draftAmount, null);
  assert.equal(value.handoff.release, "not-performed");
  assert.match(renderPayrollReview(value), /No exceptions identified within the supplied gross-component scope/);
});

test("owner tolerances do not hide source absence or alter stated variance", () => {
  const value = clone();
  value.expectedComponents[2].tolerance = 20000;
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.workpaper[2].variance, 20000);
  assert.deepEqual(value.workpaper[2].issues, []);
  assert.ok(value.workpaper[4].issues.includes("missing-draft"));
});

test("cutoff comparisons respect timezone and never mean release readiness", () => {
  const value = clone();
  value.scope.cutoff = "2026-10-02T20:00:00Z";
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.handoff.cutoffState, "before-cutoff");
  value.scope.cutoff = "2026-10-02T19:00:00Z";
  refresh(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.handoff.cutoffState, "at-or-after-cutoff");
});

test("component labels containing slashes and reordered object fields preserve meaning", () => {
  const value = clone();
  for (const rows of [value.expectedComponents, value.prior.rows, value.draft.rows, value.expectations]) {
    for (const row of rows) if (row.component === "BASE") row.component = "PAY/BASE";
  }
  refresh(value);
  value.summary = Object.fromEntries(Object.entries(value.summary).reverse());
  value.workpaper[0] = Object.fromEntries(Object.entries(value.workpaper[0]).reverse());
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(value), []);
});

test("schema excludes raw payroll identifiers, fractional minor units and oversized money", () => {
  for (const mutate of [(x) => { x.draft.rows[0].bankAccount = "secret"; }, (x) => { x.draft.rows[0].amount = 0.1; },
    (x) => { x.draft.rows[0].amount = Number.MAX_SAFE_INTEGER; }, (x) => { x.draft.rows[0].employee = "Full Name"; },
    (x) => { x.scope.cutoff = "2026-10-03T12:00:00"; }]) {
    const value = clone();
    mutate(value);
    assert.equal(validate(value), false);
  }
});

test("negated authority wording is not a completion claim", () => {
  const value = clone();
  value.handoff.revisionQuestion = "We have not released payroll. Supply a corrected exact revision.";
  assert.deepEqual(findings(value), []);
});

test("malformed top-level payroll input yields a structure finding", () => {
  assert.equal(findings(null)[0].code, "payroll_structure");
  assert.equal(findings({})[0].code, "payroll_structure");
});

test("payroll catalog and contribution preserve a valid minimal workspace profile", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const contribution = JSON.parse(await readFile(new URL("../contributions/payroll-review-preparer.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === "payroll-review-preparer");
  for (const profile of [entry.openclawProfile, contribution.entry.openclawProfile]) {
    assert.doesNotThrow(() => validateOpenClawProfile(profile));
    assert.deepEqual(profile, { schemaVersion: 1, agent: { tools: { profile: "minimal", alsoAllow: ["read", "write", "edit"], fs: { workspaceOnly: true } } } });
  }
});

test("payroll renderer reproduces the checked-in usable workpaper", async () => {
  const expected = await readFile(new URL("fixtures/workpaper.example.md", root), "utf8");
  assert.equal(renderPayrollReview(fixture), expected.replaceAll("\r\n", "\n"));
});
