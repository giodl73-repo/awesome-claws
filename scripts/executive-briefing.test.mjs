import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/executive-briefing/schemas/executive-briefing-snapshot.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/executive-briefing/fixtures/executive-briefing-snapshot.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const template = await readFile(
  new URL(
    "../sources/executive-briefing/templates/executive-briefing-snapshot.md",
    import.meta.url,
  ),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf(
  "function executiveBriefingSnapshotFindings(",
);
const validatorBody = validatorSource.slice(
  validatorStart,
  validatorSource.indexOf("\nfunction ", validatorStart + 1),
);
const emittedFindingCodes = new Set(
  [...validatorBody.matchAll(/finding\(\s*"([a-z_]+)"/gu)].map(
    (match) => match[1],
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("executive-briefing", value);
const hasFinding = (value, code) =>
  findings(value).some((item) => item.code === code);

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function assertSchemaInvalid(value) {
  assert.equal(validateSchema(value), false);
}

function find(collection, id) {
  return collection.find((item) => item.id === id);
}

function readyForReview() {
  const value = clone();
  const prerequisite = find(
    value.sources,
    "source-travel-risk-appendix",
  );
  prerequisite.accessState = "available";
  prerequisite.observedAt = "2026-08-31T07:21:00-07:00";
  prerequisite.freshness = "current";
  const preparation = find(value.preparationNeeds, "prep-travel-packet");
  preparation.state = "open";
  preparation.conflictRefs = [];
  preparation.blockerRefs = [];
  preparation.task =
    "Corporate Travel Team should provide a review-only transfer option before Dana Whitfield answers the travel-buffer question.";
  const prerequisiteAgenda = find(
    value.agendaItems,
    "agenda-travel-prerequisite",
  );
  prerequisiteAgenda.summary =
    "The quarterly review deck and version-bound travel-risk appendix are available at their authorized document locations.";
  prerequisiteAgenda.conflictRefs = [];
  value.conflicts = value.conflicts.filter(
    (item) => item.id !== "conflict-missing-travel-appendix",
  );
  value.blockers = value.blockers.filter(
    (item) => item.id !== "blocker-missing-travel-appendix",
  );
  value.reviewQuestions = value.reviewQuestions.filter(
    (item) => item.id !== "question-travel-appendix",
  );
  value.handoff.conflictRefs = value.handoff.conflictRefs.filter(
    (id) => id !== "conflict-missing-travel-appendix",
  );
  value.handoff.blockerRefs = [];
  value.handoff.reviewQuestionRefs = value.handoff.reviewQuestionRefs.filter(
    (id) => id !== "question-travel-appendix",
  );
  value.run.status = "ready-for-review";
  value.handoff.state = "ready-for-review";
  return value;
}

test("the executive briefing fixture is schema-valid and semantically honest", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.run.status, "blocked");
  assert.equal(fixture.run.trigger.deliveryMode, "none");
  assert.equal(fixture.delivery.status, "not-delivered");
  assert.ok(
    fixture.meetings.every(
      (item) =>
        item.calendarState === "observed-read-only" &&
        item.attendanceState === "not-observed" &&
        item.invitationResponseState === "not-inferred",
    ),
  );
  assert.ok(
    fixture.preparationNeeds.every(
      (item) =>
        item.assignmentState === "not-assigned" &&
        item.completionState === "not-completed",
    ),
  );
});

test("the template preserves the complete read-only briefing contract", () => {
  for (const heading of [
    "## Run, window, and authority",
    "## Authorized source and freshness ledger",
    "## Agenda and meeting observations",
    "## Decision asks",
    "## Preparation needs",
    "## Conflicts and prerequisites",
    "## Forecasts and weather implications",
    "## Questions, blockers, and honest state",
    "## Classification, delivery, and private handoff",
  ]) {
    assert.ok(template.includes(heading), heading);
  }
});

test("ready-for-review remains representable without delivery or external action", () => {
  const value = readyForReview();
  assertSchemaValid(value);
  assert.deepEqual(findings(value), []);
  assert.equal(value.delivery.mode, "none");
  assert.equal(value.delivery.status, "not-delivered");
  assert.equal(value.run.trigger.session, "isolated");
});

test("run and source chronology, authorization, scope, freshness, and references are enforced", () => {
  const badRun = clone();
  badRun.run.completedAt = "2026-08-31T07:20:00-07:00";
  assert.equal(hasFinding(badRun, "invalid_run_chronology"), true);

  const badZone = clone();
  badZone.run.timeZone = "Mars/Olympus";
  assert.equal(hasFinding(badZone, "invalid_time_zone"), true);

  const futureSource = clone();
  futureSource.sources[0].retrievedAt = "2026-08-31T07:31:00-07:00";
  assert.equal(hasFinding(futureSource, "future_source_evidence"), true);

  const badSourceOrder = clone();
  badSourceOrder.sources[0].observedAt = "2026-08-31T07:21:00-07:00";
  assert.equal(hasFinding(badSourceOrder, "invalid_source_chronology"), true);

  const expiredAuthorization = clone();
  expiredAuthorization.sources[0].authorization.status = "expired";
  assert.equal(
    hasFinding(expiredAuthorization, "invalid_source_authorization"),
    true,
  );

  const broadButWrongScope = clone();
  broadButWrongScope.sources[0].authorization.scopes = ["documents.read"];
  assert.equal(hasFinding(broadButWrongScope, "invalid_source_scope"), true);

  const extraScope = clone();
  extraScope.sources[0].authorization.scopes = [
    "calendar.read",
    "documents.read",
  ];
  assertSchemaValid(extraScope);
  assert.equal(hasFinding(extraScope, "invalid_source_scope"), true);

  const wrongWorkspaceAccount = clone();
  wrongWorkspaceAccount.sources[1].authorization.workspaceAccountId =
    "other.executive@example.com";
  assert.equal(
    hasFinding(wrongWorkspaceAccount, "invalid_workspace_account"),
    true,
  );

  const missingWorkspaceAccount = clone();
  delete missingWorkspaceAccount.sources[2].authorization.workspaceAccountId;
  assertSchemaInvalid(missingWorkspaceAccount);
  assert.equal(
    hasFinding(missingWorkspaceAccount, "invalid_workspace_account"),
    true,
  );

  const workspaceAccountOnWeather = clone();
  workspaceAccountOnWeather.sources[4].authorization.workspaceAccountId =
    "dana.whitfield@example.com";
  assertSchemaInvalid(workspaceAccountOnWeather);
  assert.equal(
    hasFinding(workspaceAccountOnWeather, "invalid_workspace_account"),
    true,
  );

  const missingDocumentVersion = clone();
  missingDocumentVersion.sources[2].sourceVersion = "";
  assertSchemaInvalid(missingDocumentVersion);
  assert.equal(
    hasFinding(missingDocumentVersion, "invalid_source_version"),
    true,
  );

  const versionedCalendar = clone();
  versionedCalendar.sources[0].sourceVersion = "calendar-v1";
  assertSchemaInvalid(versionedCalendar);
  assert.equal(hasFinding(versionedCalendar, "invalid_source_version"), true);

  const weakCutoff = clone();
  weakCutoff.sources[0].freshnessCutoff = "2026-08-30T07:30:00-07:00";
  assert.equal(hasFinding(weakCutoff, "invalid_freshness_cutoff"), true);

  const overstatedFreshness = clone();
  overstatedFreshness.sources[0].observedAt = "2026-08-31T04:00:00-07:00";
  assert.equal(
    hasFinding(overstatedFreshness, "overstated_source_freshness"),
    true,
  );

  const unsafePath = clone();
  unsafePath.sources[0].reference = "../private/calendar.json";
  assert.equal(hasFinding(unsafePath, "unsafe_source_reference"), true);

  const privateUrl = clone();
  privateUrl.sources[4].reference = "https://localhost/forecast";
  assert.equal(hasFinding(privateUrl, "unsafe_source_reference"), true);

  const credentialUrl = clone();
  credentialUrl.sources[4].reference =
    "https://api.weather.gov/forecast?access_token=secret";
  assert.equal(hasFinding(credentialUrl, "unsafe_source_reference"), true);
});

test("material statements require current and relevant evidence with explicit epistemic type", () => {
  const noCurrentEvidence = clone();
  noCurrentEvidence.agendaItems[3].sourceRefs = [
    "source-travel-risk-appendix",
  ];
  assert.equal(
    hasFinding(noCurrentEvidence, "missing_current_evidence"),
    true,
  );

  const irrelevantEvidence = clone();
  irrelevantEvidence.agendaItems[1].sourceRefs = ["source-flagged-mail"];
  assert.equal(
    hasFinding(irrelevantEvidence, "irrelevant_source_evidence"),
    true,
  );

  const blurredStatement = clone();
  blurredStatement.agendaItems[0].statementType = "inferred";
  assert.equal(
    hasFinding(blurredStatement, "unsupported_statement_type"),
    true,
  );
});

test("meetings, decision asks, and preparation needs remain observed and human-owned", () => {
  const inferredAttendance = clone();
  inferredAttendance.meetings[0].attendanceState = "inferred";
  assert.equal(
    hasFinding(inferredAttendance, "unsupported_meeting_observation"),
    true,
  );

  const noCalendarEvidence = clone();
  noCalendarEvidence.meetings[0].sourceRefs = [
    "source-quarterly-review-deck",
  ];
  assert.equal(
    hasFinding(noCalendarEvidence, "unsupported_meeting_observation"),
    true,
  );

  const decidedByBriefing = clone();
  decidedByBriefing.decisionAsks[0].state = "decided";
  decidedByBriefing.decisionAsks[0].decision = "Use a larger buffer.";
  assert.equal(hasFinding(decidedByBriefing, "invalid_decision_ask"), true);

  const claimedAssignment = clone();
  claimedAssignment.preparationNeeds[0].assignmentState = "assigned";
  assert.equal(
    hasFinding(claimedAssignment, "invalid_preparation_need"),
    true,
  );
});

test("conflicts, weather, and source constraints stay linked and honest", () => {
  const falseOverlap = clone();
  falseOverlap.meetings[2].startsAt = "2026-09-01T14:01:00-07:00";
  assert.equal(
    hasFinding(falseOverlap, "unsupported_conflict_evidence"),
    true,
  );

  const oneWayConflict = clone();
  oneWayConflict.meetings[1].conflictRefs = [];
  assert.equal(hasFinding(oneWayConflict, "broken_conflict_link"), true);

  const oneWayAgendaConflict = clone();
  find(
    oneWayAgendaConflict.agendaItems,
    "agenda-travel-prerequisite",
  ).conflictRefs = [];
  assert.equal(hasFinding(oneWayAgendaConflict, "broken_conflict_link"), true);

  const oneWayPreparationConflict = clone();
  find(
    oneWayPreparationConflict.preparationNeeds,
    "prep-travel-packet",
  ).conflictRefs = [];
  assert.equal(
    hasFinding(oneWayPreparationConflict, "broken_conflict_link"),
    true,
  );

  const relabeledMissingConflict = clone();
  find(
    relabeledMissingConflict.conflicts,
    "conflict-missing-travel-appendix",
  ).kind = "source-staleness";
  assert.equal(
    hasFinding(relabeledMissingConflict, "unsupported_conflict_evidence"),
    true,
  );

  const inferredMissingConflict = clone();
  find(
    inferredMissingConflict.conflicts,
    "conflict-missing-travel-appendix",
  ).statementType = "inferred";
  assert.equal(
    hasFinding(inferredMissingConflict, "unsupported_conflict_evidence"),
    true,
  );

  const fakeWeatherConflict = clone();
  const conflict = find(
    fakeWeatherConflict.conflicts,
    "conflict-missing-travel-appendix",
  );
  conflict.kind = "weather-risk";
  conflict.statementType = "recommended";
  conflict.sourceRefs = ["source-seattle-forecast"];
  conflict.weatherImplicationRefs = [];
  assert.equal(
    hasFinding(fakeWeatherConflict, "unsupported_conflict_evidence"),
    true,
  );

  const validStalenessConflict = clone();
  validStalenessConflict.sources.push({
    ...structuredClone(validStalenessConflict.sources[0]),
    id: "source-stale-calendar-copy",
    label: "Stale authorized calendar observation",
    reference: "references/stale-calendar-copy.json",
    observedAt: "2026-08-31T04:30:00-07:00",
    freshness: "stale",
  });
  validStalenessConflict.conflicts.push({
    id: "conflict-calendar-staleness",
    kind: "source-staleness",
    statementType: "observed",
    summary: "The authorized calendar evidence is stale.",
    severity: "high",
    state: "open",
    sourceRefs: ["source-stale-calendar-copy"],
    agendaItemRefs: ["agenda-afternoon-overlap"],
    meetingRefs: [],
    preparationNeedRefs: [],
    weatherImplicationRefs: [],
    classification: "confidential",
    audienceScope: "executive-and-support",
  });
  find(
    validStalenessConflict.agendaItems,
    "agenda-afternoon-overlap",
  ).conflictRefs.push("conflict-calendar-staleness");
  assert.equal(
    hasFinding(validStalenessConflict, "unsupported_conflict_evidence"),
    false,
  );

  const validWeatherConflict = clone();
  validWeatherConflict.conflicts.push({
    id: "conflict-airport-weather",
    kind: "weather-risk",
    statementType: "recommended",
    summary: "The observed forecast supports additional transfer margin.",
    severity: "medium",
    state: "open",
    sourceRefs: ["source-seattle-forecast"],
    agendaItemRefs: [],
    meetingRefs: [],
    preparationNeedRefs: [],
    weatherImplicationRefs: ["weather-airport-transfer"],
    classification: "restricted",
    audienceScope: "executive-only",
  });
  validWeatherConflict.weatherImplications[0].conflictRefs.push(
    "conflict-airport-weather",
  );
  assert.equal(
    hasFinding(validWeatherConflict, "unsupported_conflict_evidence"),
    false,
  );

  const invalidForecast = clone();
  invalidForecast.weatherForecasts[0].validThrough =
    "2026-09-01T05:00:00-07:00";
  assert.equal(
    hasFinding(invalidForecast, "unsupported_weather_forecast"),
    true,
  );

  const relabeledForecastLocation = clone();
  relabeledForecastLocation.weatherForecasts[0].location = {
    id: "new-york-ny-us",
    label: "New York, New York, United States",
    latitude: 40.7128,
    longitude: -74.006,
  };
  assert.equal(
    hasFinding(relabeledForecastLocation, "unsupported_weather_forecast"),
    true,
  );

  const wrongWeatherAuthorization = clone();
  wrongWeatherAuthorization.sources[4].authorization.weatherLocationId =
    "new-york-ny-us";
  assert.equal(
    hasFinding(wrongWeatherAuthorization, "invalid_weather_location_binding"),
    true,
  );

  const outOfForecastWindow = clone();
  outOfForecastWindow.weatherImplications[0].affectedFrom =
    "2026-09-01T12:01:00-07:00";
  outOfForecastWindow.weatherImplications[0].affectedThrough =
    "2026-09-01T13:00:00-07:00";
  assert.equal(
    hasFinding(outOfForecastWindow, "unsupported_weather_implication"),
    true,
  );

  const missesMeetingWindow = clone();
  missesMeetingWindow.weatherImplications[0].meetingRefs = [
    "meeting-leadership-staff",
  ];
  missesMeetingWindow.weatherImplications[0].affectedFrom =
    "2026-09-01T06:00:00-07:00";
  missesMeetingWindow.weatherImplications[0].affectedThrough =
    "2026-09-01T08:00:00-07:00";
  assert.equal(
    hasFinding(missesMeetingWindow, "unsupported_weather_implication"),
    true,
  );

  const guaranteedWeather = clone();
  guaranteedWeather.weatherImplications[0].safetyState =
    "safety-guaranteed";
  guaranteedWeather.weatherImplications[0].summary =
    "The airport transfer will be safe.";
  assert.equal(
    hasFinding(guaranteedWeather, "unsupported_weather_implication"),
    true,
  );

  const downgraded = clone();
  downgraded.agendaItems[0].classification = "confidential";
  assert.equal(
    hasFinding(downgraded, "classification_audience_mismatch"),
    true,
  );
});

test("handoff coverage, blockers, readiness, and private delivery remain exact", () => {
  const incomplete = clone();
  incomplete.handoff.agendaItemRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const missingBlockerCoverage = clone();
  missingBlockerCoverage.blockers[0].objectRefs = [
    "agenda-travel-prerequisite",
  ];
  assert.equal(
    hasFinding(missingBlockerCoverage, "incomplete_blocked_handoff"),
    true,
  );

  const blockedPreparationWithoutOpenBlocker = clone();
  find(
    blockedPreparationWithoutOpenBlocker.blockers,
    "blocker-missing-travel-appendix",
  ).state = "resolved";
  assert.equal(
    hasFinding(
      blockedPreparationWithoutOpenBlocker,
      "invalid_preparation_blocker_link",
    ),
    true,
  );

  const blockerMissingReverseLink = clone();
  find(
    blockerMissingReverseLink.preparationNeeds,
    "prep-travel-packet",
  ).blockerRefs = [];
  assert.equal(
    hasFinding(blockerMissingReverseLink, "invalid_preparation_blocker_link"),
    true,
  );

  const openPreparationWithOpenBlocker = clone();
  find(openPreparationWithOpenBlocker.preparationNeeds, "prep-travel-packet").state =
    "open";
  assert.equal(
    hasFinding(openPreparationWithOpenBlocker, "invalid_preparation_blocker_link"),
    true,
  );

  const premature = clone();
  premature.run.status = "ready-for-review";
  premature.handoff.state = "ready-for-review";
  assert.equal(hasFinding(premature, "premature_review_state"), true);

  const inconsistent = clone();
  inconsistent.handoff.owner = "Executive Office";
  assert.equal(hasFinding(inconsistent, "inconsistent_run_handoff"), true);

  const delivered = clone();
  delivered.run.trigger.deliveryMode = "announce";
  delivered.delivery.mode = "announce";
  delivered.delivery.status = "delivered";
  delivered.handoff.delivery = structuredClone(delivered.delivery);
  assert.equal(hasFinding(delivered, "unsafe_delivery_state"), true);
});

test("authority gates and narrative scanning reject autonomous claims but allow owner questions", () => {
  const agentOwner = clone();
  agentOwner.run.briefingOwner = "Executive Briefing Claw";
  agentOwner.handoff.owner = "Executive Briefing Claw";
  assert.equal(hasFinding(agentOwner, "agent_owned_authority"), true);

  const missingGate = clone();
  missingGate.prohibitedActions.splice(0, 1);
  assert.equal(hasFinding(missingGate, "missing_authority_gate"), true);

  for (const claim of [
    "We sent the travel note after reviewing the flagged mail.",
    "We have already sent the travel note.",
    "We've sent the travel note.",
    "We revised the quarterly review deck.",
    "Dana Whitfield replied to the flagged email.",
    "Dana Whitfield replies to the flagged email.",
    "Dana Whitfield will send the travel note.",
    "The calendar invitation has been accepted.",
    "The assistant will reply to the flagged email before the meeting.",
    "The calendar event was moved to resolve the overlap.",
    "The quarterly review deck has been updated.",
    "The preparation was completed by the briefing.",
  ]) {
    const candidate = clone();
    candidate.agendaItems[0].summary = claim;
    assert.equal(
      hasFinding(candidate, "unauthorized_narrative_action"),
      true,
      claim,
    );
  }

  const ownerDirected = clone();
  ownerDirected.reviewQuestions[1].question =
    "Should Dana Whitfield reply to the travel thread after reviewing the missing appendix?";
  assert.equal(
    hasFinding(ownerDirected, "unauthorized_narrative_action"),
    false,
  );
});

test("classification and audience close transitively through referenced objects", () => {
  const publicQuestion = clone();
  publicQuestion.reviewQuestions[0].sourceRefs = ["source-seattle-forecast"];
  publicQuestion.reviewQuestions[0].classification = "public";
  publicQuestion.reviewQuestions[0].audienceScope = "public";
  assert.equal(
    hasFinding(publicQuestion, "classification_audience_mismatch"),
    true,
  );

  const cyclicQuestion = clone();
  cyclicQuestion.reviewQuestions[0].refs.push("question-afternoon-overlap");
  assert.doesNotThrow(() => findings(cyclicQuestion));
  assert.deepEqual(findings(cyclicQuestion), []);
});

test("every direct executive briefing finding code has focused coverage", () => {
  const exercised = new Set([
    "invalid_run_chronology",
    "invalid_time_zone",
    "future_source_evidence",
    "invalid_source_chronology",
    "invalid_source_authorization",
    "invalid_source_scope",
    "invalid_workspace_account",
    "invalid_source_version",
    "invalid_weather_location_binding",
    "invalid_freshness_cutoff",
    "overstated_source_freshness",
    "unsafe_source_reference",
    "missing_current_evidence",
    "irrelevant_source_evidence",
    "unsupported_statement_type",
    "unsupported_meeting_observation",
    "invalid_decision_ask",
    "invalid_preparation_need",
    "invalid_preparation_blocker_link",
    "unsupported_conflict_evidence",
    "broken_conflict_link",
    "unsupported_weather_forecast",
    "unsupported_weather_implication",
    "classification_audience_mismatch",
    "incomplete_handoff",
    "incomplete_blocked_handoff",
    "premature_review_state",
    "inconsistent_run_handoff",
    "unsafe_delivery_state",
    "agent_owned_authority",
    "missing_authority_gate",
    "unauthorized_narrative_action"
  ]);
  assert.deepEqual(emittedFindingCodes, exercised);
});
