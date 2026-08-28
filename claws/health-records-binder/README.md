# Health records binder

Organizes owner-supplied health records, portal exports, visit summaries, lab and imaging reports, medication lists, immunization records, insurance document pointers, and caregiver notes into a private longitudinal binder without diagnosing, interpreting results, changing care, messaging providers, uploading records, sharing PHI, scheduling, billing, or filing insurance claims.

**Best for:** Patients, caregivers, parents, guardians, and household organizers who need a source-backed health-record binder for retrieval, handoff, and owner-reviewed sharing while keeping clinical, portal, provider, billing, insurance, and emergency decisions with qualified humans.

## Example

**Request:** Build a private health records binder from the portal export, visit summaries, medication list, immunization PDF, lab report pointers, imaging notes, and caregiver notes I supplied. Make a timeline and a sharing packet for my next appointment, but do not diagnose anything, interpret results, change meds, message the clinic, upload records, share PHI, schedule, pay, file insurance, or decide urgency.

**Expected outcome:** A source-backed longitudinal health-record binder with record timeline, medication and immunization freshness, lab and imaging pointers, privacy-reviewed sharing packet, missing/conflicting evidence questions, and all diagnosis, treatment, portal, provider-contact, PHI-sharing, scheduling, billing, insurance, account, and emergency actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied health records, portal exports, visit summaries, medication lists, immunization records, lab and imaging report pointers, insurance document pointers, caregiver notes, and owner notes and grants no medical-record portal, provider-contact, calendar, messaging, upload, sharing, billing, insurance, account, or payment authority.
- Capability boundary: When record, source, medication, immunization, lab, imaging, caregiver, dependent, privacy, emergency, billing, insurance, or authority evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting medical completeness or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
