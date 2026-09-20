import { readFile } from "node:fs/promises";

export const acceptedFixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/procure-to-pay-three-way-match-exception-reconciler/fixtures/procure-to-pay-three-way-match.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

export const failureCases = JSON.parse(
  await readFile(
    new URL(
      "../sources/procure-to-pay-three-way-match-exception-reconciler/fixtures/procure-to-pay-three-way-match.failures.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

export const irreducibilityWitness = JSON.parse(
  await readFile(
    new URL(
      "../sources/procure-to-pay-three-way-match-exception-reconciler/fixtures/procure-to-pay-three-way-match.irreducibility.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

export const ownerTrustPolicy = JSON.parse(
  await readFile(
    new URL(
      "../sources/procure-to-pay-three-way-match-exception-reconciler/fixtures/owner-trust-policy.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function pointerSegments(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new TypeError(`Invalid JSON pointer: ${String(path)}`);
  }
  return path
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function materializeFailureCase(definition) {
  const candidate = structuredClone(acceptedFixture);
  for (const patch of definition.patches ?? []) {
    const segments = pointerSegments(patch.path);
    const key = segments.pop();
    let parent = candidate;
    for (const segment of segments) {
      parent = parent[Array.isArray(parent) ? Number(segment) : segment];
    }
    if (patch.op === "replace") {
      parent[Array.isArray(parent) ? Number(key) : key] = structuredClone(patch.value);
    } else if (patch.op === "add" && Array.isArray(parent) && key === "-") {
      parent.push(structuredClone(patch.value));
    } else {
      throw new TypeError(`Unsupported fixture patch ${patch.op} ${patch.path}`);
    }
  }
  return candidate;
}
