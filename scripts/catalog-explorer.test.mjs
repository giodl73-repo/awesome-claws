import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { buildChooser } from "./catalog-chooser.mjs";
import { renderCatalogExplorer } from "./catalog-explorer.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import { root } from "./openclaw-proof-lib.mjs";

const catalog = await readCatalog();
const chooser = buildChooser(catalog, await readExperienceCases(catalog));
const explorer = renderCatalogExplorer(chooser);

test("renders a self-contained explorer over authoritative chooser data", () => {
  assert.match(explorer, /<script type="application\/json" id="catalog-data">/u);
  assert.match(explorer, /id="capability"/u);
  assert.match(explorer, /id="authority"/u);
  assert.match(explorer, /id="maintainer"/u);
  assert.match(explorer, /id="freshness"/u);
  assert.match(explorer, /aria-live="polite"/u);
  assert.doesNotMatch(explorer, /https?:\/\/[^"]+\.(?:css|js)\b/u);
  assert.ok(
    explorer.includes(
      'href="https://github.com/giodl73-repo/awesome-claws/tree/main/claws/${encodeURIComponent(entry.id)}"',
    ),
  );
  for (const entry of chooser.entries) {
    assert.ok(explorer.includes(JSON.stringify(entry.id).slice(1, -1)));
  }
});

test("uses the required Clawpilot theme before application JavaScript", () => {
  assert.ok(
    explorer.indexOf('new URLSearchParams(window.location.search).get("scoutTheme")') <
      explorer.indexOf('const catalog = JSON.parse'),
  );
  for (const token of [
    "--cp-bg: #f7f4ef",
    "--cp-accent: #b11f4b",
    '--cp-bg: #3d3b3a',
    '--cp-accent: #fd8ea1',
    'font-family: "Segoe UI", Aptos, Calibri',
  ]) {
    assert.ok(explorer.includes(token), `Missing theme token: ${token}`);
  }
});

test("committed explorer matches authoritative metadata", async () => {
  assert.equal(await readFile(join(root, "catalog-explorer.html"), "utf8"), explorer);
});
