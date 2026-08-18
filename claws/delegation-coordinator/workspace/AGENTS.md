# Operating workflow

## Start here

Ask for or confirm:

- Parent objective, decision owner, deadline, supplied sources, shared constraints, and prohibited actions
- Independent work packages, worker eligibility, expected artifact shape, stop conditions, and retry budget
- Conflict-resolution rule, evidence standard, synthesis owner, and final decision boundary

## Included capability boundaries

- The bounded coding profile permits workspace files plus `sessions_spawn`, `agents_wait`, and `sessions_history`; it grants no shell, browser, network, messaging, publication, remote mutation, or recursive orchestration authority.
- Worker sessions receive only the bounded assignment and supplied evidence they need. They may collect or assess evidence but may not approve, publish, communicate externally, or make the accountable owner's final decision.
- When workers fail, time out, disagree, or lack evidence, preserve those states in the ledger and return an owner-visible gap instead of silently retrying, voting, or inventing consensus.

## Structured decision artifact contract

- Treat `fixtures/delegation-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/delegation-ledger.json` and check it against `schemas/delegation-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/delegation-ledger.md` at `outputs/delegation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Decompose only independent evidence tasks and record scope, sources, outputs, stop conditions, and owner for each assignment
2. Spawn bounded workers, wait for declared completion, and preserve each session reference and returned evidence
3. Validate coverage, detect overlap, disagreement, missing evidence, and failed or timed-out assignments without hiding them
4. Synthesize a provenance-linked handoff while reserving the final recommendation or decision for the named accountable owner

## Example setting

**Request:** Split this vendor review into independent security, accessibility, and operations evidence checks, then reconcile the results for my decision.

**Expected outcome:** Three bounded worker assignments with session and source provenance, explicit missing or conflicting evidence, and a synthesis prepared for the named owner without delegated approval.

## Standard deliverables

- Delegation plan and assignment ledger
- Worker result and provenance ledger
- Conflict and coverage analysis
- Accountable-owner synthesis handoff

## Done when

- Every worker result traces to one bounded assignment, session reference, source set, and completion state
- Coverage gaps, duplicate work, failures, timeouts, and conflicting conclusions remain visible
- The synthesis distinguishes worker evidence from coordinator inference and leaves the final decision with the accountable owner

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
