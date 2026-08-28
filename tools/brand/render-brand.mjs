// Renders the brand assets and the partner profile.
//
//   node tools/brand/render-brand.mjs
//
// Output lands in brand-out/ at the repo root — gitignored, like the social
// renders. These are files you send to a hall or upload to Instagram, not
// assets the site serves.
//
// The logo geometry is duplicated from src/components/Logo.js on purpose: a
// brand asset that silently changes when someone refactors a React component
// is worse than one that has to be updated in two places deliberately.

import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "brand-out");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((c) => existsSync(c));
if (!CHROME) throw new Error("Could not find Chrome.");

// ---------------------------------------------------------------------------
// The mark, as standalone SVG. currentColor is resolved to a literal so the
// file works dropped into anything — a print shop, a slide, a signwriter.
// ---------------------------------------------------------------------------
const OUTER = "M32 5 L37.8 26.2 L59 32 L37.8 37.8 L32 59 L26.2 37.8 L5 32 L26.2 26.2 Z";
const INNER = "M32 17.5 L35 29 L46.5 32 L35 35 L32 46.5 L29 35 L17.5 32 L29 29 Z";

function markSvg(color, { rings = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64" fill="none">
${rings ? `  <circle cx="32" cy="32" r="29.5" stroke="${color}" stroke-width="1" opacity="0.28" stroke-dasharray="6 10"/>
  <circle cx="32" cy="32" r="24.5" stroke="${color}" stroke-width="0.8" opacity="0.18"/>` : ""}
  <path d="${OUTER}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  <path d="${INNER}" fill="${color}"/>
</svg>
`;
}

const GOLD_ON_DARK = "#d9b877";
const GOLD_ON_LIGHT = "#816539"; // the only gold that clears 4.5:1 on cream

await mkdir(path.join(OUT, "logo"), { recursive: true });
await mkdir(path.join(OUT, "instagram"), { recursive: true });
await mkdir(path.join(OUT, "profile"), { recursive: true });

await writeFile(path.join(OUT, "logo", "mark-gold.svg"), markSvg(GOLD_ON_DARK), "utf8");
await writeFile(path.join(OUT, "logo", "mark-gold-dark.svg"), markSvg(GOLD_ON_LIGHT), "utf8");
await writeFile(path.join(OUT, "logo", "mark-cream.svg"), markSvg("#fdf6e6"), "utf8");
await writeFile(path.join(OUT, "logo", "mark-plain-gold.svg"), markSvg(GOLD_ON_DARK, { rings: false }), "utf8");
console.log("  svg  4 mark files");

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 2, locale: "ar" });
const page = await ctx.newPage();

// ---------------------------------------------------------------------------
// Lockups and the Instagram avatar, from one throwaway page.
// ---------------------------------------------------------------------------
function lockupHtml() {
  const mark = (size, color, rings = true) =>
    markSvg(color, { rings }).replace('width="512" height="512"', `width="${size}" height="${size}"`);

  const box = (id, bg, color, inner, w, h) => `
<div id="${id}" style="width:${w}px;height:${h}px;background:${bg};display:flex;
     align-items:center;justify-content:center;">${inner}</div>`;

  const horizontal = (color) => `
<span style="display:inline-flex;align-items:center;gap:22px;color:${color};direction:rtl">
  ${mark(96, color)}
  <span style="display:flex;flex-direction:column;align-items:flex-start">
    <span style="font-family:'Aref Ruqaa',serif;font-size:62px;line-height:1.15">دعوة</span>
    <span style="font-family:'Amiri',serif;font-size:22px;letter-spacing:.34em;opacity:.65;margin-top:4px">DA3WA</span>
  </span>
</span>`;

  const stacked = (color) => `
<span style="display:inline-flex;flex-direction:column;align-items:center;gap:18px;color:${color}">
  ${mark(128, color)}
  <span style="font-family:'Aref Ruqaa',serif;font-size:64px;line-height:1.1">دعوة</span>
  <span style="font-family:'Amiri',serif;font-size:20px;letter-spacing:.34em;opacity:.65">DA3WA</span>
</span>`;

  const DARK = "radial-gradient(ellipse 95% 70% at 50% 40%, #241d12 0%, #14100a 60%, #0b0906 100%)";

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Amiri:wght@400;700&display=swap">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#555}</style></head><body>
${box("h-dark", DARK, GOLD_ON_DARK, horizontal(GOLD_ON_DARK), 760, 260)}
${box("h-light", "#faf6ef", GOLD_ON_LIGHT, horizontal(GOLD_ON_LIGHT), 760, 260)}
${box("s-dark", DARK, GOLD_ON_DARK, stacked(GOLD_ON_DARK), 520, 520)}
${box("s-light", "#faf6ef", GOLD_ON_LIGHT, stacked(GOLD_ON_LIGHT), 520, 520)}
${box("avatar", DARK, GOLD_ON_DARK, mark(360, GOLD_ON_DARK), 1080, 1080)}
</body></html>`;
}

await page.setViewportSize({ width: 1200, height: 1200 });
await page.setContent(lockupHtml(), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

for (const [id, file] of [
  ["h-dark", "logo/logo-horizontal-dark.png"],
  ["h-light", "logo/logo-horizontal-light.png"],
  ["s-dark", "logo/logo-stacked-dark.png"],
  ["s-light", "logo/logo-stacked-light.png"],
  // The avatar is a circle everywhere it is shown, so the mark sits alone and
  // centred with a wide margin — a wordmark would be cropped or illegible.
  ["avatar", "instagram/avatar.png"],
]) {
  await page.locator(`#${id}`).screenshot({ path: path.join(OUT, file), animations: "disabled" });
  console.log(`  png  ${file}`);
}

// ---------------------------------------------------------------------------
// The partner profile, one image per A4 page.
// ---------------------------------------------------------------------------
await page.setViewportSize({ width: 794, height: 1123 });
await page.goto(pathToFileURL(path.join(HERE, "profile-halls.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

const pages = await page.locator(".page").count();
for (let i = 0; i < pages; i++) {
  const file = `profile/halls-${String(i + 1).padStart(2, "0")}.png`;
  await page.locator(".page").nth(i).screenshot({ path: path.join(OUT, file), animations: "disabled" });
  console.log(`  png  ${file}`);
}

// A single PDF as well — that is what actually gets emailed to a venue.
await page.pdf({
  path: path.join(OUT, "profile", "da3wa-partner-profile.pdf"),
  width: "794px",
  height: "1123px",
  printBackground: true,
});
console.log("  pdf  profile/da3wa-partner-profile.pdf");

await browser.close();
console.log(`\ndone -> ${OUT}`);
