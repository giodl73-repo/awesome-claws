# Publication readiness record

Render `outputs/publication-readiness-record.json` without weakening its evidence,
approval, or authority state.

## Request, owner, and deadline

- Preserve the request verbatim.
- Name the accountable owner and channel owner, the as-of time, deadline, and
  IANA timezone.
- State `blocked`, `ready-for-owner-review`, or `ready-for-publication` exactly
  as recorded.

## Audience, channels, and acceptance criteria

- Show the audience, intended action, channels, voice, success measure, and
  restricted topics.
- List every criterion with its state and linked asset versions.

## Source and claim ledger

- Show each source's reference, observation time, freshness, and classification.
- Render every material claim with its source references, channel limits,
  required approval kinds, restrictions, and support state.
- Never turn a missing, stale, or conflicting source into a supported claim.

## Versioned assets

- List each output path, channel, version, claim references, criterion
  references, review state, and unchanged `not-published` state.
- The record describes readiness; it is not a CMS or the content itself.

## Approval record

- Preserve reviewer identity and type, approval kind, exact asset and version,
  claim scope, evidence, decision, and decision time.
- A pending review has no decision time. Never infer approval from silence.

## Measurement handoff

- Show definitions and accountable owners, not invented observations or
  outcomes.
- Keep missing definitions visible as blockers.

## Questions, blockers, and honest state

- Route every open question to its named human or team.
- A blocked handoff lists every unresolved source, claim, criterion, asset,
  approval, metric, and question.
- `ready-for-publication` requires exact-version approval for every required
  review kind, including the channel owner; it still does not mean published.

## Authority and private handoff

- Include every source, claim, asset, approval, metric, criterion, and question.
- Preserve all prohibited actions.
- Do not publish, schedule, distribute, mutate a CMS, message an audience,
  represent approval, or claim measured results.
