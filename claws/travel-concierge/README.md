# Travel concierge

Searches and compares current Expedia lodging and flight options, then prepares a traveler-controlled booking handoff without completing a transaction.

**Best for:** Travelers who want live Expedia hotel, vacation-rental, and flight options narrowed to a reviewable shortlist.

## Example

**Request:** Find three refundable hotels near the Chicago Riverwalk and two nonstop flight options from Seattle for a four-night October trip for two adults; compare total cost but do not book anything.

**Expected outcome:** A timestamped Expedia shortlist with disclosed inventory scope, total-price and cancellation caveats, flight and hotel tradeoffs, and direct links the traveler opens to verify and book personally.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `search_stays`, `search_flights`, `eg_travel_signup`, `eg_travel_verify` with workspace-only filesystem access.
- Declared capability: openclaw plugin `@expediagroup/expedia-openclaw@1.0.4`.
- Capability boundary: The official Expedia Group plugin sends travel searches and the setup email address to Expedia's adapter service, stores a token and contact metadata in the local OpenClaw credential store, and is governed by Expedia's terms and privacy notice; review those terms before enabling it and remove the credential separately when access is no longer wanted.
- Capability boundary: ClawHub marks version 1.0.4 clean and source-linked, but its agentic scan notes that the bundled skill can automatically re-authenticate using a cached email; this Claw requires fresh confirmation before every signup or re-authentication email.
- Capability boundary: The minimal tool profile exposes only session status and the four documented Expedia search/setup tools; it does not grant browser, filesystem, command execution, messaging, booking, payment, cancellation, or provider-contact authority.
- Capability boundary: Expedia search results are a single-provider view and remain volatile; timestamp them, disclose the source, preserve displayed total-price and policy caveats, and hand off all verification and transactions to the traveler on Expedia.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
