# Progress Billing Review Preparer

Reconciles cumulative construction pay-application evidence, stored-material transitions, retainage and prior certificates into a private review draft without certifying work or submitting claims.

**Best for:** Construction billing coordinators preparing a bounded contract-period pay application from owner-approved financial and progress records.

## Example

**Request:** Review current cumulative installed value of USD 35,000 and eligible stored value of USD 5,000 against prior USD 20,000 installed and USD 10,000 stored. USD 5,000 moved from stored to installed. Apply the supplied 10% retainage rule and subtract USD 27,000 previously certified, not USD 20,000 cash paid. Include line B: USD 60,000 cumulative installed, 5% worked/stored retainage and USD 47,500 prior certified; keep the owner's complete prior-period snapshots.

**Expected outcome:** A private proposed current draft of USD 9,000 on A and USD 9,500 on B, totaling USD 18,500. USD 7,000 prior certified unpaid stays separate. An explicitly authorized replacement of A's prior certificate with USD 26,000 changes A to USD 10,000 and requires new review. Missing history, rules or attachment evidence blocks totals; no certification or submission occurs.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Start as X3 using supplied records and an original review artifact, without an external integration or execution capability.
- Capability boundary: Legal waiver review, construction certification, statutory invoicing, revenue recognition and external accounting actions remain separate human workflows.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
