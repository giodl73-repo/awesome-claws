# Enterprise License Entitlement Reconciler contract

This package reconciles one organization's owner-supplied license rights and SKU
mapping against complete assignment and measured-consumption exports for one
agreement, program, period, cutoff, round, and predecessor.

The rights manifest and SKU mapping are external public trust roots. The Claw
recomputes their internal digests but never interprets agreement text or invents
a mapping. Validate the example with both caller-controlled inputs:

```bash
npm run validate:artifact -- enterprise-license-entitlement-reconciler fixtures/license-entitlement-reconciliation.example.json --as-of 2026-09-03T18:00:00Z --license-trust-root fixtures/license-trust-root.example.json
```

The machine artifact is authoritative. The Markdown and inline visual are
projections of the same validated state. A ready handoff means only that the
declared evidence graph, arithmetic, authority, exceptions, and decisions are
internally consistent. It does not purchase, assign, revoke, renew, mutate an
account, submit a true-up, infer effective access or usage, recommend action, or
declare compliance.
