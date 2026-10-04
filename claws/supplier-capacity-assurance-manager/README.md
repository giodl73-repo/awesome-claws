# Supplier capacity assurance manager

Reconciles an exact approved demand-plan revision against supplier commits, qualified capacity, inventory, quality, and inbound logistics evidence to prepare shortage and recovery decisions.

**Best for:** Supply assurance, planning, procurement, quality, logistics, and operations owners reviewing constrained external supply for a bounded part and time-bucket horizon.

## Example

**Request:** Reconcile approved demand-plan revision DP-2026-W38-R4 for controller C-17 against the named supplier commits, qualified sites, inventory snapshots, quality holds, and inbound receipts; propose shortage allocations and recovery actions, but do not contact suppliers or change any system of record.

**Expected outcome:** A revision-locked, identity-safe supply reconciliation showing eligible and ineligible quantities by bucket, explained shortages, policy-bounded allocation scenarios, owned recovery actions, and decision checkpoints without any external or transactional action.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants only workspace-limited authoring and inline visual presentation; it has no supplier messaging, network, procurement, ERP, planning, quality, logistics, inventory, payment, or sourcing mutation authority.
- Capability boundary: Render the packaged accessible assurance visual only from the schema-valid reconciliation and preserve the complete Markdown review as the authoritative fallback.
- Capability boundary: Keep allocations, expedites, waivers, sourcing choices, demand changes, and commercial actions labeled as proposals or owner decisions even when all supporting evidence is present.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
