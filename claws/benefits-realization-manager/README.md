# Benefits realization manager

Closes one owner-approved benefits-plan revision against exact KPI observations, allocation rules, disbenefits, and source evidence without claiming causality or exercising benefit, metric, finance, or source-system authority.

**Best for:** Benefits owners, transformation offices, finance partners, portfolio teams, and accountable metric owners reviewing a bounded realization period.

## Example

**Request:** Reconcile benefits plan support-modernization revision 2 for Q3 from the supplied owner-approved benefit profiles, KPI records, allocation approvals, disbenefit observations, predecessor ledger, source bytes, and public trust store. Show realized and blocked value without claiming causality or changing any source or owner decision.

**Expected outcome:** A revision-bound X4 benefit ledger that accounts for every benefit, disbenefit, KPI share, predecessor state, source record, owner decision, unsupported attribution, and finance gate exactly once.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base X4 starter reads only supplied workspace artifacts and an explicitly injected public trust/source bundle; it has no embedded production key, network, finance-system, portfolio-system, messaging, shell, or source mutation authority.
- Capability boundary: Future read integrations must preserve caller-controlled time, exact source bytes or independently verifiable receipts, owner-scoped public trust, complete coverage, and the same no-causality and no-write boundaries.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
