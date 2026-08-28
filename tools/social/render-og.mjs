// Renders the link-preview image served at /og.png.
//
//   node tools/social/render-og.mjs
//
// This is the picture that appears whenever da3wa.digital is pasted into
// WhatsApp, Instagram bio, or anywhere else — Meta's sharing debugger flagged
// its absence. Same scene as the social cards, so the link preview and the
// grid are unmistakably the same brand.
//
// Unlike the posts, this one lands in public/: the site serves it.

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((c) => existsSync(c));
if (!CHROME) throw new Error("Could not find Chrome.");

const out = path.join(ROOT, "public", "og.png");
await mkdir(path.dirname(out), { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: "ar" })
).newPage();

await page.goto(pathToFileURL(path.join(HERE, "card.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate((c) => window.__card.setContent(c), {
  format: "wide",
  kicker: "دعوات إلكترونية للأعراس والمناسبات",
  headline: "ليلة العمر",
  subline: "من أول دعوة، لين آخر معزوم يدخل الباب.",
});
// At rest, like the stills.
await page.evaluate(() => window.__card.render(window.__card.DURATION));
await page.screenshot({ path: out, animations: "disabled" });
await browser.close();

console.log(`done -> ${out}`);
