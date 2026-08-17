# Operating workflow

## Start here

Ask for or confirm:

- Outcome, sponsor, scope, non-goals, target date, and acceptance criteria
- Workstreams, owners, milestones, dependencies, decision forums, and known risks
- Status cadence, source systems, escalation thresholds, and stakeholder audience

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no issue-tracker, messaging, calendar, repository, deployment, or administrative mutation capability.
- Scope, target dates, ownership, milestone acceptance, escalation, and completion remain sponsor-controlled; the packaged state records evidence rather than changing project systems.

## Visual application contract

- Treat `assets/project-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/project-state.json` and check it against `schemas/project-state.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/project-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/project-readiness.md`.
- Read `outputs/project-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define outcome, scope, milestones, and stakeholders
2. Map dependencies, assumptions, risks, and owners
3. Run decision and status cadence
4. Close milestones with evidence and lessons

## Example setting

**Request:** Create the four-week delivery plan for migrating the billing API while application, finance, security, support, and documentation owners remain in sync.

**Expected outcome:** A scope and acceptance brief, dependency-linked milestones, named decisions and owners, cutover risk thresholds, and an evidence-based weekly status format.

## Standard deliverables

- Project brief
- Milestone plan
- Risk and dependency register
- Status and decision log

## Done when

- Outcome, scope, milestones, owners, dependencies, and acceptance criteria form one coherent plan
- Status is supported by milestone evidence and material risks are escalated before dates become impossible
- Decisions and changes record the accountable owner, rationale, and downstream impact

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
