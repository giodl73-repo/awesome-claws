import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";
import { isDeepStrictEqual } from "node:util";
import schema from "../sources/sales-commission-review-preparer/schemas/commission.schema.json" with { type: "json" };

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateInput = ajv.compile({ ...schema.$defs.input, $defs: schema.$defs });
const validateRecord = ajv.compile(schema);
const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
const instant = (value) => Temporal.Instant.from(value).epochNanoseconds;
const max = BigInt(Number.MAX_SAFE_INTEGER);
const key = (...parts) => JSON.stringify(parts);

export function reconcileCommissions(input) {
  if (!validateInput(input)) throw new Error(`Invalid commission input: ${ajv.errorsText(validateInput.errors)}`);
  const findings = [];
  const add = (code, ref) => findings.push({ code, ref });
  const unique = (values, code) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) add(code, /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value ?? "") ? value : "UNKNOWN");
      seen.add(value);
    }
  };
  const kinds = ["sources", "plans", "openings", "events", "credits", "originals", "reversals", "payouts"];
  for (const kind of kinds) unique(input[kind].map((r) => r.id), `duplicate-${kind}`);
  unique(input.payees, "duplicate-payee");
  const { scope } = input;
  const asOf = instant(scope.asOf), start = instant(scope.periodStart), end = instant(scope.periodEnd);
  if (start >= end || end > asOf) add("cycle-cutoff", scope.cycle);
  if (!scope.complete || !scope.owner) add("owner-completeness", scope.cycle);
  for (const [field, rows] of [["eventIds", input.events.map((r) => r.id)], ["payeeIds", input.payees], ["payoutIds", input.payouts.map((r) => r.id)], ["reversalIds", input.reversals.map((r) => r.id)], ["eventOrder", input.events.map((r) => r.id)]]) {
    unique(scope[field], `duplicate-${field}`);
    if (!isDeepStrictEqual([...scope[field]].sort(), [...rows].sort())) add(`coverage-${field}`, scope.cycle);
  }
  const sources = new Map(input.sources.map((r) => [r.id, r]));
  const plans = new Map(input.plans.map((r) => [r.id, r]));
  const events = new Map(input.events.map((r) => [r.id, r]));
  const originals = new Map(input.originals.map((r) => [r.id, r]));
  for (const source of input.sources) {
    if (source.employer !== scope.employer || source.currency !== scope.currency) add("source-scope", source.id);
    if (instant(source.capturedAt) > asOf) add("source-future", source.id);
  }
  const native = new Set();
  function evidence(row, kind) {
    const e = row.evidence, source = sources.get(e.sourceRef);
    if (!source || source.kind !== kind || source.revision !== e.revision) add("source-binding", row.id);
    if (e.state !== "current" || !e.decisionOwner) add("unresolved-evidence", row.id);
    if (instant(e.at) > asOf || source && instant(e.at) > instant(source.capturedAt)) add("evidence-chronology", row.id);
    if (row.at && instant(row.at) > instant(e.at)) add("event-after-evidence", row.id);
    const identity = key(e.sourceRef, e.record);
    if (native.has(identity)) add("duplicate-source-record", row.id);
    native.add(identity);
    if (row.payee && !input.payees.includes(row.payee)) add("unknown-payee", row.id);
  }
  for (const [kind, singular] of [["plans", "plan"], ["openings", "opening"], ["events", "event"], ["credits", "credit"], ["originals", "original"], ["reversals", "reversal"], ["payouts", "payout"]]) {
    for (const row of input[kind]) evidence(row, singular);
  }
  for (const kind of ["events", "originals", "reversals", "payouts"]) {
    unique(input[kind].filter((r) => r.identity !== null).map((r) => r.identity), `duplicate-${kind}-identity`);
    for (const row of input[kind]) if (row.identity === null) add("unknown-identity", row.id);
  }
  for (const plan of input.plans) {
    if (instant(plan.effectiveFrom) >= instant(plan.effectiveTo)) add("plan-interval", plan.id);
    if (plan.mechanic === "unsupported" || plan.basis !== "owner-credited-amount" || plan.rounding !== "half-up-per-credit" || plan.reversalPolicy !== "original-amount-no-attainment-rewind") add("unsupported-plan", plan.id);
    let previous = 0;
    plan.tiers.forEach((tier, index) => {
      if (tier.upToMinor === null ? index !== plan.tiers.length - 1 : tier.upToMinor <= previous || index === plan.tiers.length - 1) add("tier-boundaries", plan.id);
      previous = tier.upToMinor ?? previous;
    });
    if (plan.mechanic === "flat" && (plan.tiers.length !== 1 || plan.tiers[0].upToMinor !== null)) add("flat-tier-shape", plan.id);
  }
  for (let i = 0; i < input.plans.length; i++) for (const b of input.plans.slice(i + 1)) {
    const a = input.plans[i];
    if (a.payee === b.payee && instant(a.effectiveFrom) < instant(b.effectiveTo) && instant(b.effectiveFrom) < instant(a.effectiveTo)) add("overlapping-plans", b.id);
  }
  const openings = new Map();
  for (const row of input.openings) {
    const plan = plans.get(row.planRef);
    if (!plan || row.payee !== plan.payee || row.planVersion !== plan.version) add("opening-plan", row.id);
    const k = row.planRef;
    if (openings.has(k)) add("duplicate-opening", row.id);
    openings.set(k, row);
    if (row.amountMinor === null || instant(row.asOf) !== start || instant(row.evidence.at) > start) add("opening-evidence", row.id);
  }
  let last = start;
  for (const id of scope.eventOrder) {
    const row = events.get(id);
    if (!row) continue;
    const at = instant(row.at);
    if (at < start || at >= end || at < last) add("event-order", row.id);
    last = at;
  }
  unique(input.credits.map((r) => key(r.eventRef, r.payee)), "duplicate-credit-payee");
  for (const row of input.credits) {
    const plan = plans.get(row.planRef), event = events.get(row.eventRef);
    if (row.amountMinor === null) add("credit-amount-missing", row.id);
    if (!event) add("credit-event", row.id);
    if (!plan || plan.version !== row.planVersion || plan.payee !== row.payee) add("credit-plan", row.id);
    if (plan && event && (instant(event.at) < instant(plan.effectiveFrom) || instant(event.at) >= instant(plan.effectiveTo))) add("plan-not-effective", row.id);
    if (event && instant(row.evidence.at) < instant(event.at)) add("credit-before-event", row.id);
    if (plan && instant(plan.evidence.at) > instant(row.evidence.at)) add("plan-after-credit", row.id);
    if (!openings.has(row.planRef)) add("opening-missing", row.id);
  }
  for (const plan of input.plans) {
    if (input.credits.some((r) => r.planRef === plan.id) && input.plans.some((other) => other.id !== plan.id && other.payee === plan.payee && other.attainmentPeriod === plan.attainmentPeriod && input.credits.some((r) => r.planRef === other.id))) add("unsupported-plan-transition", plan.id);
  }
  for (const event of input.events) {
    const credits = input.credits.filter((r) => r.eventRef === event.id);
    if (event.amountMinor === null || !credits.length || credits.some((r) => r.amountMinor === null) || credits.reduce((s, r) => s + BigInt(r.amountMinor ?? 0), 0n) !== BigInt(event.amountMinor ?? 0)) add("split-conservation", event.id);
  }
  const usedOriginalCredits = new Set();
  for (const row of input.originals) {
    if (usedOriginalCredits.has(row.creditRef) || input.credits.some((r) => r.id === row.creditRef)) add("duplicate-original-credit", row.id);
    usedOriginalCredits.add(row.creditRef);
    if (instant(row.at) >= start || instant(row.evidence.at) > start || !row.historyComplete || row.commissionMinor === null || row.previouslyReversedMinor === null || row.previouslyReversedMinor > row.commissionMinor) add("original-history", row.id);
    if (row.reversalPolicy !== "original-amount-no-attainment-rewind") add("unsupported-original-policy", row.id);
  }
  const reversed = new Map(input.originals.map((r) => [r.id, BigInt(r.previouslyReversedMinor ?? 0)]));
  for (const row of input.reversals) {
    const original = originals.get(row.originalRef);
    if (!original || original.payee !== row.payee) add("reversal-original", row.id);
    if (instant(row.at) < start || instant(row.at) >= end || original && instant(row.at) < instant(original.at)) add("reversal-chronology", row.id);
    if (row.amountMinor === null || row.amountMinor === 0) add("reversal-amount", row.id);
    if (original) {
      const total = reversed.get(original.id) + BigInt(row.amountMinor ?? 0);
      reversed.set(original.id, total);
      if (total > BigInt(original.commissionMinor ?? 0)) add("reversal-exceeds-original", row.id);
    }
  }
  for (const row of input.payouts) if (row.cycle !== scope.cycle || row.amountMinor === null) add("payout-scope-amount", row.id);
  for (const payee of input.payees) if (!input.payouts.some((r) => r.payee === payee)) add("payout-missing", payee);
  const calculations = [], reversalLines = [], payeeLines = [];
  const safe = (n, ref) => { if (n > max || n < -max) { add("amount-overflow", ref); return null; } return Number(n); };
  if (!findings.length) {
    const attainment = new Map(input.openings.map((r) => [r.planRef, BigInt(r.amountMinor)]));
    for (const eventId of scope.eventOrder) for (const credit of input.credits.filter((r) => r.eventRef === eventId)) {
      const plan = plans.get(credit.planRef), opening = attainment.get(plan.id), closing = opening + BigInt(credit.amountMinor);
      const segments = [];
      let lower = 0n, total = new D(0);
      for (const tier of plan.tiers) {
        const upper = tier.upToMinor === null ? closing : BigInt(tier.upToMinor);
        const lo = opening > lower ? opening : lower, hi = closing < upper ? closing : upper;
        if (hi > lo) {
          const basis = hi - lo, amount = new D(basis.toString()).times(tier.rateBps).div(10000);
          total = total.plus(amount);
          segments.push({ basisMinor: Number(basis), rateBps: tier.rateBps, unroundedMinor: amount.toFixed() });
        }
        lower = upper;
      }
      const closingMinor = safe(closing, credit.id), commissionMinor = safe(BigInt(total.toDecimalPlaces(0).toFixed(0)), credit.id);
      if (closingMinor !== null && commissionMinor !== null) calculations.push({ creditRef: credit.id, payee: credit.payee, planRef: plan.id, planVersion: plan.version, openingMinor: Number(opening), closingMinor, commissionMinor, segments });
      attainment.set(plan.id, closing);
    }
    const remaining = new Map(input.originals.map((r) => [r.id, BigInt(r.commissionMinor) - BigInt(r.previouslyReversedMinor)]));
    for (const r of [...input.reversals].sort((a, b) => instant(a.at) < instant(b.at) ? -1 : instant(a.at) > instant(b.at) ? 1 : a.id.localeCompare(b.id))) {
      remaining.set(r.originalRef, remaining.get(r.originalRef) - BigInt(r.amountMinor));
      reversalLines.push({ ref: r.id, originalRef: r.originalRef, amountMinor: -r.amountMinor, remainingMinor: Number(remaining.get(r.originalRef)) });
    }
    for (const payee of input.payees) {
      const earned = calculations.filter((r) => r.payee === payee).reduce((s, r) => s + BigInt(r.commissionMinor), 0n);
      const reversedAmount = input.reversals.filter((r) => r.payee === payee).reduce((s, r) => s + BigInt(r.amountMinor), 0n);
      const proposed = input.payouts.filter((r) => r.payee === payee).reduce((s, r) => s + BigInt(r.amountMinor), 0n);
      const expected = earned - reversedAmount, difference = proposed - expected;
      payeeLines.push({ payee, earnedMinor: safe(earned, payee), reversedMinor: safe(reversedAmount, payee), expectedMinor: safe(expected, payee), proposedMinor: safe(proposed, payee), differenceMinor: safe(difference, payee) });
      if (difference !== 0n) add("payout-difference", payee);
    }
  }
  const unsafe = findings.some((r) => r.code !== "payout-difference");
  return {
    schemaVersion: "awesomeClaws.commissionReport.v1", state: findings.length ? "blocked" : "ready-for-owner-review", findings,
    calculations: unsafe ? [] : calculations, reversals: unsafe ? [] : reversalLines,
    payees: unsafe ? input.payees.map((payee) => ({ payee, earnedMinor: null, reversedMinor: null, expectedMinor: null, proposedMinor: null, differenceMinor: null })) : payeeLines,
    coverage: Object.fromEntries(["events", "credits", "originals", "reversals", "payouts"].map((k) => [k, input[k].map((r) => r.id)])),
    authority: "draft-only-no-entitlement-payroll-payment-or-system-action",
  };
}

