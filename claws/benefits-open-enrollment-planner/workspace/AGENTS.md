# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied enrollment guide, plan comparison sheets, rate tables, payroll deduction notes, HSA/FSA notes, dependent document checklist, prior-year elections, life-event notes, employer notices, carrier notices, and owner constraints
- Enrollment dates, deadline timezone, decision owner, household/dependent scope, documents needed, plan option labels, cost fields as supplied, coverage-change notes, and privacy labels
- Review goals such as deadline readiness, missing documents, stale or conflicting plan evidence, dependent-authority questions, payroll-impact questions, and handoff notes for HR, benefits admins, tax preparers, or clinicians
- External actions that must remain draft-only, including enrollment submission, plan election, payroll changes, dependent changes, carrier contact, employer contact, claims, payments, account changes, and professional advice

## Included capability boundaries

- The base starter uses supplied benefits packets, plan summaries, rate tables, payroll notes, HSA/FSA notes, dependent checklists, prior elections, employer notices, carrier notices, and owner notes and grants no employer, benefits portal, carrier, payroll, calendar, messaging, payment, account, or claim authority.
- When benefits, enrollment, plan, rate, payroll, dependent, eligibility, privacy, medical, legal, tax, financial, insurance, employment, or source evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than choosing or submitting benefits.

## Structured decision artifact contract

- Treat `fixtures/benefits-enrollment.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/benefits-enrollment.json` and check it against `schemas/benefits-enrollment.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/benefits-enrollment.md` at `outputs/benefits-open-enrollment-planner-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each source, enrollment window, benefit option, dependent requirement, cost note, coverage-change item, evidence gap, and review question to supplied or approved evidence
2. Group options by benefit type, source authority, freshness, enrollment deadline, owner constraints, dependent scope, payroll impact, and blocked decision authority
3. Reconcile stale, missing, conflicting, partial, or sensitive benefits evidence without recommending coverage, certifying eligibility, or submitting changes
4. Prepare an owner-reviewed enrollment packet with deadlines, options, cost/source ledger, required-document checklist, coverage-change flags, and unresolved questions
5. Return a blocked-action handoff without submitting elections, changing payroll, contacting employers or carriers, filing claims, paying premiums, changing accounts, or giving professional advice

## Example setting

**Request:** Organize my open enrollment packet from the benefits guide, rate sheet, HSA note, prior elections, dependent checklist, and employer notice I supplied. Make the deadlines, options, payroll-impact notes, and questions clear, but do not choose a plan, submit elections, change payroll, certify eligibility, contact HR or carriers, pay anything, file claims, or give medical, tax, legal, financial, employment, or insurance advice.

**Expected outcome:** A source-backed open-enrollment packet with enrollment windows, plan option ledger, payroll-impact notes, dependent document checklist, stale/conflicting evidence questions, and all election, payroll, eligibility, claim, contact, payment, account, and professional-advice actions blocked.

## Standard deliverables

- Open enrollment deadline and source ledger
- Benefit option comparison packet
- Required dependent and document checklist
- Payroll-impact and coverage-change evidence register
- Missing, stale, conflicting, and sensitive evidence question list
- Blocked election, payroll, claim, contact, payment, account-change, eligibility, and advice handoff

## Done when

- Every enrollment window, option, dependent requirement, cost note, coverage-change item, source, privacy label, and review question has source identity, freshness, and owner-review state
- Every comparison or readiness claim traces to supplied or approved evidence without hiding stale, missing, conflicting, partial, sensitive, or dependent-person evidence
- Dependent details, health information, SSNs, salary data, payroll amounts, family status, account identifiers, addresses, and employer/carrier details are minimized or blocked from inappropriate outputs
- Plan choice, enrollment submission, payroll changes, dependent enrollment, eligibility certification, claims, payments, employer or carrier contact, account changes, and medical/legal/tax/financial/insurance/employment advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
