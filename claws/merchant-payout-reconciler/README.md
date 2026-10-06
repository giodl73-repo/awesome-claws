# Merchant Payout Reconciler

Prepares a private processor-transaction-to-payout reconciliation with separate bank-receipt evidence, preserving gross, fees, net, unsettled activity and failed payout attempts without moving funds or claiming settlement from arithmetic alone.

**Best for:** Merchant finance and payment-operations owners reconciling processor exports and bank receipt evidence for a bounded settlement period.

## Example

**Request:** Reconcile synthetic payout P1 with a charge gross1000 fee30 net970, refund gross-100 fee0 net-100, and separate fee gross0 fee5 net-5; compare declared payout865 with bank receipt860 and retain a separate unsettled net194 transaction.

**Expected outcome:** P1's member net is865 and its bank receipt residual is-5. Unsettled194 remains separate. Matching the processor payout does not clear the bank residual or settle the remaining transaction.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: X3 using minimized supplied exports only, with no payment-provider integration or execution authority.
- Capability boundary: Manual and instant payouts require supplied attributable membership evidence; unsupported or ambiguous reports stay blocked.
- Capability boundary: Write `outputs/merchant-payout-review.json` using `schemas/merchant-payout.schema.json` and `references/reconciliation-contract.md`, then the private Markdown handoff. Validate both schema and arithmetic; supplied completeness assertions are not independent source authentication.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
