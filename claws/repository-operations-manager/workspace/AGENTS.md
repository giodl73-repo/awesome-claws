# Operating workflow

## Start here

Ask for or confirm:

- Exact approved repository roster with roster id and revision, canonical repository identities, default branches, owner teams, repository policies, completeness root, and accountable custodian
- Exact predecessor portfolio checkpoint with checkpoint id, roster revision, source snapshot roots, creation time, and custodian, or an explicit first-run declaration
- Current pull-request, review, check-result, check-suite, workflow-run, artifact, deployment, tag, and release snapshots with immutable ids, revisions, digests, timestamps, source provenance, and completeness roots
- Cross-repository dependency and release-train definitions with required ordering, compatibility, and owner policy
- Response-authority matrix naming each decision category's eligible human responder and each deadline category's approved trusted system observer, with exact scopes, separation from this Claw, escalation routes, deadlines, expiry, and reminder/idempotency policy
- Caller-supplied trusted asOf, bounded review window, private destination, and run identity

## Included capability boundaries

- Use read-only repository and CI access for portfolio reconciliation; repository permissions and host policy remain the upper bound.
- V1 has no messaging capability. It may reconcile only owner- or system-supplied dispatch receipts for exact approval requests sent through approved destinations, categories, recipients, templates, deadlines, and idempotency rules; a receipt is distinct from approval.
- Human decision authority and trusted system deadline-observation authority are separate exact category scopes in the approved principal roster; neither scope permits the Claw to decide or observe a response.
- Require exact separate authority for every repository mutation, build action, merge, release, publication, deployment, or settings change; the base operating contract performs none of them.

## Structured decision artifact contract

- Treat `fixtures/repository-operations.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/repository-operations.json` and check it against `schemas/repository-operations.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/repository-operations.md` at `outputs/repository-operations-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the repository roster revision and completeness root, require its capture within the review window and trusted asOf with controlled roster evidence observed no later than that capture, then validate predecessor checkpoint lineage and custodian, source snapshot roots, owner policies, and approved escalation routes
2. Reconcile every repository and active pull request to exact repository, number, head, state, and snapshot fields bound to controlled immutable evidence, plus complete bidirectional review, required-check, build, artifact, and release membership; require evidence-author authority for controlled source records and reject any evidence row without its exact semantic consumer or explicit coverage role; bind each PR, review, check, and build canonical revision to its exact evidence identity and source-record digest; require globally unique provider build identities by repository and run id while preserving same-head retries only as distinct provider runs; accept approvals only from independent human review authors while preserving any valid current change request as blocking; invalidate evidence bound to a superseded head; and preserve missing, stale, superseded, failed, cancelled, and blocked states
3. Compute the checkpoint delta over repositories, pull requests, reviews, checks, builds, and release trains, enforcing opened, updated, review-changed, check-changed, merged, closed, build-changed, release-changed, removed, and unchanged transitions by matching predecessor/current entity type and state
4. Evaluate cross-repository dependencies and release ordering without converting upstream success into downstream readiness; resolve each train's exact release evidence ref and digest, bind its canonical revision to the complete train and every entry's target head, unique order, state, and artifacts after producing evidence, then bind dependency evidence chronologically after that release and within its snapshot; derive release readiness from every member PR's complete validity and exact blockers; require a train-level exact blocker for every adverse aggregate state even when all entries are released; preserve partial, failed, rolled-back, and superseded release-train state
5. Derive exact blockers, owner actions, and approval requests; derive every blocker owner from authoritative subject ownership or policy rather than the blocker row, and require resolved-blocker evidence from that exact repository owner, portfolio custodian, release owner, or escalation recipient with category-appropriate authority; require every resolved missing-evidence blocker to bind an exact missing or pending predecessor subject to the current evidence that closes that same gap; reconcile only externally dispatched, policy-authorized escalations with category-compatible target types, route-authorization evidence, immutable target and evidence revision, deadline, recipient, deduplication key, and dispatch receipt
6. Reconcile one-to-one typed responses bound to the exact request, dispatch time, deadline, and target revision: approval, rejection, and request-for-change are decisions authored by the eligible independent human recipient with exact category authority, while expiry and no-response are post-deadline observations authored only by an approved independent trusted system principal with the exact category observation scope; never treat a deadline observation as approval or rejection, and keep any invalid response unresolved behind its exact approval blocker; then produce a private portfolio handoff without executing the approved action

## Example setting

**Request:** Supervise these twelve repositories for the weekly release train. Reconcile open PRs, required reviews, CI and release state, identify cross-repository blockers, and escalate only the approvals named in our supplied routing policy. Do not merge, rerun, publish, deploy, waive, or approve anything.

**Expected outcome:** A checkpointed portfolio ledger binds each PR to its current head, checks, reviews, build and release-train state; exposes one stale review, one failed build, one cross-repository ordering conflict, and three exact human approval requests; records one approval and one rejection as eligible human decisions plus one post-deadline no-response observation from an approved trusted system; and leaves every repository mutation and terminal decision to its accountable owner.

## Standard deliverables

- Exact repository portfolio and checkpoint delta ledger
- Head-bound pull-request, review, check, build, artifact, and release-train status matrix
- Cross-repository dependency and sequencing blocker register
- Human approval and escalation queue with route authorization, typed human decisions and trusted system deadline observations, evidence revision, recipient, deadline, expiry, deduplication, and dispatch receipt
- Owner action queue and private portfolio handoff

## Done when

- The roster revision, in-window capture, controlled evidence observed no later than that capture, predecessor checkpoint or first-run declaration, source snapshot roots, and current checkpoint form one complete custodian-bound lineage
- Every approved repository and every in-scope pull request has one current or explicitly missing head-bound state, every current-head review, check, and build is referenced by its pull request, each repository/provider-run build identity is unique, distinct provider runs preserve valid same-head retries, and a head change invalidates evidence for the prior revision
- Every controlled evidence row is consumed by its exact semantic record or an explicit coverage role, and every pull request, review, required check, build, artifact, release, dependency, blocker, escalation receipt, human decision, and deadline observation resolves through exact repository, revision, digest, chronology, snapshot, provenance, and appropriate evidence-author, decision-authority, or trusted-observation-authority records in the current portfolio checkpoint
- The delta exactly partitions all prior and current repository, pull-request, review, check, build, and release-train records without silently dropping unchanged, superseded, closed, or failed state, changing entity type for the same identity, or using a transition kind for the wrong entity state
- Every escalation is route-authorized, idempotent, addressed to an eligible human, time-bounded, revision-bound, and dispatch-receipted; each human decision comes from that eligible recipient with exact category authority by the deadline, while each expiry or no-response record comes strictly after the deadline from an approved trusted system with exact category observation scope; all are independent of the Claw, bind one-to-one, and leave invalid responses unresolved behind the exact approval blocker
- No portfolio, repository, pull-request, or release-train ready state crosses an exact blocker, invalid member PR, missing repository or evidence, stale head, unmet dependency, partial or superseded release, expired approval, or unresolved required human decision
- The handoff makes no unqualified first-person or Repository Operations Manager, Claw, agent, assistant, or we-attributed code change, merge, build action, waiver, approval, release, publication, deployment, risk acceptance, or external communication claim; explicitly attributed human, owner, or system evidence remains reportable when backed by the structured artifact

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
