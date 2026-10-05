import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { deriveProgressBilling, progressBillingFindings, renderProgressBilling } from "./progress-billing-review-preparer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";

const base = new URL("../sources/progress-billing-review-preparer/", import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, base), "utf8"));
const fixture = await read("fixtures/progress-billing.example.json");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(await read("schemas/progress-billing.schema.json"));
const clone = () => structuredClone(fixture.input);
const ready = input => { const r = deriveProgressBilling(input); assert.equal(r.state, "ready-for-owner-review", JSON.stringify(r.blockers)); return r; };

test("progress billing: strict packaged report, actual Markdown and semantic registration agree", async () => {
  for (const path of ["progress-billing.example.json", "progress-billing-corrected.example.json", "progress-billing-blocked.example.json"]) {
    const r = await read(`fixtures/${path}`);
    assert(validate(r), JSON.stringify(validate.errors));
    assert.deepEqual(progressBillingFindings(r), []);
    assert.deepEqual(validateArtifactSemantics("progress-billing-review-preparer", r), []);
  }
  assert.equal(ARTIFACT_SCHEMA_NAMES["progress-billing-review-preparer"], "progress-billing.schema.json");
  const result = ready(clone());
  assert.deepEqual(result.lines.map(l => l.current), ["9000.00", "9500.00"]);
  assert.equal(result.total, "18500.00");
  assert.equal(result.priorUnpaid, "7000.00");
  assert.equal(result.lines[0].scheduled, "110000.00");
  assert.deepEqual(result.lines[0].effectiveCertificates, ["cert-A-2"]);
  const rendered = renderProgressBilling(fixture);
  assert.equal(rendered.draft, await readFile(new URL("fixtures/application.example.md", base), "utf8"));
  assert.equal(rendered.workpaper, await readFile(new URL("fixtures/workpaper.example.md", base), "utf8"));
  assert.match(rendered.draft, /USD 18500.00/);
  assert.match(rendered.workpaper, /cert-A-1/);
  assert.match(rendered.workpaper, /change-pending/);
  const corrected = await read("fixtures/progress-billing-corrected.example.json");
  assert.equal(corrected.result.lines[0].current, "10000.00");
  assert.equal(corrected.result.total, "19500.00");
  assert.equal(corrected.input.history.certificates.length, 5);
});

test("progress billing: period certifications add; cumulative snapshots never add", () => {
  const input = clone();
  input.history.mode = "period-certification";
  input.history.certificates.forEach(c => { c.kind = "period-certification"; });
  input.history.certificates[2].amount = "18000";
  input.history.certificates[3].amount = "28500";
  assert.equal(ready(input).total, "18500.00");
  const original = clone(); original.cash[0].amount = "0";
  const r = ready(original);
  assert.equal(r.total, "18500.00"); assert.equal(r.priorUnpaid, "27000.00");
  original.cash[0].amount = "30000";
  assert.equal(ready(original).lines[0].priorUnpaid, "-3000.00");
});

test("progress billing: session amounts match the recomputed base and corrected reports", async () => {
  const session = await read("fixtures/session-demo.json");
  const corrected = await read("fixtures/progress-billing-corrected.example.json");
  const baseResult = deriveProgressBilling(fixture.input);
  const correctedResult = deriveProgressBilling(corrected.input);
  const amounts = value => [...value.matchAll(/USD (-?[0-9]+\.[0-9]{2})/g)].map(m => m[1]);
  assert.deepEqual(amounts(session.messages[1].text), baseResult.lines.map(l => l.current));
  const expectedSummary = [baseResult.total, baseResult.priorUnpaid, correctedResult.lines[0].priorCertified, correctedResult.lines[0].current];
  assert.deepEqual(amounts(session.messages[3].text), expectedSummary);
  assert.deepEqual(amounts(session.report.summary), expectedSummary);
  assert.deepEqual(amounts(session.report.items[0].summary), [...baseResult.lines.map(l => l.current), baseResult.total]);
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  assert.equal(session.scenario, catalog.entries.find(e => e.id === session.claw).example.request);
  assert.equal(session.messages[0].text, session.scenario);
});

test("progress billing: component-specific rates and exact half ties", () => {
  const input = clone();
  input.lines[0].storedRate = "0.05";
  assert.equal(ready(input).lines[0].current, "9250.00");
  input.lines[0].workedRate = "0.000003";
  input.lines[0].storedRate = "0.000001";
  let r = ready(input).lines[0];
  assert.equal(r.workedRetainage, "0.11"); assert.equal(r.storedRetainage, "0.01");
  input.lines[0].rounding = "half-even-per-component";
  r = ready(input).lines[0];
  assert.equal(r.workedRetainage, "0.10"); assert.equal(r.storedRetainage, "0.00");
});

