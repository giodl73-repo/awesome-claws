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
    id: "case-continuity-coordinator",
    schema: "../claws/case-continuity-coordinator/schemas/case-checkpoint.schema.json",
    fixture: "../claws/case-continuity-coordinator/fixtures/case-checkpoint.example.json",
    decisionField: "decision.state",
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
    id: "financial-analyst",
    schema: "../claws/financial-analyst/schemas/financial-scenario.schema.json",
    fixture: "../claws/financial-analyst/fixtures/financial-scenario.example.json",
    decisionField: "decisionState",
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

test("financial analysis rejects dangling source and scenario references", () => {
  const candidate = structuredClone(cases.get("financial-analyst").fixture);
  candidate.assumptions[0].sourceRefs = ["missing-source"];
  assert.equal(isValid("financial-analyst", candidate), false);
  candidate.assumptions[0].sourceRefs = ["actuals-q2"];
  candidate.risks[0].scenarioRefs = ["missing-scenario"];
  assert.equal(isValid("financial-analyst", candidate), false);
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
    ["benefits-open-enrollment-planner", (value) => value.options[0].sourceRefs.push(value.options[0].sourceRefs[0])],
    ["child-activity-manager", (value) => value.activities[0].sourceRefs.push(value.activities[0].sourceRefs[0])],
    ["delegation-coordinator", (value) => value.synthesis.resultRefs.push(value.synthesis.resultRefs[0])],
    ["document-renewal-tracker", (value) => value.documents[0].sourceRefs.push(value.documents[0].sourceRefs[0])],
    ["financial-analyst", (value) => value.risks[0].sourceRefs.push(value.risks[0].sourceRefs[0])],
    ["fantasy-sports-manager", (value) => value.lineup[0].sourceRefs.push(value.lineup[0].sourceRefs[0])],
    ["games-backlog-manager", (value) => value.shortlist[0].constraintRefs.push(value.shortlist[0].constraintRefs[0])],
    ["gift-relationship-manager", (value) => value.shortlist[0].preferenceRefs.push(value.shortlist[0].preferenceRefs[0])],
    ["health-records-binder", (value) => value.records[0].sourceRefs.push(value.records[0].sourceRefs[0])],
    ["household-budget-steward", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["home-inventory-binder", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["insurance-policy-organizer", (value) => value.coverageItems[0].sourceRefs.push(value.coverageItems[0].sourceRefs[0])],
    ["life-timeline-keeper", (value) => value.events[0].sourceRefs.push(value.events[0].sourceRefs[0])],
    ["medical-appointment-prep", (value) => value.appointments[0].sourceRefs.push(value.appointments[0].sourceRefs[0])],
    ["local-events-watcher", (value) => value.watchlist[0].constraintRefs.push(value.watchlist[0].constraintRefs[0])],
    ["meal-grocery-planner", (value) => value.meals[0].constraintRefs.push(value.meals[0].constraintRefs[0])],
    ["model-evaluation-adjudicator", (value) => value.disagreements[0].judgmentRefs.push(value.disagreements[0].judgmentRefs[0])],
    ["movie-streaming-organizer", (value) => value.shortlist[0].preferenceRefs.push(value.shortlist[0].preferenceRefs[0])],
    ["music-organizer", (value) => value.playlistPlan[0].preferenceRefs.push(value.playlistPlan[0].preferenceRefs[0])],
    ["neighborhood-operations-watcher", (value) => value.notices[0].sourceRefs.push(value.notices[0].sourceRefs[0])],
    ["wardrobe-organizer", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["personal-archive-curator", (value) => value.retrievalCues[0].sourceRefs.push(value.retrievalCues[0].sourceRefs[0])],
    ["purchase-researcher", (value) => value.candidates[0].sourceRefs.push(value.candidates[0].sourceRefs[0])],
    ["public-safety-monitor", (value) => value.actions[0].alertRefs.push(value.actions[0].alertRefs[0])],
    ["recruiting-coordinator", (value) => value.communications[0].sessionRefs.push(value.communications[0].sessionRefs[0])],
    ["restaurant-venue-scout", (value) => value.shortlist[0].constraintRefs.push(value.shortlist[0].constraintRefs[0])],
    ["sales-operations", (value) => value.actions[0].dealRefs.push(value.actions[0].dealRefs[0])],
    ["school-coordinator", (value) => value.items[0].sourceRefs.push(value.items[0].sourceRefs[0])],
    ["sports-team-watcher", (value) => value.games[0].sourceRefs.push(value.games[0].sourceRefs[0])],
    ["stock-portfolio-monitor", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["subscription-manager", (value) => value.reviewQuestions[0].sourceRefs.push(value.reviewQuestions[0].sourceRefs[0])],
    ["tax-document-organizer", (value) => value.documents[0].sourceRefs.push(value.documents[0].sourceRefs[0])],
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
