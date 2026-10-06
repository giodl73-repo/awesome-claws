import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { root } from "./catalog-source.mjs";

const [catalog, starterSets, markdown] = await Promise.all([
  readFile(join(root, "catalog.json"), "utf8").then(JSON.parse),
  readFile(join(root, "catalog-starter-sets.json"), "utf8").then(JSON.parse),
  readFile(join(root, "docs", "catalog-starter-sets.md"), "utf8"),
]);

const catalogIds = new Set(catalog.entries.map((entry) => entry.id));

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function sectionFor(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = markdown.match(
    new RegExp(`^## ${escaped}\\r?\\n(?<body>[\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
  );
  assert.ok(match, `Missing Markdown section for ${name}`);
  return match.groups.body;
}

test("starter set metadata stays structurally valid", () => {
  assert.equal(starterSets.schemaVersion, 1);
  assert.equal(starterSets.setSize, 30);
  assert.equal(starterSets.allowOverlap, true);
  assert.equal(starterSets.sets.length, 6);
  const setIds = new Set();
  for (const set of starterSets.sets) {
    assert.match(set.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, set.name);
    assert.ok(!setIds.has(set.id), `Duplicate starter set id ${set.id}`);
    setIds.add(set.id);
    assert.match(set.name, / 30$/u, set.id);
    assert.equal(set.claws.length, starterSets.setSize, set.name);
    assert.equal(new Set(set.claws).size, set.claws.length, set.name);
    for (const id of set.claws) {
      assert.ok(catalogIds.has(id), `${set.name} references unknown Claw ${id}`);
    }
  }
});

test("starter set Markdown mirrors the machine-readable set membership", () => {
  for (const set of starterSets.sets) {
    const body = sectionFor(set.name);
    assert.ok(
      normalizeWhitespace(body).includes(normalizeWhitespace(set.description)),
      `${set.name} description drifted`,
    );
    const markdownIds = [...body.matchAll(/^\| `([a-z0-9-]+)` \|/gmu)].map(
      ([, id]) => id,
    );
    assert.deepEqual(markdownIds, set.claws, `${set.name} membership drifted`);
  }
});
