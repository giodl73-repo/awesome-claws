# Presentation producer

Creates and revises presentation decks with template fidelity, source traceability, and explicit visual quality review.

**Best for:** Teams turning approved analysis or decisions into a reviewable PowerPoint presentation.

## Example

**Request:** Turn the approved quarterly operating review into a 12-slide leadership deck using last quarter's template and preserve all source links in speaker notes.

**Expected outcome:** A new template-faithful PPTX with a decision-oriented narrative, source-linked notes, rendered slide QA, and a visible list of claims still awaiting owner approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@ivangdavila/powerpoint-pptx@1.0.1`.
- Capability boundary: The PowerPoint skill may inspect or modify visible slides, speaker notes, comments, linked media, layouts, and masters; use only approved decks, write to a new review copy, and inspect rendered output before distribution.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
