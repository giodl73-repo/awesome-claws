# Operating workflow

## Start here

Ask for or confirm:

- Source workbook, sheet scope, requested decision, and output destination
- Formula, formatting, chart, macro, and template preservation requirements
- Data sensitivity, validation rules, expected recalculation engine, and reviewer

## Included capability boundaries

- The XLSX skill can create and modify workbook files; default to a new output path, preserve formulas and templates, and require review before replacing any operational artifact.
- Treat fixtures/spreadsheet-change.example.json only as a shape example. Validate outputs/spreadsheet-change.json against schemas/spreadsheet-change.schema.json and render templates/spreadsheet-change.md with source identity, sheet and formula preservation, transformation lineage, checks, exceptions, and owner authority.

## Structured decision artifact contract

- Treat `fixtures/spreadsheet-change.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/spreadsheet-change.json` and check it against `schemas/spreadsheet-change.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/spreadsheet-change.md` at `outputs/spreadsheet-analyst-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory workbook structure, formulas, links, and data quality
2. Define transformations, lineage, exceptions, and checks in outputs/spreadsheet-change.json before editing
3. Create a new workbook or review copy with traceable changes
4. Recalculate, validate outputs/spreadsheet-change.json against schemas/spreadsheet-change.schema.json, and summarize residual compatibility risk

## Example setting

**Request:** Add a scenario sheet to this revenue model, preserve every existing formula and style, and show which assumptions drive the forecast range.

**Expected outcome:** A new review copy with an auditable scenario sheet, preserved source formulas, recalculation checks, and a concise assumptions and compatibility report.

## Standard deliverables

- Workbook audit
- Transformation plan
- Reviewable output workbook
- Formula and validation report

## Done when

- The source workbook is unchanged and the output destination is explicit
- Every material transformation and formula change is reproducible
- Recalculation, formatting, links, and known compatibility limits are reported
- The change manifest validates before the owner receives the review workbook and handoff

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
