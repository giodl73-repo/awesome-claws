# Benefits Realization Manager admission decision

Status: **NEW CLAW proven by a bounded candidate slice; not yet a catalog contribution**

Confidence: **medium-high (0.90)**

This directory is deliberately candidate-only. It does not add a catalog entry,
contribution record, regression case, Experience case, screenshot, generated
Claw package, chooser entry, or public registry output.

## Frame

Working owner systems already cover project delivery, financial scenario
analysis, and cross-functional portfolio coordination. The missing capability is
a closed benefit ledger that keeps benefit identities and owners while
allocating one observed KPI exactly once, preserving one disbenefit, and
blocking unsupported attribution.

The falsifiable thesis was:

> Financial Analyst + Project Manager + Work Chief of Staff can represent the
> requested ledger without causal overclaim or loss of identity, baseline,
> target, allocation, chronology, and authority.

The thesis would be accepted, and this candidate deleted, if composition could
represent all of the following without an untyped sidecar:

1. exactly three separately owned benefits and one disbenefit;
2. one metric-owner-controlled KPI with baseline, target, observation, and
   caller-controlled period/cutoff;
3. an explicit allocation covering every benefit exactly once and totaling
   100 percent;
4. benefit-owner, metric-owner, and finance-owner authority as distinct typed
   roles;
5. an injected owner/signing-key trust store, source bytes verified against
   signed digests, and reciprocal internal subject bindings that cannot be
   refreshed by normal validation;
6. a structured blocker that prevents unsupported attribution from becoming
   recognized value.

## Audit and internal comparison

| Existing contract | Reuse | Irreducible gap |
| --- | --- | --- |
| Financial Analyst (`catalog.json`; `sources/financial-analyst/`; `scripts/financial-scenario-schema.test.mjs`; `scripts/artifact-semantics.mjs`) | Reuse exact period/currency/basis, scenario calculations, reconciliation chronology, source/assumption owners, independent finance review, and no-advice boundaries. | Its required metric is one calculation/outcome per scenario. It has no benefit entity, benefit owner, shared-KPI allocation, disbenefit register, or unsupported-attribution blocker. Its controlled evidence binds values and scope but does not content-digest the subject and evidence in both directions. Encoding benefits as scenarios or assumptions loses benefit identity and changes the meaning of the financial contract. |
| Project Manager (`catalog.json`; `sources/project-manager/`; `scripts/project-state-schema.test.mjs`) | Reuse milestone/dependency identity, accountable ownership, acceptance evidence, and sponsor-controlled state. | The schema has no metric definition, baseline, target, allocation, cutoff, disbenefit, finance authority, or attribution evidence. Milestones cannot safely double as benefits. |
| Work Chief of Staff (`catalog.json`; `sources/work-chief-of-staff/`; `scripts/x3-decision-artifacts.test.mjs`; `scripts/prove-capstones.mjs`) | Reuse typed principals, source-artifact identity, owner/status/prohibition preservation, conflict visibility, and multi-principal commitment gates. | Composition is artifact-level. `sourceArtifacts` preserve a Financial Analyst or Project Manager artifact as a whole; `workstreams` preserve outcome and ownership but not benefit rows, KPI baselines/targets, allocation shares, or attribution evidence. Extending Work Chief with those domain fields would violate its boundary against replacing specialist workflows. |
| Cloud Cost Analyst (`catalog.json`; `sources/cloud-cost-analyst/`; `scripts/cloud-cost-analyst.test.mjs`) | Adapt its exact-period allocation reconciliation and finance-owner checks. | It allocates billed cost across accounts/services and bounds savings recommendations. It does not allocate one outcome KPI across separately owned benefits or track a disbenefit and benefit-realization chronology. |
| Customer Success Program Manager (`catalog.json`; `sources/customer-success-program-manager/`; `scripts/customer-success-program-manager.mjs`) | Adapt immutable metric-definition digests, exact plan/window binding, observations, milestones, decisions, and owner handoff. | Its metrics belong to one customer success-plan revision and workload/service binding. It has targets but no benefit baseline/target profiles, shared-metric allocation, finance reconciliation, or disbenefit netting. |
| Partner Business Manager (`catalog.json`; `sources/partner-business-manager/`; `scripts/partner-business-manager.mjs`) | Reuse canonical content digests, exact-subject evidence fingerprints, reciprocal evidence, period coverage, typed decision rights, and blocked authority claims. | Its "benefits" are partner-program eligibility evidence, not realized outcomes. Opportunity attribution is a closed partner/vendor/co-sell label, not quantified KPI allocation. Importing realized-benefit semantics would conflate program eligibility with realization. |
| Experimentation Lead (`catalog.json`; `sources/experimentation-lead/`; `scripts/experimentation-lead.test.mjs`) | Reuse preregistered metrics, observation chronology, allocation integrity, and explicit limits on causal claims. | It evaluates one experimental design and treatment/control exposure. It neither owns a durable multi-benefit ledger nor permits allocating one observed KPI as realized value across benefits. |
| Product Manager and Grant Portfolio Manager (`catalog.json`; their source schemas and focused tests) | Reuse stable option/opportunity identity, evidence, owner decisions, and portfolio coverage. | Success measures and opportunity readiness are not realized-benefit accounting. Neither closes allocation, disbenefits, finance review, or attribution. |

