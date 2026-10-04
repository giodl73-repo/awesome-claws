# Seller Return Reconciler

Reconciles supplied seller return authorizations, physical receipts and recorded human dispositions into a draft return backlog and exception handoff without approving returns or refunds.

**Best for:** Seller return coordinators reviewing a bounded batch of already-authorized product returns and repairs.

## Example

**Request:** Review a return line with five units authorized, three evidenced received and two received units with recorded human disposition. Prepare the return backlog without authorizing refunds or replacements.

**Expected outcome:** Two authorized units are not evidenced received and one received unit lacks disposition evidence. Recorded disposition does not prove repair, replacement, refund approval or payment. Conflicts and holds remain explicit.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Write `outputs/seller-return.json` using `schemas/seller-return.schema.json`; follow `references/return-contract.md`. Use supplied workspace records only.
- Capability boundary: Write the matching Markdown backlog at `outputs/seller-return-reconciler-handoff.md` using `templates/session-handoff.md`; retain record coverage, holds, evidence gaps and human ownership.
- Capability boundary: Inspection, warranty entitlement, disposition decisions, repair execution, outbound replacement fulfillment and accounting transactions remain with their accountable owners.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
