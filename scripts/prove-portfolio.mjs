import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertAddPreview,
  assertStandaloneSuccess,
  createProofEnvironment,
  failureRecord,
  readCatalog,
  resolveProofConfig,
  root,
  runOpenClaw,
  runStandalone,
} from "./openclaw-proof-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

const { cliEntry, openClawEntry } = resolveProofConfig();
const openClawRoot = dirname(openClawEntry);
const mockOpenAiEntry = join(openClawRoot, "scripts", "e2e", "mock-openai-server.mjs");
const { applyMockOpenAiModelConfig } = await import(
  pathToFileURL(
    join(openClawRoot, "scripts", "e2e", "lib", "fixtures", "mock-openai-config.mjs"),
  ).href
);
const catalog = await readCatalog();
const experienceCases = new Map(
  (await readExperienceCases(catalog)).map((item) => [item.id, item]),
);
const requestedIds = new Set(
  (process.env.PORTFOLIO_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const entries =
  requestedIds.size === 0
    ? catalog.entries
    : catalog.entries.filter((entry) => requestedIds.has(entry.id));
const unknownIds = [...requestedIds].filter(
  (id) => !catalog.entries.some((entry) => entry.id === id),
);
if (unknownIds.length > 0) {
  throw new Error(`Unknown PORTFOLIO_ONLY package ids: ${unknownIds.join(", ")}`);
}
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const proofRoot = resolve(process.env.PORTFOLIO_PROOF_DIR ?? join(root, ".tmp", "proof", runId));
const runtimeRoot = await mkdtemp(join(tmpdir(), "awesome-claws-portfolio-runtime-"));
await mkdir(proofRoot, { recursive: true });

function revision(path, override) {
  if (override) {
    return override;
  }
  const result = spawnSync("git", ["-C", dirname(path), "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function recordPhase(phases, name, command) {
  const startedAt = new Date().toISOString();
  process.stderr.write(`RUN  ${name}\n`);
  try {
    const result = command();
    phases.push({ name, status: "passed", startedAt, command: result.record });
    return result.payload;
  } catch (error) {
    phases.push({ name, status: "failed", startedAt, ...failureRecord(name, error) });
    throw error;
  }
}

function assertSchema(payload, schemaVersion, label) {
  if (payload.schemaVersion !== schemaVersion) {
    throw new Error(`${label} returned ${payload.schemaVersion ?? "no schemaVersion"}.`);
  }
  return payload;
}

function fixtureValue(input) {
  if (input.format === "timezone") {
    return "UTC";
  }
  if (input.type === "choice") {
    return input.options[0].value;
  }
  if (input.type === "boolean") {
    return input.default ?? false;
  }
  if (input.type === "integer") {
    return input.minimum ?? 1;
  }
  if (input.id.includes("currency")) {
    return "USD";
  }
  if (input.id.includes("airport")) {
    return "SEA";
  }
  return `Portfolio proof ${input.label}`;
}

function classifyFailure(phase) {
  if (phase === "standalone-inspect" || phase === "adapter-preview") {
    return "standalone-cli-defect";
  }
  if (phase === "openclaw-inspect") {
    return "package-or-spec-defect";
  }
  return "openclaw-lifecycle-defect";
}

function matchesDeclaredReadiness(finding, readiness) {
  return (readiness?.requirements ?? []).some((requirement) => {
    if (requirement.kind === "oauth" && requirement.mcpServer) {
      return (
        finding.path === `mcp.servers.${requirement.mcpServer}` &&
        /oauth authorization/iu.test(`${finding.message} ${finding.requirement ?? ""}`)
      );
    }
    return false;
  });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return port;
}

async function waitForPort(port, child) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Local Gateway exited before listening on port ${port}.`);
    }
    const connected = await new Promise((resolveConnected) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolveConnected(true);
      });
      socket.once("error", () => resolveConnected(false));
    });
    if (connected) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Local Gateway did not listen on port ${port} within 60 seconds.`);
}

async function startGateway(openClawEntry, baseEnv, id) {
  const port = await reservePort();
  const token = `portfolio-proof-${id}`;
  const env = {
    ...baseEnv,
    OPENCLAW_GATEWAY_PORT: String(port),
    OPENCLAW_GATEWAY_TOKEN: token,
  };
  const child = spawn(
    process.execPath,
    [
      openClawEntry,
      "gateway",
      "run",
      "--allow-unconfigured",
      "--auth",
      "token",
      "--token",
      token,
      "--port",
      String(port),
      "--bind",
      "loopback",
    ],
    { detached: process.platform !== "win32", env, stdio: "ignore" },
  );
  await waitForPort(port, child);
  return { child, env, port };
}

async function stopGateway(gateway) {
  if (!gateway || gateway.child.exitCode !== null) {
    return;
  }
  const signal = (name) => {
    try {
      if (process.platform !== "win32" && gateway.child.pid) {
        process.kill(-gateway.child.pid, name);
      } else {
        gateway.child.kill(name);
      }
    } catch (error) {
      if (error?.code !== "ESRCH") {
        throw error;
      }
    }
  };
  signal("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => gateway.child.once("exit", resolveExit)),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
  ]);
  if (gateway.child.exitCode === null) {
    signal("SIGKILL");
    await Promise.race([
      new Promise((resolveExit) => gateway.child.once("exit", resolveExit)),
      new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
    ]);
    let stillAlive = gateway.child.exitCode === null;
    if (stillAlive && gateway.child.pid) {
      try {
        process.kill(gateway.child.pid, 0);
      } catch (error) {
        if (error?.code === "ESRCH") {
          stillAlive = false;
        } else {
          throw error;
        }
      }
    }
    if (stillAlive) {
      throw new Error(`Child process ${gateway.child.pid ?? "unknown"} did not terminate.`);
    }
  }
}

async function startMockOpenAi(baseEnv, evidenceRoot, entry, marker) {
  const port = await reservePort();
  const requestLog = join(evidenceRoot, "agent-turn.requests.jsonl");
  const child = spawn(process.execPath, [mockOpenAiEntry], {
    env: {
      ...baseEnv,
      MOCK_PORT: String(port),
      MOCK_REQUEST_LOG: requestLog,
      SUCCESS_MARKER: `${marker}\n${entry.example.outcome}`,
    },
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
  await waitForPort(port, child);
  return { child, port, requestLog };
}

async function configureMockModel(env, port) {
  const config = JSON.parse(await readFile(env.OPENCLAW_CONFIG_PATH, "utf8"));
  const agentEntries = config.agents?.entries;
  applyMockOpenAiModelConfig(config, { mockPort: port });
  if (agentEntries) {
    config.agents.entries = agentEntries;
  }
  await writeFile(env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return { ...env, OPENAI_API_KEY: "awesome-claws-deterministic-proof" };
}

function findAgentTurnText(payload) {
  const queue = [payload];
  while (queue.length > 0) {
    const value = queue.shift();
    if (typeof value === "string" && value.trim().length > 0) {
      if (/OPENCLAW_E2E_APPLICATION_/u.test(value)) {
        return value;
      }
      continue;
    }
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (value && typeof value === "object") {
      queue.push(...Object.values(value));
    }
  }
  return "";
}

async function assertApplicationTurn({ entry, marker, requestLog, turn }) {
  const responseText = findAgentTurnText(turn);
  if (!responseText.includes(marker) || !responseText.includes(entry.example.outcome)) {
    throw new Error(`${entry.id} agent turn did not return its deterministic handoff.`);
  }
  const requestLines = (await readFile(requestLog, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const request = requestLines.find((item) => item.path === "/v1/responses");
  if (!request || typeof request.body !== "string") {
    throw new Error(`${entry.id} agent turn did not reach the OpenAI-compatible runtime.`);
  }
  const body = JSON.parse(request.body);
  const input = Array.isArray(body.input) ? body.input : [];
  const requestText = JSON.stringify(input.filter((item) => item?.role === "user"));
  const instructions = JSON.stringify(input.filter((item) => item?.role === "system"));
  if (!requestText.includes(entry.example.request)) {
    throw new Error(`${entry.id} runtime request did not preserve the domain scenario.`);
  }
  if (!instructions.includes(entry.name) || !instructions.includes(entry.principles[0])) {
    throw new Error(`${entry.id} runtime instructions did not include the Claw identity.`);
  }
  if (!Array.isArray(body.tools) || body.tools.length === 0) {
    throw new Error(`${entry.id} runtime request did not expose an agent tool surface.`);
  }
  return {
    status: "runtime-wiring-passed",
    mode: "deterministic-openai-compatible-fixture",
    request: entry.example.request,
    expectedOutcome: entry.example.outcome,
    responseMarker: marker,
    declaredToolCount: body.tools.length,
    requestLog: "agent-turn.requests.jsonl",
  };
}

const revisions = {
  awesomeClaws: revision(join(root, "package.json"), process.env.AWESOME_CLAWS_REVISION),
  clawsCli: revision(cliEntry, process.env.CLAWS_CLI_REVISION),
  openClaw: revision(openClawEntry, process.env.OPENCLAW_REVISION),
};
const results = [];

for (const entry of entries) {
  const proof = await createProofEnvironment(runtimeRoot, entry.id);
  const evidenceRoot = join(proofRoot, entry.id);
  await mkdir(evidenceRoot, { recursive: true });
  const source = join(root, "claws", entry.id);
  let env = {
    ...proof.env,
    OPENAI_API_KEY: "awesome-claws-deterministic-proof",
    OPENCLAW_CLI_ENTRY: openClawEntry,
  };
  const phases = [];
  let gateway;
  let mockOpenAi;
  const result = {
    id: entry.id,
    packagePath: relative(root, source).replaceAll("\\", "/"),
    status: "lifecycle-failed",
    phases,
    lifecycleProofMode: "local",
    capabilityProofMode: "missing",
    applicationScenario: {
      status: "not-run",
      reason: "The deterministic OpenClaw agent turn has not run yet.",
    },
    experience: experienceCases.get(entry.id),
    revisions,
  };

  try {
    if ((entry.cronJobs?.length ?? 0) > 0) {
      gateway = await startGateway(openClawEntry, env, entry.id);
      env = gateway.env;
      result.gateway = { mode: "local", port: gateway.port };
    }
    const setupInputs = entry.setup?.inputs ?? [];
    const answersPath = join(proof.packageRoot, "answers.json");
    if (setupInputs.length > 0) {
      const answers = Object.fromEntries(setupInputs.map((input) => [input.id, fixtureValue(input)]));
      await writeFile(answersPath, `${JSON.stringify(answers, null, 2)}\n`);
    }
    const answerArgs = setupInputs.length > 0 ? ["--answers", answersPath] : [];

    const standaloneInspection = assertStandaloneSuccess(
      recordPhase(phases, "standalone-inspect", () =>
        runStandalone(cliEntry, ["inspect", source], env, `${entry.id} standalone inspect`),
      ),
      "inspect",
    );
    result.package = standaloneInspection.package;

    const openClawInspection = recordPhase(phases, "openclaw-inspect", () =>
      runOpenClaw(openClawEntry, ["claws", "inspect", source], env, `${entry.id} inspect`),
    );
    if (openClawInspection.valid !== true || openClawInspection.manifest?.agent?.id !== entry.id) {
      throw new Error(`${entry.id} OpenClaw inspection did not preserve package identity.`);
    }

    const adapterPreview = recordPhase(phases, "adapter-preview", () =>
        runStandalone(
          cliEntry,
          [source, "--agent", "openclaw", "--dry-run"],
          env,
          `${entry.id} add preview`,
          setupInputs.length > 0 ? [0, 3] : [0],
        ),
      );
    if (setupInputs.length > 0) {
      const setupPlan = adapterPreview.harness?.outcome;
      if (
        adapterPreview.ok !== false ||
        setupPlan?.blockers?.length === 0 ||
        setupPlan.blockers.some((blocker) => blocker.code !== "setup_answer_required")
      ) {
        throw new Error(`${entry.id} adapter preview did not expose its setup-answer gap.`);
      }
      result.adapterPreview = "setup-answers-unsupported";
    } else {
      assertAddPreview(assertStandaloneSuccess(adapterPreview, "preview"));
      result.adapterPreview = "passed";
    }

    const addPlan = assertAddPreview(
      recordPhase(phases, "add-preview", () =>
        runOpenClaw(
          openClawEntry,
          ["claws", "add", source, "--dry-run", ...answerArgs],
          env,
          `${entry.id} add preview`,
        ),
      ),
    );
    result.readiness = addPlan.readiness ?? { ready: true, requirements: [] };

    const addResult = assertSchema(
      recordPhase(phases, "add-apply", () =>
        runOpenClaw(
          openClawEntry,
          [
            "claws",
            "add",
            source,
            "--yes",
            "--plan-integrity",
            addPlan.planIntegrity,
            ...answerArgs,
          ],
          env,
          `${entry.id} add apply`,
        ),
      ),
      "openclaw.clawAddResult.v1",
      `${entry.id} add`,
    );
    if (addResult.status !== "complete" || addResult.agent?.finalId !== entry.id) {
      throw new Error(`${entry.id} add did not create the declared agent completely.`);
    }

    const marker = `OPENCLAW_E2E_APPLICATION_${entry.id.replaceAll("-", "_").toUpperCase()}`;
    mockOpenAi = await startMockOpenAi(env, evidenceRoot, entry, marker);
    env = await configureMockModel(env, mockOpenAi.port);
    const applicationTurn = recordPhase(phases, "application-scenario", () =>
      runOpenClaw(
        openClawEntry,
        [
          "agent",
          ...(gateway ? [] : ["--local"]),
          "--agent",
          entry.id,
          "--message",
          entry.example.request,
        ],
        env,
        `${entry.id} application scenario`,
      ),
    );
    result.applicationScenario = await assertApplicationTurn({
      entry,
      marker,
      requestLog: mockOpenAi.requestLog,
      turn: applicationTurn,
    });
    await stopGateway(mockOpenAi);
    mockOpenAi = undefined;

    const status = assertSchema(
      recordPhase(phases, "status", () =>
        runOpenClaw(openClawEntry, ["claws", "status", entry.id], env, `${entry.id} status`),
      ),
      "openclaw.clawStatus.v1",
      `${entry.id} status`,
    );
    if (status.summary?.claws !== 1 || status.records?.[0]?.agentState !== "present") {
      throw new Error(`${entry.id} status did not report one present Claw agent.`);
    }

    const updatePlan = recordPhase(phases, "update-preview", () =>
      runOpenClaw(
        openClawEntry,
        ["claws", "update", entry.id, "--dry-run"],
        env,
        `${entry.id} update preview`,
      ),
    );
    if (
      updatePlan.schemaVersion !== "openclaw.clawUpdatePlan.v1" ||
      updatePlan.mutationAllowed !== false ||
      typeof updatePlan.planIntegrity !== "string" ||
      updatePlan.summary?.added !== 0 ||
      updatePlan.summary?.changed !== 0 ||
      updatePlan.summary?.removed !== 0 ||
      updatePlan.summary?.blocked !== 0
    ) {
      throw new Error(`${entry.id} update did not return a no-op consent-bound preview.`);
    }

    const doctor = recordPhase(phases, "doctor", () =>
      runOpenClaw(
        openClawEntry,
        ["doctor", "--lint"],
        env,
        `${entry.id} doctor`,
        [0, 1],
      ),
    );
    const doctorErrors = (doctor.findings ?? []).filter((finding) => finding.severity === "error");
    result.doctorFindings = doctor.findings ?? [];
    const unexpectedDoctorErrors = doctorErrors.filter(
      (finding) => !matchesDeclaredReadiness(finding, result.readiness),
    );
    if (unexpectedDoctorErrors.length > 0) {
      throw new Error(
        `${entry.id} doctor reported ${unexpectedDoctorErrors.length} undeclared error finding(s).`,
      );
    }

    const exportRoot = join(proof.packageRoot, "exported");
    const exported = assertSchema(
      recordPhase(phases, "export", () =>
        runOpenClaw(
          openClawEntry,
          ["claws", "export", entry.id, "--out", exportRoot],
          env,
          `${entry.id} export`,
        ),
      ),
      "openclaw.clawExportResult.v1",
      `${entry.id} export`,
    );
    if (exported.manifest?.agent?.id !== entry.id) {
      throw new Error(`${entry.id} export did not preserve the agent identity.`);
    }
    const exportedInspection = recordPhase(phases, "export-inspect", () =>
      runStandalone(cliEntry, ["inspect", exportRoot], env, `${entry.id} export inspect`),
    );
    assertStandaloneSuccess(exportedInspection, "inspect");

    const removePlan = assertSchema(
      recordPhase(phases, "remove-preview", () =>
        runOpenClaw(
          openClawEntry,
          ["claws", "remove", entry.id, "--dry-run", "--remove-unused"],
          env,
          `${entry.id} remove preview`,
        ),
      ),
      "openclaw.clawRemovePlan.v1",
      `${entry.id} remove preview`,
    );
    if (
      removePlan.mutationAllowed !== false ||
      typeof removePlan.planIntegrity !== "string" ||
      (removePlan.blockers?.length ?? 0) !== 0
    ) {
      throw new Error(`${entry.id} remove did not return a complete consent-bound preview.`);
    }

    const removed = assertSchema(
      recordPhase(phases, "remove-apply", () =>
        runOpenClaw(
          openClawEntry,
          [
            "claws",
            "remove",
            entry.id,
            "--yes",
            "--remove-unused",
            "--plan-integrity",
            removePlan.planIntegrity,
          ],
          env,
          `${entry.id} remove apply`,
        ),
      ),
      "openclaw.clawRemoveResult.v1",
      `${entry.id} remove`,
    );
    if (removed.status !== "complete" || removed.agentRemoved !== true) {
      throw new Error(`${entry.id} removal did not complete.`);
    }

    const finalStatus = assertSchema(
      recordPhase(phases, "final-status", () =>
        runOpenClaw(openClawEntry, ["claws", "status"], env, `${entry.id} final status`),
      ),
      "openclaw.clawStatus.v1",
      `${entry.id} final status`,
    );
    if (finalStatus.summary?.claws !== 0) {
      throw new Error(`${entry.id} left a Claw lifecycle record after removal.`);
    }
    result.status = "lifecycle-passed";
  } catch (error) {
    const lastPhase = phases.at(-1);
    if (lastPhase?.status === "passed") {
      lastPhase.status = "failed";
      lastPhase.message = error instanceof Error ? error.message : String(error);
    }
    result.failure = failureRecord(phases.at(-1)?.name ?? "unknown", error);
    result.failure.provisionalOwner = classifyFailure(result.failure.phase);
  }

  await stopGateway(gateway);
  await stopGateway(mockOpenAi);

  await writeFile(join(evidenceRoot, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  results.push(result);
  process.stderr.write(`${result.status === "lifecycle-passed" ? "PASS" : "FAIL"} ${entry.id}\n`);
}

const summary = {
  schemaVersion: "awesomeClaws.portfolioProof.v1",
  generatedAt: new Date().toISOString(),
  proofRoot,
  revisions,
  packageCount: results.length,
  lifecyclePassed: results.filter((result) => result.status === "lifecycle-passed").length,
  lifecycleFailed: results.filter((result) => result.status === "lifecycle-failed").length,
  applicationScenariosPassed: results.filter(
    (result) => result.applicationScenario.status === "runtime-wiring-passed",
  ).length,
  results,
};
await rm(runtimeRoot, { recursive: true, force: true });
summary.disposableRuntimeRemoved = true;
await writeFile(join(proofRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      schemaVersion: summary.schemaVersion,
      generatedAt: summary.generatedAt,
      proofRoot: summary.proofRoot,
      revisions: summary.revisions,
      packageCount: summary.packageCount,
      lifecyclePassed: summary.lifecyclePassed,
      lifecycleFailed: summary.lifecycleFailed,
      applicationScenariosPassed: summary.applicationScenariosPassed,
      results: summary.results.map((result) => ({
        id: result.id,
        status: result.status,
        adapterPreview: result.adapterPreview,
        applicationScenario: result.applicationScenario.status,
        ...(result.failure
          ? {
              failure: {
                phase: result.failure.phase,
                message: result.failure.message,
                provisionalOwner: result.failure.provisionalOwner,
              },
            }
          : {}),
      })),
    },
    null,
    2,
  ),
);
if (summary.lifecycleFailed > 0) {
  process.exitCode = 1;
}
