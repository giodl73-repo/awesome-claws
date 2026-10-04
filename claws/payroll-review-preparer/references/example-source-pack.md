# Synthetic payroll review source pack

Invented evidence for EMPLOYER-DEMO, pay group DEMO-USD, regular run, USD with two
minor-unit digits. Review October 2026 draft revision 1 against September revision
FINAL-SEP, as of October 2 at 12:00 -07:00. Payroll owner is the private reviewer;
Payroll input owner supplies current expectations under GROSS-REVIEW-1. No cutoff
is supplied. All amounts below are integer cents and all people are pseudonymous.

The authorized review universe is E-01/BASE, E-02/BASE, E-02/BONUS, E-03/BASE and
E-03/HOURS-ADJUSTMENT. The owner supplies zero tolerance for each. No other employee
or component is declared in scope. Both synthetic exports are owner-declared
complete for this gross-component universe; this is not live extraction proof.

| Prior row | Employee/component | September amount |
| --- | --- | ---: |
| P1 | E-01/BASE | 300000 |
| P2 | E-02/BASE | 250000 |
| P3 | E-02/BONUS | 20000 |
| P4 | E-03/BASE | 300000 |

PRIOR-REGISTER was observed September 30 at 12:00 -07:00. Declared total: 870000.
No September hours-adjustment row exists. The comparison placeholder is zero,
not an observed row.

| Draft row | Employee/component | October amount |
| --- | --- | ---: |
| D1 | E-01/BASE | 330000 |
| D2 | E-02/BASE | 250000 |
| D3 | E-02/BONUS | 20000 |
| D4 | E-03/BASE | 300000 |

DRAFT-REGISTER-1 was observed October 2 at 10:00 -07:00. Declared total: 900000.
No October hours-adjustment row exists either; do not materialize an observed zero.

Payroll input owner supplies five explicit October expectations, each approved
October 1 at 09:00 -07:00 for draft 1 and applicable October 1 through October 31:

| Input | Expected cents | Kind | Controlled reference | Supporting source |
| --- | ---: | --- | --- | --- |
| CHANGE-1 for E-01/BASE | 330000 | Approved change | SOURCE-CHANGE-1 | OWNER-CHANGE-1 |
| BASELINE-2 for E-02/BASE | 250000 | Unchanged baseline | SOURCE-BASELINE-2 | OWNER-BASELINE |
| NO-REPEAT-2 for E-02/BONUS | 0 | One-off expiry | SOURCE-NO-REPEAT-2 | BONUS-SEP and OWNER-NO-REPEAT-RULE |
| BASELINE-3 for E-03/BASE | 300000 | Unchanged baseline | SOURCE-BASELINE-3 | OWNER-BASELINE |
| CHANGE-3 for E-03/HOURS-ADJUSTMENT | -10000 | Approved change | SOURCE-CHANGE-3 | OWNER-CHANGE-3 |

BONUS-SEP covers September only. OWNER-NO-REPEAT-RULE explicitly supplies October
zero, rather than the preparer inferring pay policy. CHANGE-3 supplies an already
calculated -10000 adjustment; the preparer does not determine hours, tax or
employment entitlement. Declared expected total: 870000.

Expected result in dollars: prior 8700, draft 9000, expected 8700. E-01's +300
movement is supported. E-02's bonus has zero month-to-month movement but a +200
exception against the explicit October expectation. E-03's missing -100 input
contributes another +100 exception. The two exceptions total +300; no tax,
deductions, net-pay, benefits, statutory or cutoff readiness evidence is available.

Ask the payroll owner to explain/correct the repeated bonus, reconcile CHANGE-3,
and supply a corrected exact draft or revised owner input decision. No names,
financial identifiers, system action, approval or release is represented.
