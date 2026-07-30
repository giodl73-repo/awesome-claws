import { readFileSync, appendFileSync } from "node:fs";
import http from "node:http";

const port = Number.parseInt(process.env.MOCK_PORT ?? "", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("MOCK_PORT must be a TCP port.");
}
const scenarioPath = process.env.VISUAL_SCENARIO_PATH;
if (!scenarioPath) {
  throw new Error("VISUAL_SCENARIO_PATH is required.");
}
const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
const widgetCode = readFileSync(scenario.assetPath, "utf8");
const requestLog = process.env.MOCK_REQUEST_LOG;

function writeJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function writeSse(response, events) {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/event-stream",
  });
  for (const event of events) {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  response.end("data: [DONE]\n\n");
}

function usage() {
  return {
    input_tokens: 64,
    output_tokens: 16,
    total_tokens: 80,
    input_tokens_details: { cached_tokens: 0 },
  };
}

function functionCallEvents(name, args, ordinal) {
  const item = {
    type: "function_call",
    id: `fc_visual_${ordinal}`,
    call_id: `call_visual_${ordinal}`,
    name,
    arguments: JSON.stringify(args),
  };
  return [
    {
      type: "response.output_item.added",
      item: { ...item, arguments: "" },
    },
    { type: "response.function_call_arguments.delta", delta: item.arguments },
    { type: "response.output_item.done", item },
    {
      type: "response.completed",
      response: {
        id: `resp_visual_${ordinal}`,
        status: "completed",
        output: [item],
        usage: usage(),
      },
    },
  ];
}

function textEvents(text) {
  const item = {
    type: "message",
    id: "msg_visual_complete",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  };
  return [
    {
      type: "response.output_item.added",
      item: { ...item, content: [], status: "in_progress" },
    },
    {
      type: "response.output_text.delta",
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      delta: text,
    },
    {
      type: "response.output_text.done",
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      text,
    },
    { type: "response.output_item.done", item },
    {
      type: "response.completed",
      response: {
        id: "resp_visual_complete",
        status: "completed",
        output: [item],
        usage: usage(),
      },
    },
  ];
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024) {
      throw new Error("request body exceeded 2 MiB");
    }
  }
  return body;
}

function hasTool(body, name) {
  return Array.isArray(body.tools) && body.tools.some((tool) => tool?.name === name);
}

function functionOutputs(body) {
  return (Array.isArray(body.input) ? body.input : []).filter(
    (item) => item?.type === "function_call_output",
  );
}

function responseEvents(body) {
  const outputs = functionOutputs(body);
  if (outputs.length === 0) {
    if (!hasTool(body, "read")) {
      return textEvents("VISUAL_PROOF_FAIL read tool unavailable");
    }
    return functionCallEvents("read", { path: scenario.workspaceAssetPath }, 1);
  }
  if (outputs.length === 1) {
    if (!hasTool(body, "show_widget")) {
      return textEvents("VISUAL_PROOF_FAIL show_widget capability unavailable");
    }
    return functionCallEvents(
      "show_widget",
      {
        title: scenario.title,
        widget_code: widgetCode,
        ...(scenario.target === 5
          ? {
              name: scenario.widgets[0],
              pin: true,
              size: "lg",
              tab: "main",
            }
          : {}),
      },
      2,
    );
  }
  return textEvents(`VISUAL_PROOF_OK\n${scenario.expectedOutcome}`);
}

const server = http.createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/models") {
      writeJson(response, 200, {
        object: "list",
        data: [{ id: "gpt-5.6-luna", object: "model", owned_by: "awesome-claws" }],
      });
      return;
    }
    const bodyText = await readBody(request);
    const body = JSON.parse(bodyText || "{}");
    if (requestLog) {
      appendFileSync(
        requestLog,
        `${JSON.stringify({ method: request.method, path: url.pathname, body: bodyText })}\n`,
      );
    }
    if (request.method !== "POST" || url.pathname !== "/v1/responses") {
      writeJson(response, 404, { error: { message: "unhandled fixture route" } });
      return;
    }
    const events = responseEvents(body);
    if (body.stream === false) {
      const completed = events.find((event) => event.type === "response.completed");
      writeJson(response, 200, {
        id: completed?.response?.id ?? "resp_visual",
        object: "response",
        status: "completed",
        output: completed?.response?.output ?? [],
        usage: completed?.response?.usage ?? usage(),
      });
      return;
    }
    writeSse(response, events);
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) {
      writeJson(response, 500, { error: { message } });
    } else {
      response.destroy();
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`visual-openai listening on ${port}\n`);
});
