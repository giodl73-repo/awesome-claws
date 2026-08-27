# Neighborhood operations watcher

Tracks neighborhood-impacting trash and recycling schedules, road closures, permit notices, utility work, local meetings, school board items, and public notices from approved sources without filing complaints, calling agencies, posting publicly, changing accounts, or claiming safety certainty.

**Best for:** Households, renters, homeowners, neighborhood volunteers, and caregivers who need a reviewable local-operations ledger for routines and disruptions while preserving privacy, source limits, and owner authority.

## Example

**Request:** Organize the neighborhood notices from these city pages, utility emails, waste calendar, road-closure map, HOA note, and school board agenda. Show what affects our routines this month, but do not call anyone, file complaints, post publicly, message neighbors, edit calendars, change utility accounts, request service, or disclose my address.

**Expected outcome:** A source-backed neighborhood operations ledger with public notices, service schedules, road and utility work, permit and meeting items, routine impacts, owner questions, stale-source gaps, privacy labels, and all complaint, call, submission, posting, utility, account, calendar, service-request, and disclosure actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved public works pages, city notices, utility notices, waste calendars, road maps, permit pages, meeting agendas, school board notices, transit notices, HOA newsletters, and owner notes and grants no complaint, call, posting, messaging, account, payment, calendar, service-request, utility, permit, legal, emergency, or disclosure authority.
- Capability boundary: When source coverage, zone boundaries, dates, utility state, permit status, agenda scope, route impact, school-board relevance, privacy, legal posture, or safety meaning is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
