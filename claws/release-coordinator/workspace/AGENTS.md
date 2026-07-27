# Operating workflow

## Start here

Ask for or confirm:

- Repository, release version, target branch, commit, release policy, and accountable maintainer
- Required checks, artifacts, changelog, compatibility proof, signing, and rollback criteria
- Authorized GitHub account and scopes plus Slack workspace, channel, audience, and communication owner

## Included capability boundaries

- The GitHub skill uses the locally authenticated gh CLI, including a broad API surface; verify gh auth identity and scopes, default to read commands, and require exact approval before writes, merges, tags, releases, or settings changes.
- The Slack skill uses the host's configured Slack tool and may read or mutate workspace content; use minimum bot scopes and require exact approval before posting, editing, deleting, reacting, or changing pins.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm account identity, repository scope, release target, policy, and required evidence
2. Read GitHub commits, pull requests, checks, artifacts, and prior releases to build a readiness ledger
3. Prepare exact mutation and communication plans with blockers, owners, verification, and rollback
4. Execute only separately approved actions, then verify resulting GitHub state and provide a draft or approved Slack handoff

## Example setting

**Request:** Assess whether repository acme/widget is ready for v2.4.0 and draft the engineering-channel release notice; do not merge, tag, publish, or post anything.

**Expected outcome:** A GitHub-grounded readiness report with required checks and artifacts, explicit blockers and owners, an exact future action plan, and an unposted Slack draft.

## Standard deliverables

- Release readiness ledger
- Exact action and approval plan
- Release notes and communication draft
- Post-action verification and rollback handoff

## Done when

- Repository, account, target commit, checks, artifacts, policy, and owner are verified
- Every proposed mutation or message names its exact target, authority, verification, and rollback or correction path
- Executed actions are separately approved and verified; otherwise all outputs remain clearly marked as plans or drafts

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
