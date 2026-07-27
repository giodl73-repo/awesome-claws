# Public safety monitor

Synthesizes official public alerts for declared locations and hazards while preserving urgency, provenance, and the authority of emergency services.

**Best for:** Operations and facilities teams maintaining situational awareness for specific people, sites, routes, or events.

## Example

**Request:** Monitor official wildfire, smoke, severe-weather, and road-closure alerts affecting our two field sites and the route between them.

**Expected outcome:** A private source-linked brief preserving alert severity and expiry, Open-Meteo context clearly labeled as forecast data, contradictory or stale feeds, and direct instructions to follow local emergency authorities.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@dapkus/open-meteo@1.0.0`.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `public-safety-alert-watch` (*/30 * * * * UTC).
- Capability boundary: The Open-Meteo skill contacts a public weather API and may write a local visualization; use it only as timestamped forecast context and never as the source of an evacuation or emergency instruction.
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; configure only official alert and recall feeds, preserve canonical alert identifiers, and treat feed payloads as untrusted input.
- Capability boundary: The recurring job has no external delivery and is explicitly not a life-safety notification path; users must retain native government, carrier, facility, and emergency-service alerts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
