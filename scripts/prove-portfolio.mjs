import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
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
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
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
const sourceOverride = process.env.PORTFOLIO_SOURCE_ROOT?.trim();
const visualRuntimeProof = process.env.PORTFOLIO_VISUAL_RUNTIME === "1";
const upgradeFixtures = new Map([
  [
    "executive-assistant",
    {
      previousSource: join(
        root,
        "scripts",
        "fixtures",
        "upgrades",
        "executive-assistant-v0.0.1",
      ),
      previousVersion: "0.0.1",
      targetVersion: "0.1.0",
      changedPaths: [
        "AGENTS.md",
        "SOUL.md",
        "fixtures/session-demo.json",
        "templates/executive-brief.md",
      ],
      directlySourcedChangedPaths: [
        ["AGENTS.md", "workspace/AGENTS.md"],
        ["fixtures/session-demo.json", "fixtures/session-demo.json"],
        ["templates/executive-brief.md", "templates/executive-brief.md"],
      ],
      addedPaths: [
        "schemas/executive-commitment-ledger.schema.json",
        "fixtures/executive-commitment-ledger.example.json",
        "templates/executive-commitment-ledger.md",
        "references/executive-commitment-contract.md",
        "templates/session-handoff.md",
      ],
      removedPath: "templates/legacy-follow-up.md",
      agentChanges: 1,
      capabilityChanges: 3,
    },
  ],
]);
if (sourceOverride && entries.length !== 1) {
  throw new Error("PORTFOLIO_SOURCE_ROOT requires exactly one PORTFOLIO_ONLY package id.");
}
if (
  visualRuntimeProof &&
  (entries.length !== 1 || entries[0]?.id !== "data-analyst")
) {
  throw new Error("PORTFOLIO_VISUAL_RUNTIME currently requires PORTFOLIO_ONLY=data-analyst.");
}
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const proofRoot = resolve(process.env.PORTFOLIO_PROOF_DIR ?? join(root, ".tmp", "proof", runId));
await mkdir(join(root, ".tmp"), { recursive: true });
const runtimeRoot = await mkdtemp(join(root, ".tmp", "portfolio-runtime-"));
await mkdir(proofRoot, { recursive: true });

