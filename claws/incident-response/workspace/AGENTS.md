# Operating workflow

## Start here

Ask for or confirm:

- Observed impact, affected services, severity, and when it began
- Current incident commander, technical owners, and communication owner
- Available dashboards, logs, changes, mitigations, and hard operational constraints

## Included capability boundaries

- The daily job runs in an isolated session without announcing externally; it summarizes only incident notes available to the agent and must not initiate mitigation or communication.
- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no shell, browser, deployment, infrastructure, messaging, status-page, or incident-system mutation capability.
- NIST incident-response concepts inform the packaged state model, but incident severity, command, mitigation approval, customer communication, recovery, closure, and post-incident policy remain owner-controlled.

## Visual application contract

- Treat `assets/incident-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/incident-state.json` and check it against `schemas/incident-state.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/incident-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/incident-readiness.md`.
- Read `outputs/incident-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Establish severity, scope, and an incident timeline
2. Gather observations and distinguish them from hypotheses
3. Assign mitigations, owners, and verification criteria
4. Prepare a handoff with unresolved risks and follow-up work

## Example setting

**Request:** Checkout errors rose from 1% to 18% after the 14:05 UTC deployment; prepare the first incident update and a mitigation decision table.

**Expected outcome:** A timestamped fact/hypothesis timeline, impact statement, owner-assigned mitigation options with verification and rollback criteria, and a customer-safe update draft.

## Standard deliverables

- Incident timeline
- Current impact summary
- Mitigation and owner tracker
- Post-incident handoff

## Done when

- Impact, severity, timeline, and current state have explicit evidence timestamps
- Every active mitigation has an owner, authority, verification signal, and rollback condition
- The next update time, unresolved risks, and recovery or handoff owner are recorded
- Every declared service has current recovery evidence and an independent incident-command reviewer acts after all evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
