# Private inventory review handoff (synthetic)

Owner: synthetic inventory owner. Every supplied decision is test data, not
real approval. Intended delivery is internal to that owner; the repository
example contains no private business data and sends nothing externally.

| Case | Physical comparison | Selected count | Variance | Open action |
| --- | ---: | ---: | ---: | --- |
| bin-a | 10 | 8 | -2 | Review A separately |
| bin-b | 10 | 12 | +2 | Review B separately |
| receipt | 13 | 12 | -1 | Review complete excluded receipt evidence |
| no-rule | unavailable | 12 | unavailable | Owner supplies snapshot inclusion |
| held | 10 | 10 | 0 | Confirm physical basis including two held units |
| no-basis | unavailable | 10 | unavailable | Owner supplies ownership and status basis |
| missing | 10 | unavailable | unavailable | Supply count observation |
| zero | 10 | 0 | -10 | Review actual zero, not missing data |
| recount | 10 | unavailable | unavailable | Owner selects first (8) or second (10) |

Do not net A and B to claim reconciliation. Do not subtract holds from physical
stock, infer causes or choose the favorable recount. A zero is not certification.
Count review column G holds explicit editable selections; Source rows 20-23
preserve observations and synthetic supplied decisions. Selection alone does
not resolve a missing stock basis. No case is accepted by this evaluation.

Artifact Tool recalculates the workbook, exercises restored input mutations,
exports and reopens it. Native Microsoft Excel and live model execution were
not tested. Both rendered sheets were manually inspected on October 5, 2026:
headers, timestamps, individual variances, missing values and source notes are
visible. The generated manifest deliberately leaves automated formatting
verification not-run; this manual inspection is not an automated visual oracle.

The manifest passes existing Spreadsheet Analyst schema and semantic rules;
those rules do not establish inventory correctness, owner authenticity or stock
completeness. Focused tests apply only to the supplied nine-case example.

Regenerate after any changed source bytes, revisions or owner selections. Saved
hashes detect changed evidence; they are not signatures or source authentication.
The workbook does not monitor external files. Fresh owner review remains required.

No inventory write, adjustment, write-off, purchase, valuation, cause determination,
counting, hold release, certification, external contact or publication is authorized.
No new Claw ID is added; replenishment #208 remains held.
