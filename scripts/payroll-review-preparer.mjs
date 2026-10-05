import { isDeepStrictEqual as same } from "node:util";
const keyOf = (row) => `${row.employee}/${row.component}`;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const nullableSum = (values) => values.every(Number.isSafeInteger) ? sum(values) : null;
const delta = (a, b) => Number.isSafeInteger(a) && Number.isSafeInteger(b) ? a - b : null;
const commonScope = ["employer", "payGroup", "currency", "minorDigits", "runType"];

export function derivePayrollReview(value) {
  const { scope, prior, draft, expectations, expectedComponents } = value;
  const universe = new Map(expectedComponents.map((row) => [keyOf(row), row]));
  const keys = [...new Set([...expectedComponents, ...prior.rows, ...draft.rows, ...expectations].map(keyOf))];
  const workpaper = keys.map((key) => {
    const separator = key.indexOf("/");
    const employee = key.slice(0, separator);
    const component = key.slice(separator + 1);
    const p = prior.rows.filter((row) => keyOf(row) === key);
    const d = draft.rows.filter((row) => keyOf(row) === key);
    const e = expectations.filter((row) => keyOf(row) === key);
    const valid = (row) => commonScope.every((field) => row[field] === scope[field]) &&
      row.period === scope.currentPeriod && row.draftRevision === draft.revision && row.owner === scope.inputOwner &&
      row.decision === "approved" && row.effectiveFrom <= scope.periodStart && row.effectiveThrough >= scope.periodEnd &&
      Date.parse(row.decidedAt) <= Date.parse(scope.asOf) && (row.kind !== "one-off-expiry" || (row.amount === 0 && row.supportRefs.length > 0));
    const expectedAmount = e.length === 1 && valid(e[0]) ? e[0].amount : null;
    const issues = [];
    if (!universe.has(key)) issues.push("unexpected-component");
    if (p.length > 1) issues.push("duplicate-prior");
    if (d.length > 1) issues.push("duplicate-draft");
    if (!prior.complete) issues.push("incomplete-prior");
    if (!draft.complete) issues.push("incomplete-draft");
    if (!e.length) issues.push("expectation-missing");
    else if (e.length > 1) issues.push("expectation-conflict");
    else if (!valid(e[0])) issues.push("expectation-invalid");
    if (!d.length && expectedAmount !== 0) issues.push("missing-draft");
    const priorAmount = p.length === 1 ? p[0].amount : null;
    const draftAmount = d.length === 1 ? d[0].amount : null;
    // An absent row supplies no observed amount. Zero is only an arithmetic
    // placeholder when the owner declares the corresponding export complete.
    const priorBasis = prior.complete && p.length < 2 ? priorAmount ?? 0 : null;
    const draftBasis = draft.complete && d.length < 2 ? draftAmount ?? 0 : null;
    const variance = delta(draftBasis, expectedAmount);
    if (variance !== null && Math.abs(variance) > (universe.get(key)?.tolerance ?? 0)) issues.push("amount-difference");
    return { employee, component, priorRowIds: p.map((r) => r.id), draftRowIds: d.map((r) => r.id), expectationIds: e.map((r) => r.id),
      priorAmount, draftAmount, expectedAmount, observedMovement: delta(draftBasis, priorBasis),
      expectedMovement: delta(expectedAmount, priorBasis), variance, issues };
  });
  const control = (computed, declared) => ({ computed, declared,
    state: computed === null || declared === null ? "unavailable" : computed === declared ? "matched" : "mismatched" });
  const expectedTotal = nullableSum(workpaper.map((r) => r.expectedAmount));
  const summary = {
    prior: control(sum(prior.rows.map((r) => r.amount)), prior.declaredTotal),
    draft: control(sum(draft.rows.map((r) => r.amount)), draft.declaredTotal),
    expected: control(expectedTotal, value.declaredExpectedTotal),
    observedMovement: nullableSum(workpaper.map((r) => r.observedMovement)),
    expectedMovement: nullableSum(workpaper.map((r) => r.expectedMovement)),
    variance: nullableSum(workpaper.map((r) => r.variance)),
    absoluteExceptionAmount: nullableSum(workpaper.map((r) => r.variance === null ? null : r.issues.includes("amount-difference") ? Math.abs(r.variance) : 0)),
    exceptionCount: workpaper.filter((r) => r.issues.length).length,
    missingDraftCount: workpaper.filter((r) => !r.draftRowIds.length).length,
  };
  const sourceQuestionKeys = ["prior", "draft", "expected"].filter((source) => summary[source].state !== "matched" || (value[source] && !value[source].complete));
  const cutoffState = !scope.cutoff ? "not-supplied" : Date.parse(scope.asOf) < Date.parse(scope.cutoff) ? "before-cutoff" : "at-or-after-cutoff";
  return { workpaper, summary, sourceQuestionKeys, cutoffState };
}

