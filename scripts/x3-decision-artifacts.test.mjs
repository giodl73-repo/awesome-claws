import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const definitions = [
  {
    id: "appliance-care-coordinator",
    schema: "../claws/appliance-care-coordinator/schemas/appliance-care.schema.json",
    fixture: "../claws/appliance-care-coordinator/fixtures/appliance-care.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "benefits-open-enrollment-planner",
    schema: "../claws/benefits-open-enrollment-planner/schemas/benefits-enrollment.schema.json",
    fixture: "../claws/benefits-open-enrollment-planner/fixtures/benefits-enrollment.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "care-circle-coordinator",
    schema: "../claws/care-circle-coordinator/schemas/care-circle.schema.json",
    fixture: "../claws/care-circle-coordinator/fixtures/care-circle.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "child-activity-manager",
    schema: "../claws/child-activity-manager/schemas/activity-logistics.schema.json",
    fixture: "../claws/child-activity-manager/fixtures/activity-logistics.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "change-control-operator",
    schema: "../claws/change-control-operator/schemas/change-plan.schema.json",
    fixture: "../claws/change-control-operator/fixtures/change-plan.example.json",
    decisionField: "decision.state",
  },
  {
    id: "content-operations",
    schema: "../claws/content-operations/schemas/publication-readiness-record.schema.json",
    fixture: "../claws/content-operations/fixtures/publication-readiness-record.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "executive-assistant",
    schema: "../claws/executive-assistant/schemas/executive-commitment-ledger.schema.json",
    fixture: "../claws/executive-assistant/fixtures/executive-commitment-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "executive-briefing",
    schema: "../claws/executive-briefing/schemas/executive-briefing-snapshot.schema.json",
    fixture: "../claws/executive-briefing/fixtures/executive-briefing-snapshot.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "case-continuity-coordinator",
    schema: "../claws/case-continuity-coordinator/schemas/case-checkpoint.schema.json",
    fixture: "../claws/case-continuity-coordinator/fixtures/case-checkpoint.example.json",
    decisionField: "decision.state",
  },
  {
    id: "certification-renewal-planner",
    schema: "../claws/certification-renewal-planner/schemas/certification-renewal.schema.json",
    fixture: "../claws/certification-renewal-planner/fixtures/certification-renewal.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "conference-opportunity-scout",
    schema: "../claws/conference-opportunity-scout/schemas/conference-opportunities.schema.json",
    fixture: "../claws/conference-opportunity-scout/fixtures/conference-opportunities.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "delegation-coordinator",
    schema: "../claws/delegation-coordinator/schemas/delegation-ledger.schema.json",
    fixture: "../claws/delegation-coordinator/fixtures/delegation-ledger.example.json",
    decisionField: "synthesis.state",
  },
  {
    id: "document-renewal-tracker",
    schema: "../claws/document-renewal-tracker/schemas/document-renewal.schema.json",
    fixture: "../claws/document-renewal-tracker/fixtures/document-renewal.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "document-intake-analyst",
    schema: "../claws/document-intake-analyst/schemas/document-intake.schema.json",
    fixture: "../claws/document-intake-analyst/fixtures/document-intake.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "financial-analyst",
    schema: "../claws/financial-analyst/schemas/financial-scenario.schema.json",
    fixture: "../claws/financial-analyst/fixtures/financial-scenario.example.json",
    decisionField: "decisionState",
  },
  {
    id: "freelance-client-pipeline",
    schema: "../claws/freelance-client-pipeline/schemas/freelance-pipeline.schema.json",
    fixture: "../claws/freelance-client-pipeline/fixtures/freelance-pipeline.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "fundraising-campaign-manager",
    schema: "../claws/fundraising-campaign-manager/schemas/campaign-claim.schema.json",
    fixture: "../claws/fundraising-campaign-manager/fixtures/campaign-claim.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "invoice-payment-followup",
    schema: "../claws/invoice-payment-followup/schemas/invoice-receivables.schema.json",
    fixture: "../claws/invoice-payment-followup/fixtures/invoice-receivables.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "fantasy-sports-manager",
    schema: "../claws/fantasy-sports-manager/schemas/fantasy-roster.schema.json",
    fixture: "../claws/fantasy-sports-manager/fixtures/fantasy-roster.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "gift-relationship-manager",
    schema: "../claws/gift-relationship-manager/schemas/gift-plan.schema.json",
    fixture: "../claws/gift-relationship-manager/fixtures/gift-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "games-backlog-manager",
    schema: "../claws/games-backlog-manager/schemas/game-backlog.schema.json",
    fixture: "../claws/games-backlog-manager/fixtures/game-backlog.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "green-thumb-coordinator",
    schema: "../claws/green-thumb-coordinator/schemas/garden-plan.schema.json",
    fixture: "../claws/green-thumb-coordinator/fixtures/garden-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "health-records-binder",
    schema: "../claws/health-records-binder/schemas/health-records.schema.json",
    fixture: "../claws/health-records-binder/fixtures/health-records.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "spreadsheet-analyst",
    schema: "../claws/spreadsheet-analyst/schemas/spreadsheet-change.schema.json",
    fixture: "../claws/spreadsheet-analyst/fixtures/spreadsheet-change.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "software-maintainer",
    schema: "../claws/software-maintainer/schemas/change-delivery-record.schema.json",
    fixture: "../claws/software-maintainer/fixtures/change-delivery-record.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "media-evidence-reviewer",
    schema: "../claws/media-evidence-reviewer/schemas/media-evidence.schema.json",
    fixture: "../claws/media-evidence-reviewer/fixtures/media-evidence.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "meeting-intelligence",
    schema: "../claws/meeting-intelligence/schemas/meeting-record.schema.json",
    fixture: "../claws/meeting-intelligence/fixtures/meeting-record.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "home-repair-coordinator",
    schema: "../claws/home-repair-coordinator/schemas/home-repair.schema.json",
    fixture: "../claws/home-repair-coordinator/fixtures/home-repair.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "household-budget-steward",
    schema: "../claws/household-budget-steward/schemas/household-budget.schema.json",
    fixture: "../claws/household-budget-steward/fixtures/household-budget.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "home-inventory-binder",
    schema: "../claws/home-inventory-binder/schemas/home-inventory.schema.json",
    fixture: "../claws/home-inventory-binder/fixtures/home-inventory.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "household-steward",
    schema: "../claws/household-steward/schemas/household-operations.schema.json",
    fixture: "../claws/household-steward/fixtures/household-operations.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "insurance-policy-organizer",
    schema: "../claws/insurance-policy-organizer/schemas/insurance-policy.schema.json",
    fixture: "../claws/insurance-policy-organizer/fixtures/insurance-policy.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "job-application-tracker",
    schema: "../claws/job-application-tracker/schemas/job-application.schema.json",
    fixture: "../claws/job-application-tracker/fixtures/job-application.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "knowledge-curator",
    schema: "../claws/knowledge-curator/schemas/knowledge-collection-index.schema.json",
    fixture: "../claws/knowledge-curator/fixtures/knowledge-collection-index.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "knowledge-gardener",
    schema: "../claws/knowledge-gardener/schemas/knowledge-space-change-plan.schema.json",
    fixture: "../claws/knowledge-gardener/fixtures/knowledge-space-change-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "life-timeline-keeper",
    schema: "../claws/life-timeline-keeper/schemas/life-timeline.schema.json",
    fixture: "../claws/life-timeline-keeper/fixtures/life-timeline.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "medical-appointment-prep",
    schema: "../claws/medical-appointment-prep/schemas/medical-appointment.schema.json",
    fixture: "../claws/medical-appointment-prep/fixtures/medical-appointment.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "local-events-watcher",
    schema: "../claws/local-events-watcher/schemas/event-watchlist.schema.json",
    fixture: "../claws/local-events-watcher/fixtures/event-watchlist.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "meal-grocery-planner",
    schema: "../claws/meal-grocery-planner/schemas/meal-grocery.schema.json",
    fixture: "../claws/meal-grocery-planner/fixtures/meal-grocery.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "work-chief-of-staff",
    schema: "../claws/work-chief-of-staff/schemas/operating-portfolio.schema.json",
    fixture: "../claws/work-chief-of-staff/fixtures/operating-portfolio.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "model-evaluation-adjudicator",
    schema: "../claws/model-evaluation-adjudicator/schemas/model-evaluation.schema.json",
    fixture: "../claws/model-evaluation-adjudicator/fixtures/model-evaluation.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "moving-checklist-coordinator",
    schema: "../claws/moving-checklist-coordinator/schemas/moving-plan.schema.json",
    fixture: "../claws/moving-checklist-coordinator/fixtures/moving-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "movie-streaming-organizer",
    schema: "../claws/movie-streaming-organizer/schemas/movie-streaming.schema.json",
    fixture: "../claws/movie-streaming-organizer/fixtures/movie-streaming.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "music-organizer",
    schema: "../claws/music-organizer/schemas/music-library.schema.json",
    fixture: "../claws/music-organizer/fixtures/music-library.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "neighborhood-operations-watcher",
    schema: "../claws/neighborhood-operations-watcher/schemas/neighborhood-operations.schema.json",
    fixture: "../claws/neighborhood-operations-watcher/fixtures/neighborhood-operations.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "wardrobe-organizer",
    schema: "../claws/wardrobe-organizer/schemas/wardrobe-plan.schema.json",
    fixture: "../claws/wardrobe-organizer/fixtures/wardrobe-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "warranty-returns-manager",
    schema: "../claws/warranty-returns-manager/schemas/warranty-returns.schema.json",
    fixture: "../claws/warranty-returns-manager/fixtures/warranty-returns.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "personal-archive-curator",
    schema: "../claws/personal-archive-curator/schemas/archive-index.schema.json",
    fixture: "../claws/personal-archive-curator/fixtures/archive-index.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "purchase-researcher",
    schema: "../claws/purchase-researcher/schemas/purchase-research.schema.json",
    fixture: "../claws/purchase-researcher/fixtures/purchase-research.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "pet-care-coordinator",
    schema: "../claws/pet-care-coordinator/schemas/pet-care.schema.json",
    fixture: "../claws/pet-care-coordinator/fixtures/pet-care.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "pond-water-feature-coordinator",
    schema: "../claws/pond-water-feature-coordinator/schemas/pond-system.schema.json",
    fixture: "../claws/pond-water-feature-coordinator/fixtures/pond-system.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "presentation-producer",
    schema:
      "../claws/presentation-producer/schemas/presentation-evidence-manifest.schema.json",
    fixture:
      "../claws/presentation-producer/fixtures/presentation-evidence-manifest.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "professional-networking-followup",
    schema: "../claws/professional-networking-followup/schemas/networking-followup.schema.json",
    fixture: "../claws/professional-networking-followup/fixtures/networking-followup.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "resume-portfolio-curator",
    schema: "../claws/resume-portfolio-curator/schemas/resume-portfolio.schema.json",
    fixture: "../claws/resume-portfolio-curator/fixtures/resume-portfolio.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "vehicle-service-coordinator",
    schema: "../claws/vehicle-service-coordinator/schemas/vehicle-service.schema.json",
    fixture: "../claws/vehicle-service-coordinator/fixtures/vehicle-service.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "public-safety-monitor",
    schema: "../claws/public-safety-monitor/schemas/public-safety-state.schema.json",
    fixture: "../claws/public-safety-monitor/fixtures/public-safety-state.example.json",
    decisionField: "state",
  },
  {
    id: "recruiting-coordinator",
    schema: "../claws/recruiting-coordinator/schemas/interview-plan.schema.json",
    fixture: "../claws/recruiting-coordinator/fixtures/interview-plan.example.json",
    decisionField: "planState",
  },
  {
    id: "public-company-watcher",
    schema:
      "../claws/public-company-watcher/schemas/company-disclosure-ledger.schema.json",
    fixture:
      "../claws/public-company-watcher/fixtures/company-disclosure-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "research-scout",
    schema: "../claws/research-scout/schemas/research-evidence-delta.schema.json",
    fixture: "../claws/research-scout/fixtures/research-evidence-delta.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "research-monitor",
    schema: "../claws/research-monitor/schemas/topic-watch-delta-ledger.schema.json",
    fixture: "../claws/research-monitor/fixtures/topic-watch-delta-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "web-evidence-researcher",
    schema:
      "../claws/web-evidence-researcher/schemas/claim-evidence-investigation-ledger.schema.json",
    fixture:
      "../claws/web-evidence-researcher/fixtures/claim-evidence-investigation-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "website-evidence-collector",
    schema:
      "../claws/website-evidence-collector/schemas/website-capture-evidence-ledger.schema.json",
    fixture:
      "../claws/website-evidence-collector/fixtures/website-capture-evidence-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "restaurant-venue-scout",
    schema: "../claws/restaurant-venue-scout/schemas/venue-shortlist.schema.json",
    fixture: "../claws/restaurant-venue-scout/fixtures/venue-shortlist.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "sales-operations",
    schema: "../claws/sales-operations/schemas/pipeline-review.schema.json",
    fixture: "../claws/sales-operations/fixtures/pipeline-review.example.json",
    decisionField: "decisionState",
  },
  {
    id: "school-coordinator",
    schema: "../claws/school-coordinator/schemas/school-logistics.schema.json",
    fixture: "../claws/school-coordinator/fixtures/school-logistics.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "sports-team-watcher",
    schema: "../claws/sports-team-watcher/schemas/sports-team-watch.schema.json",
    fixture: "../claws/sports-team-watcher/fixtures/sports-team-watch.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "stock-portfolio-monitor",
    schema: "../claws/stock-portfolio-monitor/schemas/stock-portfolio.schema.json",
    fixture: "../claws/stock-portfolio-monitor/fixtures/stock-portfolio.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "subscription-manager",
    schema: "../claws/subscription-manager/schemas/subscription-ledger.schema.json",
    fixture: "../claws/subscription-manager/fixtures/subscription-ledger.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "tax-document-organizer",
    schema: "../claws/tax-document-organizer/schemas/tax-document.schema.json",
    fixture: "../claws/tax-document-organizer/fixtures/tax-document.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "travel-loyalty-points-organizer",
    schema: "../claws/travel-loyalty-points-organizer/schemas/travel-loyalty.schema.json",
    fixture: "../claws/travel-loyalty-points-organizer/fixtures/travel-loyalty.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "travel-planner",
    schema: "../claws/travel-planner/schemas/itinerary-plan.schema.json",
    fixture: "../claws/travel-planner/fixtures/itinerary-plan.example.json",
    decisionField: "handoff.state",
  },
  {
    id: "civic-data-analyst",
    schema: "../claws/civic-data-analyst/schemas/civic-evidence.schema.json",
    fixture: "../claws/civic-data-analyst/fixtures/civic-evidence.example.json",
    decisionField: "publicationState",
  },
];

