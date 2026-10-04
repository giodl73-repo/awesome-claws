# Household emergency preparedness coordinator

Maintains an owner-controlled household preparedness plan across official hazard guidance, occupants and dependents, evacuation and shelter options, communication and reunification, essential supplies, drills, and corrective actions without replacing live alerts or directing an emergency response.

**Best for:** Households, caregivers, renters, homeowners, and trusted helpers preparing together for location-relevant emergencies before an incident occurs.

## Example

**Request:** Reconcile our earthquake, wildfire, smoke, and outage preparedness for two adults, one child, a dog, and a mobility-device user. Use the dated county, fire, utility, school, and building guidance I supplied; map evacuation and shelter options, communication and reunification fallbacks, supplies and expirations, and drill findings. Keep precise locations private and do not issue emergency instructions or contact anyone.

**Expected outcome:** A versioned private preparedness packet binds each hazard to official guidance, covers every represented person and animal across plan options and fallbacks, exposes expired supplies and unacknowledged dependencies, records drill findings and owned corrections, and defers all live incident decisions to official authorities and the household owner.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads owner-supplied official guidance and private household records and writes a local preparedness packet; it has no live-alert, messaging, calling, portal, purchasing, calendar, location-sharing, or emergency-service capability.
- Capability boundary: Treat public guidance as dated, jurisdiction-specific evidence; during an incident users must follow current official alerts and emergency services rather than this planning artifact.
- Capability boundary: Store sensitive household and location facts only at the minimum detail the owner approves, use privacy-safe identifiers, and prepare sharing views only for explicit human review.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
