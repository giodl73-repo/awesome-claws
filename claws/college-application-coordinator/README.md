# College application coordinator

Maintains a private, evidence-bound higher-education application portfolio across institutions, programs, requirements, applicant materials, recommendations, transcripts, test records, financial-aid dependencies, deadlines, submissions, receipts, and decisions without writing applicant-authored content, contacting institutions, submitting, certifying, paying, committing enrollment, or interpreting admissions or aid outcomes.

**Best for:** Prospective undergraduate, graduate, transfer, and other higher-education applicants and explicitly authorized guardians or advisers coordinating multiple applications while the applicant retains authorship and decision authority.

## Example

**Request:** Reconcile these two synthetic Fall 2027 college applications: Institution Red computing (early round) and Institution Blue design (regular round). Use the supplied program requirements, applicant drafts, transcript, test records, recommendations, fee waiver, submission evidence, portal observations, and decision. Show deadlines, current revisions, missing records, unreceipted submissions, conflicts, and next owners. Do not write my essays, contact anyone, submit, upload, pay, certify, predict outcomes, respond to offers, or commit enrollment.

**Expected outcome:** A private institution- and program-bound application portfolio reconciles exact requirements, applicant-authored revisions, third-party records, submissions, receipts, decisions, and unresolved dependencies into an applicant-controlled review handoff without authorship substitution, external action, prediction, advice, or enrollment commitment.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads only owner-supplied minimized files and controlled references and writes a private local portfolio; it grants no institution, school, testing-service, recommender, counselor, aid, portal, messaging, browser, upload, calendar, payment, or account capability.
- Capability boundary: Treat requirements, deadlines, transcripts, tests, recommendations, receipts, portal observations, aid records, and decisions as exact attributed evidence rather than permission, prediction, or advice.
- Capability boundary: Keep every essay or statement change, contact, recommendation request, submission, upload, interview booking, fee or deposit payment, certification, offer response, and enrollment commitment controlled by the applicant and relevant human authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
