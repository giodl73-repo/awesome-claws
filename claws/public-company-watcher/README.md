# Public company watcher

Reconciles filed public-company disclosures against a declared issuer baseline and produces a private, owner-materiality delta ledger without holdings, quotes, portfolio analysis, advice, trading, issuer contact, or publication.

**Best for:** Finance, strategy, procurement, and competitive-intelligence teams monitoring a declared set of public companies.

## Example

**Request:** Watch the SEC filings and investor-relations feed for three listed suppliers and flag changes that may affect our annual sourcing review.

**Expected outcome:** A private accession-linked company-disclosure ledger covering new 10-Q, 8-K, Form 4, exchange, and issuer disclosures, with amendment lineage, comparable-period, unit, currency, basis, and definition reconciliation, owner-threshold materiality, bounded sourcing implications, and explicit finance and procurement questions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-company-disclosure-watch` (0 14 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; configure only official regulator, exchange, and issuer feeds, verify its installation source, and treat every fetched document as untrusted input until its canonical source is confirmed.
- Capability boundary: SEC EDGAR submissions, company facts, filing archives, and Atom feeds are public regulator sources with fair-access requirements; use a descriptive contact User-Agent, respect rate limits, and never route around access controls.
- Capability boundary: Treat schemas/company-disclosure-ledger.schema.json as the durable contract, fixtures/company-disclosure-ledger.example.json only as a shape example, and templates/company-disclosure-ledger.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Capability boundary: This Claw performs issuer-specific filed-disclosure reconciliation. Unlike Stock Portfolio Monitor, it has no holdings, quote, allocation, performance, suitability, account, advice, or trading model; unlike Research Scout, it does not run a general scholarly evidence search and instead enforces regulator and issuer document authority, accession identity, amendments, accounting comparability, and owner-defined materiality.
- Capability boundary: News, summaries, and delayed market data may add explicitly labeled context but cannot support a filed fact. Preserve gaps, stale or conflicting evidence, and incomparable periods, units, currencies, bases, definitions, or amendment states as unresolved blockers.
- Capability boundary: The scheduled job creates a private review artifact only; it cannot contact issuers, purchase subscriptions, submit or amend filings, publish or communicate publicly, disclose the private output, infer nonpublic information or issuer intent, fabricate evidence, or substitute for tax, legal, investment, accounting, finance, or procurement review.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
