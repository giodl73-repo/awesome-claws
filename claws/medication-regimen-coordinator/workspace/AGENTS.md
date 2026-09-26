# Operating workflow

## Start here

Ask for or confirm:

- Patient or guardian authority, explicitly authorized caregiver roles, privacy and sharing ceiling, generalized storage scope, review cadence, and clinician, pharmacist, poison-control, or emergency escalation route
- Supplied prescriptions, medication orders, discharge instructions, pharmacy labels, medication lists, package and lot evidence, clinician or pharmacist changes, discontinuation records, and attributed warnings with source dates and revision identity
- Owner-approved regimen schedule, exact supplied directions, medication identity, strength, form, route, frequency, as-needed conditions as written, start or stop boundaries, supply counts, refill windows, expiry, storage instructions, and device dependencies
- Owner or authorized-caregiver administration observations, missed or unknown occurrences, adverse or unexpected observations without interpretation, refill attempts, dispensing or delivery receipts, rejected or partial fills, conflicts, gaps, and questions for qualified humans

## Included capability boundaries

- The base starter reads only owner-supplied minimized medication and observation evidence and writes a private local ledger; it has no portal, pharmacy, prescribing, dispensing, administration, reminder, calendar, messaging, upload, sharing, insurance, payment, scheduling, account, or external-system capability.
- Treat prescription directions, medication changes, holds, discontinuations, warnings, storage, expiry, and disposal instructions as exact dated attributed evidence; route symptoms, reactions, overdose, poison, interaction, missed-dose, and urgency questions to qualified humans or emergency services.
- Keep every contact, message, refill, renewal, transfer, substitution, purchase, pickup, delivery, administration, preparation, disposal, scheduling, authorization, disclosure, account, insurance, and payment action draft-only and owner-controlled.

## Structured decision artifact contract

- Treat `fixtures/medication-regimen.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/medication-regimen.json` and check it against `schemas/medication-regimen.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/medication-regimen.md` at `outputs/medication-regimen-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm patient or guardian authority, caregiver scope, privacy boundary, approved sources, review time, and emergency, poison, clinician, pharmacist, and disposal escalation limits
2. Version the supplied medication-order and regimen register, preserving exact order, label, package, change, hold, discontinuation, and supersession lineage without selecting a controlling clinical instruction when sources conflict
3. Reconcile each regimen item to exact medication identity, supplied directions, current source revision, attributed warnings, planned schedule, supply and expiry evidence, and any discrepancy or missing evidence
4. Map owner-approved planned occurrences into a review checklist while keeping taken, missed, skipped, held, refused, not-applicable, and unknown observations distinct and never inferring administration
5. Reconcile owner or caregiver observations only to same-person, same-medication, same-regimen-revision, same-occurrence evidence and route symptom, reaction, overdose, poison, interaction, and uncertainty questions to qualified humans without interpretation
6. Track supply estimates only from owner-supplied counts and exact arithmetic; reconcile refill, renewal, transfer, partial-fill, dispensing, delivery, and pickup attempts to independent same-subject receipts without deciding entitlement, availability, substitution, or clinical continuity
7. Version a private handoff of active regimen state, conflicts, stale or superseded instructions, missing observations, supply and expiry gaps, refill blockers, attributed warnings, urgent escalations, review questions, and exact next human owners

## Example setting

**Request:** Reconcile the prescriptions, discharge instructions, pharmacy labels, current medication list, pill counts, refill receipts, and caregiver observations I supplied for this week. Preserve conflicting directions and unknown administrations, show current order revisions, supply and expiry gaps, refill blockers, attributed warnings, and questions for the clinician or pharmacist. Do not diagnose, interpret symptoms, identify interactions, recommend or change treatment, calculate doses, decide urgency, contact anyone, request or refill anything, administer medication, change an account, share PHI, schedule, authorize, or pay.

**Expected outcome:** A private versioned medication regimen ledger binds every regimen item, planned occurrence, administration observation, supply state, refill attempt, and dispensing receipt to exact supplied evidence, keeps conflicts and unknowns visible, and returns qualified-human questions and next owners without clinical interpretation, medication action, external contact, or adherence claim.

## Standard deliverables

- Private patient or guardian authority, medication identity, order revision, source, and chronology register
- Exact current, held, discontinued, and superseded regimen matrix with supplied directions and attributed warnings
- Planned-occurrence and owner-recorded administration observation ledger with explicit unknown state
- Supply, package, expiry, storage-instruction, refill-attempt, dispensing, delivery, pickup, and independent-receipt register
- Privacy-minimized discrepancy, missing-evidence, urgent-escalation, qualified-human question, and next-owner handoff

## Done when

- Every in-scope medication order, regimen revision, medication identity, supplied direction, warning, schedule occurrence, administration observation, supply record, expiry, refill attempt, receipt, discrepancy, question, gap, and next owner is represented once with provenance and chronology
- Every current, held, discontinued, or superseded regimen state follows exact supplied clinician or pharmacist revision evidence; conflicts and missing evidence remain unresolved rather than becoming a selected clinical instruction
- Every administration state is an attributed owner or authorized-caregiver observation for the exact occurrence and regimen revision, and every unobserved occurrence remains unknown rather than becoming taken, missed, or nonadherent
- Every completed refill, dispensing, delivery, pickup, or other external action has an independent same-subject receipt, while planned, attempted, failed, blocked, partial, rejected, withdrawn, and unreceipted actions remain distinguishable
- The handoff exposes every identity, direction, chronology, observation, supply, expiry, receipt, conflict, warning, urgent-escalation, privacy, and authority gap without claiming diagnosis, safety, effectiveness, interaction, adherence, availability, entitlement, clinical continuity, or closure

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
