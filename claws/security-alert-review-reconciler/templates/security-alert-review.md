# Security alert review

- Snapshot: `snapshot-owner-alerts-2026-09-16` revision `export-42`
- Captured: 2026-09-16T19:00:00Z
- Caller as-of: 2026-09-16T23:30:00Z
- State: **complete-covered**
- Owner source manifest: **verified**
- Owner signing key: `security-alert-owner-key-1`
- Snapshot completeness root:
  `sha256:652a61009ac87b2a2b2bb82bc246e0d8bc9ca15829a00a30d63e734724eeaeb1`
- Source versions and exact byte digests:
  - `github/code-scanning` `export-42`:
    `sha256:b6fccf35cec1c0326d2889caa451f8bc4dea024990b1f40c6d3fe083725b09bf`
  - `github/dependabot` `export-42`:
    `sha256:804eff0cbb63c37df8a49d6acb53fdfb84dae905c5cbd095684531510c73c868`
  - `github/secret-scanning` `export-42`:
    `sha256:086a14a8330c350981b13e22c78ceb70f7b41cd4f452d89b165ae4d6beb50e4a`
- Native alert coverage: **8 / 8**

## Review result

| Source | Native alert | Revision | Source state | Review result |
| --- | --- | --- | --- | --- |
| github/code-scanning | 101 | analysis-3 | open | False positive - Riley Chen |
| github/code-scanning | 102 | analysis-5 | open | Duplicate - owner-declared group |
| github/secret-scanning | 77 | occurrence-1 | muted | Non-decision: source muted |
| github/dependabot | 55 | advisory-4 | suppressed | Non-decision: source suppressed |
| github/code-scanning | 104 | analysis-1 | open | Non-decision: unknown asset |
| github/code-scanning | 105 | analysis-1 | open | Non-decision: self-suppression attempt |
| github/code-scanning | 106 | analysis-2 | open | Non-decision: prior revision invalidated |
| github/code-scanning | 107 | analysis-1 | open | Incident-owner review requested |

## Policy and authority

- Current reviews bind `policy-2026-09-16-2`.
- The invalidated prior decision remains bound to
  `policy-2026-09-15-1`; its historical digest was not rewritten.
- Public detector documentation is independently supplied, query-free,
  approved-domain, and context-only.
- The duplicate relationship was declared by the alert owner. No correlation
  was inferred.
- The incident record is only `requested-owner-review`; `incidentRef` is null
  and declaration effect is `none`.

## Explicit non-actions

No SIEM query, correlation inference, severity inference, source suppression,
source closure, containment, incident declaration, ticket mutation, risk
acceptance, compliance claim, remediation claim, or security claim was made.

## Next owner

Morgan Patel reviews the complete covered ledger at
`controlled://security-alert-review/handoffs/review-2026-09-16.json`.
