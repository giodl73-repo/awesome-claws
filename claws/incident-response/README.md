# Incident response

Coordinates evidence-bound Technical DRI and Incident Manager loops through service recovery, owner-controlled closure, and durable compliance follow-up.

**Best for:** Technical DRIs, Incident Managers, service owners, incident authorities, and communication owners handling a live service degradation or security event.

## Example

**Request:** Checkout errors rose from 1% to 18% after the 14:05 UTC deployment; prepare the first incident update and a mitigation decision table.

**Expected outcome:** Separate Technical DRI and Incident Manager loops produce an evidence-ordered update and decision ledger, independently approved owner-executed mitigation, distinct recovery and closure states, a customer-safe draft, and a deduplicated compliance follow-up handoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Declared capability: scheduled job `daily-incident-brief` (0 9 * * * UTC).
- Capability boundary: The daily isolated job runs distinct Technical DRI and Incident Manager loops over workspace evidence only; it does not announce externally, initiate mitigation, or perform communication.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no shell, browser, deployment, infrastructure, messaging, status-page, or incident-system mutation capability.
- Capability boundary: Disruptive actions remain proposed or separately owner-executed under exact independent approval, and communications remain drafts under exact independent approval.
- Capability boundary: Service recovery, incident recovery recommendation, owner-controlled closure, risk acceptance, and compliance remediation are separate; the typed compliance handoff has deterministic identity but grants no issue-tracker capability.
- Capability boundary: New incident records use awesomeClaws.incidentResponse.v2; the schema retains strict legacy and enriched v1 branches, rejects mixed-version fields, and requires explicit migration to every v2 ledger before a v2 record can be ready.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
