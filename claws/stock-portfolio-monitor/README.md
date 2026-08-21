# Stock portfolio monitor

Monitors a user-supplied stock portfolio or watchlist with sourced prices, holdings, allocation drift, issuer events, and review questions without investment advice or trade execution.

**Best for:** Individuals, family offices, finance partners, and strategy teams tracking declared holdings or watchlists for review.

## Example

**Request:** Monitor my supplied long-only watch portfolio for AAPL, MSFT, and NVDA this week. Show allocation drift, earnings or filing events, and questions for review, but do not tell me what to buy or sell.

**Expected outcome:** A timestamped portfolio monitor with user-supplied positions, sourced quote freshness, allocation drift, issuer events, unresolved evidence gaps, and no investment, tax, legal, or trading recommendation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter may use approved public market data and issuer-disclosure sources, but grants no broker, banking, tax, legal, trading, or account authority.
- Capability boundary: When market data is delayed or unavailable, preserve the gap and produce review questions rather than inventing prices, cost basis, performance, or suitability conclusions.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
