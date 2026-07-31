import { createHash } from "node:crypto";

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
  for (const rawEntry of entries) {
    const entry = rawEntry.replaceAll("\\", "/");
    const segments = entry.split("/").filter(Boolean);
    if (
      entry.startsWith("/") ||
      /^[A-Za-z]:\//u.test(entry) ||
      segments.includes("..") ||
      segments[0] !== "package"
    ) {
      throw new Error(`Unsafe path in downloaded Claw artifact: ${rawEntry}`);
    }
  }
}

export function assertSafeTarEntryTypes(verboseEntries) {
  for (const entry of verboseEntries) {
    const type = entry[0];
    if (type !== "-" && type !== "d") {
      throw new Error(`Unsafe entry type in downloaded Claw artifact: ${entry}`);
    }
  }
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
