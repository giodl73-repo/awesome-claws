import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactIdentity,
  assertSafeTarEntries,
  assertSafeTarEntryTypes,
  createArtifactResponse,
} from "./golden-artifact-proof-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = requiredPath("GOLDEN_CLAW_ARTIFACT");
const clawHubEntry = requiredPath("CLAWHUB_CLI_ENTRY");
const packageName = "@awesome-claws/travel-concierge";
const version = "0.1.0";
const artifactBytes = await readFile(artifactPath);
const identity = artifactIdentity(artifactBytes);
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const proofRoot = resolve(
  process.env.GOLDEN_PROOF_DIR ?? join(root, ".tmp", "proof", `golden-${runId}`),
);
const runtimeRoot = await mkdtemp(join(tmpdir(), "awesome-claws-golden-registry-"));
const downloadedPath = join(proofRoot, "travel-concierge-0.1.0.tgz");
const extractedRoot = join(proofRoot, "extracted");
await mkdir(proofRoot, { recursive: true });

let uploaded = false;
const server = createServer(async (request, response) => {
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
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
      if (!uploaded) {
        return sendJson(response, 404, { error: "not_published" });
      }
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
const registry = `http://127.0.0.1:${server.address().port}`;
const configPath = join(runtimeRoot, "clawhub-config.json");
await writeFile(configPath, `${JSON.stringify({ registry, token: "local-proof-token" })}\n`);
const cliEnv = {
  ...process.env,
  CLAWHUB_CONFIG_PATH: configPath,
  CLAWHUB_REGISTRY: registry,
  NO_COLOR: "1",
};

let publish;
let download;
let lifecycle;
try {
  process.stderr.write("RUN  clawhub-publish\n");
  publish = await runClawHub(
    [
      "package",
      "publish",
      artifactPath,
      "--family",
      "claw",
      "--json",
    ],
    cliEnv,
  );
  process.stderr.write("PASS clawhub-publish\nRUN  clawhub-download\n");
  download = await runClawHub(
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

  const listing = await runCommand("tar", ["-tzf", downloadedPath], process.env);
  const entries = listing.stdout.split(/\r?\n/u).filter(Boolean);
  assertSafeTarEntries(entries);
  const verboseListing = await runCommand("tar", ["-tvzf", downloadedPath], process.env);
  assertSafeTarEntryTypes(verboseListing.stdout.split(/\r?\n/u).filter(Boolean));
  await mkdir(extractedRoot, { recursive: true });
  await runCommand("tar", ["-xzf", downloadedPath, "-C", extractedRoot], process.env);
  process.stderr.write("PASS artifact-extract\nRUN  openclaw-lifecycle\n");

  const lifecycleEnv = {
    ...process.env,
    PORTFOLIO_ONLY: "travel-concierge",
    PORTFOLIO_SOURCE_ROOT: join(extractedRoot, "package"),
    PORTFOLIO_PROOF_DIR: join(proofRoot, "lifecycle"),
  };
  lifecycle = await runCommand(
    process.execPath,
    [join(root, "scripts", "prove-portfolio.mjs")],
    lifecycleEnv,
    { streamStderr: true },
  );
  process.stderr.write("PASS openclaw-lifecycle\n");

  const summary = {
    schemaVersion: "awesomeClaws.goldenArtifactProof.v1",
    package: `${packageName}@${version}`,
    artifact: {
      sourcePath: artifactPath,
      downloadedPath,
      bytes: artifactBytes.byteLength,
      ...identity,
    },
    registry: {
      mode: "disposable-local-fixture",
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
  await new Promise((resolveClosed) => server.close(resolveClosed));
  await rm(runtimeRoot, { recursive: true, force: true });
}

function requiredPath(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must point to the corresponding built checkout artifact.`);
  }
  return resolve(value);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
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

async function runClawHub(args, env) {
  const runtime = process.env.CLAWHUB_CLI_RUNTIME?.trim() ||
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
      if (options.streamStderr) {
        process.stderr.write(chunk);
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
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
