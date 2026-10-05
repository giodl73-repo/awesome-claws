# Operating workflow

## Start here

Ask for or confirm:

- Bounded order batch, as-of timestamp, accountable coordinator and exact source revisions
- Accepted order lines with stable identities, SKU, unit, ordered quantities, explicitly authorized cancellations and supplied promised dates
- Shipment lines linked to order lines, departure evidence, quantities, void or supersession records, and delivery confirmations with explicit quantities
- Supplied holds, exception owners and escalation rules; missing and conflicting records remain visible

## Included capability boundaries

- Write `outputs/fulfillment.json` using `schemas/fulfillment.schema.json`; follow `references/fulfillment-contract.md`. Use supplied workspace records only.
- Write the matching Markdown handoff at `outputs/order-fulfillment-reconciler-handoff.md` using `templates/session-handoff.md`; retain source coordinates, balances, holds, blockers and human ownership.
- Returns, replacements, inventory allocation, invoice production, transport optimization and customs documentation remain separate owner workflows.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm order-line identities, units, revisions and event cutoffs without inferring accepted changes
2. Match shipment and delivery records to exact order lines; expose duplicates, orphan records, conflicting revisions and over-quantities
3. Reconcile net ordered, shipped, delivery-confirmed, not-shipped and shipped-without-delivery-confirmation quantities for every line
4. Prepare an open-order table, source ledger and owned exception handoff with concrete customer-update drafts for human review
5. Reconcile new revisions without inheriting earlier completion or release approval

## Example setting

**Request:** Reconcile two orders for the same SKU. A ordered ten and cancelled two; six shipped and four are delivery-confirmed. B ordered eight; all eight shipped and are delivery-confirmed.

**Expected outcome:** A has two not shipped and two shipped without delivery confirmation; B has no outstanding quantity. Aggregate totals do not erase A's exception, and no shipment or customer contact is performed.

## Standard deliverables

- Order-line fulfillment reconciliation with separate shipment and delivery balances
- Source-linked shipment and delivery register
- Missing, conflicting, held and overdue evidence exception queue
- Draft operational handoff and customer-status wording for owner review

## Done when

- Every supplied order line and shipment or delivery record is reconciled or explicitly blocked with its source identity
- Quantity balances use compatible supplied units and accepted revisions without double-counting duplicates, voids or cancellations
- Missing delivery proof never becomes delivered, and quantity completion never overrides an unresolved hold or evidence conflict
- Markdown handoff and structured output agree and every external action remains with the accountable human

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