const cases = new Map();
for (const definition of definitions) {
  const schema = JSON.parse(await readFile(new URL(definition.schema, import.meta.url), "utf8"));
  const fixture = JSON.parse(await readFile(new URL(definition.fixture, import.meta.url), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  cases.set(definition.id, {
    ...definition,
    fixture,
    fixturePath: definition.fixture,
    validate: ajv.compile(schema),
  });
}

function isValid(id, candidate) {
  const item = cases.get(id);
  return item.validate(candidate) && validateArtifactSemantics(id, candidate).length === 0;
}

function resolvedMovingPlan(fixture) {
  const value = structuredClone(fixture);
  value.plan.asOf = "2026-10-16";
  for (const source of value.sources) {
    source.freshness = "current";
    if (source.id === "source-mover-quote") {
      source.validThrough = "2026-12-31";
    }
  }
  for (const workstream of value.workstreams) {
    workstream.state = "complete";
  }
  const destinationMilestone = value.milestones.find(
    (item) => item.id === "milestone-destination-access",
  );
  destinationMilestone.dateState = "known";
  destinationMilestone.date = "2026-10-15";
  destinationMilestone.dateCandidates[1].date = "2026-10-15";
  value.evidenceRecords.find(
    (item) => item.id === "evidence-destination-access-date-two",
  ).assertedDate = "2026-10-15";
  const schoolMilestone = value.milestones.find(
    (item) => item.id === "milestone-school-transition",
  );
  schoolMilestone.dateState = "known";
  schoolMilestone.date = "2026-10-14";
  schoolMilestone.dateCandidates = [
    { date: "2026-10-14", sourceRef: "source-school-gap" },
  ];
  const schoolDateEvidence = value.evidenceRecords.find(
    (item) => item.id === "evidence-school-date-missing",
  );
  schoolDateEvidence.assertedDate = "2026-10-14";
  schoolDateEvidence.assertedValue = null;
  const milestoneWorkstreamRefs = new Set(
    value.milestones.map((item) => item.workstreamRef),
  );
  for (const workstream of value.workstreams) {
    if (milestoneWorkstreamRefs.has(workstream.id)) {
      continue;
    }
    const suffix = workstream.id.slice("workstream-".length);
    const milestoneId = `milestone-${suffix}-completion`;
    value.milestones.push({
      id: milestoneId,
      workstreamRef: workstream.id,
      ownerRef: workstream.ownerRef,
      title: `${workstream.title} completion`,
      phase: "pre-move",
      dateState: "known",
      date: "2026-10-14",
      dateCandidates: [
        { date: "2026-10-14", sourceRef: "source-owner-plan" },
      ],
      status: "completed",
      sourceRefs: ["source-owner-plan"],
      completionEvidenceRefs: [],
    });
    value.evidenceRecords.push({
      id: `evidence-${suffix}-completion-date`,
      sourceRef: "source-owner-plan",
      sourceKind: "owner-plan",
      claimKind: "milestone-date",
      subjectRef: milestoneId,
      workstreamRef: workstream.id,
      readinessKind: null,
      assertedDate: "2026-10-14",
      assertedValue: null,
    });
  }
  for (const milestone of value.milestones) {
    milestone.status = "completed";
    const completionSource = {
      id: `source-${milestone.id.slice("milestone-".length)}-completion`,
      kind: "milestone-completion-record",
      label: `Owner-supplied completion record for ${milestone.title}`,
      provenance: "owner-supplied",
      privacy: "private",
      freshness: "current",
      asOf: "2026-10-16",
      subjectRef: milestone.id,
      workstreamRef: milestone.workstreamRef,
      ownerRef: milestone.ownerRef,
    };
    const completionEvidence = {
      id: `evidence-${milestone.id.slice("milestone-".length)}-completion`,
      sourceRef: completionSource.id,
      sourceKind: "milestone-completion-record",
      claimKind: "milestone-completion",
      subjectRef: milestone.id,
      workstreamRef: milestone.workstreamRef,
      ownerRef: milestone.ownerRef,
      readinessKind: null,
      assertedDate: null,
      assertedValue: "completed",
    };
    value.sources.push(completionSource);
    value.evidenceRecords.push(completionEvidence);
    milestone.completionEvidenceRefs = [completionEvidence.id];
  }
  for (const readiness of value.readinessItems) {
    readiness.state = "ready-for-owner-review";
    value.evidenceRecords.find(
      (record) =>
        record.claimKind === "readiness" && record.subjectRef === readiness.id,
    ).assertedValue = "ready-for-owner-review";
  }
  for (const dependency of value.dependencies) {
    dependency.state = "satisfied";
  }
  for (const gate of value.actionGates) {
    gate.state = "completed-by-owner";
    let actionSource = value.sources.find(
      (source) =>
        source.kind === "owner-action-record" &&
        source.workstreamRef === gate.workstreamRef &&
        source.action === gate.action &&
        source.ownerRef === gate.ownerRef,
    );
    if (!actionSource) {
      actionSource = {
        id: `source-owner-action-${gate.id.slice("gate-".length)}`,
        kind: "owner-action-record",
        label: `Owner-supplied ${gate.action} completion record`,
        provenance: "owner-supplied",
        privacy: "private",
        freshness: "current",
        asOf: "2026-10-16",
        workstreamRef: gate.workstreamRef,
        action: gate.action,
        ownerRef: gate.ownerRef,
      };
      value.sources.push(actionSource);
    }
    if (!gate.evidenceRefs.includes(actionSource.id)) {
      gate.evidenceRefs.push(actionSource.id);
    }
  }
  value.gaps = [];
  value.reviewQuestions = [];
  value.handoff.state = "ready-for-owner-review";
  value.handoff.reviewQuestionRefs = [];
  value.handoff.blockingRefs = [];
  return value;
}

for (const item of cases.values()) {
  test(`${item.id} accepts its packaged decision artifact`, () => {
    assert.equal(isValid(item.id, item.fixture), true, JSON.stringify(item.validate.errors));
  });
}

test("installed X3 instructions require the structured artifact contract", async () => {
  for (const item of cases.values()) {
    const instructions = await readFile(
      new URL(`../claws/${item.id}/workspace/AGENTS.md`, import.meta.url),
      "utf8",
    );
    const schemaPath = item.schema.slice(item.schema.indexOf("schemas/"));
    const fixturePath = item.fixturePath.slice(item.fixturePath.indexOf("fixtures/"));
    const name = schemaPath.split("/").at(-1).replace(/\.schema\.json$/u, "");
    for (const expected of [
      schemaPath,
      fixturePath,
      `templates/${name}.md`,
      `outputs/${item.id}-handoff.md`,
      "explicit decision by the named accountable owner",
    ]) {
      assert.match(instructions, new RegExp(expected.replaceAll(".", "\\."), "u"), item.id);
    }
  }
});

test("the public artifact validator accepts every packaged X3 fixture", () => {
  const validator = fileURLToPath(new URL("./validate-artifact.mjs", import.meta.url));
  for (const item of cases.values()) {
    const fixture = fileURLToPath(new URL(item.fixturePath, import.meta.url));
    const result = spawnSync(process.execPath, [validator, item.id, fixture], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${item.id}: ${result.stderr || result.stdout}`);
    assert.equal(JSON.parse(result.stdout).valid, true, item.id);
  }
});

test("document intake preserves lineage, fidelity, processing authority, and owner control", () => {
  const fixture = cases.get("document-intake-analyst").fixture;
  const readyArtifact = () => {
    const value = structuredClone(fixture);
    for (const source of value.sources) source.state = "converted";
    for (const output of value.outputs) {
      output.conversionState = "complete";
      output.fidelityState = "sampled-pass";
      output.reviewState = "ready";
      output.limitations = [];
    }
    for (const finding of value.findings) finding.state = "resolved";
    value.handoff.state = "ready-for-owner-review";
    value.handoff.blockingFindingRefs = [];
    return value;
  };

  const danglingSource = structuredClone(fixture);
  danglingSource.outputs[0].sourceRef = "source-missing";
  assert.equal(isValid("document-intake-analyst", danglingSource), false);

  const externalInLocalBoundary = structuredClone(fixture);
  externalInLocalBoundary.sources[0].processingAuthorization = "external-approved";
  externalInLocalBoundary.sources[0].provider = "Example OCR";
  assert.equal(isValid("document-intake-analyst", externalInLocalBoundary), false);

  const localWithProvider = structuredClone(fixture);
  localWithProvider.sources[0].provider = "Example OCR";
  assert.equal(isValid("document-intake-analyst", localWithProvider), false);

  const unauthorizedConversion = structuredClone(fixture);
  unauthorizedConversion.sources[0].processingAuthorization = "external-not-approved";
  assert.equal(isValid("document-intake-analyst", unauthorizedConversion), true);

  const unauthorizedExternalConversion = structuredClone(fixture);
  unauthorizedExternalConversion.outputs[0].processingMode = "external";
  assert.equal(
    isValid("document-intake-analyst", unauthorizedExternalConversion),
    false,
  );

  const processedWithoutOutput = structuredClone(fixture);
  processedWithoutOutput.outputs = processedWithoutOutput.outputs.filter(
    (item) => item.sourceRef !== "source-overview-pdf",
  );
  processedWithoutOutput.handoff.outputRefs =
    processedWithoutOutput.handoff.outputRefs.filter(
      (id) => id !== "output-overview",
    );
  assert.equal(isValid("document-intake-analyst", processedWithoutOutput), false);

  const exceptionWithoutFinding = structuredClone(fixture);
  exceptionWithoutFinding.findings = exceptionWithoutFinding.findings.filter(
    (item) => item.outputRef !== "output-contract",
  );
  assert.equal(isValid("document-intake-analyst", exceptionWithoutFinding), false);

  const unsupportedReadyOutput = structuredClone(fixture);
  unsupportedReadyOutput.outputs[1].reviewState = "ready";
  assert.equal(isValid("document-intake-analyst", unsupportedReadyOutput), false);

  const notProducedReadyOutput = readyArtifact();
  notProducedReadyOutput.outputs[0].conversionState = "not-produced";
  assert.equal(isValid("document-intake-analyst", notProducedReadyOutput), false);

  const partialReadyOutput = readyArtifact();
  partialReadyOutput.outputs[0].conversionState = "partial";
  assert.equal(isValid("document-intake-analyst", partialReadyOutput), false);

  const convertedWithoutProducedOutput = structuredClone(fixture);
  convertedWithoutProducedOutput.outputs[0].processingMode = "none";
  convertedWithoutProducedOutput.outputs[0].conversionState = "not-produced";
  convertedWithoutProducedOutput.outputs[0].fidelityState = "blocked";
  convertedWithoutProducedOutput.outputs[0].reviewState = "blocked";
  assert.equal(
    isValid("document-intake-analyst", convertedWithoutProducedOutput),
    false,
  );

  for (const unsafePath of [
    "outputs/../outside.md",
    "outputs/a/../../outside.md",
    "outputs/a//outside.md",
  ]) {
    const traversalOutput = structuredClone(fixture);
    traversalOutput.outputs[0].path = unsafePath;
    assert.equal(isValid("document-intake-analyst", traversalOutput), false);
  }

  const portablePathCollision = structuredClone(fixture);
  portablePathCollision.outputs[1].path =
    "outputs/normalized/COMPANY-OVERVIEW.md";
  assert.equal(isValid("document-intake-analyst", portablePathCollision), false);

  const mismatchedFindingSource = structuredClone(fixture);
  mismatchedFindingSource.findings[0].sourceRefs = ["source-overview-pdf"];
  assert.equal(isValid("document-intake-analyst", mismatchedFindingSource), false);

  const mismatchedQuestionSource = structuredClone(fixture);
  mismatchedQuestionSource.reviewQuestions[0].sourceRefs = [
    "source-contract-docx",
  ];
  assert.equal(isValid("document-intake-analyst", mismatchedQuestionSource), false);

  const missingBlocker = structuredClone(fixture);
  missingBlocker.handoff.blockingFindingRefs = ["finding-roadmap-chart"];
  assert.equal(isValid("document-intake-analyst", missingBlocker), false);

  const unsupportedReadyHandoff = structuredClone(fixture);
  unsupportedReadyHandoff.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("document-intake-analyst", unsupportedReadyHandoff), false);

  const readyWithHiddenBlockedSource = readyArtifact();
  readyWithHiddenBlockedSource.sources[0].state = "blocked";
  readyWithHiddenBlockedSource.outputs =
    readyWithHiddenBlockedSource.outputs.filter(
      (item) => item.sourceRef !== "source-overview-pdf",
    );
  readyWithHiddenBlockedSource.handoff.outputRefs =
    readyWithHiddenBlockedSource.handoff.outputRefs.filter(
      (id) => id !== "output-overview",
    );
  assert.equal(
    isValid("document-intake-analyst", readyWithHiddenBlockedSource),
    false,
  );

  const readyWithReviewNeededSource = readyArtifact();
  readyWithReviewNeededSource.sources[0].state = "review-needed";
  assert.equal(
    isValid("document-intake-analyst", readyWithReviewNeededSource),
    false,
  );

  const blockedSourceWithVisibleOutput = structuredClone(fixture);
  blockedSourceWithVisibleOutput.sources[0].state = "blocked";
  blockedSourceWithVisibleOutput.outputs[0].processingMode = "none";
  blockedSourceWithVisibleOutput.outputs[0].conversionState = "not-produced";
  blockedSourceWithVisibleOutput.outputs[0].fidelityState = "blocked";
  blockedSourceWithVisibleOutput.outputs[0].reviewState = "blocked";
  assert.equal(
    isValid("document-intake-analyst", blockedSourceWithVisibleOutput),
    true,
  );

  const incompleteReadyHandoff = readyArtifact();
  incompleteReadyHandoff.handoff.outputRefs =
    incompleteReadyHandoff.handoff.outputRefs.filter(
      (id) => id !== "output-contract",
    );
  assert.equal(isValid("document-intake-analyst", incompleteReadyHandoff), false);

  const unresolvedReadyClaim = structuredClone(fixture);
  unresolvedReadyClaim.outputs[1].fidelityState = "sampled-pass";
  unresolvedReadyClaim.outputs[1].reviewState = "ready";
  assert.equal(isValid("document-intake-analyst", unresolvedReadyClaim), false);

  const missingAuthorityGate = structuredClone(fixture);
  missingAuthorityGate.blockedActions =
    missingAuthorityGate.blockedActions.filter(
      (action) => action !== "external-processing",
    );
  assert.equal(isValid("document-intake-analyst", missingAuthorityGate), false);

  const actionAdvice = structuredClone(fixture);
  actionAdvice.reviewQuestions[0].reason +=
    " Upload the source to an external provider now.";
  assert.equal(isValid("document-intake-analyst", actionAdvice), false);

  const directActionAdvice = structuredClone(fixture);
  directActionAdvice.reviewQuestions[0].reason =
    "Upload the source to an external OCR provider.";
  assert.equal(isValid("document-intake-analyst", directActionAdvice), false);

  const mandatoryActionAdvice = structuredClone(fixture);
  mandatoryActionAdvice.reviewQuestions[0].reason =
    "You must upload the source to an external OCR provider.";
  assert.equal(isValid("document-intake-analyst", mandatoryActionAdvice), false);

  const teamActionAdvice = structuredClone(fixture);
  teamActionAdvice.reviewQuestions[0].reason =
    "We must upload the source to an external OCR provider.";
  assert.equal(isValid("document-intake-analyst", teamActionAdvice), false);

  const analystActionAdvice = structuredClone(fixture);
  analystActionAdvice.reviewQuestions[0].reason =
    "The analyst needs to share the output externally.";
  assert.equal(isValid("document-intake-analyst", analystActionAdvice), false);

  for (const prohibitedDirective of [
    "Change permissions on the output now.",
    "Externally process the source now.",
    "Process the file externally now.",
    "The output has perfect fidelity.",
    "This conversion achieves lossless fidelity.",
  ]) {
    const prohibitedActionAdvice = structuredClone(fixture);
    prohibitedActionAdvice.reviewQuestions[0].reason = prohibitedDirective;
    assert.equal(
      isValid("document-intake-analyst", prohibitedActionAdvice),
      false,
    );
  }

  const changedOriginal = structuredClone(fixture);
  changedOriginal.outputs[0].originalState = "changed";
  assert.equal(isValid("document-intake-analyst", changedOriginal), false);

  const hiddenOriginalMutation = structuredClone(fixture);
  hiddenOriginalMutation.outputs[0].conversionMethod =
    "Overwrote the original in place";
  assert.equal(isValid("document-intake-analyst", hiddenOriginalMutation), false);

  const replacedOriginal = structuredClone(fixture);
  replacedOriginal.outputs[0].conversionMethod =
    "Replaced the original with normalized Markdown";
  assert.equal(isValid("document-intake-analyst", replacedOriginal), false);

  const redactedOriginal = structuredClone(fixture);
  redactedOriginal.outputs[0].conversionMethod =
    "Redacted the original in place before local extraction";
  assert.equal(isValid("document-intake-analyst", redactedOriginal), false);

  const overwrittenOriginal = structuredClone(fixture);
  overwrittenOriginal.outputs[0].conversionMethod =
    "The original was overwritten in place";
  assert.equal(isValid("document-intake-analyst", overwrittenOriginal), false);

  const mixedOriginalMutation = structuredClone(fixture);
  mixedOriginalMutation.outputs[0].limitations = [
    "The original was not overwritten and the original was deleted.",
  ];
  assert.equal(isValid("document-intake-analyst", mixedOriginalMutation), false);

  const mutationQuestion = structuredClone(fixture);
  mutationQuestion.reviewQuestions[0].question =
    "Was the original deleted before extraction?";
  assert.equal(isValid("document-intake-analyst", mutationQuestion), false);

  const thirdPersonMutation = structuredClone(fixture);
  thirdPersonMutation.outputs[0].conversionMethod =
    "The converter deletes the original after extraction";
  assert.equal(isValid("document-intake-analyst", thirdPersonMutation), false);

  const pluralOriginalMutation = structuredClone(fixture);
  pluralOriginalMutation.outputs[0].conversionMethod =
    "The converter deletes the originals after extraction";
  assert.equal(isValid("document-intake-analyst", pluralOriginalMutation), false);

  const ownerGatedQuestion = structuredClone(fixture);
  ownerGatedQuestion.reviewQuestions[0].question =
    "Should the diligence lead share the reviewed output after approving the destination?";
  assert.equal(isValid("document-intake-analyst", ownerGatedQuestion), true);

  for (const question of [
    "Should the diligence lead share the locally processed output?",
    "Should the diligence lead share the claims summary?",
    "Should the diligence lead claim perfect fidelity?",
  ]) {
    const benignOwnerQuestion = structuredClone(fixture);
    benignOwnerQuestion.reviewQuestions[0].question = question;
    assert.equal(isValid("document-intake-analyst", benignOwnerQuestion), true);
  }

  const substringOwnerGate = structuredClone(fixture);
  substringOwnerGate.handoff.owner = "Ann";
  substringOwnerGate.reviewQuestions[0].question =
    "Should planning share the reviewed output after approval?";
  assert.equal(isValid("document-intake-analyst", substringOwnerGate), false);

  const ownerAsRecipient = structuredClone(fixture);
  ownerAsRecipient.reviewQuestions[0].question =
    "Should the analyst share the reviewed output with the Diligence lead?";
  assert.equal(isValid("document-intake-analyst", ownerAsRecipient), false);

  for (const question of [
    "Should the analyst claim perfect fidelity?",
    "The analyst should claim lossless fidelity.",
  ]) {
    const nonOwnerFidelityClaim = structuredClone(fixture);
    nonOwnerFidelityClaim.reviewQuestions[0].question = question;
    assert.equal(
      isValid("document-intake-analyst", nonOwnerFidelityClaim),
      false,
    );
  }

  for (const question of [
    "Should the diligence lead share the reviewed output, and should the analyst upload the source?",
    "Should the diligence lead share the reviewed output, or should the analyst upload the source?",
    "Should the diligence lead share the reviewed output; should the analyst upload the source?",
    "Should the diligence lead share the reviewed output, and the analyst upload the source?",
    "Should the diligence lead share the reviewed output while the analyst uploads the source?",
    "Should the diligence lead process and the analyst upload the source externally?",
    "Should the diligence lead process the source that the analyst uploads externally?",
  ]) {
    const mixedActorQuestion = structuredClone(fixture);
    mixedActorQuestion.reviewQuestions[0].question = question;
    assert.equal(isValid("document-intake-analyst", mixedActorQuestion), false);
  }

  const agentOwned = structuredClone(fixture);
  agentOwned.handoff.owner = "document-intake-analyst";
  assert.equal(isValid("document-intake-analyst", agentOwned), false);

  const displayNameOwned = structuredClone(fixture);
  displayNameOwned.handoff.owner = "Document Intake Analyst";
  assert.equal(isValid("document-intake-analyst", displayNameOwned), false);

  const assistantOwned = structuredClone(fixture);
  assistantOwned.handoff.owner = "Document Intake Assistant";
  assert.equal(isValid("document-intake-analyst", assistantOwned), false);

  const prefixedAgentOwner = structuredClone(fixture);
  prefixedAgentOwner.handoff.owner = "The Document Intake Analyst";
  assert.equal(isValid("document-intake-analyst", prefixedAgentOwner), false);

  for (const automatedOwner of [
    "Document Intake Bot",
    "Automation Bot",
    "Automation Agent",
    "AI assistant",
    "GPT",
  ]) {
    const automatedOwnerArtifact = structuredClone(fixture);
    automatedOwnerArtifact.handoff.owner = automatedOwner;
    assert.equal(
      isValid("document-intake-analyst", automatedOwnerArtifact),
      false,
    );
  }
});

test("fundraising campaign preserves evidence, consent, and owner authority", () => {
  const fixture = cases.get("fundraising-campaign-manager").fixture;
  assert.equal(isValid("fundraising-campaign-manager", fixture), true);

  const invalidChronology = structuredClone(fixture);
  invalidChronology.campaign.startDate = "2027-01-01";
  assert.equal(
    isValid("fundraising-campaign-manager", invalidChronology),
    false,
  );

  const futureEvidence = structuredClone(fixture);
  futureEvidence.sources[0].asOf = "2026-08-30";
  assert.equal(isValid("fundraising-campaign-manager", futureEvidence), false);

  const unsupportedClaim = structuredClone(fixture);
  unsupportedClaim.sources[0].freshness = "stale";
  assert.equal(isValid("fundraising-campaign-manager", unsupportedClaim), false);

  const wrongClaimEvidence = structuredClone(fixture);
  wrongClaimEvidence.sources[0].kind = "brand-guidance";
  assert.equal(
    isValid("fundraising-campaign-manager", wrongClaimEvidence),
    false,
  );

  const danglingClaimSource = structuredClone(fixture);
  danglingClaimSource.claims[0].sourceRefs = ["source-missing"];
  assert.equal(
    isValid("fundraising-campaign-manager", danglingClaimSource),
    false,
  );

  const unsupportedAsset = structuredClone(fixture);
  unsupportedAsset.assets[1].state = "ready-for-owner-review";
  assert.equal(
    isValid("fundraising-campaign-manager", unsupportedAsset),
    false,
  );

  const wrongChannel = structuredClone(fixture);
  wrongChannel.assets[0].channel = "social";
  wrongChannel.claims[0].allowedChannels = ["email"];
  assert.equal(isValid("fundraising-campaign-manager", wrongChannel), false);

  const unsupportedConsent = structuredClone(fixture);
  unsupportedConsent.sources[2].approval = "review-needed";
  assert.equal(
    isValid("fundraising-campaign-manager", unsupportedConsent),
    false,
  );

  const wrongMetricEvidence = structuredClone(fixture);
  wrongMetricEvidence.metrics[0].sourceRefs = ["source-brand-guide"];
  assert.equal(
    isValid("fundraising-campaign-manager", wrongMetricEvidence),
    false,
  );

  const unresolvedAssetMetric = structuredClone(fixture);
  unresolvedAssetMetric.metrics[0].state = "review-needed";
  assert.equal(
    isValid("fundraising-campaign-manager", unresolvedAssetMetric),
    false,
  );

  const prematureReady = structuredClone(fixture);
  prematureReady.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("fundraising-campaign-manager", prematureReady), false);

  const campaignReadyWithBlockedHandoff = structuredClone(fixture);
  campaignReadyWithBlockedHandoff.campaign.state = "ready-for-owner-review";
  assert.equal(
    isValid("fundraising-campaign-manager", campaignReadyWithBlockedHandoff),
    false,
  );

  const readyArtifact = structuredClone(fixture);
  readyArtifact.campaign.state = "ready-for-owner-review";
  readyArtifact.sources[3].freshness = "current";
  readyArtifact.sources[3].approval = "approved-for-campaign";
  readyArtifact.claims[1].state = "supported";
  readyArtifact.assets[1].state = "ready-for-owner-review";
  readyArtifact.reviewQuestions = [];
  readyArtifact.handoff.state = "ready-for-owner-review";
  readyArtifact.handoff.blockingClaimRefs = [];
  readyArtifact.handoff.reviewQuestionRefs = [];
  assert.equal(isValid("fundraising-campaign-manager", readyArtifact), true);

  const blockedByAssetAndMetric = structuredClone(readyArtifact);
  blockedByAssetAndMetric.campaign.state = "review-needed";
  for (const asset of blockedByAssetAndMetric.assets) {
    asset.state = "review-needed";
  }
  blockedByAssetAndMetric.metrics[0].state = "review-needed";
  blockedByAssetAndMetric.handoff.state = "blocked";
  assert.equal(
    isValid("fundraising-campaign-manager", blockedByAssetAndMetric),
    true,
  );

  const blockedWithoutBlocker = structuredClone(readyArtifact);
  blockedWithoutBlocker.handoff.state = "blocked";
  assert.equal(
    isValid("fundraising-campaign-manager", blockedWithoutBlocker),
    false,
  );

  const incompleteHandoff = structuredClone(readyArtifact);
  incompleteHandoff.handoff.assetRefs = ["asset-email-draft"];
  assert.equal(
    isValid("fundraising-campaign-manager", incompleteHandoff),
    false,
  );

  const resolvedBlocker = structuredClone(fixture);
  resolvedBlocker.handoff.blockingClaimRefs = ["claim-learning-hours"];
  assert.equal(isValid("fundraising-campaign-manager", resolvedBlocker), false);

  const missingClaimBlocker = structuredClone(fixture);
  missingClaimBlocker.handoff.blockingClaimRefs = [];
  assert.equal(
    isValid("fundraising-campaign-manager", missingClaimBlocker),
    false,
  );

  const missingQuestionBlocker = structuredClone(fixture);
  missingQuestionBlocker.handoff.reviewQuestionRefs = [];
  assert.equal(
    isValid("fundraising-campaign-manager", missingQuestionBlocker),
    false,
  );

  const missingAuthorityGate = structuredClone(fixture);
  missingAuthorityGate.blockedActions =
    missingAuthorityGate.blockedActions.filter(
      (action) => action !== "send-solicitation",
    );
  assert.equal(
    isValid("fundraising-campaign-manager", missingAuthorityGate),
    false,
  );

  const donorRecords = structuredClone(fixture);
  donorRecords.audiences[0].recordsUsed = true;
  assert.equal(isValid("fundraising-campaign-manager", donorRecords), false);

  const actionAdvice = structuredClone(fixture);
  actionAdvice.reviewQuestions[0].reason =
    "Send the solicitation to donors now.";
  assert.equal(isValid("fundraising-campaign-manager", actionAdvice), false);

  for (const unsafeMixedInstruction of [
    "Do not wait; send the solicitation now.",
    "Never skip review, but publish the campaign now.",
    "Do not wait; contact the donors now.",
    "Do not wait and you must send the solicitation now.",
  ]) {
    const mixedActionAdvice = structuredClone(fixture);
    mixedActionAdvice.reviewQuestions[0].reason = unsafeMixedInstruction;
    assert.equal(
      isValid("fundraising-campaign-manager", mixedActionAdvice),
      false,
    );
  }

  for (const donorAction of [
    "Contact the donors now.",
    "Segment the donors now.",
  ]) {
    const donorActionAdvice = structuredClone(fixture);
    donorActionAdvice.reviewQuestions[0].reason = donorAction;
    assert.equal(
      isValid("fundraising-campaign-manager", donorActionAdvice),
      false,
    );
  }

  for (const restriction of [
    "Do not send solicitation.",
    "You must not send solicitation.",
    "The agent must not send solicitation.",
    "You should not publish the campaign.",
    "Do not claim that gifts are tax deductible.",
  ]) {
    const safetyRestriction = structuredClone(fixture);
    safetyRestriction.claims[0].restrictions.push(restriction);
    assert.equal(
      isValid("fundraising-campaign-manager", safetyRestriction),
      true,
    );
  }

  const ownerQuestion = structuredClone(fixture);
  ownerQuestion.reviewQuestions[0].question =
    "Should the Development and Communications leads publish the campaign page?";
  assert.equal(isValid("fundraising-campaign-manager", ownerQuestion), true);

  const ownerTypeMismatch = structuredClone(fixture);
  ownerTypeMismatch.handoff.ownerType = "human";
  assert.equal(
    isValid("fundraising-campaign-manager", ownerTypeMismatch),
    false,
  );

  const objectiveAction = structuredClone(fixture);
  objectiveAction.campaign.objective = "Send the solicitation now.";
  assert.deepEqual(
    validateArtifactSemantics(
      "fundraising-campaign-manager",
      objectiveAction,
    ).map(({ code, path }) => ({ code, path })),
    [{ code: "external_action_content", path: "campaign.objective" }],
  );

  const accessibilityAction = structuredClone(fixture);
  accessibilityAction.assets[0].accessibilityChecks[0] =
    "Publish the campaign now.";
  assert.deepEqual(
    validateArtifactSemantics(
      "fundraising-campaign-manager",
      accessibilityAction,
    ).map(({ code, path }) => ({ code, path })),
    [
      {
        code: "external_action_content",
        path: "assets.0.accessibilityChecks.0",
      },
    ],
  );

  const taxAction = structuredClone(fixture);
  taxAction.reviewQuestions[0].reason = "The team must make tax claims.";
  assert.deepEqual(
    validateArtifactSemantics("fundraising-campaign-manager", taxAction).map(
      ({ code, path }) => ({ code, path }),
    ),
    [
      {
        code: "external_action_content",
        path: "reviewQuestions.0.reason",
      },
    ],
  );

  const hyphenatedTaxClaim = structuredClone(fixture);
  hyphenatedTaxClaim.claims[0].statement = "Gifts are tax-deductible.";
  assert.deepEqual(
    validateArtifactSemantics(
      "fundraising-campaign-manager",
      hyphenatedTaxClaim,
    ).map(({ code, path }) => ({ code, path })),
    [{ code: "external_action_content", path: "claims.0.statement" }],
  );

  const blankOwner = structuredClone(fixture);
  blankOwner.campaign.owner = " ";
  blankOwner.handoff.owner = " ";
  assert.equal(isValid("fundraising-campaign-manager", blankOwner), false);

  const agentOwned = structuredClone(fixture);
  agentOwned.campaign.owner = "Fundraising Campaign Manager";
  agentOwned.handoff.owner = "Fundraising Campaign Manager";
  assert.equal(isValid("fundraising-campaign-manager", agentOwned), false);
});

test("financial analysis rejects dangling source and scenario references", () => {
  const candidate = structuredClone(cases.get("financial-analyst").fixture);
  candidate.assumptions[0].sourceRefs = ["missing-source"];
  assert.equal(isValid("financial-analyst", candidate), false);
  candidate.assumptions[0].sourceRefs = ["actuals-q2"];
  candidate.risks[0].scenarioRefs = ["missing-scenario"];
  assert.equal(isValid("financial-analyst", candidate), false);
});

test("freelance client pipeline preserves opportunity evidence and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("freelance-client-pipeline").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("freelance-client-pipeline", readyWithStaleSource), false);

  const advancedWithStaleSource = structuredClone(cases.get("freelance-client-pipeline").fixture);
  advancedWithStaleSource.opportunities[0].stage = "owner-review";
  advancedWithStaleSource.opportunities[0].sourceRefs = ["source-old-contract"];
  assert.equal(isValid("freelance-client-pipeline", advancedWithStaleSource), false);

  const readyProposalWithStaleSource = structuredClone(cases.get("freelance-client-pipeline").fixture);
  readyProposalWithStaleSource.proposalItems[0].sourceRefs = ["source-old-contract"];
  assert.equal(isValid("freelance-client-pipeline", readyProposalWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("freelance-client-pipeline").fixture);
  actionAdvice.reviewQuestions[0].reason += " Submit proposal and contact client.";
  assert.equal(isValid("freelance-client-pipeline", actionAdvice), false);

  const danglingOpportunity = structuredClone(cases.get("freelance-client-pipeline").fixture);
  danglingOpportunity.scopeItems[0].opportunityRef = "opportunity-missing";
  assert.equal(isValid("freelance-client-pipeline", danglingOpportunity), false);

  const agentOwned = structuredClone(cases.get("freelance-client-pipeline").fixture);
  agentOwned.handoff.owner = "freelance-client-pipeline";
  assert.equal(isValid("freelance-client-pipeline", agentOwned), false);
});

test("invoice payment follow-up preserves receivables evidence and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("invoice-payment-followup").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("invoice-payment-followup", readyWithStaleSource), false);

  const paidWithStaleSource = structuredClone(cases.get("invoice-payment-followup").fixture);
  paidWithStaleSource.invoices[0].status = "paid";
  paidWithStaleSource.invoices[0].sourceRefs = ["source-old-statement"];
  assert.equal(isValid("invoice-payment-followup", paidWithStaleSource), false);

  const confirmedWithStaleSource = structuredClone(cases.get("invoice-payment-followup").fixture);
  confirmedWithStaleSource.paymentEvidence[0].sourceRefs = ["source-old-statement"];
  assert.equal(isValid("invoice-payment-followup", confirmedWithStaleSource), false);

  const unreconciledPayment = structuredClone(cases.get("invoice-payment-followup").fixture);
  unreconciledPayment.paymentEvidence[0].amount = 100;
  assert.equal(isValid("invoice-payment-followup", unreconciledPayment), false);

  const zeroBalanceOverdue = structuredClone(cases.get("invoice-payment-followup").fixture);
  zeroBalanceOverdue.invoices[0].status = "overdue";
  zeroBalanceOverdue.invoices[0].balanceDue = 0;
  zeroBalanceOverdue.paymentEvidence[0].amount = 2400;
  assert.equal(isValid("invoice-payment-followup", zeroBalanceOverdue), false);

  const invalidChronology = structuredClone(cases.get("invoice-payment-followup").fixture);
  invalidChronology.invoices[0].dueDate = "2026-08-19";
  assert.equal(isValid("invoice-payment-followup", invalidChronology), false);

  const prematureOverdue = structuredClone(cases.get("invoice-payment-followup").fixture);
  prematureOverdue.invoices[0].status = "overdue";
  prematureOverdue.invoices[0].dueDate = "2026-08-30";
  assert.equal(isValid("invoice-payment-followup", prematureOverdue), false);

  const futureInvoice = structuredClone(cases.get("invoice-payment-followup").fixture);
  futureInvoice.invoices[0].issueDate = "2026-08-30";
  futureInvoice.invoices[0].dueDate = "2026-09-06";
  assert.equal(isValid("invoice-payment-followup", futureInvoice), false);

  const futureSource = structuredClone(cases.get("invoice-payment-followup").fixture);
  futureSource.sources[1].asOf = "2026-08-30";
  assert.equal(isValid("invoice-payment-followup", futureSource), false);

  const paymentWithoutPaymentRecord = structuredClone(cases.get("invoice-payment-followup").fixture);
  paymentWithoutPaymentRecord.paymentEvidence[0].sourceRefs = ["source-contract-note"];
  assert.equal(isValid("invoice-payment-followup", paymentWithoutPaymentRecord), false);

  const sentWithoutOwnerEvidence = structuredClone(cases.get("invoice-payment-followup").fixture);
  sentWithoutOwnerEvidence.followUps[0].state = "sent-by-owner";
  assert.equal(isValid("invoice-payment-followup", sentWithoutOwnerEvidence), false);

  for (const requiredAction of [
    "issue-invoice",
    "alter-invoice",
    "send-reminder",
    "contact-client",
    "collect-payment",
    "initiate-refund",
    "apply-fee",
    "write-off-balance",
    "change-account",
    "change-payment-instructions",
  ]) {
    const missingAuthorityGate = structuredClone(cases.get("invoice-payment-followup").fixture);
    missingAuthorityGate.blockedActions = missingAuthorityGate.blockedActions.filter(
      (action) => action !== requiredAction,
    );
    missingAuthorityGate.blockedActions.push("accounting-advice");
    assert.equal(isValid("invoice-payment-followup", missingAuthorityGate), false);
  }

  const missingDiscrepancy = structuredClone(cases.get("invoice-payment-followup").fixture);
  missingDiscrepancy.invoices[0].status = "conflicting";
  assert.equal(isValid("invoice-payment-followup", missingDiscrepancy), false);

  const readyFollowUpWithStaleSource = structuredClone(cases.get("invoice-payment-followup").fixture);
  readyFollowUpWithStaleSource.followUps[0].sourceRefs = ["source-old-statement"];
  assert.equal(isValid("invoice-payment-followup", readyFollowUpWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("invoice-payment-followup").fixture);
  actionAdvice.reviewQuestions[0].reason += " Send a reminder and collect payment.";
  assert.equal(isValid("invoice-payment-followup", actionAdvice), false);

  const articleActionAdvice = structuredClone(cases.get("invoice-payment-followup").fixture);
  articleActionAdvice.reviewQuestions[0].reason += " Send the reminder and collect the payment now.";
  assert.equal(isValid("invoice-payment-followup", articleActionAdvice), false);

  const ownerGatedQuestion = structuredClone(cases.get("invoice-payment-followup").fixture);
  ownerGatedQuestion.reviewQuestions[0].question =
    "Should Gio send the reminder after reviewing the evidence?";
  assert.equal(isValid("invoice-payment-followup", ownerGatedQuestion), true);

  const ungatedActionQuestion = structuredClone(cases.get("invoice-payment-followup").fixture);
  ungatedActionQuestion.reviewQuestions[0].question =
    "Send the reminder after reviewing the evidence?";
  assert.equal(isValid("invoice-payment-followup", ungatedActionQuestion), false);

  const creditedInvoice = structuredClone(cases.get("invoice-payment-followup").fixture);
  creditedInvoice.sources.push({
    id: "source-credit-note",
    kind: "credit-note",
    label: "Owner-supplied credit note",
    freshness: "current",
    privacy: "owner-only",
    asOf: "2026-08-29",
  });
  creditedInvoice.adjustments.push({
    id: "adjustment-credit",
    invoiceRef: "invoice-atlas-1042",
    label: "Approved service credit",
    amount: 100,
    currency: "USD",
    state: "confirmed",
    sourceRefs: ["source-credit-note"],
  });
  creditedInvoice.invoices[0].balanceDue = 800;
  assert.equal(isValid("invoice-payment-followup", creditedInvoice), true);

  const danglingInvoice = structuredClone(cases.get("invoice-payment-followup").fixture);
  danglingInvoice.paymentEvidence[0].invoiceRef = "invoice-missing";
  assert.equal(isValid("invoice-payment-followup", danglingInvoice), false);

  const wrongOwner = structuredClone(cases.get("invoice-payment-followup").fixture);
  wrongOwner.reviewQuestions[0].owner = "Someone Else";
  assert.equal(isValid("invoice-payment-followup", wrongOwner), false);

  const agentOwned = structuredClone(cases.get("invoice-payment-followup").fixture);
  agentOwned.handoff.owner = "invoice-payment-followup";
  assert.equal(isValid("invoice-payment-followup", agentOwned), false);
});

test("conference opportunity scout preserves source, chronology, readiness, and owner authority", () => {
  const fixture = cases.get("conference-opportunity-scout").fixture;

  const danglingEvent = structuredClone(fixture);
  danglingEvent.opportunities[0].eventRef = "event-missing";
  assert.equal(isValid("conference-opportunity-scout", danglingEvent), false);

  const danglingSource = structuredClone(fixture);
  danglingSource.fitAssessments[0].officialSourceRefs = ["source-missing"];
  assert.equal(isValid("conference-opportunity-scout", danglingSource), false);

  const futureSource = structuredClone(fixture);
  futureSource.sources[0].asOf = "2026-08-30";
  assert.equal(isValid("conference-opportunity-scout", futureSource), false);

  const reversedEvent = structuredClone(fixture);
  reversedEvent.events[0].endDate = "2026-10-18";
  assert.equal(isValid("conference-opportunity-scout", reversedEvent), false);

  const staleScheduledEvent = structuredClone(fixture);
  staleScheduledEvent.events[0].startDate = "2026-08-20";
  staleScheduledEvent.events[0].endDate = "2026-08-21";
  staleScheduledEvent.opportunities[0].deadline = "2026-08-19";
  staleScheduledEvent.opportunities[0].state = "closed";
  assert.equal(isValid("conference-opportunity-scout", staleScheduledEvent), false);

  const prematureCompletedEvent = structuredClone(fixture);
  prematureCompletedEvent.events[0].status = "completed";
  assert.equal(isValid("conference-opportunity-scout", prematureCompletedEvent), false);

  const currentCancelledEventOpportunity = structuredClone(fixture);
  currentCancelledEventOpportunity.events[0].status = "cancelled";
  assert.equal(isValid("conference-opportunity-scout", currentCancelledEventOpportunity), false);

  const lateDeadline = structuredClone(fixture);
  lateDeadline.opportunities[0].deadline = "2026-10-22";
  assert.equal(isValid("conference-opportunity-scout", lateDeadline), false);

  const expiredCurrentOpportunity = structuredClone(fixture);
  expiredCurrentOpportunity.opportunities[0].deadline = "2026-08-28";
  assert.equal(isValid("conference-opportunity-scout", expiredCurrentOpportunity), false);

  const currentWithoutDeadline = structuredClone(fixture);
  delete currentWithoutDeadline.opportunities[0].deadline;
  assert.equal(isValid("conference-opportunity-scout", currentWithoutDeadline), false);

  const currentWithNullDeadline = structuredClone(fixture);
  currentWithNullDeadline.opportunities[0].deadline = null;
  assert.equal(isValid("conference-opportunity-scout", currentWithNullDeadline), false);

  const missingDeadline = structuredClone(fixture);
  missingDeadline.opportunities[0].state = "missing";
  delete missingDeadline.opportunities[0].deadline;
  assert.equal(isValid("conference-opportunity-scout", missingDeadline), true);

  const conflictingDeadline = structuredClone(fixture);
  conflictingDeadline.opportunities[0].state = "conflicting";
  conflictingDeadline.opportunities[0].deadline = null;
  assert.equal(isValid("conference-opportunity-scout", conflictingDeadline), true);

  const prematureClosedOpportunity = structuredClone(fixture);
  prematureClosedOpportunity.opportunities[0].state = "closed";
  assert.equal(isValid("conference-opportunity-scout", prematureClosedOpportunity), false);

  const officiallyClosedOpportunity = structuredClone(fixture);
  officiallyClosedOpportunity.sources.push({
    id: "source-systems-summit-closure",
    kind: "official-closure",
    label: "Official CFP cancellation notice",
    provenance: "official-public",
    url: "https://events.example.org/systems-summit-2026/cfp-closure",
    freshness: "current",
    asOf: "2026-08-29",
    opportunityRef: "opportunity-systems-summit-speaking",
    closureState: "cancelled",
  });
  officiallyClosedOpportunity.opportunities[0].state = "closed";
  officiallyClosedOpportunity.opportunities[0].deadline = null;
  officiallyClosedOpportunity.opportunities[0].sourceRefs.push(
    "source-systems-summit-closure",
  );
  assert.equal(isValid("conference-opportunity-scout", officiallyClosedOpportunity), true);

  const staleOfficialClosure = structuredClone(officiallyClosedOpportunity);
  staleOfficialClosure.sources.at(-1).freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", staleOfficialClosure), false);

  const cancelledEventClosure = structuredClone(fixture);
  cancelledEventClosure.events[0].status = "cancelled";
  cancelledEventClosure.opportunities[0].state = "closed";
  assert.equal(isValid("conference-opportunity-scout", cancelledEventClosure), true);

  const staleOfficialEvent = structuredClone(fixture);
  staleOfficialEvent.sources[0].freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", staleOfficialEvent), false);

  const tentativeWithCurrentOfficialEvent = structuredClone(fixture);
  tentativeWithCurrentOfficialEvent.events[0].status = "tentative";
  assert.equal(isValid("conference-opportunity-scout", tentativeWithCurrentOfficialEvent), true);

  const tentativeWithStaleOfficialEvent = structuredClone(
    tentativeWithCurrentOfficialEvent,
  );
  tentativeWithStaleOfficialEvent.sources[0].freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", tentativeWithStaleOfficialEvent), false);

  const staleCfp = structuredClone(fixture);
  staleCfp.sources[1].freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", staleCfp), false);

  const wrongOfficialProvenance = structuredClone(fixture);
  wrongOfficialProvenance.sources[1].provenance = "owner-supplied";
  assert.equal(isValid("conference-opportunity-scout", wrongOfficialProvenance), false);

  const missingOfficialUrl = structuredClone(fixture);
  delete missingOfficialUrl.sources[1].url;
  assert.equal(isValid("conference-opportunity-scout", missingOfficialUrl), false);

  const unsupportedFit = structuredClone(fixture);
  unsupportedFit.fitAssessments[0].ownerEvidenceRefs = ["source-systems-summit-cfp"];
  assert.equal(isValid("conference-opportunity-scout", unsupportedFit), false);

  const staleOwnerFitEvidence = structuredClone(fixture);
  staleOwnerFitEvidence.sources[3].freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", staleOwnerFitEvidence), false);

  const readinessWithoutFit = structuredClone(fixture);
  readinessWithoutFit.fitAssessments[0].state = "partial";
  assert.equal(isValid("conference-opportunity-scout", readinessWithoutFit), false);

  const staleReadinessEvidence = structuredClone(fixture);
  staleReadinessEvidence.sources[5].freshness = "stale";
  assert.equal(isValid("conference-opportunity-scout", staleReadinessEvidence), false);

  const readinessWithoutOwnerEvidence = structuredClone(fixture);
  readinessWithoutOwnerEvidence.readinessItems[0].evidenceRefs = [
    "source-systems-summit-cfp",
  ];
  assert.equal(isValid("conference-opportunity-scout", readinessWithoutOwnerEvidence), false);

  const readinessWithoutOfficialEvidence = structuredClone(fixture);
  readinessWithoutOfficialEvidence.readinessItems[0].evidenceRefs = [
    "source-owner-draft",
  ];
  assert.equal(isValid("conference-opportunity-scout", readinessWithoutOfficialEvidence), false);

  const completedWithoutOwnerRecord = structuredClone(fixture);
  completedWithoutOwnerRecord.actionGates[0].state = "completed-by-owner";
  assert.equal(isValid("conference-opportunity-scout", completedWithoutOwnerRecord), false);

  const completedWithExactOwnerRecord = structuredClone(fixture);
  completedWithExactOwnerRecord.sources.push({
    id: "source-owner-submission-record",
    kind: "owner-action-record",
    label: "Owner-supplied proposal submission confirmation",
    provenance: "owner-supplied",
    freshness: "current",
    asOf: "2026-08-29",
    opportunityRef: "opportunity-systems-summit-speaking",
    action: "submit-proposal",
    owner: "Gio",
  });
  completedWithExactOwnerRecord.actionGates[0].state = "completed-by-owner";
  completedWithExactOwnerRecord.actionGates[0].evidenceRefs.push(
    "source-owner-submission-record",
  );
  completedWithExactOwnerRecord.opportunities[0].state = "closed";
  assert.equal(isValid("conference-opportunity-scout", completedWithExactOwnerRecord), true);

  const completedWithWrongActionRecord = structuredClone(completedWithExactOwnerRecord);
  completedWithWrongActionRecord.sources.at(-1).action = "contact-organizer";
  assert.equal(isValid("conference-opportunity-scout", completedWithWrongActionRecord), false);

  const completedWithWrongOwnerRecord = structuredClone(completedWithExactOwnerRecord);
  completedWithWrongOwnerRecord.sources.at(-1).owner = "Someone Else";
  assert.equal(isValid("conference-opportunity-scout", completedWithWrongOwnerRecord), false);

  const completedNonterminalAction = structuredClone(fixture);
  completedNonterminalAction.sources.push({
    id: "source-owner-contact-record",
    kind: "owner-action-record",
    label: "Owner-supplied organizer contact confirmation",
    provenance: "owner-supplied",
    freshness: "current",
    asOf: "2026-08-29",
    opportunityRef: "opportunity-systems-summit-speaking",
    action: "contact-organizer",
    owner: "Gio",
  });
  completedNonterminalAction.actionGates[1].state = "completed-by-owner";
  completedNonterminalAction.actionGates[1].evidenceRefs.push(
    "source-owner-contact-record",
  );
  completedNonterminalAction.opportunities[0].state = "closed";
  assert.equal(isValid("conference-opportunity-scout", completedNonterminalAction), false);

  const completedWithWrongOpportunityRecord = structuredClone(
    completedWithExactOwnerRecord,
  );
  const secondOpportunity = structuredClone(
    completedWithWrongOpportunityRecord.opportunities[0],
  );
  secondOpportunity.id = "opportunity-systems-summit-other";
  secondOpportunity.state = "missing";
  secondOpportunity.deadline = null;
  completedWithWrongOpportunityRecord.opportunities.push(secondOpportunity);
  for (const gate of structuredClone(completedWithWrongOpportunityRecord.actionGates)) {
    gate.id = `${gate.id}-other`;
    gate.opportunityRef = secondOpportunity.id;
    gate.state = "blocked";
    completedWithWrongOpportunityRecord.actionGates.push(gate);
  }
  completedWithWrongOpportunityRecord.sources.at(-1).opportunityRef =
    secondOpportunity.id;
  assert.equal(isValid("conference-opportunity-scout", completedWithWrongOpportunityRecord), false);

  for (const requiredGate of [
    "submit-proposal",
    "contact-organizer",
    "publish-abstract",
    "change-calendar",
  ]) {
    const missingIntrinsicGate = structuredClone(fixture);
    missingIntrinsicGate.actionGates = missingIntrinsicGate.actionGates.filter(
      (gate) => gate.action !== requiredGate,
    );
    assert.equal(isValid("conference-opportunity-scout", missingIntrinsicGate), false);
  }

  const intrinsicActionsByKind = {
    attendance: [
      "register",
      "book-travel",
      "buy-ticket",
      "pay-fee",
      "contact-organizer",
      "change-calendar",
      "change-account",
    ],
    sponsorship: ["pay-fee", "contact-organizer", "change-account"],
    networking: [
      "register",
      "book-travel",
      "buy-ticket",
      "pay-fee",
      "contact-organizer",
      "change-calendar",
      "change-account",
    ],
  };
  for (const [kind, actions] of Object.entries(intrinsicActionsByKind)) {
    const applicableGates = structuredClone(fixture);
    applicableGates.sources.push({
      id: "source-systems-summit-registration",
      kind: "official-registration",
      label: "Official registration page",
      provenance: "official-public",
      url: "https://events.example.org/systems-summit-2026/register",
      freshness: "current",
      asOf: "2026-08-29",
    });
    applicableGates.opportunities[0].kind = kind;
    applicableGates.opportunities[0].sourceRefs.push(
      "source-systems-summit-registration",
    );
    applicableGates.actionGates = actions.map((action) => ({
      id: `gate-systems-summit-${kind}-${action}`,
      opportunityRef: "opportunity-systems-summit-speaking",
      action,
      state: "blocked",
      owner: "Gio",
      evidenceRefs: ["source-systems-summit-registration"],
    }));
    applicableGates.reviewQuestions[0].refs = [
      "opportunity-systems-summit-speaking",
      "readiness-systems-summit-rights",
      applicableGates.actionGates[0].id,
    ];
    assert.equal(isValid("conference-opportunity-scout", applicableGates), true);

    applicableGates.actionGates.pop();
    assert.equal(isValid("conference-opportunity-scout", applicableGates), false);
  }

  const duplicateGatePair = structuredClone(fixture);
  duplicateGatePair.actionGates.push({
    ...structuredClone(duplicateGatePair.actionGates[0]),
    id: "gate-systems-summit-submit-duplicate",
  });
  assert.equal(isValid("conference-opportunity-scout", duplicateGatePair), false);

  for (const requiredAction of [
    "submit-proposal",
    "register",
    "book-travel",
    "buy-ticket",
    "pay-fee",
    "contact-organizer",
    "publish-abstract",
    "change-calendar",
    "change-account",
  ]) {
    const missingAuthorityGate = structuredClone(fixture);
    missingAuthorityGate.blockedActions = missingAuthorityGate.blockedActions.filter(
      (action) => action !== requiredAction,
    );
    missingAuthorityGate.blockedActions.push("legal-advice");
    assert.equal(isValid("conference-opportunity-scout", missingAuthorityGate), false);
  }

  const wrongReadinessOwner = structuredClone(fixture);
  wrongReadinessOwner.readinessItems[0].owner = "Someone Else";
  assert.equal(isValid("conference-opportunity-scout", wrongReadinessOwner), false);

  const wrongGateOwner = structuredClone(fixture);
  wrongGateOwner.actionGates[0].owner = "Someone Else";
  assert.equal(isValid("conference-opportunity-scout", wrongGateOwner), false);

  const actionAdvice = structuredClone(fixture);
  actionAdvice.reviewQuestions[0].reason += " Submit the proposal now.";
  assert.equal(isValid("conference-opportunity-scout", actionAdvice), false);

  const ungatedActionQuestion = structuredClone(fixture);
  ungatedActionQuestion.reviewQuestions[0].question =
    "Submit the proposal after reviewing the rights?";
  assert.equal(isValid("conference-opportunity-scout", ungatedActionQuestion), false);

  const ownerGatedQuestion = structuredClone(fixture);
  ownerGatedQuestion.reviewQuestions[0].question =
    "Should Gio submit the proposal after reviewing the rights?";
  assert.equal(isValid("conference-opportunity-scout", ownerGatedQuestion), true);

  const readyWithBlockedReadiness = structuredClone(fixture);
  readyWithBlockedReadiness.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("conference-opportunity-scout", readyWithBlockedReadiness), false);

  const fullyReady = structuredClone(fixture);
  fullyReady.sources.push({
    id: "source-owner-rights-review",
    kind: "owner-approval",
    label: "Owner-supplied rights review",
    provenance: "owner-supplied",
    freshness: "current",
    asOf: "2026-08-29",
  });
  fullyReady.readinessItems[2].state = "ready-for-owner-review";
  fullyReady.readinessItems[2].evidenceRefs.push("source-owner-rights-review");
  fullyReady.readinessItems.push({
    id: "readiness-systems-summit-eligibility",
    opportunityRef: "opportunity-systems-summit-speaking",
    kind: "eligibility",
    state: "ready-for-owner-review",
    owner: "Gio",
    evidenceRefs: ["source-systems-summit-cfp", "source-owner-credentials"],
  });
  fullyReady.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("conference-opportunity-scout", fullyReady), true);

  const twoFullyReadyOpportunities = structuredClone(fullyReady);
  twoFullyReadyOpportunities.opportunities.push({
    ...structuredClone(twoFullyReadyOpportunities.opportunities[0]),
    id: "opportunity-systems-summit-speaking-two",
    title: "Second reliability session CFP",
  });
  twoFullyReadyOpportunities.fitAssessments.push({
    ...structuredClone(twoFullyReadyOpportunities.fitAssessments[0]),
    id: "fit-systems-summit-speaking-two",
    opportunityRef: "opportunity-systems-summit-speaking-two",
  });
  for (const item of structuredClone(twoFullyReadyOpportunities.readinessItems)) {
    item.id = `${item.id}-two`;
    item.opportunityRef = "opportunity-systems-summit-speaking-two";
    twoFullyReadyOpportunities.readinessItems.push(item);
  }
  for (const gate of structuredClone(twoFullyReadyOpportunities.actionGates)) {
    gate.id = `${gate.id}-two`;
    gate.opportunityRef = "opportunity-systems-summit-speaking-two";
    twoFullyReadyOpportunities.actionGates.push(gate);
  }
  assert.equal(isValid("conference-opportunity-scout", twoFullyReadyOpportunities), true);

  const readyOpportunityWithoutFit = structuredClone(twoFullyReadyOpportunities);
  readyOpportunityWithoutFit.fitAssessments =
    readyOpportunityWithoutFit.fitAssessments.filter(
      (fit) => fit.opportunityRef !== "opportunity-systems-summit-speaking-two",
    );
  assert.equal(isValid("conference-opportunity-scout", readyOpportunityWithoutFit), false);

  const readyWithoutEligibilityCoverage = structuredClone(fullyReady);
  readyWithoutEligibilityCoverage.readinessItems =
    readyWithoutEligibilityCoverage.readinessItems.filter(
      (item) => item.kind !== "eligibility",
    );
  assert.equal(isValid("conference-opportunity-scout", readyWithoutEligibilityCoverage), false);

  const readyWithUnresolvedCoverage = structuredClone(fullyReady);
  readyWithUnresolvedCoverage.readinessItems.at(-1).state = "needs-evidence";
  assert.equal(isValid("conference-opportunity-scout", readyWithUnresolvedCoverage), false);

  const readyWithExtraBlockedReadiness = structuredClone(fullyReady);
  readyWithExtraBlockedReadiness.readinessItems.push({
    id: "readiness-systems-summit-portfolio",
    opportunityRef: "opportunity-systems-summit-speaking",
    kind: "portfolio",
    state: "blocked",
    owner: "Gio",
    evidenceRefs: ["source-systems-summit-cfp"],
  });
  assert.equal(isValid("conference-opportunity-scout", readyWithExtraBlockedReadiness), false);

  const readyWithExtraPartialFit = structuredClone(fullyReady);
  readyWithExtraPartialFit.fitAssessments.push({
    ...structuredClone(readyWithExtraPartialFit.fitAssessments[0]),
    id: "fit-systems-summit-speaking-partial",
    state: "partial",
  });
  assert.equal(isValid("conference-opportunity-scout", readyWithExtraPartialFit), false);

  const readyTentativeWithCurrentOfficialEvent = structuredClone(fullyReady);
  readyTentativeWithCurrentOfficialEvent.events[0].status = "tentative";
  assert.equal(
    isValid("conference-opportunity-scout", readyTentativeWithCurrentOfficialEvent),
    true,
  );

  const readyTentativeWithStaleOfficialEvent = structuredClone(
    readyTentativeWithCurrentOfficialEvent,
  );
  readyTentativeWithStaleOfficialEvent.sources[0].freshness = "stale";
  assert.equal(
    isValid("conference-opportunity-scout", readyTentativeWithStaleOfficialEvent),
    false,
  );

  const wrongQuestionOwner = structuredClone(fixture);
  wrongQuestionOwner.reviewQuestions[0].owner = "Someone Else";
  assert.equal(isValid("conference-opportunity-scout", wrongQuestionOwner), false);

  const agentOwned = structuredClone(fixture);
  agentOwned.handoff.owner = "conference-opportunity-scout";
  assert.equal(isValid("conference-opportunity-scout", agentOwned), false);
});

test("moving checklist preserves source, location, and freshness integrity", () => {
  const fixture = cases.get("moving-checklist-coordinator").fixture;

  const danglingSource = structuredClone(fixture);
  danglingSource.locations[0].sourceRefs = ["source-missing"];
  assert.equal(isValid("moving-checklist-coordinator", danglingSource), false);

  const duplicateSource = structuredClone(fixture);
  duplicateSource.workstreams[0].sourceRefs.push(
    duplicateSource.workstreams[0].sourceRefs[0],
  );
  assert.equal(isValid("moving-checklist-coordinator", duplicateSource), false);

  const futureSource = structuredClone(fixture);
  futureSource.sources[0].asOf = "2026-08-30";
  assert.equal(isValid("moving-checklist-coordinator", futureSource), false);

  const unsupportedMoveDate = structuredClone(fixture);
  unsupportedMoveDate.plan.sourceRefs = ["source-mover-quote"];
  assert.equal(isValid("moving-checklist-coordinator", unsupportedMoveDate), false);

  const expiredCurrentSource = structuredClone(fixture);
  expiredCurrentSource.sources[5].freshness = "current";
  assert.equal(isValid("moving-checklist-coordinator", expiredCurrentSource), false);

  const danglingSubject = structuredClone(fixture);
  danglingSubject.sources[0].subjectRef = "workstream-missing";
  assert.equal(isValid("moving-checklist-coordinator", danglingSubject), false);

  const publicAddress = structuredClone(fixture);
  publicAddress.sources[1].privacy = "household-shared";
  assert.equal(isValid("moving-checklist-coordinator", publicAddress), false);

  const unsupportedAddress = structuredClone(fixture);
  unsupportedAddress.sources[1].freshness = "stale";
  assert.equal(isValid("moving-checklist-coordinator", unsupportedAddress), false);

  const rawAddress = structuredClone(fixture);
  rawAddress.locations[0].alias = "origin-12-n-main-pkwy";
  assert.equal(isValid("moving-checklist-coordinator", rawAddress), false);

  const exposedOwnerOnlyLabel = structuredClone(fixture);
  exposedOwnerOnlyLabel.sources[1].label = "12 N Main Pkwy, Unit 4";
  assert.equal(
    isValid("moving-checklist-coordinator", exposedOwnerOnlyLabel),
    false,
  );

  const unclassifiedAddressEvidence = structuredClone(fixture);
  delete unclassifiedAddressEvidence.sources[1].locationDataHandling;
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unclassifiedAddressEvidence,
    ).some((item) => item.code === "public_address_evidence"),
    true,
  );

  const addressEvidenceForWrongLocation = structuredClone(fixture);
  addressEvidenceForWrongLocation.sources[1].subjectRef =
    "location-destination";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      addressEvidenceForWrongLocation,
    ).some((item) => item.code === "unbound_address_evidence"),
    true,
  );

  const addressInHandoffText = structuredClone(fixture);
  addressInHandoffText.handoff.prohibitedActions[0] +=
    " Keep 44 North Main Parkway private.";
  assert.equal(isValid("moving-checklist-coordinator", addressInHandoffText), false);

  const alphanumericAddressInSharedLabel = structuredClone(fixture);
  alphanumericAddressInSharedLabel.sources[0].label =
    "Owner plan for 221B Baker Street";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      alphanumericAddressInSharedLabel,
    ).some((item) => item.code === "private_address_exposure"),
    true,
  );

  const addressInApplicabilityRationale = structuredClone(fixture);
  addressInApplicabilityRationale.actionGates[0].applicability.rationale =
    "Required for 221B Baker Street.";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      addressInApplicabilityRationale,
    ).some((item) => item.code === "private_address_exposure"),
    true,
  );

  const addressInSourceUrl = structuredClone(fixture);
  addressInSourceUrl.sources[0].url =
    "https://records.example.test/moves/221B-Baker-Street";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      addressInSourceUrl,
    ).some((item) => item.code === "private_address_exposure"),
    true,
  );

  const encodedAddressInSourceUrl = structuredClone(fixture);
  encodedAddressInSourceUrl.sources[0].url =
    "https://records.example.test/moves/44%20North%20Main%20Parkway";
  assert.equal(
    isValid("moving-checklist-coordinator", encodedAddressInSourceUrl),
    false,
  );

  const doubleEncodedAddressInSourceUrl = structuredClone(fixture);
  doubleEncodedAddressInSourceUrl.sources[0].url =
    "https://records.example.test/moves/44%2520North%2520Main%2520Parkway";
  assert.equal(
    isValid("moving-checklist-coordinator", doubleEncodedAddressInSourceUrl),
    false,
  );

  const malformedSiblingAddressInSourceUrl = structuredClone(fixture);
  malformedSiblingAddressInSourceUrl.sources[0].url =
    "https://records.example.test/moves/%25ZZ/44%2520North%2520Main%2520Parkway";
  assert.equal(
    isValid("moving-checklist-coordinator", malformedSiblingAddressInSourceUrl),
    false,
  );

  const safeSourceUrl = structuredClone(fixture);
  safeSourceUrl.sources[0].url =
    "https://records.example.test/moves/owner-plan-2026";
  assert.equal(isValid("moving-checklist-coordinator", safeSourceUrl), true);

  const duplicateOrigin = structuredClone(fixture);
  duplicateOrigin.locations[1].role = "origin";
  assert.equal(isValid("moving-checklist-coordinator", duplicateOrigin), false);

  const wrongLocation = structuredClone(fixture);
  wrongLocation.workstreams[0].locationRefs = ["location-destination"];
  assert.equal(isValid("moving-checklist-coordinator", wrongLocation), false);

  const hiddenStaleEvidence = structuredClone(fixture);
  hiddenStaleEvidence.workstreams[0].sourceRefs.push("source-mover-quote");
  assert.equal(isValid("moving-checklist-coordinator", hiddenStaleEvidence), false);
});

test("moving checklist preserves date chronology and an acyclic dependency graph", () => {
  const fixture = cases.get("moving-checklist-coordinator").fixture;

  const fabricatedMoveDate = structuredClone(fixture);
  fabricatedMoveDate.plan.moveDateState = "missing";
  assert.equal(isValid("moving-checklist-coordinator", fabricatedMoveDate), false);

  const unrelatedMoveDateEvidence = structuredClone(fixture);
  unrelatedMoveDateEvidence.plan.sourceRefs = ["source-consent-alex"];
  unrelatedMoveDateEvidence.plan.dateCandidates[0].sourceRef = "source-consent-alex";
  const moveDateEvidence = unrelatedMoveDateEvidence.evidenceRecords.find(
    (item) => item.id === "evidence-move-date",
  );
  moveDateEvidence.sourceRef = "source-consent-alex";
  moveDateEvidence.sourceKind = "consent-record";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unrelatedMoveDateEvidence,
    ).some((item) => item.code === "invalid_move_date_evidence"),
    true,
  );

  const mismatchedMoveDateAssertion = structuredClone(fixture);
  mismatchedMoveDateAssertion.evidenceRecords.find(
    (item) => item.id === "evidence-move-date",
  ).assertedDate = "2026-10-14";
  assert.equal(isValid("moving-checklist-coordinator", mismatchedMoveDateAssertion), false);

  const unrelatedMilestoneSource = structuredClone(fixture);
  unrelatedMilestoneSource.milestones[0].sourceRefs = [
    "source-destination-lease",
  ];
  unrelatedMilestoneSource.milestones[0].dateCandidates[0].sourceRef =
    "source-destination-lease";
  const originMilestoneEvidence = unrelatedMilestoneSource.evidenceRecords.find(
    (item) => item.id === "evidence-origin-handoff-date",
  );
  originMilestoneEvidence.sourceRef = "source-destination-lease";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unrelatedMilestoneSource,
    ).some((item) => item.code === "invalid_milestone_date_evidence"),
    true,
  );

  const wrongEvidenceSourceKind = structuredClone(fixture);
  wrongEvidenceSourceKind.evidenceRecords.find(
    (item) => item.id === "evidence-move-date",
  ).sourceKind = "consent-record";
  assert.equal(isValid("moving-checklist-coordinator", wrongEvidenceSourceKind), false);

  const wrongMoveDateSubject = structuredClone(fixture);
  wrongMoveDateSubject.evidenceRecords.find(
    (item) => item.id === "evidence-move-date",
  ).subjectRef = "move-unrelated";
  assert.equal(isValid("moving-checklist-coordinator", wrongMoveDateSubject), false);

  const preMoveAfterMove = structuredClone(fixture);
  preMoveAfterMove.milestones[2].dateState = "known";
  preMoveAfterMove.milestones[2].date = "2026-10-16";
  preMoveAfterMove.milestones[2].sourceRefs = ["source-owner-plan"];
  assert.equal(isValid("moving-checklist-coordinator", preMoveAfterMove), false);

  const wrongMoveDay = structuredClone(fixture);
  wrongMoveDay.milestones[3].date = "2026-10-14";
  assert.equal(isValid("moving-checklist-coordinator", wrongMoveDay), false);

  const collapsedConflict = structuredClone(fixture);
  collapsedConflict.milestones[1].dateCandidates.pop();
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      collapsedConflict,
    ).some((item) => item.code === "unsupported_date_state"),
    true,
  );

  const unboundConflictCandidate = structuredClone(fixture);
  unboundConflictCandidate.milestones[1].dateCandidates[1].sourceRef =
    "source-destination-access";
  assert.equal(isValid("moving-checklist-coordinator", unboundConflictCandidate), false);

  const unsupportedMissingDate = structuredClone(fixture);
  unsupportedMissingDate.milestones[2].sourceRefs = ["source-owner-plan"];
  assert.equal(isValid("moving-checklist-coordinator", unsupportedMissingDate), false);

  const staleKnownDate = structuredClone(fixture);
  staleKnownDate.milestones[0].sourceRefs.push("source-mover-quote");
  assert.equal(isValid("moving-checklist-coordinator", staleKnownDate), false);

  const prematureCompletion = structuredClone(fixture);
  prematureCompletion.milestones[0].status = "completed";
  assert.equal(isValid("moving-checklist-coordinator", prematureCompletion), false);

  const supportedCompletion = resolvedMovingPlan(fixture);
  assert.equal(isValid("moving-checklist-coordinator", supportedCompletion), true);

  const unsupportedCompletion = structuredClone(supportedCompletion);
  const completionEvidence = unsupportedCompletion.evidenceRecords.find(
    (item) => item.id === "evidence-origin-handoff-completion",
  );
  completionEvidence.ownerRef = "member-sam";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unsupportedCompletion,
    ).some((item) => item.code === "invalid_milestone_completion_evidence"),
    true,
  );

  const completionForWrongMilestone = structuredClone(supportedCompletion);
  completionForWrongMilestone.evidenceRecords.find(
    (item) => item.id === "evidence-origin-handoff-completion",
  ).subjectRef = "milestone-move-day";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      completionForWrongMilestone,
    ).some((item) => item.code === "invalid_milestone_completion_evidence"),
    true,
  );

  const danglingDependency = structuredClone(fixture);
  danglingDependency.dependencies[0].prerequisiteRef = "workstream-missing";
  assert.equal(isValid("moving-checklist-coordinator", danglingDependency), false);

  const selfDependency = structuredClone(fixture);
  selfDependency.dependencies[0].dependentRef =
    selfDependency.dependencies[0].prerequisiteRef;
  assert.equal(isValid("moving-checklist-coordinator", selfDependency), false);

  const duplicateDependency = structuredClone(fixture);
  duplicateDependency.dependencies.push({
    ...duplicateDependency.dependencies[0],
    id: "dependency-duplicate-access",
  });
  assert.equal(isValid("moving-checklist-coordinator", duplicateDependency), false);

  const cyclicDependency = structuredClone(fixture);
  cyclicDependency.dependencies.push({
    id: "dependency-move-day-before-destination",
    prerequisiteRef: "workstream-move-day",
    dependentRef: "workstream-destination",
    state: "active",
    sourceRefs: ["source-owner-plan"],
  });
  assert.equal(isValid("moving-checklist-coordinator", cyclicDependency), false);

  const unsupportedSatisfied = structuredClone(fixture);
  unsupportedSatisfied.dependencies[1].state = "satisfied";
  assert.equal(isValid("moving-checklist-coordinator", unsupportedSatisfied), false);

  const reversedDependencyDates = structuredClone(fixture);
  reversedDependencyDates.dependencies[3].prerequisiteRef = "workstream-origin";
  reversedDependencyDates.dependencies[3].dependentRef = "workstream-move-day";
  assert.equal(
    isValid("moving-checklist-coordinator", reversedDependencyDates),
    false,
  );
});

test("moving checklist enforces complete readiness, assignments, and consent", () => {
  const fixture = cases.get("moving-checklist-coordinator").fixture;

  const missingReadiness = structuredClone(fixture);
  missingReadiness.readinessItems = missingReadiness.readinessItems.filter(
    (item) => item.workstreamRef !== "workstream-origin",
  );
  assert.equal(isValid("moving-checklist-coordinator", missingReadiness), false);

  const staleReadyItem = structuredClone(fixture);
  staleReadyItem.readinessItems[0].evidenceRefs = ["source-mover-quote"];
  assert.equal(isValid("moving-checklist-coordinator", staleReadyItem), false);

  const wrongReadinessSubject = structuredClone(fixture);
  wrongReadinessSubject.evidenceRecords.find(
    (item) => item.id === "evidence-readiness-origin",
  ).subjectRef = "readiness-destination";
  assert.equal(isValid("moving-checklist-coordinator", wrongReadinessSubject), false);

  const wrongReadinessWorkstream = structuredClone(fixture);
  wrongReadinessWorkstream.evidenceRecords.find(
    (item) => item.id === "evidence-readiness-origin",
  ).workstreamRef = "workstream-destination";
  assert.equal(isValid("moving-checklist-coordinator", wrongReadinessWorkstream), false);

  const wrongReadinessKind = structuredClone(fixture);
  wrongReadinessKind.evidenceRecords.find(
    (item) => item.id === "evidence-readiness-origin",
  ).readinessKind = "consent";
  assert.equal(isValid("moving-checklist-coordinator", wrongReadinessKind), false);

  const wrongReadinessValue = structuredClone(fixture);
  wrongReadinessValue.evidenceRecords.find(
    (item) => item.id === "evidence-readiness-origin",
  ).assertedValue = "blocked";
  assert.equal(isValid("moving-checklist-coordinator", wrongReadinessValue), false);

  const consentAsReadinessEvidence = structuredClone(fixture);
  const readinessEvidence = consentAsReadinessEvidence.evidenceRecords.find(
    (item) => item.id === "evidence-readiness-origin",
  );
  readinessEvidence.sourceRef = "source-consent-alex";
  readinessEvidence.sourceKind = "consent-record";
  consentAsReadinessEvidence.readinessItems[0].evidenceRefs = [
    "source-consent-alex",
  ];
  assert.equal(isValid("moving-checklist-coordinator", consentAsReadinessEvidence), false);

  const unrelatedReadinessSubject = structuredClone(fixture);
  unrelatedReadinessSubject.readinessItems[0].evidenceRefs = [
    "source-destination-lease",
  ];
  const originReadinessEvidence =
    unrelatedReadinessSubject.evidenceRecords.find(
      (item) => item.id === "evidence-readiness-origin",
    );
  originReadinessEvidence.sourceRef = "source-destination-lease";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unrelatedReadinessSubject,
    ).some((item) => item.code === "invalid_readiness_evidence"),
    true,
  );

  const wrongReadinessOwner = structuredClone(fixture);
  wrongReadinessOwner.readinessItems[0].ownerRef = "member-sam";
  assert.equal(isValid("moving-checklist-coordinator", wrongReadinessOwner), false);

  const ownerNotAssigned = structuredClone(fixture);
  ownerNotAssigned.workstreams[2].assignedMemberRefs = ["member-alex"];
  assert.equal(isValid("moving-checklist-coordinator", ownerNotAssigned), false);

  const unsupportedAssignment = structuredClone(fixture);
  unsupportedAssignment.sources.find(
    (source) => source.id === "source-assignment-packing",
  ).memberRefs = ["member-sam"];
  assert.equal(isValid("moving-checklist-coordinator", unsupportedAssignment), false);

  const ineligibleAssignment = structuredClone(fixture);
  ineligibleAssignment.workstreams[2].assignedMemberRefs.push("member-child");
  assert.equal(isValid("moving-checklist-coordinator", ineligibleAssignment), false);

  const pendingConsentAssignment = structuredClone(fixture);
  pendingConsentAssignment.members[1].consentState = "pending";
  assert.equal(
    isValid("moving-checklist-coordinator", pendingConsentAssignment),
    false,
  );

  const invalidPlanOwner = structuredClone(fixture);
  invalidPlanOwner.plan.ownerRef = "member-sam";
  assert.equal(isValid("moving-checklist-coordinator", invalidPlanOwner), false);

  const wrongHandoffOwner = structuredClone(fixture);
  wrongHandoffOwner.handoff.ownerRef = "member-sam";
  assert.equal(isValid("moving-checklist-coordinator", wrongHandoffOwner), false);

  const unsupportedComplete = structuredClone(fixture);
  unsupportedComplete.workstreams[1].state = "complete";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      unsupportedComplete,
    ).some((item) => item.code === "unsupported_complete_workstream"),
    true,
  );

  const completeWithoutMilestone = structuredClone(fixture);
  completeWithoutMilestone.workstreams[2].state = "complete";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      completeWithoutMilestone,
    ).some((item) => item.code === "unsupported_complete_workstream"),
    true,
  );

  const falseReadyHandoff = structuredClone(fixture);
  falseReadyHandoff.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("moving-checklist-coordinator", falseReadyHandoff), false);

  const resolved = resolvedMovingPlan(fixture);
  assert.equal(
    isValid("moving-checklist-coordinator", resolved),
    true,
    JSON.stringify({
      schemaErrors: cases.get("moving-checklist-coordinator").validate.errors,
      semanticFindings: validateArtifactSemantics(
        "moving-checklist-coordinator",
        resolved,
      ),
    }),
  );

  const readyWithPendingMoveDay = structuredClone(resolved);
  readyWithPendingMoveDay.milestones.find(
    (item) => item.id === "milestone-move-day",
  ).status = "pending";
  const readyWithPendingFindings = validateArtifactSemantics(
    "moving-checklist-coordinator",
    readyWithPendingMoveDay,
  );
  assert.equal(
    readyWithPendingFindings.some(
      (item) => item.code === "unsupported_complete_workstream",
    ),
    true,
  );
  assert.equal(
    readyWithPendingFindings.some((item) => item.code === "unsupported_ready_state"),
    true,
  );

  const readyWithoutMoveDayMilestone = structuredClone(resolved);
  readyWithoutMoveDayMilestone.milestones =
    readyWithoutMoveDayMilestone.milestones.filter(
      (item) => item.workstreamRef !== "workstream-move-day",
    );
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      readyWithoutMoveDayMilestone,
    ).some((item) => item.code === "missing_move_day_milestone"),
    true,
  );

  const readyWithoutMoveDayWorkstream = structuredClone(resolved);
  readyWithoutMoveDayWorkstream.workstreams =
    readyWithoutMoveDayWorkstream.workstreams.filter(
      (item) => item.id !== "workstream-move-day",
    );
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      readyWithoutMoveDayWorkstream,
    ).some((item) => item.code === "invalid_move_day_workstream_count"),
    true,
  );

  const blockedWithoutRefs = structuredClone(fixture);
  blockedWithoutRefs.handoff.blockingRefs = [];
  assert.equal(isValid("moving-checklist-coordinator", blockedWithoutRefs), false);
});

test("moving checklist keeps every external action with exact named-owner evidence", () => {
  const fixture = cases.get("moving-checklist-coordinator").fixture;

  const missingGateKind = structuredClone(fixture);
  missingGateKind.actionGates[0].action = "make-booking";
  assert.equal(isValid("moving-checklist-coordinator", missingGateKind), false);

  const notApplicableTravel = structuredClone(fixture);
  const travelWorkstream = notApplicableTravel.workstreams.find(
    (item) => item.id === "workstream-travel",
  );
  travelWorkstream.applicableActions = [];
  const travelGate = notApplicableTravel.actionGates.find(
    (item) => item.id === "gate-travel",
  );
  travelGate.state = "not-applicable";
  travelGate.applicability.state = "not-applicable";
  travelGate.applicability.rationale =
    "The owner supplied a driving plan that requires no travel booking.";
  notApplicableTravel.evidenceRecords.find(
    (item) => item.id === "evidence-gate-travel-applicability",
  ).assertedValue = "not-applicable";
  assert.equal(isValid("moving-checklist-coordinator", notApplicableTravel), true);

  const missingApplicabilityRationale = structuredClone(notApplicableTravel);
  missingApplicabilityRationale.actionGates.find(
    (item) => item.id === "gate-travel",
  ).applicability.rationale = "";
  assert.equal(
    isValid("moving-checklist-coordinator", missingApplicabilityRationale),
    false,
  );

  const whitespaceApplicabilityRationale = structuredClone(notApplicableTravel);
  whitespaceApplicabilityRationale.actionGates.find(
    (item) => item.id === "gate-travel",
  ).applicability.rationale = "   ";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      whitespaceApplicabilityRationale,
    ).some((item) => item.code === "unsupported_not_applicable_gate"),
    true,
  );

  const unrelatedApplicabilityEvidence = structuredClone(notApplicableTravel);
  unrelatedApplicabilityEvidence.actionGates.find(
    (item) => item.id === "gate-travel",
  ).applicability.evidenceRefs = ["source-consent-alex"];
  assert.equal(
    isValid("moving-checklist-coordinator", unrelatedApplicabilityEvidence),
    false,
  );

  const wrongKindApplicabilityEvidence = structuredClone(fixture);
  wrongKindApplicabilityEvidence.actionGates.find(
    (item) => item.id === "gate-utility",
  ).applicability.evidenceRefs = ["source-inventory"];
  const utilityApplicabilityRecord =
    wrongKindApplicabilityEvidence.evidenceRecords.find(
      (item) => item.id === "evidence-gate-utility-applicability",
    );
  utilityApplicabilityRecord.sourceRef = "source-inventory";
  utilityApplicabilityRecord.sourceKind = "inventory-record";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      wrongKindApplicabilityEvidence,
    ).some((item) => item.code === "invalid_gate_applicability_evidence"),
    true,
  );

  const scopedOwnerPlanEvidence = structuredClone(fixture);
  scopedOwnerPlanEvidence.sources.find(
    (item) => item.id === "source-owner-plan",
  ).subjectRef = "workstream-origin";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      scopedOwnerPlanEvidence,
    ).some(
      (item) =>
        item.code === "invalid_readiness_evidence" ||
        item.code === "invalid_gate_applicability_evidence",
    ),
    true,
  );

  const bypassedIntrinsicGate = structuredClone(fixture);
  const contractGate = bypassedIntrinsicGate.actionGates.find(
    (item) => item.id === "gate-contract",
  );
  contractGate.state = "not-applicable";
  contractGate.applicability.state = "not-applicable";
  bypassedIntrinsicGate.evidenceRecords.find(
    (item) => item.id === "evidence-gate-contract-applicability",
  ).assertedValue = "not-applicable";
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      bypassedIntrinsicGate,
    ).some((item) => item.code === "intrinsic_action_not_applicable"),
    true,
  );

  const omittedIntrinsicAction = structuredClone(fixture);
  omittedIntrinsicAction.workstreams.find(
    (item) => item.id === "workstream-moving-service",
  ).applicableActions = ["make-booking", "make-payment", "send-message"];
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      omittedIntrinsicAction,
    ).some((item) => item.code === "missing_intrinsic_action"),
    true,
  );

  const actionGateOnWrongApplicableWorkstream = structuredClone(fixture);
  actionGateOnWrongApplicableWorkstream.workstreams.push({
    id: "workstream-insurance",
    kind: "insurance",
    title: "Insurance transition",
    state: "blocked",
    locationRefs: ["location-destination"],
    ownerRef: "member-alex",
    assignedMemberRefs: ["member-alex"],
    applicableActions: ["change-insurance"],
    sourceRefs: ["source-owner-plan", "source-assignment-administration"],
  });
  assert.equal(
    validateArtifactSemantics(
      "moving-checklist-coordinator",
      actionGateOnWrongApplicableWorkstream,
    ).some((item) => item.code === "missing_applicable_action_gate"),
    true,
  );

  const missingBlockedAction = structuredClone(fixture);
  missingBlockedAction.blockedActions =
    missingBlockedAction.blockedActions.filter(
      (action) => action !== "change-insurance",
    );
  assert.equal(isValid("moving-checklist-coordinator", missingBlockedAction), false);

  const wrongGateOwner = structuredClone(fixture);
  wrongGateOwner.actionGates[0].ownerRef = "member-sam";
  assert.equal(isValid("moving-checklist-coordinator", wrongGateOwner), false);

  const wrongGateWorkstream = structuredClone(fixture);
  wrongGateWorkstream.actionGates[0].workstreamRef = "workstream-utilities";
  assert.equal(isValid("moving-checklist-coordinator", wrongGateWorkstream), false);

  const ownerMissingFromConsent = structuredClone(fixture);
  ownerMissingFromConsent.actionGates[0].requiredMemberRefs = [];
  assert.equal(
    isValid("moving-checklist-coordinator", ownerMissingFromConsent),
    false,
  );

  const missingExactConsent = structuredClone(fixture);
  missingExactConsent.actionGates[10].consentSourceRefs = [
    "source-consent-alex",
  ];
  assert.equal(isValid("moving-checklist-coordinator", missingExactConsent), false);

  const completedWithoutRecord = structuredClone(fixture);
  completedWithoutRecord.actionGates[0].state = "completed-by-owner";
  assert.equal(isValid("moving-checklist-coordinator", completedWithoutRecord), false);

  const wrongActionRecord = structuredClone(fixture);
  wrongActionRecord.sources.find(
    (source) => source.id === "source-mail-confirmation",
  ).action = "change-account";
  assert.equal(isValid("moving-checklist-coordinator", wrongActionRecord), false);

  const wrongWorkstreamRecord = structuredClone(fixture);
  wrongWorkstreamRecord.sources.find(
    (source) => source.id === "source-mail-confirmation",
  ).workstreamRef = "workstream-utilities";
  assert.equal(isValid("moving-checklist-coordinator", wrongWorkstreamRecord), false);

  const wrongOwnerRecord = structuredClone(fixture);
  wrongOwnerRecord.sources.find(
    (source) => source.id === "source-mail-confirmation",
  ).ownerRef = "member-sam";
  assert.equal(isValid("moving-checklist-coordinator", wrongOwnerRecord), false);

  const staleOwnerRecord = structuredClone(fixture);
  staleOwnerRecord.sources.find(
    (source) => source.id === "source-mail-confirmation",
  ).freshness = "stale";
  assert.equal(isValid("moving-checklist-coordinator", staleOwnerRecord), false);

  const nonblockingReference = structuredClone(fixture);
  nonblockingReference.handoff.blockingRefs[0] = "workstream-origin";
  assert.equal(isValid("moving-checklist-coordinator", nonblockingReference), false);

  const externalInstruction = structuredClone(fixture);
  externalInstruction.reviewQuestions[0].question =
    "Book the movers now on our behalf.";
  assert.equal(isValid("moving-checklist-coordinator", externalInstruction), false);
});

test("gift relationship manager preserves privacy, budget, and owner authority", () => {
  const staleSource = structuredClone(cases.get("gift-relationship-manager").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("gift-relationship-manager", staleSource), false);

  const overBudget = structuredClone(cases.get("gift-relationship-manager").fixture);
  overBudget.giftIdeas[0].estimatedCost = 90;
  assert.equal(isValid("gift-relationship-manager", overBudget), false);

  const lateShipping = structuredClone(cases.get("gift-relationship-manager").fixture);
  lateShipping.giftIdeas[0].shippingState = "risk";
  assert.equal(isValid("gift-relationship-manager", lateShipping), false);

  const actionAdvice = structuredClone(cases.get("gift-relationship-manager").fixture);
  actionAdvice.shortlist[0].fitReason += " Buy it now and send a message.";
  assert.equal(isValid("gift-relationship-manager", actionAdvice), false);

  const mismatch = structuredClone(cases.get("gift-relationship-manager").fixture);
  mismatch.giftIdeas[0].recipientRef = "recipient-team";
  assert.equal(isValid("gift-relationship-manager", mismatch), false);
});

test("personal archive curator preserves privacy, retention, and owner authority", () => {
  const staleSource = structuredClone(cases.get("personal-archive-curator").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("personal-archive-curator", staleSource), false);

  const privatePath = structuredClone(cases.get("personal-archive-curator").fixture);
  privatePath.items[2].pathDisclosure = "owner-visible-path";
  assert.equal(isValid("personal-archive-curator", privatePath), false);

  const deleteDuplicate = structuredClone(cases.get("personal-archive-curator").fixture);
  deleteDuplicate.duplicates[0].action = "blocked-delete";
  assert.equal(isValid("personal-archive-curator", deleteDuplicate), false);

  const actionAdvice = structuredClone(cases.get("personal-archive-curator").fixture);
  actionAdvice.reviewQuestions[0].reason += " Delete the duplicate and upload the family photos.";
  assert.equal(isValid("personal-archive-curator", actionAdvice), false);

  const danglingCue = structuredClone(cases.get("personal-archive-curator").fixture);
  danglingCue.retrievalCues[0].itemRefs = ["missing-item"];
  assert.equal(isValid("personal-archive-curator", danglingCue), false);
});

test("knowledge curator emits every collection-index finding code", async () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const expectFinding = (code, mutate) => {
    const candidate = structuredClone(fixture);
    mutate(candidate);
    const findings = validateArtifactSemantics("knowledge-curator", candidate);
    assert.ok(
      findings.some((item) => item.code === code),
      `${code}: ${JSON.stringify(findings)}`,
    );
  };
  const mutations = new Map([
    [
      "duplicate_reference",
      (value) => value.handoff.sourceRefs.push(value.handoff.sourceRefs[0]),
    ],
    [
      "dangling_reference",
      (value) => {
        value.reviewQuestions[0].targetRefs[0] = "missing-object";
      },
    ],
    [
      "duplicate_object_id",
      (value) => {
        value.evidence[0].id = value.sources[0].id;
      },
    ],
    [
      "invalid_collection_chronology",
      (value) => {
        value.collection.reviewHorizon.endsAt =
          value.collection.reviewHorizon.startsAt;
      },
    ],
    [
      "invalid_navigation_graph",
      (value) => {
        value.navigationNodes[0].childNodeRefs = [];
      },
    ],
    [
      "invalid_source_chronology",
      (value) => {
        value.sources[0].retrievedAt = "2026-08-31T21:00:00Z";
      },
    ],
    [
      "invalid_source_authorization",
      (value) => {
        value.sources[0].authorization.status = "expired";
      },
    ],
    [
      "invalid_source_binding",
      (value) => {
        value.sources[1].binding.value = "not-an-integrity";
      },
    ],
    [
      "overstated_source_state",
      (value) => {
        value.sources.find(
          (item) => item.id === "source-validation-build-8702",
        ).freshnessState = "current";
      },
    ],
    [
      "unsafe_source_representation",
      (value) => {
        value.sources[0].representationPolicy.permission.grantedAt =
          "2026-09-01T00:00:00Z";
      },
    ],
    [
      "invalid_evidence_binding",
      (value) => {
        value.evidence[0].sourceBinding = "atlas-launch-brief-v3";
      },
    ],
    [
      "invalid_owner_attribution",
      (value) => {
        value.evidence[0].ownerAttribution.owner = {
          id: "principal-unrelated-review-team",
          name: "Unrelated Review Team",
          type: "team",
        };
      },
    ],
    [
      "irrelevant_evidence",
      (value) => {
        value.evidence[0].topicRefs = ["topic-operations"];
      },
    ],
    [
      "restricted_content_copy",
      (value) => {
        const evidence = value.evidence.find(
          (item) => item.id === "evidence-security-appendix-metadata",
        );
        evidence.representedAs = "permitted-excerpt";
        evidence.excerpt = "Restricted appendix content copied without permission.";
      },
    ],
    [
      "overstated_claim_status",
      (value) => {
        value.claims.find(
          (item) => item.id === "claim-security-readiness",
        ).status = "current";
      },
    ],
    [
      "invalid_claim_authority",
      (value) => {
        value.claims.find(
          (item) => item.id === "claim-dual-write-interval",
        ).authorityStatus = "authoritative";
      },
    ],
    [
      "invalid_claim_chronology",
      (value) => {
        value.claims[0].recordedAt = "2026-09-01T00:00:00Z";
      },
    ],
    [
      "invalid_decision_provenance",
      (value) => {
        value.decisions[0].evidenceRefs = ["evidence-dual-write-note"];
      },
    ],
    [
      "invalid_decision_chronology",
      (value) => {
        value.decisions[0].effectiveAt = "2026-10-01T20:30:00Z";
      },
    ],
    [
      "invalid_duplicate_group",
      (value) => {
        value.sources.find(
          (item) => item.id === "source-rollback-runbook-v3-export",
        ).binding.value = `sha256:${"0".repeat(64)}`;
      },
    ],
    [
      "broken_dispute_link",
      (value) => {
        value.claims.find(
          (item) => item.id === "claim-dual-write-interval",
        ).disputeRefs = [];
      },
    ],
    [
      "dishonest_dispute_resolution",
      (value) => {
        value.disputes[0].status = "human-resolved";
        value.disputes[0].resolution = {
          decisionRef: "decision-atlas-go-live-gate",
          resolvedBy: {
            id: "principal-launch-steering-group",
            name: "Atlas Launch Steering Group",
            type: "team",
          },
          resolvedAt: "2026-08-31T20:00:00Z",
          selectedClaimRef: "claim-single-write-path",
          rationale: "The unrelated go-live gate cannot resolve this conflict.",
        };
      },
    ],
    [
      "invalid_gap_resolution",
      (value) => {
        value.gaps[0].status = "human-resolved";
      },
    ],
    [
      "incomplete_findings",
      (value) => {
        value.freshnessFindings = value.freshnessFindings.filter(
          (item) => item.id !== "freshness-old-validation",
        );
      },
    ],
    [
      "classification_audience_mismatch",
      (value) => {
        value.navigationNodes.find(
          (item) => item.id === "nav-atlas-launch",
        ).classification = "internal";
      },
    ],
    [
      "retention_inheritance_mismatch",
      (value) => {
        value.handoff.retention.policyRefs =
          value.handoff.retention.policyRefs.filter(
            (item) => item !== "policy-atlas-security-records",
          );
      },
    ],
    [
      "incomplete_handoff",
      (value) => {
        value.handoff.claimRefs.pop();
      },
    ],
    [
      "incomplete_blocked_handoff",
      (value) => {
        value.handoff.blockerRefs =
          value.handoff.blockerRefs.filter(
            (item) => item !== "claim-security-readiness",
          );
      },
    ],
    [
      "premature_review_state",
      (value) => {
        value.collection.status = "ready-for-review";
        value.handoff.state = "ready-for-review";
      },
    ],
    [
      "inconsistent_handoff",
      (value) => {
        value.handoff.owner.name = "Different maintenance team";
      },
    ],
    [
      "unsafe_output_state",
      (value) => {
        value.handoff.output.path = "../published-index.json";
      },
    ],
    [
      "unsupported_external_integration",
      (value) => {
        value.handoff.output.externalIntegrationConsent = "operator-granted";
      },
    ],
    [
      "agent_owned_authority",
      (value) => {
        value.decisions[0].decisionOwner = {
          id: "principal-knowledge-curator",
          name: "Knowledge Curator",
          type: "team",
        };
      },
    ],
    [
      "missing_authority_gate",
      (value) => {
        value.prohibitedActions = value.prohibitedActions.filter(
          (item) => item !== "publish",
        );
      },
    ],
    [
      "unauthorized_narrative_action",
      (value) => {
        value.handoff.summary =
          "The Knowledge Curator published the collection and updated the source wiki.";
      },
    ],
  ]);
  for (const [code, mutate] of mutations) expectFinding(code, mutate);

  const semanticsSource = await readFile(
    new URL("./artifact-semantics.mjs", import.meta.url),
    "utf8",
  );
  const validatorSource = semanticsSource.slice(
    semanticsSource.indexOf("function knowledgeCollectionIndexFindings"),
    semanticsSource.indexOf("function fundraisingCampaignFindings"),
  );
  const directFindingCodes = [
    ...validatorSource.matchAll(/finding\(\s*"([^"]+)"/gu),
  ].map((match) => match[1]);
  for (const code of new Set(directFindingCodes)) {
    assert.ok(mutations.has(code), `missing direct finding-code regression: ${code}`);
  }
});

test("knowledge curator blocks provenance, conflict, and confidentiality bypasses", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const findingCodes = (candidate) =>
    new Set(
      validateArtifactSemantics("knowledge-curator", candidate).map(
        (item) => item.code,
      ),
    );

  const laundered = structuredClone(fixture);
  laundered.navigationNodes.find(
    (item) => item.id === "nav-atlas-launch",
  ).classification = "internal";
  assert.ok(
    findingCodes(laundered).has("classification_audience_mismatch"),
  );

  const silentlyResolved = structuredClone(fixture);
  silentlyResolved.disputes[0].status = "human-resolved";
  silentlyResolved.disputes[0].resolution = {
    decisionRef: "decision-atlas-go-live-gate",
    resolvedBy: {
      id: "principal-launch-steering-group",
      name: "Atlas Launch Steering Group",
      type: "team",
    },
    resolvedAt: "2026-08-31T20:00:00Z",
    selectedClaimRef: "claim-single-write-path",
    rationale: "An unrelated decision cannot erase the conflicting source.",
  };
  assert.ok(
    findingCodes(silentlyResolved).has("dishonest_dispute_resolution"),
  );

  const falseCanonical = structuredClone(fixture);
  falseCanonical.sources.find(
    (item) => item.id === "source-rollback-runbook-v3-export",
  ).binding.value = `sha256:${"f".repeat(64)}`;
  assert.ok(findingCodes(falseCanonical).has("invalid_duplicate_group"));

  const staleAsCurrent = structuredClone(fixture);
  staleAsCurrent.sources.find(
    (item) => item.id === "source-validation-build-8702",
  ).freshnessState = "current";
  staleAsCurrent.claims.find(
    (item) => item.id === "claim-old-validation-build",
  ).status = "current";
  assert.ok(findingCodes(staleAsCurrent).has("overstated_source_state"));
  assert.ok(findingCodes(staleAsCurrent).has("overstated_claim_status"));

  const restrictedCopy = structuredClone(fixture);
  const restrictedEvidence = restrictedCopy.evidence.find(
    (item) => item.id === "evidence-security-appendix-metadata",
  );
  restrictedEvidence.representedAs = "permitted-excerpt";
  restrictedEvidence.excerpt = "Unapproved restricted content.";
  assert.ok(findingCodes(restrictedCopy).has("restricted_content_copy"));
});

test("knowledge curator keeps decisions, handoff, and narrative action human-owned", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const findingCodes = (candidate) =>
    new Set(
      validateArtifactSemantics("knowledge-curator", candidate).map(
        (item) => item.code,
      ),
    );

  const agentDecision = structuredClone(fixture);
  agentDecision.decisions[0].decisionOwner = {
    id: "principal-knowledge-curator",
    name: "Knowledge Curator",
    type: "team",
  };
  assert.ok(findingCodes(agentDecision).has("agent_owned_authority"));

  const incomplete = structuredClone(fixture);
  incomplete.handoff.disputeRefs = [];
  assert.ok(findingCodes(incomplete).has("incomplete_handoff"));

  const autonomousNarrative = structuredClone(fixture);
  autonomousNarrative.handoff.summary =
    "I published the handoff, approved the decision, and updated the source.";
  assert.ok(
    findingCodes(autonomousNarrative).has("unauthorized_narrative_action"),
  );
});

function knowledgeFindingCodes(candidate) {
  return new Set(
   validateArtifactSemantics("knowledge-curator", candidate).map(
     (item) => item.code,
   ),
  );
}

function resolvedKnowledgeDispute(fixture) {
  const value = structuredClone(fixture);
  const dispute = value.disputes[0];
  const decision = value.decisions.find(
   (item) => item.id === "decision-single-write-path",
  );
  decision.status = "current";
  decision.claimRefs = [...dispute.claimRefs];
  dispute.status = "human-resolved";
  dispute.resolution = {
   decisionRef: decision.id,
   resolvedBy: structuredClone(decision.decisionOwner),
   resolvedAt: "2026-08-31T20:00:00Z",
   selectedClaimRef: "claim-single-write-path",
   rationale: "The linked decision selects the authoritative ADR claim after reviewing both recorded sides.",
  };
  value.handoff.blockerRefs = value.handoff.blockerRefs.filter(
   (ref) => ref !== dispute.id,
  );
  return value;
}

function resolvedKnowledgeGap(fixture) {
  const value = structuredClone(fixture);
  const source = value.sources.find(
   (item) => item.id === "source-security-readiness-appendix",
  );
  source.retrievedAt = source.retrievalAttemptedAt;
  source.freshnessState = "current";
  source.representationPolicy = {
   mode: "permitted-excerpt",
   maxExcerptCharacters: 220,
   permission: {
     status: "current",
     grantedBy: structuredClone(source.authorization.authorizedBy),
     grantedAt: "2026-08-31T19:20:00Z",
     expiresAt: null,
     audienceScope: ["product-launch-core"],
     purpose: "Private security gap-resolution evidence.",
   },
  };
  const evidenceTemplate = value.evidence.find(
   (item) => item.id === "evidence-security-appendix-metadata",
  );
  const decisionEvidence = {
   ...structuredClone(evidenceTemplate),
   id: "evidence-security-resolution-decision",
   representedAs: "permitted-excerpt",
   excerpt: "Product Security recorded that the authorized readiness evidence closes the indexed access gap.",
   ownerAttribution: {
     role: "decision-owner",
     owner: structuredClone(source.authorization.authorizedBy),
     effectiveAt: "2026-08-31T19:30:00Z",
   },
  };
  const resolutionEvidence = {
   ...structuredClone(decisionEvidence),
   id: "evidence-security-gap-resolution",
   ownerAttribution: {
     role: "gap-resolution-owner",
     owner: structuredClone(source.authorization.authorizedBy),
     effectiveAt: "2026-08-31T19:30:00Z",
   },
  };
  value.evidence.push(decisionEvidence, resolutionEvidence);
  value.handoff.evidenceRefs.push(decisionEvidence.id, resolutionEvidence.id);
  const decision = {
   id: "decision-security-gap-resolution",
   statement: "Product Security recorded that the authorized readiness evidence resolves the collection gap.",
   decidedAt: "2026-08-31T19:30:00Z",
   effectiveAt: "2026-08-31T19:30:00Z",
   expiresAt: null,
   decisionOwner: structuredClone(source.authorization.authorizedBy),
   authorityStatus: "authoritative",
   status: "current",
   topicRefs: ["topic-security-readiness"],
   claimRefs: ["claim-security-readiness"],
   evidenceRefs: [decisionEvidence.id, resolutionEvidence.id],
   contextEvidenceRefs: [],
   disputeRefs: [],
   classification: "restricted",
   audienceScope: ["product-launch-core"],
   retention: structuredClone(evidenceTemplate.retention),
  };
  value.decisions.push(decision);
  value.handoff.decisionRefs.push(decision.id);
  const gap = value.gaps[0];
  gap.status = "human-resolved";
  gap.resolution = {
   decisionRef: decision.id,
   evidenceRefs: [resolutionEvidence.id],
   resolvedBy: structuredClone(decision.decisionOwner),
   resolvedAt: "2026-08-31T19:32:00Z",
   rationale: "Product Security supplied current authorized evidence and recorded the resolution.",
  };
  value.handoff.blockerRefs = value.handoff.blockerRefs.filter(
   (ref) => ref !== gap.id,
  );
  return value;
}

test("knowledge curator enforces source and excerpt authorization chronology", () => {
  const fixture = cases.get("knowledge-curator").fixture;

  const lateAuthorization = structuredClone(fixture);
  lateAuthorization.sources[0].authorization.authorizedAt =
   "2026-08-31T19:01:00Z";
  assert.ok(
   knowledgeFindingCodes(lateAuthorization).has("invalid_source_chronology"),
  );

  const expiredAtObservation = structuredClone(fixture);
  expiredAtObservation.sources[0].authorization.expiresAt =
   "2026-08-31T18:59:00Z";
  assert.ok(
   knowledgeFindingCodes(expiredAtObservation).has(
     "invalid_source_authorization",
   ),
  );

  const permissionAfterCapture = structuredClone(fixture);
  permissionAfterCapture.sources[0].representationPolicy.permission.grantedAt =
   "2026-08-31T19:26:00Z";
  assert.ok(
   knowledgeFindingCodes(permissionAfterCapture).has(
     "restricted_content_copy",
   ),
  );

  const permissionExpiredAtCapture = structuredClone(fixture);
  permissionExpiredAtCapture.sources[0].representationPolicy.permission.expiresAt =
   "2026-08-31T19:24:00Z";
  const expiredCodes = knowledgeFindingCodes(permissionExpiredAtCapture);
  assert.ok(expiredCodes.has("unsafe_source_representation"));
  assert.ok(expiredCodes.has("restricted_content_copy"));
});

test("knowledge curator enforces immutable identity and complete exact-duplicate groups", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const canonicalId = "source-rollback-runbook-v3";
  const exportId = "source-rollback-runbook-v3-export";

  const validReuse = structuredClone(fixture);
  validReuse.sources.find((item) => item.id === exportId).immutableRef =
   validReuse.sources.find((item) => item.id === canonicalId).immutableRef;
  assert.deepEqual(
   validateArtifactSemantics("knowledge-curator", validReuse),
   [],
  );

  const collision = structuredClone(validReuse);
  collision.sources.find((item) => item.id === exportId).binding.value =
   `sha256:${"a".repeat(64)}`;
  assert.ok(knowledgeFindingCodes(collision).has("invalid_source_binding"));

  const omittedExactGroup = structuredClone(fixture);
  omittedExactGroup.duplicateGroups = [];
  omittedExactGroup.handoff.duplicateGroupRefs = [];
  assert.ok(
   knowledgeFindingCodes(omittedExactGroup).has("invalid_duplicate_group"),
  );

  const versionOnly = structuredClone(fixture);
  for (const id of [canonicalId, exportId]) {
   const source = versionOnly.sources.find((item) => item.id === id);
   source.binding = { kind: "version", value: "atlas-runbook-v3" };
  }
  versionOnly.evidence.find(
   (item) => item.id === "evidence-rollback-sequence",
  ).sourceBinding = "atlas-runbook-v3";
  assert.ok(knowledgeFindingCodes(versionOnly).has("invalid_duplicate_group"));
});

test("knowledge curator binds canonical confirmation to authorized review evidence", () => {
  const fixture = cases.get("knowledge-curator").fixture;

  const unrelatedOwner = structuredClone(fixture);
  unrelatedOwner.duplicateGroups[0].confirmation.owner = {
   id: "principal-unrelated-review-team",
   name: "Unrelated Review Team",
   type: "team",
  };
  assert.ok(
   knowledgeFindingCodes(unrelatedOwner).has("invalid_duplicate_group"),
  );

  const confirmationBeforeEvidence = structuredClone(fixture);
  confirmationBeforeEvidence.duplicateGroups[0].confirmation.confirmedAt =
   "2026-08-31T19:28:59Z";
  assert.ok(
   knowledgeFindingCodes(confirmationBeforeEvidence).has(
     "invalid_duplicate_group",
   ),
  );

  const unauthorizedReviewRecord = structuredClone(fixture);
  unauthorizedReviewRecord.sources.find(
   (item) => item.id === "source-duplicate-review-record",
  ).authorization.authorizedBy = {
   id: "principal-unrelated-review-team",
   name: "Unrelated Review Team",
   type: "team",
  };
  const reviewCodes = knowledgeFindingCodes(unauthorizedReviewRecord);
  assert.ok(reviewCodes.has("invalid_owner_attribution"));
  assert.ok(reviewCodes.has("invalid_duplicate_group"));
});

test("knowledge curator requires every current support ref and coherent effective periods", () => {
  const fixture = cases.get("knowledge-curator").fixture;

  const staleBesideCurrentClaim = structuredClone(fixture);
  staleBesideCurrentClaim.claims.find(
   (item) => item.id === "claim-validation-build-8841",
  ).evidenceRefs.push("evidence-old-validation-metadata");
  assert.ok(
   knowledgeFindingCodes(staleBesideCurrentClaim).has(
     "overstated_claim_status",
   ),
  );

  const supersededCurrentClaim = structuredClone(fixture);
  const currentClaim = supersededCurrentClaim.claims.find(
   (item) => item.id === "claim-validation-build-8841",
  );
  const currentEvidence = supersededCurrentClaim.evidence.find(
   (item) => item.id === currentClaim.evidenceRefs[0],
  );
  supersededCurrentClaim.sources.find(
   (item) => item.id === currentEvidence.sourceRef,
  ).authorityStatus = "superseded";
  assert.ok(
   knowledgeFindingCodes(supersededCurrentClaim).has(
     "overstated_claim_status",
   ),
  );

  const metadataBesideDecision = structuredClone(fixture);
  metadataBesideDecision.decisions[0].evidenceRefs.push(
   "evidence-security-appendix-metadata",
  );
  assert.ok(
   knowledgeFindingCodes(metadataBesideDecision).has(
     "invalid_decision_provenance",
   ),
  );

  const contextualHistory = structuredClone(fixture);
  contextualHistory.claims.find(
   (item) => item.id === "claim-validation-build-8841",
  ).contextEvidenceRefs.push("evidence-old-validation-metadata");
  assert.deepEqual(
   validateArtifactSemantics("knowledge-curator", contextualHistory),
   [],
  );

  const futureCurrentClaim = structuredClone(fixture);
  futureCurrentClaim.claims[0].effectiveAt = "2026-09-01T00:00:00Z";
  assert.ok(
   knowledgeFindingCodes(futureCurrentClaim).has("overstated_claim_status"),
  );

  const expiredCurrentClaim = structuredClone(fixture);
  expiredCurrentClaim.claims[0].expiresAt = "2026-08-31T20:00:00Z";
  assert.ok(
   knowledgeFindingCodes(expiredCurrentClaim).has("overstated_claim_status"),
  );

  const reversedClaimRange = structuredClone(fixture);
  reversedClaimRange.claims[0].expiresAt = "2026-08-29T00:00:00Z";
  assert.ok(
   knowledgeFindingCodes(reversedClaimRange).has("invalid_claim_chronology"),
  );

  const futureCurrentDecision = structuredClone(fixture);
  futureCurrentDecision.decisions[0].status = "current";
  futureCurrentDecision.decisions[0].effectiveAt = "2026-09-01T00:00:00Z";
  assert.ok(
   knowledgeFindingCodes(futureCurrentDecision).has(
     "invalid_decision_chronology",
   ),
  );

  const expiredCurrentDecision = structuredClone(fixture);
  expiredCurrentDecision.decisions[0].status = "current";
  expiredCurrentDecision.decisions[0].expiresAt = "2026-08-30T00:00:00Z";
  assert.ok(
   knowledgeFindingCodes(expiredCurrentDecision).has(
     "invalid_decision_chronology",
   ),
  );
});

test("knowledge curator uses structured decision-owner provenance, not prose inference", () => {
  const fixture = cases.get("knowledge-curator").fixture;

  const unrelatedOwner = structuredClone(fixture);
  unrelatedOwner.decisions[0].decisionOwner = {
   id: "principal-unrelated-review-team",
   name: "Unrelated Review Team",
   type: "team",
  };
  assert.ok(
   knowledgeFindingCodes(unrelatedOwner).has("invalid_decision_provenance"),
  );

  const proseOnly = structuredClone(fixture);
  proseOnly.decisions[0].statement =
   "An unrelated team is named in this prose, while the structured authoritative owner remains unchanged.";
  assert.deepEqual(
   validateArtifactSemantics("knowledge-curator", proseOnly),
   [],
  );
});

test("knowledge curator requires complete dated dispute and gap resolution provenance", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const resolvedDispute = resolvedKnowledgeDispute(fixture);
  assert.equal(
   knowledgeFindingCodes(resolvedDispute).has(
     "dishonest_dispute_resolution",
   ),
   false,
  );

  const unselectedSide = structuredClone(resolvedDispute);
  unselectedSide.disputes[0].resolution.selectedClaimRef =
   "claim-launch-scope";
  assert.ok(
   knowledgeFindingCodes(unselectedSide).has(
     "dishonest_dispute_resolution",
   ),
  );

  const missingDisputeClaim = structuredClone(resolvedDispute);
  missingDisputeClaim.decisions[0].claimRefs = ["claim-single-write-path"];
  assert.ok(
   knowledgeFindingCodes(missingDisputeClaim).has(
     "dishonest_dispute_resolution",
   ),
  );

  const prematureResolution = structuredClone(resolvedDispute);
  prematureResolution.disputes[0].resolution.resolvedAt =
   "2026-08-31T19:00:00Z";
  assert.ok(
   knowledgeFindingCodes(prematureResolution).has(
     "dishonest_dispute_resolution",
   ),
  );

  const resolvedGap = resolvedKnowledgeGap(fixture);
  assert.equal(
   knowledgeFindingCodes(resolvedGap).has("invalid_gap_resolution"),
   false,
  );

  const unresolvedWithoutProof = structuredClone(fixture);
  unresolvedWithoutProof.gaps[0].status = "human-resolved";
  assert.ok(
   knowledgeFindingCodes(unresolvedWithoutProof).has(
     "invalid_gap_resolution",
   ),
  );

  const unrelatedResolver = structuredClone(resolvedGap);
  unrelatedResolver.gaps[0].resolution.resolvedBy = {
   id: "principal-unrelated-review-team",
   name: "Unrelated Review Team",
   type: "team",
  };
  assert.ok(
   knowledgeFindingCodes(unrelatedResolver).has("invalid_gap_resolution"),
  );

  const earlyGapResolution = structuredClone(resolvedGap);
  earlyGapResolution.gaps[0].resolution.resolvedAt =
   "2026-08-31T19:29:00Z";
  assert.ok(
   knowledgeFindingCodes(earlyGapResolution).has("invalid_gap_resolution"),
  );
});

test("knowledge curator enforces navigation reciprocity and blocker equality in every state", () => {
  const fixture = cases.get("knowledge-curator").fixture;

  const oneWayParent = structuredClone(fixture);
  oneWayParent.navigationNodes[0].childNodeRefs = [];
  assert.ok(
   knowledgeFindingCodes(oneWayParent).has("invalid_navigation_graph"),
  );

  const secondRoot = structuredClone(fixture);
  secondRoot.navigationNodes[1].kind = "root";
  secondRoot.navigationNodes[1].parentNodeRef = null;
  secondRoot.navigationNodes[0].childNodeRefs =
   secondRoot.navigationNodes[0].childNodeRefs.filter(
     (ref) => ref !== secondRoot.navigationNodes[1].id,
   );
  assert.ok(knowledgeFindingCodes(secondRoot).has("invalid_navigation_graph"));

  const readyMissingBlockers = structuredClone(fixture);
  readyMissingBlockers.collection.status = "ready-for-review";
  readyMissingBlockers.handoff.state = "ready-for-review";
  readyMissingBlockers.handoff.blockerRefs = [];
  const missingCodes = knowledgeFindingCodes(readyMissingBlockers);
  assert.ok(missingCodes.has("incomplete_blocked_handoff"));
  assert.ok(missingCodes.has("premature_review_state"));

  const readyExtraBlocker = structuredClone(fixture);
  readyExtraBlocker.collection.status = "ready-for-review";
  readyExtraBlocker.handoff.state = "ready-for-review";
  readyExtraBlocker.handoff.blockerRefs.push("claim-launch-scope");
  assert.ok(
   knowledgeFindingCodes(readyExtraBlocker).has(
     "incomplete_blocked_handoff",
   ),
  );
});

test("knowledge curator requires globally unique retrieval job ids", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const duplicateJob = structuredClone(fixture);
  duplicateJob.collection.retrievalJobs.push({
    ...structuredClone(duplicateJob.collection.retrievalJobs[1]),
    id: duplicateJob.collection.retrievalJobs[0].id,
  });
  assert.equal(isValid("knowledge-curator", duplicateJob), false);

  const collidingJob = structuredClone(fixture);
  collidingJob.collection.retrievalJobs[0].id = collidingJob.sources[0].id;
  assert.equal(isValid("knowledge-curator", collidingJob), false);
});

test("knowledge curator represents unknown retention without fabricated dates", () => {
  const item = cases.get("knowledge-curator");
  const fixture = item.fixture;
  const unknownSource = fixture.sources.find(
   (source) => source.id === "source-security-readiness-appendix",
  );
  assert.equal(item.validate(fixture), true, JSON.stringify(item.validate.errors));
  assert.equal(unknownSource.retention.state, "unknown");
  assert.equal(unknownSource.retention.retainUntil, null);
  assert.ok(
   fixture.retentionFindings.some(
     (finding) =>
       finding.state === "unknown" &&
       finding.targetRefs.includes(unknownSource.id),
   ),
  );
  assert.ok(fixture.handoff.blockerRefs.includes("retention-security-unknown"));

  const fabricatedDate = structuredClone(fixture);
  fabricatedDate.sources.find(
   (source) => source.id === unknownSource.id,
  ).retention.retainUntil = "2032-12-31T23:59:59Z";
  assert.equal(item.validate(fabricatedDate), false);

  const omittedFinding = structuredClone(fixture);
  omittedFinding.retentionFindings = omittedFinding.retentionFindings.filter(
   (finding) => finding.id !== "retention-security-unknown",
  );
  omittedFinding.handoff.retentionFindingRefs =
   omittedFinding.handoff.retentionFindingRefs.filter(
     (ref) => ref !== "retention-security-unknown",
   );
  assert.ok(knowledgeFindingCodes(omittedFinding).has("incomplete_findings"));
});

test("knowledge curator rejects passive source mutations but permits owner proposals", () => {
  const fixture = cases.get("knowledge-curator").fixture;
  const prohibited = [
   "The collection was published and the source system was updated.",
   "The wiki was deleted and the repository was mutated.",
   "Access was changed and the retention policy was removed.",
  ];
  for (const summary of prohibited) {
   const candidate = structuredClone(fixture);
   candidate.handoff.summary = summary;
   assert.ok(
     knowledgeFindingCodes(candidate).has("unauthorized_narrative_action"),
     summary,
   );
  }

  const proposed = structuredClone(fixture);
  proposed.handoff.summary =
   "Product Security proposes a future source update after explicit owner approval.";
  assert.equal(
   knowledgeFindingCodes(proposed).has("unauthorized_narrative_action"),
   false,
  );

  const verbatimRequest = structuredClone(fixture);
  verbatimRequest.collection.request =
   "Our wiki was updated last week; curate the supplied export into the handoff index.";
  assert.equal(
   knowledgeFindingCodes(verbatimRequest).has("unauthorized_narrative_action"),
   false,
  );

  assert.equal(
   knowledgeFindingCodes(fixture).has("unauthorized_narrative_action"),
   false,
  );
});

test("health records binder preserves source freshness, privacy, and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("health-records-binder").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("health-records-binder", readyWithStaleSource), false);

  const staleMedication = structuredClone(cases.get("health-records-binder").fixture);
  staleMedication.medicationReview[0].sourceRefs = ["source-imaging-old"];
  assert.equal(isValid("health-records-binder", staleMedication), false);

  const unsafePacket = structuredClone(cases.get("health-records-binder").fixture);
  unsafePacket.sharingPackets[0].privacyState = "owner-approved";
  unsafePacket.sharingPackets[0].reviewState = "ready-for-owner-review";
  assert.equal(isValid("health-records-binder", unsafePacket), false);

  const actionAdvice = structuredClone(cases.get("health-records-binder").fixture);
  actionAdvice.reviewQuestions[0].reason += " Interpret test results and message the provider.";
  assert.equal(isValid("health-records-binder", actionAdvice), false);

  const danglingRecord = structuredClone(cases.get("health-records-binder").fixture);
  danglingRecord.timeline[0].recordRefs = ["record-missing"];
  assert.equal(isValid("health-records-binder", danglingRecord), false);

  const agentOwned = structuredClone(cases.get("health-records-binder").fixture);
  agentOwned.handoff.owner = "health-records-binder";
  assert.equal(isValid("health-records-binder", agentOwned), false);
});

test("benefits open enrollment planner preserves deadlines, evidence, and owner authority", () => {
  const invalidWindow = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  invalidWindow.windows[0].closesAt = invalidWindow.windows[0].opensAt;
  assert.equal(isValid("benefits-open-enrollment-planner", invalidWindow), false);

  const staleAvailableOption = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  staleAvailableOption.options[0].status = "available";
  assert.equal(isValid("benefits-open-enrollment-planner", staleAvailableOption), false);

  const readyWithStaleSource = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("benefits-open-enrollment-planner", readyWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  actionAdvice.reviewQuestions[0].reason += " Choose the plan and submit elections.";
  assert.equal(isValid("benefits-open-enrollment-planner", actionAdvice), false);

  const danglingCost = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  danglingCost.options[0].costRefs = ["cost-missing"];
  assert.equal(isValid("benefits-open-enrollment-planner", danglingCost), false);

  const agentOwned = structuredClone(cases.get("benefits-open-enrollment-planner").fixture);
  agentOwned.handoff.owner = "benefits-open-enrollment-planner";
  assert.equal(isValid("benefits-open-enrollment-planner", agentOwned), false);
});

test("warranty returns manager preserves windows, evidence, and owner authority", () => {
  const invalidWindow = structuredClone(cases.get("warranty-returns-manager").fixture);
  invalidWindow.returnWindows[0].closesAt = invalidWindow.returnWindows[0].opensAt;
  assert.equal(isValid("warranty-returns-manager", invalidWindow), false);

  const openWithStalePolicy = structuredClone(cases.get("warranty-returns-manager").fixture);
  openWithStalePolicy.returnWindows[0].state = "open";
  assert.equal(isValid("warranty-returns-manager", openWithStalePolicy), false);

  const readyWithStaleSource = structuredClone(cases.get("warranty-returns-manager").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("warranty-returns-manager", readyWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("warranty-returns-manager").fixture);
  actionAdvice.reviewQuestions[0].reason += " Start returns and contact sellers.";
  assert.equal(isValid("warranty-returns-manager", actionAdvice), false);

  const danglingTermItem = structuredClone(cases.get("warranty-returns-manager").fixture);
  danglingTermItem.warrantyTerms[0].itemRef = "item-missing";
  assert.equal(isValid("warranty-returns-manager", danglingTermItem), false);

  const agentOwned = structuredClone(cases.get("warranty-returns-manager").fixture);
  agentOwned.handoff.owner = "warranty-returns-manager";
  assert.equal(isValid("warranty-returns-manager", agentOwned), false);
});

test("restaurant venue scout preserves source certainty and owner authority", () => {
  const staleSource = structuredClone(cases.get("restaurant-venue-scout").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("restaurant-venue-scout", staleSource), false);

  const unsupportedAccessibility = structuredClone(cases.get("restaurant-venue-scout").fixture);
  unsupportedAccessibility.availability[0].accessibilityState = "unknown";
  assert.equal(isValid("restaurant-venue-scout", unsupportedAccessibility), false);

  const actionAdvice = structuredClone(cases.get("restaurant-venue-scout").fixture);
  actionAdvice.reviewQuestions[1].reason += " Make a reservation and message the venue.";
  assert.equal(isValid("restaurant-venue-scout", actionAdvice), false);

  const mismatch = structuredClone(cases.get("restaurant-venue-scout").fixture);
  mismatch.shortlist[0].availabilityRef = "availability-market-hall";
  assert.equal(isValid("restaurant-venue-scout", mismatch), false);

  const danglingVenue = structuredClone(cases.get("restaurant-venue-scout").fixture);
  danglingVenue.reviewQuestions[0].venueRefs = ["missing-venue"];
  assert.equal(isValid("restaurant-venue-scout", danglingVenue), false);
});

test("local events watcher preserves source certainty and owner authority", () => {
  const staleSource = structuredClone(cases.get("local-events-watcher").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("local-events-watcher", staleSource), false);

  const unsupportedAccessibility = structuredClone(cases.get("local-events-watcher").fixture);
  unsupportedAccessibility.events[0].accessibilityState = "unknown";
  assert.equal(isValid("local-events-watcher", unsupportedAccessibility), false);

  const actionAdvice = structuredClone(cases.get("local-events-watcher").fixture);
  actionAdvice.reviewQuestions[1].reason += " Buy tickets and invite the group.";
  assert.equal(isValid("local-events-watcher", actionAdvice), false);

  const mismatch = structuredClone(cases.get("local-events-watcher").fixture);
  mismatch.watchlist[0].ticketingRef = "ticketing-park-concert";
  assert.equal(isValid("local-events-watcher", mismatch), false);

  const danglingEvent = structuredClone(cases.get("local-events-watcher").fixture);
  danglingEvent.reviewQuestions[0].eventRefs = ["missing-event"];
  assert.equal(isValid("local-events-watcher", danglingEvent), false);
});

test("neighborhood operations watcher preserves public-source limits and owner authority", () => {
  const staleConfirmedSchedule = structuredClone(cases.get("neighborhood-operations-watcher").fixture);
  staleConfirmedSchedule.handoff.state = "draft";
  staleConfirmedSchedule.sources[0].freshness = "stale";
  assert.equal(isValid("neighborhood-operations-watcher", staleConfirmedSchedule), false);

  const invalidRange = structuredClone(cases.get("neighborhood-operations-watcher").fixture);
  invalidRange.schedules[0].endsAt = invalidRange.schedules[0].startsAt;
  assert.equal(isValid("neighborhood-operations-watcher", invalidRange), false);

  const actionAdvice = structuredClone(cases.get("neighborhood-operations-watcher").fixture);
  actionAdvice.reviewQuestions[0].reason += " Call city, report issue, and share address.";
  assert.equal(isValid("neighborhood-operations-watcher", actionAdvice), false);

  const danglingNotice = structuredClone(cases.get("neighborhood-operations-watcher").fixture);
  danglingNotice.routineImpacts[0].noticeRefs = ["missing-notice"];
  assert.equal(isValid("neighborhood-operations-watcher", danglingNotice), false);

  const agentOwned = structuredClone(cases.get("neighborhood-operations-watcher").fixture);
  agentOwned.handoff.owner = "neighborhood-operations-watcher";
  assert.equal(isValid("neighborhood-operations-watcher", agentOwned), false);
});

test("meal grocery planner preserves pantry evidence and owner authority", () => {
  const staleSource = structuredClone(cases.get("meal-grocery-planner").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("meal-grocery-planner", staleSource), false);

  const unsupportedAllergy = structuredClone(cases.get("meal-grocery-planner").fixture);
  unsupportedAllergy.sources.find((source) => source.id === "src-allergy").freshness = "unknown";
  assert.equal(isValid("meal-grocery-planner", unsupportedAllergy), false);

  const actionAdvice = structuredClone(cases.get("meal-grocery-planner").fixture);
  actionAdvice.reviewQuestions[0].reason += " Order groceries and schedule delivery.";
  assert.equal(isValid("meal-grocery-planner", actionAdvice), false);

  const danglingGrocery = structuredClone(cases.get("meal-grocery-planner").fixture);
  danglingGrocery.meals[0].groceryRefs = ["missing-grocery"];
  assert.equal(isValid("meal-grocery-planner", danglingGrocery), false);

  const unsupportedReady = structuredClone(cases.get("meal-grocery-planner").fixture);
  unsupportedReady.meals[0].constraintRefs = ["constraint-vegetarian"];
  assert.equal(isValid("meal-grocery-planner", unsupportedReady), false);
});

test("school coordinator preserves student privacy and guardian authority", () => {
  const staleSource = structuredClone(cases.get("school-coordinator").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("school-coordinator", staleSource), false);

  const unsupportedReady = structuredClone(cases.get("school-coordinator").fixture);
  unsupportedReady.items[0].dueAt = null;
  assert.equal(isValid("school-coordinator", unsupportedReady), false);

  const actionAdvice = structuredClone(cases.get("school-coordinator").fixture);
  actionAdvice.reviewQuestions[0].reason += " Submit the form and message teacher.";
  assert.equal(isValid("school-coordinator", actionAdvice), false);

  const danglingStudent = structuredClone(cases.get("school-coordinator").fixture);
  danglingStudent.items[0].studentRef = "missing-student";
  assert.equal(isValid("school-coordinator", danglingStudent), false);

  const agentOwned = structuredClone(cases.get("school-coordinator").fixture);
  agentOwned.handoff.guardian = "school-coordinator";
  assert.equal(isValid("school-coordinator", agentOwned), false);
});

test("child activity manager preserves child privacy, logistics evidence, and guardian authority", () => {
  const staleSource = structuredClone(cases.get("child-activity-manager").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("child-activity-manager", staleSource), false);

  const invalidRange = structuredClone(cases.get("child-activity-manager").fixture);
  invalidRange.sessions[0].endsAt = invalidRange.sessions[0].startsAt;
  assert.equal(isValid("child-activity-manager", invalidRange), false);

  const actionAdvice = structuredClone(cases.get("child-activity-manager").fixture);
  actionAdvice.reviewQuestions[0].reason += " Arrange ride, commit pickup, and share location.";
  assert.equal(isValid("child-activity-manager", actionAdvice), false);

  const danglingHelper = structuredClone(cases.get("child-activity-manager").fixture);
  danglingHelper.transportation[0].helperRef = "missing-helper";
  assert.equal(isValid("child-activity-manager", danglingHelper), false);

  const unsupportedHelper = structuredClone(cases.get("child-activity-manager").fixture);
  unsupportedHelper.helpers[0].sourceRefs = ["src-team-app"];
  assert.equal(isValid("child-activity-manager", unsupportedHelper), false);

  const agentOwned = structuredClone(cases.get("child-activity-manager").fixture);
  agentOwned.handoff.owner = "child-activity-manager";
  assert.equal(isValid("child-activity-manager", agentOwned), false);
});

test("games backlog manager preserves ownership evidence and owner authority", () => {
  const staleSource = structuredClone(cases.get("games-backlog-manager").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("games-backlog-manager", staleSource), false);

  const unsupportedContent = structuredClone(cases.get("games-backlog-manager").fixture);
  unsupportedContent.availability[0].contentState = "unknown";
  assert.equal(isValid("games-backlog-manager", unsupportedContent), false);

  const actionAdvice = structuredClone(cases.get("games-backlog-manager").fixture);
  actionAdvice.reviewQuestions[1].reason += " Install and launch it now.";
  assert.equal(isValid("games-backlog-manager", actionAdvice), false);

  const mismatch = structuredClone(cases.get("games-backlog-manager").fixture);
  mismatch.shortlist[0].availabilityRef = "availability-racer";
  assert.equal(isValid("games-backlog-manager", mismatch), false);

  const danglingGame = structuredClone(cases.get("games-backlog-manager").fixture);
  danglingGame.reviewQuestions[0].gameRefs = ["missing-game"];
  assert.equal(isValid("games-backlog-manager", danglingGame), false);
});

test("home inventory binder preserves evidence and owner disclosure authority", () => {
  const staleSource = structuredClone(cases.get("home-inventory-binder").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("home-inventory-binder", staleSource), false);

  const unsupportedReady = structuredClone(cases.get("home-inventory-binder").fixture);
  unsupportedReady.items[0].condition = "unknown";
  assert.equal(isValid("home-inventory-binder", unsupportedReady), false);

  const actionAdvice = structuredClone(cases.get("home-inventory-binder").fixture);
  actionAdvice.reviewQuestions[0].reason += " Upload it and contact insurer.";
  assert.equal(isValid("home-inventory-binder", actionAdvice), false);

  const danglingItem = structuredClone(cases.get("home-inventory-binder").fixture);
  danglingItem.evidence[0].itemRef = "missing-item";
  assert.equal(isValid("home-inventory-binder", danglingItem), false);

  const agentOwned = structuredClone(cases.get("home-inventory-binder").fixture);
  agentOwned.handoff.owner = "home-inventory-binder";
  assert.equal(isValid("home-inventory-binder", agentOwned), false);
});

test("insurance policy organizer preserves policy evidence and owner authority", () => {
  const staleSource = structuredClone(cases.get("insurance-policy-organizer").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("insurance-policy-organizer", staleSource), false);

  const unsupportedCoverage = structuredClone(cases.get("insurance-policy-organizer").fixture);
  unsupportedCoverage.coverageItems[0].sourceRefs = ["src-owner-note"];
  assert.equal(isValid("insurance-policy-organizer", unsupportedCoverage), false);

  const unsupportedPremium = structuredClone(cases.get("insurance-policy-organizer").fixture);
  unsupportedPremium.premiumItems[0].sourceRefs = ["src-owner-note"];
  assert.equal(isValid("insurance-policy-organizer", unsupportedPremium), false);

  const actionAdvice = structuredClone(cases.get("insurance-policy-organizer").fixture);
  actionAdvice.reviewQuestions[0].reason += " File a claim and contact the carrier.";
  assert.equal(isValid("insurance-policy-organizer", actionAdvice), false);

  const danglingAsset = structuredClone(cases.get("insurance-policy-organizer").fixture);
  danglingAsset.claimReadiness[0].assetRefs = ["missing-asset"];
  assert.equal(isValid("insurance-policy-organizer", danglingAsset), false);

  const unsupportedReady = structuredClone(cases.get("insurance-policy-organizer").fixture);
  unsupportedReady.claimReadiness[0].blockedReason = "Needs more evidence.";
  assert.equal(isValid("insurance-policy-organizer", unsupportedReady), false);
});

test("certification renewal planner preserves issuer evidence and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("certification-renewal-planner").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("certification-renewal-planner", readyWithStaleSource), false);

  const currentWithStaleSource = structuredClone(cases.get("certification-renewal-planner").fixture);
  currentWithStaleSource.credentials[1].status = "current";
  assert.equal(isValid("certification-renewal-planner", currentWithStaleSource), false);

  const satisfiedWithStaleSource = structuredClone(cases.get("certification-renewal-planner").fixture);
  satisfiedWithStaleSource.requirements[2].state = "satisfied";
  assert.equal(isValid("certification-renewal-planner", satisfiedWithStaleSource), false);

  const evidenceWithStaleSource = structuredClone(cases.get("certification-renewal-planner").fixture);
  evidenceWithStaleSource.evidenceItems[1].state = "available";
  assert.equal(isValid("certification-renewal-planner", evidenceWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("certification-renewal-planner").fixture);
  actionAdvice.reviewQuestions[0].reason += " Submit renewal and pay fee.";
  assert.equal(isValid("certification-renewal-planner", actionAdvice), false);

  const danglingCredential = structuredClone(cases.get("certification-renewal-planner").fixture);
  danglingCredential.requirements[0].credentialRef = "credential-missing";
  assert.equal(isValid("certification-renewal-planner", danglingCredential), false);

  const agentOwned = structuredClone(cases.get("certification-renewal-planner").fixture);
  agentOwned.handoff.owner = "certification-renewal-planner";
  assert.equal(isValid("certification-renewal-planner", agentOwned), false);
});

test("job application tracker preserves candidate evidence and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("job-application-tracker").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("job-application-tracker", readyWithStaleSource), false);

  const suppliedWithStaleSource = structuredClone(cases.get("job-application-tracker").fixture);
  suppliedWithStaleSource.materials[0].sourceRefs = ["source-offer-old"];
  assert.equal(isValid("job-application-tracker", suppliedWithStaleSource), false);

  const actionAdvice = structuredClone(cases.get("job-application-tracker").fixture);
  actionAdvice.reviewQuestions[0].reason += " Submit applications and message recruiters.";
  assert.equal(isValid("job-application-tracker", actionAdvice), false);

  const danglingApplication = structuredClone(cases.get("job-application-tracker").fixture);
  danglingApplication.materials[0].applicationRef = "application-missing";
  assert.equal(isValid("job-application-tracker", danglingApplication), false);

  const danglingQuestion = structuredClone(cases.get("job-application-tracker").fixture);
  danglingQuestion.handoff.reviewQuestionRefs = ["question-missing"];
  assert.equal(isValid("job-application-tracker", danglingQuestion), false);

  const agentOwned = structuredClone(cases.get("job-application-tracker").fixture);
  agentOwned.handoff.owner = "job-application-tracker";
  assert.equal(isValid("job-application-tracker", agentOwned), false);
});

test("travel loyalty organizer preserves rewards evidence and owner authority", () => {
  const readyWithSensitiveSource = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  readyWithSensitiveSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("travel-loyalty-points-organizer", readyWithSensitiveSource), false);

  const staleBalance = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  staleBalance.balances[0].sourceRefs = ["source-transfer-page-old"];
  assert.equal(isValid("travel-loyalty-points-organizer", staleBalance), false);

  const unsupportedCandidate = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  unsupportedCandidate.redemptionCandidates[0].state = "review-candidate";
  assert.equal(isValid("travel-loyalty-points-organizer", unsupportedCandidate), false);

  const actionAdvice = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  actionAdvice.reviewQuestions[0].reason += " Redeem award and transfer points.";
  assert.equal(isValid("travel-loyalty-points-organizer", actionAdvice), false);

  const danglingProgram = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  danglingProgram.balances[0].programRef = "program-missing";
  assert.equal(isValid("travel-loyalty-points-organizer", danglingProgram), false);

  const agentOwned = structuredClone(cases.get("travel-loyalty-points-organizer").fixture);
  agentOwned.handoff.owner = "travel-loyalty-points-organizer";
  assert.equal(isValid("travel-loyalty-points-organizer", agentOwned), false);
});

test("professional networking follow-up preserves contact evidence and owner authority", () => {
  const readyWithSensitiveSource = structuredClone(cases.get("professional-networking-followup").fixture);
  readyWithSensitiveSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("professional-networking-followup", readyWithSensitiveSource), false);

  const staleInteraction = structuredClone(cases.get("professional-networking-followup").fixture);
  staleInteraction.interactions[0].sourceRefs = ["source-old-email"];
  assert.equal(isValid("professional-networking-followup", staleInteraction), false);

  const unsupportedIntro = structuredClone(cases.get("professional-networking-followup").fixture);
  unsupportedIntro.introductions[0].state = "needs-owner-review";
  assert.equal(isValid("professional-networking-followup", unsupportedIntro), false);

  const actionAdvice = structuredClone(cases.get("professional-networking-followup").fixture);
  actionAdvice.reviewQuestions[0].reason += " Send message and make introduction.";
  assert.equal(isValid("professional-networking-followup", actionAdvice), false);

  const danglingContact = structuredClone(cases.get("professional-networking-followup").fixture);
  danglingContact.followUps[0].contactRef = "contact-missing";
  assert.equal(isValid("professional-networking-followup", danglingContact), false);

  const agentOwned = structuredClone(cases.get("professional-networking-followup").fixture);
  agentOwned.handoff.owner = "professional-networking-followup";
  assert.equal(isValid("professional-networking-followup", agentOwned), false);
});

test("resume portfolio curator preserves claim evidence and owner authority", () => {
  const readyWithStaleSource = structuredClone(cases.get("resume-portfolio-curator").fixture);
  readyWithStaleSource.handoff.state = "ready-for-owner-review";
  assert.equal(isValid("resume-portfolio-curator", readyWithStaleSource), false);

  const danglingSource = structuredClone(cases.get("resume-portfolio-curator").fixture);
  danglingSource.claims[0].sourceRefs = ["source-missing"];
  assert.equal(isValid("resume-portfolio-curator", danglingSource), false);

  const unsupportedClaim = structuredClone(cases.get("resume-portfolio-curator").fixture);
  unsupportedClaim.claims[2].state = "supported";
  assert.equal(isValid("resume-portfolio-curator", unsupportedClaim), false);

  const unsupportedMaterial = structuredClone(cases.get("resume-portfolio-curator").fixture);
  unsupportedMaterial.materials[1].claimRefs = ["claim-certification"];
  assert.equal(isValid("resume-portfolio-curator", unsupportedMaterial), false);

  const unsupportedFit = structuredClone(cases.get("resume-portfolio-curator").fixture);
  unsupportedFit.roleFits[0].state = "supported";
  unsupportedFit.roleFits[0].claimRefs = ["claim-portfolio-links"];
  assert.equal(isValid("resume-portfolio-curator", unsupportedFit), false);

  const actionAdvice = structuredClone(cases.get("resume-portfolio-curator").fixture);
  actionAdvice.reviewQuestions[0].reason += " Publish profile and upload files.";
  assert.equal(isValid("resume-portfolio-curator", actionAdvice), false);

  const agentOwned = structuredClone(cases.get("resume-portfolio-curator").fixture);
  agentOwned.handoff.owner = "resume-portfolio-curator";
  assert.equal(isValid("resume-portfolio-curator", agentOwned), false);
});

test("public safety state rejects impossible time ranges and dangling alerts", () => {
  const candidate = structuredClone(cases.get("public-safety-monitor").fixture);
  candidate.alerts[0].expiresAt = candidate.alerts[0].issuedAt;
  assert.equal(isValid("public-safety-monitor", candidate), false);
  candidate.alerts[0].expiresAt = "2026-08-18T04:00:00Z";
  candidate.actions[0].alertRefs = ["missing-alert"];
  assert.equal(isValid("public-safety-monitor", candidate), false);
});

test("recruiting plans reject invalid sessions and dangling participants", () => {
  const candidate = structuredClone(cases.get("recruiting-coordinator").fixture);
  candidate.sessions[0].end = candidate.sessions[0].start;
  assert.equal(isValid("recruiting-coordinator", candidate), false);
  candidate.sessions[0].end = "2026-08-20T15:45:00Z";
  candidate.sessions[0].interviewerRefs = ["missing-interviewer"];
  assert.equal(isValid("recruiting-coordinator", candidate), false);
});

test("sales reviews reject deal references outside the supplied snapshot", () => {
  const candidate = structuredClone(cases.get("sales-operations").fixture);
  candidate.actions[0].dealRefs = ["missing-deal"];
  assert.equal(isValid("sales-operations", candidate), false);
});

test("civic evidence rejects incompatible source, measure, and geography references", () => {
  const candidate = structuredClone(cases.get("civic-data-analyst").fixture);
  candidate.measures[0].sourceRefs = ["missing-source"];
  assert.equal(isValid("civic-data-analyst", candidate), false);
  candidate.measures[0].sourceRefs = ["acs-vehicle"];
  candidate.comparisons[0].measureRefs = ["zero-vehicle-share", "missing-measure"];
  assert.equal(isValid("civic-data-analyst", candidate), false);
  candidate.comparisons[0].measureRefs = ["zero-vehicle-share", "evening-trips"];
  candidate.measures[0].geographyRef = "different-boundary";
  assert.equal(isValid("civic-data-analyst", candidate), false);
});

test("decision artifacts reject agent-owned terminal states", () => {
  for (const item of cases.values()) {
    const candidate = structuredClone(item.fixture);
    const parts = item.decisionField.split(".");
    const target = parts.slice(0, -1).reduce((value, key) => value[key], candidate);
    target[parts.at(-1)] = "committed-by-agent";
    assert.equal(isValid(item.id, candidate), false, item.id);
  }
});

test("decision artifacts reject duplicate semantic references", () => {
  const mutations = [
    ["change-control-operator", (value) => value.execution.stepResults.push(structuredClone(value.execution.stepResults[0]))],
    ["case-continuity-coordinator", (value) => value.actions[0].evidenceRefs.push(value.actions[0].evidenceRefs[0])],
    ["certification-renewal-planner", (value) => value.credentials[0].sourceRefs.push(value.credentials[0].sourceRefs[0])],
    ["benefits-open-enrollment-planner", (value) => value.options[0].sourceRefs.push(value.options[0].sourceRefs[0])],
    ["child-activity-manager", (value) => value.activities[0].sourceRefs.push(value.activities[0].sourceRefs[0])],
    ["delegation-coordinator", (value) => value.synthesis.resultRefs.push(value.synthesis.resultRefs[0])],
    ["document-renewal-tracker", (value) => value.documents[0].sourceRefs.push(value.documents[0].sourceRefs[0])],
    ["financial-analyst", (value) => value.risks[0].sourceRefs.push(value.risks[0].sourceRefs[0])],
    ["freelance-client-pipeline", (value) => value.opportunities[0].sourceRefs.push(value.opportunities[0].sourceRefs[0])],
    ["conference-opportunity-scout", (value) => value.opportunities[0].sourceRefs.push(value.opportunities[0].sourceRefs[0])],
    ["fantasy-sports-manager", (value) => value.lineup[0].sourceRefs.push(value.lineup[0].sourceRefs[0])],
    ["games-backlog-manager", (value) => value.shortlist[0].constraintRefs.push(value.shortlist[0].constraintRefs[0])],
    ["gift-relationship-manager", (value) => value.shortlist[0].preferenceRefs.push(value.shortlist[0].preferenceRefs[0])],
    ["health-records-binder", (value) => value.records[0].sourceRefs.push(value.records[0].sourceRefs[0])],
    ["household-budget-steward", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["home-inventory-binder", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["insurance-policy-organizer", (value) => value.coverageItems[0].sourceRefs.push(value.coverageItems[0].sourceRefs[0])],
    ["invoice-payment-followup", (value) => value.invoices[0].sourceRefs.push(value.invoices[0].sourceRefs[0])],
    ["job-application-tracker", (value) => value.applications[0].sourceRefs.push(value.applications[0].sourceRefs[0])],
    ["knowledge-curator", (value) => value.handoff.sourceRefs.push(value.handoff.sourceRefs[0])],
    ["life-timeline-keeper", (value) => value.events[0].sourceRefs.push(value.events[0].sourceRefs[0])],
    ["medical-appointment-prep", (value) => value.appointments[0].sourceRefs.push(value.appointments[0].sourceRefs[0])],
    ["local-events-watcher", (value) => value.watchlist[0].constraintRefs.push(value.watchlist[0].constraintRefs[0])],
    ["meal-grocery-planner", (value) => value.meals[0].constraintRefs.push(value.meals[0].constraintRefs[0])],
    ["model-evaluation-adjudicator", (value) => value.disagreements[0].judgmentRefs.push(value.disagreements[0].judgmentRefs[0])],
    ["movie-streaming-organizer", (value) => value.shortlist[0].preferenceRefs.push(value.shortlist[0].preferenceRefs[0])],
    ["music-organizer", (value) => value.playlistPlan[0].preferenceRefs.push(value.playlistPlan[0].preferenceRefs[0])],
    ["neighborhood-operations-watcher", (value) => value.notices[0].sourceRefs.push(value.notices[0].sourceRefs[0])],
    ["wardrobe-organizer", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["warranty-returns-manager", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["personal-archive-curator", (value) => value.retrievalCues[0].sourceRefs.push(value.retrievalCues[0].sourceRefs[0])],
    ["purchase-researcher", (value) => value.candidates[0].sourceRefs.push(value.candidates[0].sourceRefs[0])],
    ["professional-networking-followup", (value) => value.contacts[0].sourceRefs.push(value.contacts[0].sourceRefs[0])],
    ["resume-portfolio-curator", (value) => value.claims[0].sourceRefs.push(value.claims[0].sourceRefs[0])],
    ["public-safety-monitor", (value) => value.actions[0].alertRefs.push(value.actions[0].alertRefs[0])],
    ["recruiting-coordinator", (value) => value.communications[0].sessionRefs.push(value.communications[0].sessionRefs[0])],
    ["restaurant-venue-scout", (value) => value.shortlist[0].constraintRefs.push(value.shortlist[0].constraintRefs[0])],
    ["sales-operations", (value) => value.actions[0].dealRefs.push(value.actions[0].dealRefs[0])],
    ["school-coordinator", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["sports-team-watcher", (value) => value.games[0].sourceRefs.push(value.games[0].sourceRefs[0])],
    ["stock-portfolio-monitor", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["subscription-manager", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["tax-document-organizer", (value) => value.documents[0].sourceRefs.push(value.documents[0].sourceRefs[0])],
    ["travel-loyalty-points-organizer", (value) => value.programs[0].sourceRefs.push(value.programs[0].sourceRefs[0])],
    ["civic-data-analyst", (value) => value.measures[0].sourceRefs.push(value.measures[0].sourceRefs[0])],
  ];
  for (const [id, mutate] of mutations) {
    const candidate = structuredClone(cases.get(id).fixture);
    mutate(candidate);
    assert.equal(isValid(id, candidate), false, id);
  }
});

test("change control rejects digest drift and unsupported verification", () => {
  const candidate = structuredClone(cases.get("change-control-operator").fixture);
  candidate.decision.planDigest = "b".repeat(64);
  assert.equal(isValid("change-control-operator", candidate), false);
  candidate.decision.planDigest = candidate.plan.digest;
  candidate.execution.stepResults[0].state = "failed";
  assert.equal(isValid("change-control-operator", candidate), false);
  const changedPlan = structuredClone(cases.get("change-control-operator").fixture);
  changedPlan.plan.targets.push("config/production.yml");
  assert.equal(isValid("change-control-operator", changedPlan), false);
});

test("case continuity rejects broken chains and stale resume points", () => {
  const candidate = structuredClone(cases.get("case-continuity-coordinator").fixture);
  candidate.checkpoints[1].previousRef = "missing-checkpoint";
  assert.equal(isValid("case-continuity-coordinator", candidate), false);
  candidate.checkpoints[1].previousRef = candidate.checkpoints[0].id;
  candidate.resume.checkpointRef = candidate.checkpoints[0].id;
  assert.equal(isValid("case-continuity-coordinator", candidate), false);
  const stale = structuredClone(cases.get("case-continuity-coordinator").fixture);
  stale.evidence[0].expiresAt = stale.checkpoints.at(-1).recordedAt;
  assert.equal(isValid("case-continuity-coordinator", stale), false);
});

test("delegation rejects dangling provenance and mismatched worker sessions", () => {
  const candidate = structuredClone(cases.get("delegation-coordinator").fixture);
  candidate.results[0].assignmentRef = "missing-assignment";
  assert.equal(isValid("delegation-coordinator", candidate), false);
  candidate.results[0].assignmentRef = candidate.assignments[0].id;
  candidate.results[0].workerSessionRef = "agent:other:01";
  assert.equal(isValid("delegation-coordinator", candidate), false);
  const expanded = structuredClone(cases.get("delegation-coordinator").fixture);
  expanded.results[0].sourceRefs = ["accessibility-pack"];
  assert.equal(isValid("delegation-coordinator", expanded), false);
});

test("model evaluation rejects invalid score, coverage, and adjudication state", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.judgments[0].score = 8;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.judgments[0].score = 4;
  candidate.coverage.completedJudgments = 7;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.coverage.completedJudgments = 8;
  candidate.disagreements[0].state = "open";
  delete candidate.disagreements[0].adjudication;
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation rejects dangling and incomparable judgments", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.disagreements[0].judgmentRefs[1] = "missing-judgment";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.disagreements[0].judgmentRefs[1] = "j-a-policy-1";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation blocks incomplete studies from owner-ready state", () => {
  const candidate = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  candidate.study.blinding.state = "partial";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
  candidate.study.blinding.state = "verified";
  candidate.evaluators[0].calibrationState = "needs-review";
  assert.equal(isValid("model-evaluation-adjudicator", candidate), false);
});

test("model evaluation requires every planned judgment and material disagreement", () => {
  const missingDisagreement = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  missingDisagreement.disagreements = [];
  assert.equal(isValid("model-evaluation-adjudicator", missingDisagreement), false);

  const omittedOutlier = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  omittedOutlier.evaluators.push({
    id: "evaluator-3",
    calibrationState: "calibrated",
    anchorRefs: omittedOutlier.evaluators[0].anchorRefs,
  });
  omittedOutlier.judgments.push({
    id: "j-b-policy-3",
    outputRef: "output-b",
    criterionRef: "policy",
    evaluatorRef: "evaluator-3",
    score: 1,
    evidenceRef: "evaluations/evaluator-3.json",
  });
  omittedOutlier.samplingPlan.push({
    outputRef: "output-b",
    criterionRef: "policy",
    evaluatorRef: "evaluator-3",
  });
  omittedOutlier.coverage.expectedJudgments += 1;
  omittedOutlier.coverage.completedJudgments += 1;
  omittedOutlier.disagreements[0].judgmentRefs = ["j-b-policy-1", "j-b-policy-3"];
  omittedOutlier.disagreements[0].spread = 0;
  omittedOutlier.disagreements[0].thresholdExceeded = false;
  assert.equal(isValid("model-evaluation-adjudicator", omittedOutlier), false);

  const decimalSpread = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  decimalSpread.judgments.find((item) => item.id === "j-b-policy-1").score = 1.1;
  decimalSpread.judgments.find((item) => item.id === "j-b-policy-2").score = 3.3;
  decimalSpread.disagreements[0].spread = 2.2;
  assert.equal(isValid("model-evaluation-adjudicator", decimalSpread), true);

  const incompleteMatrix = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  incompleteMatrix.judgments = [incompleteMatrix.judgments[0]];
  incompleteMatrix.samplingPlan = [incompleteMatrix.samplingPlan[0]];
  incompleteMatrix.coverage = {
    expectedJudgments: 1,
    completedJudgments: 1,
    missing: [],
  };
  incompleteMatrix.disagreements = [];
  assert.equal(isValid("model-evaluation-adjudicator", incompleteMatrix), false);
});

test("model evaluation binds calibration anchors to their criteria", () => {
  const incomplete = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  incomplete.evaluators[0].anchorRefs = ["anchor-accuracy-low"];
  assert.equal(isValid("model-evaluation-adjudicator", incomplete), false);

  const mismatched = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  mismatched.criteria[0].anchorRefs[0] = "anchor-policy-low";
  assert.equal(isValid("model-evaluation-adjudicator", mismatched), false);
});

test("model evaluation keeps blinding and terminal authority owner-controlled", () => {
  const exposed = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  exposed.outputs[0].blindLabel = "GPT-5.6";
  exposed.outputs[0].sourceRef = "outputs/gpt-5.6.json";
  assert.equal(isValid("model-evaluation-adjudicator", exposed), false);

  const identityBearingPath = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  identityBearingPath.outputs[0].sourceRef = "blinded/gpt-5.6.json";
  assert.equal(isValid("model-evaluation-adjudicator", identityBearingPath), false);

  const mismatchedOpaqueAlias = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  mismatchedOpaqueAlias.outputs[0].id = "output-gpt-5";
  mismatchedOpaqueAlias.outputs[0].sourceRef = "blinded/system-gpt-5.json";
  mismatchedOpaqueAlias.judgments
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });

  mismatchedOpaqueAlias.samplingPlan
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  assert.equal(isValid("model-evaluation-adjudicator", mismatchedOpaqueAlias), false);

  const identityBearingAlias = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  identityBearingAlias.outputs[0].blindLabel = "System GPT-5";
  identityBearingAlias.outputs[0].id = "output-gpt-5";
  identityBearingAlias.outputs[0].sourceRef = "blinded/system-gpt-5.json";
  identityBearingAlias.judgments
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  identityBearingAlias.samplingPlan
    .filter((item) => item.outputRef === "output-a")
    .forEach((item) => {
      item.outputRef = "output-gpt-5";
    });
  assert.equal(isValid("model-evaluation-adjudicator", identityBearingAlias), false);

  const agentOwned = structuredClone(cases.get("model-evaluation-adjudicator").fixture);
  agentOwned.study.decisionOwner.id = "model-evaluation-adjudicator";
  agentOwned.handoff.decisionOwner.id = "model-evaluation-adjudicator";
  assert.equal(isValid("model-evaluation-adjudicator", agentOwned), false);

  const incompleteProhibitions = structuredClone(
    cases.get("model-evaluation-adjudicator").fixture,
  );
  incompleteProhibitions.handoff.prohibitedActions = ["deploy"];
  assert.equal(isValid("model-evaluation-adjudicator", incompleteProhibitions), false);
});

test("vehicle service binds safety, diagnosis, and appointment authority", () => {
  const unsafe = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unsafe.assessment.safeToDrive = "routine";
  assert.equal(isValid("vehicle-service-coordinator", unsafe), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  unsupportedDiagnosis.hypotheses[0].status = "technician-confirmed";
  assert.equal(isValid("vehicle-service-coordinator", unsupportedDiagnosis), false);

  const unsupportedCheck = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unsupportedCheck.ownerChecks[0].safetyClass = "manual-approved";
  unsupportedCheck.ownerChecks[0].evidenceRefs = ["ev-owner"];
  unsupportedCheck.hypotheses = [];
  assert.equal(isValid("vehicle-service-coordinator", unsupportedCheck), false);

  const exposedVin = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  exposedVin.vehicle.reference = "vehicle-1hgcm82633a004352";
  assert.equal(isValid("vehicle-service-coordinator", exposedVin), false);

  const exposedLowercaseVin = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  exposedLowercaseVin.observations[0].description += " VIN 1hgcm82633a004352.";
  assert.equal(isValid("vehicle-service-coordinator", exposedLowercaseVin), false);

  const agentOwned = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  agentOwned.owner.id = "vehicle-service-coordinator";
  agentOwned.handoff.owner.id = "vehicle-service-coordinator";
  assert.equal(isValid("vehicle-service-coordinator", agentOwned), false);
});

test("vehicle service rejects unapproved or drifted booking state", () => {
  const prematureReceipt = structuredClone(
    cases.get("vehicle-service-coordinator").fixture,
  );
  prematureReceipt.appointment.bookingIntegration = {
    id: "approved-integration-provider",
    providerRef: "provider-hybrid",
    approvalRef: "controlled://vehicle-service/integration-approval",
    configuredBy: prematureReceipt.owner,
  };
  prematureReceipt.appointment.receipt = {
    planDigest: `sha256:${"0".repeat(64)}`,
    integrationId: "approved-integration-provider",
    providerRef: "provider-hybrid",
    confirmationRef: "provider://provider-hybrid/confirmation-early",
    bookedAt: "2026-08-22T17:00:00Z",
  };
  assert.equal(isValid("vehicle-service-coordinator", prematureReceipt), false);

  const unapproved = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  unapproved.appointment.state = "booked";
  assert.equal(isValid("vehicle-service-coordinator", unapproved), false);

  const invalidProvider = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  invalidProvider.appointment.plan.providerRef = "missing-provider";
  assert.equal(isValid("vehicle-service-coordinator", invalidProvider), false);

  const excessiveDeposit = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  excessiveDeposit.appointment.plan.maxDeposit = 300;
  assert.equal(isValid("vehicle-service-coordinator", excessiveDeposit), false);

  const booked = structuredClone(cases.get("vehicle-service-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(booked.appointment.plan))
    .digest("hex")}`;
  booked.appointment = {
    ...booked.appointment,
    state: "booked",
    approval: {
      owner: booked.owner,
      planDigest,
      approvedAt: "2026-08-22T18:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-provider",
      providerRef: "provider-hybrid",
      approvalRef: "controlled://vehicle-service/integration-approval",
      configuredBy: booked.owner,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-provider",
      providerRef: "provider-hybrid",
      confirmationRef: "provider://provider-hybrid/confirmation-1",
      bookedAt: "2026-08-22T17:00:00Z",
    },
  };
  assert.equal(isValid("vehicle-service-coordinator", booked), false);

  booked.appointment.receipt.bookedAt = "2026-08-22T19:00:00Z";
  booked.appointment.receipt.confirmationRef =
    "provider://unrelated-provider/confirmation-1";
  assert.equal(isValid("vehicle-service-coordinator", booked), false);
});

test("appliance care binds identity, recurring care, and portfolio state", () => {
  const unverifiedSerial = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unverifiedSerial.appliances[1].serialScope = "unverified";
  assert.equal(isValid("appliance-care-coordinator", unverifiedSerial), false);

  const unsupportedCare = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedCare.maintenance[0].sourceRefs = ["ev-owner"];
  assert.equal(isValid("appliance-care-coordinator", unsupportedCare), false);

  const repairInstruction = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  repairInstruction.maintenance[0].task = "Disassemble and repair the washer pump.";
  assert.equal(isValid("appliance-care-coordinator", repairInstruction), false);

  const unsupportedCompletion = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedCompletion.maintenance[0].state = "completed";
  unsupportedCompletion.maintenance[0].completedAt = "2026-08-20T19:00:00Z";
  assert.equal(isValid("appliance-care-coordinator", unsupportedCompletion), false);

  const incompleteCoverage = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  incompleteCoverage.coverage.pop();
  assert.equal(isValid("appliance-care-coordinator", incompleteCoverage), false);
});

test("appliance care requires exact recall, coverage, and lifecycle evidence", () => {
  const serialMismatch = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  serialMismatch.appliances[3].serialScope = "masked";
  assert.equal(isValid("appliance-care-coordinator", serialMismatch), false);

  const unsupportedRecall = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedRecall.recalls[3].evidenceRefs = ["ev-owner"];
  assert.equal(isValid("appliance-care-coordinator", unsupportedRecall), false);

  const unsupportedWarranty = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedWarranty.coverage[0].evidenceRefs = ["ev-purchases"];
  assert.equal(isValid("appliance-care-coordinator", unsupportedWarranty), false);

  const unsupportedReplacement = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedReplacement.lifecycleDecisions[2].evidenceRefs = ["ev-service"];
  assert.equal(isValid("appliance-care-coordinator", unsupportedReplacement), false);

  const wrongFaultHandoff = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  wrongFaultHandoff.incidents[0].state = "active-fault";
  assert.equal(isValid("appliance-care-coordinator", wrongFaultHandoff), false);
});

test("appliance care protects owner authority and external actions", () => {
  const addressLeak = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  addressLeak.lifecycleDecisions[0].rationale += " Service address: 742 Evergreen Terrace.";
  assert.equal(isValid("appliance-care-coordinator", addressLeak), false);

  const unsupportedProvider = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-manuals";
  assert.equal(isValid("appliance-care-coordinator", unsupportedProvider), false);

  const wrongAction = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  wrongAction.action.plan.applianceRef = "appliance-washer";
  assert.equal(isValid("appliance-care-coordinator", wrongAction), false);

  const prematureApproval = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  prematureApproval.action.approval = {
    owner: prematureApproval.owner,
    planDigest: `sha256:${"0".repeat(64)}`,
    approvedAt: "2026-08-21T03:00:00Z",
  };
  assert.equal(isValid("appliance-care-coordinator", prematureApproval), false);

  const agentOwned = structuredClone(
    cases.get("appliance-care-coordinator").fixture,
  );
  agentOwned.owner.id = "appliance-care-coordinator";
  agentOwned.handoff.owner.id = "appliance-care-coordinator";
  assert.equal(isValid("appliance-care-coordinator", agentOwned), false);
});

test("household steward preserves independent member authority", () => {
  const elevatedCaregiver = structuredClone(cases.get("household-steward").fixture);
  elevatedCaregiver.members[3].decisionScopes = ["appointment"];
  assert.equal(isValid("household-steward", elevatedCaregiver), false);

  const agentOwned = structuredClone(cases.get("household-steward").fixture);
  agentOwned.members[0].id = "household-steward";
  agentOwned.handoff.accountableMemberRefs[0] = "household-steward";
  assert.equal(isValid("household-steward", agentOwned), false);

  const falseConsensus = structuredClone(cases.get("household-steward").fixture);
  falseConsensus.externalAction.state = "approved";
  falseConsensus.externalAction.approvals = [
    {
      memberRef: "member-alex",
      planDigest: `sha256:${"0".repeat(64)}`,
      approvedAt: "2026-08-21T05:10:00Z",
    },
  ];
  assert.equal(isValid("household-steward", falseConsensus), false);
});

test("household steward bounds multiplayer worker scope and provenance", () => {
  const broadened = structuredClone(cases.get("household-steward").fixture);
  broadened.assignments[0].sourceArtifactRefs.push("artifact-pet");
  assert.equal(isValid("household-steward", broadened), false);

  const mismatchedSession = structuredClone(cases.get("household-steward").fixture);
  mismatchedSession.results[0].workerSessionRef = "agent:unrelated:99";
  assert.equal(isValid("household-steward", mismatchedSession), false);

  const droppedBoundary = structuredClone(cases.get("household-steward").fixture);
  droppedBoundary.results[1].prohibitedActions = ["diagnose"];
  assert.equal(isValid("household-steward", droppedBoundary), false);
});

test("household steward exposes cross-domain conflicts instead of false readiness", () => {
  const unavailableReady = structuredClone(cases.get("household-steward").fixture);
  const vehicle = unavailableReady.operations.find(
    (item) => item.id === "operation-vehicle",
  );
  vehicle.state = "ready";
  vehicle.blockedReasons = [];
  assert.equal(isValid("household-steward", unavailableReady), false);

  const hiddenBudget = structuredClone(cases.get("household-steward").fixture);
  hiddenBudget.conflicts = hiddenBudget.conflicts.filter(
    (item) => item.kind !== "budget",
  );
  assert.equal(isValid("household-steward", hiddenBudget), false);

  const unresolvedDependency = structuredClone(cases.get("household-steward").fixture);
  const pond = unresolvedDependency.operations.find(
    (item) => item.id === "operation-pond",
  );
  pond.state = "ready";
  pond.blockedReasons = [];
  assert.equal(isValid("household-steward", unresolvedDependency), false);

  const falseHandoff = structuredClone(cases.get("household-steward").fixture);
  falseHandoff.handoff.state = "ready-for-household";
  assert.equal(isValid("household-steward", falseHandoff), false);
});

test("household steward keeps shared and private views separate", () => {
  const restrictedLeak = structuredClone(cases.get("household-steward").fixture);
  restrictedLeak.views[0].sourceArtifactRefs.push("artifact-pet");
  assert.equal(isValid("household-steward", restrictedLeak), false);

  const addressLeak = structuredClone(cases.get("household-steward").fixture);
  addressLeak.sourceArtifacts[0].sharedSummary += " Address: 123 Main Street.";
  assert.equal(isValid("household-steward", addressLeak), false);

  const missingPrivateView = structuredClone(cases.get("household-steward").fixture);
  missingPrivateView.views = missingPrivateView.views.filter(
    (view) => view.id !== "view-casey-private",
  );
  assert.equal(isValid("household-steward", missingPrivateView), false);
});

test("work chief of staff preserves independent leader authority", () => {
  const agentOwned = structuredClone(cases.get("work-chief-of-staff").fixture);
  agentOwned.principals[0].id = "work-chief-of-staff";
  agentOwned.handoff.accountablePrincipalRefs[0] = "work-chief-of-staff";
  assert.equal(isValid("work-chief-of-staff", agentOwned), false);

  const falseConsensus = structuredClone(cases.get("work-chief-of-staff").fixture);
  falseConsensus.commitment.state = "approved";
  falseConsensus.commitment.approvals = [
    {
      principalRef: "principal-ceo",
      planDigest: `sha256:${"0".repeat(64)}`,
      approvedAt: "2026-08-21T17:30:00Z",
    },
  ];
  assert.equal(isValid("work-chief-of-staff", falseConsensus), false);

  const borrowedAuthority = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  borrowedAuthority.principals.find(
    (principal) => principal.id === "principal-product",
  ).authorityEvidenceRefs = ["ev-ceo"];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", borrowedAuthority).some(
      (finding) => finding.code === "unsupported_work_principal_authority",
    ),
  );

  const selfAuthorized = structuredClone(cases.get("work-chief-of-staff").fixture);
  selfAuthorized.approvalPolicies[0].requiredPrincipalRefs = ["principal-ceo"];
  const selfAuthorizedDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(selfAuthorized.commitment.plan))
    .digest("hex")}`;
  selfAuthorized.commitment.state = "approved";
  selfAuthorized.commitment.approvals = [
    {
      principalRef: "principal-ceo",
      planDigest: selfAuthorizedDigest,
      approvedAt: "2026-08-21T17:30:00Z",
    },
  ];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", selfAuthorized).some(
      (finding) => finding.code === "work_commitment_approval_mismatch",
    ),
  );

  const borrowedPolicyAuthority = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  borrowedPolicyAuthority.approvalPolicies[0].authorityEvidenceRefs = [
    "ev-engineering",
  ];
  assert.ok(
    validateArtifactSemantics(
      "work-chief-of-staff",
      borrowedPolicyAuthority,
    ).some((finding) => finding.code === "unsupported_work_approval_policy"),
  );
});

test("work chief of staff bounds specialist worker scope and provenance", () => {
  const broadened = structuredClone(cases.get("work-chief-of-staff").fixture);
  broadened.assignments[0].sourceArtifactRefs.push("artifact-finance");
  assert.equal(isValid("work-chief-of-staff", broadened), false);

  const mismatchedSession = structuredClone(cases.get("work-chief-of-staff").fixture);
  mismatchedSession.results[0].workerSessionRef = "agent:unrelated:99";
  assert.equal(isValid("work-chief-of-staff", mismatchedSession), false);

  const droppedBoundary = structuredClone(cases.get("work-chief-of-staff").fixture);
  droppedBoundary.results[2].prohibitedActions = ["merge"];
  assert.equal(isValid("work-chief-of-staff", droppedBoundary), false);

  const prematureResult = structuredClone(cases.get("work-chief-of-staff").fixture);
  prematureResult.assignments[0].state = "running";
  prematureResult.assignments[0].resultRef = null;
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", prematureResult).some(
      (finding) => finding.code === "work_result_scope_drift",
    ),
  );

  const duplicateResult = structuredClone(cases.get("work-chief-of-staff").fixture);
  duplicateResult.results.push({
    ...structuredClone(duplicateResult.results[0]),
    id: "result-product-duplicate",
  });
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", duplicateResult).some(
      (finding) => finding.code === "work_result_scope_drift",
    ),
  );

  const futureResult = structuredClone(cases.get("work-chief-of-staff").fixture);
  futureResult.results[0].producedAt = "2027-08-21T18:00:00Z";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", futureResult).some(
      (finding) => finding.code === "work_result_scope_drift",
    ),
  );
});

test("work chief of staff exposes portfolio conflicts instead of false alignment", () => {
  const hiddenCapacity = structuredClone(cases.get("work-chief-of-staff").fixture);
  hiddenCapacity.conflicts = hiddenCapacity.conflicts.filter(
    (item) => item.id !== "conflict-engineering-capacity",
  );
  assert.equal(isValid("work-chief-of-staff", hiddenCapacity), false);

  const falseReady = structuredClone(cases.get("work-chief-of-staff").fixture);
  const release = falseReady.workstreams.find(
    (item) => item.id === "workstream-release",
  );
  release.state = "ready";
  release.blockedReasons = [];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", falseReady).some(
      (finding) => finding.code === "unsafe_workstream",
    ),
  );

  const authorityConflictReady = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  const product = authorityConflictReady.workstreams.find(
    (item) => item.id === "workstream-product",
  );
  product.state = "ready";
  product.blockedReasons = [];
  assert.ok(
    validateArtifactSemantics(
      "work-chief-of-staff",
      authorityConflictReady,
    ).some((finding) => finding.code === "unsafe_workstream"),
  );

  const declaredCapacityConflict = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  declaredCapacityConflict.capacityEnvelopes.find(
    (item) => item.id === "capacity-engineering",
  ).amount = 30;
  const platform = declaredCapacityConflict.workstreams.find(
    (item) => item.id === "workstream-platform",
  );
  platform.state = "ready";
  platform.blockedReasons = [];
  assert.ok(
    validateArtifactSemantics(
      "work-chief-of-staff",
      declaredCapacityConflict,
    ).some((finding) => finding.code === "unsafe_workstream"),
  );

  const falseHandoff = structuredClone(cases.get("work-chief-of-staff").fixture);
  falseHandoff.handoff.state = "ready-for-leadership";
  assert.equal(isValid("work-chief-of-staff", falseHandoff), false);

  const missingDecisionOwner = structuredClone(cases.get("work-chief-of-staff").fixture);
  missingDecisionOwner.decisionForums[1].requiredPrincipalRefs =
    missingDecisionOwner.decisionForums[1].requiredPrincipalRefs.filter(
      (reference) => reference !== "principal-engineering",
    );
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", missingDecisionOwner).some(
      (finding) => finding.code === "incoherent_decision_forum",
    ),
  );

  const missingConflictPrincipal = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  const capacityConflict = missingConflictPrincipal.conflicts.find(
    (item) => item.id === "conflict-engineering-capacity",
  );
  capacityConflict.requiredDecisionRefs =
    capacityConflict.requiredDecisionRefs.filter(
      (reference) => reference !== "principal-product",
    );
  assert.ok(
    validateArtifactSemantics(
      "work-chief-of-staff",
      missingConflictPrincipal,
    ).some((finding) => finding.code === "incoherent_work_conflict"),
  );
});

test("work chief of staff keeps leadership and restricted views separate", () => {
  const restrictedLeak = structuredClone(cases.get("work-chief-of-staff").fixture);
  restrictedLeak.views[0].sourceArtifactRefs.push("artifact-finance");
  assert.equal(isValid("work-chief-of-staff", restrictedLeak), false);

  const unauthorizedScope = structuredClone(cases.get("work-chief-of-staff").fixture);
  const engineering = unauthorizedScope.principals.find(
    (principal) => principal.id === "principal-engineering",
  );
  engineering.confidentialityScopes = engineering.confidentialityScopes.filter(
    (scope) => scope !== "finance-confidential",
  );
  unauthorizedScope.sourceArtifacts
    .find((artifact) => artifact.id === "artifact-finance")
    .permittedPrincipalRefs.push("principal-engineering");
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", unauthorizedScope).some(
      (finding) => finding.code === "unsupported_work_source_artifact",
    ),
  );

  const derivedLeak = structuredClone(cases.get("work-chief-of-staff").fixture);
  derivedLeak.views
    .find((view) => view.id === "view-engineering")
    .workstreamRefs.push("workstream-recruiting");
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", derivedLeak).some(
      (finding) => finding.code === "work_portfolio_view_confidentiality_leak",
    ),
  );

  const missingPrivateView = structuredClone(cases.get("work-chief-of-staff").fixture);
  missingPrivateView.views = missingPrivateView.views.filter(
    (view) => view.id !== "view-finance",
  );
  assert.equal(isValid("work-chief-of-staff", missingPrivateView), false);
});

test("work chief of staff blocks commitments over unresolved portfolio state", () => {
  const blockedCommitment = structuredClone(cases.get("work-chief-of-staff").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(blockedCommitment.commitment.plan))
    .digest("hex")}`;
  blockedCommitment.commitment.state = "approved";
  blockedCommitment.commitment.approvals = [
    {
      principalRef: "principal-ceo",
      planDigest,
      approvedAt: "2026-08-21T17:30:00Z",
    },
    {
      principalRef: "principal-product",
      planDigest,
      approvedAt: "2026-08-21T17:31:00Z",
    },
  ];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", blockedCommitment).some(
      (finding) => finding.code === "work_commitment_approval_mismatch",
    ),
  );

  const agentConfigured = structuredClone(blockedCommitment);
  agentConfigured.commitment.state = "completed";
  agentConfigured.evidence.push(
    {
      id: "ev-integration",
      type: "integration-approval",
      authority: "approved-integration",
      capturedAt: "2026-08-21T17:20:00Z",
      reference: "controlled://integrations/roadmap-system",
    },
    {
      id: "ev-receipt",
      type: "system-receipt",
      authority: "controlled-system",
      capturedAt: "2026-08-21T17:40:00Z",
      reference: "system://roadmap-system/commitment-1",
    },
  );
  agentConfigured.commitment.integration = {
    id: "approved-integration-roadmap",
    systemRef: "roadmap-system",
    approvalRef: "controlled://integrations/roadmap-system",
    approvalEvidenceRef: "ev-integration",
    configuredByRef: "work-chief-of-staff",
  };
  agentConfigured.commitment.receipt = {
    planDigest,
    integrationId: "approved-integration-roadmap",
    systemRef: "roadmap-system",
    confirmationRef: "system://roadmap-system/commitment-1",
    evidenceRef: "ev-receipt",
    completedAt: "2026-08-21T17:40:00Z",
  };
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", agentConfigured).some(
      (finding) => finding.code === "work_commitment_receipt_mismatch",
    ),
  );

  const retroactiveApproval = structuredClone(agentConfigured);
  retroactiveApproval.commitment.integration.configuredByRef = "principal-product";
  for (const approval of retroactiveApproval.commitment.approvals) {
    approval.approvedAt = "2026-08-22T17:30:00Z";
  }
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", retroactiveApproval).some(
      (finding) => finding.code === "work_commitment_receipt_mismatch",
    ),
  );

  const unauthorizedSpend = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  unauthorizedSpend.commitment.plan.actionType = "approve-spend";
  unauthorizedSpend.commitment.plan.affectedPrincipalRefs = [
    "principal-product",
  ];
  unauthorizedSpend.approvalPolicies[0].actionTypes = ["approve-spend"];
  unauthorizedSpend.approvalPolicies[0].requiredPrincipalRefs = [
    "principal-product",
  ];
  const unauthorizedSpendDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(unauthorizedSpend.commitment.plan))
    .digest("hex")}`;
  unauthorizedSpend.commitment.state = "approved";
  unauthorizedSpend.commitment.approvals = [
    {
      principalRef: "principal-product",
      planDigest: unauthorizedSpendDigest,
      approvedAt: "2026-08-21T17:30:00Z",
    },
  ];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", unauthorizedSpend).some(
      (finding) => finding.code === "work_commitment_approval_mismatch",
    ),
  );

  const prematureReceipt = structuredClone(agentConfigured);
  prematureReceipt.commitment.integration.configuredByRef = "principal-product";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", prematureReceipt).some(
      (finding) => finding.code === "work_commitment_receipt_mismatch",
    ),
  );
});

test("work chief of staff supports every advertised leadership source", () => {
  for (const clawId of ["delegation-coordinator", "meeting-intelligence"]) {
    const candidate = structuredClone(cases.get("work-chief-of-staff").fixture);
    candidate.sourceArtifacts[0].clawId = clawId;
    assert.equal(isValid("work-chief-of-staff", candidate), true, clawId);
  }
});

test("work chief of staff preserves truthful decision forum chronology", () => {
  const completed = structuredClone(cases.get("work-chief-of-staff").fixture);
  completed.decisionForums[0].state = "completed";
  completed.decisionForums[0].startsAt = "2026-08-20T17:00:00Z";
  assert.equal(isValid("work-chief-of-staff", completed), true);

  completed.decisionForums[0].startsAt = "2026-08-22T17:00:00Z";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", completed).some(
      (finding) => finding.code === "incoherent_decision_forum",
    ),
  );

  const omitted = structuredClone(cases.get("work-chief-of-staff").fixture);
  omitted.decisionForums[1].workstreamRefs =
    omitted.decisionForums[1].workstreamRefs.filter(
      (reference) => reference !== "workstream-release",
    );
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", omitted).some(
      (finding) => finding.code === "incoherent_decision_forum",
    ),
  );
});

test("work chief of staff binds evidence and capacity to the portfolio period", () => {
  const futureEvidence = structuredClone(cases.get("work-chief-of-staff").fixture);
  futureEvidence.evidence[0].capturedAt = "2027-08-21T15:00:00Z";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", futureEvidence).some(
      (finding) => finding.code === "future_work_evidence",
    ),
  );

  const unrelatedCapacity = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  const engineering = unrelatedCapacity.capacityEnvelopes.find(
    (item) => item.id === "capacity-engineering",
  );
  engineering.periodStart = "2027-09-01";
  engineering.periodEnd = "2027-09-30";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", unrelatedCapacity).some(
      (finding) => finding.code === "unsafe_workstream",
    ),
  );

  const unauthorizedCapacity = structuredClone(
    cases.get("work-chief-of-staff").fixture,
  );
  const unauthorizedEngineering = unauthorizedCapacity.capacityEnvelopes.find(
    (item) => item.id === "capacity-engineering",
  );
  unauthorizedEngineering.approverRefs = ["principal-product"];
  unauthorizedEngineering.evidenceRefs = ["ev-product"];
  assert.ok(
    validateArtifactSemantics(
      "work-chief-of-staff",
      unauthorizedCapacity,
    ).some((finding) => finding.code === "invalid_capacity_period"),
  );

  const invalidHorizon = structuredClone(cases.get("work-chief-of-staff").fixture);
  invalidHorizon.portfolio.periodStart = "2026-12-01";
  invalidHorizon.portfolio.periodEnd = "2026-09-01";
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", invalidHorizon).some(
      (finding) => finding.code === "invalid_portfolio_period",
    ),
  );

  const futureApproval = structuredClone(cases.get("work-chief-of-staff").fixture);
  const approvalDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(futureApproval.commitment.plan))
    .digest("hex")}`;
  futureApproval.commitment.approvals = [
    {
      principalRef: "principal-ceo",
      planDigest: approvalDigest,
      approvedAt: "2027-08-21T18:00:00Z",
    },
  ];
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", futureApproval).some(
      (finding) => finding.code === "work_commitment_approval_mismatch",
    ),
  );

  const falseCompletion = structuredClone(cases.get("work-chief-of-staff").fixture);
  const productWorkstream = falseCompletion.workstreams.find(
    (item) => item.id === "workstream-product",
  );
  productWorkstream.state = "completed";
  productWorkstream.blockedReasons = [];
  falseCompletion.conflicts = falseCompletion.conflicts.filter(
    (item) => !item.workstreamRefs.includes(productWorkstream.id),
  );
  assert.ok(
    validateArtifactSemantics("work-chief-of-staff", falseCompletion).some(
      (finding) => finding.code === "unsafe_workstream",
    ),
  );
});

