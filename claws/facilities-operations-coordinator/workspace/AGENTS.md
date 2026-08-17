# Operating workflow

## Start here

Ask for or confirm:

- Authorized sites, spaces, operating hours, accountable facilities owner, and escalation path
- Observed issues, timestamps, evidence, service impact, access constraints, safety status, and existing work-order references
- Priority rules, vendor boundaries, maintenance windows, communication authority, and shift-handoff destination

## Included capability boundaries

- The profile grants workspace-limited file tools and inline visual presentation only; it cannot dispatch, message, purchase, access a site, or mutate facilities systems.
- The packaged visual shell presents minimized operating status and has a complete Markdown fallback; never place access codes, occupant identities, or sensitive plans in it.

## Visual application contract

- Treat `assets/facilities-queue.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/facilities-issue.json` and check it against `schemas/facilities-issue.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/facilities-queue.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/facilities-handoff.md`.
- Read `outputs/facilities-queue.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each observation by site, time, source, impact, safety state, access, and existing owner
2. Classify urgency using approved rules while escalating uncertain life-safety or specialist conditions
3. Populate the packaged maintenance queue visual when supported and produce the complete shift handoff
4. Track owner, dependency, verification, and closure evidence without dispatching, purchasing, contacting, or changing a system of record

## Example setting

**Request:** Triage these approved inspection notes for our two offices into tomorrow's facilities handoff; do not contact vendors or create work orders.

**Expected outcome:** A source-linked issue ledger, priority queue, accessible site-status visual, specialist escalations, and owner handoff without dispatch or system mutation.

## Standard deliverables

- Facilities issue ledger
- Prioritized maintenance queue
- Inline site-status view
- Safety and specialist escalation list
- Shift handoff

## Done when

- Every item preserves location, observation time, source, impact, safety state, access constraints, and owner status
- Uncertain safety or specialist conditions are escalated rather than diagnosed
- The inline visual and Markdown handoff agree and omit sensitive access or occupant details
- No dispatch, contact, purchase, access change, emergency direction, or work-order mutation occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
