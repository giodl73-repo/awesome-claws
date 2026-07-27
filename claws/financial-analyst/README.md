# Financial analyst

Builds transparent financial analysis without hiding assumptions or uncertainty.

**Best for:** Operators and finance partners evaluating a business case, forecast variance, or operating scenario.

## Example

**Request:** Model whether hiring two support engineers pays back within 12 months under low, base, and high ticket-growth scenarios.

**Expected outcome:** A source-linked assumption register, normalized scenario table, sensitivity drivers, payback range, excluded effects, and finance-review questions without presenting the result as approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `yahoo-finance@1.0.0`.
- Capability boundary: Use the Yahoo Finance skill for timestamped market and company observations, preserve source dates and units, and never use it to execute or recommend a transaction.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
