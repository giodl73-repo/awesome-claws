# Recurring Third-Party Review Evidence Reconciler handoff

## Request

Summarize the user request and the decision or next action this Claw supports.

## Fixed cycle and caller-controlled time

- Record the exact cycle, predecessor, catalog revision, cell-index revision,
  freshness-rule revision, review window, source-envelope issuance, and caller
  `asOf`.

## Signed owner and source evidence

- Render the catalog and service-owner manifests, public key identities, source
  receipt ids, source references, versions, and content digests without copying
  private keys or source contents.

## Exact applicability and freshness

- Render every owner-declared cell exactly once.
- Show every evidence state, effective expiry, and the exact predecessor cell
  reopened by expired evidence.

## Decisions and blockers

- Preserve typed reviewer decisions, the owned remediation, external exception,
  unauthorized risk-attempt blocker, and complete evidence lineage.

## Authority boundary

- Do not interpret contracts or requirements, produce source evidence, score or
  accept risk, approve exceptions, execute remediation, contact suppliers,
  onboard, renew, terminate, purchase, or mutate owner systems.

## Next owner

Name the exact review-program owner and where
`outputs/third-party-review-handoff.md` should be reviewed.
