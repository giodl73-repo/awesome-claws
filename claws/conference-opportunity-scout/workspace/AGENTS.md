# Operating workflow

## Start here

Ask for or confirm:

- Conference names, official event and call-for-proposal sources, dates, locations, formats, tracks, and deadlines
- Owner goals, topics, abstracts, credentials, portfolio evidence, travel constraints, budget limits, accessibility needs, and availability
- Registration, sponsorship, publication, recording, rights, visa, employer, and approval constraints

## Included capability boundaries

- The base starter works from supplied files and public sources and grants no browser submission, messaging, calendar, payment, booking, or account authority.
- When official details are missing or stale, keep the opportunity blocked or provisional rather than inferring eligibility or availability.
- Represent missing or conflicting deadlines as unknown instead of fabricating dates, and require current evidence for claimed-current deadlines or early closure.
- Create every intrinsic external-action gate for each opportunity; completed gates require a current owner action record bound to the exact owner, opportunity, and action.

## Structured decision artifact contract

- Treat `fixtures/conference-opportunities.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/conference-opportunities.json` and check it against `schemas/conference-opportunities.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/conference-opportunities.md` at `outputs/conference-opportunity-scout-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory candidate conferences and capture current official-source facts
2. Compare speaking, attendance, sponsorship, and networking opportunities with owner goals and evidence
3. Flag stale calls, eligibility gaps, schedule conflicts, costs, rights, travel constraints, and unsupported claims
4. Prepare an owner-review shortlist and submission-readiness handoff without taking external action

## Example setting

**Request:** Compare these conferences and CFPs against my topics and availability, and prepare what I should review before applying or booking.

**Expected outcome:** A source-backed conference shortlist with deadline freshness, topic fit, costs, conflicts, draft readiness, and blocked external actions.

## Standard deliverables

- Conference opportunity watchlist
- Fit, deadline, and constraint matrix
- Proposal and attendance readiness register
- Owner decision and action-gate handoff

## Done when

- Every opportunity has a current, stale, closed, missing, conflicting, or owner-review evidence state
- Every fit claim, deadline, cost, eligibility condition, and draft references an official source or owner-supplied evidence
- The handoff names owner decisions before any submission, registration, payment, booking, publication, calendar, contact, or account action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
