import assert from "node:assert/strict";
import test from "node:test";
import { isSafePackagePath, pathsConflict, portablePathKey } from "./portable-paths.mjs";

test("accepts normalized package-relative paths", () => {
  assert.equal(isSafePackagePath("templates/report.md"), true);
  assert.equal(
    portablePathKey("Templates/Re\u0301sume\u0301.md"),
    "templates/r\u00e9sum\u00e9.md",
  );
  assert.equal(pathsConflict("templates", "templates/report.md"), true);
});

test("rejects absolute, traversal, Windows drive-relative, and ADS paths", () => {
  for (const path of [
    "/etc/passwd",
    "../secret",
    "templates/../../secret",
    "C:/secret",
    "C:secret",
    "templates/report.md:ads",
    "templates\\report.md",
    "CON",
    "COM\u00b9",
    "LPT\u00b3.txt",
    "templates/bad?.md",
    "templates/trailing.",
    "templates/trailing ",
    "templates/control\u0001.md",
  ]) {
    assert.equal(isSafePackagePath(path), false, path);
  }
});