test("home repair rejects hazardous or unauthorized owner work", () => {
  const ownerLabels = structuredClone(cases.get("home-repair-coordinator").fixture);
  ownerLabels.home.reference = "primary-home";
  ownerLabels.home.locationLabel = "upstairs-hallway";
  assert.equal(isValid("home-repair-coordinator", ownerLabels), true);

  const hazardous = structuredClone(cases.get("home-repair-coordinator").fixture);
  hazardous.hazardAssessment.level = "high";
  hazardous.hazardAssessment.hazards = ["gas"];
  hazardous.hazardAssessment.action = "bounded-owner-check";
  assert.equal(isValid("home-repair-coordinator", hazardous), false);

  const hazardousInstructions = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  hazardousInstructions.hazardAssessment.level = "high";
  hazardousInstructions.hazardAssessment.hazards = ["gas"];
  hazardousInstructions.hazardAssessment.action = "qualified-trade";
  hazardousInstructions.repairPlan.eligibility = "specialist-only";
  assert.equal(isValid("home-repair-coordinator", hazardousInstructions), false);

  const roofInstructions = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  roofInstructions.hazardAssessment.level = "high";
  roofInstructions.hazardAssessment.hazards = ["roof"];
  roofInstructions.hazardAssessment.action = "qualified-trade";
  roofInstructions.repairPlan.eligibility = "specialist-only";
  assert.equal(isValid("home-repair-coordinator", roofInstructions), false);

  const inconsistentHazardLevel = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  inconsistentHazardLevel.hazardAssessment.level = "high";
  assert.equal(isValid("home-repair-coordinator", inconsistentHazardLevel), false);

  const unauthorized = structuredClone(cases.get("home-repair-coordinator").fixture);
  unauthorized.home.workAuthority = "landlord-required";
  assert.equal(isValid("home-repair-coordinator", unauthorized), false);

  const unisolated = structuredClone(cases.get("home-repair-coordinator").fixture);
  unisolated.isolations[0].state = "unknown";
  assert.equal(isValid("home-repair-coordinator", unisolated), false);

  const missingIsolation = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  missingIsolation.isolations = [];
  assert.equal(isValid("home-repair-coordinator", missingIsolation), false);

  const unsupportedIsolation = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedIsolation.isolations[0].evidenceRefs = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedIsolation), false);
});

