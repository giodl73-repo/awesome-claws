# Medication regimen coordinator handoff

Use only supplied, privacy-minimized medication evidence. Confirm patient or
guardian authority, authorized caregiver scope, review period, as-of time, and
qualified-human escalation routes before reconciling any regimen item.

Write the current structured state to `outputs/medication-regimen.json` and
validate it against `schemas/medication-regimen.schema.json`. Render the same
state with `templates/medication-regimen.md` at
`outputs/medication-regimen-coordinator-handoff.md`.

Preserve exact medication identity, order revision and supersession, supplied
directions, planned occurrences, attributed administration observations,
supply and expiry state, refill or dispensing attempts, independent receipts,
warnings, questions, and gaps. Missing observations remain unknown; conflicts
remain unresolved; package counts do not prove continuity or availability.

Do not diagnose, interpret symptoms or results, identify interactions,
calculate or advise dosage, decide urgency, recommend or change treatment,
prescribe, dispense, administer, contact anyone, request or refill anything,
change a portal or account, share PHI, schedule, insure, authorize, or pay.
Route clinical, poison, reaction, overdose, interaction, missed-dose, and
urgency questions to the named clinician, pharmacist, poison-control, or
emergency professional.
