import { readFile, writeFile, mkdir } from "node:fs/promises";

const base = new URL("../sources/progress-billing-review-preparer/", import.meta.url);
const save = async (path, value) => {
  await mkdir(new URL(path.slice(0, path.lastIndexOf("/")), base), { recursive: true });
  await writeFile(new URL(path, base), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const text = { type: "string", minLength: 1, maxLength: 160, pattern: "\\S" };
const optional = { anyOf: [text, { type: "null" }] };
const bool = { type: "boolean" };
const amount = { type: "string", pattern: "^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,4})?$", maxLength: 18 };
const rate = { type: "string", pattern: "^(0(\\.[0-9]{1,6})?|1(\\.0{1,6})?)$", maxLength: 8 };
const list = (items, minItems = 0, maxItems = 200) => ({ type: "array", items, ...(minItems > 0 ? { minItems } : {}), maxItems });
const object = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const enumeration = (...values) => ({ enum: values });
const evidence = { sourceRef: text, sourceRevision: text, nativeId: text };
const row = (properties) => object({ id: text, ...evidence, ...properties });
const input = object({
  schemaVersion: { const: "awesomeClaws.progressBillingInput.v1" },
  scope: object({ contract: text, application: text, revision: text, period: { type: "integer", minimum: 1, maximum: 120 },
    periodStart: { type: "string", format: "date" }, periodEnd: { type: "string", format: "date" },
    asOf: { type: "string", format: "date-time" }, currency: { type: "string", pattern: "^[A-Z]{3}$" },
    minorDigits: { type: "integer", minimum: 0, maximum: 4 }, reviewer: text, privateDestination: text }),
  coverage: row({ lines: list(text, 1), lots: list(text), complete: bool, historyComplete: bool, cashComplete: bool,
    checklistComplete: bool, rulesComplete: bool, noDuplicateCoverage: bool, disclosureApproved: bool, unresolvedCorrections: list(text) }),
  sources: list(object({ id: text, revision: text, currentRevision: text, contract: text,
    capturedAt: { type: "string", format: "date-time" }, approved: bool }), 1),
  periods: list(row({ number: { type: "integer", minimum: 1, maximum: 120 },
    start: { type: "string", format: "date" }, end: { type: "string", format: "date" }, applicationRevision: text }), 1, 120),
  lines: list(row({ baseScheduled: amount, installedOpening: amount, installedClosing: amount,
    storedOpening: amount, storedClosing: amount, workedRate: rate, storedRate: rate,
    rounding: enumeration("half-up-per-component", "half-even-per-component", "unsupported"), rulesRef: text,
    negativeAdjustmentRef: optional }), 1),
  changes: list(row({ line: text, amount, state: enumeration("approved", "pending", "rejected"), approvalRef: optional })),
  installed: list(row({ line: text, kind: enumeration("new-work", "stored-transfer", "adjustment"), amount, authorizationRef: optional })),
  lots: list(row({ line: text, opening: amount, additions: amount, removals: amount, closing: amount,
    eligible: bool, eligibilityRef: optional, movementRef: text,
    transfers: list(object({ installedRef: text, amount })) })),
  history: object({ mode: enumeration("cumulative-snapshot", "period-certification"),
    applications: list(row({ line: text, period: { type: "integer", minimum: 1, maximum: 120 },
      applicationRevision: text, installed: amount, stored: amount })),
    certificates: list(row({ line: text, period: { type: "integer", minimum: 1, maximum: 120 },
      applicationRevision: text, kind: enumeration("cumulative-snapshot", "period-certification"), amount,
      supersedes: optional, replacementApprovalRef: optional, correctionResolved: bool })) }),
  cash: list(row({ line: text, amount, at: { type: "string", format: "date-time" },
    basis: enumeration("applied-to-prior-certificates", "advance", "unresolved"),
    throughPeriod: { type: "integer", minimum: 0, maximum: 119 }, ownerConfirmed: bool, applicationRef: optional })),
  attachments: list(row({ requiredRevision: text, suppliedRevision: optional, permitted: bool }))
});
const derivedAmount = { type: "string", pattern: "^-?(0|[1-9][0-9]{0,15})(\\.[0-9]{1,4})?$", maxLength: 22 };
const nullableAmount = { anyOf: [derivedAmount, { type: "null" }] };
const result = object({ inputDigest: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
  state: enumeration("blocked", "ready-for-owner-review"),
  lines: list(object({ id: text, scheduled: derivedAmount, installed: derivedAmount, stored: derivedAmount, workedRetainage: derivedAmount,
    storedRetainage: derivedAmount, entitlement: derivedAmount, priorCertified: derivedAmount, current: derivedAmount, priorUnpaid: derivedAmount,
    effectiveCertificates: list(text), negativeAdjustment: bool })),
  total: nullableAmount, priorUnpaid: nullableAmount,
  blockers: list(object({ code: text, id: text }), 0, 10000)
});
const authority = object(Object.fromEntries(["certification", "submission", "invoice", "accounting", "waiver", "eligibilityDetermination"].map(k => [k, { const: "not-performed" }])));
await save("schemas/progress-billing-input.schema.json", { $schema: "https://json-schema.org/draft/2020-12/schema", ...input });
await save("schemas/progress-billing.schema.json", { $schema: "https://json-schema.org/draft/2020-12/schema", ...object({
  schemaVersion: { const: "awesomeClaws.progressBilling.v1" }, input, result, authority
}) });

const { deriveProgressBilling, renderProgressBilling, progressBillingAuthority } = await import("./progress-billing-review-preparer.mjs");
const ref = (id, rest) => ({ id, sourceRef: "owner-pack", sourceRevision: "r1", nativeId: id, ...rest });
const example = {
  schemaVersion: "awesomeClaws.progressBillingInput.v1",
  scope: { contract: "Contract-Alias", application: "APP-3", revision: "r1", period: 3,
    periodStart: "2026-10-01", periodEnd: "2026-10-05", asOf: "2026-10-05T18:00:00Z", currency: "USD", minorDigits: 2,
    reviewer: "Owner billing reviewer", privateDestination: "private/owner-review" },
  coverage: ref("coverage", { lines: ["A", "B"], lots: ["LOT-A"], complete: true, historyComplete: true,
    cashComplete: true, checklistComplete: true, rulesComplete: true, noDuplicateCoverage: true, disclosureApproved: true, unresolvedCorrections: [] }),
  sources: [{ id: "owner-pack", revision: "r1", currentRevision: "r1", contract: "Contract-Alias", capturedAt: "2026-10-05T17:00:00Z", approved: true }],
  periods: [ref("period-1", { number: 1, start: "2026-08-01", end: "2026-08-31", applicationRevision: "r1" }),
    ref("period-2", { number: 2, start: "2026-09-01", end: "2026-09-30", applicationRevision: "r1" }),
    ref("period-3", { number: 3, start: "2026-10-01", end: "2026-10-05", applicationRevision: "r1" })],
  lines: [ref("A", { baseScheduled: "100000", installedOpening: "20000", installedClosing: "35000", storedOpening: "10000", storedClosing: "5000", workedRate: "0.10", storedRate: "0.10", rounding: "half-up-per-component", rulesRef: "owner-rules-A-r1", negativeAdjustmentRef: null }),
    ref("B", { baseScheduled: "100000", installedOpening: "50000", installedClosing: "60000", storedOpening: "0", storedClosing: "0", workedRate: "0.05", storedRate: "0.05", rounding: "half-up-per-component", rulesRef: "owner-rules-B-r1", negativeAdjustmentRef: null })],
  changes: [ref("change-approved", { line: "A", amount: "10000", state: "approved", approvalRef: "owner-change-1" }),
    ref("change-pending", { line: "A", amount: "7000", state: "pending", approvalRef: null })],
  installed: [ref("installed-A-new", { line: "A", kind: "new-work", amount: "10000", authorizationRef: "owner-progress-A" }),
    ref("installed-A-transfer", { line: "A", kind: "stored-transfer", amount: "5000", authorizationRef: "owner-install-LOT-A" }),
    ref("installed-B-new", { line: "B", kind: "new-work", amount: "10000", authorizationRef: "owner-progress-B" })],
  lots: [ref("LOT-A", { line: "A", opening: "10000", additions: "0", removals: "0", closing: "5000", eligible: true,
    eligibilityRef: "owner-eligibility-A", movementRef: "owner-lot-ledger-r1", transfers: [{ installedRef: "installed-A-transfer", amount: "5000" }] })],
  history: { mode: "cumulative-snapshot", applications: [
    ref("app-A-1", { line: "A", period: 1, applicationRevision: "r1", installed: "10000", stored: "0" }),
    ref("app-B-1", { line: "B", period: 1, applicationRevision: "r1", installed: "20000", stored: "0" }),
    ref("app-A-2", { line: "A", period: 2, applicationRevision: "r1", installed: "20000", stored: "10000" }),
    ref("app-B-2", { line: "B", period: 2, applicationRevision: "r1", installed: "50000", stored: "0" })], certificates: [
    ref("cert-A-1", { line: "A", period: 1, applicationRevision: "r1", kind: "cumulative-snapshot", amount: "9000", supersedes: null, replacementApprovalRef: null, correctionResolved: true }),
    ref("cert-B-1", { line: "B", period: 1, applicationRevision: "r1", kind: "cumulative-snapshot", amount: "19000", supersedes: null, replacementApprovalRef: null, correctionResolved: true }),
    ref("cert-A-2", { line: "A", period: 2, applicationRevision: "r1", kind: "cumulative-snapshot", amount: "27000", supersedes: null, replacementApprovalRef: null, correctionResolved: true }),
    ref("cert-B-2", { line: "B", period: 2, applicationRevision: "r1", kind: "cumulative-snapshot", amount: "47500", supersedes: null, replacementApprovalRef: null, correctionResolved: true })] },
  cash: [ref("cash-A", { line: "A", amount: "20000", at: "2026-10-03T12:00:00Z", basis: "applied-to-prior-certificates", throughPeriod: 2, ownerConfirmed: true, applicationRef: "owner-cash-application-A" }),
    ref("cash-B", { line: "B", amount: "47500", at: "2026-10-03T12:00:00Z", basis: "applied-to-prior-certificates", throughPeriod: 2, ownerConfirmed: true, applicationRef: "owner-cash-application-B" })],
  attachments: [ref("backup-checklist", { requiredRevision: "r1", suppliedRevision: "r1", permitted: true })]
};
const report = (input) => ({ schemaVersion: "awesomeClaws.progressBilling.v1", input, result: deriveProgressBilling(input), authority: progressBillingAuthority });
await save("fixtures/progress-billing-input.example.json", example);
const record = report(example);
await save("fixtures/progress-billing.example.json", record);
const rendered = renderProgressBilling(record);
await save("fixtures/application.example.md", rendered.draft);
await save("fixtures/workpaper.example.md", rendered.workpaper);
const corrected = structuredClone(example);
corrected.scope.revision = "r2";
corrected.periods[2].applicationRevision = "r2";
corrected.history.certificates.push(ref("cert-A-2-corrected", { ...corrected.history.certificates[2], id: "cert-A-2-corrected", nativeId: "cert-A-2-corrected", amount: "26000", supersedes: "cert-A-2", replacementApprovalRef: "owner-replacement-approval", correctionResolved: true }));
const correctedRecord = report(corrected);
await save("fixtures/progress-billing-corrected.example.json", correctedRecord);
const blocked = structuredClone(example);
blocked.coverage.historyComplete = false;
blocked.attachments[0].suppliedRevision = null;
await save("fixtures/progress-billing-blocked.example.json", report(blocked));
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const entry = catalog.entries.find(e => e.id === "progress-billing-review-preparer");
const session = JSON.parse(await readFile(new URL("fixtures/session-demo.json", base), "utf8"));
session.scenario = entry.example.request;
session.messages[0].text = entry.example.request;
const [lineA, lineB] = record.result.lines;
const correctedA = correctedRecord.result.lines.find(l => l.id === lineA.id);
const money = value => `${example.scope.currency} ${value}`;
session.messages[1].text = `The synthetic owner pack reconciles ${lineA.id}: ${money(lineA.current)} and ${lineB.id}: ${money(lineB.current)}. Cumulative certificates are snapshots, never additive. The partial stored transfer is counted once.`;
session.messages[3].text = `Private draft total ${money(record.result.total)}; prior certified unpaid ${money(record.result.priorUnpaid)} remains separate. Authorized replacement of ${lineA.id}'s prior certificate with ${money(correctedA.priorCertified)} changes ${lineA.id} to ${money(correctedA.current)} and requires fresh review. No certification, submission or accounting action occurred.`;
session.report.summary = session.messages[3].text;
session.report.items = [
  { title: "Original private application", summary: `${lineA.id} ${money(lineA.current)} + ${lineB.id} ${money(lineB.current)} = ${money(record.result.total)}; worked/stored retainage is calculated separately by line.`, tags: ["draft", "owner-review"] },
  { title: "Stored and certificate workpaper", summary: `${example.lots[0].id}: ${example.lots[0].opening} + ${example.lots[0].additions} - ${example.lots[0].transfers[0].amount} - ${example.lots[0].removals} = ${example.lots[0].closing}. Prior ${lineA.id} snapshot ${example.history.certificates[2].amount}, not ${example.history.certificates[0].amount} + ${example.history.certificates[2].amount}; cash ${example.cash[0].amount} does not replace certification.`, tags: ["evidence", "reconciled"] },
  { title: "Revision and authority handoff", summary: "Review fixtures/progress-billing.example.json, application.example.md and workpaper.example.md. Missing history or attachments blocks totals. All examples are synthetic deterministic fixtures.", tags: ["handoff", "private"] }
];
await save("fixtures/session-demo.json", session);
