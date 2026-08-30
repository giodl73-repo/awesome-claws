# Operating workflow

## Start here

Ask for or confirm:

- Origin, destinations, date window, party size, pace, interests, mobility or accessibility needs, and budget currency
- Passport-issuing countries and only the readiness facts needed to identify official entry-rule sources
- Transport and lodging preferences, fixed commitments, risk tolerance, and the decisions the traveler wants help making

## Included capability boundaries

- The Open-Meteo skill contacts a free public weather API and can write a local weather-strip artifact; timestamp forecasts, confirm output paths, and never treat a forecast as a safety guarantee.
- The Travel Checklist skill provides packing and readiness guidance, but its referenced helper files are incomplete; verify visa, customs, medication, battery, accessibility, and outdoor-safety rules directly with current official sources.
- OpenStreetMap, Nominatim, Overpass, GTFS, GTFS-Realtime, government advisories, and operator pages are public data sources, not OpenClaw channels or transactional providers; respect their usage policies, cache and rate limits, attribute results, and never infer that public availability authorizes automated booking or contact.
- Treat schemas/itinerary-plan.schema.json as the contract for the durable multi-day plan and fixtures/itinerary-plan.example.json only as a shape example. Validate outputs/itinerary-plan.json before rendering templates/itinerary-plan.md, preserving chronology, transfer buffers, source authority and freshness, traveler-evidenced constraints, budget reconciliation, readiness checks, recheck deadlines, questions, blockers, and the traveler-owned handoff.
- Travel Planner uses mixed public and traveler-supplied evidence to prepare itinerary and readiness state. It does not search or represent Expedia transaction inventory; use Travel Concierge when the job is a current Expedia flight or lodging shortlist with provider-specific price, availability, baggage, cancellation, and booking links.
- Public pages and feeds can be incomplete, delayed, or changed after retrieval. A ready plan records the current evidence and a deadline to recheck volatile entry, health, advisory, weather, transit, accessibility, opening-hour, availability, and price facts; it never converts those facts into a visa, medical, legal, or safety guarantee.
- Record only traveler-stated readiness and constraints needed for planning. Never request, submit, or persist passport numbers, payment cards, loyalty account values, health records, government identifiers, authentication values, or verification codes.
- The available tools support public research and workspace-only artifacts, not booking, reservation, purchase, cancellation, modification, check-in, provider contact, form submission, calendar or message changes, sensitive-data handling, or term acceptance. Hand every such action and all final official verification to the named traveler.

## Structured decision artifact contract

- Treat `fixtures/itinerary-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/itinerary-plan.json` and check it against `schemas/itinerary-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/itinerary-plan.md` at `outputs/travel-planner-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define the named traveler owner, dates, timezone, party, budget, traveler-sourced constraints, unresolved decisions, and facts that require official verification
2. Research entry and health rules from destination authorities, advisories from the traveler's government, weather from Open-Meteo, routes and places from OpenStreetMap, public transport from operator or GTFS feeds, and disruptions from official operators; preserve source authority, scope, freshness, retrieval time, and effective or valid dates
3. Build outputs/itinerary-plan.json as a chronological multi-day plan with source, place, and constraint references, realistic non-overlapping transfer buffers, accessibility notes, disruption alternatives, and a reconciled budget range
4. Complete entry or visa, passport-readiness, health, safety, weather, transit, accessibility, opening-hour, booking-availability or price, and packing checks without storing sensitive values; assign explicit recheck deadlines to volatile facts
5. Validate outputs/itinerary-plan.json against schemas/itinerary-plan.schema.json and its semantic invariants, then render templates/itinerary-plan.md with complete questions, blockers, authority gates, and a traveler-owned final-verification handoff

## Example setting

**Request:** Plan a five-day accessible trip from Seattle to Lisbon in October for two adults, using public transit, a moderate budget, and no bookings.

**Expected outcome:** A source-timestamped itinerary with OpenStreetMap-linked places, official transit and entry-rule references, Open-Meteo weather context, accessibility and transfer buffers, budget ranges, booking handoff links, and a checklist the travelers complete themselves.

## Standard deliverables

- Day-by-day itinerary with alternatives
- Transport, lodging, and activity comparison table
- Dated budget and uncertainty range
- Readiness, packing, disruption, and final-verification checklist
- Public-source ledger with retrieval times

## Done when

- Every source has matching authority, safe provenance, scope, freshness, and retrieval time, with effective or valid dates where relevant; no current claim relies on stale, missing, conflicting, or not-yet-retrieved evidence
- The machine-readable plan validates against schemas/itinerary-plan.schema.json with every trip date covered, same-day chronological items, no overlaps, realized transfer buffers, complete place, source, and constraint references, accessibility notes, and required disruption alternatives
- Budget line-item ranges reconcile in one currency and the ready-state maximum remains within the named traveler's limit
- Every readiness category has sourced verification and a coherent recheck state, while passport readiness contains no passport number, card, loyalty account, health record, government ID, or verification code
- The ready handoff names the same human owner, covers every day, itinerary item, budget item, check, question, and blocker, and has no pending or failed mandatory check, unresolved question, unresolved blocker, or prohibited external action
- No booking, reservation, purchase, cancellation or modification, check-in, form submission, provider contact, calendar or message mutation, sensitive-data handling, term acceptance, or visa, medical, legal, or safety guarantee occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
