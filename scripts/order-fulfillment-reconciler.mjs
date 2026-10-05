import { createHash } from "node:crypto";
import schema from "../sources/order-fulfillment-reconciler/schemas/fulfillment.schema.json" with { type: "json" };
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Temporal } from "@js-temporal/polyfill";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile({ ...schema.$defs.input, $defs: schema.$defs });
const validateRecord = ajv.compile(schema);
const canonical = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const time = (value) => Temporal.Instant.from(value).epochNanoseconds;
const cell = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("|", "&#124;").replaceAll("\n", " ").replaceAll("\r", " ");

export function fulfillmentInputDigest(input) {
  return `sha256:${createHash("sha256").update(canonical(input)).digest("hex")}`;
}

// This is a supplied-evidence reconciliation, not a claim about unobserved goods movements.
export function reconcileFulfillment(input) {
  if (!validate(input)) throw new Error(`Invalid fulfillment input: ${ajv.errorsText(validate.errors)}`);
  const exceptions = [];
  const add = (code, recordId, message) => exceptions.push({ code, recordId, message });
  const unique = (rows, kind) => {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.id)) add("duplicate_identity", row.id, `Duplicate ${kind} identity`);
      seen.add(row.id);
    }
  };
  for (const key of ["sources", "lines", "shipments", "deliveries"]) unique(input[key], key);
  if (/^(agent|assistant|order fulfillment reconciler)$/u.test(input.scope.owner.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/gu, " "))) {
    add("human_owner_required", "SCOPE", "Name the accountable human coordinator");
  }
  const asOf = time(input.scope.asOf);
  const sources = new Map(input.sources.map((row) => [row.id, row]));
  for (const row of input.sources) {
    if (time(row.capturedAt) > asOf) add("future_source", row.id, "Source was captured after the as-of cutoff");
  }
  const evidenceKeys = new Set();
  const source = (row, kind, eventAt = null) => {
    const found = sources.get(row.sourceRef);
    if (!found || found.revision !== row.sourceRevision) add("source_revision", row.id, "Missing source or non-current source revision");
    if (found && eventAt !== null && time(eventAt) > time(found.capturedAt)) add("event_after_capture", row.id, "Event postdates its supporting source snapshot");
    const key = canonical([kind, row.sourceRef, row.sourceRevision, row.sourceRecord]);
    if (evidenceKeys.has(key)) add("duplicate_evidence", row.id, "The same source record cannot be counted twice under different identities");
    evidenceKeys.add(key);
  };
  const lines = new Map(input.lines.map((row) => [row.id, row]));
  const orderLines = new Set();
  for (const line of input.lines) {
    source(line, "order");
    const key = canonical([line.orderId, line.orderLine]);
    if (orderLines.has(key)) add("duplicate_order_line", line.id, "More than one current record for the same order line");
    orderLines.add(key);
    if (!line.accepted) add("unaccepted_order", line.id, "Order or change has not been explicitly accepted");
    if (line.cancelled === null || !line.cancellationAuthorized) add("cancellation_unknown", line.id, "Explicit authorized cancellation quantity, including zero, is required");
    if (line.cancelled > line.ordered) add("cancellation_over_quantity", line.id, "Cancellation exceeds ordered quantity");
  }
  const shipments = new Map(input.shipments.map((row) => [row.id, row]));
  const currentDepartures = new Set();
  const sum = (rows) => rows.reduce((total, row) => total + BigInt(row.quantity), 0n);
  for (const shipment of input.shipments) {
    source(shipment, "shipment", shipment.occurredAt);
    if (shipment.status === "departed") {
      const key = canonical([shipment.shipmentId, shipment.lineId]);
      if (currentDepartures.has(key)) add("duplicate_departure", shipment.id, "Only one current departure record per shipment and order line is allowed");
      currentDepartures.add(key);
    }
    const line = lines.get(shipment.lineId);
    if (!line) add("orphan_shipment", shipment.id, "Shipment has no matching order line");
    else if (shipment.sku !== line.sku || shipment.unit !== line.unit) add("item_unit_conflict", shipment.id, "Shipment SKU or unit differs from the exact order line");
    if (time(shipment.occurredAt) > asOf) add("future_event", shipment.id, "Shipment record is beyond the as-of cutoff");
    if (shipment.status === "superseded") {
      const replacement = shipments.get(shipment.replacedBy);
      if (!replacement || replacement.id === shipment.id || replacement.status !== "departed" || replacement.lineId !== shipment.lineId || replacement.shipmentId !== shipment.shipmentId) {
        add("invalid_supersession", shipment.id, "Supersession must name a current departed replacement for the same shipment and order line");
      }
    } else if (shipment.replacedBy !== null) add("invalid_supersession", shipment.id, "Only an explicitly superseded record may name a replacement");
  }
  for (const delivery of input.deliveries) {
    source(delivery, "delivery", delivery.confirmedAt);
    const shipment = shipments.get(delivery.shipmentLineId);
    if (!shipment) add("orphan_delivery", delivery.id, "Delivery has no matching shipment line");
    else {
      if (shipment.status !== "departed") add("delivery_without_departure", delivery.id, "Label, void and superseded records cannot support delivery");
      if (delivery.unit !== shipment.unit) add("item_unit_conflict", delivery.id, "Delivery unit differs from the shipment line");
      if (time(delivery.confirmedAt) < time(shipment.occurredAt)) add("delivery_before_departure", delivery.id, "Delivery confirmation predates departure");
    }
    if (time(delivery.confirmedAt) > asOf) add("future_event", delivery.id, "Delivery confirmation is beyond the as-of cutoff");
  }
  for (const shipment of input.shipments) {
    if (sum(input.deliveries.filter((row) => row.shipmentLineId === shipment.id)) > BigInt(shipment.quantity)) {
      add("over_delivery", shipment.id, "Delivery confirmations exceed this shipment line, regardless of other orders' totals");
    }
  }
  const balances = input.lines.map((line) => {
    const departed = input.shipments.filter((row) => row.lineId === line.id && row.status === "departed");
    const shipped = sum(departed);
    const departedIds = new Set(departed.map((row) => row.id));
    const delivered = sum(input.deliveries.filter((row) => departedIds.has(row.shipmentLineId)));
    const net = BigInt(line.ordered) - BigInt(line.cancelled ?? 0);
    if (shipped > net) add("over_shipment", line.id, "Departed quantity exceeds accepted net ordered quantity");
    if ([shipped, delivered].some((value) => value > BigInt(Number.MAX_SAFE_INTEGER))) add("quantity_overflow", line.id, "Quantity exceeds the exact integer output range");
    return {
      lineId: line.id, netOrdered: Number(net), shipped: Number(shipped), deliveryConfirmed: Number(delivered),
      notShipped: Number(net - shipped), shippedWithoutConfirmation: Number(shipped - delivered),
      overdueEvidence: line.promisedAt === null ? null : asOf > time(line.promisedAt) && delivered < net,
      holds: [...line.holds],
      status: line.holds.length ? "held" : delivered === net ? "quantity-evidenced" : "open",
    };
  });
  // A broken source link may affect more than its named line. Suppress all balances until reconciled.
  return {
    schemaVersion: "awesomeClaws.fulfillmentReport.v1", inputDigest: fulfillmentInputDigest(input),
    status: exceptions.length ? "blocked" : "draft", owner: input.scope.owner, asOf: input.scope.asOf,
    approved: false, externalActionsPerformed: false,
    balances: exceptions.length ? [] : balances, exceptions,
    coverage: { lines: input.lines.map((row) => row.id), shipments: input.shipments.map((row) => row.id), deliveries: input.deliveries.map((row) => row.id) },
  };
}

