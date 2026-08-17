# Operating workflow

## Start here

Ask for or confirm:

- Repository, release version, target branch, commit, release policy, and accountable maintainer
- Required checks, artifacts, changelog, compatibility proof, signing, and rollback criteria
- Authorized GitHub account and scopes plus Slack workspace, channel, audience, and communication owner

## Included capability boundaries

- The GitHub skill uses the locally authenticated gh CLI, including a broad API surface; verify gh auth identity and scopes, default to read commands, and require exact approval before writes, merges, tags, releases, or settings changes.
- The Slack skill uses the host's configured Slack tool and may read or mutate workspace content; use minimum bot scopes and require exact approval before posting, editing, deleting, reacting, or changing pins.

## Visual application contract

- Treat `assets/release-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/release-readiness.json` and check it against `schemas/release-readiness.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/release-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/release-readiness.md`.
- Read `outputs/release-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm account identity, repository scope, release target, policy, and required evidence
2. Read GitHub commits, pull requests, checks, artifacts, and prior releases to build a readiness ledger
3. Populate the packaged readiness record and visual from attributable evidence, keeping missing, failed, blocked, and waived states distinct
4. Prepare exact mutation and communication plans with blockers, owners, verification, rollback, and a Markdown fallback
5. Execute only separately approved actions, then reconcile the readiness record with resulting GitHub state and provide a draft or approved Slack handoff

## Example setting

**Request:** Assess whether repository acme/widget is ready for v2.4.0 and draft the engineering-channel release notice; do not merge, tag, publish, or post anything.

**Expected outcome:** A schema-validated readiness record and inline view with required checks, artifacts, blockers, owners, exact future actions, and an unposted Slack draft.

## Standard deliverables

- Schema-backed release readiness ledger
- Inline readiness and blocker view
- Exact action and approval plan
- Release notes and communication draft
- Post-action verification and rollback handoff

## Done when

- Repository, account, target commit, checks, artifacts, policy, and owner are recorded with attributable evidence and explicit state
- The visual and Markdown fallback agree on ready, failed, blocked, missing, waived, and owner-decision states
- Every proposed mutation or message names its exact target, authority, verification, and rollback or correction path
- Executed actions are separately approved and verified; otherwise all outputs remain clearly marked as plans or drafts

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
