# Merchant Payout Reconciler proof

## Admission and scope

Gio approved issue #233 as a separate X3 Claw. Decision recorded at:
https://github.com/giodl73-repo/awesome-claws/issues/233#issuecomment-6007696833

Base: 3e4e8f9fa76b2a013646e0ba300a20573bba3722 (146 merged Claws).
This branch adds one Claw; all 146 existing catalog entries compare unchanged.
Admission is not merge approval. Replenishment #208 remains outside this work.

Unlike ledger-to-bank account reconciliation or invoice drafting, this Claw
reconciles processor transaction membership and signed fees to individual payout
attempts, then separately checks reviewer-mapped bank receipts. Historical
failed/returned attempts and unsettled activity cannot disappear into a total.

Fresh advisory comparison: distinct-on-declared-contract. Nearest alternatives
are Payroll Review 13.5%, Seller Returns 12.5%, Progress Billing 12.5%, Invoice
Draft 11.7%, and Benefits Realization 11.5%. These are lexical overlap measures,
not quality ratings or admission decisions. The contribution record discusses
six alternatives. Repository quality rubric: 97/100; deterministic evidence only.

## Local evidence

- Strict packaged schema and synthetic integer-minor-unit workpaper.
- Registered repository semantic validator with BigInt arithmetic and canonical
  evidence hashing; no added dependencies or packaged execution authority.
- Sixteen focused tests pass, plus three catalog-document count tests.
- Generated package resolves the exact structured artifact and Markdown handoff.
- Mock+ regeneration passes: 60,025 cases, 56,917 mutants killed, zero survivors
  or safety blockers. Digest:
  sha256:2ff5dddd727f053b69cb60bad14612250a0ed28d70a0ceed220033a76efe414b
- Final full `npm run check` passes: 3,267 tests passed, zero failed, one existing
  Windows permission skip. All downstream gates pass: 147 packages and
  contribution checks, 136 post-policy records, regression contracts, current
  quality scorecard, 401 semantic recipes and 441 deterministic mock trials.

The initial full check caught stale count assertions and a real object-key-order
hashing defect. Canonical hashing fixes the latter without relaxing the valid
control cases; a focused regression now covers reordered keys. Mock+ passes
after the fix, followed by the passing final whole-repository validation.

Coverage includes absent bank evidence, manual/instant missing membership,
unmapped receipts, failed/returned retries, amount/lineage conflicts, exact
source populations, duplicate identities, stale/cross-scope evidence, source
roles, chronology, owner mapping, signed fee refunds, unsafe arithmetic,
stale reviews, hidden discrepancies and authority escalation.

## Visual evidence and limits

Captured and visually inspected `screenshots/merchant-payout-reconciler.png`
using the real OpenClaw Control UI and the synthetic session fixture. The
workpaper shows member net USD 865.00, bank residual USD -5.00 and unsettled
USD 194.00 separately. It is a rendered fixture, not a live merchant session.

Local screenshot source: C:/src/openclaw-windows-claw-lifecycle at
917df0d36d3abc2aa4d019553246e651afd91085. That checkout has unrelated local
lifecycle changes, preserved untouched. No clean-upstream runtime, installed
merchant workflow, live-model, processor authentication or settlement proof is
claimed. CI proof and exact-head review remain required for merge.

`codex review --uncommitted` was attempted but the standalone command is absent.
Manual scoped review found and fixed unbound association evidence and reused
processor identity for bank evidence; this is not a Codex CLI review result.

Source completeness and issuer identity are owner-supplied assertions, not
authenticated by schema or digest. Ambiguous bank splits, changed retry batches
and questionable source completeness require owner clarification. No funds move,
no journal is posted, and no contact, liability, settlement or close decision is
authorized. Baseline npm audit findings remain unchanged; no dependency
overrides, binaries, publishing or default-on changes are included.
