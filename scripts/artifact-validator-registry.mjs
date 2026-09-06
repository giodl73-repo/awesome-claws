import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { root } from "./catalog-source.mjs";

export const ARTIFACT_SCHEMA_NAMES = Object.freeze({
  "accessibility-review-coordinator": "accessibility-finding.schema.json",
  "appliance-care-coordinator": "appliance-care.schema.json",
  "benefits-open-enrollment-planner": "benefits-enrollment.schema.json",
  "care-circle-coordinator": "care-circle.schema.json",
  "case-continuity-coordinator": "case-checkpoint.schema.json",
  "certification-renewal-planner": "certification-renewal.schema.json",
  "conference-opportunity-scout": "conference-opportunities.schema.json",
  "change-control-operator": "change-plan.schema.json",
  "child-activity-manager": "activity-logistics.schema.json",
  "civic-data-analyst": "civic-evidence.schema.json",
  "cloud-cost-analyst": "cloud-cost-record.schema.json",
  "data-migration-planner": "mapping.schema.json",
  "content-operations": "publication-readiness-record.schema.json",
  "data-analyst": "analysis-state.schema.json",
  "delegation-coordinator": "delegation-ledger.schema.json",
  "document-intake-analyst": "document-intake.schema.json",
  "document-renewal-tracker": "document-renewal.schema.json",
  "event-operations-director": "run-of-show.schema.json",
  "executive-assistant": "executive-commitment-ledger.schema.json",
  "executive-briefing": "executive-briefing-snapshot.schema.json",
  "experimentation-lead": "experiment-record.schema.json",
  "facilities-operations-coordinator": "facilities-issue.schema.json",
  "fantasy-sports-manager": "fantasy-roster.schema.json",
  "financial-analyst": "financial-scenario.schema.json",
  "feed-intelligence-monitor": "feed-intelligence-delta-ledger.schema.json",
  "freelance-client-pipeline": "freelance-pipeline.schema.json",
  "fundraising-campaign-manager": "campaign-claim.schema.json",
  "games-backlog-manager": "game-backlog.schema.json",
  "gift-relationship-manager": "gift-plan.schema.json",
  "grant-portfolio-manager": "grant-opportunity.schema.json",
  "green-thumb-coordinator": "garden-plan.schema.json",
  "health-records-binder": "health-records.schema.json",
  "home-repair-coordinator": "home-repair.schema.json",
  "household-budget-steward": "household-budget.schema.json",
  "home-inventory-binder": "home-inventory.schema.json",
  "household-steward": "household-operations.schema.json",
  "insurance-policy-organizer": "insurance-policy.schema.json",
  "invoice-payment-followup": "invoice-receivables.schema.json",
  "job-application-tracker": "job-application.schema.json",
  "knowledge-curator": "knowledge-collection-index.schema.json",
  "knowledge-gardener": "knowledge-space-change-plan.schema.json",
  "life-timeline-keeper": "life-timeline.schema.json",
  "local-events-watcher": "event-watchlist.schema.json",
  "localization-program-manager": "locale-readiness.schema.json",
  "manufacturing-operations-planner": "production-plan.schema.json",
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
  "presentation-producer": "presentation-evidence-manifest.schema.json",
  "privacy-request-coordinator": "privacy-request.schema.json",
  "procurement-evaluator": "vendor-evaluation.schema.json",
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
  "quality-assurance-lead": "test-evidence.schema.json",
  "recruiting-coordinator": "interview-plan.schema.json",
  "restaurant-venue-scout": "venue-shortlist.schema.json",
  "research-briefing": "research-brief.schema.json",
  "sales-operations": "pipeline-review.schema.json",
  "school-coordinator": "school-logistics.schema.json",
  "software-maintainer": "change-delivery-record.schema.json",
  "sports-team-watcher": "sports-team-watch.schema.json",
  "spreadsheet-analyst": "spreadsheet-change.schema.json",
  "stock-portfolio-monitor": "stock-portfolio.schema.json",
  "subscription-manager": "subscription-ledger.schema.json",
  "tax-document-organizer": "tax-document.schema.json",
  "travel-concierge": "travel-shortlist.schema.json",
  "travel-planner": "itinerary-plan.schema.json",
  "travel-loyalty-points-organizer": "travel-loyalty.schema.json",
  "ux-research-synthesizer": "research-evidence.schema.json",
  "vehicle-service-coordinator": "vehicle-service.schema.json",
  "video-concept-producer": "video-concept-generation-manifest.schema.json",
  "wardrobe-organizer": "wardrobe-plan.schema.json",
  "warranty-returns-manager": "warranty-returns.schema.json",
  "website-evidence-collector": "website-capture-evidence-ledger.schema.json",
  "work-chief-of-staff": "operating-portfolio.schema.json",
  "workflow-operator": "workflow-execution-reconciliation.schema.json",
});

