# Claw Portfolio Manager composition proof

This directory is an archival, candidate-only proof for the
**IMPROVE/COMPOSE** decision in `DECISION.md`. It is not a standalone Claw,
catalog entry, generated package, or default repository gate.

## Run the proof

```powershell
npm run check:claw-portfolio-composition
```

The default `npm run check` intentionally does not invoke this archival proof.
Run both commands when changing the adapter or its owner contracts.
The explicit proof is comparatively expensive: it repeatedly validates the
three owner artifacts and exercises Catalog Quality, Runtime Evidence,
Regression, and Mock+ across the adversarial cases. Keeping it explicit avoids
adding that repeated repository-wide work to every default check.

Run the exact owner and evidence analogue suites separately:

```powershell
npm run check:claw-portfolio-owners
```

## Regenerate exact fixtures

The signed fixtures bind the adapter, closed schemas, complete transitive local
import closure, owner package trees, registries, `package.json`, and
`package-lock.json`. Regenerate them after any bound byte changes:

```powershell
npm run regenerate:claw-portfolio-composition
npm run check:claw-portfolio-composition
```

`regenerate-fixtures.mjs` uses fixed fixture-only Ed25519 keys so reruns are
deterministic. Those keys are test material and grant no runtime authority.
Regeneration discovers and hashes the complete transitive local import closure,
the full selected owner source/package trees, registries, `package.json`, and
`package-lock.json`; signs every dependent record; runs the owner-backed
composition once; and rewrites:

- `fixtures/composition-input.test.json`
- `fixtures/composition-trust.test.json`
- `fixtures/composition-trust-pin.test.json`
- `fixtures/catalog-maintainer-retire.test.json`
- `fixtures/catalog-maintainer-product-decision.test.json`
- `expected/composition.expected.json`
- `proof/composition-plan.md`

Provider and admission evidence references are non-authoritative pointers.
`RETIRE` and `PRODUCT_DECISION` require a matching, active
`catalogMaintainerDecisions` record signed by the separately pinned
`catalog-maintainer` trust domain. Catalog comparisons are recomputed from the
bound catalog bytes, so an exact operating-contract match with contradictory
comparison evidence fails closed instead of yielding `NEW`.

Provider request bytes must be the canonical serialization of the validated
minimized body; alternate encodings and duplicate JSON keys fail closed. The
stateless budget port has a stable composition extension identity independent
of the selected capacity envelope, while its idempotency key binds the complete
signed admission, continuation, portfolio, requested demand, envelope, and
allocation result.
