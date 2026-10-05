import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Ajv from "ajv";
import { documentationPatch, fixtureRoot, normalize } from "./documentation-example-patch.mjs";

const read = async (path) => normalize(await readFile(new URL(path, fixtureRoot), "utf8"));
const input = JSON.parse(await read("input.json"));
const files = {};
for (const path of Object.keys(input.before)) files[path] = await read(path);
const ajv = new Ajv({ strict: true, allErrors: true });
const validators = Object.fromEntries(Object.entries(input.specifications).map(([v, schema]) => [v, ajv.compile(schema)]));
const example = (guide, version) => {
  const section = guide.split(`## Version ${version}\n`)[1]?.split("\n## ")[0];
  const code = section?.match(/```json\n([\s\S]*?)\n```/u)?.[1];
  return code ? JSON.parse(code) : null;
};

// These checks cover the worked example's syntax and fixed version contract,
// not arbitrary documentation prose or a live API implementation.
function inspect(candidate) {
  const findings = [];
  for (const v of [1, 2]) {
    const payload = example(candidate["guide.md"], v);
    if (!payload || !validators[`v${v}`](payload)) findings.push(`v${v} guide example`);
    if (!validators[`v${v}`](JSON.parse(candidate[`request-v${v}.json`]))) findings.push(`v${v} request`);
    const field = v === 1 ? "project" : "workspace";
    if (!candidate["reference.md"].includes(`| v${v} | POST /v${v}/jobs | ${field}, name |`)) findings.push(`v${v} reference`);
  }
  for (const path of ["guide.md", "reference.md"]) {
    for (const [, target] of candidate[path].matchAll(/\]\(([^)]+)\)/gu)) {
      if (!Object.hasOwn(candidate, target)) findings.push(`broken link ${target}`);
    }
  }
  if (candidate["request-v1.json"] !== input.before["request-v1.json"]) findings.push("v1 changed");
  return findings;
}

test("actual revised guide, reference and examples agree on both versions", () => {
  assert.deepEqual(inspect(files), []);
  assert.deepEqual(example(files["guide.md"], 1), JSON.parse(files["request-v1.json"]));
  assert.deepEqual(example(files["guide.md"], 2), JSON.parse(files["request-v2.json"]));
});

test("stale baseline fails the same v2 checks", () => {
  assert.deepEqual(inspect(input.before), ["v2 guide example", "v2 request", "v2 reference"]);
});

for (const [name, mutate, finding] of [
  ["stale v2 request", (x) => { x["request-v2.json"] = x["request-v1.json"]; }, "v2 request"],
  ["wrong-version guide example", (x) => { x["guide.md"] = x["guide.md"].replace('{"workspace":"ws-demo"', '{"project":"ws-demo"'); }, "v2 guide example"],
  ["removed v1 guidance", (x) => { x["guide.md"] = x["guide.md"].split("## Version 1")[0]; }, "v1 guide example"],
  ["broken internal link", (x) => { x["guide.md"] = x["guide.md"].replace("(reference.md)", "(missing.md)"); }, "broken link missing.md"],
  ["wrong-version reference", (x) => { x["reference.md"] = x["reference.md"].replace("| workspace, name |", "| project, name |"); }, "v2 reference"],
]) test(`example checks reject ${name}`, () => {
  const changed = structuredClone(files);
  mutate(changed);
  assert.ok(inspect(changed).includes(finding));
});

test("v2 does not silently accept project as an alias", () => {
  assert.equal(validators.v2({ project: "p", workspace: "w", name: "n" }), false);
  assert.equal(validators.v1({ workspace: "w", name: "n" }), false);
  assert.equal(validators.v2({ workspace: "", name: "n" }), false);
});

test("packaged patch applies to baseline and produces the actual revised files", async () => {
  const patch = await read("documentation.patch");
  assert.equal(patch, documentationPatch(input.before, files));
  assert.doesNotMatch(patch, /diff --git a\/request-v1\.json/u);
  const dir = await mkdtemp(join(tmpdir(), "claw-doc-example-"));
  try {
    for (const [path, body] of Object.entries(input.before)) await writeFile(join(dir, path), body);
    await writeFile(join(dir, "documentation.patch"), patch);
    execFileSync("git", ["apply", "--check", "--", "documentation.patch"], { cwd: dir });
    execFileSync("git", ["apply", "--", "documentation.patch"], { cwd: dir });
    for (const [path, body] of Object.entries(files)) assert.equal(normalize(await readFile(join(dir, path), "utf8")), body);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Content Operations ships actual versioned guide examples, with review pending", async () => {
  const guide = normalize(await readFile(new URL("../sources/content-operations/fixtures/technical-guide.example.md", import.meta.url), "utf8"));
  const supplied = JSON.parse(await readFile(new URL("../sources/content-operations/fixtures/technical-guide-specifications.json", import.meta.url), "utf8"));
  assert.deepEqual(supplied.specifications, input.specifications);
  assert.match(guide, new RegExp(supplied.reference));
  for (const v of [1, 2]) assert.equal(ajv.compile(supplied.specifications[`v${v}`])(example(guide, v)), true);
  assert.match(guide, /Both reviews remain pending/);
  assert.match(guide, /Example execution: not run/);
  assert.match(guide, /revised asset requiring fresh review/);
});

test("handoff does not invent execution receipts or carry stale review forward", async () => {
  const handoff = await read("handoff.md");
  assert.match(handoff, /Verification state: not run/);
  assert.match(handoff, /Record actual commands, output and\nbase\/head revisions/);
  assert.match(handoff, /Recheck after changes/);
  assert.match(handoff, /Publication and merge are\nnot authorized/);
  assert.doesNotMatch(handoff.replaceAll(/\s+/gu, " "), /(?:^|[.!?] )(?:All |The )?(?:tests|checks) (?:all )?passed|(?:^|[.!?] )Approved for (?:release|publication)/iu);
});
