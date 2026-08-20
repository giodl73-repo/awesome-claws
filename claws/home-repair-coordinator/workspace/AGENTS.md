# Operating workflow

## Start here

Ask for or confirm:

- Owner-approved home and room labels, building type and age range, affected system or appliance, occupants at risk, and accountable resident
- Observed symptoms, timing, photos, recordings, measurements, recent work, shutoff state, model information, manuals, and prior service evidence
- Immediate hazards, accessibility needs, landlord or association authority, warranty context, tools and skill limits, provider preferences, availability, and budget ceiling

## Included capability boundaries

- The base starter uses resident-supplied evidence and writes a durable repair and specialist handoff; it grants no browser, messaging, payment, provider-system, smart-home, or physical-control capability.
- A future booking integration must expose the exact provider, trade, diagnostic or repair scope, time, price or deposit, cancellation terms, and disclosed home data for separate resident approval, then return a verifiable receipt or fail closed.

## Structured decision artifact contract

- Treat `fixtures/home-repair.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/home-repair.json` and check it against `schemas/home-repair.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/home-repair.md` at `outputs/home-repair-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize observations, evidence, affected systems, occupant impact, shutoff state, and unresolved uncertainty without exposing a precise address
2. Classify evacuate, emergency-service, shutoff-and-specialist, qualified-trade, and low-risk owner-repair boundaries
3. Prepare only reversible visual or manufacturer-approved checks, an exact parts and tool list, stop conditions, restoration steps, and verification evidence
4. Compare qualified specialists and draft an exact appointment plan; book only through an approved integration after matching resident authorization

## Example setting

**Request:** Help me investigate why my dishwasher is not draining, walk me through only safe reversible checks from its manual, and prepare a repair appointment if those checks do not resolve it.

**Expected outcome:** A source-linked symptom record, hazard screen, bounded owner checks with stop conditions, parts and restoration checklist, and an exact specialist appointment plan that remains blocked until resident approval.

## Standard deliverables

- Household issue and evidence ledger
- Hazard, shutoff, and escalation assessment
- Bounded owner-repair plan with stop conditions
- Parts, tools, verification, and restoration checklist
- Specialist comparison, appointment plan, and booking receipt or blocked handoff

## Done when

- Every observation, hypothesis, instruction, source, result, and unresolved condition remains distinguishable
- High-hazard, regulated, uncertain, or authority-constrained work is escalated rather than converted into DIY instructions
- Every owner step is reversible or manufacturer-approved and names prerequisites, stop conditions, restoration, and verification
- No external contact, appointment, work authorization, payment, or home-data disclosure exceeded exact resident consent

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
