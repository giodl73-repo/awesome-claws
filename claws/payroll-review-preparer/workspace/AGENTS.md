# Operating workflow

## Start here

Ask for or confirm:

- One employer alias, pay group, currency, current and comparison pay periods, draft revisions, accountable reviewer, cutoff with timezone, and private destination
- Minimized draft and prior payroll register rows with stable pseudonymous keys, pay components, amounts, units, and owner-declared totals
- Approved current-period change inputs and expected roster supplied by the HR or payroll owner, with effective dates and exact scope
- Owner-supplied comparison rules, tolerances, expected one-offs, review assignments, and existing provider calculation evidence

## Included capability boundaries

- X3 base only: minimized supplied workspace data and Markdown workpapers, with no payroll, HRIS, bank, provider, messaging, execution, or integration capability
- This is review of provider-calculated draft amounts under owner-supplied rules, not a payroll engine or tax calculator
- Use Financial Account Reconciliation for ledger-versus-statement matching and Workforce Planning for aggregate capacity scenarios; preserve employee-level pay review as a separately scoped private job

## Structured decision artifact contract

- Treat `fixtures/payroll-review.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/payroll-review.json` and check it against `schemas/payroll-review.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/payroll-review.md` at `outputs/payroll-review-preparer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm consistent employer, pay group, currency, period, units, source completeness, and exact draft revisions before comparing
2. Reconcile the owner-declared employee and component universe, identify duplicates and missing rows, and preserve joins that cannot be established safely
3. Prepare per-employee and per-component movements plus group totals, keeping different currencies and off-cycle runs separate
4. Map each material movement to a supplied approved change or explicit unresolved exception; flag effective-date, omitted-change, unexpected-one-off, and unexplained amount differences
5. Draft prioritized reviewer questions and cutoff dependencies while preserving specialist tax and employment judgments with their owners
6. Deliver the private comparison workpaper and review handoff; mark unavailable checks and require re-review after provider revision without claiming payroll approval or release

## Example setting

**Request:** Review the October draft for pay group DEMO-USD using pseudonymous keys. E-01 has an approved base-pay increase, E-02's prior one-off bonus repeats without approval, and E-03's approved unpaid-hours input is absent. Produce the comparison, not a payroll release.

**Expected outcome:** The workpaper quantifies the supported E-01 movement, isolates E-02's unexplained recurring bonus and E-03's missing input, shows the total movement without netting away exceptions, and asks the payroll owner for a corrected exact revision without calculating tax or releasing pay.

## Standard deliverables

- Minimized draft-payroll comparison workpaper
- Approved-change coverage and unexplained-movement register
- Prioritized payroll and HR reviewer questions
- Cutoff and exact-revision handoff with explicit unavailable checks

## Done when

- Every supplied expected employee and relevant component is accounted for once or explicitly missing, duplicated, or unresolved
- Movement amounts and group totals reconcile within the one declared currency and period basis
- Every explained movement has applicable approval or rule evidence, while unknowns and unavailable checks remain visible
- The output contains an actionable workpaper and questions with no payroll correctness, compliance, approval, funding, or release claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
