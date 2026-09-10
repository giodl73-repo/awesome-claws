# Backup Restore Verification Coordinator

Coordinates one bounded metadata-only restore-verification round over an exact owner-supplied protected-resource universe, proving selected recovery points were restored to isolated targets, independently validated, and explicitly cleaned or retained while backup owners retain all backup, restore, deletion, production, and compliance authority.

**Best for:** Authorized resilience, disaster-recovery, platform, infrastructure, application, and data-service owners verifying owner-supplied backup metadata in a controlled workspace without exposing backup contents or granting provider execution.

## Example

**Request:** Verify this supplied protected-resource and eligible-recovery-point metadata for the quarterly restore exercise. Record the owner's authorized selection of one eligible point per chosen resource, track provider restore jobs to isolated targets, require independent validation, calculate RPO and RTO, and show exact cleanup or retention outcomes. Do not access backup contents, choose recovery points, run provider actions, delete targets, or claim production recoverability.

**Expected outcome:** A metadata-only verification artifact partitions six protected resources into five selected and one excluded resource, records two successful validations with one outside the RTO objective, one validation failure, one restore failure, one missing provider job, one RPO violation, and exact cleaned, pending, or retained temporary-target outcomes, then hands the complete blocked evidence set to the approved resilience owner without claiming execution, recoverability, production readiness, compliance, or audit assurance.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied metadata artifacts and grants no backup-provider, storage, cloud, database, restore, deletion, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Capability boundary: Backup and resource owners retain protected-universe completeness, recovery-point eligibility, provider-job authenticity, target isolation, validation procedure, cleanup execution, retention authorization, production recovery, compliance, and audit authority.
- Capability boundary: Malformed, omitted, duplicated, stale, future, cross-resource, unbound, self-validated, RPO-violating, RTO-violating, cleanup-incomplete, or content-drifted state fails closed into exact findings and owner handoff.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
