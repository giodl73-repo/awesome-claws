# Merchant Payout Reconciler handoff

## Request

Record merchant/account aliases, currency and scale, time window, cutoff,
private reviewer and complete current source revisions.

## Known facts

- Record only facts grounded in supplied context or approved tools.

## Assumptions and gaps

- Separate assumptions, stale evidence, conflicts, and missing information.

## Evidence ledger

- Link or name the source for every material claim.

## Result

- Show each attempt's explicit members, gross, signed fees, net, declared payout
  and member residual; keep independent bank sums and bank residuals separate.
- Unknown membership or receipts means null, not zero. Preserve historical
  attempts without adding them into current totals. Keep unsettled activity out.
- Write `outputs/merchant-payout-review.json` against
  `schemas/merchant-payout.schema.json`; explain every discrepancy and gap.

## Blocked actions

- No movement, retry, refund, bank-detail change, reserve release, journal,
  contact, settlement certification or accounting-close decision.

## Next owner

Name the accountable human owner and where `outputs/merchant-payout-reconciler-handoff.md` should be reviewed.
Recompute after source revisions or mappings change. Matching arithmetic is not settlement.
