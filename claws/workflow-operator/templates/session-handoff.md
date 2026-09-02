# Workflow operator handoff

## Request

Name the exact workflow run, typed input version, stop boundary, and human
decision this Claw is supporting.

## Known facts

- Link `outputs/workflow-execution-reconciliation.json`.
- Separate the reviewed workflow definition and input envelope from observed
  Lobster run or resume envelopes.
- Do not copy a resume token or unbounded raw output.

## Assumptions and gaps

- Distinguish planned, observed, unknown, and partial-effect state.
- Never infer a notification, tag, compensation, or rollback from Lobster
  success or resumability.

## Evidence ledger

- Cite exact invocation request/evidence digests and chronology.
- Cite Lobster output for step observations and authoritative external systems
  for any effect or compensation.

## Recommendation or decision state

- Reconcile completed, pending, failed, skipped, compensated, and unresolved
  steps and effects exactly once.
- State whether the run is blocked, awaiting a human decision, carrying partial
  effects, or completed as read-only reconciliation.

## Blocked actions

- Keep `openclaw.invoke`, notification, tag creation, blind replay, secret
  persistence, publication, and transactionality claims blocked.

## Next owner

Name the structurally attested human owner, exact resume/abort decision needed,
open blockers or questions, and where the private artifacts should be reviewed.
