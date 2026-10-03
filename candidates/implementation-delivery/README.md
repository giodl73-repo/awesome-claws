# Implementation delivery composition experiment

Accepted route [#195](https://github.com/giodl73-repo/awesome-claws/issues/195),
under [#196](https://github.com/giodl73-repo/awesome-claws/issues/196).
No new Claw, generic controller, delegated session or catalog capability.

## Actual output

Start with `handoff.md`. `intake.json` contains three requirements, two actual
lookup tables, ticket samples, ordered cutover/rollback instructions and the
unaccepted support handoff. `adapter.mjs` implements the bounded in-memory
mapping and snapshot copy. `adapter.patch` is its real isolated-repository diff.
`acceptance.mjs` checks mapped IDs, all three statuses, unknown/blank identity
rejection, unknown status rejection and independent snapshot restoration.

The five files under `artifacts/` use the real existing owner schemas and
semantic validators, not substitute owner status flags:

| Owner | Artifact and responsibility |
| --- | --- |
| Project Manager | `project.json`: requirements, accepted example milestones, remaining owner decision |
| API Integration Engineer | `integration.json`: interface and exact-target contract-test evidence |
| Data Migration Planner | `migration.json`: required fields, actual lookup values, reconciliation, rollback, pending cutover permission |
| Software Maintainer | `maintainer.json`: actual bounded patch, Git ancestry and revision-bound local verification |
| Quality Assurance Lead | `qa.json`: requirement-to-test coverage and limited synthetic recommendation |

## Reproduce

From the repository root:

```sh
node --test scripts/implementation-delivery.test.mjs
node candidates/implementation-delivery/regenerate.mjs
node --test scripts/implementation-delivery.test.mjs
npm run check
```

The first test uses saved owner artifacts and independently reruns local
acceptance assertions. Regeneration creates a fresh ignored `.tmp/` Git repository
with no remote. It commits the deliberately broken `baseline-adapter.mjs`, checks
that acceptance fails, commits the corrected adapter, verifies ancestry, then
executes the same tests at the exact head. It emits the patch, owner artifacts,
receipt and handoff. Regeneration changes actual execution timestamps. It is not
needed for ordinary CI. No generated fixture repository is pushed or packaged.

`receipt.json` distinguishes actual current local assertions from illustrative
supplied API/QA/migration evidence. The latter fixtures use invented example
principals, controlled references and historical dates; no API/auth/rate-limit
server, live migration, human QA review or production recovery was performed.
Owner-schema acceptance does not authenticate those invented sources.
Reconciliation control totals are supplied synthetic counts, not a database
checksum or data-integrity proof. Maintainer Git commits and local assertions
are real; the fictional business approvals remain pending.

## Findings and route

The bounded example can be composed without a sixth owner. Keep the five owners
and carry their full outputs, explicit shared scope and source/revision bindings
in an example recipe. This is evidence for the accepted experiment, not a claim
that a generic deployment workflow or automatic multi-agent runtime exists.

The exact failing cases are covered in `scripts/implementation-delivery.test.mjs`:
missing identity mapping remains blocked even with all milestones accepted;
removing the required-field declaration cannot hide the missing mapping; changed
adapter bytes or mismatched QA/adapter revisions invalidate results; mismatched
repository, environment or snapshots fail; rollback and support acceptance stay
independent gates. Negative tests deliberately rebind digests to exercise real
owner/cross-owner checks instead of relying only on stale-fixture detection.

Observed contract limits and the smallest route for each:

- Project Manager has no structured shared revision/environment field. Keep
  that binding in the composition intake; do not add deployment authority to it.
- Migration's enriched schema permits extra lookup data, but its semantic
  validator does not prove lookup values. This experiment explicitly compares
  the supplied tables and runs the actual adapter assertions. Do not call generic
  migration validation proof of arbitrary transforms.
- Software Maintainer requires real Git ancestry and a local commit when changes
  are present. The initial content-hash-only draft failed `invalid_revision_identity`
  and `overstated_delivery_authority`. An actual isolated fixture repository meets
  that contract without weakening it or inventing commits.
- No owner output proves support acknowledgement. Keep the named handoff draft
  unaccepted; require separately supplied evidence before any future operational
  use. No new support-approval field is silently added to an owner contract.

The checker is deliberately bounded to this worked example. Receipts are drift
detectors, not authenticated attestations; rewriting a receipt is not fresh
verification. It is not a universal prose, source-authenticity, permissions,
identity assurance, support acknowledgement or recovery validator. The canonical
result is `draft-for-owner-review`, with deployment unauthorized and support
acceptance pending. Complete milestones never turn those into permission.

## UI and admission scope

No catalog entry, packaged resource, Experience, schema, profile, dependency or
runtime behavior changes. Existing owner Control UI screenshots remain unchanged;
they are not screenshots of live composition execution. The experiment uses
ordinary local tests and supplied fixtures, not the installed/live capability
lane. No merge, publishing, default enablement or production action is requested.
