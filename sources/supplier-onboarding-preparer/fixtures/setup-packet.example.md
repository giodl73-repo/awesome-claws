# Supplier setup packet

Private review draft. Not activated, verified for payment or sent.

Supplier: SUP-17. Buying entity: BUY-US. Packet: R1.
Policy: ONB-3 (POLICY-ONB-3). As of: 2026-10-02T12:00:00-07:00.
Owner: Procurement owner. Private recipient: Supplier activation owner.

## Setup fields

Legal entity: Unresolved; preserve the records below (unresolved).
Service: Invoice routing including employee names. Scope revision: S2 (SERVICE-SCOPE-2).
Personal data: included.
Selection: supplied by Business owner (OWNER-SELECTION-1); not activation authority.

## Entity records

| Record | Kind | Legal entity | Revision | Reference |
| --- | --- | --- | --- | --- |
| INTAKE | intake | Example Services LLC | I2 | INTAKE-2 |
| CONTRACT | contract | Example Services Holdings LLC | C1 | CONTRACT-DRAFT-1 |

## Checklist and evidence

| Item | Requirement | State | Evidence | Owner |
| --- | --- | --- | --- | --- |
| ENTITY | Selected and contracting entity must agree | gap | INTAKE, CONTRACT | Procurement owner |
| SERVICE | Record the current service scope | satisfied | SCOPE | Business owner |
| SELECTED | Retain the supplied selection decision | satisfied | SELECTION | Business owner |
| PRIVACY | Current-scope Privacy review for personal-data handling | reopened | PRIVACY-P1 | Privacy owner |
| PAYMENT | Controlled Finance verification receipt | gap | Not supplied | Finance owner |

## Supplied specialist receipts

- PRIVACY-P1: privacy, Example Services LLC, scope S1, policy ONB-3; supplied result satisfied, Privacy owner, 2026-09-28T09:00:00-07:00, valid through 2026-12-31T23:59:59-08:00. Controlled reference: CONTROLLED-PRIVACY-P1. The checklist determines whether this scope is usable.

## Exact owner questions

### Procurement owner: ENTITY

Which legal entity is selected and contracting: Example Services LLC or Example Services Holdings LLC? Supply authoritative corrected records, a scoped resolution and any existing-master match observation; do not merge by name similarity.

### Privacy owner: PRIVACY

Review the resolved entity and exact S2 scope including employee names. P1 covered S1 without personal data and cannot carry forward. Provide only a minimized controlled decision reference.

### Finance owner: PAYMENT

After entity resolution, provide a controlled payment-verification receipt reference for that entity and S2 scope under ONB-3. Do not send account numbers, tax identifiers or credentials to this packet.

## Handoff

State: blocked. Unresolved prerequisites: ENTITY, PRIVACY, PAYMENT.
Preparation does not select or activate a supplier, authenticate payment details, accept risk, grant specialist approval, contact anyone or change an external system.
Compare this minimized packet with the original permitted records. A controlled reference is supplied evidence, not an independently authenticated decision.