export function payrollReviewFindings(value) {
  const findings = [];
  const fail = (code, message) => findings.push({ code, path: "/", message });
  if (!value?.scope || !value.prior || !value.draft || !value.summary || !value.handoff ||
      ![value.expectedEmployees, value.expectedComponents, value.expectations, value.workpaper, value.prior.rows, value.draft.rows].every(Array.isArray)) {
    fail("payroll_structure", "A bounded payroll workpaper with both source registers is required.");
    return findings;
  }
  const { scope, prior, draft, expectations, expectedComponents } = value;
  if (scope.currentPeriod === scope.priorPeriod || scope.periodStart > scope.periodEnd) fail("payroll_period", "Current and comparison periods must be distinct and the current period dates ordered.");
  for (const [source, period] of [[prior, scope.priorPeriod], [draft, scope.currentPeriod]]) {
    if (commonScope.some((field) => source[field] !== scope[field]) || source.period !== period) fail("payroll_scope", "Never combine different employers, pay groups, currencies, unit scales, run types or periods.");
    if (Date.parse(source.observedAt) > Date.parse(scope.asOf)) fail("payroll_chronology", "A register cannot postdate the review as-of time.");
  }
  const recordIds = [...prior.rows, ...draft.rows, ...expectations].map((r) => r.id);
  if (new Set(recordIds).size !== recordIds.length) fail("payroll_duplicate_id", "Each supplied row and expectation needs its own preserved source identity.");
  if (new Set(expectedComponents.map(keyOf)).size !== expectedComponents.length || new Set(value.expectedEmployees).size !== value.expectedEmployees.length ||
      expectedComponents.some((r) => !value.expectedEmployees.includes(r.employee)) ||
      value.expectedEmployees.some((employee) => !expectedComponents.some((r) => r.employee === employee))) fail("payroll_universe", "The supplied roster and component universe must agree without duplicate expected keys.");
  for (const e of expectations) {
    if (e.effectiveFrom > e.effectiveThrough) fail("payroll_chronology", "An input's supplied effective dates cannot be reversed.");
  }
  const { workpaper, summary, sourceQuestionKeys, cutoffState } = derivePayrollReview(value);
  if (!same(value.workpaper.map(keyOf), workpaper.map(keyOf))) fail("payroll_coverage", "Preserve the union of expected, prior, draft and input keys once in deterministic order; never silently drop unmatched rows.");
  for (const expected of workpaper) {
    const row = value.workpaper.find((r) => keyOf(r) === keyOf(expected));
    if (!row) continue;
    const { owner, question, ...actual } = row;
    if (!same(actual, expected)) fail("payroll_comparison", "Recompute exact row links, observed amounts, applicable expectations, movements, variances and non-netted exceptions.");
    if (owner !== scope.reviewer || (expected.issues.length ? !question?.trim() : question !== null)) fail("payroll_question", "Every exception needs a concrete payroll-owner question; resolved rows do not retain resolved questions.");
  }
  if (!same(value.summary, summary)) fail("payroll_totals", "Reconcile supplied-row totals and retain absolute exceptions independently of net movement.");
  const unresolved = workpaper.filter((r) => r.issues.length).map(keyOf);
  if (!same(value.handoff.unresolvedKeys, unresolved) || value.handoff.reviewedDraftRevision !== draft.revision) fail("payroll_handoff", "The private handoff must retain every exception and the exact reviewed draft revision.");
  if (!same(value.handoff.sourceQuestions.map((q) => q.source), sourceQuestionKeys) || value.handoff.sourceQuestions.some((q) => !q.question.trim())) fail("payroll_source_question", "Missing, incomplete or mismatched control totals need exact source-owner questions.");
  if (value.handoff.cutoffState !== cutoffState || (cutoffState !== "before-cutoff" ? !value.handoff.cutoffQuestion?.trim() : value.handoff.cutoffQuestion !== null)) fail("payroll_cutoff", "A missing cutoff is unknown; elapsed cutoff needs owner handling and a future cutoff is not release readiness.");
  const needsRevision = unresolved.length > 0 || sourceQuestionKeys.length > 0;
  if (needsRevision ? !value.handoff.revisionQuestion?.trim() : value.handoff.revisionQuestion !== null) fail("payroll_revision_question", "Unresolved review work needs a corrected exact-revision or scoped input-decision request.");
  if (value.handoff.state !== "private-review-draft" || value.handoff.correctness !== "not-determined" || value.handoff.approval !== "not-granted" ||
      ["funding", "release", "systemChanges", "contacts"].some((k) => value.handoff[k] !== "not-performed") ||
      !same(value.handoff.unavailableChecks, ["tax", "deductions", "net-pay", "benefits", "statutory"])) fail("payroll_authority", "Gross-pay comparison is not correctness, statutory verification, approval, funding, system mutation, contact or release.");
  if ([scope.reviewer, scope.inputOwner].some((owner) => /^(?:the )?(?:agent|assistant|claw|ai|payroll review preparer)$/iu.test(owner.trim()))) fail("payroll_owner", "Review and input decisions remain human-owned.");
  const narrative = [scope.recipient, scope.reviewer, scope.inputOwner, ...value.workpaper.map((r) => r.question ?? ""),
    ...value.handoff.sourceQuestions.map((q) => q.question), value.handoff.cutoffQuestion ?? "", value.handoff.revisionQuestion ?? ""].join("\n");
  if (/\b(?:I|we|the (?:agent|assistant|claw))\s+(?:have\s+)?(?:approved|released|funded|submitted|paid|sent|updated)\b|\b(?:payroll|payments?)\s+(?:(?:is|was|has been)\s+)?(?:approved|released|funded|compliant|correct)\b/iu.test(narrative)) fail("payroll_authority_text", "Review text cannot claim payroll approval, compliance, funding or release.");
  const text = JSON.stringify(value);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/iu.test(text)) fail("payroll_sensitive_text", "Do not include personal contact or financial-identifier-shaped content in the durable workpaper.");
  return findings;
}

