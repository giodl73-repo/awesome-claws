# Operating workflow

## Start here

Ask for or confirm:

- Traveler owner, authorized helpers, covered traveler aliases, confirmed journey scope, ticketing and operating carriers, private destination, and as-of time
- Supplied ticketed segment revisions, airport identifiers, dated departures and arrivals, cancellation or schedule-change notices, and existing separate-ticket dependencies
- Carrier replacement offers and expiry times, traveler decision evidence, independent ticket reissue or cancellation confirmations, and official connection constraints or explicit missing-evidence questions

## Included capability boundaries

- Base only: read supplied minimized records and write a private local handoff. No flight-status feed, reservation system, airline portal, travel search, messaging, payment, browser, or account capability is granted.
- Use Travel Planner for a public-source itinerary or prospective disruption alternatives, Travel Concierge for current Expedia inventory, and Travel Loyalty Points Organizer for award balances. This starter reconciles an existing ticketed journey rather than searching for new travel.
- The structured ledger can check consistency of supplied evidence, not authenticate a ticket or guarantee carriage, entry, connection feasibility, compensation, or safety. Conflicting or insufficient intake remains blocked for the traveler and responsible provider.
- Write outputs/flight-disruption.json using schemas/flight-disruption.schema.json and templates/flight-disruption.md. The initial contract supports one-to-one leg replacements; multi-stop reroutes, split tickets, changed issuers, and cancellation dispositions remain blocked intake questions.

## Structured decision artifact contract

- Treat `fixtures/flight-disruption.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/flight-disruption.json` and check it against `schemas/flight-disruption.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/flight-disruption.md` at `outputs/flight-disruption-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory the original booked journey and traveler-to-leg allocations, retaining ticket issuer and operating carrier as separate authorities
2. Bind each supplied operating notice to the exact carrier, service date, flight, route, and affected leg without treating a status notice as a ticket change
3. Compare supplied replacement offers against the exact displaced legs, traveler coverage, expiry, and source-stated connection constraints; leave unsupported alternatives unresolved
4. Reconcile traveler decisions with independent ticket-issuer confirmations and retain an acyclic predecessor-to-successor leg history without silently removing the original journey
5. Recompute affected inbound and outbound connections from offset-bearing instants and airport identity, preserving separate-ticket status and unknown minimum-connection or transfer evidence
6. Prepare a private before-and-after journey ledger with expired or unaccepted offers, missing reissues, partial traveler coverage, downstream questions, and the next traveler-owned review steps

## Example setting

**Request:** Our booked Seattle-Chicago-Boston outbound journey has a cancelled first leg. The airline offered a replacement for both traveler aliases, but the agency confirmation covers only one. The separate onward ticket still shows the original departure. Reconcile the supplied notices, offer expiry, ticket revisions, and connection evidence. Show what is confirmed and what still needs our review; do not accept, rebook, cancel, contact anyone, pay, or make a passenger-rights claim.

**Expected outcome:** A blocked recovery handoff preserves the cancelled original leg, separates the two-person offer from the one-person confirmed reissue, identifies the uncovered traveler and affected separate-ticket connection, and names the exact carrier or ticket-issuer evidence still needed.

## Standard deliverables

- Original booked-leg and traveler-allocation register with ticket revision lineage
- Operating disruption and replacement-offer timeline with source authority and expiry
- Traveler decision versus independent ticket-confirmation reconciliation
- Connection-impact register covering every affected predecessor and successor leg
- Private recovery review handoff with unresolved questions and blocked external actions

## Done when

- Every original leg and covered traveler allocation has one evidenced current disposition or a visible unresolved gap, with complete replacement lineage
- Operating notices, unaccepted offers, traveler decisions, independent ticket confirmations, and expired or conflicting evidence remain distinct
- Every affected connection is represented with exact airports, offset-bearing chronology, ticket relationship, source-stated constraints, and missing-evidence state without inferring feasibility
- The handoff accounts for partial-party changes, missing reissues, expired offers, schedule conflicts, and separate-ticket dependencies, and leaves all transactions and final verification with the traveler

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
