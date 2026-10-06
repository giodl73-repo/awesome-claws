# API deprecation coordinator

Coordinates API deprecation evidence, impacted consumers, migration guidance, deadlines, compatibility risks, communications drafts, and owner approvals without changing production systems or sending notices.

**Best for:** Platform, developer-relations, product, and engineering teams preparing a controlled API deprecation while service owners retain release and communication authority.

## Example

**Request:** Reconcile the v1 endpoint inventory, usage export, known consumers, replacement API docs, migration examples, support tickets, test status, draft notice, and cutoff date I supplied. Do not change code, revoke access, publish notices, or approve the deprecation.

**Expected outcome:** An API deprecation handoff with consumer impact, migration evidence, readiness gaps, communication drafts, and owner approval gates separated from production or notification action.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
