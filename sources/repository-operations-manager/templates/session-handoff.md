# Repository Operations Manager handoff

Validate `outputs/repository-operations.json` against
`schemas/repository-operations.schema.json` and its semantic contract before
rendering `templates/repository-operations.md`.

## Required proof

- Exact approved roster id, revision, repository set, completeness root, and
  human custodian. The roster capture remains within the run window and its
  controlled evidence is observed no later than that capture.
- Exact predecessor checkpoint lineage, including each entity's prior state, or
  explicit first-run state. Terminal pull-request delta kinds apply only to
  transitions into merged or closed; later terminal-state revisions are updated.
- Complete source snapshot roots and caller-supplied trusted `asOf`.
- Current PR repository, number, previous/current head, state, and portfolio-
  or repository-scoped snapshot bound by a canonical revision to exact immutable
  controlled source evidence identity and source-record digest;
  complete forward and reverse review, check,
  build, and artifact refs; immutable review, check-result, and build evidence
  whose canonical revisions bind complete record state, snapshot, evidence
  identity, and source-record digest; only fully valid records and independent
  human approvals contribute to readiness, while any valid current change
  request remains blocking. Provider build identity is globally unique by
  repository and run id. Same-head check/build retries may supersede earlier
  attempts without making those attempts active only when each provider run id
  is distinct.
- Exact prior/current repository, PR, review, check, build, and release delta;
  matching entity types for every predecessor/current identity;
  dependency evidence; check chronology and result digests; build-before-artifact
  provenance chronology; repository-local provenance; one exact release
  evidence ref and digest bound to every entry's target head, unique order,
  state, and artifacts after every member PR's current-head review, active
  required-check, source, build, and artifact-provenance evidence; dependency
  evidence observed after that release and within its snapshot; and
  partial, failed, rolled-back, or superseded release and artifact state.
- Policy-authorized escalation routes, exact target and evidence revisions,
  recipient, deadline, dedupe key, globally unique destination/provider-message
  identity, one receipt bound to one request, and exactly one independent
  typed response. Approval, rejection, and change request are human decisions
  authored by the eligible recipient with exact category decision authority by
  the deadline. Expiry and no-response are observations authored only by an
  approved trusted system with exact category observation scope.
  Unanswered requests remain dispatched through the exact deadline; expiry and
  no-response evidence is strictly later than the deadline and no later than
  trusted `asOf`, and is never interpreted as approval or rejection.
  An invalid response leaves the exact request unresolved and approval-blocked.
- Evidence-author authority for controlled PR, CI, artifact, release,
  dependency, and dispatch-receipt records; category-compatible escalation
  targets; and exact aggregate blockers for every adverse train state.

## Fail-closed handoff

Any missing repository or evidence, stale or dangling ref, cross-head or
cross-repository provenance, mistyped delta, invalid chronology, unauthorized
principal, duplicated response, expired or unresolved decision, unreceipted
dispatch, or cyclic escalation/response target keeps exact PR, repository,
release-train, and portfolio readiness blocked. Blocker subjects, source
evidence, adverse state, owner, and resolution evidence are exact; unrelated
refs are invalid, and every resolution revision binds the complete blocker
payload. Resolution ownership is independently derived from authoritative
repository ownership, roster policy, release membership, or escalation
recipient authority; changing both the blocker owner and resolution author
cannot transfer that authority. Release readiness inherits the exact computed readiness and blockers
of every member PR. The Claw performs no code, branch, merge, build, release, settings,
risk-acceptance, or approval mutation. External communication is limited to the
exact dispatch receipts represented in the validated artifact. Narrative checks
reject affirmative mutation or approval claims by this Claw, an agent or
assistant, `we`, or unqualified first person while permitting negated statements
and explicitly attributed human, owner, or trusted-system evidence backed by
the structured artifact.
