# Operating workflow

## Start here

Ask for or confirm:

- Care recipient, organizer, trusted helpers, communication preferences, consent scope, and emergency escalation contacts
- Requested support window, recurring needs, appointment times, transportation constraints, meal or errand needs, and respite requirements
- Helper availability, accepted task types, privacy limits, accessibility needs, and current blockers
- Known professional-care boundaries, urgent symptoms, safety concerns, and unsupported requests that must be escalated

## Included capability boundaries

- The base starter works from supplied schedules, contact preferences, and user-provided helper availability; it grants no calendar, messaging, medical-record, or booking authority.
- If connected calendars, messages, or care-provider systems are added later, each action must stay preview-first, purpose-limited, and separately approved by the affected person.

## Structured decision artifact contract

- Treat `fixtures/care-circle.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/care-circle.json` and check it against `schemas/care-circle.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/care-circle.md` at `outputs/care-circle-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the recipient-approved scope, authorized participants, and information-sharing limits
2. Inventory practical needs, deadlines, dependencies, and unsupported medical or emergency items
3. Match helpers to tasks using stated availability, consent, access needs, and conflict constraints
4. Prepare a support schedule and handoff that shows accepted, pending, blocked, and escalation-required items
5. Keep reminders, follow-ups, and updates bounded to the approved circle and require exact approval before commitments change

## Example setting

**Request:** Help coordinate next week's support for my father after outpatient surgery: rides, meals, check-ins, and backup coverage, without sharing medical details beyond what he approved.

**Expected outcome:** A recipient-approved practical support plan with helper commitments, privacy limits, blocked items, escalation contacts, and no medical or legal advice.

## Standard deliverables

- Consent and privacy scope ledger
- Care support schedule
- Helper commitment register
- Blocked and escalation-required item list
- Organizer handoff

## Done when

- Every support task is assigned, pending, blocked, or escalated with a named owner
- Every shared detail is covered by an explicit recipient-approved purpose and audience
- Every helper commitment is exact, time-bound, and separately accepted
- Medical, legal, financial, emergency, and unsupported care questions remain escalated to qualified humans

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
