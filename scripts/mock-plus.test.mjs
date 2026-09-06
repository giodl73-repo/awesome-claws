import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { root } from "./catalog-source.mjs";
import {
  MOCK_PLUS_EVIDENCE_CLASS,
  MOCK_PLUS_MODE,
  MOCK_PLUS_VERTICAL_IDS,
  assertCapabilityAdapterCoverage,
  assertLifecycleRegistry,
  assertMockPlusOutputRemoved,
  loadMockPlusContext,
  runBoundedMockPlusCaseGroup,
  runMockPlus,
} from "./mock-plus-lib.mjs";
import { parseMockPlusArgs } from "./mock-plus.mjs";
import { aggregateRuntimeEvidence } from "./runtime-evidence-lib.mjs";

test("inventory derives the current portfolio oracle surface", async () => {
  const { inventory } = await loadMockPlusContext();
  assert.equal(inventory.evidenceClass, MOCK_PLUS_EVIDENCE_CLASS);
  assert.equal(inventory.mode, MOCK_PLUS_MODE);
  assert.equal(inventory.summary.clawCount, 100);
  assert.equal(
    inventory.summary.registeredSchemaCount,
    inventory.entries.filter((entry) => entry.schema.registered).length,
  );
  assert.equal(
    inventory.summary.fixtureResourceClawCount,
    inventory.entries.filter((entry) => entry.fixtureResources.length > 0)
      .length,
  );
  assert.equal(inventory.summary.packagedSchemaCount, 100);
  assert.equal(
    inventory.summary.schemaFixturePairClawCount,
    inventory.entries.filter((entry) =>
      entry.schemaContracts.some((contract) => contract.fixturePath !== null),
    ).length,
  );
  assert.deepEqual(
    inventory.summary.schemaFixtureGapIds,
    inventory.entries
      .filter((entry) =>
        entry.schemaContracts.some((contract) => contract.fixturePath === null),
      )
      .map((entry) => entry.id),
  );

  const byId = new Map(inventory.entries.map((entry) => [entry.id, entry]));
  assert.deepEqual(byId.get("data-analyst").capabilityClasses, ["visual"]);
  assert.deepEqual(byId.get("software-maintainer").capabilityClasses, [
    "profile-extension",
    "oauth-mcp",
    "workspace-execution",
  ]);
});

test("three-Claw vertical kills applicable mutants without false kills", async () => {
  const run = await runMockPlus({ writeOutput: false });
  assert.deepEqual(
    run.results.claws.map((claw) => claw.id),
    MOCK_PLUS_VERTICAL_IDS,
  );
  assert.equal(run.coverage.status, "passed");
  assert.equal(run.coverage.clawCount, 3);
  assert.equal(run.coverage.caseCount, 53);
  assert.equal(run.coverage.counts["control-passed"], 21);
  assert.equal(run.coverage.counts["control-failed"], 0);
  assert.equal(run.coverage.counts.killed, 32);
  assert.equal(run.coverage.counts.survived, 0);
  assert.equal(run.coverage.counts["oracle-error"], 0);
  assert.equal(run.coverage.safety.caseCount, 18);
  assert.equal(run.coverage.safety.independentCount, 12);
  assert.equal(run.coverage.safety.derivedCount, 6);
  assert.equal(run.coverage.safety.blockingCount, 0);
  assert.equal(run.results.evidenceClass, MOCK_PLUS_EVIDENCE_CLASS);
  assert.equal(JSON.stringify(run).includes("MOCKPLUS_CANARY_NONLIVE"), false);
});

