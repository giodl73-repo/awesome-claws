# Change delivery record handoff

## Request, criteria, and outcome

Record the request id, run id, and the requester's own words without rewriting
them, plus the named accountable owner, the named reviewer, the intake time, and
the as-of time. List every acceptance criterion with its statement, its kind, and
whether it came from the requester, from a confirmed derivation, or from a
repository-required check. At least one criterion must come from the requester:
a change with no requester-stated criterion is an unrequested change. A criterion
that is met names the changes and the verifications that support it; a criterion
that is unmet or unverifiable says why in its own words instead of being quietly
dropped. Declare the outcome truthfully: changes delivered, no change required,
or blocked before any change was made.

## Repository identity and starting state

Name the repository, the worktree path, the target branch, the exact base and
head revisions, and whether the base is still an ancestor of the head. Capture
the working tree as it was found: a clean tree says so, and a dirty tree lists
every path with its status. Each pre-existing path is either preserved
uncommitted, in which case it must be declared protected and must not appear in
the change list, or authorized and included, in which case it must be inside the
authorized scope and must appear in the change list. Unrelated work is never
reverted, reformatted, or absorbed into this change.

## Authorized scope and protected paths

List the authorized path prefixes and the protected path prefixes, and name the
request or owner instruction that authorized them. Authorized and protected
prefixes never overlap. Every changed path lives inside the authorized scope and
outside every protected prefix. Public behavior changes and dependency manifest
changes each require their own explicit authorization; without it, they stay out
of the diff and go back to the owner as a question.

## Evidence inventory

List every source the work relied on with its kind, label, capture time,
provenance, and integrity: the request itself, owner instructions, repository
files and history read at a named revision, command and test output, issue
threads, and public documentation. Repository evidence names the revision it was
read at; public references stay credential-free public HTTPS; command output is
captured after the request arrived. No source may postdate the as-of time, and
unverified or conflicting evidence keeps the record short of owner-ready.

## Changes and rationale

For each changed file record the path, the change kind, the previous path for a
rename, the added and removed line counts, the acceptance criteria it serves, and
the evidence it rests on. The rationale explains why this change is the smallest
one that satisfies its criteria, not merely what the diff does. A change that
serves no acceptance criterion is out of scope. When nothing needed to change,
record no changes and say the request required none rather than inventing work.

## Verification bound to the current head

For each check record the exact command, its kind and scope, the revision it ran
against, the start and finish times, the result, and the captured output that
proves it. Every completed check runs against the current head: a result carried
over from an earlier revision is stale and cannot support a criterion. A bug-fix
criterion needs a check that failed on the base revision and passes on the head,
and a failed, blocked, or never-run check is reported as exactly that. Never
weaken, skip, or delete a test to make a check pass, and never describe a result
that was not observed.

## Review, findings, and dispositions

Record every review run with its kind, its reviewer, the revision it covered, and
its state. A completed review names the exact head it reviewed and lists every
finding it produced, and every finding names the review it came from. Human
review belongs to a named human, never to an agent identity; self and automated
reviews say so. A finding marked fixed names the change that fixed it and the
head revision where it is resolved. A finding deferred to the owner names the
residual risk it leaves behind. Residual risk is only accepted by the owner's
explicit decision, never by the agent on the owner's behalf.

## Risk, blockers, and honest state

Carry every unresolved risk with its category, severity, state, and whether it
blocks delivery or needs an owner decision. A blocked record names real
unresolved work and keeps every blocking finding and risk visible; it does not
invent a blocker. An owner-ready record has met or explicitly not-applicable
criteria, verified evidence, no failed, blocked, or unrun checks, no open
findings, no blocking findings or risks, a completed review at the current head,
and no risk still waiting on an owner decision. Draft, blocked, ready, and
delivered describe what actually happened.

## Delivery authority and owner decision

State the delivery authority explicitly as local-only, draft pull request, pull
request, or merge, and name the human who granted it and the evidence that
records it. What was performed never exceeds what was authorized. Nothing beyond
a local commit happens without the named owner's completed decision naming the
exact delivery step, and force-pushing or rewriting history is never performed.
List the prohibited publication, merge, history, unrelated-change, protected-path,
public-behavior, test-weakening, fabrication, finding-closing, risk-acceptance,
dependency, secret, and issue-comment actions. Name the accountable owner and
reviewer, write the record to its private portable destination under `outputs/`,
and include every criterion, change, verification, review, finding, and risk in
the handoff so readiness cannot hide anything.
