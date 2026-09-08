# Access Entitlement Review Coordinator

Reconciles one exact owner-supplied access-assignment snapshot, bound to a locale-independent recomputed assignment-manifest digest, so that every in-scope principal, resource, entitlement, and assignment key carries exactly one fresh named-human retain or revoke recertification decision or one exact non-decision, with per-row reviewer authority, a content-bound owner authority roster, controlled evidence that content-addresses both its envelope and the exact semantic payload of the row it supports, a scoped non-subject handoff recipient, and a record that carries no free-text field at all, and without reaching identity systems, inferring effective access, carrying any prior decision forward, or changing access.

**Best for:** Authorized identity-governance, access-owner, and audit-support staff running a periodic entitlement recertification round over approved access exports in a controlled workspace, while IAM systems, resource and entitlement catalogs, HR and identity sources, access owners, reviewers, and executors remain authoritative.

## Example

**Request:** Coordinate our Q3 entitlement recertification from these supplied access exports. Show every in-scope assignment with its named-human retain or revoke decision for this round, prove each reviewer was authorized for that exact resource and entitlement by someone the owner roster names, keep the source-system inactivity and recommendation signals visible without letting them decide anything, and do not let last quarter's approvals stand in for this quarter's. Do not reach our directory, expand groups, compute effective access, change access, or claim we are compliant.

**Expected outcome:** A strict review artifact whose snapshot digest is the recomputed owner assignment manifest and whose authority roster is a content-bound custodian record, proving exactly one fresh named-human decision or one exact non-decision for every in-scope assignment key, refusing a service-account reviewer and an auto-applied default, keeping an owner-excluded workload-identity row visibly out of scope under a closed exclusion code, recording a privileged revoke by a reviewer who is neither its subject nor its grantor, recording a third current retain against a source-system deny recommendation, rendering the six access paths this snapshot does not cover, and handing execution to the named access owner with no replacement, modification, or field anywhere in which to claim the change was made.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied workspace artifacts and grants no directory, IAM, HR, cloud, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Capability boundary: IAM systems, resource and entitlement catalogs, HR and identity sources, access owners, reviewers, and executors retain all identity, scope, privilege, authority, alternative-access planning, and execution authority.
- Capability boundary: Malformed, duplicated, excluded, unscoped, expired, self-reviewed, machine-sourced, changed, stale, or incompletely covered evidence produces exact blockers and an owner handoff rather than an inferred decision, a hidden row, or an executed change.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
