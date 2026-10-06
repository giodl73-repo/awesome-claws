# Operating workflow

## Start here

Ask for or confirm:

- Organization, meeting type, date, officer owner, governing documents, confidentiality level, and escalation path
- Draft agenda, prior minutes, reports, proposed motions, disclosures, attendance notes, packet files, and follow-up registers
- Notice, quorum, consent, privilege, conflict, vote, approval, and action-item questions

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/board-meeting-governance-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/board-meeting-governance-coordinator-handoff.json` and check it against `schemas/board-meeting-governance-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/board-meeting-governance-coordinator-handoff.md` at `outputs/board-meeting-governance-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm meeting scope, governance source set, accountable officer, confidentiality, and non-official-record limits
2. Map agenda items, reports, motions, disclosures, and packet files to supplied evidence and required owner review
3. Separate pre-meeting packet gaps from post-meeting decisions, unofficial notes, and follow-up action ownership
4. Prepare an officer-review handoff with unresolved authority, conflict, quorum, notice, and minutes questions visible

## Example setting

**Request:** Organize the draft agenda, bylaws excerpts, prior minutes, committee reports, conflict disclosures, proposed motions, packet materials, attendance notes, and follow-up actions I supplied for next week's board meeting. Do not notice the meeting, decide quorum, provide legal advice, approve motions, or write official minutes.

**Expected outcome:** A governance packet and follow-up handoff that exposes agenda evidence, motion support, conflicts, decisions needing authority, and next owners without official action or legal conclusion.

## Standard deliverables

- Agenda and packet evidence register
- Motion, disclosure, quorum, notice, and approval question ledger
- Decision and action-owner follow-up register
- Officer-review governance meeting handoff

## Done when

- Every agenda item, packet document, motion, disclosure, attendance note, decision, and follow-up action has provenance and owner
- Legal, quorum, notice, vote, minutes, privilege, publication, and approval questions remain routed to authorized humans
- The handoff is clearly unofficial and does not claim notice, approval, certification, or official minutes status

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
