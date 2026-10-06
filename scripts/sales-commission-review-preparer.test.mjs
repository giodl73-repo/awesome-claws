import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateArtifact } from "./artifact-validator-registry.mjs";
import { reconcileCommissions, commissionFindings, renderCommission } from "./sales-commission-review-preparer.mjs";
import { commissionExample } from "./sales-commission-review-example.mjs";

test("marginal tier crossing and separate original reversal are exact", () => {
  const input = commissionExample(), before = structuredClone(input);
  const report = reconcileCommissions(input);
  assert.equal(report.state, "ready-for-owner-review");
  assert.deepEqual(report.calculations[0].segments.map((r) => r.unroundedMinor), ["5000", "10000"]);
  assert.equal(report.calculations[0].commissionMinor, 15000);
  assert.equal(report.reversals[0].amountMinor, -8000);
  assert.equal(report.payees[0].expectedMinor, 7000);
  assert.deepEqual(commissionFindings({ input, report }), []);
  assert.deepEqual(input, before);
});

const mutations = [
  ["unknown owner", (x) => { x.scope.owner = null; }, "owner-completeness"],
  ["incomplete universe", (x) => { x.scope.complete = false; }, "owner-completeness"],
  ["dropped event", (x) => { x.events = []; }, "coverage-eventIds"],
  ["dropped payout", (x) => { x.payouts = []; }, "coverage-payoutIds"],
  ["dropped reversal", (x) => { x.reversals = []; }, "coverage-reversalIds"],
  ["duplicate event", (x) => { x.events.push(structuredClone(x.events[0])); }, "duplicate-events"],
  ["unknown cash identity", (x) => { x.events[0].identity = null; }, "unknown-identity"],
  ["missing credit decision", (x) => { x.credits[0].evidence.decisionOwner = null; }, "unresolved-evidence"],
  ["missing amount", (x) => { x.events[0].amountMinor = null; }, "split-conservation"],
  ["split shortfall", (x) => { x.credits[0].amountMinor--; }, "split-conservation"],
  ["split excess", (x) => { x.credits[0].amountMinor++; }, "split-conservation"],
  ["duplicated credit", (x) => { x.credits.push({ ...x.credits[0], id: "C2" }); }, "duplicate-credit-payee"],
  ["missing opening", (x) => { x.openings = []; }, "opening-missing"],
  ["unknown opening", (x) => { x.openings[0].amountMinor = null; }, "opening-evidence"],
  ["stale opening plan", (x) => { x.openings[0].planVersion = "OLD"; }, "opening-plan"],
  ["stale source", (x) => { x.credits[0].evidence.revision = "OLD"; }, "source-binding"],
  ["evidence after capture", (x) => { x.sources.find((r) => r.kind === "credit").capturedAt = x.scope.periodStart; }, "evidence-chronology"],
  ["credit precedes event", (x) => { x.credits[0].evidence.at = x.scope.periodStart; }, "credit-before-event"],
  ["plan approved after credit", (x) => { x.plans[0].evidence.at = x.scope.periodEnd; }, "plan-after-credit"],
  ["wrong employer", (x) => { x.sources[0].employer = "OTHER"; }, "source-scope"],
  ["wrong currency", (x) => { x.sources[0].currency = "EUR"; }, "source-scope"],
  ["source future", (x) => { x.sources[0].capturedAt = "2026-11-01T00:00:00Z"; }, "source-future"],
  ["event after source evidence", (x) => { x.events[0].evidence.at = "2026-10-01T00:00:00Z"; }, "event-after-evidence"],
  ["unsupported rule", (x) => { x.plans[0].rounding = "unsupported"; }, "unsupported-plan"],
  ["stale plan version", (x) => { x.credits[0].planVersion = "OLD"; }, "credit-plan"],
  ["expired plan", (x) => { x.plans[0].effectiveTo = "2026-10-02T00:00:00Z"; }, "plan-not-effective"],
  ["invalid tier endpoint", (x) => { x.plans[0].tiers[1].upToMinor = 2000000; }, "tier-boundaries"],
  ["bad event order", (x) => { x.scope.eventOrder = []; }, "coverage-eventOrder"],
  ["event outside cycle", (x) => { x.events[0].at = x.scope.periodEnd; }, "event-order"],
  ["unknown original", (x) => { x.reversals[0].originalRef = "UNKNOWN"; }, "reversal-original"],
  ["cross-payee reversal", (x) => { x.reversals[0].payee = "OTHER"; }, "reversal-original"],
  ["over reversal", (x) => { x.reversals[0].amountMinor = 8001; }, "reversal-exceeds-original"],
  ["missing prior reversal history", (x) => { x.originals[0].historyComplete = false; }, "original-history"],
  ["history includes this cycle", (x) => { x.originals[0].evidence.at = x.scope.periodEnd; }, "original-history"],
  ["unsupported original reversal policy", (x) => { x.originals[0].reversalPolicy = "unsupported"; }, "unsupported-original-policy"],
  ["reversed source", (x) => { x.reversals[0].evidence.state = "void"; }, "unresolved-evidence"],
  ["wrong payout cycle", (x) => { x.payouts[0].cycle = "OTHER"; }, "payout-scope-amount"],
  ["duplicate reversal identity", (x) => { x.reversals.push({ ...x.reversals[0], id: "R2", evidence: { ...x.reversals[0].evidence, record: "R2" } }); x.scope.reversalIds.push("R2"); }, "duplicate-reversals-identity"],
  ["duplicate original identity", (x) => { x.originals.push({ ...x.originals[0], id: "OLD2", creditRef: "OLD-CREDIT2", evidence: { ...x.originals[0].evidence, record: "OLD2" } }); }, "duplicate-originals-identity"],
  ["overlapping effective plans", (x) => { x.plans.push({ ...structuredClone(x.plans[0]), id: "PLAN2", version: "V2", evidence: { ...x.plans[0].evidence, record: "PLAN2" } }); }, "overlapping-plans"],
];
for (const [name, mutate, code] of mutations) test(`${name} blocks and retains coverage`, () => {
  const input = commissionExample(); mutate(input);
  const report = reconcileCommissions(input);
  assert.equal(report.state, "blocked");
  assert(report.findings.some((r) => r.code === code), JSON.stringify(report.findings));
  assert(report.payees.every((r) => r.expectedMinor === null));
  assert.deepEqual(report.coverage.events, input.events.map((r) => r.id));
  assert.deepEqual(commissionFindings({ input, report }), []);
});

