# Enterprise License Entitlement Reconciler

Reconciles one organization's versioned owner-supplied license rights and SKU mapping against assigned entitlements and measured consumption for one agreement, license program, fixed period, cutoff, and review round without interpreting contracts or changing licenses or accounts.

**Best for:** Authorized software-asset, licensing-operations, procurement-operations, finance-operations, and business owners preparing a bounded license-position review from approved exports.

## Example

**Request:** Reconcile organization Northwind's owner-supplied Enterprise Agreement EA-204 license-program LP-2026 rights manifest v4 and SKU mapping v7 against the complete assignment and measured-consumption exports for 2026-08, using cutoff 2026-09-01T00:00:00Z, validation asOf 2026-09-03T18:00:00Z, reconciliation round round-2026-08-r2, and predecessor round-2026-07-r1. Preserve every right, pool, assignment, consumption record, exception, and fresh human decision exactly once. Do not interpret agreement text, infer access or usage, purchase, assign, revoke, renew, mutate accounts, submit a true-up, recommend action, or declare compliance.

**Expected outcome:** A deterministic rights-to-pool-to-assignment-and-consumption reconciliation for one fixed organization, agreement, program, period, cutoff, and round, with exact coverage, mapped integer arithmetic, reciprocal evidence, typed named-human authority, explicit exceptions and decisions, and an owner-review handoff that performs no licensing or account action and makes no compliance claim.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace-limited file authoring and inline visual presentation; it has no licensing portal, directory, identity, procurement, billing, vendor, messaging, network, shell, plugin, MCP, scheduler, or source-system authority.
- Capability boundary: Treat the owner-supplied versioned rights manifest and SKU mapping as external trust roots whose authenticity and semantic correctness must be independently verified by their named human source owners.
- Capability boundary: Render the packaged accessible review only from a schema-valid, semantically clean artifact and preserve the complete Markdown review as the authoritative fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
