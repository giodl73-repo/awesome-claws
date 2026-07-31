import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readExperienceCases } from "./experience-cases.mjs";
import { readCatalog, root } from "./openclaw-proof-lib.mjs";

const VIEWPORT = { width: 1440, height: 1000 };
const BROWSER_PATHS = [
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function resolveOpenClawRoot() {
  const configured = process.env.OPENCLAW_ROOT?.trim();
  if (!configured) {
    throw new Error("Set OPENCLAW_ROOT to an OpenClaw checkout with the Control UI sources.");
  }
  return resolve(configured);
}

function loadPlaywright(openClawRoot) {
  return createRequire(join(openClawRoot, "package.json"))("playwright");
}

async function findInstalledBrowser(chromium) {
  const candidates = [chromium.executablePath(), ...BROWSER_PATHS];
  for (const browserPath of candidates) {
    if (await access(browserPath).then(() => true, () => false)) {
      return browserPath;
    }
  }
  throw new Error("No Chromium-compatible browser was found for Control UI screenshots.");
}

async function loadControlUiHelpers(openClawRoot) {
  const helperPath = join(openClawRoot, "ui", "src", "test-helpers", "control-ui-e2e.ts");
  return import(pathToFileURL(helperPath).href);
}

function reportMarkdown(entry, demo) {
  const rows = demo.report.items
    .map((item) => `- **${item.title}:** ${item.summary}`)
    .join("\n");
  return [
    `## ${demo.report.title}`,
    demo.report.summary,
    rows,
    `**Next artifact:** \`${demo.report.output}\``,
    `I kept this within the ${entry.name} authority boundary.`,
  ].join("\n\n");
}

async function buildSession(entry, experience) {
  const packageRoot = join(root, "claws", entry.id);
  const now = Date.now();
  if (experience.target >= 4) {
    const viewId = `${entry.id}-primary`;
    const asset = await readFile(join(packageRoot, experience.asset), "utf8");
    return {
      asset,
      assetUrl: `/__openclaw__/canvas/documents/${viewId}/index.html`,
      historyMessages: [
        { role: "user", content: entry.example.request, timestamp: now - 2_000 },
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: `${entry.example.outcome}\n\nI prepared a reviewable visual result and kept the underlying artifact available in the workspace.`,
            },
            {
              type: "canvas",
              preview: {
                kind: "canvas",
                surface: "assistant_message",
                render: "url",
                title: entry.name,
                viewId,
                url: `/__openclaw__/canvas/documents/${viewId}/index.html`,
                preferredHeight: 620,
                sandbox: "scripts",
              },
            },
          ],
          timestamp: now - 1_000,
        },
      ],
    };
  }

  const demo = JSON.parse(
    await readFile(join(packageRoot, "fixtures", "session-demo.json"), "utf8"),
  );
  return {
    historyMessages: [
      { role: "user", content: entry.example.request, timestamp: now - 2_000 },
      {
        role: "assistant",
        content: [{ type: "text", text: reportMarkdown(entry, demo) }],
        timestamp: now - 1_000,
      },
    ],
  };
}

async function waitForVisualResult(page, entry, session) {
  await page.getByText(entry.example.request, { exact: false }).first().waitFor({ timeout: 60_000 });
  if (session.assetUrl) {
    await page.locator('.chat-tool-card__preview[data-kind="canvas"] iframe').waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await page.waitForTimeout(500);
  } else {
    await page.getByText("Next artifact:", { exact: false }).waitFor({ timeout: 60_000 });
  }
  await page.evaluate(() => document.fonts.ready);
}

const openClawRoot = resolveOpenClawRoot();
const { chromium } = loadPlaywright(openClawRoot);
const {
  controlUiSessionUrl,
  installMockGateway,
  startControlUiE2eServer,
} = await loadControlUiHelpers(openClawRoot);
const catalog = await readCatalog();
const experienceCases = await readExperienceCases(catalog);
const casesById = new Map(experienceCases.map((item) => [item.id, item]));
const requestedIds = new Set(
  (process.env.SCREENSHOT_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const entries = requestedIds.size
  ? catalog.entries.filter((entry) => requestedIds.has(entry.id))
  : catalog.entries;
const executablePath = await findInstalledBrowser(chromium);
const screenshotRoot = join(root, "screenshots");
await mkdir(screenshotRoot, { recursive: true });
const server = await startControlUiE2eServer({
  version: "2026.7.31",
  commit: "awesome-claws-control-ui-proof",
  commitAt: "2026-07-31T00:00:00.000Z",
  builtAt: new Date().toISOString(),
  branch: null,
  dirty: false,
  release: false,
  buildId: "awesome-claws",
});
const browser = await chromium.launch({ executablePath, headless: true });

try {
  for (const entry of entries) {
    const experience = casesById.get(entry.id);
    if (!experience) {
      throw new Error(`${entry.id} has no experience case.`);
    }
    const session = await buildSession(entry, experience);
    const sessionKey = `agent:${entry.id}:main`;
    const context = await browser.newContext({
      colorScheme: "light",
      deviceScaleFactor: 1,
      viewport: VIEWPORT,
    });
    try {
      const page = await context.newPage();
      if (session.assetUrl) {
        await page.route(`**${session.assetUrl}`, async (route) => {
          await route.fulfill({
            body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${session.asset}</body></html>`,
            contentType: "text/html; charset=utf-8",
          });
        });
      }
      await installMockGateway(page, {
        agentModel: "openai/gpt-5.5",
        assistantAgentId: entry.id,
        assistantName: entry.name,
        defaultAgentId: entry.id,
        historyMessages: session.historyMessages,
        sessionKey,
        workspace: `/home/openclaw/.openclaw/workspace-${entry.id}`,
      });
      await page.goto(controlUiSessionUrl(server.baseUrl, sessionKey), {
        waitUntil: "domcontentloaded",
      });
      await waitForVisualResult(page, entry, session);
      const screenshotPath = join(screenshotRoot, `${entry.id}.png`);
      await page.screenshot({
        path: screenshotPath,
        type: "png",
      });
      await copyFile(screenshotPath, join(root, "claws", entry.id, "screenshot.png"));
      process.stdout.write(`Captured ${entry.id} in the OpenClaw Control UI.\n`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`Generated ${entries.length} screenshots from the real OpenClaw Control UI.`);
