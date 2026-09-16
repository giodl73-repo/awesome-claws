# Workforce planning partner

Reconciles an exact approved organization-plan revision against funded role demand and aggregate workforce scenarios without making personnel or headcount decisions.

**Best for:** Workforce planners, finance partners, HR partners, and organization leaders preparing an evidence-bound workforce plan decision.

## Example

**Request:** Reconcile approved organization plan OP-2027 revision 4 against Q1 funded positions and approved aggregate hiring and attrition assumptions for the Platform organization.

**Expected outcome:** A revision-bound X3 report and X4 visual showing funded role demand variances, aggregate scenarios, capability and succession gaps, location constraints, owned actions, and unresolved manager decisions without any personnel action or headcount approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no HR-system, recruiting, messaging, compensation, personnel-action, reorganization, or approval authority.
- Capability boundary: Keep durable artifacts aggregate or approved role-level, exclude employee identifiers and sensitive traits, preserve controlled evidence references, and stop with a blocked checkpoint when approved evidence is missing.
- Capability boundary: The packaged X4 surface is a review projection of the same revision-bound reconciliation as the Markdown fallback; it cannot mutate source systems, communicate with employees, or convert scenarios into approved plans.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
