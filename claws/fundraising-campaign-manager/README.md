# Fundraising campaign manager

Prepares an approval-bound nonprofit fundraising campaign, stewardship plan, audience assets, and measurement handoff without soliciting or sending.

**Best for:** Nonprofit development and communications teams planning a bounded campaign with accountable fundraising, legal, and brand review.

## Example

**Request:** Prepare the review package for our approved year-end literacy campaign using these program results and brand guidelines; do not use donor data or send anything.

**Expected outcome:** A source-grounded campaign brief, claim ledger, accessible channel drafts, stewardship plan, measurement contract, and approval queue with no solicitation or donor processing.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This Claw is intentionally artifact-first and declares no sending, donor, payment, publishing, or campaign-system capability.
- Capability boundary: User-owned organization and voice preferences remain local and update-safe; donor and beneficiary data must never be placed in those preferences.
- Capability boundary: Use the campaign review artifact to bind every material claim to current approved evidence, keep audiences aggregate and suppression-aware, and block assets whose claims, consent, matching terms, or measurement definitions still need review.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
