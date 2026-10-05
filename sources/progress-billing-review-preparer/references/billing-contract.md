# Progress billing review contract

One owner-confirmed contract and currency, one current application revision,
up to 120 contiguous periods and 200 records per collection. This is an original
private review draft and owner workpaper, not an AIA form, certification,
invoice, legal opinion or accounting entry. No integrations or execution tools
are granted by this X3 package. Repository validators are deterministic tests.

Use `schemas/progress-billing-input.schema.json` for intake and
`schemas/progress-billing.schema.json` for the report containing the complete
input, derived result and unchanged authority object. Required information may
not be invented to satisfy the schema. Invalid structure stops calculation;
unresolved evidence produces a blocked report with no derived line or total
amounts. Empty collections require the owner's coverage declaration. Use only
approved aliases and a private destination.

## Evidence and history

Every record identifies its source, exact revision and native identity. Sources
must be current, owner-approved, contract-matching and captured by the as-of
instant. Owner coverage seals the complete line and lot universe, all changes,
application/certificate history, separate cash, checklist, rules and duplicate
coverage review. Missing or disputed declarations block. A copied native record
with a new local id is not new evidence. Historical records remain in the current
owner-confirmed archive; current archive revision is distinct from historical
application revision. No source authenticity is inferred from a digest.

Native identities must be globally unique within the pack; namespace original
system ids before intake. Source aliases do not create independent native records.
Dates use Gregorian UTC calendar days. The inclusive period-end date may be the
as-of UTC day (a partial final-day snapshot), but may not start after the as-of
instant. Offset timestamps are compared as instants. Source evidence must be
captured by that instant. No local-calendar or business-day interpretation is
supported. The currency is an owner-supplied three-letter code with explicit
0-4 decimal digits; this package does not look up or infer currency precision.

All periods from inception through the current period must be contiguous. Each
prior period has exactly one application snapshot and one effective certificate
per current line, including explicit zero rows before a line first earns value.
Opening installed/stored values match the immediately prior application, not
cash or a certificate. First-period openings must be zero. A corrected application
requires a reconciled current history pack and new review; unresolved prior
corrections block. Do not silently choose between duplicate application versions.

Certificates declare one mode for the entire pack:

- `cumulative-snapshot`: use only the effective immediately prior-period
  cumulative amount. Earlier snapshots remain visible and are never summed.
- `period-certification`: sum one effective certificate per prior period.

Mixed modes are unsupported. A replacement explicitly references `supersedes`,
stays on the same line and period and has `replacementApprovalRef`. Preserve
both original and replacement. No branches, cycles, orphan replacements or
unresolved corrections are permitted. Never select the smaller amount merely
because it produces a larger current draft. Multiple revised copies of the same
native certificate identity are unsupported: obtain distinct owner-issued
correction identities and explicit supersession or keep the draft blocked.
For cumulative snapshots, only replacement of the immediately prior snapshot is
supported. Replacement of an earlier snapshot blocks even if marked resolved;
this package does not propagate earlier corrections through later snapshots.
`correctionResolved` means the owner has reconciled the correction and all affected
downstream application/certification history through the latest snapshot, not
merely acknowledged a correction. Period-certificate replacements may affect
earlier periods because their effective amounts are explicitly summed, but still
require that complete owner reconciliation declaration.

## Conservation and exact arithmetic

Amounts are decimal strings; input money must already fit the supplied 0-4
currency digits. Do not use binary floating point or silently round input money.
Installed opening + authorized new work + stored transfers + signed adjustments
= installed closing. Every positive stored transfer matches exactly one installed
transfer record on the same line, with the same amount, and is used once.
Lot opening + additions - transfers - removals = closing. Lots reconcile to
line-level stored opening and closing. Nonnegative lot balances, source-linked
movement records, owner-supplied eligibility and no-duplicate-coverage declarations
are mandatory; these assertions are not engineering or legal determinations.

Scheduled value = base + approved changes. Keep pending and rejected changes in
the workpaper and exclude them from scheduled value. Installed plus stored may
not exceed approved scheduled value. Supply line-specific worked and stored
rates between zero and one and a source-bound rule reference. Compute each
component separately, rounded to the currency digits using exactly the owner's
`half-up-per-component` or `half-even-per-component` instruction. Other rounding,
tax, retainage release, statutory deductions, currency conversion, formula caps,
and eligibility rules are unsupported: obtain a reconciled supported rule pack
or keep the draft blocked. Do not infer exemptions or choose a rounding policy.

Cumulative entitlement = installed + stored - rounded worked retainage - rounded
stored retainage. Current draft = cumulative entitlement - prior certified.
Previously certified unpaid = prior certified - separately supplied cumulative
cash. Never subtract cash to calculate current entitlement. Preserve negative
unpaid balances and signed adjustments; never clamp to zero. Negative current
drafts or installed corrections require explicit line adjustment authority.
Every cash row must have an owner-confirmed `applied-to-prior-certificates` basis,
an exact `applicationRef`, `throughPeriod` equal to the immediately prior period,
and an application/receipt timestamp no later than the as-of instant or source
capture. Advances, ambiguous application, absent owner confirmation and future
cash block the report. This validates supplied attribution; it does not allocate
receipts, infer payment application or change accounting. Signed owner-attributed
cash reversals remain visible; raw bank receipts are not attribution evidence.

## Private handoff and re-review

Produce `outputs/progress-billing-review.json`, an original private application
at `outputs/progress-billing-application.md`, and the full owner workpaper at
`outputs/progress-billing-review-preparer-handoff.md`. The latter includes all
source identities/revisions, complete retained history, lot movements, rules,
change states, cash, supplied checklist, blockers and owner next steps. Checklist
revisions must match supplied, current and permitted revisions. Missing documents
or disclosure permission block; do not determine legal document sufficiency.
`attachments[]` is the owner's sealed complete required checklist, including
missing items with `suppliedRevision: null`. `checklistComplete` attests that this
list is complete; there is no independently discovered checklist universe. An
empty list is supported only when the owner explicitly confirms no attachments
are required. The validator detects missing/stale evidence for listed items;
it cannot detect an omitted requirement hidden behind an incorrect declaration.

The result digest is SHA-256 over UTF-8 JSON of the entire input, recursively
sorting object keys while retaining array order, with no whitespace. Every
input change invalidates the result and requires recalculation and fresh review.
No reviewer decision is implied by `ready-for-owner-review`. All authority fields
remain `not-performed`; do not certify, submit, sign, waive, issue or post.

The packaged fixtures are synthetic examples as of 2026-10-05, not real project
evidence, screenshots, live-provider proof or owner approval.
