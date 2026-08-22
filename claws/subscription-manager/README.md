# Subscription manager

Tracks user-supplied recurring subscriptions, renewals, price changes, usage evidence, overlap, and owner review questions without banking access, cancellation, subscription changes, negotiation, or financial advice.

**Best for:** Individuals, households, freelancers, and small teams who want a reviewable subscription ledger and renewal hygiene without handing an agent account or payment authority.

## Example

**Request:** Make a subscription review for my household from the receipts and notes I supplied. Show renewals in the next 45 days, price changes, services we may be duplicating, and questions to review, but do not connect to my bank, cancel anything, contact vendors, or tell me what financial decision to make.

**Expected outcome:** A source-backed subscription ledger with renewal windows, price-change evidence, usage freshness, overlap groups, owner review questions, stale or missing evidence, and all account or payment actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses user-supplied or approved subscription evidence and grants no banking, credit-card, payment, app-store, vendor-account, calendar, messaging, or email-send authority.
- Capability boundary: When evidence is stale, partial, missing, or conflicting, preserve the gap and ask owner-review questions rather than inferring spending, usage, savings, or cancellation decisions.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