test("partial and cumulative reversals consume only remaining original amount", () => {
  const input = commissionExample();
  input.originals[0].previouslyReversedMinor = 2000;
  input.reversals[0].amountMinor = 3000;
  input.reversals.push({ ...input.reversals[0], id: "R2", identity: "REV2", amountMinor: 3000,
    evidence: { ...input.reversals[0].evidence, record: "R2" } });
  input.scope.reversalIds.push("R2");
  input.payouts[0].amountMinor = 9000;
  let report = reconcileCommissions(input);
  assert.equal(report.state, "ready-for-owner-review");
  assert.deepEqual(report.reversals.map((r) => r.remainingMinor), [3000, 0]);
  input.reversals[1].amountMinor++;
  report = reconcileCommissions(input);
  assert(report.findings.some((r) => r.code === "reversal-exceeds-original"));
});

test("flat rate, zero rate and per-credit half-up rounding", () => {
  const input = commissionExample();
  input.plans[0].mechanic = "flat"; input.plans[0].tiers = [{ upToMinor: null, rateBps: 500 }];
  input.events[0].amountMinor = 10; input.credits[0].amountMinor = 10;
  input.payouts[0].amountMinor = -7999;
  assert.equal(reconcileCommissions(input).calculations[0].commissionMinor, 1);
  input.plans[0].tiers[0].rateBps = 0; input.payouts[0].amountMinor = -8000;
  assert.equal(reconcileCommissions(input).state, "ready-for-owner-review");
});

test("payout differences are retained without netting away a payee residual", () => {
  const input = commissionExample(); input.payouts[0].amountMinor++;
  const report = reconcileCommissions(input);
  assert.equal(report.state, "blocked"); assert.equal(report.payees[0].differenceMinor, 1);
  assert.equal(report.calculations[0].commissionMinor, 15000);
});

test("overflow blocks totals and tampering fails semantic validation", () => {
  const input = commissionExample(); input.openings[0].amountMinor = Number.MAX_SAFE_INTEGER;
  assert(reconcileCommissions(input).findings.some((r) => r.code === "amount-overflow"));
  const clean = commissionExample(), report = reconcileCommissions(clean); report.payees[0].expectedMinor = 0;
  assert(commissionFindings({ input: clean, report }).length);
});

test("schema rejects fractional money and extra execution authority", () => {
  const input = commissionExample(); input.events[0].amountMinor = 1.5;
  assert.throws(() => reconcileCommissions(input), /Invalid commission input/);
  const other = commissionExample(); other.releasePayroll = true;
  assert.throws(() => reconcileCommissions(other), /Invalid commission input/);
});

test("Markdown embeds exact source and report with no invented clearance", () => {
  const input = commissionExample(), markdown = renderCommission(input);
  const record = JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]);
  assert.deepEqual(record, { input, report: reconcileCommissions(input) });
  assert.match(markdown, /No entitlement, payroll release/);
});

test("two ordered events consume attainment sequentially and reject reversed chronology", () => {
  const input = commissionExample();
  input.events[0].amountMinor = 100000; input.credits[0].amountMinor = 100000;
  input.events.push({ ...input.events[0], id: "E2", identity: "EVENT2", at: "2026-10-03T12:00:00Z", evidence: { ...input.events[0].evidence, record: "E2", at: "2026-10-03T12:00:00Z" } });
  input.credits.push({ ...input.credits[0], id: "C2", eventRef: "E2", evidence: { ...input.credits[0].evidence, record: "C2", at: "2026-10-03T12:00:00Z" } });
  input.scope.eventIds.push("E2"); input.scope.eventOrder.push("E2");
  let report = reconcileCommissions(input);
  assert.equal(report.state, "ready-for-owner-review");
  assert.deepEqual(report.calculations.map((r) => [r.openingMinor, r.commissionMinor]), [[900000, 5000], [1000000, 10000]]);
  input.scope.eventOrder.reverse(); report = reconcileCommissions(input);
  assert(report.findings.some((r) => r.code === "event-order"));
});

