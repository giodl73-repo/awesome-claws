import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

export const JSON_LIMITS = Object.freeze({
  maxDepth: 28,
  maxNodes: 20_000,
  maxArrayLength: 256,
  maxObjectKeys: 128,
  maxStringLength: 131_072,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON requires finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical JSON cannot encode cycles.");
    }
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical JSON cannot encode cycles.");
    }
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonInner(value[key], next)}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}.`);
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

export function sha256Digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function normalizeJsonValue(
  value,
  {
    maxBytes,
    maxDepth = JSON_LIMITS.maxDepth,
    maxNodes = JSON_LIMITS.maxNodes,
    maxArrayLength = JSON_LIMITS.maxArrayLength,
    maxObjectKeys = JSON_LIMITS.maxObjectKeys,
    maxStringLength = JSON_LIMITS.maxStringLength,
  },
) {
  let nodes = 0;
  let stringBytes = 0;
  const ancestors = new Set();
  const fail = (code) => ({ ok: false, code });

  function visit(item, depth) {
    nodes += 1;
    if (nodes > maxNodes) return fail("node-limit");
    if (depth > maxDepth) return fail("depth-limit");
    if (item === null || typeof item === "boolean") {
      return { ok: true, value: item };
    }
    if (typeof item === "string") {
      const bytes = Buffer.byteLength(item);
      stringBytes += bytes;
      if (bytes > maxStringLength || stringBytes > maxBytes) {
        return fail("string-limit");
      }
      return { ok: true, value: item };
    }
    if (typeof item === "number") {
      return Number.isFinite(item)
        ? { ok: true, value: item }
        : fail("non-finite-number");
    }
    if (
      typeof item === "symbol" ||
      typeof item === "bigint" ||
      typeof item === "function" ||
      typeof item === "undefined"
    ) {
      return fail("non-json-value");
    }
    if (utilTypes.isProxy(item)) return fail("proxy");
    if (ancestors.has(item)) return fail("cycle");

    let keys;
    let descriptors;
    let prototype;
    try {
      keys = Reflect.ownKeys(item);
      descriptors = Object.getOwnPropertyDescriptors(item);
      prototype = Object.getPrototypeOf(item);
    } catch {
      return fail("hostile-object");
    }
    if (keys.some((key) => typeof key === "symbol")) return fail("symbol-key");

    if (Array.isArray(item)) {
      if (prototype !== Array.prototype) return fail("non-plain-array");
      if (item.length > maxArrayLength) return fail("array-limit");
      const dataKeys = keys.filter((key) => key !== "length");
      if (
        dataKeys.length !== item.length ||
        dataKeys.some((key, index) => key !== String(index))
      ) {
        return fail("sparse-or-custom-array");
      }
      if (
        dataKeys.some((key) => {
          const descriptor = descriptors[key];
          return (
            !descriptor ||
            !descriptor.enumerable ||
            !Object.hasOwn(descriptor, "value") ||
            Object.hasOwn(descriptor, "get") ||
            Object.hasOwn(descriptor, "set")
          );
        })
      ) {
        return fail("accessor-or-hidden-state");
      }
      ancestors.add(item);
      const output = [];
      for (const key of dataKeys) {
        const child = visit(descriptors[key].value, depth + 1);
        if (!child.ok) {
          ancestors.delete(item);
          return child;
        }
        output.push(child.value);
      }
      ancestors.delete(item);
      return { ok: true, value: output };
    }

    if (prototype !== Object.prototype && prototype !== null) {
      return fail("non-plain-object");
    }
    if (keys.length > maxObjectKeys) return fail("object-key-limit");
    if (
      keys.some((key) => {
        const descriptor = descriptors[key];
        return (
          !descriptor ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value") ||
          Object.hasOwn(descriptor, "get") ||
          Object.hasOwn(descriptor, "set")
        );
      })
    ) {
      return fail("accessor-or-hidden-state");
    }
    ancestors.add(item);
    const output = Object.create(null);
    for (const key of keys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        ancestors.delete(item);
        return fail("prototype-key");
      }
      const child = visit(descriptors[key].value, depth + 1);
      if (!child.ok) {
        ancestors.delete(item);
        return child;
      }
      output[key] = child.value;
    }
    ancestors.delete(item);
    return { ok: true, value: output };
  }

  const normalized = visit(value, 0);
  if (!normalized.ok) return normalized;
  try {
    if (Buffer.byteLength(canonicalJson(normalized.value)) > maxBytes) {
      return fail("byte-limit");
    }
  } catch {
    return fail("canonicalization");
  }
  return normalized;
}