Repository-wide searches found no Benefits Realization, disbenefit, benefit-ledger,
or OKR contract. Existing attribution contracts concern meeting speech,
partner opportunity labels, or source provenance rather than allocated realized
benefits.

## External comparison

The UK Government Project Delivery Teal Book chapter on benefits management and
the Benefits Practitioner Workbook treat benefits management as a lifecycle
with named benefit owners, baselines, targets, measurement, realization, and
handover:

- https://projectdelivery.gov.uk/teal-book/home/part-e-planning-and-control/chapter-19-benefits-management/
- https://projectdelivery.gov.uk/library-product/practitioner-workbook-for-benefits-management-in-government/

The UK Benefits Measurement Guidance Note and NISTA assurance guidance add
measurement, attribution, disbenefit, and double-counting scrutiny:

- https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/987133/Benefits_Measurement_Guidance_Note_May_2021.pdf
- https://www.gov.uk/government/publications/assurance-of-benefits-realisation-in-major-projects

Useful precedent: benefit identity, ownership, baseline, target, and measurement
must survive past project delivery. Negative precedent: a benefits map or
financial scenario alone cannot be treated as causal proof. This slice is
simpler than a full benefits framework: it accepts caller-supplied evidence,
uses an approved fixed allocation only to prevent double counting, and
explicitly sets `causalClaim` to false. Currency V1 uses integer minor units,
direction-aware baseline deltas, and deterministic largest-remainder
allocation rather than floating-point amounts.

## Role evaluation

The FACES review used four repository roles from distinct tension clusters:

| Lens | Finding applied to the slice |
| --- | --- |
| Claws repo steward (H) | Keep the experiment under `candidates/`; touch no authoritative catalog or generated surface before admission proof and maintainer acceptance. |
| Power user (B) | The slice must replace the manual spreadsheet join across project status, financial analysis, and portfolio reporting. One input, one result, and one blocker are the minimum useful proof. |
| Compliance (C) | IDs, typed authority, caller cutoff, chronology, content digests, reciprocal evidence, and exact coverage must be machine-checkable. Narrative-only evidence is insufficient. |
| Founder/simplicity (A) | Do not generalize into a dashboard, integration, causal model, or new platform contract. Keep an X3-shaped, removable candidate seam. |

No role finding required a broader runtime or catalog contract.

## Slice and proof

The candidate seam contains:

- `fixtures/benefits-realization.input.json`: a raw, non-zero-baseline,
  increase-direction input with three benefits, one shared KPI, one
  disbenefit, typed owners, explicit basis-point allocation, and caller
  period/cutoff;
- `fixtures/municipal-permit-cost.input.json`: an independent raw,
  decrease-direction case whose uneven 33.34/33.33/33.33 allocation exercises
  residual-cent handling;
- `fixtures/unsupported-attribution.input.json`: an independently signed,
  schema-valid blocked input rather than a validator-time mutation;
- `fixtures/unsupported-with-evidence.input.json` and
  `fixtures/absent-finance-close.input.json`: signed adversarial inputs proving
  that retained context cannot turn unsupported attribution into value and
  that supported attributions cannot bypass finance close;
- `fixtures/trust-store.test.json`, `fixtures/source-bytes.test.json`, and
  `fixtures/source-bytes-municipal.test.json`: explicitly injected test-only
  public trust and exact per-case source bytes; production validation has no
  embedded trust default;
