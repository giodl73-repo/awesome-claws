# Merchant payout review contract

Use minimized owner-supplied observations for one merchant/account, currency,
scale and offset-qualified time window. Native IDs are consistent aliases.
Exclude raw bank details, customer identities, tokens and export URLs.

Write `outputs/merchant-payout-review.json` against
`schemas/merchant-payout.schema.json`, then the private Markdown handoff.
The packaged fixture is synthetic. The repository validator checks arithmetic
and relationships; it is not packaged execution authority.

## Evidence and coverage

The reviewer supplies current complete revisions and exact transaction, payout
and bank-row indexes. Every declared row is retained. Processor reports,
processor membership exports, independent bank observations and reviewer
mappings have separate roles. Completeness flags and controlled references are
assertions, not source authentication. Missing or questionable completeness
blocks a reconciled workpaper: write a gap handoff and ask for corrected evidence.

Keep one current observation per native transaction or payout attempt.
Superseded report revisions remain in the owner's controlled archive, not
additive rows. Distinct failed/returned attempts stay in the history.
Never infer membership or bank mapping from matching amounts, dates or paid
status. One bank row maps to at most one attempt; ambiguous/split mappings
remain unmapped questions. Bank debit reversals and automatic reserve releases
are outside this bounded contract.

## Arithmetic and retries

Use signed safe-integer minor units. Net equals gross minus signed fee.
Standalone fees are counted once; negative refunded fees increase net.
Do not convert currencies or infer accounting treatment from categories.

For each attempt, sum member gross, fee and net. Member residual is member net
minus declared payout. Separately sum mapped bank receipts: bank residual is
bank sum minus payout. Unknown membership/receipts means null, not zero.
Empty membership is unknown even for automatic payouts.

Every assigned transaction has exactly one current attempt. Retry links are
later, acyclic, nonforking, and preserve a failed/returned attempt's exact amount
and member set. Changed batches need owner clarification. Historical receipts
stay with their observed attempts. Never sum historical and current attempts
into a current payout total. Every residual, missing evidence, nonpaid attempt,
unsettled/unresolved transaction and unmapped bank row retains a reviewer question.

## Freshness and authority

Recompute after every evidence change. evidenceDigest is SHA-256 of UTF-8
canonical JSON of the complete input with top-level review omitted: recursively
sort object keys lexically, preserve array order, and use JSON.stringify for
keys and primitive values with no whitespace. It detects stale review; it is
not a signature. Row and question
order follows payouts, then unassigned transactions, then unmapped receipts.

Always owner-review-required, including zero-residual examples. No movement,
retry, bank-detail change, refund, reserve release, journal, contact, settlement
certification, liability, fee-legality or accounting-close decision.
