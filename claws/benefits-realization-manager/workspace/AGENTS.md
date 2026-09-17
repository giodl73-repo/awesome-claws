# Operating workflow

## Start here

Ask for or confirm:

- Exact benefits plan id and revision, predecessor revision or first-plan declaration, caller-controlled period and cutoff, currency, minor-unit scale, and complete benefit/disbenefit universe
- Named benefit, metric, finance, and trust owners with stable identities, authority evidence, KPI baseline/target/observation records, allocation approvals, lifecycle decisions, and finance-close evidence
- Injected owner-and-key-scoped public trust, signed semantic envelope, exact source bytes or controlled receipts, source versions and digests, prior-period realized state, and supersession or retirement evidence

## Included capability boundaries

- The base X4 starter reads only supplied workspace artifacts and an explicitly injected public trust/source bundle; it has no embedded production key, network, finance-system, portfolio-system, messaging, shell, or source mutation authority.
- Future read integrations must preserve caller-controlled time, exact source bytes or independently verifiable receipts, owner-scoped public trust, complete coverage, and the same no-causality and no-write boundaries.

## Visual application contract

- Treat `assets/benefits-realization-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/benefits-realization-ledger.json` and check it against `schemas/benefits-realization-ledger.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/benefits-realization-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/benefits-realization-ledger.md`.
- Read `outputs/benefits-realization-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the complete plan-revision identity, predecessor chain, caller period/cutoff, owner roster, injected trust, source bytes, and bounded evidence universe before interpreting results
2. Recompute direction-aware KPI deltas in integer minor units and allocate each shared KPI exactly once across its declared benefits using the approved deterministic residual rule
3. Reconcile direct disbenefits, unsupported attribution, predecessor supersession or retirement, and exact finance-close chronology without converting allocation into causality
4. Produce an X4 benefits ledger and equivalent Markdown handoff that withholds aggregate values unless every in-scope attribution and finance gate closes

## Example setting

**Request:** Reconcile benefits plan support-modernization revision 2 for Q3 from the supplied owner-approved benefit profiles, KPI records, allocation approvals, disbenefit observations, predecessor ledger, source bytes, and public trust store. Show realized and blocked value without claiming causality or changing any source or owner decision.

**Expected outcome:** A revision-bound X4 benefit ledger that accounts for every benefit, disbenefit, KPI share, predecessor state, source record, owner decision, unsupported attribution, and finance gate exactly once.

## Standard deliverables

- Plan, revision, predecessor, period, cutoff, owner, and trust identity block
- Closed benefit and disbenefit universe with lifecycle and predecessor reconciliation
- Shared-KPI baseline, target, observation, allocation, attribution, and residual ledger
- Derived gross, disbenefit, and net realization with unsupported-attribution blockers
- X4 benefits realization visual with equivalent Markdown handoff

## Done when

- Every in-scope benefit and disbenefit appears exactly once with stable identity, owner, lifecycle, baseline, target, period, evidence, and predecessor disposition
- Every shared KPI delta is direction-aware, allocated exactly once in integer minor units, and reconciles under a deterministic residual rule without double counting
- Unsupported attribution or an invalid finance close withholds aggregate realization, and no output claims causality, approval, certification, publication, or source mutation

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
