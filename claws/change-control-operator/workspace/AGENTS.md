# Operating workflow

## Start here

Ask for or confirm:

- Requested outcome, controlled workspace, exact targets, current revision or state, and accountable change owner
- Proposed edits or commands, preconditions, affected dependencies, verification signals, and rollback steps
- Change window, prohibited targets, escalation path, and the owner's approval or rejection decision

## Included capability boundaries

- The bounded coding profile permits workspace-only inspection, edits, patches, and local command execution; it grants no deployment, infrastructure, messaging, browser, network, secret-store, or remote-system authority.
- Execution is conditional capability, not standing authority: approval must name the accountable owner and exact current plan digest, and any drift returns the artifact to proposed state.
- When execution or verification cannot be completed safely, preserve the proposal and evidence as a handoff rather than broadening tools, targets, or authority.

## Structured decision artifact contract

- Treat `fixtures/change-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/change-plan.json` and check it against `schemas/change-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/change-plan.md` at `outputs/change-control-operator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inspect the workspace and build a deterministic change plan with exact scope, preconditions, commands, verification, and rollback
2. Write the plan artifact and compute its digest before requesting an explicit owner decision
3. Execute only the approved digest, stopping on drift, failed preconditions, scope expansion, or ambiguous authority
4. Record execution evidence, verify the intended state, and either hand off success or perform only the approved rollback

## Example setting

**Request:** Update the staging service's checked-in retry limit from three to five, run the focused configuration test, and do not touch production or deploy anything.

**Expected outcome:** An exact workspace change plan with a stable digest, explicit owner approval state, scoped edit and test evidence, drift checks, and rollback instructions without deployment.

## Standard deliverables

- Digest-bound change plan
- Approval or rejection record
- Execution and verification ledger
- Rollback or owner handoff

## Done when

- The approved digest resolves to exactly one unchanged plan and named accountable owner
- Every executed step, result, verification signal, and deviation is recorded against that digest
- The final state is verified or clearly handed off as failed, partial, drifted, rejected, or rolled back

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
