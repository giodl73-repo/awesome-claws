# Operating workflow

## Start here

Ask for or confirm:

- One bounded request, leadership audience, decision and presentation setting, exact expected slide count, deadline, deterministic as-of boundary, provenance-backed human authority registry, exact effective classification, audience, licenses, retention, and private output paths
- Immutable authorized source documents, source and template decks, linked assets, exact locators, digests and versions, observation and retrieval chronology, owners, authorities, usage permissions, hidden-content handling, approved representation modes, and structured use-bound relevance/freshness assessments
- Exact extracted template inventory digest and version plus preservation requirements for the proven 16:9 or 4:3 aspect ratio, masters, layouts, placeholders, theme, fonts, brand, notes, linked media, macros, embedded objects, comments, hidden content, and remote links
- Per-slide extracted titles and material body items, canonical text digests, claim mappings, epistemic types, caveats, visual provenance, citations, speaker-note policy, and human approval state
- Complete failing first render, later fixed full-deck render, text-extraction and standard plus template placeholder scan configuration, canonical QA and approval digests, structured proposed owner actions, exact deadline and decision blockers, and private handoff owner

## Included capability boundaries

- The PowerPoint skill may inspect and modify visible slides, speaker notes, comments, linked media, layouts, and masters. Use only the exact authorized inputs, never execute macros or resolve remote links, preserve source and template files, and write the PPTX to the distinct private review-copy path.
- The PPTX is the primary deliverable. outputs/presentation-evidence-manifest.json is a sidecar for one exact deck path, digest, and version; it retains only structured extracted title/material-text evidence and must not duplicate PowerPoint object or runtime state.
- Treat fixtures/presentation-evidence-manifest.example.json as an illustrative contract fixture only. The package does not include or claim to have created a real PPTX, source deck, template deck, render, or review approval.
- Treat the first render as the complete observed failing pass. Render every slide, record tool and version, bind findings to exact failed renders, fix before the later full-deck rerender, and inspect overflow, clipping, contrast, placeholders, citation collisions, overlap, margins, and notes leakage.
- Run exact final text extraction with per-slide title/body claim mapping and the standard PPTX plus template-derived placeholder patterns. Validate canonical template, content-QA, and approval-material digests before rendering templates/presentation-evidence-manifest.md.
- Manifest asOf is the deterministic chronology boundary; do not compare illustrative artifacts with the machine clock. A missed deadline requires an exact blocker and blocked handoff, while a blocked pre-review artifact may omit approvals.
- Review-copy approval is not decision or distribution authority. Put proposed owner actions only in structured records, keep unresolved work visible, and hand the private deck and manifest to the named owner without publishing, sending, uploading, or claiming delivery.

## Structured decision artifact contract

- Treat `fixtures/presentation-evidence-manifest.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/presentation-evidence-manifest.json` and check it against `schemas/presentation-evidence-manifest.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/presentation-evidence-manifest.md` at `outputs/presentation-producer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Freeze the request, provenance-backed authority registry, exact deck-content control closure, private destinations, immutable input identities, and deterministic as-of boundary
2. Record use-bound human relevance/freshness assessments and the exact extracted template inventory before mapping every material title/body claim to authorized source evidence, caveats, visuals, citations, and audience-safe speaker notes
3. Create a distinct review-copy PPTX with the inventory-proven aspect ratio, masters, layouts, placeholders, theme, fonts, brand, notes, media, macro, embedded-object, comment, hidden-content, and remote-link handling
4. Make the first render a complete observed failing full-deck pass, bind each finding to its exact failed render, record the fix before a later complete rerender, and inspect overflow, clipping, contrast, placeholders, citation collisions, overlap, margins, and notes leakage
5. Extract final deck text into per-slide content-claim mappings, verify canonical text digests, exact slide count and order, claim and citation coverage, and standard plus template-derived placeholder and notes-leakage scans
6. Record only registered human or team review after all evidence and QA chronology, with canonical digests binding the exact deck identity and all approval material
7. Validate outputs/presentation-evidence-manifest.json, keep blocked pre-review approval references empty when appropriate, represent owner actions structurally, turn missed deadlines into exact blockers, and prepare a private not-delivered handoff

## Example setting

**Request:** Turn the approved quarterly operating review into a 12-slide leadership deck using last quarter's template and preserve all source links in speaker notes.

**Expected outcome:** A distinct private 12-slide review-copy PPTX plus an exact-version evidence manifest with immutable input identities, source-linked claims and notes, one recorded citation-collision fix and full rerender, final text and placeholder QA, scoped human review, inherited controls, and the unresolved Q3 priority decision preserved as a blocker.

## Standard deliverables

- Primary template-faithful review-copy PPTX
- Exact-version presentation evidence manifest
- 12-slide claim, visual, citation, and speaker-note inventory
- Full-deck render, visual finding, fix, rerender, and content-QA record
- Canonical exact-version human review approval plus structured proposed owner action, unresolved claim, caveat, question, and blocker registers
- Complete private not-delivered owner handoff

## Done when

- The source and template deck paths, digests, and versions remain unchanged, the output is a distinct private review copy, and the exact preservation contract is satisfied
- Exactly 12 stable ordered slide records cover every extracted title/material body item and claim, source-located visual, citation, speaker note, hidden/comment state, and final render identity bidirectionally
- Every actual source use has a dated, use-bound, registered-human relevance/freshness assessment; assumptions and inferences stay visibly labeled, and decisions and recommendations remain with the named decision owner
- The first complete full-deck render records a real failure, its fix precedes a later complete rerender, final visual and canonical content QA pass, and standard plus template placeholder, collision, clipping, overflow, and notes-leakage checks remain clean
- Any review approval is registered-human owned, follows all evidence and QA, and its canonical digest binds the exact deck identity, complete material content, final render records, content-QA digest/configuration, citations, notes, visuals, controls, and handoff
- The manifest validates against schemas/presentation-evidence-manifest.schema.json, template masters/layouts resolve to the exact inventory, review-copy and manifest controls exactly match actual deck-content closure, blockers/readiness are exact, and the private handoff remains not delivered

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
