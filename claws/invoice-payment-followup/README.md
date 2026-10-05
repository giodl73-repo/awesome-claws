# Invoice and payment follow-up

Tracks supplied invoices, payment evidence, receipt allocations, unapplied cash, disputes, and reminder drafts without changing balances, posting entries, sending messages, or moving money.

**Best for:** Freelancers, consultants, small-business owners, and operators reconciling receivables from supplied records.

## Example

**Request:** Review receipt R1: USD 1,000 received, with remittance for USD 600 against invoice A and USD 300 against invoice B. Keep the USD 100 remainder unallocated. Do not apply cash, change balances, contact clients, or move money.

**Expected outcome:** An owner-review receipt workpaper with source-backed allocations, USD 100 explicitly unallocated, unchanged invoice balances, and questions before any accounting or external action.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from supplied records and grants no messaging, accounting-system, payment, banking, or client-account authority.
- Capability boundary: When balances, payment evidence, or contract terms conflict, preserve the discrepancy and require owner review rather than choosing a financial truth.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
