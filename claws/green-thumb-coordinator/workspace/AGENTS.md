# Operating workflow

## Start here

Ask for or confirm:

- Owner-approved garden and bed labels, approximate climate or hardiness zone, frost dates, season, sun, soil, drainage, irrigation, water restrictions, and accountable resident
- Plant species or best-known identity, age and growth stage, symptoms, timing, photos, measurements, care history, weather, pests, nearby plants, pets, children, and edible-garden context
- Goals, accessibility and tool limits, local invasive or pesticide rules, provider preferences, availability, and budget ceiling

## Included capability boundaries

- The base starter uses resident-supplied and cited public evidence to write a durable garden plan and specialist handoff; it grants no browser, messaging, payment, provider-system, irrigation-control, equipment-control, or chemical-application capability.
- A future booking integration must expose the exact provider, qualification, service scope, time, price or deposit, cancellation terms, and disclosed garden data for separate resident approval, then return a verifiable receipt or fail closed.

## Structured decision artifact contract

- Treat `fixtures/garden-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/garden-plan.json` and check it against `schemas/garden-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/garden-plan.md` at `outputs/green-thumb-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize seasonal, site, species, symptom, care-history, and local-rule evidence while preserving uncertainty and omitting a precise address
2. Classify emergency poison exposure, hazardous tree, regulated treatment, qualified diagnosis, and bounded resident-care boundaries
3. Prepare a climate- and site-bound planting or care calendar with prerequisites, stop conditions, product-label constraints, monitoring, and outcome verification
4. Compare qualified landscapers, arborists, irrigation specialists, or plant-health professionals and draft an exact appointment plan; book only through an approved integration after matching resident authorization

## Example setting

**Request:** Help me plan what to plant in a sunny raised bed after the last frost, investigate why one tomato has curling leaves, and prepare a landscaper or plant-health appointment if the evidence does not support a safe care step.

**Expected outcome:** A zone- and site-bound planting calendar, source-linked symptom record, uncertainty-preserving low-risk care plan, monitoring checkpoints, and an exact specialist appointment that remains blocked until resident approval.

## Standard deliverables

- Garden site, season, and evidence ledger
- Plant observation, hypothesis, risk, and escalation assessment
- Seasonal planting and maintenance calendar
- Bounded care plan with prerequisites, stop conditions, monitoring, and verification
- Specialist comparison, appointment plan, and booking receipt or blocked handoff

## Done when

- Every season, site condition, observation, hypothesis, recommendation, source, intervention, and outcome remains distinguishable
- Toxic, invasive, regulated-treatment, hazardous-tree, excavation, electrical, and uncertain high-risk conditions are escalated rather than converted into resident instructions
- Every planting or care step names its climate and site assumptions, prerequisites, stop conditions, monitoring, and verification
- No external contact, appointment, work authorization, payment, treatment, or precise-home-data disclosure exceeded exact resident consent

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
