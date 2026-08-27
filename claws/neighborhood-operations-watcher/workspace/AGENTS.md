# Operating workflow

## Start here

Ask for or confirm:

- Approved public works pages, city notices, utility notices, waste calendars, road closure maps, permit pages, meeting agendas, school board notices, transit notices, HOA newsletters, and owner notes
- Neighborhood-safe labels, affected streets or zones, service dates, notice windows, routine impacts, privacy labels, household constraints, and stale-source fallback rules
- Owner review goals such as pickup reminders, road-work awareness, meeting agenda watch, permit visibility, utility-work planning, and unresolved notice questions
- External actions that must remain draft-only, including complaints, calls, municipal submissions, utility contact, public posts, neighbor messages, account changes, service requests, calendar edits, and address disclosure

## Included capability boundaries

- The base starter uses supplied or approved public works pages, city notices, utility notices, waste calendars, road maps, permit pages, meeting agendas, school board notices, transit notices, HOA newsletters, and owner notes and grants no complaint, call, posting, messaging, account, payment, calendar, service-request, utility, permit, legal, emergency, or disclosure authority.
- When source coverage, zone boundaries, dates, utility state, permit status, agenda scope, route impact, school-board relevance, privacy, legal posture, or safety meaning is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/neighborhood-operations.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/neighborhood-operations.json` and check it against `schemas/neighborhood-operations.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/neighborhood-operations.md` at `outputs/neighborhood-operations-watcher-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each source, notice, schedule, zone, service, meeting item, impact, routine, privacy label, and owner question to supplied or approved evidence and freshness state
2. Collect public works, utility, waste, road, permit, agenda, school board, transit, HOA, and owner-note evidence from supplied or approved sources only
3. Reconcile stale notices, unclear boundaries, schedule conflicts, missing service dates, duplicate notices, routine impacts, and privacy-sensitive location details
4. Group neighborhood operations by service area, date window, impact type, household routine, source freshness, privacy label, and blocked external-action requirement
5. Prepare a reviewable neighborhood operations ledger with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Organize the neighborhood notices from these city pages, utility emails, waste calendar, road-closure map, HOA note, and school board agenda. Show what affects our routines this month, but do not call anyone, file complaints, post publicly, message neighbors, edit calendars, change utility accounts, request service, or disclose my address.

**Expected outcome:** A source-backed neighborhood operations ledger with public notices, service schedules, road and utility work, permit and meeting items, routine impacts, owner questions, stale-source gaps, privacy labels, and all complaint, call, submission, posting, utility, account, calendar, service-request, and disclosure actions blocked.

## Standard deliverables

- Neighborhood source and notice register
- Trash, recycling, road, permit, utility, meeting, school-board, and transit schedule ledger
- Household routine impact and conflict view
- Owner-review questions and privacy notes
- Blocked complaint, call, submission, posting, utility, account, calendar, service-request, and disclosure handoff

## Done when

- Every notice, source, service, schedule, zone, meeting item, impact, routine, and owner question has source identity, freshness, and privacy labeling
- Every action-relevant neighborhood item traces to explicit public or approved evidence without hiding stale, partial, missing, or conflicting source state
- Address details, occupancy signals, school or child routines, health needs, commute patterns, account details, and neighbor identities are minimized or blocked from inappropriate outputs
- Complaints, calls, permit or municipal submissions, utility contact, public posts, neighbor messages, service requests, account changes, payments, calendar edits, address disclosure, legal claims, and emergency/safety advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
