# Manufacturing operations planner

Builds a constraint-led production plan and exception handoff from approved demand, capacity, material, quality, and maintenance evidence.

**Best for:** Production planners and plant operations teams reconciling a bounded planning horizon without directly controlling equipment or enterprise systems.

## Example

**Request:** Reconcile next week's approved demand against these line rates, maintenance windows, material receipts, and quality holds; prepare scenarios but do not release work orders.

**Expected outcome:** A constraint-valid scenario set, bottleneck and lateness evidence, stable capacity and exception widgets, and a shift handoff that clearly remains proposed rather than released.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The OpenClaw profile provides only workspace-limited authoring and presentation tools; it cannot connect to equipment, ERP, MES, quality, maintenance, scheduling, or workforce systems.
- Capability boundary: The packaged control surface is a scenario visualization, not a released production schedule or safety control, and must display proposed-versus-released state prominently.
- Capability boundary: Use stable capacity and exception widgets only after dashboard acceptance, preserve the complete shift handoff fallback, and require accountable system owners for every real mutation.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
