// Renders the invitation backdrop served at /backdrops/silk.jpg.
//
//   node tools/brand/render-backdrop.mjs
//
// Eslam asked for the invitation to sit on a real image rather than a flat
// colour, like the reference does. That reference uses photography — pearls on
// silk — and photography is the one thing here that cannot be generated, so
// this is painted instead: layered soft gradients, a slow fabric fold, and a
// scatter of out-of-focus motes. Abstract on purpose. A bad imitation of a
// photograph looks cheap in a way a deliberate abstract does not.
//
// Rendered once to a file rather than drawn in CSS on every load: fifty
// blurred layers is a lot of compositing for a phone to redo on every scroll.

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "public", "backdrops");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((c) => existsSync(c));
if (!CHROME) throw new Error("Could not find Chrome.");

// 1080x1920 — a phone screen, and the invitation scrolls over it.
const W = 1080;
const H = 1920;

function scene() {
  // Seeded so a re-render is identical; an invitation backdrop that shifts
  // between deploys is a bug nobody would think to look for.
  let seed = 21;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const blobs = Array.from({ length: 9 }, () => ({
    x: rand() * 120 - 10,
    y: rand() * 120 - 10,
    r: 30 + rand() * 45,
    hue: ["#f6ecd8", "#efe0c4", "#e7d3ad", "#fbf5e9", "#e3d0b4"][Math.floor(rand() * 5)],
    a: 0.3 + rand() * 0.45,
  }));

  // Out-of-focus specks, the way pearls read when they are not the subject.
  const motes = Array.from({ length: 34 }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: 3 + rand() * 16,
    a: 0.12 + rand() * 0.4,
    blur: 1 + rand() * 5,
  }));

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  body { width:${W}px; height:${H}px; overflow:hidden; }
  #bg {
    position:relative; width:${W}px; height:${H}px;
    background:
      radial-gradient(ellipse 120% 70% at 50% 0%,   #fdf8ef 0%, #f7eeda 45%, #efe2c9 100%),
      linear-gradient(160deg, #fbf4e6, #f0e3ca 60%, #e9dcc2);
    overflow:hidden;
  }
  .blob { position:absolute; border-radius:50%; filter:blur(90px); }
  .mote { position:absolute; border-radius:50%; background:#fffdf7; }
  /* One soft fold of fabric across the lower third, so the field has a
     direction instead of being pure haze. */
  .fold {
    position:absolute; inset-inline:-30%; height:70%; bottom:-18%;
    background:linear-gradient(105deg, transparent 20%, rgba(255,253,247,.85) 46%, rgba(233,220,194,.5) 58%, transparent 78%);
    filter:blur(46px);
    transform:rotate(-9deg);
  }
  .fold.two {
    bottom:8%; height:44%; opacity:.55; transform:rotate(6deg);
    background:linear-gradient(95deg, transparent 25%, rgba(255,255,255,.7) 50%, transparent 72%);
  }
  /* A whisper of the brand mark, far too faint to read as a logo — it just
     keeps the surface from being anonymous. */
  .grain { position:absolute; inset:0; opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='58' height='58' viewBox='0 0 58 58'%3E%3Cpath fill='none' stroke='%23b08d57' stroke-width='0.6' stroke-opacity='0.07' d='M29 8 L34 24 L50 29 L34 34 L29 50 L24 34 L8 29 L24 24 Z'/%3E%3C/svg%3E"); }
  /* Vignette, so text laid over the edges keeps its contrast. */
  .vig { position:absolute; inset:0;
    background:radial-gradient(ellipse 80% 65% at 50% 42%, transparent 45%, rgba(196,175,140,.28) 100%); }
</style></head><body><div id="bg">
  ${blobs.map((b) => `<div class="blob" style="left:${b.x}%;top:${b.y}%;width:${b.r}%;height:${b.r * 0.8}%;background:${b.hue};opacity:${b.a}"></div>`).join("")}
  <div class="fold"></div>
  <div class="fold two"></div>
  ${motes.map((m) => `<div class="mote" style="left:${m.x}%;top:${m.y}%;width:${m.r}px;height:${m.r}px;opacity:${m.a};filter:blur(${m.blur}px)"></div>`).join("")}
  <div class="grain"></div>
  <div class="vig"></div>
</div></body></html>`;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.setContent(scene(), { waitUntil: "networkidle" });
await page.waitForTimeout(400);

// JPEG, not PNG: this is a photographic-style gradient field, where PNG costs
// several megabytes for no visible gain on a page opened over mobile data.
const file = path.join(OUT, "silk.jpg");
await page.screenshot({ path: file, type: "jpeg", quality: 86 });
await browser.close();
console.log(`done -> ${file}`);
