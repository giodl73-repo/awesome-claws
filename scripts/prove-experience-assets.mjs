import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readExperienceCases } from "./experience-cases.mjs";
import { readCatalog } from "./openclaw-proof-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openClawRoot = resolve(
  process.env.OPENCLAW_ROOT ??
    dirname(process.env.OPENCLAW_CLI_ENTRY ?? ""),
);
if (!process.env.OPENCLAW_ROOT && !process.env.OPENCLAW_CLI_ENTRY) {
  throw new Error("Set OPENCLAW_ROOT or OPENCLAW_CLI_ENTRY to an OpenClaw checkout.");
}
const requireFromOpenClaw = createRequire(join(openClawRoot, "package.json"));
const { chromium } = requireFromOpenClaw("playwright");
const sharp = requireFromOpenClaw("sharp");

const catalog = await readCatalog();
const visualCases = (await readExperienceCases(catalog)).filter((item) => item.target >= 4);
const proofRoot = resolve(
  process.env.EXPERIENCE_PROOF_DIR ?? join(root, ".tmp", "experience-assets"),
);
await mkdir(proofRoot, { recursive: true });

const viewports = [
  { id: "desktop", width: 1280, height: 900 },
  { id: "mobile", width: 390, height: 844 },
];

const hostCss = `
  :root {
    color-scheme: light;
    --surface: #ffffff; --card: #f7f8fa; --elevated: #ffffff;
    --text: #24272d; --text-strong: #111318; --muted: #68707c;
    --border: #d9dde4; --border-strong: #aeb5c0; --accent: #1769aa;
    --accent-fill: #1769aa; --accent-fg: #ffffff; --ok: #18794e;
    --warn: #9a6700; --danger: #c9372c; --info: #1769aa;
    --ok-subtle: #e7f5ee; --warn-subtle: #fff4ce; --danger-subtle: #ffebe9;
    --info-subtle: #e7f1fa; --radius: 6px;
    --font-body: system-ui, sans-serif; --font-mono: ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-width: 0; background: var(--surface); color: var(--text); }
  body { padding: 16px; font-family: var(--font-body); }
  img, svg, canvas, table { max-width: 100%; }
`;

async function imageSignal(buffer) {
  const { data, info } = await sharp(buffer)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Set();
  let count = 0;
  let sum = 0;
  let sumSquares = 0;
  const stride = Math.max(1, Math.floor((info.width * info.height) / 50_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const luma = (red * 299 + green * 587 + blue * 114) / 1000;
    sum += luma;
    sumSquares += luma * luma;
    count += 1;
    buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
  }
  const mean = sum / count;
  return {
    colorBuckets: buckets.size,
    lumaStandardDeviation: Math.sqrt(Math.max(0, sumSquares / count - mean * mean)),
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const experience of visualCases) {
    const assetPath = join(root, "claws", experience.id, experience.asset);
    const widgetCode = await readFile(assetPath, "utf8");
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${hostCss}</style></head><body>${widgetCode}</body></html>`,
        { waitUntil: "load" },
      );
      await page.evaluate(() => document.fonts.ready);
      const dom = await page.evaluate(() => {
        const visible = [...document.body.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
        });
        const overflow = visible
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .filter((element) => {
            for (let parent = element.parentElement; parent; parent = parent.parentElement) {
              const overflowX = getComputedStyle(parent).overflowX;
              if (overflowX === "auto" || overflowX === "scroll") {
                return false;
              }
            }
            return true;
          })
          .map((element) => element.tagName.toLowerCase())
          .slice(0, 10);
        const unnamedControls = visible
          .filter((element) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/u.test(element.tagName))
          .filter((element) => {
            const htmlElement = element;
            return !(
              htmlElement.getAttribute("aria-label") ||
              htmlElement.getAttribute("title") ||
              htmlElement.textContent?.trim() ||
              htmlElement.getAttribute("placeholder") ||
              htmlElement.getAttribute("value")
            );
          })
          .map((element) => element.tagName.toLowerCase());
        return {
          overflow,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          textLength: document.body.innerText.trim().length,
          unnamedControls,
        };
      });
      const screenshotPath = join(proofRoot, `${experience.id}-${viewport.id}.png`);
      const screenshot = await page.screenshot({ fullPage: true, path: screenshotPath });
      const signal = await imageSignal(screenshot);
      const failures = [
        ...(dom.textLength < 40 ? ["insufficient visible text"] : []),
        ...(dom.pageOverflow ? ["document has horizontal overflow"] : []),
        ...(dom.overflow.length > 0 ? [`horizontal overflow: ${dom.overflow.join(", ")}`] : []),
        ...(dom.unnamedControls.length > 0
          ? [`unnamed controls: ${dom.unnamedControls.join(", ")}`]
          : []),
        ...(consoleErrors.length > 0 ? [`console errors: ${consoleErrors.join("; ")}`] : []),
        ...(signal.colorBuckets < 8 || signal.lumaStandardDeviation < 4
          ? ["screenshot is visually blank or one-note"]
          : []),
      ];
      results.push({
        id: experience.id,
        target: experience.target,
        viewport: viewport.id,
        status: failures.length === 0 ? "passed" : "failed",
        failures,
        dom,
        signal,
        screenshot: `${experience.id}-${viewport.id}.png`,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const summary = {
  schemaVersion: "awesomeClaws.experienceAssetProof.v1",
  generatedAt: new Date().toISOString(),
  visualClaws: visualCases.length,
  renderCount: results.length,
  passed: results.filter((result) => result.status === "passed").length,
  failed: results.filter((result) => result.status === "failed").length,
  results,
};
await writeFile(join(proofRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) {
  process.exitCode = 1;
}
