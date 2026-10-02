import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = new URL("../sources/content-operations/", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const record = JSON.parse(await read("fixtures/commercial-campaign.example.json"));
const schema = JSON.parse(await read("schemas/publication-readiness-record.schema.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const findings = (value) => validateArtifactSemantics("content-operations", value);
const brief = await read("fixtures/campaign-brief.example.md");
const email = await read("fixtures/campaign-email.example.md");
const web = await read("fixtures/campaign-web.example.md");
const sources = await read("references/commercial-campaign-source-pack.md");

test("commercial campaign uses the existing publication contract with honest blockers", () => {
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.deepEqual(findings(record), []);
  assert.equal(record.package.state, "blocked");
  assert.equal(record.assets.length, 3);
  assert.ok(record.assets.every((a) => a.state === "ready-for-owner-review"));
  assert.ok(record.approvals.every((a) => a.decision === "pending"));
  assert.ok(record.assets.every((a) => a.publicationState === "not-published"));
});

test("each declared v1 asset has usable copy with its exact supported claims", () => {
  const bodies = new Map([
    ["outputs/campaign-brief.md", brief],
    ["outputs/campaign-email.md", email],
    ["outputs/campaign-web.md", web],
  ]);
  for (const asset of record.assets) {
    const text = bodies.get(asset.path);
    assert.ok(text, asset.path);
    assert.match(text, /Private draft v1/);
    assert.equal(asset.version, "v1");
    assert.deepEqual(asset.claimRefs, ["claim-forms", "claim-sequential-approvals"]);
    assert.match(text, /configurable form/);
    assert.match(text, /sequential approval steps/);
    for (const ref of asset.claimRefs) {
      assert.deepEqual(record.claims.find((c) => c.id === ref).sourceRefs, ["source-product"]);
    }
  }
  assert.match(email, /Subject: Review procurement requests with FlowDesk/);
  assert.match(email, /Preheader:/);
  assert.match(web, /## Procurement requests in FlowDesk/);
  assert.match(sources, /version 2.4 supports configurable procurement request forms/);
  for (const text of [email, web]) {
    assert.match(text, /Call to action: Request a demo/);
    assert.match(text, /Destination: Pending Marketing team confirmation/);
    assert.doesNotMatch(text, /https?:\/\//);
  }
});

// Fixture acceptance checks cover these supplied restricted strings, not all possible prose.
function assertPermittedExampleCopy(text) {
  assert.doesNotMatch(text, /40%|Cedar Sample Ltd|saved us a day every week|conversion (?:was|is) \d|uplift (?:was|is) \d/i);
}

test("restricted quote and unsupported savings stay out of channel copy", () => {
  for (const text of [brief, email, web]) assertPermittedExampleCopy(text);
  for (const bad of ["cuts costs by 40%", "Cedar Sample Ltd", "FlowDesk saved us a day every week", "conversion was 12%", "uplift is 20%"])
    assert.throws(() => assertPermittedExampleCopy(`${email}\n${bad}`));
  assert.match(sources, /cuts costs by 40%/);
  assert.match(sources, /Neither wording nor attribution has permission/);
  for (const id of ["claim-savings", "claim-quote"]) {
    assert.equal(record.claims.find((c) => c.id === id).state, "blocked");
    assert.ok(record.assets.every((a) => !a.claimRefs.includes(id)));
  }
});

test("measurement is a defined proposal with denominator, window and no fabricated results", () => {
  assert.equal(record.metrics[0].state, "review-needed");
  assert.equal(record.metrics[0].owner, "Analytics team");
  for (const phrase of [/divided by unique eligible/, /seven days/, /zero denominator/, /undefined/, /unknown/, /UTC/, /No event data/, /must agree/])
    assert.match(brief, phrase);
  assert.match(sources, /first campaign delivery/);
  assert.match(sources, /final recipient's window to mature/);
  assert.match(sources, /No events were supplied/);
});

for (const [name, code, mutate] of [
  ["unsupported performance", "unsupported_claim_state", (x) => { x.claims.find((c) => c.id === "claim-savings").state = "supported"; }],
  ["quote without permission", "unsupported_claim_state", (x) => { x.claims.find((c) => c.id === "claim-quote").state = "supported"; }],
  ["wrong asset version", "invalid_approval_scope", (x) => { x.approvals[0].assetVersion = "v2"; }],
  ["fabricated measured result", "unauthorized_narrative_action", (x) => { x.metrics[0].definition = "We measured a 12 percent conversion rate."; }],
  ["premature readiness", "premature_publication_ready_state", (x) => { x.package.state = x.handoff.state = "ready-for-publication"; }],
]) {
  test(`campaign rejects ${name}`, () => {
    const value = structuredClone(record);
    mutate(value);
    assert.ok(findings(value).some((f) => f.code === code), code);
  });
}

test("campaign additions do not add integrations or change the schema", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((e) => e.id === "content-operations");
  assert.equal(entry.profiles, undefined);
  assert.equal(entry.skills, undefined);
  assert.ok(entry.resources.some((r) => r.path === "fixtures/campaign-email.example.md"));
  assert.ok(entry.resources.some((r) => r.path === "templates/commercial-campaign.md"));
  assert.equal(record.schemaVersion, "awesomeClaws.publicationReadinessRecord.v1");
});

test("measurement guard preserves proposals and explicit absence of observations", () => {
  for (const text of [
    "We have not measured a conversion rate.",
    "No conversion result is available; a seven-day window is proposed.",
    "Do not claim we measured a conversion rate without observations.",
  ]) {
    const value = structuredClone(record);
    value.metrics[0].definition = text;
    assert.deepEqual(findings(value), []);
  }
});
