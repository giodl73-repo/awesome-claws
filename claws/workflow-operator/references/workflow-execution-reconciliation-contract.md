# Workflow execution reconciliation contract

## Pinned runtime evidence

This contract is grounded in `@openclaw/lobster@2026.7.1`, its bundled
`@clawdbot/lobster@2026.6.11` runtime, and OpenClaw `2026.7.1`.

The optional `lobster` tool runs only outside the OpenClaw sandbox. `run`
accepts an inline pipeline or a workspace-relative `.lobster`, `.yaml`, `.yml`,
or `.json` file, optional JSON arguments, a workspace-bounded relative `cwd`,
timeout, and stdout cap. `resume` accepts a resume token or approval ID plus an
approve/reject boolean. Optional managed-flow fields add OpenClaw TaskFlow
identity and revision state.

The normalized result exposes:

- `ok`, `status`, and an output array;
- an optional approval request with prompt, items, resume token, and/or approval
  ID;
- or an error type and message;
- plus optional managed-flow and mutation state when that mode is used.

The durable artifact hashes output, prompt, and items rather than copying
arbitrary payloads. A resume token is an operational capability and is never
persisted; it remains in runtime custody. The plugin does not manage OAuth or
downstream credentials.

## Ownership boundary

Lobster owns pipeline execution, its typed envelope, approval continuation, and
managed-flow state. Workflow Operator owns a separate review artifact that
binds one exact workflow and input version to:

- the pre-reviewed step/effect/approval model;
- the exact exposed tool-call evidence;
- independently sourced effect and compensation evidence;
- human decisions over a specific paused state;
- and a truthful resume, abort, or partial-effects handoff.

The artifact does not reconstruct Lobster internals or claim universal
per-step telemetry. A per-step state is a Claw reconciliation observation and
must cite Lobster output or an authoritative external system.

## Downstream effects

`openclaw.invoke` can bridge from Lobster to OpenClaw tools only when the
gateway endpoint, authentication, target tool, and effective tool policy all
allow it. This Claw package grants only `read`, `write`, `edit`, and `lobster`.
Its shipped release-readiness scenario keeps the bridge disabled and stops
before the declared notification and tag tools.

Lobster approval and resume are control mechanisms, not transactions. Success
does not prove a notification or tag occurred. External effects require their
own authoritative receipts; unknown state blocks blind retry. Compensation is
manual or irreversible unless separately proven.

## Fixture status

`workflow-execution-reconciliation.example.json` is deterministic illustrative
documentation. It claims no workflow inspection, validation, human authority,
execution, approval, effect, or compensation.
