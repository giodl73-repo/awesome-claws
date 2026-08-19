import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCompatibilityReport,
  renderCompatibilityReport,
} from "./compatibility-canary.mjs";

const catalog = {
  entries: [
    {
      id: "one",
      name: "One",
      maintenance: {
        status: "active",
        maintainers: ["@owner"],
        lastVerified: "2026-08-19",
      },
    },
    {
      id: "two",
      name: "Two",
      maintenance: {
        status: "needs-help",
        maintainers: ["@owner", "@backup"],
        lastVerified: "2026-08-18",
      },
    },
  ],
};

function passedResult(id) {
  return {
    id,
    status: "lifecycle-passed",
    applicationScenario: { status: "runtime-wiring-passed" },
  };
}

test("reports complete exact-revision compatibility", () => {
  const report = buildCompatibilityReport({
    catalog,
    portfolioSummary: {
      revisions: { openClaw: "abc123" },
      evidenceClaims: { providerLive: false },
      results: [passedResult("one"), passedResult("two")],
    },
    generatedAt: "2026-08-19T12:00:00.000Z",
  });
  assert.equal(report.status, "passed");
  assert.deepEqual(report.counts, {
    total: 2,
    compatible: 2,
    incompatible: 0,
    notRun: 0,
  });
  assert.match(renderCompatibilityReport(report), /2\/2 compatible/u);
});

test("fails closed for incompatible, missing, and unknown results", () => {
  const report = buildCompatibilityReport({
    catalog,
    portfolioSummary: {
      results: [
        {
          id: "one",
          status: "lifecycle-failed",
          applicationScenario: { status: "not-run" },
          failure: {
            phase: "add-preview",
            provisionalOwner: "openclaw-runtime",
            message: "schema drift",
          },
        },
        passedResult("unknown"),
      ],
    },
    execution: { status: 1, summaryError: "Unexpected end of JSON input" },
  });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.counts, {
    total: 2,
    compatible: 0,
    incompatible: 1,
    notRun: 1,
  });
  assert.deepEqual(report.unknownResultIds, ["unknown"]);
  assert.equal(report.execution.summaryError, "Unexpected end of JSON input");
  const markdown = renderCompatibilityReport(report);
  assert.match(markdown, /Unexpected end of JSON input/u);
  assert.match(markdown, /add-preview/u);
});
