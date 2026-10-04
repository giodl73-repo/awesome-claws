# Repository Operations Manager checkpoint

Render only a validated `repository-operations.schema.json` artifact. This is a
read-only portfolio reconciliation plus receipt-bound escalation record. It is
not authority to change code, branches, pull requests, checks, builds, releases,
settings, or risk decisions.

## Run, roster, and checkpoint lineage

| Field | Exact value |
| --- | --- |
| Artifact / run | `{{artifactId}}` / `{{run.id}}` |
| Trusted as-of / review window | `{{run.asOf}}` / `{{run.windowStart}}` |
| Roster / revision / custodian | `{{run.rosterRef}}` / `{{run.rosterRevision}}` / `{{run.custodianRef}}` |
| Roster completeness root | `{{run.rosterCompletenessRoot}}` |
| Escalation policy revision | `{{run.escalationPolicyRevision}}` |
| Predecessor / first run | `{{run.predecessorCheckpointRef}}` / `{{run.firstRun}}` |
| Source snapshot roots | `{{run.sourceSnapshotRoots}}` |
| Snapshot-set root | `{{run.snapshotSetRoot}}` |
| Current checkpoint / digest | `{{run.currentCheckpointId}}` / `{{run.currentCheckpointDigest}}` |

The predecessor must be present and exact unless `firstRun` is explicitly true.
Its entity rows must be unique by `entityRef`; conflicting duplicate revisions
invalidate checkpoint lineage rather than being collapsed during delta comparison.
Each predecessor entity binds its prior state as well as its revision. `merged`
and `closed` delta kinds apply only when a pull request transitions into that
terminal state; a revision change that remains merged or remains closed is
`updated`.
Every current source snapshot must satisfy
`run.windowStart <= capturedAt <= run.asOf`. Only the single exact
predecessor-checkpoint snapshot may predate the window, and a first run has no
predecessor snapshot.
The roster capture must satisfy the same run-window bounds, and its controlled
evidence must be observed no later than `roster.capturedAt`; evidence authored
after the asserted roster capture cannot backdate the portfolio trust root.
The approved roster is complete only when `{{roster.repositoryRefs}}` equals the
repository ledger and `{{roster.completenessRoot}}` recomputes from that ledger.
The checkpoint digest commits the complete roster, including `roster.capturedAt`,
and the principal roster as well as operational state, because provenance time,
principal kind, and exact category scopes determine evidence, human decision,
and trusted system observation authority.

## Approved repository roster

| Repository | Canonical name / default branch | Owner | Policy / required checks / required approvals / eligible reviewers / roster revision | Snapshot roots | State |
| --- | --- | --- | --- | --- | --- |
| `{{repositories[].id}}` | `{{repositories[].canonicalName}}` / `{{repositories[].defaultBranch}}` | `{{repositories[].ownerRef}}` | `{{repositories[].policyRevision}}` / `{{repositories[].requiredCheckContexts}}` / `{{repositories[].requiredApprovalCount}}` / `{{repositories[].eligibleReviewerRefs}}` / `{{repositories[].rosterRevision}}` | `{{repositories[].snapshotRefs}}` | `{{repositories[].state}}` |

## Exact checkpoint delta

| Change | Entity | Kind | Before revision | After revision |
| --- | --- | --- | --- | --- |
| `{{delta.entries[].id}}` | `{{delta.entries[].entityRef}}` | `{{delta.entries[].kind}}` | `{{delta.entries[].beforeRevision}}` | `{{delta.entries[].afterRevision}}` |

Unchanged records: `{{delta.unchangedRefs}}`

Superseded predecessor revisions: `{{delta.supersededRefs}}`

## PR-head-bound status matrix

