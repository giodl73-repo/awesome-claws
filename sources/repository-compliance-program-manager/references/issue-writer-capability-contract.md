# Issue-writer capability contract

## Purpose

The operating loop is vendor-neutral. Its only external mutation carrier is the
declared `issue_tracker` MCP binding, currently installed through a
credential-free HTTPS endpoint declaration and OAuth readiness gate. The
artifact contract refers to generic issue create/update operations and does not
depend on provider-specific compliance concepts.

## Installed authority

The OpenClaw profile grants workspace `read`, `write`, and `edit` plus only
`issue_tracker__create_issue` and `issue_tracker__update_issue`. The MCP
declaration filters the remote surface to `create_issue` and `update_issue`.
There is no issue close, delete, comment, repository mutation, settings,
scanner, suppression, code, shell, browser, messaging, or risk-acceptance tool.

Installed capability is not standing mutation authority. Before any call, the
current artifact must supply one exact policy revision containing:

- approved destination and asset/repository roster;
- approved issue template, labels, route, and mutable-field allowlist;
- only `create` and `update` operations;
- deterministic obligation and idempotency keys;
- dry-run preview bound to the exact obligation revision and policy digest;
- mutation values derived from the obligation and policy, with the expected
  issue revision equal to the authoritative pre-mutation revision;
- resulting issue revision and owner-content precondition recorded separately;
- conflict detection with preserve-or-block owner-content handling;
- external receipt requirements, including original-receipt identity and an
  identical idempotency key and result for replay.

Any mismatch is a blocker. The Claw never overwrites owner-authored content and
never closes an issue.

## Provenance

The package manifest and generated OpenClaw profile are the installed dependency
declarations. The checkpoint repeats the dependency name, endpoint, transport,
auth mode, and an owner-supplied provenance digest so a mutation receipt can be
reviewed against the exact policy generation. OAuth credentials remain in host
custody and must never enter the artifact.

## Lifecycle proof

The installed proof uses isolated local state and records:

1. standalone and OpenClaw inspection;
2. adapter and OpenClaw add dry-run previews;
3. consent-bound install and status;
4. exact dependency and tool-filter installation;
5. upgrade preview, stale-consent rejection, upgrade, and status;
6. rollback preview, rollback, and status;
7. repeat upgrade;
8. export and inspection;
9. removal preview, removal, and absent status;
10. reinstall preview, reinstall, status, second removal, and final absent
    status.

This proves declaration and lifecycle wiring. It does not contact an issue
provider, authenticate, create or update a real issue, or establish provider
behavior. Real mutations require the artifact-level approved policy, preview,
conflict check, and external receipt.
