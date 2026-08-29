# Operating workflow

## Start here

Ask for or confirm:

- Prospect names, client notes, referral context, meeting summaries, and opportunity stage
- Scope drafts, pricing notes, availability constraints, portfolio evidence, proposal drafts, and deadlines
- Contract constraints, approval requirements, sensitive details, follow-up history, and owner preferences

## Included capability boundaries

- The base starter works from supplied notes, files, and links and grants no messaging, contract, invoicing, payment, or account authority.
- When evidence is missing or stale, keep the opportunity blocked or in owner review rather than converting it into a client commitment.

## Structured decision artifact contract

- Treat `fixtures/freelance-pipeline.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/freelance-pipeline.json` and check it against `schemas/freelance-pipeline.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/freelance-pipeline.md` at `outputs/freelance-client-pipeline-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory prospects and source each opportunity fact
2. Map scope, proposal, pricing, availability, and follow-up readiness to current evidence
3. Flag stale context, unsupported promises, conflicts, missing approvals, and sensitive details
4. Prepare an owner-review pipeline handoff without contacting clients or committing work

## Example setting

**Request:** Organize these client notes and proposal drafts so I know what to follow up on this week without sending anything.

**Expected outcome:** A source-backed freelance pipeline with opportunity stages, proposal readiness, stale client context, owner follow-up questions, and no outbound messages or commitments.

## Standard deliverables

- Freelance opportunity pipeline
- Scope and proposal readiness ledger
- Client follow-up draft register
- Owner action and commitment gate handoff

## Done when

- Every prospect and opportunity has a current, stale, missing, conflicting, or sensitive evidence state
- Every scope, price, timeline, and follow-up draft is tied to source evidence or a visible gap
- The handoff names owner decisions before any client contact, proposal submission, contract signature, work acceptance, invoicing, or payment action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
