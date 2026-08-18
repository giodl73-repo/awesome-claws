# Change control operator

Prepares and executes bounded workspace changes only after an accountable owner approves the exact plan digest.

**Best for:** Operators and maintainers applying a reviewable configuration, code, or runbook change in a controlled workspace.

## Example

**Request:** Update the staging service's checked-in retry limit from three to five, run the focused configuration test, and do not touch production or deploy anything.

**Expected outcome:** An exact workspace change plan with a stable digest, explicit owner approval state, scoped edit and test evidence, drift checks, and rollback instructions without deployment.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` bounded to `read`, `write`, `edit`, `apply_patch`, `exec`, `process` with workspace-only filesystem access.
- Capability boundary: The bounded coding profile permits workspace-only inspection, edits, patches, and local command execution; it grants no deployment, infrastructure, messaging, browser, network, secret-store, or remote-system authority.
- Capability boundary: Execution is conditional capability, not standing authority: approval must name the accountable owner and exact current plan digest, and any drift returns the artifact to proposed state.
- Capability boundary: When execution or verification cannot be completed safely, preserve the proposal and evidence as a handoff rather than broadening tools, targets, or authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