A review, required check, build, or artifact from another head is stale or
superseded evidence. It never contributes to readiness for the current head.
Every current-head review, check, build, and build artifact in the ledgers must
also appear in its pull request's refs. Release-train membership must resolve in
both directions. An unreferenced failure is blocking, not invisible.
Each pull request also binds its complete identity, repository, number,
current head, state, and snapshot, plus nullable previous head, to an immutable
controlled source record and source-record digest. Its target revision is a
canonical object digest over those fields and the source evidence identity and
digest, so rebinding otherwise identical PR state is a checkpoint change. A PR
snapshot may cover the portfolio or be scoped to that PR's repository.

| Pull request | Repository / state | Previous head | Current head / target revision | Source evidence / digest | Reviews | Checks | Builds / artifacts | Release train | Blockers | Readiness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{pullRequests[].id}}` | `{{pullRequests[].repositoryRef}}` / `{{pullRequests[].state}}` | `{{pullRequests[].previousHeadSha}}` | `{{pullRequests[].currentHeadSha}}` / `{{pullRequests[].evidenceRevision}}` | `{{pullRequests[].sourceEvidenceRef}}` / `{{pullRequests[].sourceEvidenceDigest}}` | `{{pullRequests[].reviewRefs}}` | `{{pullRequests[].checkRefs}}` | `{{pullRequests[].buildRefs}}` / `{{pullRequests[].artifactRefs}}` | `{{pullRequests[].releaseTrainRefs}}` | `{{pullRequests[].blockerRefs}}` | `{{pullRequests[].readiness}}` |

Only a human principal with the `independent-review-author` scope, distinct from
the repository owner and this Claw, can contribute an approval to readiness.
The review identity, PR, head, state, author, timestamp, and snapshot must match
its immutable source evidence identity and source-record digest. The canonical
review revision covers that complete binding, so evidence rebinding is a
checkpoint change. The repository's required count must be met by its exact
eligible reviewers.
A valid current-head change request remains blocking even when the approval
count is otherwise satisfied and requires its exact review blocker.

| Review | PR / exact head | Independent author | State | Submitted / snapshot | Immutable evidence / digest |
| --- | --- | --- | --- | --- | --- |
| `{{reviews[].id}}` | `{{reviews[].pullRequestRef}}` / `{{reviews[].headSha}}` | `{{reviews[].authorRef}}` | `{{reviews[].state}}` | `{{reviews[].submittedAt}}` / `{{reviews[].snapshotRef}}` | `{{reviews[].evidenceRef}}` / `{{reviews[].evidenceDigest}}` |

| Check | PR / exact head | Context / required | State | Started / completed / snapshot | Immutable evidence / digest |
| --- | --- | --- | --- | --- | --- |
| `{{checks[].id}}` | `{{checks[].pullRequestRef}}` / `{{checks[].headSha}}` | `{{checks[].context}}` / `{{checks[].required}}` | `{{checks[].state}}` | `{{checks[].startedAt}}` / `{{checks[].completedAt}}` / `{{checks[].snapshotRef}}` | `{{checks[].evidenceRef}}` / `{{checks[].evidenceDigest}}` |

Passed, failed, cancelled, and superseded checks require
`startedAt <= completedAt <= run.asOf`; pending checks have a start but no
completion, and missing checks have neither. Every result binds an immutable
check evidence record to the exact check id, pull request, head, context,
required flag, state, start, completion, source-record digest, and snapshot
chronology. Its revision is a canonical digest that includes the evidence record
identity and source-record digest, so rebinding otherwise identical check fields
is a checkpoint change. Changing any result field without matching evidence is
invalid.
An earlier same-head check or build attempt may be `superseded` only by a later
observed non-superseded attempt; superseded retries remain auditable but do not
contribute to active readiness.

## Build and artifact provenance

| Build | Repository / PR / head | Provider run | State | Exact artifacts | Snapshot | Immutable evidence / digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{builds[].id}}` | `{{builds[].repositoryRef}}` / `{{builds[].pullRequestRef}}` / `{{builds[].headSha}}` | `{{builds[].runId}}` | `{{builds[].state}}` | `{{builds[].artifactRefs}}` | `{{builds[].snapshotRef}}` | `{{builds[].evidenceRef}}` / `{{builds[].evidenceDigest}}` |

