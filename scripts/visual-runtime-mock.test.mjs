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

test("the visual runtime fixture drives writes, show_widget, then a final response", async () => {
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
      const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stream: false, input: [] }),
      });
      assert.equal(response.status, 200);
      outputs.push((await response.json()).output[0]);
    }
    assert.equal(outputs[0].name, "write");
    assert.equal(outputs[3].name, "show_widget");
    assert.equal(outputs[4].type, "message");
    assert.match(outputs[4].content[0].text, /VISUAL_RUNTIME_OK/u);
    const records = (await readFile(requestLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      records.map((record) => record.emittedTool),
      ["write", "write", "write", "show_widget", undefined],
    );
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
