# Recurring Third-Party Review Evidence Reconciler admission decision

Status: **NEW CLAW proven by a bounded candidate slice; not a catalog contribution**

Confidence: **high (0.84)**

This directory is deliberately candidate-only. It does not add or change a
catalog entry, contribution record, regression case, Experience case,
screenshot, generated Claw package, chooser entry, artifact-validator registry,
semantic-recipe registry, or any other public registry output.

## Frame

Compliance Reviewer, Contract Obligation Tracker, Procurement Evaluator,
Business Continuity Program Manager, and Supplier Capacity Assurance Manager
already work for their owner domains and remain authoritative there. The
missing shared capability is a recurring third-party review evidence ledger
that preserves an owner-declared vendor-service-by-requirement applicability
index, evidence expiry, predecessor-cycle reopening, and typed human review
decisions without interpreting requirements or making supplier decisions.

Affected operators currently join vendor/service inventories, requirement
catalogs, assurance reports, questionnaires, subprocessor disclosures,
remediation trackers, and exception records in spreadsheets. Applicability is
often reconstructed as a Cartesian product, expired reports remain attached to
previously closed cells, and an owner handoff can look complete even though the
underlying decision reopened.

The falsifiable thesis was:

> Compliance Reviewer plus Contract Obligation Tracker preserves every
> vendor-service applicability, requirement-catalog revision, evidence expiry,
> and predecessor reopening invariant without an untyped sidecar.

If that thesis is true, this candidate is redundant and must be deleted. The
executable composition test deliberately has both outcomes:

- current analogue sources produce
  `reject-compliance-plus-contract-composition`; and
- a closed, independently authenticated future analogue graph can produce
  `reject-candidate` only after its validator executes and its exact graph binds
  the validated Compliance and Contract artifact digests.

The proposed owner-first capability is:

```text
working compliance and contract owner systems
+ exact recurring service-review cell reconciliation
-> reusable expiry, reopening, and blocked-handoff evidence
```

Requirement meaning, applicability, catalog approval, vendor/service
ownership, source authenticity, remediation execution, exception approval,
risk authority, and all supplier or commercial decisions remain with their
owner systems and named humans.

### V1 boundaries

The bounded slice handles exactly one approved current review cycle, one
predecessor cycle, two vendor/service records, four owner-supplied
requirements, six explicitly declared cells, one shared subprocessor, one
expired assurance report, one reopened remediation, one externally approved
exception, and one unauthorized risk-acceptance attempt.

It performs no scoring, ranking, selection, vendor contact, contract
interpretation, certification, risk acceptance, exception approval,
onboarding, renewal, termination, purchase, or source-system mutation. The
machine result carries each of those authority claims as structural `false`.

## Audit and internal comparison

| Existing contract | Classification | Reusable seam | Irreducible gap |
| --- | --- | --- | --- |
| Compliance Reviewer | Reuse | Stable requirement/evidence/finding identity, exact snapshot binding, typed principals, independent remediation verification, and risk/certification non-claims (`sources/compliance-reviewer/schemas/control-assessment.schema.json`; `scripts/artifact-semantics.mjs:44138-44493`; `scripts/control-assessment-schema.test.mjs`). | Requirements are global to one system snapshot, not an explicit vendor-service applicability index. Evidence has collection time but no owner freshness-rule catalog or `validUntil`. There is no predecessor cycle or deterministic reopening. Its enriched validator also uses `Date.now()` at `scripts/artifact-semantics.mjs:44224`, so it cannot supply this slice's caller-controlled time invariant. |
| Contract Obligation Tracker | Reuse | Exact owner-confirmed universe, exactly one observation or blocker per obligation, typed human authority, caller-supplied `asOf`, exact coverage, content roots, and a blocked handoff (`sources/contract-obligation-tracker/schemas/contract-obligation-tracker.schema.json`; `scripts/contract-obligation-tracker.mjs:835-1120`; `scripts/contract-obligation-tracker.test.mjs`). | Its unit is an owner-interpreted executed-agreement obligation. Due state is sealed to a bounded round; there is no service-applicability cell index, evidence-kind freshness rule, predecessor review decision, or expiry-triggered reopening. Adding those records as a sidecar would be the new contract being tested rather than composition. |
| Procurement Evaluator | Avoid for core semantics | Vendor identity, attributable evidence, specialist review, and explicit no-contact/no-purchase boundaries (`sources/procurement-evaluator/`; `scripts/procurement-evaluator.test.mjs`). | It is intentionally a pre-selection weighted comparison and recommendation-range workflow. Scores, rankings, disqualifiers, and supplier selection are forbidden in this candidate. Its packaged schema does not express recurring evidence cells, catalog revisions, expiry, or predecessor reopening. |
| Business Continuity Program Manager | Adapt | Current/predecessor revision binding, transitive recertification, separately owned remediation, externally approved time-bounded exceptions, and exact blockers (`sources/business-continuity-program-manager/schemas/business-continuity-program.schema.json`; `scripts/business-continuity-program-manager.mjs:467-573`; `scripts/business-continuity-program-manager.test.mjs`). | Its authoritative universe is critical processes, BIAs, dependencies, plans, exercises, and recertifications. Recasting vendor-service requirement cells as processes would lose applicability semantics and import continuity-specific authority. |
| Supplier Capacity Assurance Manager | Adapt | Caller-supplied time, supplier/site identity, explicit source revisions, freshness windows, exclusion of stale evidence, typed checkpoints, and non-purchasing boundaries (`sources/supplier-capacity-assurance-manager/schemas/supplier-capacity-assurance.schema.json`; `scripts/supplier-capacity-assurance-manager.mjs:180-280,690-735`; `scripts/supplier-capacity-assurance-manager.test.mjs`). | Its exact partitions and freshness rules determine eligible quantities and allocation proposals. This candidate has no quantities, arithmetic, allocation, scoring, sourcing, or purchasing state. |

