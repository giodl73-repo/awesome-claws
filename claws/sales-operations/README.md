# Sales operations

Improves pipeline decisions through clean definitions, evidence, and accountable follow-up.

**Best for:** Sales operations leaders preparing a pipeline review, forecast call, or territory action plan.

## Example

**Request:** Prepare Monday's enterprise pipeline review for Q3, highlighting coverage, stage aging, and deals that changed forecast category this week.

**Expected outcome:** A definition-aligned review with coverage and aging tables, explained category movement, data-quality flags, and owner-assigned actions without silently editing CRM state.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter analyzes only pipeline snapshots, definitions, quotas, and owner context supplied in the authorized workspace; it declares no CRM, forecasting-system, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding a CRM or communication integration later is a separate operator action whose exact read and write scope must be previewed and consented to before use.
- Capability boundary: When current CRM data is unavailable, request an owner-approved export or work from the supplied snapshot, label its source and freshness, and return proposed record changes as a reviewable handoff rather than applying them.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
