# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied loyalty account exports, screenshots, emails, points statements, certificate notices, elite-benefit pages, award-search notes, trip goals, fee notes, transfer pages, and owner constraints
- Program names, masked account labels, balance dates, expiration dates, certificates, benefit scope, trip windows, destination ideas, travel party constraints, source freshness, and privacy labels
- Review goals such as points ledger, expiration watchlist, certificate checklist, trip-fit shortlist, missing-evidence questions, and blocked redemption handoff
- External actions that must remain blocked or draft-only, including bookings, redemptions, transfers, purchases, payments, account changes, provider contact, itinerary changes, and professional advice

## Included capability boundaries

- The base starter uses owner-supplied loyalty exports, statements, emails, screenshots, certificates, benefit pages, transfer pages, award-search notes, trip goals, and owner notes and grants no airline, hotel, credit-card, travel-booking, payment, messaging, browser, or account authority.
- When balances, certificates, expirations, benefits, transfer ratios, award availability, fees, account data, or trip goals are stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than booking, redeeming, transferring, buying, paying, contacting, changing accounts, or advising.

## Structured decision artifact contract

- Treat `fixtures/travel-loyalty.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/travel-loyalty.json` and check it against `schemas/travel-loyalty.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/travel-loyalty.md` at `outputs/travel-loyalty-points-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each program, balance, certificate, benefit, trip goal, redemption candidate, gap, and review question to supplied or approved evidence
2. Group balances and certificates by program, expiration, source freshness, privacy label, transferability, trip fit, fee risk, and owner priority
3. Reconcile stale, missing, conflicting, partial, account-sensitive, blackout-adjacent, transfer-adjacent, or fee-adjacent evidence without inventing availability or point value
4. Prepare an owner-reviewed travel-rewards packet with source ledger, expiration watchlist, certificate checklist, redemption-candidate notes, and unresolved questions
5. Return a blocked-action handoff without booking, redeeming, transferring, buying, paying, contacting providers, changing accounts, changing itineraries, or giving professional advice

## Example setting

**Request:** Organize my airline miles, hotel points, credit-card points, expiring certificates, elite benefits, award-search notes, and trip goals. Show balances, expirations, trip-fit questions, and stale evidence, but do not book, redeem, transfer, buy points, pay fees, change accounts, contact providers, alter itineraries, or give tax, legal, financial, credit-card, travel, immigration, insurance, or loyalty-program advice.

**Expected outcome:** A source-backed travel loyalty packet with masked account ledger, balances, certificates, expiration risks, trip-fit redemption candidates, missing evidence, owner-review questions, and all booking, redemption, transfer, purchase, payment, account, contact, itinerary, and professional-advice actions blocked.

## Standard deliverables

- Travel loyalty source ledger
- Points, miles, certificate, and benefit inventory
- Expiration and missing-evidence watchlist
- Trip-fit redemption candidate review
- Owner questions for certificates, transfers, fees, and blackout risk
- Blocked booking, redemption, transfer, purchase, payment, account, provider-contact, itinerary, and advice handoff

## Done when

- Every program, balance, certificate, benefit, trip goal, redemption candidate, gap, and review question has source identity, freshness, privacy scope, and owner-review state
- Every expiration, balance, certificate, benefit, trip-fit, transfer, or fee claim traces to supplied or approved evidence without hiding stale, missing, conflicting, partial, account-sensitive, blackout-adjacent, or fee-adjacent evidence
- Account numbers, credentials, traveler identifiers, confirmation numbers, family-member details, card details, and provider contact details are minimized or blocked from inappropriate outputs
- Bookings, redemptions, transfers, point purchases, fee payments, provider contact, account changes, itinerary changes, and tax/legal/financial/credit-card/travel/immigration/insurance/loyalty-program advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
