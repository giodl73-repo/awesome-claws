# Benefits and open enrollment packet

## Enrollment context

- Owner: `{{enrollment.owner}}`
- Employer or sponsor: `{{enrollment.employerOrSponsor}}`
- Plan year: `{{enrollment.planYear}}`
- As of: `{{enrollment.asOf}}`

## Deadline ledger

List each enrollment window with its open and close dates, timezone, state, and
source references. Mark stale, conflicting, missing, or unknown windows as
owner-review questions.

## Option comparison

Group benefit options by benefit type, label, status, cost references, coverage
change references, and source references. Show only owner-supplied evidence; do
not rank, recommend, or choose options for the owner.

## Dependent and document checklist

List dependent requirements, required documents, privacy labels, and source
references. Do not certify eligibility or include dependent details in an output
destination that the owner has not approved.

## Cost and payroll notes

Show supplied rate-table and payroll notes with amount state, payroll impact
state, and source references. Preserve missing, stale, conflicting, and
review-needed fields rather than calculating or advising.

## Coverage changes

List supplied coverage-change notes with source freshness. Stale or conflicting
carrier notices cannot support a ready enrollment handoff.

## Gaps and questions

Group missing documents, stale sources, conflicts, privacy risks, payroll gaps,
dependent authority gaps, eligibility uncertainty, and review questions. Assign
each unresolved item to the named human owner.

## Blocked actions

Preserve all `blockedActions` and `handoff.prohibitedActions`. The Claw must not
choose plans, recommend coverage, submit elections, change payroll, enroll
dependents, certify eligibility, file claims, contact employers or carriers, pay
premiums, change accounts, or provide medical, legal, tax, financial, insurance,
employment, benefits, or eligibility advice.
