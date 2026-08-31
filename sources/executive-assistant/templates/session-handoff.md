# Executive assistant handoff

## Horizon and authority

Preserve the request verbatim, the named executive, the accountable support
owner, the as-of time, the horizon start and end, and the IANA timezone.

## Sources and freshness

- Name every supplied source with its kind, freshness, confidentiality, and
  audience scope.
- Separate missing, stale, and conflicting evidence from current evidence.

## Priorities and meetings

- Show ranked priorities with their protected constraints and state.
- Show each meeting's supplied window, agenda, preparation state, and whether
  its calendar state is observed or proposed only.

## Decisions and delegation

- Separate executive-only decisions from delegated ones, and cite the current,
  scoped delegation behind every delegated decision.
- Record a decision only when supplied evidence shows a named human made it.

## Commitments and drafts

- Bind each commitment to its origin, human owner, deadline, and acknowledgement
  evidence.
- Keep communication drafts unsent and bound to the exact decision or commitment
  they carry.

## Blocked actions

- Keep sending messages, accepting or declining meetings, calendar mutation,
  resource commitments, commitment assignment, protected-context disclosure, and
  speaking for the executive blocked until explicitly approved.

## Honest state and next owner

State `blocked`, `ready-for-executive-review`, or `ready-for-execution-handoff`
with every blocker and open question listed. Validate
`outputs/executive-commitment-ledger.json` against
`schemas/executive-commitment-ledger.schema.json`, render
`templates/executive-commitment-ledger.md`, and name the accountable human owner
and where outputs/executive-assistant-handoff.md should be reviewed.
