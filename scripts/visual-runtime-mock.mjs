import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";

const port = Number(process.env.MOCK_PORT);
const requestLog = process.env.MOCK_REQUEST_LOG;
const packageRoot = process.env.VISUAL_RUNTIME_PACKAGE_ROOT;
const successMarker = process.env.SUCCESS_MARKER;
const expectedOutcome = process.env.EXPECTED_OUTCOME;
if (!Number.isInteger(port) || port <= 0 || !requestLog || !packageRoot || !successMarker) {
  throw new Error("Visual runtime mock requires port, log, package root, and success marker.");
}
const state = await readFile(join(packageRoot, "fixtures", "analysis-state.example.json"), "utf8");
const asset = await readFile(join(packageRoot, "assets", "analysis-readout.html"), "utf8");
const widgetCode = `${asset.trim()}\n<div data-runtime-proof="installed-claw">Current installed-Claw runtime proof</div>`;
const fallback = `# Analysis readout

The installed Data Analyst Claw produced the structured state, visual output,
and this Markdown fallback from the current request.

Decision state: ready for owner review.
`;
let responseStep = 0;

function functionCall(name, args) {
  const serialized = JSON.stringify(args);
  const suffix = createHash("sha256")
    .update(name)
    .update("\0")
    .update(serialized)
    .digest("hex")
    .slice(0, 10);
  return {
    type: "function_call",
    id: `fc_visual_${suffix}`,
    call_id: `call_visual_${suffix}`,
    name,
    arguments: serialized,
  };
}

function completed(output) {
  return {
    type: "response.completed",
    response: {
      id: `resp_visual_${responseStep}`,
      status: "completed",
      output,
      usage: {
        input_tokens: 64,
        output_tokens: 16,
        total_tokens: 80,
        input_tokens_details: { cached_tokens: 0 },
      },
    },
  };
}

function toolEvents(name, args) {
  const item = functionCall(name, args);
  return [
    {
      type: "response.output_item.added",
      item: { ...item, arguments: "" },
    },
    { type: "response.function_call_arguments.delta", delta: item.arguments },
    { type: "response.output_item.done", item },
    completed([item]),
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
    { type: "response.output_item.added", item: { ...item, status: "in_progress", content: [] } },
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
    completed([item]),
  ];
}

function writeEvents(response, events, stream) {
  if (stream === false) {
    const done = events.at(-1);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        id: done.response.id,
        object: "response",
        status: "completed",
        output: done.response.output,
        usage: done.response.usage,
      }),
    );
    return;
  }
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });
  for (const event of events) {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  response.end("data: [DONE]\n\n");
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) {
      throw new Error("Mock request exceeded 16 MiB.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const steps = [
  {
    tool: "write",
    events: () =>
      toolEvents("write", {
      path: "outputs/analysis-state.json",
      content: state,
    }),
  },
  {
    tool: "write",
    events: () =>
      toolEvents("write", {
      path: "outputs/analysis-readout.html",
      content: widgetCode,
    }),
  },
  {
    tool: "write",
    events: () =>
      toolEvents("write", {
      path: "outputs/analysis-readout.md",
      content: fallback,
    }),
  },
  {
    tool: "show_widget",
    events: () =>
      toolEvents("show_widget", {
      title: "Data Analyst current readout",
      widget_code: widgetCode,
    }),
  },
  {
    events: () => textEvents(`${successMarker}\n${expectedOutcome ?? ""}`),
  },
];

const server = http.createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"object":"list","data":[{"id":"gpt-5.6-luna","object":"model"}]}');
      return;
    }
    if (request.method !== "POST" || url.pathname !== "/v1/responses") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end('{"error":{"message":"unhandled mock route"}}');
      return;
    }
    const bodyText = await readBody(request);
    const step = Math.min(responseStep, steps.length - 1);
    const responsePlan = steps[step];
    await appendFile(
      requestLog,
      `${JSON.stringify({
        method: request.method,
        path: url.pathname,
        body: bodyText,
        step,
        emittedTool: responsePlan.tool,
      })}\n`,
    );
    const body = JSON.parse(bodyText);
    const events = responsePlan.events();
    responseStep += 1;
    writeEvents(response, events, body.stream);
  })().catch((error) => {
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: error.message } }));
    } else {
      response.destroy(error);
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`visual-runtime-mock listening on ${port}`);
});
