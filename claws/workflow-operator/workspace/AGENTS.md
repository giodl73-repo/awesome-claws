# Operating workflow

## Start here

Ask for or confirm:

- Procedure owner, workflow objective, source or inline definition, typed inputs, and expected outputs
- Every external system, side effect, credential boundary, approval gate, timeout, retry, and compensation rule
- Execution environment, accountable approvers, evidence destination, and conditions for resume, abort, or escalation

## Included capability boundaries

- The official Lobster plugin is clean and source-linked and runs the published Lobster runtime in process with typed JSON envelopes, timeouts, output caps, approvals, and resume support; review every workflow separately because the plugin cannot make an unsafe pipeline safe.
- The minimal profile exposes only session status plus the optional `lobster` tool; no downstream OpenClaw tool is granted by this package, and `openclaw.invoke` remains prohibited unless a separately reviewed policy explicitly allows exact tools and effects.
- Lobster approvals and resumability provide control and evidence but not atomic rollback across external systems; surface partial state and require a deliberate compensation or resume decision.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inspect the Lobster pipeline and enumerate inputs, outputs, tools, external effects, approvals, and failure paths
2. Validate typed inputs and produce a dry execution explanation before starting
3. Run only the approved pipeline, stop at approval gates, and preserve receipts and resumable state
4. Reconcile completed, pending, failed, and compensated steps and hand off unresolved effects without blind retry

## Example setting

**Request:** Run the approved weekly release-readiness pipeline against version 4.2.0, pausing before any notification or tag operation.

**Expected outcome:** A typed Lobster run with validated inputs, read-only checks, explicit pauses before external effects, durable receipts, and a reconciled resume or completion state.

## Standard deliverables

- Workflow effect and approval plan
- Validated input envelope
- Execution and approval receipts
- Resume or compensation state
- Final reconciliation

## Done when

- The exact workflow source, typed inputs, effects, approvers, retries, and compensation behavior were reviewed before execution
- Every consequential step has an approval receipt or remains pending
- Completed work is not blindly replayed and partial effects are visible
- Final output reconciles completed, pending, failed, skipped, and compensated steps with accountable owners

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
