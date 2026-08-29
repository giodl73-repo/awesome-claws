# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied invoices, statements, contracts, delivery evidence, client notes, and payment records
- Invoice amounts, currencies, issue and due dates, partial payments, credits, disputes, and follow-up history
- Owner policies for reminders, escalation, sensitive details, write-offs, and review

## Included capability boundaries

- The base starter works from supplied records and grants no messaging, accounting-system, payment, banking, or client-account authority.
- When balances, payment evidence, or contract terms conflict, preserve the discrepancy and require owner review rather than choosing a financial truth.

## Structured decision artifact contract

- Treat `fixtures/invoice-receivables.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/invoice-receivables.json` and check it against `schemas/invoice-receivables.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/invoice-receivables.md` at `outputs/invoice-payment-followup-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory invoices and source every amount, date, client, and payment fact
2. Reconcile open, paid, partial, disputed, stale, and unknown states against current evidence
3. Draft owner-review follow-ups and flag conflicts, missing delivery proof, overdue risk, and escalation questions
4. Prepare a receivables handoff without issuing invoices, contacting clients, or moving money

## Example setting

**Request:** Reconcile these invoices and payment notes, then draft what I should review before following up with clients.

**Expected outcome:** A source-backed receivables ledger with payment states, discrepancies, overdue items, draft follow-ups, and explicit owner action gates.

## Standard deliverables

- Invoice and receivables ledger
- Payment evidence and discrepancy register
- Owner-review follow-up draft queue
- Escalation and action-gate handoff

## Done when

- Every invoice has a current, paid, partial, overdue, disputed, stale, conflicting, or unknown evidence state
- Every amount, due date, payment, credit, dispute, and follow-up draft points to supplied evidence or a visible gap
- The handoff names owner decisions before any invoice change, client contact, collection, fee, refund, write-off, account, or payment action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
