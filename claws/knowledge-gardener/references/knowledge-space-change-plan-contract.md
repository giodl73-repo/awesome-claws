# Knowledge-space change plan contract

Knowledge Gardener owns one durable, reviewable change plan for one observed
version of an explicitly shared Notion knowledge-space scope. Notion owns page,
database, property, link, archive, sharing, and access-control state. Knowledge
Curator separately owns a system-neutral normalized collection index. The
Gardener neither duplicates that index nor claims that a proposed operation was
applied.

The artifact uses `awesomeClaws.knowledgeSpaceChangePlan.v1`. Its deterministic
digest binds the request boundary, exact observed snapshots, detected issues,
proposed operations, blockers, questions, and authority gates while excluding
approval state. An approval can therefore bind a stable proposal without
creating a circular digest, but any plan, snapshot, issue, target, patch,
rollback, blocker, question, or authority change invalidates the approval.

## Local observation-export boundary

Record one plan id, verbatim request, as-of time, positive review horizon,
observation goals, owner-defined stale-decision threshold, naming, linking,
property, archive, and retention conventions, and a named human or team
maintenance owner. The Claw reads one operator-supplied, versioned, digest-bound
Notion observation export at `inputs/notion-observation-export.json`. Its
`observationExportId`, `integrationRegistrationId`, and authorization receipt id
use explicit noncredential formats that cannot be Notion keys. The export marks
`containsSecrets` false and records export and local-supply times.

The operator supplies a read-only authorization/scope receipt bound to the same
export id, integration-registration id, version, and digest. It names the human
or team authorizer, authorization and receipt times, validity at export, exact
shared root object ids, and exact excluded object ids. Only exact shared roots
and their proven descendants may appear. A plausible Notion URL is not scope
proof. Every snapshot shows its stable object id and type, root and parent chain,
artifact and Notion ancestry, explicitly shared ancestor, and absence of every
excluded ancestor. Shared and excluded identities are disjoint, and exclusion
wins for any exact ancestry intersection.

The installed Claw has only local workspace `read`, `write`, and `edit` for the
supplied input and its output artifacts. It has no package, network, exec,
process, browser, web, Notion API, Notion skill, or source-mutation access.

## Exact observed snapshots

Preserve each Notion object separately with a globally unique stable id and
canonical URL/object identity, page or database type, credential-free URL, exact
`last_edited_time` version, parent and root ancestry, operator observation and
export inclusion times, source owner, authority, access state, classification,
audience, and human-controlled retention. Reject duplicate identity rather than
overwriting a map entry. Record only values needed to ground proposed patches,
plus visible missing links, properties, and inbound-link counts. Restricted or
unavailable objects remain restricted or unavailable; reachability never widens
access.

References between snapshots carry controls transitively. Every derived issue,
operation, approval, blocker, question, and handoff inherits the strongest
classification, the audience intersection, all retention policies, all unknown
retention obligations, and at least the longest known retain-until date through
the complete cycle-safe reference closure.

## Detected issues

Issues are typed as observed or inferred and cite exact snapshot evidence.
Evidence snapshot refs equal, rather than merely subset, every affected object
side. Duplicate and conflict issues therefore cannot omit one side.
Duplicate topics require at least two distinct objects with the same normalized
topic fingerprint. Stale decisions require decision objects whose exact
last-edited times are older than the maintenance owner's recorded threshold as
of the plan. Conflicts preserve every exact-version side with one shared
decision key and distinct content digests. The artifact never selects, merges,
or resolves a side. Broken links, missing links, missing properties, and orphan
candidates must be visible in their cited snapshots. Related issue links are
reciprocal.

## Proposed operations

Operations are limited to `link`, `property-update`, `rename`, `draft-page`,
`move`, and `archive`. Every operation identifies one exact observed target
version, all affected objects, exact source-snapshot closure, materially
grounding issue closure, dependencies, impact, expected access and handling
controls, before and after values or patch intent, and a rollback patch that
restores the exact before value. `proposedAt` is strictly after every cited
observation and issue and no later than plan as-of. Archive and move proposals
remain reversible. Any operation touching an unresolved conflict side remains
proposed or blocked and cannot be approved to rename, edit, modify, archive,
move, or otherwise structurally hide that side.

States are only `proposed`, `blocked`, and
`approved-for-human-application`. Application is always
`external-human`; there are no executed or applied states. Blocked operations
name complete blockers. Approved operations name exactly one approval for that
operation and every affected object's current observed version.

## Exact-version human approval

Approval is never blanket. It names one operation, one current plan digest, all
and only affected targets and exact observed versions, a named human or team,
and an approval time at or after every affected target observation and after
every cited issue and proposal. Every approved target must already exist in the
operation's exact source snapshot closure; approval cannot introduce an unseen
object. A changed snapshot version, target set, plan digest, operation, or
receipt binding makes approval stale. Approval authorizes only a human to
consider applying the exact proposal outside this artifact; it does not grant
the Claw mutation authority and is not an application receipt.

## Dependencies, blockers, questions, and handoff

Dependencies resolve to operations and form an acyclic graph. An operation
cannot be approved while a dependency is not approved. Blocker-to-operation,
issue, object, and question links are reciprocal. A ready plan has no open
blocker or blocking question. The handoff covers every snapshot, issue,
operation, approval, blocker, and question exactly once and repeats every and
only current blocker and blocking question.

Keep `outputs/knowledge-space-change-plan.json` and
`outputs/knowledge-gardener-handoff.md` private, local, and not delivered. The
verbatim request is source input and is not scanned as an agent claim. Agent
narrative is scanned for active and passive claims of access, mutation,
application, completion, sharing, publication, autonomous conflict resolution,
decision, or retention action, including rename, edit, property modification,
link, write, archive, move, create, update, and delete claims. Clearly proposed
owner actions remain allowed.

## Authority boundary

The required gates prohibit reads outside shared scope; Notion create, update,
archive, move, delete, publish, share, and access-control changes; copying
restricted material to weaker pages; autonomous conflict resolution, decisions,
or retention action; and claims of mutation, completion, or access. The Notion
API and Notion skill are absent. Any application is a separate external
human-controlled workflow with its own current authorization and receipt
contract.
