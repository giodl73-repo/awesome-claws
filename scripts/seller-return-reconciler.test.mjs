import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateArtifact } from "./artifact-validator-registry.mjs";
import { resolveArtifactContract } from "./runtime-evidence-lib.mjs";
import { readExperienceCases } from "./experience-cases.mjs";
import test from "node:test";
import { reconcileSellerReturns, renderSellerReturns, sellerReturnFindings, sellerReturnInputDigest } from "./seller-return-reconciler.mjs";

const base = new URL("../sources/seller-return-reconciler/fixtures/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("return-input.example.json", base), "utf8"));
const clone = () => structuredClone(fixture);

test("returns: registered runtime output requires JSON and the matching Markdown handoff", async () => {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  const entry = catalog.entries.find((row) => row.id === "seller-return-reconciler");
  const experience = (await readExperienceCases(catalog)).find((row) => row.id === entry.id);
  const contract = await resolveArtifactContract({ entry, experience });
  assert.equal(contract.structuredPath, "outputs/seller-return.json");
  assert.equal(contract.handoffPath, "outputs/seller-return-reconciler-handoff.md");
});

test("returns: shared artifact validation rejects omitted blockers and changed balances", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seller-return-test-"));
  try {
    const artifactPath = join(dir, "artifact.json");
    const check = async (record) => {
      await writeFile(artifactPath, JSON.stringify(record));
      return validateArtifact({ id: "seller-return-reconciler", artifactPath, scenarioType: "accepted-task", mode: "mock-plus" });
    };
    const input = clone();
    let report = reconcileSellerReturns(input);
    assert.equal((await check({ input, report })).valid, true);
    report.balances[0].dispositionEvidenced = 3;
    assert.equal((await check({ input, report })).valid, false);
    input.lines[0].authorizedBy = null;
    report = reconcileSellerReturns(input);
    assert.equal((await check({ input, report })).valid, true);
    report.exceptions = [];
    const invalid = await check({ input, report });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.semantics.valid, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("returns: blocked Markdown preserves supplied safety holds without publishing balances", () => {
  const input = clone();
  input.lines[0].holds = ["Recall review required"];
  input.receipts[0].sourceRevision = "stale";
  const text = renderSellerReturns(input);
  assert.ok(text.includes("Status: blocked"));
  assert.ok(text.includes("Recall review required"));
  assert.ok(!text.includes("| 5 | 3 | 2 |"));
});
const secondDisposition = (input, first = 3, last = 3) => {
  const row = { ...structuredClone(input.dispositions[0]), id: "DECISION-B", sourceRecord: "ROW-D2", unitRanges: [{ first, last }] };
  input.dispositions.push(row);
  return row;
};

test("returns: authorized, received and disposition-evidenced remain separate", () => {
  const report = reconcileSellerReturns(fixture);
  assert.equal(report.status, "draft");
  assert.deepEqual(report.balances[0], { lineId: "RETURN-A-1", authorized: 5, received: 3, dispositionEvidenced: 2, notEvidencedReceived: 2, awaitingDisposition: 1, holds: [], dispositionHolds: [], status: "open" });
  assert.equal(report.approved, false);
  assert.equal(report.externalActionsPerformed, false);
  assert.deepEqual(sellerReturnFindings({ input: fixture, report }), []);
});

for (const [name, mutate, code] of [
  ["duplicate source", (r) => r.sources.push({ ...r.sources[0] }), "duplicate_identity"],
  ["duplicate line", (r) => r.lines.push({ ...r.lines[0] }), "duplicate_identity"],
  ["duplicate receipt", (r) => r.receipts.push({ ...r.receipts[0] }), "duplicate_identity"],
  ["duplicate disposition", (r) => r.dispositions.push({ ...r.dispositions[0] }), "duplicate_identity"],
  ["same return line under a new ID", (r) => r.lines.push({ ...r.lines[0], id: "ALIAS", sourceRecord: "OTHER" }), "duplicate_return_line"],
  ["same physical receipt under new source coordinates", (r) => r.receipts.push({ ...r.receipts[0], id: "ALIAS", sourceRecord: "OTHER" }), "duplicate_receipt"],
  ["duplicate receipt evidence", (r) => r.receipts.push({ ...r.receipts[0], id: "ALIAS", receivingId: "OTHER" }), "duplicate_evidence"],
  ["unmatched goods", (r) => { r.receipts[0].lineId = "MISSING"; }, "unmatched_receipt"],
  ["orphan disposition", (r) => { r.dispositions[0].receiptId = "MISSING"; }, "unmatched_disposition"],
  ["unapproved return", (r) => { r.lines[0].authorized = false; }, "human_authorization_required"],
  ["missing authorizer", (r) => { r.lines[0].authorizedBy = null; }, "human_authorization_required"],
  ["automated authorization", (r) => { r.lines[0].authorizedBy.kind = "automation"; }, "human_authorization_required"],
  ["missing disposition authority", (r) => { r.dispositions[0].decidedBy = null; }, "human_disposition_required"],
  ["automated disposition", (r) => { r.dispositions[0].decidedBy.kind = "automation"; }, "human_disposition_required"],
  ["assistant-named human", (r) => { r.dispositions[0].decidedBy.id = "assistant"; }, "human_disposition_required"],
  ["unknown coordinator", (r) => { r.scope.owner.kind = "unknown"; }, "human_owner_required"],
  ["product mismatch", (r) => { r.receipts[0].product = "OTHER"; }, "product_unit_conflict"],
  ["unit mismatch", (r) => { r.receipts[0].unit = "BOX"; }, "product_unit_conflict"],
  ["stale source", (r) => { r.receipts[0].sourceRevision = "r0"; }, "source_revision"],
  ["missing source", (r) => { r.sources.shift(); }, "source_revision"],
  ["future source", (r) => { r.sources[0].capturedAt = "2026-10-05T00:00:00Z"; }, "future_source"],
  ["future receipt", (r) => { r.receipts[0].receivedAt = "2026-10-05T00:00:00Z"; }, "future_event"],
  ["receipt after capture", (r) => { r.receipts[0].receivedAt = "2026-10-04T16:30:00Z"; }, "event_after_capture"],
  ["disposition after capture", (r) => { r.dispositions[0].decidedAt = "2026-10-04T16:30:00Z"; }, "event_after_capture"],
  ["authorization after capture", (r) => { r.lines[0].authorizedAt = "2026-10-04T16:30:00Z"; }, "event_after_capture"],
  ["receipt before authorization", (r) => { r.receipts[0].receivedAt = "2026-10-01T00:00:00Z"; }, "receipt_before_authorization"],
  ["disposition before receipt", (r) => { r.dispositions[0].decidedAt = "2026-10-02T00:00:00Z"; }, "disposition_before_receipt"],
  ["over-receipt", (r) => { r.receipts[0].quantity = 6; }, "over_receipt"],
  ["range outside received lot", (r) => { r.dispositions[0].unitRanges[0].last = 4; }, "invalid_unit_range"],
  ["reversed range", (r) => { r.dispositions[0].unitRanges[0].first = 3; }, "invalid_unit_range"],
  ["overlap across dispositions", (r) => secondDisposition(r, 2, 3), "overlapping_disposition"],
  ["overlap within disposition", (r) => r.dispositions[0].unitRanges.push({ first: 2, last: 3 }), "overlapping_disposition"],
  ["void receipt supporting disposition", (r) => { r.receipts[0].status = "void"; }, "disposition_without_receipt"],
  ["missing receipt replacement", (r) => { r.receipts[0].status = "superseded"; }, "invalid_supersession"],
  ["undeclared replacement", (r) => { r.receipts[0].replacedBy = "OTHER"; }, "invalid_supersession"],
  ["self disposition replacement", (r) => { r.dispositions[0].status = "superseded"; r.dispositions[0].replacedBy = r.dispositions[0].id; }, "invalid_supersession"],
]) {
  test(`returns: blocks ${name} without hiding record coverage`, () => {
    const input = clone();
    mutate(input);
    const report = reconcileSellerReturns(input);
    assert.equal(report.status, "blocked");
    assert.deepEqual(report.balances, []);
    assert.ok(report.exceptions.some((row) => row.code === code), JSON.stringify(report.exceptions));
    for (const kind of ["lines", "receipts", "dispositions"]) assert.deepEqual(report.coverage[kind], input[kind].map((row) => row.id));
    assert.deepEqual(sellerReturnFindings({ input, report }), []);
  });
}

test("returns: adjacent ranges are disjoint, holds survive complete evidence", () => {
  const input = clone();
  input.lines[0].authorizedQuantity = 3;
  secondDisposition(input).decision = "hold";
  let report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.equal(report.balances[0].dispositionEvidenced, 3);
  assert.equal(report.balances[0].status, "held");
  assert.deepEqual(report.balances[0].dispositionHolds, ["DECISION-B"]);
  input.dispositions[1].decision = "repair";
  input.lines[0].holds.push("Recall review required");
  report = reconcileSellerReturns(input);
  assert.equal(report.balances[0].status, "held");
  assert.deepEqual(report.balances[0].holds, ["Recall review required"]);
});

test("returns: missing receipt and disposition records stay evidence gaps", () => {
  const input = clone();
  input.dispositions = [];
  assert.equal(reconcileSellerReturns(input).balances[0].awaitingDisposition, 3);
  input.receipts = [];
  const row = reconcileSellerReturns(input).balances[0];
  assert.equal(row.notEvidencedReceived, 5);
  assert.equal(row.awaitingDisposition, 0);
});

test("returns: void disposition remains covered but does not count", () => {
  const input = clone();
  input.dispositions[0].status = "void";
  const report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.equal(report.balances[0].dispositionEvidenced, 0);
  assert.deepEqual(report.coverage.dispositions, ["DECISION-A"]);
});

test("returns: explicit disposition correction counts only current replacement", () => {
  const input = clone();
  secondDisposition(input, 1, 3);
  input.dispositions[0].status = "superseded";
  input.dispositions[0].replacedBy = "DECISION-B";
  const report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.equal(report.balances[0].dispositionEvidenced, 3);
});

test("returns: receipt correction cannot inherit an old disposition linkage", () => {
  const input = clone();
  input.receipts.push({ ...input.receipts[0], id: "RECEIPT-B", sourceRecord: "ROW-R2" });
  input.receipts[0].status = "superseded";
  input.receipts[0].replacedBy = "RECEIPT-B";
  assert.equal(reconcileSellerReturns(input).status, "blocked");
  input.dispositions[0].receiptId = "RECEIPT-B";
  const report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.equal(report.balances[0].received, 3);
});

test("returns: multiple partial receipts and same-product returns remain separate", () => {
  const input = clone();
  input.receipts.push({ ...input.receipts[0], id: "PARTIAL", receivingId: "INBOUND-2", quantity: 2, sourceRecord: "ROW-R2" });
  input.lines.push({ ...input.lines[0], id: "RETURN-B-1", returnId: "RETURN-B", authorizedQuantity: 2, sourceRecord: "ROW-B" });
  input.receipts.push({ ...input.receipts[0], id: "OTHER-RETURN", lineId: "RETURN-B-1", quantity: 2, sourceRecord: "ROW-R3" });
  const report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.deepEqual(report.balances.map((row) => [row.authorized, row.received, row.awaitingDisposition]), [[5, 5, 3], [2, 2, 2]]);
});

test("returns: huge lots use exact interval arithmetic without expanding units", () => {
  const input = clone();
  input.lines[0].authorizedQuantity = Number.MAX_SAFE_INTEGER;
  input.receipts[0].quantity = Number.MAX_SAFE_INTEGER;
  input.dispositions[0].unitRanges = [{ first: 1, last: Number.MAX_SAFE_INTEGER }];
  const report = reconcileSellerReturns(input);
  assert.equal(report.status, "draft");
  assert.equal(report.balances[0].awaitingDisposition, 0);
  input.receipts.push({ ...input.receipts[0], id: "EXTRA", receivingId: "OTHER", sourceRecord: "EXTRA" });
  assert.ok(reconcileSellerReturns(input).exceptions.some((row) => row.code === "quantity_overflow"));
});

for (const [name, mutate] of [
  ["fractional units", (r) => { r.receipts[0].quantity = 1.5; }],
  ["negative quantities", (r) => { r.lines[0].authorizedQuantity = -1; }],
  ["unsafe integer", (r) => { r.lines[0].authorizedQuantity = Number.MAX_SAFE_INTEGER + 1; }],
  ["zero-based unit range", (r) => { r.dispositions[0].unitRanges[0].first = 0; }],
  ["implicit timezone", (r) => { r.scope.asOf = "2026-10-04T17:00:00"; }],
  ["invalid calendar date", (r) => { r.scope.asOf = "2026-02-30T17:00:00Z"; }],
  ["raw serial number", (r) => { r.receipts[0].serialNumber = "PRIVATE"; }],
  ["customer address", (r) => { r.lines[0].address = "PRIVATE"; }],
  ["refund authority", (r) => { r.dispositions[0].refundApproved = true; }],
]) test(`returns: strict schema rejects ${name}`, () => {
  const input = clone();
  mutate(input);
  assert.throws(() => reconcileSellerReturns(input), /Invalid seller return input/);
});

test("returns: revised input invalidates reports and no approval can be inherited", () => {
  const input = clone();
  const report = reconcileSellerReturns(input);
  const original = sellerReturnInputDigest(input);
  input.scope.revision = "r2";
  assert.notEqual(sellerReturnInputDigest(input), original);
  assert.ok(sellerReturnFindings({ input, report }).length);
  assert.ok(sellerReturnFindings({ input: fixture, report: { ...report, approved: true } }).length);
  assert.ok(sellerReturnFindings({ input: fixture, report, externalAction: "refund" }).length);
  assert.ok(sellerReturnFindings({ input: fixture, report: { ...report, coverage: { ...report.coverage, dispositions: [] } } }).length);
});

test("returns: saved artifacts and Markdown preserve actual evidence and owner", async () => {
  const artifact = JSON.parse(await readFile(new URL("seller-return.example.json", base), "utf8"));
  assert.deepEqual(artifact, { input: fixture, report: reconcileSellerReturns(fixture) });
  const markdown = renderSellerReturns(fixture);
  assert.equal(await readFile(new URL("return-handoff.example.md", base), "utf8"), markdown);
  assert.ok(markdown.includes("| 5 | 3 | 2 | 2 | 1 | open |"));
  assert.ok(markdown.includes("COORDINATOR-LEE"));
  for (const row of [...fixture.lines, ...fixture.receipts, ...fixture.dispositions]) assert.ok(markdown.includes(`${row.sourceRef} / ${row.sourceRevision} / ${row.sourceRecord}`));
  assert.ok(markdown.includes("Recorded disposition is not executed repair"));
});
