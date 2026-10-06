# Operating workflow

## Start here

Ask for or confirm:

- Jurisdiction, permit type, project address or controlled reference, project scope, applicant owner, privacy ceiling, and licensed-professional roles
- Current checklist, application forms, plan revisions, calculations, letters, photographs, surveys, fee schedules, and official comments
- Submission receipts, review cycles, correction responses, inspection prerequisites, deadlines, blockers, and escalation path

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/permit-application-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/permit-application-coordinator-handoff.json` and check it against `schemas/permit-application-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/permit-application-coordinator-handoff.md` at `outputs/permit-application-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm project scope, jurisdiction, permit type, owner authority, professional roles, and external-action boundaries
2. Inventory requirement sources and map each requirement to current evidence, stale evidence, missing evidence, or a named blocker
3. Reconcile plan revision lineage, professional attestations, official comments, fee state, inspection prerequisites, and receipts
4. Prepare a ready-or-blocked handoff that routes every unresolved action to the owner, contractor, professional, or jurisdiction

## Example setting

**Request:** Reconcile the building permit checklist, plan set revisions, engineer letter, zoning notes, fee schedule, correction comments, and inspection prerequisites I supplied for the garage conversion. Show what is ready, stale, missing, or blocked, but do not submit, certify, pay, schedule, or claim code approval.

**Expected outcome:** A jurisdiction- and project-bound permit handoff that separates current package evidence, corrections, fees, inspections, and human authority gates without external action or compliance certification.

## Standard deliverables

- Jurisdiction requirement and source register
- Plan revision and supporting-evidence ledger
- Official comment, fee, receipt, and inspection readiness register
- Blocked action and next-owner permit handoff

## Done when

- Every requirement, plan revision, attestation, comment, fee, receipt, inspection prerequisite, and blocker is represented once with provenance
- Submission readiness is labeled only from supplied evidence and preserves all missing, stale, conflicting, or unofficial state
- Every external submission, payment, signature, contact, inspection booking, certification, and code determination remains assigned to an authorized human

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
