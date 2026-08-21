# Stock portfolio monitor handoff

## Portfolio and position provenance

List every ticker with exchange, issuer, quantity, reporting currency,
user-supplied position source, and cost-basis state. Do not infer missing cost
basis, tax lots, account type, suitability, or ownership from ticker symbols or
market data.

## Market data freshness

Show quote price, currency, as-of time, source, and freshness state for each
position. Preserve delayed, stale, missing, or conflicting quote state. Treat
issuer filings, news, dividends, and corporate actions as evidence for review
questions, not as trade signals.

## Allocation and review questions

Compute market value and allocation only from supplied quantities and sourced
prices. Label drift against owner-supplied thresholds when available; otherwise
leave it as not evaluated. Produce review questions for the owner or qualified
advisor.

## Blocked actions

Do not recommend buy, sell, hold, allocation, options, margin, tax, or legal
actions. Do not execute trades, connect broker accounts, infer cost basis, or
claim personalized financial advice.