- `expected/accepted-result.json`: the accepted owner-review result;
- `expected/municipal-permit-cost.accepted.json`: the second derived accepted
  result;
- `expected/unsupported-attribution.failure.json`: the structured failure that
  withholds one benefit and all gross/net realization claims;
- `proof/accepted-ledger.md`: the observable X3-style proof surface;
- `schemas/benefits-realization-slice.schema.json` and
  `benefits-realization-slice.mjs`: integrated draft-2020-12 validation,
  direction-aware minor-unit derivation, deterministic residual allocation,
  injected owner-and-key-scoped trust, full-envelope signature and source-byte
  verification, reciprocal internal bindings, total relational validation,
  chronology, stable human identity, authority, finance, and no-causality
  checks;
- `benefits-realization-fixture-tools.mjs`: test-only internal resealing with no
  signing capability;
- `benefits-realization-slice.test.mjs`: two accepted raw vectors, structured
  blocker variants, absent finance close, schema/CLI failures, malformed
  cardinality and relationships, allocation, distinct authority, caller
  cutoff, full-envelope and source-byte tampering, chronology, identity
  aliasing, BigInt aggregate overflow, bounded evidence/source sizes,
  preregistration, strict finance-close ordering, and causal-overclaim proof.

The first accepted ledger derives a USD 120,000 increase from a USD 20,000
baseline and USD 140,000 observation, allocates that delta 50/30/20, derives a
USD 15,000 disbenefit, and reconciles USD 105,000 net. The second derives a USD
12,000.02 decrease from a USD 80,000.03 baseline and USD 68,000.01
observation, assigns residual cents deterministically, derives a USD 1,250.01
disbenefit, and reconciles USD 10,750.01 net. Neither input supplies allocated
benefit values or finance totals.

Aggregate finance arithmetic remains in `BigInt` until the final supported
range check. A result outside JavaScript's safe-integer minor-unit range is an
`aggregate-out-of-supported-range` contract finding and cannot become ready.
Proof rendering also uses signed `BigInt` quotient/remainder arithmetic and
manual digit grouping, so even `9007199254740991` minor units renders exactly
as `$90,071,992,547,409.91` without a floating major-unit conversion.
Target approval strictly predates both period start and target due time;
finance close strictly follows the final attribution; and metric-owner
authority strictly predates the KPI baseline.

The SHA-256 `recordDigest` and `bindingDigest` fields are explicitly internal
consistency checks, not external immutability claims. External tamper evidence
comes from an Ed25519 signature over the complete semantic input: request,
period/cutoff, principal and authority roster, subjects, evidence, source
manifest, and every result-driving field. Validation requires an injected
public trust-store entry keyed by both `ownerRef` and `signingKeyId`, then
hashes separately supplied source bytes and compares them with the signed
`sourceContentDigest` values. Production evaluation has no default key or
source bundle. Fixture resealing can update only internal digests; it cannot
update the signed envelope.

Source-byte limits are computed once over every supplied bundle record,
including unreferenced records. Shared source records are counted once even
when multiple evidence rows reference them, while unreferenced records retain
their own `unreferenced-source-record` finding. Stable-human-identity
uniqueness is likewise one global pass and emits one deterministic finding per
invalid roster.

Focused proof command:

```text
node --test candidates\benefits-realization-manager\benefits-realization-slice.test.mjs scripts\financial-scenario-schema.test.mjs scripts\project-state-schema.test.mjs scripts\cloud-cost-analyst.test.mjs scripts\customer-success-program-manager.test.mjs scripts\partner-business-manager.test.mjs scripts\experimentation-lead.test.mjs scripts\x3-decision-artifacts.test.mjs
```

Results on 2026-09-15:

- candidate slice: **30 passed, 0 failed, 0 skipped**;
- the prior candidate-plus-focused-analogue command, previously 349 tests:
  **366 passed, 0 failed, 0 skipped** after adding seventeen adversarial
  regressions across the skeptical review rounds.

## Verdict

**NEW CLAW.** The closed benefit ledger is irreducible under existing contracts.
This is a materially new source/evidence model, recurring workflow, output
contract, and authority boundary:

