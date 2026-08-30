import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/travel-planner/schemas/itinerary-plan.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/travel-planner/fixtures/itinerary-plan.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("travel-planner", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

test("itinerary plan fixture is a complete public-source traveler handoff", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("itinerary chronology is date-range and timezone safe", () => {
  const outsideTrip = clone();
  outsideTrip.itineraryDays[0].date = "2026-10-11";
  assert.equal(isValid(outsideTrip), false);

  const wrongLocalDay = clone();
  wrongLocalDay.itineraryDays[0].items[0].startAt = "2026-10-12T23:30:00-07:00";
  assert.equal(Date.parse(wrongLocalDay.itineraryDays[0].items[0].startAt) > 0, true);
  assert.equal(
    findings(wrongLocalDay).some((item) => item.code === "itinerary_local_date_mismatch"),
    true,
  );

  const outOfOrder = clone();
  outOfOrder.itineraryDays[1].items.reverse();
  assert.equal(
    findings(outOfOrder).some((item) => item.code === "itinerary_order"),
    true,
  );

  const overlap = clone();
  overlap.itineraryDays[1].items[1].startAt = "2026-10-13T11:30:00+01:00";
  assert.equal(
    findings(overlap).some((item) => item.code === "itinerary_overlap"),
    true,
  );
});

test("itinerary enforces transfer buffers and disruption alternatives", () => {
  const shortTransfer = clone();
  shortTransfer.itineraryDays[0].items[1].transferBufferBeforeMinutes = 10;
  assert.equal(
    findings(shortTransfer).some((item) => item.code === "insufficient_transfer_buffer"),
    true,
  );

  const impossibleBuffer = clone();
  impossibleBuffer.itineraryDays[0].items[1].startAt = "2026-10-12T11:15:00+01:00";
  assert.equal(
    findings(impossibleBuffer).some((item) => item.code === "unrealized_transfer_buffer"),
    true,
  );

  const noAlternative = clone();
  noAlternative.itineraryDays[0].items[1].alternatives = [];
  assert.equal(
    findings(noAlternative).some((item) => item.code === "missing_disruption_alternative"),
    true,
  );
});

test("itinerary rejects dangling references and incoherent source authority", () => {
  const dangling = clone();
  dangling.itineraryDays[0].items[0].placeRef = "place-missing";
  assert.equal(
    findings(dangling).some((item) => item.code === "dangling_reference"),
    true,
  );

  const wrongAuthority = clone();
  wrongAuthority.sources[1].authority = "openstreetmap";
  assert.equal(
    findings(wrongAuthority).some((item) => item.code === "source_authority_mismatch"),
    true,
  );

  const nonTravelerConstraint = clone();
  nonTravelerConstraint.constraints[0].sourceRefs = ["source-portugal-entry"];
  assert.equal(
    findings(nonTravelerConstraint).some(
      (item) => item.code === "constraint_without_traveler_evidence",
    ),
    true,
  );

  const wrongReadinessEvidence = clone();
  wrongReadinessEvidence.readinessChecks.find((item) => item.kind === "health").sourceRefs = [
    "source-openstreetmap",
  ];
  assert.equal(
    findings(wrongReadinessEvidence).some(
      (item) => item.code === "inappropriate_readiness_evidence",
    ),
    true,
  );
});

test("current readiness cannot rely on stale or temporally impossible evidence", () => {
  const stale = clone();
  stale.sources[4].freshness = "stale";
  assert.equal(
    findings(stale).some((item) => item.code === "stale_current_evidence"),
    true,
  );

  const beforeRetrieval = clone();
  beforeRetrieval.readinessChecks[0].verifiedAt = "2026-08-29T23:59:00Z";
  assert.equal(
    findings(beforeRetrieval).some((item) => item.code === "verification_before_retrieval"),
    true,
  );

  const futureOffset = clone();
  futureOffset.sources[0].retrievedAt = "2026-08-29T22:30:00-05:00";
  assert.equal(Date.parse(futureOffset.sources[0].retrievedAt) > Date.parse(fixture.trip.asOf), true);
  assert.equal(
    findings(futureOffset).some((item) => item.code === "future_source_evidence"),
    true,
  );

  const expired = clone();
  expired.sources[1].validThrough = "2026-08-29";
  assert.equal(
    findings(expired).some((item) => item.code === "expired_current_source"),
    true,
  );

  const futureEffective = clone();
  futureEffective.sources[1].effectiveDate = "2026-08-31";
  assert.equal(
    findings(futureEffective).some((item) => item.code === "future_effective_source"),
    true,
  );

  const staleRecheck = clone();
  staleRecheck.readinessChecks[0].recheckDeadline = "2026-08-30T01:30:00Z";
  assert.equal(
    findings(staleRecheck).some((item) => item.code === "stale_recheck_state"),
    true,
  );

  const lateRecheck = clone();
  lateRecheck.readinessChecks[0].recheckDeadline = "2026-10-13T17:00:00Z";
  assert.equal(
    findings(lateRecheck).some((item) => item.code === "late_recheck_deadline"),
    true,
  );

  const localDepartureDay = clone();
  localDepartureDay.trip.timezone = "America/Los_Angeles";
  localDepartureDay.readinessChecks[0].recheckDeadline = "2026-10-12T20:00:00-07:00";
  assert.equal(
    findings(localDepartureDay).some((item) => item.code === "late_recheck_deadline"),
    false,
  );

  const nextLocalDay = clone();
  nextLocalDay.trip.timezone = "Asia/Tokyo";
  nextLocalDay.readinessChecks[0].recheckDeadline = "2026-10-13T00:30:00+09:00";
  assert.equal(
    findings(nextLocalDay).some((item) => item.code === "late_recheck_deadline"),
    true,
  );
});

test("ready plans require current place, alternative, and budget evidence", () => {
  for (const [path, apply] of [
    ["places.0.sourceRefs", (value, id) => { value.places[0].sourceRefs = [id]; }],
    [
      "itineraryItems.1.alternatives.0.sourceRefs",
      (value, id) => { value.itineraryDays[0].items[1].alternatives[0].sourceRefs = [id]; },
    ],
    ["budget.items.0.sourceRefs", (value, id) => { value.budget.items[0].sourceRefs = [id]; }],
  ]) {
    const stale = clone();
    const source = {
      ...structuredClone(stale.sources.find((item) => item.kind === "official-venue")),
      id: `source-stale-${path.split(".")[0]}`,
      freshness: "stale",
    };
    stale.sources.push(source);
    apply(stale, source.id);
    assert.equal(
      findings(stale).some(
        (item) => item.code === "stale_current_evidence" && item.path === path,
      ),
      true,
      path,
    );
  }
});

test("budget ranges, currencies, totals, and owner limit reconcile", () => {
  const inverted = clone();
  inverted.budget.items[0].minimum = 1200;
  assert.equal(
    findings(inverted).some((item) => item.code === "invalid_budget_range"),
    true,
  );

  const currency = clone();
  currency.budget.items[0].currency = "EUR";
  assert.equal(
    findings(currency).some((item) => item.code === "currency_mismatch"),
    true,
  );

  const total = clone();
  total.budget.totalMaximum = 3300;
  assert.equal(
    findings(total).some((item) => item.code === "budget_total_mismatch"),
    true,
  );

  const overBudget = clone();
  overBudget.trip.budgetLimit = 3000;
  assert.equal(
    findings(overBudget).some((item) => item.code === "budget_limit_exceeded"),
    true,
  );
});

test("ready handoff is exhaustive and blocker-aware", () => {
  for (const [field, value] of [
    ["dayRefs", "day-2026-10-16"],
    ["itineraryItemRefs", "item-oceanario"],
    ["budgetItemRefs", "budget-food"],
    ["checkRefs", "check-weather"],
    ["reviewQuestionRefs", "question-pace"],
  ]) {
    const incomplete = clone();
    incomplete.handoff[field] = incomplete.handoff[field].filter((item) => item !== value);
    assert.equal(
      findings(incomplete).some((item) => item.code === "incomplete_handoff"),
      true,
      field,
    );
  }

  const pending = clone();
  pending.readinessChecks[0].status = "pending";
  assert.equal(
    findings(pending).some((item) => item.code === "premature_ready_state"),
    true,
  );

  const openQuestion = clone();
  openQuestion.reviewQuestions[0].status = "open";
  openQuestion.reviewQuestions[0].resolution = null;
  assert.equal(
    findings(openQuestion).some((item) => item.code === "premature_ready_state"),
    true,
  );

  const blocked = clone();
  blocked.trip.state = "blocked";
  blocked.handoff.state = "blocked";
  blocked.itineraryDays[0].items[1].status = "blocked";
  blocked.blockers = [
    {
      id: "blocker-airport-transfer",
      description: "The planned accessible airport transfer is not currently supportable.",
      refs: ["item-airport-hotel-transfer", "check-transit"],
      status: "open",
    },
  ];
  blocked.handoff.blockerRefs = ["blocker-airport-transfer"];
  assert.equal(isValid(blocked), true);

  const missingBlocker = structuredClone(blocked);
  missingBlocker.handoff.blockerRefs = [];
  assert.equal(
    findings(missingBlocker).some((item) => item.code === "incomplete_blocked_handoff"),
    true,
  );
});

test("owner identity remains human and consistent", () => {
  const mismatch = clone();
  mismatch.handoff.owner = "Another traveler";
  assert.equal(findings(mismatch).some((item) => item.code === "owner_mismatch"), true);

  const agentOwned = clone();
  agentOwned.trip.owner = "Travel Planner";
  agentOwned.handoff.owner = "Travel Planner";
  assert.equal(
    findings(agentOwned).some((item) => item.code === "agent_owned_authority"),
    true,
  );
});

test("itinerary plan rejects sensitive traveler values and unsafe references", () => {
  for (const value of [
    "Passport number: X12345678",
    "The traveler passport number is X12345678",
    "Payment card number: 4111111111111111",
    "Loyalty account: ZXCV123456",
    "Health record: asthma diagnosis",
    "Government ID: 123-45-6789",
    "Verification code: 839201",
  ]) {
    const sensitive = clone();
    sensitive.readinessChecks[1].notes = value;
    assert.equal(
      findings(sensitive).some((item) => item.code === "sensitive_value"),
      true,
      value,
    );
  }

  const credentialUrl = clone();
  credentialUrl.sources[1].reference =
    "https://user:secret@travel.example.org/entry";
  assert.equal(
    findings(credentialUrl).some((item) => item.code === "unsafe_source_reference"),
    true,
  );

  const tokenUrl = clone();
  tokenUrl.sources[1].reference =
    "https://travel.example.org/entry?token=secret";
  assert.equal(
    findings(tokenUrl).some((item) => item.code === "unsafe_source_reference"),
    true,
  );

  for (const reference of ["https://172.16.0.1/entry", "https://[::1]/entry"]) {
    const privateUrl = clone();
    privateUrl.sources[1].reference = reference;
    assert.equal(
      findings(privateUrl).some((item) => item.code === "unsafe_source_reference"),
      true,
      reference,
    );
  }
});

test("itinerary plan preserves every authority gate", () => {
  for (const action of fixture.blockedActions) {
    const missing = clone();
    missing.blockedActions = missing.blockedActions.filter((item) => item !== action);
    assert.equal(
      findings(missing).some((item) => item.code === "missing_authority_gate"),
      true,
      action,
    );
  }

  for (const instruction of [
    "The assistant should book the hotel.",
    "Please reserve the museum.",
    "Purchase the tickets now.",
    "The agent must cancel the booking.",
    "Modify the booking after approval.",
    "Check in for the traveler.",
    "Submit the entry form.",
    "Contact the transit provider.",
    "Add this plan to the traveler's calendar.",
    "Send the itinerary message.",
    "Store the passport details.",
    "Submit the payment data.",
    "Store the verification code.",
    "Accept the provider terms.",
    "Guarantee the visa outcome.",
    "Guarantee this medical advice.",
    "Guarantee the legal result.",
    "Guarantee traveler safety.",
    "The assistant should email the hotel.",
  ]) {
    const action = clone();
    action.reviewQuestions[0].reason = instruction;
    assert.equal(
      findings(action).some((item) => item.code === "external_action_content"),
      true,
      instruction,
    );
  }

  const differentOwner = clone();
  differentOwner.trip.owner = "Avery Chen";
  differentOwner.handoff.owner = "Avery Chen";
  differentOwner.reviewQuestions[0].reason = "Avery Chen may book the hotel after final verification.";
  assert.equal(
    findings(differentOwner).some((item) => item.code === "external_action_content"),
    false,
  );

  const nounUse = clone();
  nounUse.reviewQuestions[0].reason = "Booking availability requires traveler verification.";
  assert.equal(
    findings(nounUse).some((item) => item.code === "external_action_content"),
    false,
  );
});