The strongest-composition adapter projects the exact six-cell fixture into
actual typed Compliance Reviewer and Contract Obligation Tracker fields. It
imports the official schemas, fixtures, semantic validators, validation context,
and resealer internally; caller-supplied replacements are rejected. It builds
two service-scoped Compliance assessments and one resealed six-obligation
Contract artifact, then executes both exact schemas and semantic validators
before computing graph digests. The validated graph can round-trip the six cell relationships and
catalog revision only by encoding requirement links into Contract clause fields
and inventing agreement, clause, and due-date semantics that the candidate input
does not own. It still cannot round-trip effective expiry or
predecessor-linked reopening. Because verdict eligibility now requires an
authority-safe projection, this lossy adapter cannot reject the candidate. A
strict future analogue graph round-trips all four invariants without
inventions. It can return `reject-candidate` only after the full candidate
evaluation passes with signed receipts and detached owner/predecessor
authentication, its closed schema and semantic validator pass, it binds the
exact validated Compliance and Contract graph digests, and it is signed by an
independently trusted key disjoint from every candidate key. The verdict is
therefore derived only from normalized records extracted from executed,
validated analogue graphs—not editable labels or an overriding fact sidecar.

1. owner-declared service applicability;
2. requirement catalog and cell-index revisions;
3. explicit evidence expiry rules; and
4. predecessor-decision reopening.

## External comparison

Current official sources were used as semantic comparators, not copied into the
candidate as interpreted requirements:

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20)
  provides a non-prescriptive taxonomy for governing and communicating
  cybersecurity outcomes. Useful precedent: retain an owner-controlled
  requirement catalog rather than having the reconciler invent controls.