> Unlike Financial Analyst, Benefits Realization Manager repeatedly closes
> separately owned benefit and disbenefit profiles over owner-controlled KPI
> observations by applying explicit no-double-count allocation and
> owner-signed, reciprocal attribution evidence to derive a finance-reconciled
> benefit ledger, while retaining benefit-owner, metric-owner, and
> finance-owner authority and refusing unsupported causal claims.

`IMPROVE/COMPOSE` would require an untyped cross-artifact sidecar for benefit
identity, allocation, and attribution. Adding those fields to Financial Analyst
would turn scenarios into benefits; adding them to Project Manager would turn
milestones into outcomes; adding them to Work Chief would replace a specialist
workflow it is required to preserve. All three workarounds violate an existing
contract rather than reuse it.

## Deletion and workaround mapping

| Current workaround | Slice replacement | Deletion gate |
| --- | --- | --- |
| Spreadsheet benefit register joined manually to Financial Analyst outputs | Typed benefit/disbenefit profiles plus one finance reconciliation | Delete when every profile, owner, baseline, target, and result validates in the accepted ledger. |
| Manual shared-KPI apportionment and duplicate-count review | One exact 10,000-basis-point allocation rule | Delete when allocation covers every benefit exactly once and the focused overlap test fails closed. |
| Narrative caveat that attribution is "not proven" | `causalClaim: false` plus a structured `unsupported-attribution` blocker | Delete when missing attribution evidence withholds that benefit and gross/net realization values. |
| Hand-copied evidence links across PM, finance, and portfolio documents | Full-envelope owner signature, independently supplied source bytes, and reciprocal internal references | Delete when request/principal/subject/evidence mutations fail after fixture resealing, source bytes are verified, and manifest edits require a new trusted owner signature. |
| Report-date defaults chosen by the tool | Caller-supplied period and cutoff propagated to result/proof | Delete when post-cutoff evidence is rejected without consulting wall-clock time. |

## Remaining slice limitations

- This falsification contract is intentionally fixed at three separately owned
  benefits, one disbenefit, one shared financial KPI, one currency, and one
  fixed-basis-point allocation per period.
- Financial V1 accepts only a KPI whose unit exactly equals the request
  currency and uses a scale of 100. Currency exponent catalogs, conversions,
  and non-financial measures are not modeled.
- Allocation is a no-double-count accounting convention over a direction-aware
  observed delta. It is not causal inference, counterfactual estimation, or
  proof that any initiative produced the KPI movement.
- The repository contains only an injected test trust store and synthetic
  source-byte bundle. Production contribution work must define trust-store and
  source-byte/controlled-receipt providers, owner-key discovery, rotation,
  revocation, and verification availability/failure behavior.
- This slice verifies supplied Base64 source bytes directly. It does not yet
  implement the alternative controlled-system receipt path, streaming digest
  verification, or source retrieval.
- Candidate limits are explicit: 1 MiB JSON input, 64 evidence/manifest
  records, 64 supplied source records, 256 KiB decoded per source, 1 MiB
  decoded source bytes total, and a 2 MiB source-bundle file. A full
  contribution must decide whether these remain fixed or become governed
  profile limits.
- Internal record and evidence digests detect accidental drift only. They are
  externally meaningful solely because their exact values are included in the
  verified owner manifest.
- The two positive vectors and signed adversarial variants prove
  increase/decrease direction, non-zero baselines, residual cents, schema and
  relational failure totality, unsupported attribution, and absent finance
  close. They do not establish multi-period correction, supersession, benefit
  retirement, or migration.

## Remaining full contribution work

This slice intentionally stops before full contribution. A maintainer-accepted
proposal and accountable GitHub maintainer are still required. Then run the
repository similarity review, complete at least three honest existing
alternatives including two current nearest matches, scaffold the catalog/source
package, decide the durable v1 schema beyond this exact falsification case, add
the contribution record and deterministic accepted/missing-evidence/
unapproved-authority regression vectors, produce the current Control UI
screenshot and X3 installed proof, update Experience metadata, regenerate
outputs, and run `npm run check`. A full v1 should also define multi-period
supersession/correction, non-financial units, allocation-method evolution,
benefit closure/retirement, and migration from existing registers without
weakening this slice's authority or no-causality boundaries. The injected test trust store and source-byte bundle must be replaced by
configured production providers and a documented signing/rotation path; the
private fixture key is not stored in the repository.
