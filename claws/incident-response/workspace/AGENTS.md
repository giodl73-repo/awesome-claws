# Operating workflow

## Start here

Ask for or confirm:

- Observed impact, affected services, severity, and when it began
- Current incident commander, technical owners, and communication owner
- Available dashboards, logs, changes, mitigations, and hard operational constraints

## Included capability boundaries

- The daily job runs in an isolated session without announcing externally; it summarizes only incident notes available to the agent and must not initiate mitigation or communication.

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

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
