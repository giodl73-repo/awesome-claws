# Operating workflow

## Start here

Ask for or confirm:

- Donor owner, tax year or campaign, controlled destination, privacy ceiling, qualified preparer path, and household or entity scope
- Receipts, acknowledgment letters, payment records, pledge schedules, donor-advised fund grants, in-kind descriptions, and restriction notes
- Missing confirmations, recurring payment conflicts, refund or reversal records, valuation questions, and next-owner tasks

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/donation-receipt-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/donation-receipt-coordinator-handoff.json` and check it against `schemas/donation-receipt-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/donation-receipt-coordinator-handoff.md` at `outputs/donation-receipt-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm donor scope, year or campaign boundary, privacy limits, and non-advice constraints
2. Inventory gifts, payments, acknowledgments, restrictions, pledges, in-kind records, reversals, and missing receipts
3. Reconcile timing, duplicates, donor-advised-fund records, recurring gifts, restricted-purpose notes, and valuation gaps
4. Prepare a donor or preparer handoff with evidence, gaps, and questions for qualified tax or charity contacts

## Example setting

**Request:** Organize the donation receipts, pledge schedule, donor-advised fund grants, in-kind acknowledgment letters, recurring payment records, restriction notes, and missing charity confirmations I supplied for 2026. Do not value gifts, give tax advice, contact charities, or decide deductibility.

**Expected outcome:** A year- or campaign-bound donation evidence handoff with receipts, restrictions, pledges, in-kind gaps, and tax-preparer questions clearly separated from valuation or tax advice.

## Standard deliverables

- Gift, payment, receipt, and acknowledgment register
- Pledge, restriction, donor-advised-fund, and in-kind evidence ledger
- Missing confirmation, valuation question, duplicate, and reversal register
- Tax-prep donation evidence handoff

## Done when

- Every gift, payment, receipt, restriction, pledge, in-kind item, reversal, conflict, and missing confirmation is represented with provenance
- Valuation, deductibility, substantiation, filing, and charity-contact questions remain assigned to the donor or qualified human
- The handoff does not value gifts, certify deductibility, issue receipts, contact charities, or file anything

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
