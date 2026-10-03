# RFP internal review

WORKFLOW-DEMO; ExampleFlow Enterprise 4.2; RFP revision 1 plus Amendments 1 and 2; revision 1.

Owner: Proposal owner. Deadline: 2026-10-09T17:00:00+02:00.

Delivery format: Buyer DOCX template not supplied; Markdown is a private review format only. Conversion complete: no.

Coverage is not approval, commercial viability or authority to submit.

## Buyer constraints

| Question | Mandatory | Words / limit | Amendments | Attachments |
| --- | --- | --- | --- | --- |
| Q1 | no | 24 / 80 | none | none |
| Q2 | yes | 24 / 50 | none | none |
| Q3 | yes | 42 / 60 | A2 | none |
| Q4 | no | 21 / 60 | none | none |
| Q5 | yes | 25 / 50 | none | none |
| Q6 | no | 21 / 40 | none | none |
| Q7 | no | 35 / 70 | none | none |
| Q8 | yes | 28 / 50 | A1 | SECURITY, DPA |

## Requirement coverage

| Question | Part | State | Source claims |
| --- | --- | --- | --- |
| Q1 | intake | supported | PRODUCT-4.2/forms |
| Q1 | routing | supported | PRODUCT-4.2/routing |
| Q1 | visibility | supported | PRODUCT-4.2/visibility |
| Q2 | support | supported | PRODUCT-4.2/sso |
| Q2 | edition | supported | PRODUCT-4.2/sso |
| Q2 | setup-owner | supported | PRODUCT-4.2/sso-owners |
| Q3 | application-data | gap | REGIONS-2026-10/regions |
| Q3 | backups | gap | REGIONS-2026-10/regions |
| Q3 | logs | gap | REGIONS-2026-10/regions |
| Q3 | regions | gap | REGIONS-2026-10/regions |
| Q4 | formats | supported | PRODUCT-4.2/exports |
| Q4 | roles | supported | PRODUCT-4.2/exports |
| Q4 | attachments | supported | PRODUCT-4.2/exports |
| Q5 | availability | gap | Unresolved |
| Q5 | credits | gap | Unresolved |
| Q6 | customer | gap | Unresolved |
| Q6 | contact-permission | gap | Unresolved |
| Q7 | activities | supported | DELIVERY-2/activities |
| Q7 | date | gap | DELIVERY-2/activities |
| Q8 | security-overview | gap | Unresolved |
| Q8 | data-processing-agreement | gap | Unresolved |

## Source notes

### PRODUCT-4.2

Version 4.2; product ExampleFlow Enterprise 4.2; buyer-permitted; current: yes.

- forms (Q1): Configurable request forms are supported.

- routing (Q1): Sequential approval routing is supported.

- visibility (Q1): Status view shows current step and assigned approver.

- sso (Q2): Enterprise 4.2 supports SAML 2.0 SSO.

- sso-owners (Q2): Customer identity administrator configures the identity provider; workspace administrator configures ExampleFlow.

- exports (Q4): Workspace administrators can export request records as CSV; uploaded attachments are excluded.

### REGIONS-2026-10

Version 2026-10; product ExampleFlow Enterprise 4.2; buyer-permitted; current: yes.

- regions (Q3): Application data, backups and logs are hosted only in the US. EU hosting is unavailable; no approved EU release date.

### DELIVERY-2

Version 2; product ExampleFlow Enterprise 4.2; buyer-permitted; current: yes.

- activities (Q7): Implementation includes discovery, form configuration, SSO setup, user acceptance testing and administrator training. Timing depends on scope, identity-provider access and capacity. No date is approved for this opportunity.

### LIBRARY-2025

Version 2025-06; product Unspecified historical product; internal-only; current: no.

- old-region (Q3): Historical answer says EU hosting available; not current evidence.

- old-sla (Q5): Historical 99.9% and service-credit text; no scoped approval supplied.

## Summary evidence

PRODUCT-4.2/forms, PRODUCT-4.2/routing, PRODUCT-4.2/sso, PRODUCT-4.2/exports, REGIONS-2026-10/regions

## Buyer amendments

- A1: Q8 requires Security Overview revision 3, replacing revision 2.

- A2: Q3 EU-only hosting is now mandatory, not preferred, for application data, backups and logs. Prior preference review cannot carry forward.

## Attachments

- SECURITY: Security Overview, required 3, available 2: wrong-version.

- DPA: Data-processing agreement, required 5, available 5: missing.

## Review history

- REVIEW-Q3-R1: Q3, RFP revision 1: EU hosting preferred, answer 0: superseded (Product reviewer).

## Owner questions

- P0 Product and bid owner (Q3): Review A2, current region evidence, summary and Q3 revision 1. Confirm the mandatory capability gap and decide whether to continue the bid; no exception or roadmap promise is assumed.

- P0 Commercial and Legal (Q5): Provide opportunity-specific availability and service-credit terms or retain both unresolved answers. Historical boilerplate is not current approval.

- P0 Security (Q8): Supply Security Overview revision 3 and intended-buyer disclosure permission. Do not substitute the internal-only revision 2.

- P0 Legal (Q8): Supply the actual revision 5 DPA bytes and verify identity and disclosure scope. Sharing an unexecuted form does not accept terms.

- P1 Account owner (Q6): Supply separate naming and contact permissions or retain the no-authorized-reference answer. No customer outreach is authorized.

- P1 Delivery (Q7): Review exact scope, customer dependencies and capacity before providing any authorized date.

- P1 Bid owner (Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8): Obtain the buyer DOCX template, coordinate conversion and exact-version final review before the deadline. The mandatory gap is not resolved by a complete draft.

## Private notes

- Synthetic worked example only; source assertions and permissions are supplied, not independently authenticated.

- The prior Q3 preference review is superseded for this baseline, not approval of the amended mandatory condition.

- Rejected historical LIBRARY-2025 EU and SLA claims. All supported answers use current product-specific claims.

- REFERENCE-NOTE names Cedar Sample Ltd and reference@example.invalid; naming and contact permissions are absent. Keep both out of buyer copy.

- Mandatory Q3 is not met; Q5 and Q8 remain unresolved. No final-format conversion or submission readiness is claimed.

- Review the summary against all answer and attachment changes; structural citation checks do not prove prose entailment.

## Authority

No submission, attachment distribution, approval, contractual acceptance or commitment performed.
