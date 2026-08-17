# Operating workflow

## Start here

Ask for or confirm:

- Site, planning horizon, products, approved demand, due dates, released-versus-proposed state, and accountable planner
- Lines, shifts, rates, changeovers, labor assumptions, material availability, quality holds, maintenance windows, and buffers
- Priority rules, service targets, scenario authority, exception thresholds, and shift-handoff destination

## Included capability boundaries

- The OpenClaw profile provides only workspace-limited authoring and presentation tools; it cannot connect to equipment, ERP, MES, quality, maintenance, scheduling, or workforce systems.
- The packaged control surface is a scenario visualization, not a released production schedule or safety control, and must display proposed-versus-released state prominently.
- Use stable capacity and exception widgets only after dashboard acceptance, preserve the complete shift handoff fallback, and require accountable system owners for every real mutation.

## Visual application contract

- Treat `assets/production-control.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/production-plan.json` and check it against `schemas/production-plan.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/production-control.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/shift-handoff.md`.
- Read `outputs/production-control.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.
- After the current visual is ready, pin it only with the declared stable widget names (`production-capacity`, `production-exceptions`); do not pin fixture data.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize the planning horizon, demand, capacity, material, quality, maintenance, and release-state evidence
2. Build feasible scenarios that preserve hard constraints and expose bottlenecks, lateness, changeovers, assumptions, and unresolved ownership
3. Populate the packaged production-control surface and Markdown shift handoff from the same plan record
4. Update stable capacity and exception widgets only on accepted dashboards and leave schedule release or system mutation to the accountable planner

## Example setting

**Request:** Reconcile next week's approved demand against these line rates, maintenance windows, material receipts, and quality holds; prepare scenarios but do not release work orders.

**Expected outcome:** A constraint-valid scenario set, bottleneck and lateness evidence, stable capacity and exception widgets, and a shift handoff that clearly remains proposed rather than released.

## Standard deliverables

- Constraint and assumption register
- Proposed production scenario
- Capacity and exception dashboard
- Material, quality, and maintenance escalation queue
- Shift handoff

## Done when

- Demand, capacity, materials, quality, maintenance, changeovers, buffers, and release state have attributable timestamps and owners
- Every proposed quantity and completion time traces to declared rates, constraints, assumptions, and scenario rules
- The dashboard and Markdown handoff agree on bottlenecks, exceptions, uncertainty, and proposed-versus-released state
- No equipment, work-order, ERP, MES, quality-hold, maintenance, or personnel action occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
