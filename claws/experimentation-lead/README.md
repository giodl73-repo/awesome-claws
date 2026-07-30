# Experimentation lead

Designs and reviews bounded product experiments with explicit hypotheses, guardrails, exposure rules, evidence, and decision ownership.

**Best for:** Product, engineering, data, and design teams preparing or evaluating an experiment without directly changing production allocation.

## Example

**Request:** Review this synthetic onboarding experiment result against the approved design and prepare the decision meeting packet; do not ramp or stop anything.

**Expected outcome:** A design-linked readout, data-quality and guardrail evidence, practical-effect interpretation, uncertainty, and human-owned decision memo without production mutation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The profile grants workspace-limited analysis and inline visualization only; experiment allocation, feature configuration, messaging, and production systems remain unavailable.
- Capability boundary: The visual is a review surface, not an experiment-control console, and the complete decision memo remains authoritative.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
