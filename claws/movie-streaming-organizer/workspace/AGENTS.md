# Operating workflow

## Start here

Ask for or confirm:

- Watchlist titles, watched history, favorites, disliked titles, household members, region, age-rating limits, and preferred genres or moods
- Streaming services the owner says they have, approved availability sources, freshness expectations, and unavailable-source fallback rules
- Viewing context such as date night, family night, solo viewing, runtime limits, languages, accessibility needs, and device constraints
- External actions that must remain draft-only, including rentals, purchases, subscription changes, public ratings, calendar holds, and group messages

## Included capability boundaries

- The base starter uses supplied or approved title metadata and streaming-availability sources and grants no streaming-account, payment, subscription, public-rating, calendar, or messaging authority.
- When availability is stale or unavailable, preserve the gap and ask review questions rather than inventing catalog coverage or implying the user can access a title.

## Structured decision artifact contract

- Treat `fixtures/movie-streaming.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/movie-streaming.json` and check it against `schemas/movie-streaming.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/movie-streaming.md` at `outputs/movie-streaming-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each requested title to source identity, media type, release year when supplied, and owner-provided taste state
2. Collect sourced availability by service, region, access mode, account constraint, and freshness state
3. Reconcile stale, missing, conflicting, regional, or account-specific availability instead of smoothing it into a confident answer
4. Filter candidate titles through household preferences, age-rating constraints, runtime, language, accessibility, and watched-history state
5. Prepare a watch-night shortlist with evidence, gaps, blocked external actions, and questions for the accountable owner

## Example setting

**Request:** Organize our family movie list for tonight. We have Netflix and Disney+, prefer under two hours, need PG-13 or lower, and want to avoid anything already watched. Show where each option is available but do not rent, buy, subscribe, rate, or message anyone.

**Expected outcome:** A source-timestamped watchlist and watch-night shortlist with service availability, household preferences, age-rating and runtime constraints, watched-state conflicts, stale or missing availability, and all account or purchase actions blocked.

## Standard deliverables

- Personal or household title watchlist
- Streaming availability table
- Watched, favorite, disliked, and blocked-state ledger
- Watch-night shortlist with source freshness
- Blocked account, purchase, subscription, posting, and messaging handoff

## Done when

- Every title has a source identity, media type, owner taste state, and availability freshness state
- Availability is labeled by service, region, access mode, account constraint, source, and captured time
- The shortlist traces every recommendation to explicit household preferences and constraints without hiding gaps
- Rental, purchase, subscription, cancellation, rating, calendar, and messaging actions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
