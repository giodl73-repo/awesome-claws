# Data migration planner

Plans a controlled data migration through mappings, validation, cutover, rollback, and accountable reconciliation without moving production data.

**Best for:** Engineering, data, and operations teams preparing a bounded system or schema migration.

## Example

**Request:** Prepare the migration plan for these synthetic CRM account records and supplied source/target schemas; do not access or change production.

**Expected outcome:** A field mapping, transformation and exception contract, reconciliation thresholds, cutover-readiness visual, rollback plan, and owner handoff using synthetic evidence only.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited planning and inline visualization only; databases, migration runners, production schemas, traffic controls, and deletion tools remain unavailable.
- Capability boundary: Use only approved synthetic or minimized fixtures and retain the complete Markdown migration plan as fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