Each build's canonical revision covers its complete identity, repository and PR,
head, provider run, state, exact artifact refs, snapshot, and immutable evidence
identity and source-record digest. Rebinding otherwise identical build state is
a checkpoint change. `(repositoryRef, runId)` is the globally unique provider
build identity. Same-head retries remain separate valid attempts only when the
provider assigns each retry a distinct `runId`; a second ledger row cannot
duplicate one provider run.

| Artifact | Build / repository / head | State | Digest | Provenance evidence | Snapshot |
| --- | --- | --- | --- | --- | --- |
| `{{artifacts[].id}}` | `{{artifacts[].buildRef}}` / `{{artifacts[].repositoryRef}}` / `{{artifacts[].headSha}}` | `{{artifacts[].state}}` | `{{artifacts[].digest}}` | `{{artifacts[].provenanceEvidenceRef}}` | `{{artifacts[].snapshotRef}}` |

`verified`, `missing`, `failed`, and `superseded` are distinct evidence states.
A successful build may still have missing or failed artifact verification; a
verified artifact requires a successful build, while a superseded artifact
requires its superseded build. Artifact provenance must be observed no earlier
than its producing build evidence and no later than the artifact snapshot or
trusted `asOf`, with exactly the artifact and producing build as its subjects.

## Cross-repository dependency and release ordering

Passing upstream evidence does not make a downstream repository ready.
Released train entries in the required order permit, but do not prove, dependency
satisfaction. A dependency remains blocked until its own exact state and evidence
record prove satisfaction.
`partial`, `failed`, `rolled-back`, and `superseded` release state remains
blocking and visible through an exact repository-and-train blocker backed by
release evidence. The same adverse aggregate train state also requires a
custodian-owned blocker whose sole subject is that train, including when every
entry is marked released. Release evidence commits the full repository set and
every entry's target head, unique order, state, and artifact refs. A `planned`
entry is not release-ready. Each train names one exact release evidence record
and source-record digest; its canonical revision covers the full train identity,
source revision, repository set, entries, aggregate state, snapshot, and
evidence binding. Its observation follows every member PR's current-head
review evidence, active required-check evidence, source evidence, producing
build evidence, and artifact provenance, and does not exceed the release
snapshot or trusted `asOf`. Invalid release evidence blocks every declared
member PR and therefore its repository, release train, and portfolio.
Dependency evidence then follows that exact release observation without
exceeding the same snapshot.
Every release artifact must close over the exact entry
repository and head, its producing build, repository-local build and artifact
snapshots, digest, and provenance evidence.

| Train / source revision | Exact repositories | State | Snapshot | Immutable release evidence / digest |
| --- | --- | --- | --- | --- |
| `{{releaseTrains[].id}}` / `{{releaseTrains[].revision}}` | `{{releaseTrains[].repositoryRefs}}` | `{{releaseTrains[].state}}` | `{{releaseTrains[].snapshotRef}}` | `{{releaseTrains[].releaseEvidenceRef}}` / `{{releaseTrains[].releaseEvidenceDigest}}` |

| Train | Repository / target head | Order | State | Artifacts |
| --- | --- | --- | --- | --- |
| `{{releaseTrains[].id}}` | `{{releaseTrains[].entries[].repositoryRef}}` / `{{releaseTrains[].entries[].targetHeadSha}}` | `{{releaseTrains[].entries[].order}}` | `{{releaseTrains[].entries[].state}}` | `{{releaseTrains[].entries[].artifactRefs}}` |

