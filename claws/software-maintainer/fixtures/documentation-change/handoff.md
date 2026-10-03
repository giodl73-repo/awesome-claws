# Documentation change handoff

Private synthetic draft for the documentation owner. Publication and merge are
not authorized by this example.

Changed: guide.md, reference.md and request-v2.json. Preserved: request-v1.json
and the version-1 request procedure. The patch repairs the stale v2 field name;
it does not change an API implementation or migrate existing jobs.

Acceptance: v2 examples satisfy the supplied v2 request specification; the guide
and reference agree; links resolve; v1 still uses its own supported fields.

Verification state: not run in this example session. No live API execution,
successful response, current-head review or owner approval is claimed. A supplied
sample request is not an execution receipt. Record actual commands, output and
base/head revisions in the existing change-delivery record before asserting any
checks passed. Recheck after changes, even when the version label is unchanged.

Open questions for the API owner: authentication, error responses and server
behavior are not specified. Do not publish those details until sourced and
reviewed. The owner must review this exact draft version before release.
