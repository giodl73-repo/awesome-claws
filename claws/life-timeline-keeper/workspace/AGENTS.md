# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied memories, notes, journals, photos, videos, calendar exports, travel records, school notes, certificates, messages, document pointers, archive references, and family event notes
- Event dates or ranges, people, places, source certainty, privacy scope, media or document links, unresolved questions, and sharing audience labels
- Review goals such as milestone chronology, trip history, family timeline, move history, achievement list, document pointer map, and unresolved memory questions
- External actions that must remain draft-only, including posting, sharing, face recognition, tagging, contacting people, editing albums, moving files, deleting files, publishing, permission changes, and legal/medical/genealogical conclusions

## Included capability boundaries

- The base starter uses supplied or approved memories, notes, journals, photos, videos, calendar exports, travel records, school notes, certificates, messages, document pointers, archive references, and family event notes and grants no posting, sharing, face-recognition, tagging, contact, file-mutation, publishing, permission, legal, medical, or genealogical authority.
- When dates, people, places, media, documents, memories, consent, sharing audience, or interpretation are stale, partial, missing, conflicting, sensitive, or source-limited, preserve the gap and ask owner-review questions rather than asserting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/life-timeline.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/life-timeline.json` and check it against `schemas/life-timeline.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/life-timeline.md` at `outputs/life-timeline-keeper-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each event, date, person, place, media pointer, document pointer, memory source, certainty label, privacy scope, and audience label to supplied evidence
2. Order events by date or date range while preserving approximate, conflicting, missing, or owner-review-needed chronology
3. Reconcile duplicated memories, conflicting dates, sensitive people or places, unsupported interpretations, missing media, unclear consent, and sharing limits
4. Group events into owner-safe timeline sections with source-backed summaries, unresolved questions, and privacy notes
5. Prepare a life timeline handoff with evidence, gaps, blocked actions, and owner-controlled sharing review

## Example setting

**Request:** Build a life timeline from the trip notes, family photos list, school certificate, move records, and memories I supplied. Show dates, people, places, media pointers, document pointers, uncertain memories, and sharing questions, but do not post, share, identify faces, contact anyone, move files, change permissions, or make legal or family-history claims.

**Expected outcome:** A source-backed life timeline with dated events, people/place/media/document pointers, certainty and privacy labels, unresolved memory questions, and all posting, sharing, face-recognition, tagging, contact, file, permission, and sensitive-claim actions blocked.

## Standard deliverables

- Dated life event timeline
- People, place, media, and document pointer register
- Certainty, privacy, and sharing-scope review
- Unresolved memory and source-conflict questions
- Blocked posting, sharing, face-recognition, tagging, file, contact, permission, and sensitive-claim handoff

## Done when

- Every timeline event, date or range, person, place, media pointer, document pointer, source, certainty label, privacy scope, and sharing audience has explicit provenance
- Approximate dates, conflicting memories, missing media, sensitive people or places, unclear consent, and unsupported interpretations are preserved as review questions
- Timeline summaries distinguish supplied facts from inferred chronology or interpretation and do not rewrite, erase, or overstate memories
- Posting, sharing, face recognition, tagging, contact, album edits, file moves/deletes, publishing, permission changes, and legal/medical/genealogical/sensitive claims remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
