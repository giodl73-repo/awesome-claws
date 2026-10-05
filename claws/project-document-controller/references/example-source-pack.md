# Synthetic PKG-4 source pack

These invented records exercise document-control behavior; no live project,
engineering decision, EDMS inspection or distribution is represented.

Project DEMO requires D-101 (Service installation drawing) and D-102 (Required
connection drawing). Register R1 is prepared at 2026-10-02 12:00 +01:00 for the
Document controller's private review. Project engineer owns use decisions;
Information owner owns recipient access. The register's intended use is construction.

PROJECT-RULES-1 supplies two status meanings: FR is for review, not construction
authorization; AFC is an approved-for-construction status label, but receipt alone
does not establish an engineering decision or authority to issue. No other code
meanings are supplied.

| Receipt | Document | Revision | Received (+01:00) | Status | File reference |
| --- | --- | --- | --- | --- | --- |
| D101-A | D-101 | A | 2026-09-01 09:00 | FR | FILE-D101-A |
| D101-B | D-101 | B | 2026-09-10 09:00 | FR | FILE-D101-B |
| D101-C | D-101 | C | 2026-10-01 09:00 | FR | FILE-D101-C |

The synthetic intake marks all three files available. This repository contains
the metadata exercise, not real engineering drawings. D-102 has no receipt or file.

ENGINEER-DECISION-7 (ENG-7), supplied by Project engineer on September 12 at
10:00 +01:00, explicitly approves D101-B for construction. It does not approve
D101-C. No explicit supersession, withdrawal or continued-use direction after
receipt of C is supplied. Thus C is the latest receipt, B is the historical last
approval, and current construction use remains unresolved.

Submittal S-4 references D101-C, belongs to Project engineer, and has an October 5
17:00 +01:00 deadline. No response is supplied. RFI-8 references D101-A, belongs
to RFI owner, and has an October 1 17:00 +01:00 deadline. No response is supplied;
it is overdue at the package as-of time. Later receipts do not rewrite the RFI.

Draft T-9 revision T1 proposes D101-B for Site team for construction. Neither
recipient-access evidence nor exact-draft issue authorization is supplied. Hold
the draft for current-use clarification and both permission decisions. Do not
silently replace B with C or issue the draft.

Expected work product: two-row register, full three-revision history, two exact
document questions, open S-4 and overdue RFI-8 follow-ups, the held T-9/T1 manifest,
and a private handoff retaining D-101, D-102, S-4, RFI-8 and T-9.
