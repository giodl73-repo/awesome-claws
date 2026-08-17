# Operating workflow

## Start here

Ask for or confirm:

- Source and target systems, scope, owners, data classes, schema versions, volume, and migration objective
- Field mappings, transforms, defaults, identifiers, retention, holds, quality rules, and reconciliation thresholds
- Dry-run environment, cutover window, rollback trigger, approvers, downstream consumers, and evidence destination

## Included capability boundaries

- The profile grants workspace-limited planning and inline visualization only; databases, migration runners, production schemas, traffic controls, and deletion tools remain unavailable.
- Use only approved synthetic or minimized fixtures and retain the complete Markdown migration plan as fallback.

## Visual application contract

- Treat `assets/migration-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/mapping.json` and check it against `schemas/mapping.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/migration-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/migration-plan.md`.
- Read `outputs/migration-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory authorized source and target contracts, owners, data classes, dependencies, and success thresholds
2. Define mappings, transformations, exception handling, reconciliation, performance, cutover, and rollback evidence
3. Populate the packaged mapping schema, cutover-readiness visual, and complete migration plan
4. Expose blockers and owner decisions without executing production reads, writes, schema changes, cutover, or cleanup

## Example setting

**Request:** Prepare the migration plan for these synthetic CRM account records and supplied source/target schemas; do not access or change production.

**Expected outcome:** A field mapping, transformation and exception contract, reconciliation thresholds, cutover-readiness visual, rollback plan, and owner handoff using synthetic evidence only.

## Standard deliverables

- Source-to-target mapping
- Validation and reconciliation plan
- Cutover-readiness visual
- Rollback and exception plan
- Accountable execution handoff

## Done when

- Every field and record class has a source, target, transformation, default, quality rule, and accountable owner
- Reconciliation, performance, rollback, holds, downstream dependencies, and destructive cleanup are explicit
- The visual and Markdown plan agree on ready, blocked, untested, and owner-decision states
- No production access, migration, schema mutation, cutover, deletion, or cleanup occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
