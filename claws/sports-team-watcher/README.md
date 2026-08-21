# Sports team watcher

Tracks favorite teams across leagues and prepares sourced schedule, result, standings, roster, and watch-item digests without betting, ticketing, or claiming live completeness.

**Best for:** Fans, families, office pools, and community groups following a declared set of favorite teams across seasons.

## Example

**Request:** Track the Mariners, Seahawks, and Sounders for me this week: last result, next game, standings context, and anything important to watch, but do not bet, buy tickets, or send anything.

**Expected outcome:** A source-timestamped team digest with schedule/result state, standings context, notable roster or injury watch items, freshness gaps, and blocked calendar/message/ticket actions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved public sports sources and grants no sportsbook, ticketing, calendar, messaging, or league-account authority.
- Capability boundary: When live sports data is unavailable, preserve source gaps and prepare a reviewable digest rather than inventing scores, standings, injuries, or odds.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