test("home repair binds instructions, verification, and resident authority", () => {
  const unsupportedStep = structuredClone(cases.get("home-repair-coordinator").fixture);
  unsupportedStep.repairPlan.steps[0].evidenceRefs = ["ev-report"];
  unsupportedStep.repairPlan.hypotheses = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedStep), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedDiagnosis.repairPlan.hypotheses[0].status = "specialist-confirmed";
  unsupportedDiagnosis.evidence[0].authority = "qualified-specialist";
  assert.equal(isValid("home-repair-coordinator", unsupportedDiagnosis), false);

  const unsupportedVerification = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedVerification.verification.state = "passed";
  unsupportedVerification.verification.evidenceRefs = ["ev-manual"];
  unsupportedVerification.verification.unresolvedConditions = [];
  assert.equal(isValid("home-repair-coordinator", unsupportedVerification), false);

  const unboundStep = structuredClone(cases.get("home-repair-coordinator").fixture);
  unboundStep.repairPlan.steps[0].observationRefs = ["obs-missing"];
  assert.equal(isValid("home-repair-coordinator", unboundStep), false);

  const missingHypothesis = structuredClone(cases.get("home-repair-coordinator").fixture);
  missingHypothesis.repairPlan.hypotheses = [];
  missingHypothesis.repairPlan.steps = [];
  assert.equal(isValid("home-repair-coordinator", missingHypothesis), false);

  const agentOwned = structuredClone(cases.get("home-repair-coordinator").fixture);
  agentOwned.resident.id = "home-repair-coordinator";
  agentOwned.handoff.resident.id = "home-repair-coordinator";
  assert.equal(isValid("home-repair-coordinator", agentOwned), false);
});

