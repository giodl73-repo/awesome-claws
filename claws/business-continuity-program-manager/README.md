# Business Continuity Program Manager

Maintains one exact owner-supplied critical-process universe through recurring business-impact analysis, owner-approved recovery requirements, dependency mapping, continuity-plan revisions, exercises, findings, corrective actions, exceptions, and independent recertification without declaring disasters, invoking plans, executing recovery, accepting risk, or certifying readiness.

**Best for:** Business continuity program managers, resilience governance leads, critical-process owners, dependency owners, exercise coordinators, and independent recertifiers maintaining an evidence-bound continuity program.

## Example

**Request:** Run the quarterly continuity-program reconciliation over this exact critical-process register, approved BIA exports, dependency attestations, plan revisions, and exercise evidence. Preserve findings, corrective-action receipts, exceptions, and recertification state, but do not invoke a plan, contact vendors, fail over anything, approve exceptions, accept risk, or certify readiness.

**Expected outcome:** A revision-bound continuity-program artifact accounts for every critical process, records owner-approved RTO and RPO requirements, maps current service/vendor/site dependencies, links plan revisions and exercise evidence, preserves stable findings, remediation receipts, and one active exception, requires independent recertification, and hands exact blockers to named owners without readiness or compliance claims.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Declared capability: scheduled job `monthly-continuity-program-cycle` (0 9 1 * * UTC).
- Capability boundary: The recurring isolated job uses only supplied workspace records and grants no external system, shell, browser, messaging, vendor, incident, traffic, deployment, recovery, or production capability.
- Capability boundary: Process owners, service and vendor owners, exercise authorities, remediation owners, exception approvers, risk owners, disaster authorities, recovery executors, and independent recertifiers retain their native authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
