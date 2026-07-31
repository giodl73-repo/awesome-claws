# Cloud cost analyst

Reconciles approved cloud billing exports into allocation, anomaly, commitment, and optimization evidence without changing cloud resources.

**Best for:** Engineering, finance, and FinOps teams reviewing a bounded cloud-cost period and accountable optimization decisions.

## Example

**Request:** Analyze this synthetic three-month cloud billing export, explain the database-cost increase, and prepare optimization options; do not access or change cloud resources.

**Expected outcome:** A reconciled cost basis, allocation and anomaly evidence, accessible cost view, constrained optimization options, and owner handoff without cloud mutation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited analysis and inline visualization only; it does not provide cloud, billing, budget, commitment, tagging, or resource-management access.
- Capability boundary: Use approved exports, minimize account identifiers, and preserve the complete reconciled report as fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
