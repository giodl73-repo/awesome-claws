export function isActivityRecap(body) {
  if (body.tools !== undefined || !Array.isArray(body.input) || body.input.length !== 2) {
    return false;
  }
  const [system, user] = body.input;
  if (
    system?.role !== "system" || user?.role !== "user" ||
    system.content?.length !== 1 || user.content?.length !== 1 ||
    system.content[0]?.type !== "input_text" || user.content[0]?.type !== "input_text" ||
    !system.content[0].text?.startsWith("Write an Activity recap for someone scanning their tasks:")
  ) {
    return false;
  }
  try {
    const payload = JSON.parse(user.content[0].text);
    return typeof payload?.previousRecap === "string" &&
      Array.isArray(payload.messages) && payload.messages.every((message) => typeof message === "string") &&
      typeof payload.omittedContent === "boolean";
  } catch {
    return false;
  }
}

export function selectApplicationRequest(records) {
  for (const record of records) {
    if (record.path !== "/v1/responses") continue;
    // Skip only the observed background recap contract, never a failed agent request.
    if (typeof record.body !== "string") return record;
    const body = JSON.parse(record.body);
    if (!isActivityRecap(body)) return record;
  }
  return undefined;
}
