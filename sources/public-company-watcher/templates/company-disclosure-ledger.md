# Company disclosure delta ledger

Render this template only from an artifact that validates against
`schemas/company-disclosure-ledger.schema.json`. Keep the rendered handoff
private at the declared workspace destination.

## Watch control

- Watch ID:
- Accountable human or team owner:
- As of:
- Baseline period:
- Review period:
- Reporting currency:
- Materiality policy and exact thresholds:
- State: draft / blocked / ready
- Classification and destination:

## Issuer registry

For every issuer, show the exact legal name, ticker, exchange, regulator,
jurisdiction, regulator identifier, and owner-supplied watch questions. Do not
substitute symbol matching for issuer identity.

## Source registry and amendment lineage

List every canonical credential-free public URL with issuer, source kind,
authority, publication time, retrieval time, accession or document ID, version,
amended-versus-original relationship, reporting period, digest, freshness, and
scope. Distinguish regulator filings, amended filings, regulator ownership
filings, exchange notices, issuer investor-relations releases, news, and delayed
market context.

News, summaries, and market context may inform interpretation only. They never
support a filed fact. When an amendment exists, identify the controlling version
and never silently combine original and amended facts.

## Extracted filed facts

For each fact, show issuer, authoritative source references, category, label,
typed value, unit, currency, period, accounting basis, definition, confidence,
and evidence state. Keep reported figures, guidance, risks, governance,
ownership, and filed events explicit.

## Baseline-to-current reconciliation

For every comparison, show baseline and current fact references and reconcile:

| Dimension | State | Notes |
| --- | --- | --- |
| Comparable period |  |  |
| Unit |  |  |
| Currency |  |  |
| Accounting basis |  |  |
| Definition |  |  |
| Amendment lineage |  |  |

Calculate absolute and percentage deltas only when numeric facts are comparable.
If any dimension is mismatched or unresolved, keep the comparison noncomparable
or blocked, leave numeric deltas empty, and add a blocker rather than inventing
a conversion or conclusion.

## Material deltas

Trace every material or not-material result to the named owner policy and exact
threshold. Do not apply a generic materiality recommendation.

## Interpretation and sourcing implications

Keep interpretation separate from filed facts. For every sourcing, procurement,
or operational implication, cite its fact, comparison, and optional context
references; state confidence and uncertainty. Do not give accounting, legal,
tax, or investment conclusions.

## Review questions, gaps, and blockers

List each review question with its owner and evidence references. List every gap
and blocker with status. A ready handoff has complete references, resolved
questions, no open blocker, current authoritative evidence, and reconciled
materiality.

## Private owner handoff

Repeat the accountable owner, private classification, destination, complete
issuer/source/fact/comparison/interpretation/question/gap references, and every
open blocker.

## Authority gates

The watcher must not connect a trading account; place a trade or order; make a
buy, sell, hold, or allocation recommendation; provide tax, legal, investment,
or accounting advice; contact an issuer or investor-relations team; purchase a
subscription; submit or amend a filing; publish or communicate publicly;
disclose the private output; infer nonpublic information or issuer intent; or
fabricate evidence. All such authority remains outside this artifact.