const materializeCheck = spawnSync(
  process.execPath,
  [join(root, "scripts", "materialize-catalog.mjs"), "--check"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (materializeCheck.status !== 0) {
  throw new Error(
    `Catalog materialization check failed:\n${materializeCheck.stderr || materializeCheck.stdout}`,
  );
}

function revision(path, override) {
  const cwd = dirname(path);
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return override ?? "unknown";
  }
  const status = spawnSync("git", ["-C", cwd, "status", "--porcelain", "--untracked-files=normal"], {
    encoding: "utf8",
  });
  const revision = override ?? result.stdout.trim();
  const dirtyEntries =
    status.status === 0
      ? status.stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .filter((entry) => !(entry.startsWith("?? ") && entry.endsWith("/")))
      : [];
  return dirtyEntries.length > 0 ? `${revision}-dirty` : revision;
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

async function recordAsyncPhase(phases, name, command) {
  const startedAt = new Date().toISOString();
  process.stderr.write(`RUN  ${name}\n`);
  try {
    const result = await command();
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

function assertUpdatePlan(plan, fixture, direction, label) {
  const expectedChanged = fixture.changedPaths.length + fixture.agentChanges;
  const expectedAdded = direction === "forward" ? fixture.addedPaths.length : 1;
  const expectedRemoved = direction === "forward" ? 1 : fixture.addedPaths.length;
  const expectedCapabilityEscalations =
    direction === "forward" ? 0 : fixture.capabilityChanges;
  if (
    plan.schemaVersion !== "openclaw.clawUpdatePlan.v1" ||
    plan.mutationAllowed !== false ||
    typeof plan.planIntegrity !== "string" ||
    plan.summary?.totalActions !==
      expectedAdded + expectedChanged + expectedRemoved + 1 ||
    plan.summary?.added !== expectedAdded ||
    plan.summary?.changed !== expectedChanged ||
    plan.summary?.removed !== expectedRemoved ||
    plan.summary?.unchanged !== 1 ||
    plan.summary?.blocked !== 0 ||
    plan.summary?.capabilityChanges !== fixture.capabilityChanges ||
    plan.summary?.capabilityEscalations !== expectedCapabilityEscalations ||
    plan.capabilityChanges?.length !== fixture.capabilityChanges ||
    !plan.capabilityChanges.every(
      (change) =>
        change.classification ===
        (direction === "forward" ? "reduction" : "escalation"),
    ) ||
    (plan.blockers?.length ?? 0) !== 0
  ) {
    throw new Error(`${label} did not return the expected consent-bound managed delta.`);
  }
  const expected =
    direction === "forward"
      ? [
          ...fixture.changedPaths.map((path) => ["change", path]),
          ...fixture.addedPaths.map((path) => ["add", path]),
          ["remove", fixture.removedPath],
        ]
      : [
          ...fixture.changedPaths.map((path) => ["change", path]),
          ...fixture.addedPaths.map((path) => ["remove", path]),
          ["add", fixture.removedPath],
        ];
  for (const [action, id] of expected) {
    const matched = plan.actions?.some(
      (candidate) =>
        candidate.kind === "workspaceFile" &&
        candidate.action === action &&
        candidate.id === id &&
        candidate.blocked === false,
    );
    if (!matched) {
      throw new Error(`${label} omitted workspace ${action} action for ${id}.`);
    }
  }
  const agentChange = plan.actions?.some(
    (candidate) =>
      candidate.kind === "agent" &&
      candidate.action === "change" &&
      candidate.id === "executive-assistant" &&
      candidate.blocked === false,
  );
  if (!agentChange) {
    throw new Error(`${label} omitted the owned executive-assistant agent change.`);
  }
  const expectedVersion =
    direction === "forward" ? fixture.targetVersion : fixture.previousVersion;
  if (plan.targetClaw?.version !== expectedVersion) {
    throw new Error(`${label} targeted ${plan.targetClaw?.version ?? "no version"}.`);
  }
  return plan;
}

async function assertFileMatches(actualPath, expectedPath, label) {
  const [actual, expected] = await Promise.all([readFile(actualPath), readFile(expectedPath)]);
  if (!actual.equals(expected)) {
    throw new Error(`${label} did not match ${expectedPath}.`);
  }
}

async function assertFileMissing(path, label) {
  try {
    await access(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`${label} unexpectedly remained at ${path}.`);
}

async function assertUserOwnedState(userOwnedState, label) {
  if (!userOwnedState) {
    return;
  }
  const retained = await readFile(userOwnedState.path, "utf8");
  if (retained !== userOwnedState.content) {
    throw new Error(`${label} changed user-owned USER.md state.`);
  }
}

function assertInstalledVersion(status, expectedVersion, label) {
  const record = status.records?.[0];
  if (
    status.summary?.claws !== 1 ||
    record?.agentState !== "present" ||
    record?.install?.claw?.version !== expectedVersion
  ) {
    throw new Error(`${label} did not report installed version ${expectedVersion}.`);
  }
}

function assertInstalledCapabilities(entry, addPlan, addResult) {
  const expectedPackages = [
    ...(entry.packages ?? []),
    ...(entry.openclawProfile?.extensions ?? []).map((extension) => ({
      kind: extension.kind,
      ref: extension.ref,
      version: extension.version,
    })),
  ];
  for (const expected of expectedPackages) {
    const installed = addResult.packages?.find(
      (item) =>
        item.kind === expected.kind &&
        item.ref === expected.ref &&
        item.version === expected.version,
    );
    if (installed?.status !== "complete" || typeof installed.integrity !== "string") {
      throw new Error(
        `${entry.id} did not install exact ${expected.kind} ${expected.ref}@${expected.version}.`,
      );
    }
  }
  for (const [name, expected] of Object.entries(entry.mcpServers ?? {})) {
    const planned = addPlan.actions?.find(
      (action) => action.kind === "mcpServer" && action.id === name,
    );
    if (
      planned?.action !== "configure" ||
      planned.details?.url !== expected.url ||
      planned.details?.transport !== expected.transport ||
      planned.details?.auth !== expected.auth ||
      JSON.stringify(planned.details?.toolFilter) !== JSON.stringify(expected.toolFilter)
    ) {
      throw new Error(`${entry.id} add plan did not preserve MCP server ${name}.`);
    }
    const installed = addResult.mcpServers?.find((item) => item.name === name);
    if (installed?.status !== "complete") {
      throw new Error(`${entry.id} did not install MCP server ${name}.`);
    }
  }
  for (const expected of entry.cronJobs ?? []) {
    const installed = addResult.cronJobs?.find((item) => item.manifestId === expected.id);
    if (installed?.status !== "complete") {
      throw new Error(`${entry.id} did not install cron job ${expected.id}.`);
    }
  }
}

async function assertInstalledBootstrap(entry, addPlan, addResult) {
  if (!entry.bootstrap) {
    return;
  }
  const action = addPlan.actions?.find(
    (candidate) => candidate.kind === "bootstrap" && candidate.id === "BOOTSTRAP.md",
  );
  const workspace = addResult.agent?.workspace;
  if (
    action?.action !== "write" ||
    action.blocked !== false ||
    typeof action.source !== "string" ||
    typeof action.digest !== "string" ||
    typeof workspace !== "string" ||
    workspace.length === 0
  ) {
    throw new Error(`${entry.id} add plan did not preserve its bootstrap contract.`);
  }
  const source = await readFile(action.source);
  const digest = `sha256:${createHash("sha256").update(source).digest("hex")}`;
  const installed = await readFile(join(workspace, "BOOTSTRAP.md"));
  if (digest !== action.digest || !source.equals(installed)) {
    throw new Error(`${entry.id} did not install the exact planned bootstrap bytes.`);
  }
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

async function waitForGatewayReady(openClawEntry, env, port, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local Gateway exited before becoming healthy on port ${port}.`);
    }
    const remainingMs = deadline - Date.now();
    try {
      runOpenClaw(
        openClawEntry,
        [
          "gateway",
          "health",
          "--port",
          String(port),
          "--timeout",
          String(Math.max(1, Math.min(1000, remainingMs))),
        ],
        env,
        "gateway readiness",
      );
      return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(250, remainingMs)));
    }
  }
  throw new Error(`Local Gateway did not become healthy on port ${port} within 30 seconds.`);
}

async function startGateway(openClawEntry, baseEnv, id, evidenceRoot) {
  const port = await reservePort();
  const token = `portfolio-proof-${id}`;
  const env = {
    ...baseEnv,
    OPENCLAW_GATEWAY_PORT: String(port),
    OPENCLAW_GATEWAY_TOKEN: token,
  };
  const logPath = join(evidenceRoot, "gateway.log");
  const logFd = openSync(logPath, "a");
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
    { detached: process.platform !== "win32", env, stdio: ["ignore", logFd, logFd] },
  );
  try {
    await waitForPort(port, child);
    await waitForGatewayReady(openClawEntry, env, port, child);
    return { child, env, logFd, logPath, port };
  } catch (error) {
    await stopGateway({ child, logFd });
    throw error;
  }
}

async function stopGateway(gateway) {
  if (!gateway) {
    return;
  }
  if (gateway.child.exitCode !== null) {
    if (gateway.logFd !== undefined) closeSync(gateway.logFd);
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
  if (gateway.logFd !== undefined) closeSync(gateway.logFd);
}

async function startMockOpenAi(baseEnv, evidenceRoot, entry, marker) {
  const port = await reservePort();
  const requestLog = join(evidenceRoot, "agent-turn.requests.jsonl");
  const mockEntry = visualRuntimeProof
    ? join(root, "scripts", "visual-runtime-mock.mjs")
    : mockOpenAiEntry;
  const child = spawn(process.execPath, [mockEntry], {
    env: {
      ...baseEnv,
      MOCK_PORT: String(port),
      MOCK_REQUEST_LOG: requestLog,
      SUCCESS_MARKER: visualRuntimeProof ? marker : `${marker}\n${entry.example.outcome}`,
      EXPECTED_OUTCOME: entry.example.outcome,
      VISUAL_RUNTIME_PACKAGE_ROOT: join(root, "claws", entry.id),
    },
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
  try {
    await waitForPort(port, child);
    return { child, port, requestLog };
  } catch (error) {
    await stopGateway({ child });
    throw error;
  }
}

async function runGatewayApplicationTurn({ entry, gateway, marker }) {
  const { GatewayClient } = await import(
    pathToFileURL(
      join(openClawRoot, "packages", "gateway-client", "dist", "index.mjs"),
    ).href
  );
  let connectedResolve;
  let connectedReject;
  const connected = new Promise((resolveConnected, rejectConnected) => {
    connectedResolve = resolveConnected;
    connectedReject = rejectConnected;
  });
  const client = new GatewayClient({
    url: `ws://127.0.0.1:${gateway.port}`,
    token: gateway.env.OPENCLAW_GATEWAY_TOKEN,
    requestTimeoutMs: 120_000,
    clientName: "cli",
    clientDisplayName: "awesome-claws-visual-proof",
    clientVersion: "dev",
    mode: "cli",
    role: "operator",
    scopes: ["operator.admin", "operator.read", "operator.write"],
    caps: ["inline-widgets"],
    onHelloOk: () => connectedResolve(),
    onConnectError: (error) => connectedReject(error),
  });
  client.start();
  try {
    await connected;
    const sessionKey = `agent:${entry.id}:main`;
    const accepted = await client.request("chat.send", {
      sessionKey,
      idempotencyKey: marker,
      message: entry.example.request,
      deliver: false,
    });
    if (!["started", "in_flight", "ok"].includes(accepted?.status)) {
      throw new Error(`${entry.id} visual runtime agent request was not accepted.`);
    }
    const completed = await client.request(
      "agent.wait",
      { runId: marker, timeoutMs: 120_000 },
      { timeoutMs: 125_000 },
    );
    if (completed?.status !== "ok") {
      throw new Error(`${entry.id} visual runtime agent request did not complete.`);
    }
    const history = await client.request("chat.history", { sessionKey, limit: 50 });
    return {
      payload: history,
      record: {
        invocation: ["gateway", "agent", sessionKey],
        status: 0,
        stdout: "",
        stderr: "",
      },
    };
  } finally {
    await client.stopAndWait({ timeoutMs: 5_000 });
  }
}

async function configureMockModel(env, port) {
  const config = JSON.parse(await readFile(env.OPENCLAW_CONFIG_PATH, "utf8"));
  const agentEntries = config.agents?.entries;
  applyMockOpenAiModelConfig(config, { mockPort: port });
  config.plugins = {
    ...config.plugins,
    enabled: true,
    allow: [...new Set([...(config.plugins?.allow ?? []), "openai"])],
    entries: {
      ...config.plugins?.entries,
      openai: { ...config.plugins?.entries?.openai, enabled: true },
    },
  };
  if (agentEntries) {
    config.agents.entries = agentEntries;
  }
  await writeFile(env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return { ...env, OPENAI_API_KEY: "awesome-claws-deterministic-proof" };
}

function findAgentTurnText(payload) {
  const queue = [payload];
  const text = [];
  while (queue.length > 0) {
    const value = queue.shift();
    if (typeof value === "string" && value.trim().length > 0) {
      text.push(value);
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
  return text.some((value) => /OPENCLAW_E2E_APPLICATION_/u.test(value))
    ? text.join("\n")
    : "";
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
  const experience = experienceCases.get(entry.id);
  if (experience?.target >= 4) {
    for (const requiredInstruction of [
      experience.asset,
      experience.output,
      experience.fallback,
      "show_widget",
    ]) {
      if (!instructions.includes(requiredInstruction)) {
        throw new Error(
          `${entry.id} runtime instructions omitted visual contract value ${requiredInstruction}.`,
        );
      }
    }
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

async function assertVisualRuntime({ entry, env, requestLog, turn }) {
  const result = await assertApplicationTurn({
    entry,
    marker: `OPENCLAW_E2E_APPLICATION_${entry.id.replaceAll("-", "_").toUpperCase()}`,
    requestLog,
    turn,
  });
  const requestRecords = (await readFile(requestLog, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const showWidgetRecord = requestRecords.find((record) => record.emittedTool === "show_widget");
  const postWidgetRecord = requestRecords.find((record) => record.step > showWidgetRecord?.step);
  if (!showWidgetRecord || !postWidgetRecord) {
    throw new Error(`${entry.id} did not execute show_widget.`);
  }
  const postWidgetRequest = JSON.parse(postWidgetRecord.body);
  if (
    !(postWidgetRequest.input ?? []).some((item) => item?.type === "function_call_output")
  ) {
    throw new Error(`${entry.id} show_widget did not return an executed tool result.`);
  }
  const config = JSON.parse(await readFile(env.OPENCLAW_CONFIG_PATH, "utf8"));
  const agentEntries = config.agents?.entries;
  const installed = Array.isArray(agentEntries)
    ? agentEntries.find((agent) => agent.id === entry.id)
    : agentEntries?.[entry.id];
  if (!installed?.workspace) {
    throw new Error(`${entry.id} installed workspace was not recorded.`);
  }
  for (const output of [
    "outputs/analysis-state.json",
    "outputs/analysis-readout.html",
    "outputs/analysis-readout.md",
  ]) {
    const content = await readFile(join(installed.workspace, output), "utf8");
    if (!content.trim()) {
      throw new Error(`${entry.id} produced an empty ${output}.`);
    }
  }
  const structuredState = JSON.parse(
    await readFile(join(installed.workspace, "outputs", "analysis-state.json"), "utf8"),
  );
  const semanticFindings = validateArtifactSemantics(entry.id, structuredState);
  if (semanticFindings.length > 0) {
    throw new Error(
      `${entry.id} produced semantically invalid state: ${JSON.stringify(semanticFindings)}`,
    );
  }
  return {
    ...result,
    status: "installed-visual-runtime-passed",
    showWidgetCall: "observed",
    outputs: [
      "outputs/analysis-state.json",
      "outputs/analysis-readout.html",
      "outputs/analysis-readout.md",
    ],
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
  const source = sourceOverride ? resolve(sourceOverride) : join(root, "claws", entry.id);
  const upgradeFixture = sourceOverride ? undefined : upgradeFixtures.get(entry.id);
  const installSource = upgradeFixture?.previousSource ?? source;
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
    packagePath: sourceOverride
      ? source
      : relative(root, installSource).replaceAll("\\", "/"),
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
    await writeFile(env.OPENCLAW_CONFIG_PATH, "{}\n", { flag: "wx" });
    const marker = `OPENCLAW_E2E_APPLICATION_${entry.id.replaceAll("-", "_").toUpperCase()}`;
    mockOpenAi = await startMockOpenAi(env, evidenceRoot, entry, marker);
    env = await configureMockModel(env, mockOpenAi.port);
    if ((entry.cronJobs?.length ?? 0) > 0 || visualRuntimeProof) {
      gateway = await startGateway(openClawEntry, env, entry.id, evidenceRoot);
      env = gateway.env;
      result.gateway = {
        mode: "local",
        port: gateway.port,
        purpose: "canonical-cron-owner",
        log: relative(proofRoot, gateway.logPath).replaceAll("\\", "/"),
      };
    }
    const standaloneInspection = assertStandaloneSuccess(
      recordPhase(phases, "standalone-inspect", () =>
        runStandalone(cliEntry, ["inspect", installSource], env, `${entry.id} standalone inspect`),
      ),
      "inspect",
    );
    result.package = standaloneInspection.package;

    const openClawInspection = recordPhase(phases, "openclaw-inspect", () =>
      runOpenClaw(openClawEntry, ["claws", "inspect", installSource], env, `${entry.id} inspect`),
    );
    if (openClawInspection.valid !== true || openClawInspection.manifest?.agent?.id !== entry.id) {
      throw new Error(`${entry.id} OpenClaw inspection did not preserve package identity.`);
    }
    result.openClawPackage = { source: openClawInspection.source };

    const adapterPreview = recordPhase(phases, "adapter-preview", () =>
      runStandalone(
        cliEntry,
        [installSource, "--agent", "openclaw", "--dry-run"],
        env,
        `${entry.id} add preview`,
      ),
    );
    assertAddPreview(assertStandaloneSuccess(adapterPreview, "preview"));
    result.adapterPreview = "passed";
    const addPlan = assertAddPreview(
      recordPhase(phases, "add-preview", () =>
        runOpenClaw(
          openClawEntry,
          ["claws", "add", installSource, "--dry-run"],
          env,
          `${entry.id} add preview`,
        ),
      ),
    );
    result.readiness = addPlan.readiness ?? { ready: true, requirements: [] };
    result.openClawPackage.planIntegrity = addPlan.planIntegrity;
    result.openClawPackage.plannedClaw = addPlan.claw;
    for (const expectedCron of entry.cronJobs ?? []) {
      const cronAction = addPlan.actions?.find(
        (action) => action.kind === "cronJob" && action.id === expectedCron.id,
      );
      const projected = cronAction?.details;
      if (
        cronAction?.action !== "schedule" ||
        JSON.stringify(projected?.schedule) !== JSON.stringify(expectedCron.schedule) ||
        projected?.session !== expectedCron.session ||
        projected?.message !== expectedCron.message ||
        JSON.stringify(projected?.delivery) !== JSON.stringify(expectedCron.delivery) ||
        projected?.agentId !== entry.id
      ) {
        throw new Error(`${entry.id} add plan did not preserve its declared cron contract.`);
      }
    }

    const addResult = assertSchema(
      recordPhase(phases, "add-apply", () =>
        runOpenClaw(
          openClawEntry,
          [
            "claws",
            "add",
            installSource,
            "--yes",
            "--plan-integrity",
            addPlan.planIntegrity,
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
    assertInstalledCapabilities(entry, addPlan, addResult);
    await assertInstalledBootstrap(entry, addPlan, addResult);
    result.capabilityProofMode = "installed-declarations";
    let userOwnedState;
    if (entry.bootstrap) {
      const workspace = addResult.agent.workspace;
      const path = join(workspace, "USER.md");
      const content = `# Local preferences\n\nProof marker: ${entry.id}\n`;
      await writeFile(path, content, { flag: "wx" });
      userOwnedState = { path, content };
      result.bootstrapState = "synthetic-user-owned-preferences-created";
    }

    const applicationTurn = visualRuntimeProof
      ? await recordAsyncPhase(phases, "application-scenario", () =>
          runGatewayApplicationTurn({ entry, gateway, marker }),
        )
      : recordPhase(phases, "application-scenario", () =>
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
    result.applicationScenario = visualRuntimeProof
      ? await assertVisualRuntime({
          entry,
          env,
          requestLog: mockOpenAi.requestLog,
          turn: applicationTurn,
        })
      : await assertApplicationTurn({
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

    if (upgradeFixture) {
      assertInstalledVersion(status, upgradeFixture.previousVersion, `${entry.id} initial status`);
      const workspace = addResult.agent?.workspace;
      if (typeof workspace !== "string" || workspace.length === 0) {
        throw new Error(`${entry.id} upgrade proof requires an installed workspace.`);
      }
      const priorLegacy = join(
        upgradeFixture.previousSource,
        "templates",
        "legacy-follow-up.md",
      );
      for (const [path, sourcePath] of upgradeFixture.directlySourcedChangedPaths) {
        await assertFileMatches(
          join(workspace, path),
          join(upgradeFixture.previousSource, sourcePath),
          entry.id,
        );
      }
      await assertFileMatches(join(workspace, upgradeFixture.removedPath), priorLegacy, entry.id);
      for (const path of upgradeFixture.addedPaths) {
        await assertFileMissing(join(workspace, path), entry.id);
      }

      const updatePlan = assertUpdatePlan(
        recordPhase(phases, "upgrade-preview", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "update", entry.id, "--from", source, "--dry-run"],
            env,
            `${entry.id} upgrade preview`,
          ),
        ),
        upgradeFixture,
        "forward",
        `${entry.id} upgrade`,
      );
      const rejected = recordPhase(phases, "upgrade-reject-stale-consent", () =>
        runOpenClaw(
          openClawEntry,
          [
            "claws",
            "update",
            entry.id,
            "--from",
            source,
            "--yes",
            "--plan-integrity",
            `sha256:${"0".repeat(64)}`,
          ],
          env,
          `${entry.id} stale-consent update`,
          [1],
        ),
      );
      if (rejected.status !== "failed" || rejected.error?.code !== "plan_integrity_mismatch") {
        throw new Error(`${entry.id} update did not reject stale plan integrity.`);
      }
      for (const [path, sourcePath] of upgradeFixture.directlySourcedChangedPaths) {
        await assertFileMatches(
          join(workspace, path),
          join(upgradeFixture.previousSource, sourcePath),
          entry.id,
        );
      }
      await assertFileMatches(join(workspace, upgradeFixture.removedPath), priorLegacy, entry.id);
      for (const path of upgradeFixture.addedPaths) {
        await assertFileMissing(join(workspace, path), entry.id);
      }
      const rejectedStatus = assertSchema(
        recordPhase(phases, "upgrade-rejected-status", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "status", entry.id],
            env,
            `${entry.id} rejected-update status`,
          ),
        ),
        "openclaw.clawStatus.v1",
        `${entry.id} rejected-update status`,
      );
      assertInstalledVersion(
        rejectedStatus,
        upgradeFixture.previousVersion,
        `${entry.id} rejected-update status`,
      );

      const updated = assertSchema(
        recordPhase(phases, "upgrade-apply", () =>
          runOpenClaw(
            openClawEntry,
            [
              "claws",
              "update",
              entry.id,
              "--from",
              source,
              "--yes",
              "--plan-integrity",
              updatePlan.planIntegrity,
            ],
            env,
            `${entry.id} upgrade apply`,
          ),
        ),
        "openclaw.clawUpdateResult.v1",
        `${entry.id} upgrade`,
      );
      const expectedActionCount =
        upgradeFixture.addedPaths.length +
        upgradeFixture.changedPaths.length +
        upgradeFixture.agentChanges +
        1;
      if (
        updated.status !== "complete" ||
        (updated.appliedActions?.length ?? 0) !== expectedActionCount
      ) {
        throw new Error(`${entry.id} upgrade did not apply the expected managed deltas.`);
      }
      for (const [path, sourcePath] of upgradeFixture.directlySourcedChangedPaths) {
        await assertFileMatches(join(workspace, path), join(source, sourcePath), entry.id);
      }
      for (const path of upgradeFixture.addedPaths) {
        await assertFileMatches(join(workspace, path), join(source, path), entry.id);
      }
      await assertFileMissing(join(workspace, upgradeFixture.removedPath), entry.id);
      await assertUserOwnedState(userOwnedState, `${entry.id} upgrade`);
      const upgradedStatus = assertSchema(
        recordPhase(phases, "upgrade-status", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "status", entry.id],
            env,
            `${entry.id} upgraded status`,
          ),
        ),
        "openclaw.clawStatus.v1",
        `${entry.id} upgraded status`,
      );
      assertInstalledVersion(
        upgradedStatus,
        upgradeFixture.targetVersion,
        `${entry.id} upgraded status`,
      );

      const rollbackPlan = assertUpdatePlan(
        recordPhase(phases, "rollback-preview", () =>
          runOpenClaw(
            openClawEntry,
            [
              "claws",
              "update",
              entry.id,
              "--from",
              upgradeFixture.previousSource,
              "--dry-run",
            ],
            env,
            `${entry.id} rollback preview`,
          ),
        ),
        upgradeFixture,
        "rollback",
        `${entry.id} rollback`,
      );
      const rolledBack = assertSchema(
        recordPhase(phases, "rollback-apply", () =>
          runOpenClaw(
            openClawEntry,
            [
              "claws",
              "update",
              entry.id,
              "--from",
              upgradeFixture.previousSource,
              "--yes",
              "--plan-integrity",
              rollbackPlan.planIntegrity,
            ],
            env,
            `${entry.id} rollback apply`,
          ),
        ),
        "openclaw.clawUpdateResult.v1",
        `${entry.id} rollback`,
      );
      if (
        rolledBack.status !== "complete" ||
        (rolledBack.appliedActions?.length ?? 0) !== expectedActionCount
      ) {
        throw new Error(`${entry.id} rollback did not restore the expected managed deltas.`);
      }
      for (const [path, sourcePath] of upgradeFixture.directlySourcedChangedPaths) {
        await assertFileMatches(
          join(workspace, path),
          join(upgradeFixture.previousSource, sourcePath),
          entry.id,
        );
      }
      await assertFileMatches(join(workspace, upgradeFixture.removedPath), priorLegacy, entry.id);
      for (const path of upgradeFixture.addedPaths) {
        await assertFileMissing(join(workspace, path), entry.id);
      }
      await assertUserOwnedState(userOwnedState, `${entry.id} rollback`);
      const rolledBackStatus = assertSchema(
        recordPhase(phases, "rollback-status", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "status", entry.id],
            env,
            `${entry.id} rolled-back status`,
          ),
        ),
        "openclaw.clawStatus.v1",
        `${entry.id} rolled-back status`,
      );
      assertInstalledVersion(
        rolledBackStatus,
        upgradeFixture.previousVersion,
        `${entry.id} rolled-back status`,
      );

      const repeatPlan = assertUpdatePlan(
        recordPhase(phases, "upgrade-repeat-preview", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "update", entry.id, "--from", source, "--dry-run"],
            env,
            `${entry.id} repeat upgrade preview`,
          ),
        ),
        upgradeFixture,
        "forward",
        `${entry.id} repeat upgrade`,
      );
      const repeated = assertSchema(
        recordPhase(phases, "upgrade-repeat-apply", () =>
          runOpenClaw(
            openClawEntry,
            [
              "claws",
              "update",
              entry.id,
              "--from",
              source,
              "--yes",
              "--plan-integrity",
              repeatPlan.planIntegrity,
            ],
            env,
            `${entry.id} repeat upgrade apply`,
          ),
        ),
        "openclaw.clawUpdateResult.v1",
        `${entry.id} repeat upgrade`,
      );
      if (
        repeated.status !== "complete" ||
        (repeated.appliedActions?.length ?? 0) !== expectedActionCount
      ) {
        throw new Error(`${entry.id} repeat upgrade did not apply the managed deltas.`);
      }
      for (const [path, sourcePath] of upgradeFixture.directlySourcedChangedPaths) {
        await assertFileMatches(join(workspace, path), join(source, sourcePath), entry.id);
      }
      for (const path of upgradeFixture.addedPaths) {
        await assertFileMatches(join(workspace, path), join(source, path), entry.id);
      }
      await assertFileMissing(join(workspace, upgradeFixture.removedPath), entry.id);
      await assertUserOwnedState(userOwnedState, `${entry.id} repeat upgrade`);
      const repeatedStatus = assertSchema(
        recordPhase(phases, "upgrade-repeat-status", () =>
          runOpenClaw(
            openClawEntry,
            ["claws", "status", entry.id],
            env,
            `${entry.id} repeated-upgrade status`,
          ),
        ),
        "openclaw.clawStatus.v1",
        `${entry.id} repeated-upgrade status`,
      );
      assertInstalledVersion(
        repeatedStatus,
        upgradeFixture.targetVersion,
        `${entry.id} repeated-upgrade status`,
      );
      result.upgradeProof = {
        status: "passed",
        previousVersion: upgradeFixture.previousVersion,
        targetVersion: upgradeFixture.targetVersion,
        managedDelta: {
          added: upgradeFixture.addedPaths.length,
          changed: upgradeFixture.changedPaths.length + upgradeFixture.agentChanges,
          removed: 1,
        },
        staleConsent: "rejected-before-mutation",
        rollback: "public-update-path-passed",
        repeatUpgrade: "passed",
      };
    } else {
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
      const updated = assertSchema(
        recordPhase(phases, "update-apply", () =>
          runOpenClaw(
            openClawEntry,
            [
              "claws",
              "update",
              entry.id,
              "--yes",
              "--plan-integrity",
              updatePlan.planIntegrity,
            ],
            env,
            `${entry.id} update apply`,
          ),
        ),
        "openclaw.clawUpdateResult.v1",
        `${entry.id} update`,
      );
      if (updated.status !== "complete" || (updated.appliedActions?.length ?? 0) !== 0) {
        throw new Error(`${entry.id} no-op update did not complete without mutations.`);
      }
    }
    if (userOwnedState) {
      await assertUserOwnedState(userOwnedState, `${entry.id} update`);
      result.bootstrapState = "synthetic-user-owned-preferences-preserved-after-update";
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
    const exportedOpenClawInspection = recordPhase(phases, "export-openclaw-inspect", () =>
      runOpenClaw(
        openClawEntry,
        ["claws", "inspect", exportRoot],
        env,
        `${entry.id} exported OpenClaw inspect`,
      ),
    );
    if (
      exportedOpenClawInspection.valid !== true ||
      exportedOpenClawInspection.manifest?.agent?.id !== entry.id
    ) {
      throw new Error(`${entry.id} exported OpenClaw inspection lost package identity.`);
    }

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
    if (userOwnedState) {
      const retained = await readFile(userOwnedState.path, "utf8");
      if (retained !== userOwnedState.content) {
        throw new Error(`${entry.id} removal changed user-owned USER.md state.`);
      }
      result.bootstrapState = "synthetic-user-owned-preferences-preserved-after-remove";
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

  const cleanup = await Promise.allSettled([stopGateway(gateway), stopGateway(mockOpenAi)]);
  const cleanupFailure = cleanup.find((outcome) => outcome.status === "rejected");
  if (cleanupFailure?.status === "rejected") {
    result.status = "lifecycle-failed";
    result.failure = failureRecord("cleanup", cleanupFailure.reason);
    result.failure.provisionalOwner = "proof-harness-defect";
  }

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
  evidenceClaims: {
    materialization: "byte-for-byte generated-output check",
    lifecycle: "isolated local inspect/add/status/export/remove",
    applicationRuntime: "deterministic OpenAI-compatible fixture",
    providerLive: false,
  },
  lifecyclePassed: results.filter((result) => result.status === "lifecycle-passed").length,
  lifecycleFailed: results.filter((result) => result.status === "lifecycle-failed").length,
  applicationScenariosPassed: results.filter(
    (result) =>
      result.applicationScenario.status === "runtime-wiring-passed" ||
      result.applicationScenario.status === "installed-visual-runtime-passed",
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
      evidenceClaims: summary.evidenceClaims,
      lifecyclePassed: summary.lifecyclePassed,
      lifecycleFailed: summary.lifecycleFailed,
      applicationScenariosPassed: summary.applicationScenariosPassed,
      results: summary.results.map((result) => ({
        id: result.id,
        status: result.status,
        adapterPreview: result.adapterPreview,
        applicationScenario: result.applicationScenario.status,
        capabilityProofMode: result.capabilityProofMode,
        openClawPackage: result.openClawPackage,
        ...(result.bootstrapState ? { bootstrapState: result.bootstrapState } : {}),
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
