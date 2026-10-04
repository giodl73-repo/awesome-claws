# Payroll comparison review draft

Private gross-component workpaper. No payroll approval or release.

EMPLOYER-DEMO; DEMO-USD; USD; regular; current 2026-10 draft 1 versus 2026-09 revision FINAL-SEP.
As of 2026-10-02T12:00:00-07:00. Payroll reviewer: Payroll owner. Input owner: Payroll input owner. Private recipient: Payroll owner private review. Policy: GROSS-REVIEW-1.
Prior source: PRIOR-REGISTER, observed 2026-09-30T12:00:00-07:00, owner-declared complete. Draft source: DRAFT-REGISTER-1, observed 2026-10-02T10:00:00-07:00, owner-declared complete.

## Component workpaper

| Employee | Component | Prior observed | Draft observed | Supplied expected | Movement | Draft minus expected | Exceptions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| E-01 | BASE | 3000.00 | 3300.00 | 3300.00 | 300.00 | 0.00 | Within supplied expectation/tolerance |
| E-02 | BASE | 2500.00 | 2500.00 | 2500.00 | 0.00 | 0.00 | Within supplied expectation/tolerance |
| E-02 | BONUS | 200.00 | 200.00 | 0.00 | 0.00 | 200.00 | amount-difference |
| E-03 | BASE | 3000.00 | 3000.00 | 3000.00 | 0.00 | 0.00 | Within supplied expectation/tolerance |
| E-03 | HOURS-ADJUSTMENT | Absent (0 comparison placeholder) | Absent (0 comparison placeholder) | -100.00 | 0.00 | 100.00 | missing-draft, amount-difference |

## Totals and reconciliation

| Basis | Sum of supplied rows / expectations | Owner control total | Control |
| --- | ---: | ---: | --- |
| prior | 8700.00 | 8700.00 | matched |
| draft | 9000.00 | 9000.00 | matched |
| expected | 8700.00 | 8700.00 | matched |

Observed movement: 300.00. Expected movement: 0.00. Draft minus expected: 300.00.
Absolute amount outside supplied tolerances: 300.00. Exception keys: 2. Absent draft components: 1.
A matched control total does not clear row exceptions. Incomplete exports and duplicate keys do not support a complete comparison. An absent row is not an observed zero.

## Input coverage and source lineage

- E-01/BASE: prior rows P1; draft rows D1; expectation inputs CHANGE-1; expected movement 300.00.
- E-02/BASE: prior rows P2; draft rows D2; expectation inputs BASELINE-2; expected movement 0.00.
- E-02/BONUS: prior rows P3; draft rows D3; expectation inputs NO-REPEAT-2; expected movement -200.00.
- E-03/BASE: prior rows P4; draft rows D4; expectation inputs BASELINE-3; expected movement 0.00.
- E-03/HOURS-ADJUSTMENT: prior rows none; draft rows none; expectation inputs CHANGE-3; expected movement -100.00.
- CHANGE-1: E-01/BASE, approved-change, 3300.00 USD; applied within supplied scope; EMPLOYER-DEMO/DEMO-USD/regular, approved, Payroll input owner, 2026-10, draft 1, effective 2026-10-01 through 2026-10-31, decided 2026-10-01T09:00:00-07:00 (SOURCE-CHANGE-1); supporting references OWNER-CHANGE-1.
- BASELINE-2: E-02/BASE, baseline, 2500.00 USD; applied within supplied scope; EMPLOYER-DEMO/DEMO-USD/regular, approved, Payroll input owner, 2026-10, draft 1, effective 2026-10-01 through 2026-10-31, decided 2026-10-01T09:00:00-07:00 (SOURCE-BASELINE-2); supporting references OWNER-BASELINE.
- NO-REPEAT-2: E-02/BONUS, one-off-expiry, 0.00 USD; applied within supplied scope; EMPLOYER-DEMO/DEMO-USD/regular, approved, Payroll input owner, 2026-10, draft 1, effective 2026-10-01 through 2026-10-31, decided 2026-10-01T09:00:00-07:00 (SOURCE-NO-REPEAT-2); supporting references BONUS-SEP, OWNER-NO-REPEAT-RULE.
- BASELINE-3: E-03/BASE, baseline, 3000.00 USD; applied within supplied scope; EMPLOYER-DEMO/DEMO-USD/regular, approved, Payroll input owner, 2026-10, draft 1, effective 2026-10-01 through 2026-10-31, decided 2026-10-01T09:00:00-07:00 (SOURCE-BASELINE-3); supporting references OWNER-BASELINE.
- CHANGE-3: E-03/HOURS-ADJUSTMENT, approved-change, -100.00 USD; applied within supplied scope; EMPLOYER-DEMO/DEMO-USD/regular, approved, Payroll input owner, 2026-10, draft 1, effective 2026-10-01 through 2026-10-31, decided 2026-10-01T09:00:00-07:00 (SOURCE-CHANGE-3); supporting references OWNER-CHANGE-3.

## Exact reviewer questions

- E-02/BONUS (Payroll owner): Explain or correct the repeated October bonus. BONUS-SEP is September-only; SOURCE-NO-REPEAT-2 supplies zero for October. An unchanged amount is not evidence of recurrence approval.
- E-03/HOURS-ADJUSTMENT (Payroll owner): Reconcile the missing CHANGE-3 adjustment with the provider draft. Supply the corrected register or an explicit revised input decision; an absent row is not an observed zero.
- Exact revision (Payroll owner): Supply a corrected exact provider draft revision or an explicit revised owner input decision, then repeat component coverage and amount checks.

## Cutoff and private handoff

Cutoff: not supplied; not-supplied.
Supply the payroll review cutoff with timezone and remaining provider dependencies; cutoff readiness cannot be determined.
Unresolved keys: E-02/BONUS, E-03/HOURS-ADJUSTMENT. Reviewed draft: 1.
Unavailable checks: tax, deductions, net-pay, benefits, statutory. No statutory amounts were calculated.
Re-review any corrected provider revision against current scoped owner inputs. Verify original authorized sources and actual workpaper text; metadata checks do not authenticate approvals or guarantee complete sensitive-data removal.
No payroll correctness, compliance, approval, funding, release, system change or employee contact is claimed.
