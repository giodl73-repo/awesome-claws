---
name: recurring-third-party-review-validator
description: Validate a recurring third-party review artifact with its public trust and source receipts.
---

# Recurring third-party review validator

Use this skill before deriving or presenting a review result. It performs the
package's strict schema, detached-signature, source-receipt, chronology,
freshness, reopening, typed-authority, and evidence-closure checks locally.

Run only the packaged verifier against workspace files:

```text
node skills/recurring-third-party-review-validator/scripts/verify.mjs <artifact.json> <asOf> <public-trust.json> <source-receipts.json>
```

Treat exit code `0` and JSON `"valid": true` as accepted validation. Any other
exit code or result is blocked. Do not install dependencies, invoke another
command, contact a source, or echo rejected input. The verifier only reads the
four named files and writes its structured result to standard output.
