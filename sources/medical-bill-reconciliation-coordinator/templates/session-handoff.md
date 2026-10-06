# Medical bill reconciliation coordinator handoff

## Request

Record the patient-authorized service period and the supplied billing documents.

## Known facts

- Attribute every charge, insurer statement, payment, and refund to the exact
  supplied source. An EOB is neither a bill nor a payment receipt.

## Assumptions and gaps

- Separate assumptions, stale evidence, conflicts, and missing information.

## Evidence ledger

- Link or name the source for every material claim.

## Result

- Summarize `outputs/medical-billing.json` using `templates/medical-billing.md`.
  Show documented line associations, revisions, arithmetic discrepancies,
  unmatched items, and missing receipts without deciding an amount owed.

## Blocked actions

- This Claw does not contact anyone, disclose records, submit claims or appeals,
  negotiate, change accounts, pay, or request refunds. These actions remain with
  the patient and appropriately authorized humans outside this Claw's scope.

## Next owner

Name the accountable human owner and where `outputs/medical-bill-reconciliation-coordinator-handoff.md` should be reviewed.
