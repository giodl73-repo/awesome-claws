import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

export const snapshot = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fields = ["entity", "accountId", "period", "currency", "basis"];
const sourceIds = ["TB-OPEN", "TB-CLOSE", "SCHED-SUPPLIER", "SCHED-PAYROLL"];
const text = (s) => typeof s === "string" && s.trim().length > 0;

// Fixed worked-example arithmetic. The existing reconciliation owner validates
// matching and residuals; this example does not implement another matching engine.
export function buildCloseWorkpaper(input, reconciliation) {
  const gaps = [];
  if (!input || fields.some((f) => !text(input[f])) || input.currency !== "USD" || !text(input.owner)) return { gaps: ["Workpaper scope or owner is missing."], analysis: null };
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(input.period)) gaps.push("Period must be an explicit calendar month.");
  if (!isDeepStrictEqual(input.expectedSources, sourceIds) || rows.length !== 4 || !isDeepStrictEqual(rows.map((r) => r?.reference), sourceIds)) gaps.push("A required source is missing, duplicated or substituted.");
  for (const row of rows) {
    if (!row || typeof row !== "object") { gaps.push("A supplied source row is malformed."); continue; }
    if (fields.some((f) => row[f] !== input[f]) || !text(row.revision) || row.state !== "supplied-complete") gaps.push(`Source scope, revision or completeness unresolved: ${row.reference}.`);
    if (!Number.isSafeInteger(row.cents) || Math.abs(row.cents) > 1_000_000_000) gaps.push(`Amount missing or invalid: ${row.reference}; do not substitute zero.`);
  }
  const binding = input.reconciliationBinding;
  if (!binding || ["entity", "basis", "currency", "period"].some((f) => binding[f] !== input[f]) || binding.accountId === input.accountId) gaps.push("Separate-account entity, currency, period or basis binding is unresolved.");
  if (!reconciliation?.round || !binding || reconciliation.round.id !== binding.roundId || reconciliation.round.accountId !== binding.accountId || reconciliation.round.currency !== binding.currency || reconciliation.round.roundRootDigest !== binding.roundRootDigest || reconciliation.round.period.startsOn !== `${input.period}-01` || reconciliation.round.period.endsOn.slice(0, 7) !== input.period) gaps.push("Reconciliation snapshot does not match the supplied account/period binding.");
  if (reconciliation?.round) {
    try {
      if (validateArtifactSemantics("financial-account-reconciliation-coordinator", reconciliation, { asOf: input.asOf }).length) gaps.push("Existing account-reconciliation validation failed.");
    } catch { gaps.push("Existing account-reconciliation artifact is malformed."); }
  }
  if (gaps.length) return { gaps, analysis: null };
  const [opening, closing, supplier, payroll] = input.rows.map((r) => r.cents);
  const residuals = reconciliation.residuals.map((r) => {
    const rows = r.side === "ledger" ? reconciliation.ledgerRows : reconciliation.statementRows;
    const row = rows.find((row) => row.id === r.rowRef);
    return { id: r.id, accountId: r.accountId, side: r.side, rowRef: r.rowRef, usd: Number(row.minorUnits) / 100, reason: r.reason, nextOwner: reconciliation.principals.find((p) => p.id === r.nextOwnerRef).name };
  });
  return { gaps: [], analysis: {
    entity: input.entity, accountId: input.accountId, period: input.period, currency: input.currency, basis: input.basis,
    sourceSnapshot: snapshot(input), reconciliationSnapshot: snapshot(reconciliation),
    opening: opening / 100, closing: closing / 100, change: (closing - opening) / 100,
    explained: (supplier + payroll) / 100, unexplained: (closing - opening - supplier - payroll) / 100,
    sources: input.rows.map(({ reference, revision, cents }) => ({ reference, revision, usd: cents / 100 })),
    residuals, owner: input.owner, state: "accountant-review-pending",
    journalPosting: "not-performed", bookClosure: "not-performed", certification: "not-claimed",
  } };
}

export function closeWorkpaperNarrative(result) {
  if (!result.analysis) return `# Close workpaper: evidence needed\n\n${result.gaps.join("\n\n")}\n\nNo complete comparison, journal proposal or close approval is produced.\n`;
  const a = result.analysis;
  return ["# Close workpaper", "", `${a.entity}; ${a.accountId}; ${a.period}; ${a.currency}; ${a.basis}.`, "",
    "| Component | USD | Source / revision |", "| --- | ---: | --- |",
    ...a.sources.map((s, i) => `| ${["Opening balance", "Closing balance", "Supplier schedule change", "Payroll schedule change"][i]} | ${s.usd.toFixed(2)} | ${s.reference} / ${s.revision} |`),
    `| Balance change | ${a.change.toFixed(2)} | Closing less opening |`,
    `| Explained by schedules | ${a.explained.toFixed(2)} | Supplier plus payroll |`,
    `| Unexplained | ${a.unexplained.toFixed(2)} | Balance change less schedules |`, "",
    `The supplied balances changed from USD ${a.opening.toFixed(2)} to USD ${a.closing.toFixed(2)}. Supporting schedules explain USD ${a.explained.toFixed(2)} of the USD ${a.change.toFixed(2)} change. USD ${a.unexplained.toFixed(2)} remains unexplained; no accrual, cause or journal is inferred.`, "",
    "## Separate-account unresolved items", "", ...a.residuals.map((r) => `- ${r.accountId}: ${r.id}, ${r.side} row ${r.rowRef}, USD ${r.usd.toFixed(2)}, ${r.reason}; next owner ${r.nextOwner}.`), "",
    "Keep these items separate; netting accounts or balancing portfolio totals does not resolve them. The reconciliation output is validated by its existing owner contract, not a replacement matcher.", "",
    `Reviewer: ${a.owner}. Which source explains the remaining balance difference? What evidence resolves each separate-account item? Review the exact source and reconciliation snapshots again after any entity, period, basis, value or revision changes.`, "",
    "This private workpaper is not a journal, accounting-policy determination, tax conclusion, certification or close approval. No posting, funding, source-system mutation or communication occurred.", ""].join("\n");
}

export function checkCloseWorkpaper(input, reconciliation, result, markdown) {
  const expected = buildCloseWorkpaper(input, reconciliation);
  return [
    ...(!isDeepStrictEqual(result, expected) ? ["Source-bound workpaper scope, arithmetic, residuals or authority differs."] : []),
    ...(markdown !== closeWorkpaperNarrative(expected) ? ["Worked-example narrative differs from the source-bound schedule or handoff."] : []),
  ];
}
