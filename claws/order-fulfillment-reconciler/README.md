# Order Fulfillment Reconciler

Reconciles seller order lines with supplied shipment and delivery evidence into a draft open-order and exception handoff without releasing goods or contacting customers.

**Best for:** Seller operations coordinators reconciling a bounded batch of customer orders after order acceptance.

## Example

**Request:** Reconcile two orders for the same SKU. A ordered ten and cancelled two; six shipped and four are delivery-confirmed. B ordered eight; all eight shipped and are delivery-confirmed.

**Expected outcome:** A has two not shipped and two shipped without delivery confirmation; B has no outstanding quantity. Aggregate totals do not erase A's exception, and no shipment or customer contact is performed.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Write `outputs/fulfillment.json` using `schemas/fulfillment.schema.json`; follow `references/fulfillment-contract.md`. Use supplied workspace records only.
- Capability boundary: Write the matching Markdown handoff at `outputs/order-fulfillment-reconciler-handoff.md` using `templates/session-handoff.md`; retain source coordinates, balances, holds, blockers and human ownership.
- Capability boundary: Returns, replacements, inventory allocation, invoice production, transport optimization and customs documentation remain separate owner workflows.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
