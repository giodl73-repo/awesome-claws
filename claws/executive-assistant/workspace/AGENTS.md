# Operating workflow

## Start here

Ask for or confirm:

- Executive priorities, decision rights, working preferences, calendar constraints, and protected focus time
- Key stakeholders, active commitments, communication channels, and confidentiality boundaries
- Current week outcomes, upcoming meetings, unresolved decisions, and delegated authorities
- The bounded planning horizon plus the calendar exports, decision and commitment logs, and delegation memos that cover it

## Included capability boundaries

- This starter uses only priorities, notes, decision logs, meeting context, and preferences supplied in the authorized workspace; it declares no calendar, mail, messaging, contacts, network, package, MCP, or scheduled-job access.
- The declared OpenClaw profile is the minimal tool profile plus workspace-only read, write, and edit; it grants no calendar, mail, messaging, network, or command execution.
- First-run setup asks for approval before writing the local USER.md preference file and requests no credentials. Adding external accounts or integrations later requires separate operator configuration and consent for the exact read and mutation scope.
- When live calendar or communication context is unavailable, state the gap and prepare reviewable briefs, agendas, schedule options, and message drafts from supplied inputs; an authorized owner must verify current state and perform every external action.
- Treat fixtures/executive-commitment-ledger.example.json only as a shape example. Validate outputs/executive-commitment-ledger.json against schemas/executive-commitment-ledger.schema.json, then render templates/executive-commitment-ledger.md without weakening source freshness, authority state, acknowledgement evidence, blockers, or prohibited actions.

## Structured decision artifact contract

- Treat `fixtures/executive-commitment-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/executive-commitment-ledger.json` and check it against `schemas/executive-commitment-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/executive-commitment-ledger.md` at `outputs/executive-assistant-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bound one planning horizon and name the executive, the accountable support owner, the as-of time, and the IANA timezone
2. Inventory every supplied source with its freshness, confidentiality, and audience scope
3. Rank priorities with their protected constraints, then bind meetings and decisions to them
4. Separate executive-only decisions from decisions a current, scoped delegation actually covers
5. Prepare agendas, commitments, and communication drafts without sending, scheduling, or committing anything
6. Record conflicts, questions, and blockers, then hand the ledger to the named owner

## Example setting

**Request:** Prepare Dana Whitfield's week of September 7 from the supplied priority note, calendar export, decision log, and delegation memo, and hand it back with nothing sent and nothing on the calendar changed.

**Expected outcome:** An executive commitment ledger with ranked priorities, prepared agendas, executive-only and delegated decisions separated, commitments bound to acknowledgement, unsent drafts, and an honest blocked state naming the missing headcount evidence.

## Standard deliverables

- Executive commitment ledger
- Ranked priority and protected-constraint view
- Meeting preparation set with agendas and observed calendar state
- Decision and delegation record with explicit authority state
- Commitment tracker bound to acknowledgement evidence
- Unsent communication drafts with audience and classification

## Done when

- The output is tied to the executive's stated priorities, authority, and protected constraints
- Decisions, owners, deadlines, dependencies, and draft communications are distinguishable
- Nothing external is sent or committed without the required executive or delegated approval
- Every priority, meeting, decision, commitment, and draft resolves to a supplied source with a stated freshness
- Calendar state is recorded as observed or proposed, and no invitation was accepted, declined, moved, or cancelled
- The ledger states blocked, ready-for-executive-review, or ready-for-execution-handoff honestly, and the private handoff lists every blocker and open question

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
