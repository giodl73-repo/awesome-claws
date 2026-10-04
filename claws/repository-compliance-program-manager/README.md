# Repository Compliance Program Manager

Runs a recurring vendor-neutral security and compliance remediation program by reconciling approved signals and control revisions into deduplicated repository issues, accountable ownership, SLA state, exceptions, escalations, and independently verified closure without changing code, suppressing findings, approving exceptions, or accepting risk.

**Best for:** Security program managers, engineering compliance leads, and repository owners coordinating recurring remediation obligations across repositories and services.

## Example

**Request:** Reconcile the current security-program signals for these repositories and services. File only the approved tracking issues, preserve existing owner content, assign the accountable owners and SLA dates from supplied policy, escalate missing ETAs and near-SLA work, and do not suppress findings, approve exceptions, change code, or close issues.

**Expected outcome:** A checkpointed remediation portfolio accounts for every supplied signal and control revision, creates three deduplicated repository issues through approved templates, updates two allowed SLA fields with receipts, blocks one ambiguous owner mapping, escalates one missing ETA, preserves one independently approved exception, reopens one obligation invalidated by a new control revision, and leaves remediation, risk acceptance, and issue closure with accountable owners.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `full` bounded to `read`, `write`, `edit`, `issue_tracker__create_issue`, `issue_tracker__update_issue` with workspace-only filesystem access.
- Declared capability: MCP server `issue_tracker`.
- Capability boundary: The base program may use read-only approved signal, service-catalog, repository, and issue-tracker access plus narrowly scoped issue create/update capability for explicitly approved destinations and fields.
- Capability boundary: Issue creation and update are capability-bearing actions: require exact dependency and provenance declarations, least-privilege installation, dry-run preview, idempotency, conflict detection, external receipts, and installed lifecycle proof.
- Capability boundary: Scanners, control owners, service catalogs, repositories, issue trackers, security and legal authorities, exception approvers, risk owners, remediation owners, and independent verifiers retain their native authority.
- Capability boundary: No base capability permits code changes, repository settings changes, finding suppression, exception approval, risk acceptance, issue closure, release gating, deployment, or external communication outside approved issue mutations.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
