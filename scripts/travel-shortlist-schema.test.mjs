import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/travel-concierge/schemas/travel-shortlist.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const validShortlist = JSON.parse(
  await readFile(
    new URL(
      "../claws/travel-concierge/fixtures/travel-shortlist.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function clone(value) {
  return structuredClone(value);
}

function isValid(value) {
  return validate(value) && validateArtifactSemantics("travel-concierge", value).length === 0;
}

test("the Golden travel shortlist accepts the complete sourced fixture", () => {
  assert.equal(validate(validShortlist), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateArtifactSemantics("travel-concierge", validShortlist), []);
});

test("the Golden travel shortlist schema rejects empty, unsafe, and unrelated options", () => {
  assert.equal(validate({ ...validShortlist, options: [] }), false);

  const unknownProvider = clone(validShortlist);
  unknownProvider.options[0].provider = "Unknown provider";
  assert.equal(validate(unknownProvider), false);

  for (const sourceUrl of [
    "javascript:alert(1)",
    "https://example.com/hotel",
    "http://www.expedia.com/hotel",
  ]) {
    const unsafeSource = clone(validShortlist);
    unsafeSource.options[0].sourceUrl = sourceUrl;
    assert.equal(validate(unsafeSource), false);
  }
});

test("travel shortlist semantics preserve chronology, source identity, and currency", () => {
  const invalidChronology = clone(validShortlist);
  invalidChronology.trip.departureDate = "2026-10-20";
  assert.equal(isValid(invalidChronology), false);

  const futureSource = clone(validShortlist);
  futureSource.sources[1].capturedAt = "2026-08-30T18:22:00Z";
  assert.equal(isValid(futureSource), false);

  const futureOffsetSource = clone(validShortlist);
  futureOffsetSource.sources[1].capturedAt = "2026-08-29T14:00:00-05:00";
  assert.equal(isValid(futureOffsetSource), false);

  const futureOption = clone(validShortlist);
  futureOption.options[0].retrievedAt = "2026-08-30T18:22:00Z";
  assert.equal(isValid(futureOption), false);

  const validOffsetOption = clone(validShortlist);
  validOffsetOption.options[0].retrievedAt = "2026-08-29T22:00:00+05:00";
  assert.equal(isValid(validOffsetOption), true);

  const wrongAuthority = clone(validShortlist);
  wrongAuthority.sources[1].authority = "mapbox";
  assert.equal(isValid(wrongAuthority), false);

  const wrongSourceKind = clone(validShortlist);
  wrongSourceKind.options[0].sourceRefs = ["src-expedia-flights"];
  assert.equal(isValid(wrongSourceKind), false);

  const wrongCurrency = clone(validShortlist);
  wrongCurrency.options[0].price.currency = "CAD";
  assert.equal(isValid(wrongCurrency), false);

  const danglingSource = clone(validShortlist);
  danglingSource.options[0].sourceRefs.push("src-missing");
  assert.equal(isValid(danglingSource), false);
});

test("travel shortlist recommendations require current evidence and applicable constraints", () => {
  const staleRecommendation = clone(validShortlist);
  staleRecommendation.sources[1].freshness = "stale";
  assert.equal(isValid(staleRecommendation), false);

  const limitedRecommendation = clone(validShortlist);
  limitedRecommendation.options[0].availabilityState = "limited";
  assert.equal(isValid(limitedRecommendation), false);

  const missingConstraint = clone(validShortlist);
  missingConstraint.options[0].constraintRefs =
    missingConstraint.options[0].constraintRefs.filter(
      (ref) => ref !== "constraint-refundable",
    );
  assert.equal(isValid(missingConstraint), false);

  const nonrefundableRecommendation = clone(validShortlist);
  nonrefundableRecommendation.options[0].cancellationState = "nonrefundable";
  assert.equal(isValid(nonrefundableRecommendation), false);

  const missingBaggage = clone(validShortlist);
  missingBaggage.options[3].baggageSummary = null;
  assert.equal(isValid(missingBaggage), false);

  const lodgingBaggage = clone(validShortlist);
  lodgingBaggage.options[0].baggageSummary = "Not applicable.";
  assert.equal(isValid(lodgingBaggage), false);
});

test("travel shortlist handoff preserves complete traveler-owned readiness", () => {
  const missingOption = clone(validShortlist);
  missingOption.handoff.optionRefs.pop();
  assert.equal(isValid(missingOption), false);

  const missingQuestion = clone(validShortlist);
  missingQuestion.handoff.reviewQuestionRefs.pop();
  assert.equal(isValid(missingQuestion), false);

  const noRecommendedFlight = clone(validShortlist);
  noRecommendedFlight.options[3].state = "review-needed";
  assert.equal(isValid(noRecommendedFlight), false);

  const blockedOption = clone(validShortlist);
  blockedOption.options[4].state = "blocked";
  blockedOption.options[4].blockedReason = "Traveler review is required.";
  blockedOption.trip.state = "blocked";
  blockedOption.handoff.state = "blocked";
  blockedOption.handoff.blockingOptionRefs = ["option-evening-nonstop"];
  assert.equal(isValid(blockedOption), true);

  const missingBlocker = clone(blockedOption);
  missingBlocker.handoff.blockingOptionRefs = [];
  assert.equal(isValid(missingBlocker), false);

  const resolvedBlocker = clone(validShortlist);
  resolvedBlocker.trip.state = "blocked";
  resolvedBlocker.handoff.state = "blocked";
  resolvedBlocker.handoff.blockingOptionRefs = ["option-river-north-hotel"];
  assert.equal(isValid(resolvedBlocker), false);

  const ownerMismatch = clone(validShortlist);
  ownerMismatch.handoff.owner = "Another traveler";
  assert.equal(isValid(ownerMismatch), false);

  const agentOwned = clone(validShortlist);
  agentOwned.trip.owner = "Travel concierge";
  agentOwned.handoff.owner = "Travel concierge";
  assert.equal(isValid(agentOwned), false);
});

test("travel shortlist semantics preserve every authority gate", () => {
  for (const action of validShortlist.blockedActions) {
    const missingAuthorityGate = clone(validShortlist);
    missingAuthorityGate.blockedActions =
      missingAuthorityGate.blockedActions.filter((item) => item !== action);
    assert.equal(
      validateArtifactSemantics("travel-concierge", missingAuthorityGate).some(
        (item) => item.code === "missing_authority_gate",
      ),
      true,
      action,
    );
  }

  const delegatedBooking = clone(validShortlist);
  delegatedBooking.reviewQuestions[0].reason =
    "The assistant should book the lower-priced hotel.";
  const findings = validateArtifactSemantics("travel-concierge", delegatedBooking);
  assert.equal(findings.some((item) => item.code === "external_action_content"), true);
  assert.equal(
    findings.some(
      (item) =>
        item.code === "external_action_content" &&
        item.path === "reviewQuestions.0.reason",
    ),
    true,
  );

  const conditionalBooking = clone(validShortlist);
  conditionalBooking.reviewQuestions[0].reason =
    "Once approved, book the lower-priced hotel for Jordan.";
  assert.equal(
    validateArtifactSemantics("travel-concierge", conditionalBooking).some(
      (item) => item.code === "external_action_content",
    ),
    true,
  );

  for (const instruction of [
    "If Jordan approves book the lower-priced hotel today.",
    "Once the traveler confirms please book the hotel for Jordan.",
    "Please go ahead and book the flight for the traveler.",
    "Ask the traveler whether to book the hotel now.",
    "Please proceed with booking the flight now.",
    "Go ahead with reserving the hotel today.",
    "Go ahead and start purchasing this option now.",
    "The assistant is submitting the payment data now.",
    "Contacting the provider directly is fine right now.",
    "The assistant should rebook the cheaper flight for the traveler.",
    "Prebook this room now to lock in the rate for the traveler.",
    "The assistant should repurchase this option for the traveler.",
    "The assistant must not book the flight and reserve the hotel for the traveler.",
    "The assistant must not accept the terms and then book the flight for me.",
    "Traveler must not book this option and reserve the alternate for me instead.",
    "The assistant should not book the flight but reserve the hotel for the traveler.",
  ]) {
    const bypassAttempt = clone(validShortlist);
    bypassAttempt.reviewQuestions[0].reason = instruction;
    assert.equal(
      validateArtifactSemantics("travel-concierge", bypassAttempt).some(
        (item) => item.code === "external_action_content",
      ),
      true,
      instruction,
    );
  }

  const travelerOwnedAction = clone(validShortlist);
  travelerOwnedAction.reviewQuestions[0].reason =
    "The traveler may book personally after verifying the live Expedia terms.";
  assert.equal(isValid(travelerOwnedAction), true);

  for (const benignWord of ["guidebook", "logbook", "phrasebook"]) {
    const benignCaveat = clone(validShortlist);
    benignCaveat.options[0].caveats[0] =
      `Bring the supplied ${benignWord} because connectivity may be limited.`;
    assert.equal(isValid(benignCaveat), true, benignWord);
  }

  const safetyRestriction = clone(validShortlist);
  safetyRestriction.options[0].caveats[0] =
    "The assistant must not book or purchase this option.";
  assert.equal(isValid(safetyRestriction), true);

  for (const restriction of [
    "Don't cancel the reservation without traveler confirmation.",
    "The traveler mustn't book without confirming the price.",
    "Shouldn't book without confirming availability.",
    "The assistant must not book, reserve, or purchase this option.",
    "The assistant will not book this option.",
    "The assistant may not book this option.",
    "The assistant shall not book this option.",
    "The assistant can not book this option.",
    "The assistant don’t book this option.",
  ]) {
    const contractedRestriction = clone(validShortlist);
    contractedRestriction.options[0].caveats[0] = restriction;
    assert.equal(isValid(contractedRestriction), true, restriction);
  }
});
