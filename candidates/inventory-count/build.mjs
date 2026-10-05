import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = new URL("./", import.meta.url);
const read = (path) => fs.readFile(new URL(path, root));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (path, value) => fs.writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`);
const input = JSON.parse(await read("inputs/counts.json"));
assert.equal(input.synthetic, true);
assert.equal(input.rows.length, 9, "This builder is an exact-example evaluation");
const inputSha256 = sha(await read("inputs/counts.json"));
const paper = Workbook.create();
const review = paper.worksheets.add("Count review");
const sources = paper.worksheets.add("Sources");
const original = Workbook.create();
const originalSources = original.worksheets.add("Sources");
function style(sheet, range) {
  sheet.showGridLines = false;
  sheet.getRange(range).format = { font: { name: "Arial", size: 11, color: "#202124" }, rowHeight: 24, verticalAlignment: "center" };
}
function header(sheet, range) {
  sheet.getRange(range).format = { fill: "#344B42", font: { name: "Arial", size: 11, color: "#FFFFFF", bold: true }, horizontalAlignment: "center", rowHeight: 30 };
}
function fillSources(sheet) {
  style(sheet, "A1:J29");
  sheet.getRange("A1:A29").format.columnWidth = 28;
  sheet.getRange("B1:J29").format.columnWidth = 22;
  sheet.getRange("A2").values = [["Inventory count sources (synthetic)"]];
  sheet.getRange("A2").format.font.size = 15;
  sheet.getRange("A3:B4").values = [["Revision", input.revision], ["Scope", input.scope]];
  for (let i = 0; i < input.fields.length; i++) {
    sheet.getRangeByIndexes(i + 5, 0, 1, 10).values = [[input.fields[i], ...input.rows.map((r) => [5, 6, 9].includes(i) ? new Date(r[i]) : r[i])]];
  }
  header(sheet, "A6:J6");
  for (const r of [11, 12, 15]) sheet.getRange(`B${r}:J${r}`).setNumberFormat("mm/dd/yy hh:mm");
  sheet.getRange("B13:J14").setNumberFormat("0");
  sheet.getRange("B20:J21").setNumberFormat("0");
  sheet.getRange("B19:J19").format.wrapText = true;
  sheet.getRange("A19:J19").format.rowHeight = 38;
  sheet.getRange("A27:B28").values = [["Source JSON SHA-256", inputSha256], ["Decision provenance", "All supplied decisions are synthetic assertions. No real approval."]];
  sheet.freezePanes.freezeRows(6);
}
fillSources(sources);
fillSources(originalSources);
style(review, "A1:H19");
for (const [col, width] of Object.entries({ A: 18, B: 13, C: 15, D: 16, E: 16, F: 13, G: 17, H: 44 })) review.getRange(`${col}1:${col}19`).format.columnWidth = width;
review.getRange("A2").values = [["Inventory count review (synthetic)"]];
review.getRange("A2").format.font.size = 15;
review.getRange("A3").values = [["Physical units including holds. Owner review pending for every row."]];
review.getRange("A5:H5").values = [["Case", "Book", "Net movement", "Comparison", "Selected count", "Variance", "Owner selection", "Review state"]];
header(review, "A5:H5");
for (let i = 0; i < input.rows.length; i++) {
  const r = i + 6;
  const col = String.fromCharCode(66 + i);
  const s = (n) => `'Sources'!${col}${n}`;
  const data = input.rows[i];
  review.getRange(`A${r}`).values = [[data[0]]];
  review.getRange(`G${r}`).values = [[data[16]]];
  review.getRange(`G${r}`).dataValidation = { rule: { type: "list", values: ["first", "second"] } };
  // Scope and identity are pinned to this example, not inferred from counts.
  const basis = [`'Sources'!$B$3="${input.revision}"`, `'Sources'!$B$4="${input.scope}"`, ...[0, 1, 2, 3, 4, 18].map((n) => `${s(n + 6)}="${data[n]}"`), `${s(18)}="company"`, `${s(19)}="physical-including-held"`, `${s(23)}="supplied"`, `${s(17)}="complete"`, `OR(${s(16)}="excluded",${s(16)}="included")`, `ISNUMBER(${s(11)})`, `ISNUMBER(${s(12)})`, `ISNUMBER(${s(15)})`, `${s(11)}<=${s(15)}`, `${s(15)}<=${s(12)}`, `ISNUMBER(${s(13)})`, `ISNUMBER(${s(14)})`].join(",");
  review.getRange(`B${r}`).formulas = [[`=IF(ISNUMBER(${s(13)}),${s(13)},"n.a.")`]];
  review.getRange(`C${r}`).formulas = [[`=IF(AND(${basis}),IF(${s(16)}="excluded",${s(14)},0),"n.a.")`]];
  review.getRange(`D${r}`).formulas = [[`=IF(COUNT(B${r}:C${r})=2,SUM(B${r}:C${r}),"n.a.")`]];
  review.getRange(`E${r}`).formulas = [[`=IF(AND(G${r}="first",ISNUMBER(${s(20)})),${s(20)},IF(AND(G${r}="second",ISNUMBER(${s(21)})),${s(21)},"n.a."))`]];
  review.getRange(`F${r}`).formulas = [[`=IF(COUNT(D${r}:E${r})=2,E${r}-D${r},"n.a.")`]];
  review.getRange(`H${r}`).formulas = [[`=IF(NOT(ISNUMBER(D${r})),"Supply basis / movement / revision",IF(NOT(ISNUMBER(E${r})),"Supply count / owner selection","Owner review pending"))`]];
}
review.getRange("B6:F14").setNumberFormat("0;[Red](0);0");
review.getRange("B6:F14").format.horizontalAlignment = "right";
review.getRange("G6:G14").format.fill = "#FFF2CC";
review.getRange("G6:G14").format.horizontalAlignment = "center";
review.getRange("F6:F14").conditionalFormats.add("cellIs", { operator: "notEqual", formula: 0, format: { font: { color: "#9C2424", bold: true } } });
review.getRange("A16").values = [["Owner selection: first or second. Missing decisions remain open."]];
review.getRange("A17").values = [["Held case: 10 physical includes 2 held. Do not substitute 8 eligible units."]];
review.getRange("A18").values = [["No aggregate netting, adjustments, purchase orders or certification."]];
review.getRange("A19").values = [["Changed sources or selections invalidate saved proof and require fresh review."]];
const expected = [-2, 2, -1, "n.a.", 0, "n.a.", "n.a.", -10, "n.a."];
paper.recalculate();
assert.deepEqual(review.getRange("F6:F14").values.flat(), expected);
const mutations = [];
for (const [name, sheet, cell, value, resultCell, result] of [
  ["receipt changes", sources, "D14", 4, "F8", -2],
  ["receipt already included", sources, "D16", "included", "F8", 2],
  ["missing movement", sources, "D14", null, "F8", "n.a."],
  ["incomplete movements", sources, "D17", "unknown", "F8", "n.a."],
  ["movement after count", sources, "D15", new Date("2026-10-05T10:31:00Z"), "F8", "n.a."],
  ["movement before book", sources, "D15", new Date("2026-10-05T09:59:00Z"), "F8", "n.a."],
  ["missing rule", sources, "D16", null, "F8", "n.a."],
  ["wrong units", sources, "D10", "case", "F8", "n.a."],
  ["changed lot", sources, "D9", "other", "F8", "n.a."],
  ["changed bin", sources, "D8", "other", "F8", "n.a."],
  ["changed item", sources, "D7", "other", "F8", "n.a."],
  ["stale row revision", sources, "D24", "r2", "F8", "n.a."],
  ["stale global revision", sources, "B3", "r2", "F8", "n.a."],
  ["changed scope", sources, "B4", "other", "F8", "n.a."],
  ["unknown ownership", sources, "F18", null, "F10", "n.a."],
  ["eligible not physical", sources, "F19", "eligible", "F10", "n.a."],
  ["zero is not missing", sources, "B20", 0, "F6", -10],
  ["blank is not zero", sources, "I20", null, "F13", "n.a."],
  ["recount chosen by owner", review, "G14", "first", "F14", -2],
  ["second chosen by owner", review, "G14", "second", "F14", 0],
  ["selection alone does not fix basis", review, "G11", "first", "F11", "n.a."],
  ["no auto favorable recount", review, "G14", "invalid", "F14", "n.a."],
]) {
  const before = sheet.getRange(cell).values;
  sheet.getRange(cell).values = [[value]];
  paper.recalculate();
  assert.equal(review.getRange(resultCell).values[0][0], result, name);
  mutations.push({ name, result, status: "passed" });
  sheet.getRange(cell).values = before;
}
paper.recalculate(); original.recalculate();
assert.deepEqual(review.getRange("F6:F14").values.flat(), expected);
assert.deepEqual(sources.getRange("A1:J29").values, originalSources.getRange("A1:J29").values);
console.log((await paper.inspect({ kind: "table", range: "'Count review'!A5:H14", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 8, maxChars: 2500 })).ndjson);
const scan = await paper.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(scan.ndjson);
assert.match(scan.ndjson, /matched 0 entries/);
await fs.mkdir(new URL("outputs/", root), { recursive: true });
await (await SpreadsheetFile.exportXlsx(original)).save(fileURLToPath(new URL("inputs/inventory-source.xlsx", root)));
await (await SpreadsheetFile.exportXlsx(paper)).save(fileURLToPath(new URL("outputs/inventory-review.xlsx", root)));
const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(new URL("outputs/inventory-review.xlsx", root))));
reopened.recalculate();
assert.deepEqual(reopened.worksheets.getItem("Count review").getRange("F6:F14").values.flat(), expected);
assert.deepEqual(reopened.worksheets.getItem("Count review").getRange("A1:H19").formulas, review.getRange("A1:H19").formulas);
assert.equal(reopened.worksheets.getItem("Sources").getRange("A1:J29").formulas.flat().filter(Boolean).length, 0);
const savedSources = reopened.worksheets.getItem("Sources").getRange("A1:J29").values;
originalSources.getRange("A1:J29").values.forEach((row, r) => row.forEach((value, c) => {
  const saved = savedSources[r][c];
  if (value instanceof Date) assert.equal(Math.round((saved - 25569) * 86400000), value.getTime());
  else assert.equal(saved, value);
}));
reopened.worksheets.getItem("Sources").getRange("D14").values = [[4]];
reopened.recalculate();
assert.equal(reopened.worksheets.getItem("Count review").getRange("F8").values[0][0], -2);
reopened.worksheets.getItem("Sources").getRange("D14").values = [[3]];
reopened.recalculate();
assert.deepEqual(reopened.worksheets.getItem("Count review").getRange("F6:F14").values.flat(), expected);
for (const [sheetName, range, name] of [["Count review", "A1:H19", "review"], ["Sources", "A1:J29", "sources"]]) {
  const preview = await paper.render({ sheetName, range, scale: 1 });
  await fs.writeFile(new URL(`outputs/${name}.png`, root), new Uint8Array(await preview.arrayBuffer()));
}
const blockedActions = ["overwrite-source", "replace-formulas-with-values", "execute-macros", "upload-workbook", "disclose-sensitive-data", "infer-missing-facts", "accept-output"];
const checks = [
  ["source-hash", "passed", "Original XLSX bytes and source JSON hash bound in calculation-proof.json."],
  ["formula-preservation", "passed", "Source values preserved on export/reimport; 54 formulas added only to review."],
  ["recalculation", "passed", `${mutations.length} restored input mutations in Artifact Tool. Native Excel not tested.`],
  ["formatting", "not-run", "Both previews rendered. See private-handoff.md for manual visual review; regeneration requires fresh inspection."],
  ["links", "not-applicable", "No external workbook links."],
  ["charts", "not-applicable", "No charts required."],
  ["macros", "not-applicable", "Generated macro-free XLSX files."],
  ["validation", "passed", "Exact-example basis, identity, revision, time, numeric and selection guards tested."],
  ["output-open", "passed", "Artifact Tool reimport/recalculation preserves expected variances and source values."],
].map(([kind, status, details]) => ({ id: `check-${kind}`, kind, status, details, refs: ["workbook-inventory"] }));
const exceptions = [{ id: "exception-review", severity: "high", refs: ["sheet-review"], description: "Human inventory review pending on every row; no-rule, no-basis, missing and recount lack required evidence or decisions. Separate -2/+2 variances remain unresolved.", state: "open" }];
const manifest = {
  schemaVersion: "awesomeClaws.spreadsheetChange.v1",
  workbook: { id: "workbook-inventory", owner: input.owner, asOf: input.asOf, sourcePath: "inputs/inventory-source.xlsx", sourceSha256: sha(await read("inputs/inventory-source.xlsx")), outputPath: "outputs/inventory-review.xlsx", recalculationEngine: "Artifact Tool; native Excel not tested", sensitivity: "internal", state: "blocked" },
  sheets: [{ id: "sheet-sources", name: "Sources", role: "source", sourcePreserved: true, formulaCountBefore: 0, formulaCountAfter: 0 }, { id: "sheet-review", name: "Count review", role: "output", sourcePreserved: true, formulaCountBefore: 0, formulaCountAfter: 54 }],
  transformations: [{ id: "transform-review", kind: "add-sheet", targetSheetRef: "sheet-review", inputRefs: ["sheet-sources"], outputRange: "Count review!A1:H19", logic: "Preserve source rows. Compare physical book plus explicitly excluded movement with owner-selected count; block missing basis and counts, retain separate bin variances.", formulaPolicy: "add-only", state: "verified" }],
  checks, exceptions,
  reviewQuestions: [{ id: "question-owner", question: "What supplied evidence resolves missing basis, movement rules, counts and recount selection?", reason: "Synthetic assertions are not real inventory approval. Every row needs owner review.", refs: ["exception-review"] }],
  blockedActions,
  handoff: { state: "blocked", owner: input.owner, transformationRefs: ["transform-review"], checkRefs: checks.map((c) => c.id), exceptionRefs: ["exception-review"], reviewQuestionRefs: ["question-owner"], blockingRefs: ["exception-review", "check-formatting"], prohibitedActions: blockedActions },
};
await write("outputs/spreadsheet-change.json", manifest);
await write("outputs/calculation-proof.json", { engine: "@oai/artifact-tool", nativeExcel: "not-tested", inputSha256, sourceSha256: manifest.workbook.sourceSha256, outputSha256: sha(await read("outputs/inventory-review.xlsx")), manifestSha256: sha(await read("outputs/spreadsheet-change.json")), variances: expected, mutations, sourcePreserved: true, reopened: true, reopenedMutationPassed: true, formulaErrorScan: scan.ndjson });
console.log(`Saved workbook; ${mutations.length} mutation checks passed.`);
