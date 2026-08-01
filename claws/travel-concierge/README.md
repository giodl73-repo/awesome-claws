# Travel concierge

Searches and compares current Expedia lodging and flight options, then prepares a traveler-controlled booking handoff without completing a transaction.

**Best for:** Travelers who want live Expedia hotel, vacation-rental, and flight options narrowed to a reviewable shortlist.

## Example

**Request:** Find three refundable hotels near the Chicago Riverwalk and two nonstop flight options from Seattle for a four-night October trip for two adults; compare total cost but do not book anything.

**Expected outcome:** A timestamped Expedia shortlist with disclosed inventory scope, total-price and cancellation caveats, flight and hotel tradeoffs, and direct links the traveler opens to verify and book personally.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard`, `search_stays`, `search_flights`, `eg_travel_signup`, `eg_travel_verify` with workspace-only filesystem access.
- Declared capability: openclaw plugin `@expediagroup/expedia-openclaw@1.0.4`.
- Declared capability: MCP server `mapbox`.
- Declared capability: scheduled job `daily-trip-readiness-refresh` (0 8 * * * UTC).
- Capability boundary: The official Expedia Group plugin sends travel searches and the setup email address to Expedia's adapter service, stores a token and contact metadata in the local OpenClaw credential store, and is governed by Expedia's terms and privacy notice; review those terms before enabling it and remove the credential separately when access is no longer wanted.
- Capability boundary: ClawHub marks version 1.0.4 clean and source-linked, but its agentic scan notes that the bundled skill can automatically re-authenticate using a cached email; this Claw requires fresh confirmation before every signup or re-authentication email.
- Capability boundary: The Mapbox hosted MCP endpoint uses browser OAuth configured outside the package. Only place search, place details, directions, and travel-time matrix tools are requested; authorization remains a visible local readiness prerequisite and removing this Claw does not revoke the user's Mapbox account grant.
- Capability boundary: The daily readiness refresh runs in an isolated session with no delivery. It may revisit only an already-approved trip and shortlist; absent scope or provider authorization produces a private prerequisite report instead of a broad search or notification.
- Capability boundary: Treat schemas/travel-shortlist.schema.json as the contract for persisted shortlist data. Validate that record before rendering the packaged command center or its Markdown fallback, and leave invalid or missing fields visible instead of inventing values.
- Capability boundary: The minimal tool profile exposes workspace-only file access, the four documented Expedia search/setup tools, and OpenClaw's presentation-only show_widget and dashboard tools; it does not grant browser, unrestricted filesystem, command execution, messaging, booking, payment, cancellation, or provider-contact authority.
- Capability boundary: Use the packaged command-center asset for the reviewed shortlist and keep the Markdown comparison complete as its fallback. Pin the stable travel-shortlist widget only after the traveler asks for it, update it in place, and never place verification codes, contact details, or payment data in a widget.
- Capability boundary: Expedia search results are a single-provider view and remain volatile; timestamp them, disclose the source, preserve displayed total-price and policy caveats, and hand off all verification and transactions to the traveler on Expedia.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
