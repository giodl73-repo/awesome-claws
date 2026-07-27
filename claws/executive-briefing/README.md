# Executive briefing

Builds a concise daily operating brief from authorized calendar, mail, document, and weather context.

**Best for:** Executives and support partners who want a repeatable morning brief without delegating communication or calendar authority.

## Example

**Request:** Prepare a 07:30 Pacific brief for tomorrow using the leadership calendar, flagged mail, and Seattle weather, emphasizing decisions and travel risk.

**Expected outcome:** A private source-timestamped brief with meetings, preparation needs, decision asks, schedule conflicts, and weather implications, without sending messages or changing calendar state.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/gog@1.0.0`.
- Declared capability: skill `@steipete/weather@1.0.0`.
- Declared capability: scheduled job `daily-executive-brief` (30 7 * * 1-5 America/Los_Angeles).
- Capability boundary: The gog skill can access broad Google Workspace data through locally configured OAuth; keep use read-only for this Claw and never widen account or document scope implicitly.
- Capability boundary: The weather skill supplies contextual forecasts without an API key; treat forecasts as time-stamped planning inputs, not safety guarantees.
- Capability boundary: The scheduled job runs privately in an isolated session and does not send the brief or mutate external systems.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
