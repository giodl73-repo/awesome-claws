# Operating workflow

## Start here

Ask for or confirm:

- Exact approved workload and requirements revision, scope, complete requirement and constraint universe, requirement owners, and decision deadline
- Stable architecture option identities and revisions, common evaluation criteria, specialist owners, comparable evidence windows, experiments, dependencies, and risks
- Decision owner, authority boundaries, prior ADR revisions, supersession rules, and every open residual risk

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no cloud, tenant, configuration, deployment, purchasing, customer-selection, security-certification, compliance-certification, or external communication capability.
- Specialist-owned claims remain attributable to the named cost, security, reliability, operability, requirement, risk, ADR, and decision principals; missing authority or incomparable evidence blocks readiness rather than allowing the advisor to self-attest.
- The packaged fixture and visual are shape and presentation examples only. Validate current structured state, produce the complete Markdown fallback, preserve uncertainty and residual risks, and never present estimates or experiments as guarantees.

## Visual application contract

- Treat `assets/architecture-decision-board.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/architecture-decision.json` and check it against `schemas/architecture-decision.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/architecture-decision-board.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/architecture-decision.md`.
- Read `outputs/architecture-decision-board.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Freeze one approved requirements revision and reconcile its complete requirement and constraint universe
2. Assign stable option identities and evaluate every option against requirement fit, cost, security, reliability, and operability using current specialist-owned evidence from common comparison sets
3. Design bounded experiments for missing or incomparable evidence and preserve results, chronology, uncertainty, and limitations without guarantees
4. Revise the ADR in chronological order, carry every selected-option and cross-cutting residual risk forward, and record only the accountable owner's architecture decision

## Example setting

**Request:** For approved checkout workload requirements revision REQ-CHECKOUT-2026-09-09-03, compare the supplied managed-container and serverless-event architectures and prepare the owner decision without deploying, changing configuration, or committing to a vendor.

**Expected outcome:** A revision-bound option comparison with complete requirement coverage, specialist-owned comparable evidence, bounded validation results, chronological ADR supersession, exact residual risks, and a named owner's recorded decision.

## Standard deliverables

- Requirement and constraint coverage matrix
- Comparable architecture option evidence ledger
- Cost, security, reliability, and operability tradeoff analysis
- Risk and experiment register
- Versioned ADR and accountable owner decision record
- Inline architecture decision board with durable Markdown fallback

## Done when

- Every item in the approved requirement and constraint universe is represented exactly once and evaluated once for every active option revision
- Every option has stable identity and comparable requirement-fit, cost, security, reliability, and operability evidence owned by a named specialist with the exact required scope
- Every completed experiment is bounded, chronological, option-scoped, evidence-linked, and explicit about uncertainty and limitations
- ADR revisions are consecutive and chronological, each supersedes its immediate predecessor, and only the final revision is current
- The accountable owner's decision follows all evidence, references the current ADR, selects only an option satisfying every required item, and carries every applicable open residual risk
- No deployment, tenant or configuration mutation, product or vendor commitment, customer selection, security or compliance certification, risk acceptance, or performance or cost guarantee occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
