# Seller Return Reconciler handoff

## Request

Name the bounded return batch, revision, explicit-offset cutoff and human coordinator.

## Known facts

- Preserve exact return-line identities, human authorizers, compatible units and current authorized quantities. Keep physical receipts separate from recorded human dispositions.

## Assumptions and gaps

- List authorized units without receipt evidence and received units without disposition evidence. Do not infer lost shipments, product diagnoses or repair completion.
- Block derived balances on identity, authority, revision, chronology, unit, overlapping disposition or quantity conflicts. Preserve supplied holds even when blocked.

## Evidence ledger

- List each source revision and capture instant. Cite exact source-record identities for every authorization, receipt and disposition.
- Preserve receiving event and lot aliases, receipt-linked unit ranges, human decision authors and timestamps, plus void and supersession links. Account for every supplied record.

## Result

- Match `outputs/seller-return.json`: authorized, received, disposition-evidenced, not evidenced received and awaiting disposition evidence for every return line.
- Retain line holds and current disposition holds. Quantity completion never clears a hold or proves financial closure.

## Blocked actions

- No return authorization, warranty decision, inspection, diagnosis, disposition choice, safety clearance, credit, refund, inventory adjustment, replacement shipment, carrier booking, customer contact or ERP write is performed. Report approval and external-action flags remain false.

## Next owner

Name the coordinator responsible for missing evidence and holds. Route recorded decisions to the appropriate human repair, replacement or accounting workflow without claiming execution. Review `outputs/seller-return-reconciler-handoff.md` with the structured report and recompute after every source revision.
