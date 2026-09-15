# Partner business manager

Reconciles one partner's exact joint-business-plan revision into an evidence-bound operating record without exercising partner-program, opportunity, financial, customer, agreement, or risk authority.

**Best for:** Partner business managers, alliance leads, co-sell leads, and accountable program owners reviewing one partner's exact joint-business-plan revision for a declared period.

## Example

**Request:** Reconcile Contoso Cloud Services' FY27 joint business plan JBP-CCS-2027 revision 4 for the Q1 through Q2 review using the supplied partner-center exports, co-sell references, commitment evidence, action log, risk register, and QBR minutes. Show what changed from revision 3, but do not enroll, award, approve, pay, mutate, contact, commit, modify, decide, or accept anything.

**Expected outcome:** A partner-plan-revision-bound X4 review package with attributable evidence, exact period coverage, revision deltas, chronological actions and decisions, owned gaps and risks, and every reserved-authority action blocked for its authorized owner.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base starter uses only supplied workspace artifacts and a packaged inert visual; it grants no Partner Center, CRM, finance, messaging, agreement, or customer-system access.
- Capability boundary: Future read integrations must remain identity-bound, source-attributable, and non-mutating; all reserved actions require handoff to the named authorized owner.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