- [NIST SP 800-161 Rev. 1](https://csrc.nist.gov/pubs/sp/800/161/r1/final)
  integrates cybersecurity supply-chain risk management into organization,
  mission/business process, and operational risk activities for products and
  services. Useful precedent: third-party evidence belongs to an ongoing
  lifecycle, not a one-time procurement score.
- The Federal Reserve's
  [SR 23-4](https://www.federalreserve.gov/supervisionreg/srletters/SR2304.htm)
  and the OCC's
  [2023-17 bulletin](https://www.occ.treas.gov/news-issuances/bulletins/2023/bulletin-2023-17.html)
  describe risk-based third-party relationship lifecycle management and
  tailoring by relationship criticality. Useful precedent: recurring
  monitoring. Negative precedent: banking guidance is not universally
  applicable and must not be interpreted by this candidate as a requirement,
  risk decision, or legal conclusion.

The slice is intentionally smaller than those governance programs. It accepts
one owner-approved catalog and cycle, reconciles only exact declared cells,
derives evidence freshness, preserves human decisions, and blocks handoff. It
does not determine third-party criticality, control effectiveness, residual
risk, contract meaning, or relationship disposition.

## Role evaluation

Four repository roles from different tension clusters produced concrete
constraints:

| Lens | Finding applied |
| --- | --- |
| Claws repo steward (H) | Keep the proof under `candidates/`; do not touch catalog, generated, Experience, contribution, or validator-registry surfaces before admission. |
| Power user (B) | One input and one exact result must replace the manual spreadsheet join. Six declared cells, derived freshness, reopening, and exact blockers are the minimum useful operator proof. |
| Compliance (C) | Catalog and cell revisions, stable human identities, complete signed input, caller time, evidence expiry, exact coverage, and structural authority non-claims must be machine-checkable. Narrative caveats are insufficient. |
| Founder/simplicity (A) | Do not create a dashboard, integration, public runtime contract, generalized policy engine, scoring layer, or workflow executor. Keep the seam removable and understandable as JSON plus one validator. |

No role finding justified a public registry change or broader runtime surface.

## Slice and proof

The candidate contains:

- `schemas/recurring-third-party-review-evidence-reconciler.schema.json`: a
  strict draft-2020-12 input contract with bounded cardinalities and no score,
  recommendation, action, or mutation field;
- `fixtures/approved-review-cycle.input.json`: the exact two-service,
  six-cell, shared-subprocessor cycle with one predecessor, one expired public
  assurance report, one open remediation, one external exception, and one
  preserved unauthorized risk-acceptance attempt; every current and predecessor
  decision binds the catalog, cell-index, freshness-rule, and immutable cell
  digests, while the predecessor, catalog, and two service applicability
  manifests carry independent signatures;
- `fixtures/public-trust.test.json`: an explicitly injected,
  bounded set of owner-and-key-scoped Ed25519 public keys with no private key or
  production trust default;
- `fixtures/source-receipts.test.json`: independently signed receipts containing
  the exact deterministic source bytes, reference, version, and SHA-256 digest
  for every evidence row;
- `schemas/public-trust.schema.json`: a closed root and signer contract that
  rejects unknown fields before trust resolution;
- `schemas/source-receipts.schema.json`: a closed receipt-manifest and source-byte
  contract;
- `schemas/strongest-composition-proof.schema.json`: the strict future-composition
  graph shape used to prove that an authority-safe complete analogue would
  delete this candidate;
- `schemas/future-analogue-validator.schema.json`: the closed declarative
  validator artifact whose canonical digest is signed into the future graph;
- `recurring-third-party-review-evidence-reconciler.mjs`: strict schema
  validation, descriptor-first rejection of proxies, symbols, accessors,
  non-enumerable state, and private-key material, bounded normalization, canonical
  catalog/cell/exception digests, independently signed owner manifests and
  predecessor artifact, signed source-byte receipt verification, full-input
  signature verification, post-close and caller-time-bounded source issuance,
  exact identity and coverage checks, deterministic freshness, predecessor
  reopening, typed-human authority validation, recursive private-key rejection,
  executed strongest-composition falsification, a pure derived result, and
  Markdown proof rendering;
- `expected/blocked-handoff.expected.json`: the accepted deterministic result
  summary;
- `expected/prohibited-score.failure.json`: the structured strict-schema
  failure for an attempted score field;
- `proof/blocked-handoff.md`: the observable X3-style proof surface; and
- `recurring-third-party-review-evidence-reconciler.test.mjs`: accepted,
  structured-failure, tamper, identity, authority, chronology, applicability,
  exact coverage, expiry/reopening, source-envelope issuance, public trust,
  hostile getters/serialization/size/depth/cardinality, source receipt bytes,
  owner-manifest omission/service reassignment, decision revision/cell binding,
  independent predecessor authentication, subprocessor, remediation, exception,
  risk-attempt, no-action, actual-analogue, authority-safe future-graph deletion,
  bounded non-echoing CLI failures, and CLI proof.

The public signature covers every result-driving field in the candidate input.
The private fixture key was discarded and is not stored. The public trust entry
is test-only; production key discovery, rotation, revocation, and source-system
authentication remain deliberately outside this slice.

Focused proof command:

```powershell
node --test `
  candidates\recurring-third-party-review-evidence-reconciler\recurring-third-party-review-evidence-reconciler.test.mjs `
  scripts\control-assessment-schema.test.mjs `
  scripts\contract-obligation-tracker.test.mjs `
  scripts\procurement-evaluator.test.mjs `
  scripts\business-continuity-program-manager.test.mjs `
  scripts\supplier-capacity-assurance-manager.test.mjs
```

Candidate-only result:

- **36 passed, 0 failed, 0 skipped**.

Candidate plus focused analogue result:

- **284 passed, 0 failed, 0 skipped**.

## Verdict

**NEW CLAW.** Compliance Reviewer plus Contract Obligation Tracker does not
preserve the service-applicability, catalog-revision, expiry, and reopening
invariants. Procurement Evaluator would add prohibited scoring/selection
semantics. Business Continuity Program Manager and Supplier Capacity Assurance
Manager provide useful lifecycle and freshness patterns but have different
authoritative universes and decisions. The strengthened source-envelope proof
also requires the program owner to sign no earlier than cycle close and no later
than caller-controlled `asOf`, while every signed evidence observation remains
bounded at or before issuance. The executed strongest-composition adapter can
round-trip service applicability and catalog revision only through an
authority-unsafe Contract reinterpretation. Neither analogue can round-trip the
effective evidence-expiry rule/state or predecessor-linked reopening. The
authority-safe future analogue control proves that a complete validated graph
can return `reject-candidate`, but only with exact source-graph bindings and
independent execution provenance.

The distinct repeatable job is:

> Reconcile one approved recurring third-party review cycle over an exact
> owner-declared vendor-service requirement-cell index, derive evidence
> freshness and predecessor reopening, preserve typed human remediation and
> exception records, and emit an exact blocked owner handoff without
> interpreting requirements or taking supplier, contract, risk, or lifecycle
> action.

## Deletion and workaround mapping

| Current workaround | Candidate replacement | Deletion gate |
| --- | --- | --- |
| Spreadsheet Cartesian product of vendors/services and requirements | Six-cell owner-declared index with independent cell revision | Delete when an owner system supplies and the Compliance + Contract composition preserves the same exact applicability index without a sidecar. |
| Copying the prior review status into the next cycle | Predecessor decisions plus deterministic evidence expiry and reopening | Delete when composition makes every expired relied-evidence transition reopen the exact predecessor cell. |
| Narrative statement that a report is "out of date" | Caller-time-derived effective expiry and an exact `evidence-expired` blocker | Delete when composition applies owner freshness rules and produces the same stable blocker without wall-clock time. |
| Separate remediation and exception spreadsheets | Typed human, exact-cell remediation and externally approved exception records | Delete when composition preserves both records, scopes, chronology, and authority without granting approval. |
| Email or note attempting to accept the gap | Preserved unauthorized attempt plus structural `riskAcceptanceClaim: false` and blocked handoff | Delete when composition records and blocks the attempt without changing the human cell decision. |
| Hand-built review summary | Deterministic signed result and Markdown proof | Delete when composition produces the same six-cell coverage, reopen state, blockers, and authority non-claims. |

The named deletion target is the entire
`candidates/recurring-third-party-review-evidence-reconciler/` directory. The
candidate should be rejected and deleted if the composition test ever returns
`reject-candidate`.

## Remaining limitations before contribution

- This is a fixed falsification slice, not a generalized vendor-risk platform:
  two vendor/services, four requirements, six cells, one predecessor, one
  subprocessor, one remediation, one exception, and at most one risk attempt.
- The proof verifies deterministic fixture bytes through an independently signed
  receipt manifest. It does not perform live retrieval, authenticate a real
  trust-center session, validate assurance-report substance, or prove external
  source truth. A full contribution must define production receipt issuance,
  retrieval failure, key rotation/revocation, and unavailable-source behavior.
- The strongest current analogue mapping is intentionally proof-only: it must
  invent executed-agreement, clause, and due-date facts to populate Contract
  Obligation Tracker. Those fields make the projection authority-unsafe and
  cannot be shipped as an interpretation of the owner inputs.
- Requirement statements and applicability declarations are opaque
  owner-controlled inputs. The candidate does not map frameworks, interpret
  contracts, assess control effectiveness, score risk, or determine whether
  an exception or remediation is substantively adequate.
- The slice derives freshness at caller `asOf`; it does not schedule the next
  review, contact a vendor, create a ticket, update a register, or mutate any
  owner system.
- A full contribution still requires maintainer acceptance, accountable
  GitHub maintenance, the current similarity review, honest nearest
  alternatives, contribution and regression records, current Control UI
  proof, generated package surfaces, and public-registry validation.
