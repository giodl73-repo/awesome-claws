import assert from "node:assert/strict";
import { test } from "node:test";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import {
  evaluateRegressionRequest,
  readPackageTexts,
  readRegressionCases,
  runRegressionCases,
} from "./regression-cases.mjs";

async function fixture() {
  const catalog = await readCatalog();
  const experienceCases = await readExperienceCases(catalog);
  const registry = await readRegressionCases();
  const packageTexts = await readPackageTexts(catalog);
  return { catalog, experienceCases, registry, packageTexts };
}

test("every Claw passes the deterministic regression contract", async () => {
  const input = await fixture();
  const results = runRegressionCases(input);
  assert.equal(results.length, input.catalog.entries.length);
  assert.equal(
    new Set(results.map((item) => item.id)).size,
    input.catalog.entries.length,
  );
  for (const result of results) {
    assert.deepEqual(result.accepted, { status: "accepted", code: "ready" });
    assert.equal(result.missingEvidence.status, "blocked");
    assert.equal(result.missingEvidence.code, "missing-evidence");
    assert.equal(result.missingEvidence.missing.length, 1);
    assert.equal(result.authorityBoundary.status, "refused");
    assert.equal(result.authorityBoundary.code, "authority-required");
    assert.equal(result.authorityBoundary.boundaries.length, 1);
    assert.match(result.output.output, /^outputs\//u);
    assert.match(result.capabilityDigest, /^sha256:[a-f0-9]{64}$/u);
  }
});

test("focused regression execution preserves global coverage validation", async () => {
  const input = await fixture();
  const results = runRegressionCases({
    ...input,
    onlyIds: ["incident-response"],
  });
  assert.deepEqual(results.map((result) => result.id), ["incident-response"]);
  assert.throws(
    () => runRegressionCases({ ...input, onlyIds: ["unknown-claw"] }),
    /Unknown regression Claw ids/u,
  );
});

test("the reference evaluator changes behavior with evidence and approval", () => {
  const contract = {
    acceptedRequest: "Prepare the release.",
    requiredEvidence: ["checks", "artifacts"],
    authorityBoundaries: ["publish"],
  };
  const base = {
    request: contract.acceptedRequest,
    providedEvidence: ["checks", "artifacts"],
    requestedBoundaries: [],
    approvals: [],
  };
  assert.deepEqual(evaluateRegressionRequest(contract, base), {
    status: "accepted",
    code: "ready",
  });
  assert.deepEqual(
    evaluateRegressionRequest(contract, {
      ...base,
      providedEvidence: ["checks"],
    }),
    {
      status: "blocked",
      code: "missing-evidence",
      missing: ["artifacts"],
    },
  );
  assert.deepEqual(
    evaluateRegressionRequest(contract, {
      ...base,
      requestedBoundaries: ["publish"],
    }),
    {
      status: "refused",
      code: "authority-required",
      boundaries: ["publish"],
    },
  );
  assert.deepEqual(
    evaluateRegressionRequest(contract, {
      ...base,
      requestedBoundaries: ["publish"],
      approvals: ["publish"],
    }),
    { status: "accepted", code: "ready" },
  );
  assert.deepEqual(
    evaluateRegressionRequest(contract, {
      ...base,
      requestedBoundaries: ["undeclared-action"],
    }),
    {
      status: "refused",
      code: "authority-required",
      boundaries: ["undeclared-action"],
    },
  );
});

test("regression coverage rejects missing, duplicate, and unknown Claws", async () => {
  const input = await fixture();
  const missing = structuredClone(input.registry);
  missing.cases.pop();
  assert.throws(
    () => runRegressionCases({ ...input, registry: missing }),
    /must cover every catalog Claw exactly once.*missing:/u,
  );

  const duplicate = structuredClone(input.registry);
  duplicate.cases.push(structuredClone(duplicate.cases[0]));
  assert.throws(
    () => runRegressionCases({ ...input, registry: duplicate }),
    /duplicate Claw id/u,
  );

  const unknown = structuredClone(input.registry);
  unknown.cases[0].id = "unknown-claw";
  assert.throws(
    () => runRegressionCases({ ...input, registry: unknown }),
    /must cover every catalog Claw exactly once.*unknown: unknown-claw/u,
  );
});

test("regression contracts reject missing vectors and exact contract drift", async () => {
  const input = await fixture();
  for (const required of ["missing-evidence", "authority-boundary"]) {
    const registry = structuredClone(input.registry);
    registry.requiredCases = registry.requiredCases.filter((item) => item !== required);
    assert.throws(
      () => runRegressionCases({ ...input, registry }),
      /must contain every required.*regression case/u,
    );
  }

  for (const mutate of [
    (item) => {
      item.acceptedRequest = "Unrelated request";
    },
    (item) => {
      item.requiredEvidence[0] = "Unrelated evidence";
    },
    (item) => {
      item.authorityBoundaries[0] = "Unrelated authority";
    },
    (item) => {
      item.experience.fallback = "outputs/wrong.md";
    },
    (item) => {
      item.experience.asset = "assets/wrong.html";
    },
    (item) => {
      item.capabilityDigest = `sha256:${"0".repeat(64)}`;
    },
  ]) {
    const registry = structuredClone(input.registry);
    const item = registry.cases.find((candidate) => candidate.id === "incident-response");
    mutate(item);
    assert.throws(
      () => runRegressionCases({ ...input, registry }),
      /incident-response regression contract has drifted.*Run npm run test:regression -- --update/u,
    );
  }
});

test("materialized package text must retain exact regression vectors", async () => {
  const input = await fixture();
  const packageTexts = new Map(input.packageTexts);
  packageTexts.set("incident-response", "unrelated instructions");
  assert.throws(
    () => runRegressionCases({ ...input, packageTexts }),
    /incident-response materialized instructions omit regression contract text.*Run npm run build/u,
  );
});

test("any capability-bearing configuration change invalidates the snapshot", async () => {
  const input = await fixture();
  const catalog = structuredClone(input.catalog);
  const incident = catalog.entries.find((entry) => entry.id === "incident-response");
  incident.openclawProfile.agent.tools.alsoAllow.push("message");
  assert.throws(
    () => runRegressionCases({ ...input, catalog }),
    /incident-response regression contract has drifted.*capabilityDigest/u,
  );
});

test("regression vectors reject duplicate evidence and authority entries", async () => {
  const input = await fixture();
  for (const field of ["requiredEvidence", "authorityBoundaries"]) {
    const registry = structuredClone(input.registry);
    const item = registry.cases.find((candidate) => candidate.id === "incident-response");
    item[field][1] = item[field][0];
    assert.throws(
      () => runRegressionCases({ ...input, registry }),
      /incident-response has an invalid regression contract/u,
    );
  }
});

test("accepted-request session fixtures cannot drift from the catalog example", async () => {
  const input = await fixture();
  for (const field of ["scenario", "message"]) {
    const catalog = structuredClone(input.catalog);
    const incident = catalog.entries.find((entry) => entry.id === "incident-response");
    const fixture = incident.resources.find(
      (resource) => resource.path === "fixtures/session-demo.json",
    );
    const session = JSON.parse(fixture.content);
    if (field === "scenario") {
      session.scenario = "Unrelated request";
    } else {
      session.messages[0].text = "Unrelated request";
    }
    fixture.content = `${JSON.stringify(session, null, 2)}\n`;
    assert.throws(
      () => runRegressionCases({ ...input, catalog }),
      /incident-response accepted-request session fixture has drifted/u,
    );
  }
});
