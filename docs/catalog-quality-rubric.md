# Catalog quality rubric

This rubric measures how completely each Claw is specified, bounded, packaged, and verifiable in this repository. It complements the [contribution admission policy](contribution-admission.md): admission asks whether a Claw belongs in the catalog; this rubric asks how strong and reviewable its maintained contract is.

The score is intentionally conservative. It uses deterministic repository evidence only. It does not score prose style, assume live-model behavior, or claim user outcomes that have not been tested.

## Interpretation

| Score | Band | Meaning |
| ---: | --- | --- |
| 90-100 | Exemplary | Deep, reviewable contract with strong artifact and verification evidence |
| 80-89 | Strong | Production-shaped contract with a small number of hardening opportunities |
| 70-79 | Solid | Useful maintained Claw whose evidence or authority model needs uplift |
| 60-69 | Needs uplift | Material contract gaps should be prioritized |
| Below 60 | Priority remediation | Multiple foundational contract or verification gaps |

A numeric score is not enough to qualify an entry. Every Claw must also retain its catalog entry, materialized source package, regression case, Experience declaration, and resolvable packaged resources. A failed gate blocks qualification regardless of score.

Legacy entries are not treated as failed admissions. A missing post-policy contribution record costs at most 5 points and is reported as "not recorded," while the Claw continues to receive credit for all observable contract, artifact, safety, experience, verification, and maintenance evidence.

## Point rules

### 1. Distinct job and admission case - 15 points

| Evidence | Points |
| --- | ---: |
| Specific catalog description | 3 |
| Named audience | 2 |
| Concrete example request and outcome | 3 |
| At least two job-shaping boundaries | 2 |
| Contribution problem, repeatable job, and proof plan recorded | 2 |
| At least three alternatives with explicit overlap and difference | 3 |

### 2. Operating contract completeness - 20 points

| Evidence | Points |
| --- | ---: |
| At least three principles | 3 |
| At least three intake requirements | 4 |
| At least four workflow stages | 5 |
| At least four deliverables | 4 |
| At least three observable done conditions | 4 |

### 3. Evidence and artifact model - 20 points

| Evidence | Points |
| --- | ---: |
| Packaged fixture | 3 |
| Packaged template | 3 |
| Structured artifact schema | 5 |
| Registered semantic validator | 6 |
| Complete schema, non-session example fixture, and non-session artifact template trio | 3 |

Semantic validation receives the most weight because schemas alone cannot enforce cross-field provenance, chronology, reconciliation, or authority invariants.

### 4. Authority and safety - 20 points

| Evidence | Points |
| --- | ---: |
| Three or more boundaries (two earns 4 points) | 5 |
| Explicit approval, owner, authorization, or prohibited-action language | 6 |
| Explicit evidence, uncertainty, conflict, or anti-invention language | 4 |
| No runtime capability classes, or an OpenClaw profile plus capability guidance for declared classes | 5 |

No-capability Claws receive full capability-boundary credit: least privilege is not a missing feature. Capability execution proof remains class-based, with representative Claws proving shared platform behavior.

Privacy and sensitive-data handling remain mandatory where relevant, but are
reviewed as domain semantics rather than keyword-scored. This avoids rewarding
incidental terminology or penalizing valid boundaries that use different
protective language.

### 5. Experience and usability - 10 points

| Evidence | Points |
| --- | ---: |
| Exactly one Experience declaration | 3 |
| Valid X3, X4, or X5 contract | 3 |
| Maintained screenshot | 2 |
| Required X3 session resources, or required visual asset/output/fallback resources | 2 |

Higher Experience tiers do not automatically score more points. A well-executed X3 artifact is not inferior to an X4 visual or X5 dashboard when X3 is the right interface.

### 6. Verification and portability - 10 points

| Evidence | Points |
| --- | ---: |
| Deterministic regression case | 4 |
| Materialized `CLAW.md` and package manifest | 2 |
| Every declared resource resolves inside the Claw package | 2 |
| Registered semantic validator | 2 |

### 7. Stewardship and maintenance - 5 points

| Evidence | Points |
| --- | ---: |
| Active maintenance status | 2 |
| At least one named GitHub maintainer | 1 |
| Verified within 90 days of the score date | 2 |

## Reproduction

Run:

```text
npm run score:catalog
```

The command writes `catalog-quality-scores.json` and `docs/catalog-quality-scorecard.md`. Use `npm run score:catalog:check` to verify that checked-in scores match the current catalog while retaining the scorecard's recorded `asOf` date.
Both commands first require byte-for-byte agreement between the catalog source
and every materialized Claw package, so a stale package cannot be reported as
qualified.

The generated scorecard is a prioritization aid, not a leaderboard of authors or a substitute for live evaluation. Improve low dimensions by adding evidence at the owning layer; do not pad prose or add capabilities merely to increase a score.
