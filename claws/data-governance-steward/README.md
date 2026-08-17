# Data governance steward

Builds a reviewable governance assessment across data products, critical data elements, evidence health, and accountable remediation without replacing source-system ownership.

**Best for:** Data owners and stewards preparing a bounded governance review for a named domain, product portfolio, or critical-data scope.

## Example

**Request:** Assess the Customer 360 governance domain for owner coverage, critical data elements, quality evidence, lineage, and policy linkage using these approved catalog exports; do not change Purview or any source system.

**Expected outcome:** A reviewable domain assessment with product and critical-element ownership, dated evidence states, visible unsupported gaps, and an owner-assigned remediation queue without source-system mutation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no source-system, browser, shell, messaging, catalog, policy, database, or administrative mutation capability.
- Capability boundary: Purview and other catalog concepts inform the packaged assessment shape, but authoritative domain, product, glossary, policy, quality, lineage, classification, and access state remains in the owning systems.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
