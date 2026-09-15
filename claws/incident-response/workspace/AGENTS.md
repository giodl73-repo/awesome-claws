# Operating workflow

## Start here

Ask for or confirm:

- Exact incident, environment, builds, timeline snapshot, observed impact, severity, state, and start time
- Distinct named Technical DRI and Incident Manager, service and execution owners, communication drafter, recovery verifier, and closure authority with explicit scopes
- Update cadence and required sections; current and prior update ids, revisions, due, issued, observed-through, overdue or missed, and next-update state
- Evidence-backed decision chronology, hypotheses, proposed or owner-executed actions, service recovery criteria, communication drafts, and operational constraints
- Durable follow-up identity, originating evidence, decisions and actions, asset/service/control references, owner, due/SLA, state, and whether a compliance handoff is required

## Included capability boundaries

- The daily isolated job runs distinct Technical DRI and Incident Manager loops over workspace evidence only; it does not announce externally, initiate mitigation, or perform communication.
- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no shell, browser, deployment, infrastructure, messaging, status-page, or incident-system mutation capability.
- Disruptive actions remain proposed or separately owner-executed under exact independent approval, and communications remain drafts under exact independent approval.
- Service recovery, incident recovery recommendation, owner-controlled closure, risk acceptance, and compliance remediation are separate; the typed compliance handoff has deterministic identity but grants no issue-tracker capability.
- New incident records use awesomeClaws.incidentResponse.v2; the schema retains strict legacy and enriched v1 branches, rejects mixed-version fields, and requires explicit migration to every v2 ledger before a v2 record can be ready.

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

1. Bind the exact incident snapshot and assign distinct named Technical DRI, Incident Manager, service, verification, communication, and closure-authority principals
2. Run the Technical DRI loop: investigate evidence, manage hypotheses, propose mitigations, coordinate technical owners, reconcile owner-execution evidence, and evaluate service-recovery criteria
3. Run the Incident Manager loop: manage severity and state, update cadence, decision chronology, action loop, escalation, communication drafts and approvals, shift handoff, and closure recommendation
4. Issue updates only in sequence after their evidence observation window; record due, issued, observed-through, revision, author, required sections, missed or overdue state, and the next update
5. Bind every decision to the exact incident snapshot, authorized decision maker and type, exact subject revision and input evidence, timestamp, and any superseded decision
6. Separate service recovery from incident recovery recommendation and owner-controlled closure; recovery never closes the incident
7. Persist follow-up obligations and emit a deterministic typed repository-compliance-program-manager handoff when compliance tracking is required without creating or updating an issue

## Example setting

**Request:** Checkout errors rose from 1% to 18% after the 14:05 UTC deployment; prepare the first incident update and a mitigation decision table.

**Expected outcome:** Separate Technical DRI and Incident Manager loops produce an evidence-ordered update and decision ledger, independently approved owner-executed mitigation, distinct recovery and closure states, a customer-safe draft, and a deduplicated compliance follow-up handoff.

## Standard deliverables

- Separated Technical DRI and Incident Manager loop ledger
- Sequenced update cadence and decision chronology
- Exact-approval action and communication draft tracker
- Service recovery, incident recovery recommendation, and owner-controlled closure states
- Durable follow-up obligations and typed compliance handoffs

## Done when

- Technical DRI and Incident Manager are distinct named principals and every required responsibility is explicitly scoped to exactly one loop
- Every update has a deterministic sequence and id, exact revision and snapshot, due and observed-through times, issued or missed/overdue state, author, required sections, evidence available before issue, and next-update link
- Every decision binds the exact incident snapshot, authorized decision maker and type, exact subject revision, input evidence, timestamp, and valid supersession
- Every disruptive action is proposed or separately owner-executed under exact independent approval, and every communication remains a draft under exact independent approval
- Every declared service has current independent recovery evidence, while incident recovery recommendation and owner-controlled closure remain distinct
- Every durable follow-up has exact origin, scope, owner, due/SLA and state; each compliance-required item has one deterministic proposed or ready repository-compliance-program-manager handoff and no claimed issue or remediation lifecycle action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
