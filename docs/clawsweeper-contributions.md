# ClawSweeper contribution review

The repository includes a target-specific `AGENTS.md` review policy and a
dispatcher workflow.

## Repository operator setup

1. Install the `clawsweeper` GitHub App.
2. Add `CLAWSWEEPER_APP_PRIVATE_KEY` as an Actions secret.
3. Ensure ClawSweeper has an explicit repository profile for this repository.

## Contributor workflow

Open or update a starter proposal or pull request. Those events automatically
request an exact-item review when the repository operator setup is complete.
Updating the issue or pull request, or pushing a new pull-request head, requests
a fresh pass.

This repository does not forward issue comments, so `@clawsweeper review` and
`@clawsweeper re-review` are not enabled here. Keeping comment commands out of
the dispatcher prevents contribution review from exposing ClawSweeper's repair
or merge command surface.

The review should use `npm run review:contribution`, related GitHub items, the
contribution record, and current catalog source. Similarity remains advisory;
maintainers own admission.

If the secret is absent, the dispatcher exits successfully with a notice and
normal catalog CI remains authoritative.
