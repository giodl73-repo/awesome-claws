# Operating workflow

## Start here

Ask for or confirm:

- Approved aggregate capability-gap revision, skill taxonomy version, program owner, audience, privacy class, and review horizon
- Curriculum versions, release requirements, cohort roster revisions, assignment policy, delivery prerequisites, and accountable owners
- Assignment receipts, completion records, assessment evidence, aggregate effectiveness measures, refresh criteria, and review chronology

## Included capability boundaries

- The base starter uses supplied local evidence and grants no LMS, HRIS, credential, messaging, or external contact authority.
- Write outputs/learning-program-release.json, validate it against schemas/learning-program-release.schema.json and the semantic invariants, and render both the complete Markdown fallback and optional inline review without weakening identity, privacy, chronology, blockers, or authority.
- When identity, privacy, or effectiveness evidence is missing or incompatible, preserve a blocked state rather than inferring or broadening access.

## Visual application contract

- Treat `assets/learning-program-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/learning-program-release.json` and check it against `schemas/learning-program-release.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/learning-program-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/learning-program-release.md`.
- Read `outputs/learning-program-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the approved aggregate capability-gap revision, taxonomy binding, privacy class, owners, and decision authority
2. Plan versioned curriculum releases and bind audience and cohort assignments to exact roster revisions
3. Reconcile delivery readiness, assignment receipts, completion and assessment identities, exceptions, and evidence gaps
4. Evaluate only approved aggregate effectiveness measures against declared criteria and preserve unsupported or privacy-blocked findings
5. Record human-owned refresh decisions and prepare a complete owner handoff without external action or HR mutation

## Example setting

**Request:** Turn the approved FY27 cloud reliability capability-gap revision into the next curriculum release and cohort plan, then track delivery evidence and prepare the quarterly refresh review.

**Expected outcome:** A revision-bound learning program package with versioned curriculum, cohort roster bindings, assignment receipts, completion and assessment identities, aggregate effectiveness evidence, privacy-aware blockers, human-owned refresh decisions, and no individual performance inference.

## Standard deliverables

- Versioned learning program release ledger
- Audience and cohort assignment register
- Delivery readiness and evidence register
- Aggregate effectiveness and refresh review
- Owner handoff

## Done when

- Every curriculum release and cohort assignment binds to exact approved gap, taxonomy, curriculum, and roster revisions
- Every readiness, completion, assessment, and aggregate effectiveness claim has current evidence or a visible blocker
- Every refresh decision and next action names its human owner and chronology without prohibited individual or employment claims

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
