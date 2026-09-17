# Problem and known-error candidate proof

Status: hardened local deterministic proof on 2026-09-17.

## Commands and results

```text
node --test docs\admission-slices\problem-known-error\composition-adapter.test.mjs docs\admission-slices\problem-known-error\validate.test.mjs scripts\incident-state-schema.test.mjs scripts\quality-assurance-lead.test.mjs scripts\repository-compliance-program-manager.test.mjs
```

Result: **123 passed, 0 failed**. The eight composition assertions validate the
real owner artifacts, three coherently substituted Incident Response artifacts,
owner projection round-trip, normalized typed-graph relationship/authority
calculation, five independent closed future controls, and tamper rejection. The
27 candidate assertions cover the
accepted artifact and exact adversarial regressions. The remaining tests are
the Incident Response, Quality Assurance Lead, and Repository Compliance
Program Manager schema and semantic suites.

```text
node --test --test-name-pattern="change control rejects|case continuity rejects" scripts\x3-decision-artifacts.test.mjs
```

Result: **2 passed, 0 failed** for the focused Change Control Operator and Case
Continuity Coordinator contracts.

```text
node --test scripts\problem-known-error-admission-slice.test.mjs
```

Result: **35 passed, 0 failed**. The required scripts bridge executes both the
strongest-composition probe and hardened candidate suite without registering a
public artifact validator.

```text
npm run check
```

Result: **2,138 passed, 1 expected platform skip, 0 failed**. The remaining
required checks also passed: 121 semantic validators, 331 recipes, 435 finding
codes, 121 packages, 121 chooser views, 363 deterministic runtime trials, 110
post-policy contribution records, and 121 regression contracts.

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

## Hardened candidate claims

- Resealing recomputes digest fields only; it never rewrites evidence,
  authority, coverage, or downstream revision bindings.
- A caller-trusted owner signature seals the complete incident-membership
  revision universe, including real Incident follow-up identity keys.
- A caller-supplied allowlisted keyring—not the trust payload—selects the issuer
  key and each principal key.
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

No public registry or generated catalog surface is changed.

## Autoreview

The fresh trust-boundary review accepted two P1 findings: issuer signatures
could impersonate an owner receipt, and the trust payload could declare its own
verification key. Both are fixed with exact adversarial regressions. The
follow-up Autoreview loop also tightened coherent-subgraph evaluation, exact
candidate node/edge bindings, owner-artifact validation, evidence-bound owner
signatures, key-material separation, malformed-input totality, and signed
control attribution. No finding was rejected.

Final command:

```text
C:\src\claws-hapi\.agents\skills\autoreview\scripts\autoreview --mode local --fallback-reviewer claude --output C:\src\awesome-claws-problem-slice\.tmp\autoreview-problem.txt
```

Final result:
`autoreview clean: no accepted/actionable findings reported`.
The reviewer reported no actionable correctness issues, **35 focused tests**
passing, and the full repository check passing with **2,138 tests** plus all
catalog validations.