| Dependency | Upstream -> downstream | Train | Requirement | State | Evidence / exact revision |
| --- | --- | --- | --- | --- | --- |
| `{{dependencies[].id}}` | `{{dependencies[].upstreamRepositoryRef}}` -> `{{dependencies[].downstreamRepositoryRef}}` | `{{dependencies[].releaseTrainRef}}` | `{{dependencies[].requirement}}` | `{{dependencies[].state}}` | `{{dependencies[].evidenceRef}}` / `{{dependencies[].evidenceRevision}}` |

Dependency revisions are canonical object digests over the requirement, train
revision, exact upstream/downstream heads, states, order, and dependency state.

## Policy-authorized approval escalation queue

This Claw does not send messages. It accepts a dispatch only when an external
owner-controlled sender provides a receipt for the exact route, category,
recipient, target revision, supporting evidence record and revision, deadline,
and dedupe key. Each receipt belongs to exactly one request, and the
`(destination, providerMessageId)` identity is globally unique. The
receipt must be authored by an external human or system principal, never this
Claw, and proves only that bounded request was sent; it is not approval.
Merge approval and change-request escalation target a pull request, release
approval targets a release train, and a risk decision targets a dependency.

| Request | Category / route / recipient | Exact target / revision | Evidence / revision | Deadline / state | Dedupe key | Dispatch destination / template / time / provider id / receipt |
| --- | --- | --- | --- | --- | --- | --- |
| `{{escalations[].id}}` | `{{escalations[].category}}` / `{{escalations[].routeRef}}` / `{{escalations[].recipientRef}}` | `{{escalations[].targetRef}}` / `{{escalations[].targetRevision}}` | `{{escalations[].evidenceRef}}` / `{{escalations[].evidenceRevision}}` | `{{escalations[].deadline}}` / `{{escalations[].state}}` | `{{escalations[].dedupeKey}}` | `{{escalations[].dispatch.destination}}` / `{{escalations[].dispatch.templateRevision}}` / `{{escalations[].dispatch.dispatchedAt}}` / `{{escalations[].dispatch.providerMessageId}}` / `{{escalations[].dispatch.receiptEvidenceRef}}` |

## Independently authored decisions and deadline observations

Every response has an explicit kind and outcome and binds the exact request,
dedupe key, target revision, and evidence revision. `human-decision` responses
may have only `approved`, `rejected`, or `change-requested` outcomes and must be
authored by the eligible independent human recipient with
`decision-authority:<request-category>`. Their evidence kind is
`decision-response`.

`deadline-observation` responses may have only `expired` or `no-response`
outcomes and are not human decisions. They must be authored by an approved
independent system principal with
`trusted-deadline-observer:<request-category>` and use
`deadline-observation` evidence. This Claw can author neither response kind,
and a deadline observation is never interpreted as approval or rejection.
Each response id belongs to exactly one request, and its authored/observed time
cannot predate dispatch, exceed the trusted as-of, or violate the request
deadline semantics. An unanswered request remains `dispatched` before and at
its exact deadline. Deadline observation evidence is required only when
`asOf` is later than the deadline and must be authored and observed strictly
after that deadline and no later than `asOf`.
Every dispatched, rejected, change-requested, expired, or unanswered request
requires an open blocker bound to the exact target and response or dispatch evidence.

| Response | Kind / outcome | Request / dedupe key | Target / target revision / evidence revision | Author / authored at | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{responses[].id}}` | `{{responses[].kind}}` / `{{responses[].outcome}}` | `{{responses[].requestRef}}` / `{{responses[].requestDedupeKey}}` | `{{responses[].targetRef}}` / `{{responses[].targetRevision}}` / `{{responses[].evidenceRevision}}` | `{{responses[].authorRef}}` / `{{responses[].authoredAt}}` | `{{responses[].evidenceRef}}` |

## Exact blockers and readiness

| Blocker | Category | Exact subjects | Owner | Evidence | State / resolution |
| --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].category}}` | `{{blockers[].subjectRefs}}` | `{{blockers[].ownerRef}}` | `{{blockers[].evidenceRefs}}` | `{{blockers[].state}}` / `{{blockers[].resolutionEvidenceRef}}` |

