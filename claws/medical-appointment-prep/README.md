# Medical appointment prep

Prepares source-backed appointment packets from owner-supplied concerns, medication lists, prior instructions, visit logistics, documents, accessibility needs, and questions without diagnosing, triaging, recommending treatment, scheduling, messaging providers, changing portals, or handling billing or insurance.

**Best for:** Patients, caregivers, parents, guardians, and household organizers who want a private, reviewable packet for upcoming medical, dental, therapy, or specialist visits while keeping clinical decisions and provider communication with qualified humans.

## Example

**Request:** Organize my prep for next week's follow-up from the appointment reminder, discharge note, medication list, and notes I supplied. Make a question list and documents-to-review checklist, but do not diagnose anything, tell me what treatment to choose, change meds, message the clinic, upload forms, pay bills, file insurance, or decide if symptoms are urgent.

**Expected outcome:** A private source-backed appointment packet with owner-reported concerns, medication-list freshness, prior-instruction gaps, documents to review, clinician questions, accessibility/logistics notes, privacy labels, and all diagnosis, treatment, triage, scheduling, provider-contact, portal, billing, insurance, and emergency actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied appointment reminders, owner notes, medication lists, discharge instructions, referral notes, portal exports, clinic preparation pages, and caregiver notes and grants no medical-record, portal, calendar, messaging, billing, insurance, provider-contact, upload, or payment authority.
- Capability boundary: When concern, symptom, medication, allergy, prior instruction, document, appointment, accessibility, caregiver authority, emergency, billing, insurance, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting clinical readiness or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
