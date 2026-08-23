# Operating workflow

## Start here

Ask for or confirm:

- Approved event sources, official pages, ticketing pages, venue pages, calendar listings, community feeds, school or club notices, accessibility notes, map notes, and owner preferences
- Audience preferences, favorite artists or teams, family-friendly constraints, age/rating constraints, accessibility needs, budget ranges, date windows, neighborhood limits, and travel-time limits
- Existing commitments, blocked dates, recurring routines, favorite venues, avoid lists, privacy labels, and stale-source fallback rules
- External actions that must remain draft-only, including ticket purchases, waitlists, RSVPs, venue contact, attendee messages, rides, payments, calendar edits, and public posting

## Included capability boundaries

- The base starter uses supplied or approved event pages, ticketing pages, venue pages, community calendars, map notes, and owner preferences and grants no ticketing, waitlist, RSVP, payment, messaging, calendar, ride, location-sharing, or public-posting authority.
- When availability, ticketing, accessibility, age fit, price, timing, travel, conflict, or venue evidence is stale, partial, missing, conflicting, or privacy-sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/event-watchlist.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/event-watchlist.json` and check it against `schemas/event-watchlist.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/event-watchlist.md` at `outputs/local-events-watcher-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each event, source, venue, timing window, ticketing signal, accessibility note, and audience constraint to supplied evidence and freshness state
2. Collect official, ticketing, venue, calendar, community, map, and owner-note evidence from supplied or approved sources only
3. Reconcile stale listings, missing accessibility evidence, sold-out states, waitlist claims, age/rating uncertainty, price mismatch, travel-time concerns, and schedule conflicts
4. Rank event options by explicit preferences, audience fit, source freshness, date/time fit, location fit, and blocked external-action requirements
5. Prepare a reviewable event watchlist with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Find local events for next weekend from the links and calendars I supplied. Prioritize family-friendly music, low-noise options, wheelchair access, and no conflicts with our Saturday afternoon commitment, but do not buy tickets, join waitlists, message venues, invite anyone, or edit calendars.

**Expected outcome:** A source-backed local event watchlist with official/ticketing/venue/calendar evidence, accessibility and age-fit notes, timing and conflict gaps, owner review questions, and all ticketing, waitlist, RSVP, contact, ride, calendar, and posting actions blocked.

## Standard deliverables

- Event watchlist with source freshness
- Ticketing, price, accessibility, and age-fit evidence register
- Date, time, location, travel, and conflict view
- Audience preference and privacy review questions
- Blocked ticketing, waitlist, RSVP, contact, ride, calendar, and posting handoff

## Done when

- Every event, source, venue, ticketing signal, accessibility claim, age-fit claim, and conflict has source identity, freshness, and privacy labeling
- Every watchlist item traces to explicit preferences, timing, location, price, accessibility, audience-fit, and source-freshness evidence without hiding gaps
- Private addresses, group constraints, minor details, accessibility needs, and care-circle details are minimized or blocked from inappropriate outputs
- Ticket purchases, waitlists, RSVPs, venue contact, attendee messages, rides, payments, calendar edits, location sharing, and public posting remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
