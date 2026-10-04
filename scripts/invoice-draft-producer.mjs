import { createHash } from "node:crypto";

const SCALE = 1000000n;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const require = (condition, message) => { if (!condition) throw new Error(message); };
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const canonical = (value) => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v);

function quantity(value) {
  require(typeof value === "string" && /^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(value), "Invalid decimal quantity");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}

function decimal(value) {
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${value / SCALE}${fraction ? `.${fraction}` : ""}`;
}

function safe(value) {
  require(value >= 0n && value <= MAX, "Amount outside safe minor-unit range");
  return Number(value);
}

function rounded(numerator, denominator) {
  return safe((numerator * 2n + denominator) / (2n * denominator));
}

function unique(rows, key) {
  require(Array.isArray(rows), "Expected records");
  const values = rows.map(key);
  require(new Set(values).size === values.length, "Duplicate record identity");
}

function date(value) {
  require(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "Expected calendar date");
  const result = new Date(`${value}T00:00:00Z`);
  require(Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === value, "Invalid calendar date");
  return result;
}

export function deriveInvoiceDraft(record) {
  const { scope, rules, history, items, balances } = record;
  require(record.schemaVersion === "awesomeClaws.invoiceDraft.v1", "Unknown invoice contract");
  for (const key of ["seller", "sellerBilling", "customer", "customerBilling", "currency", "draftRef", "revision", "reviewer", "privateDestination"]) {
    require(text(scope[key]), `Missing scope ${key}`);
  }
  require(/^[A-Z]{3}$/.test(scope.currency) && integer(scope.minorDigits) && scope.minorDigits <= 4, "Invalid currency precision");
  require(!/^(agent|assistant|invoice-draft-producer)$/i.test(scope.reviewer), "A human reviewer is required");
  date(scope.invoiceDate);
  require(date(scope.periodStart) <= date(scope.periodEnd), "Reversed service period");
  require(date(scope.periodEnd) <= date(scope.invoiceDate), "Completion period is after invoice date");
  require(integer(rules.netDays) && rules.netDays <= 365, "Unsupported calendar payment terms");
  require(text(rules.sourceRef) && text(rules.revision) && typeof rules.confirmed === "boolean", "Missing billing rule evidence");
  require(text(history.sourceRef) && text(history.revision) && typeof history.complete === "boolean", "Missing history declaration");
  unique(items, (item) => item.id);
  unique(items, (item) => item.sourceRef);
  unique(balances, (balance) => balance.id);
  unique(balances, (balance) => balance.sourceRef);
  unique(history.rows, (row) => canonical([row.sourceId, row.invoiceRef]));
  require(items.length > 0, "No billable source records supplied");
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const row of history.rows) {
    require(itemById.has(row.sourceId) && text(row.invoiceRef), "Unknown prior-billing source");
    require(row.customer === scope.customer && row.currency === scope.currency, "Prior-billing scope mismatch");
    require(row.unit === itemById.get(row.sourceId).unit, "Prior-billing quantity unit mismatch");
    quantity(row.quantity);
  }
  const blockers = [];
  const add = (id, reason) => blockers.push({ id, reason });
  if (!history.complete) add(history.sourceRef, "Owner must confirm complete prior-billing coverage.");
  if (!rules.confirmed || rules.rounding !== "half-up-per-line") add(rules.sourceRef, "Supply current approved rules and supported explicit rounding.");
  if (rules.poRequired && !text(scope.purchaseOrder)) add(rules.sourceRef, "Supply the required customer PO.");
  const lines = [];
  const coverage = [];
  for (const item of items) {
    require(text(item.id) && text(item.revision) && text(item.sourceRef) && text(item.unit), "Missing source identity");
    require(["bill", "defer", "reject"].includes(item.decision), "Unknown disposition");
    for (const key of ["approved", "completed", "current", "disclosureApproved"]) require(typeof item[key] === "boolean", `Missing ${key}`);
    require(integer(item.rateMinor) && integer(item.discountMinor), "Invalid rate or discount");
    require(item.taxBps === null || integer(item.taxBps) && item.taxBps <= 10000, "Unsupported tax rate");
    const total = quantity(item.quantity);
    const billed = history.rows.filter((row) => row.sourceId === item.id).reduce((sum, row) => sum + quantity(row.quantity), 0n);
    require(billed <= total, "Previously billed quantity exceeds source quantity");
    const remaining = total - billed;
    let disposition = "blocked";
    const reasons = [];
    if (total === 0n && item.decision === "bill") reasons.push("Supply a positive billable quantity or an explicit owner deferral/rejection; zero work is not already billed.");
    if (item.customer !== scope.customer || item.currency !== scope.currency) reasons.push("Resolve customer or currency mismatch.");
    if (item.periodStart !== scope.periodStart || item.periodEnd !== scope.periodEnd) reasons.push("Resolve source service-period mismatch.");
    if (!item.current) reasons.push("Supply the current source revision.");
    if (!history.complete) reasons.push("Confirm complete prior billing before calculating unbilled work.");
    if (item.decision !== "bill") {
      if (!text(item.decisionRef)) reasons.push("Supply the owner's explicit deferral or rejection.");
      if (!reasons.length) disposition = item.decision === "defer" ? "deferred" : "rejected";
    } else if (remaining === 0n && !reasons.length) {
      disposition = "already-billed";
    } else {
      if (!item.approved || !text(item.approvalRef)) reasons.push("Supply billing approval and the current agreement/rate reference.");
      if (!item.completed || !text(item.completionRef)) reasons.push("Supply completion and any required acceptance evidence.");
      if (!item.disclosureApproved || !text(item.description)) reasons.push("Supply a disclosure-approved billing description.");
      if (item.taxBps === null) reasons.push("Supply explicit tax treatment, including zero where applicable.");
      if (!rules.confirmed || rules.rounding !== "half-up-per-line") reasons.push("Resolve billing and rounding instructions.");
      if (!reasons.length) {
        const gross = rounded(remaining * BigInt(item.rateMinor), SCALE);
        require(item.discountMinor <= gross, "Discount exceeds supported gross amount");
        const net = gross - item.discountMinor;
        const tax = rounded(BigInt(net) * BigInt(item.taxBps), 10000n);
        lines.push({ sourceId: item.id, revision: item.revision, description: item.description, unit: item.unit,
          quantity: decimal(remaining), rateMinor: item.rateMinor, gross, discount: item.discountMinor, net,
          taxBps: item.taxBps, tax, total: safe(BigInt(net) + BigInt(tax)) });
        disposition = "included";
      }
    }
    for (const reason of reasons) add(item.id, reason);
    coverage.push({ sourceId: item.id, revision: item.revision, totalQuantity: decimal(total),
      billedQuantity: decimal(billed), proposedQuantity: disposition === "included" ? decimal(remaining) : "0", disposition });
  }
  const totals = Object.fromEntries(["gross", "discount", "net", "tax", "total"].map((key) => [key,
    safe(lines.reduce((sum, line) => sum + BigInt(line[key]), 0n))]));
  const applications = [];
  for (const balance of balances) {
    require(text(balance.id) && text(balance.revision) && text(balance.sourceRef), "Missing balance identity");
    require(["deposit", "credit"].includes(balance.kind), "Unknown balance kind");
    require(integer(balance.remaining) && integer(balance.proposed), "Invalid balance amount");
    require(typeof balance.current === "boolean" && typeof balance.authorized === "boolean", "Missing balance evidence state");
    const valid = balance.current && balance.authorized && text(balance.authorizationRef)
      && balance.customer === scope.customer && balance.currency === scope.currency
      && balance.draftRef === scope.draftRef && balance.draftRevision === scope.revision
      && balance.proposed <= balance.remaining;
    if (!valid) add(balance.id, "Resolve balance scope, freshness, available amount and exact-draft authorization.");
    applications.push({ id: balance.id, revision: balance.revision, kind: balance.kind,
      proposed: balance.proposed, included: valid ? balance.proposed : 0, state: valid ? "proposed" : "blocked" });
  }
  const applied = safe(applications.reduce((sum, application) => sum + BigInt(application.included), 0n));
  if (applied > totals.total) add(scope.draftRef, "Proposed balances exceed the supported invoice total; obtain revised applications.");
  if (lines.length === 0) add(scope.draftRef, "No supported invoice lines are available.");
  const dueDate = date(scope.invoiceDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + rules.netDays);
  // Detect stale derived output, not source authenticity or external approval.
  const inputDigest = `sha256:${createHash("sha256").update(canonical({ scope, rules, history, items, balances })).digest("hex")}`;
  return { inputDigest, state: blockers.length ? "blocked" : "ready-for-owner-review", draftRevision: scope.revision,
    dueDate: dueDate.toISOString().slice(0, 10), rulesRevision: rules.revision, historyRevision: history.revision,
    lines, coverage, applications, totals: { ...totals, applications: applied, due: applied <= totals.total ? totals.total - applied : null }, blockers };
}

export function invoiceDraftFindings(record) {
  try {
    const expected = deriveInvoiceDraft(record);
    const findings = [];
    if (canonical(record.result) !== canonical(expected)) findings.push({ code: "invoice_result", path: "result", message: "Recompute the complete draft and coverage from current evidence; do not preserve stale totals or readiness." });
    const authority = { invoice: "draft-not-issued", sending: "not-performed", numbering: "not-reserved", ledger: "not-changed", payment: "not-collected", balances: "not-applied" };
    if (canonical(record.authority) !== canonical(authority)) findings.push({ code: "invoice_authority", path: "authority", message: "All external invoice and accounting actions remain unperformed." });
    return findings;
  } catch (error) {
    return [{ code: "invoice_input", path: "$", message: error.message }];
  }
}

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("|", "&#124;").replaceAll("\n", " ").replaceAll("\r", " ").replaceAll(/([\\`*_\[\]])/g, "\\$1");

