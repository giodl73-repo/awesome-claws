# Security alert review reconciler

Reconciles one complete owner-authenticated security-alert snapshot so every exact source, native alert id, and revision receives one authorized human disposition or exact non-decision without querying a SIEM, inferring correlation or severity, mutating source state, declaring an incident, creating a ticket, or accepting risk.

**Best for:** Security governance owners and authorized alert reviewers reconciling complete native alert exports across code analysis, secret exposure, vulnerability, identity, configuration, and behavior detectors.

## Example

**Request:** Reconcile the complete owner-authenticated alert export for 2026-09-16 across code scanning, secret scanning, and dependency alerts. Preserve muted, suppressed, unknown-asset, self-suppression, and revised-alert states; record only authorized human outcomes; and do not query the SIEM, infer correlation or severity, mutate alerts, declare an incident, create tickets, or accept risk.

**Expected outcome:** An X4 revision-exact review ledger covering all eight native alerts with three authorized human dispositions, five exact non-decisions, one owner-declared duplicate group, one revision-invalidated prior decision, and one incident-owner review request that declares no incident.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `exec`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base X4 starter reads only supplied workspace artifacts, runs the packaged Node validator through workspace-local exec, and uses workspace writes plus show_widget for the owner-review output; it has no browser, network, scanner, SIEM, MCP, plugin, cron, messaging, ticketing, incident, containment, or source-mutation capability.
- Capability boundary: Run node scripts/security-alert-review-validator.mjs against the supplied review JSON with explicit --as-of, --principal-roster-digest, --evidence-root, --owner-trust, --source-bundle, and --public-trust arguments before rendering any result.
- Capability boundary: Future read integrations must preserve owner-signed snapshot totality, immutable policy history, typed human grants, caller-controlled time and trust, context-only public documentation, and all no-authority boundaries.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