Every open blocker must be supported by the exact adverse review, check, build,
artifact, dependency, release, or approval state named by its category, with no
unrelated subject or evidence refs. A resolved blocker retains source evidence
whose state matches the historical category plus separate owner-authored
resolution evidence. The expected resolution owner is derived from exact
subjects and approved policy, never trusted from mutable `blocker.ownerRef`:
repository and member-release blockers resolve through that repository owner,
aggregate portfolio and train blockers through the roster custodian, and
approval blockers through the escalation recipient with exact category
decision authority. The resolution author must equal that derived owner and
hold its category-appropriate scope. For every category, the resolution revision commits the
complete blocker id, category, subject set, owner, source-evidence set, state,
and category-specific history.
Every controlled evidence row must be consumed by its exact typed ledger field.
Additional consumers such as escalation support and blocker coverage may reuse
that evidence, but they cannot turn an otherwise orphaned row into valid proof.
For a resolved `missing-evidence` blocker, `missingEvidenceHistory` binds the
exact subject and its `missing` or `pending` predecessor revision to the current
controlled evidence that closes that same gap. The owner-authored resolution
evidence commits that history binding and closure evidence; evidence for a
different subject cannot resolve the blocker.
Insufficient current-head reviews require a repository-owner-controlled
`missing-evidence` blocker bound to the pull request and, when present, the exact
current review evidence.
Controlled pull-request, check, build, artifact, release, dependency, and
dispatch-receipt evidence must be authored by a non-Claw principal with the
`evidence-author` scope; repository ownership alone cannot attest CI evidence.

| Scope | State | Blockers |
| --- | --- | --- |
| Portfolio | `{{readiness.portfolioState}}` | `{{readiness.blockerRefs}}` |
| `{{readiness.repositoryStates[].subjectRef}}` | `{{readiness.repositoryStates[].state}}` | `{{readiness.repositoryStates[].blockerRefs}}` |
| `{{readiness.releaseTrainStates[].subjectRef}}` | `{{readiness.releaseTrainStates[].state}}` | `{{readiness.releaseTrainStates[].blockerRefs}}` |

Repository and release-train rows are computed projections: each row must list
exactly its open blockers and must remain blocked for missing repositories,
blocked or invalid member PRs, adverse release entries, unmet dependencies, or
unresolved decisions. Release-train blocker refs include the exact computed
blockers of every member PR. Every observed current-head review, check, build,
and artifact failure also requires a matching open blocker and accountable
owner.

## Authority boundary and owner handoff

| Field | Exact value |
| --- | --- |
| Handoff / state / next owner | `{{handoff.id}}` / `{{handoff.state}}` / `{{handoff.nextOwnerRef}}` |
| Checkpoint / digest | `{{handoff.checkpointRef}}` / `{{handoff.checkpointDigest}}` |
| Code / branch / merge | `{{handoff.codeChangeClaim}}` / `{{handoff.branchChangeClaim}}` / `{{handoff.mergeClaim}}` |
| Build / release / settings | `{{handoff.buildActionClaim}}` / `{{handoff.releaseClaim}}` / `{{handoff.settingsClaim}}` |
| Risk acceptance / approval | `{{handoff.riskAcceptanceClaim}}` / `{{handoff.approvalClaim}}` |
| External communication | `{{handoff.externalCommunicationClaim}}` |

`ready-for-owner-review` means only that this artifact is internally complete
and blocker-free. It never means merged, built, waived, approved, released,
published, deployed, or risk-accepted.
Affirmative mutation and approval claims are rejected when attributed to the
Repository Operations Manager, Claw, agent, assistant, `we`, or unqualified
first person, across past, present, and future forms. Negated claims remain
valid. Explicitly attributed human, owner, or trusted-system evidence may be
reported, but its corresponding structured evidence and authority records
remain mandatory.
