# Operating workflow

## Start here

Ask for or confirm:

- Approved school sources, assignment pages, LMS exports, teacher notes, school calendars, forms, supply lists, handbook snippets, email excerpts, portal screenshots, and guardian notes
- Student-safe task details, due dates, class labels, form requirements, supply needs, event times, parent review preferences, accommodation notes, and privacy labels
- Existing commitments, pickup/drop-off limits, blocked dates, recurring routines, school-contact rules, and stale-source fallback rules
- External actions that must remain draft-only, including form submission, teacher messages, school contact, payments, calendar edits, enrollment changes, attendance changes, and disclosure

## Included capability boundaries

- The base starter uses supplied or approved school pages, LMS exports, calendar entries, forms, supply lists, teacher notes, handbook snippets, portal screenshots, and guardian preferences and grants no school-account, form-submit, messaging, payment, calendar, enrollment, attendance, or disclosure authority.
- When due-date, assignment, form, supply, event, accommodation, attendance, grade, eligibility, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask guardian-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/school-logistics.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/school-logistics.json` and check it against `schemas/school-logistics.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/school-logistics.md` at `outputs/school-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each assignment, form, event, supply item, source, deadline, student context, accommodation note, and guardian decision to supplied evidence and freshness state
2. Collect LMS, calendar, form, teacher-note, supply-list, handbook, portal, and guardian-note evidence from supplied or approved sources only
3. Reconcile stale portals, missing forms, ambiguous due dates, conflicting teacher notes, unsupported accommodation claims, calendar conflicts, and sensitive student details
4. Group school tasks and deadlines by required guardian action, student-safe next step, source freshness, privacy label, and blocked external-action requirement
5. Prepare a reviewable school logistics ledger with evidence, gaps, privacy notes, blocked actions, and guardian questions

## Example setting

**Request:** Organize this week's school items from the portal export, teacher note, calendar, and supply list I supplied. Show assignments, forms, supplies, events, conflicts, and what I need to review, but do not submit anything, message the teacher, change the calendar, pay fees, or disclose student details.

**Expected outcome:** A source-backed school logistics ledger with assignments, forms, supplies, events, due dates, student-safe privacy labels, accommodation and conflict gaps, guardian review questions, and all form, message, payment, calendar, enrollment, attendance, and disclosure actions blocked.

## Standard deliverables

- Student-safe school task ledger
- Assignment, form, event, and supply deadline view
- Source freshness and privacy register
- Accommodation, conflict, and guardian-review questions
- Blocked form, message, payment, calendar, enrollment, attendance, and disclosure handoff

## Done when

- Every task, form, event, supply item, source, deadline, accommodation note, conflict, and guardian question has source identity, freshness, and privacy labeling
- Every recommended school item traces to explicit due-date, class, form, supply, event, guardian, privacy, and source-freshness evidence without hiding gaps
- Student identifiers, school details, addresses, class names, accommodation notes, family constraints, and teacher notes are minimized or blocked from inappropriate outputs
- Form submission, teacher or school contact, payments, calendar edits, enrollment changes, attendance changes, grade or eligibility conclusions, medical/legal/discipline decisions, and student-detail disclosure remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
