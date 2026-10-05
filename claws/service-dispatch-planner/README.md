# Service Dispatch Planner

Builds a feasible draft technician appointment schedule from supplied job, availability, skill, travel and readiness constraints without dispatching anyone.

**Best for:** Service-office dispatchers planning one day's ordinary field-service appointments for a bounded technician roster.

## Example

**Request:** Draft Monday's schedule from the supplied two-technician roster, three service jobs, fixed appointment and travel table. Retain the parts-held job and do not contact or dispatch anyone.

**Expected outcome:** A feasible draft with travel-aware appointment times, the fixed appointment unchanged, the parts-held job visibly unassigned, and a human release gate.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Write `outputs/service-dispatch.json` using `schemas/service-dispatch.schema.json`; follow `references/dispatch-contract.md`.
- Capability boundary: Write the matching Markdown itinerary at `outputs/service-dispatch-planner-handoff.md` using `templates/service-dispatch.md`.
- Capability boundary: A schedule requiring missing travel, duration, qualification or readiness evidence stays incomplete. Multi-person crews, multi-day jobs and emergency dispatch are out of scope.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
