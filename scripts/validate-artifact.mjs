import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { root } from "./catalog-source.mjs";

const [id, input] = process.argv.slice(2);
if (!id || !input) {
  throw new Error("Usage: npm run validate:artifact -- <claw-id> <artifact.json>");
}
const schemaNames = {
  "appliance-care-coordinator": "appliance-care.schema.json",
  "benefits-open-enrollment-planner": "benefits-enrollment.schema.json",
  "care-circle-coordinator": "care-circle.schema.json",
  "case-continuity-coordinator": "case-checkpoint.schema.json",
  "certification-renewal-planner": "certification-renewal.schema.json",
  "conference-opportunity-scout": "conference-opportunities.schema.json",
  "change-control-operator": "change-plan.schema.json",
  "child-activity-manager": "activity-logistics.schema.json",
  "civic-data-analyst": "civic-evidence.schema.json",
  "data-analyst": "analysis-state.schema.json",
  "delegation-coordinator": "delegation-ledger.schema.json",
  "document-intake-analyst": "document-intake.schema.json",
  "document-renewal-tracker": "document-renewal.schema.json",
  "fantasy-sports-manager": "fantasy-roster.schema.json",
  "financial-analyst": "financial-scenario.schema.json",
  "feed-intelligence-monitor": "feed-intelligence-delta-ledger.schema.json",
  "freelance-client-pipeline": "freelance-pipeline.schema.json",
  "fundraising-campaign-manager": "campaign-claim.schema.json",
  "games-backlog-manager": "game-backlog.schema.json",
  "gift-relationship-manager": "gift-plan.schema.json",
  "green-thumb-coordinator": "garden-plan.schema.json",
  "health-records-binder": "health-records.schema.json",
  "home-repair-coordinator": "home-repair.schema.json",
  "household-budget-steward": "household-budget.schema.json",
  "home-inventory-binder": "home-inventory.schema.json",
  "household-steward": "household-operations.schema.json",
  "insurance-policy-organizer": "insurance-policy.schema.json",
  "invoice-payment-followup": "invoice-receivables.schema.json",
  "job-application-tracker": "job-application.schema.json",
  "life-timeline-keeper": "life-timeline.schema.json",
  "local-events-watcher": "event-watchlist.schema.json",
  "meal-grocery-planner": "meal-grocery.schema.json",
  "media-evidence-reviewer": "media-evidence.schema.json",
  "medical-appointment-prep": "medical-appointment.schema.json",
  "meeting-intelligence": "meeting-record.schema.json",
  "model-evaluation-adjudicator": "model-evaluation.schema.json",
  "moving-checklist-coordinator": "moving-plan.schema.json",
  "movie-streaming-organizer": "movie-streaming.schema.json",
  "music-organizer": "music-library.schema.json",
  "neighborhood-operations-watcher": "neighborhood-operations.schema.json",
  "personal-archive-curator": "archive-index.schema.json",
  "pet-care-coordinator": "pet-care.schema.json",
  "pond-water-feature-coordinator": "pond-system.schema.json",
  "professional-networking-followup": "networking-followup.schema.json",
  "public-company-watcher": "company-disclosure-ledger.schema.json",
  "research-monitor": "topic-watch-delta-ledger.schema.json",
  "research-scout": "research-evidence-delta.schema.json",
  "web-evidence-researcher": "claim-evidence-investigation-ledger.schema.json",
  "resume-portfolio-curator": "resume-portfolio.schema.json",
  "project-manager": "project-state.schema.json",
  "product-manager": "product-decision.schema.json",
  "purchase-researcher": "purchase-research.schema.json",
  "public-safety-monitor": "public-safety-state.schema.json",
  "recruiting-coordinator": "interview-plan.schema.json",
  "restaurant-venue-scout": "venue-shortlist.schema.json",
  "research-briefing": "research-brief.schema.json",
  "sales-operations": "pipeline-review.schema.json",
  "school-coordinator": "school-logistics.schema.json",
  "sports-team-watcher": "sports-team-watch.schema.json",
  "spreadsheet-analyst": "spreadsheet-change.schema.json",
  "stock-portfolio-monitor": "stock-portfolio.schema.json",
  "subscription-manager": "subscription-ledger.schema.json",
  "tax-document-organizer": "tax-document.schema.json",
  "travel-concierge": "travel-shortlist.schema.json",
  "travel-planner": "itinerary-plan.schema.json",
  "travel-loyalty-points-organizer": "travel-loyalty.schema.json",
  "vehicle-service-coordinator": "vehicle-service.schema.json",
  "wardrobe-organizer": "wardrobe-plan.schema.json",
  "warranty-returns-manager": "warranty-returns.schema.json",
  "website-evidence-collector": "website-capture-evidence-ledger.schema.json",
  "work-chief-of-staff": "operating-portfolio.schema.json",
};
const schemaName = schemaNames[id];
if (!schemaName) {
  throw new Error(`No structured artifact validator is registered for ${id}.`);
}
const schema = JSON.parse(
  await readFile(join(root, "claws", id, "schemas", schemaName), "utf8"),
);
const value = JSON.parse(await readFile(resolve(input), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const schemaValid = validateSchema(value);
const semanticFindings = schemaValid ? validateArtifactSemantics(id, value) : [];
const result = {
  schemaVersion: "awesomeClaws.artifactValidation.v1",
  id,
  valid: schemaValid && semanticFindings.length === 0,
  schemaErrors: validateSchema.errors ?? [],
  semanticFindings,
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exitCode = 1;
}
