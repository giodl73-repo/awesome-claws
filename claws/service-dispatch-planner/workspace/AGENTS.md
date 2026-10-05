# Operating workflow

## Start here

Ask for or confirm:

- Planning date and timezone, accountable dispatcher, exact input revisions and priority rules; single-technician jobs only
- Job IDs, required skills, supplied durations, earliest-start and latest-finish windows, site labels, parts and access readiness, holds and locked appointments
- Approved technician skills, shift availability, breaks, existing commitments and start/end locations
- Supplied directional travel minutes between required locations, effective date and approved buffers; missing routes remain unknown rather than zero

## Included capability boundaries

- Write `outputs/service-dispatch.json` using `schemas/service-dispatch.schema.json`; follow `references/dispatch-contract.md`.
- Write the matching Markdown itinerary at `outputs/service-dispatch-planner-handoff.md` using `templates/service-dispatch.md`.
- A schedule requiring missing travel, duration, qualification or readiness evidence stays incomplete. Multi-person crews, multi-day jobs and emergency dispatch are out of scope.

## Structured decision artifact contract

- Treat `fixtures/service-dispatch.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/service-dispatch.json` and check it against `schemas/service-dispatch.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/service-dispatch.md` at `outputs/service-dispatch-planner-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the common planning date, timezone, evidence revisions and permitted data; separate safety escalations and missing constraints
2. Preserve fixed appointments and construct a proposed assignment order using supplied priority rules, skills, availability, travel and readiness
3. Check every proposed start and finish against appointment windows, shifts, breaks, travel legs and locked commitments; retain unassigned jobs with reasons
4. Produce a technician itinerary and job-disposition table with source references, assumption register and dispatcher decision handoff; describe feasibility without claiming global optimality
5. Revalidate changed jobs and affected technician itineraries after new input revisions; invalidate old schedule review rather than inheriting approval

## Example setting

**Request:** Draft Monday's schedule from the supplied two-technician roster, three service jobs, fixed appointment and travel table. Retain the parts-held job and do not contact or dispatch anyone.

**Expected outcome:** A feasible draft with travel-aware appointment times, the fixed appointment unchanged, the parts-held job visibly unassigned, and a human release gate.

## Standard deliverables

- Draft technician itinerary with job, site, start, finish and travel legs
- Complete job-disposition table including unassigned jobs and blockers
- Constraint and source-revision register
- Changed-appointment comparison and dispatcher approval questions

## Done when

- Every supplied job appears exactly once as assigned, unassigned or human-escalation-required
- Each assignment satisfies supplied skills, readiness, windows, shifts, breaks and directional travel with no overlap or unsupported zero-duration travel
- Fixed commitments remain unchanged; affected schedules become unreviewed after evidence revisions
- The durable Markdown itinerary and exception list agree and no external action or optimality claim is implied

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
