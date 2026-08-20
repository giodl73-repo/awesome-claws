# Home repair coordinator

Coordinates evidence-bound household troubleshooting, low-risk owner repairs, hazardous-condition escalation, and explicitly approved specialist appointments.

**Best for:** Residents and homeowners diagnosing a bounded household problem and deciding between a safe owner repair and a qualified trade specialist.

## Example

**Request:** Help me investigate why my dishwasher is not draining, walk me through only safe reversible checks from its manual, and prepare a repair appointment if those checks do not resolve it.

**Expected outcome:** A source-linked symptom record, hazard screen, bounded owner checks with stop conditions, parts and restoration checklist, and an exact specialist appointment plan that remains blocked until resident approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses resident-supplied evidence and writes a durable repair and specialist handoff; it grants no browser, messaging, payment, provider-system, smart-home, or physical-control capability.
- Capability boundary: A future booking integration must expose the exact provider, trade, diagnostic or repair scope, time, price or deposit, cancellation terms, and disclosed home data for separate resident approval, then return a verifiable receipt or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
