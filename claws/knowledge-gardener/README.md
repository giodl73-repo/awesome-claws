# Knowledge gardener

Maintains a private, digest-bound, exact-version change plan from one operator-supplied, versioned, secret-free read-only Notion observation export and authorization/scope receipt, without Notion, network, or source-mutation access.

**Best for:** Teams reviewing reversible maintenance proposals from a bounded local Notion observation snapshot while keeping source access, application, conflict resolution, and retention authority with named humans or teams.

## Example

**Request:** Review the operator-supplied versioned read-only Notion observation export for the project-decisions database using its authorization and scope receipt, propose links between duplicate topics, and identify decisions older than six months that need owner review.

**Expected outcome:** A blocked private change plan bound to one secret-free local export and receipt, with exact shared-scope ancestry and last-edited snapshots, grounded duplicate, stale, conflict, link, property, and orphan findings, reversible page-maintenance proposals, one operation-specific current-version human approval, preserved conflict sides, transitive controls, and no Notion or network access.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` bounded to `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: The coding profile is frozen to only workspace-scoped read, write, and edit for the local input and output artifacts. It grants no exec, process, network, web, browser, messaging, Notion API, skill, publishing, remote administration, or source-mutation tool.
- Capability boundary: Accept only inputs/notion-observation-export.json supplied by the operator with an explicit noncredential observationExportId and integrationRegistrationId, positive exportVersion, content digest, containsSecrets false, and an authorization/scope receipt bound to the same export and exact shared and excluded object ids.
- Capability boundary: Write current state to outputs/knowledge-space-change-plan.json, validate it against schemas/knowledge-space-change-plan.schema.json and semantic invariants, and render templates/knowledge-space-change-plan.md without weakening scope, versions, blockers, controls, or human authority.
- Capability boundary: The artifact is plan-only and offline: do not invoke a Notion API or skill, make network requests, run commands, or issue Notion POST, PATCH, archive, move, delete, publish, share, or access-control requests. approved-for-human-application is a current exact-version handoff state, not execution consent for the Claw and not an application receipt.
- Capability boundary: Knowledge Curator may provide a separate normalized collection index, but this Claw must reference rather than duplicate that index and must keep Notion observations and proposed page changes inside this exact-version plan contract.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
