# Order fulfillment handoff

Status: draft; human owner: COORDINATOR-LEE; as of: 2026-10-04T17:00:00Z

Supplied evidence only. Quantity evidence is not release approval, financial closure, or confirmation of unobserved movement. No external action performed.

Input digest: sha256:90dc03a556fe117efc561bdb8eb8845503ca11d13f0ca07b86364bc84f7ed611

| Order / line | Net ordered | Departed | Delivery-confirmed | Not evidenced shipped | Shipped without confirmation | Status | Holds | Past promise without full delivery evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| ORDER-A / ITEM-1 (LINE-A) | 8 | 6 | 4 | 2 | 2 | open | none supplied | yes |
| ORDER-B / ITEM-1 (LINE-B) | 8 | 8 | 8 | 0 | 0 | quantity-evidenced | none supplied | unknown promise |

## Movement evidence

These are supplied records, not independently verified movements.

- Order line LINE-A: 10 EA ordered; 2 cancelled; source ORDERS / r2 / ROW-A.
- Order line LINE-B: 8 EA ordered; 0 cancelled; source ORDERS / r2 / ROW-B.
- Shipment line SHIP-A (LOAD-1), order line LINE-A: 6 EA, departed at 2026-10-03T09:00:00Z; replacement none; source SHIPMENTS / r1 / ROW-A.
- Shipment line SHIP-B (LOAD-1), order line LINE-B: 8 EA, departed at 2026-10-03T09:00:00Z; replacement none; source SHIPMENTS / r1 / ROW-B.
- Delivery DELIVERY-A, shipment line SHIP-A: 4 EA confirmed at 2026-10-04T10:00:00Z; source DELIVERIES / r1 / ROW-A.
- Delivery DELIVERY-B, shipment line SHIP-B: 8 EA confirmed at 2026-10-04T10:00:00Z; source DELIVERIES / r1 / ROW-B.

## Customer-status drafts

For coordinator review only. Not sent; no new delivery promise is made.

- ORDER-A / ITEM-1: As of 2026-10-04T17:00:00Z, supplied records show 6 of 8 EA departed and 4 delivery-confirmed. 2 lack departure evidence; 2 departed units lack delivery confirmation. Holds: none supplied.
- ORDER-B / ITEM-1: As of 2026-10-04T17:00:00Z, supplied records show 8 of 8 EA departed and 8 delivery-confirmed. 0 lack departure evidence; 0 departed units lack delivery confirmation. Holds: none supplied.

## Source register

- ORDERS revision r2 captured 2026-10-04T16:00:00Z
- SHIPMENTS revision r1 captured 2026-10-04T16:00:00Z
- DELIVERIES revision r1 captured 2026-10-04T16:00:00Z

## Record coverage

- lines: LINE-A, LINE-B
- shipments: SHIP-A, SHIP-B
- deliveries: DELIVERY-A, DELIVERY-B

## Human handoff

The named coordinator must resolve blockers and holds, obtain missing departure/delivery evidence, and review any customer-status wording. No picking, shipping, carrier booking, order change, invoicing, refund, or customer contact is authorized by this report.
