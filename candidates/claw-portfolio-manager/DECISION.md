# Claw Portfolio Manager admission decision

Status: **NEW CLAW remains after repaired strongest-composition proof; candidate-only**

Confidence: **0.85**

This repair supersedes the original V1 proof. It does not modify `catalog.json`,
`sources/`, generated Claw packages, contribution policy, Experience,
regression, quality, Runtime Evidence, or semantic-recipe registries. The only
repository-level bridge remains the candidate test and verifier in
`npm run check`.

## Frame

Repository Operations Manager, Repository Compliance Program Manager, Work
Chief of Staff, contribution admission/scoring, Catalog Quality, Regression,
Runtime Evidence, and Mock+ already work and remain authoritative.

The repaired falsifiable thesis is:

> Their actual schema- and semantic-valid artifacts can be connected through a
> typed, no-sidecar adapter to emit the complete Claw Portfolio Manager ledger
> without invented fields or reachable consequential authority.

If that graph becomes lossless, this candidate must be rejected and deleted.
The V2 control test demonstrates that every current loss is independently
clearable and that clearing all losses changes the verdict to `COMPOSE`.

## Executed strongest composition

`strongest-composition.mjs` executes and pins:

- Repository Operations Manager schema, fixture, semantic validator, and
  first-run/predecessor checkpoint contract;
- Repository Compliance Program Manager schema, fixture, semantic validator,
  provider issue identities, snapshot index, issue idempotency, mutation
  receipts, and predecessor coverage;
- Work Chief of Staff schema, fixture, semantic validator, source-artifact,
  capacity, conflict, decision-right, and blocked-handoff contracts;
- contribution proposal validation and weighted similarity;
- the exact `catalog.json` bytes used by contribution similarity and
  classification, plus every registry and reader consumed by the quality,
  Regression, Runtime Evidence, and Mock+ executions;
- Catalog Quality scoring for all three analogues;
- deterministic Regression scenarios;
- Runtime Evidence scenarios and budget preflight; and
- Mock+ schema and semantic-validator coverage.

Every graph node records exact code, schema, validator, and artifact digests.
Ports and edges are closed typed records. The current adapter consumes only
repository owner artifacts and outputs a partial ledger; it consumes no
candidate fact sidecar.

The adapter also exposes explicit partial outputs toward seven target ports.
Reachability traverses each source-to-adapter-to-target path and requires an
exact closed field set at the target. The eighth target, external trust, has no
current source port. The loss ledger therefore records the fields missing after
real transformation rather than treating the absence of direct edges as proof.
Each requested composition output must derive from exactly all declared input
ports; unrelated extra inputs or an incomplete target-shaped output fail.

Contribution admission validates the candidate's own operating contract, not
an existing analogue's proposal. Its comparison set is generated from the
candidate's current weighted-similarity results, and every reported nearest
match is discussed before the graph can support `NEW`.

### Reachable authority

Repository Compliance exposes a typed `issue-mutation` output carrying
`external-mutation`. No edge connects that port to the composition adapter or
target handoff. The graph therefore reports:

- reachable prohibited authority: **none**;
- unused authority port:
  `repository-compliance-program-manager.issue-mutation`; and
- proposal-only authority: safe.

Unused installed capability no longer forces `NEW`.

### Graph-derived typed losses

The current graph remains lossy at eight target ports:

| Target port | Nearest actual analogue output | Exact loss |
| --- | --- | --- |
| `portfolio-run-lineage` | Repository Operations roster, `firstRun`, predecessor checkpoint, current checkpoint digest | No run/decision identity tied to predecessor result, decision, and cumulative budget bytes. |
| `provider-issue-snapshot` | Repository Compliance provider issue ID, URL, state, revision, owner-content digest, issue snapshot index | No exact repository identity, issue number/ETag, minimized title/body bytes, source-custodian signature, and provider completeness root in one source snapshot. |
| `typed-admission-decision` | Contribution advisory similarity, quality, Regression, Runtime Evidence, Mock+ | No provider-revision-bound classifier or signed human classification that includes composition feasibility. |
| `signed-package-tree` | Work Chief source artifact ref/version/owner | No catalog-revision-bound tree covering the catalog entry and every material source/package file path, media type, byte length, and digest. |
| `cumulative-budget-ledger` | Work Chief capacity envelopes | No period-bound cumulative reservations/usage with run, decision, predecessor, and idempotency replay protection. |
| `externally-pinned-trust` | None | No externally pinned signed trust revision with activation, revocation, rotation, and incompatible signer domains. |
| `minimized-usage-evidence` | Runtime Evidence usage/efficiency observation | No independently signed tenant/source-scoped minimized usage envelope restricted to advisory issue effects. |
| `proposal-owner-handoff` | Repository Operations and Work Chief private blocked handoffs | No single classification/evidence/affected-Claw/blocked-state/owner-decision/PR-ready-plan ledger. |

