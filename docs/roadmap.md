# Awesome Claws roadmap

Awesome Claws has 100 maintained starter Claws. The catalog now covers a broad
personal-agent lane, a work-operations lane, and several capstone examples that
show how Claws compose into larger managed workflows.

## Current Shape

| Category | Count | Current emphasis |
| --- | ---: | --- |
| Productivity | 47 | Personal operating systems, personal media, fantasy sports, household planning, documents, travel, meetings, and knowledge work |
| Operations | 22 | Workflows with handoffs, queues, events, public safety, facilities, household operations, and manager Claws |
| Analysis | 16 | Research, evidence collection, financial monitoring, public/company watching, data work, and model evaluation |
| Engineering | 8 | Software delivery, incidents, release readiness, security, migration, QA, and controlled local change execution |
| Governance | 4 | Compliance, privacy requests, accessibility review, and data governance |
| Product | 3 | Product decisions, UX synthesis, and experiments |

The strongest recent expansion is practical personal work: vehicle service,
home repair, garden care, pet care, pond and water features, appliance care,
care-circle coordination, favorite sports teams, fantasy sports, stock portfolios, movies and
streaming, subscriptions, music, relationships and gifts, personal archives,
restaurants and venues, local events, school logistics, games backlogs, home
inventory, meals and groceries, insurance policies, tax documents, purchase
research, household budgets, life timelines, child activities, neighborhood
operations, wardrobes, document renewals, and medical appointment prep.

## Manager Claws

Manager Claws coordinate other Claws without absorbing their authority. They
read specialist artifacts, surface conflicts, and prepare owner decisions.

| Manager Claw | Coordinates | Boundary |
| --- | --- | --- |
| Household Steward | Meal and Grocery Planner, Home Inventory Binder, Subscription Manager, Household Budget Steward, Document Renewal Tracker, Medical Appointment Prep, Child Activity Manager, Care Circle Coordinator, Vehicle Service Coordinator, Appliance Care Coordinator, Home Repair Coordinator, Green Thumb Coordinator, Pet Care Coordinator, Pond and Water Feature Coordinator | Keeps household-wide conflicts visible while leaving purchases, appointments, care, payments, messages, and account changes with the owner |
| Work Chief of Staff | Project Manager, Product Manager, Release Coordinator, Recruiting Coordinator, Sales Operations, Customer Support, Procurement Evaluator, Grant Portfolio Manager, Fundraising Campaign Manager, Experimentation Lead, Localization Program Manager | Coordinates portfolio state, decision forums, capacity, and commitments without becoming the executive or functional owner |
| Care Circle Coordinator | Medical Appointment Prep, Document Renewal Tracker, Meal and Grocery Planner, Home Repair Coordinator, Pet Care Coordinator, Child Activity Manager, Gift and Relationship Manager | Coordinates helpers, privacy, consent, logistics, and recipient needs without making care, clinical, financial, legal, scheduling, or messaging decisions |
| Delegation Coordinator | Software Maintainer, Research Briefing, Data Analyst, Document Intake Analyst, Presentation Producer, Spreadsheet Analyst, Model Evaluation Adjudicator | Tracks worker-session scope, evidence, provenance, and handoff quality without granting hidden authority to workers |

## Quality Uplift

The [catalog quality scorecard](catalog-quality-scorecard.md) is now the primary
post-100 prioritization tool. The current baseline has 100 of 100 Claws passing
the non-negotiable package, regression, resource, and Experience gates. The
highest-value portfolio work is depth rather than count:

| Uplift | Baseline | Goal |
| --- | ---: | --- |
| Retrospective admission records | 48 of 100 | Make legacy distinctness decisions reviewable without reopening accepted admissions |
| Structured artifact schemas | 81 of 100 | Add schemas only where a durable structured decision artifact improves the job |
| Semantic artifact validators | 60 of 100 | Enforce provenance, reconciliation, chronology, and authority invariants beyond JSON shape |
| Domain privacy and sensitive-data handling | Manual review, not keyword-scored | Add proportional handling rules where the job touches sensitive material |

The dated [solid-band review](catalog-quality-solid-review.md) separates
schema-ready evidence work from narrative and integration-owned contracts that
should not receive ceremonial schemas.

Potential additions remain subject to the
[contribution admission policy](contribution-admission.md). Civic Services
Navigator, Learning Plan Coordinator, and Legal Matter Organizer remain
plausible candidates. Home Project Planner should first be tested as an
improvement or composition of Moving Checklist Coordinator, Home Repair
Coordinator, Facilities Operations Coordinator, and Household Steward.

## Add Or Improve Existing

Some ideas are likely better as improvements to existing Claws unless a proposal
introduces a materially different workflow:

| Idea | Likely home |
| --- | --- |
| Streaming availability by household service | Movie and Streaming Organizer |
| Music availability by streaming service | Music Organizer |
| Coupon, price-drop, or purchase timing research | Purchase Researcher |
| Portfolio watchlists without holdings | Stock Portfolio Monitor |
| Favorite teams, schedules, standings, and viewing plans | Sports Team Watcher |
| Household-wide conflict rollups | Household Steward |

## Roadmap Order

1. Add structured artifacts and semantic validation to the lowest-scoring
   Claws where the workflow has real cross-field invariants.
2. Backfill legacy contribution records in coherent topic batches, preserving
   the distinction between "not recorded" and "failed admission."
3. Audit privacy and sensitive-data boundaries in high-risk domains; add
   proportional rules rather than keyword-padding the contract.
4. Promote manager-Claw examples in README and chooser copy as their specialist
   lanes become deeper and more interoperable.
5. Keep all category expansion selective. Product and Governance are smaller
   by design; new entries should only land when they bring a new evidence model
   or authority boundary.
