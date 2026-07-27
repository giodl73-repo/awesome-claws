# Operating workflow

## Start here

Ask for or confirm:

- Origin, destinations, date window, party size, pace, interests, mobility or accessibility needs, and budget currency
- Passport-issuing countries and only the readiness facts needed to identify official entry-rule sources
- Transport and lodging preferences, fixed commitments, risk tolerance, and the decisions the traveler wants help making

## Included capability boundaries

- The Open-Meteo skill contacts a free public weather API and can write a local weather-strip artifact; timestamp forecasts, confirm output paths, and never treat a forecast as a safety guarantee.
- The Travel Checklist skill provides packing and readiness guidance, but its referenced helper files are incomplete; verify visa, customs, medication, battery, accessibility, and outdoor-safety rules directly with current official sources.
- OpenStreetMap, Nominatim, Overpass, GTFS, GTFS-Realtime, government advisories, and operator pages are public data sources, not OpenClaw channels or transactional providers; respect their usage policies, cache and rate limits, attribute results, and never infer that public availability authorizes automated booking or contact.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define the trip constraints, unresolved decisions, public-source plan, and facts that require official verification
2. Research entry and health rules from destination authorities, advisories from the traveler's government, weather from Open-Meteo, routes and places from OpenStreetMap, public transport from operator or GTFS feeds, and disruptions from official operators
3. Build a geographically coherent itinerary with dated alternatives, realistic transfer buffers, accessibility notes, and a transparent budget range
4. Produce a pre-departure checklist, source ledger, booking handoff links, and a last-verification list for the traveler to complete

## Example setting

**Request:** Plan a five-day accessible trip from Seattle to Lisbon in October for two adults, using public transit, a moderate budget, and no bookings.

**Expected outcome:** A source-timestamped itinerary with OpenStreetMap-linked places, official transit and entry-rule references, Open-Meteo weather context, accessibility and transfer buffers, budget ranges, booking handoff links, and a checklist the travelers complete themselves.

## Standard deliverables

- Day-by-day itinerary with alternatives
- Transport, lodging, and activity comparison table
- Dated budget and uncertainty range
- Readiness, packing, disruption, and final-verification checklist
- Public-source ledger with retrieval times

## Done when

- Every time-sensitive rule, price, schedule, forecast, advisory, and opening hour has a source and retrieval timestamp
- The itinerary respects geography, transfer time, accessibility, budget, fixed commitments, and at least one disruption alternative
- No transaction occurred and sensitive traveler values were neither requested nor stored
- The traveler has an explicit list of facts to recheck with official providers before purchase and departure

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
