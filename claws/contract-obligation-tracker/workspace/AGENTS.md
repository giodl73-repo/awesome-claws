# Operating workflow

## Start here

Ask for or confirm:

- One bounded round id, opensAt and closesAt, caller-supplied trusted zone-bearing RFC 3339 validation asOf, fixed contract-owner-review-queue destination, named destination approver, named handoff owner, and exact register and authority-roster references and digests
- One exact owner-confirmed obligation-register version with confirmation time, confirming named owner, source system, complete executed-agreement version index, complete obligation index, owner-authorized content digest, and reciprocal evidence
- Each executed-agreement version with stable logical agreement id, version, execution timestamp, owner repository, owner-supplied complete content digest, and reciprocal executed-copy evidence
- Every registered obligation with exact agreement-version reference, responsible owner, clause locator, owner-supplied clause digest, distinct owner-supplied obligation digest, fixed due timestamp, performance-evidence supplier, and non-empty required-evidence index
- A content-bound authority roster and exact-obligation completion grants with separate named custodian, issuer, and grantee; exact scope and active interval; reciprocal evidence; and current roster and grant payload digests
- Current observations or exact missing-evidence blockers plus reciprocal evidence, with completion represented only by a named-human confirmation under the exact current obligation grant after all relied evidence
- Payload-bound coverage, destination approval, and handoff records carrying exact observation and blocker indexes, structural not-claimed fields, and a named destination-bound next owner

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and grants no contract repository, procurement, legal, finance, payment, filing, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Contract repositories and owners retain executed-agreement completeness, register completeness and reseal authorization, clause and obligation semantics, due-date interpretation, source-record authenticity, roster authenticity, and all performance, legal, communication, payment, amendment, renewal, termination, dispute, and mutation authority.
- Malformed, omitted, duplicated, invented, stale, future, cross-agreement, unbound, unauthenticated, evidence-incomplete, authority-invalid, or destination-drifted state fails closed into exact findings and an owner handoff rather than an interpretation or action.

## Structured decision artifact contract

- Treat `fixtures/contract-obligation-tracker.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/contract-obligation-tracker.json` and check it against `schemas/contract-obligation-tracker.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/contract-obligation-tracker.md` at `outputs/contract-obligation-tracker-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Require a trusted caller-supplied asOf, recompute every internal digest under locale-independent UTF-16 code-unit ordering, and reject offset-less, malformed, future, duplicated, dangling, cross-round, or internally-derived source anchors
2. Verify exact equality among the round, owner-confirmed register, executed-agreement version universe, obligation universe, authority-roster binding, and register digest before evaluating any obligation state; changing the confirmed register root requires explicit owner-authorized resealing
3. Validate agreement-version, clause-locator, clause-digest, and obligation-digest identity so one locator maps to one clause digest per agreement version, one clause digest maps to one locator, and multiple obligations in one clause remain distinct
4. Derive due state only from dueAt against round.closesAt; require not-yet-due observations to rely on no evidence, due evidence-complete obligations to have one pending or owner-confirmed observation, and due evidence-incomplete obligations to have one exact source-evidence-missing blocker and no observation
5. Validate evidence chronology and closure, allowing performance evidence before round.openAt only when it follows agreement execution and strictly precedes its consuming observation and completion, while all other records remain exactly time-bound to their sources and trusted asOf
6. Recompute exact coverage, destination approval, and handoff bindings; emit ready-for-owner-review only with zero blockers, otherwise emit blocked, always to the approved destination and named recipient with every structural authority disclaimer fixed to not-claimed

## Example setting

**Request:** Track this exact owner-confirmed contract-obligation register for the September review round. Show every obligation exactly once with one current evidence-bound observation or the exact missing-evidence blocker, preserve executed-version and clause bindings, and require current named-human authority for any owner-confirmed completion. Do not interpret the agreements, send notices, make payments, accept performance, recommend action, or change any system.

**Expected outcome:** A strict contract-obligation review artifact covering all four registered obligations exactly once: one owner-confirmed completion under a current exact-obligation grant, one evidence-complete observation awaiting owner confirmation, one not-yet-due observation sealed to the round close, and one exact missing-evidence blocker, handed to the approved contract-owner queue with every legal, acceptance, compliance, audit, notice, payment, amendment, renewal, termination, and mutation claim structurally not-claimed.

## Standard deliverables

- Exact round, executed-agreement, owner-confirmed register, obligation, principal, roster, and exact-obligation grant ledgers with recomputed internal consistency digests and explicit external trust roots
- One complete current observation ledger binding every evidence-complete or not-yet-due obligation to its exact agreement version, clause digest, obligation digest, responsible owner, sealed due state, review round, and evidence
- One exact blocker ledger for due obligations whose required performance evidence is missing, with no observation and exact set equality between required missing evidence and blocker targets
- Coverage proof showing every owner-confirmed registered obligation exactly once with exactly one observation or blocker resolution
- Payload-bound destination approval and blocked or ready-for-owner-review handoff containing complete observation and blocker indexes plus structural not-claimed legal, acceptance, compliance, audit, notice, payment, amendment, renewal, termination, and system-mutation fields

## Done when

- The round, register, agreement-version, obligation, roster, coverage, destination, handoff, grant, evidence-payload, and evidence-record digests recompute exactly, while every unique sourceRecordDigest remains explicitly an externally authenticated trust root rather than a derived proof
- The exact agreement-version and obligation universes equal the owner-confirmed register indexes, and each agreement-version plus clause locator maps consistently to one clause digest while distinct obligations remain distinguishable by obligation digest
- Every registered obligation appears exactly once in coverage and has exactly one current observation or one exact blocker, with due state sealed to round.closesAt and unchanged by later valid asOf values
- Every relied performance record follows agreement execution and strictly precedes its consuming observation and completion, and every owner-confirmed completion names a current authorized human under a grant scoped to that exact obligation
- The blocker ledger equals the unresolved due-obligation and exact missing-evidence sets, with no false, omitted, duplicated, cross-obligation, or handoff evidence accepted as performance evidence
- The destination-bound handoff carries exact coverage indexes and all structural not-claimed fields, is blocked whenever any exact blocker remains, and never represents interpretation, acceptance, notice, payment, amendment, renewal, termination, dispute, assurance, or action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