test("home repair rejects address leakage and unapproved appointments", () => {
  const addressLeak = structuredClone(cases.get("home-repair-coordinator").fixture);
  addressLeak.observations[0].description += " Service address: 123 Main Street.";
  assert.equal(isValid("home-repair-coordinator", addressLeak), false);

  const terraceLeak = structuredClone(cases.get("home-repair-coordinator").fixture);
  terraceLeak.observations[0].description += " Service address: 742 Evergreen Terrace.";
  assert.equal(isValid("home-repair-coordinator", terraceLeak), false);

  const alphanumericAddressLeak = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  alphanumericAddressLeak.observations[0].description +=
    " Service address: 123A Main Street.";
  assert.equal(isValid("home-repair-coordinator", alphanumericAddressLeak), false);

  const sluggedAddressLeak = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  sluggedAddressLeak.home.reference = "home-123-main-st";
  assert.equal(isValid("home-repair-coordinator", sluggedAddressLeak), false);

  const invalidProvider = structuredClone(cases.get("home-repair-coordinator").fixture);
  invalidProvider.appointment.plan.trade = "electrician";
  assert.equal(isValid("home-repair-coordinator", invalidProvider), false);

  const unsupportedProvider = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-manual";
  assert.equal(isValid("home-repair-coordinator", unsupportedProvider), false);

  unsupportedProvider.appointment = { state: "not-requested" };
  assert.equal(isValid("home-repair-coordinator", unsupportedProvider), false);

  const prematureReceipt = structuredClone(
    cases.get("home-repair-coordinator").fixture,
  );
  prematureReceipt.appointment.bookingIntegration = {
    id: "approved-integration-provider",
    providerRef: "provider-appliance",
    approvalRef: "controlled://home-repair/integration-approval",
    approvalEvidenceRef: "ev-report",
    configuredBy: prematureReceipt.resident,
  };
  prematureReceipt.appointment.receipt = {
    planDigest: `sha256:${"0".repeat(64)}`,
    integrationId: "approved-integration-provider",
    providerRef: "provider-appliance",
    confirmationRef: "provider://provider-appliance/confirmation-early",
    evidenceRef: "ev-provider",
    bookedAt: "2026-08-23T17:00:00Z",
  };
  assert.equal(isValid("home-repair-coordinator", prematureReceipt), false);
});

