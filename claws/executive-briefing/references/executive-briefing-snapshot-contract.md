# Executive briefing snapshot contract

Executive Briefing owns one private, reviewable snapshot of a bounded briefing
run. It does not own calendar, mailbox, document, or weather-provider state, and
it does not make the narrative prose brief authoritative.

The snapshot records the request, run and coverage chronology, configured
isolated trigger, explicit source authorization, source-specific freshness
cutoffs, source timestamps, agenda and meeting observations, open decision
asks, proposed preparation needs, conflicts, weather forecasts and implications,
review questions, blockers, and the complete private handoff in one graph.
Observed facts remain distinct from inferences and recommendations.

The run names one authorized Google Workspace account. Every calendar, mail, and
document source repeats that exact account identity and has exactly one
source-type scope: `calendar.read`, `mail.read.flagged`, or `documents.read`.
Weather sources carry no Workspace account and have exactly
`weather.read.public`. Calendar entries are observations backed by current
read-scoped calendar evidence. Attendance and invitation response are not
inferred. Mail-derived items do not claim sending or replying. Document-derived
claims stay linked to a nonempty read-only `sourceVersion`.

The run also declares normalized authorized weather locations. Each weather
source names one of those location ids, each forecast repeats the exact
authorized location object, and each implication declares an affected window
inside forecast validity. An implication linked to a meeting must overlap that
meeting. Forecasts remain planning inputs, not guarantees.

Decision asks name the human or team that decides and remain open. Preparation
needs name a proposed owner but remain unassigned and not completed. This
snapshot intentionally contains no delegation grant, commitment
acknowledgement, or durable horizon ledger: those belong to Executive
Assistant, not to a recurring briefing run.

Every object inherits the strongest classification and narrowest audience
through its complete reference graph, including referenced objects and their
transitive sources; cycles do not weaken the result. Conflict links are
bidirectional for every schema-permitted object. Conflict kinds cannot be
relabeled: schedule overlaps require observed overlapping calendar windows,
missing prerequisites require observed missing/unavailable evidence, source
staleness requires observed stale evidence, and weather risks require typed
weather implications and current weather evidence. Blocked preparation and open
blockers also link both ways.

A blocked snapshot enumerates every source or prerequisite gap and routes exact
questions to human or team owners. A ready-for-review snapshot only means the
private read-only synthesis is reviewable; it does not authorize delivery or
action. Cron delivery remains `none`, the artifact remains `not-delivered`, and
past, future, or passive claims of sending, replying, invitation action,
calendar or document mutation, commitments, decisions, disclosure, and
unsupported access or completion remain prohibited. Owner-directed questions
remain permitted.
