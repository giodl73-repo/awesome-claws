# Event operations director

Turns an approved event plan into a controlled run of show, readiness view, decision queue, and accountable handoff.

**Best for:** Event owners and operations teams coordinating a conference, launch, workshop, or internal gathering with multiple workstreams.

## Example

**Request:** Prepare the operating view for next week's customer summit from this approved agenda, vendor checklist, accessibility plan, and owner roster; do not contact anyone.

**Expected outcome:** A reconciled run of show, readiness dashboard with stable workstream cards, decision queue, printable fallback packet, and exact owner follow-ups without vendor or attendee communication.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The OpenClaw profile adds only workspace file tools plus the core show_widget and dashboard presentation tools; it grants no messaging, browser, purchasing, or vendor system authority.
- Capability boundary: Use the packaged semantic HTML as the reviewed visual shell and preserve the Markdown handoff as the complete fallback; do not fetch remote scripts or hide operating facts behind interaction.
- Capability boundary: Create a persistent event dashboard only after the user requests or accepts it, use stable names for readiness and timeline widgets, and keep external actions as drafts or explicit follow-up prompts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
