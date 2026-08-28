# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied receipts, order confirmations, invoices, packing slips, product photos, product manuals, warranty cards, manufacturer pages, retailer policy excerpts, serial-number notes, issue notes, packaging status, payment proofs, and owner constraints
- Item labels, purchase dates, sellers, return deadlines, warranty windows, evidence freshness, policy confidence, issue status, privacy labels, and owner-review goals
- Review goals such as return-window readiness, warranty-claim packet, missing receipt, serial lookup, packaging checklist, defect evidence, replacement research handoff, and unresolved seller/manufacturer questions
- External actions that must remain blocked or draft-only, including return starts, claim submissions, seller/manufacturer/carrier contact, shipping labels, refunds, chargebacks, account changes, repair booking, disposal, resale, donation, and professional advice

## Included capability boundaries

- The base starter uses supplied receipts, order confirmations, invoices, product photos, manuals, warranty cards, policy excerpts, serial notes, issue notes, packaging status, and owner notes and grants no retailer, manufacturer, carrier, account, payment, messaging, shipping, repair, resale, donation, disposal, or claim authority.
- When item, receipt, serial, policy, return, warranty, issue, packaging, safety, privacy, payment, account, or source evidence is stale, partial, missing, conflicting, expired, or sensitive, preserve the gap and ask owner-review questions rather than taking action or asserting entitlement.

## Structured decision artifact contract

- Treat `fixtures/warranty-returns.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/warranty-returns.json` and check it against `schemas/warranty-returns.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/warranty-returns.md` at `outputs/warranty-returns-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each item, purchase source, return window, warranty term, issue note, packaging requirement, serial record, evidence gap, and review question to supplied or approved evidence
2. Group items by owner, seller, product category, purchase date, return deadline, warranty term, source freshness, privacy label, issue status, and blocked external action
3. Reconcile stale, missing, conflicting, partial, expired, duplicate, safety-sensitive, or private evidence without making claim, refund, safety, repair, or legal conclusions
4. Prepare an owner-reviewed warranty and returns packet with source ledger, window timeline, item checklist, claim/return readiness notes, and unresolved questions
5. Return a blocked-action handoff without starting returns, filing claims, contacting sellers or manufacturers, creating labels, requesting refunds, changing accounts, or giving professional advice

## Example setting

**Request:** Organize the warranty and return options for the appliance, headphones, and office chair from the receipts, order emails, warranty card, retailer policy excerpts, serial notes, photos, and issue notes I supplied. Show return windows, warranty terms, missing evidence, and a packet checklist, but do not start a return, file a claim, contact sellers, create labels, request refunds, dispute charges, change accounts, book repairs, discard anything, or give legal, financial, tax, safety, repair, warranty, insurance, or consumer-rights advice.

**Expected outcome:** A source-backed warranty and returns packet with receipt/product ledger, return-window and warranty timeline, serial/packaging/issue checklist, stale or missing evidence questions, and all return, claim, contact, label, refund, chargeback, account, repair, disposal, resale, donation, and professional-advice actions blocked.

## Standard deliverables

- Receipt, order, and product source ledger
- Return-window and warranty-term timeline
- Item, serial, packaging, and issue evidence checklist
- Claim or return packet readiness notes
- Missing, stale, conflicting, expired, safety-sensitive, and privacy evidence question list
- Blocked return, claim, contact, label, refund, chargeback, account, repair, disposal, resale, donation, and advice handoff

## Done when

- Every item, purchase source, return window, warranty term, issue note, packaging requirement, serial record, evidence gap, and review question has source identity, freshness, privacy scope, and owner-review state
- Every window, warranty, readiness, or checklist claim traces to supplied or approved evidence without hiding stale, missing, conflicting, partial, expired, safety-sensitive, or private evidence
- Order numbers, serial numbers, addresses, payment details, account ids, photos, defects, valuable items, and household details are minimized or blocked from inappropriate outputs
- Return submission, warranty claims, seller/manufacturer/carrier contact, labels, refunds, chargebacks, replacements, repairs, account changes, disposal, resale, donation, and legal/financial/tax/safety/repair/warranty/insurance/consumer-rights advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
