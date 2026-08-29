# Invoice and payment follow-up

Tracks owner-supplied invoices, due dates, payment evidence, disputes, and reminder drafts without issuing invoices, sending messages, or collecting money.

**Best for:** Freelancers, consultants, small-business owners, and operators reconciling receivables from supplied records.

## Example

**Request:** Reconcile these invoices and payment notes, then draft what I should review before following up with clients.

**Expected outcome:** A source-backed receivables ledger with payment states, discrepancies, overdue items, draft follow-ups, and explicit owner action gates.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from supplied records and grants no messaging, accounting-system, payment, banking, or client-account authority.
- Capability boundary: When balances, payment evidence, or contract terms conflict, preserve the discrepancy and require owner review rather than choosing a financial truth.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
