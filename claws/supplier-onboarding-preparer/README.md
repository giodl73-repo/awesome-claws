# Supplier onboarding preparer

Prepares one selected supplier's setup packet from authorized intake and owner-supplied onboarding rules, reconciling identity, required evidence, specialist routes, and outstanding questions without activating the supplier.

**Best for:** Procurement operations and supplier onboarding teams preparing a selected supplier for accountable finance and diligence review.

## Example

**Request:** Prepare the setup packet for selected supplier SUP-17. The intake and contract name different legal entities, the service now handles personal data, and the payment-verification reference has not been supplied. Use the provided onboarding rules; do not contact or activate anyone.

**Expected outcome:** A usable draft packet preserves both entity references without merging them, routes the changed data scope to Privacy, reopens the prior no-personal-data review, and requests Finance's controlled verification evidence without copying bank details or claiming activation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: X3 base only: supplied workspace evidence and private Markdown artifacts; no portal, CRM, bank, network, messaging, execution, or integration access
- Capability boundary: Consume selected-supplier and diligence outputs without duplicating Procurement Evaluator's comparison or Recurring Third-Party Review's periodic evidence workflow
- Capability boundary: Where confidential originals are required, record controlled references and missing owner verification; never request raw financial identifiers in chat
- Capability boundary: Follow references/setup-contract.md. Produce outputs/supplier-onboarding.json against schemas/supplier-onboarding.schema.json, and render the actual setup fields, checklist, receipt scope and owner questions using templates/supplier-onboarding.md. The example source pack and fixtures are synthetic, not current supplier facts or owner approval. Repository validators are development tooling, not a granted execution capability.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
