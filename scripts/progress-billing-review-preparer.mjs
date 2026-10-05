import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";
import schema from "../sources/progress-billing-review-preparer/schemas/progress-billing-input.schema.json" with { type: "json" };

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const D = Decimal.clone({ precision: 50 });
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const sum = values => values.reduce((s, v) => s.plus(v), new D(0));
const instant = value => Temporal.Instant.from(value).epochNanoseconds;
export const progressBillingAuthority = Object.freeze(Object.fromEntries(
  ["certification", "submission", "invoice", "accounting", "waiver", "eligibilityDetermination"].map(k => [k, "not-performed"])));

export function deriveProgressBilling(input) {
  if (!validate(input)) throw new Error(`Invalid progress billing input: ${ajv.errorsText(validate.errors)}`);
  const blockers = [];
  const add = (code, id) => blockers.push({ code, id });
  const { scope, coverage, lines, history } = input;
  const cutoff = instant(scope.asOf);
  const money = v => new D(v).toFixed(scope.minorDigits);
  const unique = (rows, key, code) => {
    const seen = new Set();
    for (const row of rows) { const id = key(row); if (seen.has(id)) add(code, id); seen.add(id); }
  };
  const sources = new Map(input.sources.map(s => [s.id, s]));
  const lineById = new Map(lines.map(l => [l.id, l]));
  unique(input.sources, s => s.id, "duplicate-source");
  const records = [coverage, ...input.periods, ...lines, ...input.changes, ...input.installed, ...input.lots,
    ...history.applications, ...history.certificates, ...input.cash, ...input.attachments];
  unique(records, r => r.id, "duplicate-id");
  unique(records, r => r.nativeId, "duplicate-native-identity");
  for (const s of input.sources) {
    if (s.revision !== s.currentRevision || !s.approved || s.contract !== scope.contract || instant(s.capturedAt) > cutoff) add("source-state", s.id);
  }
  for (const r of records) {
    if (sources.get(r.sourceRef)?.revision !== r.sourceRevision) add("source-revision", r.id);
    if ("line" in r && !lineById.has(r.line)) add("orphan-line", r.id);
  }
  // No silent input rounding: all supplied money must already use the currency precision.
  for (const r of records) for (const k of ["amount", "baseScheduled", "installedOpening", "installedClosing", "storedOpening", "storedClosing", "opening", "additions", "removals", "closing", "installed", "stored"]) {
    if (k in r && new D(r[k]).decimalPlaces() > scope.minorDigits) add("currency-precision", r.id);
  }
  for (const k of ["complete", "historyComplete", "cashComplete", "checklistComplete", "rulesComplete", "noDuplicateCoverage", "disclosureApproved"]) if (!coverage[k]) add(`coverage-${k}`, coverage.id);
  for (const id of coverage.unresolvedCorrections) add("unresolved-correction", id);
  const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
  if (!sameSet(coverage.lines, lines.map(l => l.id))) add("line-universe", coverage.id);
  if (!sameSet(coverage.lots, input.lots.map(l => l.id))) add("lot-universe", coverage.id);
  const reviewer = scope.reviewer.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (/^(agent|assistant|bot|self|me|myself|ai|ai assistant|agent owned|self approved|progress billing review preparer)$/.test(reviewer)) add("human-reviewer", scope.application);
  if (scope.periodStart > scope.periodEnd || instant(`${scope.periodEnd}T00:00:00Z`) > cutoff) add("period-scope", scope.application);
  unique(input.periods, p => String(p.number), "duplicate-period");
  const periods = new Map(input.periods.map(p => [p.number, p]));
  if (input.periods.length !== scope.period) add("period-history", scope.application);
  for (let n = 1; n <= scope.period; n++) {
    const p = periods.get(n), prev = periods.get(n - 1);
    if (!p || p.start > p.end || (prev && Date.parse(p.start) !== Date.parse(prev.end) + 86400000)) add("period-continuity", String(n));
  }
  const currentPeriod = periods.get(scope.period);
  if (!currentPeriod || currentPeriod.start !== scope.periodStart || currentPeriod.end !== scope.periodEnd || currentPeriod.applicationRevision !== scope.revision) add("application-revision", scope.application);
  for (const r of [...history.applications, ...history.certificates]) {
    if (r.period >= scope.period || periods.get(r.period)?.applicationRevision !== r.applicationRevision) add("history-revision", r.id);
  }
  const certById = new Map(history.certificates.map(c => [c.id, c]));
  const replaced = new Set();
  for (const c of history.certificates) {
    if (c.kind !== history.mode) add("mixed-certificate-mode", c.id);
    if (!c.correctionResolved) add("unresolved-correction", c.id);
    if (c.supersedes !== null) {
      if (history.mode === "cumulative-snapshot" && c.period !== scope.period - 1) add("unsupported-earlier-snapshot-correction", c.id);
      const old = certById.get(c.supersedes);
      if (!old || old.id === c.id || old.line !== c.line || old.period !== c.period || old.kind !== c.kind || !c.replacementApprovalRef || replaced.has(c.supersedes)) add("certificate-supersession", c.id);
      replaced.add(c.supersedes);
      const seen = new Set([c.id]);
      let ancestor = old;
      while (ancestor) {
        if (seen.has(ancestor.id)) { add("supersession-cycle", c.id); break; }
        seen.add(ancestor.id); ancestor = certById.get(ancestor.supersedes);
      }
    } else if (c.replacementApprovalRef !== null) add("orphan-replacement-approval", c.id);
  }
  const effective = history.certificates.filter(c => !replaced.has(c.id));
  const transferRefs = new Set();
  for (const lot of input.lots) {
    if (!lot.eligible || !lot.eligibilityRef) add("stored-eligibility", lot.id);
    if ([lot.opening, lot.additions, lot.removals, lot.closing].some(v => new D(v).isNegative())) add("negative-lot-balance", lot.id);
    if (!new D(lot.opening).plus(lot.additions).minus(sum(lot.transfers.map(t => t.amount))).minus(lot.removals).eq(lot.closing)) add("lot-conservation", lot.id);
    for (const t of lot.transfers) {
      const installed = input.installed.find(i => i.id === t.installedRef);
      if (transferRefs.has(t.installedRef)) add("duplicate-transfer", lot.id);
      transferRefs.add(t.installedRef);
      if (!installed || installed.kind !== "stored-transfer" || installed.line !== lot.line || !new D(installed.amount).eq(t.amount) || new D(t.amount).lte(0) || new D(t.amount).decimalPlaces() > scope.minorDigits) add("transfer-installed-evidence", lot.id);
    }
  }
  for (const i of input.installed) {
    if (!i.authorizationRef || (i.kind !== "adjustment" && new D(i.amount).isNegative())) add("installed-authorization", i.id);
    if (i.kind === "stored-transfer" && !transferRefs.has(i.id)) add("orphan-transfer", i.id);
  }
  for (const c of input.changes) if (c.state === "approved" && !c.approvalRef) add("change-approval", c.id);
  for (const c of input.cash) {
    if (c.basis !== "applied-to-prior-certificates" || !c.ownerConfirmed || !c.applicationRef || c.throughPeriod !== scope.period - 1) add("cash-prior-application", c.id);
    const source = sources.get(c.sourceRef);
    if (instant(c.at) > cutoff || (source && instant(c.at) > instant(source.capturedAt))) add("cash-cutoff", c.id);
  }
  for (const a of input.attachments) if (!a.permitted || a.suppliedRevision !== a.requiredRevision || a.sourceRevision !== a.suppliedRevision) add("attachment-revision-permission", a.id);
  const computed = [];
  for (const l of lines) {
    const certs = effective.filter(c => c.line === l.id);
    for (let p = 1; p < scope.period; p++) {
      if (certs.filter(c => c.period === p).length !== 1 || history.applications.filter(a => a.line === l.id && a.period === p).length !== 1) add("history-line-period-coverage", l.id);
    }
    const previous = history.applications.find(a => a.line === l.id && a.period === scope.period - 1);
    if (scope.period === 1 ? !new D(l.installedOpening).eq(0) || !new D(l.storedOpening).eq(0)
      : !previous || !new D(previous.installed).eq(l.installedOpening) || !new D(previous.stored).eq(l.storedOpening)) add("opening-history", l.id);
    const lots = input.lots.filter(t => t.line === l.id);
    if (!sum(lots.map(t => t.opening)).eq(l.storedOpening) || !sum(lots.map(t => t.closing)).eq(l.storedClosing)) add("stored-line-reconciliation", l.id);
    if (!new D(l.installedOpening).plus(sum(input.installed.filter(i => i.line === l.id).map(i => i.amount))).eq(l.installedClosing)) add("installed-line-reconciliation", l.id);
    const scheduled = new D(l.baseScheduled).plus(sum(input.changes.filter(c => c.line === l.id && c.state === "approved").map(c => c.amount)));
    if ([l.baseScheduled, l.installedOpening, l.installedClosing, l.storedOpening, l.storedClosing].some(v => new D(v).isNegative()) || scheduled.isNegative() || new D(l.installedClosing).plus(l.storedClosing).gt(scheduled)) add("scheduled-value", l.id);
    if (l.rounding === "unsupported") add("rounding-rule", l.id);
    const rounding = l.rounding === "half-even-per-component" ? D.ROUND_HALF_EVEN : D.ROUND_HALF_UP;
    const workedRetainage = new D(l.installedClosing).times(l.workedRate).toDecimalPlaces(scope.minorDigits, rounding);
    const storedRetainage = new D(l.storedClosing).times(l.storedRate).toDecimalPlaces(scope.minorDigits, rounding);
    const entitlement = new D(l.installedClosing).plus(l.storedClosing).minus(workedRetainage).minus(storedRetainage);
    // Snapshots replace the cumulative position. Only period certifications are additive.
    const selected = history.mode === "cumulative-snapshot" ? certs.filter(c => c.period === scope.period - 1) : certs;
    const prior = sum(selected.map(c => c.amount));
    const current = entitlement.minus(prior);
    const negativeAdjustment = current.isNegative() || new D(l.installedClosing).lt(l.installedOpening)
      || input.installed.some(i => i.line === l.id && new D(i.amount).isNegative())
      || history.certificates.some(c => c.line === l.id && new D(c.amount).isNegative())
      || input.changes.some(c => c.line === l.id && c.state === "approved" && new D(c.amount).isNegative());
    if (negativeAdjustment && !l.negativeAdjustmentRef) add("negative-adjustment-authorization", l.id);
    computed.push({ id: l.id, scheduled: money(scheduled), installed: money(l.installedClosing), stored: money(l.storedClosing),
      workedRetainage: money(workedRetainage), storedRetainage: money(storedRetainage), entitlement: money(entitlement),
      priorCertified: money(prior), current: money(current), priorUnpaid: money(prior.minus(sum(input.cash.filter(c => c.line === l.id).map(c => c.amount)))),
      effectiveCertificates: selected.map(c => c.id), negativeAdjustment });
  }
  return { inputDigest: `sha256:${createHash("sha256").update(canonical(input)).digest("hex")}`,
    state: blockers.length ? "blocked" : "ready-for-owner-review", lines: blockers.length ? [] : computed,
    total: blockers.length ? null : money(sum(computed.map(l => l.current))),
    priorUnpaid: blockers.length ? null : money(sum(computed.map(l => l.priorUnpaid))), blockers };
}

