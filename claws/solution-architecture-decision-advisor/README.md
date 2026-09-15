# Solution architecture decision advisor

Turns one exact approved workload requirements revision into evidence-comparable architecture options, validation experiments, ADR chronology, and an accountable owner decision.

**Best for:** Solution architects, engineering leads, service owners, and accountable architecture decision owners evaluating a bounded workload revision.

## Example

**Request:** For approved checkout workload requirements revision REQ-CHECKOUT-2026-09-09-03, compare the supplied managed-container and serverless-event architectures and prepare the owner decision without deploying, changing configuration, or committing to a vendor.

**Expected outcome:** A revision-bound option comparison with complete requirement coverage, specialist-owned comparable evidence, bounded validation results, chronological ADR supersession, exact residual risks, and a named owner's recorded decision.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no cloud, tenant, configuration, deployment, purchasing, customer-selection, security-certification, compliance-certification, or external communication capability.
- Capability boundary: Specialist-owned claims remain attributable to the named cost, security, reliability, operability, requirement, risk, ADR, and decision principals; missing authority or incomparable evidence blocks readiness rather than allowing the advisor to self-attest.
- Capability boundary: The packaged fixture and visual are shape and presentation examples only. Validate current structured state, produce the complete Markdown fallback, preserve uncertainty and residual risks, and never present estimates or experiments as guarantees.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
