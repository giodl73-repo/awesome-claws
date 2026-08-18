import { createHash } from "node:crypto";
import yauzl from "yauzl";

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const SHA1_HEX = /^[a-f0-9]{40}$/u;

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

export function parsePinnedSkillRef(ref) {
  const match = /^@([a-z0-9](?:[a-z0-9-]{0,38}))\/([a-z0-9][a-z0-9-]{0,63})$/u.exec(ref);
  if (!match) {
    throw new Error(`ClawHub skill ref must pin its publisher as @owner/slug: ${ref}`);
  }
  return { ownerHandle: match[1], slug: match[2] };
}

export function buildDependencyInventory(catalog) {
  const dependencies = new Map();
  const add = (key, dependency, consumer) => {
    const current = dependencies.get(key) ?? { ...dependency, consumers: [] };
    if (
      dependency.runtimeId &&
      current.runtimeId &&
      dependency.runtimeId !== current.runtimeId
    ) {
      throw new Error(`${dependency.ref}@${dependency.version} declares conflicting runtime IDs.`);
    }
    if (dependency.runtimeId) {
      current.runtimeId = dependency.runtimeId;
    }
    current.consumers.push(consumer);
    dependencies.set(key, current);
  };

  for (const entry of catalog.entries) {
    for (const pkg of entry.packages ?? []) {
      if (pkg.source !== "clawhub") {
        throw new Error(`${entry.id} uses unsupported dependency source ${pkg.source}.`);
      }
      if (pkg.kind === "skill") {
        const parsed = parsePinnedSkillRef(pkg.ref);
        add(
          `skill:${parsed.ownerHandle}/${parsed.slug}@${pkg.version}`,
          {
            type: "clawhub-skill",
            ref: pkg.ref,
            version: pkg.version,
            ...parsed,
          },
          { claw: entry.id, surface: "package" },
        );
      } else if (pkg.kind === "plugin") {
        add(
          `plugin:${pkg.ref}@${pkg.version}`,
          {
            type: "clawhub-plugin",
            ref: pkg.ref,
            version: pkg.version,
          },
          { claw: entry.id, surface: "package" },
        );
      } else {
        throw new Error(`${entry.id} uses unsupported package kind ${pkg.kind}.`);
      }
    }

    for (const extension of entry.openclawProfile?.extensions ?? []) {
      if (
        extension.kind !== "plugin" ||
        extension.source !== "clawhub" ||
        extension.format !== "openclaw"
      ) {
        throw new Error(`${entry.id} uses an unsupported extension dependency.`);
      }
      add(
        `plugin:${extension.ref}@${extension.version}`,
        {
          type: "clawhub-plugin",
          ref: extension.ref,
          version: extension.version,
          runtimeId: extension.id,
        },
        { claw: entry.id, surface: "extension" },
      );
    }

    for (const [name, server] of Object.entries(entry.mcpServers ?? {})) {
      if (server.auth !== "oauth" || server.transport !== "streamable-http") {
        throw new Error(`${entry.id} uses an unsupported MCP health contract for ${name}.`);
      }
      const url = new URL(server.url);
      if (url.protocol !== "https:") {
        throw new Error(`${entry.id} MCP server ${name} must use HTTPS.`);
      }
      add(
        `mcp:${server.url}`,
        {
          type: "oauth-mcp",
          name,
          url: server.url,
          transport: server.transport,
          auth: server.auth,
        },
        { claw: entry.id, surface: "mcpServer" },
      );
    }
  }

  return [...dependencies.values()]
    .map((dependency) => ({
      ...dependency,
      consumers: dependency.consumers.sort((a, b) =>
        `${a.claw}:${a.surface}`.localeCompare(`${b.claw}:${b.surface}`),
      ),
    }))
    .sort((a, b) => `${a.type}:${a.ref ?? a.url}`.localeCompare(`${b.type}:${b.ref ?? b.url}`));
}

