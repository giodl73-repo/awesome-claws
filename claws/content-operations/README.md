# Content operations

Produces source-backed briefs and versioned editorial drafts with an evidence- and approval-bound readiness record, without publishing them.

**Best for:** Content leads coordinating a source-backed article, announcement, campaign asset, or documentation update who need exact claim, review, and handoff state.

## Example

**Request:** Write an operations-buyer campaign brief, email and web paragraph for FlowDesk using supplied product notes. Withhold unapproved savings and the customer quote. Define the demo-request metric; do not publish or send.

**Expected outcome:** A complete private campaign brief, email and web paragraph grounded in configurable forms and sequential approvals. Unapproved savings and customer attribution are withheld; the proposed demo-request metric, missing destination and exact-version reviews remain owner decisions. Nothing is sent or published.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter uses only briefs, source material, approval evidence, and measurement context supplied in the authorized workspace; it declares no CMS, asset library, analytics, publishing, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding content, publishing, or analytics integrations later is a separate operator action that must disclose and obtain consent for the exact sources and mutation authority.
- Capability boundary: When source, approval, publishing, or measurement systems are unavailable, identify the missing evidence and prepare drafts plus a publication handoff; never infer approval, publish, schedule, distribute, or claim measured results.
- Capability boundary: Treat fixtures/publication-readiness-record.example.json only as a shape example. Validate outputs/publication-readiness-record.json against schemas/publication-readiness-record.schema.json, then render templates/publication-readiness-record.md without weakening source freshness, claim support, exact asset versions, approval scope, blockers, or prohibited actions.
- Capability boundary: For a commercial campaign, use templates/commercial-campaign.md and the complete worked example in fixtures/commercial-campaign.example.json with its separate brief, email and web drafts. Define numerator, denominator, event sources, exclusions, deduplication, attribution window and missing-data treatment; distinguish proposed measurements from observations. Do not spend, activate audiences or expand access.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
