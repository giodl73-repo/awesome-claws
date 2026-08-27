# Operating workflow

## Start here

Ask for or confirm:

- Approved income forms, wage statements, contractor forms, interest and dividend forms, brokerage statements, mortgage statements, tuition forms, charitable receipts, medical expense records, property tax statements, business expense logs, prior-year checklists, preparer notes, and owner notes
- Tax year, owner labels, document types, issuer names, received dates, source references, privacy labels, freshness state, missing-item expectations, and preparer-review scope
- Deadline reminders, extension questions, estimated-payment records, refund or payment questions, household/dependent document boundaries, and stale-source fallback rules
- External actions that must remain draft-only, including filing, payment, refund requests, tax-preparer contact, employer or institution contact, uploads, calendar edits, account changes, and tax/legal conclusions

## Included capability boundaries

- The base starter uses supplied or approved tax documents, statements, receipts, checklists, preparer notes, and owner notes and grants no tax-preparation, filing, payment, refund, contact, upload, account, calendar, legal, financial, or tax-advice authority.
- When document, issuer, tax year, income, deduction, statement, receipt, deadline, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner or preparer review questions rather than presenting tax certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/tax-document.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/tax-document.json` and check it against `schemas/tax-document.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/tax-document.md` at `outputs/tax-document-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each supplied document, issuer, tax year, owner, source, category, evidence state, deadline, missing item, and review question to source identity and freshness state
2. Collect income, deduction, statement, receipt, prior-year, preparer-note, and owner-note evidence from supplied or approved sources only
3. Reconcile missing forms, conflicting issuer records, stale statements, unsupported deduction labels, privacy-sensitive identity data, and preparer-only questions
4. Group documents by tax year, owner, category, source authority, privacy sensitivity, missing-item status, deadline relevance, and preparer-review need
5. Prepare a reviewable tax document packet with evidence, gaps, privacy notes, blocked actions, and owner or preparer questions

## Example setting

**Request:** Organize the tax documents I supplied for this year's prep folder. Group wage, contractor, interest, mortgage, charitable receipt, and business expense records; show missing or conflicting items and questions for my preparer, but do not prepare the return, give tax advice, contact anyone, upload documents, pay anything, or edit my calendar.

**Expected outcome:** A source-backed tax document packet with document, issuer, tax-year, category, freshness, privacy, missing-item, conflict, deadline, and preparer-review evidence; and all filing, advice, payment, contact, upload, account-change, calendar, and disclosure actions blocked.

## Standard deliverables

- Tax-year document ledger
- Income, deduction, statement, and receipt evidence register
- Missing-item and conflict checklist
- Deadline and preparer-review question list
- Blocked filing, advice, payment, contact, upload, account-change, calendar, and disclosure handoff

## Done when

- Every document, issuer, tax year, category, owner, source, received date, deadline, missing item, and preparer question has source identity, freshness, and privacy labeling
- Every packet conclusion traces to explicit supplied forms, statements, receipts, prior-year checklists, preparer notes, or owner notes without hiding gaps
- SSNs, tax IDs, addresses, employer details, account numbers, income amounts, medical records, dependent details, and preparer communications are minimized or blocked from inappropriate outputs
- Tax advice, legal advice, filing, amendments, signatures, payments, refunds, institution contact, preparer contact, uploads, account changes, calendar edits, and sensitive disclosure remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
