# Merchant payout discrepancy workpaper

Synthetic USD, scale 2; private reviewer-finance.
Period starts 2026-09-01; cutoff 2026-09-08T23:59:00Z.

| Row | Gross | Signed fee | Net | Disposition |
| --- | ---: | ---: | ---: | --- |
| txn-charge | 1000.00 | 30.00 | 970.00 | payout-one |
| txn-refund | -100.00 | 0.00 | -100.00 | payout-one |
| txn-fee | 0.00 | 5.00 | -5.00 | payout-one |
| txn-unsettled | 200.00 | 6.00 | 194.00 | unsettled |

P1 (payout-one): gross USD 900.00 minus fees USD 35.00 equals net USD 865.00.
Declared payout USD 865.00; member residual USD 0.00. Processor status: paid.
Independent bank-one receipt USD 860.00; bank residual USD -5.00.
Reviewer-finance must explain this discrepancy; do not infer an additional fee.
Unsettled USD 194.00 remains separate.

Evidence: source-transactions r1, source-payouts r1, source-members r1,
source-bank r1, source-map r1. These synthetic references are not authenticated
reports. There are no retry attempts in this example.

Owner review required. No funds movement, contact, journal, settlement
certification or accounting-close decision has occurred.
