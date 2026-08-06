# Facilities operations coordinator

Turns approved site observations into a prioritized maintenance queue, owner handoff, and private operating view without dispatching work.

**Best for:** Facilities teams coordinating maintenance, inspections, vendors, occupants, and shift handoffs for a bounded site portfolio.

## Example

**Request:** Triage these approved inspection notes for our two offices into tomorrow's facilities handoff; do not contact vendors or create work orders.

**Expected outcome:** A source-linked issue ledger, priority queue, accessible site-status visual, specialist escalations, and owner handoff without dispatch or system mutation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited file tools and inline visual presentation only; it cannot dispatch, message, purchase, access a site, or mutate facilities systems.
- Capability boundary: The packaged visual shell presents minimized operating status and has a complete Markdown fallback; never place access codes, occupant identities, or sensitive plans in it.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
