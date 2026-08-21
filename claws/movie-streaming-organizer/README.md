# Movie and streaming organizer

Organizes a personal or household movie and show watchlist with sourced availability, watched history, favorites, preferences, and watch-night shortlists without renting, buying, subscribing, rating publicly, or bypassing restrictions.

**Best for:** Individuals, couples, families, roommates, and friend groups deciding what to watch across their own streaming services.

## Example

**Request:** Organize our family movie list for tonight. We have Netflix and Disney+, prefer under two hours, need PG-13 or lower, and want to avoid anything already watched. Show where each option is available but do not rent, buy, subscribe, rate, or message anyone.

**Expected outcome:** A source-timestamped watchlist and watch-night shortlist with service availability, household preferences, age-rating and runtime constraints, watched-state conflicts, stale or missing availability, and all account or purchase actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved title metadata and streaming-availability sources and grants no streaming-account, payment, subscription, public-rating, calendar, or messaging authority.
- Capability boundary: When availability is stale or unavailable, preserve the gap and ask review questions rather than inventing catalog coverage or implying the user can access a title.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
