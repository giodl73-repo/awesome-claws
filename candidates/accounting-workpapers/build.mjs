import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { buildCloseWorkpaper, closeWorkpaperNarrative } from "../../scripts/close-workpaper.mjs";

const root = new URL("./", import.meta.url);
const sourceRoot = new URL("../../sources/spreadsheet-analyst/", root);
const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));
const input = await readJson(new URL("fixtures/close-workpaper-input.json", sourceRoot));
const reconciliation = await readJson(new URL("../../sources/financial-account-reconciliation-coordinator/fixtures/financial-account-reconciliation.example.json", root));
const result = buildCloseWorkpaper(input, reconciliation);
assert.deepEqual(result.gaps, []);
const a = result.analysis;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (url, value) => fs.writeFile(url, `${JSON.stringify(value, null, 2)}\n`);
const money = '#,##0.00"  ";(#,##0.00)"  ";"-"';
const paper = Workbook.create();
const review = paper.worksheets.add("Workpaper");
const sources = paper.worksheets.add("Sources");
const raw = Workbook.create();
const rawSources = raw.worksheets.add("Sources");
const rows = input.rows.map((r) => [r.label, r.cents / 100, r.reference, r.revision, r.entity, r.period, r.currency, r.basis, r.accountId, r.state]);
const residuals = a.residuals.map((r) => [r.id, r.usd, r.side, r.reason, r.nextOwner, r.rowRef]);

