import { createHash } from "node:crypto";
import { t, x } from "tar";

export function artifactIdentity(bytes) {
  const buffer = Buffer.from(bytes);
  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    npmIntegrity: `sha512-${createHash("sha512").update(buffer).digest("base64")}`,
    npmShasum: createHash("sha1").update(buffer).digest("hex"),
  };
}

export function assertSafeTarEntries(entries) {
  if (entries.length === 0) {
    throw new Error("The downloaded Claw artifact is empty.");
  }
  const seen = new Set();
  for (const rawEntry of entries) {
    const entry = rawEntry.replaceAll("\\", "/");
    const segments = entry.split("/").filter(Boolean);
    const canonical = segments.join("/").normalize("NFC").toLowerCase();
    if (
      entry.startsWith("/") ||
      /^[A-Za-z]:\//u.test(entry) ||
      entry.includes(":") ||
      segments.includes("..") ||
      segments[0] !== "package"
    ) {
      throw new Error(`Unsafe path in downloaded Claw artifact: ${rawEntry}`);
    }
    if (seen.has(canonical)) {
      throw new Error(`Duplicate or colliding path in downloaded Claw artifact: ${rawEntry}`);
    }
    seen.add(canonical);
  }
}

export function assertSafeTarEntryTypes(verboseEntries) {
  for (const type of verboseEntries) {
    if (type !== "File" && type !== "Directory") {
      throw new Error(`Unsafe entry type in downloaded Claw artifact: ${type}`);
    }
  }
}

export async function inspectAndExtractTarball(artifactPath, destination) {
  const entries = [];
  await t({
    file: artifactPath,
    onentry(entry) {
      entries.push({ path: entry.path, type: entry.type });
    },
  });
  assertSafeTarEntries(entries.map((entry) => entry.path));
  assertSafeTarEntryTypes(entries.map((entry) => entry.type));

  const filePaths = new Set(
    entries.filter((entry) => entry.type === "File").map((entry) => entry.path.replace(/\/$/u, "")),
  );
  for (const path of filePaths) {
    if ([...filePaths].some((candidate) => candidate !== path && candidate.startsWith(`${path}/`))) {
      throw new Error(`File/directory collision in downloaded Claw artifact: ${path}`);
    }
  }

  await x({ file: artifactPath, cwd: destination, preservePaths: false, strict: true });
  return entries;
}

export function createArtifactResponse({ baseUrl, identity, packageName, size, version }) {
  return {
    package: {
      name: packageName,
      displayName: "Travel Concierge",
      family: "claw",
    },
    version,
    artifact: {
      kind: "npm-pack",
      sha256: identity.sha256,
      size,
      npmIntegrity: identity.npmIntegrity,
      npmShasum: identity.npmShasum,
      npmTarballName: "travel-concierge-0.1.0.tgz",
      downloadUrl: `${baseUrl}/artifact.tgz`,
      source: "clawhub",
      artifactKind: "npm-pack",
      artifactSha256: identity.sha256,
      packageName,
      version,
    },
  };
}
