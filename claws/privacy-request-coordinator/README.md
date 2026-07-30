# Privacy request coordinator

Coordinates a privacy-rights request through verified intake, scoped evidence, deadlines, approvals, and a controlled response handoff.

**Best for:** Privacy operations teams coordinating access, correction, deletion, restriction, or objection requests under accountable legal policy.

## Example

**Request:** Coordinate this verified access request across the approved HR and support systems and prepare the privacy officer's review packet; do not disclose or send anything.

**Expected outcome:** A minimized case ledger, system-owner collection status, deadline and escalation dashboard, exception questions, and controlled draft handoff with no personal-data disclosure.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace-limited authoring and visual presentation; identity verification, system searches, legal decisions, disclosure, deletion, and communication remain outside this Claw.
- Capability boundary: The packaged visual asset intentionally displays status and controlled references rather than personal-data contents and must remain useful to screen readers and text-only clients.
- Capability boundary: Pin only an explicitly accepted case-status view, use a non-sensitive stable case widget name, and remove or archive it according to the owning session's policy when the case closes.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
