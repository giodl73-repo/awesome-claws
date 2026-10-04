import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Temporal } from "@js-temporal/polyfill";
import schema from "../sources/seller-return-reconciler/schemas/seller-return.schema.json" with { type: "json" };

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateInput = ajv.compile({ ...schema.$defs.input, $defs: schema.$defs });
const validateRecord = ajv.compile(schema);
const canonical = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const instant = (value) => Temporal.Instant.from(value).epochNanoseconds;
const human = (person) => person?.kind === "human" && !/^(agent|assistant|automation|unknown|seller[-_]return[-_]reconciler)$/iu.test(person.id);
const cell = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("|", "&#124;").replaceAll("\n", " ").replaceAll("\r", " ");

export function sellerReturnInputDigest(input) {
  return `sha256:${createHash("sha256").update(canonical(input)).digest("hex")}`;
}

export function reconcileSellerReturns(input) {
  if (!validateInput(input)) throw new Error(`Invalid seller return input: ${ajv.errorsText(validateInput.errors)}`);
  const exceptions = [];
  const add = (code, recordId, message) => exceptions.push({ code, recordId, message });
  for (const kind of ["sources", "lines", "receipts", "dispositions"]) {
    const seen = new Set();
    for (const row of input[kind]) {
      if (seen.has(row.id)) add("duplicate_identity", row.id, `Duplicate ${kind} identity`);
      seen.add(row.id);
    }
  }
  if (!human(input.scope.owner)) add("human_owner_required", "SCOPE", "Name an accountable human coordinator");
  const cutoff = instant(input.scope.asOf);
  const sources = new Map(input.sources.map((row) => [row.id, row]));
  for (const row of input.sources) {
    if (instant(row.capturedAt) > cutoff) add("future_source", row.id, "Source capture is after the batch cutoff");
  }
  const usedEvidence = new Set();
  const evidence = (row, kind, at) => {
    const source = sources.get(row.sourceRef);
    if (!source || source.revision !== row.sourceRevision) add("source_revision", row.id, "Missing source or non-current source revision");
    if (source && instant(at) > instant(source.capturedAt)) add("event_after_capture", row.id, "Event postdates its supporting source snapshot");
    if (instant(at) > cutoff) add("future_event", row.id, "Event is after the batch cutoff");
    const key = canonical([kind, row.sourceRef, row.sourceRevision, row.sourceRecord]);
    if (usedEvidence.has(key)) add("duplicate_evidence", row.id, "The same source record cannot count twice under different identities");
    usedEvidence.add(key);
  };
  const lines = new Map(input.lines.map((row) => [row.id, row]));
  const lineKeys = new Set();
  for (const row of input.lines) {
    evidence(row, "authorization", row.authorizedAt);
    const key = canonical([row.returnId, row.returnLine]);
    if (lineKeys.has(key)) add("duplicate_return_line", row.id, "More than one current record for the same return line");
    lineKeys.add(key);
    if (!row.authorized || !human(row.authorizedBy)) add("human_authorization_required", row.id, "Current return quantity requires supplied human authorization");
  }
  const receipts = new Map(input.receipts.map((row) => [row.id, row]));
  const receiptKey = (row) => canonical([row.lineId, row.receivingId, row.lotId]);
  const currentReceipts = new Set();
  const supersession = (row, records, currentStatus, sameAllocation) => {
    if (row.status === "superseded") {
      const replacement = records.get(row.replacedBy);
      if (!replacement || replacement.id === row.id || replacement.status !== currentStatus || !sameAllocation(row, replacement)) {
        add("invalid_supersession", row.id, "A superseded record must name a current replacement for the same allocation");
      }
    } else if (row.replacedBy !== null) add("invalid_supersession", row.id, "Only a superseded record may name a replacement");
  };
  for (const row of input.receipts) {
    evidence(row, "receipt", row.receivedAt);
    const line = lines.get(row.lineId);
    if (!line) add("unmatched_receipt", row.id, "Receipt has no matching authorized return line");
    else {
      if (row.product !== line.product || row.unit !== line.unit) add("product_unit_conflict", row.id, "Receipt product or unit differs from the exact return line");
      if (instant(row.receivedAt) < instant(line.authorizedAt)) add("receipt_before_authorization", row.id, "Receipt predates the supplied return authorization");
    }
    const key = receiptKey(row);
    if (row.status === "received") {
      if (currentReceipts.has(key)) add("duplicate_receipt", row.id, "Repeated current physical receipt allocation");
      currentReceipts.add(key);
    }
    supersession(row, receipts, "received", (a, b) => receiptKey(a) === receiptKey(b));
  }
  const dispositions = new Map(input.dispositions.map((row) => [row.id, row]));
  const rangesByReceipt = new Map();
  const countsByReceipt = new Map();
  for (const row of input.dispositions) {
    evidence(row, "disposition", row.decidedAt);
    if (!human(row.decidedBy)) add("human_disposition_required", row.id, "Disposition requires supplied human decision evidence");
    const receipt = receipts.get(row.receiptId);
    if (!receipt) add("unmatched_disposition", row.id, "Disposition has no matching receipt");
    else {
      if (row.status === "recorded" && receipt.status !== "received") add("disposition_without_receipt", row.id, "Current disposition cannot use void or superseded receipt evidence");
      if (instant(row.decidedAt) < instant(receipt.receivedAt)) add("disposition_before_receipt", row.id, "Disposition predates its linked receipt");
    }
    supersession(row, dispositions, "recorded", (a, b) => a.receiptId === b.receiptId);
    for (const range of row.unitRanges) {
      if (range.first > range.last || (receipt && range.last > receipt.quantity)) add("invalid_unit_range", row.id, "Disposition units are reversed or outside the receipt quantity");
      if (row.status !== "recorded") continue;
      if (!rangesByReceipt.has(row.receiptId)) rangesByReceipt.set(row.receiptId, []);
      rangesByReceipt.get(row.receiptId).push({ ...range, id: row.id });
      const count = BigInt(range.last) - BigInt(range.first) + 1n;
      countsByReceipt.set(row.receiptId, (countsByReceipt.get(row.receiptId) ?? 0n) + count);
    }
  }
  // Compare intervals instead of expanding unit identities, including very large supplied lots.
  for (const ranges of rangesByReceipt.values()) {
    ranges.sort((a, b) => a.first - b.first || a.last - b.last);
    let end = 0;
    for (const range of ranges) {
      if (range.first <= end) add("overlapping_disposition", range.id, "Received units are covered by more than one current disposition range");
      end = Math.max(end, range.last);
    }
  }
  const balances = input.lines.map((line) => {
    const current = input.receipts.filter((row) => row.lineId === line.id && row.status === "received");
    const received = current.reduce((sum, row) => sum + BigInt(row.quantity), 0n);
    const disposed = current.reduce((sum, row) => sum + (countsByReceipt.get(row.id) ?? 0n), 0n);
    const authorized = BigInt(line.authorizedQuantity);
    if (received > authorized) add("over_receipt", line.id, "Received quantity exceeds this return line's authorized quantity");
    if (disposed > received) add("over_disposition", line.id, "Disposition coverage exceeds received quantity");
    if (received > BigInt(Number.MAX_SAFE_INTEGER) || disposed > BigInt(Number.MAX_SAFE_INTEGER)) add("quantity_overflow", line.id, "Quantity exceeds the exact integer output range");
    const ids = new Set(current.map((row) => row.id));
    const dispositionHolds = input.dispositions.filter((row) => row.status === "recorded" && row.decision === "hold" && ids.has(row.receiptId)).map((row) => row.id);
    return {
      lineId: line.id, authorized: line.authorizedQuantity, received: Number(received), dispositionEvidenced: Number(disposed),
      notEvidencedReceived: Number(authorized - received), awaitingDisposition: Number(received - disposed),
      holds: [...line.holds], dispositionHolds,
      status: line.holds.length || dispositionHolds.length ? "held" : disposed === authorized ? "quantity-evidenced" : "open",
    };
  });
  return {
    schemaVersion: "awesomeClaws.sellerReturnReport.v1", inputDigest: sellerReturnInputDigest(input),
    status: exceptions.length ? "blocked" : "draft", owner: { ...input.scope.owner }, asOf: input.scope.asOf,
    approved: false, externalActionsPerformed: false, balances: exceptions.length ? [] : balances, exceptions,
    coverage: { lines: input.lines.map((row) => row.id), receipts: input.receipts.map((row) => row.id), dispositions: input.dispositions.map((row) => row.id) },
  };
}