test("schema portfolio covers every Claw and active constraint family", async () => {
  const run = await runMockPlus({
    profile: "schema-portfolio",
    writeOutput: false,
  });

  assert.equal(run.coverage.scope, "schema-portfolio");
  assert.equal(run.coverage.status, "passed");
  assert.equal(run.coverage.clawCount, 100);
  assert.equal(run.coverage.counts["control-failed"], 0);
  assert.equal(run.coverage.counts.survived, 0);
  assert.equal(run.coverage.counts["unsupported-oracle"], 0);
  assert.equal(run.coverage.counts["oracle-error"], 0);
  assert.equal(run.coverage.safety.caseCount, 600);
  assert.equal(run.coverage.safety.blockingCount, 0);
  assert.equal(run.coverage.schema.clawCount, 100);
  assert.equal(run.coverage.schema.survivedCount, 0);
  assert.deepEqual(run.coverage.schema.keywordFamilies, [
    "additionalProperties",
    "anyOf",
    "const",
    "enum",
    "exclusiveMinimum",
    "format",
    "maxItems",
    "maxLength",
    "maximum",
    "minItems",
    "minLength",
    "minProperties",
    "minimum",
    "not",
    "oneOf",
    "pattern",
    "required",
    "type",
    "uniqueItems",
  ]);
  for (const coverage of Object.values(run.coverage.schema.perClaw)) {
    assert.equal(coverage.applicable, coverage.killed);
    assert.deepEqual(coverage.uncoveredFamilies, []);
  }
  assert.match(run.outputRoot, /[\\/]mock-plus[\\/]schema-portfolio[\\/]/u);
  for (const keyword of ["oneOf", "anyOf"]) {
    assert.ok(
      run.results.claws
        .flatMap((claw) => claw.cases)
        .some(
          (result) =>
            result.oracle.keyword === keyword &&
            result.oracle.instancePath === "",
        ),
      keyword,
    );
  }
  for (const claw of run.results.claws) {
    assert.ok(
      claw.cases.some(
        (result) =>
          result.family === "accepted-variants" &&
          result.outcome === "control-passed",
      ),
      claw.id,
    );
    assert.ok(
      claw.cases.some(
        (result) => result.family === "schema" && result.outcome === "killed",
      ),
      claw.id,
    );
  }
  const reversed = await runMockPlus({
    profile: "schema-portfolio",
    onlyIds: run.results.claws.map((claw) => claw.id).reverse(),
    writeOutput: false,
  });
  assert.equal(reversed.canonicalDigest, run.canonicalDigest);
  assert.deepEqual(reversed.manifest.claws, run.manifest.claws);
});

test("semantic portfolio covers every registered owner-defined validator", async () => {
  const run = await runMockPlus({
    profile: "semantic-portfolio",
    writeOutput: false,
  });

  assert.equal(run.coverage.scope, "semantic-portfolio");
  assert.equal(run.coverage.status, "passed");
  assert.equal(run.coverage.clawCount, 100);
  assert.equal(run.coverage.counts["control-failed"], 0);
  assert.equal(run.coverage.counts.survived, 0);
  assert.equal(run.coverage.counts["unsupported-oracle"], 0);
  assert.equal(run.coverage.counts["oracle-error"], 0);
  assert.equal(run.coverage.safety.caseCount, 600);
  assert.equal(run.coverage.safety.blockingCount, 0);
  assert.equal(run.coverage.semantics.applicableClawCount, 93);
  assert.equal(run.coverage.semantics.caseCount, 245);
  assert.equal(run.coverage.semantics.killedCount, 245);
  assert.equal(run.coverage.semantics.findingCodeCount, 196);
  assert.equal(Object.keys(run.coverage.semantics.perClaw).length, 93);
  for (const coverage of Object.values(run.coverage.semantics.perClaw)) {
    assert.equal(coverage.applicable, coverage.killed);
    assert.deepEqual(coverage.uncoveredRecipeIds, []);
  }
  assert.match(
    run.outputRoot,
    /[\\/]mock-plus[\\/]semantic-portfolio[\\/]/u,
  );
  const reversed = await runMockPlus({
    profile: "semantic-portfolio",
    onlyIds: run.results.claws.map((claw) => claw.id).reverse(),
    writeOutput: false,
  });
  assert.equal(reversed.canonicalDigest, run.canonicalDigest);
  assert.deepEqual(reversed.manifest.claws, run.manifest.claws);
});