test("progress billing: normalized self aliases and offset timestamps", () => {
  for (const reviewer of ["agent-owned", "self", "SELF_APPROVED", "\uff41ssistant", " progress_billing_review_preparer "]) {
    const i = clone(); i.scope.reviewer = reviewer;
    assert(deriveProgressBilling(i).blockers.some(b => b.code === "human-reviewer"));
  }
  const i = clone();
  i.scope.asOf = "2026-10-04T23:00:00-07:00";
  i.sources[0].capturedAt = "2026-10-05T05:00:00Z";
  assert.equal(ready(i).total, "18500.00");
  i.scope.asOf = "2026-10-05T01:00:00+07:00";
  i.sources[0].capturedAt = "2026-10-04T17:00:00Z";
  assert(deriveProgressBilling(i).blockers.some(b => b.code === "period-scope"));
});

test("progress billing: explicit negative correction remains signed", () => {
  const input = clone();
  input.lines[0].installedClosing = "19000";
  input.lines[0].negativeAdjustmentRef = "owner-negative-adjustment";
  input.installed[0].kind = "adjustment"; input.installed[0].amount = "-6000";
  const r = ready(input).lines[0];
  assert.equal(r.current, "-5400.00"); assert.equal(r.negativeAdjustment, true);
});

for (const [name, mutate, code] of [
  ["missing history declaration", i => { i.coverage.historyComplete = false; }, "coverage-historyComplete"],
  ["missing certificate period", i => { i.history.certificates.shift(); }, "history-line-period-coverage"],
  ["missing previous application", i => { i.history.applications.pop(); }, "opening-history"],
  ["missing initial period", i => { i.periods.shift(); }, "period-continuity"],
  ["period gap", i => { i.periods[1].start = "2026-09-02"; }, "period-continuity"],
  ["stale current revision", i => { i.sources[0].currentRevision = "r2"; }, "source-state"],
  ["future source", i => { i.sources[0].capturedAt = "2026-10-06T00:00:00Z"; }, "source-state"],
  ["cash advance cannot erase unpaid", i => { i.cash.push({ ...i.cash[0], id: "advance", nativeId: "advance", amount: "7000", basis: "advance" }); }, "cash-prior-application"],
  ["ambiguous cash application", i => { i.cash[0].basis = "unresolved"; }, "cash-prior-application"],
  ["unconfirmed cash application", i => { i.cash[0].ownerConfirmed = false; }, "cash-prior-application"],
  ["missing cash attribution", i => { i.cash[0].applicationRef = null; }, "cash-prior-application"],
  ["wrong cash attribution period", i => { i.cash[0].throughPeriod = 3; }, "cash-prior-application"],
  ["future applied cash", i => { i.cash[0].at = "2026-10-05T18:00:00.000000001Z"; }, "cash-cutoff"],
  ["cash after source capture", i => { i.cash[0].at = "2026-10-05T17:30:00Z"; }, "cash-cutoff"],
  ["foreign contract", i => { i.sources[0].contract = "other"; }, "source-state"],
  ["unapproved source", i => { i.sources[0].approved = false; }, "source-state"],
  ["stale historical revision", i => { i.history.certificates[2].applicationRevision = "r0"; }, "history-revision"],
  ["stale draft revision", i => { i.scope.revision = "r2"; }, "application-revision"],
  ["duplicate native record", i => { i.installed[1].nativeId = i.installed[0].nativeId; }, "duplicate-native-identity"],
  ["duplicate certificate selection", i => { i.history.certificates.push({ ...i.history.certificates[2], id: "copy", nativeId: "copy" }); }, "history-line-period-coverage"],
  ["unresolved prior correction", i => { i.coverage.unresolvedCorrections.push("correction"); }, "unresolved-correction"],
  ["unresolved certificate", i => { i.history.certificates[2].correctionResolved = false; }, "unresolved-correction"],
  ["unauthorized supersession", i => { i.history.certificates[2].supersedes = "cert-A-1"; }, "certificate-supersession"],
  ["cyclic supersession", i => { i.history.certificates[2].supersedes = "cert-A-2"; i.history.certificates[2].replacementApprovalRef = "owner"; }, "supersession-cycle"],
  ["earlier snapshot correction without downstream reconciliation", i => { i.history.certificates.push({ ...i.history.certificates[0], id: "early-replacement", nativeId: "early-replacement", amount: "8000", supersedes: "cert-A-1", replacementApprovalRef: "owner", correctionResolved: false }); }, "unresolved-correction"],
  ["earlier snapshot corrections conservatively unsupported", i => { i.history.certificates.push({ ...i.history.certificates[0], id: "early-replacement", nativeId: "early-replacement", amount: "8000", supersedes: "cert-A-1", replacementApprovalRef: "owner", correctionResolved: true }); }, "unsupported-earlier-snapshot-correction"],
  ["mixed certificate mode", i => { i.history.certificates[0].kind = "period-certification"; }, "mixed-certificate-mode"],
  ["retained transferred value", i => { i.lots[0].closing = "10000"; }, "lot-conservation"],
  ["missing installed transfer", i => { i.lots[0].transfers[0].installedRef = "missing"; }, "transfer-installed-evidence"],
  ["duplicate transfer", i => { i.lots[0].transfers.push({ ...i.lots[0].transfers[0] }); }, "duplicate-transfer"],
  ["unlinked installed transfer", i => { i.lots[0].transfers = []; }, "orphan-transfer"],
  ["orphan lot", i => { i.lots[0].line = "unknown"; }, "orphan-line"],
  ["missing lot", i => { i.lots = []; }, "lot-universe"],
  ["missing line", i => { i.lines.pop(); }, "line-universe"],
  ["unknown eligibility", i => { i.lots[0].eligible = false; }, "stored-eligibility"],
  ["unsupported rounding", i => { i.lines[0].rounding = "unsupported"; }, "rounding-rule"],
  ["unknown rules", i => { i.coverage.rulesComplete = false; }, "coverage-rulesComplete"],
  ["over earned", i => { i.lines[0].baseScheduled = "1"; }, "scheduled-value"],
  ["unapproved change", i => { i.changes[0].approvalRef = null; }, "change-approval"],
  ["missing attachment", i => { i.attachments[0].suppliedRevision = null; }, "attachment-revision-permission"],
  ["stale attachment", i => { i.attachments[0].suppliedRevision = "r0"; }, "attachment-revision-permission"],
  ["undisclosed attachment", i => { i.attachments[0].permitted = false; }, "attachment-revision-permission"],
  ["undisclosed pack", i => { i.coverage.disclosureApproved = false; }, "coverage-disclosureApproved"],
  ["unresolved duplicate coverage", i => { i.coverage.noDuplicateCoverage = false; }, "coverage-noDuplicateCoverage"],
  ["unsupported money precision", i => { i.cash[0].amount = "0.001"; }, "currency-precision"],
  ["negative draft without authority", i => { i.history.certificates[2].amount = "40000"; }, "negative-adjustment-authorization"],
  ["agent reviewer", i => { i.scope.reviewer = "progress-billing-review-preparer"; }, "human-reviewer"],
]) test(`progress billing blocks ${name}`, () => {
  const input = clone(); mutate(input);
  const result = deriveProgressBilling(input);
  assert.equal(result.state, "blocked"); assert.equal(result.total, null); assert.deepEqual(result.lines, []);
  assert(result.blockers.some(b => b.code === code), JSON.stringify(result.blockers));
});

