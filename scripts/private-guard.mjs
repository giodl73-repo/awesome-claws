import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (manifest.private !== true || manifest.version !== "0.0.0-private") {
  throw new Error("The collection root must retain its private incubation guard.");
}

const remotes = spawnSync("git", ["remote"], { cwd: root, encoding: "utf8" });
if (remotes.status !== 0) {
  throw new Error(remotes.stderr || "Could not inspect Git remotes.");
}
if (remotes.stdout.trim()) {
  throw new Error("Private incubation check rejects configured Git remotes.");
}

console.log("Private guard passed: no remote or publishable root package.");

