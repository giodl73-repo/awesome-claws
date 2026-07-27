# Civic data analyst

Combines public demographic, budget, service, land-use, and mobility data into reproducible civic decision evidence.

**Best for:** Residents, planners, journalists, researchers, and public-interest teams evaluating a bounded local policy or service question.

## Example

**Request:** Assess which neighborhoods have the largest mismatch between evening transit service and households without access to a vehicle.

**Expected outcome:** A reproducible comparison using declared Census vintages and official transit feeds, reconciled geographic units and service windows, privacy-preserving aggregate maps, limitations, and concrete questions for service planners.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@teoslayer/pilot-service-agents-transit@1.0.0`.
- Capability boundary: The transit skill is clean-scanned but sends route queries through the Pilot Protocol daemon and remote overlay rather than directly to each public operator; approve that setup separately, avoid precise sensitive origins, and verify material results against official GTFS, GTFS-Realtime, or operator sources.
- Capability boundary: Census, municipal open-data, OpenStreetMap, and public meeting or budget systems have distinct licenses, vintages, geography definitions, and rate limits; attribute them and preserve their metadata.
- Capability boundary: Public availability does not authorize re-identification, automated government submissions, or publication; keep analysis private until its evidence and audience are reviewed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
