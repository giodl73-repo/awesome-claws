import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildChooser,
  classifyBoundary,
  classifySetup,
  renderChooserMarkdown,
} from "./catalog-chooser.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { root } from "./openclaw-proof-lib.mjs";

const catalog = await readCatalog();
const chooser = buildChooser(catalog, await readExperienceCases(catalog));

test("covers every catalog entry exactly once in stable name order", () => {
  assert.equal(chooser.entries.length, catalog.entries.length);
  assert.equal(new Set(chooser.entries.map((entry) => entry.id)).size, catalog.entries.length);
  assert.deepEqual(
    chooser.entries.map((entry) => entry.name),
    chooser.entries.map((entry) => entry.name).toSorted((left, right) => left.localeCompare(right, "en")),
  );
  assert.ok(chooser.entries.every((entry) => /^X[345]$/.test(entry.proofTier)));
  assert.ok(
    chooser.entries.every(
      (entry) =>
        entry.maintenance.status === "active" &&
        entry.maintenance.maintainers.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/u.test(entry.maintenance.lastVerified),
    ),
  );
});

test("derives setup and boundary levels from declared capabilities", () => {
  const base = { packages: [], mcpServers: {}, cronJobs: [] };
  assert.equal(classifySetup(base).level, "low");
  assert.equal(classifyBoundary(base).level, "standard");
  assert.equal(classifySetup({ ...base, bootstrap: "Ask a question." }).level, "medium");
  assert.equal(classifyBoundary({ ...base, bootstrap: "Ask a question." }).level, "guarded");
  const connected = {
    ...base,
    mcpServers: { search: { url: "https://example.test/mcp", auth: "oauth" } },
  };
  assert.equal(classifySetup(connected).level, "high");
  assert.equal(classifyBoundary(connected).level, "heightened");
  assert.equal(
    classifySetup({
      ...base,
      packages: [
        { kind: "skill", ref: "@example/one", version: "1.0.0" },
        { kind: "skill", ref: "@example/two", version: "1.0.0" },
      ],
      cronJobs: [{ id: "daily" }],
    }).level,
    "high",
  );
});

test("renders every required chooser dimension and Claw", () => {
  const markdown = renderChooserMarkdown(chooser);
  for (const heading of [
    "## By maintenance status",
    "## By setup burden",
    "## By external dependencies",
    "## By Experience proof tier",
    "## By category",
    "## By boundary attention",
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const entry of chooser.entries) {
    assert.match(markdown, new RegExp(`claws/${entry.id}(?:\\)|\\b)`));
  }
});

test("committed chooser views match authoritative metadata", async () => {
  assert.equal(
    await readFile(join(root, "catalog-chooser.json"), "utf8"),
    `${JSON.stringify(chooser, null, 2)}\n`,
  );
  assert.equal(await readFile(join(root, "CHOOSER.md"), "utf8"), renderChooserMarkdown(chooser));
});