export function validateSkillVerification(dependency, response) {
  if (
    response?.schema !== "clawhub.skill.verify.v1" ||
    response.ok !== true ||
    response.decision !== "pass" ||
    response.slug !== dependency.slug ||
    response.publisherHandle !== dependency.ownerHandle ||
    response.version !== dependency.version
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} identity verification failed.`);
  }
  if (
    (response.artifact?.sourceFingerprint != null &&
      !SHA256_HEX.test(response.artifact.sourceFingerprint)) ||
    !Array.isArray(response.artifact?.bundleFingerprints) ||
    response.artifact.bundleFingerprints.length === 0 ||
    response.artifact.bundleFingerprints.some((digest) => !SHA256_HEX.test(digest)) ||
    !Array.isArray(response.artifact?.files) ||
    response.artifact.files.length === 0 ||
    response.artifact.files.some(
      (file) =>
        typeof file.path !== "string" ||
        !SHA256_HEX.test(file.sha256 ?? "") ||
        !Number.isSafeInteger(file.size) ||
        file.size < 0,
    )
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} lacks exact artifact identity.`);
  }
  if (
    response.card?.available !== true ||
    !SHA256_HEX.test(response.card.sha256 ?? "") ||
    typeof response.card.url !== "string"
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} lacks an exact skill card.`);
  }
  if (response.security?.passed !== true) {
    throw new Error(`${dependency.ref}@${dependency.version} no longer passes ClawHub security.`);
  }
  return {
    sourceFingerprint: response.artifact.sourceFingerprint,
    bundleFingerprints: response.artifact.bundleFingerprints,
    fileCount: response.artifact.files.length,
    files: response.artifact.files.map(({ path, sha256, size }) => ({ path, sha256, size })),
    card: { url: response.card.url, sha256: response.card.sha256 },
    securityStatus: response.security.status,
  };
}

export function validatePluginResponses(dependency, detail, versionResponse, artifactResponse) {
  const family = artifactResponse?.package?.family;
  const version =
    typeof artifactResponse?.version === "string"
      ? artifactResponse.version
      : artifactResponse?.version?.version;
  const artifact = artifactResponse?.artifact;
  if (
    artifactResponse?.package?.name !== dependency.ref ||
    !["code-plugin", "bundle-plugin"].includes(family) ||
    version !== dependency.version ||
    artifact?.kind !== "npm-pack"
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} plugin identity verification failed.`);
  }
  if (
    !SHA256_HEX.test(artifact.sha256 ?? artifact.artifactSha256 ?? "") ||
    typeof artifact.npmIntegrity !== "string" ||
    !artifact.npmIntegrity.startsWith("sha512-") ||
    !SHA1_HEX.test(artifact.npmShasum ?? "") ||
    !Number.isSafeInteger(artifact.size) ||
    artifact.size <= 0 ||
    typeof artifact.downloadUrl !== "string"
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} lacks exact artifact metadata.`);
  }
  if (
    versionResponse?.package?.name !== dependency.ref ||
    versionResponse?.version?.version !== dependency.version ||
    !["code-plugin", "bundle-plugin"].includes(versionResponse?.package?.family) ||
    versionResponse?.version?.verification?.scanStatus !== "clean"
  ) {
    throw new Error(`${dependency.ref}@${dependency.version} version metadata is inconsistent.`);
  }
  if (
    dependency.runtimeId &&
    (detail?.package?.name !== dependency.ref ||
      detail.package.runtimeId !== dependency.runtimeId ||
      !["code-plugin", "bundle-plugin"].includes(detail.package.family))
  ) {
    throw new Error(
      `${dependency.ref}@${dependency.version} runtime identity does not match ${dependency.runtimeId}.`,
    );
  }
  return {
    family,
    runtimeId: detail?.package?.runtimeId,
    artifact: {
      sha256: artifact.sha256 ?? artifact.artifactSha256,
      npmIntegrity: artifact.npmIntegrity,
      npmShasum: artifact.npmShasum,
      size: artifact.size,
      downloadUrl: artifact.downloadUrl,
    },
  };
}

export function downloadedIdentity(bytes) {
  const buffer = Buffer.from(bytes);
  return {
    size: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    npmIntegrity: `sha512-${createHash("sha512").update(buffer).digest("base64")}`,
    npmShasum: createHash("sha1").update(buffer).digest("hex"),
  };
}

export function assertDownloadedPluginIdentity(expected, actual) {
  for (const field of ["size", "sha256", "npmIntegrity", "npmShasum"]) {
    if (actual[field] !== expected[field]) {
      throw new Error(`Downloaded plugin ${field} does not match registry metadata.`);
    }
  }
}

export async function verifySkillArchive(bytes, verifiedFiles, generatedFiles) {
  const expected = new Map(
    verifiedFiles.map((file) => [file.path, { ...file, kind: "verified" }]),
  );
  expected.set("skill-card.md", { ...generatedFiles.card, kind: "card" });
  const allowedDirectories = new Set(
    [...expected.keys()].flatMap((path) => {
      const segments = path.split("/");
      return segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join("/")}/`);
    }),
  );
  const seenPaths = new Set();
  const verified = [];
  let card;
  let metadata;
  const zip = await new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      { autoClose: true, lazyEntries: true, validateEntrySizes: true },
      (error, opened) => (error ? reject(error) : resolve(opened)),
    );
  });
  return await new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      zip.close();
      reject(error);
    };
    zip.on("error", fail);
    zip.on("entry", (entry) => {
      const path = entry.fileName.replaceAll("\\", "/").normalize("NFC");
      const segments = path.split("/").filter(Boolean);
      const canonical = segments.join("/").toLowerCase();
      const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
      const fileType = mode & 0o170000;
      if (
        path.startsWith("/") ||
        /^[A-Za-z]:\//u.test(path) ||
        path.includes(":") ||
        segments.includes("..") ||
        seenPaths.has(canonical) ||
        (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000)
      ) {
        fail(new Error(`Unsafe entry in downloaded skill archive: ${entry.fileName}`));
        return;
      }
      seenPaths.add(canonical);
      if (entry.uncompressedSize > 64 * 1024 * 1024) {
        fail(new Error(`Oversized entry in downloaded skill archive: ${entry.fileName}`));
        return;
      }
      if (path.endsWith("/")) {
        if (!allowedDirectories.has(path)) {
          fail(new Error(`Unexpected entry in downloaded skill archive: ${entry.fileName}`));
          return;
        }
        zip.readEntry();
        return;
      }
      const expectedFile = expected.get(path);
      if (!expectedFile && path !== "_meta.json") {
        fail(new Error(`Unexpected entry in downloaded skill archive: ${entry.fileName}`));
        return;
      }
      zip.openReadStream(entry, (error, stream) => {
        if (error) {
          fail(error);
          return;
        }
        const hash = createHash("sha256");
        const chunks = [];
        let size = 0;
        stream.on("error", fail);
        stream.on("data", (chunk) => {
          size += chunk.length;
          hash.update(chunk);
          if (path === "_meta.json") {
            chunks.push(chunk);
          }
        });
        stream.on("end", () => {
          if (settled) {
            return;
          }
          const sha256 = hash.digest("hex");
          if (path === "_meta.json") {
            let parsed;
            try {
              parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {
              fail(new Error("Downloaded skill archive has invalid _meta.json."));
              return;
            }
            if (
              !parsed ||
              typeof parsed !== "object" ||
              Array.isArray(parsed) ||
              typeof parsed.ownerId !== "string" ||
              parsed.ownerId.length === 0 ||
              parsed.slug !== generatedFiles.slug ||
              parsed.version !== generatedFiles.version ||
              !Number.isSafeInteger(parsed.publishedAt) ||
              parsed.publishedAt <= 0
            ) {
              fail(new Error("Downloaded skill archive metadata does not match registry identity."));
              return;
            }
            metadata = {
              ownerId: parsed.ownerId,
              slug: parsed.slug,
              version: parsed.version,
              publishedAt: parsed.publishedAt,
              size,
              sha256,
            };
            zip.readEntry();
            return;
          }
          if (size !== expectedFile.size || sha256 !== expectedFile.sha256) {
            fail(new Error(`Downloaded skill file does not match verification metadata: ${path}`));
            return;
          }
          if (expectedFile.kind === "verified") {
            verified.push({ path, size, sha256 });
          } else {
            card = { path, size, sha256 };
          }
          zip.readEntry();
        });
      });
    });
    zip.on("end", () => {
      if (settled) {
        return;
      }
      const missing = [...expected.keys()].filter(
        (path) => path !== card?.path && !verified.some((file) => file.path === path),
      );
      if (missing.length > 0) {
        fail(new Error(`Downloaded skill archive lacks verified files: ${missing.join(", ")}`));
        return;
      }
      if (!card || !metadata) {
        fail(new Error("Downloaded skill archive lacks generated card or metadata evidence."));
        return;
      }
      settled = true;
      resolve({ verifiedFiles: verified, generatedFiles: { card, metadata } });
    });
    zip.readEntry();
  });
}

