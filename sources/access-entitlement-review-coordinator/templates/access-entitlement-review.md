# Access entitlement review

Use this template only with `access-entitlement-review.schema.json`.

1. Record the exact owner-supplied round, snapshot, assignment, principal, evidence, authority-grant, signal, decision, non-decision, and blocker ledgers.
2. Recompute the assignment-manifest, authority-roster, evidence-payload, and evidence-record digests.
3. Keep every assignment key visible exactly once across reviewed and excluded populations.
4. Accept only fresh `retain` or `revoke` decisions from named humans holding current-round authority for the exact resource and entitlement.
5. Treat defaults, automation, recommendations, prior decisions, and non-human principals as non-decisions.
6. Render only `blocked` or `ready-for-owner-execution`; do not add replacement, modification, outcome, certificate, compliance, or execution claims.
