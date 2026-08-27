# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied appointment date, provider or clinic label, visit type, concerns, symptoms as reported, questions, medication and supplement list, allergies as supplied, prior instructions, discharge notes, lab or imaging pointers, forms, transportation notes, accessibility needs, caregiver authority, and privacy labels
- Approved sources such as visit reminders, portal exports, medication lists, discharge instructions, referral notes, owner notes, appointment cards, clinic preparation pages, and caregiver notes
- Owner review goals such as question list, documents to bring, medication list freshness, conflicting instructions, accessibility/logistics needs, caregiver handoff, and source gaps
- External actions that must remain draft-only, including scheduling, provider messages, portal submissions, uploads, payments, insurance contact, medication changes, and emergency escalation

## Included capability boundaries

- The base starter uses supplied appointment reminders, owner notes, medication lists, discharge instructions, referral notes, portal exports, clinic preparation pages, and caregiver notes and grants no medical-record, portal, calendar, messaging, billing, insurance, provider-contact, upload, or payment authority.
- When concern, symptom, medication, allergy, prior instruction, document, appointment, accessibility, caregiver authority, emergency, billing, insurance, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting clinical readiness or taking action.

## Structured decision artifact contract

- Treat `fixtures/medical-appointment.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/medical-appointment.json` and check it against `schemas/medical-appointment.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/medical-appointment.md` at `outputs/medical-appointment-prep-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each appointment, concern, owner-reported symptom, medication entry, prior instruction, document, source, logistics need, privacy label, and review question to supplied or approved evidence
2. Group visit-prep items by appointment, owner, caregiver authority, source freshness, urgency uncertainty, document readiness, medication-list freshness, accessibility/logistics need, and blocked external action
3. Reconcile stale, missing, conflicting, partial, or sensitive appointment evidence without diagnosing, triaging, interpreting results, certifying urgency, or recommending care
4. Prepare an owner-reviewed appointment packet with source freshness, questions for the clinician, documents-to-review list, logistics notes, privacy labels, and unresolved gaps
5. Return a blocked-action handoff without scheduling, messaging, uploading, submitting, changing portals, paying, filing insurance claims, or giving medical, legal, billing, insurance, or emergency advice

## Example setting

**Request:** Organize my prep for next week's follow-up from the appointment reminder, discharge note, medication list, and notes I supplied. Make a question list and documents-to-review checklist, but do not diagnose anything, tell me what treatment to choose, change meds, message the clinic, upload forms, pay bills, file insurance, or decide if symptoms are urgent.

**Expected outcome:** A private source-backed appointment packet with owner-reported concerns, medication-list freshness, prior-instruction gaps, documents to review, clinician questions, accessibility/logistics notes, privacy labels, and all diagnosis, treatment, triage, scheduling, provider-contact, portal, billing, insurance, and emergency actions blocked.

## Standard deliverables

- Appointment prep packet
- Owner-reported concern and question list
- Medication and prior-instruction freshness register
- Documents, forms, and records-to-review checklist
- Accessibility, caregiver, and logistics note
- Blocked diagnosis, treatment, triage, portal, provider-contact, billing, insurance, and emergency-action handoff

## Done when

- Every appointment, concern, medication entry, prior instruction, document, logistics need, privacy label, and review question has source identity, freshness, and owner-review state
- Every appointment-prep claim traces to supplied or approved evidence without hiding stale, partial, missing, conflicting, or sensitive source state
- Protected health information, dependent details, mental-health notes, pregnancy notes, disability details, contact details, account information, and insurance information are minimized or blocked from inappropriate outputs
- Diagnosis, triage, treatment, medication changes, scheduling, provider messaging, portal submissions, uploads, payments, insurance claims, billing advice, legal advice, and emergency decisions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
