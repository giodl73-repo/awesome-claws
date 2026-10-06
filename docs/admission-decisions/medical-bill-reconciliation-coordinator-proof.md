# Medical Bill Reconciliation Coordinator proof

## Admission

Accepted as a new Claw in [proposal #183](https://github.com/giodl73-repo/awesome-claws/issues/183).
The patient-side bill/EOB service-line and reprocessing contract is distinct
from clinical records, prospective plan enrollment, property claims, supplier
receivables, and two-export account reconciliation. The advisory report remains
`needs-distinction-review`; it does not override the recorded maintainer decision.

Current nearest matches: Rental Housing 21.5%, Home Purchase Transaction 20.9%,
Identity Theft Recovery 19.7%, Estate Administration 19.2%, Property Insurance
Claim 19.0%. The contribution record compares the first two and six additional
operational alternatives.

## Delivered scope

Base-only X3, with no new skill, plugin, MCP, cron, bootstrap, executable
workspace resource, or external action capability. Source resources include a
closed JSON schema, a synthetic 14-document/7-service-line fixture, and a patient
handoff template. Repository-side semantic validation checks complete document
and line coverage, exact associations, revision chains, comparable charges,
independent payment/posting and refund evidence, and patient-owned questions.

The initial supported matching contract is deliberately one-to-one. Ambiguous
or split associations stay unmatched for owner review. Conflicting document
lineage or duplicate source/transaction observations require a blocked intake
handoff; do not discard them merely to produce a passing structured artifact.
The validator checks supplied-document consistency, not authenticity, consent,
identity, clinical correctness, coverage, liability, or guaranteed redaction.

## Validation on 2026-10-02

- `npm run review:contribution -- --id medical-bill-reconciliation-coordinator`
- `npm run build`
- `node --test scripts/medical-bill-reconciliation-coordinator.test.mjs`: 18 passed.
- `npm run mock-plus:semantics:recipes`: 136 validators, 376 recipes, 511 finding codes.
- `npm run mock-plus -- --update`: 4 profiles, 55,766 cases, 52,889 mutants killed.
- `npm run mock-plus:profile:check`: final canonical profile matched after review fixes.
- `npm run test:regression -- --update`: reviewed addition-only contract change.
- `npm run score:catalog`
- `npm run check`: 2,417 passed, 0 failed, 1 existing Windows file-link test skipped
  (`EPERM`); all 136 packages, contribution records, generated views, and
  regression contracts validated. The 408-trial runtime check is deterministic
  mock evidence, not live model/provider evidence.
- The final mixed-history predicate follow-up also passed all 18 focused tests
  and the canonical Mock+ profile check.
- `git diff --check`: passed.

## Refresh on 2026-10-05

Refreshed against main `7d8f8448455c2d29cb8c7d630ee0388e9d685f98`.
All 145 existing catalog entries are unchanged; this branch adds only the
Medical Bill Claw and required registrations, generated outputs, and counts.
Medical source resources, semantic validator, focused tests, and screenshot
are unchanged from PR head `fec214524d912344e73843c3c6c9c1454df8a125`.

- `npm ci --ignore-scripts`: passed; lockfile unchanged. npm reported two
  existing high-severity audit findings; no dependency override was added.
- `npm run build`: passed, 146 packages and chooser views.
- Focused medical tests: 18 passed.
- Contribution review: passed with the same advisory nearest matches above.
- Semantic recipes: 146 validators, 398 recipes, 541 finding codes.
- Canonical Mock+ regeneration: 4 profiles, 59,680 cases, 56,593 mutants killed.
- Catalog score: Medical Bill 100/100; portfolio average 99.1, median 100.
  These are repository-evidence scores, not live-model quality measurements.
- Initial full check: 3,250 passed, one failed, one Windows skip. The failure
  was a stale 145-Claw count in `docs/mock-plus.md`; corrected to 146. All
  three focused documentation-count tests then passed.
- Final `npm run check`: 3,251 passed, zero failed, one existing Windows
  file-link permission skip. All downstream gates passed: public validators,
  semantic recipes, 146 packages, chooser views, quality scorecard, 438
  deterministic mock runtime trials, contribution policy, and regression
  contracts. No assertions or timeouts were weakened.
- Independent in-session manual refresh review: no actionable findings.
  Checked integration, source/package agreement, contribution consistency,
  and counts. Standalone Codex CLI remains absent from Windows PATH; this is
  not a successful CLI review or live-provider evaluation.
- `git diff --check`: passed.

The existing screenshot was visually reinspected, not recaptured. No new
live-agent or current-upstream compatibility claim is made by this refresh.

## Control UI screenshot

The [screenshot](../../screenshots/medical-bill-reconciliation-coordinator.png)
was captured on 2026-10-02 using the repository screenshot command with
`SCREENSHOT_ONLY=medical-bill-reconciliation-coordinator` and
`OPENCLAW_ROOT=C:/src/openclaw-windows-claw-lifecycle`, source revision
`917df0d36d3` (2026-09-09). It uses real Control UI rendering with a mocked
Gateway and the supplied synthetic session, not an installed live agent run
or validation of Patrick's newer Agents/Labs stack. The package name, monetary
discrepancies, missing evidence, and patient-only handoff are visible.

## Review and release boundary

Standalone `codex review --uncommitted` could not run natively because the CLI
is absent from Windows PATH. The installed WSL CLI was attempted with explicit
worktree paths and failed authentication with an expired/reused refresh token.
No login, provider, or proxy configuration was changed. Independent in-session
manual review found missing itemization and competing-link gaps, including a
mixed-history variant. All were fixed with focused regression tests; the final
scoped manual re-review reported no actionable findings. This is a manual
review result, not a successful standalone CLI review.

This local proof does not publish to ClawHub, authorize merge, establish
live-provider quality, or enable Claws by default.