test("green thumb rejects unsafe or unsupported resident care", () => {
  const hazardous = structuredClone(cases.get("green-thumb-coordinator").fixture);
  hazardous.riskAssessment.level = "high";
  hazardous.riskAssessment.risks = ["regulated-pesticide"];
  hazardous.riskAssessment.action = "qualified-specialist";
  assert.equal(isValid("green-thumb-coordinator", hazardous), false);

  hazardous.carePlan.eligibility = "specialist-only";
  hazardous.carePlan.steps = [];
  hazardous.calendar[0].activity = "Prune the unstable tree limb above the bed.";
  assert.equal(isValid("green-thumb-coordinator", hazardous), false);

  const contradictoryRisk = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  contradictoryRisk.riskAssessment.level = "uncertain";
  contradictoryRisk.carePlan.eligibility = "specialist-only";
  contradictoryRisk.carePlan.steps = [];
  assert.equal(isValid("green-thumb-coordinator", contradictoryRisk), false);

  contradictoryRisk.riskAssessment.level = "high";
  contradictoryRisk.riskAssessment.action = "qualified-specialist";
  contradictoryRisk.calendar[0].executor = "resident";
  assert.equal(isValid("green-thumb-coordinator", contradictoryRisk), false);

  const understatedRisk = structuredClone(cases.get("green-thumb-coordinator").fixture);
  understatedRisk.riskAssessment.risks = ["regulated-pesticide"];
  understatedRisk.carePlan.eligibility = "specialist-only";
  understatedRisk.carePlan.steps = [];
  understatedRisk.calendar[0].executor = "qualified-specialist";
  assert.equal(isValid("green-thumb-coordinator", understatedRisk), false);

  const unauthorized = structuredClone(cases.get("green-thumb-coordinator").fixture);
  unauthorized.site.workAuthority = "landlord-required";
  assert.equal(isValid("green-thumb-coordinator", unauthorized), false);

  const unsupportedProduct = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedProduct.carePlan.steps[0].class = "label-approved-product";
  unsupportedProduct.carePlan.steps[0].productUse = {
    productName: "Restricted pesticide",
    target: "tomato",
    labelRef: "ev-extension",
    localRuleRefs: ["ev-zone"],
    licenseRequired: true,
    applicationLimits: "Unknown",
  };
  assert.equal(isValid("green-thumb-coordinator", unsupportedProduct), false);
});

