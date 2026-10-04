# Operating workflow

## Start here

Ask for or confirm:

- Resident-stated need, candidate locality, relevant date, language, access modality, privacy ceiling, and accountable resident or delegate
- Official jurisdiction locators, agency directories, program pages, criterion text, intake-channel descriptions, office coverage, fee schedules, and revision dates
- Resident-controlled fact assertions labeled self-attested, document-backed, withheld, unknown, or reserved for agency review
- Known service-area ambiguity, cross-agency referral, offline alternative, interpreter or accommodation need, and time-sensitive condition

## Included capability boundaries

- The base starter reads owner-supplied or approved official civic-service sources and writes a private access packet; it has no government portal, messaging, calendar, upload, payment, identity, or account capability.
- Treat official directories and program pages as dated evidence rather than universal truth; jurisdiction, program version, office, channel, deadline, fee, and accessibility details must remain explicit.
- Minimize resident facts and retain self-attested, document-backed, and agency-confirmed states separately; never transform a criteria match into eligibility or approval.

## Structured decision artifact contract

- Treat `fixtures/service-access.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/service-access.json` and check it against `schemas/service-access.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/service-access.md` at `outputs/civic-services-navigator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Resolve the locality and service-area claims that govern the stated need, retaining every boundary conflict
2. Enumerate official program routes and bind agency, program identity, published revision, coverage, intake modality, language path, accommodation path, timing, and fee provenance
3. Crosswalk criterion text to resident-controlled evidence states and reserve every interpretation or adjudication question for the administering agency
4. Order the access-step dependency graph, required-material placeholders, deadline windows, alternate channels, and question docket
5. Version the route map after agency feedback or source revision without erasing superseded guidance or resident choices

## Example setting

**Request:** Map the official route for obtaining a reduced-fare transit card at my city-county boundary. Preserve which authority serves my address, the dated criterion text, the evidence states I chose to provide, interpreter and offline channels, step dependencies, and questions the transit authority must answer. Do not decide qualification or open a case.

**Expected outcome:** A versioned route map distinguishes city and county coverage, binds each criterion to resident-controlled evidence state, preserves offline and language-access paths, orders the intake dependencies, and routes unresolved adjudication questions to the transit authority.

## Standard deliverables

- Jurisdiction and responsible-agency resolution ledger
- Versioned public-service route map
- Criterion-to-resident-evidence crosswalk
- Access-step dependency graph and channel matrix
- Agency-question docket and resident handoff

## Done when

- The route map closes over every candidate jurisdiction and administering agency without silently choosing between conflicting service-area claims
- Each criterion has exactly one resident-controlled evidence state and zero workspace-authored adjudications
- Program revisions, step dependencies, intake modalities, language paths, accommodation paths, timing windows, fees, and unresolved questions remain source-bound
- The handoff names the resident-controlled next route and the agency-owned questions without initiating a case or transmitting resident evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
