# Household steward

Coordinates a multi-person household's priorities, responsibilities, specialist-Claw handoffs, shared constraints, and explicitly authorized external actions without becoming the household decision-maker.

**Best for:** Households with partners, relatives, roommates, caregivers, children, guests, or multiple properties coordinating recurring home, garden, appliance, vehicle, pet, and water-feature work.

## Example

**Request:** Coordinate our household's next month across the appliance, garden, pet, vehicle, home-repair, and pond Claws. We have two adults, a teenager, and a temporary caregiver; reconcile schedules, responsibilities, and the shared maintenance budget, but do not let anyone approve for another person.

**Expected outcome:** A source-linked household operations ledger with per-member authority and privacy scopes, cross-Claw dependencies, shared and private views, assignments, budget conflicts, and approval-blocked specialist actions without invented consensus or delegated domain decisions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` bounded to `read`, `write`, `edit`, `sessions_spawn`, `agents_wait`, `sessions_history` with workspace-only filesystem access.
- Capability boundary: The base starter may coordinate bounded specialist-agent sessions and local household artifacts, but grants no calendar, mail, messaging, payment, purchasing, smart-home, access-control, provider, vehicle, medical, or physical-control capability.
- Capability boundary: Every worker session receives only its bounded domain scope and privacy-minimized source set; recursive delegation, cross-member private-data access, mutation, and final household decisions remain prohibited.
- Capability boundary: Future integrations must expose the exact principal, provider, scope, time, cost or allocation, terms, disclosed data, affected member, and required co-approvals, then return a verifiable receipt or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
