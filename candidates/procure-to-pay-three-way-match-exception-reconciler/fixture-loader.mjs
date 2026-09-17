import { readFile } from "node:fs/promises";

export const acceptedFixture = JSON.parse(
  await readFile(new URL("./fixtures/accepted.json", import.meta.url), "utf8"),
);

export const failureCases = JSON.parse(
  await readFile(new URL("./fixtures/failure-cases.json", import.meta.url), "utf8"),
);

export const irreducibilityWitness = JSON.parse(
  await readFile(new URL("./fixtures/irreducibility-witness.json", import.meta.url), "utf8"),
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
