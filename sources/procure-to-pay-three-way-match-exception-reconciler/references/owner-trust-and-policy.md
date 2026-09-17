# Owner trust and policy configuration

The Claw operates only on owner-supplied workspace exports. Configure and verify
the trust roots before producing an artifact; never infer them from file names,
descriptions, or matching values.

## Required trust roots

For each of the purchase-order, receipt, and invoice sides, the owner supplies:

- an opaque `sourceSystemRef`;
- an opaque `exportRef`;
- the complete line universe at the caller-controlled cutoff; and
- one opaque `sourceNativeLineId` per line.

The exact `{sourceSystemRef, exportRef, sourceNativeLineId}` triple is immutable
inside a review. The validator rejects duplicate triples in one manifest so a
single owner line cannot be split into multiple candidate rows. Digests prove
internal consistency only. They do not authenticate an owner system or prove
that an export is complete.

## Owner-approved policy

Use `fixtures/owner-trust-policy.example.json` as a shape example, not as current
configuration. V1 supports exactly:

- one PO line per group;
- one or more exact receipt-side lines and invoice-side lines;
- signed integer quantity equality across PO, net receipt/return, and net
  invoice/credit;
- exact current-PO unit price and integer minor-unit amount equality;
- exact source-line references only; and
- no tax lane and no tolerance lane.

The policy and amendment approvals bind exact payload digests. Match decisions
bind the policy id, version, payload digest, group payload, and all three line
manifest digests.

## Reversal lineage

A return must reference one earlier receipt line. A credit must reference one
earlier invoice line. The source and reversal must have the same PO line,
current revision, currency, unit, source system, and unit price where applicable.
Aggregate reversal quantity cannot exceed the referenced source quantity. An
invalid reversal is retained as a side-specific residual; it cannot enter an
accepted match group.

## Human authority and time

Every grant is scoped to the exact PO, currency, revision, role, and active
interval. Matching-policy approval, amendment approval, match decisions, and
handoff require typed named humans under independently issued grants. The
caller-supplied policy binds the exact principal and grant ledger digest, so an
artifact cannot self-attest a different actor, issuer, role, target, or active
interval.

The caller supplies both `cutoffAt` and validation `asOf` as zone-bearing RFC
3339 timestamps. There is no wall-clock fallback. The handoff must follow every
policy, amendment, grant, manifest, decision, and residual prerequisite.

## Reserved owner authority

The Claw never:

- interprets tax or accounting treatment;
- creates or changes a PO, receipt, return, invoice, or credit;
- posts or reverses an entry;
- initiates or approves payment;
- contacts a supplier;
- writes to an owner system; or
- claims accounting, audit, control, or compliance assurance.
