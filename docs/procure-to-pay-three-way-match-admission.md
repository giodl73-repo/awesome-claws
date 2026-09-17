# Procure-to-Pay Three-Way Match Exception Reconciler admission decision

Date: 2026-09-16

Status: admitted and promoted as a public X4 Claw

Evidence verdict: **recommend NEW**, implemented by adapting exact-partition
patterns rather than by expanding the Financial Account Reconciliation
Coordinator

Admission status: **admitted**

Confidence: **0.92**

## Frame

### Falsifiable thesis

Procurement, receiving, and accounts-payable owner systems already hold the
authoritative purchase-order revision, receipt/return, invoice/credit, and
matching-policy records. The missing catalog job is an atomic, read-only
three-source exception partition that:

1. binds one current owner-approved PO revision and amendment;
2. consumes every PO, receipt, and invoice line exactly once;
3. accepts only one-PO-line groups whose net receipt/return and
   invoice/credit quantities and minor-unit amounts match exactly under an
   owner-approved policy; and
4. emits side-specific residuals and a typed-human owner handoff without
   posting, paying, contacting a supplier, interpreting tax or accounting
   treatment, or mutating a source.

The thesis is disproved if the existing two-source Financial Account
Reconciliation Coordinator can represent the same atomic three-manifest
partition, revision and amendment authority, one-PO-line policy, and global
line-consumption invariant without adding a new joint contract. It is also
disproved if representative owner data does not require receipt/return evidence
in addition to PO and invoice evidence.

### Owner-first capability framing

```text
authoritative procurement, receiving, and AP systems
+ missing atomic three-source partition and exception evidence
-> one reviewable owner handoff without changing financial truth or systems
```

Owner systems retain source completeness, PO revision and amendment semantics,
receipt and return truth, invoice and credit truth, source authenticity,
matching-policy approval, accounting and tax interpretation, posting, payment,
supplier communication, exception disposition, and every mutation.

### V1 boundaries

- One purchase order, one current revision, and one amendment.
- One caller-supplied cutoff and one caller-supplied validation `asOf`.
- Exact source-line references only.
- Exactly one PO line and one or more receipt and invoice lines per accepted
  group.
- Signed integer quantities and signed integer minor-unit arithmetic.
- Immutable owner source identities preserve the exact
  `{sourceSystemRef, exportRef, sourceNativeLineId}` triple without normalizing
  opaque owner identifiers.
- Returns and credits must identify an earlier exact source line with matching
  PO line, revision, currency, unit, and source system before they may
  participate in a group.
- Exact equality only. There is no tolerance, fuzzy matching, allocation,
  currency conversion, tax, freight, discount, or accounting-treatment lane.
- Side-specific residuals preserve every unmatched source line.
- Output is evidence for owner review, not approval to post or pay.

### Deletion target

After two representative owner-controlled runs reproduce the same accepted and
blocked outcomes, delete the manual workflow that maintains:

1. a PO-to-receipt worksheet;
2. a separate PO-to-invoice worksheet; and
3. a post-hoc duplicate invoice-line reuse audit across those worksheets.

Do not delete or replace the procurement, receiving, invoice, accounting, or
payment owner systems, and do not delete the existing two-source financial
account reconciliation job.

## Audit

The repository instructions make `catalog.json` and `sources/<claw-id>/`
authoritative and `claws/`, `CHOOSER.md`, and `catalog-chooser.json` generated.
The admission rubric requires a distinct repeatable job or materially different
workflow, output, evidence, or authority contract. The admitted implementation
uses those authoritative and generated surfaces and removes the superseded
candidate-only directory.

