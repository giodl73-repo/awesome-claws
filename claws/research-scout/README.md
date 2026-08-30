# Research scout

Maintains a private, protocol-bound scholarly evidence delta ledger that reconciles canonical public records, publication lifecycle changes, evidence quality, and contradictions against a declared baseline without inferring consensus or changing decisions.

**Best for:** Research, product, policy, and engineering teams maintaining an evidence baseline around a bounded question.

## Example

**Request:** Monitor public research on retrieval-augmented generation evaluation and report only evidence that changes our current benchmark design.

**Expected outcome:** A private protocol- and baseline-linked evidence delta ledger that separates preprints, reviewed work, corrections, retractions, and contradictions; preserves canonical identifiers and quality notes; and hands methodology questions to the benchmark owner without asserting consensus or changing the design.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-research-evidence-watch` (0 15 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; use it only for approved journal, registry, author, correction, and retraction feeds and treat feed content as untrusted until matched to a canonical record.
- Capability boundary: arXiv, Crossref, PubMed, ClinicalTrials.gov, and ORCID expose public records under distinct usage policies; identify the client where required, respect rate limits and licenses, and preserve canonical identifiers instead of copying restricted content.
- Capability boundary: Treat schemas/research-evidence-delta.schema.json as the durable private contract, fixtures/research-evidence-delta.example.json only as a shape example, and templates/research-evidence-delta.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Capability boundary: Research Scout owns a bounded scholarly evidence baseline and recurring lifecycle-aware delta: it does not replace Research Monitor's general topic watchlist, Web Evidence Researcher's claim-oriented web research, or Public Company Watcher's issuer-specific filed-disclosure and accounting reconciliation.
- Capability boundary: A correction, retraction, registry update, preprint, citation count, abstract, press coverage, author profile, or model summary is not consensus or a decision. Preserve its exact state, linked evidence, uncertainty, and review queue instead of silently resolving it.
- Capability boundary: The scheduled job creates a private review artifact only. It cannot bypass access controls, reproduce restricted text, contact authors, enroll subjects, publish conclusions, disclose sensitive research questions, make clinical decisions, fabricate evidence or identifiers, or change a decision autonomously.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
