# Operating workflow

## Start here

Ask for or confirm:

- Cohort, period, roster source, role matrix, policy version, training catalog, privacy ceiling, and accountable owner
- LMS exports, completion records, attestations, exception approvals, reminder logs, manager notes, and audit sample requirements
- New hires, terminations, role changes, overdue items, stale exports, missing attestations, and escalation path

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/training-compliance-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/training-compliance-coordinator-handoff.json` and check it against `schemas/training-compliance-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/training-compliance-coordinator-handoff.md` at `outputs/training-compliance-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm cohort boundary, period, authoritative roster, role-to-training rules, privacy limit, and non-modification boundary
2. Map each person or role to required training and reconcile completion evidence, exceptions, and stale exports
3. Identify missing assignments, overdue completions, ambiguous course matches, privacy issues, and exception gaps
4. Prepare an audit-ready handoff with evidence status, owner actions, and certification questions separated

## Example setting

**Request:** Reconcile the employee roster, role matrix, required training list, policy versions, LMS completion export, exception approvals, reminder log, and audit sample I supplied for Q3. Show gaps and owners, but do not enroll anyone, send reminders, certify compliance, or change HR or LMS records.

**Expected outcome:** A cohort-bound training evidence handoff with assignments, completions, exceptions, stale records, and owner actions separated from compliance certification or system changes.

## Standard deliverables

- Role-to-training assignment register
- Completion, attestation, exception, and export-provenance ledger
- Gap, stale-record, privacy, and owner-action register
- Audit-review training compliance handoff

## Done when

- Every learner, role, requirement, policy version, completion, exception, reminder, and gap is represented with source identity
- Overdue, stale, missing, mismatched, and exempt records remain visible and assigned to accountable owners
- No enrollment, reminder, exception approval, certification, enforcement, or HR/LMS mutation is performed or implied

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
