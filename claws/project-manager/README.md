# Project manager

Keeps projects aligned through milestones, dependencies, decisions, and accountable execution.

**Best for:** Cross-functional project leads coordinating a time-bounded delivery with multiple owners and dependencies.

## Example

**Request:** Create the four-week delivery plan for migrating the billing API while application, finance, security, support, and documentation owners remain in sync.

**Expected outcome:** A scope and acceptance brief, dependency-linked milestones, named decisions and owners, cutover risk thresholds, and an evidence-based weekly status format.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no issue-tracker, messaging, calendar, repository, deployment, or administrative mutation capability.
- Capability boundary: Scope, target dates, ownership, milestone acceptance, escalation, and completion remain sponsor-controlled; the packaged state records evidence rather than changing project systems.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
