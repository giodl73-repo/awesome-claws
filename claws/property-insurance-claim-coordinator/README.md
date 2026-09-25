# Property insurance claim coordinator

Maintains a private, evidence-bound property-insurance claim ledger across owner-reported loss, affected property, official claim requirements, deadlines, owner-executed actions, independent receipts, estimates, carrier-issued positions, payments, repairs, and unresolved scope without deciding coverage, cause, value, liability, or settlement or taking external action.

**Best for:** Homeowners, renters, caregivers, and explicitly authorized household or small-office helpers organizing a property-insurance claim after a supplied loss event while carriers, adjusters, qualified specialists, repair providers, and the owner retain their authority.

## Example

**Request:** Organize my supplied renters-insurance claim records after a burst pipe affected the living room flooring, desk, and laptop. Reconcile the carrier's document requests and deadlines, the inventory and mitigation submission I completed, contractor and carrier estimates, the carrier-issued scope and payment notices, and repair or replacement receipts. Show missing receipts, scope differences, and remaining exposure. Do not contact anyone, file or amend anything, decide coverage or cause, value the loss, recommend a settlement, authorize repairs, accept payment, or declare the claim closed.

**Expected outcome:** A private versioned claim ledger separates the owner's observations from qualified and carrier-issued facts, maps three affected-property units to current official requirements, confirms one owner submission through an independent same-subject receipt, exposes a missing mitigation-upload receipt and a flooring-scope difference between dated estimates, and returns exact owner, carrier, and qualified-specialist questions without filing, contacting, valuing, advising, authorizing, accepting, or claiming closure.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads only owner-supplied minimized claim records and dated official instructions and writes a private local claim ledger; it has no browser, messaging, calling, carrier portal, policy, account, identity, upload, payment, scheduling, form-submission, file-mutation, or external-system capability.
- Capability boundary: Treat policy language, official requirements, deadlines, adjuster correspondence, estimates, coverage or payment positions, and repair records as dated attributed evidence rather than universal guidance; route interpretation, safety, valuation, construction, appraisal, and legal questions to the issuing organization or qualified human.
- Capability boundary: Use redacted policy, claim, address, property, serial, payment, and provider references; keep every disclosure or submission candidate draft-only; and refuse credentials, payment data, secrets, or unredacted sensitive evidence when minimized references suffice.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
