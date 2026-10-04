# Operating workflow

## Start here

Ask for or confirm:

- Exact approved organization-plan revision, planning horizon, organization scope, and accountable plan owner
- Approved role demand, current funded headcount, position and funding snapshots, and source-effective dates
- Aggregate hiring and attrition scenario assumptions, capability taxonomy, succession coverage, location constraints, privacy classification, and decision calendar

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no HR-system, recruiting, messaging, compensation, personnel-action, reorganization, or approval authority.
- Keep durable artifacts aggregate or approved role-level, exclude employee identifiers and sensitive traits, preserve controlled evidence references, and stop with a blocked checkpoint when approved evidence is missing.
- The packaged X4 surface is a review projection of the same revision-bound reconciliation as the Markdown fallback; it cannot mutate source systems, communicate with employees, or convert scenarios into approved plans.

## Visual application contract

- Treat `assets/workforce-plan-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/workforce-plan-reconciliation.json` and check it against `schemas/workforce-plan-reconciliation.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/workforce-plan-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/workforce-plan-handoff.md`.
- Read `outputs/workforce-plan-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the exact plan revision, evidence scope, source dates, privacy classification, and decision authority
2. Reconcile approved role demand to funded headcount and positions by period, role, organization, and allowed location
3. Apply aggregate hiring and attrition scenarios while preserving assumptions, uncertainty, and unresolved data gaps
4. Assess aggregate capability gaps, succession coverage, and location constraints without individual performance or sensitive-trait inference
5. Assign owner actions and prepare explicit manager decision checkpoints without taking workforce actions or granting approval

## Example setting

**Request:** Reconcile approved organization plan OP-2027 revision 4 against Q1 funded positions and approved aggregate hiring and attrition assumptions for the Platform organization.

**Expected outcome:** A revision-bound X3 report and X4 visual showing funded role demand variances, aggregate scenarios, capability and succession gaps, location constraints, owned actions, and unresolved manager decisions without any personnel action or headcount approval.

## Standard deliverables

- Revision-bound workforce reconciliation ledger
- Aggregate hiring and attrition scenario comparison
- Capability, succession, and location constraint register
- Owner action register
- Manager decision checkpoint brief

## Done when

- Every demand line reconciles to the exact plan revision, funded position evidence, period, organization, role, and allowed location or is explicitly blocked
- Every scenario result preserves its hiring and attrition assumptions and is separated from approved baseline facts
- Every material capability, succession, location, funding, or privacy gap has an owner action or named decision checkpoint
- The handoff names decision owners and explicitly withholds personnel actions, reorganization, employee communication, HR-system mutation, and headcount approval

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
