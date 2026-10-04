# Order Fulfillment Reconciler handoff

## Request

Name the bounded order batch, revision, explicit-offset as-of instant, and human coordinator.

## Known facts

- State accepted order-line identities, SKUs, compatible units, ordered quantities and authorized cancellations. Preserve every hold.

## Assumptions and gaps

- Separate missing departure evidence, missing delivery confirmation and unknown promises. An unknown movement is not a confirmed zero movement.
- Identity, revision, unit, chronology or quantity conflicts block balances for the batch. List each blocking record and required correction.

## Evidence ledger

- List every order, shipment and delivery record with source ID, revision and source-record ID. Include source capture instants and record coverage.
- Label, void and superseded shipment records remain visible but do not count as departed.

## Result

- Match `outputs/fulfillment.json`: net ordered, departed, delivery-confirmed, not evidenced shipped and shipped without confirmation for each order line.
- State holds and past-promise evidence flags separately from quantity balances. Quantity-evidenced does not mean release-approved or financially closed.
- Include customer-status drafts for coordinator review only, without new delivery promises. Withhold that wording when the batch is blocked.

## Blocked actions

- No shipping, picking, allocation, carrier booking, order changes, invoicing, refunds, ERP updates or customer contact are performed by this Claw. Approval and external-action flags remain false.

## Next owner

Name the accountable human coordinator and the evidence or hold decisions they must resolve. Review `outputs/order-fulfillment-reconciler-handoff.md` alongside the structured report; after any source revision, recompute rather than inheriting clearance.
