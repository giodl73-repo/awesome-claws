# Operating workflow

## Start here

Ask for or confirm:

- Exact contract, billing period, application revision, currency precision, human reviewer, as-of instant and private destination
- Complete owner-approved schedule of values and change ledger with stable line identities, current revisions, approvals and pending or rejected changes
- Source-linked cumulative installed value, eligible stored-material lots and explicit stored-to-installed transfers; owner-supplied eligibility and duplicate-coverage assertions
- Complete previous-period application and certificate history, corrections, separate cash-receipt references, and line-specific worked/stored retainage and rounding instructions
- Owner-supplied document checklist and exact permitted attachment revisions; legal sufficiency, waiver decisions and certification stay with authorized humans

## Included capability boundaries

- Start as X3 using supplied records and an original review artifact, without an external integration or execution capability.
- Legal waiver review, construction certification, statutory invoicing, revenue recognition and external accounting actions remain separate human workflows.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Reconcile the owner-confirmed line universe, period chain, source snapshots and current approved changes without selecting a convenient conflicting revision
2. Track every stored lot through supplied opening, additions, transfers and closing evidence without counting transferred value twice
3. Recompute cumulative worked-plus-eligible-stored value, supplied retainage and proposed current entitlement by line; retain unknowns behind blockers
4. Subtract prior certified entitlement, not cash paid, while retaining historical corrections and the separate previously certified unpaid amount
5. Reconcile the supplied backup checklist, revisions and disclosure permissions; produce an original private application draft and detailed owner workpaper
6. Reopen affected calculations and review after any certificate, approved scope, stored-material, rule or attachment revision changes
7. Write current structured state to `outputs/progress-billing-review.json` and validate it against `schemas/progress-billing.schema.json`; follow `references/billing-contract.md` without treating example fixtures as current evidence.
8. Write the matching private owner workpaper at `outputs/progress-billing-review-preparer-handoff.md` using `templates/session-handoff.md`, and the original private application at `outputs/progress-billing-application.md`; preserve blockers and human review ownership.

## Example setting

**Request:** Review current cumulative installed value of USD 35,000 and eligible stored value of USD 5,000 against prior USD 20,000 installed and USD 10,000 stored. USD 5,000 moved from stored to installed. Apply the supplied 10% retainage rule and subtract USD 27,000 previously certified, not USD 20,000 cash paid. Include line B: USD 60,000 cumulative installed, 5% worked/stored retainage and USD 47,500 prior certified; keep the owner's complete prior-period snapshots.

**Expected outcome:** A private proposed current draft of USD 9,000 on A and USD 9,500 on B, totaling USD 18,500. USD 7,000 prior certified unpaid stays separate. An explicitly authorized replacement of A's prior certificate with USD 26,000 changes A to USD 10,000 and requires new review. Missing history, rules or attachment evidence blocks totals; no certification or submission occurs.

## Standard deliverables

- Original cumulative pay-application review draft by schedule-of-values line
- Stored-material movement and prior-certification reconciliation workpaper
- Approved and pending change register, retainage calculation and supplied attachment checklist
- Exact-revision owner handoff with unresolved questions and prohibited-action gates

## Done when

- Every supplied schedule line, change, stored lot, certificate and checklist item is covered once or explicitly blocked
- Period and revision continuity, exact arithmetic, stored-value conservation and prior-certification deductions are reconciled without cash-based double billing
- No calculation or readiness claim relies on inferred progress, eligibility, tax, retainage, approval or missing history
- Structured and Markdown drafts agree and remain private, unissued, unsubmitted and subject to the named human review

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
