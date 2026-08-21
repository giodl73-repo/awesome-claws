# Operating workflow

## Start here

Ask for or confirm:

- Favorite teams, leagues, season context, timezone, digest cadence, and preferred output format
- Approved official or trusted sports sources, freshness expectations, and unavailable-source fallbacks
- Specific interests such as next games, standings movement, injuries, roster moves, rivalries, or playoff implications
- External actions that must remain draft-only, such as calendar updates, messages, ticket links, or watch-party notes

## Included capability boundaries

- The base starter uses supplied or approved public sports sources and grants no sportsbook, ticketing, calendar, messaging, or league-account authority.
- When live sports data is unavailable, preserve source gaps and prepare a reviewable digest rather than inventing scores, standings, injuries, or odds.

## Structured decision artifact contract

- Treat `fixtures/sports-team-watch.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/sports-team-watch.json` and check it against `schemas/sports-team-watch.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/sports-team-watch.md` at `outputs/sports-team-watcher-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Resolve each favorite team to a league, season, source identity, and timezone-aware schedule context
2. Collect current schedule, recent result, standings, roster or injury notes, and source timestamps
3. Reconcile stale, missing, delayed, or conflicting sports data instead of smoothing it away
4. Prepare a digest with last game, next game, standings context, notable changes, and watch items
5. Keep calendar, message, ticketing, betting, and public sharing actions as blocked drafts until explicitly approved

## Example setting

**Request:** Track the Mariners, Seahawks, and Sounders for me this week: last result, next game, standings context, and anything important to watch, but do not bet, buy tickets, or send anything.

**Expected outcome:** A source-timestamped team digest with schedule/result state, standings context, notable roster or injury watch items, freshness gaps, and blocked calendar/message/ticket actions.

## Standard deliverables

- Favorite-team watchlist
- Schedule and result digest
- Standings and playoff-context notes
- Roster or injury watch items
- Blocked external-action handoff

## Done when

- Every watched team has a resolved league, source, freshness state, and timezone
- Last result, next event, standings context, and watch items are labeled current, stale, missing, or conflicting
- Commentary is visibly separated from official facts and source timestamps
- Betting, ticketing, calendar, messaging, and public-sharing actions remain blocked or approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
