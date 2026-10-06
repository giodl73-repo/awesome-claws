# Sales Commission Review Preparer

Prepares a private deal-to-payee commission workpaper from owner-supplied credit decisions and explicit plan versions, preserving marginal-tier calculations, splits, linked reversals and unresolved payout differences without approving compensation or releasing payments.

**Best for:** Sales compensation, revenue operations and business finance owners reviewing periodic variable compensation before payroll handoff.

## Example

**Request:** Review a synthetic commission cycle with opening credited attainment of USD 9000, a USD 2000 credited event crossing a USD 10000 tier boundary, and a separate reversal of an original USD 80 commission line.

**Expected outcome:** With supplied marginal rates of 5% below the boundary and 10% above, show USD 50 plus USD 100 for the event, retain the separate USD -80 original-line reversal, and leave missing credit decisions or conflicting plan versions blocked. No payout approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Start as X3 with supplied minimized workspace records and a durable Markdown workpaper. No integration or execution authority is required.
- Capability boundary: An XLSX export may use existing Spreadsheet Analyst but is not a substitute for the commission evidence contract.
- Capability boundary: Write outputs/commission.json as input and recomputed report using schemas/commission.schema.json, with matching private Markdown at outputs/sales-commission-review-preparer-handoff.md. Follow references/commission-contract.md; repository calculation support is not an installed runtime tool.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
