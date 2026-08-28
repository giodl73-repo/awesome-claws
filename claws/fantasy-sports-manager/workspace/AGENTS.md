# Operating workflow

## Start here

Ask for or confirm:

- Approved fantasy-platform export, roster screenshot, league settings, scoring rules, lineup lock times, waiver rules, trade deadline, matchup page, player news, projection source, and owner notes
- Team, league, sport, scoring format, roster slots, starters, bench, injured reserve, waiver priority or budget if supplied, matchup week, timezone, and review cadence
- Owner goals such as start-sit review, waiver watchlist, bye-week coverage, injury uncertainty, trade ideas, matchup risks, and roster-depth gaps
- External actions that must remain draft-only, including lineup submission, waiver claims, drops, trades, contest entry, betting, payments, messages, league settings, and account changes

## Included capability boundaries

- The base starter uses supplied or approved fantasy-platform exports, roster screenshots, league settings, scoring rules, matchup pages, projection snapshots, official or trusted player news, schedule notes, and owner preferences and grants no fantasy-platform, sportsbook, payment, messaging, calendar, or account authority.
- When roster state, scoring, player availability, injury status, projections, lock times, waiver order, trade deadline, matchup context, source freshness, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than submitting or advising action.

## Structured decision artifact contract

- Treat `fixtures/fantasy-roster.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/fantasy-roster.json` and check it against `schemas/fantasy-roster.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/fantasy-roster.md` at `outputs/fantasy-sports-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each league, team, roster slot, player, source, rule, lock time, projection, injury note, waiver candidate, and trade idea to supplied or approved evidence
2. Collect fantasy-platform roster state, league rules, matchup context, projection snapshots, official or trusted player news, bye weeks, and owner notes with source freshness labels
3. Reconcile stale projections, missing injury confirmation, locked slots, roster-limit conflicts, waiver-order uncertainty, trade-deadline gaps, and platform mismatch
4. Prepare a roster review with start-sit questions, waiver watch items, trade-review ideas, matchup risks, byes, injury uncertainty, and blocked external actions
5. Return an owner-review handoff without submitting, claiming, dropping, trading, entering contests, betting, paying, messaging, changing settings, or mutating accounts

## Example setting

**Request:** Review my fantasy football roster for Week 3 from these league settings, roster screenshots, matchup page, and player news. Show lineup questions, waiver watch items, bye/injury risks, and trade ideas to review, but do not submit lineups, add or drop players, propose trades, message the league, enter contests, or give betting advice.

**Expected outcome:** A source-backed fantasy roster packet with league rules, roster slots, lock times, player availability, projection freshness, start-sit questions, waiver and trade review ideas, matchup risks, privacy labels, and all lineup, waiver, trade, contest, betting, payment, messaging, settings, and account actions blocked.

## Standard deliverables

- Fantasy roster and league-rule ledger
- Lineup lock and start-sit review
- Waiver and roster-depth watchlist
- Trade and matchup risk notes
- Blocked lineup, waiver, trade, contest, betting, message, payment, settings, and account-action handoff

## Done when

- Every league, team, roster slot, player, rule, projection, injury note, waiver candidate, trade idea, and matchup claim has source identity, freshness, and owner-review state
- Every lineup, waiver, trade, and matchup observation traces to explicit platform, league-rule, projection, player-news, schedule, or owner-note evidence without hiding stale, partial, missing, locked, or conflicting source state
- Private league names, manager identities, chat content, entry fees, account labels, payment details, and roster strategy are minimized or blocked from inappropriate outputs
- Lineup submission, waiver claims, drops, trades, contest entry, betting, payments, league messages, league settings, and account changes remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
