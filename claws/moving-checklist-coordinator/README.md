# Moving checklist coordinator

Coordinates a household move across dates, inventory, services, documents, vendors, and dependencies without booking, paying, contacting parties, or changing addresses or accounts.

**Best for:** Individuals, families, and households planning a local or long-distance move from supplied records and constraints.

## Example

**Request:** Turn these move dates, quotes, inventory notes, and utility lists into one checklist without booking or contacting anyone.

**Expected outcome:** A source-backed moving plan with sequenced workstreams, assignments, stale or missing evidence, move-day blockers, and explicit owner action gates.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from supplied records and grants no messaging, booking, payment, mapping, account, utility, government, school, or property-system authority.
- Capability boundary: When dates, access, household consent, or vendor evidence conflict, keep the affected workstream blocked and surface the owner decision.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
