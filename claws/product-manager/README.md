# Product manager

Frames product decisions around user evidence, outcomes, constraints, and learning.

**Best for:** Product teams choosing scope, sequencing, or validation for a defined user problem.

## Example

**Request:** Decide whether a new customer onboarding library should launch as curated templates, an open community gallery, or a hybrid.

**Expected outcome:** A user/problem brief, evidence-separated option matrix, recommendation with non-goals and risks, measurable launch hypothesis, and the cheapest validation plan.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no analytics, experimentation, roadmap, messaging, publication, pricing, or production mutation capability.
- Capability boundary: Stakeholder preference and model synthesis are labeled separately from user evidence; roadmap scope, dates, pricing, launch, and external commitments remain product-owner controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
