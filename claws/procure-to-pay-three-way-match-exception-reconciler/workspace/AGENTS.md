# Operating workflow

## Start here

Ask for or confirm:

- One purchase order, exact current revision, prior-revision reference, owner-approved amendment, currency, and complete PO line export
- Complete receipt and return line export plus complete invoice and credit line export at a caller-controlled cutoff
- Immutable owner source identity triples for every PO, receipt, return, invoice, and credit line
- Owner-approved exact matching policy and typed grants scoped to the purchase order, currency, revision, role, and active interval
- Caller-supplied trusted zone-bearing RFC 3339 cutoff and validation asOf plus the named exception owner and private review destination

## Included capability boundaries

- The profile grants workspace read, write, edit, inline presentation, and workspace-local execution solely for the packaged deterministic validator; it grants no ERP, procurement, receiving, invoice, accounting, tax, payment, messaging, browser, network, MCP, plugin, cron, or source-mutation capability.
- Run node scripts/procure-to-pay-three-way-match-validator.mjs against the bounded artifact with explicit --workspace-root, --as-of, --cutoff, and --owner-trust-policy arguments before accepting any match or residual state.
- Owner systems and named humans retain source completeness and authenticity, policy and amendment approval, exception disposition, accounting and tax interpretation, posting, payment, receipt creation, supplier communication, and every mutation.
- The X4 visual is a projection of the schema-valid X3 record; the Markdown handoff remains the complete accessible fallback.
- Malformed, omitted, duplicated, split, reused, stale, future, cross-revision, cross-currency, reversal-invalid, arithmetically inconsistent, incompletely covered, or root-drifted evidence fails closed.

## Visual application contract

- Treat `assets/three-way-match-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/procure-to-pay-three-way-match.json` and check it against `schemas/procure-to-pay-three-way-match.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/three-way-match-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/procure-to-pay-three-way-match.md`.
- Read `outputs/three-way-match-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify the caller-controlled cutoff, current PO revision, prior revision, amendment, matching policy, named principals, and target-bound grants
2. Recompute all three exact line manifests while preserving opaque source-system, export, and source-native line identifiers
3. Validate return and credit lineage against the exact earlier source line with matching PO line, revision, currency, unit, and chronology
4. Evaluate only one-PO-line groups with exact referenced receipt and invoice lines using signed integer quantities and integer minor units
5. Consume every line exactly once in an allowed three-sided group or evidence-derived side residual, rejecting omission, reuse, row splitting, stale revision, and false residualization
6. Bind policy, amendment, revision, decisions, manifests, coverage, residuals, and authority non-claims into one partition root and produce a blocked, pending-owner-review, or accepted-for-owner-review handoff

## Example setting

**Request:** Reconcile PO-450 revision 2 and its approved amendment against these complete receipt and invoice exports at the supplied cutoff. Preserve split receipts, the return, partial invoices, the credit, and every unmatched line. Accept only exact owner-approved three-way groups; do not post, pay, create receipts, contact the supplier, interpret tax or accounting treatment, or change any source.

**Expected outcome:** A partition-root-bound review with two exact authorized three-sided groups, one PO-side residual, complete source-line identity and reversal evidence, zero hidden or reused lines, and no posting, payment, supplier-contact, interpretation, or mutation claim.

## Standard deliverables

- Exact PO, receipt, and invoice line manifests with immutable owner source identities
- Owner-approved policy, amendment, revision, and typed grant ledger
- Authorized exact three-sided match-group register with reversal lineage and deterministic arithmetic
- Complete side-specific residual and structured blocker register
- Partition-root-bound X3 handoff and matching accessible X4 exception-review visual

## Done when

- The current PO revision and amendment payloads, owner matching policy, scoped grants, and caller-controlled time all validate exactly
- All three line manifests recompute and every source identity triple is unique within its owner export
- Every return and credit is either bound to its exact earlier source line or preserved as a side-specific residual
- Every PO, receipt, and invoice line is consumed exactly once by an allowed one-PO-line three-sided group or one side-specific residual
- Every accepted group has equal net integer quantities, exact current PO unit price, equal invoice and PO minor-unit amounts, and a current named-human decision bound to policy and manifests
- The blocked, pending-owner-review, or accepted-for-owner-review handoff recomputes from the complete partition root and structurally claims no accounting, tax, posting, payment, receipt-creation, supplier-contact, or mutation authority

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
