# Operating workflow

## Start here

Ask for or confirm:

- Bounded return batch, as-of timestamp, accountable coordinator and exact source revisions
- Supplied human-authorized return lines with stable identities, quantities, units and accepted amendments
- Physical receipt records linked to return lines, including partial receipts, voids, corrections and unmatched goods
- Recorded human disposition evidence linked to received units or lots, supplied holds and repair or replacement handoff status

## Included capability boundaries

- Write `outputs/seller-return.json` using `schemas/seller-return.schema.json`; follow `references/return-contract.md`. Use supplied workspace records only.
- Write the matching Markdown backlog at `outputs/seller-return-reconciler-handoff.md` using `templates/session-handoff.md`; retain record coverage, holds, evidence gaps and human ownership.
- Inspection, warranty entitlement, disposition decisions, repair execution, outbound replacement fulfillment and accounting transactions remain with their accountable owners.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate return-line identities, source revisions, compatible units, authorization evidence and observation cutoffs
2. Match physical receipts to authorized return lines while preserving duplicates, unmatched goods and excess quantities as exceptions
3. Reconcile authorized quantities, evidenced receipts and quantities with recorded human disposition without treating disposition as executed repair or refund
4. Prepare a source-linked return backlog, unresolved evidence queue and owner-reviewable repair, replacement or accounting handoff
5. Compare revised records without inheriting prior clearance, disposition authority or financial closure

## Example setting

**Request:** Review a return line with five units authorized, three evidenced received and two received units with recorded human disposition. Prepare the return backlog without authorizing refunds or replacements.

**Expected outcome:** Two authorized units are not evidenced received and one received unit lacks disposition evidence. Recorded disposition does not prove repair, replacement, refund approval or payment. Conflicts and holds remain explicit.

## Standard deliverables

- Return-line authorization, receipt and disposition reconciliation
- Source revision and event ledger
- Unmatched, excess, duplicate, held and missing-evidence exception queue
- Draft return backlog and human-owned downstream handoff

## Done when

- Every supplied return line, receipt and disposition record is reconciled or explicitly blocked with its source identity
- Partial quantities reconcile in compatible units without double-counting duplicate, voided, superseded or overlapping records
- Missing receipt evidence is not called a lost shipment, and recorded disposition is not called completed repair, refund or closure
- Structured output and Markdown agree on balances, holds, evidence gaps, owners and all prohibited external actions

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
