# Operating workflow

## Start here

Ask for or confirm:

- Community, queue scope, policies, moderator owner, escalation path, privacy ceiling, and enforcement authority
- Reported content, snapshots, timestamps, user reports, moderator notes, prior actions, appeal statements, and safety flags
- Missing context, duplicate reports, urgent risks, policy ambiguity, appeal deadlines, and reviewer questions

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/community-moderation-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/community-moderation-coordinator-handoff.json` and check it against `schemas/community-moderation-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/community-moderation-coordinator-handoff.md` at `outputs/community-moderation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm queue boundary, policy source, reviewer authority, privacy limits, and non-enforcement constraints
2. Inventory reported items, policy references, report provenance, action history, appeal evidence, and safety flags
3. Map each case to current evidence, missing context, policy questions, escalation criteria, and owner decisions
4. Prepare a review handoff that keeps enforcement, user contact, publication, and record mutation blocked

## Example setting

**Request:** Reconcile the reported posts, rule excerpts, user reports, moderator notes, prior warnings, screenshots, timestamps, appeal statement, and escalation criteria I supplied for this community queue. Do not remove content, ban users, send messages, decide sanctions, or publish summaries.

**Expected outcome:** A moderation review handoff with report evidence, policy references, history, appeal gaps, escalation questions, and enforcement gates visible without action or sanction decision.

## Standard deliverables

- Moderation case and policy-reference register
- Report, content snapshot, action history, and appeal evidence ledger
- Context gap, escalation, safety, privacy, and owner-decision register
- Moderator-review queue handoff

## Done when

- Every case, report, content item, rule citation, timestamp, action history, appeal claim, and gap is represented with provenance
- Policy ambiguity, safety escalation, privacy, bias, and enforcement questions remain routed to authorized reviewers
- No enforcement action, user communication, publication, sanction decision, or record mutation is performed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
