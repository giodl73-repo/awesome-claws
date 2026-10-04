import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { root } from "./catalog-source.mjs";

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(child, url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Visual runtime mock exited before becoming healthy.");
    }
    if (
      await fetch(url)
        .then((response) => response.ok)
        .catch(() => false)
    ) {
      return;
    }
    await delay(25);
  }
  throw new Error(`Visual runtime mock did not become healthy within ${timeoutMs}ms.`);
}

test("the visual runtime fixture preserves writes and widget steps around background recaps", async () => {
  await mkdir(join(root, ".tmp"), { recursive: true });
  const temp = await mkdtemp(join(root, ".tmp", "visual-mock-test-"));
  const requestLog = join(temp, "requests.jsonl");
  const port = await reservePort();
  const child = spawn(process.execPath, [join(root, "scripts", "visual-runtime-mock.mjs")], {
    env: {
      ...process.env,
      MOCK_PORT: String(port),
      MOCK_REQUEST_LOG: requestLog,
      SUCCESS_MARKER: "VISUAL_RUNTIME_OK",
      EXPECTED_OUTCOME: "ready",
      VISUAL_RUNTIME_PACKAGE_ROOT: join(root, "claws", "data-analyst"),
    },
    stdio: "ignore",
  });
  try {
    await waitForHealth(child, `http://127.0.0.1:${port}/health`);
    const outputs = [];
    for (let step = 0; step < 5; step += 1) {
      const recap = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stream: false, input: [
          { role: "system", content: [{ type: "input_text", text: "Write an Activity recap for someone scanning their tasks: summarize." }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ previousRecap: "", messages: ["user: scenario"], omittedContent: false }) }] },
        ] }),
      });
      assert.equal(recap.status, 200);
      const recapOutput = (await recap.json()).output;
      assert.equal(recapOutput.length, 1);
      assert.equal(recapOutput[0].type, "message");
      assert.doesNotMatch(recapOutput[0].content[0].text, /VISUAL_RUNTIME_OK/u);
      const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stream: false, input: [] }),
      });
      assert.equal(response.status, 200);
      outputs.push((await response.json()).output[0]);
    }
    assert.equal(outputs[0].name, "write");
    assert.equal(JSON.parse(outputs[0].arguments).path, "outputs/analysis-state.json");
    assert.equal(outputs[3].name, "show_widget");
    assert.equal(outputs[4].type, "message");
    assert.match(outputs[4].content[0].text, /VISUAL_RUNTIME_OK/u);
    const records = (await readFile(requestLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      records.filter((record) => record.step !== undefined).map((record) => record.emittedTool),
      ["write", "write", "write", "show_widget", undefined],
    );
    assert.deepEqual(records.filter((record) => record.step !== undefined).map((record) => record.step), [0, 1, 2, 3, 4]);
    const recaps = records.filter((record) => record.inferenceFacts?.purpose === "activity-recap");
    assert.equal(recaps.length, 5);
    assert.ok(recaps.every((record) => record.step === undefined && record.emittedTool === undefined));
  } finally {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once("exit", resolve);
    });
    await rm(temp, { recursive: true, force: true });
  }
});
