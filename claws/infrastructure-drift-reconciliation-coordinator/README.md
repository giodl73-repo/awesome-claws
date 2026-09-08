# Infrastructure drift reconciliation coordinator

Reconciles owner-supplied desired-state and observed-state infrastructure snapshots into one exact symmetric resource universe, with one evidence-backed converged, drifted, missing, or unmanaged disposition per resolved identity and fail-closed deviation authority, without accessing or changing infrastructure.

**Best for:** Authorized platform, infrastructure-governance, and cloud-operations staff reconciling approved desired-state and observed-state exports in a controlled workspace while configuration repositories, inventory systems, change systems, and named owners remain authoritative.

## Example

**Request:** Reconcile these supplied production IaC and cloud-inventory exports. Show every resource that is converged, drifted, missing, unmanaged, or blocked on unresolved identity, and verify whether the database deviation still binds both snapshots; do not access the cloud, run Terraform, change anything, approve risk, or claim compliance.

**Expected outcome:** A strict reconciliation artifact proving one disposition for every resolved resource in the symmetric union, preserving the inventory-only unmanaged resource, blocking an unevidenced IaC-to-provider identity match, revoking any deviation whose desired or observed snapshot digest changed or expired, and handing all interpretation and action to the named infrastructure owners.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied workspace artifacts and grants no browser, shell, network, cloud, IaC, registry, MCP, plugin, cron, messaging, ticketing, deployment, or infrastructure capability.
- Capability boundary: Configuration repositories, inventory systems, change systems, and named infrastructure and risk owners retain all identity, comparability, desired-state, remediation, deviation, acceptance, deployment, and closure authority.
- Capability boundary: Malformed, duplicated, unresolved, stale, future, mismatched, expired, self-approved, or incompletely covered evidence produces exact blockers and an owner handoff rather than inferred identity, hidden drift, or accepted deviation.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
