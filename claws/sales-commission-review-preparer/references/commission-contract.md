# Commission review contract

Separate X3 admitted in issue #232, comment
https://github.com/giodl73-repo/awesome-claws/issues/232#issuecomment-6007491037.
Admission is not implementation quality proof or payout approval.

## Scope and supplied authority

Prepare one employer, currency, scale and closed review interval [start, end).
Use pseudonymous payees and controlled source aliases only. The owner supplies
the exact event, payee, payout and reversal populations, their completeness
assertion, and event order (including ties). Declared populations are not proof
that exports are complete. A missing population is not an empty population.
Every source binds employer, currency, kind, revision and capture time. Every
record cites native source coordinates, state, observation/decision time and
named human decision-owner alias. Do not populate approval aliases yourself.
Aliases do not authenticate humans or source records. No raw employee details,
bank details, tax data, credentials or unrestricted commercial notes are needed.

All amounts are safe integer minor units at the supplied scale, not floating
currency values. Null quantities and null decision owners remain unresolved.
Sources with wrong scope, stale revisions, unresolved state, future captures,
duplicate records or unknown identities block calculations for the whole cycle.
The record embeds complete supplied input even when all derived totals are null.
Stable event, original, reversal and payout identities must survive re-export;
never mint new identities to hide duplicates.

## Plan and credit calculation

Plans are exact versions with inclusive effective start and exclusive end.
One applicable plan per payee: overlapping versions are conflicts. Plan evidence
must precede credit decisions. Supply opening attainment for the exact plan at
the cycle start, backed by evidence at or before that start. Opening attainment
already includes all earlier activity in its named attainment period; do not
repeat those events in this cycle. Missing opening is not zero.

Each event has explicit owner-approved split amounts. They must sum exactly to
the event amount, once per event/payee; rounding a percentage split is not part
of this engine. An owner must supply the exact minor-unit partition. Current
credit decision time cannot precede the event. Unsupported or disputed credit
does not disappear from coverage and cannot be reassigned by the Claw.

Supported mechanics: flat rate (one unbounded tier), or marginal tiers with
strictly increasing positive upper thresholds and one final unbounded tier.
Rates are integer basis points from zero to 10000. For each ordered credit,
intersect [opening, opening + credit) with each tier and calculate segment basis
times rate / 10000. Sum exact segment commissions, then round half-up once per
credit to a minor unit. Do not round each segment separately. Show every segment
and its unrounded amount. Closing attainment becomes the next event's opening.
The reference uses existing decimal.js 10.6.0 with 60-digit precision.

Plan changes during one attainment period that affect credited events in the
same cycle are blocked as unsupported transitions. Supply a separately reviewed
cycle/opening boundary rather than resetting attainment automatically. Draws,
caps, guarantees, retroactive whole-volume accelerators, FX, percentage split
rounding, proration, tax and statutory pay are not approximated. Mark unsupported
mechanics explicitly; do not relabel them as marginal tiers.

## Original-line reversals

An original is an owner-supplied historical commission line, not a newly
recalculated entitlement. Retain its exact original credit ID, plan ID/version,
payee, amount, stable identity and evidence. The supplied history at cycle start
must state cumulative prior monetary reversals and completeness. That aggregate
is an owner assertion, not an independently audited reversal-history ledger.
The original must predate this cycle; same-cycle reversal mechanics are outside
this bounded version. Never use current tier rates to reprice an original.

Require the explicit original policy `original-amount-no-attainment-rewind` and
an owner-recorded monetary reversal decision for each reversal. Reversals must
fall in the current cycle and target the same payee's exact original. Sum all
current reversals plus prior reversed amount; do not exceed original commission.
Keep partial and cumulative reversal lines separately with remaining balance.
These negative comparison amounts do not authorize a deduction, establish legal
recoverability or rewind attainment. A changed source means a new complete
assessment, not inherited clearance. Void/superseded/conflicting records remain
in the blocked input; no automatic winning-revision selection occurs.

## Payout comparison and output

Cover every proposed payout row with stable identity, payee, cycle, source and
signed amount. Every declared payee needs explicit payout evidence, including
zero where appropriate. Earned commission minus current monetary reversals is
the expected comparison amount. Difference = proposed minus expected, separately
per payee. Opposing residuals cannot clear each other. Payout differences block
readiness but preserve valid calculations; evidence failures make calculations
and expected totals unknown. Amounts exceeding the safe-integer range block.

Write `outputs/commission.json` as `{ "input": ..., "report": ... }` under
`schemas/commission.schema.json`. The semantic validator recomputes the entire
report from input; changed plans, sources, credit or owner decisions invalidate
old output. Render matching `outputs/sales-commission-review-preparer-handoff.md`
using `templates/commission.md`. Keep it private, including the embedded input.
A correctly blocked record is a valid artifact, never compensation clearance.

The repository helper is proof support, not a bundled execution capability.
Use authorized calculation support or an owner-supplied verified workpaper; if
exact recomputation is unavailable, keep a working Markdown handoff marked
unverified rather than inventing a schema-valid result. No payroll release,
payment, deduction, plan design, entitlement decision, CRM mutation or employee
communication occurs. Optional Spreadsheet Analyst output does not replace
commission validation.

## Example and proof limits

Synthetic PAYEE-A starts at USD 9000 credited attainment. E1 contributes USD
2000: USD 1000 at 5% produces USD 50; USD 1000 at 10% produces USD 100. The separate
OLD1 commission of USD 80 is reversed once, leaving expected USD 70, matching the
supplied proposed payout. No money moved. The blocked companion omits the credit
decision owner while retaining all source rows and unknown derived amounts.

Focused schema, semantic and renderer tests are local deterministic proof only.
They do not prove genuine approvals, complete source exports, human entitlement,
installed execution, live model quality, privacy filtering or payroll correctness.
The screenshot renders the synthetic session fixture in the real OpenClaw
Control UI at revision 917df0d36d3abc2aa4d019553246e651afd91085 and was visually
inspected. It is rendered-fixture proof, not live-model or installed execution
proof. Full package checks and independent review remain separate release gates.
