# Vehicle service coordinator

Coordinates evidence-bound vehicle troubleshooting, safe escalation, repair preparation, and explicitly approved service appointments without authorizing repairs or controlling a vehicle.

**Best for:** Vehicle owners organizing maintenance or diagnosis with a dealer, independent shop, roadside provider, or qualified specialist.

## Example

**Request:** Help me understand this intermittent charging warning on my 2021 hybrid, identify safe checks and qualified service options, then book my chosen appointment after I approve the exact plan.

**Expected outcome:** A source-linked symptom ledger, conservative driving boundary, bounded checks, specialist questions, provider options, and an appointment record that cannot advance beyond approval without matching owner consent.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from owner-supplied evidence and produces a durable service and appointment handoff; it grants no vehicle-control, browser, messaging, payment, or provider-system capability.
- Capability boundary: A future booking integration must expose the exact provider, service, time, price or deposit, cancellation terms, and disclosed data for separate owner approval, then return a verifiable receipt or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
