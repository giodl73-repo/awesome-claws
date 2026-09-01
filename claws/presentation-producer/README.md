# Presentation producer

Produces a template-faithful review-copy PPTX plus an exact-version evidence manifest whose canonical digests bind authority, source-use review, every material slide text item and claim, visual provenance, render, QA record, control, and human review without distributing the deck.

**Best for:** Teams turning approved analysis and human-owned decisions into a private leadership review deck that needs source, template, visual-QA, and exact-version approval proof.

## Example

**Request:** Turn the approved quarterly operating review into a 12-slide leadership deck using last quarter's template and preserve all source links in speaker notes.

**Expected outcome:** A distinct private 12-slide review-copy PPTX plus an exact-version evidence manifest with immutable input identities, source-linked claims and notes, one recorded citation-collision fix and full rerender, final text and placeholder QA, scoped human review, inherited controls, and the unresolved Q3 priority decision preserved as a blocker.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@ivangdavila/powerpoint-pptx@1.0.1`.
- Capability boundary: The PowerPoint skill may inspect and modify visible slides, speaker notes, comments, linked media, layouts, and masters. Use only the exact authorized inputs, never execute macros or resolve remote links, preserve source and template files, and write the PPTX to the distinct private review-copy path.
- Capability boundary: The PPTX is the primary deliverable. outputs/presentation-evidence-manifest.json is a sidecar for one exact deck path, digest, and version; it retains only structured extracted title/material-text evidence and must not duplicate PowerPoint object or runtime state.
- Capability boundary: Treat fixtures/presentation-evidence-manifest.example.json as an illustrative contract fixture only. The package does not include or claim to have created a real PPTX, source deck, template deck, render, or review approval.
- Capability boundary: Treat the first render as the complete observed failing pass. Render every slide, record tool and version, bind findings to exact failed renders, fix before the later full-deck rerender, and inspect overflow, clipping, contrast, placeholders, citation collisions, overlap, margins, and notes leakage.
- Capability boundary: Run exact final text extraction with per-slide title/body claim mapping and the standard PPTX plus template-derived placeholder patterns. Validate canonical template, content-QA, and approval-material digests before rendering templates/presentation-evidence-manifest.md.
- Capability boundary: Manifest asOf is the deterministic chronology boundary; do not compare illustrative artifacts with the machine clock. A missed deadline requires an exact blocker and blocked handoff, while a blocked pre-review artifact may omit approvals.
- Capability boundary: Review-copy approval is not decision or distribution authority. Put proposed owner actions only in structured records, keep unresolved work visible, and hand the private deck and manifest to the named owner without publishing, sending, uploading, or claiming delivery.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
