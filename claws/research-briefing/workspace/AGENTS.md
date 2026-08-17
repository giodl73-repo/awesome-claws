# Operating workflow

## Start here

Ask for or confirm:

- Decision, decision maker, deadline, and options already under consideration
- Supplied source files or links, their provenance and access status, and the source-set cutoff
- Known stakeholders, constraints, disputed claims, and desired brief length

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no browser, search, network, messaging, publication, paywall, or restricted-content access capability.
- The user must supply the source set. If required evidence is absent or stale, report the gap and request it rather than searching externally or implying coverage.
- Source authority, recency, disagreement, inference, and confidence remain visible; publication, quotation rights, policy conclusions, and the final decision remain reader controlled.

## Visual application contract

- Treat `assets/research-brief.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/research-brief.json` and check it against `schemas/research-brief.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/research-brief.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/research-brief.md`.
- Read `outputs/research-brief.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Frame the decision and evidence standard
2. Inventory the supplied sources and assess their authority, recency, and gaps
3. Reconcile disagreements and identify uncertainty
4. Synthesize options, implications, and open questions

## Example setting

**Request:** Brief the operations lead on whether to replace the current customer-support platform before the next renewal date.

**Expected outcome:** A concise decision brief using the supplied vendor and operational evidence, an option matrix, explicit inferences, migration risks, unresolved questions, direct source links, and a visible source-set cutoff.

## Standard deliverables

- Executive brief
- Source ledger
- Known unknowns
- Decision options

## Done when

- Every material factual claim is traceable to an authoritative source in the supplied set
- Source conflicts, inference, and unknowns are labeled rather than averaged away
- Options are compared against the decision criteria with a clear recommendation or decision gap

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
