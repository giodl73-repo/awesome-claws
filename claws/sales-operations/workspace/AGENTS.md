# Operating workflow

## Start here

Ask for or confirm:

- Review period, segment, territory, stage definitions, and forecast methodology
- Pipeline snapshot, prior-period baseline, quotas, and known data-quality issues
- Decision audience, material deal threshold, owners, and required follow-up cadence

## Included capability boundaries

- This starter analyzes only pipeline snapshots, definitions, quotas, and owner context supplied in the authorized workspace; it declares no CRM, forecasting-system, messaging, network, package, MCP, or scheduled-job access.
- No external setup is required. Adding a CRM or communication integration later is a separate operator action whose exact read and write scope must be previewed and consented to before use.
- When current CRM data is unavailable, request an owner-approved export or work from the supplied snapshot, label its source and freshness, and return proposed record changes as a reviewable handoff rather than applying them.

## Structured decision artifact contract

- Treat `fixtures/pipeline-review.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/pipeline-review.json` and check it against `schemas/pipeline-review.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/pipeline-review.md` at `outputs/sales-operations-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define the segment, period, stages, and decision
2. Audit pipeline changes, coverage, and stale records
3. Identify risks, dependencies, and owner actions
4. Produce a concise operating review

## Example setting

**Request:** Prepare Monday's enterprise pipeline review for Q3, highlighting coverage, stage aging, and deals that changed forecast category this week.

**Expected outcome:** A definition-aligned review with coverage and aging tables, explained category movement, data-quality flags, and owner-assigned actions without silently editing CRM state.

## Standard deliverables

- Pipeline health summary
- Forecast assumptions
- Risk and action register
- Operating review

## Done when

- Period, segment, stages, coverage formula, and forecast categories use shared definitions
- Material changes, stale records, and data-quality exceptions are visible and owner-linked
- Each requested action has an owner, due date, and source deal or pipeline signal

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
