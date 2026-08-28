# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied portal exports, visit summaries, discharge instructions, lab reports, imaging reports, medication and supplement lists, allergies as supplied, immunization records, insurance or EOB pointers, caregiver notes, owner notes, and privacy labels
- Approved record purposes such as personal retrieval, upcoming appointment handoff, dependent-person binder, school or activity packet, second-opinion packet, travel health packet, medication-list review, and archive clean-up
- Owner review goals such as source freshness, missing documents, conflicting records, medication-list uncertainty, privacy and sharing limits, dependent authority, and questions for a clinician or records office
- External actions that must remain blocked or draft-only, including provider messaging, portal uploads, PHI sharing, scheduling, billing, insurance claims, account changes, medical advice, and emergency escalation

## Included capability boundaries

- The base starter uses supplied health records, portal exports, visit summaries, medication lists, immunization records, lab and imaging report pointers, insurance document pointers, caregiver notes, and owner notes and grants no medical-record portal, provider-contact, calendar, messaging, upload, sharing, billing, insurance, account, or payment authority.
- When record, source, medication, immunization, lab, imaging, caregiver, dependent, privacy, emergency, billing, insurance, or authority evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting medical completeness or taking action.

## Structured decision artifact contract

- Treat `fixtures/health-records.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/health-records.json` and check it against `schemas/health-records.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/health-records.md` at `outputs/health-records-binder-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each source, health record, timeline event, medication-list item, sharing packet, evidence gap, and review question to supplied or approved evidence
2. Group records by owner, subject, date, record type, source authority, freshness, privacy label, dependent-person scope, and clinical/non-clinical handoff purpose
3. Reconcile stale, missing, conflicting, partial, duplicate, or sensitive health evidence without diagnosing, interpreting results, certifying urgency, or recommending care
4. Prepare a longitudinal binder with source ledger, record timeline, medication and immunization freshness, lab and imaging document pointers, sharing packet candidates, and unresolved gaps
5. Return an owner-reviewed handoff with blocked medical, portal, provider-contact, upload, PHI-sharing, scheduling, billing, insurance, account, legal, and emergency actions

## Example setting

**Request:** Build a private health records binder from the portal export, visit summaries, medication list, immunization PDF, lab report pointers, imaging notes, and caregiver notes I supplied. Make a timeline and a sharing packet for my next appointment, but do not diagnose anything, interpret results, change meds, message the clinic, upload records, share PHI, schedule, pay, file insurance, or decide urgency.

**Expected outcome:** A source-backed longitudinal health-record binder with record timeline, medication and immunization freshness, lab and imaging pointers, privacy-reviewed sharing packet, missing/conflicting evidence questions, and all diagnosis, treatment, portal, provider-contact, PHI-sharing, scheduling, billing, insurance, account, and emergency actions blocked.

## Standard deliverables

- Health record source ledger
- Longitudinal visit, lab, imaging, medication, and immunization timeline
- Medication and record freshness register
- Owner-reviewed sharing packet and privacy checklist
- Missing, stale, conflicting, and sensitive evidence question list
- Blocked diagnosis, treatment, portal, provider-contact, PHI-sharing, scheduling, billing, insurance, emergency, and account-action handoff

## Done when

- Every source, record, timeline item, medication-list item, sharing packet, evidence gap, and review question has source identity, freshness, privacy scope, and owner-review state
- Every binder claim traces to supplied or approved evidence without hiding stale, partial, missing, conflicting, duplicate, sensitive, or dependent-person source state
- Protected health information, dependent details, mental-health notes, pregnancy notes, disability details, genetic or family-history details, account information, insurance information, and contact details are minimized or blocked from inappropriate outputs
- Diagnosis, triage, treatment, medication changes, result interpretation, provider messaging, portal submissions, uploads, PHI sharing, scheduling, payments, billing, insurance claims, legal advice, and emergency decisions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
