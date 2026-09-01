# Presentation evidence manifest

Render `outputs/presentation-evidence-manifest.json` without weakening its exact
deck identity, source evidence, QA history, controls, blockers, or authority
state. The PPTX remains the primary deliverable; this is its review sidecar.

## Request, audience, setting, and owners

- Preserve the request verbatim.
- State the leadership audience, classification, presentation setting, decision
  question, exact expected slide count, as-of time, deadline, named reviewer, and
  decision owner.
- Show the canonical approval-material digest and the provenance-backed human
  authority registry with exact role scopes.
- Show the private deck, manifest, and handoff paths.

## Immutable authorized inputs

- List every source document, source deck, template deck, and linked asset with
  exact path, digest, version, observation and retrieval chronology, owner,
  authority, classification, audience, license, retention, usage permission, and
  approved representation mode.
- Preserve notes, comments, hidden-content, and remote-content handling exactly.
- For each actual deck, claim, template, and visual use, show the structured
  relevance/freshness assessment: exact source identity, use, observed and
  reviewed time, dated threshold, current-through date, as-of boundary, status,
  and authorized registry reviewer. Rationale prose is not proof.

## Source, template, and review-copy identity

- Show the unchanged source and template paths, digests, and versions, plus the
  exact extracted template-inventory version and canonical digest.
- Show the distinct review-copy path, digest, version, and creation time.
- Preserve the inventory's exact 16:9 or 4:3 aspect ratio, masters, layouts,
  placeholders, theme, fonts, brand,
  notes, linked-media, macro, embedded-object, comment, hidden-content, and
  remote-link policy.
- Reject every master or layout id absent from the extracted inventory.

## Exact 12-slide inventory

- Render slides by stable id and exact order.
- For each slide show master, layout, title, purpose, extracted-content item
  references, claim references, visual asset references, citation references,
  speaker-note reference, hidden/comment state, and final render identity.
- Map the exact extracted title and every material body item to claim references,
  with canonical per-slide text digests. No material title/body content may sit
  outside this map.
- Do not reproduce PowerPoint object or runtime state. Retain only the extracted
  title/material-text items needed for claim coverage and canonical QA.

## Material claims and evidence

- Show claim kind, epistemic type, final or draft status, visible labeling,
  accountable owner, exact source version and digest, locator, structured
  source-use assessment, evidence date, source owner and authority, caveat,
  slide coverage, and approval state.
- Final factual claims require current authorized evidence. Assumptions remain
  labeled; decisions and recommendations remain human-owned.

## Citations and approved speaker notes

- Bind every material slide claim to an exact source, version, digest, locator,
  approved audience, and speaker-note record.
- Confirm source notes, hidden content, and comments were not copied.
- Show every visual's exact source locator/version and visible-only provenance,
  including audience scope and the explicit notes, comments, and hidden-content
  exclusion.

## Full-deck render and visual QA history

- The first render set must be the complete failing 12-slide render with at
  least one real observed finding; do not insert a clean pre-cycle.
- Show each full 12-slide render set, deck digest and version, render tool and
  version, render and review time, reviewer, status, per-slide render digest, all
  visual checks, and reviewer finding references.
- Bind each failed finding to its exact render, discovery time, fix time, and
  later fixed render. The fix must precede that rerender. A failed
  overflow, clipping, contrast, placeholder, citation collision, overlap, edge
  margin, or notes-leakage check blocks readiness.

## Content extraction and placeholder QA

- Show the exact final deck digest and version, extraction tool, text digest,
  canonical content-QA digest, all 12 covered slide ids and extracted-content
  maps, slide count and order checks, text and citation coverage, placeholder
  patterns and matches, notes-leakage check, reviewer, and chronology.
- Scan `xxxx`, `lorem`, `ipsum`, `this page layout`, and `this slide layout`
  plus every template-derived placeholder pattern. A custom sentinel alone does
  not satisfy this check.

## Exact-version review approval

- Show the registered human or team reviewer, exact review-copy path, digest and
  version, canonical approval-material and content-QA digests,
  complete source and claim sets, all 12 slide ids and final render ids, final
  render set, content QA, decision, and time after all evidence and QA.
- Never interpret review-copy approval as a decision, recommendation,
  distribution, publication, sending, or upload approval.

## Caveats, questions, blockers, and private handoff

- Include every caveat, unresolved claim, open question, and blocker with its
  exact targets and human owner.
- Owner actions appear only as structured proposed actions; do not exempt
  proposal-like prose from completed-action scanning.
- Include every manifest object exactly once in the handoff coverage.
- Preserve transitive classification, audience, license, and retention controls;
  the review copy and manifest must exactly equal the full slide-content source
  closure.
- Blocked pre-review artifacts may omit approvals and approval references. When
  the deadline is at or before `asOf`, record one exact open deadline blocker.
- Treat `asOf`, not the machine clock, as the deterministic chronology boundary
  for every evidence, render, QA, review, and approval event.
- Keep the manifest and handoff private, local, and not delivered, and preserve
  every prohibited action.
