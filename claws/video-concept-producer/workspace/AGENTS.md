# Operating workflow

## Start here

Ask for or confirm:

- Bounded objective, private audience and use, exactly two desired six-second MP4 variants, synthetic disclosure, prohibited subjects, named authority roles, as-of time, deadline, and nonpublication boundary
- Pinned @openclaw/pixverse-provider@2026.7.1 and OpenClaw v2026.7.1 configuration, observed video_generate availability for production, region, endpoint, pixverse/v6, terms and retention versions, nonsecret credential reference, currency, cap, and expected maximum per attempt
- For production, rights-cleared local raster assets plus inspection receipts proving existence, bytes, digest, MIME, dimensions, 16:9 geometry, owner, rights provenance, use, audience, territory, expiry, classification, and conservative safety flags
- Exact positive and negative prompts, allowlisted abstract and brand vocabulary, image-to-video aspect-ratio handling, seeds and settings, immutable approvals and reservations, retry rules, output review disciplines, controls, owners, questions, blockers, and handoff

## Included capability boundaries

- At OpenClaw v2026.7.1, @openclaw/pixverse-provider@2026.7.1 uploads one image, obtains a numeric video_id, polls to terminal status, and returns model, endpoint, videoId, hosted URL, video/mp4 MIME, and optional dimensions; the shared video_generate tool can also expose tool/task identity, task chronology, normalization, and ignored overrides.
- PixVerse image-to-video omits aspect_ratio. Keep the source image inspection at 16:9, record the requested aspectRatio as ignored, and derive output ratio only from returned dimensions or a separate materialization probe.
- Provider receipts must not invent account, provider request/output ids, response digests, billing, usage, provider start time, or local files. Account billing and local download/probe evidence are optional separate provenance-backed receipts.
- Use explicit pixverse/v6 with no fallback. Every initial or retry call needs immutable exact approvals from generation, cost, prompt-rights, and prompt-safety authorities and a conservative reservation; repeated request digests are valid only on failed-parent retry lineage.
- Validate outputs/video-concept-generation-manifest.json against the strict schema and semantic validator before rendering. The packaged fixture is illustrative only, deterministically blocked, and contains no actual asset inspection, human attestation, approval, provider call, charge, output, materialization, or review.

## Structured decision artifact contract

- Treat `fixtures/video-concept-generation-manifest.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/video-concept-generation-manifest.json` and check it against `schemas/video-concept-generation-manifest.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/video-concept-generation-manifest.md` at `outputs/video-concept-producer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Freeze the desired brief, structural authority roles, private control policy, deterministic as-of boundary, deadline, and two concept plans without presenting plans as completed generation
2. For production, verify attested human identities and exact scopes, OpenClaw tool availability, provider pin and region, terms and retention versions, nonsecret credential reference, budget cap, and external secret boundary
3. Inspect each local input through a provenance-backed system and verify bytes, MIME, geometry, rights, safety, and exact permitted abstract and brand vocabulary
4. Construct two image-to-video requests, mark the aspect-ratio override ignored, bind source geometry, and obtain immutable exact approvals from generation, cost, prompt-rights, and prompt-safety authorities with one reservation per attempt
5. Invoke only approved calls; allow repeated request digests only on exact retry descendants of failed attempts under renewed approval and reservation
6. Record only the exposed OpenClaw/PixVerse provider result, then add billing or local materialization facts solely through separate provenance-backed systems
7. Cover each successful output once with a same-variant concept and review board, validate every shot and review receipt, preserve partial failures and missing disciplines as blockers, and hand off every object, principal, and policy without publication

## Example setting

**Request:** Create two six-second abstract motion concepts for an internal renewable-energy presentation using only our approved geometric brand assets.

**Expected outcome:** An illustrative-only blocked plan for two desired abstract treatments, with no claim that assets were inspected, humans approved or reviewed, PixVerse was called, billing occurred, media was generated or downloaded, or publication was authorized.

## Standard deliverables

- Durable awesomeClaws.videoConceptGenerationManifest.v1 generation-and-review manifest
- Two clearly labeled desired variant and concept plans, plus production asset-inspection, authority-attestation, exact-approval, request, reservation, and retry records only when observed
- Minimal provider receipts containing exposed tool/task identity, PixVerse videoId, hosted URL, MIME, optional dimensions, normalization, and ignored image-to-video aspect override
- Separate optional account billing receipts and separate optional materialization and media-probe receipts without inferred charges or local files
- One concept and nonfinal human review board per successful output, with exact present-shot timing, explicit missing disciplines, questions, and blockers
- Complete private policy-, principal-, receipt-, and handoff coverage with not-published, not-distributed, not-advertised, not-purchased, and not-authorized state

## Done when

- The schema and public semantic validator accept the artifact; illustrative mode remains blocked with zero actual evidence collections, while production asOf and all event chronology are trustworthy
- Every production source has inspection and rights provenance, every principal has matching human attestation, and every prompt stays inside exact approved abstract and brand vocabulary
- Every invocation has exact immutable generation, cost, prompt-rights, and prompt-safety approval plus a reservation; retries descend only from failed parents under renewed approval
- Provider receipts use only fields exposed by the pinned provider and shared tool; billing and materialization claims appear only in their separate provenance-backed receipts
- Budget totals reserve every unreconciled attempt once, reconcile billed or not-billed evidence without double counting, and never infer actual charge when billing evidence is absent
- Every successful output has exactly one same-variant concept and review board; every present shot resolves and is frame-correct, and ready state requires complete probed output and six-discipline review coverage
- Every owner and target resolves, proposal and editorial text avoids completed effects and final approval, and the sole policy plus every principal and object is covered once in the private handoff

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