test("lifecycle portfolio classifies faults and removes every capability adapter", async () => {
  const run = await runMockPlus({
    profile: "lifecycle-portfolio",
    writeOutput: false,
  });
  assert.equal(run.coverage.scope, "lifecycle-portfolio");
  assert.equal(run.coverage.status, "passed");
  assert.equal(run.coverage.clawCount, 100);
  assert.equal(run.coverage.counts["control-failed"], 0);
  assert.equal(run.coverage.counts.survived, 0);
  assert.equal(run.coverage.counts["unsupported-oracle"], 0);
  assert.equal(run.coverage.counts["oracle-error"], 0);
  assert.equal(run.coverage.safety.caseCount, 600);
  assert.equal(run.coverage.safety.blockingCount, 0);
  assert.equal(run.coverage.lifecycle.clawCount, 100);
  assert.equal(run.coverage.lifecycle.caseCount, 500);
  assert.equal(run.coverage.lifecycle.killedCount, 500);
  assert.equal(
    run.coverage.lifecycle.completeness.every((item) =>
      [
        item.missingRecipeIds,
        item.unexpectedRecipeIds,
        item.nonKilledRecipeIds,
        item.missingCapabilityRecipeIds,
        item.unexpectedCapabilityRecipeIds,
        item.nonKilledCapabilityRecipeIds,
      ].every((ids) => ids.length === 0),
    ),
    true,
  );
  assert.deepEqual(run.coverage.lifecycle.classifications, [
    "cleanup-infrastructure-failure",
    "deterministic-model-failure",
    "harness-failure",
    "infrastructure-failure",
  ]);
  assert.equal(run.coverage.capabilities.applicableClawCount, 50);
  assert.equal(run.coverage.capabilities.caseCount, 73);
  assert.equal(run.coverage.capabilities.killedCount, 73);
  assert.deepEqual(run.coverage.capabilities.classes, [
    "bootstrap",
    "clawhub-plugin",
    "clawhub-skill",
    "cron",
    "delegated-sessions",
    "oauth-mcp",
    "profile-extension",
    "visual",
    "workspace-execution",
  ]);
  const cases = run.results.claws.flatMap((claw) => claw.cases);
  const staleConsent = cases.find(
    (item) => item.recipeId === "lifecycle-stale-consent",
  );
  assert.deepEqual(staleConsent.observed, {
    classification: "deterministic-model-failure",
    gate: "approval-bypass",
    retryAllowed: false,
    recovered: false,
    sideEffectApplied: false,
  });
  const retryableInfrastructure = cases.find(
    (item) => item.recipeId === "lifecycle-status-missing",
  );
  assert.equal(retryableInfrastructure.observed.retryAllowed, true);
  assert.equal(retryableInfrastructure.observed.recovered, true);
  const cleanupFailure = cases.find(
    (item) => item.recipeId === "lifecycle-cleanup-failure",
  );
  assert.equal(cleanupFailure.observed.retryAllowed, false);
  assert.equal(cleanupFailure.observed.recovered, false);
  assert.match(
    run.outputRoot,
    /[\\/]mock-plus[\\/]lifecycle-portfolio[\\/]/u,
  );
  const reversed = await runMockPlus({
    profile: "lifecycle-portfolio",
    onlyIds: run.results.claws.map((claw) => claw.id).reverse(),
    writeOutput: false,
  });
  assert.equal(reversed.canonicalDigest, run.canonicalDigest);
  assert.deepEqual(reversed.manifest.claws, run.manifest.claws);
  const partial = await runMockPlus({
    profile: "lifecycle-portfolio",
    onlyIds: ["incident-response"],
    writeOutput: false,
  });
  assert.equal(partial.coverage.status, "diagnostic");
  assert.match(partial.outputRoot, /[\\/]mock-plus[\\/]diagnostic[\\/]/u);
});

test("lifecycle recipe registry fails closed when coverage or expectations drift", async () => {
  const registry = JSON.parse(
    await readFile(join(root, "required-lifecycle-recipes.json"), "utf8"),
  );
  assert.doesNotThrow(() => assertLifecycleRegistry(registry));
  assert.throws(
    () =>
      assertLifecycleRegistry({
        ...registry,
        recipes: registry.recipes.slice(1),
      }),
    /incomplete/u,
  );
  assert.throws(
    () =>
      assertLifecycleRegistry({
        ...registry,
        recipes: registry.recipes.map((recipe, index) =>
          index === 0
            ? { ...recipe, expectedClassification: "first-attempt-pass" }
            : recipe,
        ),
      }),
    /malformed/u,
  );
});

test("capability adapter coverage fails closed before removal mutants run", () => {
  const entries = [{ capabilityClasses: ["visual"] }];
  assert.doesNotThrow(() =>
    assertCapabilityAdapterCoverage(entries, { visual: "fixture-adapter" }),
  );
  assert.throws(
    () => assertCapabilityAdapterCoverage(entries, {}),
    /adapter registry is incomplete: visual/u,
  );
});

test("canonical evidence reproduces exactly", async () => {
  const first = await runMockPlus({ writeOutput: false });
  const second = await runMockPlus({ writeOutput: false });
  assert.equal(second.canonicalDigest, first.canonicalDigest);
  assert.deepEqual(second.manifest, first.manifest);
  assert.deepEqual(second.results, first.results);
  assert.deepEqual(second.coverage, first.coverage);
});

