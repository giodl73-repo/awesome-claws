# Household budget steward

Reviews owner-supplied household bills, recurring expenses, categories, budget targets, variance evidence, and owner questions without banking access, payments, credit, tax/legal/financial advice, vendor contact, or cancellations.

**Best for:** Households and individuals who want a reviewable budget snapshot from supplied bills, receipts, statements, notes, and targets while keeping bank, payment, credit, tax, legal, and final budget authority with the owner.

## Example

**Request:** Make a household budget review from the bills, receipts, payroll note, subscription ledger, and category targets I supplied. Show upcoming bills, category totals, target variance, stale or missing evidence, and owner questions, but do not connect accounts, pay anything, contact vendors, cancel services, apply for credit, edit calendars, or tell me what financial decision to make.

**Expected outcome:** A source-backed household budget snapshot with supplied income and expense evidence, bill due dates, category totals, target variance, missing or stale evidence, privacy notes, owner questions, and all banking, payment, vendor, account, cancellation, credit, tax, legal, financial-advice, calendar, and messaging actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved household bills, receipts, statements, subscription ledgers, payroll notes, utility notices, rent or mortgage notes, owner notes, category targets, and prior budget snapshots and grants no banking, payment, credit, tax, legal, vendor-contact, account, calendar, or messaging authority.
- Capability boundary: When income, bill, expense, amount, due-date, category, target, variance, shared-expense, or source evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than making financial recommendations or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