| Existing Claw | Source-backed behavior | Contribution consequence |
| --- | --- | --- |
| Financial Account Reconciliation Coordinator | `contributions/financial-account-reconciliation-coordinator.json`, `sources/.../financial-account-reconciliation.schema.json`, and `scripts/financial-account-reconciliation-coordinator.mjs` define two co-equal monetary exports, exact manifests, 1:1/1:n/n:1 groups, BigInt arithmetic, typed authority, complete two-sided consumption, residuals, caller-supplied time, and no posting. Its focused tests prove row reuse, many-to-many rejection, one-minor-unit drift, and residual totality. | **Adapt** exact manifests, total partitioning, integer arithmetic, structured findings, caller time, and typed authority. Do not pretend its two-sided signed-balance convention proves PO revision, receipt quantity, or invoice-credit identity. |
| Invoice and Payment Follow-up | `contributions/invoice-payment-followup.json`, `sources/.../invoice-receivables.schema.json`, and the focused case in `scripts/x3-decision-artifacts.test.mjs` track receivable balances, payments, credits, disputes, and owner-reviewed communications. | **Avoid as the core seam.** Reuse only the explicit credit vocabulary and no-payment/no-contact boundary. It is aggregate receivables follow-up, not source-line P2P matching, and its schema uses general JSON numbers. |
| Procurement Evaluator | `contributions/procurement-evaluator.json`, `sources/.../vendor-evaluation.schema.json`, and `scripts/procurement-evaluator.test.mjs` compare vendors against weighted evidence and specialist review. | **Avoid as the core seam.** Reuse the purchasing-owner boundary. No vendor scoring, ranking, recommendation, or pre-selection work belongs in this contribution. |
| Contract Obligation Tracker | `contributions/contract-obligation-tracker.json`, `sources/.../contract-obligation-tracker.schema.json`, `scripts/contract-obligation-tracker.mjs`, and its focused tests bind one owner-confirmed version, total coverage, exact blockers, chronology, and current named-human authority. | **Adapt** current-version authority, closed ledgers, and fail-closed chronology. Avoid clause, obligation, due-state, legal, and completion semantics. |
| Commercial Deal Desk Coordinator | `contributions/commercial-deal-desk-coordinator.json`, `sources/.../commercial-deal-desk.schema.json`, `scripts/commercial-deal-desk-coordinator.mjs`, and its focused tests bind an immutable revision, use BigInt quantity/minor-unit arithmetic, and require exact independent current approvals. | **Adapt** immutable revision binding, integer arithmetic, and exact approval scope. Avoid quote configuration, margin, discount, licensing, legal, and order-readiness domains. |

### Source audit conclusions

- The Financial Account Reconciliation Coordinator is the closest
  implementation analogue, but its row model makes both sides co-equal signed
  financial amounts. A receipt line has quantity evidence but no invoice amount,
  and a PO line is a current-revision policy anchor rather than another co-equal
  transaction.
- Invoice and Payment Follow-up proves that credits and partial payments need
  explicit evidence, but it does not close line identity or consumption.
- Contract Obligation Tracker and Commercial Deal Desk provide the strongest
  existing revision and authority precedents.
- Procurement Evaluator is the nearest audience analogue but a different job.

## Compare

### Internal reuse matrix

| Mechanism | Classification | Reason |
| --- | --- | --- |
| Exact line manifests | Reuse | All three source universes must be observable and immutable inside the artifact. |
| Complete line partition | Adapt | Extend two-sided consumption to three sides while allowing only one PO line per group. |
| BigInt-style arithmetic over integer strings | Reuse | Prevent floating-point quantity and currency drift. |
| Typed named-human grants | Adapt | Separate policy approval, amendment approval, match decision, and handoff. |
| Caller-supplied cutoff and `asOf` | Reuse | Source inclusion and validation must not depend on wall-clock time. |
| Receivables status and message drafts | Avoid | They create a different post-delivery follow-up workflow. |
| Vendor scoring and ranking | Avoid | They are pre-selection judgments, not transaction evidence. |
| Contract interpretation and quote-domain matrices | Avoid | They would expand the slice beyond exact P2P line evidence. |
| Configurable tolerance or fuzzy matching | Avoid | V1 has no authority to invent or choose a variance policy. |

### External primary-source comparison

1. Microsoft Dynamics 365 Finance documents line-level two-way matching as PO
   versus invoice price, and three-way matching as the additional comparison of
   invoice quantity to selected product-receipt quantity. It also documents
   multiple invoices per PO line and owner-configured tolerances. Useful
   precedent: receipt evidence is a distinct third source and policy is
   owner-configured. Negative precedent for this slice: do not import tolerances,
   tax/charges semantics, posting behavior, or automatic status updates.
   - <https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching>
   - <https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/tasks/set-up-accounts-payable-invoice-matching-validation>
2. Odoo 19 documents a received-quantity control policy, partial receipts, and a
   three-way `Should Be Paid` status that can become `Exception` after bill
   edits and can be manually changed before payment. Useful precedent: partial
   receipt quantity is operationally distinct. Negative precedent: this
   contribution must not expose a mutable pay decision or payment action.
   - <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html>

The contribution is deliberately simpler than either comparator: it validates
owner-supplied evidence under one exact policy and stops at a review handoff.

## Evaluate

The role review used three repository roles from different tension clusters.

| Lens | Finding | Revision made |
| --- | --- | --- |
| `claws-repo-steward` (cluster H, boundary purity) | Candidate evidence must not leak into public surfaces before admission, and the candidate-only directory must disappear after promotion. | Promote admitted files into authoritative `sources/`, `scripts/`, `docs/`, and generated surfaces; remove `candidates/procure-to-pay-three-way-match-exception-reconciler/`. |
| `power-user` (cluster B, operational control) | A third artifact that merely documents two worksheets would add ceremony. It needs one command, exact failures, and a named deletion target. | Add the public proof command, deterministic failure fixtures, and the three-worksheet deletion gate. Keep three exact line manifests and one complete partition root rather than a generalized evidence framework. |
| `ciso` (cluster A, security/correctness) | An accepted result must not turn model or system inference into financial authority. Source identity, policy approval, amendment approval, matching, and handoff need fail-closed human bindings. | Require independently issued typed grants to named humans; structurally set posting, payment, supplier contact, accounting, tax, and source mutation to `not-claimed`. |

