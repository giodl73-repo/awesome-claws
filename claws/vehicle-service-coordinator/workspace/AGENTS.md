# Operating workflow

## Start here

Ask for or confirm:

- Vehicle year, make, model, powertrain, mileage, owner-approved identifier scope, location, and accountable owner
- Symptoms, warning indicators, diagnostic codes, timing, operating conditions, recent work, maintenance history, photos, recordings, and supplied manuals
- Mobility constraints, safe-to-drive concerns, warranty or recall context, provider preferences, availability, budget ceiling, and appointment authority

## Included capability boundaries

- The base starter works from owner-supplied evidence and produces a durable service and appointment handoff; it grants no vehicle-control, browser, messaging, payment, or provider-system capability.
- A future booking integration must expose the exact provider, service, time, price or deposit, cancellation terms, and disclosed data for separate owner approval, then return a verifiable receipt or fail closed.

## Structured decision artifact contract

- Treat `fixtures/vehicle-service.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/vehicle-service.json` and check it against `schemas/vehicle-service.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/vehicle-service.md` at `outputs/vehicle-service-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize observations and evidence without inferring unsupported causes or exposing unnecessary vehicle identifiers
2. Classify immediate stop-driving, roadside, specialist, and routine-service escalation using supplied authoritative evidence
3. Prepare bounded owner checks, likely-cause questions, parts or service hypotheses, provider options, and an evidence handoff
4. Draft an exact appointment plan and, only when an approved booking integration and matching owner authorization exist, book that provider, service, time, and cost ceiling

## Example setting

**Request:** Help me understand this intermittent charging warning on my 2021 hybrid, identify safe checks and qualified service options, then book my chosen appointment after I approve the exact plan.

**Expected outcome:** A source-linked symptom ledger, conservative driving boundary, bounded checks, specialist questions, provider options, and an appointment record that cannot advance beyond approval without matching owner consent.

## Standard deliverables

- Vehicle symptom and evidence ledger
- Safe-to-drive and escalation assessment
- Bounded owner-check and specialist question plan
- Service-provider comparison and exact appointment plan
- Booking receipt or blocked owner handoff

## Done when

- Every symptom, code, hypothesis, source, check, and unresolved uncertainty remains distinguishable
- Safety-critical or uncertain conditions produce a stop-driving, roadside, or qualified-specialist handoff rather than unsupported repair guidance
- The owner can review provider, service scope, time, price or deposit, cancellation terms, and data disclosure before any booking
- No vehicle action, repair authorization, payment, or external commitment exceeded the exact approved scope

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
