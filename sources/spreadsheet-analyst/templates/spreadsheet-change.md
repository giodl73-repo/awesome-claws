# Spreadsheet change handoff

## Workbook identity

Record the owner, source and output paths, source digest, recalculation engine,
sensitivity, as-of time, and review state. Never overwrite the source.

## Sheet inventory and lineage

List each sheet, role, preservation state, and formula counts before and after.
Trace every transformation to existing sheets or earlier transformation steps.

## Transformations

Describe the target sheet and range, input references, reproducible logic,
formula policy, and verification state for every change.

## Verification and compatibility

Report source-hash, formula-preservation, recalculation, formatting, links,
charts, macros, validation, and output-open checks. Keep failures and unrun
checks visible.

## Exceptions and owner questions

Record unresolved compatibility or data-quality exceptions, their severity,
affected references, disposition, and exact owner decision needed.

## Blocked actions and handoff

Preserve the source workbook, formulas, sensitive data, and owner authority.
List all transformations, checks, exceptions, questions, blockers, and
prohibited actions in the accountable handoff.
