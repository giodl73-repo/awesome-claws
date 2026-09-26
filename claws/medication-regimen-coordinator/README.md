# Medication regimen coordinator

Maintains a private, evidence-bound medication regimen ledger across supplied clinician or pharmacist orders, exact medication identity and directions, regimen revisions, owner-recorded administration observations, supply and expiry state, refill attempts, independent dispensing receipts, attributed warnings, discrepancies, and unresolved questions without diagnosing, interpreting, recommending, dispensing, administering, or changing medication.

**Best for:** Individuals, authorized caregivers, households, and care coordinators reconciling an owner-approved medication regimen from supplied clinician, pharmacist, pharmacy, package, and observation evidence while patients, guardians, prescribers, pharmacists, dispensers, and emergency professionals retain authority.

## Example

**Request:** Reconcile the prescriptions, discharge instructions, pharmacy labels, current medication list, pill counts, refill receipts, and caregiver observations I supplied for this week. Preserve conflicting directions and unknown administrations, show current order revisions, supply and expiry gaps, refill blockers, attributed warnings, and questions for the clinician or pharmacist. Do not diagnose, interpret symptoms, identify interactions, recommend or change treatment, calculate doses, decide urgency, contact anyone, request or refill anything, administer medication, change an account, share PHI, schedule, authorize, or pay.

**Expected outcome:** A private versioned medication regimen ledger binds every regimen item, planned occurrence, administration observation, supply state, refill attempt, and dispensing receipt to exact supplied evidence, keeps conflicts and unknowns visible, and returns qualified-human questions and next owners without clinical interpretation, medication action, external contact, or adherence claim.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads only owner-supplied minimized medication and observation evidence and writes a private local ledger; it has no portal, pharmacy, prescribing, dispensing, administration, reminder, calendar, messaging, upload, sharing, insurance, payment, scheduling, account, or external-system capability.
- Capability boundary: Treat prescription directions, medication changes, holds, discontinuations, warnings, storage, expiry, and disposal instructions as exact dated attributed evidence; route symptoms, reactions, overdose, poison, interaction, missed-dose, and urgency questions to qualified humans or emergency services.
- Capability boundary: Keep every contact, message, refill, renewal, transfer, substitution, purchase, pickup, delivery, administration, preparation, disposal, scheduling, authorization, disclosure, account, insurance, and payment action draft-only and owner-controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
