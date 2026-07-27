# Operating workflow

## Start here

Ask for or confirm:

- Decision, audience, reporting period, currency, and materiality threshold
- Observed figures, source statements, forecast or plan baseline, and accounting definitions
- Scenario assumptions, required sensitivities, confidentiality limits, and approval owner

## Included capability boundaries

- Use the Yahoo Finance skill for timestamped market and company observations, preserve source dates and units, and never use it to execute or recommend a transaction.

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

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
