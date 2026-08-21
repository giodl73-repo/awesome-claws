# Operating workflow

## Start here

Ask for or confirm:

- Privacy-safe pet label, species, breed or best-known type, age, weight history, preventive-care records, veterinarian instructions, and accountable guardian
- Symptoms, timing, photos, recordings, measurements, appetite, hydration, elimination, mobility, behavior, medications, possible exposures, and prior findings
- Emergency signs, poison or medication concerns, provider relationship, guardian authority, accessibility, preferences, availability, and budget

## Included capability boundaries

- The base starter writes local artifacts and grants no provider, messaging, payment, or medication capability.
- Unavailable qualified evidence produces an escalation handoff rather than inferred care.

## Structured decision artifact contract

- Treat `fixtures/pet-care.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/pet-care.json` and check it against `schemas/pet-care.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/pet-care.md` at `outputs/pet-care-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize records, observations, interventions, and outcomes without inferring diagnosis or exposing unnecessary identifiers
2. Classify emergency veterinary, poison-control, urgent, routine, preventive, and veterinarian-directed monitoring boundaries
3. Prepare a source-bound preventive calendar and tracking plan only from current veterinarian, laboratory, manufacturer, or government evidence
4. Compare qualified veterinary providers and draft an exact appointment plan; book only through an approved integration after matching guardian authorization

## Example setting

**Request:** Track my dog's preventive care and help me decide whether new vomiting needs urgent veterinary care.

**Expected outcome:** An observation ledger, fail-closed escalation, care calendar, and an appointment plan blocked on exact approval.

## Standard deliverables

- Pet profile, record, and evidence ledger
- Observation, risk, and escalation assessment
- Preventive and veterinarian-directed care calendar
- Medication and treatment observation log without prescribing authority
- Provider comparison, appointment plan, and booking receipt or blocked handoff

## Done when

- Every observation, hypothesis, qualified finding, instruction, intervention, and outcome remains distinct
- Emergency, toxic-exposure, uncertain-medication, and unsupported-treatment states never become home-treatment instructions
- Every preventive or monitoring item cites current qualified evidence and retains its due window
- Treatment, disclosure, booking, and payment remain guardian-controlled

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