export function renderPayrollReview(value) {
  const findings = payrollReviewFindings(value);
  if (findings.length) throw new Error(findings.map((f) => `${f.code}: ${f.message}`).join("\n"));
  const { scope, prior, draft, summary, handoff } = value;
  const cell = (text) => String(text).replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");
  const amount = (n) => n === null ? "Unknown" : (n / 10 ** scope.minorDigits).toFixed(scope.minorDigits);
  const observed = (n, refs, complete) => refs.length > 1 ? "Ambiguous duplicate rows" : n === null ? (complete ? "Absent (0 comparison placeholder)" : "Absent; incomplete source") : amount(n);
  const lines = ["# Payroll comparison review draft", "", "Private gross-component workpaper. No payroll approval or release.", "",
    `${scope.employer}; ${scope.payGroup}; ${scope.currency}; ${scope.runType}; current ${scope.currentPeriod} draft ${draft.revision} versus ${scope.priorPeriod} revision ${prior.revision}.`,
    `As of ${scope.asOf}. Payroll reviewer: ${scope.reviewer}. Input owner: ${scope.inputOwner}. Private recipient: ${scope.recipient}. Policy: ${scope.policyRef}.`,
    `Prior source: ${prior.reference}, observed ${prior.observedAt}, ${prior.complete ? "owner-declared complete" : "incomplete"}. Draft source: ${draft.reference}, observed ${draft.observedAt}, ${draft.complete ? "owner-declared complete" : "incomplete"}.`,
    "", "## Component workpaper", "", "| Employee | Component | Prior observed | Draft observed | Supplied expected | Movement | Draft minus expected | Exceptions |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |"];
  for (const r of value.workpaper) lines.push(`| ${r.employee} | ${cell(r.component)} | ${observed(r.priorAmount, r.priorRowIds, prior.complete)} | ${observed(r.draftAmount, r.draftRowIds, draft.complete)} | ${amount(r.expectedAmount)} | ${amount(r.observedMovement)} | ${amount(r.variance)} | ${r.issues.join(", ") || "Within supplied expectation/tolerance"} |`);
  lines.push("", "## Totals and reconciliation", "", "| Basis | Sum of supplied rows / expectations | Owner control total | Control |", "| --- | ---: | ---: | --- |");
  for (const source of ["prior", "draft", "expected"]) lines.push(`| ${source} | ${amount(summary[source].computed)} | ${amount(summary[source].declared)} | ${summary[source].state} |`);
  lines.push("", `Observed movement: ${amount(summary.observedMovement)}. Expected movement: ${amount(summary.expectedMovement)}. Draft minus expected: ${amount(summary.variance)}.`,
    `Absolute amount outside supplied tolerances: ${amount(summary.absoluteExceptionAmount)}. Exception keys: ${summary.exceptionCount}. Absent draft components: ${summary.missingDraftCount}.`,
    "A matched control total does not clear row exceptions. Incomplete exports and duplicate keys do not support a complete comparison. An absent row is not an observed zero.",
    "", "## Input coverage and source lineage", "");
  for (const r of value.workpaper) lines.push(`- ${keyOf(r)}: prior rows ${r.priorRowIds.join(", ") || "none"}; draft rows ${r.draftRowIds.join(", ") || "none"}; expectation inputs ${r.expectationIds.join(", ") || "none"}; expected movement ${amount(r.expectedMovement)}.`);
  for (const e of value.expectations) {
    const applied = value.workpaper.find((r) => keyOf(r) === keyOf(e))?.expectedAmount !== null;
    lines.push(`- ${e.id}: ${e.employee}/${e.component}, ${e.kind}, ${(e.amount / 10 ** e.minorDigits).toFixed(e.minorDigits)} ${e.currency}; ${applied ? "applied within supplied scope" : "not applied; review scope or conflicting inputs"}; ${e.employer}/${e.payGroup}/${e.runType}, ${e.decision}, ${e.owner}, ${e.period}, draft ${e.draftRevision}, effective ${e.effectiveFrom} through ${e.effectiveThrough}, decided ${e.decidedAt} (${e.reference}); supporting references ${e.supportRefs.join(", ") || "none"}.`);
  }
  lines.push("", "## Exact reviewer questions", "");
  for (const r of value.workpaper.filter((r) => r.question)) lines.push(`- ${keyOf(r)} (${r.owner}): ${r.question}`);
  for (const q of handoff.sourceQuestions) lines.push(`- ${q.source} source (${scope.reviewer}): ${q.question}`);
  if (handoff.revisionQuestion) lines.push(`- Exact revision (${scope.reviewer}): ${handoff.revisionQuestion}`);
  if (!handoff.unresolvedKeys.length && !handoff.sourceQuestions.length) lines.push("No exceptions identified within the supplied gross-component scope. This is not a payroll correctness or release conclusion.");
  lines.push("", "## Cutoff and private handoff", "", `Cutoff: ${scope.cutoff ?? "not supplied"}; ${handoff.cutoffState}.`, handoff.cutoffQuestion ?? "A future cutoff does not establish release readiness.",
    `Unresolved keys: ${handoff.unresolvedKeys.join(", ") || "none within supplied scope"}. Reviewed draft: ${handoff.reviewedDraftRevision}.`,
    `Unavailable checks: ${handoff.unavailableChecks.join(", ")}. No statutory amounts were calculated.`,
    "Re-review any corrected provider revision against current scoped owner inputs. Verify original authorized sources and actual workpaper text; metadata checks do not authenticate approvals or guarantee complete sensitive-data removal.",
    "No payroll correctness, compliance, approval, funding, release, system change or employee contact is claimed.");
  return `${lines.join("\n")}\n`;
}