test("green thumb binds seasonal evidence and monitored outcomes", () => {
  const unsupportedCalendar = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedCalendar.calendar[0].siteEvidenceRefs = ["ev-report"];
  assert.equal(isValid("green-thumb-coordinator", unsupportedCalendar), false);

  const reversedWindow = structuredClone(cases.get("green-thumb-coordinator").fixture);
  reversedWindow.calendar[0].windowEnd = "2026-03-01";
  assert.equal(isValid("green-thumb-coordinator", reversedWindow), false);

  const unsupportedDiagnosis = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedDiagnosis.hypotheses[0].status = "specialist-confirmed";
  assert.equal(isValid("green-thumb-coordinator", unsupportedDiagnosis), false);

  const unsupportedOutcome = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedOutcome.monitoring[0].state = "passed";
  unsupportedOutcome.monitoring[0].evidenceRefs = ["ev-extension"];
  unsupportedOutcome.monitoring[0].observedAt = "2026-03-25T16:00:00Z";
  assert.equal(isValid("green-thumb-coordinator", unsupportedOutcome), false);

  const staleOutcome = structuredClone(cases.get("green-thumb-coordinator").fixture);
  staleOutcome.monitoring[0].state = "passed";
  staleOutcome.monitoring[0].evidenceRefs = ["ev-photo"];
  staleOutcome.monitoring[0].observedAt = "2026-03-18T16:10:00Z";
  assert.equal(isValid("green-thumb-coordinator", staleOutcome), false);

  const unsupportedFailure = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedFailure.monitoring[0].state = "failed";
  assert.equal(isValid("green-thumb-coordinator", unsupportedFailure), false);
});

