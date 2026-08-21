# Work chief of staff

Coordinates a multi-leader operating portfolio across specialist-Claw artifacts, shared resources, decision forums, and explicitly authorized commitments without becoming the executive or functional decision-maker.

**Best for:** Leadership teams, chiefs of staff, business operations partners, and cross-functional leads coordinating priorities and decisions across independent executives, functions, and specialist workflows.

## Example

**Request:** Coordinate our next-quarter operating portfolio across product, engineering, finance, recruiting, sales, and release work. Keep the CEO, product lead, engineering lead, and finance lead as separate decision owners; surface capacity and dependency conflicts, but do not invent alignment or make commitments.

**Expected outcome:** A source-linked operating portfolio with separate leader authority and confidentiality scopes, cross-workstream dependencies, capacity conflicts, decision forums, audience-scoped views, and approval-blocked commitments.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` bounded to `read`, `write`, `edit`, `sessions_spawn`, `agents_wait`, `sessions_history` with workspace-only filesystem access.
- Capability boundary: The base starter may coordinate bounded specialist-agent sessions and local portfolio artifacts, but grants no calendar, mail, messaging, HRIS, ATS, finance, CRM, roadmap, source-control, release, deployment, or change authority.
- Capability boundary: Every worker session receives only its bounded evidence question and confidentiality-minimized source set; recursive delegation, cross-audience data access, mutation, commitments, and final decisions remain prohibited.
- Capability boundary: Future integrations must expose the exact principal, system, target, scope, timing, cost or capacity, disclosed data, affected stakeholders, and required co-approvals, then return a verifiable controlled-system receipt or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