test("same-period effective plan transition blocks rather than resetting attainment", () => {
  const input = commissionExample();
  const boundary = "2026-10-03T00:00:00Z";
  input.plans[0].effectiveTo = boundary;
  input.plans.push({ ...structuredClone(input.plans[0]), id: "PLAN2", version: "V2", effectiveFrom: boundary, effectiveTo: input.scope.periodEnd, evidence: { ...input.plans[0].evidence, record: "PLAN2" } });
  input.openings.push({ ...input.openings[0], id: "OPEN2", planRef: "PLAN2", planVersion: "V2", evidence: { ...input.openings[0].evidence, record: "OPEN2" } });
  input.events.push({ ...input.events[0], id: "E2", identity: "EVENT2", at: boundary, evidence: { ...input.events[0].evidence, record: "E2", at: boundary } });
  input.credits.push({ ...input.credits[0], id: "C2", eventRef: "E2", planRef: "PLAN2", planVersion: "V2", evidence: { ...input.credits[0].evidence, record: "C2", at: boundary } });
  input.scope.eventIds.push("E2"); input.scope.eventOrder.push("E2");
  const report = reconcileCommissions(input);
  assert.equal(report.state, "blocked");
  assert.deepEqual(new Set(report.findings.map((r) => r.code)), new Set(["unsupported-plan-transition"]));
  assert.deepEqual(report.calculations, []);
  assert.equal(report.payees[0].expectedMinor, null);
});

test("split among two payees conserves event without netting their payout residuals", () => {
  const input = commissionExample();
  input.payees.push("PAYEE-B"); input.scope.payeeIds.push("PAYEE-B");
  input.plans.push({ ...structuredClone(input.plans[0]), id: "PLAN2", payee: "PAYEE-B", evidence: { ...input.plans[0].evidence, record: "PLAN2" } });
  input.openings.push({ ...input.openings[0], id: "OPEN2", payee: "PAYEE-B", planRef: "PLAN2", evidence: { ...input.openings[0].evidence, record: "OPEN2" } });
  input.credits[0].amountMinor = 100000;
  input.credits.push({ ...input.credits[0], id: "C2", payee: "PAYEE-B", planRef: "PLAN2", evidence: { ...input.credits[0].evidence, record: "C2" } });
  input.payouts[0].amountMinor = -3000;
  input.payouts.push({ ...input.payouts[0], id: "PAYOUT2", identity: "PAYOUT-LINE2", payee: "PAYEE-B", amountMinor: 5000, evidence: { ...input.payouts[0].evidence, record: "PAYOUT2" } });
  input.scope.payoutIds.push("PAYOUT2");
  assert.equal(reconcileCommissions(input).state, "ready-for-owner-review");
  input.payouts[0].amountMinor++; input.payouts[1].amountMinor--;
  const report = reconcileCommissions(input);
  assert.equal(report.state, "blocked"); assert.deepEqual(report.payees.map((r) => r.differenceMinor), [1, -1]);
});

test("round only once across tier segments", () => {
  const input = commissionExample();
  input.openings[0].amountMinor = 0;
  input.plans[0].tiers = [{ upToMinor: 1, rateBps: 5000 }, { upToMinor: null, rateBps: 5000 }];
  input.events[0].amountMinor = 2; input.credits[0].amountMinor = 2; input.payouts[0].amountMinor = -7999;
  const report = reconcileCommissions(input);
  assert.equal(report.state, "ready-for-owner-review");
  assert.deepEqual(report.calculations[0].segments.map((r) => r.unroundedMinor), ["0.5", "0.5"]);
  assert.equal(report.calculations[0].commissionMinor, 1);
});

test("generated accepted and blocked fixtures pass real runtime validation", async () => {
  for (const name of ["commission.example.json", "commission-blocked.example.json"]) {
    const url = new URL(`../sources/sales-commission-review-preparer/fixtures/${name}`, import.meta.url);
    const record = JSON.parse(await readFile(url, "utf8"));
    assert.deepEqual(record.report, reconcileCommissions(record.input));
    const result = await validateArtifact({ id: "sales-commission-review-preparer", artifactPath: fileURLToPath(url), scenarioType: "accepted-task", mode: "mock-plus" });
    assert.equal(result.valid, true, JSON.stringify(result));
  }
  const markdown = await readFile(new URL("../sources/sales-commission-review-preparer/templates/session-handoff.md", import.meta.url), "utf8");
  assert.equal(markdown.replace(/\r\n/g, "\n"), renderCommission(commissionExample()));
});
