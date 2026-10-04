# Service dispatch draft

NOT APPROVED - NOT DISPATCHED

Feasible against the supplied constraints; not an optimality, safety or arrival guarantee.

Date: 2026-10-05 | Timezone: America/Chicago | Dispatcher: Maya Chen
Scope revision: dispatch-r1 | Current input fingerprint: sha256:7221caa1924148e0e0f108ae275f0d859ead7b260aeef1e27b9e1f5cc1c0dddc
Schedule-bound fingerprint: sha256:7221caa1924148e0e0f108ae275f0d859ead7b260aeef1e27b9e1f5cc1c0dddc
Priority rule: Keep fixed appointments; consider lower priority numbers first. Explain unassigned work for dispatcher review.

## Findings

No feasibility findings. Source authenticity and priority tradeoffs still require dispatcher review.

## Technician itineraries

### TECH-A

Shift: 2026-10-05T08:00-05:00 to 2026-10-05T17:00-05:00; DEPOT to DEPOT.

| Job or break | Site | Start | Finish | Fixed |
| --- | --- | --- | --- | --- |
| JOB-1 | SITE-A | 2026-10-05T09:00-05:00 | 2026-10-05T10:00-05:00 | yes |
| JOB-2 | SITE-B | 2026-10-05T10:30-05:00 | 2026-10-05T11:30-05:00 | no |
| BREAK-A | DEPOT | 2026-10-05T12:00-05:00 | 2026-10-05T12:30-05:00 | yes |

| From | To | Available after | Next stop starts | Travel minutes | Buffer | Slack minutes |
| --- | --- | --- | --- | --- | --- | --- |
| DEPOT | SITE-A | 2026-10-05T08:00-05:00 | 2026-10-05T09:00-05:00 | 20 | 0 | 40 |
| SITE-A | SITE-B | 2026-10-05T10:00-05:00 | 2026-10-05T10:30-05:00 | 30 | 0 | 0 |
| SITE-B | DEPOT | 2026-10-05T11:30-05:00 | 2026-10-05T12:00-05:00 | 20 | 0 | 10 |
| DEPOT | DEPOT | 2026-10-05T12:30-05:00 | 2026-10-05T17:00-05:00 | 0 | 0 | 270 |

### TECH-B

Shift: 2026-10-05T08:00-05:00 to 2026-10-05T17:00-05:00; DEPOT to DEPOT.

| Job or break | Site | Start | Finish | Fixed |
| --- | --- | --- | --- | --- |
| BREAK-B | DEPOT | 2026-10-05T12:00-05:00 | 2026-10-05T12:30-05:00 | yes |

No jobs assigned to this technician.

| From | To | Available after | Next stop starts | Travel minutes | Buffer | Slack minutes |
| --- | --- | --- | --- | --- | --- | --- |
| DEPOT | DEPOT | 2026-10-05T08:00-05:00 | 2026-10-05T12:00-05:00 | 0 | 0 | 240 |
| DEPOT | DEPOT | 2026-10-05T12:30-05:00 | 2026-10-05T17:00-05:00 | 0 | 0 | 270 |

## Complete job disposition

| Job | Disposition | Readiness | Explanation |
| --- | --- | --- | --- |
| JOB-1 | Assigned: TECH-A | ready | Supplied owner confirmation: access, parts and required permit checks ready. |
| JOB-2 | Assigned: TECH-A | ready | Supplied owner confirmation: access, parts and required permit checks ready. |
| JOB-3 | Unassigned: readiness | held | Replacement part unavailable; retain the job for human rescheduling. |

## Source register

| Record | Source | Revision |
| --- | --- | --- |
| TECH-A | ROSTER-A | r1 |
| TECH-B | ROSTER-B | r1 |
| JOB-1 | WORK-1 | r1 |
| JOB-2 | WORK-2 | r1 |
| JOB-3 | WORK-3 | r1 |
| Travel valid 2026-10-05 | TRAVEL-TABLE | r1 |

## Changes and dispatcher decisions

No prior schedule supplied; changed-appointment comparison unavailable.

- Resolve findings and verify current parts, access, qualifications and source evidence.
- Review priority tradeoffs and ready-but-unscheduled work; this checker does not prove no better schedule exists.
- Release and any customer or technician communication remain the human dispatcher's decision.
- No booking, cancellation, customer contact, technician dispatch, purchase, invoice or service-system change occurred.
