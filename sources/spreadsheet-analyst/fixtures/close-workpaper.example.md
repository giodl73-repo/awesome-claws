# Close workpaper

Northwind Example Co; accruals-2100; 2026-08; USD; owner-supplied accrual basis.

| Component | USD | Source / revision |
| --- | ---: | --- |
| Opening balance | 12000.00 | TB-OPEN / r1 |
| Closing balance | 15500.00 | TB-CLOSE / r2 |
| Supplier schedule change | 2100.00 | SCHED-SUPPLIER / r1 |
| Payroll schedule change | 900.00 | SCHED-PAYROLL / r1 |
| Balance change | 3500.00 | Closing less opening |
| Explained by schedules | 3000.00 | Supplier plus payroll |
| Unexplained | 500.00 | Balance change less schedules |

The supplied balances changed from USD 12000.00 to USD 15500.00. Supporting schedules explain USD 3000.00 of the USD 3500.00 change. USD 500.00 remains unexplained; no accrual, cause or journal is inferred.

## Separate-account unresolved items

- operating-001: residual-ledger-review, ledger row ledger-row-residual, USD 1.25, owner-review-needed; next owner Ruth Abara.
- operating-001: residual-statement-timing, statement row statement-row-residual, USD -0.90, timing-difference; next owner Ruth Abara.

Keep these items separate; netting accounts or balancing portfolio totals does not resolve them. The reconciliation output is validated by its existing owner contract, not a replacement matcher.

Reviewer: Morgan Lee, Controller. Which source explains the remaining balance difference? What evidence resolves each separate-account item? Review the exact source and reconciliation snapshots again after any entity, period, basis, value or revision changes.

This private workpaper is not a journal, accounting-policy determination, tax conclusion, certification or close approval. No posting, funding, source-system mutation or communication occurred.
