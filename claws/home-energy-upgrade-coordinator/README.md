# Home energy upgrade coordinator

Reconciles home energy audit findings, contractor proposals, utility rebates, equipment specifications, permits, warranties, and owner decisions without recommending vendors, claiming savings, applying for rebates, or authorizing work.

**Best for:** Homeowners, renters with permission, property managers, and household helpers comparing supplied energy-upgrade evidence while owners retain spending and contractor authority.

## Example

**Request:** Reconcile the energy audit, heat pump quotes, insulation proposal, utility rebate forms, equipment spec sheets, permit notes, warranty terms, and contractor assumptions I supplied. Show comparison gaps and owners, but do not choose a vendor, claim savings, apply for rebates, sign contracts, or authorize work.

**Expected outcome:** A home energy upgrade evidence handoff that shows audit recommendations, proposal assumptions, rebate and permit dependencies, warranty terms, and owner-controlled next actions without advice or authorization.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
