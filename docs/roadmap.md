# Awesome Claws roadmap

Awesome Claws has 87 maintained starter Claws. The catalog now covers a broad
personal-agent lane, a work-operations lane, and several capstone examples that
show how Claws compose into larger managed workflows.

## Current Shape

| Category | Count | Current emphasis |
| --- | ---: | --- |
| Productivity | 35 | Personal operating systems, personal media, household planning, documents, travel, meetings, and knowledge work |
| Operations | 21 | Workflows with handoffs, queues, events, public safety, facilities, household operations, and manager Claws |
| Analysis | 16 | Research, evidence collection, financial monitoring, public/company watching, data work, and model evaluation |
| Engineering | 8 | Software delivery, incidents, release readiness, security, migration, QA, and controlled local change execution |
| Governance | 4 | Compliance, privacy requests, accessibility review, and data governance |
| Product | 3 | Product decisions, UX synthesis, and experiments |

The strongest recent expansion is practical personal work: vehicle service,
home repair, garden care, pet care, pond and water features, appliance care,
care-circle coordination, favorite sports teams, stock portfolios, movies and
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

## Next Gaps

These are good next candidates because they appear to need distinct evidence
models, authority boundaries, or recurring artifacts, not just renamed versions
of existing Claws.

| Candidate | Why it is distinct | Nearest existing Claws |
| --- | --- | --- |
| Fantasy Sports Manager | Manages fantasy rosters, league rules, waiver windows, trades, matchup evidence, injury uncertainty, and owner-approved lineup decisions. It is adjacent to sports watching, but the job is portfolio/league operations, not fan tracking. | Sports Team Watcher, Games Backlog Manager, Stock Portfolio Monitor |
| Health Records Binder | Organizes longitudinal medical records, labs, imaging references, medication history, provider summaries, and sharing packets. It complements appointment prep but is not tied to a single visit. | Medical Appointment Prep, Document Renewal Tracker, Personal Archive Curator |
| Benefits and Open Enrollment Planner | Tracks employer benefits, coverage options, deadlines, dependent eligibility, plan comparisons, and owner questions without selecting coverage or giving legal/financial advice. | Insurance Policy Organizer, Medical Appointment Prep, Household Budget Steward |
| Home Project Planner | Coordinates multi-step renovations or moving projects with estimates, permits, vendors, budgets, sequencing, and resident constraints. It is broader than repair triage. | Home Repair Coordinator, Facilities Operations Coordinator, Household Steward |
| Travel Loyalty and Points Organizer | Tracks airline, hotel, credit-card rewards, expirations, transfer rules, trip fit, and blocked booking/account actions. It is related to travel planning but has a different evidence and value model. | Travel Concierge, Subscription Manager, Stock Portfolio Monitor |
| Warranty and Returns Manager | Tracks return windows, warranty coverage, repair claims, receipts, serial numbers, and owner-approved escalation without filing claims or contacting merchants. | Home Inventory Binder, Appliance Care Coordinator, Purchase Researcher |
| Civic Services Navigator | Organizes local services, permits, trash/recycling rules, transit, municipal contacts, and deadlines without submitting forms or contacting agencies. | Neighborhood Operations Watcher, Civic Data Analyst, Document Renewal Tracker |
| Learning Plan Coordinator | Tracks courses, assignments, credentials, study plans, learning resources, and review evidence for adults. This is not student logistics or child activities. | School Coordinator, Knowledge Curator, Project Manager |
| Legal Matter Organizer | Organizes supplied legal documents, deadlines, facts, counsel questions, and evidence packets without legal advice, filing, or contacting parties. | Document Renewal Tracker, Tax Document Organizer, Privacy Request Coordinator |

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

1. Add Fantasy Sports Manager as the next personal-agent specialist, because it
   pairs naturally with Sports Team Watcher while proving that Claws can manage
   owner-controlled competitive decisions without betting or account mutation.
2. Add Health Records Binder or Benefits and Open Enrollment Planner next,
   because the medical/document/insurance lane is now strong enough to support a
   useful manager-level story.
3. Add Warranty and Returns Manager to close the ownership lifecycle between
   Purchase Researcher, Home Inventory Binder, Appliance Care Coordinator, and
   Subscription Manager.
4. Promote manager-Claw examples in README and chooser copy once at least one
   more specialist is present in each manager lane.
5. Keep Product and Governance expansion selective. Those categories are smaller
   by design; new entries should only land when they bring a new evidence model
   or authority boundary.
