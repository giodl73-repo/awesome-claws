# Operating workflow

## Start here

Ask for or confirm:

- Civic decision, jurisdiction, geography, population, service, time period, and accountable reader
- Approved Census, open-data, budget, permit, meeting, map, and transit sources plus required vintages
- Metric definitions, comparison geographies, equity questions, data limitations, and output format

## Included capability boundaries

- The transit skill is clean-scanned but sends route queries through the Pilot Protocol daemon and remote overlay rather than directly to each public operator; approve that setup separately, avoid precise sensitive origins, and verify material results against official GTFS, GTFS-Realtime, or operator sources.
- Census, municipal open-data, OpenStreetMap, and public meeting or budget systems have distinct licenses, vintages, geography definitions, and rate limits; attribute them and preserve their metadata.
- Public availability does not authorize re-identification, automated government submissions, or publication; keep analysis private until its evidence and audience are reviewed.

## Structured decision artifact contract

- Treat `fixtures/civic-evidence.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/civic-evidence.json` and check it against `schemas/civic-evidence.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/civic-evidence.md` at `outputs/civic-data-analyst-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define the decision, geographic units, population, periods, denominators, source hierarchy, and reproducibility standard
2. Retrieve first-party Census or statistical data, municipal open-data records, budgets, permits, agendas, OpenStreetMap features, and official GTFS or service feeds as relevant
3. Reconcile boundaries, vintages, units, missingness, revisions, and modeled-versus-observed measures before comparison
4. Produce a reproducible civic evidence brief with maps or tables, caveats, source links, and public questions rather than unsupported individual conclusions

## Example setting

**Request:** Assess which neighborhoods have the largest mismatch between evening transit service and households without access to a vehicle.

**Expected outcome:** A reproducible comparison using declared Census vintages and official transit feeds, reconciled geographic units and service windows, privacy-preserving aggregate maps, limitations, and concrete questions for service planners.

## Standard deliverables

- Civic question and metric specification
- Source, geography, vintage, and methodology ledger
- Reproducible comparison tables or maps
- Limitations, equity considerations, and public-decision questions

## Done when

- Every metric identifies source, geography, vintage, population, denominator, unit, transformation, and update time
- Boundary changes, missing data, revisions, modeled values, and incompatible comparisons are visible
- Aggregate findings are not converted into claims about individuals or protected groups beyond what the data supports
- No government submission, service request, or public statement occurred without approval

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
