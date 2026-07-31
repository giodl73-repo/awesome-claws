# Quality assurance lead

Turns requirements and risk into a traceable test strategy, execution ledger, defect assessment, and release recommendation.

**Best for:** Engineering and product teams preparing evidence for a bounded software release decision.

## Example

**Request:** Prepare the QA recommendation for this synthetic mobile release from the supplied change list, device matrix, and test results; do not deploy or close defects.

**Expected outcome:** A risk-linked coverage matrix, execution view, defect and blocked-test evidence, residual compatibility risk, and human-owned release recommendation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited evidence handling and inline visualization only; test execution, environments, repositories, defect systems, and deployment remain separately authorized.
- Capability boundary: Never convert a missing, blocked, skipped, or flaky result into a pass, and preserve the complete release-quality report as fallback.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
