# Fantasy sports manager

Manages fantasy-team rosters, league rules, matchup evidence, waiver windows, trade ideas, injury uncertainty, and owner-review lineup decisions without submitting changes, joining contests, betting, messaging managers, or giving gambling advice.

**Best for:** Fantasy sports players, league co-managers, families, and office leagues who want a source-backed roster and matchup review while keeping final lineup, waiver, trade, contest, and message actions owner-approved.

## Example

**Request:** Review my fantasy football roster for Week 3 from these league settings, roster screenshots, matchup page, and player news. Show lineup questions, waiver watch items, bye/injury risks, and trade ideas to review, but do not submit lineups, add or drop players, propose trades, message the league, enter contests, or give betting advice.

**Expected outcome:** A source-backed fantasy roster packet with league rules, roster slots, lock times, player availability, projection freshness, start-sit questions, waiver and trade review ideas, matchup risks, privacy labels, and all lineup, waiver, trade, contest, betting, payment, messaging, settings, and account actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved fantasy-platform exports, roster screenshots, league settings, scoring rules, matchup pages, projection snapshots, official or trusted player news, schedule notes, and owner preferences and grants no fantasy-platform, sportsbook, payment, messaging, calendar, or account authority.
- Capability boundary: When roster state, scoring, player availability, injury status, projections, lock times, waiver order, trade deadline, matchup context, source freshness, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than submitting or advising action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
