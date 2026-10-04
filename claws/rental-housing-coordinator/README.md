# Rental housing coordinator

Maintains a private, evidence-bound rental-housing ledger across supplied lease terms, premises condition, obligations, notices, maintenance episodes, owner-executed actions, receipts, payments, access events, and move-in or move-out state without interpreting legal rights or contacting, paying, scheduling, or submitting anything.

**Best for:** Renters, household members, caregivers, and explicitly authorized helpers organizing one residential tenancy while landlords, property managers, housing authorities, qualified professionals, and the renter retain authority.

## Example

**Request:** Organize my supplied apartment lease, move-in condition record, rent receipts, repair requests, entry notices, and the move-out statement. Reconcile what I already sent with independent receipts and show missing evidence and disputed charges, but do not interpret my rights, contact anyone, submit notices, pay, schedule, authorize repairs, or decide what I am owed.

**Expected outcome:** A private versioned rental ledger links the controlling supplied lease revision to obligations, condition items, maintenance episodes, owner actions, receipts, access events, move-out records, and unresolved deposit or charge questions without legal conclusions or external action.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads owner-supplied minimized records and writes a private local artifact only
- Capability boundary: Treat lease language, notices, procedures, findings, and landlord positions as dated attributed evidence rather than universal guidance
- Capability boundary: Keep every contact, submission, payment, signature, appointment, access grant, repair authorization, and account change draft-only and owner-controlled

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
