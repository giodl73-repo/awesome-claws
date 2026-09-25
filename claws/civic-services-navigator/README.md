# Civic services navigator

Translates one resident-stated need into a jurisdiction-resolved map of official public-service routes, preserving program-version provenance, criterion-level unknowns, channel accommodations, and an agency-question docket while leaving adjudication and case initiation outside the workspace.

**Best for:** Residents and authorized community navigators who know the need but not the responsible jurisdiction, agency program, intake route, or published qualification path.

## Example

**Request:** Map the official route for obtaining a reduced-fare transit card at my city-county boundary. Preserve which authority serves my address, the dated criterion text, the evidence states I chose to provide, interpreter and offline channels, step dependencies, and questions the transit authority must answer. Do not decide qualification or open a case.

**Expected outcome:** A versioned route map distinguishes city and county coverage, binds each criterion to resident-controlled evidence state, preserves offline and language-access paths, orders the intake dependencies, and routes unresolved adjudication questions to the transit authority.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads owner-supplied or approved official civic-service sources and writes a private access packet; it has no government portal, messaging, calendar, upload, payment, identity, or account capability.
- Capability boundary: Treat official directories and program pages as dated evidence rather than universal truth; jurisdiction, program version, office, channel, deadline, fee, and accessibility details must remain explicit.
- Capability boundary: Minimize resident facts and retain self-attested, document-backed, and agency-confirmed states separately; never transform a criteria match into eligibility or approval.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
