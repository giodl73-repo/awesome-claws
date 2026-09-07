# Legal matter organizer handoff

Matter: {{matter.id}}
Snapshot: {{matter.snapshotRef}}
As of: {{matter.asOf}} ({{matter.timezone}})
Named supervising counsel: {{matter.supervisingCounselRef}}
Destination: {{matter.destinationRef}}
State: {{handoff.state}}
Approval: {{handoff.approvalState}}

## Scope and principals

Render the counsel-supplied scope, neutral title, approved workspace and
destination, and every named human with exact scopes. A bare role, team, package,
agent, service, or system identity cannot supervise, confirm, own, issue, or
review this matter.

## Parties and workstreams

Use only minimized counsel-supplied party labels and roles. Show conflict and
sensitivity state without inferring relationships, claims, defenses, strategy,
or clearance. Bind every party and workstream to the exact matter and snapshot.

## Controlled sources and custody

List each nondegenerate `controlled://` reference, source authority, custodian,
supplied-by principal, observed and received times, immutable version, integrity
digest, classification, active-hold coverage, custody events, and indexed record
uses. Keep custody events append-only and source-supplied. Originals remain
unchanged; this Claw records custody and never transfers it.

## Filing, correspondence, and evidence indexes

Render every indexed record with source, party, workstream, chronology,
deadline, privilege, and hold links in both directions. Do not omit orphan rows
or copy confidential contents into the handoff.

## Chronology and deadlines

Keep `occurred`, `reported`, `scheduled`, and `unknown` distinct. Every event
needs exact source and record references. Every deadline needs source-bound
candidates, timezone, authority, verification state, and named counsel
confirmation. Conflicting, stale, unsupported, inferred, unknown-authority, or
unconfirmed deadlines block readiness.

## Privilege, holds, and conflicts

Preserve exactly `unreviewed-claim`, `counsel-confirmed`, `counsel-rejected`, or
`not-assessed` privilege state. Confirmation or rejection requires scoped named
counsel, a timestamp, and controlled evidence. Active holds are normal
preservation state; missing coverage, contradiction, release, or any destructive
instruction blocks readiness. Keep counsel-supplied conflict state visible and
block unresolved, flagged, or unassessed parties.

## Tasks, decisions, and review gates

Render human-owned tasks and their source evidence. Keep decisions append-only,
source-backed, explicitly supplied by humans, and linked in sequence; never
infer one. Show all eight review gates. Independent counsel review must be by a
different named counsel after every evidence and decision timestamp.

## Authority gates and handoff

Render the complete structured prohibited-action set. This Claw has no
authority to interpret law, advise, determine strategy or privilege, file,
serve, contact legal participants, sign, negotiate, settle, waive, commit,
alter custody, destroy material, release a hold, or approve the handoff.

The only handoff states are `blocked` and `ready-for-counsel-review`; approval is
always `not-approved`. Readiness requires exact scope and snapshot binding,
controlled source coverage, complete bidirectional references, no orphan rows,
confirmed authoritative deadlines, active hold coverage, resolved privilege and
conflict gates, completed readiness-required tasks, and independent named
counsel review after all evidence.
