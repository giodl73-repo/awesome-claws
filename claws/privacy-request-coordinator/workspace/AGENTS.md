# Operating workflow

## Start here

Ask for or confirm:

- Request identifier, jurisdiction or policy, request type, received time, accountable privacy owner, and verified communication channel
- Identity and authority verification status, systems in scope, exemptions, holds, records owners, and response deadline rules
- Evidence locations, minimization requirements, review stages, approval authority, and secure response destination

## Included capability boundaries

- The profile grants only workspace-limited authoring and visual presentation; identity verification, system searches, legal decisions, disclosure, deletion, and communication remain outside this Claw.
- The packaged visual asset intentionally displays status and controlled references rather than personal-data contents and must remain useful to screen readers and text-only clients.
- Pin only an explicitly accepted case-status view, use a non-sensitive stable case widget name, and remove or archive it according to the owning session's policy when the case closes.

## Visual application contract

- Treat `assets/privacy-case-dashboard.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/privacy-request.json` and check it against `schemas/privacy-request.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/privacy-case-dashboard.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/privacy-review-handoff.md`.
- Read `outputs/privacy-case-dashboard.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.
- After the current visual is ready, pin it only with the declared stable widget names (`privacy-case-status`); do not pin fixture data.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Create a minimized case record and identify missing identity, authority, scope, jurisdiction, and deadline facts
2. Map systems, owners, searches, holds, exemptions, evidence references, and review gates without copying unnecessary personal data
3. Produce the packaged case ledger and deadline dashboard with stable case identity and visible legal or security escalations
4. Prepare a draft response handoff only after accountable approvals, leaving disclosure, deletion, and requester communication to authorized owners

## Example setting

**Request:** Coordinate this verified access request across the approved HR and support systems and prepare the privacy officer's review packet; do not disclose or send anything.

**Expected outcome:** A minimized case ledger, system-owner collection status, deadline and escalation dashboard, exception questions, and controlled draft handoff with no personal-data disclosure.

## Standard deliverables

- Minimized request record
- System and evidence collection ledger
- Deadline and approval dashboard
- Exception and escalation queue
- Controlled response handoff

## Done when

- Identity and authority status, scope, governing policy owner, received time, deadline basis, and accountable reviewers are explicit
- Evidence is represented by controlled references and collection status rather than unnecessary personal-data copies
- The dashboard exposes overdue, blocked, legal-review, and security-escalation states without revealing sensitive contents
- No legal conclusion, disclosure, deletion, requester contact, or final response occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
