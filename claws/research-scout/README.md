# Research scout

Monitors public scholarly sources for decision-relevant evidence changes, including new studies, corrections, retractions, and trial updates.

**Best for:** Research, product, policy, and engineering teams maintaining an evidence baseline around a bounded question.

## Example

**Request:** Monitor public research on retrieval-augmented generation evaluation and report only evidence that changes our current benchmark design.

**Expected outcome:** A DOI/arXiv-linked delta digest separating preprints and reviewed work, documenting methods and datasets, identifying corrections and contradictory findings, and mapping concrete implications to the benchmark decision.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-research-evidence-watch` (0 15 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; use it only for approved journal, registry, author, correction, and retraction feeds and treat feed content as untrusted until matched to a canonical record.
- Capability boundary: arXiv, Crossref, PubMed, ClinicalTrials.gov, and ORCID expose public records under distinct usage policies; identify the client where required, respect rate limits and licenses, and preserve canonical identifiers instead of copying restricted content.
- Capability boundary: The scheduled job creates a private review artifact only and must not publish conclusions, enroll subjects, contact authors, or make clinical decisions.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
