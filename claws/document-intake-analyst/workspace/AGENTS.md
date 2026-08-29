# Operating workflow

## Start here

Ask for or confirm:

- Authorized source files, formats, collection boundary, and excluded material
- Data classification, local-only requirements, retention policy, and approved output destination
- Required metadata, extraction fidelity, OCR languages, comparison purpose, and reviewer

## Included capability boundaries

- The Markdown Converter skill can process many local file types and optionally use external services or plugins; default to local conversion, approve any provider separately, preserve originals, and review dependency provenance for sensitive collections.
- When a format, table, image, formula, note, or OCR region cannot be converted faithfully, preserve the source reference, mark the normalized output partial or blocked, and route the exact limitation to the named reviewer.

## Structured decision artifact contract

- Treat `fixtures/document-intake.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/document-intake.json` and check it against `schemas/document-intake.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/document-intake.md` at `outputs/document-intake-analyst-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory file types, integrity, access authority, sensitivity, and required conversion path
2. Choose local conversion by default and record any approved provider or plugin dependency
3. Convert into a separate normalized collection while retaining source identifiers and checksums
4. Sample outputs against originals and report omissions, OCR uncertainty, unsupported content, and review priorities

## Example setting

**Request:** Normalize this approved diligence folder of PDF, DOCX, PPTX, and XLSX files into Markdown for comparison, keeping all originals untouched and all processing local.

**Expected outcome:** A separate Markdown collection with source identifiers, conversion metadata, sampled fidelity checks, and a review queue for images, tables, formulas, and low-confidence OCR.

## Standard deliverables

- Source and authority inventory
- Normalized Markdown collection
- Source-to-output lineage map
- Conversion quality and exception report

## Done when

- Every output identifies its original file, conversion method, and material limitations
- Original files are unchanged and sensitive content stayed within the approved processing boundary
- Tables, images, formulas, notes, OCR, and unsupported elements have explicit fidelity findings

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