export function commissionFindings(value) {
  try {
    if (!validateRecord(value)) return [{ code: "commission-schema", path: "$", message: "Invalid commission record shape." }];
    return isDeepStrictEqual(value.report, reconcileCommissions(value.input)) ? [] : [{ code: "commission-recomputation", path: "report", message: "Report differs from complete supplied input." }];
  } catch { return [{ code: "commission-input", path: "$", message: "Cannot validate supplied commission evidence." }]; }
}

export function renderCommission(input) {
  const report = reconcileCommissions(input);
  return ["# Private commission review", "", `State: ${report.state}. Owner: ${input.scope.owner ?? "unresolved"}. Currency: ${input.scope.currency}; scale: ${input.scope.scale}. All amounts below are minor units.`, "",
    "Draft only. No entitlement, payroll release, payment, deduction, CRM update or employee contact. Owner assertions are not authenticated facts.", "",
    "## Credit calculations", "", "| Credit | Payee | Plan / version | Opening | Closing | Commission |", "| --- | --- | --- | --- | --- | --- |",
    ...report.calculations.map((r) => `| ${r.creditRef} | ${r.payee} | ${r.planRef} / ${r.planVersion} | ${r.openingMinor} | ${r.closingMinor} | ${r.commissionMinor} |`), "",
    "## Payee comparison", "", "| Payee | Earned | Reversed | Expected | Proposed | Difference |", "| --- | --- | --- | --- | --- | --- |",
    ...report.payees.map((r) => `| ${r.payee} | ${r.earnedMinor ?? "unknown"} | ${r.reversedMinor ?? "unknown"} | ${r.expectedMinor ?? "unknown"} | ${r.proposedMinor ?? "unknown"} | ${r.differenceMinor ?? "unknown"} |`), "",
    "## Owner questions", "", ...report.findings.map((r) => `- ${input.scope.owner ?? "Owner"}: resolve ${r.code} for ${r.ref}; retain the evidence and do not approve payout.`),
    "- Review remains human-owned even when all arithmetic agrees. Reversals do not determine recoverability or rewind attainment.", "",
    "## Complete input, tier segments and reversal lineage", "", "```json", JSON.stringify({ input, report }, null, 2), "```", ""].join("\n");
}
