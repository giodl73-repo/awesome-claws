# Operating workflow

## Start here

Ask for or confirm:

- Prepared locations, responsible owner, household members and dependents represented by privacy-safe identifiers, trusted-helper scope, and review cadence
- Dated official hazard guidance, evacuation-zone and shelter sources, local alert enrollment references, building instructions, utility shutoff guidance, and source authority hierarchy
- Owner-approved accessibility, language, mobility, communication, medical-device, transport, pet, school, workplace, custody, and reunification constraints
- Current evacuation and shelter options, communication fallbacks, supplies and expirations, documents, insurance references, drill history, and known gaps

## Included capability boundaries

- The base starter reads owner-supplied official guidance and private household records and writes a local preparedness packet; it has no live-alert, messaging, calling, portal, purchasing, calendar, location-sharing, or emergency-service capability.
- Treat public guidance as dated, jurisdiction-specific evidence; during an incident users must follow current official alerts and emergency services rather than this planning artifact.
- Store sensitive household and location facts only at the minimum detail the owner approves, use privacy-safe identifiers, and prepare sharing views only for explicit human review.

## Structured decision artifact contract

- Treat `fixtures/preparedness-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/preparedness-plan.json` and check it against `schemas/preparedness-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/preparedness-plan.md` at `outputs/household-emergency-preparedness-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the preparedness scope, private-data ceiling, named owners, official-source hierarchy, and the boundary between planning and live response
2. Build a location-to-hazard register and preserve official guidance revisions, coverage limits, conflicts, expiries, and unavailable evidence
3. Reconcile every represented person, dependent, animal, location, and assistance need against evacuation, shelter, communication, reunification, transport, and continuity options
4. Map owner-approved plan steps, alternatives, dependencies, supplies, document references, helper acknowledgements, and blocked external actions without inventing live triggers
5. Record exercises and drills, observed results, unresolved findings, corrective-action owners, evidence, due dates, and independent owner acceptance
6. Version the plan after household, location, guidance, supply, helper, or exercise changes while preserving superseded decisions and open gaps

## Example setting

**Request:** Reconcile our earthquake, wildfire, smoke, and outage preparedness for two adults, one child, a dog, and a mobility-device user. Use the dated county, fire, utility, school, and building guidance I supplied; map evacuation and shelter options, communication and reunification fallbacks, supplies and expirations, and drill findings. Keep precise locations private and do not issue emergency instructions or contact anyone.

**Expected outcome:** A versioned private preparedness packet binds each hazard to official guidance, covers every represented person and animal across plan options and fallbacks, exposes expired supplies and unacknowledged dependencies, records drill findings and owned corrections, and defers all live incident decisions to official authorities and the household owner.

## Standard deliverables

- Official-source and location-bound hazard register
- Privacy-minimized household needs and assistance coverage matrix
- Evacuation, shelter, communication, transport, and reunification option map
- Supply, document, dependency, expiry, and gap ledger
- Drill, finding, corrective-action, and owner-review record
- Private preparedness handoff with live-emergency boundaries

## Done when

- Every declared location and hazard is reconciled to dated official guidance or an explicit evidence gap without workspace-authored warning thresholds
- Every represented person, dependent, animal, accessibility need, communication need, transport constraint, and critical dependency is covered by an owner-approved option or an explicit unresolved gap
- Every plan step, supply, document pointer, helper dependency, drill finding, and corrective action has a current state, accountable owner, provenance, and review or expiry condition
- The private handoff preserves superseded plans and blocked external actions and makes no claim of live safety, readiness certification, emergency direction, contact, purchase, enrollment, or transmission

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
