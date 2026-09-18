import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assessStrongestComposition,
  evaluateClawPortfolio,
  renderPortfolioProof,
} from "./claw-portfolio-manager.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const [input, publicTrust, sourceReceipts, expected, proof] = await Promise.all([
  readFile(new URL("portfolio.input.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("public-trust.test.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("source-receipts.test.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("./expected/portfolio.expected.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("./proof/portfolio-handoff.md", import.meta.url), "utf8"),
]);

const result = await evaluateClawPortfolio(input, {
  asOf: input.run.asOf,
  publicTrust,
  sourceReceipts,
});
assert.deepEqual(result, expected);
assert.equal(renderPortfolioProof(result), proof);

const composition = await assessStrongestComposition({
  input,
  asOf: input.run.asOf,
  publicTrust,
  sourceReceipts,
});
assert.equal(composition.verdict, "NEW");
assert.equal(composition.deleteCandidate, false);

process.stdout.write(
  `${JSON.stringify(
    {
      candidate: "claw-portfolio-manager",
      resultStatus: result.resultStatus,
      resultDigest: result.resultDigest,
      classificationCounts: Object.fromEntries(
        [
          "NEW",
          "IMPROVE",
          "COMPOSE",
          "VARIANT",
          "PRODUCT_DECISION",
          "RETIRE",
          "DUPLICATE",
          "UNSUPPORTED",
        ].map((classification) => [
          classification,
          result.issues.filter((item) => item.classification === classification)
            .length,
        ]),
      ),
      budget: result.budget,
      compositionVerdict: composition.verdict,
      confidence: composition.confidence,
      missingInvariantIds: composition.missingInvariantIds,
      publicMutation: false,
    },
    null,
    2,
  )}\n`,
);