export function renderInvoiceDraft(record) {
  const findings = invoiceDraftFindings(record);
  require(findings.length === 0, JSON.stringify(findings));
  const { scope: s, result: r } = record;
  const money = (value) => {
    if (value === null) return "Unresolved";
    const scale = 10n ** BigInt(s.minorDigits);
    const amount = BigInt(value);
    return `${s.currency} ${amount / scale}${s.minorDigits ? `.${(amount % scale).toString().padStart(s.minorDigits, "0")}` : ""}`;
  };
  const draft = ["# DRAFT - NOT ISSUED", `Draft: ${escape(s.draftRef)} revision ${escape(s.revision)}`,
    r.state === "blocked" ? "**BLOCKED WORKING DRAFT - incomplete; not a request for payment.**" : "Ready for owner review only; not a request for payment.",
    `Seller: ${escape(s.sellerBilling)}`, `Bill to: ${escape(s.customerBilling)}`,
    `Proposed date: ${s.invoiceDate}. Service period: ${s.periodStart} through ${s.periodEnd}.`,
    `Customer PO: ${escape(text(s.purchaseOrder) ? s.purchaseOrder : record.rules.poRequired ? "Required - pending owner input" : "Not required under supplied rules")}.`,
    `Terms: Net ${record.rules.netDays} calendar days. Proposed due date: ${r.dueDate}.`,
    "| Description | Quantity/unit | Rate | Gross | Discount | Net | Tax rate | Tax | Total |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n"
      + r.lines.map((line) => `| ${escape(line.description)} | ${line.quantity} ${escape(line.unit)} | ${money(line.rateMinor)} | ${money(line.gross)} | ${money(line.discount)} | ${money(line.net)} | ${line.taxBps / 100}% | ${money(line.tax)} | ${money(line.total)} |`).join("\n"),
    ...["gross", "discount", "net", "tax", "total"].map((key) => `${key === "total" ? "Invoice total" : key}: ${money(r.totals[key])}`),
    ...["deposit", "credit"].map((kind) => `Proposed ${kind} application: ${money(r.applications.filter((a) => a.kind === kind).reduce((sum, a) => sum + a.included, 0))}`),
    `**Proposed amount due: ${money(r.totals.due)}**`,
    "Tax uses the owner's supplied per-line rates on discounted charges, rounded half-up to the supplied currency precision. No legal or tax determination is made.",
    "No invoice was issued, sent or posted. No balance was consumed or payment collected. Official numbering and payment instructions remain with the issuing owner."].join("\n\n") + "\n";
  const workpaper = ["# Private billing workpaper", `Reviewer: ${escape(s.reviewer)}. Destination: ${escape(s.privateDestination)}.`,
    `Draft ${escape(s.draftRef)} revision ${escape(s.revision)}: **${r.state}**.`,
    `Billing rules ${escape(record.rules.sourceRef)} revision ${escape(r.rulesRevision)}; prior history ${escape(record.history.sourceRef)} revision ${escape(r.historyRevision)}; complete: ${record.history.complete}.`,
    "| Source/revision | Total quantity | Previously billed | Proposed quantity | Disposition |\n| --- | ---: | ---: | ---: | --- |\n"
      + r.coverage.map((row) => `| ${escape(row.sourceId)}/${escape(row.revision)} | ${row.totalQuantity} | ${row.billedQuantity} | ${row.proposedQuantity} | ${row.disposition} |`).join("\n"),
    "## Source evidence", ...record.items.map((item) => `- ${escape(item.id)}: ${escape(item.sourceRef)}; approval ${escape(item.approvalRef ?? "missing")}; completion ${escape(item.completionRef ?? "missing")}; disposition ${escape(item.decisionRef ?? "bill if supported")}.`),
    "## Prior invoices", ...record.history.rows.map((row) => `- ${escape(row.sourceId)}: ${row.quantity} ${escape(row.unit)} on ${escape(row.invoiceRef)}.`),
    "## Proposed balances", ...record.balances.map((balance) => `- ${escape(balance.id)}/${escape(balance.revision)}: ${escape(balance.sourceRef)}; remaining ${money(balance.remaining)}; proposed ${money(balance.proposed)}; authorization ${escape(balance.authorizationRef ?? "missing")} for ${escape(balance.draftRef)}/${escape(balance.draftRevision)}.`),
    "## Calculations", ...r.lines.map((line) => `- ${escape(line.sourceId)}: ${line.quantity} x ${money(line.rateMinor)} = ${money(line.gross)}; discount ${money(line.discount)}; net ${money(line.net)}; ${line.taxBps / 100}% tax ${money(line.tax)}; total ${money(line.total)}.`),
    `Invoice total ${money(r.totals.total)}; proposed applications ${money(r.totals.applications)}; proposed due ${money(r.totals.due)}.`,
    "## Owner questions", ...(r.blockers.length ? r.blockers.map((blocker) => `- ${escape(blocker.id)}: ${escape(blocker.reason)}`) : ["No input blockers remain; the owner must review this exact draft revision."]),
    "Recalculate after source changes. Nothing was issued, sent, numbered, posted, paid or applied. Require the owner's actual issued invoice before handoff to Invoice and payment follow-up."].join("\n\n") + "\n";
  return { draft, workpaper };
}
