# Executive commitment ledger

Render `outputs/executive-commitment-ledger.json` without weakening its evidence,
authority, or honest state.

## Request, horizon, and authority

- Preserve the request verbatim.
- Name the executive, the accountable support owner, the as-of time, the horizon
  start and end, and the IANA timezone.
- State `blocked`, `ready-for-executive-review`, or `ready-for-execution-handoff`
  exactly as recorded. Execution handoff still performs no action.

## Source inventory

- Show each source's kind, reference, observation time, freshness,
  confidentiality, and audience scope.
- Never present a missing, stale, or conflicting source as current evidence.

## Priorities and protected constraints

- List priorities in rank order with their outcome, sources, timebox, and state.
- Keep every priority tied to executive direction, even when missing or stale
  supporting evidence leaves it blocked.
- Repeat protected constraints verbatim; they bound what may be scheduled,
  drafted, or shared.

## Meetings and calendar state

- Show the supplied window, attendees, priorities, decisions, agenda path, and
  preparation state for each meeting.
- Calendar state is `observed-from-supplied-input` or `proposed-only`. The Claw
  never accepts, declines, books, moves, or cancels anything.

## Decisions, authority, and delegation

- Render each decision with its question, kind, evidence, deadline, and state.
- Executive-only decisions stay with the named executive. A delegated decision
  must name the delegate and cite a current delegation source, scoped to that
  decision kind and still valid at the deadline.
- Record wording, decision time, and evidence only when the human decided. The
  decision evidence must belong to the decision's declared evidence set. The
  Claw never decides.

## Commitments and acknowledgement

- Bind every commitment to its originating decision or supplied record, its
  accountable human or team owner, its deadline, and its timezone.
- A commitment becomes active or complete only when its named owner and type,
  acknowledgement time, and current acknowledgement evidence agree and follow
  the originating decision or record. Never assign work from draft language or
  silence.

## Communication drafts

- Show audience, audience reach, classification, purpose, path, version, and
  the exact decisions or commitments each draft carries.
- Send state stays `not-sent`. A draft never widens the audience or lowers the
  classification of its direct or inherited decision and commitment sources.
- `approved-by-executive` requires the named executive's approval time,
  exact draft version, and current supplied approval evidence.

## Conflicts, risks, and review questions

- List every conflict and risk with its severity, references, and state. Meeting
  and conflict references remain bidirectional.
- Route each open question to its named human or team.

## Honest state and private handoff

- A blocked ledger enumerates every unresolved source, priority, meeting,
  commitment, and evidence or authority gap.
- The handoff includes every source, priority, meeting, decision, commitment,
  draft, conflict, and question, and preserves all prohibited actions.
- Do not send messages, accept or decline meetings, mutate a calendar, commit
  resources, assign commitments, disclose protected context, speak for the
  executive, or claim decisions or acknowledgement.
