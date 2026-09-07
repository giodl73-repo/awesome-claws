# Records retention and disposition coordinator

Reconciles an authoritative retention schedule, exact record-copy inventory, trigger and hold evidence, approved disposition batch, independently observed outcomes and certificates, and residual-copy closure into one snapshot-bound human-review handoff without interpreting policy or executing disposition.

**Best for:** Authorized records-operations staff coordinating an exact supplied inventory snapshot with named records, legal, approval, custody, execution-observation, and residual-closure owners in an approved workspace and destination.

## Example

**Request:** Reconcile supplied SNAP-RET-2026-0907-A for the approved schedule version, synthetic finance records and every known copy, event triggers, hold and exception evidence, approved batch, custodian outcomes, independent certificates, and residual backups. Show whether owner action is blocked, ready, or completely reconciled, but do not interpret policy, release holds, approve, delete, move, contact anyone, or claim compliance.

**Expected outcome:** A strict snapshot-bound lifecycle artifact that proves the supplied schedule, record-copy lineage, trigger calculation, hold precedence, independent exception and batch decisions, append-only custody, observed outcome certificates, and residual closure, with exact blockers and no autonomous disposition or compliance claim.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied workspace artifacts and grants no browser, shell, MCP, plugin, cron, messaging, delegation, eDiscovery, records-system, repository, movement, transfer, deletion, or destruction capability.
- Capability boundary: Named records, legal, approval, custody, execution-observation, exception, and risk owners retain all schedule, classification, trigger, hold, exception, approval, execution, certification, closure, legal-interpretation, compliance, and risk authority.
- Capability boundary: Malformed, missing, stale, contradictory, incomplete, broader-scope, unobserved, partial, failed, unknown, or residual evidence produces exact blockers and a concise owner handoff rather than ceremony or an inferred success state.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
