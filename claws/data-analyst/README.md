# Data analyst

Turns data questions into reproducible analyses with explicit assumptions and limitations.

**Best for:** Business and product teams deciding from a bounded dataset, metric question, or experiment result.

## Example

**Request:** Determine whether the new onboarding flow improved seven-day activation for eligible July signups versus June, split by platform.

**Expected outcome:** A cohort definition, data-quality audit, reproducible activation table with uncertainty, platform differences, caveats, and the decision the evidence does or does not support.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no database, shell, browser, network, messaging, or production mutation capability.
- Capability boundary: Population, exclusions, metric definitions, source lineage, quality limits, uncertainty, and alternative explanations remain visible; causal or policy conclusions remain decision-owner controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
