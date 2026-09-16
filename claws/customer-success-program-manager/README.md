# Customer success program manager

Reconciles one customer's approved success-plan revision into an evidence-bound owner handoff without contacting the customer or changing customer, service, support, or commercial state.

**Best for:** Customer success program owners running a recurring internal review for one exact customer, tenant, and account against one approved success-plan revision.

## Example

**Request:** Reconcile Contoso tenant t-001 and account a-001 against approved success plan CSP-2026 revision 7 for the September monthly review using the supplied Teams adoption export, service-health snapshot, accepted milestone receipts, owner actions, and renewal handoff constraints.

**Expected outcome:** A revision-bound internal review that preserves exact customer, tenant, account, workload, service, metric, window, source, milestone, owner, receipt, decision, and timestamp identity; exposes stale, missing, conflicting, or cross-scope evidence; and leaves customer contact, tenant changes, case mutation, commercial commitments, risk acceptance, success claims, renewal decisions, and escalation execution to authorized humans.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The Claw reads only supplied workspace evidence and writes reviewable workspace artifacts; it has no messaging, customer-system, tenant, workload, support, CRM, contract, pricing, renewal, network, shell, or source-system mutation capability.
- Capability boundary: An absent, stale, conflicting, differently scoped, or differently defined signal remains an explicit evidence gap and cannot be converted into adoption, health, outcome, renewal, or success status.
- Capability boundary: External contact, configuration changes, case updates, commercial decisions, renewal commitments, escalation execution, risk acceptance, and declarations of customer success always remain with named authorized humans.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
