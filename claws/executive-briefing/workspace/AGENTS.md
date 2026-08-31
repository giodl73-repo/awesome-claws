# Operating workflow

## Start here

Ask for or confirm:

- One briefing run id, 07:30-style schedule, positive coverage window, as-of time, completion time, resolvable IANA timezone, and named human or team briefing owner
- One explicitly authorized Google Workspace account, read-only calendars, flagged-mail scope, version-bound document locations, authorization validity, exact one-scope-per-source rules, and source-type freshness cutoffs
- Authorized normalized weather locations and public forecast sources with location binding, issue, observation, retrieval, validity, and affected-window timestamps
- Executive priorities, protected focus periods, audience and classification boundary, decision deadlines, preparation owners, and known prerequisites

## Included capability boundaries

- The gog skill can access broad Google Workspace data through locally configured OAuth; every calendar, mail, and document source must repeat the run-authorized account and exactly its one allowed read scope, and every document must retain a nonempty source version.
- Mail evidence is read-only and label-scoped: a source observation never proves that a message was sent, replied to, forwarded, acknowledged, or acted on.
- Calendar records are observations from current read evidence only; attendance and invitation response are not inferred, and no event is created, accepted, declined, moved, or cancelled.
- Document observations stay bound to their named read-only source and version; the snapshot does not edit, comment on, replace, or otherwise mutate a document.
- The weather skill supplies public forecasts without an API key; bind each source and forecast to one exact run-authorized normalized location, preserve issue and observation times and validity, require affected implication windows to cover linked meetings, and never relabel Seattle evidence as another location.
- Treat fixtures/executive-briefing-snapshot.example.json only as a shape example. Validate outputs/executive-briefing-snapshot.json against schemas/executive-briefing-snapshot.schema.json, then render templates/executive-briefing-snapshot.md without weakening evidence, authority, blockers, classification, audience, or no-delivery state.
- The isolated weekday job has delivery mode none. It creates only a private snapshot and handoff; it does not send the brief, reply to mail, mutate calendars or documents, assign work, make commitments or decisions, disclose protected context, or claim access or completion.

## Structured decision artifact contract

- Treat `fixtures/executive-briefing-snapshot.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/executive-briefing-snapshot.json` and check it against `schemas/executive-briefing-snapshot.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/executive-briefing-snapshot.md` at `outputs/executive-briefing-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bound one isolated briefing run and confirm the owner, window, timezone, private destination, cron delivery none, and no-action authority
2. Inventory only explicitly authorized calendar, flagged-mail, version-bound document, and exact-location weather sources with one exact allowed scope, safe references, observation and retrieval times, type-appropriate freshness cutoffs, classification, and audience
3. Reconcile current evidence into typed agenda and meeting observations while labeling every inference or recommendation and preserving missing or stale prerequisites
4. Create open decision asks and proposed, open, or blocked preparation needs with named human or team owners and deadlines, without deciding, assigning, or completing
5. Bind every conflict kind and statement type to exact evidence; link every schema-permitted conflict object and every blocked preparation or blocker bidirectionally
6. Bind forecasts to run-authorized normalized locations and implications to affected windows that cover linked meetings, while keeping weather as a planning input rather than a safety guarantee
7. Write outputs/executive-briefing-snapshot.json, validate it, render the complete private handoff, and leave delivery not-delivered

## Example setting

**Request:** Prepare a 07:30 Pacific brief for tomorrow using the leadership calendar, flagged mail, the quarterly review documents, and Seattle weather, emphasizing decisions and travel risk.

**Expected outcome:** A blocked private briefing snapshot with current read-only calendar, scoped mail, document, and forecast evidence; observed meetings, open decision asks, proposed preparation, a bidirectional schedule conflict, a missing travel prerequisite, bounded weather implications, and nothing delivered or changed.

## Standard deliverables

- Private executive briefing snapshot for one bounded run
- Authorized source, access, timestamp, freshness, classification, and audience ledger
- Typed agenda and read-only meeting observations with open decision asks and preparation needs
- Evidence-bound bidirectional conflict, preparation blocker, weather forecast and implication, question, and transitive classification graph
- Complete private not-delivered owner handoff and concise narrative view

## Done when

- The positive run window, as-of and completion chronology, IANA timezone, isolated cron, owner, private destination, and no-delivery state are explicit
- Every Workspace source matches the run-authorized account, every source has exactly its one allowed scope, every document has a nonempty version, and every weather source and forecast matches one run-authorized normalized location
- Every source has safe identity, current authorization, observation and retrieval chronology, type-appropriate freshness cutoff, access state, classification, and audience
- Every material agenda item, decision ask, preparation need, conflict, and weather implication cites relevant current evidence, labels observed, inferred, or recommended content honestly, and inherits transitive classification and audience constraints
- Meetings remain current calendar observations with no inferred attendance or invitation response; mail and document claims remain read-only and source-bound; forecasts retain location, issue, observation, and validity windows
- Every decision ask and preparation need names a human or team owner and deadline while remaining open, proposed, or blocked, not decided, assigned, or completed
- Every conflict and preparation blocker link is bidirectional, each conflict kind is evidence-bound, and each weather implication has a valid affected window covering every linked meeting
- The schema-valid blocked or ready-for-review handoff covers every object, exact blocker and question, strongest transitive classification, narrowest transitive audience, prohibited action, and unchanged private not-delivered state

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
