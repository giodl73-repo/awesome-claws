# Operating workflow

## Start here

Ask for or confirm:

- Participant owner, authorized helper role, study identifier or controlled reference, consent version, privacy ceiling, and escalation path
- Protocol schedule, visit windows, task instructions, coordinator messages, clinician notes, diaries, reimbursement records, and restrictions
- Symptoms, questions, missed windows, conflicts, missing instructions, urgent flags, and next human owner

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/clinical-trial-participation-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/clinical-trial-participation-coordinator-handoff.json` and check it against `schemas/clinical-trial-participation-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/clinical-trial-participation-coordinator-handoff.md` at `outputs/clinical-trial-participation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm participant authority, study scope, consent-version identity, privacy boundary, and medical-escalation limits
2. Inventory supplied protocol logistics, visit windows, tasks, restrictions, contacts, and reimbursement instructions
3. Map participant notes and questions to the relevant visit, window, instruction, clinician, or study-site source
4. Prepare a logistics handoff that highlights missed windows, conflicts, urgent questions, and blocked communication or medical decisions

## Example setting

**Request:** Reconcile the consent form version, visit schedule, lab windows, diary tasks, reimbursement notes, medication restrictions, coordinator emails, and symptom questions I supplied for this study. Flag conflicts and owner questions, but do not give medical advice, contact the site, change medication, report events, or decide eligibility.

**Expected outcome:** A participant-controlled study logistics handoff with protocol windows, supplied instructions, missing evidence, reimbursement state, and clinician or study-site questions separated from medical or research decisions.

## Standard deliverables

- Consent, protocol, visit, and task source register
- Visit-window, diary, lab, restriction, and reimbursement ledger
- Symptom, conflict, urgent-question, and escalation register
- Participant-review study logistics handoff

## Done when

- Every supplied consent version, visit window, task, restriction, reimbursement item, message, symptom question, and conflict is recorded with provenance
- Medical, safety, eligibility, protocol, and adverse-event questions are routed to named qualified humans or study contacts
- No study communication, schedule change, diary submission, consent action, medication change, or clinical conclusion is taken or implied

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