export function parseResourceMetadataUrl(wwwAuthenticate) {
  const match = /resource_metadata="([^"]+)"/iu.exec(wwwAuthenticate ?? "");
  if (!match) {
    throw new Error("OAuth MCP challenge lacks resource_metadata.");
  }
  const url = new URL(match[1]);
  if (url.protocol !== "https:") {
    throw new Error("OAuth MCP resource metadata must use HTTPS.");
  }
  return url.toString();
}

export function validateMcpMetadata(dependency, metadata, metadataUrl) {
  if (
    metadata?.resource !== dependency.url ||
    !Array.isArray(metadata.authorization_servers) ||
    metadata.authorization_servers.length === 0 ||
    metadata.authorization_servers.some((value) => new URL(value).protocol !== "https:")
  ) {
    throw new Error(`${dependency.name} MCP OAuth metadata does not match its declared endpoint.`);
  }
  return {
    resource: metadata.resource,
    resourceMetadata: metadataUrl,
    authorizationServers: metadata.authorization_servers,
    scopesSupported: metadata.scopes_supported ?? [],
  };
}

export function requireJsonObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must return a JSON object.`);
  }
  return value;
}

export function requireNonEmptyBytes(bytes, label) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error(`${label} returned an empty artifact.`);
  }
  return bytes;
}

export function requireExactCard(bytes, expectedSha256, label) {
  requireNonEmptyBytes(bytes, label);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== requireString(expectedSha256, `${label} sha256`)) {
    throw new Error(`${label} bytes do not match verification metadata.`);
  }
  return { size: bytes.byteLength, sha256: actual };
}