export function sellerReturnFindings(record) {
  try {
    if (!validateRecord(record)) return [{ code: "seller_return_schema", message: ajv.errorsText(validateRecord.errors) }];
    if (canonical(record.report) !== canonical(reconcileSellerReturns(record.input))) return [{ code: "seller_return_report", message: "Report differs from current source-bound reconciliation; omitted blockers or inherited approval are not allowed" }];
    return [];
  } catch (error) {
    return [{ code: "seller_return_input", message: error.message }];
  }
}

export function renderSellerReturns(input) {
  const report = reconcileSellerReturns(input);
  const citation = (row) => `${cell(row.sourceRef)} / ${cell(row.sourceRevision)} / ${cell(row.sourceRecord)}`;
  const rows = ["# Seller return handoff", "", `Status: ${report.status}; coordinator: ${cell(report.owner.id)} (${cell(report.owner.kind)}); as of: ${cell(report.asOf)}`, "",
    "Supplied evidence only. Recorded disposition is not executed repair, replacement, safety clearance, inventory eligibility or financial closure. No external action performed.", "",
    `Input digest: ${report.inputDigest}`, ""];
  if (report.status === "blocked") rows.push("## Evidence blockers", "", ...report.exceptions.map((row) => `- ${cell(row.recordId)}: ${cell(row.code)} - ${cell(row.message)}`));
  else {
    rows.push("| Return / line | Authorized | Received | Disposition-evidenced | Not evidenced received | Awaiting disposition evidence | Status | Holds |", "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |");
    for (const row of report.balances) {
      const line = input.lines.find((item) => item.id === row.lineId);
      rows.push(`| ${cell(line.returnId)} / ${cell(line.returnLine)} (${cell(line.unit)}) | ${row.authorized} | ${row.received} | ${row.dispositionEvidenced} | ${row.notEvidencedReceived} | ${row.awaitingDisposition} | ${row.status} | ${[...row.holds, ...row.dispositionHolds.map((id) => `Disposition hold ${id}`)].map(cell).join(", ") || "none supplied"} |`);
    }
  }
  rows.push("", "## Source and event ledger", "", ...input.sources.map((row) => `- Source ${cell(row.id)} revision ${cell(row.revision)} captured ${cell(row.capturedAt)}.`),
    ...input.lines.map((row) => `- Return line ${cell(row.id)}: ${row.authorizedQuantity} ${cell(row.unit)}; authorization ${row.authorized}, principal ${cell(row.authorizedBy?.id ?? "missing")} at ${cell(row.authorizedAt)}; holds ${row.holds.map(cell).join(", ") || "none supplied"}; source ${citation(row)}.`),
    ...input.receipts.map((row) => `- Receipt ${cell(row.id)}, return line ${cell(row.lineId)}, receiving ${cell(row.receivingId)}, lot ${cell(row.lotId)}: ${row.quantity} ${cell(row.unit)}, ${cell(row.status)} at ${cell(row.receivedAt)}; replacement ${cell(row.replacedBy ?? "none")}; source ${citation(row)}.`),
    ...input.dispositions.map((row) => `- Disposition ${cell(row.id)}, receipt ${cell(row.receiptId)}, units ${row.unitRanges.map((range) => `${range.first}-${range.last}`).join(", ")}: supplied decision ${cell(row.decision)}, ${cell(row.status)}, principal ${cell(row.decidedBy?.id ?? "missing")} at ${cell(row.decidedAt)}; replacement ${cell(row.replacedBy ?? "none")}; source ${citation(row)}.`),
    "", "## Record coverage", "", ...Object.entries(report.coverage).map(([kind, ids]) => `- ${kind}: ${ids.map(cell).join(", ") || "none supplied"}`),
    "", "## Human-owned downstream handoff", "", "The coordinator must resolve missing receipt/disposition evidence, source conflicts and holds. Escalate supplied safety or recall holds to the accountable human. Recorded repair, replacement or accounting decisions require a separate owner-controlled execution workflow; this report proves none of those actions occurred.", "",
    "No return authorization, warranty decision, inspection, diagnosis, disposition choice, safety clearance, refund, credit, account or inventory adjustment, shipping label, carrier booking, replacement shipment, customer contact or ERP write is authorized by this draft.", "");
  return rows.join("\n");
}
