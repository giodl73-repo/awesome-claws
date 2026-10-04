import { createHash } from "node:crypto";
import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
const require = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === "string" && value.trim().length > 0;
const amount = (value) => Number.isSafeInteger(value) && value >= 0;
const canonical = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const moneyInteger = (value) => {
  const rounded = new D(value).toDecimalPlaces(0);
  require(rounded.isFinite() && rounded.gte(0) && rounded.lte(Number.MAX_SAFE_INTEGER), "Unsafe monetary amount");
  return rounded.toNumber();
};
const decimal = (value) => {
  require(typeof value === "string" && /^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(value), "Invalid supplied decimal quantity or conversion");
  return new D(value);
};
const date = (value) => {
  require(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "Missing calendar date");
  const parsed = new Date(`${value}T00:00:00Z`);
  require(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, "Invalid calendar date");
  return value;
};
function unique(rows, key) {
  require(Array.isArray(rows), "Expected a record list");
  const keys = rows.map(key);
  require(keys.every(text) && new Set(keys).size === keys.length, "Missing or duplicate record identity");
}

export function deriveJobEstimate(record) {
  const { scope, scopeItems, scenarios } = record;
  require(record.schemaVersion === "awesomeClaws.jobEstimate.v1", "Unknown estimate contract");
  for (const key of ["job", "revision", "quoteRef", "quoteRevision", "customer", "customerScope", "owner", "privateDestination", "terms"]) require(text(scope[key]), `Missing scope ${key}`);
  require(!/^(agent|assistant|job-estimate-producer)$/i.test(scope.owner), "A human estimating owner is required");
  require(/^[A-Z]{3}$/.test(scope.currency) && amount(scope.minorDigits) && scope.minorDigits <= 4, "Invalid currency precision");
  date(scope.asOf); date(scope.validUntil);
  unique(scopeItems, (item) => item.id);
  unique(scenarios, (scenario) => scenario.id);
  require(scopeItems.length > 0 && scenarios.length > 0, "Scope and baseline scenario are required");
  for (const item of scopeItems) {
    require(text(item.description) && ["priced", "allowance", "excluded", "blocked"].includes(item.disposition), "Invalid scope item");
    require(Array.isArray(item.costLineIds) && item.costLineIds.every(text) && new Set(item.costLineIds).size === item.costLineIds.length, "Invalid required cost-slot list");
  }
  require(new Set(scopeItems.flatMap((item) => item.costLineIds)).size === scopeItems.flatMap((item) => item.costLineIds).length, "A required cost slot cannot belong to multiple scope items");
  const scopeById = new Map(scopeItems.map((item) => [item.id, item]));
  const outputs = scenarios.map((scenario) => {
    const blockers = [];
    const add = (id, reason) => blockers.push({ id, reason });
    const { pricing, lines } = scenario;
    require(text(scenario.label) && text(scenario.scopeRevision), "Missing scenario identity");
    require(["markup", "target-margin"].includes(pricing.method), "Unknown pricing method");
    require(["direct-cost", "total-estimated-cost"].includes(pricing.basis), "Unknown pricing basis");
    require(amount(pricing.bps) && pricing.bps <= 100000 && (pricing.method !== "target-margin" || pricing.bps < 10000), "Invalid markup or target margin");
    for (const key of ["overheadMinor", "contingencyMinor", "taxBps", "maxPreTaxMinor"]) require(pricing[key] === null || amount(pricing[key]), `Invalid ${key}`);
    require(pricing.taxBps === null || pricing.taxBps <= 10000, "Unsupported tax rate");
    require(text(pricing.sourceRef) && text(pricing.revision), "Missing pricing-policy evidence");
    const policyReady = pricing.confirmed === true && pricing.rounding === "half-up-per-line";
    const scopeReady = scenario.scopeRevision === scope.revision && scenario.equivalentScope === true && text(scenario.decisionRef);
    if (!scopeReady) add(scenario.id, "Confirm this scenario's exact scope revision and equivalent-scope owner decision.");
    if (!scope.reviewed || !scope.disclosureApproved) add(scope.job, "Obtain owner scope review and approved customer-facing scope wording.");
    if (scope.validUntil < scope.asOf) add(scope.quoteRef, "Supply a current proposed quote validity date.");
    if (!policyReady) add(pricing.sourceRef, "Supply confirmed pricing and explicit supported rounding instructions.");
    unique(lines, (line) => line.id);
    unique(lines, (line) => line.sourceRef);
    const costs = lines.map((line) => {
      const item = scopeById.get(line.scopeId);
      require(item && text(line.sourceRevision), "Unknown scope mapping or source revision");
      require(["labor", "material", "subcontractor", "equipment", "expense"].includes(line.category), "Unknown cost category");
      require(text(line.quantityUnit) && text(line.rateUnit), "Missing quantity or rate unit");
      require(line.rateMinor === null || amount(line.rateMinor), "Invalid cost rate");
      if (line.quantity !== null) decimal(line.quantity);
      if (line.conversion !== null) decimal(line.conversion);
      date(line.observedOn); date(line.validThrough);
      const reasons = [];
      if (item.disposition === "excluded" || item.disposition === "blocked") reasons.push("Remove or resolve cost lines mapped to excluded or blocked scope; do not hide their cost.");
      if (!line.approved || !line.current || !text(line.approvalRef)) reasons.push("Supply current owner-approved quantity and cost evidence.");
      if (line.customer !== scope.customer || line.currency !== scope.currency || line.job !== scope.job || line.scopeRevision !== scope.revision) reasons.push("Resolve job, customer, currency or scope-revision mismatch.");
      if (line.observedOn > scope.asOf || line.validThrough < scope.asOf || line.validThrough < scope.validUntil || line.observedOn > line.validThrough) reasons.push("Supply cost evidence valid through the proposed quote period; do not rely on an expired or future quote.");
      if (line.quantity === null || !decimal(line.quantity).gt(0)) reasons.push("Supply a positive checked quantity; unknown or zero work is not priced scope.");
      if (line.rateMinor === null) reasons.push("Supply a cost rate; unknown is not explicit zero.");
      if (line.conversion === null || !decimal(line.conversion).gt(0)
        || line.quantityUnit === line.rateUnit && !decimal(line.conversion).eq(1)
        || line.quantityUnit !== line.rateUnit && !text(line.conversionRef)) reasons.push("Supply the explicit unit conversion; same-unit quantities require a factor of one.");
      if (item.disposition === "allowance" && (!line.allowance || !text(item.decisionRef))) reasons.push("Bind the allowance to the owner's explicit allowance decision.");
      if (item.disposition === "priced" && line.allowance) reasons.push("Do not present an allowance as a firm cost basis.");
      for (const reason of reasons) add(line.id, reason);
      const cost = reasons.length ? null : moneyInteger(decimal(line.quantity).times(decimal(line.conversion)).times(line.rateMinor));
      return { id: line.id, scopeId: line.scopeId, sourceRevision: line.sourceRevision, cost, state: cost === null ? "blocked" : line.allowance ? "allowance" : "priced" };
    });
    const coverage = scopeItems.map((item) => {
      const mapped = costs.filter((cost) => cost.scopeId === item.id);
      const slotsMatch = canonical(mapped.map((cost) => cost.id).sort()) === canonical([...item.costLineIds].sort());
      if (!slotsMatch) add(item.id, "Account for every owner-declared cost slot exactly once; do not omit or invent a cost component.");
      const decisionReady = text(item.decisionRef);
      if (!decisionReady) add(item.id, "Supply the owner's explicit scope/allowance/exclusion decision.");
      if (item.disposition === "blocked") add(item.id, "Resolve this scope item before claiming a complete job price.");
      if (["priced", "allowance"].includes(item.disposition) && mapped.length === 0) add(item.id, "Supply the missing cost build-up for this scope item.");
      if (!item.disclosureApproved) add(item.id, "Supply customer-approved scope and exclusion wording without internal cost details.");
      const complete = slotsMatch && decisionReady && item.disposition !== "blocked" && (item.disposition === "excluded" ? mapped.length === 0 : mapped.length > 0 && mapped.every((cost) => cost.cost !== null));
      return { scopeId: item.id, disposition: complete ? item.disposition : "blocked", lineIds: mapped.map((cost) => cost.id) };
    });
    const knownCost = moneyInteger(costs.reduce((sum, cost) => sum.plus(cost.cost ?? 0), new D(0)));
    const costComplete = coverage.every((item) => item.disposition !== "blocked") && costs.every((cost) => cost.cost !== null)
      && coverage.some((item) => item.disposition !== "excluded") && scopeReady && scope.reviewed === true;
    if (!coverage.some((item) => item.disposition !== "excluded")) add(scope.job, "No included job scope remains.");
    const directCost = costComplete ? knownCost : null;
    if (pricing.overheadMinor === null || pricing.contingencyMinor === null) add(pricing.sourceRef, "Supply explicit overhead and contingency amounts, including zero when intended.");
    const totalCost = directCost !== null && pricing.overheadMinor !== null && pricing.contingencyMinor !== null
      ? moneyInteger(new D(directCost).plus(pricing.overheadMinor).plus(pricing.contingencyMinor)) : null;
    let preTax = null;
    if (totalCost !== null && policyReady) {
      const basis = pricing.basis === "direct-cost" ? directCost : totalCost;
      const fraction = new D(pricing.bps).div(10000);
      const pricedBasis = pricing.method === "markup" ? new D(basis).times(fraction.plus(1)) : new D(basis).div(new D(1).minus(fraction));
      preTax = moneyInteger(pricedBasis.plus(new D(totalCost).minus(basis)));
    }
    if (pricing.taxBps === null) add(pricing.sourceRef, "Supply explicit tax treatment; final quote total remains unknown.");
    const tax = preTax === null || pricing.taxBps === null ? null : moneyInteger(new D(preTax).times(pricing.taxBps).div(10000));
    const total = preTax === null || tax === null ? null : moneyInteger(new D(preTax).plus(tax));
    const grossMarginBps = preTax === null || preTax === 0 ? null : moneyInteger(new D(preTax).minus(totalCost).div(preTax).times(10000));
    if (preTax !== null && pricing.maxPreTaxMinor !== null && preTax > pricing.maxPreTaxMinor) add(pricing.sourceRef, "Proposed price exceeds the owner's review limit; do not cap or approve it silently.");
    return { id: scenario.id, state: blockers.length ? "blocked" : "ready-for-owner-review", costs, coverage,
      knownCost, directCost, totalCost, preTax, tax, total, grossMarginBps, blockers };
  });
  const baseline = outputs[0];
  const comparisons = outputs.slice(1).map((output) => ({ id: output.id, baselineId: baseline.id,
    costDelta: output.totalCost === null || baseline.totalCost === null ? null : output.totalCost - baseline.totalCost,
    preTaxDelta: output.preTax === null || baseline.preTax === null ? null : output.preTax - baseline.preTax }));
  return { inputDigest: `sha256:${createHash("sha256").update(canonical({ scope, scopeItems, scenarios })).digest("hex")}`,
    quoteRevision: scope.quoteRevision, scenarios: outputs, comparisons };
}

