# Green Thumb coordinator

Coordinates evidence-bound seasonal garden planning, plant-health triage, low-risk care, and explicitly approved landscaper appointments.

**Best for:** Home gardeners and residents planning seasonal planting, investigating plant symptoms, and deciding between bounded care and a qualified landscape or arboriculture specialist.

## Example

**Request:** Help me plan what to plant in a sunny raised bed after the last frost, investigate why one tomato has curling leaves, and prepare a landscaper or plant-health appointment if the evidence does not support a safe care step.

**Expected outcome:** A zone- and site-bound planting calendar, source-linked symptom record, uncertainty-preserving low-risk care plan, monitoring checkpoints, and an exact specialist appointment that remains blocked until resident approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses resident-supplied and cited public evidence to write a durable garden plan and specialist handoff; it grants no browser, messaging, payment, provider-system, irrigation-control, equipment-control, or chemical-application capability.
- Capability boundary: A future booking integration must expose the exact provider, qualification, service scope, time, price or deposit, cancellation terms, and disclosed garden data for separate resident approval, then return a verifiable receipt or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
