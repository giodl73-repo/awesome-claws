# Claw Portfolio Manager final composition decision

Status: **IMPROVE/COMPOSE; standalone candidate rejected**

Confidence: **0.92**

No public catalog entry, generated package, registry, source package, push, or
pull request is part of this decision.

## Frame

Repository Operations Manager, Repository Compliance Program Manager, Work
Chief of Staff, contribution admission/scoring, Catalog Quality, Runtime
Evidence, Regression, and Mock+ collectively own the required behavior.

The missing capability was a typed adapter and small owner-owned output
extensions, not a new autonomous repository steward. The standalone candidate
would duplicate owner workflows, trust, issue, continuation, and handoff
semantics. Its evaluator and candidate-specific runtime fixtures are therefore
deleted.

The retained deletion target is the standalone Claw. The retained artifact is
only an executable composition proof and delivery recipe.

## Executable proof

`composition.mjs` is the retained candidate-only executable contract. It:

1. validates the actual Repository Operations, Repository Compliance, and Work
   Chief fixtures with their real JSON Schemas and semantic validators;
2. runs the actual contribution validator and similarity scorer over a complete
   proposal;
3. derives all eight admission dispositions end to end from signed owner
   evidence and prioritizes COMPOSE/IMPROVE ahead of NEW;
4. optionally executes Catalog Quality, Runtime Evidence budget preflight,
   Regression, and Mock+ inventory proof and emits concrete advisory results;
5. deterministically walks and verifies the complete transitive local import
   closure from the adapter, plus exact schemas, owner artifacts, registries,
   `package.json`, and `package-lock.json` bytes;
6. verifies an externally supplied lifecycle-bounded trust pin,
   domain-separated Ed25519 public keys, and signed provider, continuation,
   admission, catalog, receipt, runtime-budget, and usage records;
7. accepts bootstrap, adopt, and manage continuation modes while keeping
   persistence, compare-and-swap, and receipt consumption external; and
8. emits eight concrete, closed output ports with reachable authority derived
   from selected zero-authority edges.

The representative end-to-end lane is:

```text
Repository Compliance issue-api
  -> authenticated exact provider snapshot
  -> repository-valid signed admission proposal
  -> typed COMPOSE classification
  -> Work Chief capacity-aware stateless plan
  -> Repository Operations continuation checkpoint
  -> owner-controlled handoff
```

The Repository Compliance `issue-mutation` capability is not connected. No
merge, publish, external mutation, atomic mutation, budget increase, risk
acceptance, HR inference, or sensitive-person inference authority is reachable.

## Eight-port composition

| Output port | Owner | Minimal owner improvement |
| --- | --- | --- |
| `portfolio-run-lineage` | Repository Operations Manager | Emit a signed bootstrap/adopt/manage continuation plan over portfolio revision, exact source root, predecessor, and prior receipt identities. |
| `provider-issue-snapshot` | Repository Compliance Program Manager | Emit provider identity, state, revision, capture time, exact minimized title/body bytes, and completeness root without invoking mutation. |
| `typed-admission-decision` | Contribution admission | Emit the selected disposition plus an eight-way scorecard over the valid proposal, similarity, comparison, and composition feasibility. |
| `signed-package-tree` | Catalog Quality | Publish a signed tree over exact catalog, owner schema, validator, artifact, adapter, package manifest, and lockfile bytes. |
| `stateless-budget-plan` | Work Chief of Staff | Plan against supplied capacity and externally persisted provider/idempotency receipts; claim neither reservation nor atomic mutation. |
| `externally-pinned-trust` | Composition adapter | Verify an independently supplied, time-bounded trust revision with incompatible provider, continuation, admission, catalog, receipt, runtime-budget, and usage key domains. |
| `minimized-usage-evidence` | Runtime Evidence | Emit tenant/source-scoped counts only, limited to advisory issue creation or reprioritization, with no mutation authority. |
| `proposal-owner-handoff` | Work Chief of Staff | Render evidence, classification, signed continuation, and proposal as a blocked owner handoff requiring external action. |

All eight ports are concrete in `expected/composition.expected.json`. There is
no residual executable loss.

## Budget and continuation semantics

The composition is a stateless planner:

- prior provider/idempotency receipts, when present, are externally supplied,
  signed, scoped, and time-bounded;
- the signed continuation plan binds bootstrap/adopt/manage mode, exact source
  root, portfolio revision, predecessor checkpoint, and receipt identities;
- output contains only a proposed idempotency key and declares
  `externalReceiptRequired: true`;
- `reservationClaim` and `atomicMutationClaim` are always false.

Persistence, one-time compare-and-swap, and concurrent consumption remain with
the owner system. The composition makes no claim that local validation performs
or guarantees an atomic mutation.

## Admission semantics

Classification is derived after the exact issue, proposal, comparison, and
signatures validate:

