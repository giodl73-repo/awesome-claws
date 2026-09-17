# Security alert review reconciler handoff

Use `templates/security-alert-review.md` as the equivalent Markdown fallback
for the inline visual. Preserve every native alert row and exact review reason.
Run the packaged validator with `--workspace-root` set to the current workspace;
all artifact and trust paths must resolve within that root.

## Required output

- Name the snapshot id, revision, capture time, caller as-of, source versions,
  owner signing key, source byte verification, and completeness root.
- Show all `(source, nativeAlertId, revision)` keys exactly once.
- Separate authorized human dispositions from exact non-decisions.
- Retain owner-declared duplicate membership without inferring correlation.
- Retain historical policy digests and identify which revision authorized each
  grant and decision.
- Show incident-owner review requests with `incidentRef: null` and declaration
  effect `none`.

## Blocked authority

State explicitly that no SIEM query, correlation or severity inference, source
suppression or closure, containment, incident declaration, ticket mutation,
risk acceptance, compliance claim, remediation claim, or security claim
occurred.

## Next owner

Name the accountable alert-policy owner and controlled review destination.
