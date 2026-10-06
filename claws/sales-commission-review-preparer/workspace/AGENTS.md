# Operating workflow

## Start here

Ask for or confirm:

- Employer alias, pseudonymous payees, review period, currency and scale, trusted as-of time, private destination and named compensation reviewer
- Versioned owner-supplied commission plans with effective periods, calculation basis, flat or marginal-tier rates, opening attainment and exact rounding rules
- Complete declared deal-event universe, event order, source revisions and amounts, plus separately supplied owner credit decisions and payee splits
- Proposed payout lines and owner-recorded reversal decisions linked to the exact original credit and commission lines

## Included capability boundaries

- Start as X3 with supplied minimized workspace records and a durable Markdown workpaper. No integration or execution authority is required.
- An XLSX export may use existing Spreadsheet Analyst but is not a substitute for the commission evidence contract.
- Write outputs/commission.json as input and recomputed report using schemas/commission.schema.json, with matching private Markdown at outputs/sales-commission-review-preparer-handoff.md. Follow references/commission-contract.md; repository calculation support is not an installed runtime tool.

## Structured decision artifact contract

- Treat `fixtures/commission.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/commission.json` and check it against `schemas/commission.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/commission.md` at `outputs/sales-commission-review-preparer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bind scope, source revisions, plan applicability and complete declared deal/payee populations before calculating
2. Reconcile owner credit allocations to each eligible deal event without creating or selecting credit decisions
3. Show credited basis, opening attainment, each marginal tier segment and calculated commission using explicit owner rules
4. Carry linked original-line reversals separately; compare proposed payout lines and preserve per-payee residuals
5. Prepare a private reviewer workpaper and blockers; invalidate old review after source, plan or credit revision changes

## Example setting

**Request:** Review a synthetic commission cycle with opening credited attainment of USD 9000, a USD 2000 credited event crossing a USD 10000 tier boundary, and a separate reversal of an original USD 80 commission line.

**Expected outcome:** With supplied marginal rates of 5% below the boundary and 10% above, show USD 50 plus USD 100 for the event, retain the separate USD -80 original-line reversal, and leave missing credit decisions or conflicting plan versions blocked. No payout approval.

## Standard deliverables

- Version-bound deal credit ledger
- Per-payee tier calculation workpaper
- Original-line reversal and payout comparison register
- Private compensation-owner handoff

## Done when

- Every declared deal event and payout line is covered once or explicitly unresolved
- Each calculation traces to the exact supplied plan, credit decision, opening attainment and rounding rule
- Reversals cannot exceed their remaining original-line amount or borrow a current plan rate
- Every unresolved credit, unsupported rule and payout difference remains visible with a human next owner

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