These losses are calculated from target type/field contracts and available
related ports. They are not permanent booleans. Each loss carries an exact
future-control schema, validator digest, artifact digest, output type, and field
set. A malformed or incomplete future control does not clear its port.
Future-control inputs pass through the same bounded JSON normalization as the
candidate evaluator, so cyclic, accessor-bearing, proxied, oversized, or deeply
nested values are rejected without being canonicalized or echoed. Each signed
control is also bound to the exact pinned source revision and a caller-evaluated
validity window; stale controls are rejected.

## Repaired distinct contract

Because the current graph is not lossless, V2 implements only the irreducible
ports above.

### Authenticated issue source

The owner input is a signed provider snapshot containing:

- GitHub repository owner/name/node identity;
- immutable provider issue ID and number;
- exact URL, state, revision, and ETag;
- exact minimized title/body media type, bytes, byte length, and SHA-256 digest;
- source-custodian identity and issue-domain Ed25519 signature; and
- exact issue membership and snapshot completeness root.

Classification is never selected from caller booleans. The exact body is a
strict typed issue-form payload. A domain-separated classifier signs one
revision-bound decision per issue. A separately signed composition assessment
binds the executed graph digest, feasibility, proposed Claws, and typed losses.
NEW also requires a complete repository-valid contribution proposal in those
authenticated issue bytes: full operating contract, proof plan, and at least
three substantive existing-alternative comparisons. Weighted nearest matches
and the signed dimension decision are derived from that proposal rather than
technical invariant names.
VARIANT is accepted only when job, workflow, outputs, authority, and proof
remain unchanged; an evidence-model change must use another admission class.
Omission, duplicate provider identity, repository substitution, body
substitution, decision omission, or stale decision binding fails closed.

### Signed package trees

The signed package-tree manifest covers each selected Claw's:

- canonical catalog-entry bytes;
- every file under `sources/<claw-id>/`;
- every material file under `claws/<claw-id>/`, including package, workspace,
  profile, resource, and screenshot files; and
- path, media type, byte length, digest, per-Claw tree root, portfolio root,
  catalog revision, source custodian, and signature.

The verifier rereads the actual repository bytes. Omission, extra file, path
substitution, size drift, digest drift, root drift, or any symbolic or otherwise
unsupported filesystem entry fails.

### Enforced compose-first budget

The classifier makes one each of `NEW`, `IMPROVE`, `COMPOSE`, `VARIANT`,
`PRODUCT_DECISION`, `RETIRE`, `DUPLICATE`, and `UNSUPPORTED`.

Allocation sorts feasible `IMPROVE` and `COMPOSE` ahead of `NEW`, then applies
priority. In the bounded fixture the NEW issue has the highest raw priority,
but COMPOSE and IMPROVE consume the two available admission reservations first;
NEW remains budget-blocked.

The signed ledger binds:

- budget period, run ID, decision ID, predecessor budget digest;
- cumulative state before and after;
- exact per-issue candidate/admission/work/cost/time amounts;
- reservation and run idempotency keys; and
- consumed prior run/decision/reservation identities.

Every allocation also consumes an independently signed, time-bounded exclusive
CAS lease from the budget authority. The lease binds the exact predecessor
checkpoint, period, run, and decision, so concurrent workers cannot both obtain
a valid claim on the same budget head. The candidate verifies the receipt but
does not mutate the lease store itself.

Changing run IDs cannot replay the same decision or budget, and the supplied
predecessor result must match the final history entry rather than any earlier
member. Stable issue identity excludes observation time, while blocked work may
be reconsidered when capacity becomes available; only reserved or completed
work suppresses another reservation for the same issue revision, regardless of
later reclassification. A classification change for already reserved or
completed work is rejected rather than attributing that work to a new plan.
Prior reserved/completed decisions must correspond
one-to-one with full historical reservations, and their amounts must sum exactly
to the predecessor period's cumulative usage. Older period-tagged reservations
remain in lifetime replay history without carrying their spend into a later
period. Prior period dates must parse, be ordered, and end before a later period
may reset cumulative usage.

