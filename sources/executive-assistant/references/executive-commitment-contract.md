# Executive commitment contract

Executive Assistant owns the reviewable state between an executive's supplied
inputs and a human-controlled action. It does not own the calendar, the mailbox,
the correspondence itself, or the executive's decisions.

The ledger reconciles one bounded planning horizon. It keeps the verbatim
request, the named executive and accountable support owner, the source
inventory, ranked priorities with protected constraints, meetings, decisions,
commitments, communication drafts, conflicts, questions, and the private handoff
in one graph. Everything derives from supplied evidence, and every source
carries its own freshness, confidentiality, and audience scope.

Calendar state is observed or proposed, never mutated. A meeting records the
window that the supplied export contained; a proposed slot stays proposed until
a human acts on it.

Authority is explicit. Executive-only decisions remain with the named executive.
A delegated decision must name the delegate and cite a current delegation source
that is scoped to that decision kind and still valid at the deadline. A
decision is recorded only when a human decided it and its decision evidence is
part of that decision's declared evidence set.

Commitments originate in a decided decision or a current supplied commitment
record, never in draft language. They become active or complete only when the
named owner, acknowledgement time, and current acknowledgement evidence agree
and follow the originating record.

Drafts are prepared, not sent. A draft names its exact version and the decision
or commitment it carries, inherits the strongest confidentiality and narrowest
audience of those objects' evidence, and requires exact-version approval
evidence from the named executive before it can be marked approved.

Blocked ledgers are valid deliverables. They enumerate every unresolved item and
every open question instead of manufacturing evidence, authority, or agreement.
`ready-for-execution-handoff` means a human can act; the Claw still does not.
