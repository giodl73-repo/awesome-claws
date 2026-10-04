# Procure-to-Pay Three-Way Match Exception Reconciler

Reconciles one exact owner-approved purchase-order revision against complete receipt and invoice line exports, partitioning every line into an authorized exact three-sided group or a typed side-specific residual.

**Best for:** Authorized procurement operations, receiving operations, accounts-payable operations, and accountable finance owners reviewing purchase-order matching exceptions from approved exports.

## Example

**Request:** Reconcile PO-450 revision 2 and its approved amendment against these complete receipt and invoice exports at the supplied cutoff. Preserve split receipts, the return, partial invoices, the credit, and every unmatched line. Accept only exact owner-approved three-way groups; do not post, pay, create receipts, contact the supplier, interpret tax or accounting treatment, or change any source.

**Expected outcome:** A partition-root-bound review with two exact authorized three-sided groups, one PO-side residual, complete source-line identity and reversal evidence, zero hidden or reused lines, and no posting, payment, supplier-contact, interpretation, or mutation claim.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `exec`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace read, write, edit, inline presentation, and workspace-local execution solely for the packaged deterministic validator; it grants no ERP, procurement, receiving, invoice, accounting, tax, payment, messaging, browser, network, MCP, plugin, cron, or source-mutation capability.
- Capability boundary: Run node scripts/procure-to-pay-three-way-match-validator.mjs against the bounded artifact with explicit --workspace-root, --as-of, --cutoff, and --owner-trust-policy arguments before accepting any match or residual state.
- Capability boundary: Owner systems and named humans retain source completeness and authenticity, policy and amendment approval, exception disposition, accounting and tax interpretation, posting, payment, receipt creation, supplier communication, and every mutation.
- Capability boundary: The X4 visual is a projection of the schema-valid X3 record; the Markdown handoff remains the complete accessible fallback.
- Capability boundary: Malformed, omitted, duplicated, split, reused, stale, future, cross-revision, cross-currency, reversal-invalid, arithmetically inconsistent, incompletely covered, or root-drifted evidence fails closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
