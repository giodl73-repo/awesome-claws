import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { readExperienceCases } from "./experience-cases.mjs";
import { readCatalog, root } from "./openclaw-proof-lib.mjs";

const VIEWPORT = { width: 1600, height: 1000 };
const BROWSER_PATHS = [
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)("playwright");
  } catch {
    const openClawRoot = process.env.OPENCLAW_ROOT ?? "C:/src/openclaw-control-ui-host-policy-main";
    return createRequire(join(openClawRoot, "package.json"))("playwright");
  }
}

async function findInstalledBrowser() {
  for (const browserPath of BROWSER_PATHS) {
    if (await access(browserPath).then(() => true, () => false)) {
      return browserPath;
    }
  }
  return undefined;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdownInline(value) {
  return escapeHtml(String(value).replaceAll("`", ""));
}

function hostPage(entry, experience, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(entry.name)} screenshot</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #edf3f8; color: #0d1b2f; }
    body { font: 16px/1.45 "Segoe UI", Inter, Arial, sans-serif; }
    .shot { width: 1600px; min-height: 1000px; padding: 34px 38px 38px; }
    .shot-header { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding-bottom: 22px; border-bottom: 1px solid #d2deeb; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
    .logo { width: 54px; height: 54px; border-radius: 8px; display: grid; place-items: center; background: #111d35; color: white; font-weight: 800; letter-spacing: 0; }
    h1 { margin: 0; font-size: 38px; line-height: 1.05; letter-spacing: 0; }
    .subtitle { margin-top: 6px; color: #60708b; }
    .proof { border: 1px solid #9cc5ef; background: #ddecfb; border-radius: 8px; padding: 14px 18px; min-width: 390px; color: #174575; font-weight: 700; }
    .proof span { color: #0a7a4c; }
    .proof b { color: #ba1f1f; }
    .surface-frame { background: #fff; border: 1px solid #d5dfeb; border-radius: 8px; box-shadow: 0 1px 2px rgba(20, 36, 58, .04); overflow: hidden; }
    .artifact-shell { display: grid; grid-template-columns: 510px 1fr; gap: 20px; }
    .panel { background: #fff; border: 1px solid #d5dfeb; border-radius: 8px; padding: 22px; box-shadow: 0 1px 2px rgba(20, 36, 58, .04); }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .metric { min-height: 124px; }
    .label, dt, .artifact-card span { color: #69768c; font-weight: 700; font-size: 13px; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 10px; font-size: 36px; line-height: 1; }
    .metric p, .artifact-card p, .message p { margin: 8px 0 0; color: #506079; }
    .message { padding: 14px 16px; border-radius: 8px; margin-top: 12px; border: 1px solid #d7e2ee; background: #f2f6fb; }
    .message.agent { background: #eaf5f0; border-color: #bcdccf; }
    .artifact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
    .artifact-card { min-height: 112px; border: 1px solid #d8e3ef; border-radius: 8px; padding: 16px; background: #f9fbfe; }
    .artifact-card strong { display: block; margin-top: 8px; }
    .report-list { display: grid; gap: 12px; margin-top: 18px; }
    .report-row { border: 1px solid #d8e3ef; border-radius: 8px; padding: 14px 16px; }
    .report-row strong { color: #0b5fc2; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .chips span { border: 1px solid #c8d9ea; background: #f3f8fe; color: #53647d; border-radius: 999px; padding: 4px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <main class="shot">
    <header class="shot-header">
      <div class="brand">
        <div class="logo">AC</div>
        <div>
          <h1>${escapeHtml(entry.name)}</h1>
          <div class="subtitle">@awesome-claws/${escapeHtml(entry.id)} - ${escapeHtml(entry.description)}</div>
        </div>
      </div>
      <div class="proof">Experience X${experience.target}: <span>${escapeHtml(experience.primary)}</span> - fallback: <b>${escapeHtml(experience.fallback ?? experience.output)}</b></div>
    </header>
    ${body}
  </main>
</body>
</html>`;
}

function artifactBody(entry, experience, demo, template) {
  const rows = demo.report.items
    .map(
      (item) => `<div class="report-row">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.summary)}</p>
        <div class="chips">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </div>`,
    )
    .join("");
  const messages = demo.messages
    .map(
      (message) => `<div class="message ${message.role === "agent" ? "agent" : "user"}">
        <strong>${escapeHtml(message.role === "agent" ? entry.name : "User")}</strong>
        <p>${escapeHtml(message.text)}</p>
      </div>`,
    )
    .join("");
  return `<section class="metrics">
    <article class="panel metric"><span class="label">Turns</span><strong>${demo.messages.length}</strong><p>evolved session</p></article>
    <article class="panel metric"><span class="label">Artifact</span><strong>1</strong><p>${markdownInline(demo.report.output)}</p></article>
    <article class="panel metric"><span class="label">Evidence</span><strong>${demo.report.items.length}</strong><p>reviewable report items</p></article>
    <article class="panel metric"><span class="label">Template</span><strong>JSON</strong><p>structured session fixture</p></article>
  </section>
  <section class="artifact-shell">
    <aside class="panel"><h2>Session Demonstration</h2>${messages}</aside>
    <section class="panel">
      <h2>${escapeHtml(demo.report.title)}</h2>
      <p>${escapeHtml(demo.report.summary)}</p>
      <div class="artifact-grid">
        <div class="artifact-card"><span>Audience</span><strong>${escapeHtml(entry.audience)}</strong></div>
        <div class="artifact-card"><span>Output</span><strong>${markdownInline(demo.report.output)}</strong></div>
        <div class="artifact-card"><span>Boundary</span><strong>${escapeHtml(entry.boundaries[0])}</strong></div>
        <div class="artifact-card"><span>Template</span><strong>${escapeHtml(template.title ?? "Session report")}</strong></div>
      </div>
      <div class="report-list">${rows}</div>
    </section>
  </section>`;
}

async function visualBody(entry, experience) {
  const assetPath = join(root, "claws", entry.id, experience.asset);
  const asset = await readFile(assetPath, "utf8");
  return `<section class="surface-frame">${asset}</section>`;
}

async function artifactPage(entry, experience) {
  const packageRoot = join(root, "claws", entry.id);
  const demo = JSON.parse(await readFile(join(packageRoot, "fixtures", "session-demo.json"), "utf8"));
  const template = JSON.parse(await readFile(join(packageRoot, "templates", "session-report.template.json"), "utf8"));
  return hostPage(entry, experience, artifactBody(entry, experience, demo, template));
}

const { chromium } = loadPlaywright();
const catalog = await readCatalog();
const experienceCases = await readExperienceCases(catalog);
const casesById = new Map(experienceCases.map((item) => [item.id, item]));
const executablePath = await findInstalledBrowser();
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const pageInstance = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  for (const entry of catalog.entries) {
    const experience = casesById.get(entry.id);
    const body = experience.target >= 4 ? await visualBody(entry, experience) : undefined;
    await pageInstance.setContent(
      experience.target >= 4 ? hostPage(entry, experience, body) : await artifactPage(entry, experience),
      { waitUntil: "load" },
    );
    await pageInstance.evaluate(() => document.fonts.ready);
    await pageInstance.screenshot({
      path: join(root, "claws", entry.id, "screenshot.png"),
      type: "png",
      fullPage: true,
    });
  }
} finally {
  await browser.close();
}

console.log(`Generated ${catalog.entries.length} Claw screenshots from package experience assets.`);
