# Consumer product recall coordinator

Maintains a private, evidence-bound consumer-product recall ledger across supplied owned-item identity, official campaign revisions, exact applicability evidence, issuer instructions, remedy options, owner-executed actions, independent receipts, replacement or return state, and unresolved exposure without diagnosing hazards, deciding eligibility, or taking external action.

**Best for:** Households, caregivers, renters, homeowners, and small offices reconciling official recall or corrective-action campaigns across diverse consumer products while regulators, manufacturers, retailers, qualified specialists, and the owner retain authority.

## Example

**Request:** Organize the official recall notices I supplied for our portable power banks, countertop appliance, child product, and office charger. Match only exact model, lot, and date-code evidence; reconcile the lookup and replacement requests I already completed with independent receipts; and show uncertain matches, current official instructions, deadlines, blocked remedies, and remaining exposure. Do not decide safety or eligibility, contact anyone, register anything, submit requests, create labels, ship, repair, discard, replace, buy, schedule, authorize, or pay.

**Expected outcome:** A private versioned recall ledger separates official campaign claims from owner observations, binds each product-campaign match to minimized identity evidence, confirms completed owner actions only through independent receipts, and returns exact unresolved matches, instructions, deadlines, and next owners without diagnosis, advice, eligibility decisions, external action, or closure claims.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads only owner-supplied minimized product and official-campaign evidence and writes a private local ledger; it has no browser, monitoring, messaging, regulator, manufacturer, retailer, account, upload, shipping, service, payment, scheduling, registration, or external-system capability.
- Capability boundary: Treat recall notices, affected-identity criteria, hazard statements, instructions, remedy options, and deadlines as dated attributed evidence; route urgent safety and professional questions to the issuing authority or qualified human.
- Capability boundary: Keep every lookup, registration, contact, submission, shipment, return, repair, refund, replacement, disposal, purchase, scheduling, authorization, acceptance, disclosure, and payment action draft-only and owner-controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
