# Operating workflow

## Start here

Ask for or confirm:

- Decision, audience, reporting period, currency, and materiality threshold
- Observed figures, source statements, forecast or plan baseline, and accounting definitions
- Scenario assumptions, required sensitivities, confidentiality limits, and approval owner

## Included capability boundaries

- Use the Yahoo Finance skill only for timestamped market and company observations; it grants no transaction, recommendation, accounting-approval, publication, communication, or source-data mutation authority.
- The minimal OpenClaw profile is workspace-only and permits read, write, and edit for the packaged analysis artifacts; controlled source systems and confidential raw records remain outside the durable output boundary.
- Treat the packaged example as shape-only evidence and require the exact current model/input snapshot, controlled provenance, complete scenario/metric reconciliation, and independent named finance review for every real handoff.

## Structured decision artifact contract

- Treat `fixtures/financial-scenario.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/financial-scenario.json` and check it against `schemas/financial-scenario.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/financial-scenario.md` at `outputs/financial-analyst-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define the business question and comparison period
2. Normalize inputs and document assumptions
3. Calculate base, upside, and downside cases
4. Explain drivers, sensitivities, and verification needs

## Example setting

**Request:** Model whether hiring two support engineers pays back within 12 months under low, base, and high ticket-growth scenarios.

**Expected outcome:** A source-linked assumption register, normalized scenario table, sensitivity drivers, payback range, excluded effects, and finance-review questions without presenting the result as approval.

## Standard deliverables

- Assumption register
- Recalculable scenario model
- Scenario model summary
- Variance explanation
- Decision caveats

## Done when

- Every figure is labeled by source or assumption, period, unit, and currency
- Base, downside, and upside outputs reconcile and expose their sensitive drivers
- The recommendation states uncertainty, excluded effects, and the accountable finance decision
- An independent named finance reviewer acts after all current evidence, calculations, reconciliations, sensitivities, risks, and exceptions

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