export function artifactSchemaName(id) {
  return ARTIFACT_SCHEMA_NAMES[id] ?? null;
}

const validatorCache = new Map();

async function registeredValidator(id, targetRoot) {
  const schemaName = ARTIFACT_SCHEMA_NAMES[id];
  if (!schemaName) return null;
  const key = `${targetRoot}\0${id}`;
  if (!validatorCache.has(key)) {
    validatorCache.set(
      key,
      readFile(join(targetRoot, "claws", id, "schemas", schemaName), "utf8").then(
        (text) => {
          const ajv = new Ajv2020({ allErrors: true, strict: true });
          addFormats(ajv);
          return { schemaName, validate: ajv.compile(JSON.parse(text)) };
        },
      ),
    );
  }
  return validatorCache.get(key);
}

function diagnosticSchemaErrors(errors = [], diagnostics) {
  if (diagnostics === "safe") {
    return errors.map(({ instancePath, keyword }) => ({ instancePath, keyword }));
  }
  return structuredClone(errors);
}

function diagnosticSemanticFindings(findings, diagnostics) {
  if (diagnostics === "safe") {
    return findings.map(({ code, path }) => ({ code, path }));
  }
  return structuredClone(findings);
}

export async function validateArtifact({
  id,
  artifactPath,
  scenarioType,
  mode,
  role = "completion",
  targetRoot = root,
  diagnostics = "full",
}) {
  if (!["full", "safe"].includes(diagnostics)) {
    throw new Error(`Unknown artifact diagnostic view: ${diagnostics}.`);
  }
  const content = await readFile(artifactPath);
  if (content.length === 0) {
    return {
      performed: true,
      policy: "durable-handoff",
      valid: false,
      schema: { applicable: false, valid: null, name: null, errors: [] },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  if (scenarioType !== "accepted-task") {
    return {
      performed: true,
      policy: "durable-blocked-or-refusal-handoff",
      valid: true,
      schema: { applicable: false, valid: null, name: null, errors: [] },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  if (role === "handoff") {
    const valid = extname(artifactPath).toLowerCase() !== ".json";
    return {
      performed: true,
      policy: valid
        ? "durable-unstructured-completion"
        : "unregistered-structured-completion",
      valid,
      schema: {
        applicable: !valid,
        valid: valid ? null : false,
        name: null,
        errors: valid ? [] : [{ instancePath: "", keyword: "handoff-format" }],
      },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  let value;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch {
    const registered = Boolean(ARTIFACT_SCHEMA_NAMES[id]);
    return {
      performed: true,
      policy: registered || extname(artifactPath).toLowerCase() === ".json"
        ? "registered-completion-schema"
        : "durable-unstructured-completion",
      valid: !registered && extname(artifactPath).toLowerCase() !== ".json",
      schema: {
        applicable: registered || extname(artifactPath).toLowerCase() === ".json",
        valid: false,
        name: ARTIFACT_SCHEMA_NAMES[id] ?? null,
        errors: [{ instancePath: "", keyword: "parse" }],
      },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  if (mode === "mock") {
    const valid =
      value?.schemaVersion === "awesomeClaws.runtimeMockArtifact.v1" &&
      value?.clawId === id &&
      value?.scenarioType === scenarioType &&
      value?.outcome === "completed";
    return {
      performed: true,
      policy: "deterministic-mock-contract",
      valid,
      schema: {
        applicable: true,
        valid,
        name: "awesomeClaws.runtimeMockArtifact.v1",
        errors: valid ? [] : [{ instancePath: "", keyword: "mock-contract" }],
      },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  const registered = await registeredValidator(id, targetRoot);
  if (!registered) {
    const valid = extname(artifactPath).toLowerCase() !== ".json";
    return {
      performed: true,
      policy: valid
        ? "durable-unstructured-completion"
        : "unregistered-structured-completion",
      valid,
      schema: {
        applicable: !valid,
        valid: valid ? null : false,
        name: null,
        errors: valid ? [] : [{ instancePath: "", keyword: "unregistered-schema" }],
      },
      semantics: { applicable: false, valid: null, findings: [] },
    };
  }

  const schemaValid = registered.validate(value);
  const semanticFindings = schemaValid ? validateArtifactSemantics(id, value) : [];
  return {
    performed: true,
    policy: "registered-completion-schema",
    valid: schemaValid && semanticFindings.length === 0,
    schema: {
      applicable: true,
      valid: schemaValid,
      name: registered.schemaName,
      errors: diagnosticSchemaErrors(registered.validate.errors ?? [], diagnostics),
    },
    semantics: {
      applicable: schemaValid,
      valid: schemaValid ? semanticFindings.length === 0 : null,
      findings: diagnosticSemanticFindings(semanticFindings, diagnostics),
    },
  };
}
