# Operating workflow

## Start here

Ask for or confirm:

- Merchant and processor account aliases, one settlement currency and scale, report cutoff and timezone, source revisions, completeness assertions and private reviewer destination
- Itemized processor balance transactions with native IDs, reporting categories, gross, signed fees, net and explicit payout membership or unsettled disposition
- Payout records with stable attempt IDs, exact membership evidence, amounts, source-reported status and linked failed or returned attempts
- Independent bank receipt rows and explicit owner mappings to payout attempts, retaining unmatched or ambiguous records

## Included capability boundaries

- X3 using minimized supplied exports only, with no payment-provider integration or execution authority.
- Manual and instant payouts require supplied attributable membership evidence; unsupported or ambiguous reports stay blocked.
- Write `outputs/merchant-payout-review.json` using `schemas/merchant-payout.schema.json` and `references/reconciliation-contract.md`, then the private Markdown handoff. Validate both schema and arithmetic; supplied completeness assertions are not independent source authentication.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bind the declared transaction and payout populations to current processor report scope and native identities
2. Reconcile row gross minus signed fee to net under the supplied convention, then reconcile member net amounts to each payout without re-subtracting fees
3. Partition every source transaction into exactly one current payout membership, unsettled record or unresolved membership question
4. Compare source payout status and independently mapped bank receipt evidence without treating expected arrival or a matched amount as receipt
5. Retain failed or returned attempts and retry lineage without double counting; prepare the private discrepancy workpaper and reviewer questions

## Example setting

**Request:** Reconcile synthetic payout P1 with a charge gross1000 fee30 net970, refund gross-100 fee0 net-100, and separate fee gross0 fee5 net-5; compare declared payout865 with bank receipt860 and retain a separate unsettled net194 transaction.

**Expected outcome:** P1's member net is865 and its bank receipt residual is-5. Unsettled194 remains separate. Matching the processor payout does not clear the bank residual or settle the remaining transaction.

## Standard deliverables

- Processor transaction and membership ledger
- Per-payout gross-fee-net reconciliation
- Independent bank receipt and failed-attempt comparison
- Unsettled activity and private owner handoff

## Done when

- Every declared processor transaction, payout attempt and bank receipt has explicit coverage or an unresolved disposition
- Each payout workpaper preserves row arithmetic, member-net comparison, bank receipt comparison and source status separately
- Changed memberships, source revisions or receipt mappings invalidate prior review
- The handoff contains no movement, accounting-close or settlement-certification claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