for (const [name, mutate] of [
  ["unknown tax rule", i => { i.lines[0].tax = "0"; }],
  ["missing worked rate", i => { delete i.lines[0].workedRate; }],
  ["missing history", i => { delete i.history; }],
  ["invalid date", i => { i.scope.periodEnd = "2026-02-30"; }],
  ["unbounded money", i => { i.cash[0].amount = "1000000000000"; }],
  ["exponent money", i => { i.cash[0].amount = "1e4"; }],
  ["number money", i => { i.cash[0].amount = 20000; }],
  ["too many records", i => { i.cash = Array(201).fill(i.cash[0]); }],
]) test(`progress billing rejects strict input: ${name}`, () => {
  const input = clone(); mutate(input); assert.throws(() => deriveProgressBilling(input), /Invalid progress billing input/);
});

test("progress billing: refreshed evidence cannot leave stale reports or authority claims", () => {
  for (const mutate of [r => { r.result.total = "25500.00"; }, r => { r.input.cash[0].amount = "19000"; },
    r => { r.authority.submission = "performed"; }, r => { r.result.lines[0].priorCertified = "36000.00"; }]) {
    const r = structuredClone(fixture); mutate(r);
    assert(progressBillingFindings(r).length); assert.throws(() => renderProgressBilling(r));
  }
  const bad = structuredClone(fixture); bad.result.extra = true;
  assert.equal(validate(bad), false);
});
