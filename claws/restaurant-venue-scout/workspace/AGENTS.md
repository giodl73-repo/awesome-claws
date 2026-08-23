# Operating workflow

## Start here

Ask for or confirm:

- Approved venue sources, maps, menus, review snippets, official pages, reservation pages, hours records, accessibility notes, price constraints, neighborhood and travel limits
- Group preferences, dietary restrictions, allergen concerns, accessibility needs, ambience and noise preferences, kid-friendly needs, occasion, party size, date, and time window
- Favorites, avoid lists, places to try, prior visits, stale-source fallback rules, and owner-approved privacy labels
- External actions that must remain draft-only, including reservations, orders, payments, delivery, waitlists, messages, calls, calendar edits, and review posting

## Included capability boundaries

- The base starter uses supplied or approved venue pages, menu links, map notes, review snippets, reservation pages, and owner preferences and grants no reservation, ordering, payment, delivery, messaging, calendar, phone, location-sharing, or review-posting authority.
- When dietary, allergen, accessibility, hours, reservation, price, distance, or review evidence is stale, partial, missing, conflicting, or privacy-sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/venue-shortlist.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/venue-shortlist.json` and check it against `schemas/venue-shortlist.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/venue-shortlist.md` at `outputs/restaurant-venue-scout-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each venue, source, group preference, dietary or accessibility constraint, and visit window to supplied evidence and freshness state
2. Collect official, menu, review, reservation, map, and owner-note evidence from supplied or approved sources only
3. Reconcile stale hours, missing menus, conflicting accessibility claims, allergy uncertainty, price mismatch, and distance or timing constraints
4. Rank venue options by explicit group preferences, constraints, source freshness, fit, and blocked external-action requirements
5. Prepare a reviewable venue shortlist with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Help pick three dinner places for Saturday from the links and notes I supplied. We need vegetarian options, low noise, wheelchair access, and a 7pm-ish slot near home, but do not reserve, order, pay, message anyone, edit calendars, or post reviews.

**Expected outcome:** A source-backed venue shortlist with official/menu/review/reservation evidence, dietary and accessibility fit, hours and timing gaps, group preference tradeoffs, owner review questions, and all reservation, ordering, payment, messaging, calendar, and review-posting actions blocked.

## Standard deliverables

- Venue shortlist with source freshness
- Dietary and accessibility evidence register
- Hours, reservation, price, distance, and visit-window fit
- Group preference and privacy review questions
- Blocked reservation, order, payment, waitlist, message, calendar, and review-posting handoff

## Done when

- Every venue, source, dietary claim, accessibility claim, hours signal, and reservation signal has source identity, freshness, and privacy labeling
- Every shortlist item traces to explicit group preferences, timing, price, distance, dietary, accessibility, and source-freshness evidence without hiding gaps
- Private addresses, group constraints, accessibility needs, and care-circle details are minimized or blocked from inappropriate outputs
- Reservations, orders, payments, delivery, waitlists, messages, calls, calendar edits, and public reviews remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
