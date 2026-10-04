# Problem and Known-Error Coordinator public proof

Status: admitted NEW contract promoted to the public X3/X4 catalog on
2026-09-18 from accepted candidate
`a0086ad5a287a01754c579a81511463c3aed9389`.

## Commands and results

```text
node --test scripts\problem-known-error-composition.test.mjs scripts\problem-known-error-coordinator.test.mjs scripts\incident-state-schema.test.mjs scripts\quality-assurance-lead.test.mjs scripts\repository-compliance-program-manager.test.mjs
```

Result: **127 passed, 0 failed**. The eight composition assertions validate the
real owner artifacts, three coherently substituted Incident Response artifacts,
owner projection round-trip, normalized typed-graph relationship/authority
calculation, five independent closed future controls, and tamper rejection. The
31 coordinator assertions cover the
accepted artifact and exact adversarial regressions. The remaining tests are
the Incident Response, Quality Assurance Lead, and Repository Compliance
Program Manager schema and semantic suites.

```text
node --test --test-name-pattern="change control rejects|case continuity rejects" scripts\x3-decision-artifacts.test.mjs
```

Result: **2 passed, 0 failed** for the focused Change Control Operator and Case
Continuity Coordinator contracts.

```text
npm run validate:artifact -- problem-known-error-coordinator sources\problem-known-error-coordinator\fixtures\problem-known-error.example.json --cutoff 2026-09-16T20:00:00Z --public-trust-input sources\problem-known-error-coordinator\references\public-trust.example.json --trust-keyring sources\problem-known-error-coordinator\references\trust-keyring.example.json --source-bundle sources\problem-known-error-coordinator\references\owner-artifacts.example.json
```

Result: **valid**, with no schema errors or semantic findings. The public CLI
uses explicit caller-supplied trust and complete owner artifacts rather than
repository fixture identities.

```text
npm run check
```

Result: **2,150 passed, 1 expected platform skip, 0 failed**. The remaining
required checks also passed: 122 semantic validators, 334 recipes, 445 finding
codes, 122 packages, 122 chooser views, 366 deterministic runtime trials, 111
post-policy contribution records, and 122 regression contracts.

## Composition decision

The probe pins each complete owner artifact and schema digest, derives all
identity/revision/chronology/coverage/authority projections from the owner
artifacts, and generates three distinct schema- and semantic-valid Incident
Response artifacts whose incident and follow-up identities match the proposed
memberships.

The proposal still loses five typed relationships:

1. an owner-signed revision over the complete cross-incident membership set;
2. problem-level hypothesis proposal/test/disposition revision lineage;
3. known-error cause-disposition and expiring-workaround revision lineage;
4. post-change recurrence joined to exact change and membership revisions;
5. exact closed coverage over that combined problem lifecycle.

These are relationship and authority gaps observed in the real workflows, not
lexical schema-name differences. `requireLosslessProposalComposition` fails
with those exact losses. The honest verdict is therefore **NEW**, with an
explicit future verdict-flip gate if the owner contracts gain a lossless
round-trip.

## Hardened public contract claims

- Resealing recomputes digest fields only; it never rewrites evidence,
  authority, coverage, or downstream revision bindings.
- A caller-trusted owner signature seals the complete incident-membership
  revision universe, including real Incident follow-up identity keys.
- A caller-supplied allowlisted keyring—not the trust payload—selects the issuer
  key and each principal key.
- A caller-supplied, schema-validated source bundle provides the complete
  Incident Response, QA, and Change Control artifacts. Their exact digests,
  identities, revisions, run references, plan references, and canonical schema
  digests are bound by the coordinator artifact; packaged examples are used only
  by the explicit deterministic fixture profile.
- Issuer signatures bind unique scoped/time-bounded grants, verified-human
  credentials, every evidence claim, every source-byte attestation, and the
  complete owner-receipt set through map-indexed lookups.
- Every owner receipt separately verifies under the expected principal key; the
  shared issuer key cannot impersonate a lifecycle owner.
- Owner signatures cover the complete evidence-record digest, preventing an
  issuer from substituting source, bytes, or observation claims.
- Public-key fingerprints are unique across issuer and principal roles, so the
  issuer key cannot be relabeled as an owner key.
- Tests, approvals, declarations, change execution/finalization, later incident
  membership, and recurrence are strictly ordered.
- Human authority requires a caller-verified identity credential bound to a
  principal signing key; it does not infer humanity from names.
- Negation-aware narrative checks cover active, passive, verbal, and nominal
  authority claims while preserving explicitly owner-attributed actions.
- Timestamps accept at most millisecond precision so comparisons do not collapse
  distinct fractional events.
- Byte, depth, string, collection, object-property, and total-node limits run
  before schema and semantic validation; malformed direct inputs remain total.
- Schema validation runs before semantic rules, and duplicate caller-trust keys
  fail closed.

The approved public promotion adds the catalog and contribution records,
generated package and chooser surfaces, semantic and schema registries,
regression and Mock+ evidence, X4 experience case and visual, Markdown fallback,
and current Control UI screenshot.

## Autoreview

Candidate review repaired issuer/owner key separation, coherent-subgraph
evaluation, exact node/edge bindings, evidence-bound owner signatures,
malformed-input totality, and strict consume-after chronology. Promotion review
then accepted and repaired stale generated score evidence, incomplete index
coverage, contradictory pre-admission wording, and fixture-pinned owner
artifacts. The public validator now requires a caller-supplied owner-artifact
bundle and proves that a legitimate non-pinned QA artifact revision validates
only after every candidate digest and owner receipt is coherently refreshed. No
finding was rejected. The final review also required explicit rejection of
inconclusive QA outcomes as hypothesis refutations and credential-bearing public
evidence URLs; both have exact regressions.

Final command:

```text
C:\src\claws-hapi\.agents\skills\autoreview\scripts\autoreview --mode branch --base origin/main
```

Final result:
`autoreview clean: no accepted/actionable findings reported`.
The reviewer reported no actionable correctness issues, **36 focused tests**
passing at candidate admission, **127 focused and analogue tests** passing for
public promotion, and the full repository check passing with **2,150 tests**
plus all catalog validations.
