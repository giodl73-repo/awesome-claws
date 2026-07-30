import assert from "node:assert/strict";
import test from "node:test";
import { validateSetupTemplateDeclarations } from "./setup-templates.mjs";

test("accepts complete scalar setup interpolation", () => {
  assert.doesNotThrow(() =>
    validateSetupTemplateDeclarations(
      [{ id: "name" }, { id: "timezone" }],
      [{ content: "Name: {{ input.name }}\nTimezone: {{ input.timezone }}" }],
    ),
  );
});

test("rejects unknown, malformed, and unused setup interpolation", () => {
  assert.throws(
    () =>
      validateSetupTemplateDeclarations([{ id: "name" }], [
        { content: "Name: {{ input.unknown }}" },
      ]),
    /undeclared input unknown/,
  );
  assert.throws(
    () => validateSetupTemplateDeclarations([{ id: "name" }], [{ content: "{{ name }}" }]),
    /only scalar input interpolation/,
  );
  assert.throws(
    () => validateSetupTemplateDeclarations([{ id: "name" }], [{ content: "No inputs" }]),
    /name is not referenced/,
  );
});
