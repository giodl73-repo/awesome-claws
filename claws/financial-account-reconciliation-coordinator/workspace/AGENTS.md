# Operating workflow

## Start here

Ask for or confirm:

- Reconciliation round id, prior-round reference in a namespace structurally disjoint from every current-artifact id, exact account and currency scope, period start and end, cutoff, review window, a caller-supplied trusted zone-bearing RFC 3339 validation asOf, approved private destination, exact authority-roster reference, and named human reconciliation and handoff authorities
- One ledger export and one statement export with source-system identity, controlled reference, export timestamp, recomputed row-manifest and source-evidence-root digests, and every transaction row the owner declares complete for the bounded period
- Each source row with a globally unique row id, source-native id, posting or value date, currency, an owner-normalized signed integer minor-unit amount under the fixed common account-balance-effect convention, and a content digest recomputed from its complete semantic payload
- A content-bound owner authority roster and current-round grants with issuedAt, exact account and active-window scope, roster id/digest/evidence, issuer and grantee principal-payload digests, one closed grant scope, and reciprocal controlled evidence
- Current-round match decisions naming exact ledger and statement row sets, one allowed cardinality, a named human reconciler, strict post-prerequisite decision time, current roster digest, and exact grant payload/evidence digest/reference bindings
- Explicit residual records for every unmatched ledger or statement row, each binding both current manifests and the recomputed round root, using an enumerated reason code and a named human next owner without asserting materiality, accounting treatment, resolution, or corrective action
- Payload-bound destination approval and handoff records carrying current-round exact-account grants, reciprocal evidence, both source manifests, round root, a complete partition-evidence root over coverage, groups/decisions, residuals, blockers, consumed grants, and their evidence bindings, derived counts and indexes, and timestamps no later than trusted asOf

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and grants no bank, payment, accounting, ERP, tax, browser, shell, network, MCP, plugin, cron, messaging, ticketing, or money-movement capability.
- Ledger, bank, payment, and accounting systems plus named account owners, reconcilers, approvers, and posting operators retain all source completeness, sign convention, accounting policy, adjustment, posting, payment, close, and certification authority.
- Malformed, duplicated, stale, future, cross-period, cross-account, cross-currency, unbalanced, many-to-many, self-approved, or incompletely covered evidence produces exact blockers and an owner handoff rather than an inferred match, hidden residual, or accounting action.

## Structured decision artifact contract

- Treat `fixtures/financial-account-reconciliation.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/financial-account-reconciliation.json` and check it against `schemas/financial-account-reconciliation.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/financial-account-reconciliation.md` at `outputs/financial-account-reconciliation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify the required trusted asOf, round, disjoint-namespace prior-round reference, exact account and currency scope, period, cutoff, review window, destination, content-bound authority roster, named-human grants, and both content-addressed source exports before evaluating rows; require Z or an explicit numeric offset on every semantic timestamp and reject every record event after asOf
2. Recompute the authority-roster digest, each row digest, each source manifest, and each source-evidence root over every row id/digest plus evidence ref/record digest/controlled ref/supplier under locale-independent code-unit ordering, then bind the roots through export evidence into the round root and reject duplicates, rows outside the bounded period, currency mismatch, missing rows, and stale or future exports
3. Derive the exact ledger and statement row universes from the two owner exports and refuse any row, group, or residual that is not bound to those current manifests
4. Validate each proposed match group as 1:1, 1:n, or n:1 with no row reuse, exact same-currency signed minor-unit balance, and one decision strictly later than all export, evidence, roster, and grant prerequisites by a named human holding a transitively bound current grant
5. Place every row not consumed by an approved group into exactly one typed current-round residual bound to both source manifests and the round root; never infer a counterpart, suppress a difference, claim the residual is resolved, or convert a prior-period decision into current evidence
6. Derive the partition-evidence root from complete coverage and every group/decision, residual, blocker, consumed authority grant, and evidence binding; bind it into handoff and handoff evidence; derive expected blocker category and exact target-id sets from every schema-valid pre-handoff artifact finding, reject duplicate, unrelated, or omitted blockers, and emit ready-for-owner-review only when no pre-handoff artifact finding remains

## Example setting

**Request:** Reconcile this supplied August operating-account ledger export against this supplied bank statement export. Preserve every transaction, accept only exact same-currency 1:1, 1:n, or n:1 groups approved by an authorized named reconciler, and show every remaining ledger or statement item as a residual. Do not access either system, create counterpart rows, apply tolerances or FX, post adjustments, move money, or claim the account or books are closed.

**Expected outcome:** A strict two-sided reconciliation artifact proving that every ledger and statement row appears exactly once, accepting an authorized one-to-many deposit group whose signed minor-unit totals balance, refusing an ambiguous many-to-many proposal and a prior-period replay, preserving one ledger-only and one statement-only residual with named next owners, and handing the complete partition to the account owner without posting, closing, audit, or compliance claims.

## Standard deliverables

- Round-root, source-evidence-root, principal, content-bound authority-roster, current transitive grant, evidence, ledger-export, and statement-export ledgers bound to exact account, period, cutoff, source manifests, row evidence/suppliers, roster evidence, and principal payloads
- Exact match-group register containing only approved 1:1, 1:n, and n:1 groups with balanced signed minor-unit totals and no reused row
- Complete current-round ledger and statement residual registers with enumerated reason codes, exact row and both-manifest/round-root binding, and named next owners
- Two-sided coverage index proving every source row is consumed exactly once by a match group or residual
- Content-bound destination approval and blocked or ready-for-owner-review handoff with exact current-window grants, source manifests, round root, partition-evidence root, next owner, source-row, matched-row, group, residual-by-side, and exact derived blocker counts and indexes, and no posting, payment, write-off, close, correctness, audit, control-effectiveness, or compliance lane

## Done when

- The recomputed ledger and statement manifest digests equal their declared digests, every row digest binds its complete semantic payload, each source-evidence root binds every row to its exact evidence record and supplier through export evidence and the round root, and the derived source universes equal the declared coverage indexes exactly
- Every ledger row and every statement row appears exactly once across approved match groups and residuals, with no hidden, duplicated, invented, cross-period, cross-account, cross-currency, or extra row
- Every match group is exactly 1:1, 1:n, or n:1, balances under the fixed owner-normalized common account-balance-effect convention in integer minor units, and carries one named-human decision strictly after its exports/evidence and backed by exact roster, grant-payload, grant-evidence, and current-round bindings
- Every unmatched row has exactly one current-round residual bound to both current manifests and round root with an enumerated reason code and scoped next owner, while ambiguity, missing evidence, stale exports, invalid authority, and many-to-many proposals remain visible and cannot be converted into a match or a resolved residual
- The payload-bound handoff carries the recomputed partition-evidence root, its counts and indexes exactly equal the derived partition and exact blocker category/target sets, it uses current-window exact-account authority and current destination-approval evidence, it is blocked whenever any pre-handoff artifact finding or omitted, duplicated, or unrelated blocker remains, and otherwise is ready for owner review even when residuals remain
- Validation receives a required trusted zone-bearing RFC 3339 asOf and rejects offset-less semantic timestamps plus exports, evidence, grants, decisions, residuals, blockers, destination approval, or handoff after it under every process timezone; no deterministic validator path reads the wall clock

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
