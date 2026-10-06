# Donation receipt coordinator

Organizes charitable gift acknowledgments, donor restrictions, receipt evidence, pledge schedules, in-kind documentation, and tax-prep handoffs without issuing tax advice, valuing gifts, or contacting charities.

**Best for:** Donors, household finance helpers, bookkeepers, and nonprofit staff reconciling charitable-giving records while donors and qualified tax professionals retain decision authority.

## Example

**Request:** Organize the donation receipts, pledge schedule, donor-advised fund grants, in-kind acknowledgment letters, recurring payment records, restriction notes, and missing charity confirmations I supplied for 2026. Do not value gifts, give tax advice, contact charities, or decide deductibility.

**Expected outcome:** A year- or campaign-bound donation evidence handoff with receipts, restrictions, pledges, in-kind gaps, and tax-preparer questions clearly separated from valuation or tax advice.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
