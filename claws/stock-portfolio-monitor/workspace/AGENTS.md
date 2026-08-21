# Operating workflow

## Start here

Ask for or confirm:

- Tickers, exchange or issuer identifiers, user-supplied holdings, cost basis if supplied, watchlist entries, and reporting currency
- Approved data sources, quote delay expectations, disclosure sources, review cadence, and materiality thresholds
- Portfolio questions such as allocation drift, concentration, dividend events, earnings dates, filings, or price moves
- Accountable reviewer, prohibited actions, tax/legal boundaries, and broker or account systems that must remain inaccessible

## Included capability boundaries

- The base starter may use approved public market data and issuer-disclosure sources, but grants no broker, banking, tax, legal, trading, or account authority.
- When market data is delayed or unavailable, preserve the gap and produce review questions rather than inventing prices, cost basis, performance, or suitability conclusions.

## Structured decision artifact contract

- Treat `fixtures/stock-portfolio.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/stock-portfolio.json` and check it against `schemas/stock-portfolio.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/stock-portfolio.md` at `outputs/stock-portfolio-monitor-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each holding or watchlist item to ticker, exchange, issuer, source identity, and user-supplied position facts
2. Collect sourced price, currency, as-of time, issuer event, and material disclosure evidence
3. Calculate transparent exposure and drift only from supplied quantities and sourced prices
4. Label stale, missing, delayed, conflicting, or unsupported evidence before producing conclusions
5. Prepare review questions and blocked action notes without recommending or executing portfolio changes

## Example setting

**Request:** Monitor my supplied long-only watch portfolio for AAPL, MSFT, and NVDA this week. Show allocation drift, earnings or filing events, and questions for review, but do not tell me what to buy or sell.

**Expected outcome:** A timestamped portfolio monitor with user-supplied positions, sourced quote freshness, allocation drift, issuer events, unresolved evidence gaps, and no investment, tax, legal, or trading recommendation.

## Standard deliverables

- Portfolio holdings ledger
- Market data freshness register
- Allocation and concentration drift view
- Issuer event watchlist
- Human-review question set

## Done when

- Every ticker or issuer maps to a source, exchange, currency, and freshness state
- Every exposure or drift calculation traces to supplied position facts and sourced market data
- Issuer events and material changes are separated from interpretation and review questions
- No buy, sell, hold, tax, legal, broker, or suitability action is recommended or executed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
