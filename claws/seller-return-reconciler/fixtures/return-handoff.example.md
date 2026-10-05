# Seller return handoff

Status: draft; coordinator: COORDINATOR-LEE (human); as of: 2026-10-04T17:00:00Z

Supplied evidence only. Recorded disposition is not executed repair, replacement, safety clearance, inventory eligibility or financial closure. No external action performed.

Input digest: sha256:78c318777a6389962dbc2ecc922105851bca9546b0bc5a197f7dcdbe2b8854ee

| Return / line | Authorized | Received | Disposition-evidenced | Not evidenced received | Awaiting disposition evidence | Status | Holds |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| RETURN-A / ITEM-1 (EA) | 5 | 3 | 2 | 2 | 1 | open | none supplied |

## Source and event ledger

- Source AUTHORIZATIONS revision r2 captured 2026-10-04T16:00:00Z.
- Source RECEIPTS revision r1 captured 2026-10-04T16:00:00Z.
- Source DISPOSITIONS revision r1 captured 2026-10-04T16:00:00Z.
- Return line RETURN-A-1: 5 EA; authorization true, principal AUTHORIZER-PAT at 2026-10-02T09:00:00Z; holds none supplied; source AUTHORIZATIONS / r2 / ROW-A.
- Receipt RECEIPT-A, return line RETURN-A-1, receiving INBOUND-1, lot LOT-A: 3 EA, received at 2026-10-03T10:00:00Z; replacement none; source RECEIPTS / r1 / ROW-R1.
- Disposition DECISION-A, receipt RECEIPT-A, units 1-2: supplied decision repair, recorded, principal REVIEWER-SAM at 2026-10-04T10:00:00Z; replacement none; source DISPOSITIONS / r1 / ROW-D1.

## Record coverage

- lines: RETURN-A-1
- receipts: RECEIPT-A
- dispositions: DECISION-A

## Human-owned downstream handoff

The coordinator must resolve missing receipt/disposition evidence, source conflicts and holds. Escalate supplied safety or recall holds to the accountable human. Recorded repair, replacement or accounting decisions require a separate owner-controlled execution workflow; this report proves none of those actions occurred.

No return authorization, warranty decision, inspection, diagnosis, disposition choice, safety clearance, refund, credit, account or inventory adjustment, shipping label, carrier booking, replacement shipment, customer contact or ERP write is authorized by this draft.
