# Video concept generation manifest contract

Video Concept Producer owns
`awesomeClaws.videoConceptGenerationManifest.v1`, a private planning,
generation-evidence, and review handoff. It does not become the authority for
PixVerse account, billing, retention, or hosted-media state, and it does not
become the authority for OpenClaw task execution or managed media.

## Pinned provider evidence boundary

The package is pinned to `@openclaw/pixverse-provider@2026.7.1` and OpenClaw
tag `v2026.7.1`. At that tag, the PixVerse provider:

- uploads one image for image-to-video;
- submits the generation and obtains a numeric `video_id`;
- polls `/video/result/{videoId}` until terminal provider status;
- returns the provider model, endpoint, `videoId`, terminal status, hosted URL,
  `video/mp4` MIME, and optional output width and height;
- lets the shared `video_generate` tool expose tool-call identity, optional
  OpenClaw task identity and chronology, normalization, ignored overrides, and
  the hosted attachment.

PixVerse image-to-video does not send an aspect-ratio parameter. The manifest
therefore records the requested `16:9` override as ignored, binds the inspected
source image's `16:9` geometry, and derives or verifies output ratio only from
returned dimensions or a later media probe.

A production provider receipt is limited to those exposed fields. It cannot
invent an account identity, provider request id, provider output id, billing or
usage, response digest, provider start time, local path, or downloaded file.
The receipt's evidence digest identifies the captured OpenClaw record; it is not
represented as a PixVerse response digest.

## Separate evidence systems

Provider, billing, and materialization evidence remain separate:

- an OpenClaw provider receipt records the actual tool/task result and hosted
  PixVerse output;
- an optional separate billing receipt comes from the PixVerse account billing
  system and may state billed, pending, or not billed;
- an optional separate materialization receipt comes from an approved download
  system and proves local path, bytes, content digest, MIME, dimensions,
  duration, frame rate, frame count, and probe provenance.

Absent account billing evidence, `actualBilledTotal` is `null`; the manifest
does not guess a charge or usage. Every exact initial or retry approval reserves
its expected maximum until a final billed or not-billed receipt reconciles that
attempt. Billed amounts replace, rather than stack on top of, the reservation;
not billed is exactly zero.

## Approval and retry authority

Every production approval binds:

- the exact positive and negative prompt, structured subject declaration, and
  prompt digest;
- the inspected source path, bytes digest, MIME, dimensions, geometry, rights,
  and asset digest;
- exact settings, source-ratio handling, expected maximum charge, and budget
  reservation;
- provider, region, model, model version, terms version, retention version, and
  nonsecret credential reference;
- the intended attempt and exact retry parent;
- an attested human generation approver, the cost owner with
  `approve-generation-cost`, and a human reviewer with both
  `approve-prompt-rights` and `approve-prompt-safety`.

The approval also requires an immutable receipt from an approval system. Its
issuer, system, record id, digest, and timestamp are retained with either a
signature or an external record reference. A locally recomputed content digest
alone is not approval provenance.

A retry must descend from a completed failed same-variant attempt. It needs a
new exact approval and reservation after the failure. Repeating a request digest
under an unrelated attempt or a new local id is blind replay and is rejected.

## Input, prompt, and output truth

Production inputs require inspection receipts proving existence, byte digest,
byte length, MIME, dimensions, and raster geometry. Rights evidence has its own
immutable provenance and authorized human reviewer.

Positive prompts use an exact conservative vocabulary: declared abstract
elements plus brand vocabulary permitted by the inspected asset. Undeclared
proper names, entities, brands, people, or sensitive events are rejected. A
negative prompt may name those subjects solely as exclusions. Exact prompt
rights and safety review is part of the signed generation approval.

Every successful attempt has one hosted output identity, one same-variant
concept, and one review board. Any present shot resolves to that exact
concept/variant/output. A complete production-ready shot plan covers seconds
0-6 and frames 0-143 without gaps or overlap. There are no orphan shots.

## Human review, partial failure, and readiness

Authority is structural: production principals are typed as human, have an
exact role and scopes, and link to an attestation receipt with matching
principal type, role, and scopes. Ids, names, and roles containing GPT, model,
bot, agent, assistant, AI, Copilot, or Claw identities are rejected.

The schema permits zero outputs and permits a review board to name missing
disciplines. This supports honest failed or incomplete runs. Semantic readiness
still requires exactly two successful outputs, two materialization probes,
complete shot coverage, and exact editorial, rights, factual, brand,
accessibility, and safety reviews. Missing review work must have an exact open
review blocker, and all incomplete or failed work remains blocked.

Production `asOf` is checked against the validator's injectable validation
boundary with a five-minute default tolerance. Every observed event is no later
than `asOf`. The illustrative fixture is deterministically exempt from the
wall-clock comparison, but its own event chronology still cannot exceed its
fixed `asOf`.

## Complete control and handoff coverage

All proposal, question, and blocker owners and targets resolve. Proposed
actions are typed, future, and not executed. Editorial text, including proposal
text, cannot claim completed publication, distribution, advertising, upload,
send, purchase, review, or broader final approval.

Every present object is covered exactly once by the handoff and the sole
effective control policy. Coverage includes authority records, attestations,
policies, receipts, and the handoff itself. Unused principals or policies are
rejected; complete coverage never substitutes for production readiness.

## Illustrative fixture

The packaged fixture is illustrative only and blocked. It contains two desired
variant and concept plans, but no inspected source asset, attested human,
approval, provider call, OpenClaw task, PixVerse `videoId`, hosted output,
billing event, charge, materialized file, shot, or human review. Its plans are
not evidence that any event occurred.
