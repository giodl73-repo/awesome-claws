# Synthetic service-desk migration

State: draft-for-owner-review. Adapter fixture Git revision: 8fc6bc78561f375dd91f0496d3220a02545e0cea.

## Requirements and owner outputs

- req-user-id: Every ticket user ID resolves through the supplied identity table; unknown or blank identities block.
- req-ticket-status: NEW maps to open, WAITING to pending and DONE to closed; unknown states block.
- req-rollback: Restore the exact pre-run target snapshot in memory without mutating the source or snapshot.

- project-manager: artifacts/project.json (SHA-256 d899ffd12f32013d58119ba15da029f317243f89f96e2b85ee2445cf8e8d1f5c).
- api-integration-engineer: artifacts/integration.json (SHA-256 72df770ea4fc8bc310575af21dab5a36c6d309a6d84bf82ed137bd53a603ecca).
- data-migration-planner: artifacts/migration.json (SHA-256 74eae6c1d9a2fc1182585069097211d82a73208b0835fe7f33e8a4971aaba186).
- software-maintainer: artifacts/maintainer.json (SHA-256 7c42c8680813ee2d269e9419d26ab8d5dd9b3684a39c80f9cbf89ef1c259aa70).
- quality-assurance-lead: artifacts/qa.json (SHA-256 9604cc76c7374ee7b5217b52f375b1c01a831d6790fa748dcd0128cfef6a288b).

## Ordered cutover draft

1. Obtain separate cutover authorization and support acceptance; stop while either is missing.
2. Operator freezes writes only within the approved window.
3. Operator captures and verifies source and target snapshots; changed identities require fresh evidence.
4. Run exact-revision acceptance tests and reconciliation against isolated copies; stop on any unmapped value.
5. Only the authorized operator may apply the bounded batch and switch routing after every gate clears.
6. Verify counts, identities, status mappings and error rates; apply rollback on any mismatch.
7. Request the named support owner's acknowledgement with results, limitations and escalation contacts.

Rollback owner: Neil Prakash. Trigger: Any unmapped identity/status, count mismatch, failed acceptance test or error rate above 1%.

1. Stop routing and pause writes under operator authority.
2. Restore the verified pre-cutover target snapshot and prior adapter/routing.
3. Reconcile restored counts and sample IDs before asking the owner to resume service.

## Support handoff

Owner: Sam Lee; queue: service-desk-migration; acceptance pending, no acknowledgement supplied.

Neil Prakash for cutover; Dana Ruiz for mapping; Alex Rivera for adapter.

Synthetic local assertions only; live permissions, load, retention, write recovery and staffing are unverified.

No cutover, migration, deployment, communication or support acceptance occurred. In-memory tests are not live-system or production recovery proof.
