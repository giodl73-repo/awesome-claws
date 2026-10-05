# Payroll comparison review draft

Private gross-component workpaper. No payroll approval or release.

Employer: <alias>; pay group: <group>; currency/scale: <currency and minor digits>.
Run: <run type>; current period/draft: <period and revision>; comparison: <period
and revision>; as of: <timestamp with timezone>; supplied policy: <reference>.
Payroll reviewer: <owner>; input owner: <owner>; private recipient: <recipient>.

## Source scope

<Both register references, observation times, owner-declared completeness and
control totals. Preserve unavailable exports, ambiguous joins and missing scope.>

## Component workpaper

| Employee | Component | Prior observed | Draft observed | Supplied expected | Movement | Draft minus expected | Exceptions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| <pseudonymous key> | <component> | <amount or absent/ambiguous> | <amount or absent/ambiguous> | <scoped owner amount or unknown> | <amount or unknown> | <amount or unknown> | <all unresolved issues> |

Label absent rows explicitly. Zero can be a comparison placeholder only for a
complete supplied export; it is never an invented observed row.

## Totals and reconciliation

| Basis | Sum of supplied rows / expectations | Owner control total | Control |
| --- | ---: | ---: | --- |
| Prior | <amount> | <amount or unavailable> | <matched/mismatched/unavailable> |
| Draft | <amount> | <amount or unavailable> | <matched/mismatched/unavailable> |
| Expected | <amount or unknown> | <amount or unavailable> | <matched/mismatched/unavailable> |

<Observed and expected movements, net variance, absolute exceptions outside
supplied tolerances, exception-key count and absent-draft-component count.
Do not net away offsetting employee errors or imply incomplete totals are final.>

## Input coverage and source lineage

<Every expected/observed/input key, original row references, scoped approval or
rule reference, applicable period, draft revision, effective dates and current
owner. Retain invalid or conflicting inputs as unapplied, not explained.>

## Exact reviewer questions

<One concrete question for every exception, plus missing or mismatched control
totals and the exact corrected provider revision or revised input decision needed.>

## Cutoff and private handoff

<Supplied cutoff with timezone or unknown, remaining owner dependencies, every
unresolved key and exact reviewed draft. A future deadline is not release readiness.>

Unavailable: tax, deductions, net pay, benefits and statutory checks. This output
does not determine correctness, compliance, payroll approval, funding or release.
No provider/HRIS/bank mutation, personnel decision, filing or employee contact.
Review original permitted sources and the actual text before human handoff.
