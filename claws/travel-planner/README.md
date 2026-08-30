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
- Capability boundary: Treat schemas/itinerary-plan.schema.json as the contract for the durable multi-day plan and fixtures/itinerary-plan.example.json only as a shape example. Validate outputs/itinerary-plan.json before rendering templates/itinerary-plan.md, preserving chronology, transfer buffers, source authority and freshness, traveler-evidenced constraints, budget reconciliation, readiness checks, recheck deadlines, questions, blockers, and the traveler-owned handoff.
- Capability boundary: Travel Planner uses mixed public and traveler-supplied evidence to prepare itinerary and readiness state. It does not search or represent Expedia transaction inventory; use Travel Concierge when the job is a current Expedia flight or lodging shortlist with provider-specific price, availability, baggage, cancellation, and booking links.
- Capability boundary: Public pages and feeds can be incomplete, delayed, or changed after retrieval. A ready plan records the current evidence and a deadline to recheck volatile entry, health, advisory, weather, transit, accessibility, opening-hour, availability, and price facts; it never converts those facts into a visa, medical, legal, or safety guarantee.
- Capability boundary: Record only traveler-stated readiness and constraints needed for planning. Never request, submit, or persist passport numbers, payment cards, loyalty account values, health records, government identifiers, authentication values, or verification codes.
- Capability boundary: The available tools support public research and workspace-only artifacts, not booking, reservation, purchase, cancellation, modification, check-in, provider contact, form submission, calendar or message changes, sensitive-data handling, or term acceptance. Hand every such action and all final official verification to the named traveler.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
