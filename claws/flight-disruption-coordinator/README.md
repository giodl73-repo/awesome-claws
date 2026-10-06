# Flight disruption coordinator

Reconciles an already-ticketed air journey after a cancellation or schedule change, keeping operating-flight notices, ticket revisions, carrier offers, traveler decisions, reissue confirmations, and affected connections separate without rebooking, cancelling, checking in, paying, contacting carriers, or deciding passenger rights.

**Best for:** Travelers and explicitly authorized helpers recovering an existing multi-leg flight journey from supplied airline, ticketing-agency, airport, and traveler records.

## Example

**Request:** Our booked Seattle-Chicago-Boston outbound journey has a cancelled first leg. The airline offered a replacement for both traveler aliases, but the agency confirmation covers only one. The separate onward ticket still shows the original departure. Reconcile the supplied notices, offer expiry, ticket revisions, and connection evidence. Show what is confirmed and what still needs our review; do not accept, rebook, cancel, contact anyone, pay, or make a passenger-rights claim.

**Expected outcome:** A blocked recovery handoff preserves the cancelled original leg, separates the two-person offer from the one-person confirmed reissue, identifies the uncovered traveler and affected separate-ticket connection, and names the exact carrier or ticket-issuer evidence still needed.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Base only: read supplied minimized records and write a private local handoff. No flight-status feed, reservation system, airline portal, travel search, messaging, payment, browser, or account capability is granted.
- Capability boundary: Use Travel Planner for a public-source itinerary or prospective disruption alternatives, Travel Concierge for current Expedia inventory, and Travel Loyalty Points Organizer for award balances. This starter reconciles an existing ticketed journey rather than searching for new travel.
- Capability boundary: The structured ledger can check consistency of supplied evidence, not authenticate a ticket or guarantee carriage, entry, connection feasibility, compensation, or safety. Conflicting or insufficient intake remains blocked for the traveler and responsible provider.
- Capability boundary: Write outputs/flight-disruption.json using schemas/flight-disruption.schema.json and templates/flight-disruption.md. The initial contract supports one-to-one leg replacements; multi-stop reroutes, split tickets, changed issuers, and cancellation dispositions remain blocked intake questions.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
