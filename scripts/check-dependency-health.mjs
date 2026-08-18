import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readCatalog, root } from "./catalog-source.mjs";
import {
  assertDownloadedPluginIdentity,
  buildDependencyInventory,
  downloadedIdentity,
  parseResourceMetadataUrl,
  requireExactCard,
  requireJsonObject,
  requireNonEmptyBytes,
  validateMcpMetadata,
  validatePluginResponses,
  validateSkillVerification,
  verifySkillArchive,
} from "./dependency-health-lib.mjs";

const CLAWHUB_URL = (process.env.CLAWHUB_URL ?? "https://clawhub.ai").replace(/\/+$/u, "");
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

function endpoint(path) {
  return new URL(path, `${CLAWHUB_URL}/`).toString();
}

async function requestWithRetry(url, options, consume) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`)),
      FETCH_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, {
        ...(options ?? {}),
        signal: controller.signal,
        headers: {
          "User-Agent": "awesome-claws-dependency-health/1",
          ...(options?.headers ?? {}),
        },
      });
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        throw new Error(`${url} returned ${response.status}.`);
      }
      return await consume(response);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`${url} failed after 3 attempts: ${lastError?.message ?? "unknown error"}`);
}

async function readResponseBytes(response, maxBytes, label) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error(`${label} exceeds ${maxBytes} bytes.`);
  }
  if (!response.body) {
    throw new Error(`${label} returned no body.`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} exceeds ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return requireNonEmptyBytes(bytes, label);
}

async function fetchJson(url, options) {
  return await requestWithRetry(url, options, async (response) => {
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`${url} returned ${response.status}.`);
    }
    const bytes = await readResponseBytes(response, MAX_JSON_BYTES, url);
    return requireJsonObject(JSON.parse(new TextDecoder().decode(bytes)), url);
  });
}

async function fetchBytes(url, label) {
  return await requestWithRetry(url, undefined, async (response) => {
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`${label} returned ${response.status}.`);
    }
    return await readResponseBytes(response, MAX_ARTIFACT_BYTES, label);
  });
}

async function checkSkill(dependency) {
  const query = new URLSearchParams({
    ownerHandle: dependency.ownerHandle,
    version: dependency.version,
  });
  const verification = await fetchJson(
    endpoint(`/api/v1/skills/${encodeURIComponent(dependency.slug)}/verify?${query}`),
  );
  const identity = validateSkillVerification(dependency, verification);
  const downloadQuery = new URLSearchParams({
    slug: dependency.slug,
    ownerHandle: dependency.ownerHandle,
    version: dependency.version,
  });
  const [archive, cardBytes] = await Promise.all([
    fetchBytes(
      endpoint(`/api/v1/download?${downloadQuery}`),
      `${dependency.ref}@${dependency.version}`,
    ),
    fetchBytes(identity.card.url, `${dependency.ref}@${dependency.version} card`),
  ]);
  const card = requireExactCard(
    cardBytes,
    identity.card.sha256,
    `${dependency.ref}@${dependency.version} card`,
  );
  const archiveFiles = await verifySkillArchive(archive, identity.files, {
    card,
    slug: dependency.slug,
    version: dependency.version,
  });
  return {
    ...identity,
    archive: { ...downloadedIdentity(archive), ...archiveFiles },
    card,
  };
}

async function checkPlugin(dependency) {
  const packagePath = `/api/v1/packages/${encodeURIComponent(dependency.ref)}`;
  const versionPath = `${packagePath}/versions/${encodeURIComponent(dependency.version)}`;
  const [detail, version, artifact] = await Promise.all([
    fetchJson(endpoint(packagePath)),
    fetchJson(endpoint(versionPath)),
    fetchJson(endpoint(`${versionPath}/artifact`)),
  ]);
  const metadata = validatePluginResponses(dependency, detail, version, artifact);
  const downloaded = downloadedIdentity(
    await fetchBytes(
      metadata.artifact.downloadUrl,
      `${dependency.ref}@${dependency.version}`,
    ),
  );
  assertDownloadedPluginIdentity(metadata.artifact, downloaded);
  return { ...metadata, downloaded };
}

async function checkMcp(dependency) {
  const challengeResponse = await requestWithRetry(
    dependency.url,
    {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "awesome-claws-dependency-health", version: "1.0.0" },
        },
      }),
      redirect: "manual",
    },
    async (response) => {
      const value = {
        status: response.status,
        challenge: response.headers.get("www-authenticate"),
      };
      await response.body?.cancel();
      return value;
    },
  );
  if (![401, 403].includes(challengeResponse.status)) {
    throw new Error(`${dependency.name} MCP endpoint did not enforce its OAuth boundary.`);
  }
  const challenge = challengeResponse.challenge;
  if (!/^Bearer(?:\s|,)/iu.test(challenge ?? "")) {
    throw new Error(`${dependency.name} MCP endpoint did not return a Bearer challenge.`);
  }
  const metadataUrl = parseResourceMetadataUrl(challenge);
  const metadata = await fetchJson(metadataUrl);
  return {
    challengeStatus: challengeResponse.status,
    ...validateMcpMetadata(dependency, metadata, metadataUrl),
  };
}

async function checkDependency(dependency) {
  if (dependency.type === "clawhub-skill") {
    return await checkSkill(dependency);
  }
  if (dependency.type === "clawhub-plugin") {
    return await checkPlugin(dependency);
  }
  return await checkMcp(dependency);
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

export async function runDependencyHealth() {
  const inventory = buildDependencyInventory(await readCatalog());
  const checks = await runPool(inventory, 4, async (dependency) => {
    const startedAt = new Date().toISOString();
    const label = `${dependency.ref ?? dependency.url}${dependency.version ? `@${dependency.version}` : ""}`;
    process.stderr.write(`CHECK ${label}\n`);
    try {
      const evidence = await checkDependency(dependency);
      process.stderr.write(`PASS  ${label}\n`);
      return { ...dependency, status: "passed", startedAt, evidence };
    } catch (error) {
      process.stderr.write(`FAIL  ${label}: ${error.message}\n`);
      return { ...dependency, status: "failed", startedAt, error: error.message };
    }
  });
  const failed = checks.filter((check) => check.status === "failed");
  return {
    schemaVersion: "awesomeClaws.dependencyHealth.v1",
    generatedAt: new Date().toISOString(),
    registry: CLAWHUB_URL,
    credentialMode: "anonymous",
    dependencyCount: checks.length,
    consumerCount: checks.reduce((total, check) => total + check.consumers.length, 0),
    passed: checks.length - failed.length,
    failed: failed.length,
    status: failed.length === 0 ? "passed" : "failed",
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidenceRoot = join(root, ".tmp", "dependency-health");
  await mkdir(evidenceRoot, { recursive: true });
  let summary;
  try {
    summary = await runDependencyHealth();
  } catch (error) {
    summary = {
      schemaVersion: "awesomeClaws.dependencyHealth.v1",
      generatedAt: new Date().toISOString(),
      registry: CLAWHUB_URL,
      credentialMode: "anonymous",
      dependencyCount: 0,
      consumerCount: 0,
      passed: 0,
      failed: 1,
      status: "failed",
      checks: [],
      fatal: {
        phase: "inventory",
        message: error.message,
      },
    };
  }
  await writeFile(join(evidenceRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== "passed") {
    process.exitCode = 1;
  }
}
