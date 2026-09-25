import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { civicServiceAccessFindings } from "./civic-services-navigator.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/civic-services-navigator/fixtures/service-access.example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../sources/civic-services-navigator/schemas/service-access.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = civicServiceAccessFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings, null, 2));
}

test("accepted service access packet is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(civicServiceAccessFindings(fixture), []);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [null, undefined, true, 7, "route", [], {}, { case: {}, steps: [null] }]) {
    assert.doesNotThrow(() => civicServiceAccessFindings(value));
    assert.ok(civicServiceAccessFindings(value).length > 0);
  }
});

test("case and route indexes exactly cover their bound collections", () => {
  assertFinding(mutate((value) => value.case.routeRefs.pop()), "incomplete_case_index");
  assertFinding(mutate((value) => value.routes[0].criterionRefs.pop()), "incomplete_route_index");
  assertFinding(mutate((value) => value.sources.push({ ...value.sources[0], id: "source-orphan", controlledRef: "official://orphan" })), "orphan_source");
});

test("route jurisdiction must match its administering agency", () => {
  assertFinding(mutate((value) => value.routes[0].jurisdictionRef = "jurisdiction-county"), "cross_jurisdiction_route");
  assertFinding(mutate((value) => value.routes[0].programRevision = "2025-01"), "invalid_program_revision");
  assertFinding(mutate((value) => value.routes[0].feeSourceRef = "source-city-channels"), "invalid_fee_source");
});

test("selected route is unique, preferred, current, and case-bound", () => {
  assertFinding(mutate((value) => value.routes[0].status = "candidate"), "invalid_selected_route");
  assertFinding(mutate((value) => value.case.nextRouteRef = "route-county-transit"), "invalid_next_route");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-program").freshness = "stale"), "invalid_selected_route");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-channels").freshness = "stale"), "invalid_selected_route");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-boundary").freshness = "stale"), "invalid_selected_route");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-agency").freshness = "stale"), "invalid_selected_route");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-owner-location").freshness = "stale"), "invalid_selected_route");
  assertFinding(mutate((value) => value.routes[0].timingWindows[0].closesAt = "2026-09-01T23:59:59-07:00"), "invalid_selected_route");
  const renewed = mutate((value) => {
    value.routes[0].timingWindows[0].closesAt = "2026-09-01T23:59:59-07:00";
    value.routes[0].timingWindows.push({
      label: "Next intake window",
      status: "confirmed",
      opensAt: "2026-10-01T00:00:00-07:00",
      closesAt: "2026-12-31T23:59:59-08:00",
      sourceRef: "source-city-program",
    });
  });
  assert.ok(!civicServiceAccessFindings(renewed).some((row) => row.code === "invalid_selected_route"));
  assertFinding(mutate((value) => value.localityClaims[0].state = "candidate"), "unresolved_selected_jurisdiction");
});

test("criterion evidence is reciprocal and kind-bound", () => {
  assertFinding(mutate((value) => value.criteria[0].evidenceRef = "evidence-city-age"), "invalid_criterion_evidence");
  assertFinding(mutate((value) => value.criteria[2].evidenceRef = "evidence-city-age"), "invalid_criterion_evidence");
  assertFinding(mutate((value) => value.residentEvidence[0].kind = "agency-confirmation"), "invalid_criterion_evidence");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-criteria").revision = "2025-01"), "invalid_criterion_revision");
});

