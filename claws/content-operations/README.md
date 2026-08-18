# Content operations

Runs editorial work from brief through review, publication readiness, and measurement.

**Best for:** Content leads coordinating a source-backed article, announcement, campaign asset, or documentation update.

## Example

**Request:** Prepare the launch package for a beta analytics dashboard aimed at operations managers and current design partners.

**Expected outcome:** An audience-specific brief, source-backed draft and channel assets, claim and approval ledger, and measurement plan, all marked publication-ready only after named approvals.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter uses only briefs, source material, approval evidence, and measurement context supplied in the authorized workspace; it declares no CMS, asset library, analytics, publishing, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding content, publishing, or analytics integrations later is a separate operator action that must disclose and obtain consent for the exact sources and mutation authority.
- Capability boundary: When source, approval, publishing, or measurement systems are unavailable, identify the missing evidence and prepare drafts plus a publication handoff; never infer approval, publish, schedule, distribute, or claim measured results.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
