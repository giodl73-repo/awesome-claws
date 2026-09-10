# Operating workflow

## Start here

Ask for or confirm:

- One round id, requestedAt, approved campaign reference and version, caller-supplied trusted zone-bearing RFC 3339 validation asOf, approved private destination, and exact predecessor-certificate export, binding export, authority-roster, approver, and handoff references
- One exact metadata-only predecessor certificate export whose certificate index equals every supplied certificate and whose digest binds each certificate owner, class, rotate or exclude state, exclusion reason, external source digest, and semantic payload digest
- One exact service, listener, and endpoint binding export with complete binding index, per-binding certificate reference, unique endpoint locator, external source digests, and semantic payload digests
- Exactly one owner-approved rotation request per rotate certificate and none for excluded certificates, each bound to its certificate payload, approved campaign and version, approver, grant, and request time
- One CA/provider issuance outcome per request yielding one unique successor version and provider operation id or an exact blocker, one successor deployment observation per binding, and one independent endpoint fingerprint and chain observation per deployment
- Exact retirement or revocation observations only after all bindings validate, or current approver-authored time-bounded overlap states, plus content-bound principal roster and current exact-round grants with reciprocal evidence, strict chronology, and separation among coordinator, exporters, approver, provider, observers, validator, overlap approver, destination approver, and handoff owner
- Exact derived blocker ledger across issuance, deployment, endpoint, and overlap categories, complete coverage proof, payload-bound destination approval, and payload-bound handoff with structural not-claimed fields

## Included capability boundaries

- The base starter uses only supplied metadata artifacts and grants no certificate-authority, key-store, load-balancer, listener, DNS, route, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Certificate authorities and inventory owners retain certificate and binding completeness, issuance authenticity, deployment execution, endpoint identity, overlap authorization, retirement and revocation, readiness, security, compliance, and audit authority.
- Malformed, omitted, duplicated, stale, future, cross-certificate, unbound, self-validated, provider-borrowed, deployment-incomplete, endpoint-mismatched, or content-drifted state fails closed into exact findings and owner handoff.

## Structured decision artifact contract

- Treat `fixtures/tls-certificate-rotation.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/tls-certificate-rotation.json` and check it against `schemas/tls-certificate-rotation.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/tls-certificate-rotation.md` at `outputs/tls-certificate-rotation-verification-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Require a caller-supplied trusted asOf and reject offset-less, malformed, or future metadata without reading the wall clock
2. Recompute the predecessor-certificate and binding export roots, then prove rotate and exclude references are a disjoint exact partition and rotation requests are an exact one-to-one projection of rotate certificates
3. Bind each issuance to its request's unique provider operation, require an issued outcome to yield one unique successor version within the approved campaign, and keep pending, failed, or missing issuance as an exact blocker
4. Require one successor deployment observation per binding that deploys only the issued successor version, and one independent endpoint fingerprint and chain observation per deployment authored by a separated validator
5. Admit a retirement or revocation observation only after every binding of the predecessor is deployed and independently validated; otherwise require a current approver-authored time-bounded overlap and a blocker
6. Derive blocker category and subject equality across issuance-pending, issuance-failed, issuance-missing, deployment-missing, deployment-failed, endpoint-missing, endpoint fingerprint mismatch, endpoint chain failure, and overlap retention
7. Recompute the non-circular plan, coverage, destination, and handoff roots over semantic payloads and evidence records, then emit a blocked owner handoff whenever the exact derived blocker set is non-empty

## Example setting

**Request:** Verify this supplied predecessor TLS certificate inventory and service/listener/endpoint binding inventory for the approved rotation campaign. Record the owner's approved rotation requests, track each CA/provider issuance to a successor version, confirm successor deployment and independent endpoint fingerprint and chain observations, and show exact retirement or approved temporary overlap. Do not read private keys or certificate bodies, issue or deploy certificates, change listeners, DNS, or routes, restart, revoke, disable, or delete anything, or claim rotation completion.

**Expected outcome:** A metadata-only verification artifact partitions nine predecessor certificates into eight rotate and one excluded certificate, records one clean rotation retired after validation, one fully validated certificate held in approved temporary overlap, one pending and one failed CA issuance, one missing and one failed deployment, one endpoint fingerprint mismatch, and one chain failure, then hands the complete blocked evidence set to the approved TLS owner without claiming issuance, deployment, revocation, readiness, security, compliance, audit, or rotation completion.

## Standard deliverables

- Exact metadata-only predecessor certificate and service/listener/endpoint binding inventories with rotate and exclude partition proof and explicit external trust roots
- Owner-approved rotation requests and separately authored CA/provider issuance outcomes yielding one successor version per issued rotation or an exact blocker
- Successor deployment observations per binding and independent endpoint fingerprint and chain observations per deployment, with provider success never implying deployment or endpoint success
- Exact retirement or revocation only after all bindings validate, or current approver-authored time-bounded overlap, with exact blocker equality across issuance, deployment, endpoint, and overlap categories
- Content-bound authority, evidence, coverage, destination, and owner handoff records with every private-key, certificate-body, issuance, deployment, listener-route, restart, revocation, disable, deletion, readiness, identity, security, compliance, audit, and rotation-completion claim structurally not-claimed

## Done when

- The certificate export equals the complete predecessor ledger and rotate plus exclude references form a disjoint exact partition, while rotation requests equal rotate certificates exactly and the binding export equals every supplied binding
- Every rotation request, issuance, deployment, endpoint observation, retirement, and overlap binds its subject by semantic payload digest rather than id alone, with no certificate, binding, request, issuance, deployment, observation, grant, or evidence reuse and unique successor and provider-operation identities
- CA/provider issuance success never implies deployment or endpoint success and is never borrowable across requests; a match requires a deployed observation of the exact successor version
- Retirement or revocation is admissible only after every binding of the predecessor is deployed and independently validated; otherwise the predecessor is held in a current approver-authored time-bounded overlap
- The blocker ledger exactly equals every derived issuance, deployment, endpoint, and overlap category and subject pair, and the handoff cannot become ready while any blocker exists
- Roles, grants, and evidence chronology are causal and authorized under current exact-round grants held by pairwise separated roles, all modeled objects are closed, malformed validation is total, and every prohibited authority claim remains structurally not-claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