test("resident evidence and official sources cannot cross the case boundary", () => {
  assertFinding(mutate((value) => value.residentEvidence[0].observedAt = "2026-09-25T17:00:01Z"), "invalid_evidence_chronology");
  assertFinding(mutate((value) => value.residentEvidence[0].sourceRef = "source-city-program"), "invalid_evidence_source");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-city-program").authorityRef = "agency-county-mobility"), "invalid_program_revision");
  assertFinding(mutate((value) => value.sources.find((row) => row.id === "source-owner-age").authorityRef = "agency-city-transit"), "invalid_source_authority");
  assertFinding(mutate((value) => {
    value.criteria[0].evidenceState = "agency-confirmed";
    value.residentEvidence[0].kind = "agency-confirmation";
    const source = value.sources.find((row) => row.id === "source-owner-location");
    source.kind = "agency-response";
    source.authorityRef = "agency-county-mobility";
  }), "invalid_evidence_source");
  assertFinding(mutate((value) => {
    const city = value.sources.find((row) => row.id === "source-city-boundary");
    const county = value.sources.find((row) => row.id === "source-county-boundary");
    [city.authorityRef, county.authorityRef] = [county.authorityRef, city.authorityRef];
  }), "invalid_jurisdiction_source");
  assertFinding(mutate((value) => {
    const city = value.sources.find((row) => row.id === "source-city-agency");
    const county = value.sources.find((row) => row.id === "source-county-agency");
    [city.authorityRef, county.authorityRef] = [county.authorityRef, city.authorityRef];
  }), "invalid_agency_source");
});

test("access steps remain ordered, resident-owned, and evidence-bound", () => {
  assertFinding(mutate((value) => value.steps[1].sequence = 4), "invalid_step_sequence");
  assertFinding(mutate((value) => value.steps[1].prerequisiteRefs = ["step-city-initiate"]), "invalid_step_prerequisite");
  assertFinding(mutate((value) => value.steps[2].state = "owner-completed"), "unsupported_external_action_completion");
  assertFinding(mutate((value) => value.steps[0].owner = "agency-city-transit"), "invalid_owner_authority");
  assertFinding(mutate((value) => {
    value.steps[2].state = "owner-completed";
    value.steps[2].sourceRefs.push("source-owner-location");
  }), "unsupported_external_action_completion");
  assertFinding(mutate((value) => value.steps[2].state = "owner-completed"), "incomplete_step_prerequisite");
  assertFinding(mutate((value) => value.steps[0].sourceRefs = ["source-county-program"]), "invalid_step_source");
});

test("materials, timing, and office details are explicit and route-authoritative", () => {
  const missing = mutate((value) => delete value.routes[0].requiredMaterials);
  assert.equal(validateSchema(missing), false);
  assertFinding(mutate((value) => value.routes[0].requiredMaterials[0].sourceRef = "source-county-program"), "invalid_material_source");
  assertFinding(mutate((value) => value.routes[0].timingWindows[0].closesAt = null), "invalid_timing_window");
  assertFinding(mutate((value) => value.routes[0].offices[0].channelRef = "channel-county-online"), "invalid_office_channel");
});

test("agency questions require same-route agency ownership and authoritative answers", () => {
  assertFinding(mutate((value) => value.questions[0].owner = "resident-owner"), "invalid_question_owner");
  assertFinding(mutate((value) => value.questions[0].subjectRef = "channel-city-interpreter"), "invalid_question_subject");
  assertFinding(mutate((value) => {
    value.questions[0].status = "answered";
    value.questions[0].answerSourceRef = "source-city-program";
  }), "invalid_question_answer");
});

test("review exactly preserves conflicts and open questions", () => {
  assertFinding(mutate((value) => value.review.unresolvedQuestionRefs.pop()), "incomplete_question_review");
  assertFinding(mutate((value) => {
    value.localityClaims[1].state = "conflicting";
  }), "incomplete_locality_review");
});

test("resident-ready handoff cannot hide open questions or a missing selected route", () => {
  assertFinding(mutate((value) => value.review.decision = "ready-for-resident-review"), "premature_resident_handoff");
  assertFinding(mutate((value) => value.review.nextOwner = "agency-city-transit"), "invalid_next_owner");
  assertFinding(mutate((value) => {
    value.case.residentOwner = "agent";
    value.review.nextOwner = "agent";
    for (const step of value.steps) step.owner = "agent";
    for (const source of value.sources.filter((row) => row.kind === "resident-record")) source.authorityRef = "agent";
  }), "invalid_owner_authority");
});

test("strict schema forbids adjudication authority and hidden fields", () => {
  const authority = mutate((value) => value.prohibitedActions.eligibilityDetermined = true);
  assert.equal(validateSchema(authority), false);
  const hidden = mutate((value) => value.criteria[0].eligible = true);
  assert.equal(validateSchema(hidden), false);
});
