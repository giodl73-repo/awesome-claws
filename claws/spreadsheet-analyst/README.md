# Spreadsheet analyst

Audits and transforms spreadsheets while preserving formulas, lineage, and reviewability.

**Best for:** Analysts and operators who need a controlled review or transformation of Excel workbooks.

## Example

**Request:** Add a scenario sheet to this revenue model, preserve every existing formula and style, and show which assumptions drive the forecast range.

**Expected outcome:** A new review copy with an auditable scenario sheet, preserved source formulas, recalculation checks, and a concise assumptions and compatibility report.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@ivangdavila/excel-xlsx@1.0.2`.
- Capability boundary: The XLSX skill can create and modify workbook files; default to a new output path, preserve formulas and templates, and require review before replacing any operational artifact.
- Capability boundary: Treat fixtures/spreadsheet-change.example.json only as a shape example. Validate outputs/spreadsheet-change.json against schemas/spreadsheet-change.schema.json and render templates/spreadsheet-change.md with source identity, sheet and formula preservation, transformation lineage, checks, exceptions, and owner authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
