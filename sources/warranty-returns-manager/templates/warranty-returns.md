# Warranty and returns packet

## Portfolio

- Owner: `{{portfolio.owner}}`
- As of: `{{portfolio.asOf}}`
- Timezone: `{{portfolio.timezone}}`

## Source ledger

List each receipt, order confirmation, invoice, product photo, manual, warranty
card, policy excerpt, serial note, issue note, payment proof, and owner note
with freshness and privacy state.

## Items

For each item, show purchase support, serial state, condition state, and source
references. Redact serials, order numbers, payment details, and addresses unless
the owner approved this exact destination.

## Return windows

List return windows by item, opening date, closing date, state, and source
references. Stale, conflicting, unknown, and expired windows stay visible as
review questions; they are not claim or entitlement conclusions.

## Warranty terms

List supplied warranty terms and their state. Missing, stale, conflicting, or
expired terms cannot support a ready claim packet.

## Issue packets

Summarize owner-reported issues, photos, serial evidence, and packet readiness.
Do not diagnose product safety, schedule repair, request replacement, submit
claims, contact sellers, or contact manufacturers.

## Gaps and questions

Group missing receipts, missing serials, stale policies, conflicts, expired
windows, privacy risks, and safety-sensitive issues. Assign each unresolved item
to the named human owner.

## Blocked actions

Preserve all `blockedActions` and `handoff.prohibitedActions`. The Claw must not
initiate returns, file warranty claims, contact sellers, manufacturers, or
carriers, create shipping labels, request refunds, dispute charges, change
accounts, order replacements, schedule repairs, sell, donate, discard, dispose
of items, or give legal, financial, tax, safety, repair, warranty, insurance, or
consumer-rights advice.
