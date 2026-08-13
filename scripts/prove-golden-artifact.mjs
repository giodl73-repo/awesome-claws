import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactIdentity,
  createArtifactResponse,
  inspectAndExtractTarball,
} from "./golden-artifact-proof-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(
  process.env.GOLDEN_CLAW_SOURCE ?? join(root, "claws", "travel-concierge"),
);
const openClawEntry = requiredPath("OPENCLAW_CLI_ENTRY");
const clawHubEntry = requiredPath("CLAWHUB_CLI_ENTRY");
const packageName = "@awesome-claws/travel-concierge";
const version = "0.1.0";
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const proofRoot = resolve(
  process.env.GOLDEN_PROOF_DIR ?? join(root, ".tmp", "proof", `golden-${runId}`),
);
await mkdir(join(root, ".tmp"), { recursive: true });
const runtimeRoot = await mkdtemp(join(root, ".tmp", "golden-registry-"));
const artifactPath = join(proofRoot, "build", "travel-concierge-0.1.0.tgz");
const comparisonArtifactPath = join(proofRoot, "build", "travel-concierge-0.1.0-second.tgz");
const downloadedPath = join(proofRoot, "travel-concierge-0.1.0.tgz");
const extractedRoot = join(proofRoot, "extracted");

let server;
let serverListening = false;
try {
  await mkdir(dirname(proofRoot), { recursive: true });
  await mkdir(proofRoot);
  await mkdir(dirname(artifactPath), { recursive: true });

  const buildEnv = {
    ...process.env,
    HOME: join(runtimeRoot, "home"),
    OPENCLAW_CONFIG_PATH: join(runtimeRoot, "state", "openclaw.json"),
    OPENCLAW_EXPERIMENTAL_CLAWS: "1",
    OPENCLAW_HOME: join(runtimeRoot, "state"),
    OPENCLAW_STATE_DIR: join(runtimeRoot, "state"),
    TEMP: join(runtimeRoot, "tmp"),
    TMP: join(runtimeRoot, "tmp"),
    TMPDIR: join(runtimeRoot, "tmp"),
  };
  await mkdir(buildEnv.HOME, { recursive: true });
  await mkdir(buildEnv.OPENCLAW_STATE_DIR, { recursive: true });
  await mkdir(buildEnv.TMPDIR, { recursive: true });
  await writeFile(buildEnv.OPENCLAW_CONFIG_PATH, "{}\n", { flag: "wx" });

  process.stderr.write("RUN  openclaw-validate\n");
  const validation = parseJsonResult(
    await runOpenClaw(["claws", "validate", sourceRoot, "--json"], buildEnv),
    "OpenClaw validation",
  );
  process.stderr.write("PASS openclaw-validate\nRUN  openclaw-dev\n");
  const development = parseJsonResult(
    await runOpenClaw(["claws", "dev", sourceRoot, "--json"], buildEnv, {
      acceptedCodes: [0, 1],
    }),
    "OpenClaw development preview",
  );
  assertGoldenDevelopmentPlan(development);
  process.stderr.write("PASS openclaw-dev\nRUN  openclaw-build-twice\n");
  const firstBuild = parseJsonResult(
    await runOpenClaw(
      ["claws", "build", sourceRoot, "--out", artifactPath, "--json"],
      buildEnv,
    ),
    "first OpenClaw build",
  );
  const secondBuild = parseJsonResult(
    await runOpenClaw(
      ["claws", "build", sourceRoot, "--out", comparisonArtifactPath, "--json"],
      buildEnv,
    ),
    "second OpenClaw build",
  );
  const artifactBytes = await readFile(artifactPath);
  const comparisonBytes = await readFile(comparisonArtifactPath);
  if (!artifactBytes.equals(comparisonBytes) || firstBuild.integrity !== secondBuild.integrity) {
    throw new Error("Two builds from the checked-out Golden Claw produced different artifacts.");
  }
  const identity = artifactIdentity(artifactBytes);
  if (
    firstBuild.integrity !== `sha256:${identity.sha256}` ||
    development.build?.integrity !== firstBuild.integrity ||
    firstBuild.claw?.name !== packageName ||
    firstBuild.claw?.version !== version
  ) {
    throw new Error("The Golden Claw build identity does not match its development preview.");
  }
  process.stderr.write("PASS openclaw-build-twice\n");

  let uploaded = false;
  const authenticatedApiRequests = [];
  server = createServer(async (request, response) => {
    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      if (request.url?.startsWith("/api/")) {
        if (request.headers.authorization !== "Bearer local-proof-token") {
          return sendJson(response, 401, { error: "unauthorized" });
        }
        authenticatedApiRequests.push(`${request.method} ${request.url}`);
      }
      if (request.method === "POST" && request.url === "/api/v1/packages") {
        const body = await readRequestBody(request);
        const webRequest = new Request(`${baseUrl}${request.url}`, {
          method: "POST",
          headers: request.headers,
          body,
        });
        const form = await webRequest.formData();
        const payload = JSON.parse(String(form.get("payload")));
        const clawpack = form.get("clawpack");
        if (!(clawpack instanceof Blob)) {
          throw new Error("ClawHub publish did not upload a clawpack file.");
        }
        const uploadedBytes = Buffer.from(await clawpack.arrayBuffer());
        const uploadedIdentity = artifactIdentity(uploadedBytes);
        if (
          payload.name !== packageName ||
          payload.version !== version ||
          payload.family !== "claw" ||
          payload.expectedArtifactSha256 !== identity.sha256 ||
          uploadedIdentity.sha256 !== identity.sha256
        ) {
          throw new Error("ClawHub publish did not preserve the expected Claw artifact identity.");
        }
        uploaded = true;
        return sendJson(response, 200, {
          ok: true,
          packageId: "pkg_travel_concierge",
          releaseId: "rel_travel_concierge_0_1_0",
          publicationStatus: "published",
          artifactSha256: identity.sha256,
        });
      }

      const artifactRoute =
        `/api/v1/packages/${encodeURIComponent(packageName)}` +
        `/versions/${encodeURIComponent(version)}/artifact`;
      if (request.method === "GET" && request.url === artifactRoute) {
        if (!uploaded) return sendJson(response, 404, { error: "not_published" });
        return sendJson(
          response,
          200,
          createArtifactResponse({
            baseUrl,
            identity,
            packageName,
            size: artifactBytes.byteLength,
            version,
          }),
        );
      }
      if (request.method === "GET" && request.url === "/artifact.tgz") {
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": artifactBytes.byteLength,
        });
        response.end(artifactBytes);
        return;
      }
      sendJson(response, 404, { error: "not_found", path: request.url });
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  serverListening = true;
  const registry = `http://127.0.0.1:${server.address().port}`;
  const configPath = join(runtimeRoot, "clawhub-config.json");
  await writeFile(configPath, `${JSON.stringify({ registry, token: "local-proof-token" })}\n`);
  const cliEnv = {
    ...process.env,
    CLAWHUB_CONFIG_PATH: configPath,
    CLAWHUB_REGISTRY: registry,
    NO_COLOR: "1",
  };

  process.stderr.write("RUN  clawhub-publish\n");
  const publish = await runClawHub(
    ["package", "publish", artifactPath, "--family", "claw", "--json"],
    cliEnv,
  );
  process.stderr.write("PASS clawhub-publish\nRUN  clawhub-download\n");
  const download = await runClawHub(
    [
      "package",
      "download",
      packageName,
      "--version",
      version,
      "--output",
      downloadedPath,
      "--force",
      "--json",
    ],
    cliEnv,
  );
  process.stderr.write("PASS clawhub-download\nRUN  artifact-extract\n");
  const downloadedBytes = await readFile(downloadedPath);
  const downloadedIdentity = artifactIdentity(downloadedBytes);
  if (!uploaded || downloadedIdentity.sha256 !== identity.sha256) {
    throw new Error("The downloaded artifact differs from the built and uploaded artifact.");
  }
  await mkdir(extractedRoot);
  await inspectAndExtractTarball(downloadedPath, extractedRoot);
  await assertArtifactMatchesSource(
    sourceRoot,
    join(extractedRoot, "package"),
    firstBuild.files,
  );
  process.stderr.write("PASS artifact-extract\nRUN  openclaw-lifecycle\n");

  const revisions = {
    awesomeClaws: resolveRevision(root, process.env.AWESOME_CLAWS_REVISION),
    openClaw: resolveRevision(dirname(openClawEntry), process.env.OPENCLAW_REVISION),
    clawHub: resolveRevision(
      resolve(dirname(clawHubEntry), "../../.."),
      process.env.CLAWHUB_REVISION,
    ),
  };
  const lifecycleEnv = {
    ...process.env,
    AWESOME_CLAWS_REVISION: revisions.awesomeClaws,
    OPENCLAW_REVISION: revisions.openClaw,
    PORTFOLIO_ONLY: "travel-concierge",
    PORTFOLIO_SOURCE_ROOT: join(extractedRoot, "package"),
    PORTFOLIO_PROOF_DIR: join(proofRoot, "lifecycle"),
  };
  const lifecycle = await runCommand(
    process.execPath,
    [join(root, "scripts", "prove-portfolio.mjs")],
    lifecycleEnv,
    { streamStderr: true },
  );
  process.stderr.write("PASS openclaw-lifecycle\n");

  const requiredAuthenticatedRequests = [
    "POST /api/v1/packages",
    `GET /api/v1/packages/${encodeURIComponent(packageName)}/versions/${encodeURIComponent(version)}/artifact`,
  ];
  if (!requiredAuthenticatedRequests.every((request) => authenticatedApiRequests.includes(request))) {
    throw new Error("The ClawHub client did not authenticate every registry API request.");
  }

  const summary = {
    schemaVersion: "awesomeClaws.goldenArtifactProof.v1",
    package: `${packageName}@${version}`,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      experimentalGates: { OPENCLAW_EXPERIMENTAL_CLAWS: "1" },
      revisions,
    },
    build: {
      sourceRoot,
      deterministic: true,
      validation,
      development,
      first: firstBuild,
      second: secondBuild,
    },
    artifact: {
      sourcePath: artifactPath,
      downloadedPath,
      bytes: artifactBytes.byteLength,
      ...identity,
    },
    registry: {
      mode: "disposable-local-fixture",
      authenticatedApiRequests,
      exactUploadVerified: uploaded,
      exactDownloadVerified: true,
      publish: JSON.parse(publish.stdout),
      download: JSON.parse(download.stdout),
    },
    openclaw: {
      source: "verified downloaded artifact/package",
      lifecycle: JSON.parse(lifecycle.stdout),
    },
  };
  await writeFile(join(proofRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, proofRoot }, null, 2));
} finally {
  if (serverListening) {
    await new Promise((resolveClosed) => server.close(resolveClosed));
  }
  await rm(runtimeRoot, { recursive: true, force: true });
}

