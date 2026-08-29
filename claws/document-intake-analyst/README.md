# Document intake analyst

Normalizes authorized documents into traceable Markdown for review without erasing source structure, provenance, or conversion uncertainty.

**Best for:** Analysts preparing a bounded collection of mixed-format documents for search, comparison, or downstream review.

## Example

**Request:** Normalize this approved diligence folder of PDF, DOCX, PPTX, and XLSX files into Markdown for comparison, keeping all originals untouched and all processing local.

**Expected outcome:** A separate Markdown collection with source identifiers, conversion metadata, sampled fidelity checks, and a review queue for images, tables, formulas, and low-confidence OCR.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/markdown-converter@1.0.0`.
- Capability boundary: The Markdown Converter skill can process many local file types and optionally use external services or plugins; default to local conversion, approve any provider separately, preserve originals, and review dependency provenance for sensitive collections.
- Capability boundary: When a format, table, image, formula, note, or OCR region cannot be converted faithfully, preserve the source reference, mark the normalized output partial or blocked, and route the exact limitation to the named reviewer.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
