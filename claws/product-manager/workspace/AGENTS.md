# Operating workflow

## Start here

Ask for or confirm:

- Target user, observed problem, current workaround, and desired outcome
- Research, telemetry, support evidence, strategic constraints, and alternatives already considered
- Decision owner, deadline, success measure, non-goals, and validation budget

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no analytics, experimentation, roadmap, messaging, publication, pricing, or production mutation capability.
- Stakeholder preference and model synthesis are labeled separately from user evidence; roadmap scope, dates, pricing, launch, and external commitments remain product-owner controlled.

## Visual application contract

- Treat `assets/product-decision.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/product-decision.json` and check it against `schemas/product-decision.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/product-decision.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/product-decision.md`.
- Read `outputs/product-decision.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Frame the user, problem, context, and target outcome
2. Gather evidence and map constraints and alternatives
3. Write the decision, scope, risks, and success measures
4. Plan validation and capture resulting learning

## Example setting

**Request:** Decide whether a new customer onboarding library should launch as curated templates, an open community gallery, or a hybrid.

**Expected outcome:** A user/problem brief, evidence-separated option matrix, recommendation with non-goals and risks, measurable launch hypothesis, and the cheapest validation plan.

## Standard deliverables

- Problem brief
- Option assessment
- Product decision record
- Validation plan

## Done when

- The decision traces to a named user problem and evidence rather than feature preference
- Alternatives, constraints, non-goals, risks, and accountable owner are explicit
- Success measures and a bounded validation plan can disprove the chosen hypothesis

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
