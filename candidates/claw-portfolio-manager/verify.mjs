import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  evaluatePortfolioV2,
  renderPortfolioV2Proof,
} from "./claw-portfolio-manager.mjs";
import { runStrongestComposition } from "./strongest-composition.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const [input, publicTrust, packageTree, expected, proof] = await Promise.all([
  readFile(new URL("manage-v2.input.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("public-trust-v2.test.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("package-tree-v1.test.json", fixtureRoot), "utf8").then(JSON.parse),
  readFile(new URL("./expected/manage-v2.expected.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("./proof/manage-v2-handoff.md", import.meta.url), "utf8"),
]);

const result = await evaluatePortfolioV2(input, {
  asOf: input.run.asOf,
  publicTrust,
  packageTree,
});
assert.deepEqual(result, expected);
assert.equal(renderPortfolioV2Proof(result), proof);

const composition = await runStrongestComposition();
assert.equal(composition.verdict, "NEW");
assert.equal(composition.authoritySafe, true);
assert.equal(composition.candidateSidecarUsed, false);
assert.ok(composition.losses.length > 0);

process.stdout.write(
  `${JSON.stringify(
    {
      candidate: "claw-portfolio-manager",
      schemaVersion: result.schemaVersion,
      resultStatus: result.resultStatus,
      resultDigest: result.resultDigest,
      mode: result.run.mode,
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
      confidence: 0.85,
      typedLosses: composition.losses.map((item) => ({
        id: item.id,
        targetPort: item.targetPort,
        requiredType: item.requiredType,
      })),
      reachableAuthority: composition.reachableAuthority,
      publicMutation: false,
    },
    null,
    2,
  )}\n`,
);
