# Operating workflow

## Start here

Ask for or confirm:

- Privacy-safe appliance label, manufacturer, model, serial evidence, purchase or installation date, and accountable owner
- Manual, warranty, registration, recall, maintenance, energy-use, and service-history evidence with source and freshness
- Owner priorities, availability, budget ceiling, and authority for registration, claims, retirement, and service

## Included capability boundaries

- The base starter writes local ownership artifacts and grants no appliance-control, manufacturer-account, warranty, recall-subscription, provider, messaging, payment, or smart-home capability.
- Future integrations must expose the exact appliance, data disclosure, manufacturer or servicer, purpose, scope, time, cost, terms, and owner approval, then return authoritative receipt evidence or fail closed.

## Structured decision artifact contract

- Treat `fixtures/appliance-care.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/appliance-care.json` and check it against `schemas/appliance-care.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/appliance-care.md` at `outputs/appliance-care-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Reconcile a multi-appliance ownership ledger without inventing model, serial, coverage, or recall matches
2. Derive recurring care only from model-bound manufacturer instructions and surface overdue or blocked items
3. Separate active recall, warranty, service-history, energy-cost, and remaining-life evidence for retain, repair-evaluation, or replacement-research decisions
4. Prepare an exact manufacturer or authorized-servicer action plan; execute only after matching owner approval and return a controlled receipt

## Example setting

**Request:** Organize my washer, dryer, refrigerator, and range; tell me which manufacturer care is due, whether any exact model or serial has a recall or active warranty, and prepare authorized service for approved items.

**Expected outcome:** A four-appliance provenance ledger, model-bound care calendar, exact-match recall and coverage states, lifecycle decision briefs, and approval-blocked manufacturer or authorized-servicer plans without troubleshooting or repair instructions.

## Standard deliverables

- Multi-appliance ownership and provenance ledger
- Model-bound preventive-care calendar with completion evidence
- Warranty, registration, recall, and service-history state
- Evidence-bounded retain, repair-evaluation, or replacement-research brief
- Manufacturer or authorized-servicer action plan with approval, receipt, or blocked handoff

## Done when

- Every appliance identity, due item, coverage statement, recall match, service event, and lifecycle recommendation cites the evidence that supports it
- Unverified identity, stale sources, hazardous symptoms, or missing manufacturer guidance block the affected conclusion or action rather than becoming generic advice
- No diagnosis or repair instruction is produced; active faults are handed to Home Repair or the appropriate emergency path
- Every registration, claim, contact, appointment, authorization, disclosure, acceptance, and payment remains owner-controlled

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
