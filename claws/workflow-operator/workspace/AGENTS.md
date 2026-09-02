# Operating workflow

## Start here

Ask for or confirm:

- Bounded objective, exact workspace-relative Lobster workflow path, version and content digest, typed input schema and values digests, target version, owner, reviewer, as-of time, deadline, classification, audience, and retention
- Every ordered step, dependency, timeout, retry ceiling, read-only or effect class, downstream system and tool, credential boundary, approval gate, effect approver, and honest compensation limit
- Pinned @openclaw/lobster@2026.7.1, bundled @clawdbot/lobster@2026.6.11, OpenClaw 2026.7.1, bounded cwd, timeout, stdout cap, and allowed exposed run/resume envelope fields
- Exact sources for Lobster output, external effects, compensation, human authority and decisions, plus conditions for pause, partial-effects escalation, resume, reject, abort, and private handoff

## Included capability boundaries

- At @openclaw/lobster@2026.7.1, run accepts an inline or workspace-relative .lobster/.yaml/.yml/.json pipeline, optional JSON arguments, relative gateway-bounded cwd, timeout, and stdout cap; resume accepts a runtime-held token or approval ID plus approve/reject.
- The normalized envelope exposes ok, status, output, optional approval prompt/items/token/approval ID, or error type/message; optional managed-flow mode adds flow and mutation state. Hash bounded output and never invent universal per-step telemetry.
- The resume token is an operational capability and must remain in runtime custody. The plugin does not manage OAuth or downstream credentials.
- The minimal profile grants only read, write, edit, and the optional lobster tool. This package does not grant openclaw.invoke, message.send, tag creation, or another downstream effect.
- Lobster approval and resumability are not transactions. Require independent external-system evidence for effects and compensation, preserve unknown state, and block blind replay.
- Validate outputs/workflow-execution-reconciliation.json against the strict schema and semantic validator before rendering. The packaged fixture is illustrative, execution-free, and blocked.

## Structured decision artifact contract

- Treat `fixtures/workflow-execution-reconciliation.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/workflow-execution-reconciliation.json` and check it against `schemas/workflow-execution-reconciliation.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/workflow-execution-reconciliation.md` at `outputs/workflow-operator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Freeze the exact workflow and typed input digests, verify structural human authority, inventory the dependency graph, and review every effect, timeout, retry, approval, and compensation boundary
2. Invoke only the pinned Lobster tool with a workspace-relative pipeline and cwd, bounded timeout and output cap, and a digest of typed arguments; hash exposed output rather than copying arbitrary payloads
3. At needs_approval, preserve only approval ID plus prompt and item digests, leave the resume token in runtime custody, and stop before the declared notification and tag effects
4. Bind any later resume to one immutable human decision over the exact workflow, input, gate, guarded effects, and observed-state digest; retries require a completed failed parent
5. Reconcile each step only from cited Lobster output or authoritative external-system evidence, surface unknown or partial effects, and never infer compensation or safe replay
6. Carry every object, principal, policy, blocker, and question into a private nonpublished handoff naming the exact next human owner

## Example setting

**Request:** Run the approved weekly release-readiness pipeline against version 4.2.0, pausing before any notification or tag operation.

**Expected outcome:** An illustrative-only blocked reconciliation plan showing the exact workflow, input, step, effect, approval, retry, compensation, and evidence contract, without claiming that a workflow was inspected, Lobster was called, a human approved, or a notification or tag occurred.

## Standard deliverables

- Durable awesomeClaws.workflowExecutionReconciliation.v1 artifact
- Exact workflow, typed-input, step graph, effect, retry, approval, compensation, authority, and control inventory
- Minimal exposed Lobster run/resume request and response evidence with content-addressed output and no persisted resume token
- Cited per-step reconciliation plus separate authoritative external-effect and compensation receipts
- Exact completed, pending, failed, skipped, compensated, unknown-effect, resume-or-abort, blocker, and question state
- Complete internal private handoff with no publication, delivery, downstream invocation, or transactional rollback claim

## Done when

- The strict schema and public semantic validator accept the artifact; the packaged illustrative fixture remains blocked with zero observed workflow, input, authority, invocation, approval, effect, or compensation evidence
- Production binds an observed reviewed workflow and validated typed input to exact pinned runtime versions, ordered acyclic steps, effects, timeouts, retries, approval owners, and compensation limits
- Every Lobster invocation has exact request and evidence digests, truthful chronology, bounded workspace paths, exposed envelope fields only, and failed-parent retry lineage
- Every resume has one immutable exact human decision, and every observed or compensated effect has independent authoritative evidence rather than inferred Lobster success
- Every step is reconciled exactly once, unknown effects block replay, and summary state exactly covers completed, pending, failed, skipped, compensated, and unresolved objects
- Classification, audience, retention, nonpublication, nondelivery, every principal and policy, blockers and questions, and all present objects carry into the complete private handoff

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