function style(sheet, area) {
  sheet.showGridLines = false;
  sheet.getRange(area).format.font = { name: "Arial", size: 11, color: "#202124" };
  sheet.getRange(area).format.rowHeight = 22;
  sheet.getRange(area).format.verticalAlignment = "center";
  sheet.getRange(area).format.wrapText = false;
}
function header(sheet, range) {
  sheet.getRange(range).format = { fill: "#344B42", font: { name: "Arial", size: 11, color: "#FFFFFF", bold: true }, horizontalAlignment: "center", rowHeight: 28 };
}
function fillSources(sheet) {
  style(sheet, "A1:J20");
  sheet.getRange("A2").values = [["August close source schedules (synthetic)"]];
  sheet.getRange("A2").format.font = { name: "Arial", size: 15, bold: true };
  sheet.getRange("A3:B6").values = [["Entity", input.entity], ["Period", input.period], ["Currency", input.currency], ["Basis", input.basis]];
  sheet.getRange("E3:F4").values = [["Account", input.accountId], ["Owner", input.owner]];
  sheet.getRange("A7").values = [["Opening: July 31. Closing: August 31, 2026."]];
  sheet.getRange("A9:J9").values = [["Component", "USD", "Source", "Revision", "Entity", "Period", "Currency", "Basis", "Account", "Evidence state"]];
  sheet.getRange("A10:J13").values = rows;
  sheet.getRange("A16").values = [[`Separate account: ${input.reconciliationBinding.accountId}`]];
  sheet.getRange("A17:F17").values = [["Residual", "USD", "Side", "Reason", "Next owner", "Source row"]];
  sheet.getRange("A18:F19").values = residuals;
  header(sheet, "A9:J9"); header(sheet, "A17:F17");
  for (const [col, width] of Object.entries({ A: 33, B: 28, C: 25, D: 22, E: 27, F: 28, G: 12, H: 32, I: 21, J: 23 })) sheet.getRange(`${col}1:${col}20`).format.columnWidth = width;
  sheet.getRange("B10:B13").setNumberFormat(money);
  sheet.getRange("B18:B19").setNumberFormat(money);
  sheet.getRange("B10:B13").format.font.color = "#0000FF";
  sheet.getRange("B18:B19").format.font.color = "#0000FF";
  sheet.freezePanes.freezeRows(9);
}
fillSources(rawSources);
fillSources(sources);
style(review, "A1:E28");
for (const [col, width] of Object.entries({ A: 36, B: 17, C: 27, D: 23, E: 36 })) review.getRange(`${col}1:${col}28`).format.columnWidth = width;
review.getRange("A2").values = [["August close workpaper"]];
review.getRange("A2").format.font = { name: "Arial", size: 15, bold: true };
review.getRange("A3:B5").values = [["Entity", input.entity], ["Currency", input.currency], ["Account", input.accountId]];
review.getRange("D3:E5").values = [["Period", input.period], ["Basis", input.basis], ["Reviewer", input.owner]];
review.getRange("A6").values = [["Unexplained change (USD)"]];
review.getRange("B6").formulas = [["=B16"]];
review.getRange("E6").formulas = [['=IF(COUNT(B10:B13)=4,"Accountant review pending","Evidence needed")']];
review.getRange("A7").values = [["Opening: July 31. Closing: August 31, 2026."]];
review.getRange("D7:E7").values = [["As of", new Date(input.asOf)]];
review.getRange("E7").setNumberFormat("yyyy-mm-dd");
review.getRange("A9:E9").values = [["Component", "USD", "Source", "Prepared revision", "Availability"]];
header(review, "A9:E9");
for (let i = 0; i < input.rows.length; i++) {
  const r = i + 10;
  review.getRange(`A${r}`).values = [[input.rows[i].label]];
  review.getRange(`C${r}:D${r}`).values = [[input.rows[i].reference, input.rows[i].revision]];
  review.getRange(`E${r}`).formulas = [[`=IF(AND(ISNUMBER('Sources'!B${r}),'Sources'!C${r}=C${r},'Sources'!D${r}=D${r},'Sources'!E${r}=$B$3,'Sources'!F${r}=$E$3,'Sources'!G${r}=$B$4,'Sources'!H${r}=$E$4,'Sources'!I${r}=$B$5,'Sources'!J${r}="supplied-complete",'Sources'!$B$3=$B$3,'Sources'!$B$4=$E$3,'Sources'!$B$5=$B$4,'Sources'!$B$6=$E$4),"Available","Evidence needed")`]];
  review.getRange(`B${r}`).formulas = [[`=IF(E${r}="Available",'Sources'!B${r},"n.a.")`]];
}
review.getRange("A14:A17").values = [["Balance change"], ["Explained by schedules"], ["Unexplained"], ["Change / opening balance"]];
review.getRange("B14:B17").formulas = [
  ['=IF(COUNT(B10:B11)=2,B11-B10,"n.a.")'],
  ['=IF(COUNT(B12:B13)=2,SUM(B12:B13),"n.a.")'],
  ['=IF(COUNT(B14:B15)=2,B14-B15,"n.a.")'],
  ['=IF(AND(ISNUMBER(B14),ISNUMBER(B10),B10<>0),B14/B10,"n.a.")'],
];
review.getRange("B6").setNumberFormat(money);
review.getRange("B10:B16").setNumberFormat(money);
review.getRange("B17").setNumberFormat("0.0%");
review.getRange("A16:B16").format.font.bold = true;
review.getRange("A16:B16").format.borders = { top: { style: "thin", color: "#344B42" } };
review.getRange("B6").conditionalFormats.add("cellIs", { operator: "notEqual", formula: 0, format: { fill: "#FCE8E6", font: { color: "#9C2424", bold: true } } });
review.getRange("A20").values = [[`Unresolved: ${input.reconciliationBinding.accountId}`]];
review.getRange("A22:E22").values = [["Residual", "USD", "Side", "Reason", "Next owner"]];
header(review, "A22:E22");
for (let i = 0; i < 2; i++) review.getRange(`A${23 + i}:E${23 + i}`).formulas = [["A", "B", "C", "D", "E"].map((col) => `='Sources'!${col}${18 + i}`)];
review.getRange("B23:B24").setNumberFormat(money);
review.getRange("A27").values = [["No journal, policy judgment or close approval is implied."]];
raw.recalculate(); paper.recalculate();
assert.deepEqual(review.getRange("B14:B16").values, [[3500], [3000], [500]]);
assert.deepEqual(review.getRange("B23:B24").values, [[1.25], [-0.9]]);
const exercised = [];
for (const [name, cell, value, expected] of [
  ["changed closing balance", "B11", 15600, 600],
  ["missing schedule", "B13", null, "n.a."],
  ["real zero schedule", "B13", 0, 1400],
  ["wrong entity", "E11", "Different entity", "n.a."],
  ["wrong period", "F11", "2026-09", "n.a."],
  ["wrong currency", "G11", "EUR", "n.a."],
  ["wrong basis", "H11", "cash basis", "n.a."],
  ["stale source revision", "D11", "r3", "n.a."],
  ["missing source reference", "C12", null, "n.a."],
  ["incomplete source", "J12", "missing", "n.a."],
  ["wrong global entity", "B3", "Different entity", "n.a."],
  ["main schedule ties but separate residuals remain", "B11", 15000, 0],
]) {
  const old = sources.getRange(cell).values;
  sources.getRange(cell).values = [[value]];
  paper.recalculate();
  assert.equal(review.getRange("B16").values[0][0], expected, name);
  assert.deepEqual(review.getRange("B23:B24").values, [[1.25], [-0.9]], name);
  exercised.push({ name, status: "passed" });
  sources.getRange(cell).values = old;
}
paper.recalculate();
assert.deepEqual(sources.getRange("A1:J20").values, rawSources.getRange("A1:J20").values);
assert.deepEqual(sources.getRange("A1:J20").formulas, rawSources.getRange("A1:J20").formulas);
await fs.mkdir(new URL("inputs/", root), { recursive: true });
await fs.mkdir(new URL("outputs/", root), { recursive: true });
await (await SpreadsheetFile.exportXlsx(raw)).save(fileURLToPath(new URL("inputs/close-source.xlsx", root)));
await (await SpreadsheetFile.exportXlsx(paper)).save(fileURLToPath(new URL("outputs/close-review.xlsx", root)));
const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(new URL("outputs/close-review.xlsx", root))));
reopened.recalculate();
assert.deepEqual(reopened.worksheets.getItem("Workpaper").getRange("B14:B16").values, [[3500], [3000], [500]]);
assert.deepEqual(reopened.worksheets.getItem("Sources").getRange("A1:J20").values, rawSources.getRange("A1:J20").values);
const scan = await paper.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 50 }, summary: "final formula error scan" });
console.log(scan.ndjson);
for (const [sheetName, range, filename] of [["Workpaper", "A1:E28", "workpaper.png"], ["Sources", "A1:J20", "sources.png"]]) {
  const image = await paper.render({ sheetName, range, scale: 1 });
  await fs.writeFile(new URL(`outputs/${filename}`, root), new Uint8Array(await image.arrayBuffer()));
}
const sourceHash = sha(await fs.readFile(new URL("inputs/close-source.xlsx", root)));
const outputHash = sha(await fs.readFile(new URL("outputs/close-review.xlsx", root)));
await writeJson(new URL("outputs/calculation-proof.json", root), { engine: "@oai/artifact-tool", sourceSha256: sourceHash, outputSha256: outputHash, scopeSnapshot: a.sourceSnapshot, reconciliationSnapshot: a.reconciliationSnapshot, recalculationCases: exercised, reopened: true, sourceValuesAndFormulasPreserved: true, nativeExcel: "not-tested", formulaErrorScan: scan.ndjson });
await writeJson(new URL("fixtures/close-workpaper-result.json", sourceRoot), result);
await fs.writeFile(new URL("fixtures/close-workpaper.example.md", sourceRoot), closeWorkpaperNarrative(result));
const blockedActions = ["overwrite-source", "replace-formulas-with-values", "execute-macros", "upload-workbook", "disclose-sensitive-data", "infer-missing-facts", "accept-output"];
const checks = [
  ["source-hash", "passed", "Source file SHA-256 recorded from actual bytes; the source path is distinct from the review output."],
  ["formula-preservation", "passed", "Source values and zero source formulas preserved; 24 formulas added on Workpaper."],
  ["recalculation", "passed", "Artifact Tool recalculation passed 12 changed-input cases. Native Microsoft Excel was not tested."],
  ["formatting", "passed", "Known source styles retained, explicit currency formats and fitted columns applied, and both sheet previews captured."],
  ["links", "not-applicable", "No external workbook links were created; cross-sheet formulas link only to preserved Sources."],
  ["charts", "not-applicable", "No charts are required or present in this focused workpaper."],
  ["macros", "not-applicable", "Both generated XLSX files are macro-free; no macro execution occurred."],
  ["validation", "passed", "Required amounts, source references, scope, completeness and prepared revisions are checked before dependent totals."],
  ["output-open", "passed", "Export reimported in Artifact Tool and recalculated to 3500 change, 3000 explained and 500 unexplained; source values unchanged."],
].map(([kind, status, details]) => ({ id: `check-${kind}`, kind, refs: ["workbook-august-close"], status, details }));
const manifest = {
  schemaVersion: "awesomeClaws.spreadsheetChange.v1",
  workbook: { id: "workbook-august-close", owner: input.owner, asOf: input.asOf, sourcePath: "inputs/close-source.xlsx", sourceSha256: sourceHash, outputPath: "outputs/close-review.xlsx", recalculationEngine: "Artifact Tool; native Excel not tested", sensitivity: "internal", state: "blocked" },
  sheets: [
    { id: "sheet-sources", name: "Sources", role: "source", sourcePreserved: true, formulaCountBefore: 0, formulaCountAfter: 0 },
    { id: "sheet-workpaper", name: "Workpaper", role: "output", sourcePreserved: true, formulaCountBefore: 0, formulaCountAfter: 24 },
  ],
  transformations: [{ id: "transform-close-workpaper", kind: "add-sheet", targetSheetRef: "sheet-workpaper", inputRefs: ["sheet-sources"], outputRange: "Workpaper!A1:E28", logic: "Add source-bound balance change and supporting schedules, retain an explicit unexplained amount, and carry separate-account residuals without netting or inferred journals.", formulaPolicy: "add-only", state: "verified" }],
  checks,
  exceptions: [
    { id: "exception-unexplained", severity: "high", refs: ["sheet-workpaper"], description: "USD 500 remains unexplained. The accountant must supply attributable support; no plug or accrual is inferred.", state: "open" },
    { id: "exception-reconciliation", severity: "high", refs: ["sheet-sources"], description: "Operating-001 still has a USD 1.25 ledger residual and a USD -0.90 statement residual. Their owner must resolve each separately.", state: "open" },
  ],
  reviewQuestions: [
    { id: "question-unexplained", question: "Which permitted source supports the remaining USD 500?", reason: "Schedules explain only 3000 of the 3500 balance change.", refs: ["exception-unexplained"] },
    { id: "question-residuals", question: "What evidence resolves each operating-account residual?", reason: "A balanced aggregate does not resolve individual unmatched rows.", refs: ["exception-reconciliation"] },
  ],
  blockedActions,
  handoff: { state: "blocked", owner: input.owner, transformationRefs: ["transform-close-workpaper"], checkRefs: checks.map((c) => c.id), exceptionRefs: ["exception-unexplained", "exception-reconciliation"], reviewQuestionRefs: ["question-unexplained", "question-residuals"], blockingRefs: ["exception-unexplained", "exception-reconciliation"], prohibitedActions: blockedActions },
};
await writeJson(new URL("fixtures/close-spreadsheet-change.example.json", sourceRoot), manifest);
console.log(JSON.stringify({ sourceHash, outputHash, mutationCases: exercised.length, formulaCount: review.getRange("A1:E28").formulas.flat().filter(Boolean).length }));
