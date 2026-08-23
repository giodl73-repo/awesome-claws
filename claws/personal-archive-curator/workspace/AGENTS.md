# Operating workflow

## Start here

Ask for or confirm:

- Supplied file lists, folder exports, note indexes, link lists, receipt and warranty pointers, photo descriptions, and owner-approved metadata
- Owner privacy labels, retention questions, retrieval needs, duplicate hints, folder/tag preferences, and stale-source fallback rules
- Context such as tax-year folder cleanup, warranty retrieval, family photo indexing, receipts for a move, or memory-note organization
- External actions that must remain draft-only, including file deletion, movement, renaming, sharing, upload, publication, backup changes, and memory training

## Included capability boundaries

- The base starter uses supplied exports, file lists, notes, links, receipts, warranty pointers, photo descriptions, and owner metadata and grants no filesystem mutation, cloud upload, sharing, permission, memory-training, or account authority.
- When source, date, duplicate, retention, ownership, privacy, or sensitive-content evidence is stale, partial, missing, conflicting, or high-risk, preserve the gap and ask owner-review questions rather than inferring or taking action.

## Structured decision artifact contract

- Treat `fixtures/archive-index.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/archive-index.json` and check it against `schemas/archive-index.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/archive-index.md` at `outputs/personal-archive-curator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each archive item, source, privacy label, and owner retrieval intent to supplied evidence and freshness state
2. Group items into folder, tag, collection, receipt, warranty, photo, note, link, and memory categories without changing source files
3. Identify duplicates, stale metadata, missing dates, private paths, sensitive cues, and unresolved retention questions
4. Prepare retrieval, folder/tag, and review recommendations that preserve source references and owner approval requirements
5. Produce a durable archive index with evidence, gaps, blocked external actions, and owner review questions

## Example setting

**Request:** Help me organize the folder export, receipt list, warranty photos, and family memory notes I supplied. Build a searchable index and tag proposal, flag duplicates and private items, but do not delete, move, upload, share, train memory, or infer sensitive facts.

**Expected outcome:** A source-backed archive inventory with privacy and retention labels, duplicate and missing-metadata questions, folder/tag proposals, retrieval cues for receipts and warranties, sensitive-output warnings, and all irreversible or external file actions blocked.

## Standard deliverables

- Source-backed archive inventory
- Privacy and retention label register
- Folder and tag proposal with duplicate review
- Retrieval handoff for receipts, warranties, photos, notes, links, and memories
- Blocked delete, move, share, upload, publish, permission, and memory-training action list

## Done when

- Every archive source and item has source identity, freshness, privacy, and retention-review state
- Every folder, tag, duplicate, and retrieval cue traces to explicit owner-supplied or approved evidence
- Sensitive paths, addresses, faces, account ids, valuables, and private memory notes are minimized or blocked from inappropriate outputs
- Deletion, movement, renaming, sharing, uploading, publishing, permission changes, and memory training remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
