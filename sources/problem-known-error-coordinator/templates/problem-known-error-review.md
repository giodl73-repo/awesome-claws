# Problem lifecycle review

## Current revision

- Problem: `problem-checkout-timeout`
- State: open
- Membership coverage: 3 / 3 owner-signed incidents
- Trust: caller keyring and signatures valid

## Hypothesis matrix

| Hypothesis | QA result | Disposition |
| --- | --- | --- |
| Route-cache timeout regression | supports | supported |
| Primary database saturation | refutes | refuted |

## Workaround and known error

- Workaround: owner-approved, active, unexpired, unpublished, not executed by
  the Claw.
- Known error: owner-declared, unpublished, bound to the supported hypothesis
  and current workaround revision.

## Change and recurrence

- Change: owner-executed and verified; exact Change Control artifact and plan
  bound.
- Recurrence: observed after finalization and later incident membership.

## Authority boundary

No inferred correlation or root cause. No workaround approval/execution,
known-error publication, production change, closure, mutation, or risk
acceptance.

The complete fallback is
`outputs/problem-known-error-coordinator-handoff.md`.