test("qualifying selection order canonicalizes to one digest", async () => {
  const canonical = await runMockPlus({ writeOutput: false });
  const reversed = await runMockPlus({
    onlyIds: [...MOCK_PLUS_VERTICAL_IDS].reverse(),
    writeOutput: false,
  });
  assert.equal(reversed.coverage.status, "passed");
  assert.equal(reversed.canonicalDigest, canonical.canonicalDigest);
  assert.deepEqual(reversed.manifest.claws, canonical.manifest.claws);
});

test("case-group budget overruns fail before qualification", async () => {
  const started = performance.now();
  await assert.rejects(
    runBoundedMockPlusCaseGroup(
      "deliberately-slow",
      () => new Promise(() => {}),
      20,
    ),
    (error) => error.code === "mock-plus-case-timeout",
  );
  assert.ok(performance.now() - started < 150);
});

test("one-case reproduction stays scoped and explainable", async () => {
  const run = await runMockPlus({
    onlyIds: ["sales-operations"],
    caseId: "semantic-dangling-reference",
    writeOutput: false,
  });
  assert.equal(run.results.claws.length, 1);
  assert.equal(run.coverage.status, "diagnostic");
  assert.equal(run.coverage.scope, "diagnostic-selection");
  assert.match(
    run.outputRoot,
    /[\\/]mock-plus[\\/]diagnostic[\\/]sales-operations[\\/]semantic-dangling-reference[\\/][a-f0-9]{64}$/u,
  );
  assert.equal(run.results.claws[0].cases.length, 1);
  const { caseDigest, ...result } = run.results.claws[0].cases[0];
  assert.match(caseDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(result, {
    schemaVersion: "awesomeClaws.mockPlus.v1",
    evidenceClass: "mock-deterministic",
    mode: "mock",
    clawId: "sales-operations",
    recipeId: "semantic-dangling-reference",
    family: "semantics",
    kind: "mutant",
    oracle: {
      type: "semantic-validator",
      code: "dangling_reference",
      path: "actions.0.dealRefs",
    },
    outcome: "killed",
    observed: {
      schemaValid: true,
      findings: [
        {
          code: "dangling_reference",
          path: "actions.0.dealRefs",
        },
      ],
      delta: {
        path: "actions.0.dealRefs",
        before: { type: "reference-list" },
        after: { type: "dangling-reference-list" },
      },
    },
  });
});

test("run output is bounded, redacted, and removable", async () => {
  let run;
  try {
    run = await runMockPlus({ onlyIds: ["sales-operations"] });
    assert.ok(run.outputBytes > 0);
    assert.ok(run.outputBytes < 25 * 1_048_576);
    const persisted = await Promise.all(
      [
        "manifest.json",
        "results.json",
        "coverage.json",
        "inventory.json",
        "report.md",
      ].map((name) => readFile(join(run.outputRoot, name), "utf8")),
    );
    persisted.push(
      await readFile(join(run.provenanceRoot, "provenance.json"), "utf8"),
    );
    assert.equal(
      persisted.some((text) => text.includes("MOCKPLUS_CANARY_NONLIVE")),
      false,
    );
    assert.match(
      persisted.find((text) => text.startsWith("#")),
      /MOCK EVIDENCE ONLY/u,
    );
  } finally {
    if (run) {
      await rm(run.outputRoot, { recursive: true, force: true });
      await rm(run.provenanceRoot, { recursive: true, force: true });
    }
  }
  assert.ok(run);
  await assertMockPlusOutputRemoved(run.outputRoot);
  await assertMockPlusOutputRemoved(run.provenanceRoot);
});

test("CLI arguments require exact replay inputs", () => {
  assert.deepEqual(
    parseMockPlusArgs([
      "--only",
      "sales-operations,data-analyst",
      "--case",
      "schema-invalid-enum",
      "--explain",
      "--check",
    ]),
    {
      onlyIds: ["sales-operations", "data-analyst"],
      caseId: "schema-invalid-enum",
      explain: true,
      inventory: false,
      check: true,
      profile: "vertical",
    },
  );
  assert.throws(() => parseMockPlusArgs(["--explain"]), /requires --case/u);
  assert.throws(
    () => parseMockPlusArgs(["--unknown"]),
    /Unknown Mock\+ option/u,
  );
  assert.throws(() => parseMockPlusArgs(["--update"]), /not available yet/u);
  assert.equal(parseMockPlusArgs(["--portfolio"]).profile, "schema-portfolio");
  assert.equal(
    parseMockPlusArgs(["--semantics"]).profile,
    "semantic-portfolio",
  );
  assert.equal(
    parseMockPlusArgs(["--lifecycle"]).profile,
    "lifecycle-portfolio",
  );
  assert.throws(
    () => parseMockPlusArgs(["--portfolio", "--semantics"]),
    /mutually exclusive/u,
  );
});

test("unknown Claws and inapplicable recipes fail explicitly", async () => {
  await assert.rejects(
    runMockPlus({
      onlyIds: ["sales-operations", "sales-operations"],
      writeOutput: false,
    }),
    /must not contain duplicates/u,
  );
  await assert.rejects(
    runMockPlus({ onlyIds: ["not-a-claw"], writeOutput: false }),
    /Unknown Mock\+ Claw ids/u,
  );
  await assert.rejects(
    runMockPlus({
      onlyIds: ["data-migration-planner"],
      writeOutput: false,
    }),
    /limited to the reviewed vertical slice/u,
  );
  await assert.rejects(
    runMockPlus({
      onlyIds: ["sales-operations"],
      caseId: "capability-adapter-absent",
      writeOutput: false,
    }),
    /did not apply/u,
  );
});

test("diagnostics cannot overwrite the qualifying namespace", async () => {
  const diagnostic = await runMockPlus({
    onlyIds: ["sales-operations"],
    writeOutput: false,
  });
  const qualifying = await runMockPlus({ writeOutput: false });
  assert.match(diagnostic.outputRoot, /[\\/]mock-plus[\\/]diagnostic[\\/]/u);
  assert.match(qualifying.outputRoot, /[\\/]mock-plus[\\/]vertical[\\/]/u);
});

test("junctioned evidence directories cannot cross namespaces", async (t) => {
  const dryRun = await runMockPlus({
    onlyIds: ["sales-operations"],
    writeOutput: false,
  });
  const verticalRoot = join(root, ".tmp", "mock-plus", "vertical");
  await mkdir(verticalRoot, { recursive: true });
  const target = await mkdtemp(join(verticalRoot, "junction-target-"));
  await mkdir(dirname(dryRun.outputRoot), { recursive: true });
  await rm(dryRun.outputRoot, { recursive: true, force: true });
  try {
    try {
      await symlink(target, dryRun.outputRoot, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
        t.skip(`Junction creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(
      runMockPlus({ onlyIds: ["sales-operations"] }),
      /output resolves outside its namespace/u,
    );
  } finally {
    await rm(dryRun.outputRoot, { recursive: true, force: true });
    await rm(target, { recursive: true, force: true });
  }
});

test("pre-existing evidence-file links are never followed", async (t) => {
  const dryRun = await runMockPlus({
    onlyIds: ["sales-operations"],
    writeOutput: false,
  });
  const outside = await mkdtemp(join(tmpdir(), "mock-plus-file-link-target-"));
  const outsideFile = join(outside, "outside.json");
  await rm(dryRun.outputRoot, { recursive: true, force: true });
  await mkdir(dryRun.outputRoot, { recursive: true });
  await writeFile(outsideFile, "owner-data");
  try {
    try {
      await symlink(
        outsideFile,
        join(dryRun.outputRoot, "manifest.json"),
        "file",
      );
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
        t.skip(`File link creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(
      runMockPlus({ onlyIds: ["sales-operations"] }),
      /immutable evidence directory has unexpected files|refuses a non-regular evidence destination/u,
    );
    assert.equal(await readFile(outsideFile, "utf8"), "owner-data");
  } finally {
    await rm(dryRun.outputRoot, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("unsafe provenance is rejected before persistence", async () => {
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "MOCKPLUS_CANARY_NONLIVE_8D31C6A4";
  try {
    await assert.rejects(
      runMockPlus({ onlyIds: ["sales-operations"] }),
      /persisted output contains the synthetic canary/u,
    );
  } finally {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  }
});

test("Runtime Evidence aggregation rejects Mock+ evidence", () => {
  assert.throws(
    () =>
      aggregateRuntimeEvidence({
        manifest: {
          evidenceClass: MOCK_PLUS_EVIDENCE_CLASS,
        },
        results: [],
        catalogScores: { scores: [] },
      }),
    /rejects Mock\+ deterministic evidence/u,
  );
  assert.throws(
    () =>
      aggregateRuntimeEvidence({
        manifest: {},
        results: [{ evidenceClass: MOCK_PLUS_EVIDENCE_CLASS }],
        catalogScores: { scores: [] },
      }),
    /rejects Mock\+ deterministic evidence/u,
  );
});
