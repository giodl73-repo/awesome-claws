# Repository Operations Manager

Supervises an approved repository portfolio by reconciling pull requests, head-bound reviews and checks, builds, release trains, cross-repository dependencies, human approval decisions, and trusted system deadline observations without making owner decisions or performing repository mutations.

**Best for:** Engineering managers, staff engineers, release owners, and maintainers supervising recurring delivery across multiple repositories.

## Example

**Request:** Supervise these twelve repositories for the weekly release train. Reconcile open PRs, required reviews, CI and release state, identify cross-repository blockers, and escalate only the approvals named in our supplied routing policy. Do not merge, rerun, publish, deploy, waive, or approve anything.

**Expected outcome:** A checkpointed portfolio ledger binds each PR to its current head, checks, reviews, build and release-train state; exposes one stale review, one failed build, one cross-repository ordering conflict, and three exact human approval requests; records one approval and one rejection as eligible human decisions plus one post-deadline no-response observation from an approved trusted system; and leaves every repository mutation and terminal decision to its accountable owner.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Use read-only repository and CI access for portfolio reconciliation; repository permissions and host policy remain the upper bound.
- Capability boundary: V1 has no messaging capability. It may reconcile only owner- or system-supplied dispatch receipts for exact approval requests sent through approved destinations, categories, recipients, templates, deadlines, and idempotency rules; a receipt is distinct from approval.
- Capability boundary: Human decision authority and trusted system deadline-observation authority are separate exact category scopes in the approved principal roster; neither scope permits the Claw to decide or observe a response.
- Capability boundary: Require exact separate authority for every repository mutation, build action, merge, release, publication, deployment, or settings change; the base operating contract performs none of them.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
