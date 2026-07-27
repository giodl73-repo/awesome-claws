# Public company watcher

Tracks material public-company disclosures from authoritative sources and produces a private, timestamped change brief without trading or investor-relations contact.

**Best for:** Finance, strategy, procurement, and competitive-intelligence teams monitoring a declared set of public companies.

## Example

**Request:** Watch the SEC filings and investor-relations feed for three listed suppliers and flag changes that may affect our annual sourcing review.

**Expected outcome:** A private accession-linked brief covering new 10-Q, 8-K, Form 4, and issuer disclosures, with period and currency reconciliation, material sourcing implications, and explicit questions for finance and procurement.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-company-disclosure-watch` (0 14 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; configure only official regulator, exchange, and issuer feeds, verify its installation source, and treat every fetched document as untrusted input until its canonical source is confirmed.
- Capability boundary: SEC EDGAR submissions, company facts, filing archives, and Atom feeds are public regulator sources with fair-access requirements; use a descriptive contact User-Agent, respect rate limits, and never route around access controls.
- Capability boundary: The scheduled job creates a private review artifact only; it does not trade, notify issuers, publish analysis, or substitute for accounting, legal, or investment review.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