- unsupported owner contract or support -> `UNSUPPORTED`;
- exact existing operating contract -> `DUPLICATE`;
- validated lifecycle removal -> `RETIRE`;
- feasible complete composition -> `COMPOSE`;
- same job plus any material workflow/output/evidence/authority difference ->
  `IMPROVE`;
- same job plus an owner-accepted non-improvement specialization -> `VARIANT`;
- `NEW` requires `job === "different"` **and** at least one material
  workflow/output/evidence/authority difference, with no feasible COMPOSE or
  IMPROVE path;
- authenticated product-decision references suppress every automatic
  disposition and select `PRODUCT_DECISION`, even when composition is feasible;
- otherwise -> `PRODUCT_DECISION`.

The scorecard always includes all eight dispositions, their eligibility,
priority, and evidence reason. The suite includes same-job/different-workflow,
compose-before-NEW, and all-disposition regressions and rejects incomplete
proposal contracts and caller-only classification claims.

## Exact composition recipe

1. Verify the independently supplied trust pin, its validity interval, exact
   trust revision, key lifecycles, unique fingerprints, and incompatible
   provider/continuation/admission/catalog/receipt/runtime-budget/usage domains.
2. Recompute the source-binding root over exact schemas, semantic validators,
   owner source/package trees, registries, adapter bytes, `package.json`, and
   `package-lock.json`.
3. Validate the actual Repository Operations, Repository Compliance, and Work
   Chief artifacts with their current schemas and semantic validators.
4. Verify the provider issue identity, state, base revision, exact minimized
   bytes, replacement mapping, content revision, completeness root, provider
   signature, and the closed decoded body; reconstruct only typed,
   subject-bound `evidenceRefs`, `proposalDigest`, and `request`.
5. Validate the complete contribution proposal, current similarity coverage,
   the exact selected owner set, signed
   support/duplicate/lifecycle/variant/product-decision/demand evidence,
   typed lifecycle and product-decision references, zero-authority owner
   mappings, and the eight-way compose-first scorecard.
6. Verify the signed package tree and, when supplied, the bounded runtime
   budget; then run Catalog Quality, Regression, Runtime Evidence, and Mock+ as
   advisory evidence that cannot change classification.
7. Verify externally supplied receipt lineage and compute an explicit Work
   Chief proposed-demand allocation or blocked result from remaining capacity
   and open conflicts only, without reserving, consuming, or mutating anything.
8. Verify the signed bootstrap/adopt/manage continuation plan and emit the
   owner-controlled handoff with merge, publication, mutation, budget increase,
   risk acceptance, HR inference, and sensitive-person inference unreachable.

## Delivery plan

1. Improve Repository Compliance with the exact provider snapshot output; keep
   `issue-mutation` disconnected.
2. Improve Repository Operations with the signed bootstrap/adopt/manage
   continuation-plan output.
3. Improve contribution admission with the closed eight-way scorecard over the
   complete proposal and current nearest-match report.
4. Improve Catalog Quality with the signed package/source/dependency tree.
5. Improve Runtime Evidence with optional advisory proof and the minimized
   create-or-reprioritize issue envelope.
6. Improve Work Chief with stateless capacity/conflict planning and the final
   external-action handoff.
7. Promote the schemas and adapter only after those owners accept the listed
   extensions; then delete this candidate proof directory.

## Proof

- `npm run check:claw-portfolio-composition`
- `node --test scripts/repository-operations-manager.test.mjs scripts/repository-compliance-program-manager.test.mjs scripts/x3-decision-artifacts.test.mjs scripts/contribution-lib.test.mjs scripts/catalog-quality-score.test.mjs scripts/runtime-evidence.test.mjs scripts/regression-cases.test.mjs scripts/mock-plus.test.mjs`
- `npm run check`

The candidate proof is intentionally absent from the default `npm run check`
gate. Run it explicitly and regenerate exact signed fixtures with
`npm run regenerate:claw-portfolio-composition` after any
bound adapter, schema, owner, registry, manifest, or lockfile byte changes.

The focused lane covers exact output, all authenticated dispositions, complete
transitive import closure, source/provider/proposal/package substitution,
closed provider-body reconstruction, explicit Work Chief allocation, stateless
receipt semantics, all continuation modes, trust lifecycle/domain separation,
optional usage/evidence, hostile values in every public API argument, and
bounded non-echoing CLI files. The owner analogue command and full repository
check pass.

## Landing boundary

What can land now is this candidate-only composition recipe, its closed schemas,
executable proof, and the enumerated owner improvements. What is not being
added is a standalone Claw Portfolio Manager, catalog entry, generated Claw
package, registry entry, mutation capability, push, or pull request.

## Disproof and review boundary

This decision is disproved if any emitted port requires the deleted standalone
candidate to supply facts, authority, persistence, or business semantics. A
reviewer should especially challenge provider receipt issuance, continuation
signer custody, package completeness, external idempotency receipt persistence,
and the owner teams' willingness to adopt the listed minimal schema extensions.
