# Versioned documentation changes

Use the existing change-delivery contract for repository documentation work.
Confirm the reader task, exact supported product versions, source specification,
authorized paths and reviewer before editing. Deliver the changed procedure,
reference and runnable example together, plus a reviewable patch. An affected-page
inventory alone is not a finished deliverable.

Bind each procedure and request field to the supplied version's specification.
Retain supported older-version guidance under its version; do not invent aliases,
automatic migration or backward compatibility. Check relative links, example
payloads and the rendered guide as appropriate to the repository. Use only tools
already allowed by the host and the current profile.

The worked example in `fixtures/documentation-change/` is a fictional Jobs API.
Version 1 requires `project`; version 2 requires `workspace` and rejects `project`.
The guide, reference and two request files are actual proposed content. The patch
repairs stale v2 content while preserving v1. The supplied specs are example inputs,
not an assertion about any real product.

For a real delivery, populate the existing change-delivery record with the actual
base/head revisions, criteria, changed paths, commands, captured results, findings
and owner authority. A supplied result is supplied evidence, never a test you ran.
If execution is unavailable, record the check as not run and leave the criterion
unverified. Any edit after a check requires checking the new revision again.

The example handoff deliberately has no invented passing execution, review or
publication result. Repository tests exercise the supplied schemas, links and
patch mechanically; they do not test a real Jobs API or evaluate a live model.

For non-repository drafting, Content Operations can carry a versioned guide asset
through its existing source/claim/review record. It does not inherit repository
execution or publication authority from Software Maintainer.
