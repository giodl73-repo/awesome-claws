# Operating workflow

## Start here

Ask for or confirm:

- Applicant owner, authorized guardian or adviser roles, application cycle, privacy ceiling, controlled destination, and escalation path
- Institution, school, program, degree, round, deadline, requirement, fee, interview, portfolio, and financial-aid information from exact supplied sources
- Applicant material revisions, transcripts, test records, activity records, recommendations, waivers, submission receipts, portal observations, official decisions, and enrollment deadlines
- Missing, stale, conflicting, sensitive, applicant-authorship, third-party, submission, receipt, decision, and next-owner gaps

## Included capability boundaries

- The base starter reads only owner-supplied minimized files and controlled references and writes a private local portfolio; it grants no institution, school, testing-service, recommender, counselor, aid, portal, messaging, browser, upload, calendar, payment, or account capability.
- Treat requirements, deadlines, transcripts, tests, recommendations, receipts, portal observations, aid records, and decisions as exact attributed evidence rather than permission, prediction, or advice.
- Keep every essay or statement change, contact, recommendation request, submission, upload, interview booking, fee or deposit payment, certification, offer response, and enrollment commitment controlled by the applicant and relevant human authority.

## Structured decision artifact contract

- Treat `fixtures/college-application-portfolio.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/college-application-portfolio.json` and check it against `schemas/college-application-portfolio.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/college-application-portfolio.md` at `outputs/college-application-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm applicant ownership, authorized helper scope, privacy, application cycle, institution and program identity, and external-action boundaries
2. Version institution, program, application-round, requirement, deadline, fee, interview, portfolio, aid, and decision sources without interpreting eligibility or likelihood
3. Inventory every program requirement and map it to exact applicant, school, testing-service, recommender, counselor, or institution evidence
4. Track applicant-controlled material revisions separately from third-party transcripts, tests, recommendations, and official records while preserving authorship
5. Reconcile proposed, prepared, requested, received, submitted, independently receipted, incomplete, withdrawn, decided, and enrollment-response states without taking external action
6. Validate program and cycle scope, source currency, chronology, requirement coverage, material revision identity, third-party independence, submission receipts, official decision provenance, privacy minimization, and blocker equality
7. Prepare a blocked or applicant-review-ready portfolio that exposes every deadline, material, recommendation, transcript, test, interview, fee, aid, submission, decision, and enrollment-response gap without ranking institutions or deciding what the applicant should do

## Example setting

**Request:** Reconcile the six college applications, program requirements, essay drafts, transcript and test records, recommendation requests, interview notices, fee-waiver records, submission receipts, portal updates, aid-form dependencies, and decisions I supplied for this application cycle. Show exact deadlines, current material revisions, missing third-party records, unreceipted submissions, conflicting portal state, and who must act next. Do not write my essays, contact anyone, submit or upload anything, schedule, pay, certify, predict admission or aid, accept or decline an offer, or commit enrollment.

**Expected outcome:** A private institution- and program-bound application portfolio reconciles exact requirements, applicant-authored revisions, third-party records, submissions, receipts, decisions, and unresolved dependencies into an applicant-controlled review handoff without authorship substitution, external action, prediction, advice, or enrollment commitment.

## Standard deliverables

- Private institution, program, round, requirement, deadline, fee, and source-revision register
- Applicant-material revision, transcript, test-record, recommendation, interview, portfolio, and financial-aid dependency ledger
- Application submission, independent receipt, portal observation, official decision, and enrollment-response register
- Missing-evidence, privacy, authorship, conflict, blocker, question, and next-owner register
- Blocked or applicant-review-ready higher-education application portfolio handoff

## Done when

- Every in-scope institution, program, round, requirement, deadline, material revision, transcript, test record, recommendation, interview, fee, aid dependency, submission, receipt, portal observation, decision, enrollment response, gap, and next owner is represented exactly once with complete provenance
- Every requirement and status follows current exact-program and exact-cycle evidence, and every claimed submission or third-party delivery has an independent same-application receipt where applicable
- Every stale, conflicting, missing, sensitive, authorship, eligibility, aid, transfer-credit, prediction, or official-decision state remains visible and routes to the applicant or a named qualified human
- All writing, contact, submission, upload, scheduling, payment, certification, account, offer-response, deposit, and enrollment actions remain blocked or applicant-controlled, and the handoff exactly mirrors unresolved state

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
