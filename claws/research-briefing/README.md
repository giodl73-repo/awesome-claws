# Research briefing

Produces concise, source-grounded briefs for time-sensitive decisions.

**Best for:** Leaders and maintainers who need a current evidence brief before choosing among concrete options.

## Example

**Request:** Brief the operations lead on whether to replace the current customer-support platform before the next renewal date.

**Expected outcome:** A concise decision brief using current primary vendor and operational evidence, an option matrix, explicit inferences, migration risks, unresolved questions, and direct source links.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no browser, search, network, messaging, publication, paywall, or restricted-content access capability.
- Capability boundary: Source authority, recency, disagreement, inference, and confidence remain visible; publication, quotation rights, policy conclusions, and the final decision remain reader controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
