import { isDeepStrictEqual } from "node:util";

const date = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const instant = (s) => typeof s === "string" && /(?:Z|[+-]\d{2}:\d{2})$/u.test(s) && Number.isFinite(Date.parse(s));
const text = (s) => typeof s === "string" && s.trim().length > 0;
const percentage = (n) => Number(n.toFixed(8));
const fields = ["revision", "population", "numerator", "denominator", "target", "unit"];

function pairIssues(pair, audience, asOf) {
  if (!pair?.prior || !pair.current) return ["A required comparison period is missing."];
  const rows = [pair.prior, pair.current];
  if (rows.some((r) => !Array.isArray(r.audiences) || !r.audiences.includes(audience))) return ["Required source evidence is not authorized for this audience; values are withheld."];
  if (rows.some((r) => r.state !== "verified" || r.complete !== true)) return ["Required source evidence is missing, stale, conflicting or incomplete; do not substitute zero."];
  if (rows.some((r) => !text(r.reference) || !text(r.service) || !text(r.period) || !date(r.start) || !date(r.end) ||
      r.start > r.end || !instant(r.observedAt) || Date.parse(r.observedAt) > Date.parse(asOf) ||
      Date.parse(r.observedAt) < Date.parse(r.end) + 86_400_000)) return ["Source identity, full UTC-period dates or observation chronology is unresolved."];
  if (rows.some((r) => !Number.isSafeInteger(r.total) || !Number.isSafeInteger(r.met) || r.total <= 0 || r.total > 1_000_000_000 || r.met < 0 || r.met > r.total)) return ["Counts require a positive supplied denominator and a valid target-hit numerator."];
  if (pair.prior.reference === pair.current.reference || pair.prior.period === pair.current.period || pair.prior.end >= pair.current.start || pair.prior.service !== pair.current.service) return ["Use distinct ordered, nonoverlapping periods for the same service, with separate source references."];
  if (rows.some((r) => fields.some((f) => !text(r.definition?.[f])) || r.definition.unit !== "requests") ||
      !isDeepStrictEqual(pair.prior.definition, pair.current.definition)) return ["Metric definitions differ or are incomplete; reconcile population, numerator, denominator, target, unit and revision before comparison."];
  return [];
}

