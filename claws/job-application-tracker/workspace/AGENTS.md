# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied job postings, company pages, recruiter messages, referral notes, resume versions, cover letter drafts, portfolio links, application receipts, interview invites, calendar notes, offer letters, salary notes, and owner constraints
- Application status, deadlines, contact labels, material freshness, role requirements, eligibility uncertainty, interview logistics, follow-up needs, privacy labels, and owner-review goals
- Review goals such as application pipeline, missing-material checklist, interview prep packet, follow-up draft review, offer-question list, and stale/conflicting status cleanup
- External actions that must remain blocked or draft-only, including submitting applications, uploading files, sending messages, scheduling interviews, changing accounts, accepting or rejecting offers, negotiating, and professional advice

## Included capability boundaries

- The base starter uses supplied job postings, company pages, recruiter notes, referral notes, resumes, cover letters, portfolio links, application receipts, interview invites, offer letters, salary notes, and owner notes and grants no job board, employer, messaging, calendar, account, upload, document-submission, or negotiation authority.
- When posting, material, contact, deadline, interview, offer, salary, eligibility, privacy, account, or source evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than submitting, messaging, fabricating, or advising.

## Structured decision artifact contract

- Treat `fixtures/job-application.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/job-application.json` and check it against `schemas/job-application.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/job-application.md` at `outputs/job-application-tracker-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each job, posting source, application material, status update, contact, interview, follow-up draft, offer item, evidence gap, and review question to supplied or approved evidence
2. Group applications by owner priority, role, company, deadline, status, material readiness, interview date, source freshness, privacy label, and blocked external action
3. Reconcile stale, missing, conflicting, partial, duplicate, sensitive, or eligibility-adjacent evidence without fabricating credentials or recommending career decisions
4. Prepare an owner-reviewed application pipeline with source ledger, materials checklist, interview prep notes, follow-up drafts, offer questions, and unresolved gaps
5. Return a blocked-action handoff without submitting applications, uploading files, sending messages, scheduling, changing accounts, accepting offers, negotiating, or giving professional advice

## Example setting

**Request:** Organize my job search from the postings, recruiter notes, resume drafts, portfolio links, interview invite, and offer questions I supplied. Track statuses, deadlines, missing materials, follow-up drafts, and interview prep, but do not apply, upload files, message anyone, schedule interviews, fabricate credentials, change accounts, accept or reject offers, negotiate, or give legal, immigration, tax, financial, employment, career, salary, benefits, or relocation advice.

**Expected outcome:** A source-backed job-application tracker with posting ledger, pipeline status, materials checklist, interview prep, follow-up and offer questions, stale/conflicting evidence gaps, and all submission, upload, messaging, scheduling, account, credential, offer, negotiation, and professional-advice actions blocked.

## Standard deliverables

- Job posting and application source ledger
- Application pipeline and deadline tracker
- Resume, cover letter, portfolio, and reference material checklist
- Interview logistics and prep packet
- Follow-up draft and offer-question review list
- Blocked submission, upload, message, scheduling, account, credential, offer, negotiation, and advice handoff

## Done when

- Every job, posting, material, contact, status, interview, follow-up draft, offer item, evidence gap, and review question has source identity, freshness, privacy scope, and owner-review state
- Every pipeline, deadline, material-readiness, interview, follow-up, or offer-question claim traces to supplied or approved evidence without hiding stale, missing, conflicting, partial, duplicate, sensitive, or eligibility-adjacent evidence
- Personal identifiers, salary notes, references, work authorization, recruiter details, account ids, portfolio drafts, employer names, and offer terms are minimized or blocked from inappropriate outputs
- Applications, uploads, messages, interview scheduling, account changes, credential assertions, offer acceptance or rejection, negotiation commitments, and legal/immigration/tax/financial/employment/career/salary/benefits/relocation advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
