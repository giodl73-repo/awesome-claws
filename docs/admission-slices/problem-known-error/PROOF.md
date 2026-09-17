# Problem and known-error candidate proof

Status: hardened local deterministic proof on 2026-09-17.

## Commands and results

```text
node --test docs\admission-slices\problem-known-error\composition-adapter.test.mjs docs\admission-slices\problem-known-error\validate.test.mjs scripts\incident-state-schema.test.mjs scripts\quality-assurance-lead.test.mjs scripts\repository-compliance-program-manager.test.mjs
```

Result: **115 passed, 0 failed**. The five composition assertions validate the
real owner artifacts, three coherently substituted Incident Response artifacts,
owner projection round-trip, proposal-aware relationship comparison, namespace
resolution, and tamper rejection. The 22 candidate assertions cover the
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

Result: **27 passed, 0 failed**. The required scripts bridge executes both the
strongest-composition probe and hardened candidate suite without registering a
public artifact validator.

```text
npm run check
```

Result: **2,130 passed, 1 expected platform skip, 0 failed**. The remaining
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
- Caller trust binds unique issuer-scoped, time-bounded grants, every evidence
  record, and every source-byte digest through map-indexed lookups.
- Tests, approvals, declarations, change execution/finalization, later incident
  membership, and recurrence are strictly ordered.
- Human authority rejects agent, assistant, automation, bot, Claw, and package
  identities, including concatenated forms.
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

The follow-up review loop accepted **31 comments (9 P1, 22 P2)**. They drove
the source-derived multi-incident composition proof, complete governed-use
grant chronology, immutable digest-only resealing, receipt-finalization
ordering, resource-total validation, and the adversarial identity/narrative
cases recorded above. No review finding was rejected.

Final command:

```text
C:\src\claws-hapi\.agents\skills\autoreview\scripts\autoreview --mode local --fallback-reviewer none --output C:\src\awesome-claws-problem-slice\.tmp\autoreview-problem.txt
```

Final result:
`autoreview clean: no accepted/actionable findings reported`.
The reviewer reported **no actionable defects**, **54 focused tests** passing,
and the full repository check passing with **2,130 tests** plus all catalog
validations.
