# Operating workflow

## Start here

Ask for or confirm:

- One exact opportunity snapshot and immutable quote revision with stable ids, revisions, issued and expiry times, currency, complete line index, and externally authenticated content digests
- Exact approved product-configuration, product-catalog, price-book, discount-policy, margin-policy, approval-matrix, licensing-rule, legal-baseline, dependency-register, authenticated approval/conflict-history, and destination-policy versions with evidence
- Every quote line with approved configuration, SKU, quantity, term, list, net, cost, discount, margin, dependency, and licensing bindings expressed in integer minor units and basis points
- Complete per-line and quote-level finding and exception universes, current and historical approvals, conflicts, revocations, supersession chronology, and reciprocal evidence
- Named principals and roles separating seller, quote owner, source-system custodian, pricing approver, legal approver, licensing approver, destination approver, and order-readiness recipient
- Caller-supplied trusted zone-bearing RFC 3339 validation asOf, approved private destination, and a payload-bound blocked or ready-for-order-review handoff

## Included capability boundaries

- The profile grants only workspace read, write, edit, and inline presentation; it grants no CRM, CPQ, pricing, product, licensing, legal, contract, order, billing, finance, messaging, browser, shell, network, MCP, plugin, cron, signature, or mutation capability.
- Opportunity, quote, product, price-book, policy, approval, licensing, legal, order, and finance systems remain authoritative external trust roots; content digests prove internal binding only, not source authenticity or semantic correctness.
- Pricing, legal, and licensing owners retain their independent approval and interpretation authority; the coordinator may verify supplied records but cannot create, renew, broaden, or resolve an approval.
- Malformed, omitted, duplicated, invented, stale, expired, superseded, revoked, conflicted, cross-revision, arithmetically inconsistent, incompletely covered, or destination-drifted state fails closed into exact blockers.

## Visual application contract

- Treat `assets/deal-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/commercial-deal-desk.json` and check it against `schemas/commercial-deal-desk.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/deal-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/commercial-deal-desk.md`.
- Read `outputs/deal-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Require a trusted asOf; verify immutable opportunity and quote identity, recompute the exact input-snapshot digest, and reject missing, duplicate, future, expired, cross-opportunity, cross-revision, or internally invented source anchors
2. Content-bind canonical product and quote-line payloads to authenticated source-record digests, carry their exact digest maps and root through coverage and handoff, and use BigInt arithmetic over schema-bounded safe integers
3. Reconcile the quote line universe against the approved configuration and catalog, price-book version and arithmetic, discount and margin thresholds, licensing rules, legal baseline deviations, dependencies, and quote validity
4. Require exactly one finding for every required line-domain cell and exactly one exception for every exception finding, then derive and exactly match the blocker ledger for every blocked cell, uncovered exception, open conflict, missing input, and expired quote
5. Reconcile approval-matrix requirements to exact exceptions and require separate current named-human pricing, legal, and licensing approvals bound to the opportunity, quote revision, quote digest, domain, scope, evidence, and validity interval
6. Bind the complete supplied approval and conflict ledgers plus every supersession and conflict edge to one authenticated immutable history input; order quote issuance, exceptions, evidence, decisions, conflicts, and handoff through trusted asOf
7. Recompute exact coverage and handoff bindings; emit ready-for-order-review only when the derived blocker universe is empty, otherwise emit blocked
8. Render the schema-valid X3 Markdown record and matching X4 inline visual while retaining all negotiation, customer communication, approval, legal, signature, booking, invoicing, contract, and revenue authority with named humans and owner systems

## Example setting

**Request:** Reconcile opportunity OPP-2048 and immutable quote revision Q-2048-R7 against the supplied approved configuration, catalog, price book, discount and margin policies, approval matrix, licensing rules, legal baseline, dependencies, validity windows, and independent approvals. Preserve conflicts and supersession chronology, cover every exception, and prepare only an order-readiness handoff. Do not negotiate, contact the customer, approve anything, reach a legal conclusion, sign, book, invoice, modify a contract, or claim revenue.

**Expected outcome:** A quote-revision-bound artifact with exact source and line arithmetic, complete eight-domain finding coverage, four exact exceptions, current independent pricing, legal, and licensing approval proof, visible superseded pricing history and resolved cross-revision conflict, and a ready-for-order-review handoff that structurally claims none of the reserved commercial actions.

## Standard deliverables

- Immutable opportunity, quote-revision, exact-input, principal, policy, product, line, evidence, and content-digest ledgers
- Complete configuration, price-book, discount, margin, licensing, legal-deviation, dependency, and validity finding matrix
- Exact exception register with independent pricing, legal, and licensing approval coverage plus conflict, revocation, and supersession chronology
- Exact coverage proof and destination-bound blocked or ready-for-order-review handoff with structural authority non-claims
- Accessible X4 deal-readiness visual with the authoritative X3 Markdown fallback

## Done when

- Every exact input, canonical product, and quote line is present once, content-bound to the one opportunity and quote revision, effective at trusted asOf, covered by reciprocal evidence, and sealed into exact payload maps and one coverage/handoff root
- Every line has exactly one configuration, pricing, discount, margin, licensing, legal, dependency, and validity finding, and every exception finding maps one-to-one to an exact exception
- Discount and margin basis points and list, net, and cost extensions recompute exactly in integer minor units against the current price book and approved thresholds
- Every pricing, legal, and licensing exception is covered by one current independent named-human approval with exact quote, revision, digest, domain, scope, chronology, evidence, and validity bindings
- The authenticated history indexes exactly equal the supplied approval and conflict ledgers and every supersession and conflict edge; quote issuance precedes exception, evidence, decision, conflict, and handoff events
- The blocker ledger equals the complete derived blocker universe, ready-for-order-review appears only when that universe is empty, coverage and handoff digests recompute, and all reserved authority claims remain not-claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