function requiredPath(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must point to the corresponding built checkout entry.`);
  return resolve(value);
}

function parseJsonResult(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not emit JSON: ${error.message}\n${result.stdout}`);
  }
}

function assertGoldenDevelopmentPlan(development) {
  if (
    development.schemaVersion !== "openclaw.clawDev.v1" ||
    development.offline !== true ||
    development.mutationAllowed !== false
  ) {
    throw new Error("OpenClaw dev did not remain offline and non-mutating.");
  }
  const actions = new Set(
    (development.plan?.actions ?? []).map((action) => `${action.kind}:${action.id}`),
  );
  const expected = [
    "bootstrap:BOOTSTRAP.md",
    "workspaceFile:schemas/travel-shortlist.schema.json",
    "workspaceFile:assets/travel-command-center.html",
    "workspaceFile:templates/travel-comparison.md",
    "package:plugin:@expediagroup/expedia-openclaw",
    "mcpServer:mapbox",
    "cronJob:daily-trip-readiness-refresh",
  ];
  const missing = expected.filter((action) => !actions.has(action));
  if (missing.length > 0) {
    throw new Error(`OpenClaw dev omitted Golden application actions: ${missing.join(", ")}`);
  }
}

async function assertArtifactMatchesSource(source, extracted, expectedFiles) {
  const actualFiles = await listFiles(extracted);
  const expected = [...expectedFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expected)) {
    throw new Error("The built artifact file inventory does not match OpenClaw's build result.");
  }
  for (const path of expected) {
    const [sourceBytes, artifactBytes] = await Promise.all([
      readFile(join(source, path)),
      readFile(join(extracted, path)),
    ]);
    if (path === "package.json") {
      const sourcePackage = JSON.parse(sourceBytes);
      const artifactPackage = JSON.parse(artifactBytes);
      delete sourcePackage.private;
      if (JSON.stringify(sourcePackage) !== JSON.stringify(artifactPackage)) {
        throw new Error("The built package.json differs beyond npm's private-field removal.");
      }
      continue;
    }
    if (!sourceBytes.equals(artifactBytes)) {
      throw new Error(`The built artifact does not match checked-out source bytes: ${path}`);
    }
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

function resolveRevision(repositoryRoot, override) {
  if (override?.trim()) return override.trim();
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${repositoryRoot}`, "-C", repositoryRoot, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Could not resolve revision for ${repositoryRoot}.`);
  }
  return result.stdout.trim();
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sendJson(response, status, value) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": body.byteLength,
  });
  response.end(body);
}

async function runOpenClaw(args, env, options) {
  return await runCommand(process.execPath, [openClawEntry, ...args], env, options);
}

async function runClawHub(args, env) {
  const runtime =
    process.env.CLAWHUB_CLI_RUNTIME?.trim() ||
    (extname(clawHubEntry) === ".ts" ? "bun" : process.execPath);
  return await runCommand(runtime, [clawHubEntry, ...args], env, { streamStderr: true });
}

async function runCommand(command, args, env, options = {}) {
  return await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (options.streamStderr) process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if ((options.acceptedCodes ?? [0]).includes(code)) {
        resolveRun({ stdout, stderr, code });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed (${code ?? "signal"}).\n${stderr || stdout}`,
        ),
      );
    });
  });
}
