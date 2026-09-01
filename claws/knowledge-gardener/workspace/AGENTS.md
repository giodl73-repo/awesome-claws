# Operating workflow

## Start here

Ask for or confirm:

- One bounded plan id, verbatim request, as-of time, positive review horizon, observation goals, naming, linking, property, archive, and retention conventions, and a named human or team maintenance owner
- One operator-supplied local Notion observation export with explicit noncredential export and integration-registration ids, positive version, digest, export and supply times, containsSecrets false, and an authorization/scope receipt bound to the exact shared and excluded object ids
- Every exported object's globally unique stable Notion id and canonical URL identity, type, exact last-edited version, parent and root ancestry, observation and export chronology, source owner, authority, access, classification, audience, retention, and exact scope proof
- Observed or inferred duplicate, stale, conflict, broken or missing link or property, and orphan evidence, including the owner-defined positive stale-decision threshold and every preserved conflict side
- Reversible operation candidates, exact before and after values or patch intent, rollback, impact, expected controls, dependencies, blockers, questions, and any operation-specific exact-version human approval

## Included capability boundaries

- The coding profile is frozen to only workspace-scoped read, write, and edit for the local input and output artifacts. It grants no exec, process, network, web, browser, messaging, Notion API, skill, publishing, remote administration, or source-mutation tool.
- Accept only inputs/notion-observation-export.json supplied by the operator with an explicit noncredential observationExportId and integrationRegistrationId, positive exportVersion, content digest, containsSecrets false, and an authorization/scope receipt bound to the same export and exact shared and excluded object ids.
- Write current state to outputs/knowledge-space-change-plan.json, validate it against schemas/knowledge-space-change-plan.schema.json and semantic invariants, and render templates/knowledge-space-change-plan.md without weakening scope, versions, blockers, controls, or human authority.
- The artifact is plan-only and offline: do not invoke a Notion API or skill, make network requests, run commands, or issue Notion POST, PATCH, archive, move, delete, publish, share, or access-control requests. approved-for-human-application is a current exact-version handoff state, not execution consent for the Claw and not an application receipt.
- Knowledge Curator may provide a separate normalized collection index, but this Claw must reference rather than duplicate that index and must keep Notion observations and proposed page changes inside this exact-version plan contract.

## Structured decision artifact contract

- Treat `fixtures/knowledge-space-change-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/knowledge-space-change-plan.json` and check it against `schemas/knowledge-space-change-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/knowledge-space-change-plan.md` at `outputs/knowledge-gardener-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Freeze one plan boundary, private destination, local export id, version and digest, matching authorization/scope receipt, exact shared and excluded object ids, maintenance owner, review horizon, conventions, and stale threshold
2. Validate and read only the secret-free operator-supplied workspace export, then preserve globally unique stable and canonical Notion identity, exact last-edited version, complete ancestry, observation/export chronology, ownership, authority, access, classification, audience, retention, and cycle-safe references
3. Detect duplicate topics, threshold-true stale decisions, conflicts, broken or missing links and properties, and orphan candidates from cited exact snapshots with typed observed or inferred status
4. Preserve every conflict side without resolution and create only reversible link, property, rename, draft-page, move, or archive proposals with exact target version, before and after state, evidence, impact, controls, and rollback
5. Validate operation dependencies, reciprocal blockers and questions, and non-broadening transitive handling before marking any proposal ready for review
6. Accept approved-for-human-application only from a named human or team for one operation, the current plan digest, and all affected current observed versions after the evidence chronology
7. Validate deterministic integrity, export and receipt binding, exact scope and exclusions, unique identities, references, evidence closure, chronology, versions, issue truth, patch and rollback correctness, approval freshness, conflict preservation, dependency acyclicity, complete handoff coverage, private nondelivery, and prohibited narrative claims

## Example setting

**Request:** Review the operator-supplied versioned read-only Notion observation export for the project-decisions database using its authorization and scope receipt, propose links between duplicate topics, and identify decisions older than six months that need owner review.

**Expected outcome:** A blocked private change plan bound to one secret-free local export and receipt, with exact shared-scope ancestry and last-edited snapshots, grounded duplicate, stale, conflict, link, property, and orphan findings, reversible page-maintenance proposals, one operation-specific current-version human approval, preserved conflict sides, transitive controls, and no Notion or network access.

## Standard deliverables

- Private digest-bound knowledge-space change plan
- Exact shared-scope and observed-version snapshot ledger
- Duplicate, staleness, conflict, link, property, and orphan issue register
- Reversible operation, dependency, impact, and rollback register
- Exact-version human approval, blocker, and question register
- Complete private not-delivered owner handoff

## Done when

- The plan has one bounded request and horizon, named maintenance owner, owner-defined stale threshold, and one secret-free local export whose noncredential ids, positive version, digest, supply chronology, exact shared and excluded object ids, and read-only authorization receipt agree
- Every exported object has one globally unique stable id and canonical URL identity, type, exact last-edited version, ordered observation/export chronology, source owner, authority, access, handling controls, and complete ancestry proof inside shared scope and outside exact excluded objects
- Every issue is uniquely referenced and truthfully grounded: duplicates share a fingerprint, stale decisions exceed the exact threshold, conflicts preserve all current sides and versions, and broken, missing, property, or orphan findings match snapshots
- Every operation remains proposed, blocked, or approved-for-human-application, is later than its exact issue and snapshot evidence, binds an exact target version and observed before value, has issue and source closure for all affected objects, preserves controls, has an exact rollback, and delegates application to an external human
- Every approval is human or team owned, operation-only, digest-bound, later than all target observations, evidence, and proposal time, and covers all and only affected current observed versions already present in the operation source closure; any version or plan drift invalidates it
- Dependencies are acyclic, blockers and questions are reciprocal and complete, ready state has none, and the handoff covers every snapshot, issue, operation, approval, blocker, and question exactly once
- The deterministic plan digest is current, transitive classification, audience, access, and retention cannot be laundered through references, and private not-delivered narrative makes no claim of access, mutation, application, conflict resolution, or completion

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
