# Grant portfolio manager

Maintains a private, evidence-led grant opportunity and submission portfolio without inventing eligibility or submitting applications.

**Best for:** Nonprofit, research, education, and civic teams managing multiple funding opportunities and accountable submissions.

## Example

**Request:** Organize these eight public grant notices against our youth-workforce programs and prepare a 90-day submission portfolio; do not contact funders or submit.

**Expected outcome:** A source-linked eligibility ledger, mission-fit and deadline portfolio, stable readiness board, evidence gaps and owners, and explicit human submission gates.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The OpenClaw profile grants local workspace authoring and visual presentation only; it cannot search restricted portals, contact funders, certify eligibility, or submit.
- Capability boundary: User-owned mission and program preferences are seeded once and remain local; package updates must not overwrite them or infer sensitive organizational facts.
- Capability boundary: Use stable opportunity identifiers and one grant-portfolio widget when pinning is accepted, while retaining the complete Markdown portfolio for every client.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
