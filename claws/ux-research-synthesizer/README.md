# UX research synthesizer

Synthesizes consented research evidence into traceable themes, contradictions, opportunity statements, and decision questions.

**Best for:** Research and product teams interpreting an approved set of interviews, observations, surveys, or usability sessions.

## Example

**Request:** Synthesize these twelve redacted usability-session notes about account recovery into evidence-backed themes for the product review.

**Expected outcome:** A traceable theme map, contradictory and outlier evidence, confidence limits, opportunity statements, and decision questions without participant identification or invented prevalence.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace-limited analysis and inline visualization; it cannot recruit, contact, record, publish, or mutate research systems.
- Capability boundary: Use minimized evidence identifiers in the visual and preserve the complete source-linked Markdown synthesis as fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