// This is the worked example's source-bound reference calculation, not a new
// general formula parser or an executable capability granted to Data Analyst.
export function buildRecurringBusinessReview(input) {
  if (!input || !text(input.audience) || !text(input.decisionOwner) || !instant(input.asOf)) throw new Error("An audience, decision owner and timezone-bearing as-of time are required.");
  const issues = pairIssues(input.primary, input.audience, input.asOf);
  if (issues.length) return { artifact: null, markdown: `# Business review: evidence needed\n\n${issues.join("\n\n")}\n\nMetric owner: supply the missing permitted evidence or reconciled definition. No comparison, ranking, causal claim or decision is produced.\n` };
  const { prior, current } = input.primary;
  const refs = [prior.reference, current.reference];
  const priorRate = percentage(prior.met / prior.total * 100);
  const currentRate = percentage(current.met / current.total * 100);
  const ratePoints = percentage((current.met / current.total - prior.met / prior.total) * 100);
  const volumePercent = percentage((current.total - prior.total) / prior.total * 100);
  const excluded = input.adjacent ? pairIssues(input.adjacent, input.audience, input.asOf) : [];
  const exclusion = excluded.length ? `Adjacent service not combined or ranked. ${excluded.join(" ")}` : "Other services are outside this one-service comparison; no cross-service ranking is produced.";
  const metric = (name, formula, value, unit, lineageRefs) => ({ name, formula, value, unit,
    uncertainty: "Descriptive totals from owner-supplied complete-period exports; no causal or statistical significance claim.", lineageRefs });
  const paragraph1 = `${current.service}: request volume changed from ${prior.total} in ${prior.period} to ${current.total} in ${current.period} (${volumePercent}% relative change). Requests meeting target changed from ${prior.met} to ${current.met}, while target-hit rate changed from ${priorRate}% to ${currentRate}% (${ratePoints} percentage points). The count change does not by itself establish improved service quality.`;
  const paragraph2 = `${exclusion} No cause is established by these two aggregate periods. The metric owner should reconcile definitions before any broader comparison, and the operations owner should request permitted request-mix and capacity evidence before attributing the movement. These are proposed follow-ups, not assigned or approved actions.`;
  const artifact = {
    question: `What changed between ${prior.period} and ${current.period} for ${current.service}, for ${input.audience}?`,
    population: { included: [`${current.service}: ${current.definition.population}`], excluded: [exclusion] },
    comparison: `${current.period} versus ${prior.period}; raw full-period request totals and the same target-hit definition ${current.definition.revision}; no cross-service ranking`,
    timeWindow: { start: prior.start, end: current.end },
    sources: [prior, current].map((r) => ({ reference: r.reference, source: `${r.service} ${r.period} authorized aggregate export`, observedAt: r.observedAt, state: "verified", fields: ["total", "met", "definition", "period", "audiences"] })),
    transformations: [prior, current].map((r, i) => ({ step: `Retain ${r.period} denominator and definition`, inputRef: r.reference, outputField: i ? "current_counts" : "prior_counts", logic: `Use supplied total=${r.total}, met=${r.met}; ${r.definition.numerator} / ${r.definition.denominator}; target=${r.definition.target}; population=${r.definition.population}; unit=${r.definition.unit}; no pooled teams or inferred missing rows` })),
    metrics: [
      metric("Prior request volume", "prior.total", prior.total, "requests", [refs[0], "prior_counts"]),
      metric("Current request volume", "current.total", current.total, "requests", [refs[1], "current_counts"]),
      metric("Prior requests meeting target", "prior.met", prior.met, "requests", [refs[0], "prior_counts"]),
      metric("Current requests meeting target", "current.met", current.met, "requests", [refs[1], "current_counts"]),
      metric("Prior target-hit rate", "100 * prior.met / prior.total", priorRate, "percent", [refs[0], "prior_counts"]),
      metric("Current target-hit rate", "100 * current.met / current.total", currentRate, "percent", [refs[1], "current_counts"]),
      metric("Request volume change", "100 * (current.total - prior.total) / prior.total", volumePercent, "percent", refs),
      metric("Target-hit rate change", "100 * (current.met / current.total - prior.met / prior.total)", ratePoints, "percentage points", refs),
    ],
    qualityFindings: [{ issue: exclusion, severity: "medium", affectedRows: 0, disposition: "Excluded entire adjacent aggregate comparison; zero affected primary-service rows is not a claim about adjacent row counts." },
      { issue: "Raw period counts are not normalized per business day and two aggregate periods do not identify causes.", severity: "medium", affectedRows: 0, disposition: "Report dates and full-period totals; obtain authorized request-mix and capacity evidence before attribution." }],
    findings: [{ statement: paragraph1, evidenceState: "supported", metricRefs: ["Prior request volume", "Current request volume", "Prior target-hit rate", "Current target-hit rate", "Request volume change", "Target-hit rate change"], alternativeExplanations: ["Changes in request mix, capacity or calendar exposure are hypotheses, not established causes."] },
      { statement: paragraph2, evidenceState: "inconclusive", metricRefs: ["Target-hit rate change"], alternativeExplanations: ["Metric-definition changes prevent an adjacent-team trend or ranking conclusion."] }],
    decisionOwner: input.decisionOwner,
    decisionState: "ready-for-review",
  };
  const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");
  const markdown = ["# Monthly service review", "", `Private draft for ${input.audience}; decision owner: ${input.decisionOwner}; as of ${input.asOf}.`, "",
    "| Period | Requests | Met target | Target-hit rate | Definition | Evidence |", "| --- | ---: | ---: | ---: | --- | --- |",
    `| ${cell(prior.period)} | ${prior.total} | ${prior.met} | ${priorRate}% | ${cell(prior.definition.revision)} | ${cell(prior.reference)} |`,
    `| ${cell(current.period)} | ${current.total} | ${current.met} | ${currentRate}% | ${cell(current.definition.revision)} | ${cell(current.reference)} |`,
    "", `Relative volume change: ${volumePercent}%. Target-hit change: ${ratePoints} percentage points.`, "", paragraph1, "", paragraph2, "",
    "## Evidence and scope", "", `Periods: ${prior.start} through ${prior.end}; ${current.start} through ${current.end}. Raw full-period counts, not daily normalized volume.`,
    `Population: ${current.definition.population}. Numerator: ${current.definition.numerator}. Denominator: ${current.definition.denominator}. Target: ${current.definition.target}.`,
    "", "## Owner questions and briefing handoff", "",
    "1. Metric owner: reconcile adjacent-service population and target definitions before combining or ranking services.",
    "2. Operations owner: what permitted request-mix and capacity evidence could test the movement hypotheses? No cause is currently established.",
    "3. Decision owner: review this private readout and choose whether further investigation is warranted; no action is assigned by this draft.", "",
    "Research Briefing may use the two primary source references and this table for the same authorized audience, preserving exclusions, uncertainty and these owner questions. Do not reintroduce excluded or restricted data, claim service-quality improvement from the numerator alone, or imply external disclosure or owner approval.", ""].join("\n");
  return { artifact, markdown };
}

export function checkRecurringBusinessReview(input, artifact, markdown) {
  const expected = buildRecurringBusinessReview(input);
  const findings = [];
  if (!isDeepStrictEqual(artifact, expected.artifact)) findings.push("Source-bound example artifact differs in scope, arithmetic, lineage, units, narrative or decision state.");
  if (markdown !== expected.markdown) findings.push("Source-bound example readout differs from its reproducible table, narrative or handoff.");
  return findings;
}
