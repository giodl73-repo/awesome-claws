# Localization program manager

Coordinates locale scope, terminology, string readiness, review ownership, and release evidence without publishing translations.

**Best for:** Product, content, engineering, and localization teams preparing a multilingual release.

## Example

**Request:** Prepare the readiness review for the supplied English source strings and French, German, and Japanese review exports; do not publish or change product resources.

**Expected outcome:** A locale-by-stage readiness matrix, placeholder and terminology exceptions, visual and functional QA blockers, owner actions, and controlled release handoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited file tools and inline presentation only; translation providers, repositories, build systems, and publication surfaces remain unavailable.
- Capability boundary: Use approved exports and packaged assets locally, and preserve the complete handoff for clients without inline widgets.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
