# Operating workflow

## Start here

Ask for or confirm:

- Approved activity rosters, coach notes, team apps, camp emails, club calendars, lesson schedules, waiver links, fee notices, equipment lists, location pages, and guardian notes
- Child-safe labels, activity preferences, recurring schedule constraints, transportation limits, equipment ownership, fee review rules, carpool/helper permissions, and privacy labels
- Existing commitments, blocked dates, custody or pickup constraints supplied by the guardian, emergency-contact rules, and stale-source fallback rules
- External actions that must remain draft-only, including registration, payment, organizer contact, coach/parent messages, calendar edits, ride arrangements, waiver signatures, location sharing, and child-detail disclosure

## Included capability boundaries

- The base starter uses supplied or approved activity rosters, team-app screenshots, coach notes, club/camp calendars, fee notices, waiver links, equipment lists, location pages, and guardian preferences and grants no registration, payment, messaging, calendar, ride, waiver, location-sharing, or disclosure authority.
- When schedule, fee, registration, waiver, equipment, transportation, helper permission, source, privacy, safety, health, eligibility, custody, or location evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask guardian-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/activity-logistics.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/activity-logistics.json` and check it against `schemas/activity-logistics.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/activity-logistics.md` at `outputs/child-activity-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each activity, session, source, child label, location, equipment item, fee, waiver, transportation option, helper role, and guardian decision to supplied evidence and freshness state
2. Collect roster, team-app, coach-note, calendar, camp-email, fee, equipment, waiver, location, and guardian-note evidence from supplied or approved sources only
3. Reconcile stale schedules, missing waiver or fee evidence, equipment gaps, overlapping sessions, transportation conflicts, helper-scope gaps, and privacy-sensitive details
4. Group activity logistics by guardian action, child-safe next step, source freshness, privacy label, conflict state, and blocked external-action requirement
5. Prepare a reviewable activity logistics ledger with evidence, gaps, privacy notes, blocked actions, and guardian questions

## Example setting

**Request:** Organize the kids' soccer, swim lesson, and summer camp logistics from these emails, team-app screenshots, fee notices, and equipment lists. Show schedule conflicts, gear gaps, fees, carpools, and what I need to review, but do not register, pay, message anyone, share locations, sign waivers, edit calendars, or commit a pickup.

**Expected outcome:** A source-backed activity logistics ledger with sessions, registration and fee evidence, equipment gaps, location and transportation notes, carpool/helper approval state, guardian review questions, and all registration, payment, contact, ride, pickup, calendar, waiver, and disclosure actions blocked.

## Standard deliverables

- Child-safe activity roster and session schedule
- Registration, waiver, fee, equipment, and location evidence register
- Transportation, carpool, helper-scope, and conflict view
- Guardian-review questions and child-privacy notes
- Blocked registration, payment, contact, ride, pickup, calendar, waiver, and disclosure handoff

## Done when

- Every activity, session, source, location, fee, waiver, equipment item, helper, transportation option, conflict, and guardian question has source identity, freshness, and privacy labeling
- Every recommended activity item traces to explicit schedule, location, fee, equipment, transportation, guardian, privacy, and source-freshness evidence without hiding gaps
- Child identifiers, addresses, team or school details, medical notes, family routines, custody constraints, and transportation plans are minimized or blocked from inappropriate outputs
- Registration, payment, coach or parent contact, organizer contact, ride arrangements, pickup/drop-off commitments, calendar edits, waiver signatures, location sharing, and medical/legal/custody/eligibility decisions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
