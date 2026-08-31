# Executive briefing handoff

## Request

Preserve the request, run id, as-of time, completion time, positive coverage
window, IANA timezone, named human or team briefing owner, exact authorized
Google Workspace account, and normalized authorized weather locations.

## Structured snapshot

- Link `outputs/executive-briefing-snapshot.json`.
- Confirm it validates against
  `schemas/executive-briefing-snapshot.schema.json`.
- Treat the narrative handoff as a view of the snapshot, not the source of
  truth.

## Sources, authorization, and freshness

- List every authorized calendar, flagged-mail, document, and weather source
  with exactly its one allowed read scope, account or weather-location binding,
  document version where applicable, reference, observed and retrieved times,
  freshness cutoff, access state, classification, and audience.
- Keep missing or stale prerequisites visible. Never overstate freshness or
  access.

## Observations, implications, and recommendations

- Separate observed agenda and meeting facts from inferred implications and
  recommended preparation.
- Keep mail and document claims source-bound and read-only.
- Treat forecasts as exact authorized-location and time-bounded planning inputs,
  not safety guarantees. Show each implication's affected window and overlap
  with every linked meeting.

## Decisions, preparation, conflicts, and questions

- List each open decision ask with its human or team owner and deadline.
- List each proposed, open, or blocked preparation need without claiming
  assignment or completion.
- Preserve bidirectional conflict links for agenda, meeting, preparation, and
  weather implication objects. Keep blocked preparation and open blockers linked
  both ways, and route every blocker and question to a named human or team.

## Authority and delivery

- State `blocked` or `ready-for-review` exactly as recorded.
- Keep sending, replying, invitation action, calendar and document mutation,
  commitments, decisions, disclosure, and claims of access or completion
  prohibited, including past, future, passive, and named-subject narrative
  claims. Preserve owner-directed review questions.
- Keep the isolated cron delivery mode `none`, the handoff private, and delivery
  status `not-delivered`.

## Next owner

Name the accountable human or team owner and every exact unresolved blocker and
review question. Review this handoff at
`outputs/executive-briefing-handoff.md`.
