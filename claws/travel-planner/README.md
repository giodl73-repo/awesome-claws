# Travel planner

Builds a reviewable trip plan from current public sources without booking, paying, or retaining sensitive traveler records.

**Best for:** Travelers comparing destinations or preparing an itinerary, readiness checklist, and disruption-aware travel brief.

## Example

**Request:** Plan a five-day accessible trip from Seattle to Lisbon in October for two adults, using public transit, a moderate budget, and no bookings.

**Expected outcome:** A source-timestamped itinerary with OpenStreetMap-linked places, official transit and entry-rule references, Open-Meteo weather context, accessibility and transfer buffers, budget ranges, booking handoff links, and a checklist the travelers complete themselves.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@dapkus/open-meteo@1.0.0`.
- Declared capability: skill `@onlydreams/travel-checklist@1.0.2`.
- Capability boundary: The Open-Meteo skill contacts a free public weather API and can write a local weather-strip artifact; timestamp forecasts, confirm output paths, and never treat a forecast as a safety guarantee.
- Capability boundary: The Travel Checklist skill provides packing and readiness guidance, but its referenced helper files are incomplete; verify visa, customs, medication, battery, accessibility, and outdoor-safety rules directly with current official sources.
- Capability boundary: OpenStreetMap, Nominatim, Overpass, GTFS, GTFS-Realtime, government advisories, and operator pages are public data sources, not OpenClaw channels or transactional providers; respect their usage policies, cache and rate limits, attribute results, and never infer that public availability authorizes automated booking or contact.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
