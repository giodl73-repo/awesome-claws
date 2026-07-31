# Procurement evaluator

Builds a traceable vendor evaluation from approved requirements, evidence, risks, and accountable purchasing decisions.

**Best for:** Procurement, security, finance, legal, and business owners comparing a bounded vendor shortlist.

## Example

**Request:** Compare these three approved support-platform proposals against our requirements and evidence pack; do not contact vendors or choose one for us.

**Expected outcome:** A weighted but caveated comparison, source-linked evidence matrix, disqualifiers and unresolved specialist reviews, interactive decision card, and human-owned recommendation handoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace file tools and OpenClaw visual presentation tools; it cannot contact vendors, browse private portals, approve spend, or transact.
- Capability boundary: Populate the packaged accessible comparison shell from the schema-valid evaluation and preserve the Markdown decision record as the authoritative fallback.
- Capability boundary: Pin a comparison only when the user wants an ongoing evaluation board; use one stable vendor-comparison widget and never hide missing evidence behind a composite score.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
