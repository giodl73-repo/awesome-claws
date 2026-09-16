# Commercial Deal Desk Coordinator

Reconciles one exact immutable seller quote revision across approved configuration, pricing, discount, margin, licensing, legal deviations, dependencies, validity, approvals, and order-readiness handoff.

**Best for:** Authorized seller-side deal-desk, sales operations, pricing, finance, licensing, legal operations, product operations, and order-management owners reviewing one exact opportunity and quote revision.

## Example

**Request:** Reconcile opportunity OPP-2048 and immutable quote revision Q-2048-R7 against the supplied approved configuration, catalog, price book, discount and margin policies, approval matrix, licensing rules, legal baseline, dependencies, validity windows, and independent approvals. Preserve conflicts and supersession chronology, cover every exception, and prepare only an order-readiness handoff. Do not negotiate, contact the customer, approve anything, reach a legal conclusion, sign, book, invoice, modify a contract, or claim revenue.

**Expected outcome:** A quote-revision-bound artifact with exact source and line arithmetic, complete eight-domain finding coverage, four exact exceptions, current independent pricing, legal, and licensing approval proof, visible superseded pricing history and resolved cross-revision conflict, and a ready-for-order-review handoff that structurally claims none of the reserved commercial actions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace read, write, edit, and inline presentation; it grants no CRM, CPQ, pricing, product, licensing, legal, contract, order, billing, finance, messaging, browser, shell, network, MCP, plugin, cron, signature, or mutation capability.
- Capability boundary: Opportunity, quote, product, price-book, policy, approval, licensing, legal, order, and finance systems remain authoritative external trust roots; content digests prove internal binding only, not source authenticity or semantic correctness.
- Capability boundary: Pricing, legal, and licensing owners retain their independent approval and interpretation authority; the coordinator may verify supplied records but cannot create, renew, broaden, or resolve an approval.
- Capability boundary: Malformed, omitted, duplicated, invented, stale, expired, superseded, revoked, conflicted, cross-revision, arithmetically inconsistent, incompletely covered, or destination-drifted state fails closed into exact blockers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
