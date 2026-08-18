# Awesome Claws review policy

Read `CONTRIBUTING.md` and `docs/contribution-admission.md` before reviewing a
starter proposal or pull request. `catalog.json` and `sources/<claw-id>/` are
authoritative; `claws/`, `CHOOSER.md`, and `catalog-chooser.json` are generated.

For a new Claw:

1. Run `npm run review:contribution -- --id <claw-id>` or use `--proposal`.
2. Compare the actual user, repeatable job, workflow, outputs, authority, and
   proof with the nearest existing Claws.
3. Prefer improving an existing Claw when the proposal changes only audience,
   industry vocabulary, persona, or presentation.
4. Treat a new source/evidence model, operational workflow, output contract, or
   authority boundary as possible evidence for a distinct Claw.
5. Never decide from title or lexical similarity alone. The generated overlap
   report is advisory and must be reconciled with the contributor's explicit
   comparisons.
6. Keep `needs human` for unresolved product judgment. Do not auto-close,
   auto-fix, or auto-merge a new-Claw proposal based only on similarity.

For pull requests, require the contribution record, current Control UI
screenshot, generated-output agreement, and `npm run check`. Capability-bearing
Claws also need the proof lane named by the admission guide. Do not add a new
Claw id to `contribution-policy.json`; that list freezes the pre-policy catalog.