export function fulfillmentFindings(record) {
  try {
    if (!validateRecord(record)) return [{ code: "fulfillment_schema", message: ajv.errorsText(validateRecord.errors) }];
    const expected = reconcileFulfillment(record.input);
    if (canonical(record.report) !== canonical(expected)) return [{ code: "fulfillment_report", message: "Report differs from current source-bound reconciliation; no inherited approval or omitted exceptions are allowed" }];
    return [];
  } catch (error) {
    return [{ code: "fulfillment_input", message: error.message }];
  }
}

export function renderFulfillment(input) {
  const report = reconcileFulfillment(input);
  const rows = ["# Order fulfillment handoff", "", `Status: ${report.status}; human owner: ${cell(report.owner)}; as of: ${cell(report.asOf)}`, "",
    "Supplied evidence only. Quantity evidence is not release approval, financial closure, or confirmation of unobserved movement. No external action performed.", "",
    `Input digest: ${report.inputDigest}`, ""];
  if (report.status === "blocked") {
    rows.push("## Evidence blockers", "", ...report.exceptions.map((row) => `- ${cell(row.recordId)}: ${cell(row.code)} - ${cell(row.message)}`));
  } else {
    rows.push("| Order / line | Net ordered | Departed | Delivery-confirmed | Not evidenced shipped | Shipped without confirmation | Status | Holds | Past promise without full delivery evidence |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |");
    for (const row of report.balances) {
      const line = input.lines.find((item) => item.id === row.lineId);
      rows.push(`| ${cell(line.orderId)} / ${cell(line.orderLine)} (${cell(row.lineId)}) | ${row.netOrdered} | ${row.shipped} | ${row.deliveryConfirmed} | ${row.notShipped} | ${row.shippedWithoutConfirmation} | ${row.status} | ${row.holds.map(cell).join(", ") || "none supplied"} | ${row.overdueEvidence === null ? "unknown promise" : row.overdueEvidence ? "yes" : "no"} |`);
    }
  }
  const citation = (row) => `${cell(row.sourceRef)} / ${cell(row.sourceRevision)} / ${cell(row.sourceRecord)}`;
  rows.push("", "## Movement evidence", "", "These are supplied records, not independently verified movements.", "",
    ...input.lines.map((row) => `- Order line ${cell(row.id)}: ${row.ordered} ${cell(row.unit)} ordered; ${row.cancelled ?? "unknown"} cancelled; source ${citation(row)}.`),
    ...input.shipments.map((row) => `- Shipment line ${cell(row.id)} (${cell(row.shipmentId)}), order line ${cell(row.lineId)}: ${row.quantity} ${cell(row.unit)}, ${cell(row.status)} at ${cell(row.occurredAt)}; replacement ${cell(row.replacedBy ?? "none")}; source ${citation(row)}.`),
    ...input.deliveries.map((row) => `- Delivery ${cell(row.id)}, shipment line ${cell(row.shipmentLineId)}: ${row.quantity} ${cell(row.unit)} confirmed at ${cell(row.confirmedAt)}; source ${citation(row)}.`));
  rows.push("", "## Customer-status drafts", "", "For coordinator review only. Not sent; no new delivery promise is made.", "");
  if (report.status === "blocked") rows.push("Status wording withheld until the evidence blockers are resolved.");
  for (const row of report.balances) {
    const line = input.lines.find((item) => item.id === row.lineId);
    rows.push(`- ${cell(line.orderId)} / ${cell(line.orderLine)}: As of ${cell(report.asOf)}, supplied records show ${row.shipped} of ${row.netOrdered} ${cell(line.unit)} departed and ${row.deliveryConfirmed} delivery-confirmed. ${row.notShipped} lack departure evidence; ${row.shippedWithoutConfirmation} departed units lack delivery confirmation. Holds: ${row.holds.map(cell).join(", ") || "none supplied"}.`);
  }
  rows.push("", "## Source register", "", ...input.sources.map((row) => `- ${cell(row.id)} revision ${cell(row.revision)} captured ${cell(row.capturedAt)}`), "",
    "## Record coverage", "", ...Object.entries(report.coverage).map(([kind, ids]) => `- ${kind}: ${ids.map(cell).join(", ") || "none supplied"}`), "",
    "## Human handoff", "", "The named coordinator must resolve blockers and holds, obtain missing departure/delivery evidence, and review any customer-status wording. No picking, shipping, carrier booking, order change, invoicing, refund, or customer contact is authorized by this report.", "");
  return rows.join("\n");
}
