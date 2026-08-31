# Executive briefing snapshot

Render `outputs/executive-briefing-snapshot.json` without weakening source
freshness, classification, audience, authority, or honest state. The narrative
brief is a view of the snapshot, not the source of truth.

## Run, window, and authority

- Preserve the request, run id, as-of and completion times, positive briefing
  window, IANA timezone, named human or team owner, and exact state.
- Show the exact authorized Google Workspace account and normalized authorized
  weather locations for this run.
- Show the isolated scheduled trigger and unchanged cron delivery mode `none`.
- State `blocked` or `ready-for-review` exactly as recorded.

## Authorized source and freshness ledger

- Show every calendar, mail, document, and weather source with its safe
  reference, current authorization, exact one allowed read scope, observed and
  retrieved times, freshness cutoff, access state, classification, and audience.
- For calendar, mail, and document sources, show the Workspace account and
  require it to equal the run account. For documents, show the nonempty source
  version. For weather, show the authorized normalized location id and no
  Workspace account.
- Never present stale, missing, future, unauthorized, or unobserved source state
  as current. Do not imply access beyond the recorded source and scope.

## Agenda and meeting observations

- Keep observed statements visibly separate from inferences and
  recommendations.
- Render every agenda item with its current source evidence and linked meetings,
  decision asks, preparation needs, conflicts, and weather implications.
- Meetings are read-only calendar observations. Do not infer attendance,
  acceptance, decline, or any calendar mutation.

## Decision asks

- Name the exact question, rationale, human or team decision owner, deadline,
  sources, and open state.
- A decision ask remains open and records no decision. The Claw does not decide.

## Preparation needs

- Name the proposed task, accountable human or team owner, due time, evidence,
  linked agenda or meeting, and blocker.
- Keep preparation `proposed`, `open`, or `blocked`, with assignment
  `not-assigned` and completion `not-completed`.

## Conflicts and prerequisites

- Preserve schedule overlaps, source staleness, missing prerequisites, and
  weather risks with their evidence, severity, and state.
- Do not relabel conflicts: bind each kind and statement type to actual
  overlapping calendar, missing/unavailable, stale, or weather evidence.
- Keep agenda, meeting, preparation, weather implication, and conflict
  references bidirectional.

## Forecasts and weather implications

- Show the forecast's exact run-authorized location, issued and observed times,
  validity window, public source, and summary.
- Label each implication as inferred or recommended. Weather remains a planning
  input, never a safety guarantee.
- Show each implication's affected window inside forecast validity; it must
  overlap every linked meeting.

## Questions, blockers, and honest state

- Route every question and blocker to a named human or team and preserve its
  exact source and object references.
- Keep blocked preparation and open blocker references bidirectional. Nonblocked
  preparation cannot retain an open blocker.
- A blocked snapshot names every missing or stale source and each preparation or
  prerequisite it blocks. A ready snapshot has no open blocker.

## Classification, delivery, and private handoff

- Each object inherits the strongest classification and narrowest audience of
  referenced objects and their transitive source evidence, even across cycles.
- Include every source, agenda item, meeting, decision ask, preparation need,
  conflict, forecast, implication, blocker, and review question exactly once.
- Keep the handoff private at `outputs/executive-briefing-handoff.md`, with
  delivery mode `none` and status `not-delivered`.
- Do not send or reply, accept or decline invitations, create or modify calendar
  events, mutate documents, make commitments or decisions, disclose protected
  context, or claim unverified access or completion.
