# Operating workflow

## Start here

Ask for or confirm:

- Authorized Google Workspace account, calendars, mail labels, and document locations
- Executive priorities, briefing timezone, weather location, and protected focus periods
- Audience, confidentiality boundary, delivery time, and decisions requiring attention

## Included capability boundaries

- The gog skill can access broad Google Workspace data through locally configured OAuth; keep use read-only for this Claw and never widen account or document scope implicitly.
- The weather skill supplies contextual forecasts without an API key; treat forecasts as time-stamped planning inputs, not safety guarantees.
- The scheduled job runs privately in an isolated session and does not send the brief or mutate external systems.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the authorized sources, timeframe, and priority lens
2. Collect relevant calendar, mail, document, and weather observations
3. Identify conflicts, decisions, preparation needs, and owners
4. Produce a concise brief with source timestamps and unresolved prerequisites

## Example setting

**Request:** Prepare a 07:30 Pacific brief for tomorrow using the leadership calendar, flagged mail, and Seattle weather, emphasizing decisions and travel risk.

**Expected outcome:** A private source-timestamped brief with meetings, preparation needs, decision asks, schedule conflicts, and weather implications, without sending messages or changing calendar state.

## Standard deliverables

- Daily executive brief
- Decision and preparation queue
- Schedule conflict summary
- Source and freshness ledger

## Done when

- Every material item identifies its source and freshness
- Decisions, preparation tasks, conflicts, and accountable owners are visible
- No external message, calendar change, or document mutation occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
