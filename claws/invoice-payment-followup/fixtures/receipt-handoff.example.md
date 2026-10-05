# Receipt allocation workpaper

State: ready-for-owner-review. Owner: AR-OWNER. Scope: LEDGER-ACCOUNT-1. As of: 2026-10-04T10:00:00Z.

Owner-supplied identity and scope references are assertions, not source authentication.
Allocation evidence is not posting authority. Invoice balances and accounting entries are unchanged.
Amounts below use the supplied currency scale. Unknown means blocked, never zero.

## Receipts

| Record | Identity | Status | Currency | Received | Allocated evidence | Unallocated | Source / revision / record |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | CASH-1 | current | USD | 1000.00 | 900.00 | 100.00 | BANK / V1 / ROW-1 |

## Allocation evidence

| Record | Identity | Receipt | Invoice | Basis | Status | Currency | Amount | Source / revision / record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | ALLOCATION-L1 | R1 | A | remittance | current | USD | 600.00 | REMIT / V1 / L1 |
| L2 | ALLOCATION-L2 | R1 | B | remittance | current | USD | 300.00 | REMIT / V1 / L2 |

## Owner review

- AR-OWNER: Retain the unallocated remainder of R1; obtain allocation evidence without inventing an invoice or refund.
- AR-OWNER: L1 records remittance, not accounting application; do not change an invoice balance.
- AR-OWNER: L2 records remittance, not accounting application; do not change an invoice balance.

## Complete workpaper record

The record below retains every supplied source, invoice, receipt and allocation, including unresolved evidence.

```json
{
  "schemaVersion": "awesomeClaws.receiptWorkpaperReport.v1",
  "state": "ready-for-owner-review",
  "owner": "AR-OWNER",
  "evidence": {
    "schemaVersion": "awesomeClaws.receiptWorkpaperInput.v1",
    "asOf": "2026-10-04T10:00:00Z",
    "owner": "AR-OWNER",
    "scopeRef": "LEDGER-ACCOUNT-1",
    "currencies": [
      {
        "code": "USD",
        "scale": 2
      }
    ],
    "sources": [
      {
        "id": "BANK",
        "revision": "V1",
        "capturedAt": "2026-10-04T10:00:00Z",
        "kind": "receipt",
        "scopeRef": "LEDGER-ACCOUNT-1"
      },
      {
        "id": "REMIT",
        "revision": "V1",
        "capturedAt": "2026-10-04T10:00:00Z",
        "kind": "remittance",
        "scopeRef": "LEDGER-ACCOUNT-1"
      }
    ],
    "invoices": [
      {
        "id": "A",
        "currency": "USD"
      },
      {
        "id": "B",
        "currency": "USD"
      }
    ],
    "receipts": [
      {
        "id": "R1",
        "identityRef": "CASH-1",
        "sourceRef": "BANK",
        "sourceRevision": "V1",
        "sourceRecord": "ROW-1",
        "at": "2026-10-04T10:00:00Z",
        "currency": "USD",
        "amountMinor": 100000,
        "status": "current"
      }
    ],
    "allocations": [
      {
        "id": "L1",
        "identityRef": "ALLOCATION-L1",
        "receiptRef": "R1",
        "invoiceRef": "A",
        "sourceRef": "REMIT",
        "sourceRevision": "V1",
        "sourceRecord": "L1",
        "at": "2026-10-04T10:00:00Z",
        "currency": "USD",
        "amountMinor": 60000,
        "basis": "remittance",
        "status": "current"
      },
      {
        "id": "L2",
        "identityRef": "ALLOCATION-L2",
        "receiptRef": "R1",
        "invoiceRef": "B",
        "sourceRef": "REMIT",
        "sourceRevision": "V1",
        "sourceRecord": "L2",
        "at": "2026-10-04T10:00:00Z",
        "currency": "USD",
        "amountMinor": 30000,
        "basis": "remittance",
        "status": "current"
      }
    ]
  },
  "findings": [],
  "reviewQuestions": [
    {
      "owner": "AR-OWNER",
      "code": "unallocated_cash",
      "ref": "R1",
      "question": "Retain the unallocated remainder of R1; obtain allocation evidence without inventing an invoice or refund."
    },
    {
      "owner": "AR-OWNER",
      "code": "application_not_established",
      "ref": "L1",
      "question": "L1 records remittance, not accounting application; do not change an invoice balance."
    },
    {
      "owner": "AR-OWNER",
      "code": "application_not_established",
      "ref": "L2",
      "question": "L2 records remittance, not accounting application; do not change an invoice balance."
    }
  ],
  "receiptCoverage": [
    "R1"
  ],
  "allocationCoverage": [
    "L1",
    "L2"
  ],
  "receipts": [
    {
      "id": "R1",
      "identityRef": "CASH-1",
      "sourceRef": "BANK",
      "sourceRevision": "V1",
      "sourceRecord": "ROW-1",
      "at": "2026-10-04T10:00:00Z",
      "currency": "USD",
      "amountMinor": 100000,
      "status": "current",
      "scale": 2,
      "allocatedMinor": 90000,
      "unallocatedMinor": 10000,
      "allocationRefs": [
        "L1",
        "L2"
      ]
    }
  ],
  "allocations": [
    {
      "id": "L1",
      "identityRef": "ALLOCATION-L1",
      "receiptRef": "R1",
      "invoiceRef": "A",
      "sourceRef": "REMIT",
      "sourceRevision": "V1",
      "sourceRecord": "L1",
      "at": "2026-10-04T10:00:00Z",
      "currency": "USD",
      "amountMinor": 60000,
      "basis": "remittance",
      "status": "current"
    },
    {
      "id": "L2",
      "identityRef": "ALLOCATION-L2",
      "receiptRef": "R1",
      "invoiceRef": "B",
      "sourceRef": "REMIT",
      "sourceRevision": "V1",
      "sourceRecord": "L2",
      "at": "2026-10-04T10:00:00Z",
      "currency": "USD",
      "amountMinor": 30000,
      "basis": "remittance",
      "status": "current"
    }
  ],
  "invoiceBalancesChanged": false,
  "accountingEntriesPosted": false
}
```