export function progressBillingFindings(record) {
  try {
    const findings = [];
    if (canonical(deriveProgressBilling(record.input)) !== canonical(record.result)) findings.push({ code: "progress_billing_result", path: "result", message: "Recompute from the complete current source pack; derived values or readiness are stale." });
    if (canonical(record.authority) !== canonical(progressBillingAuthority)) findings.push({ code: "progress_billing_authority", path: "authority", message: "All external actions remain unperformed." });
    return findings;
  } catch (error) { return [{ code: "progress_billing_input", path: "input", message: error.message }]; }
}

const escape = v => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll(/([\\`*_\[\]])/g, "\\$1").replaceAll(/[\r\n]/g, " ");
export function renderProgressBilling(record) {
  const findings = progressBillingFindings(record);
  if (findings.length) throw new Error(JSON.stringify(findings));
  const { input: i, result: r } = record;
  const money = v => v === null ? "UNRESOLVED" : `${i.scope.currency} ${v}`;
  const draft = ["# Private progress application review draft", "Original workpaper; not a licensed form or request for payment.",
    `${escape(i.scope.contract)} / ${escape(i.scope.application)} revision ${escape(i.scope.revision)}; ${i.scope.periodStart} through ${i.scope.periodEnd}.`,
    `State: ${r.state}. Human reviewer: ${escape(i.scope.reviewer)}.`,
    "| Line | Scheduled | Installed | Stored | Worked retainage | Stored retainage | Cumulative entitlement | Prior certified | Current draft |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...r.lines.map(l => `| ${escape(l.id)} | ${l.scheduled} | ${l.installed} | ${l.stored} | ${l.workedRetainage} | ${l.storedRetainage} | ${l.entitlement} | ${l.priorCertified} | ${l.current} |`),
    `Amounts in ${i.scope.currency}. Proposed current total: ${money(r.total)}.`,
    `Prior certified unpaid (separate follow-up): ${money(r.priorUnpaid)}. Negative balances and adjustments are preserved.`,
    ...r.blockers.map(b => `- BLOCKED ${escape(b.code)}: ${escape(b.id)}`),
    "Owner-supplied rules only. No legal or engineering eligibility determination, certification, submission, waiver, invoice issuance or accounting action.",
    "Any changed source, certificate, rule or attachment invalidates this draft and requires recalculation and fresh owner review."
  ].join("\n\n") + "\n";
  const workpaper = ["# Private owner workpaper", `Destination: ${escape(i.scope.privateDestination)}; as of ${i.scope.asOf}.`,
    `Input digest: ${r.inputDigest}. State: ${r.state}.`,
    "## Stored lot conservation", ...i.lots.map(l => `- ${escape(l.id)} (${escape(l.line)}): ${l.opening} + ${l.additions} - ${sum(l.transfers.map(t => t.amount))} - ${l.removals} = ${l.closing}; transfer evidence ${l.transfers.map(t => `${escape(t.installedRef)}:${t.amount}`).join(", ") || "none"}; eligibility ${escape(l.eligibilityRef)}.`),
    "## Retainage instructions", ...i.lines.map(l => `- ${escape(l.id)}: installed x ${l.workedRate}; stored x ${l.storedRate}; ${l.rounding} to ${i.scope.minorDigits} digits; rule ${escape(l.rulesRef)}; negative adjustment ${escape(l.negativeAdjustmentRef ?? "none")}.`),
    "## Certification history", `Mode: ${i.history.mode}. Cumulative snapshots are never summed. Explicit approved supersession replaces only the identified record; all history is retained.`,
    ...i.history.certificates.map(c => `- ${escape(c.id)}: period ${c.period}, ${c.kind}, ${c.amount}; replaces ${escape(c.supersedes ?? "none")}; authority ${escape(c.replacementApprovalRef ?? "none")}.`),
    ...r.lines.map(l => `- ${escape(l.id)}: entitlement ${l.entitlement} - prior certified ${l.priorCertified} = ${l.current}; selected ${l.effectiveCertificates.map(escape).join(", ")}; prior unpaid ${l.priorUnpaid}.`),
    "## Changes", ...i.changes.map(c => `- ${escape(c.id)} (${escape(c.line)}): ${c.amount}, ${c.state}; approval ${escape(c.approvalRef ?? "none")}.`),
    "## Cash (never certification)", ...i.cash.map(c => `- ${escape(c.id)} (${escape(c.line)}): ${c.amount}; ${escape(c.at)}; ${c.basis} through period ${c.throughPeriod}; owner confirmed ${c.ownerConfirmed}; application ${escape(c.applicationRef ?? "missing")}.`),
    "## Supplied checklist", ...i.attachments.map(a => `- ${escape(a.id)}: required ${escape(a.requiredRevision)}, supplied ${escape(a.suppliedRevision ?? "missing")}; disclosure permitted ${a.permitted}.`),
    "## Owner questions", ...(r.blockers.length ? r.blockers.map(b => `- ${escape(b.code)}: ${escape(b.id)}. Supply reconciled current owner evidence; no totals are released.`) : ["Review this exact revision and input digest. No input blockers remain; this is not approval to submit."]),
    "## Exact source-bound input", "The JSON report preserves every application, native record, revision, movement and owner declaration. The following private snapshot is part of this workpaper:",
    "<pre>" + JSON.stringify(i, null, 2).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "</pre>",
    "Synthetic fixtures are deterministic validation examples, not observed project evidence or human approval. No external action was performed."
  ].join("\n\n") + "\n";
  return { draft, workpaper };
}
