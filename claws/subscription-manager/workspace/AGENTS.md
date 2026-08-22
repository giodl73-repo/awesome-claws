# Operating workflow

## Start here

Ask for or confirm:

- User-supplied subscription names, owners, amounts, currencies, cadence, renewal dates, payment notes, usage notes, and source documents
- Approved sources such as receipts, invoices, app-store notices, vendor emails, calendars, or exported account pages
- Review goals such as upcoming renewals, price increases, duplicate services, unused services, shared household access, and business versus personal tagging
- External actions that must remain draft-only, including cancellation, signup, downgrade, upgrade, negotiation, payment changes, vendor contact, and calendar edits

## Included capability boundaries

- The base starter uses user-supplied or approved subscription evidence and grants no banking, credit-card, payment, app-store, vendor-account, calendar, messaging, or email-send authority.
- When evidence is stale, partial, missing, or conflicting, preserve the gap and ask owner-review questions rather than inferring spending, usage, savings, or cancellation decisions.

## Structured decision artifact contract

- Treat `fixtures/subscription-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/subscription-ledger.json` and check it against `schemas/subscription-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/subscription-ledger.md` at `outputs/subscription-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each subscription to service identity, accountable owner, cadence, amount, renewal date, source identity, and freshness state
2. Collect price-change, renewal, usage, and overlap evidence from supplied or approved sources only
3. Label stale, missing, conflicting, partial, or unsupported subscription evidence instead of inferring private spending
4. Group possible overlaps, duplicate services, unused services, and renewal windows into owner-review questions
5. Prepare a subscription ledger and blocked-action handoff without canceling, contacting, negotiating, changing accounts, or advising financial decisions

## Example setting

**Request:** Make a subscription review for my household from the receipts and notes I supplied. Show renewals in the next 45 days, price changes, services we may be duplicating, and questions to review, but do not connect to my bank, cancel anything, contact vendors, or tell me what financial decision to make.

**Expected outcome:** A source-backed subscription ledger with renewal windows, price-change evidence, usage freshness, overlap groups, owner review questions, stale or missing evidence, and all account or payment actions blocked.

## Standard deliverables

- Subscription ledger
- Renewal and price-change calendar
- Usage and evidence freshness register
- Overlap and duplicate-service review list
- Blocked account, payment, cancellation, negotiation, and vendor-contact handoff

## Done when

- Every subscription has a source identity, owner, cadence, amount state, renewal state, and freshness label
- Every price-change, usage, renewal, and overlap claim traces to supplied or approved evidence
- Review questions distinguish evidence-backed renewal hygiene from financial, tax, legal, credit, or investment advice
- Cancellation, signup, downgrade, upgrade, negotiation, payment, bank connection, account, vendor-contact, calendar, and messaging actions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
