export function widgetInvocation(body, args) {
  const names = new Set((body.tools ?? []).map((tool) => tool.name));
  if (names.has("show_widget")) return { name: "show_widget", args };
  if (names.has("tool_call")) return { name: "tool_call", args: { id: "show_widget", args } };
  throw new Error("Visual runtime has no advertised widget invocation tool.");
}

export function assertWidgetToolResult(records) {
  const index = records.findIndex((record) => record.emittedTool === "show_widget");
  const emitted = records[index];
  if (!emitted || typeof emitted.emittedCallId !== "string" || !emitted.emittedCallId) {
    throw new Error("Visual runtime has no identified show_widget call.");
  }
  for (const record of records.slice(index + 1)) {
    if (record.path !== "/v1/responses" || typeof record.body !== "string") continue;
    const body = JSON.parse(record.body);
    const result = (body.input ?? []).find((item) =>
      item?.type === "function_call_output" && item.call_id === emitted.emittedCallId,
    );
    if (!result) continue;
    let output;
    try { output = JSON.parse(result.output); } catch {
      throw new Error("show_widget returned no structured canvas result.");
    }
    const envelope = output;
    if (emitted.emittedFunction === "tool_call") {
      if (output?.tool?.name !== "show_widget" || output.tool.source !== "openclaw") {
        throw new Error("Deferred widget result has the wrong tool identity.");
      }
      output = output.result?.details;
    }
    // A canvas-shaped payload must not hide a failed outer or nested execution.
    for (const value of [envelope, envelope?.result, output]) {
      if (value && (
        value.isError === true || value.ok === false || value.success === false ||
        value.error || value.timedOut === true ||
        (value.exitCode !== undefined && value.exitCode !== 0) ||
        (value.status !== undefined && !["ok", "success", "completed"].includes(value.status))
      )) {
        throw new Error("show_widget returned a failed tool result.");
      }
    }
    if (
      output?.kind !== "canvas" || output?.presentation?.target !== "assistant_message" ||
      typeof output?.view?.id !== "string" || !output.view.id ||
      typeof output?.view?.url !== "string" ||
      !output.view.url.startsWith("/__openclaw__/canvas/documents/")
    ) {
      throw new Error("show_widget did not return an inline hosted canvas.");
    }
    return output;
  }
  throw new Error("show_widget has no matching executed tool result.");
}
