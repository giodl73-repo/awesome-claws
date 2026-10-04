import assert from "node:assert/strict";
import { test } from "node:test";
import { selectApplicationRequest } from "./portfolio-application-request.mjs";

const message = (role, text) => ({ role, content: [{ type: "input_text", text }] });
const request = (body) => ({ path: "/v1/responses", body: JSON.stringify(body) });
const recap = () => ({ input: [
  message("system", "Write an Activity recap for someone scanning their tasks: summarize."),
  message("user", JSON.stringify({ previousRecap: "", messages: ["user: scenario"], omittedContent: false })),
] });
const agent = request({ input: [message("system", "Claw identity"), message("user", "scenario")], tools: [{}] });

test("skips a leading recap and preserves the first application request", () => {
  assert.equal(selectApplicationRequest([request(recap()), agent, request(recap())]), agent);
  assert.equal(selectApplicationRequest([agent]), agent);
  assert.equal(selectApplicationRequest([{ path: "/health" }, agent]), agent);
});

test("recap-only and empty logs cannot qualify as application evidence", () => {
  assert.equal(selectApplicationRequest([request(recap())]), undefined);
  assert.equal(selectApplicationRequest([]), undefined);
});

test("does not select a later passing request over a malformed or incomplete agent request", () => {
  for (const body of [{ input: [] }, { input: [message("user", "scenario")] }, { tools: [] }]) {
    const first = request(body);
    assert.equal(selectApplicationRequest([request(recap()), first, agent]), first);
  }
  const malformed = { path: "/v1/responses", body: "{" };
  assert.throws(() => selectApplicationRequest([malformed, agent]), SyntaxError);
  const missing = { path: "/v1/responses" };
  assert.equal(selectApplicationRequest([missing, agent]), missing);
});

test("recap words alone do not exclude a request", () => {
  const changes = [
    (body) => { body.tools = []; },
    (body) => { body.input[1] = message("user", "scenario"); },
    (body) => { body.input[0].role = "user"; },
    (body) => { body.input[0].content[0].text = "Different background prompt"; },
    (body) => { body.input[1].content[0].text = JSON.stringify({ previousRecap: "", messages: [42], omittedContent: false }); },
  ];
  for (const change of changes) {
    const body = recap();
    change(body);
    const first = request(body);
    assert.equal(selectApplicationRequest([first, agent]), first);
  }
});