test("green thumb protects resident and appointment authority", () => {
  const addressLeak = structuredClone(cases.get("green-thumb-coordinator").fixture);
  addressLeak.observations[0].description += " Service address: 742 Evergreen Terrace.";
  assert.equal(isValid("green-thumb-coordinator", addressLeak), false);

  const circleAddressLeak = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  circleAddressLeak.observations[0].description += " Service address: 123 Main Circle.";
  assert.equal(isValid("green-thumb-coordinator", circleAddressLeak), false);

  const unsupportedProvider = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-extension";
  assert.equal(isValid("green-thumb-coordinator", unsupportedProvider), false);

  const invalidSpecialty = structuredClone(
    cases.get("green-thumb-coordinator").fixture,
  );
  invalidSpecialty.appointment.plan.specialty = "certified-arborist";
  assert.equal(isValid("green-thumb-coordinator", invalidSpecialty), false);

  const lateBooking = structuredClone(cases.get("green-thumb-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(lateBooking.appointment.plan))
    .digest("hex")}`;
  lateBooking.evidence.push(
    {
      id: "ev-integration",
      type: "integration-approval",
      authority: "resident-supplied",
      capturedAt: "2026-04-02T16:00:00Z",
      reference: "controlled://green-thumb/integration-approval",
    },
    {
      id: "ev-receipt",
      type: "provider-receipt",
      authority: "service-provider",
      capturedAt: "2026-04-01T16:00:00Z",
      reference: "provider://provider-plant-health/confirmation-1",
    },
  );
  lateBooking.appointment = {
    ...lateBooking.appointment,
    state: "booked",
    approval: {
      resident: lateBooking.resident,
      planDigest,
      approvedAt: "2026-03-20T16:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-plant-health",
      providerRef: "provider-plant-health",
      approvalRef: "controlled://green-thumb/integration-approval",
      approvalEvidenceRef: "ev-integration",
      configuredBy: lateBooking.resident,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-plant-health",
      providerRef: "provider-plant-health",
      confirmationRef: "provider://provider-plant-health/confirmation-1",
      evidenceRef: "ev-receipt",
      bookedAt: "2026-04-01T16:00:00Z",
    },
  };
  assert.equal(isValid("green-thumb-coordinator", lateBooking), false);

  const agentOwned = structuredClone(cases.get("green-thumb-coordinator").fixture);
  agentOwned.resident.id = "green-thumb-coordinator";
  agentOwned.handoff.resident.id = "green-thumb-coordinator";
  assert.equal(isValid("green-thumb-coordinator", agentOwned), false);
});

test("pond coordinator blocks unsafe work and unsupported conclusions", () => {
  const missingPermit = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  const permit = missingPermit.installation.requirements.find(
    (item) => item.category === "permit",
  );
  permit.evidenceRefs = ["ev-report"];
  assert.equal(isValid("pond-water-feature-coordinator", missingPermit), false);

  const unsafeResidentWork = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  unsafeResidentWork.operationsCalendar[0].activity =
    "Excavate beside the pond and rewire the pump.";
  assert.equal(isValid("pond-water-feature-coordinator", unsafeResidentWork), false);

  const unsupportedWater = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  unsupportedWater.waterQuality[0].thresholdRefs = ["ev-report"];
  assert.equal(isValid("pond-water-feature-coordinator", unsupportedWater), false);

  const treatmentOverreach = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  treatmentOverreach.operationsCalendar[0].activity =
    "Medicate the fish and release a new organism.";
  assert.equal(isValid("pond-water-feature-coordinator", treatmentOverreach), false);
});

test("pond coordinator routes habitat and system incidents to owner systems", () => {
  const fishConcern = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  fishConcern.habitat[1].observationState = "concern-observed";
  assert.equal(isValid("pond-water-feature-coordinator", fishConcern), false);

  fishConcern.habitat[1].handoff = "pet-care";
  assert.equal(isValid("pond-water-feature-coordinator", fishConcern), true);

  const wrongFaultOwner = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  wrongFaultOwner.incidents.push({
    id: "incident-pump",
    kind: "equipment-fault",
    state: "open",
    componentRefs: ["component-pump"],
    evidenceRefs: ["ev-report"],
    handoff: "pet-care",
  });
  assert.equal(isValid("pond-water-feature-coordinator", wrongFaultOwner), false);

  wrongFaultOwner.incidents[0].handoff = "home-repair";
  assert.equal(isValid("pond-water-feature-coordinator", wrongFaultOwner), true);
});

test("pond coordinator protects resident privacy and appointment authority", () => {
  const addressLeak = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  addressLeak.observations[0].description += " Service address: 123 Main Street.";
  assert.equal(isValid("pond-water-feature-coordinator", addressLeak), false);

  const unverifiedProvider = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  unverifiedProvider.providers[0].qualificationState = "unverified";
  assert.equal(isValid("pond-water-feature-coordinator", unverifiedProvider), false);

  const unapprovedBooking = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  unapprovedBooking.appointment.state = "booked";
  assert.equal(isValid("pond-water-feature-coordinator", unapprovedBooking), false);

  const driftedApproval = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  driftedApproval.appointment.state = "approved";
  driftedApproval.appointment.approval = {
    resident: driftedApproval.resident,
    planDigest: `sha256:${"0".repeat(64)}`,
    approvedAt: "2026-08-20T18:00:00Z",
  };
  assert.equal(isValid("pond-water-feature-coordinator", driftedApproval), false);

  const agentOwned = structuredClone(
    cases.get("pond-water-feature-coordinator").fixture,
  );
  agentOwned.resident.id = "pond-water-feature-coordinator";
  agentOwned.handoff.resident.id = "pond-water-feature-coordinator";
  assert.equal(isValid("pond-water-feature-coordinator", agentOwned), false);
});

test("pet care rejects unsafe or unsupported guardian care", () => {
  const emergency = structuredClone(cases.get("pet-care-coordinator").fixture);
  emergency.assessment.risks = ["breathing-distress"];
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.assessment.level = "emergency";
  emergency.assessment.action = "emergency-veterinary";
  emergency.careCalendar[0].executor = "veterinarian";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.appointment = {
    state: "blocked",
    blockedReason: "Seek immediate emergency veterinary care.",
  };
  emergency.handoff.state = "blocked";
  emergency.careCalendar = [];
  assert.equal(isValid("pet-care-coordinator", emergency), true);

  emergency.careCalendar = structuredClone(
    cases.get("pet-care-coordinator").fixture.careCalendar,
  );
  emergency.assessment.action = "poison-control";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  emergency.assessment.action = "emergency-veterinary";
  emergency.careCalendar[0].executor = "guardian";
  assert.equal(isValid("pet-care-coordinator", emergency), false);

  const understatedUrgency = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  understatedUrgency.assessment.risks = ["persistent-vomiting"];
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.assessment.risks = ["foreign-body"];
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.assessment.level = "emergency";
  understatedUrgency.assessment.action = "emergency-veterinary";
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  understatedUrgency.appointment = {
    state: "blocked",
    blockedReason: "Seek immediate emergency veterinary care.",
  };
  understatedUrgency.handoff.state = "blocked";
  understatedUrgency.careCalendar[0].executor = "guardian";
  assert.equal(isValid("pet-care-coordinator", understatedUrgency), false);

  const unsupportedMedication = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unsupportedMedication.careCalendar[0].kind = "veterinarian-directed-medication";
  unsupportedMedication.careCalendar[0].instruction =
    "Give a medication using the guardian report.";
  unsupportedMedication.careCalendar[0].evidenceRefs = ["ev-report"];
  assert.equal(isValid("pet-care-coordinator", unsupportedMedication), false);

  const reversedWindow = structuredClone(cases.get("pet-care-coordinator").fixture);
  reversedWindow.careCalendar[0].dueEnd = "2026-08-01T17:00:00Z";
  assert.equal(isValid("pet-care-coordinator", reversedWindow), false);
});

test("pet care binds outcome and provider evidence", () => {
  for (const [type, authority] of [
    ["laboratory-result", "veterinary-laboratory"],
    ["manufacturer-label", "manufacturer"],
    ["government-guidance", "government"],
  ]) {
    const supportedPreventive = structuredClone(
      cases.get("pet-care-coordinator").fixture,
    );
    const record = supportedPreventive.evidence.find((item) => item.id === "ev-record");
    record.type = type;
    record.authority = authority;
    assert.equal(isValid("pet-care-coordinator", supportedPreventive), true);
  }

  const staleOutcome = structuredClone(cases.get("pet-care-coordinator").fixture);
  staleOutcome.monitoring[0].state = "stable";
  staleOutcome.monitoring[0].observedAt = "2026-08-20T19:30:00Z";
  staleOutcome.monitoring[0].evidenceRefs = ["ev-report"];
  assert.equal(isValid("pet-care-coordinator", staleOutcome), false);

  const unsupportedProvider = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unsupportedProvider.providers[0].sourceRef = "ev-record";
  assert.equal(isValid("pet-care-coordinator", unsupportedProvider), false);

  const unverifiedProvider = structuredClone(
    cases.get("pet-care-coordinator").fixture,
  );
  unverifiedProvider.providers[0].qualificationState = "unverified";
  assert.equal(isValid("pet-care-coordinator", unverifiedProvider), false);

  const addressLeak = structuredClone(cases.get("pet-care-coordinator").fixture);
  addressLeak.observations[0].description += " Home address: 123 Main Circle.";
  assert.equal(isValid("pet-care-coordinator", addressLeak), false);
});

test("pet care protects guardian appointment authority", () => {
  const missingBoundary = structuredClone(cases.get("pet-care-coordinator").fixture);
  missingBoundary.handoff.prohibitedActions =
    missingBoundary.handoff.prohibitedActions.filter(
      (action) => action !== "delay-emergency-care",
    );
  assert.equal(isValid("pet-care-coordinator", missingBoundary), false);

  const unexplainedBlock = structuredClone(cases.get("pet-care-coordinator").fixture);
  unexplainedBlock.appointment = { state: "blocked" };
  assert.equal(isValid("pet-care-coordinator", unexplainedBlock), false);

  const unrequestedPlan = structuredClone(cases.get("pet-care-coordinator").fixture);
  unrequestedPlan.appointment.state = "not-requested";
  assert.equal(isValid("pet-care-coordinator", unrequestedPlan), false);

  const driftedApproval = structuredClone(cases.get("pet-care-coordinator").fixture);
  driftedApproval.appointment.state = "approved";
  driftedApproval.appointment.approval = {
    guardian: driftedApproval.guardian,
    planDigest: `sha256:${"0".repeat(64)}`,
    approvedAt: "2026-08-20T16:00:00Z",
  };
  assert.equal(isValid("pet-care-coordinator", driftedApproval), false);

  const lateBooking = structuredClone(cases.get("pet-care-coordinator").fixture);
  const planDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(lateBooking.appointment.plan))
    .digest("hex")}`;
  lateBooking.evidence.push(
    {
      id: "ev-integration",
      type: "integration-approval",
      authority: "guardian-supplied",
      capturedAt: "2026-08-20T16:00:00Z",
      reference: "controlled://pet-care/integration-approval",
    },
    {
      id: "ev-receipt",
      type: "provider-receipt",
      authority: "service-provider",
      capturedAt: "2026-08-22T17:00:00Z",
      reference: "provider://provider-general/confirmation-1",
    },
  );
  lateBooking.appointment = {
    ...lateBooking.appointment,
    state: "booked",
    approval: {
      guardian: lateBooking.guardian,
      planDigest,
      approvedAt: "2026-08-20T16:00:00Z",
    },
    bookingIntegration: {
      id: "approved-integration-veterinary",
      providerRef: "provider-general",
      approvalRef: "controlled://pet-care/integration-approval",
      approvalEvidenceRef: "ev-integration",
      configuredBy: lateBooking.guardian,
    },
    receipt: {
      planDigest,
      integrationId: "approved-integration-veterinary",
      providerRef: "provider-general",
      confirmationRef: "provider://provider-general/confirmation-1",
      evidenceRef: "ev-receipt",
      bookedAt: "2026-08-22T17:00:00Z",
    },
  };
  assert.equal(isValid("pet-care-coordinator", lateBooking), false);

  const agentOwned = structuredClone(cases.get("pet-care-coordinator").fixture);
  agentOwned.guardian.id = "pet-care-coordinator";
  agentOwned.handoff.guardian.id = "pet-care-coordinator";
  assert.equal(isValid("pet-care-coordinator", agentOwned), false);
});

test("care circle protects recipient privacy and consent scope", () => {
  const privateLocation = structuredClone(cases.get("care-circle-coordinator").fixture);
  privateLocation.needs[0].description += " Pickup at 123 Main Street.";
  assert.equal(isValid("care-circle-coordinator", privateLocation), false);

  const unapprovedAudience = structuredClone(cases.get("care-circle-coordinator").fixture);
  unapprovedAudience.consentScopes[0].audienceRefs = ["helper-lee"];
  assert.equal(isValid("care-circle-coordinator", unapprovedAudience), false);

  const staleConsent = structuredClone(cases.get("care-circle-coordinator").fixture);
  staleConsent.consentScopes[0].expiresAt = "2026-08-21T14:59:00Z";
  assert.equal(isValid("care-circle-coordinator", staleConsent), false);
});

test("care circle rejects professional-care and helper commitment overreach", () => {
  const unsupportedCare = structuredClone(cases.get("care-circle-coordinator").fixture);
  unsupportedCare.supportTasks[3].helperRef = "helper-aide";
  unsupportedCare.supportTasks[3].scopeRef = "scope-aide";
  unsupportedCare.supportTasks[3].state = "accepted";
  unsupportedCare.commitments.push({
    id: "commitment-symptom",
    taskRef: "task-symptom",
    helperRef: "helper-aide",
    state: "accepted",
    acceptedAt: "2026-08-21T15:40:00Z",
    evidenceRefs: ["ev-aide-availability"],
  });
  assert.equal(isValid("care-circle-coordinator", unsupportedCare), false);

  const unacceptedTask = structuredClone(cases.get("care-circle-coordinator").fixture);
  unacceptedTask.commitments.find((item) => item.id === "commitment-ride").state = "pending";
  unacceptedTask.commitments.find((item) => item.id === "commitment-ride").acceptedAt = null;
  assert.equal(isValid("care-circle-coordinator", unacceptedTask), false);

  const agentOwned = structuredClone(cases.get("care-circle-coordinator").fixture);
  agentOwned.organizer.id = "care-circle-coordinator";
  agentOwned.handoff.organizerRef = "care-circle-coordinator";
  assert.equal(isValid("care-circle-coordinator", agentOwned), false);
});

test("sports team watcher preserves sourced fan facts and blocks wagering content", () => {
  const staleReady = structuredClone(cases.get("sports-team-watcher").fixture);
  staleReady.sources[0].freshness = "stale";
  assert.equal(isValid("sports-team-watcher", staleReady), false);

  const unofficialTeam = structuredClone(cases.get("sports-team-watcher").fixture);
  unofficialTeam.sources[0].authority = "trusted-news-source";
  unofficialTeam.teams[0].sourceRefs = ["src-mlb-schedule"];
  assert.equal(isValid("sports-team-watcher", unofficialTeam), false);

  const scoreBeforeFinal = structuredClone(cases.get("sports-team-watcher").fixture);
  scoreBeforeFinal.games[1].score = "SEA 1, TEX 0";
  assert.equal(isValid("sports-team-watcher", scoreBeforeFinal), false);

  const bettingContent = structuredClone(cases.get("sports-team-watcher").fixture);
  bettingContent.watchItems[0].whyItMatters += " Include the betting spread.";
  assert.equal(isValid("sports-team-watcher", bettingContent), false);
});

test("fantasy sports manager preserves roster evidence and owner authority", () => {
  const staleReady = structuredClone(cases.get("fantasy-sports-manager").fixture);
  staleReady.sources[0].freshness = "stale";
  assert.equal(isValid("fantasy-sports-manager", staleReady), false);

  const staleRule = structuredClone(cases.get("fantasy-sports-manager").fixture);
  staleRule.handoff.state = "blocked";
  staleRule.sources[1].freshness = "stale";
  assert.equal(isValid("fantasy-sports-manager", staleRule), false);

  const lockedLineup = structuredClone(cases.get("fantasy-sports-manager").fixture);
  lockedLineup.lineup[0].lockState = "locked";
  assert.equal(isValid("fantasy-sports-manager", lockedLineup), false);

  const unsupportedProjection = structuredClone(cases.get("fantasy-sports-manager").fixture);
  unsupportedProjection.players[0].projection.sourceRef = null;
  assert.equal(isValid("fantasy-sports-manager", unsupportedProjection), false);

  const closedTrade = structuredClone(cases.get("fantasy-sports-manager").fixture);
  closedTrade.tradeIdeas[0].deadlineState = "closed";
  assert.equal(isValid("fantasy-sports-manager", closedTrade), false);

  const actionAdvice = structuredClone(cases.get("fantasy-sports-manager").fixture);
  actionAdvice.reviewQuestions[0].reason += " Set lineup, claim waiver, and place bet.";
  assert.equal(isValid("fantasy-sports-manager", actionAdvice), false);

  const danglingPlayer = structuredClone(cases.get("fantasy-sports-manager").fixture);
  danglingPlayer.waiverWatch[0].playerRef = "missing-player";
  assert.equal(isValid("fantasy-sports-manager", danglingPlayer), false);

  const agentOwned = structuredClone(cases.get("fantasy-sports-manager").fixture);
  agentOwned.handoff.owner = "fantasy-sports-manager";
  assert.equal(isValid("fantasy-sports-manager", agentOwned), false);
});

test("movie and streaming organizer preserves availability and blocks account actions", () => {
  const stalePick = structuredClone(cases.get("movie-streaming-organizer").fixture);
  stalePick.availability[0].freshness = "stale";
  assert.equal(isValid("movie-streaming-organizer", stalePick), false);

  const rentalPick = structuredClone(cases.get("movie-streaming-organizer").fixture);
  rentalPick.availability[0].accessMode = "rent";
  rentalPick.availability[0].accountConstraint = "requires-rental";
  assert.equal(isValid("movie-streaming-organizer", rentalPick), false);

  const watchedPick = structuredClone(cases.get("movie-streaming-organizer").fixture);
  watchedPick.titles[0].tasteState = "watched";
  assert.equal(isValid("movie-streaming-organizer", watchedPick), false);

  const accountAction = structuredClone(cases.get("movie-streaming-organizer").fixture);
  accountAction.shortlist[0].fitReason += " Rent it if needed.";
  assert.equal(isValid("movie-streaming-organizer", accountAction), false);
});

test("music organizer preserves rights, availability, and account boundaries", () => {
  const staleSource = structuredClone(cases.get("music-organizer").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("music-organizer", staleSource), false);

  const unsupportedService = structuredClone(cases.get("music-organizer").fixture);
  unsupportedService.availability[0].service = "Unapproved Music Service";
  assert.equal(isValid("music-organizer", unsupportedService), false);

  const purchaseRequired = structuredClone(cases.get("music-organizer").fixture);
  purchaseRequired.availability[0].accessMode = "purchase-required";
  purchaseRequired.availability[0].rightsConstraint = "requires-purchase";
  assert.equal(isValid("music-organizer", purchaseRequired), false);

  const skippedPick = structuredClone(cases.get("music-organizer").fixture);
  skippedPick.items[0].tasteState = "skipped";
  assert.equal(isValid("music-organizer", skippedPick), false);

  const publishAction = structuredClone(cases.get("music-organizer").fixture);
  publishAction.playlistPlan[0].fitReason += " Publish the playlist when done.";
  assert.equal(isValid("music-organizer", publishAction), false);
});

test("stock portfolio monitor binds valuations to sources and blocks advice", () => {
  const staleQuote = structuredClone(cases.get("stock-portfolio-monitor").fixture);
  staleQuote.quotes[0].freshness = "stale";
  assert.equal(isValid("stock-portfolio-monitor", staleQuote), false);

  const inferredCostBasis = structuredClone(cases.get("stock-portfolio-monitor").fixture);
  inferredCostBasis.positions[1].costBasis.amount = 1800;
  assert.equal(isValid("stock-portfolio-monitor", inferredCostBasis), false);

  const wrongAllocation = structuredClone(cases.get("stock-portfolio-monitor").fixture);
  wrongAllocation.allocations[0].marketValue = 2100;
  assert.equal(isValid("stock-portfolio-monitor", wrongAllocation), false);

  const advice = structuredClone(cases.get("stock-portfolio-monitor").fixture);
  advice.reviewQuestions[0].question = "Should the owner buy more AAPL this week?";
  assert.equal(isValid("stock-portfolio-monitor", advice), false);
});

test("subscription manager binds renewal evidence and blocks account authority", () => {
  const staleReceipt = structuredClone(cases.get("subscription-manager").fixture);
  staleReceipt.sources[0].freshness = "stale";
  assert.equal(isValid("subscription-manager", staleReceipt), false);

  const bankSource = structuredClone(cases.get("subscription-manager").fixture);
  bankSource.sources[0].kind = "bank-feed";
  bankSource.sources[0].authority = "banking-system";
  assert.equal(isValid("subscription-manager", bankSource), false);

  const inferredAmount = structuredClone(cases.get("subscription-manager").fixture);
  inferredAmount.subscriptions[0].amountState = "missing";
  assert.equal(isValid("subscription-manager", inferredAmount), false);

  const cancellationAdvice = structuredClone(cases.get("subscription-manager").fixture);
  cancellationAdvice.reviewQuestions[0].question = "Should the owner cancel Disney+ now?";
  assert.equal(isValid("subscription-manager", cancellationAdvice), false);
});

test("medical appointment prep preserves clinical boundaries and owner authority", () => {
  const staleReady = structuredClone(cases.get("medical-appointment-prep").fixture);
  staleReady.sources[0].freshness = "stale";
  assert.equal(isValid("medical-appointment-prep", staleReady), false);

  const staleMedication = structuredClone(cases.get("medical-appointment-prep").fixture);
  staleMedication.handoff.state = "draft";
  staleMedication.sources[2].freshness = "stale";
  assert.equal(isValid("medical-appointment-prep", staleMedication), false);

  const clinicalAdvice = structuredClone(cases.get("medical-appointment-prep").fixture);
  clinicalAdvice.reviewQuestions[0].reason += " Diagnose the issue, recommend treatment, and advise dosage.";
  assert.equal(isValid("medical-appointment-prep", clinicalAdvice), false);

  const portalAction = structuredClone(cases.get("medical-appointment-prep").fixture);
  portalAction.logistics[0].note += " Message provider, upload records, pay bills, and file insurance claims.";
  assert.equal(isValid("medical-appointment-prep", portalAction), false);

  const danglingAppointment = structuredClone(cases.get("medical-appointment-prep").fixture);
  danglingAppointment.documents[0].appointmentRefs = ["missing-appointment"];
  assert.equal(isValid("medical-appointment-prep", danglingAppointment), false);

  const agentOwned = structuredClone(cases.get("medical-appointment-prep").fixture);
  agentOwned.handoff.owner = "medical-appointment-prep";
  assert.equal(isValid("medical-appointment-prep", agentOwned), false);
});

test("document renewal tracker preserves official-source limits and owner authority", () => {
  const staleReady = structuredClone(cases.get("document-renewal-tracker").fixture);
  staleReady.sources[0].freshness = "stale";
  assert.equal(isValid("document-renewal-tracker", staleReady), false);

  const staleDocument = structuredClone(cases.get("document-renewal-tracker").fixture);
  staleDocument.handoff.state = "draft";
  staleDocument.sources[1].freshness = "stale";
  assert.equal(isValid("document-renewal-tracker", staleDocument), false);

  const invalidWindow = structuredClone(cases.get("document-renewal-tracker").fixture);
  invalidWindow.renewalWindows[0].dueAt = invalidWindow.renewalWindows[0].opensAt;
  assert.equal(isValid("document-renewal-tracker", invalidWindow), false);

  const actionAdvice = structuredClone(cases.get("document-renewal-tracker").fixture);
  actionAdvice.reviewQuestions[0].reason += " File forms, pay fees, and upload documents.";
  assert.equal(isValid("document-renewal-tracker", actionAdvice), false);

  const eligibilityAdvice = structuredClone(cases.get("document-renewal-tracker").fixture);
  eligibilityAdvice.conflicts[0].reason += " Certify eligibility and provide immigration advice.";
  assert.equal(isValid("document-renewal-tracker", eligibilityAdvice), false);

  const danglingDocument = structuredClone(cases.get("document-renewal-tracker").fixture);
  danglingDocument.materials[0].documentRef = "missing-document";
  assert.equal(isValid("document-renewal-tracker", danglingDocument), false);

  const agentOwned = structuredClone(cases.get("document-renewal-tracker").fixture);
  agentOwned.handoff.owner = "document-renewal-tracker";
  assert.equal(isValid("document-renewal-tracker", agentOwned), false);
});

test("wardrobe organizer preserves wardrobe evidence and body-adjacent authority", () => {
  const staleReady = structuredClone(cases.get("wardrobe-organizer").fixture);
  staleReady.sources[0].freshness = "stale";
  assert.equal(isValid("wardrobe-organizer", staleReady), false);

  const staleFit = structuredClone(cases.get("wardrobe-organizer").fixture);
  staleFit.handoff.state = "draft";
  staleFit.sources[2].freshness = "stale";
  assert.equal(isValid("wardrobe-organizer", staleFit), false);

  const careBlockedOutfit = structuredClone(cases.get("wardrobe-organizer").fixture);
  careBlockedOutfit.outfits[0].itemRefs.push("item-navy-blazer");
  assert.equal(isValid("wardrobe-organizer", careBlockedOutfit), false);

  const actionAdvice = structuredClone(cases.get("wardrobe-organizer").fixture);
  actionAdvice.reviewQuestions[0].reason += " Message cleaner, book service, and share photo.";
  assert.equal(isValid("wardrobe-organizer", actionAdvice), false);

  const bodyInference = structuredClone(cases.get("wardrobe-organizer").fixture);
  bodyInference.gaps[0].reason += " Infer body size and health condition from the closet notes.";
  assert.equal(isValid("wardrobe-organizer", bodyInference), false);

  const danglingItem = structuredClone(cases.get("wardrobe-organizer").fixture);
  danglingItem.careTasks[0].itemRefs = ["missing-item"];
  assert.equal(isValid("wardrobe-organizer", danglingItem), false);

  const agentOwned = structuredClone(cases.get("wardrobe-organizer").fixture);
  agentOwned.handoff.owner = "wardrobe-organizer";
  assert.equal(isValid("wardrobe-organizer", agentOwned), false);
});

test("tax document organizer preserves document evidence and owner authority", () => {
  const staleSource = structuredClone(cases.get("tax-document-organizer").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("tax-document-organizer", staleSource), false);

  const unsupportedIncome = structuredClone(cases.get("tax-document-organizer").fixture);
  unsupportedIncome.evidenceItems[0].sourceRefs = ["src-charity"];
  assert.equal(isValid("tax-document-organizer", unsupportedIncome), false);

  const unsupportedDeadline = structuredClone(cases.get("tax-document-organizer").fixture);
  unsupportedDeadline.deadlines[0].sourceRefs = ["src-w2"];
  assert.equal(isValid("tax-document-organizer", unsupportedDeadline), false);

  const actionAdvice = structuredClone(cases.get("tax-document-organizer").fixture);
  actionAdvice.reviewQuestions[0].reason += " Claim the deduction and file the return.";
  assert.equal(isValid("tax-document-organizer", actionAdvice), false);

  const danglingDocument = structuredClone(cases.get("tax-document-organizer").fixture);
  danglingDocument.evidenceItems[0].documentRef = "missing-document";
  assert.equal(isValid("tax-document-organizer", danglingDocument), false);

  const unsupportedReady = structuredClone(cases.get("tax-document-organizer").fixture);
  unsupportedReady.documents[0].taxYearState = "unknown";
  assert.equal(isValid("tax-document-organizer", unsupportedReady), false);
});

test("purchase researcher preserves source-backed fit and owner authority", () => {
  const staleSource = structuredClone(cases.get("purchase-researcher").fixture);
  staleSource.sources[1].freshness = "stale";
  assert.equal(isValid("purchase-researcher", staleSource), false);

  const unsupportedRecommendation = structuredClone(cases.get("purchase-researcher").fixture);
  unsupportedRecommendation.candidates[0].availability = "unknown";
  assert.equal(isValid("purchase-researcher", unsupportedRecommendation), false);

  const unsupportedPolicy = structuredClone(cases.get("purchase-researcher").fixture);
  unsupportedPolicy.policyNotes[0].sourceRefs = ["src-roborun-review"];
  assert.equal(isValid("purchase-researcher", unsupportedPolicy), false);

  const unsupportedClaim = structuredClone(cases.get("purchase-researcher").fixture);
  unsupportedClaim.claims[0].sourceRefs = ["src-roborun-review"];
  assert.equal(isValid("purchase-researcher", unsupportedClaim), false);

  const actionAdvice = structuredClone(cases.get("purchase-researcher").fixture);
  actionAdvice.reviewQuestions[0].reason += " Add it to cart and buy now.";
  assert.equal(isValid("purchase-researcher", actionAdvice), false);

  const danglingCandidate = structuredClone(cases.get("purchase-researcher").fixture);
  danglingCandidate.claims[0].candidateRef = "missing-candidate";
  assert.equal(isValid("purchase-researcher", danglingCandidate), false);

  const agentOwned = structuredClone(cases.get("purchase-researcher").fixture);
  agentOwned.handoff.owner = "purchase-researcher";
  assert.equal(isValid("purchase-researcher", agentOwned), false);
});

test("household budget steward preserves supplied evidence and owner authority", () => {
  const staleSource = structuredClone(cases.get("household-budget-steward").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("household-budget-steward", staleSource), false);

  const bankSource = structuredClone(cases.get("household-budget-steward").fixture);
  bankSource.sources[0].kind = "bank-feed";
  bankSource.sources[0].authority = "banking-system";
  assert.equal(isValid("household-budget-steward", bankSource), false);

  const inferredBill = structuredClone(cases.get("household-budget-steward").fixture);
  inferredBill.bills[0].amountState = "missing";
  assert.equal(isValid("household-budget-steward", inferredBill), false);

  const wrongVariance = structuredClone(cases.get("household-budget-steward").fixture);
  wrongVariance.variances[1].actual = 650;
  assert.equal(isValid("household-budget-steward", wrongVariance), false);

  const actionAdvice = structuredClone(cases.get("household-budget-steward").fixture);
  actionAdvice.reviewQuestions[0].reason += " You should pay the bill and contact the vendor.";
  assert.equal(isValid("household-budget-steward", actionAdvice), false);

  const danglingRef = structuredClone(cases.get("household-budget-steward").fixture);
  danglingRef.reviewQuestions[0].refs = ["missing-budget-ref"];
  assert.equal(isValid("household-budget-steward", danglingRef), false);

  const agentOwned = structuredClone(cases.get("household-budget-steward").fixture);
  agentOwned.handoff.owner = "household-budget-steward";
  assert.equal(isValid("household-budget-steward", agentOwned), false);
});

test("life timeline keeper preserves chronology, privacy, and owner authority", () => {
  const staleSource = structuredClone(cases.get("life-timeline-keeper").fixture);
  staleSource.sources[0].freshness = "stale";
  assert.equal(isValid("life-timeline-keeper", staleSource), false);

  const unsupportedCertainty = structuredClone(cases.get("life-timeline-keeper").fixture);
  unsupportedCertainty.events[1].sourceRefs = ["src-owner-memory"];
  assert.equal(isValid("life-timeline-keeper", unsupportedCertainty), false);

  const invalidRange = structuredClone(cases.get("life-timeline-keeper").fixture);
  invalidRange.events[0].dateEnd = "2022-07-01";
  assert.equal(isValid("life-timeline-keeper", invalidRange), false);

  const actionAdvice = structuredClone(cases.get("life-timeline-keeper").fixture);
  actionAdvice.reviewQuestions[0].reason += " Share the timeline and tag the people in the album.";
  assert.equal(isValid("life-timeline-keeper", actionAdvice), false);

  const danglingPointer = structuredClone(cases.get("life-timeline-keeper").fixture);
  danglingPointer.events[0].pointerRefs = ["missing-pointer"];
  assert.equal(isValid("life-timeline-keeper", danglingPointer), false);

  const agentOwned = structuredClone(cases.get("life-timeline-keeper").fixture);
  agentOwned.handoff.owner = "life-timeline-keeper";
  assert.equal(isValid("life-timeline-keeper", agentOwned), false);
});

test("capstone profiles expose only their intended runtime dimensions", async () => {
  const manifests = new Map(
    await Promise.all(
      ["change-control-operator", "case-continuity-coordinator", "delegation-coordinator", "household-steward", "work-chief-of-staff"].map(
        async (id) => [id, await readFile(new URL(`../claws/${id}/profiles/openclaw.yml`, import.meta.url), "utf8")],
      ),
    ),
  );
  assert.match(manifests.get("change-control-operator"), /apply_patch/u);
  assert.doesNotMatch(manifests.get("change-control-operator"), /sessions_spawn/u);
  assert.match(manifests.get("delegation-coordinator"), /sessions_spawn/u);
  assert.match(manifests.get("delegation-coordinator"), /agents_wait/u);
  assert.doesNotMatch(manifests.get("delegation-coordinator"), /\n\s+- exec\b/u);
  assert.match(manifests.get("household-steward"), /sessions_spawn/u);
  assert.match(manifests.get("household-steward"), /agents_wait/u);
  assert.doesNotMatch(manifests.get("household-steward"), /\n\s+- exec\b/u);
  assert.match(manifests.get("work-chief-of-staff"), /sessions_spawn/u);
  assert.match(manifests.get("work-chief-of-staff"), /agents_wait/u);
  assert.doesNotMatch(manifests.get("work-chief-of-staff"), /\n\s+- exec\b/u);
  assert.doesNotMatch(manifests.get("case-continuity-coordinator"), /sessions_spawn|exec|process/u);
});
