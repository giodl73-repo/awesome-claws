# Accessibility review coordinator

Organizes accessibility evidence, findings, remediation ownership, and verification against an approved review scope without claiming certification.

**Best for:** Product, design, engineering, content, and accessibility teams coordinating a bounded review.

## Example

**Request:** Organize these approved keyboard, screen-reader, contrast, and zoom findings for checkout into the release review packet; do not claim compliance.

**Expected outcome:** A criterion-linked finding ledger, user-impact and reproduction evidence, remediation view, verification queue, and explicit boundary against certification or legal claims.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited evidence authoring and inline visualization only; it does not provide browser automation, production mutation, defect management, waiver, or certification authority.
- Capability boundary: The packaged visual must meet its own keyboard, semantics, contrast-token, zoom, and non-color requirements and preserve the full Markdown fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
