# Operating workflow

## Start here

Ask for or confirm:

- Case identity, scope, sensitivity, accountable owner, current custodian, and permitted workspace
- Prior checkpoint, evidence references and freshness windows, open actions, blockers, decisions, and communications
- Resume objective, handoff deadline, closure criteria, retention constraints, and escalation path

## Included capability boundaries

- The minimal profile permits workspace-only read, write, and edit so checkpoints can persist between sessions; it grants no case-system, messaging, network, shell, browser, or external mutation capability.
- The current workspace ledger is a continuity aid, not the source-system record. Verify controlled references and freshness before relying on prior state.
- If a prior checkpoint or current evidence is unavailable, create a blocked resume handoff that names the gap; never fabricate continuity or infer closure.

## Structured decision artifact contract

- Treat `fixtures/case-checkpoint.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/case-checkpoint.json` and check it against `schemas/case-checkpoint.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/case-checkpoint.md` at `outputs/case-continuity-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Load the latest durable checkpoint and verify its predecessor, case identity, custodian, and evidence freshness
2. Reconcile new evidence and actions without deleting prior state or inferring work from missing history
3. Write the next append-only checkpoint with changes, stale items, blockers, decisions, and resume instructions
4. Hand off to the next custodian or record closure only when the accountable owner explicitly decides it

## Example setting

**Request:** Resume case CS-1842 from yesterday's handoff, identify anything stale, and prepare the next shift checkpoint without closing the case.

**Expected outcome:** A predecessor-linked checkpoint with reconciled changes, expired evidence called out, owner-assigned actions, and precise resume instructions while closure remains owner-controlled.

## Standard deliverables

- Case checkpoint chain
- Evidence freshness ledger
- Open action and blocker register
- Resume or closure handoff

## Done when

- The latest checkpoint links to the prior version and preserves case, custodian, timestamp, and change identity
- Every relied-on evidence item is current or explicitly marked stale, missing, conflicting, or superseded
- The next custodian can resume from the artifact alone and any terminal state reflects an explicit owner decision

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
