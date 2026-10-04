import assert from "node:assert/strict";
import { test } from "node:test";
import { assertWidgetToolResult, widgetInvocation } from "./visual-runtime-tool-proof.mjs";

const canvas = { kind: "canvas", presentation: { target: "assistant_message" }, view: { id: "cv_test", url: "/__openclaw__/canvas/documents/cv_test/index.html" } };
const emitted = { emittedTool: "show_widget", emittedCallId: "widget-call" };
const response = (output, callId = "widget-call") => ({ path: "/v1/responses", body: JSON.stringify({ input: [{ type: "function_call_output", call_id: callId, output }] }) });

test("uses only advertised direct or deferred widget invocation", () => {
  const args = { title: "test", widget_code: "<p>test</p>" };
  assert.deepEqual(widgetInvocation({ tools: [{ name: "show_widget" }, { name: "tool_call" }] }, args), { name: "show_widget", args });
  assert.deepEqual(widgetInvocation({ tools: [{ name: "tool_call" }] }, args), { name: "tool_call", args: { id: "show_widget", args } });
  assert.throws(() => widgetInvocation({}, args), /no advertised/);
});

test("requires the widget call's own successful hosted canvas result", () => {
  assert.deepEqual(assertWidgetToolResult([emitted, response("file written", "write-call"), response(JSON.stringify(canvas))]), canvas);
  assert.throws(() => assertWidgetToolResult([emitted, response(JSON.stringify(canvas), "other-call")]), /no matching/);
  assert.throws(() => assertWidgetToolResult([response(JSON.stringify(canvas)), emitted]), /no matching/);
  assert.throws(() => assertWidgetToolResult([{ emittedTool: "show_widget" }, response(JSON.stringify(canvas))]), /no identified/);
});

test("tool errors and invalid results cannot be hidden by a later valid result", () => {
  for (const output of ["Tool show_widget not found", "{}", JSON.stringify({ ...canvas, kind: "error" }), JSON.stringify({ ...canvas, presentation: { target: "elsewhere" } }), JSON.stringify({ ...canvas, view: { id: "cv_test", url: "https://example.com/" } })]) {
    assert.throws(() => assertWidgetToolResult([emitted, response(output), response(JSON.stringify(canvas))]));
  }
});
