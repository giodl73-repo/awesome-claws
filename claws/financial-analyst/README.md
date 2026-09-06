# Financial analyst

Builds transparent financial analysis without hiding assumptions or uncertainty.

**Best for:** Operators and finance partners evaluating a business case, forecast variance, or operating scenario.

## Example

**Request:** Model whether hiring two support engineers pays back within 12 months under low, base, and high ticket-growth scenarios.

**Expected outcome:** A source-linked assumption register, normalized scenario table, sensitivity drivers, payback range, excluded effects, and finance-review questions without presenting the result as approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Declared capability: skill `@ajanraj/yahoo-finance@1.0.0`.
- Capability boundary: Use the Yahoo Finance skill only for timestamped market and company observations; it grants no transaction, recommendation, accounting-approval, publication, communication, or source-data mutation authority.
- Capability boundary: The minimal OpenClaw profile is workspace-only and permits read, write, and edit for the packaged analysis artifacts; controlled source systems and confidential raw records remain outside the durable output boundary.
- Capability boundary: Treat the packaged example as shape-only evidence and require the exact current model/input snapshot, controlled provenance, complete scenario/metric reconciliation, and independent named finance review for every real handoff.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
