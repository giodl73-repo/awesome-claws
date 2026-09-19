import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  composePortfolioPlan,
  renderCompositionPlan,
} from "./composition.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const [input, trust, trustPin, expected, proof] = await Promise.all([
  readFile(new URL("composition-input.test.json", fixtureRoot), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("composition-trust.test.json", fixtureRoot), "utf8").then(
    JSON.parse,
  ),
  readFile(
    new URL("composition-trust-pin.test.json", fixtureRoot),
    "utf8",
  ).then(JSON.parse),
  readFile(
    new URL("./expected/composition.expected.json", import.meta.url),
    "utf8",
  ).then(JSON.parse),
  readFile(new URL("./proof/composition-plan.md", import.meta.url), "utf8"),
]);

const result = await composePortfolioPlan(input, trust, trustPin, {
  asOf: "2026-09-17T19:00:00Z",
});
assert.deepEqual(result, expected);
assert.equal(renderCompositionPlan(result), proof);
assert.equal(result.verdict, "IMPROVE_COMPOSE");
assert.equal(result.standaloneCandidateAccepted, false);

process.stdout.write(
  `${JSON.stringify(
    {
      decision: result.verdict,
      confidence: result.confidence,
      standaloneCandidateAccepted: result.standaloneCandidateAccepted,
      classification: result.classification,
      outputPorts: Object.keys(result.ports).sort(),
      ownerImprovements: result.recipe,
      reachableAuthority: result.reachableAuthority,
      authority: result.authority,
    },
    null,
    2,
  )}\n`,
);
