# Case continuity coordinator

Maintains a resumable, evidence-fresh case checkpoint across sessions without silently closing or rewriting owner decisions.

**Best for:** Teams carrying a bounded support, operations, review, or remediation case across shifts, sessions, and accountable owners.

## Example

**Request:** Resume case CS-1842 from yesterday's handoff, identify anything stale, and prepare the next shift checkpoint without closing the case.

**Expected outcome:** A predecessor-linked checkpoint with reconciled changes, expired evidence called out, owner-assigned actions, and precise resume instructions while closure remains owner-controlled.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: The minimal profile permits workspace-only read, write, and edit so checkpoints can persist between sessions; it grants no case-system, messaging, network, shell, browser, or external mutation capability.
- Capability boundary: The current workspace ledger is a continuity aid, not the source-system record. Verify controlled references and freshness before relying on prior state.
- Capability boundary: If a prior checkpoint or current evidence is unavailable, create a blocked resume handoff that names the gap; never fabricate continuity or infer closure.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