export function jobEstimateFindings(record) {
  try {
    const derived = deriveJobEstimate(record);
    const findings = [];
    if (canonical(record.result) !== canonical(derived)) findings.push({ code: "estimate_result", path: "result", message: "Recompute exact scope coverage, costs, prices and readiness from current supplied evidence." });
    const authority = { quote: "draft-not-binding", bid: "not-submitted", purchase: "not-placed", contact: "not-performed", price: "not-approved" };
    if (canonical(record.authority) !== canonical(authority)) findings.push({ code: "estimate_authority", path: "authority", message: "Quote approval and all external actions remain human-owned and unperformed." });
    return findings;
  } catch (error) {
    return [{ code: "estimate_input", path: "$", message: error.message }];
  }
}

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("|", "&#124;").replaceAll(/\r?\n/g, " ").replaceAll(/([\\`*_\[\]])/g, "\\$1");

export function renderJobEstimate(record) {
  const findings = jobEstimateFindings(record);
  require(findings.length === 0, JSON.stringify(findings));
  const { scope: s, result: r } = record;
  const money = (value) => value === null ? "Pending owner input" : `${s.currency} ${new D(value).div(new D(10).pow(s.minorDigits)).toFixed(s.minorDigits)}`;
  const quote = ["# QUOTE DRAFT - NOT A BINDING OFFER", `Quote ${escape(s.quoteRef)} revision ${escape(s.quoteRevision)}`,
    `Customer: ${escape(s.customer)}. Job: ${escape(s.job)}; scope revision ${escape(s.revision)}.`,
    s.disclosureApproved ? escape(s.customerScope) : "Customer scope wording pending owner approval.",
    "## Included scope", ...record.scopeItems.filter((item) => item.disposition !== "excluded").map((item) => item.disclosureApproved
      ? `- ${escape(item.description)}${item.disposition === "allowance" ? " (owner-defined allowance)" : item.disposition === "blocked" ? " (scope pending)" : ""}` : "- Scope wording pending approval."),
    "## Exclusions", ...record.scopeItems.filter((item) => item.disposition === "excluded").map((item) => item.disclosureApproved ? `- ${escape(item.description)}` : "- Exclusion wording pending approval."),
    `Proposed validity: ${s.validUntil}. Terms: ${escape(s.terms)}.`,
    ...r.scenarios.flatMap((output) => [`## ${escape(record.scenarios.find((item) => item.id === output.id).label)}`,
      `Whole-job proposed pre-tax price: **${money(output.preTax)}**.`, `Tax under supplied instructions: ${money(output.tax)}.`,
      `**Final total: ${money(output.total)}**.`, output.state === "blocked" ? "**BLOCKED WORKING DRAFT**: unresolved inputs or owner decisions remain." : "Ready for owner review only."]),
    "No quote was issued, bid submitted, price approved, supplier selected, purchase placed or customer contacted. This draft promises no mobilization or completion date."].join("\n\n") + "\n";
  const workpaper = ["# Private job estimate workpaper", `Owner: ${escape(s.owner)}. Private destination: ${escape(s.privateDestination)}.`,
    `Job ${escape(s.job)}, scope ${escape(s.revision)}, quote ${escape(s.quoteRef)} revision ${escape(s.quoteRevision)}; as of ${s.asOf}.`,
    ...r.scenarios.flatMap((output) => {
      const scenario = record.scenarios.find((item) => item.id === output.id);
      return [`## ${escape(scenario.label)}: ${output.state}`,
        `Equivalent scope decision: ${escape(scenario.decisionRef ?? "missing")}. Pricing ${escape(scenario.pricing.sourceRef)}/${escape(scenario.pricing.revision)}: ${scenario.pricing.bps / 100}% ${scenario.pricing.method} on ${scenario.pricing.basis}.`,
        "| Cost source/revision | Scope | Quantity | Conversion to rate unit | Rate | Cost | State |\n| --- | --- | --- | --- | ---: | ---: | --- |\n"
        + output.costs.map((cost) => {
          const line = scenario.lines.find((item) => item.id === cost.id);
          return `| ${escape(line.sourceRef)}/${escape(line.sourceRevision)} | ${escape(cost.scopeId)} | ${line.quantity ?? "unknown"} ${escape(line.quantityUnit)} | ${line.conversion ?? "unknown"} ${escape(line.rateUnit)} | ${money(line.rateMinor)} | ${money(cost.cost)} | ${cost.state} |`;
        }).join("\n"),
        ...scenario.lines.map((line) => `- ${escape(line.id)}: owner evidence ${escape(line.approvalRef ?? "missing")}; observed ${line.observedOn}, valid through ${line.validThrough}; conversion evidence ${escape(line.conversionRef ?? "same-unit factor")}.`),
        ...output.coverage.map((item) => `- Scope ${escape(item.scopeId)}: ${item.disposition}; required cost slots ${record.scopeItems.find((scopeItem) => scopeItem.id === item.scopeId).costLineIds.map(escape).join(", ") || "none"}; actual cost rows ${item.lineIds.map(escape).join(", ") || "none"}.`),
        `Known cost subtotal: ${money(output.knownCost)}; complete direct cost: ${money(output.directCost)}.`,
        `Overhead: ${money(scenario.pricing.overheadMinor)}; contingency: ${money(scenario.pricing.contingencyMinor)}; total estimated cost: ${money(output.totalCost)}.`,
        `Proposed pre-tax price: ${money(output.preTax)}; gross margin: ${output.grossMarginBps === null ? "undefined or unknown" : `${output.grossMarginBps / 100}%`}. Markup is not gross margin.`,
        ...output.blockers.map((blocker) => `- Owner question ${escape(blocker.id)}: ${escape(blocker.reason)}`)];
    }),
    "## Equivalent-scope alternatives", ...(r.comparisons.length ? r.comparisons.map((comparison) => `- ${escape(comparison.id)} versus ${escape(comparison.baselineId)}: cost delta ${money(comparison.costDelta)}; pre-tax price delta ${money(comparison.preTaxDelta)}.`) : ["No alternative was requested or inferred."]),
    "A source, scope, quantity or price change invalidates this exact derived revision. Recalculate and obtain fresh owner review. Supplier quotes and model output are not engineering approval, tax advice, binding offers or authority to act."].join("\n\n") + "\n";
  return { quote, workpaper };
}