### Bootstrap, adopt, and manage

Three accepted fixtures prove:

- `bootstrap`: owner-signed role, job, process, and capability lists plus the
  selected initial Claw subset;
- `adopt`: owner-signed adoption of an exact package-tree-bound subset; and
- `manage`: exact prior result, decision, and budget bytes and digests.

Bootstrap/adopt require no predecessor and a zero cumulative budget baseline.
Manage requires all three predecessor records. Mode, predecessor, run,
decision, package tree, provider snapshot, and budget period must agree.

The owner-signed onboarding record also contains the exact approved
tenant/source pairs for optional minimized usage. A usage issuer cannot expand
that scope.

### Externally pinned trust

Public trust V2 has an externally pinned Ed25519 SPKI root. The root signs its
revision, predecessor revision, activation window, keys root, and key records.
Key records enforce activation/revocation chronology at the caller-controlled
evaluation time, unique SPKI fingerprints, and one incompatible domain per key:

`catalog`, `issue`, `usage`, `human-grant`, `classification`, `composition`,
`run-result`, or `budget`.

Effective principal roles are derived only from those signed key domains and
principal kinds. The caller-supplied principal projection must match that
authenticated roster exactly; adding or reassigning a role cannot grant
authority.

The fixture includes an old revoked catalog key and an active replacement.
Shared-key, cross-domain, inactive, revoked, unpinned-root, and chronology
probes fail.

Any reachable prohibited authority makes the composition proof `BLOCKED`; it
cannot be reinterpreted as evidence for retaining a `NEW` candidate.

## Authority and usage boundary

The accepted and invalid outputs structurally keep merge, publication, budget
increase, risk acceptance, external mutation, production Claw mutation,
sensitive-person inference, and resealing false.

Authenticated usage is tenant/source/revision/time scoped and contains exactly
event, success, and failure counts. It can produce only an advisory priority
hint or a draft issue proposal requiring ordinary admission. It cannot alter
classification, correctness, safety, authority, budget ordering, or production
state.

Each `plan-ready` result embeds its versioned, evidence-bound plan, including
the exact issue revision, affected Claws, package-tree revision, composition
contract when applicable, validation steps, and structural non-authority. It
does not return a path to an artifact that the evaluator did not create.

## Proof surface

Canonical files:

- `claw-portfolio-manager.mjs`
- `claw-portfolio-manager.test.mjs`
- `strongest-composition.mjs`
- `candidate-utils.mjs`
- `schemas/claw-portfolio-manager.schema.json`
- `schemas/public-trust.schema.json`
- `schemas/package-tree-v1.schema.json`
- `fixtures/bootstrap-v2.input.json`
- `fixtures/adopt-v2.input.json`
- `fixtures/manage-v2.input.json`
- `fixtures/public-trust-v2.test.json`
- `fixtures/package-tree-v1.test.json`
- `expected/manage-v2.expected.json`
- `proof/manage-v2-handoff.md`
- `verify.mjs`

The adversarial suite covers provider omission/substitution, typed classifier
drift, compose-first priority inversion, run/budget replay, exact predecessor
bytes, package file substitution, trust-root drift, revoked/shared/domain-reused
keys, unauthenticated principal-role escalation, bootstrap/adopt/manage
mismatch, usage expansion/expiry, structural authority, malformed JSON, cycles,
accessors, proxies, symbols,
non-enumerables, prototype keys, oversized files, and bounded non-echoing CLI
failures.

## Verdict

**NEW, confidence 0.85.**

This verdict does not rely on the presence of Repository Compliance mutation
capability. It relies only on the eight typed graph losses above. If actual
analogue evolution supplies those ports losslessly with safe reachable
authority, `runStrongestComposition` returns `COMPOSE`; admission must stop and
this candidate directory should be deleted in favor of the emitted composition
recipe.

## Independent-review challenges

An independent reviewer should challenge:

1. whether any existing owner artifact can be mapped to one of the eight target
   port types without adding a sidecar or inventing semantics;
2. whether every material source/package file is correctly included;
3. production issue-provider snapshot issuance and title/body minimization;
4. production external trust-root custody, rotation, and revocation;
5. cumulative budget concurrency across multiple workers; and
6. whether the typed classifier rules are sufficient before public admission.
