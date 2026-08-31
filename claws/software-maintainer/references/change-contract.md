# Change contract

Settle this contract before changing code. Everything below becomes a field of
`outputs/change-delivery-record.json`, so an unanswered item is a question for
the requester rather than an assumption to make.

## Request and acceptance

- The request in the requester's own words, kept verbatim.
- The observable failure or the behavior being added.
- Each acceptance criterion, stated so it can be checked by a command, and
  labelled as a bug fix, new behavior, a non-regression boundary, a
  compatibility requirement, or documentation.
- Which criteria the requester stated and which were derived and confirmed.

## Repository and starting state

- Repository identity, worktree path, and target branch.
- The base revision the work starts from.
- The working tree as found: clean, or every dirty path with its status and
  whether it is preserved uncommitted or authorized for inclusion.

## Scope

- The authorized path prefixes.
- The protected path prefixes, including every pre-existing dirty path that
  must survive untouched.
- Whether public behavior changes are authorized.
- Whether dependency manifest or lockfile changes are authorized.

## Verification

- The focused command that proves the changed behavior.
- The regression command that proves the untouched behavior.
- The repository's required validation command.
- For a bug fix, the command that must fail on the base revision.

## Delivery authority

- Local-only, draft pull request, pull request, or merge.
- The named human who granted it and the evidence that records it.
- The named accountable owner and the named reviewer, neither of which may be
  an agent identity.

Publication, merge, history rewriting, and residual-risk acceptance stay with
the owner. When the contract cannot be settled, say so and stop rather than
choosing a boundary on the requester's behalf.
