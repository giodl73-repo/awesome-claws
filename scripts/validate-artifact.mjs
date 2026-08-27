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
  "care-circle-coordinator": "care-circle.schema.json",
  "case-continuity-coordinator": "case-checkpoint.schema.json",
  "change-control-operator": "change-plan.schema.json",
  "civic-data-analyst": "civic-evidence.schema.json",
  "data-analyst": "analysis-state.schema.json",
  "delegation-coordinator": "delegation-ledger.schema.json",
  "financial-analyst": "financial-scenario.schema.json",
  "games-backlog-manager": "game-backlog.schema.json",
  "gift-relationship-manager": "gift-plan.schema.json",
  "green-thumb-coordinator": "garden-plan.schema.json",
  "home-repair-coordinator": "home-repair.schema.json",
  "home-inventory-binder": "home-inventory.schema.json",
  "household-steward": "household-operations.schema.json",
  "insurance-policy-organizer": "insurance-policy.schema.json",
  "local-events-watcher": "event-watchlist.schema.json",
  "meal-grocery-planner": "meal-grocery.schema.json",
  "model-evaluation-adjudicator": "model-evaluation.schema.json",
  "movie-streaming-organizer": "movie-streaming.schema.json",
  "music-organizer": "music-library.schema.json",
  "personal-archive-curator": "archive-index.schema.json",
  "pet-care-coordinator": "pet-care.schema.json",
  "pond-water-feature-coordinator": "pond-system.schema.json",
  "project-manager": "project-state.schema.json",
  "product-manager": "product-decision.schema.json",
  "public-safety-monitor": "public-safety-state.schema.json",
  "recruiting-coordinator": "interview-plan.schema.json",
  "restaurant-venue-scout": "venue-shortlist.schema.json",
  "research-briefing": "research-brief.schema.json",
  "sales-operations": "pipeline-review.schema.json",
  "school-coordinator": "school-logistics.schema.json",
  "sports-team-watcher": "sports-team-watch.schema.json",
  "stock-portfolio-monitor": "stock-portfolio.schema.json",
  "subscription-manager": "subscription-ledger.schema.json",
  "tax-document-organizer": "tax-document.schema.json",
  "vehicle-service-coordinator": "vehicle-service.schema.json",
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
