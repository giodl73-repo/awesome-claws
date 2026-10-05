import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateArtifact } from "./artifact-validator-registry.mjs";
import { resolveArtifactContract } from "./runtime-evidence-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import test from "node:test";
import { fulfillmentFindings, fulfillmentInputDigest, reconcileFulfillment, renderFulfillment } from "./order-fulfillment-reconciler.mjs";

const fixture = JSON.parse(await readFile(new URL("../sources/order-fulfillment-reconciler/fixtures/fulfillment-input.example.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);

test("fulfillment: runtime requires both the registered JSON output and Markdown handoff", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((item) => item.id === "order-fulfillment-reconciler");
  const experience = (await readExperienceCases(catalog)).find((item) => item.id === entry.id);
  const contract = await resolveArtifactContract({ entry, experience });
  assert.equal(contract.structuredPath, "outputs/fulfillment.json");
  assert.equal(contract.handoffPath, "outputs/order-fulfillment-reconciler-handoff.md");
});

test("fulfillment: stored structured and Markdown examples agree with reconciliation", async () => {
  const base = new URL("../sources/order-fulfillment-reconciler/fixtures/", import.meta.url);
  const artifact = JSON.parse(await readFile(new URL("fulfillment.example.json", base), "utf8"));
  assert.deepEqual(artifact, { input: fixture, report: reconcileFulfillment(fixture) });
  assert.equal(await readFile(new URL("fulfillment-handoff.example.md", base), "utf8"), renderFulfillment(fixture));
});

test("fulfillment: registered artifact validation rejects omitted blockers and extra authority", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fulfillment-test-"));
  try {
    const input = clone();
    const artifactPath = join(dir, "artifact.json");
    const check = async (record) => {
      await writeFile(artifactPath, JSON.stringify(record));
      return validateArtifact({ id: "order-fulfillment-reconciler", artifactPath, scenarioType: "accepted-task", mode: "mock-plus" });
    };
    assert.equal((await check({ input, report: reconcileFulfillment(input) })).valid, true);
    assert.equal((await check({ input, report: reconcileFulfillment(input), releaseApproved: true })).valid, false);
    input.shipments[0].sourceRevision = "stale";
    const report = reconcileFulfillment(input);
    assert.equal((await check({ input, report })).valid, true);
    assert.ok(report.exceptions.length > 0);
    report.exceptions = [];
    const invalid = await check({ input, report });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.semantics.valid, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fulfillment: handoff links every movement and withholds blocked customer wording", () => {
  const output = renderFulfillment(fixture);
  for (const row of [...fixture.lines, ...fixture.shipments, ...fixture.deliveries]) {
    assert.ok(output.includes(`${row.sourceRef} / ${row.sourceRevision} / ${row.sourceRecord}`));
  }
  assert.ok(output.includes("6 of 8 EA departed and 4 delivery-confirmed"));
  const input = clone();
  input.shipments[0].sourceRevision = "stale";
  const blocked = renderFulfillment(input);
  assert.ok(blocked.includes("Status wording withheld"));
  assert.ok(!blocked.includes("6 of 8 EA departed"));
});

test("fulfillment: same-SKU orders and shared shipment retain separate line balances", () => {
  const report = reconcileFulfillment(fixture);
  assert.equal(report.status, "draft");
  assert.deepEqual(report.balances.map((row) => [row.netOrdered, row.shipped, row.deliveryConfirmed, row.notShipped, row.shippedWithoutConfirmation]), [[8, 6, 4, 2, 2], [8, 8, 8, 0, 0]]);
  assert.equal(report.balances[0].overdueEvidence, true);
  assert.equal(report.balances[1].overdueEvidence, null);
  assert.equal(report.approved, false);
  assert.equal(report.externalActionsPerformed, false);
  assert.deepEqual(fulfillmentFindings({ input: fixture, report }), []);
});

for (const [name, mutate, code] of [
  ["duplicate line identity", (r) => r.lines.push({...r.lines[0]}), "duplicate_identity"],
  ["duplicate source record under another ID", (r) => r.shipments.push({...r.shipments[0], id: "DUP"}), "duplicate_evidence"],
  ["duplicate order identity under another ID", (r) => r.lines.push({...r.lines[0], id: "DUP", sourceRecord: "ROW-C"}), "duplicate_order_line"],
  ["duplicate source", (r) => r.sources.push({...r.sources[0]}), "duplicate_identity"],
  ["duplicate delivery", (r) => r.deliveries.push({...r.deliveries[0]}), "duplicate_identity"],
  ["unaccepted change", (r) => {r.lines[0].accepted = false;}, "unaccepted_order"],
  ["unknown cancellation quantity", (r) => {r.lines[0].cancelled = null;}, "cancellation_unknown"],
  ["unapproved cancellation", (r) => {r.lines[0].cancellationAuthorized = false;}, "cancellation_unknown"],
  ["excess cancellation", (r) => {r.lines[0].cancelled = 11;}, "cancellation_over_quantity"],
  ["over-shipment", (r) => {r.shipments[0].quantity = 9;}, "over_shipment"],
  ["over-delivery", (r) => {r.deliveries[0].quantity = 7;}, "over_delivery"],
  ["orphan shipment", (r) => {r.shipments[0].lineId = "MISSING";}, "orphan_shipment"],
  ["orphan delivery", (r) => {r.deliveries[0].shipmentLineId = "MISSING";}, "orphan_delivery"],
  ["unit mismatch", (r) => {r.shipments[0].unit = "BOX";}, "item_unit_conflict"],
  ["SKU mismatch", (r) => {r.shipments[0].sku = "SKU-Y";}, "item_unit_conflict"],
  ["delivery unit mismatch", (r) => {r.deliveries[0].unit = "BOX";}, "item_unit_conflict"],
  ["stale source", (r) => {r.shipments[0].sourceRevision = "r0";}, "source_revision"],
  ["missing source", (r) => {r.sources.shift();}, "source_revision"],
  ["future source", (r) => {r.sources[0].capturedAt = "2026-10-05T00:00:00Z";}, "future_source"],
  ["future event", (r) => {r.deliveries[0].confirmedAt = "2026-10-05T00:00:00Z";}, "future_event"],
  ["delivery after its source capture", (r) => {r.deliveries[0].confirmedAt = "2026-10-04T16:30:00Z";}, "event_after_capture"],
  ["departure after its source capture", (r) => {r.shipments[0].occurredAt = "2026-10-04T16:30:00Z";}, "event_after_capture"],
  ["delivery before departure", (r) => {r.deliveries[0].confirmedAt = "2026-10-02T00:00:00Z";}, "delivery_before_departure"],
  ["label is not departure", (r) => {r.shipments[0].status = "label";}, "delivery_without_departure"],
  ["void is not departure", (r) => {r.shipments[0].status = "void";}, "delivery_without_departure"],
  ["unresolved supersession", (r) => {r.shipments[0].status = "superseded";}, "invalid_supersession"],
  ["self supersession", (r) => {r.shipments[0].status = "superseded"; r.shipments[0].replacedBy = "SHIP-A";}, "invalid_supersession"],
  ["cross-order replacement", (r) => {r.shipments[0].status = "superseded"; r.shipments[0].replacedBy = "SHIP-B";}, "invalid_supersession"],
  ["undeclared supersession", (r) => {r.shipments[0].replacedBy = "SHIP-B";}, "invalid_supersession"],
  ["agent as owner", (r) => {r.scope.owner = " order-fulfillment-reconciler ";}, "human_owner_required"],
]) test(`fulfillment: blocks ${name} without silently dropping supplied records`, () => {
  const input = clone(); mutate(input);
  const report = reconcileFulfillment(input);
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.balances, []);
  assert(report.exceptions.some((row) => row.code === code), JSON.stringify(report.exceptions));
  assert.deepEqual(report.coverage.shipments, input.shipments.map((row) => row.id));
  assert.deepEqual(report.coverage.deliveries, input.deliveries.map((row) => row.id));
});

test("fulfillment: missing delivery proof remains unconfirmed, not delivered", () => {
  const input = clone(); input.deliveries = [];
  assert.deepEqual(reconcileFulfillment(input).balances.map((row) => row.shippedWithoutConfirmation), [6, 8]);
});

test("fulfillment: missing movements do not imply shipments", () => {
  const input = clone(); input.shipments = []; input.deliveries = [];
  assert.deepEqual(reconcileFulfillment(input).balances.map((row) => row.notShipped), [8, 8]);
});

test("fulfillment: label and void records remain covered but do not add departed quantities", () => {
  for (const status of ["label", "void"]) {
    const input = clone(); input.shipments[0].status = status; input.deliveries.shift();
    const report = reconcileFulfillment(input);
    assert.equal(report.status, "draft"); assert.equal(report.balances[0].shipped, 0);
    assert(report.coverage.shipments.includes("SHIP-A"));
  }
});

test("fulfillment: valid supersession counts replacement once", () => {
  const input = clone(); input.shipments.push({...input.shipments[0], id: "OLD-A", sourceRecord: "OLD-ROW", status: "superseded", replacedBy: "SHIP-A"});
  const report = reconcileFulfillment(input);
  assert.equal(report.status, "draft"); assert.equal(report.balances[0].shipped, 6);
});

test("fulfillment: multiple partial shipments and confirmations conserve quantity", () => {
  const input = clone(); input.shipments[0].quantity = 4;
  input.shipments.push({...input.shipments[0], id: "SHIP-C", shipmentId: "LOAD-2", quantity: 2, sourceRecord: "ROW-C"});
  input.deliveries[0].quantity = 2;
  input.deliveries.push({...input.deliveries[0], id: "DELIVERY-C", shipmentLineId: "SHIP-C", quantity: 2, sourceRecord: "ROW-C"});
  const report = reconcileFulfillment(input);
  assert.equal(report.status, "draft"); assert.equal(report.balances[0].shipped, 6); assert.equal(report.balances[0].deliveryConfirmed, 4);
});

test("fulfillment: per-shipment over-delivery cannot hide behind line totals", () => {
  const input = clone(); input.shipments[0].quantity = 3;
  input.shipments.push({...input.shipments[0], id: "SHIP-C", shipmentId: "LOAD-2", sourceRecord: "ROW-C"});
  assert(reconcileFulfillment(input).exceptions.some((row) => row.code === "over_delivery"));
});

test("fulfillment: repeated physical departure blocks even under different source coordinates", () => {
  const input = clone(); input.lines[0].ordered = 14;
  input.shipments.push({...input.shipments[0], id: "SHIP-C", sourceRecord: "ROW-C"});
  const report = reconcileFulfillment(input);
  assert.equal(report.status, "blocked");
  assert(report.exceptions.some((row) => row.code === "duplicate_departure"));
  assert.deepEqual(report.balances, []);
});

test("fulfillment: quantity completion does not clear a hold", () => {
  const input = clone(); input.lines[1].holds = ["QUALITY-HOLD: coordinator review"];
  assert.equal(reconcileFulfillment(input).balances[1].status, "held");
  assert.match(renderFulfillment(input), /QUALITY-HOLD/);
});

test("fulfillment: promised instant uses explicit timezone and exact cutoff", () => {
  const input = clone(); input.lines[0].promisedAt = "2026-10-04T13:00:00-04:00";
  assert.equal(reconcileFulfillment(input).balances[0].overdueEvidence, false);
  input.lines[0].promisedAt = "2026-10-04T12:59:59-04:00";
  assert.equal(reconcileFulfillment(input).balances[0].overdueEvidence, true);
});

for (const [name, mutate] of [
  ["negative quantity", (r) => {r.lines[0].ordered = -1;}],
  ["fractional quantity without conversion", (r) => {r.shipments[0].quantity = 1.5;}],
  ["unsafe numeric quantity", (r) => {r.shipments[0].quantity = Number.MAX_SAFE_INTEGER + 1;}],
  ["implicit timezone", (r) => {r.scope.asOf = "2026-10-04T17:00:00";}],
  ["invalid date", (r) => {r.scope.asOf = "2026-02-30T17:00:00Z";}],
  ["empty owner", (r) => {r.scope.owner = "   ";}],
  ["customer address", (r) => {r.lines[0].address = "private";}],
  ["tracking link", (r) => {r.shipments[0].trackingUrl = "https://example.invalid";}],
  ["execution request", (r) => {r.scope.shipGoods = true;}],
]) test(`fulfillment: strict schema rejects ${name}`, () => {
  const input = clone(); mutate(input); assert.throws(() => reconcileFulfillment(input), /Invalid fulfillment input/);
});

test("fulfillment: huge sums block instead of rounding into plausible balances", () => {
  const input = clone(); input.shipments[0].quantity = Number.MAX_SAFE_INTEGER;
  input.shipments.push({...input.shipments[0], id: "SHIP-C", sourceRecord: "ROW-C"});
  assert(reconcileFulfillment(input).exceptions.some((row) => row.code === "quantity_overflow"));
});

test("fulfillment: input revisions invalidate old reports, independent of object key ordering", () => {
  const input = clone(); const report = reconcileFulfillment(input);
  input.scope = Object.fromEntries(Object.entries(input.scope).reverse());
  assert.equal(fulfillmentInputDigest(input), report.inputDigest);
  input.scope.revision = "batch-r2";
  assert.equal(fulfillmentFindings({input, report})[0].code, "fulfillment_report");
});

for (const mutate of [
  (r) => {r.approved = true;}, (r) => {r.externalActionsPerformed = true;},
  (r) => {r.balances[0].notShipped = 0;}, (r) => {r.coverage.shipments = [];},
]) test("fulfillment: rejects altered balances, omitted coverage and false authority", () => {
  const report = reconcileFulfillment(fixture); mutate(report);
  assert(fulfillmentFindings({input: fixture, report}).length > 0);
});

test("fulfillment: Markdown agrees with both line balances and includes evidence and owner", () => {
  const markdown = renderFulfillment(fixture);
  assert.match(markdown, /ORDER-A \/ ITEM-1 \(LINE-A\) \| 8 \| 6 \| 4 \| 2 \| 2/);
  assert.match(markdown, /ORDER-B \/ ITEM-1 \(LINE-B\) \| 8 \| 8 \| 8 \| 0 \| 0/);
  for (const value of ["COORDINATOR-LEE", "ORDERS revision r2", "SHIP-A", "DELIVERY-A", "No external action performed"]) assert(markdown.includes(value));
});
