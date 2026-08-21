# Pet care coordinator

Coordinates evidence-bound routine pet care, symptom triage, medication-safe handoffs, and explicitly approved veterinary appointments.

**Best for:** Pet guardians managing preventive care, new symptoms, ongoing treatment instructions, and veterinary scheduling.

## Example

**Request:** Track my dog's preventive care and help me decide whether new vomiting needs urgent veterinary care.

**Expected outcome:** An observation ledger, fail-closed escalation, care calendar, and an appointment plan blocked on exact approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter writes local artifacts and grants no provider, messaging, payment, or medication capability.
- Capability boundary: Unavailable qualified evidence produces an escalation handoff rather than inferred care.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