No role found a reason to add external capabilities. The remaining trust roots
are explicit: the contribution's digests prove internal consistency only, not
source authenticity, completeness, or semantic correctness.

## Slice

### Representative accepted result

`fixtures/accepted.json` contains:

- PO `po-450` revision 2 and one owner-approved quantity amendment from 5 to 4
  on the cable line;
- three exact PO lines, including one unmatched support line;
- two split server-kit receipt lines;
- one cable receipt and one signed cable return;
- two partial server-kit invoice lines;
- one cable invoice and one signed cable credit;
- two exact accepted three-sided groups;
- one typed PO-side residual;
- four independently issued human authority grants;
- one caller-controlled cutoff; and
- exact policy, amendment, revision, group-decision, three-manifest, and complete
  partition-root bindings;
- structural non-claims for every prohibited action or interpretation.

All 3 PO, 4 receipt, and 4 invoice lines are consumed exactly once.

### Structured failures

`fixtures/failure-cases.json` pins exact finding-code sets for:

- duplicate invoice-line reuse across two groups;
- an unapproved matching-policy actor;
- a stale invoice line bound to the superseded PO revision; and
- a one-minor-unit invoice drift.

Additional adversarial regressions prove:

- policy, prior-amendment, PO quantity, currency-scoped grant, group-policy, and
  partition-root replay cannot pass after only derived digests are resealed;
- two internal rows cannot split one immutable owner source identity;
- a return or credit before its referenced source line cannot enter a match;
- an invalid reversal can be preserved only as a side-specific residual;
- exact net-zero reversal pairs cannot be hidden as residuals; and
- a blocked empty partition cannot predate any manifest or prerequisite even
  when there are no group or residual timestamps.

Findings have the stable shape:

```json
{
  "code": "line_reused",
  "path": "/invoiceLines",
  "message": "Every invoice line must be consumed exactly once by one allowed three-sided group or one invoice residual; observed 2.",
  "targetRefs": ["invoice-line-kit-partial-1"]
}
```

### Irreducibility proof

`fixtures/irreducibility-witness.json` is a constructive counterexample to
pairwise sufficiency:

- the complete PO-to-receipt partition passes as two 1:1 groups;
- the complete PO-to-invoice partition passes as one n:1 group; and
- the atomic three-way partition fails because the one invoice line covers two
  PO lines, while the owner-approved policy requires exactly one PO line per
  group and forbids splitting or reusing a source line.

The proof output is:

```json
{
  "poReceiptAccepted": true,
  "poInvoiceAccepted": true,
  "threeWayPartitionAccepted": false
}
```

This does **not** claim that all three-source arithmetic is mathematically
irreducible. Simple 1:1 equality is composable. It proves the relevant operating
contract is irreducible to two independent artifacts unless a new joint layer
adds shared manifests, current-revision and policy identity, atomic
three-source grouping, and global no-reuse enforcement. Adding that layer is
the admitted capability.

### Observable proof

Run:

```powershell
node --test scripts\procure-to-pay-three-way-match-exception-reconciler.test.mjs
node scripts\procure-to-pay-three-way-match-exception-reconciler-proof.mjs
```

The proof command exits nonzero unless the accepted fixture has zero findings, all
structured failures emit their exact expected code sets, both pairwise witness
partitions pass, and the three-way witness partition fails.

## Admission recommendation

**NEW**, with implementation reuse from existing exact-partition and
revision/authority patterns.

Unlike Financial Account Reconciliation Coordinator, this Claw repeatedly
reconciles one current owner-approved PO revision, physical receipt/return
lines, and invoice/credit lines for procurement and AP owners by atomically
partitioning three exact manifests under one matching policy to produce exact
three-sided groups and side-specific exceptions, while retaining all source,
policy, accounting, posting, payment, supplier-contact, and mutation authority
with named humans and owner systems.

This is not an **IMPROVE** because adding PO revision/amendment authority,
quantity-only receipt evidence, invoice-credit amount evidence, and atomic
three-manifest consumption would change the financial reconciler's job and
source model. It is not merely **COMPOSE** because two independently accepted
pairwise artifacts can still fail the owner-approved global partition witness.
The eventual implementation should nevertheless compose shared canonical
manifest, BigInt, authority, and structured-finding helpers rather than fork
them.

### Residual lifecycle evidence

- Source authenticity and complete-export trust-root treatment.
- A decision on whether owner systems supply pre-normalized signed returns and
  credits exactly as required by this V1 contract.
