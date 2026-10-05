# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied invoices, statements, contracts, delivery evidence, client notes, and payment records
- Invoice amounts, currencies, issue and due dates, partial payments, credits, disputes, and follow-up history
- Owner policies for reminders, escalation, sensitive details, write-offs, and review
- For receipt work: owner-scoped source revisions, stable receipt and allocation identities, exact minor-unit amounts and currency scales, plus explicit legacy-payment mappings when linking artifacts

## Included capability boundaries

- The base starter works from supplied records and grants no messaging, accounting-system, payment, banking, or client-account authority.
- When balances, payment evidence, or contract terms conflict, preserve the discrepancy and require owner review rather than choosing a financial truth.

## Structured decision artifact contract

- For invoice-only reviews, write current state to `outputs/invoice-receivables.json` using `schemas/invoice-receivables.schema.json`; preserve the existing amount units and balance semantics.
- For receipt-only workpapers, write `outputs/invoice-receivables.json` using `schemas/receipt-workpaper-report.schema.json` and `awesomeClaws.receiptWorkpaperReport.v1`.
- For linked legacy-payment reviews, write `outputs/invoice-receivables.json` using `schemas/receipt-legacy-review.schema.json` and `awesomeClaws.receiptLegacyReview.v1`; preserve the complete legacy artifact and its handoff state unchanged.
- Follow `references/receipt-workpaper.md` for receipt identity, source scope, conservation, mapping and exact recomputation. Never add legacy payments to receipt allocations or infer an invoice balance from remittance advice.
- Treat `fixtures/invoice-receivables.example.json` and every packaged fixture only as a synthetic shape example, never as current evidence. Keep every unresolved record and owner question visible; unknown is not zero.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the same current state at `outputs/invoice-payment-followup-handoff.md`; use `templates/invoice-receivables.md` for invoice-only work, `fixtures/receipt-handoff.example.md` for receipt work, or `fixtures/receipt-legacy-handoff.example.md` for linked review, replacing all example facts.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.
- A valid blocked report is not clearance. Neither output grants posting, invoice-change, communication, collection, refund or accounting-close authority.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory invoices and source every amount, date, client, and payment fact
2. Reconcile open, paid, partial, disputed, stale, and unknown states against current evidence
3. For receipt work, conserve each supplied receipt, distinguish remittance from application, retain unallocated cash and unresolved evidence, and check legacy equivalence without combining amounts
4. Draft owner-review follow-ups and flag conflicts, missing delivery proof, overdue risk, and escalation questions
5. Prepare a receivables handoff without issuing invoices, contacting clients, or moving money

## Example setting

**Request:** Review receipt R1: USD 1,000 received, with remittance for USD 600 against invoice A and USD 300 against invoice B. Keep the USD 100 remainder unallocated. Do not apply cash, change balances, contact clients, or move money.

**Expected outcome:** An owner-review receipt workpaper with source-backed allocations, USD 100 explicitly unallocated, unchanged invoice balances, and questions before any accounting or external action.

## Standard deliverables

- Invoice and receivables ledger
- Payment evidence and discrepancy register
- Receipt conservation workpaper and optional legacy-payment equivalence review
- Owner-review follow-up draft queue
- Escalation and action-gate handoff

## Done when

- For invoice-ledger reviews, every invoice has a current, paid, partial, overdue, disputed, stale, conflicting, or unknown evidence state
- Every amount, due date, payment, credit, dispute, and follow-up draft points to supplied evidence or a visible gap
- The handoff names owner decisions before any invoice change, client contact, collection, fee, refund, write-off, account, or payment action
- For receipt work, every record is retained and totals conserve exact minor units or remain unknown behind visible blockers; linked payments are checked for equivalence, never added twice

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
