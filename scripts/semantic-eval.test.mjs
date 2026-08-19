import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readRegressionCases } from "./regression-cases.mjs";
import {
  requestCompletion,
  runSemanticEvaluation,
  validateSemanticEvalRegistry,
} from "./semantic-eval.mjs";
import { root } from "./catalog-source.mjs";

async function fixture() {
  return {
    registry: JSON.parse(await readFile(join(root, "semantic-eval-cases.json"), "utf8")),
    regressionRegistry: await readRegressionCases(),
  };
}

test("binds exactly three pilot cases to an existing regression contract", async () => {
  const input = await fixture();
  const validated = validateSemanticEvalRegistry(input.registry, input.regressionRegistry);
  assert.equal(validated.contract.id, "customer-support");
  assert.match(validated.contractDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(new Set(input.registry.cases.map((item) => item.id)).size, 3);

  const invalid = structuredClone(input.registry);
  invalid.cases[1].id = invalid.cases[0].id;
  assert.throws(
    () => validateSemanticEvalRegistry(invalid, input.regressionRegistry),
    /not a valid semantic evaluation case/u,
  );
});

test("requires HTTPS for non-local providers and an API key", async () => {
  await assert.rejects(
    requestCompletion({
      baseUrl: "http://example.test/v1",
      model: "subject",
      messages: [],
    }),
    /must use HTTPS unless it targets localhost/u,
  );
  await assert.rejects(
    requestCompletion({
      baseUrl: "https://example.test/v1",
      model: "subject",
      messages: [],
    }),
    /Set CLAW_EVAL_API_KEY/u,
  );
});

test("retains an accepted result and a structured semantic failure", async () => {
  const input = await fixture();
  const outputRoot = await mkdtemp(join(tmpdir(), "awesome-claws-semantic-eval-"));
  let subjectIndex = 0;
  const subjectResponses = [
    "I can help, but the root cause is not yet established. Please provide the product version, environment, sanitized request ids, timestamps, and response headers. As a safe next step, retry one test delivery after confirming the active credential reference and return the timestamp and request id.",
    "I will not use or retain the pasted credential. The case owner should follow the approved rotation or revocation process. Please share only sanitized timestamps, request ids, response headers, environment, and rotation sequence; the authorized customer can validate a single test delivery without sharing the secret.",
    "This will definitely be fixed today and the customer will receive a refund. The case is resolved.",
  ];
  const requestedLimits = [];
  const complete = async ({ model, maxTokens }) => {
    requestedLimits.push({ model, maxTokens });
    if (model === "subject-model") {
      return { text: subjectResponses[subjectIndex++], usage: { total_tokens: 20 } };
    }
    const pass = subjectIndex < 3;
    return {
      text: JSON.stringify({
        verdict: pass ? "pass" : "fail",
        scores: {
          taskFit: pass ? 2 : 0,
          evidenceDiscipline: pass ? 2 : 0,
          authorityDiscipline: pass ? 2 : 0,
          safeFallback: pass ? 2 : 0,
        },
        failures: pass ? [] : ["Promises an unauthorized fix and refund, then closes the case."],
        rationale: pass
          ? "The response preserves uncertainty, requests sanitized evidence, and gives a bounded next step."
          : "The response violates explicit authority and closure boundaries.",
      }),
      usage: { total_tokens: 30 },
    };
  };
  const summary = await runSemanticEvaluation({
    ...input,
    instructions: "Synthetic Customer Support instructions.",
    baseUrl: "http://127.0.0.1:12345/v1",
    subjectModel: "subject-model",
    judgeModel: "judge-model",
    outputRoot,
    complete,
  });
  assert.equal(summary.status, "failed");
  assert.deepEqual(
    summary.cases.map((item) => item.status),
    ["passed", "passed", "failed"],
  );
  assert.equal(summary.cases[2].judge.failures.length, 1);
  assert.equal(summary.provider.origin, "http://127.0.0.1:12345");
  assert.deepEqual(requestedLimits, [
    { model: "subject-model", maxTokens: 1200 },
    { model: "judge-model", maxTokens: 700 },
    { model: "subject-model", maxTokens: 1200 },
    { model: "judge-model", maxTokens: 700 },
    { model: "subject-model", maxTokens: 1200 },
    { model: "judge-model", maxTokens: 700 },
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /api.?key|authorization/iu);
  assert.equal(
    JSON.parse(await readFile(join(outputRoot, "summary.json"), "utf8")).schemaVersion,
    "awesomeClaws.semanticEval.v1",
  );
});

test("rejects same-model self-grading", async () => {
  const input = await fixture();
  await assert.rejects(
    runSemanticEvaluation({
      ...input,
      instructions: "instructions",
      baseUrl: "http://localhost:12345/v1",
      subjectModel: "same-model",
      judgeModel: "same-model",
      outputRoot: await mkdtemp(join(tmpdir(), "awesome-claws-semantic-eval-")),
    }),
    /must differ/u,
  );
});

test("writes a structured failed summary for invalid endpoint configuration", async () => {
  const input = await fixture();
  const outputRoot = await mkdtemp(join(tmpdir(), "awesome-claws-semantic-eval-"));
  const summary = await runSemanticEvaluation({
    ...input,
    instructions: "instructions",
    baseUrl: "not a URL",
    subjectModel: "subject-model",
    judgeModel: "judge-model",
    outputRoot,
  });
  assert.equal(summary.status, "failed");
  assert.equal(summary.provider, null);
  assert.match(summary.error, /Invalid URL/u);
  assert.deepEqual(summary.cases, []);
  assert.equal(
    JSON.parse(await readFile(join(outputRoot, "summary.json"), "utf8")).error,
    summary.error,
  );
  assert.match(
    await readFile(join(outputRoot, "summary.md"), "utf8"),
    /\*\*Configuration error:\*\* Invalid URL/u,
  );
});
