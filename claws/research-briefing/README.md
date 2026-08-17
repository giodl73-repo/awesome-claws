# Research briefing

Synthesizes supplied sources into concise, source-grounded briefs for time-sensitive decisions.

**Best for:** Leaders and maintainers who have a bounded source set and need an evidence brief before choosing among concrete options.

## Example

**Request:** Brief the operations lead on whether to replace the current customer-support platform before the next renewal date.

**Expected outcome:** A concise decision brief using the supplied vendor and operational evidence, an option matrix, explicit inferences, migration risks, unresolved questions, direct source links, and a visible source-set cutoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no browser, search, network, messaging, publication, paywall, or restricted-content access capability.
- Capability boundary: The user must supply the source set. If required evidence is absent or stale, report the gap and request it rather than searching externally or implying coverage.
- Capability boundary: Source authority, recency, disagreement, inference, and confidence remain visible; publication, quotation rights, policy conclusions, and the final decision remain reader controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
