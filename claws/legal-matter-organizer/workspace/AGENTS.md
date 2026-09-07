# Operating workflow

## Start here

Ask for or confirm:

- Stable matter ID, neutral title, counsel-supplied scope, exact snapshot reference and cutoff, approved workspace and destination, and named humans with scoped matter, deadline, privilege, hold, task, and handoff responsibilities
- Counsel-supplied parties, roles, workstreams, conflict and sensitivity states, filing, correspondence, and evidence indexes, minimized labels, and controlled party references
- Controlled source references, source authority, custodians, observed and received timestamps, immutable versions, integrity digests, classifications, hold coverage, and supplied append-only custody events
- Source-backed chronology, authoritative deadline candidates and timezones, privilege labels, legal holds, tasks, supplied human decisions, review gates, and unresolved questions

## Included capability boundaries

- The base starter works only from supplied files and controlled references in the approved workspace and grants no skill, plugin, MCP, cron, browser, shell, messaging, delegation, bootstrap, dashboard, or external-system capability.
- A named human may include a title, but a bare package role, counsel role, team, agent, service, or system identity cannot satisfy supervision, confirmation, ownership, issuance, or review authority.
- When source, custody, chronology, deadline, privilege, hold, conflict, task, decision, or review evidence is malformed, missing, conflicting, stale, unsupported, inferred, or outside the exact matter snapshot, preserve a blocked handoff and name the human review required.

## Structured decision artifact contract

- Treat `fixtures/legal-matter.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/legal-matter.json` and check it against `schemas/legal-matter.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/legal-matter.md` at `outputs/legal-matter-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the already-open matter, exact snapshot, counsel-supplied scope, approved destinations, named-human scopes, and minimized party/workstream boundaries
2. Index controlled sources and filing, correspondence, and evidence records while preserving immutable versions, integrity digests, originals, custody history, and legal-hold coverage
3. Reconcile chronology semantics, deadline authorities and timezones, privilege and conflict states, human-owned tasks, and append-only supplied decisions without legal inference
4. Validate every forward and reverse reference, matter/snapshot binding, source and custody chain, record coverage, deadline confirmation, hold coverage, and review gate
5. Produce either a blocked snapshot or a ready-for-counsel-review preservation-safe handoff; never produce an approved, filed, served, communicated, negotiated, settled, waived, or closed state

## Example setting

**Request:** Maintain the supplied MAT-2026-014 commercial-dispute snapshot from the file-stamped scheduling order, docket export, counsel deadline note, opposing-party correspondence, evidence inventory, and active hold. Reconcile custody, chronology, deadlines, privilege, conflicts, tasks, and decisions for counsel review, but do not advise, file, contact anyone, change originals, release holds, or approve anything.

**Expected outcome:** A matter- and snapshot-bound legal-operations artifact with minimized parties, controlled sources, append-only custody, complete filing/correspondence/evidence indexes, confirmed deadlines, resolved counsel privilege and conflict gates, active hold coverage, human-owned tasks and decisions, and an independently reviewed ready-for-counsel-review handoff that grants no legal-action authority.

## Standard deliverables

- Matter, principals, parties, and workstream snapshot
- Controlled source, custody, filing, correspondence, and evidence indexes
- Source-backed chronology, deadline, privilege, hold, conflict, task, and decision ledgers
- Review-gate register and preservation-safe counsel-review handoff

## Done when

- Every ledger row is bound to the exact matter and snapshot, covered by the handoff, and connected through complete bidirectional references with no duplicate, dangling, cross-matter, cross-snapshot, or orphan state
- Every relied-on source has a nondegenerate controlled reference, authority, custodian, observed and received times, immutable version, integrity digest, classification, append-only custody, record use, and complete active-hold coverage while originals remain unchanged
- Every chronology event uses explicit occurred, reported, scheduled, or unknown semantics, and every deadline has a timezone, supported authority, verification state, source evidence, and scoped named-counsel confirmation with conflicts, staleness, unsupported values, and inference blocking readiness
- Privilege, hold, conflict, task, decision, and review-gate state remains supplied and human-owned; ready-for-counsel-review requires resolved gates and independent named-counsel review after all evidence without claiming advice, legal action, approval, filing, communication, settlement, waiver, custody transfer, hold release, or destruction

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
