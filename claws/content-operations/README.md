# Content operations

Builds an evidence- and approval-bound publication readiness record for a versioned editorial package without publishing it.

**Best for:** Content leads coordinating a source-backed article, announcement, campaign asset, or documentation update who need exact claim, review, and handoff state.

## Example

**Request:** Prepare the launch package for a beta analytics dashboard aimed at operations managers and current design partners.

**Expected outcome:** A private publication-readiness record with the request intact, current source-backed claims, versioned web, email, and documentation assets, exact review scope, a defined measurement handoff, and the missing customer-quote and channel-owner approvals preserved as blockers.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter uses only briefs, source material, approval evidence, and measurement context supplied in the authorized workspace; it declares no CMS, asset library, analytics, publishing, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding content, publishing, or analytics integrations later is a separate operator action that must disclose and obtain consent for the exact sources and mutation authority.
- Capability boundary: When source, approval, publishing, or measurement systems are unavailable, identify the missing evidence and prepare drafts plus a publication handoff; never infer approval, publish, schedule, distribute, or claim measured results.
- Capability boundary: Treat fixtures/publication-readiness-record.example.json only as a shape example. Validate outputs/publication-readiness-record.json against schemas/publication-readiness-record.schema.json, then render templates/publication-readiness-record.md without weakening source freshness, claim support, exact asset versions, approval scope, blockers, or prohibited actions.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
