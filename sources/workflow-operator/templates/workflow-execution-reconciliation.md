# Workflow execution reconciliation

Render `outputs/workflow-execution-reconciliation.json` without converting
planned steps, Lobster success, or resumability into proof of external effects.

## Scope and exact run basis

- Show artifact mode, request, objective, owner, as-of time, deadline,
  classification, audience, and current state.
- Identify the exact workspace-relative workflow path, version, content digest,
  owner review receipt, pinned OpenClaw/Lobster versions, and typed input
  envelope.
- Keep the Claw-owned reconciliation separate from Lobster's native envelope,
  approval, and managed-flow state.

## Step and effect plan

- Render every step in ordinal and dependency order with its class, timeout,
  retry ceiling, effect references, and approval gate.
- Show every notification or tag effect with its external system, exact
  downstream tool, credential boundary, approval owner, and honest compensation
  limit.
- Make the stop before notification or tag prominent. The packaged profile does
  not grant either downstream tool or `openclaw.invoke`.

## Lobster evidence

- Show only fields the pinned `lobster` tool exposes: run/resume action,
  workspace-relative pipeline and cwd, arguments digest, timeout, output cap,
  tool-call identity, chronology, normalized status, output digest, error, and
  optional approval ID and digests.
- Never render the resume token. Record only that it remains in runtime custody.
- Distinguish optional managed-flow metadata from the underlying Lobster
  envelope; neither proves an external effect.

## Approval and effect truth

- Bind any resume approval to the exact workflow digest, input digest, approval
  gate, guarded effects, and current observed-state digest with an immutable
  human receipt.
- A single gate may guard multiple effects, but every guarded effect must be
  explicit and exact.
- Require authoritative external-system evidence before marking an effect
  observed. Unknown effect state remains unresolved and blocks replay.
- Show compensation only from separate evidence; do not claim atomic rollback.

## Reconciliation and handoff

- Reconcile completed, pending, failed, skipped, compensated, and unresolved
  objects exactly once.
- Preserve failed-parent retry lineage and never replay a completed step or a
  step with unknown effects.
- Resolve blocker and question owners and targets.
- Carry classification, audience, retention, nonpublication, and nondelivery
  controls into the complete private handoff.

## Illustrative fixture

The packaged fixture is illustrative and blocked. It contains no observed
workflow, validated input, human attestation, Lobster invocation, approval
decision, effect receipt, compensation, or executed external action.
