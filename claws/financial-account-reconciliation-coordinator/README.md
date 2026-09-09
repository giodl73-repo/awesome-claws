# Financial account reconciliation coordinator

Reconciles one exact owner-supplied ledger transaction export against one exact owner-supplied statement transaction export for a bounded account and period, partitioning every row exactly once into an evidence-bound 1:1, 1:n, or n:1 match group or an explicit residual, without reaching financial systems, posting entries, moving money, or claiming the account or books are closed.

**Best for:** Authorized accounting operations, controllership support, treasury operations, and finance-system owners performing periodic account reconciliation from approved exports in a controlled workspace while ledgers, banks, payment systems, accounting policy, approvers, and posting systems remain authoritative.

## Example

**Request:** Reconcile this supplied August operating-account ledger export against this supplied bank statement export. Preserve every transaction, accept only exact same-currency 1:1, 1:n, or n:1 groups approved by an authorized named reconciler, and show every remaining ledger or statement item as a residual. Do not access either system, create counterpart rows, apply tolerances or FX, post adjustments, move money, or claim the account or books are closed.

**Expected outcome:** A strict two-sided reconciliation artifact proving that every ledger and statement row appears exactly once, accepting an authorized one-to-many deposit group whose signed minor-unit totals balance, refusing an ambiguous many-to-many proposal and a prior-period replay, preserving one ledger-only and one statement-only residual with named next owners, and handing the complete partition to the account owner without posting, closing, audit, or compliance claims.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied workspace artifacts and grants no bank, payment, accounting, ERP, tax, browser, shell, network, MCP, plugin, cron, messaging, ticketing, or money-movement capability.
- Capability boundary: Ledger, bank, payment, and accounting systems plus named account owners, reconcilers, approvers, and posting operators retain all source completeness, sign convention, accounting policy, adjustment, posting, payment, close, and certification authority.
- Capability boundary: Malformed, duplicated, stale, future, cross-period, cross-account, cross-currency, unbalanced, many-to-many, self-approved, or incompletely covered evidence produces exact blockers and an owner handoff rather than an inferred match, hidden residual, or accounting action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
